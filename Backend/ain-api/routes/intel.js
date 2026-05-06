'use strict';

const redis = require('../lib/redis');

const deriveIntent = l => {
  const q = l.query || {};
  const v = String(l.view || q.view || 'standard').toLowerCase();
  if (v === 'map_3d')   return 'Tactical 3D';
  if (v === 'map_flat') return 'Flat Map';
  if (v === 'map_2d')   return 'Tactical 2D';
  if (v === 'mosaic')   return 'Mosaic Grid';
  if (v === 'compact')  return 'Compact Feed';
  if (q.w_space) return 'W-Space Hunter';
  const i = l.intent || 'Feed';
  if (i.includes('Search')) return 'Global Search';
  return i;
};

module.exports = async function intel(req, res) {
  try {
    const logs = await redis.lrange('intel:logs:connections', 0, 49999);
    const usageStats = await redis.hgetall('intel:usage:stats') || {};
    const activeFingerprintsRaw = await redis.zrangebyscore('intel:active:pilots', Math.floor(Date.now() / 1000) - 900, '+inf');
    const activeSet  = new Set(activeFingerprintsRaw);
    const nicknames  = await redis.hgetall('intel:user:nicknames') || {};

    const sessionPipe = redis.pipeline();
    activeFingerprintsRaw.forEach(fp => sessionPipe.get('intel:session:start:' + fp));
    const sessionResults = await sessionPipe.exec();
    const sessionStarts = {};
    activeFingerprintsRaw.forEach((fp, i) => {
      const v = sessionResults[i][1];
      if (v) sessionStarts[fp] = parseInt(v);
    });

    const parsedLogs = logs.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

    const uIPs = [...new Set(parsedLogs.map(l => l.ip).filter(i => i && i !== 'unknown'))];
    const gP = redis.pipeline();
    uIPs.forEach(ip => gP.get('intel:geo:' + ip));
    const gR = await gP.exec();
    const gMap = {};
    uIPs.forEach((ip, i) => {
      const v = gR[i][1];
      if (v && v !== 'null') gMap[ip] = JSON.parse(v);
    });

    const now = Math.floor(Date.now() / 1000);

    const userActivity = parsedLogs.reduce((acc, log) => {
      const id = log.ip && log.ip !== 'unknown' ? log.ip : (log.id || 'unknown');
      if (!acc[id]) {
        acc[id] = {
          hits: 0, last_ts: log.ts, geo: gMap[log.ip] || log.geo || null,
          latest_resolved: {}, latest_filters: {}, active_views: new Set(),
          fingerprints: new Set(), last_intent: deriveIntent(log),
          last_sse: log.sse === true, last_interaction_ts: log.sse !== true ? log.ts : null,
        };
      }
      acc[id].hits++;
      if (log.id && activeSet.has(log.id)) acc[id].fingerprints.add(log.id);
      if (log.ts >= acc[id].last_ts) {
        acc[id].last_ts  = log.ts;
        acc[id].last_sse = log.sse === true;
        if (log.sse !== true) acc[id].last_interaction_ts = Math.max(acc[id].last_interaction_ts || 0, log.ts);
      }
      if (now - log.ts < 180) {
        acc[id].active_views.add(String(log.view || 'standard').toLowerCase());
        if (log.query) acc[id].latest_filters = { ...acc[id].latest_filters, ...log.query };
        if (log.resolved || log.query_data) acc[id].latest_resolved = { ...acc[id].latest_resolved, ...(log.resolved || {}), ...(log.query_data || {}) };
      }
      if (!acc[id].processed) {
        acc[id].last_view   = log.view || (log.query && log.query.view) || 'standard';
        acc[id].last_intent = deriveIntent(log);
        acc[id].processed   = true;
      }
      return acc;
    }, {});

    const topUsers = Object.keys(userActivity).map(key => {
      const u   = userActivity[key];
      const fps = [...u.fingerprints];
      const active = fps.some(fp => activeSet.has(fp));
      const sessionStart = fps.reduce((earliest, fp) => {
        const s = sessionStarts[fp];
        return s ? (earliest ? Math.min(earliest, s) : s) : earliest;
      }, null);
      return {
        ...u,
        id: key,
        nickname: nicknames[key] || null,
        active_views: Array.from(u.active_views),
        fingerprints: fps,
        session_count: fps.length,
        active,
        active_now: (now - (u.last_ts || 0)) < 90,
        connection_type: u.last_sse
          ? ((now - (u.last_interaction_ts || 0)) < 300 ? 'sse_active' : 'sse_passive')
          : 'legacy',
        session_duration_sec: sessionStart ? (now - sessionStart) : null,
      };
    }).sort((a, b) => b.hits - a.hits).slice(0, 100);

    const tableData = parsedLogs.slice(0, 2000).map(l => ({
      Time: new Date(l.ts * 1000).toISOString().replace('T', ' ').slice(0, 19),
      Intent: deriveIntent(l),
      View: l.view || (l.query && l.query.view) || 'standard',
      Fingerprint: l.ip || l.id, Geo: l.geo || null,
      Filters: l.query || {}, Resolved: { ...(l.resolved || {}), ...(l.query_data || {}) },
      Sse: l.sse === true,
    }));

    // Geo backfill
    const isPrivateIp = ip => { const q = ip.split('.').map(Number); return q.length === 4 && (q[0]===10||q[0]===127||(q[0]===172&&q[1]>=16&&q[1]<=31)||(q[0]===192&&q[1]===168)||(q[0]===169&&q[1]===254)); };
    const uniqueIps = [...new Set(topUsers.filter(u => !u.geo).map(u => u.id).filter(ip => ip && ip !== 'unknown' && !isPrivateIp(ip)))];
    if (uniqueIps.length > 0) {
      const geoPipe = redis.pipeline();
      uniqueIps.forEach(ip => geoPipe.get('intel:geo:' + ip));
      const geoResults = await geoPipe.exec();
      const ipGeoMap = {};
      const toFetch  = [];
      uniqueIps.forEach((ip, i) => {
        const cached = geoResults[i][1];
        if (cached) { try { ipGeoMap[ip] = JSON.parse(cached); } catch {} }
        else toFetch.push(ip);
      });
      if (toFetch.length > 0) {
        try {
          const batchIps  = toFetch.slice(0, 100);
          const batchBody = JSON.stringify(batchIps.map(ip => ({ query: ip, fields: 'status,country,countryCode' })));
          let batchRes = [];
          try {
            const resp = await fetch('http://ip-api.com/batch?fields=status,country,countryCode', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: batchBody, signal: AbortSignal.timeout(5000),
            });
            batchRes = await resp.json();
          } catch {}
          const geoCachePipe = redis.pipeline();
          batchIps.forEach((ip, i) => {
            const r = Array.isArray(batchRes) ? batchRes[i] : null;
            if (r && r.status === 'success') {
              const geo = { country: r.country, code: r.countryCode };
              ipGeoMap[ip] = geo;
              geoCachePipe.set('intel:geo:' + ip, JSON.stringify(geo), 'EX', 2592000);
            } else {
              geoCachePipe.set('intel:geo:' + ip, 'null', 'EX', 300);
            }
          });
          await geoCachePipe.exec();
        } catch {}
      }
      topUsers.forEach(u => { if (!u.geo && ipGeoMap[u.id]) u.geo = ipGeoMap[u.id]; });
    }

    // ID name resolution
    const ID_FILTER_KEYS = ['alliance_id','corporation_id','character_id','region_id','solar_system_id','system_id','ship_type_id','filters_region','filters_attacker_ship'];
    const allEntityIds = new Set();
    parsedLogs.forEach(l => {
      const q = l.query || {};
      ID_FILTER_KEYS.forEach(k => {
        if (q[k]) String(q[k]).split(',').forEach(id => { id = id.trim(); if (id && Number(id) > 0) allEntityIds.add(id); });
      });
    });
    const id_names = {};
    if (allEntityIds.size > 0) {
      const idArr = [...allEntityIds];
      const namePipe = redis.pipeline();
      idArr.forEach(id => namePipe.hget('eve:id_to_name', id));
      const nameResults = await namePipe.exec();
      idArr.forEach((id, i) => { const n = nameResults[i][1]; if (n && !n.startsWith('RETRY:')) id_names[id] = n; });
    }

    // Activity timeline (30 min)
    const timelineBuckets = new Map();
    const nowSec = Math.floor(Math.floor(Date.now() / 1000) / 60) * 60;
    for (let i = 29; i >= 0; i--) timelineBuckets.set(nowSec - (i * 60), new Set());
    parsedLogs.forEach(l => {
      const bucketTs = Math.floor((l.ts || 0) / 60) * 60;
      if (timelineBuckets.has(bucketTs)) timelineBuckets.get(bucketTs).add(l.id || l.ip || 'unknown');
    });
    const timeline = [...timelineBuckets.entries()].map(([ts, pilots]) => ({
      time: new Date(ts * 1000).toISOString().substring(11, 16),
      count: pilots.size,
    }));

    // Peak tracking
    const activePilotsNow = Object.values(userActivity).filter(u => now - (u.last_ts || 0) < 90).length;
    let peakConcurrent = parseInt(await redis.get('intel:stats:peak_unique_pilots'));
    if (isNaN(peakConcurrent) || activePilotsNow > peakConcurrent) {
      peakConcurrent = activePilotsNow;
      await redis.set('intel:stats:peak_unique_pilots', peakConcurrent);
    }

    res.writeHead(200);
    res.end(JSON.stringify({
      overview: {
        active_pilots_now: activePilotsNow,
        peak_concurrent: peakConcurrent,
        total_tracked: Object.keys(userActivity).length,
        total_logs_analyzed: parsedLogs.length,
        usage_stats: {
          map_3d:        parseInt(usageStats.feed_map_3d    || 0),
          map_2d:        parseInt(usageStats.feed_map_2d    || 0),
          map_flat:      parseInt(usageStats.feed_map_flat  || 0),
          feed_mosaic:   parseInt(usageStats.feed_mosaic    || 0),
          feed_compact:  parseInt(usageStats.feed_compact   || 0),
          feed_standard: parseInt(usageStats.feed_standard  || 0),
        },
      },
      top_users: topUsers,
      recent_logs: tableData,
      id_names,
      timeline,
    }));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
};
