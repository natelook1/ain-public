'use strict';

const http = require('http');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;

// Routes
const feed        = require('./routes/feed');
const r2z2Stats   = require('./routes/r2z2Stats');
const dashboard   = require('./routes/dashboard');
const intel       = require('./routes/intel');
const search      = require('./routes/search');
const stats       = require('./routes/stats');
const system      = require('./routes/system');
const ssePresence = require('./routes/ssePresence');

// ---------------------------------------------------------------------------
// Request body reader
// ---------------------------------------------------------------------------
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const base = `http://localhost:${PORT}`;
  let url;
  try { url = new URL(req.url, base); }
  catch { res.writeHead(400); res.end('Bad request'); return; }

  // CORS + cache headers on every response
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const path = url.pathname;
  console.log(`[${req.method}] ${path} latest_known_id=${url.searchParams.get('latest_known_id')} limit=${url.searchParams.get('limit')}`);

  try {
    if (path === '/webhook/feed' && req.method === 'GET') {
      return await feed(req, res, url);
    }
    if (path === '/webhook/r2z2-stats' && req.method === 'GET') {
      return await r2z2Stats(req, res, url);
    }
    if (path === '/webhook/killmail-dashboard' && req.method === 'GET') {
      return await dashboard(req, res, url);
    }
    if (path === '/webhook/dashboard-intel' && req.method === 'GET') {
      return await intel(req, res, url);
    }
    if (path === '/webhook/search' && req.method === 'GET') {
      return await search(req, res, url);
    }
    if (path === '/webhook/stats' && req.method === 'GET') {
      return await stats(req, res, url);
    }
    if (path === '/webhook/system' && req.method === 'POST') {
      const body = await readBody(req);
      return await system(req, res, url, body);
    }
    if (path === '/webhook/system' && req.method === 'GET') {
      res.writeHead(405); res.end(JSON.stringify({ error: 'POST only' })); return;
    }
    if (path === '/webhook/sse-presence' && req.method === 'POST') {
      const body = await readBody(req);
      return await ssePresence(req, res, url, body);
    }
    if (path === '/health' && req.method === 'GET') {
      res.writeHead(200); res.end(JSON.stringify({ status: 'ok' })); return;
    }

    res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    console.error('[Request error]', err);
    res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`[ain-api] http://localhost:${PORT}`);
});
