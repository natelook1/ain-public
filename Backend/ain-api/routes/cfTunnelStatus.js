'use strict';

const { URL } = require('url');
const redis = require('../lib/redis');

module.exports = async function cfTunnelStatus(req, res) {
  try {
    const raw = await redis.get('cf:tunnel:status');
    if (!raw) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: 'No data cached yet.', fetched_at: null, summary: null, tunnels: [] }));
      return;
    }

    const url      = new URL(req.url, `http://localhost`);
    const params   = url.searchParams;
    const severity = params.get('severity') || '';
    const search   = (params.get('search') || '').trim();
    const activeOnly = params.get('active') === '1';
    const sortBy   = params.get('sort') || 'last_seen';
    const offset   = Math.max(0, parseInt(params.get('offset') || '0', 10));
    const limit    = Math.min(500, Math.max(1, parseInt(params.get('limit') || '200', 10)));

    const [historyRaw, threatHistoryRaw, libraryData] = await Promise.all([
      redis.lrange('cf:tunnel:history', 0, -1),
      redis.lrange('cf:tunnel:threat_history', 0, -1),
      redis.hgetall('cf:threat:known_ips'),
    ]);

    const history       = historyRaw.map(h => JSON.parse(h)).reverse();
    const threatHistory = threatHistoryRaw.map(h => JSON.parse(h)).reverse();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevOrder = { high: 0, medium: 1, low: 2 };

    // Use the hash directly — it holds every IP ever seen, no cap
    const allLibrary = libraryData
      ? Object.entries(libraryData).map(([ip, raw]) => {
          const rec = JSON.parse(raw);
          return { ip, ...rec, dormant: rec.last_seen ? rec.last_seen < thirtyDaysAgo : false };
        })
      : [];

    // WAF candidates from full unfiltered library
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const INTERNAL_PATH_PREFIXES = ['/healthz', '/rest/', '/webhook/', '/types/', '/workflows/', '/status/', '/assets/'];
    const persistentWaf = allLibrary
      .filter(e => {
        if (e.severity_peak !== 'high') return false;
        if (!e.last_seen || e.last_seen < sevenDaysAgo) return false;
        const paths = e.sample_paths || [];
        if (paths.length === 0) return true;
        return !paths.every(p => INTERNAL_PATH_PREFIXES.some(pfx => p.startsWith(pfx)));
      })
      .sort((a, b) => (b.total_hits_alltime || 0) - (a.total_hits_alltime || 0))
      .slice(0, 20)
      .map(e => ({
        ip:             e.ip,
        country:        e.countries?.[0] || '',
        total_hits:     e.total_hits_alltime || 0,
        threat_classes: e.threat_classes || [],
        severity:       e.severity_peak || 'high',
        sample_paths:   (e.sample_paths || []).slice(0, 5),
        sample_uas:     (e.sample_uas   || []).slice(0, 2),
        waf_rule:       `(ip.src eq ${e.ip})`,
        waf_action:     'block',
      }));

    // Apply filters for the paged library view
    let filteredLibrary = allLibrary;
    if (severity)   filteredLibrary = filteredLibrary.filter(e => e.severity_peak === severity);
    if (activeOnly) filteredLibrary = filteredLibrary.filter(e => !e.dormant);
    if (search) {
      const q = search.toLowerCase();
      filteredLibrary = filteredLibrary.filter(e =>
        e.ip.includes(q) ||
        (e.sample_paths || []).some(p => p.toLowerCase().includes(q)) ||
        (e.countries    || []).some(c => c.toLowerCase().includes(q))
      );
    }

    filteredLibrary.sort((a, b) => {
      if (sortBy === 'total_hits') return (b.total_hits_alltime ?? 0) - (a.total_hits_alltime ?? 0);
      if (sortBy === 'severity')   return (sevOrder[a.severity_peak] ?? 2) - (sevOrder[b.severity_peak] ?? 2);
      return new Date(b.last_seen ?? 0).getTime() - new Date(a.last_seen ?? 0).getTime();
    });

    const libraryTotal = filteredLibrary.length;
    const pagedLibrary = filteredLibrary.slice(offset, offset + limit);

    const responseData = JSON.parse(raw);
    responseData.history          = history;
    responseData.threat_history   = threatHistory;
    responseData.threat_library   = pagedLibrary;
    responseData.library_meta     = { total: libraryTotal, offset, limit, has_more: offset + limit < libraryTotal };
    if (persistentWaf.length > 0) responseData.waf_candidates = persistentWaf;

    res.writeHead(200, { 'Cache-Control': 'max-age=60' });
    res.end(JSON.stringify(responseData));
  } catch (err) {
    console.error('[cfTunnelStatus]', err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
};
