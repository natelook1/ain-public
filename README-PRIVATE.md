# AIN — Production Operations Guide

> Internal reference for infrastructure, deployment, secrets, workflow management, and the two-repo publish workflow.

---

## Repo Structure

| Repo | Visibility | Purpose |
|------|-----------|---------|
| `natelook1/ain` *(this repo)* | **Private** | Source of truth — real secrets, n8n-ready workflows |
| `natelook1/ain-public` | Public | Sanitized showcase — secrets replaced with placeholders |

**Never commit to ain-public directly.** Always push here first, then run `publish-public.sh`.

---

## Daily Git Workflow

```bash
# After any change:
git add <specific files>
git commit -m "description of change"
git push                   # → private repo (source of truth)

# When ready to update the public showcase:
bash publish-public.sh     # → strips secrets, pushes to ain-public automatically
```

---

## Secrets Reference

These values are stripped by `publish-public.sh` when pushing to the public repo.

| Secret | Value | Used In |
|--------|-------|---------|
| Webhook UUID | `eba71a0d-1b82-43ef-ad66-f4a15defe7dc` | `polling/redisq_poll.json` (standby) |
| Discord Channel ID | `1436186270190538927` | `indexing/archive_index_*.json`, `indexing/killmail_index.json` |
| Discord Guild ID | `1376260930668855489` | `bots/alfred.json` |
| Discord Server Name | `Ore Ya Serious` | `bots/alfred.json` |
| GA Measurement ID | `G-SD80ZQ01XR` | `src/context/ConsentContext.jsx` — intentional, leave as-is |

---

## Infrastructure

```
Proxmox PVE1    192.168.30.31
Proxmox PVE2    192.168.30.32

Docker services (on PVE nodes):
  - n8n          → exposed via Cloudflare Tunnel as api-ain.looknet.ca
  - Redis        → internal Docker hostname: redis (not exposed externally)

Cloudflare Tunnel:
  looknet.ca           → React frontend (dist/)
  api-ain.looknet.ca   → n8n webhooks
```

---

## n8n Workflow Import Order

When setting up from scratch, import in this order so dependencies are satisfied:

1. **`webhooks/`** — import all 6, activate them. n8n needs the webhook paths registered before polling starts.
2. **`polling/r2z2_poll.json`** — activate this to start the kill feed. This is the live feed worker.
3. **`indexing/killmail_index.json`** — activate to start indexing incoming kills into Redis.
4. **`indexing/archive_index_1/2/3.json`** — activate all three for parallel historical backfill.
5. **`indexing/daily_index.json`** — activate for daily rollup stats.
6. **`monitoring/r2z2_monitor_backend.json`** — activate for feed health and KPM computation.
7. **`maintenance/`** — import all three, activate on schedule as needed.
8. **`bots/alfred.json`** + **`bots/Alfred/*.json`** — import last, activate once Discord credentials are configured.

> **`polling/redisq_poll.json`** — import but **do not activate**. This is the standby fallback. Only enable it if R2Z2 goes down.

---

## Workflow Categories

### Polling (`Backend/workflows/polling/`)
| File | Status | Purpose |
|------|--------|---------|
| `r2z2_poll.json` | **Active** | Pulls live killmails from zKillboard via R2Z2 WebSocket relay |
| `redisq_poll.json` | **Standby** | RedisQ HTTP fallback — activate if R2Z2 is down |

### Webhooks (`Backend/workflows/webhooks/`)
All six are always-on, responding to frontend API requests from Redis:

| File | Endpoint | Returns |
|------|----------|---------|
| `webhook_feed.json` | `/webhook/feed` | Paginated kill list with filters |
| `webhook_stats.json` | `/webhook/stats` | 24h totals, KPM, ISK breakdown |
| `webhook_intel.json` | `/webhook/r2z2-stats` | Live feed health, KPM rate |
| `webhook_search.json` | `/webhook/search` | Alliance/corp name search |
| `webhook_cache.json` | `/webhook/cache` | Raw Redis cache ops |
| `webhook_system.json` | `/webhook/system` | Per-system kill intel for starmap |

### Indexing (`Backend/workflows/indexing/`)
| File | Purpose |
|------|---------|
| `killmail_index.json` | Indexes each incoming kill across 20+ Redis dimensions |
| `archive_index_1/2/3.json` | **Parallel workers** — same code, different range variables. Run together for historical backfill. |
| `daily_index.json` | Rolls up daily stats buckets |
| `corp_name_reindex.json` | Backfills corp/alliance name resolution across existing records |

### Maintenance (`Backend/workflows/maintenance/`)
| File | Purpose |
|------|---------|
| `db_heal.json` | Repairs malformed or incomplete Redis records |
| `redis_tool.json` | Manual cache inspection and operations |
| `geo_worker.json` | Populates geolocation data for solar systems |

---

## Frontend API Config

All endpoints in one place — change domain here only:

```js
// src/api/config.js
const API_BASE_URL = 'https://api-ain.looknet.ca/webhook'

export const API_ENDPOINTS = {
  FEED:         `${API_BASE_URL}/feed`,
  STATS:        `${API_BASE_URL}/stats`,
  SEARCH:       `${API_BASE_URL}/search`,
  R2Z2_STATS:   `${API_BASE_URL}/r2z2-stats`,
  SYSTEM_INTEL: `${API_BASE_URL}/system`
}
```

---

## Frontend Build

```bash
npm install
npm run dev      # local dev server (hot reload)
npm run build    # production build → dist/
```

`dist/` is served via Cloudflare Tunnel at `looknet.ca`. After building, the tunnel picks up the new files automatically — no restart needed.

---

## One-Time Setup Scripts

Run these only when rebuilding from scratch — not during normal operation:

```bash
node scripts/populateSystemsData.cjs   # builds public/data/systems.json from EVE SDE
node scripts/process_map_data.cjs      # processes raw SDE map export
node scripts/reindex_attacker_ships.js # backfills ship types in Redis
```

---

## Publish Script

`publish-public.sh` automates the sanitized push to `ain-public`:

1. Creates a temp branch `public-publish-temp`
2. Replaces all secrets with placeholders via `sed`
3. Force-pushes the temp branch to `ain-public` as `main`
4. Deletes the temp branch — private repo is untouched

Run it any time you want the public repo to reflect the current state:

```bash
bash publish-public.sh
```

---

## Redis Data Structure (overview)

Kill data is stored across Sorted Sets (for range/time queries) and Hashes (for full kill detail):

| Key pattern | Type | Contents |
|-------------|------|---------|
| `kills:global` | Sorted Set | All kill IDs, scored by timestamp |
| `kills:isk` | Sorted Set | Kill IDs scored by ISK value |
| `kills:region:{id}` | Sorted Set | Kill IDs by EVE region |
| `kills:alliance:{id}` | Sorted Set | Kill IDs by attacker alliance |
| `kills:corp:{id}` | Sorted Set | Kill IDs by attacker corp |
| `kills:ship:{typeId}` | Sorted Set | Kill IDs by ship type |
| `kills:system:{id}` | Sorted Set | Kill IDs by solar system |
| `kill:{id}` | Hash | Full killmail data |
| `stats:daily:{YYYY-MM-DD}` | Hash | Daily rollup: kills, ISK, pilots |
| `kpm:buckets` | Sorted Set | KPM time-series for rate display |

---

## Tools (`Backend/tools/`)

Standalone HTML pages — open directly in browser, no build step:

| Tool | Purpose |
|------|---------|
| `r2z2_monitor.html` | Live feed health monitor — shows R2Z2 connection state and KPM |
| `ain-zkb/index.html` | Standalone ZKB viewer |
| `AlfredInt/index.html` | Alfred bot interface |

---

*This repo is private. Do not share the URL or push real secrets to ain-public.*
