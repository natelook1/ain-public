#!/bin/bash
# Publishes a sanitized copy of this repo to natelook1/ain-public
# Run from c:\dev\ain with: bash publish-public.sh

set -e

PUBLIC_REMOTE="https://github.com/natelook1/ain-public.git"
TEMP_BRANCH="public-publish-temp"

echo "==> Preparing sanitized public branch..."

# Create a clean temp branch from current state
git checkout -b "$TEMP_BRANCH"

# ── Sanitize Backend workflows ────────────────────────────────────────────────

sed -i 's/eba71a0d-1b82-43ef-ad66-f4a15defe7dc/YOUR_WEBHOOK_UUID/g' \
  Backend/workflows/polling/redisq_poll.json

sed -i 's/1436186270190538927/YOUR_DISCORD_CHANNEL_ID/g' \
  Backend/workflows/indexing/archive_index_1.json \
  Backend/workflows/indexing/archive_index_2.json \
  Backend/workflows/indexing/archive_index_3.json \
  Backend/workflows/indexing/killmail_index.json

sed -i 's/1376260930668855489/YOUR_DISCORD_GUILD_ID/g' \
  Backend/workflows/bots/alfred.json

sed -i 's/Ore Ya Serious/YOUR_DISCORD_SERVER_NAME/g' \
  Backend/workflows/bots/alfred.json

sed -i 's/192\.168\.30\.56:6333/YOUR_QDRANT_HOST:6333/g' \
  Backend/workflows/bots/alfred.json

# ── Sanitize deploy scripts ───────────────────────────────────────────────────

sed -i \
  -e 's/192\.168\.30\.57/YOUR_SERVER_IP/g' \
  -e 's/192\.168\.30\.67/YOUR_SERVER_IP/g' \
  scripts/deploy-backend.ps1

sed -i \
  -e 's/192\.168\.30\.57/YOUR_SERVER_IP/g' \
  -e 's/192\.168\.30\.67/YOUR_SERVER_IP/g' \
  -e 's/n8n_secure_password/YOUR_DB_PASSWORD/g' \
  -e 's/lCtpgT3B7jh+keKLwvzMQh4Yg41vw+Iv/YOUR_N8N_ENCRYPTION_KEY/g' \
  scripts/deploy-n8n-workers.ps1

sed -i \
  -e 's/n8n_secure_password/YOUR_DB_PASSWORD/g' \
  -e 's/lCtpgT3B7jh+keKLwvzMQh4Yg41vw+Iv/YOUR_N8N_ENCRYPTION_KEY/g' \
  docker-swarm-stack.yml

sed -i \
  -e 's/192\.168\.30\.57/YOUR_SERVER_IP/g' \
  -e 's/192\.168\.30\.67/YOUR_SERVER_IP/g' \
  test_e2e.ps1

# ── Remove private-only files ─────────────────────────────────────────────────

git rm -r --cached Backend/tools/AlfredInt/ 2>/dev/null || true
git rm --cached Backend/workflows/webhooks/webhook_intel.json 2>/dev/null || true
git rm -r --cached Backend/private/ 2>/dev/null || true
git rm --cached AIN-BACKEND-MIGRATION.md 2>/dev/null || true
git rm --cached publish-public.sh 2>/dev/null || true
git rm --cached deploy.ps1 2>/dev/null || true
git rm --cached .env.example 2>/dev/null || true
rm -rf Backend/tools/AlfredInt/ Backend/workflows/webhooks/webhook_intel.json Backend/private/ \
  AIN-BACKEND-MIGRATION.md publish-public.sh deploy.ps1 .env.example

# ── Commit and push ───────────────────────────────────────────────────────────

git add -A
git commit -m "chore: sanitized publish $(date '+%Y-%m-%d %H:%M')"

echo "==> Pushing to public repo..."
git push "$PUBLIC_REMOTE" "$TEMP_BRANCH":main --force

# ── Cleanup ───────────────────────────────────────────────────────────────────

git checkout master
git branch -D "$TEMP_BRANCH"

# The sed commands ran on working files — restore originals from master
git checkout -- Backend/ scripts/ docker-swarm-stack.yml test_e2e.ps1

echo "==> Done. Public repo updated."
