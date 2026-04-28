#Requires -Version 5.1
<#
.SYNOPSIS
    Build and deploy AIN frontend, then bump the Redis deploy token.

.DESCRIPTION
    1. Runs npm run build
    2. Commits the dist/ changes if any (optional — CF Pages deploys from Git)
    3. Pushes to GitHub (triggers Cloudflare Pages auto-deploy)
    4. SSHes into the backend VPS and bumps ain:deploy_token in Redis
       so legacy polling clients auto-reload into the new SSE build.

.PARAMETER SshHost
    SSH connection string for the backend VPS. Default: administrator@ain-backend

.PARAMETER SkipBuild
    Skip npm run build (use if you already built manually).

.PARAMETER SkipPush
    Skip git push (use if deploying to CF Pages another way).
#>
param(
    [string]$SshHost    = 'administrator@ain-backend',
    [switch]$SkipBuild,
    [switch]$SkipPush
)

$ErrorActionPreference = 'Stop'

function Write-Step { param($msg) Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Fail { param($msg) Write-Host "    [FAIL] $msg" -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------------------
if (-not $SkipBuild) {
    Write-Step "Building frontend..."
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Fail "npm run build failed" }
    Write-Ok "Build complete"
}

# ---------------------------------------------------------------------------
if (-not $SkipPush) {
    Write-Step "Pushing to GitHub (triggers Cloudflare Pages deploy)..."
    git push
    if ($LASTEXITCODE -ne 0) { Write-Fail "git push failed" }
    Write-Ok "Pushed — Cloudflare Pages will deploy automatically"
}

# ---------------------------------------------------------------------------
Write-Step "Bumping Redis deploy token on $SshHost..."
$token = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
ssh $SshHost "docker exec redis redis-cli set ain:deploy_token $token"
if ($LASTEXITCODE -ne 0) { Write-Fail "SSH command failed — token NOT updated. Run manually: docker exec redis redis-cli set ain:deploy_token $token" }
Write-Ok "ain:deploy_token set to $token"

# ---------------------------------------------------------------------------
Write-Host "`n--- Deploy complete ---" -ForegroundColor Green
Write-Host "Legacy clients will auto-reload on their next /feed poll." -ForegroundColor DarkGray
