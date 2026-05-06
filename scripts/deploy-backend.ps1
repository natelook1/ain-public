#Requires -Version 5.1
<#
.SYNOPSIS
    Deploy Backend changes to ain-backend: git pull + docker compose build/up.

.DESCRIPTION
    1. git pull on the remote repo
    2. cp docker-swarm-stack.yml compose.yml
    3. docker compose build for the target services
    4. docker compose up -d --no-deps
    5. Print container status and ain-api startup logs

.PARAMETER RemoteHost
    SSH target. Default: administrator@192.168.30.57

.PARAMETER ComposePath
    Directory on the remote containing compose.yml. Default: /opt/ain

.PARAMETER Services
    Comma-separated services to rebuild/restart. Default: ain-api,sse-server

.PARAMETER DryRun
    Show what would happen without touching the server.

.PARAMETER SkipBuild
    Skip docker compose build.

.EXAMPLE
    .\scripts\deploy-backend.ps1 -DryRun
    .\scripts\deploy-backend.ps1
    .\scripts\deploy-backend.ps1 -Services ain-api -SkipBuild
#>
param(
    [string]$RemoteHost  = 'administrator@192.168.30.57',
    [string]$ComposePath = '/opt/ain',
    [string]$Services    = 'ain-api,sse-server',
    [switch]$DryRun,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$ESC    = [char]27
$GREEN  = "$ESC[32m"
$RED    = "$ESC[31m"
$CYAN   = "$ESC[36m"
$YELLOW = "$ESC[33m"
$BOLD   = "$ESC[1m"
$DIM    = "$ESC[2m"
$NC     = "$ESC[0m"

$svcList    = $Services -split ',' | ForEach-Object { $_.Trim() }
$svcString  = $svcList -join ' '
$totalSteps = 5

function Write-Step { param([int]$n, [string]$msg) Write-Host "${CYAN}[$n/$totalSteps] $msg${NC}" }
function Write-Ok   { param([string]$msg) Write-Host "  ${GREEN}OK${NC}  $msg" }
function Write-Err  { param([string]$msg) Write-Host "  ${RED}FAIL${NC}  $msg"; exit 1 }

function Invoke-Remote {
    param([string]$Cmd, [string]$Desc = '')
    if ($Desc) { Write-Host "  ${DIM}> $Desc${NC}" }
    $out = ssh $RemoteHost $Cmd 2>&1
    return $out
}

# ---------------------------------------------------------------------------
Write-Host ''
Write-Host "${BOLD}=== AIN Backend Deploy ===${NC}"
Write-Host "  Target:   $RemoteHost"
Write-Host "  Path:     $ComposePath"
Write-Host "  Services: $($svcList -join ', ')"
if ($DryRun) { Write-Host "  ${YELLOW}DRY RUN -- no changes will be applied${NC}" }
Write-Host ''

# ---------------------------------------------------------------------------
Write-Step 1 'Verifying SSH access...'

$ping = ssh $RemoteHost 'echo ok' 2>&1
if ($ping -ne 'ok') {
    Write-Host "  ${RED}FAIL${NC}  Cannot reach $RemoteHost"
    Write-Host '  Tip: set up key auth with ssh-copy-id, then retry.'
    exit 1
}
Write-Ok 'SSH connected'

# ---------------------------------------------------------------------------
Write-Step 2 'Pulling latest from GitHub...'

if (-not $DryRun) {
    $out = Invoke-Remote "cd $ComposePath && git pull 2>&1"
    Write-Host "  ${DIM}$out${NC}"
    if ($LASTEXITCODE -ne 0) { Write-Err "git pull failed: $out" }
    # keep compose.yml in sync with the authoritative stack file
    Invoke-Remote "cp $ComposePath/docker-swarm-stack.yml $ComposePath/compose.yml" | Out-Null
    Write-Ok 'Files synced'
} else {
    Write-Host "  ${YELLOW}DRY RUN -- would run: git pull && cp docker-swarm-stack.yml compose.yml${NC}"
}

# ---------------------------------------------------------------------------
Write-Step 3 'Validating compose file on remote...'

if (-not $DryRun) {
    $out = Invoke-Remote "cd $ComposePath && docker compose -f compose.yml config --quiet 2>&1"
    if ($LASTEXITCODE -ne 0) { Write-Err "compose validation failed: $out" }
    Write-Ok 'compose.yml is valid'
} else {
    Write-Host "  ${YELLOW}DRY RUN -- skipping${NC}"
}

# ---------------------------------------------------------------------------
Write-Step 4 "Building images ($svcString)..."

if (-not $SkipBuild) {
    if (-not $DryRun) {
        $out = Invoke-Remote "cd $ComposePath && docker compose -f compose.yml build $svcString 2>&1"
        if ($LASTEXITCODE -ne 0) { Write-Err "docker compose build failed: $out" }
        Write-Ok 'Images built'
    } else {
        Write-Host "  ${YELLOW}DRY RUN -- would run: docker compose build $svcString${NC}"
    }
} else {
    Write-Host "  ${DIM}Skipped (--SkipBuild)${NC}"
}

# ---------------------------------------------------------------------------
Write-Step 5 "Applying: docker compose up -d --no-deps $svcString ..."

if (-not $DryRun) {
    $out = Invoke-Remote "cd $ComposePath && docker compose -f compose.yml up -d --no-deps $svcString 2>&1"
    if ($LASTEXITCODE -ne 0) { Write-Err "docker compose up failed: $out" }
    Write-Ok 'Containers updated'

    Write-Host ''
    Write-Host "${BOLD}Container status:${NC}"
    $status = Invoke-Remote "cd $ComposePath && docker compose -f compose.yml ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}' 2>&1"
    $status | ForEach-Object { Write-Host "  $_" }

    if ($svcList -contains 'ain-api') {
        Write-Host ''
        Write-Host "${BOLD}ain-api startup log:${NC}"
        $logs = Invoke-Remote "cd $ComposePath && docker compose -f compose.yml logs --tail=20 ain-api 2>&1"
        $logs | ForEach-Object { Write-Host "  $_" }
    }
} else {
    Write-Host "  ${YELLOW}DRY RUN -- would run: docker compose up -d --no-deps $svcString${NC}"
}

# ---------------------------------------------------------------------------
Write-Host ''
Write-Host "${BOLD}${GREEN}=== Done ===${NC}"
Write-Host ''
Write-Host 'Smoke test:'
Write-Host "  curl -s http://192.168.30.57:3002/webhook/r2z2-stats | jq .status"
Write-Host ''
Write-Host 'Full endpoint tests:'
Write-Host '  .\test_endpoints.ps1'
Write-Host ''
