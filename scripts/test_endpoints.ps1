#Requires -Version 5.1
param(
    [string]$ApiBase = 'https://api-ain.looknet.ca/webhook',
    [string]$SseBase = 'https://sse-ain.looknet.ca'
)

$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$PassCount = 0
$FailCount = 0

function Write-Pass { param($msg) Write-Host "  [PASS] $msg" -ForegroundColor Green;  $script:PassCount++ }
function Write-Fail { param($msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red;    $script:FailCount++ }
function Write-Info { param($msg) Write-Host "         $msg" -ForegroundColor DarkGray }
function Section   { param($msg) Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

function Invoke-Api {
    param(
        [string]$Url,
        [string]$Method  = 'GET',
        [hashtable]$Headers = @{},
        [string]$Body    = '',
        [int]$TimeoutSec = 20
    )
    try {
        $params = @{ Uri = $Url; Method = $Method; UseBasicParsing = $true; TimeoutSec = $TimeoutSec; Headers = $Headers }
        if ($Body) { $params.Body = $Body; $params.ContentType = 'application/json' }
        $r = Invoke-WebRequest @params
        return @{ ok = $true; Code = [int]$r.StatusCode; Body = $r.Content }
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        $body = ''
        if ($_.Exception.Response) {
            try { $body = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch {}
        }
        return @{ ok = $false; Code = $code; Body = $body; Err = $_.ToString() }
    }
}

function ConvertFrom-JsonSafe { param($s) try { $s | ConvertFrom-Json } catch { $null } }

function Test-Code {
    param([string]$Label, [hashtable]$Resp, [int[]]$Expected)
    $passed = $Expected -contains $Resp.Code
    $detail = "HTTP $($Resp.Code)"
    if ($passed) { Write-Pass "$Label  ($detail)" } else { Write-Fail "$Label  (got $detail, expected $($Expected -join '|'))" }
    return $passed
}

function Test-Keys {
    param([string]$Label, [hashtable]$Resp, [string[]]$Keys)
    try {
        $obj     = $Resp.Body | ConvertFrom-Json
        $missing = $Keys | Where-Object { -not ($obj.PSObject.Properties.Name -contains $_) }
        if ($missing) { Write-Fail "$Label  (missing: $($missing -join ', '))" }
        else          { Write-Pass "$Label  (keys: $($Keys -join ', '))" }
    } catch { Write-Fail "$Label  (JSON parse error)" }
}

# ---------------------------------------------------------------------------
Section '/health'

$r = Invoke-Api "$ApiBase/../health"
if ($r.ok -and $r.Code -eq 200) { Write-Pass "/health 200 OK" }
else { Write-Info "/health not reachable at $ApiBase (may not be proxied -- skipping)" }

# ---------------------------------------------------------------------------
Section '/webhook/r2z2-stats  (ingestion pipeline health)'

$sw = [Diagnostics.Stopwatch]::StartNew()
$r  = Invoke-Api "$ApiBase/r2z2-stats"
$sw.Stop()
Test-Code '/r2z2-stats -> 200' $r @(200)
if ($r.ok) {
    Test-Keys '/r2z2-stats shape' $r @('status','metrics','summary')
    $j      = ConvertFrom-JsonSafe $r.Body
    $latCol = if ($sw.ElapsedMilliseconds -lt 500) { 'Green' } elseif ($sw.ElapsedMilliseconds -lt 1500) { 'Yellow' } else { 'Red' }
    Write-Info "status=$($j.status)  heartbeat_ttl=$($j.heartbeat_ttl)s"
    Write-Host "         response: " -NoNewline -ForegroundColor DarkGray
    Write-Host "$($sw.ElapsedMilliseconds)ms" -ForegroundColor $latCol
    if ($j.summary) {
        Write-Info "current_kpm=$($j.summary.current_kpm)  total_runs=$($j.summary.total_runs)  uptime=$($j.summary.uptime_minutes)min"
    }
    if ($j.status -eq 'active') { Write-Pass "r2z2 ingestion is active" }
    else { Write-Fail "r2z2 status=$($j.status) (pipeline may be stalled)" }
}

# ---------------------------------------------------------------------------
Section '/webhook/feed  (core poll endpoint)'

$sw = [Diagnostics.Stopwatch]::StartNew()
$r  = Invoke-Api "$ApiBase/feed?limit=10"
$sw.Stop()
Test-Code '/feed?limit=10 -> 200' $r @(200)
if ($r.ok) {
    Test-Keys '/feed response shape' $r @('kills','oldest_kill_id','isk_distribution','partial_result','end_of_results')
    $j      = ConvertFrom-JsonSafe $r.Body
    $latCol = if ($sw.ElapsedMilliseconds -lt 500) { 'Green' } elseif ($sw.ElapsedMilliseconds -lt 1500) { 'Yellow' } else { 'Red' }
    Write-Host "         response: " -NoNewline -ForegroundColor DarkGray
    Write-Host "$($sw.ElapsedMilliseconds)ms" -ForegroundColor $latCol
    Write-Info "kills=$(@($j.kills).Count)  partial=$($j.partial_result)  end=$($j.end_of_results)"
    if ($j.partial_result -eq $true) { Write-Info "[WARN] partial_result=true -- feed timed out scanning" }

    # Pagination
    if ($j.oldest_kill_id) {
        $r2 = Invoke-Api "$ApiBase/feed?before_kill_id=$($j.oldest_kill_id)&limit=5"
        Test-Code '/feed pagination (before_kill_id) -> 200' $r2 @(200)
    }
}

# Live update mode -- nonexistent ID should return empty, not 500
$r3 = Invoke-Api "$ApiBase/feed?latest_known_id=99999999999&limit=10"
Test-Code '/feed?latest_known_id=nonexistent -> 200' $r3 @(200)

# Filter params
foreach ($case in @(
    @{ qs = 'limit=3&filters_space=ns';          label = 'space filter (ns)' }
    @{ qs = 'limit=3&filters_isk=1b-10b';        label = 'isk filter (1b-10b)' }
    @{ qs = 'limit=3&filters_main=hide-pods';    label = 'hide-pods filter' }
    @{ qs = 'limit=3&search_query=Jita';         label = 'search_query=Jita' }
    @{ qs = 'limit=3&lurker=true';               label = 'lurker mode' }
)) {
    $r4 = Invoke-Api "$ApiBase/feed?$($case.qs)"
    Test-Code "/feed?$($case.label)" $r4 @(200)
}

# Latency budget (warm cache)
Invoke-Api "$ApiBase/feed?limit=50" | Out-Null
$sw2 = [Diagnostics.Stopwatch]::StartNew()
Invoke-Api "$ApiBase/feed?limit=50" | Out-Null
$sw2.Stop()
$budget = $sw2.ElapsedMilliseconds
if ($budget -lt 2500) { Write-Pass "/feed 50 kills warm-cache under 2500ms  (${budget}ms)" }
else                   { Write-Fail "/feed 50 kills warm-cache budget exceeded  (${budget}ms)" }

# ---------------------------------------------------------------------------
Section '/webhook/stats'

$sw = [Diagnostics.Stopwatch]::StartNew()
$r  = Invoke-Api "$ApiBase/stats"
$sw.Stop()
Test-Code '/stats -> 200' $r @(200)
if ($r.ok) {
    $j      = ConvertFrom-JsonSafe $r.Body
    $latCol = if ($sw.ElapsedMilliseconds -lt 800) { 'Green' } elseif ($sw.ElapsedMilliseconds -lt 2000) { 'Yellow' } else { 'Red' }
    Write-Host "         response: " -NoNewline -ForegroundColor DarkGray
    Write-Host "$($sw.ElapsedMilliseconds)ms" -ForegroundColor $latCol
    Write-Info "keys: $(@($j.PSObject.Properties.Name) -join ', ')"
    if ($j.total_count -gt 0)      { Write-Pass "total_count=$($j.total_count)" }
    else                            { Write-Fail "total_count missing or zero" }
    if ($j.stats_24h.kills -gt 0)  { Write-Pass "stats_24h.kills=$($j.stats_24h.kills)" }
    else                            { Write-Fail "stats_24h.kills missing" }
    if ($j.activity_heatmap)        { Write-Pass "activity_heatmap present" }
    else                            { Write-Fail "activity_heatmap missing" }
}

$r5 = Invoke-Api "$ApiBase/stats?alliance_id=99000006"
Test-Code '/stats?alliance_id= -> 200' $r5 @(200)

# ---------------------------------------------------------------------------
Section '/webhook/search'

$sw = [Diagnostics.Stopwatch]::StartNew()
$r  = Invoke-Api "$ApiBase/search?q=Jita"
$sw.Stop()
Test-Code '/search?q=Jita -> 200' $r @(200)
if ($r.ok) {
    $j      = ConvertFrom-JsonSafe $r.Body
    $latCol = if ($sw.ElapsedMilliseconds -lt 500) { 'Green' } elseif ($sw.ElapsedMilliseconds -lt 1500) { 'Yellow' } else { 'Red' }
    Write-Host "         response: " -NoNewline -ForegroundColor DarkGray
    Write-Host "$($sw.ElapsedMilliseconds)ms" -ForegroundColor $latCol
    Write-Info "result count: $(@($j).Count)"
}

$r6 = Invoke-Api "$ApiBase/search?q=J"
Test-Code '/search?q=J (1 char) -> 200 or 400' $r6 @(200, 400)

$r7 = Invoke-Api "$ApiBase/search?q=Amarr&multi=true"
Test-Code '/search?q=Amarr&multi=true -> 200' $r7 @(200)

$r8 = Invoke-Api "$ApiBase/search"
Test-Code '/search (no q param) -> 200 or 400' $r8 @(200, 400, 500)

# ---------------------------------------------------------------------------
Section '/webhook/dashboard-intel  (AlfredInt monitoring)'

$sw = [Diagnostics.Stopwatch]::StartNew()
$r  = Invoke-Api "$ApiBase/dashboard-intel"
$sw.Stop()
Test-Code '/dashboard-intel -> 200' $r @(200)
if ($r.ok) {
    Test-Keys '/dashboard-intel shape' $r @('overview','top_users','timeline')
    $j      = ConvertFrom-JsonSafe $r.Body
    $latCol = if ($sw.ElapsedMilliseconds -lt 800) { 'Green' } elseif ($sw.ElapsedMilliseconds -lt 2000) { 'Yellow' } else { 'Red' }
    Write-Host "         response: " -NoNewline -ForegroundColor DarkGray
    Write-Host "$($sw.ElapsedMilliseconds)ms" -ForegroundColor $latCol
    Write-Info "active_pilots_now=$($j.overview.active_pilots_now)  total_tracked=$($j.overview.total_tracked)"
    $firstUser = @($j.top_users)[0]
    if ($firstUser -and $firstUser.PSObject.Properties.Name -contains 'connection_type') { Write-Pass "connection_type field present on top user" }
    else { Write-Info "connection_type field missing (no active users)" }
}

# ---------------------------------------------------------------------------
Section '/webhook/system  (POST only)'

$r = Invoke-Api "$ApiBase/system" -Method GET
if ($r.Code -in @(400,404,405)) { Write-Pass "GET /system correctly rejected (HTTP $($r.Code))" }
else { Write-Info "GET /system returned $($r.Code)" }

$sw = [Diagnostics.Stopwatch]::StartNew()
$r9 = Invoke-Api "$ApiBase/system" -Method POST -Body '{"query_name":"Jita","query_type":"system"}'
$sw.Stop()
Test-Code 'POST /system {query_name=Jita} -> 200' $r9 @(200)
if ($r9.ok) {
    $j      = ConvertFrom-JsonSafe $r9.Body
    $latCol = if ($sw.ElapsedMilliseconds -lt 1000) { 'Green' } elseif ($sw.ElapsedMilliseconds -lt 3000) { 'Yellow' } else { 'Red' }
    Write-Host "         response: " -NoNewline -ForegroundColor DarkGray
    Write-Host "$($sw.ElapsedMilliseconds)ms" -ForegroundColor $latCol
    $td = $j.templated_response_data
    if ($td) { Write-Info "system=$($td.query_name)  security=$($td.security_class)  threat=$($td.threat_level)" }
}

$r10 = Invoke-Api "$ApiBase/system" -Method POST -Body '{"query_name":"The Forge","query_type":"region"}'
Test-Code 'POST /system {query_type=region} -> 200 or 400' $r10 @(200, 400)

$r11 = Invoke-Api "$ApiBase/system" -Method POST -Body '{}'
Test-Code 'POST /system (empty body) -> 400 or 500' $r11 @(400, 500)

# ---------------------------------------------------------------------------
Section '/webhook/sse-presence  (SSE monitoring)'

$presenceBody = '{"view":"compact","query":{"filters_space":"nullsec"},"fingerprint":"pilot_testendpoints"}'
$r  = Invoke-Api "$ApiBase/sse-presence" -Method POST -Body $presenceBody
Test-Code 'POST /sse-presence -> 200' $r @(200)
if ($r.ok) {
    $j = ConvertFrom-JsonSafe $r.Body
    if ($j.ok -eq $true) { Write-Pass "response ok=true" }
    else                  { Write-Fail "response ok != true" }
}

# ---------------------------------------------------------------------------
Section '/webhook/killmail-dashboard  (may be disabled)'

$sw = [Diagnostics.Stopwatch]::StartNew()
$r  = Invoke-Api "$ApiBase/killmail-dashboard?limit=10"
$sw.Stop()
Test-Code '/killmail-dashboard -> 200 or 404' $r @(200, 404)
if ($r.Code -eq 200) {
    $j      = ConvertFrom-JsonSafe $r.Body
    $latCol = if ($sw.ElapsedMilliseconds -lt 300) { 'Green' } elseif ($sw.ElapsedMilliseconds -lt 800) { 'Yellow' } else { 'Red' }
    Write-Host "         response: " -NoNewline -ForegroundColor DarkGray
    Write-Host "$($sw.ElapsedMilliseconds)ms" -ForegroundColor $latCol
    Write-Info "kills=$(@($j.kills).Count)"
} elseif ($r.Code -eq 404) {
    Write-Info "[INFO] 404 expected if ain-api is not yet routing this endpoint"
}

# ---------------------------------------------------------------------------
Section 'SSE server  (internal only - skipped when no SseBase provided)'

if ($SseBase -and $SseBase -ne 'https://sse-ain.looknet.ca') {
    $r = Invoke-Api "$SseBase/health"
    Test-Code 'SSE /health -> 200' $r @(200)
    if ($r.ok) {
        $j = ConvertFrom-JsonSafe $r.Body
        if ($j.status -eq 'ok') { Write-Pass "SSE status=ok  clients=$($j.clients)" }
        else                     { Write-Fail "SSE unexpected status: $($j.status)" }

        $rBad = Invoke-Api "$SseBase/publish" -Method POST -Headers @{ 'X-Publish-Secret' = 'wrong' } -Body '{}'
        if ($rBad.Code -eq 401) { Write-Pass "/publish rejects wrong secret (401)" }
        else                     { Write-Fail "/publish wrong secret returned $($rBad.Code)" }
    }
} else {
    Write-Info "SSE server is internal - pass -SseBase http://<host>:3001 to test it"
}

# ---------------------------------------------------------------------------
Section 'Latency regression (all endpoints)'

$endpoints = @(
    @{ Label = '/feed (default)';      Method = 'GET';  Url = "$ApiBase/feed?limit=20" }
    @{ Label = '/r2z2-stats';          Method = 'GET';  Url = "$ApiBase/r2z2-stats" }
    @{ Label = '/stats';               Method = 'GET';  Url = "$ApiBase/stats" }
    @{ Label = '/search?q=Jita';       Method = 'GET';  Url = "$ApiBase/search?q=Jita" }
    @{ Label = '/dashboard-intel';     Method = 'GET';  Url = "$ApiBase/dashboard-intel" }
)

foreach ($ep in $endpoints) {
    $sw   = [Diagnostics.Stopwatch]::StartNew()
    $resp = Invoke-Api $ep.Url -Method $ep.Method
    $sw.Stop()
    $ms       = $sw.ElapsedMilliseconds
    $ok       = $resp.Code -eq 200
    $latCol   = if ($ms -lt 500) { 'Green' } elseif ($ms -lt 1500) { 'Yellow' } else { 'Red' }
    $markCol  = if ($ok) { 'Green' } else { 'Red' }
    $mark     = if ($ok) { '[OK]  ' } else { '[FAIL]' }
    Write-Host "  $mark " -NoNewline -ForegroundColor $markCol
    Write-Host ("{0,-32}" -f $ep.Label) -NoNewline
    Write-Host "${ms}ms" -ForegroundColor $latCol
}

# ---------------------------------------------------------------------------
Write-Host "`n--------------------------------------------------"
Write-Host "Results: " -NoNewline
Write-Host "$PassCount passed" -ForegroundColor Green -NoNewline
Write-Host "  /  " -NoNewline
Write-Host "$FailCount failed" -ForegroundColor $(if ($FailCount -gt 0) { 'Red' } else { 'Green' })
Write-Host "--------------------------------------------------"
if ($FailCount -gt 0) { exit 1 }
