'use strict';

const redis = require('../lib/redis');

const isPrivate = ip => {
  const p = ip.split('.').map(Number);
  return p.length === 4 && (
    p[0] === 10 ||
    p[0] === 127 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 169 && p[1] === 254)
  );
};

module.exports = async function ssePresence(req, res, _url, body) {
  try {
    const headers = req.headers;
    const cfIp = headers['cf-connecting-ip'];
    const forwardedIp = (headers['x-forwarded-for'] || '')
      .split(',')
      .map(s => s.trim())
      .find(s => s && !isPrivate(s));
    const ip = (cfIp && !isPrivate(cfIp) ? cfIp : null)
      || forwardedIp
      || headers['x-real-ip']
      || 'unknown';

    const fp = headers['x-fingerprint']
      || body.fingerprint
      || ('sse_' + ip.replace(/[^a-z0-9]/gi, '_'));

    const view  = body.view || 'standard';
    const query = body.query || {};

    const v = String(view).toLowerCase();
    let intent = 'SSE Feed';
    if      (v === 'map_3d')   intent = 'Tactical 3D';
    else if (v === 'map_2d')   intent = 'Tactical 2D';
    else if (v === 'map_flat') intent = 'Flat Map';
    else if (v === 'mosaic')   intent = 'Mosaic Grid';
    else if (v === 'compact')  intent = 'Compact Feed';
    if (query.w_space) intent = 'W-Space Hunter';

    let geo = null;
    if (ip && ip !== 'unknown') {
      const cached = await redis.get('intel:geo:' + ip);
      if (cached && cached !== 'null') {
        try { geo = JSON.parse(cached); } catch {}
      }
    }

    const logEntry = JSON.stringify({
      id: fp, ip, geo,
      ua: headers['user-agent'] || null,
      ts: Math.floor(Date.now() / 1000),
      intent, view, query,
      sse: true,
      perf: { ms: 0, scanned: 0, returned: 0 },
    });

    const now = Math.floor(Date.now() / 1000);
    const pipe = redis.pipeline();
    pipe.lpush('intel:logs:connections', logEntry);
    pipe.ltrim('intel:logs:connections', 0, 49999);
    pipe.zadd('intel:active:pilots', now, fp);
    pipe.set('intel:session:start:' + fp, now, 'EX', 600, 'NX');
    pipe.hincrby('intel:usage:stats', 'sse_' + v, 1);
    await pipe.exec();

    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
};
