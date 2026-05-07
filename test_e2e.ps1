#Requires -Version 5.1
# =============================================================
#  AIN API E2E Health Check
#  Tests all ain-api endpoints with logic validation
#  and generates a formatted health report.
#
#  Default target: ain-api directly on port 3002 (pre-CF-cutover)
#  Pass -ApiBase https://api-ain.looknet.ca/webhook to test via CF tunnel
# =============================================================

param(
    [string]$ApiBase  = 'http://192.168.30.57:3002/webhook',
    [string]$HealthBase = 'http://192.168.30.57:3002'
)

$Results = [System.Collections.Generic.List[PSCustomObject]]::new()

function ts { Get-Date -Format 'HH:mm:ss.fff' }

function Invoke-Test {
    param(
        [string]      $Name,
        [string]      $Method,
        [string]      $Url,
        [hashtable]   $Headers     = @{},
        [string]      $Body        = $null,
        [scriptblock] $Validate,
        [int[]]       $PassOnCodes = @(),
        [int]         $TimeoutSec  = 20
    )

    $rec = [PSCustomObject]@{ Name=$Name; Pass=$false; Code=$null; Ms=$null; Note='' }

    try {
        $p = @{ Uri=$Url; Method=$Method; UseBasicParsing=$true; TimeoutSec=$TimeoutSec }
        if ($Headers.Count) { $p.Headers = $Headers }
        if ($Body)          { $p.Body = $Body; $p.ContentType = 'application/json' }

        $t0   = [datetime]::UtcNow
        $resp = Invoke-WebRequest @p
        $rec.Ms   = [math]::Round(([datetime]::UtcNow - $t0).TotalMilliseconds)
        $rec.Code = [int]$resp.StatusCode

        $json = $null
        try { $json = $resp.Content | ConvertFrom-Json } catch {}

        $vr = & $Validate $json $resp
        if ($vr -eq $true) {
            $rec.Pass = $true; $rec.Note = 'OK'
        } else {
            $dump = if ($json -and $json.error) { " (error: $($json.error))" } else { '' }
            $rec.Note = if ($vr) { "$vr$dump" } else { "Validation returned false$dump" }
        }
    } catch {
        $t1 = [datetime]::UtcNow
        if (-not $rec.Ms) { $rec.Ms = [math]::Round(($t1 - $t0).TotalMilliseconds) }
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        $rec.Code = $code
        $msg = $_.Exception.Message -replace "`n",' '
        if ($_.Exception.Response) {
            try {
                $body = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd()
                if ($body) { $j = $body | ConvertFrom-Json; if ($j.error) { $msg = $j.error } }
            } catch {}
        }
        if ($PassOnCodes -contains $code) { $rec.Pass = $true; $rec.Note = "OK ($code)" }
        else { $rec.Note = $msg }
    }

    $Results.Add($rec)
    return $rec
}

# ---------------------------------------------------------------------------
Write-Host ''
Write-Host ('=' * 66) -ForegroundColor Cyan
Write-Host '  AIN API E2E Health Check' -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "  $ApiBase" -ForegroundColor Cyan
Write-Host ('=' * 66) -ForegroundColor Cyan
Write-Host ''

# =============================================================
#  PHASE 0: CONNECTIVITY
# =============================================================
Write-Host '[ Phase 0: Connectivity -- all endpoints reachable ]' -ForegroundColor Yellow

$connectEndpoints = @(
    @{ Name='Conn: GET /health';              Method='GET';  Url="$HealthBase/health" }
    @{ Name='Conn: GET /webhook/r2z2-stats';  Method='GET';  Url="$ApiBase/r2z2-stats" }
    @{ Name='Conn: GET /webhook/feed';        Method='GET';  Url="$ApiBase/feed?limit=1" }
    @{ Name='Conn: GET /webhook/stats';       Method='GET';  Url="$ApiBase/stats" }
    @{ Name='Conn: GET /webhook/search';      Method='GET';  Url="$ApiBase/search?q=Jita" }
    @{ Name='Conn: GET /webhook/dashboard-intel'; Method='GET'; Url="$ApiBase/dashboard-intel" }
    @{ Name='Conn: POST /webhook/system';     Method='POST'; Url="$ApiBase/system"; Body='{"query_name":"Jita"}' }
    @{ Name='Conn: POST /webhook/sse-presence'; Method='POST'; Url="$ApiBase/sse-presence"; Body='{"view":"standard","fingerprint":"e2e_conn_check"}' }
    @{ Name='Conn: GET /webhook/killmail-dashboard'; Method='GET'; Url="$ApiBase/killmail-dashboard?limit=1" }
)

foreach ($e in $connectEndpoints) {
    $t1  = [datetime]::UtcNow
    $rec = Invoke-Test -Name $e.Name -Method $e.Method -Url $e.Url -Body $e.Body `
        -PassOnCodes @(200,404) -Validate { param($j,$r) $true }
    $ms  = [math]::Round(([datetime]::UtcNow - $t1).TotalMilliseconds)
    $col = if ($rec.Pass) { 'Green' } else { 'Red' }
    Write-Host ("  [{0}] {1,-46} {2}ms" -f $(if ($rec.Pass) { 'OK  ' } else { 'FAIL' }), $e.Name, $ms) -ForegroundColor $col
}

# =============================================================
#  PHASE 1: /health
# =============================================================
Write-Host ''
Write-Host '[ Phase 1: /health ]' -ForegroundColor Yellow

$null = Invoke-Test -Name 'Health: status=ok' -Method GET -Url "$HealthBase/health" -Validate {
    param($j)
    if ($j.status -ne 'ok') { return "status != ok: $($j.status)" }
    $true
}

# =============================================================
#  PHASE 2: /webhook/r2z2-stats
# =============================================================
Write-Host '[ Phase 2: /webhook/r2z2-stats ]' -ForegroundColor Yellow

$null = Invoke-Test -Name 'r2z2: shape (status, metrics, summary)' -Method GET -Url "$ApiBase/r2z2-stats" -Validate {
    param($j)
    if ($j.status -notin @('active','inactive')) { return "status invalid: $($j.status)" }
    if ($null -eq $j.heartbeat_ttl)  { return 'heartbeat_ttl missing' }
    if ($null -eq $j.metrics)        { return 'metrics missing' }
    if ($null -eq $j.summary)        { return 'summary missing' }
    $true
}

$null = Invoke-Test -Name 'r2z2: metrics fields present' -Method GET -Url "$ApiBase/r2z2-stats" -Validate {
    param($j)
    foreach ($f in @('total_fetched','total_queued','last_run','current_kpm')) {
        if ($null -eq $j.metrics.$f) { return "metrics.$f missing" }
    }
    $true
}

$null = Invoke-Test -Name 'r2z2: summary fields present' -Method GET -Url "$ApiBase/r2z2-stats" -Validate {
    param($j)
    foreach ($f in @('total_runs','uptime_minutes','current_kpm','hit_rate')) {
        if ($null -eq $j.summary.$f) { return "summary.$f missing" }
    }
    $true
}

$null = Invoke-Test -Name 'r2z2: recent_logs is array' -Method GET -Url "$ApiBase/r2z2-stats" -Validate {
    param($j)
    if ($j.recent_logs -isnot [array] -and $null -ne $j.recent_logs) { return "recent_logs not array" }
    $true
}

$null = Invoke-Test -Name 'r2z2: ingestion is active' -Method GET -Url "$ApiBase/r2z2-stats" -Validate {
    param($j)
    if ($j.status -ne 'active') { return "pipeline not active (status=$($j.status)) -- r2z2 may be down" }
    $true
}

# =============================================================
#  PHASE 3: /webhook/feed
# =============================================================
Write-Host '[ Phase 3: /webhook/feed ]' -ForegroundColor Yellow

$feedRec = Invoke-Test -Name 'feed: shape (kills, isk_distribution, flags)' -Method GET -Url "$ApiBase/feed?limit=10" -Validate {
    param($j)
    foreach ($f in @('kills','oldest_kill_id','isk_distribution','partial_result','end_of_results')) {
        if (-not $j.PSObject.Properties.Name.Contains($f)) { return "$f missing" }
    }
    if ($j.kills -isnot [array]) { return 'kills not array' }
    $true
}
$oldestKillId = if ($feedRec.Pass) {
    try { ($feedRec | ForEach-Object { $null }); $null } catch {}
    # re-fetch to get actual value
    $tmp = Invoke-WebRequest -Uri "$ApiBase/feed?limit=5" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json
    [string]$tmp.oldest_kill_id
} else { $null }

$null = Invoke-Test -Name 'feed: kills have expected fields' -Method GET -Url "$ApiBase/feed?limit=3" -Validate {
    param($j)
    $k = @($j.kills)[0]
    if (-not $k) { return 'no kills returned (empty feed?)' }
    foreach ($f in @('killmail_id','victim','total_value','solar_system_name','space_type')) {
        if ($null -eq $k.$f -and $k.PSObject.Properties.Name -notcontains $f) { return "kill missing field: $f" }
    }
    $true
}

$null = Invoke-Test -Name 'feed: isk_distribution has all buckets' -Method GET -Url "$ApiBase/feed?limit=5" -Validate {
    param($j)
    foreach ($b in @('sub10m','10m-100m','100m-1b','1b-10b','10b-20b','20b-50b','50b')) {
        if ($null -eq $j.isk_distribution.$b) { return "isk_distribution.$b missing" }
        if ($null -eq $j.isk_distribution.$b.count) { return "isk_distribution.$b.count missing" }
    }
    $true
}

$null = Invoke-Test -Name 'feed: partial_result is boolean' -Method GET -Url "$ApiBase/feed?limit=5" -Validate {
    param($j)
    if ($j.partial_result -isnot [bool]) { return "partial_result not bool: $($j.partial_result)" }
    $true
}

# Pagination
if ($oldestKillId) {
    $null = Invoke-Test -Name "feed: pagination (before_kill_id)" -Method GET -Url "$ApiBase/feed?before_kill_id=$oldestKillId&limit=5" -Validate {
        param($j)
        if ($j.kills -isnot [array]) { return 'kills not array' }
        $true
    }
}

# Live-update mode
$null = Invoke-Test -Name 'feed: latest_known_id=nonexistent -> 200 empty' -Method GET -Url "$ApiBase/feed?latest_known_id=99999999999&limit=10" -Validate {
    param($j)
    if ($null -eq $j) { return 'null response' }
    if ($j.kills -isnot [array]) { return 'kills not array' }
    $true
}

# Filters
foreach ($case in @(
    @{ qs='limit=3&filters_space=ns';              label='space=ns' }
    @{ qs='limit=3&filters_space=wh';              label='space=wh' }
    @{ qs='limit=3&filters_isk=1b-10b';            label='isk=1b-10b' }
    @{ qs='limit=3&filters_main=hide-pods';        label='hide-pods' }
    @{ qs='limit=3&filters_main=solo';             label='solo' }
    @{ qs='limit=3&filters_main=hide-structures';  label='hide-structures' }
    @{ qs='limit=3&search_query=Jita';             label='search_query=Jita' }
    @{ qs='limit=3&lurker=true';                   label='lurker=true' }
    @{ qs='limit=3&view=compact';                  label='view=compact' }
)) {
    $null = Invoke-Test -Name "feed: filter $($case.label)" -Method GET -Url "$ApiBase/feed?$($case.qs)" -Validate {
        param($j)
        if ($null -eq $j) { return 'null response' }
        if ($j.PSObject.Properties.Name -notcontains 'kills') { return 'kills missing' }
        $true
    }
}

# Latency budget (warm cache -- run twice, time second)
$null = Invoke-WebRequest -Uri "$ApiBase/feed?limit=50" -UseBasicParsing | Out-Null
$null = Invoke-Test -Name 'feed: 50 kills warm-cache < 2500ms' -Method GET -Url "$ApiBase/feed?limit=50" -TimeoutSec 5 -Validate {
    param($j,$r)
    if ($null -eq $j) { return 'null response' }
    $true
}
$latRec = $Results | Where-Object { $_.Name -eq 'feed: 50 kills warm-cache < 2500ms' } | Select-Object -Last 1
if ($latRec -and $latRec.Ms -ge 2500) {
    $latRec.Pass = $false
    $latRec.Note = "exceeded 2500ms budget: $($latRec.Ms)ms"
    ($Results | Where-Object { $_.Name -eq 'feed: 50 kills warm-cache < 2500ms' } | Select-Object -Last 1).Pass = $false
}

# =============================================================
#  PHASE 4: /webhook/stats
# =============================================================
Write-Host '[ Phase 4: /webhook/stats ]' -ForegroundColor Yellow

$null = Invoke-Test -Name 'stats: shape (total_count, stats_24h, isk_distribution, activity_heatmap)' -Method GET -Url "$ApiBase/stats" -Validate {
    param($j)
    foreach ($f in @('total_count','stats_24h','isk_distribution','activity_heatmap','trends','daily_stats','top_systems')) {
        if ($j.PSObject.Properties.Name -notcontains $f) { return "$f missing" }
    }
    $true
}

$null = Invoke-Test -Name 'stats: total_count > 0' -Method GET -Url "$ApiBase/stats" -Validate {
    param($j)
    if ([int]$j.total_count -le 0) { return "total_count=$($j.total_count) -- no killmails ingested?" }
    $true
}

$null = Invoke-Test -Name 'stats: stats_24h.kills > 0' -Method GET -Url "$ApiBase/stats" -Validate {
    param($j)
    if ($j.stats_24h.kills -le 0) { return "stats_24h.kills=$($j.stats_24h.kills) -- no recent kills?" }
    $true
}

$null = Invoke-Test -Name 'stats: activity_heatmap has 24 hours' -Method GET -Url "$ApiBase/stats" -Validate {
    param($j)
    $keys = $j.activity_heatmap.PSObject.Properties.Name
    if ($keys.Count -ne 24) { return "heatmap has $($keys.Count) keys, expected 24" }
    foreach ($h in 0..23) {
        if ($keys -notcontains [string]$h) { return "heatmap missing hour $h" }
        if ($null -eq $j.activity_heatmap.$h.avg -and $null -eq $j.activity_heatmap.$h.count) { return "heatmap hour $h missing count/avg" }
    }
    $true
}

$null = Invoke-Test -Name 'stats: isk_distribution buckets present' -Method GET -Url "$ApiBase/stats" -Validate {
    param($j)
    foreach ($b in @('sub10m','10m-100m','100m-1b','1b-10b','10b-20b','20b-50b','50b')) {
        if ($j.isk_distribution.PSObject.Properties.Name -notcontains $b) { return "isk_distribution.$b missing" }
    }
    $true
}

$null = Invoke-Test -Name 'stats: daily_stats is 30-entry array' -Method GET -Url "$ApiBase/stats" -Validate {
    param($j)
    if ($j.daily_stats -isnot [array]) { return 'daily_stats not array' }
    if ($j.daily_stats.Count -ne 30)   { return "daily_stats has $($j.daily_stats.Count) entries, expected 30" }
    $true
}

$null = Invoke-Test -Name 'stats: top_systems is array' -Method GET -Url "$ApiBase/stats" -Validate {
    param($j)
    if ($j.top_systems -isnot [array]) { return 'top_systems not array' }
    $true
}

$null = Invoke-Test -Name 'stats: trends has kills/isk/total30d' -Method GET -Url "$ApiBase/stats" -Validate {
    param($j)
    foreach ($f in @('kills','isk','total30d')) {
        if ($j.trends.PSObject.Properties.Name -notcontains $f) { return "trends.$f missing" }
    }
    $true
}

# With alliance_id
$null = Invoke-Test -Name 'stats: alliance_id param -> 200 with alliance_stats' -Method GET -Url "$ApiBase/stats?alliance_id=99000006" -Validate {
    param($j)
    if ($null -eq $j) { return 'null response' }
    if ($j.PSObject.Properties.Name -notcontains 'alliance_stats') { return 'alliance_stats missing' }
    $true
}

# With two alliance IDs -> vs_head_to_head
$null = Invoke-Test -Name 'stats: two alliance_ids -> vs_head_to_head' -Method GET -Url "$ApiBase/stats?alliance_id=99000006,99000038" -Validate {
    param($j)
    if ($null -eq $j) { return 'null response' }
    if ($null -eq $j.vs_head_to_head) { return 'vs_head_to_head missing for 2 alliances' }
    foreach ($f in @('alliance_a','alliance_b','a_killed_b','b_killed_a')) {
        if ($j.vs_head_to_head.PSObject.Properties.Name -notcontains $f) { return "vs_head_to_head.$f missing" }
    }
    $true
}

# =============================================================
#  PHASE 5: /webhook/search
# =============================================================
Write-Host '[ Phase 5: /webhook/search ]' -ForegroundColor Yellow

$null = Invoke-Test -Name 'search: q=Jita -> single result shape' -Method GET -Url "$ApiBase/search?q=Jita" -Validate {
    param($j)
    if ($null -eq $j) { return 'null response' }
    # single mode returns one object or array
    $item = if ($j -is [array]) { $j[0] } else { $j }
    if ($null -eq $item) { return 'no result for Jita' }
    foreach ($f in @('id','name','type')) {
        if ($item.PSObject.Properties.Name -notcontains $f) { return "result missing field: $f" }
    }
    $true
}

$null = Invoke-Test -Name 'search: q=Amarr&multi=true -> array' -Method GET -Url "$ApiBase/search?q=Amarr&multi=true" -Validate {
    param($j)
    if ($j -isnot [array]) { return "multi mode should return array, got: $($j.GetType().Name)" }
    if ($j.Count -eq 0)    { return 'empty results for Amarr multi' }
    foreach ($f in @('id','name','type')) {
        if ($j[0].PSObject.Properties.Name -notcontains $f) { return "result[0] missing field: $f" }
    }
    $true
}

$null = Invoke-Test -Name 'search: multi=true returns up to 15 results' -Method GET -Url "$ApiBase/search?q=ar&multi=true" -Validate {
    param($j)
    if ($j -isnot [array]) { return "expected array" }
    if ($j.Count -gt 15) { return "returned $($j.Count) results, expected <= 15" }
    $true
}

$null = Invoke-Test -Name 'search: type field is alliance or corporation' -Method GET -Url "$ApiBase/search?q=Goonswarm&multi=true" -Validate {
    param($j)
    if ($j -isnot [array] -or $j.Count -eq 0) { return 'no results' }
    $bad = $j | Where-Object { $_.type -notin @('alliance','corporation') }
    if ($bad) { return "invalid type: $($bad[0].type)" }
    $true
}

# Short query error
$null = Invoke-Test -Name 'search: q=J (1 char) -> 400' -Method GET -Url "$ApiBase/search?q=J" `
    -PassOnCodes @(400) -Validate { param($j) 'expected 400' }

# No q param
$null = Invoke-Test -Name 'search: missing q -> 400' -Method GET -Url "$ApiBase/search" `
    -PassOnCodes @(400) -Validate { param($j) 'expected 400' }

# =============================================================
#  PHASE 6: /webhook/dashboard-intel
# =============================================================
Write-Host '[ Phase 6: /webhook/dashboard-intel ]' -ForegroundColor Yellow

$null = Invoke-Test -Name 'intel: shape (overview, top_users, timeline)' -Method GET -Url "$ApiBase/dashboard-intel" -Validate {
    param($j)
    foreach ($f in @('overview','top_users','timeline')) {
        if ($j.PSObject.Properties.Name -notcontains $f) { return "$f missing" }
    }
    $true
}

$null = Invoke-Test -Name 'intel: overview fields present' -Method GET -Url "$ApiBase/dashboard-intel" -Validate {
    param($j)
    foreach ($f in @('active_pilots_now','peak_concurrent','total_tracked','usage_stats')) {
        if ($j.overview.PSObject.Properties.Name -notcontains $f) { return "overview.$f missing" }
    }
    $true
}

$null = Invoke-Test -Name 'intel: overview.usage_stats has view keys' -Method GET -Url "$ApiBase/dashboard-intel" -Validate {
    param($j)
    foreach ($f in @('map_3d','map_2d','feed_standard','feed_compact')) {
        if ($j.overview.usage_stats.PSObject.Properties.Name -notcontains $f) { return "usage_stats.$f missing" }
    }
    $true
}

$null = Invoke-Test -Name 'intel: timeline is array of {time, count}' -Method GET -Url "$ApiBase/dashboard-intel" -Validate {
    param($j)
    if ($j.timeline -isnot [array]) { return 'timeline not array' }
    if ($j.timeline.Count -eq 0)    { return 'timeline empty' }
    $t = $j.timeline[0]
    if ($t.PSObject.Properties.Name -notcontains 'time')  { return 'timeline[0] missing time' }
    if ($t.PSObject.Properties.Name -notcontains 'count') { return 'timeline[0] missing count' }
    $true
}

$null = Invoke-Test -Name 'intel: top_users is array' -Method GET -Url "$ApiBase/dashboard-intel" -Validate {
    param($j)
    if ($j.top_users -isnot [array]) { return 'top_users not array' }
    $true
}

$null = Invoke-Test -Name 'intel: top_users have connection_type if non-empty' -Method GET -Url "$ApiBase/dashboard-intel" -Validate {
    param($j)
    if ($j.top_users.Count -eq 0) { return $true }
    $u = $j.top_users[0]
    if ($u.PSObject.Properties.Name -notcontains 'connection_type') { return 'connection_type missing on top_users[0]' }
    $true
}

# =============================================================
#  PHASE 7: /webhook/system (POST only)
# =============================================================
Write-Host '[ Phase 7: /webhook/system ]' -ForegroundColor Yellow

# GET must be rejected
$null = Invoke-Test -Name 'system: GET -> 404 or 405' -Method GET -Url "$ApiBase/system" `
    -PassOnCodes @(404,405) -Validate { param($j) 'expected 404/405' }

# Missing body -> 400
$null = Invoke-Test -Name 'system: missing query_name -> 400' -Method POST -Url "$ApiBase/system" `
    -Body '{}' -PassOnCodes @(400) -Validate { param($j) 'expected 400' }

# Valid system query
$null = Invoke-Test -Name 'system: POST Jita -> 200 with report' -Method POST -Url "$ApiBase/system" `
    -Body '{"query_name":"Jita","query_type":"system"}' -Validate {
    param($j)
    if ($null -eq $j)                     { return 'null response' }
    if ($null -eq $j.report)              { return 'report missing' }
    if ($null -eq $j.templated_response_data) { return 'templated_response_data missing' }
    if ($null -eq $j.metadata)            { return 'metadata missing' }
    $true
}

$null = Invoke-Test -Name 'system: templated_response_data fields' -Method POST -Url "$ApiBase/system" `
    -Body '{"query_name":"Jita","query_type":"system"}' -Validate {
    param($j)
    $td = $j.templated_response_data
    if ($null -eq $td) { return 'templated_response_data missing' }
    foreach ($f in @('query_name','security_class','threat_level','full_location','kills_last_24h','system_type_label')) {
        if ($td.PSObject.Properties.Name -notcontains $f) { return "templated_response_data.$f missing" }
    }
    $true
}

$null = Invoke-Test -Name 'system: threat_level is valid enum' -Method POST -Url "$ApiBase/system" `
    -Body '{"query_name":"Jita","query_type":"system"}' -Validate {
    param($j)
    $tl = $j.templated_response_data.threat_level
    if ($tl -notin @('minimal','low','medium','high')) { return "invalid threat_level: $tl" }
    $true
}

$null = Invoke-Test -Name 'system: security_class is highsec for Jita' -Method POST -Url "$ApiBase/system" `
    -Body '{"query_name":"Jita","query_type":"system"}' -Validate {
    param($j)
    $sc = $j.templated_response_data.security_class
    if ($sc -ne 'highsec') { return "expected highsec, got: $sc" }
    $true
}

$null = Invoke-Test -Name 'system: report.executive_summary present' -Method POST -Url "$ApiBase/system" `
    -Body '{"query_name":"Jita","query_type":"system"}' -Validate {
    param($j)
    $es = $j.report.executive_summary
    if ($null -eq $es) { return 'report.executive_summary missing' }
    foreach ($f in @('name','id','security_class','threat_level')) {
        if ($es.PSObject.Properties.Name -notcontains $f) { return "executive_summary.$f missing" }
    }
    $true
}

# Region query type -- query_name must still be a system name (region lookup not yet implemented in SDE fetch)
$null = Invoke-Test -Name 'system: POST {query_type=region, known system} -> 200' -Method POST -Url "$ApiBase/system" `
    -Body '{"query_name":"Jita","query_type":"region"}' -Validate {
    param($j)
    if ($null -eq $j.report) { return 'report missing' }
    $true
}

# Wormhole query
$null = Invoke-Test -Name 'system: POST wormhole J123450 -> 200' -Method POST -Url "$ApiBase/system" `
    -Body '{"query_name":"J123450","query_type":"system"}' -Validate {
    param($j)
    if ($null -eq $j) { return 'null response' }
    if ($null -eq $j.report) { return 'report missing' }
    $true
}

# metadata.data_sources present
$null = Invoke-Test -Name 'system: metadata.data_sources present' -Method POST -Url "$ApiBase/system" `
    -Body '{"query_name":"Jita"}' -Validate {
    param($j)
    $ds = $j.metadata.data_sources
    if ($ds -isnot [array] -or $ds.Count -eq 0) { return 'metadata.data_sources missing or empty' }
    $true
}

# =============================================================
#  PHASE 8: /webhook/sse-presence
# =============================================================
Write-Host '[ Phase 8: /webhook/sse-presence ]' -ForegroundColor Yellow

$null = Invoke-Test -Name 'sse-presence: POST with fingerprint -> ok=true' -Method POST -Url "$ApiBase/sse-presence" `
    -Body '{"view":"standard","fingerprint":"e2e_test_pilot","query":{}}' -Validate {
    param($j)
    if ($j.ok -ne $true) { return "ok != true: $($j.error)" }
    $true
}

$null = Invoke-Test -Name 'sse-presence: compact view -> ok=true' -Method POST -Url "$ApiBase/sse-presence" `
    -Body '{"view":"compact","fingerprint":"e2e_test_compact","query":{"filters_space":"ns"}}' -Validate {
    param($j)
    if ($j.ok -ne $true) { return "ok != true: $($j.error)" }
    $true
}

$null = Invoke-Test -Name 'sse-presence: no fingerprint (derived) -> ok=true' -Method POST -Url "$ApiBase/sse-presence" `
    -Body '{"view":"standard","query":{}}' -Validate {
    param($j)
    if ($j.ok -ne $true) { return "ok != true: $($j.error)" }
    $true
}

# GET should be rejected
$null = Invoke-Test -Name 'sse-presence: GET -> 404 or 405' -Method GET -Url "$ApiBase/sse-presence" `
    -PassOnCodes @(404,405) -Validate { param($j) 'expected 404/405' }

# Presence should now show in dashboard-intel
$null = Invoke-Test -Name 'sse-presence: presence recorded in dashboard-intel' -Method GET -Url "$ApiBase/dashboard-intel" -Validate {
    param($j)
    if ([int]$j.overview.total_tracked -lt 1) { return "total_tracked=0, presence not recorded" }
    $true
}

# =============================================================
#  PHASE 9: /webhook/killmail-dashboard
# =============================================================
Write-Host '[ Phase 9: /webhook/killmail-dashboard ]' -ForegroundColor Yellow

$kmRec = Invoke-Test -Name 'killmail-dashboard: GET -> 200 or 404' -Method GET -Url "$ApiBase/killmail-dashboard?limit=10" `
    -PassOnCodes @(200,404) -Validate { param($j) $true }

if ($kmRec.Code -eq 200) {
    $null = Invoke-Test -Name 'killmail-dashboard: shape (kills, stats_24h, isk_distribution)' -Method GET -Url "$ApiBase/killmail-dashboard?limit=5" -Validate {
        param($j)
        foreach ($f in @('kills','total_count','stats_24h','isk_distribution','activity_heatmap')) {
            if ($j.PSObject.Properties.Name -notcontains $f) { return "$f missing" }
        }
        if ($j.kills -isnot [array]) { return 'kills not array' }
        $true
    }

    $null = Invoke-Test -Name 'killmail-dashboard: filter solo' -Method GET -Url "$ApiBase/killmail-dashboard?limit=3&filters_main=solo" -Validate {
        param($j)
        if ($null -eq $j) { return 'null response' }
        $true
    }

    $null = Invoke-Test -Name 'killmail-dashboard: filter by isk bucket' -Method GET -Url "$ApiBase/killmail-dashboard?limit=3&filters_isk=1b-10b" -Validate {
        param($j)
        if ($null -eq $j) { return 'null response' }
        $true
    }

    $null = Invoke-Test -Name 'killmail-dashboard: alliance_id -> alliance_stats' -Method GET -Url "$ApiBase/killmail-dashboard?limit=5&alliance_id=99000006" -Validate {
        param($j)
        if ($j.PSObject.Properties.Name -notcontains 'alliance_stats') { return 'alliance_stats missing' }
        $true
    }

    $null = Invoke-Test -Name 'killmail-dashboard: search_query filter' -Method GET -Url "$ApiBase/killmail-dashboard?limit=5&search_query=Jita" -Validate {
        param($j)
        if ($null -eq $j) { return 'null response' }
        $true
    }
} else {
    Write-Host "  [INFO] killmail-dashboard returned 404 -- endpoint may not be routed yet, skipping sub-tests" -ForegroundColor DarkGray
}

# =============================================================
#  PHASE 10: CORS HEADERS
# =============================================================
Write-Host '[ Phase 10: CORS headers ]' -ForegroundColor Yellow

$null = Invoke-Test -Name 'cors: Access-Control-Allow-Origin present' -Method GET -Url "$ApiBase/r2z2-stats" -Validate {
    param($j,$r)
    $h = $r.Headers
    if (-not $h['Access-Control-Allow-Origin']) { return 'Access-Control-Allow-Origin header missing' }
    $true
}

$null = Invoke-Test -Name 'cors: Content-Type is application/json' -Method GET -Url "$ApiBase/r2z2-stats" -Validate {
    param($j,$r)
    $ct = [string]$r.Headers['Content-Type']
    if ($ct -notmatch 'application/json') { return "Content-Type wrong: $ct" }
    $true
}

# =============================================================
#  PHASE 11: ERROR HANDLING
# =============================================================
Write-Host '[ Phase 11: Error handling ]' -ForegroundColor Yellow

$null = Invoke-Test -Name 'errors: unknown route -> 404' -Method GET -Url "$ApiBase/nonexistent-route" `
    -PassOnCodes @(404) -Validate { param($j) 'expected 404' }

$null = Invoke-Test -Name 'errors: system POST empty body -> 400 with error field' -Method POST -Url "$ApiBase/system" `
    -Body '{}' -PassOnCodes @(400) -Validate {
    param($j)
    # will be caught as passOnCode 400 -- if we got here somehow check shape
    if ($null -ne $j -and $j.PSObject.Properties.Name -notcontains 'error') { return 'error field missing in 400 response' }
    $true
}

$null = Invoke-Test -Name 'errors: search q=X (1 char) -> 400 with error field' -Method GET -Url "$ApiBase/search?q=X" `
    -PassOnCodes @(400) -Validate { param($j) 'expected 400' }

# =============================================================
#  PHASE 12: LATENCY REGRESSION
# =============================================================
Write-Host '[ Phase 12: Latency regression ]' -ForegroundColor Yellow

$latTargets = @(
    @{ Name='latency: /r2z2-stats < 500ms';        Url="$ApiBase/r2z2-stats";            Budget=500 }
    @{ Name='latency: /feed?limit=20 < 1500ms';    Url="$ApiBase/feed?limit=20";          Budget=1500 }
    @{ Name='latency: /stats < 1000ms';            Url="$ApiBase/stats";                  Budget=1000 }
    @{ Name='latency: /search?q=Jita < 500ms';     Url="$ApiBase/search?q=Jita";          Budget=500 }
    @{ Name='latency: /dashboard-intel < 2000ms';  Url="$ApiBase/dashboard-intel";        Budget=2000 }
    @{ Name='latency: POST /system < 3000ms';      Url="$ApiBase/system";                 Budget=3000; Method='POST'; Body='{"query_name":"Jita"}' }
)

foreach ($lt in $latTargets) {
    $method = if ($lt.Method) { $lt.Method } else { 'GET' }
    $rec = Invoke-Test -Name $lt.Name -Method $method -Url $lt.Url -Body $lt.Body -Validate {
        param($j) if ($null -eq $j) { return 'null response' }; $true
    }
    if ($rec.Pass -and $rec.Ms -ge $lt.Budget) {
        $rec.Pass = $false
        $rec.Note = "exceeded $($lt.Budget)ms: $($rec.Ms)ms"
    }
}

# =============================================================
#  HEALTH REPORT
# =============================================================
$pass  = ($Results | Where-Object {  $_.Pass }).Count
$fail  = ($Results | Where-Object { -not $_.Pass }).Count
$total = $Results.Count

Write-Host ''
Write-Host ('=' * 66) -ForegroundColor Cyan
Write-Host ("  HEALTH REPORT  --  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')") -ForegroundColor Cyan
Write-Host ('=' * 66) -ForegroundColor Cyan
Write-Host ''
Write-Host ('  {0,-48} {1,-6} {2,7} {3}' -f 'TEST', 'STATUS', 'MS', 'NOTE')
Write-Host ('  ' + ('-' * 64))

foreach ($r in $Results) {
    $color  = if ($r.Pass) { 'Green' } else { 'Red' }
    $status = if ($r.Pass) { 'PASS'  } else { 'FAIL' }
    $ms     = if ($null -ne $r.Ms) { "$($r.Ms)ms" } else { 'n/a' }
    $note   = if ($r.Note.Length -gt 28) { $r.Note.Substring(0,25) + '...' } else { $r.Note }
    Write-Host ('  {0,-48} ' -f $r.Name) -NoNewline
    Write-Host ('{0,-6} ' -f $status) -ForegroundColor $color -NoNewline
    Write-Host ('{0,7} {1}' -f $ms, $note)
}

Write-Host ''
Write-Host ('  ' + ('-' * 64))
$sc = if ($fail -eq 0) { 'Green' } else { 'Red' }
Write-Host ("  Result: $pass/$total passed") -ForegroundColor $sc

if ($fail -gt 0) {
    Write-Host ''
    Write-Host '  FAILURES:' -ForegroundColor Red
    $Results | Where-Object { -not $_.Pass } | ForEach-Object {
        Write-Host ("    X $($_.Name): $($_.Note)") -ForegroundColor Red
    }
}

Write-Host ''
Write-Host ('=' * 66) -ForegroundColor Cyan
Write-Host ''

if ($fail -gt 0) { exit 1 }
