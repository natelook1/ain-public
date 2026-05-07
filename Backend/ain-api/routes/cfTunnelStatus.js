'use strict';

const redis = require('../lib/redis');

module.exports = async function cfTunnelStatus(req, res) {
  try {
    const raw = await redis.get('cf:tunnel:status');
    if (!raw) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: 'No data cached yet.', fetched_at: null, summary: null, tunnels: [] }));
      return;
    }

    const [historyRaw, threatHistoryRaw, libraryIps, libraryData] = await Promise.all([
      redis.lrange('cf:tunnel:history', 0, -1),
      redis.lrange('cf:tunnel:threat_history', 0, -1),
      redis.zrevrange('cf:threat:ip_timeline', 0, 99),
      redis.hgetall('cf:threat:known_ips'),
    ]);

    const history      = historyRaw.map(h => JSON.parse(h)).reverse();
    const threatHistory = threatHistoryRaw.map(h => JSON.parse(h)).reverse();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const threatLibrary = libraryIps.map(ip => {
      const rec = libraryData && libraryData[ip] ? JSON.parse(libraryData[ip]) : {};
      return { ip, ...rec, dormant: rec.last_seen ? rec.last_seen < thirtyDaysAgo : false };
    });

    const responseData = JSON.parse(raw);
    responseData.history         = history;
    responseData.threat_history  = threatHistory;
    responseData.threat_library  = threatLibrary;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const INTERNAL_PATH_PREFIXES = ['/healthz', '/rest/', '/webhook/', '/types/', '/workflows/', '/status/', '/assets/'];
    const persistentWaf = threatLibrary
      .filter(e => {
        if (e.severity_peak !== 'high') return false;
        if (e.last_seen < sevenDaysAgo) return false;
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

    if (persistentWaf.length > 0) responseData.waf_candidates = persistentWaf;

    res.writeHead(200, { 'Cache-Control': 'max-age=60' });
    res.end(JSON.stringify(responseData));
  } catch (err) {
    console.error('[cfTunnelStatus]', err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
};
