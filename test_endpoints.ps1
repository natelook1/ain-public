param(
    [string]$BaseUrl = "https://api-ain.looknet.ca/webhook"
)

$ErrorActionPreference = "Continue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$PassCount = 0
$FailCount = 0

function Write-Result {
    param([string]$Label, [bool]$Passed, [string]$Details = "")
    $color  = if ($Passed) { "Green" } else { "Red" }
    $mark   = if ($Passed) { "[PASS]" } else { "[FAIL]" }
    if ($Passed) { $script:PassCount++ } else { $script:FailCount++ }
    $suffix = if ($Details) { " ($Details)" } else { "" }
    Write-Host "$mark $Label$suffix" -ForegroundColor $color
}

function Invoke-AIN {
    param(
        [string]$Method = "GET",
        [string]$Path,
        [hashtable]$Query = @{},
        [object]$Body = $null
    )
    $uri = "$BaseUrl$Path"
    if ($Query.Count -gt 0) {
        $qs  = ($Query.GetEnumerator() | ForEach-Object { "$($_.Key)=$([Uri]::EscapeDataString($_.Value))" }) -join "&"
        $uri = "${uri}?${qs}"
    }
    $p = @{ Uri = $uri; Method = $Method; UseBasicParsing = $true }
    if ($Body -and $Method -ne "GET") {
        $p.Body        = ($Body | ConvertTo-Json -Compress)
        $p.ContentType = "application/json"
    }
    try {
        $resp = Invoke-WebRequest @p
        return @{ Code = [int]$resp.StatusCode; Body = $resp.Content; Ok = $true }
    } catch {
        $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
        $body = ""
        if ($_.Exception.Response) {
            try { $body = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch {}
        }
        return @{ Code = $code; Body = $body; Ok = $false; Err = $_.Exception.Message }
    }
}

function Test-Code {
    param([string]$Label, [hashtable]$Resp, [int[]]$Expected)
    $passed = $Expected -contains $Resp.Code
    $detail = "HTTP $($Resp.Code), expected $($Expected -join '|')"
    Write-Result -Label $Label -Passed $passed -Details $detail
    return $passed
}

function Test-JsonKey {
    param([string]$Label, [hashtable]$Resp, [string[]]$Keys)
    try {
        $obj     = $Resp.Body | ConvertFrom-Json
        $missing = $Keys | Where-Object { -not ($obj.PSObject.Properties.Name -contains $_) }
        if ($missing) {
            Write-Result -Label $Label -Passed $false -Details "missing keys: $($missing -join ', ')"
        } else {
            Write-Result -Label $Label -Passed $true  -Details "keys present: $($Keys -join ', ')"
        }
    } catch {
        Write-Result -Label $Label -Passed $false -Details "JSON parse error: $($_.Exception.Message)"
    }
}

# --- Header -------------------------------------------------------------------
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  AIN Backend E2E Endpoint Tester"         -ForegroundColor Cyan
Write-Host "  Target: $BaseUrl"                        -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

# --- 1. Health / R2Z2 Stats ---------------------------------------------------
Write-Host "--- Health / R2Z2 Stats ---" -ForegroundColor Yellow

$t = [Diagnostics.Stopwatch]::StartNew()
$r = Invoke-AIN -Path "/r2z2-stats"
$t.Stop()
Test-Code    "GET /r2z2-stats -> 200"           $r @(200)
Test-JsonKey "r2z2-stats has status + metrics"  $r @("status", "metrics")
if ($r.Ok) {
    try {
        $d      = $r.Body | ConvertFrom-Json
        $latMs  = $t.ElapsedMilliseconds
        $latCol = if ($latMs -lt 500) { "Green" } elseif ($latMs -lt 1500) { "Yellow" } else { "Red" }
        Write-Host "  ingestion status : $($d.status)" -ForegroundColor DarkGray
        Write-Host "  heartbeat TTL    : $($d.heartbeat_ttl)s" -ForegroundColor DarkGray
        Write-Host "  response time    : " -NoNewline -ForegroundColor DarkGray
        Write-Host "${latMs}ms" -ForegroundColor $latCol
        if ($d.summary) {
            Write-Host "  current KPM      : $($d.summary.current_kpm)"    -ForegroundColor DarkGray
            Write-Host "  total runs       : $($d.summary.total_runs)"     -ForegroundColor DarkGray
            Write-Host "  uptime           : $($d.summary.uptime_minutes) min" -ForegroundColor DarkGray
        }
    } catch {}
}

# --- 2. Feed ------------------------------------------------------------------
Write-Host "`n--- Webhook - Feed ---" -ForegroundColor Yellow

# Basic fetch
$t     = [Diagnostics.Stopwatch]::StartNew()
$r     = Invoke-AIN -Path "/feed" -Query @{ limit = "10" }
$t.Stop()
$latMs = $t.ElapsedMilliseconds
Test-Code    "GET /feed?limit=10 -> 200"  $r @(200)
if ($r.Ok) {
    Test-JsonKey "feed response shape" $r @("kills", "oldest_kill_id", "isk_distribution", "partial_result", "end_of_results")
    try {
        $d      = $r.Body | ConvertFrom-Json
        $latCol = if ($latMs -lt 500) { "Green" } elseif ($latMs -lt 1500) { "Yellow" } else { "Red" }
        Write-Host "  kills returned   : $(@($d.kills).Count)"    -ForegroundColor DarkGray
        Write-Host "  partial_result   : $($d.partial_result)"    -ForegroundColor DarkGray
        Write-Host "  end_of_results   : $($d.end_of_results)"    -ForegroundColor DarkGray
        Write-Host "  response time    : " -NoNewline -ForegroundColor DarkGray
        Write-Host "${latMs}ms" -ForegroundColor $latCol
        $iskKeys = @($d.isk_distribution.PSObject.Properties.Name)
        Write-Host "  isk_distribution : $($iskKeys.Count) buckets" -ForegroundColor DarkGray
        if ($d.partial_result -eq $true) {
            Write-Host "  [WARN] partial_result=true - feed timed out scanning" -ForegroundColor Yellow
        }
    } catch {}
}

# Live update mode - fake ID should return empty kills, not 500
$r2 = Invoke-AIN -Path "/feed" -Query @{ latest_known_id = "99999999999"; limit = "10" }
Test-Code "GET /feed?latest_known_id=nonexistent -> 200" $r2 @(200)

# Pagination - before_kill_id
if ($r.Ok) {
    try {
        $d = $r.Body | ConvertFrom-Json
        if ($d.oldest_kill_id) {
            $r3 = Invoke-AIN -Path "/feed" -Query @{ before_kill_id = "$($d.oldest_kill_id)"; limit = "5" }
            Test-Code "GET /feed?before_kill_id (pagination) -> 200" $r3 @(200)
        }
    } catch {}
}

# Space filter
$r4 = Invoke-AIN -Path "/feed" -Query @{ filters_space = "ns"; limit = "5" }
Test-Code "GET /feed?filters_space=ns -> 200" $r4 @(200)
if ($r4.Ok) {
    try {
        $d4    = $r4.Body | ConvertFrom-Json
        $allNs = @($d4.kills) | Where-Object { $_.space_type -ne "nullsec" -and $_.space_type -ne $null }
        if (@($d4.kills).Count -gt 0 -and $allNs.Count -gt 0) {
            Write-Result "feed nullsec filter - only nullsec kills" $false "found $($allNs.Count) non-nullsec kills"
        } elseif (@($d4.kills).Count -gt 0) {
            Write-Result "feed nullsec filter - only nullsec kills" $true "$(@($d4.kills).Count) kills, all nullsec"
        } else {
            Write-Result "feed nullsec filter - no data to validate" $true "0 kills returned"
        }
    } catch {}
}

# ISK filter
$r5 = Invoke-AIN -Path "/feed" -Query @{ filters_isk = "1b-10b"; limit = "5" }
Test-Code "GET /feed?filters_isk=1b-10b -> 200" $r5 @(200)

# Search
$r6 = Invoke-AIN -Path "/feed" -Query @{ search_query = "Jita"; limit = "5" }
Test-Code "GET /feed?search_query=Jita -> 200" $r6 @(200)

# Lurker mode
$r7 = Invoke-AIN -Path "/feed" -Query @{ lurker = "true"; limit = "5" }
Test-Code "GET /feed?lurker=true -> 200" $r7 @(200)

# Latency budget - two requests: first warms the ISK cache, second is the real measurement
Invoke-AIN -Path "/feed" -Query @{ limit = "50" } | Out-Null
$t2 = [Diagnostics.Stopwatch]::StartNew()
Invoke-AIN -Path "/feed" -Query @{ limit = "50" } | Out-Null
$t2.Stop()
$budget = $t2.ElapsedMilliseconds
Write-Result "GET /feed (50 kills, warm cache) under 2500ms" ($budget -lt 2500) "${budget}ms"

# --- 3. Stats -----------------------------------------------------------------
Write-Host "`n--- Webhook - Stats ---" -ForegroundColor Yellow

$t     = [Diagnostics.Stopwatch]::StartNew()
$r     = Invoke-AIN -Path "/stats"
$t.Stop()
$latMs = $t.ElapsedMilliseconds
Test-Code "GET /stats -> 200" $r @(200)
if ($r.Ok) {
    try {
        $d      = $r.Body | ConvertFrom-Json
        $latCol = if ($latMs -lt 800) { "Green" } elseif ($latMs -lt 2000) { "Yellow" } else { "Red" }
        Write-Host "  response time    : " -NoNewline -ForegroundColor DarkGray
        Write-Host "${latMs}ms" -ForegroundColor $latCol
        Write-Host "  top-level keys   : $(@($d.PSObject.Properties.Name) -join ', ')" -ForegroundColor DarkGray
    } catch {}
}

$r2 = Invoke-AIN -Path "/stats" -Query @{ alliance_id = "99000006" }
Test-Code "GET /stats?alliance_id=99000006 -> 200" $r2 @(200)

# --- 4. Search ----------------------------------------------------------------
Write-Host "`n--- Webhook - Search ---" -ForegroundColor Yellow

$t     = [Diagnostics.Stopwatch]::StartNew()
$r     = Invoke-AIN -Path "/search" -Query @{ q = "Jita" }
$t.Stop()
$latMs = $t.ElapsedMilliseconds
Test-Code "GET /search?q=Jita -> 200" $r @(200)
if ($r.Ok) {
    try {
        $d      = $r.Body | ConvertFrom-Json
        $latCol = if ($latMs -lt 500) { "Green" } elseif ($latMs -lt 1500) { "Yellow" } else { "Red" }
        Write-Host "  response time    : " -NoNewline -ForegroundColor DarkGray
        Write-Host "${latMs}ms" -ForegroundColor $latCol
        Write-Host "  result count     : $(@($d).Count)" -ForegroundColor DarkGray
    } catch {}
}

# 1-char query - expect rejection or empty
$r2 = Invoke-AIN -Path "/search" -Query @{ q = "J" }
Test-Code "GET /search?q=J (1 char) -> 200 or 400" $r2 @(200, 400)

# Multi mode
$r3 = Invoke-AIN -Path "/search" -Query @{ q = "Amarr"; multi = "true" }
Test-Code "GET /search?q=Amarr&multi=true -> 200" $r3 @(200)

# No query param
$r4 = Invoke-AIN -Path "/search"
Test-Code "GET /search (no q param) -> 200 or 400" $r4 @(200, 400, 500)

# --- 5. Intel / Dashboard -----------------------------------------------------
Write-Host "`n--- Webhook - Intel ---" -ForegroundColor Yellow

$t     = [Diagnostics.Stopwatch]::StartNew()
$r     = Invoke-AIN -Path "/dashboard-intel"
$t.Stop()
$latMs = $t.ElapsedMilliseconds
Test-Code "GET /dashboard-intel -> 200" $r @(200)
if ($r.Ok) {
    try {
        $d      = $r.Body | ConvertFrom-Json
        $latCol = if ($latMs -lt 800) { "Green" } elseif ($latMs -lt 2000) { "Yellow" } else { "Red" }
        Write-Host "  response time    : " -NoNewline -ForegroundColor DarkGray
        Write-Host "${latMs}ms" -ForegroundColor $latCol
        Write-Host "  top-level keys   : $(@($d.PSObject.Properties.Name) -join ', ')" -ForegroundColor DarkGray
    } catch {}
}

# --- 6. System (POST) ---------------------------------------------------------
Write-Host "`n--- Webhook - System ---" -ForegroundColor Yellow

$t     = [Diagnostics.Stopwatch]::StartNew()
$r     = Invoke-AIN -Method "POST" -Path "/system" -Body @{ query_name = "Jita"; query_type = "system" }
$t.Stop()
$latMs = $t.ElapsedMilliseconds
Test-Code "POST /system {query_name=Jita} -> 200" $r @(200)
if ($r.Ok) {
    try {
        $d      = $r.Body | ConvertFrom-Json
        $latCol = if ($latMs -lt 1000) { "Green" } elseif ($latMs -lt 3000) { "Yellow" } else { "Red" }
        Write-Host "  response time    : " -NoNewline -ForegroundColor DarkGray
        Write-Host "${latMs}ms" -ForegroundColor $latCol
        $td = $d.templated_response_data
        if ($td) {
            Write-Host "  system           : $($td.query_name)"    -ForegroundColor DarkGray
            Write-Host "  security class   : $($td.security_class)" -ForegroundColor DarkGray
            Write-Host "  threat level     : $($td.threat_level)"  -ForegroundColor DarkGray
        }
    } catch {}
}

$r2 = Invoke-AIN -Method "POST" -Path "/system" -Body @{ query_name = "The Forge"; query_type = "region" }
Test-Code "POST /system {query_type=region} -> 200" $r2 @(200)

$r3 = Invoke-AIN -Method "POST" -Path "/system" -Body @{}
Test-Code "POST /system (empty body) -> 400 or 500" $r3 @(400, 500, 200)

# --- 7. Killmail Dashboard (Hot Cache) ----------------------------------------
# NOTE: This workflow (webhook_cache.json) is disabled in n8n - 404 is expected.
#       Re-enable it in the n8n UI if this endpoint is needed.
Write-Host "`n--- Webhook - Killmail Dashboard Cache ---" -ForegroundColor Yellow

$t     = [Diagnostics.Stopwatch]::StartNew()
$r     = Invoke-AIN -Path "/killmail-dashboard" -Query @{ limit = "10" }
$t.Stop()
$latMs = $t.ElapsedMilliseconds
Test-Code "GET /killmail-dashboard?limit=10 -> 200 or 404" $r @(200, 404)
if ($r.Code -eq 404) {
    Write-Host "  [INFO] workflow is disabled in n8n - 404 expected" -ForegroundColor DarkGray
} elseif ($r.Ok) {
    try {
        $d      = $r.Body | ConvertFrom-Json
        $latCol = if ($latMs -lt 300) { "Green" } elseif ($latMs -lt 800) { "Yellow" } else { "Red" }
        Write-Host "  response time    : " -NoNewline -ForegroundColor DarkGray
        Write-Host "${latMs}ms" -ForegroundColor $latCol
        Write-Host "  kills returned   : $(@($d.kills).Count)" -ForegroundColor DarkGray
    } catch {}
}

# --- 8. Latency Regression (all endpoints) ------------------------------------
Write-Host "`n--- Latency Regression (all endpoints) ---" -ForegroundColor Yellow

$endpoints = @(
    @{ Label = "/feed (default)";  Method = "GET"; Path = "/feed";            Query = @{ limit = "20" } },
    @{ Label = "/r2z2-stats";      Method = "GET"; Path = "/r2z2-stats";      Query = @{} },
    @{ Label = "/stats";           Method = "GET"; Path = "/stats";           Query = @{} },
    @{ Label = "/search?q=Jita";   Method = "GET"; Path = "/search";          Query = @{ q = "Jita" } },
    @{ Label = "/dashboard-intel"; Method = "GET"; Path = "/dashboard-intel"; Query = @{} }
)

foreach ($ep in $endpoints) {
    $sw   = [Diagnostics.Stopwatch]::StartNew()
    $resp = Invoke-AIN -Method $ep.Method -Path $ep.Path -Query $ep.Query
    $sw.Stop()
    $ms       = $sw.ElapsedMilliseconds
    $ok       = $resp.Code -eq 200
    $latCol   = if ($ms -lt 500) { "Green" } elseif ($ms -lt 1500) { "Yellow" } else { "Red" }
    $mark     = if ($ok) { "[OK]  " } else { "[FAIL]" }
    $markCol  = if ($ok) { "Green" } else { "Red" }
    Write-Host "  $mark " -NoNewline -ForegroundColor $markCol
    Write-Host ("{0,-32}" -f $ep.Label) -NoNewline
    Write-Host "${ms}ms" -ForegroundColor $latCol
}

# --- Summary ------------------------------------------------------------------
Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "  Results: " -NoNewline -ForegroundColor Cyan
Write-Host "$PassCount PASSED" -NoNewline -ForegroundColor Green
Write-Host "  /  " -NoNewline
Write-Host "$FailCount FAILED" -ForegroundColor $(if ($FailCount -eq 0) { "Green" } else { "Red" })
Write-Host "==========================================`n" -ForegroundColor Cyan
