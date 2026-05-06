# AIN Backend Migration: n8n Webhooks → Standalone Node.js Service

## Problem

All AIN webhook endpoints run inside n8n's execution queue. n8n serializes
executions — concurrent requests stack up waiting. With 2500ms+ execution
times on heavy endpoints, two simultaneous users can produce 5000ms responses,
causing Cloudflare tunnel 504s on `api-ain.looknet.ca` and `sse-ain.looknet.ca`.

The SSE server (`sse-ain.looknet.ca/sse`) is already standalone but 504s due to
Cloudflare's idle timeout on long-lived connections — needs a 30s keepalive heartbeat.

## Solution

Extract all n8n webhook Code nodes into a single **`ain-api`** Node.js service
(Fastify or plain `node:http`) running as a Docker container alongside n8n.
n8n keeps all non-webhook workflows (indexing, polling, bots, monitoring triggers).

---

## Endpoints to Migrate

| File | Method | Path | Complexity | Notes |
|------|--------|------|------------|-------|
| `webhook_feed.json` | GET | `/webhook/feed` | High | Lua Redis, filter pipeline, telemetry, 2500ms budget |
| `webhook_r2z2_stats` | GET | `/webhook/r2z2-stats` | Medium | Heavy on cache miss, 60s Redis cache |
| `webhook_cache.json` | GET | `/webhook/killmail-dashboard` | High | Two code nodes, ~24K chars |
| `webhook_intel.json` | GET | `/webhook/dashboard-intel` | Medium | ~11K chars |
| `webhook_search.json` | GET | `/webhook/search` | Medium | ~9K chars |
| `webhook_stats.json` | GET | `/webhook/stats` | Medium | ~11K chars |
| `webhook_system.json` | POST | `/webhook/system` | High | Four code nodes, ~35K chars total |
| `webhook_sse_presence.json` | POST | `/webhook/sse-presence` | Low | Presence logging only |

**Also fix (not migrate):**
- `Backend/sse-server/server.js` — add 30s keepalive heartbeat to fix CF tunnel idle timeout

---

## Architecture

```
CF Tunnel
  ├── api-ain.looknet.ca     → ain-api container (port 3000)  ← NEW
  ├── sse-ain.looknet.ca     → sse-server container (port 3001) ← EXISTS (fix heartbeat)
  └── n8n.looknet.ca         → n8n container (port 5678)  ← keep for non-webhook workflows
```

The `ain-api` container:
- Plain Node.js (`node:22-alpine`), no framework required given existing code style
- Connects to same Redis instance (`redis:6379`) on `alfred_network`
- Mounts no volumes — stateless, all state in Redis
- Auth: same `x-api-key` / `PUBLISH_SECRET` pattern already in use
- CORS: same `Access-Control-Allow-Origin: *` headers

---

## File Structure to Create

```
Backend/
  ain-api/
    server.js          ← main entry, HTTP server + route dispatch
    routes/
      feed.js          ← /webhook/feed (from webhook_feed.json)
      r2z2Stats.js     ← /webhook/r2z2-stats (from r2z2_monitor_backend.json)
      dashboard.js     ← /webhook/killmail-dashboard (from webhook_cache.json)
      intel.js         ← /webhook/dashboard-intel (from webhook_intel.json)
      search.js        ← /webhook/search (from webhook_search.json)
      stats.js         ← /webhook/stats (from webhook_stats.json)
      system.js        ← /webhook/system (from webhook_system.json)
      ssePresence.js   ← /webhook/sse-presence (from webhook_sse_presence.json)
    lib/
      redis.js         ← shared Redis client (single ioredis instance, not per-request)
      filters.js       ← filterKill() extracted from feed.js (shared with sse-server)
    package.json
    Dockerfile
```

---

## Critical Implementation Notes

### 1. Shared Redis Client (Most Important)

The n8n code nodes create a **new Redis connection per request** and `quit()` in
`finally`. This works in n8n but is wasteful. In the standalone service, use a
**single shared ioredis client** created at startup:

```js
// lib/redis.js
const Redis = require('ioredis');
const redis = new Redis({ host: 'redis', port: 6379, db: 0 });
module.exports = redis;
```

Import this in each route — do NOT create per-request connections and do NOT call
`redis.quit()` in route handlers.

### 2. Feed Route — Lua Command Registration

The feed webhook calls `redis.defineCommand('fetchBatch', ...)`. With a shared
client this must be called **once at startup**, not per-request:

```js
// In server.js startup, before routes
redis.defineCommand('fetchBatch', {
  numberOfKeys: 1,
  lua: `...`
});
```

### 3. System Webhook — Multi-Node Structure

`webhook_system.json` has **four sequential Code nodes**. When extracting, read
all four `jsCode` values in order and understand the data flow between them
(output of node N is input to node N+1 via `$input`). They likely map to:
parsing → enrichment → aggregation → response. Keep them as sequential async
functions in `system.js`, not separate HTTP handlers.

### 4. Killmail Dashboard — Two Code Nodes

`webhook_cache.json` has two Code nodes (~14K + ~10K chars). Same approach as
system — sequential functions in `dashboard.js`.

### 5. Input Mapping

n8n Code nodes read request data via `$input.first().json` which contains:
- `.query` — URL query params
- `.body` — request body
- `.headers` — request headers

In the standalone service, replace these with standard `req.query`, `req.body`,
`req.headers` from the HTTP framework.

### 6. n8n `$()` References

Some nodes reference other nodes via `$('Node Name').first()?.json`. These only
appear in multi-node workflows (system, dashboard). When extracting, replace with
direct variable passing between the sequential functions.

### 7. CORS & Headers

Every n8n webhook responds with:
```
Access-Control-Allow-Origin: *
Content-Type: application/json
```
Add a middleware in `server.js` that sets these on every response. Also handle
`OPTIONS` preflight for POST endpoints.

### 8. Error Shape

n8n Code nodes return `[{ json: { error: e.message } }]` on catch. Keep the
same response shape: `{ error: string }` with appropriate HTTP status codes
(500 for internal errors, 400 for bad input).

---

## SSE Server Fix (Quick Win — Do This First)

In `Backend/sse-server/server.js`, the `/sse` endpoint needs a 30-second
keepalive comment to prevent Cloudflare tunnel from closing idle connections:

```js
// After writing initial headers and adding client to registry:
const keepalive = setInterval(() => {
  res.write(': keepalive\n\n');
}, 30000);

req.on('close', () => {
  clearInterval(keepalive);
  clients.delete(clientId);
});
```

SSE comment lines (`: ...`) are ignored by EventSource clients but keep the
TCP connection alive through CF's 100s idle timeout.

---

## Docker / Compose Changes

Add to `docker-swarm-stack.yml` (or `compose.yml` on the ain VM):

```yaml
ain-api:
  build:
    context: ./Backend/ain-api
  container_name: ain-api
  restart: unless-stopped
  environment:
    - REDIS_HOST=redis
    - REDIS_PORT=6379
    - PORT=3000
    - API_KEY=${AIN_API_KEY}
  networks:
    - alfred_network
  depends_on:
    - redis
```

Update Cloudflare tunnel config to route `api-ain.looknet.ca` → `ain-api:3000`
instead of `n8n:5678/webhook/...`.

---

## n8n Webhook Decommission

After each endpoint is verified working in `ain-api`, **deactivate** (don't
delete) the corresponding n8n workflow. Keep them inactive for 2 weeks as
rollback, then delete.

Do NOT remove the non-webhook n8n workflows:
- `Backend/workflows/indexing/` — killmail indexing pipelines
- `Backend/workflows/polling/` — r2z2 poller
- `Backend/workflows/bots/` — Alfred bot
- `Backend/workflows/monitoring/` — cf_tunnel_status (keep trigger/cache nodes,
  remove only the webhook read node)

---

## Migration Order (Recommended)

1. **Fix SSE keepalive** — 10 min, immediate 504 reduction on `sse-ain`
2. **Scaffold `ain-api`** — server.js, lib/redis.js, Dockerfile, package.json
3. **`/webhook/r2z2-stats`** — simplest, single node, good test of the pattern
4. **`/webhook/sse-presence`** — trivial, validates CORS/POST handling
5. **`/webhook/feed`** — highest impact on 504s, most complex (Lua, filters)
6. **`/webhook/stats`** — standalone, medium complexity
7. **`/webhook/search`** — standalone, medium complexity
8. **`/webhook/dashboard-intel`** — medium complexity
9. **`/webhook/killmail-dashboard`** — two nodes, read carefully before extracting
10. **`/webhook/system`** — four nodes, most complex, save for last

After step 5, the primary 504 sources are eliminated. Steps 6-10 can be
done at lower urgency.

---

## Verification Per Endpoint

After migrating each endpoint:

```powershell
# Test response time (run from local or PVE node)
curl -s -o /dev/null -w "%{time_total}s  %{http_code}" https://api-ain.looknet.ca/webhook/r2z2-stats

# Expected: <0.1s for r2z2-stats (cached), <0.5s for feed
# Old n8n baseline: 1-3s
```

Monitor `api-ain.looknet.ca` 504 count in the CF Tunnel Monitor dashboard —
should drop to 0 within one polling cycle after the feed endpoint is migrated.

---

## What Stays in n8n

- All indexing workflows (killmail_index, archive_index_1/2/3, daily_index)
- r2z2_poll (the poller itself, not the stats webhook)
- Alfred bot workflows
- cf_tunnel_status workflow (the monitor itself)
- Any scheduled/trigger-based workflows

n8n is excellent for scheduled ETL and event-driven pipelines. It's only a
bad fit for request-response webhooks under concurrent load.
