# Alfred's Intelligence Network (AIN)

> Real-time EVE Online kill intelligence — live feed, 3D starmap, alliance tracking, and deep analytics powered by zKillboard and n8n.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-zkillmap.com-brightgreen?style=for-the-badge&logo=googlechrome&logoColor=white)](https://zkillmap.com)

![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-0.163-black?logo=three.js&logoColor=white)
![n8n](https://img.shields.io/badge/n8n-workflows-EA4B71?logo=n8n&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-cache-DC382D?logo=redis&logoColor=white)

---

## What is AIN?

AIN is a live killmail intelligence dashboard built for EVE Online players and alliances. It pulls killmail data from zKillboard in real time, indexes it through a Redis-backed n8n pipeline, and presents it through a polished React frontend with multiple views, deep filtering, and a 3D interactive starmap.

It was built to give alliance FCs, intel officers, and curious pilots a fast, beautiful way to understand what's happening across New Eden.

---

## Features

### Kill Feed
Three view modes for different use cases:

| Mode | Description |
|------|-------------|
| **Standard** | Full kill cards with victim, attackers, ship icons, ISK value, location |
| **Compact** | Single-line rows for rapid scanning of high-volume feeds |
| **Mosaic** | Grid tiles with value-colored backgrounds and spawn animations |

New kills pulse on arrival — animation duration scales with ISK value (15s for cheap kills, 60s for supercapitals).

### Alliance & Corporation Tracking
- Search and track up to 4 alliances or corporations simultaneously
- Per-entity color customization with 16-color palette
- Live stats per entity: kills, losses, ISK destroyed, ISK lost, efficiency %, active pilots, top ship
- **Lurker Mode** — watch a specific entity highlighted across the global feed
- **Focus Mode** — filter the entire feed to one entity only
- Import/export tracked lists as JSON for sharing

### Advanced Filtering
- **Role:** kill, loss, assist, solo, fleet, NPC
- **Ship class:** full EVE taxonomy (frigates → supercapitals, structures, pods)
- **ISK range:** sub-10M → 50B+, across 7 brackets
- **Space type:** high-sec, low-sec, null-sec, Pochven, wormholes, Abyssal Deadspace
- **Region:** pick any EVE region from the map
- **Search:** full-text across system, character, corporation, and alliance names
- **Toggles:** hide pods, structures, rookie ships

### 3D Starmap
Built with Three.js, rendering 65,000+ EVE systems in real 3D coordinates.

- Known space (K-Space) laid out from SDE data
- **Pochven** rendered as its own ring cluster
- **Abyssal Deadspace** and **Wormhole space** as distinct zones
- Kill location heatmap overlay on the map
- Bloom post-processing for that EVE aesthetic
- Full orbit controls — rotate, zoom, pan

### Live Statistics Bar
- Real-time KPM (kills per minute) with trend arrow in header
- 24-hour totals: kills, ISK destroyed, active pilots
- Live EVE player count from ESI
- ISK distribution chart across value brackets
- Activity heatmap: today vs yesterday vs 30-day average

### Alfred — Discord Intelligence Bot
Alfred is a Discord bot wired directly into the AIN intelligence pipeline. Type a character name in your Discord server and Alfred returns a full tactical brief — rendered in Discord's ANSI color format.

**Commands:**
| Command | Response |
|---------|----------|
| Character name lookup | Full intel brief: threat level, combat record, ship preferences, recent kills, WH/capital flags |
| Market query | Current market data pulled from ESI |
| Route query | Optimal route with security status breakdown |
| System query | Live system intel: recent activity, kills, resident corps |

Alfred's reports are color-coded by threat level, ISK value, and security status — designed to be read instantly in the heat of a fight.

---

### Theming
10 built-in faction themes plus full custom theme support:

`Dark` · `Light` · `Amarr` · `Caldari` · `Gallente` · `Minmatar` · `Triglavian` · `ORE` · `Sisters of EVE` · `EDENCOM` · `Custom`

Custom themes accept any alliance or corporation logo and a configurable color palette — stored in localStorage.

---

## Architecture

```
┌─────────────────────────────────────┐
│         Cloudflare Tunnel           │
│   looknet.ca  /  api-ain.looknet.ca │
└────────────┬────────────────────────┘
             │
    ┌────────▼────────┐
    │   React / Vite  │        Frontend
    │   src/          │        served via Cloudflare
    └────────┬────────┘
             │  REST (webhooks)
    ┌────────▼────────┐
    │      n8n        │        Workflow engine
    │  api-ain.looknet│        (Docker, Proxmox)
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │     Redis       │        Hot cache & kill index
    │  (Docker LAN)   │        Sorted Sets, Hashes
    └─────────────────┘
             ▲
             │  feed
    ┌────────┴────────┐
    │   zKillboard    │        R2Z2 feed
    │   (external)    │
    └─────────────────┘
```

### Frontend (`src/`)

| Path | Purpose |
|------|---------|
| `src/api/config.js` | Single source of truth for all API endpoint URLs |
| `src/api/feed.js` | Kill feed fetching with filters, pagination, timeout |
| `src/api/stats.js` | 24h stats, pilot count, alliance info (ESI) |
| `src/api/search.js` | Alliance & corporation search |
| `src/components/Feed/` | Kill feed — KillCard, CompactKillRow, MosaicCard, KillFeed |
| `src/components/Starmap/` | Three.js 3D starmap + system intel overlay |
| `src/components/StatsBar/` | Live stats bar + activity chart |
| `src/components/Header/` | KPM display, theme switcher, map/feed toggle |
| `src/components/Sidebar/` | Alliance tracking, color pickers, import/export |
| `src/components/Filters/` | Full filter panel + map-specific filters |
| `src/context/` | React context: alliance tracking, theme, map mode, consent |

### Backend (`Backend/workflows/`)

| Category | Workflows | Purpose |
|----------|-----------|---------|
| `polling/` | r2z2_poll *(active)*, redisq_poll *(standby fallback)* | Pull live killmails from zKillboard via R2Z2; RedisQ kept inactive as backup |
| `webhooks/` | feed, intel, stats, search, cache, system | Serve frontend API requests from Redis |
| `indexing/` | killmail_index, archive_index (×3), daily_index, corp_name_reindex | Index kills across 20+ dimensions in Redis |
| `maintenance/` | db_heal, redis_tool, geo_worker | Data integrity, cache ops, geolocation |
| `monitoring/` | r2z2_monitor_backend | Feed health and KPM computation |
| `bots/` | alfred + Alfred sub-workflows | Discord bot: character/market/route/system lookups |

The three `archive_index` workflows run in parallel as separate workers, each handling a partition of the historical backfill — same code, different range variables.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 18 |
| Build tool | Vite 6 |
| 3D rendering | Three.js 0.163 (OrbitControls, UnrealBloom) |
| Workflow engine | n8n (self-hosted) |
| Cache / data store | Redis (Sorted Sets, Hashes, Lua scripting) |
| Kill data source | zKillboard — R2Z2 |
| EVE data | ESI (EVE Swagger Interface) |
| Infrastructure | Proxmox (PVE1/PVE2), Docker, Cloudflare Tunnel |

---

## Project Structure

```
AIN/
├── src/                        # React frontend
│   ├── api/                    # API layer (config, feed, stats, search)
│   ├── components/             # UI components
│   │   ├── Feed/               # Kill feed views
│   │   ├── Starmap/            # 3D starmap
│   │   ├── StatsBar/           # Live statistics
│   │   ├── Header/             # App header + theme switcher
│   │   ├── Sidebar/            # Alliance tracking panel
│   │   ├── Filters/            # Filter controls
│   │   └── ...
│   ├── context/                # React contexts
│   ├── data/                   # Static EVE region data
│   ├── styles/                 # Global CSS
│   └── utils/                  # Utilities (color extraction)
├── Backend/
│   ├── workflows/              # n8n workflow exports
│   │   ├── polling/            # Live kill ingestion
│   │   ├── webhooks/           # Frontend API handlers
│   │   ├── indexing/           # Kill indexing pipeline
│   │   ├── maintenance/        # DB/cache maintenance
│   │   ├── monitoring/         # Feed health monitoring
│   │   └── bots/               # Alfred Discord bot
│   └── tools/                  # Standalone utility pages
│       ├── ain-zkb/            # ZKB viewer tool
│       ├── AlfredInt/          # Alfred interface
│       └── r2z2_monitor.html   # Feed monitor page
├── public/                     # Static assets
│   ├── data/systems.json       # EVE system coordinates (SDE)
│   └── logo.mp4                # App logo animation
├── scripts/                    # Build / data prep scripts
├── publish-public.sh           # Sanitized publish to public repo
└── vite.config.js
```

### Scripts (`scripts/`)

One-time data preparation utilities — run these when setting up from scratch, not during normal operation.

| Script | Purpose |
|--------|---------|
| `populateSystemsData.cjs` | Builds `public/data/systems.json` from the EVE SDE — 65,000+ systems with 3D coordinates |
| `process_map_data.cjs` | Processes raw SDE map exports into the format the starmap expects |
| `reindex_attacker_ships.js` | Backfills ship type data across existing Redis kill records |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A running n8n instance with the workflows imported
- Redis accessible from n8n (Docker network alias `redis`)
- Cloudflare Tunnel routing `api-ain.yourdomain.com` → n8n

### Frontend

```bash
npm install
npm run dev      # development server
npm run build    # production build → dist/
```

### Backend
Import the workflow JSONs from `Backend/workflows/` into n8n. Start with:
1. `polling/` — gets data flowing in
2. `indexing/` — sets up the data structure
3. `webhooks/` — enables frontend API calls

> **Note:** Workflow files in this public repo have secrets replaced with placeholders (`YOUR_WEBHOOK_UUID`, `YOUR_DISCORD_CHANNEL_ID`, etc.). Fill these in after importing to n8n.

---

## Configuration

All frontend API endpoints are defined in one place:

```js
// src/api/config.js
const API_BASE_URL = 'https://api-ain.looknet.ca/webhook'

export const API_ENDPOINTS = {
  FEED:        `${API_BASE_URL}/feed`,
  STATS:       `${API_BASE_URL}/stats`,
  SEARCH:      `${API_BASE_URL}/search`,
  R2Z2_STATS:  `${API_BASE_URL}/r2z2-stats`,
  SYSTEM_INTEL:`${API_BASE_URL}/system`
}
```

Change `API_BASE_URL` to point at your own n8n instance.

---

## Data Flow

```
zKillboard R2Z2
       │
       ▼
  r2z2_poll                    ← n8n polling workflow
       │
       ▼
  killmail_index                ← indexes kill into Redis by:
       │                           kill ID, ISK value, ship type,
       │                           region, space type, alliance/corp,
       │                           solar system, hour bucket, day bucket
       ▼
     Redis                      ← Sorted Sets + Hashes, ~30 day window
       │
       ▼
  webhook_feed/stats/intel      ← n8n webhooks respond to frontend
       │
       ▼
   React frontend               ← renders kill feed, stats, starmap
```

---

## Related

- [zKillboard](https://zkillboard.com) — kill data source
- [EVE ESI](https://esi.evetech.net) — EVE Online public API
- [n8n](https://n8n.io) — workflow automation engine
- [EVE SDE](https://developers.eveonline.com/resource/resources) — static data export (system coordinates)

---

*Built for the pilots of New Eden.*
