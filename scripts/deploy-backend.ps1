#Requires -Version 5.1
<#
.SYNOPSIS
    Push local Backend/ + docker-swarm-stack.yml to ain-backend and apply.

.DESCRIPTION
    1. rsync Backend/ain-api/, Backend/sse-server/, docker-swarm-stack.yml (as compose.yml)
    2. docker compose build for the target services
    3. docker compose up -d --no-deps
    4. Print container status and ain-api startup logs

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

# ANSI colours (work in Windows Terminal / PS 7; degrade gracefully in PS 5.1)
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
Write-Step 2 "Syncing files to ${RemoteHost}:${ComposePath} ..."

$repoRoot = Split-Path $PSScriptRoot -Parent

# local path -> remote path
$syncItems = @(
    [pscustomobject]@{ Local = 'Backend/ain-api';        Remote = "$ComposePath/Backend/ain-api" }
    [pscustomobject]@{ Local = 'Backend/sse-server';     Remote = "$ComposePath/Backend/sse-server" }
    # docker-swarm-stack.yml is the authoritative source; server expects compose.yml
    [pscustomobject]@{ Local = 'docker-swarm-stack.yml'; Remote = "$ComposePath/compose.yml" }
)

if (-not $DryRun) {
    Invoke-Remote "mkdir -p $ComposePath/Backend/ain-api $ComposePath/Backend/sse-server" | Out-Null
}

foreach ($item in $syncItems) {
    $localFull = Join-Path $repoRoot $item.Local
    $isDir     = Test-Path $localFull -PathType Container

    Write-Host "  ${DIM}scp $($item.Local) -> $($item.Remote)${NC}"

    if (-not $DryRun) {
        if ($isDir) {
            # Pack locally with .NET zip (no rsync needed), upload, extract with tar on remote
            $tmpZip    = [System.IO.Path]::GetTempFileName() + '.zip'
            $remoteDir = $item.Remote
            $remoteTmp = "$ComposePath/_deploy_tmp.zip"

            Add-Type -AssemblyName 'System.IO.Compression.FileSystem'
            if (Test-Path $tmpZip) { Remove-Item $tmpZip -Force }
            $entries = Get-ChildItem $localFull -Recurse -File |
                Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\.git\\' -and $_.Extension -ne '.log' }
            $zip = [System.IO.Compression.ZipFile]::Open($tmpZip, 'Create')
            foreach ($f in $entries) {
                $rel = $f.FullName.Substring($localFull.Length).TrimStart('\').Replace('\','/')
                [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $rel)
            }
            $zip.Dispose()

            # Upload zip, unpack with python3 (always present), clean up
            scp $tmpZip "${RemoteHost}:${remoteTmp}"
            if ($LASTEXITCODE -ne 0) { Remove-Item $tmpZip -Force; Write-Err "scp zip failed for $($item.Local)" }
            $pyUnzip = "python3 -c `"import zipfile,os; z=zipfile.ZipFile('$remoteTmp'); os.makedirs('$remoteDir',exist_ok=True); z.extractall('$remoteDir'); z.close(); os.remove('$remoteTmp')`""
            Invoke-Remote $pyUnzip | Out-Null
            if ($LASTEXITCODE -ne 0) { Remove-Item $tmpZip -Force; Write-Err "python unzip failed for $($item.Local)" }
            Remove-Item $tmpZip -Force
        } else {
            # single file -- scp directly
            scp $localFull "${RemoteHost}:$($item.Remote)"
            if ($LASTEXITCODE -ne 0) { Write-Err "scp failed for $($item.Local)" }
        }
    }
}
Write-Ok 'Files synced'

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
        $out = Invoke-Remote "cd $ComposePath && docker compose -f compose.yml build --pull $svcString 2>&1"
        if ($LASTEXITCODE -ne 0) { Write-Err "docker compose build failed: $out" }
        Write-Ok 'Images built'
    } else {
        Write-Host "  ${YELLOW}DRY RUN -- would run: docker compose build --pull $svcString${NC}"
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
