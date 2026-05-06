'use strict';

const http = require('http');
const { URL } = require('url');

const PORT = process.env.SSE_PORT || 3001;
const PUBLISH_SECRET = process.env.PUBLISH_SECRET || 'local-dev';
const CORS_ORIGINS = new Set((process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()));

// In-memory client registry
// Map<clientId, { res, filters }>
const clients = new Map();
let clientIdCounter = 0;

// ---------------------------------------------------------------------------
// Filter parsing
// ---------------------------------------------------------------------------

function parseFilters(searchParams) {
  return {
    alliance_id:    searchParams.get('alliance_id')?.split(',').filter(Boolean)    || [],
    corporation_id: searchParams.get('corporation_id')?.split(',').filter(Boolean) || [],
    filters_main:   searchParams.get('filters_main')?.split(',').filter(Boolean)   || [],
    filters_space:  searchParams.get('filters_space')?.split(',').filter(Boolean)  || [],
    filters_isk:    searchParams.get('filters_isk')?.split(',').filter(Boolean)    || [],
    filters_ship:   searchParams.get('filters_ship')?.split(',').filter(Boolean)   || [],
    filters_region: searchParams.get('filters_region')?.split(',').filter(Boolean) || [],
    search_query:   searchParams.get('search_query') || '',
    lurker:         searchParams.get('lurker') === 'true',
  };
}

// ---------------------------------------------------------------------------
// Filter matching — mirrors the backend feed API logic against enriched kills
// ---------------------------------------------------------------------------

const ISK_BRACKETS = {
  'sub10m':    v => v < 10e6,
  '10m-100m':  v => v >= 10e6    && v < 100e6,
  '100m-1b':   v => v >= 100e6   && v < 1e9,
  '1b-10b':    v => v >= 1e9     && v < 10e9,
  '10b-20b':   v => v >= 10e9    && v < 20e9,
  '20b-50b':   v => v >= 20e9    && v < 50e9,
  '50b':       v => v >= 50e9,
};

function matchesFilters(kill, filters) {
  // Alliance / corp scope
  if (filters.alliance_id.length > 0) {
    const inAttackers = kill.attackers?.some(a => filters.alliance_id.includes(String(a.alliance_id)));
    const isVictim    = filters.alliance_id.includes(String(kill.victim?.alliance_id));
    if (!inAttackers && !isVictim) return false;
  }
  if (filters.corporation_id.length > 0) {
    const inAttackers = kill.attackers?.some(a => filters.corporation_id.includes(String(a.corporation_id)));
    const isVictim    = filters.corporation_id.includes(String(kill.victim?.corporation_id));
    if (!inAttackers && !isVictim) return false;
  }

  // Space type
  if (filters.filters_space.length > 0) {
    if (!filters.filters_space.includes(kill.space_type)) return false;
  }

  // Region
  if (filters.filters_region.length > 0) {
    if (!filters.filters_region.includes(String(kill.region_id))) return false;
  }

  // ISK value brackets (OR — match any selected bracket)
  if (filters.filters_isk.length > 0) {
    const val = kill.total_value || 0;
    const matches = filters.filters_isk.some(b => ISK_BRACKETS[b]?.(val));
    if (!matches) return false;
  }

  // Ship type (victim)
  if (filters.filters_ship.length > 0) {
    if (!filters.filters_ship.includes(String(kill.victim?.ship_type_id))) return false;
  }

  // Main filters
  if (filters.filters_main.length > 0) {
    for (const f of filters.filters_main) {
      if (f === 'hide-pods'       && kill.victim?.ship_type_id === 670)         return false;
      if (f === 'hide-structures' && kill.victim_ship_class === 'structure')     return false;
      if (f === 'hide-trash'      && kill.victim_ship_class === 'rookie')        return false;
    }
    // Role / encounter type filters match against victim_ship_class_detailed or encounter markers
    const roleFilters = filters.filters_main.filter(
      f => !['hide-pods', 'hide-structures', 'hide-trash'].includes(f)
    );
    if (roleFilters.length > 0) {
      const killClass = kill.victim_ship_class_detailed || kill.victim_ship_class || '';
      const killFleet = kill.fleet_size || '';
      const matchesRole = roleFilters.some(r => r === killClass || r === killFleet);
      if (!matchesRole) return false;
    }
  }

  // Search query (victim name / ship / system)
  if (filters.search_query) {
    const q = filters.search_query.toLowerCase();
    const fields = [
      kill.victim?.character_name,
      kill.victim?.corporation_name,
      kill.victim?.alliance_name,
      kill.victim?.ship_type_name,
      kill.solar_system_name,
    ];
    if (!fields.some(f => f?.toLowerCase().includes(q))) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function sseWrite(res, kill) {
  try {
    res.write(`id: ${kill.killmail_id}\n`);
    res.write(`event: kill\n`);
    res.write(`data: ${JSON.stringify(kill)}\n\n`);
  } catch {
    // Client disconnected; cleanup handled by 'close' event
  }
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const base = `http://localhost:${PORT}`;
  let url;
  try {
    url = new URL(req.url, base);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  const reqOrigin = req.headers.origin || '';
  const allowedOrigin = CORS_ORIGINS.has('*') ? '*' : (CORS_ORIGINS.has(reqOrigin) ? reqOrigin : '');
  if (allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Publish-Secret');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ------------------------------------------------------------------
  // GET /sse — client subscribes
  // ------------------------------------------------------------------
  if (req.method === 'GET' && url.pathname === '/sse') {
    const filters  = parseFilters(url.searchParams);
    const clientId = ++clientIdCounter;

    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx / CF buffering
    });

    res.write(': connected\n\n');

    const heartbeat = setInterval(() => {
      try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
    }, 25_000);

    clients.set(clientId, { res, filters });
    console.log(`[SSE] +client ${clientId}  (total: ${clients.size})`);

    req.on('close', () => {
      clients.delete(clientId);
      clearInterval(heartbeat);
      console.log(`[SSE] -client ${clientId}  (total: ${clients.size})`);
    });

    return;
  }

  // ------------------------------------------------------------------
  // POST /publish — n8n pushes an enriched kill here
  // ------------------------------------------------------------------
  if (req.method === 'POST' && url.pathname === '/publish') {
    if (req.headers['x-publish-secret'] !== PUBLISH_SECRET) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let kill;
      try {
        kill = JSON.parse(body);
      } catch {
        res.writeHead(400);
        res.end('Invalid JSON');
        return;
      }

      let pushed = 0;
      for (const [, client] of clients) {
        if (matchesFilters(kill, client.filters)) {
          sseWrite(client.res, kill);
          pushed++;
        }
      }

      console.log(`[Publish] kill ${kill.killmail_id}  → ${pushed}/${clients.size} clients`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, clients_notified: pushed }));
    });

    return;
  }

  // ------------------------------------------------------------------
  // GET /health
  // ------------------------------------------------------------------
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', clients: clients.size }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`[SSE Server] http://localhost:${PORT}`);
  console.log(`[SSE Server] PUBLISH_SECRET=${PUBLISH_SECRET}`);
});
