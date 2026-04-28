#Requires -Version 5.1
param(
    [string]$ApiBase = 'https://api-ain.looknet.ca/webhook',
    [string]$SseBase = 'https://sse-ain.looknet.ca'
)

$ErrorActionPreference = 'Stop'
$pass = 0; $fail = 0

function Write-Pass { param($msg) Write-Host "  [PASS] $msg" -ForegroundColor Green;  $script:pass++ }
function Write-Fail { param($msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red;    $script:fail++ }
function Write-Info { param($msg) Write-Host "         $msg" -ForegroundColor DarkGray }
function Section   { param($msg) Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

function Invoke-Api {
    param([string]$Url, [string]$Method = 'GET', [hashtable]$Headers = @{}, [string]$Body = '')
    try {
        $params = @{ Uri = $Url; Method = $Method; UseBasicParsing = $true; TimeoutSec = 15; Headers = $Headers }
        if ($Body) { $params.Body = $Body; $params.ContentType = 'application/json' }
        $r = Invoke-WebRequest @params
        return @{ ok = $true; status = [int]$r.StatusCode; body = $r.Content }
    } catch {
        $status = 0
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        return @{ ok = $false; status = $status; body = $_.ToString() }
    }
}

function From-Json { param($s) try { $s | ConvertFrom-Json } catch { $null } }

# ---------------------------------------------------------------------------
Section '/webhook/feed  (core poll endpoint)'

$r = Invoke-Api "$ApiBase/feed?limit=5"
if ($r.ok -and $r.status -eq 200) {
    Write-Pass "GET /feed 200 OK  ($($r.body.Length) bytes)"
    $j = From-Json $r.body
    if ($j.kills -and $j.kills.Count -gt 0) { Write-Pass "kills array present ($($j.kills.Count) items)" }
    else                                     { Write-Fail "kills array missing or empty" }
    if ($j.oldest_kill_id)                   { Write-Pass "pagination cursor present (oldest_kill_id=$($j.oldest_kill_id))" }
    else                                     { Write-Fail "oldest_kill_id missing" }
    if ($j.perf -and $j.perf.ms -ne $null)  { Write-Pass "perf.ms=$($j.perf.ms)ms" }
    else                                     { Write-Info "perf.ms not present" }
} else {
    Write-Fail "GET /feed returned $($r.status)"
    Write-Info $r.body
}

# ---------------------------------------------------------------------------
Section '/webhook/feed  (filter params used by feed.js)'

$cases = @(
    @{ qs = 'limit=3&filters_space=nullsec';    label = 'space filter' }
    @{ qs = 'limit=3&filters_isk=100m-1b';      label = 'isk filter' }
    @{ qs = 'limit=3&filters_main=hide-pods';   label = 'hide-pods filter' }
    @{ qs = 'limit=3&search_query=Jita';        label = 'search_query' }
    @{ qs = 'limit=3&before_kill_id=135073392'; label = 'pagination (before_kill_id)' }
)
foreach ($c in $cases) {
    $r = Invoke-Api "$ApiBase/feed?$($c.qs)"
    if ($r.ok -and $r.status -eq 200) {
        $j = From-Json $r.body
        # kills can be an empty array (valid), ConvertFrom-Json turns [] into $null
        $hasKills = ($j.PSObject.Properties.Name -contains 'kills')
        if ($hasKills) { Write-Pass "$($c.label) -> 200, kills=$(@($j.kills).Count)" }
        else           { Write-Fail "$($c.label) -> 200 but no kills key in response" }
    } else {
        Write-Fail "$($c.label) -> $($r.status)"
    }
}

# ---------------------------------------------------------------------------
Section '/webhook/stats  (regression check)'

$r = Invoke-Api "$ApiBase/stats"
if ($r.ok -and $r.status -eq 200) {
    Write-Pass "GET /stats 200 OK"
    $j = From-Json $r.body
    if ($j.total_count -gt 0)     { Write-Pass "total_count=$($j.total_count)" }
    else                           { Write-Fail "total_count missing or zero" }
    if ($j.stats_24h.kills -gt 0) { Write-Pass "stats_24h.kills=$($j.stats_24h.kills)" }
    else                           { Write-Fail "stats_24h.kills missing" }
    if ($j.activity_heatmap)      { Write-Pass "activity_heatmap present" }
    else                           { Write-Fail "activity_heatmap missing" }
    if ($j.latest_db_killmail_time) {
        $age = (Get-Date) - [datetime]$j.latest_db_killmail_time
        if ($age.TotalMinutes -lt 30) { Write-Pass "data is fresh (latest kill $([int]$age.TotalMinutes) min ago)" }
        else                          { Write-Fail "data may be stale (latest kill $([int]$age.TotalMinutes) min ago)" }
    }
} else {
    Write-Fail "GET /stats returned $($r.status)"
}

# ---------------------------------------------------------------------------
Section '/webhook/search  (regression check)'

$r = Invoke-Api "$ApiBase/search?q=Jita"
if ($r.ok -and $r.status -eq 200) {
    Write-Pass "GET /search?q=Jita 200 OK"
    $j = From-Json $r.body
    if ($j.name -or $j.matches_found) { Write-Pass "result returned: $($j.name)" }
    else                               { Write-Fail "no result fields in response" }
} else {
    Write-Fail "GET /search returned $($r.status)"
}

$r = Invoke-Api "$ApiBase/search?q="
if ($r.status -in 200,400,422) { Write-Pass "empty search_query handled (HTTP $($r.status))" }
else                            { Write-Fail "empty search_query returned unexpected $($r.status)" }

# ---------------------------------------------------------------------------
Section '/webhook/r2z2-stats  (ingestion pipeline health)'

$r = Invoke-Api "$ApiBase/r2z2-stats"
if ($r.ok -and $r.status -eq 200) {
    Write-Pass "GET /r2z2-stats 200 OK"
    $j = From-Json $r.body
    if ($j.status -eq 'active') { Write-Pass "r2z2 status=active" }
    else                         { Write-Fail "r2z2 status=$($j.status)" }
    if ($j.metrics.last_run) {
        $age = (Get-Date) - [datetime]$j.metrics.last_run
        if ($age.TotalMinutes -lt 5) { Write-Pass "last_run $([int]$age.TotalSeconds)s ago" }
        else                          { Write-Fail "last_run $([int]$age.TotalMinutes) min ago - pipeline may be stalled" }
    }
    if ($j.metrics.current_kpm) {
        $kpm = [double]$j.metrics.current_kpm
        if ($kpm -gt 0) { Write-Pass "current_kpm=$kpm" }
        else             { Write-Info "current_kpm=0 (may be quiet period)" }
    }
} else {
    Write-Fail "GET /r2z2-stats returned $($r.status)"
}

# ---------------------------------------------------------------------------
Section '/webhook/system  (SYSTEM_INTEL - POST only)'

$r = Invoke-Api "$ApiBase/system"
if ($r.status -in 400,404,405) { Write-Pass "GET /system correctly rejected (HTTP $($r.status))" }
elseif ($r.status -eq 200)     { Write-Info "GET /system returned 200 - endpoint may accept GET now" }
else                            { Write-Fail "GET /system returned unexpected $($r.status)" }

$sysBody = '{"system_id":30000142}'
$r = Invoke-Api "$ApiBase/system" -Method POST -Body $sysBody
if ($r.ok -and $r.status -eq 200) {
    Write-Pass "POST /system 200 OK"
    $j = From-Json $r.body
    if ($j.solar_system_name -or $j.system_name -or $j.name) { Write-Pass "system name present" }
    else { Write-Info "response shape: $($r.body.Substring(0, [Math]::Min(120, $r.body.Length)))" }
} elseif ($r.status -in 400,404) {
    Write-Info "POST /system returned $($r.status) - may need different payload shape"
    Write-Info $r.body.Substring(0, [Math]::Min(200, $r.body.Length))
} else {
    Write-Fail "POST /system returned $($r.status)"
}

# ---------------------------------------------------------------------------
Section 'SSE server  (sse-ain.looknet.ca)'

$r = Invoke-Api "$SseBase/health"
if ($r.ok -and $r.status -eq 200) {
    Write-Pass "SSE /health 200 OK"
    $j = From-Json $r.body
    if ($j.status -eq 'ok') { Write-Pass "status=ok, clients=$($j.clients)" }
    else                     { Write-Fail "unexpected status: $($j.status)" }

    $rBad = Invoke-Api "$SseBase/publish" -Method POST -Headers @{ 'X-Publish-Secret' = 'wrong' } -Body '{}'
    if ($rBad.status -eq 401) { Write-Pass "/publish rejects wrong secret (401)" }
    else                       { Write-Fail "/publish wrong secret returned $($rBad.status)" }
} else {
    Write-Fail "SSE /health returned $($r.status) at $SseBase"
    Write-Info $r.body
}

# ---------------------------------------------------------------------------
Section '/webhook/dashboard-intel  (AlfredInt monitoring dashboard)'

$r = Invoke-Api "$ApiBase/dashboard-intel"
if ($r.ok -and $r.status -eq 200) {
    Write-Pass "GET /dashboard-intel 200 OK"
    $j = From-Json $r.body
    if ($j.overview)                          { Write-Pass "overview block present" }
    else                                       { Write-Fail "overview block missing" }
    if ($j.overview.PSObject.Properties.Name -contains 'active_pilots_now') {
                                               Write-Pass "active_pilots_now=$($j.overview.active_pilots_now)" }
    else                                       { Write-Fail "active_pilots_now missing" }
    if ($null -ne $j.top_users)               { Write-Pass "top_users present ($(@($j.top_users).Count) entries)" }
    else                                       { Write-Fail "top_users missing" }
    if ($null -ne $j.timeline)                { Write-Pass "timeline present ($(@($j.timeline).Count) buckets)" }
    else                                       { Write-Fail "timeline missing" }
    # Verify connection_type field is present on at least one top user (SSE badge support)
    $firstUser = @($j.top_users)[0]
    if ($firstUser -and $firstUser.PSObject.Properties.Name -contains 'connection_type') {
                                               Write-Pass "connection_type field present on top user" }
    else                                       { Write-Info "connection_type field missing (no active users or workflow not updated)" }
} else {
    Write-Fail "GET /dashboard-intel returned $($r.status)"
    Write-Info $r.body.Substring(0, [Math]::Min(200, $r.body.Length))
}

# ---------------------------------------------------------------------------
Section '/webhook/sse-presence  (SSE monitoring presence ping)'

$presenceBody = '{"view":"compact","query":{"filters_space":"nullsec"},"fingerprint":"pilot_testbackend"}'
$r = Invoke-Api "$ApiBase/sse-presence" -Method POST -Body $presenceBody
if ($r.ok -and $r.status -eq 200) {
    Write-Pass "POST /sse-presence 200 OK"
    $j = From-Json $r.body
    if ($j.ok -eq $true) { Write-Pass "response ok=true" }
    else                  { Write-Fail "response ok != true: $($r.body.Substring(0,[Math]::Min(120,$r.body.Length)))" }
} else {
    Write-Fail "POST /sse-presence returned $($r.status)"
    Write-Info $r.body.Substring(0, [Math]::Min(200, $r.body.Length))
}

# ---------------------------------------------------------------------------
$total = $pass + $fail
Write-Host "`n--------------------------------------------------"
Write-Host "Results: " -NoNewline
Write-Host "$pass passed" -ForegroundColor Green -NoNewline
Write-Host "  /  " -NoNewline
Write-Host "$fail failed" -ForegroundColor $(if ($fail -gt 0) { 'Red' } else { 'Green' })
Write-Host "--------------------------------------------------"
if ($fail -gt 0) { exit 1 }
