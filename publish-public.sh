#!/bin/bash
# Publishes a sanitized copy of this repo to natelook1/ain-public
# Run from C:\AIN with: bash publish-public.sh

set -e

PUBLIC_REMOTE="https://github.com/natelook1/ain-public.git"
TEMP_BRANCH="public-publish-temp"

echo "==> Preparing sanitized public branch..."

# Create a clean temp branch from current state
git checkout -b "$TEMP_BRANCH"

# Sanitize secrets in Backend files
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

# Commit the sanitized state
git add -A
git commit -m "chore: sanitized publish $(date '+%Y-%m-%d %H:%M')"

# Push to public repo
echo "==> Pushing to public repo..."
git push "$PUBLIC_REMOTE" "$TEMP_BRANCH":main --force

# Return to main and clean up temp branch
git checkout main
git branch -D "$TEMP_BRANCH"

# Restore real values (temp branch changes don't affect main's working tree,
# but the sed ran on working files — restore from main)
git checkout -- Backend/

echo "==> Done. Public repo updated."
