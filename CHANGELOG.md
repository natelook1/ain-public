# Changelog

All notable changes to AIN are documented here.

---

## [Unreleased]

### Changed
- Starmap (Three.js) chunk deferred until user first activates map mode — feed-only users never download the ~870KB Three.js bundle
- Intel dashboard pilot deduplication now keys by fingerprint first (IP as fallback), fixing duplicate pilot entries when SSE and legacy log entries had the same fingerprint but different key paths

---

## 2026-04-27 — SSE Push System

Replaced the polling architecture with a persistent Server-Sent Events push system. New kills now appear in the feed the moment they are indexed — no more 5-second poll interval hammering the API.

### Added
- **SSE server** (`Backend/sse-server/server.js`) — Node.js process serving `GET /sse` streams, `POST /publish` ingest (secret-validated), and `GET /health`
- **Filter-aware fan-out** — SSE server matches each incoming kill against each connected client's active filters before pushing; clients only receive kills they would have seen via the feed
- **Traefik routing** — `sse-ain.looknet.ca` routed to the SSE server with `X-Accel-Buffering: no` middleware to prevent proxy buffering of the event stream
- **Presence ping** (`Backend/workflows/webhooks/webhook_sse_presence.json`) — n8n webhook that logs SSE client sessions to Redis; clients ping on connect and every 60 seconds
- **PUSH/POLL badges** in AlfredInt monitoring dashboard — pilot cards now show connection type (cyan PUSH vs amber POLL) and session duration for SSE clients
- **Session duration tracking** — `intel:session:start:{fingerprint}` Redis key (NX, 24h TTL) set on first SSE ping; displayed in the monitoring dashboard
- **CONN column** added to Signal Matrix table in AlfredInt
- **`sse_client=true` param** on all feed requests — prevents the feed workflow from overwriting SSE presence entries in `intel:logs:connections`
- **ErrorBoundary component** (`src/components/ErrorBoundary/ErrorBoundary.jsx`) wrapping Starmap and KillFeed — isolates render failures without crashing the whole app
- **Backend test coverage** for SSE health endpoint and `/sse-presence` POST (`test-backend.ps1`)

### Changed
- **SSE effect stabilized** — `buildFilterParams` and `activeViewFingerprint` stored in refs; SSE `useEffect` deps narrowed to primitive/stable values, eliminating constant teardown/recreate that was preventing the connection from opening
- **Lurker mode SSE** — alliance/corp scope stripped from SSE params when `lurker=true`; all kills stream through and lurked kills are highlighted client-side (previously only lurked alliance kills were streamed)
- **Starmap data sync** — Starmap state only updated when map mode is active, preventing unnecessary re-renders while on the feed view
- **Intel workflow** (`webhook_intel.json`) — tracks `last_sse` per pilot, batch-fetches session start times, adds `connection_type` and `session_duration_sec` to `top_users` response
- **Feed workflow** (`webhook_feed.json`) — skips `intel:logs:connections` write when `sse_client=true` to avoid clobbering SSE presence status
- Architecture diagram in README updated to include SSE server and push flow

### Infrastructure
- SSE server added to Docker Swarm stack with `PUBLISH_SECRET` and `CORS_ORIGIN` env vars
- n8n and n8n-worker receive `SSE_PUBLISH_SECRET` for the publish HTTP Request node
- `VITE_SSE_BASE` env var controls the SSE server URL at build time

---

## 2026-04-20 — Stats Pipeline Optimization

### Changed
- Stats pipeline merged into a single Redis round trip on cache hit (~15ms → ~7ms response time)

---

## 2026-04-15 — Mobile & UX Fixes

### Fixed
- Default to compact view on mobile when no saved preference exists

---

## Earlier

- 3D Starmap with Three.js, OrbitControls, UnrealBloom post-processing
- Alliance and corporation tracking with lurker/focus modes
- Advanced kill feed filtering (ship class, ISK range, space type, region, role)
- Standard / Compact / Mosaic feed view modes
- Activity heatmap and live stats bar (KPM, 24h totals, EVE player count)
- Alfred Discord bot integration
- 10 faction themes + custom theme support
- AlfredInt monitoring dashboard (pilot registry, Signal Matrix, activity timeline)
- Historical kill archive indexing pipeline
- zKillboard R2Z2 ingestion with RedisQ standby fallback
