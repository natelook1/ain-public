param (
    [string]$AinHost = "192.168.30.57",
    [string]$SshUser = "administrator",
    [string]$ComposePath = "/opt/ain",
    [switch]$DryRun
)

# Patches compose.yml on the ain VM to fix n8n queue exhaustion (the root cause of
# api-ain.looknet.ca 504s). Changes:
#   - Adds QUEUE_WORKER_CONCURRENCY=25 to existing n8n-worker
#   - Adds EXECUTIONS_TIMEOUT + QUEUE_BULL_REDIS_TIMEOUT_THRESHOLD to n8n main
#   - Adds a second worker container (n8n-worker-webhooks) for dedicated capacity
# Then restarts affected containers with zero-downtime ordering.

$ESC   = [char]27
$GREEN = "$ESC[32m"
$RED   = "$ESC[31m"
$CYAN  = "$ESC[36m"
$BOLD  = "$ESC[1m"
$DIM   = "$ESC[2m"
$NC    = "$ESC[0m"

$target = "${SshUser}@${AinHost}"

function Invoke-Remote {
    param([string]$Cmd, [string]$Desc = "")
    if ($Desc) { Write-Host "  ${DIM}> $Desc${NC}" }
    $out = ssh $target $Cmd 2>&1
    return $out
}

function Test-Remote {
    param([string]$Cmd)
    $out = ssh $target $Cmd 2>&1
    return $LASTEXITCODE -eq 0
}

Write-Host ""
Write-Host "${BOLD}=== ain n8n Worker Deploy ===${NC}"
Write-Host "  Target:    $target"
Write-Host "  Compose:   $ComposePath/compose.yml"
if ($DryRun) { Write-Host "  ${CYAN}DRY RUN -- no changes will be applied${NC}" }
Write-Host ""

# --- Verify SSH ---
Write-Host "${CYAN}[1/6] Verifying SSH access...${NC}"
$ping = Invoke-Remote "echo ok"
if ($ping -ne "ok") {
    Write-Host "  ${RED}FAIL${NC}  Cannot reach $target -- set up SSH key first:"
    Write-Host "  ${DIM}type `$env:USERPROFILE\.ssh\id_ed25519.pub | ssh ${target} 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'${NC}"
    exit 1
}
Write-Host "  ${GREEN}OK${NC}  SSH connection established"

# --- Check compose file ---
Write-Host ""
Write-Host "${CYAN}[2/6] Reading current compose.yml...${NC}"
$composeSrc = Invoke-Remote "cat $ComposePath/compose.yml"
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($composeSrc)) {
    Write-Host "  ${RED}FAIL${NC}  Could not read $ComposePath/compose.yml"
    exit 1
}
Write-Host "  ${GREEN}OK${NC}  compose.yml read ($($composeSrc.Count) lines)"

# Check what's already applied
$alreadyHasConcurrency   = ($composeSrc -join "`n") -match "QUEUE_WORKER_CONCURRENCY"
$alreadyHasTimeout       = ($composeSrc -join "`n") -match "EXECUTIONS_TIMEOUT"
$alreadyHasSecondWorker  = ($composeSrc -join "`n") -match "n8n-worker-webhooks"

if ($alreadyHasConcurrency -and $alreadyHasTimeout -and $alreadyHasSecondWorker) {
    Write-Host "  ${GREEN}Already up to date${NC} -- all changes already present in compose.yml"
    exit 0
}

# --- Backup ---
Write-Host ""
Write-Host "${CYAN}[3/6] Backing up compose.yml...${NC}"
$backupPath = "$ComposePath/compose.yml.bak.$(ssh $target 'date +%Y%m%d-%H%M%S')"
$backed = Invoke-Remote "cp $ComposePath/compose.yml $backupPath" "cp compose.yml -> $backupPath"
Write-Host "  ${GREEN}OK${NC}  Backup saved to $backupPath"

# --- Build patched compose ---
Write-Host ""
Write-Host "${CYAN}[4/6] Building patched compose.yml...${NC}"

# We patch by appending env vars via a Python one-liner on the remote.
# Safer than sed for multi-line YAML blocks.
$patchScript = @'
import sys, re

src = open("/opt/ain/compose.yml").read()

# 1. Add QUEUE_WORKER_CONCURRENCY to existing n8n-worker (not n8n-worker-webhooks)
if "QUEUE_WORKER_CONCURRENCY" not in src:
    # Find the worker environment block and insert after EXECUTIONS_MODE=queue line
    src = re.sub(
        r'(container_name: n8n-worker\b.*?environment:\s*(?:.*\n)*?.*)(- EXECUTIONS_MODE=queue)',
        r'\1- EXECUTIONS_MODE=queue\n      - QUEUE_WORKER_CONCURRENCY=25',
        src, count=1, flags=re.DOTALL
    )

# 2. Add timeout vars to main n8n container
if "EXECUTIONS_TIMEOUT" not in src:
    src = re.sub(
        r'(container_name: n8n\b.*?environment:\s*(?:.*\n)*?.*)(- OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS=true)',
        r'\1- OFFLOAD_MANUAL_EXECUTIONS_TO_WORKERS=true\n      - EXECUTIONS_TIMEOUT=55\n      - EXECUTIONS_TIMEOUT_MAX=60\n      - QUEUE_BULL_REDIS_TIMEOUT_THRESHOLD=30000',
        src, count=1, flags=re.DOTALL
    )

# 3. Add second worker before the volumes: block
if "n8n-worker-webhooks" not in src:
    second_worker = """
  n8n-worker-webhooks:
    image: docker.n8n.io/n8nio/n8n
    container_name: n8n-worker-webhooks
    restart: unless-stopped
    entrypoint: sh -c "npm install --prefix /home/node ioredis papaparse axios ws && n8n worker"
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=db
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=n8n_secure_password
      - EXECUTIONS_MODE=queue
      - QUEUE_BULL_REDIS_HOST=redis
      - N8N_ENCRYPTION_KEY=lCtpgT3B7jh+keKLwvzMQh4Yg41vw+Iv
      - QUEUE_WORKER_CONCURRENCY=25
      - SSE_PUBLISH_SECRET=${SSE_PUBLISH_SECRET}
      - N8N_BLOCK_JS_PYTHON_TASKS=false
      - N8N_TASKS_LIB_ALLOWLIST=ioredis,papaparse,axios,ws
      - N8N_TASKS_BUILTIN_ALLOWLIST=child_process,path,fs,https
      - NODE_FUNCTION_ALLOW_BUILTIN=child_process,path,fs,https
      - NODE_FUNCTION_ALLOW_EXTERNAL=ioredis,papaparse,axios,ws,child_process,path,fs
      - NODE_PATH=/usr/local/lib/node_modules:/home/node/node_modules
      - N8N_JS_EXTERNALS_PATH=/home/node/node_modules
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      - n8n
      - redis
    networks:
      - alfred_network
"""
    src = re.sub(r'\nvolumes:', second_worker + '\nvolumes:', src, count=1)

open("/opt/ain/compose.yml", "w").write(src)
print("OK")
'@

# Write patch script to remote and run it
$patchB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($patchScript))

if ($DryRun) {
    Write-Host "  ${CYAN}DRY RUN -- would apply patch${NC}"
} else {
    $result = ssh $target "echo '$patchB64' | base64 -d > /tmp/patch_compose.py && python3 /tmp/patch_compose.py && rm /tmp/patch_compose.py"
    if ($result -ne "OK") {
        Write-Host "  ${RED}FAIL${NC}  Patch script failed: $result"
        Write-Host "  ${DIM}Backup is at $backupPath -- restore with: cp $backupPath $ComposePath/compose.yml${NC}"
        exit 1
    }
    Write-Host "  ${GREEN}OK${NC}  compose.yml patched"
}

# --- Validate ---
Write-Host ""
Write-Host "${CYAN}[5/6] Validating patched compose.yml...${NC}"
if (-not $DryRun) {
    $validate = Invoke-Remote "cd $ComposePath && docker compose config --quiet 2>&1" "docker compose config"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ${RED}FAIL${NC}  compose.yml failed validation: $validate"
        Write-Host "  ${DIM}Restoring backup...${NC}"
        Invoke-Remote "cp $backupPath $ComposePath/compose.yml" | Out-Null
        Write-Host "  ${GREEN}Restored${NC}"
        exit 1
    }
    Write-Host "  ${GREEN}OK${NC}  compose.yml is valid"
} else {
    Write-Host "  ${CYAN}DRY RUN -- skipping validation${NC}"
}

# --- Apply ---
Write-Host ""
Write-Host "${CYAN}[6/6] Applying changes (zero-downtime order)...${NC}"

if ($DryRun) {
    Write-Host "  ${CYAN}DRY RUN -- would run:${NC}"
    Write-Host "    docker compose up -d --no-deps n8n          (add timeout vars)"
    Write-Host "    docker compose up -d --no-deps n8n-worker   (bump concurrency)"
    Write-Host "    docker compose up -d --no-deps n8n-worker-webhooks  (new container)"
} else {
    # Restart in order: main n8n first (timeout vars), then workers
    foreach ($svc in @("n8n", "n8n-worker", "n8n-worker-webhooks")) {
        Write-Host "  Restarting $svc..." -NoNewline
        $out = Invoke-Remote "cd $ComposePath && docker compose up -d --no-deps $svc 2>&1"
        if ($LASTEXITCODE -eq 0) {
            Write-Host " ${GREEN}OK${NC}"
        } else {
            Write-Host " ${RED}FAIL${NC}"
            Write-Host "  $out"
        }
    }

    # Verify all three are running
    Write-Host ""
    Write-Host "  Container status:"
    $status = Invoke-Remote "cd $ComposePath && docker compose ps --format 'table {{.Name}}\t{{.Status}}' n8n n8n-worker n8n-worker-webhooks 2>&1"
    $status | ForEach-Object { Write-Host "    $_" }
}

Write-Host ""
Write-Host "${BOLD}=== Done ===${NC}"
Write-Host ""
Write-Host "Expected result: 50 total worker slots (25 per worker)"
Write-Host "Verify with:  ssh ${target} 'cd $ComposePath && docker compose ps'"
Write-Host "Test response time:  ssh administrator@192.168.30.67 ""curl -s -o /dev/null -w '%{time_connect}s connect  %{time_total}s total  %{http_code}' https://api-ain.looknet.ca/webhook/feed -k"""
Write-Host ""
