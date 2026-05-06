'use strict';

const redis = require('../lib/redis');

async function fetchTickerFromESI(id, type = 'alliance') {
  try {
    const endpoint = type === 'corporation' ? 'corporations' : 'alliances';
    const res = await fetch(`https://esi.evetech.net/latest/${endpoint}/${id}/`);
    if (res.ok) {
      const data = await res.json();
      return data.ticker || null;
    }
  } catch {}
  return null;
}

module.exports = async function search(req, res, url) {
  const query     = (url.searchParams.get('q') || '').trim().toLowerCase();
  const multiMode = url.searchParams.get('multi') === 'true';

  if (query.length < 2) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Query too short (min 2 chars)' }));
    return;
  }

  try {
    const [allNames, allTickers, corpNames, corpTickers] = await Promise.all([
      redis.hgetall('eve:alliance:name_to_id'),
      redis.hgetall('eve:alliance:ticker_to_id'),
      redis.hgetall('eve:corporation:name_to_id'),
      redis.hgetall('eve:corporation:ticker_to_id'),
    ]);

    const matchesMap = new Map();

    // Alliance names
    if (allNames) {
      for (const [nameLower, allianceId] of Object.entries(allNames)) {
        if (nameLower.includes(query)) {
          matchesMap.set(`alliance-${allianceId}`, { name: nameLower, id: allianceId, matchType: 'name', type: 'alliance' });
        }
      }
      if (allTickers) {
        for (const [tickerLower, allianceId] of Object.entries(allTickers)) {
          if (tickerLower.includes(query)) {
            const key = `alliance-${allianceId}`;
            if (!matchesMap.has(key)) {
              const nameLower = Object.entries(allNames).find(([, id]) => id === allianceId)?.[0] || '';
              matchesMap.set(key, { name: nameLower, id: allianceId, matchType: 'ticker', type: 'alliance' });
            }
          }
        }
      }
    }

    // Corporation names (multiMode only)
    if (multiMode && corpNames) {
      for (const [nameLower, corpId] of Object.entries(corpNames)) {
        if (nameLower.includes(query)) {
          matchesMap.set(`corp-${corpId}`, { name: nameLower, id: corpId, matchType: 'name', type: 'corporation' });
        }
      }
      if (corpTickers) {
        for (const [tickerLower, corpId] of Object.entries(corpTickers)) {
          if (tickerLower.includes(query)) {
            const key = `corp-${corpId}`;
            if (!matchesMap.has(key)) {
              const nameLower = Object.entries(corpNames).find(([, id]) => id === corpId)?.[0] || '';
              matchesMap.set(key, { name: nameLower, id: corpId, matchType: 'ticker', type: 'corporation' });
            }
          }
        }
      }
    }

    let matches = Array.from(matchesMap.values());

    if (matches.length === 0) {
      res.writeHead(200);
      res.end(multiMode ? JSON.stringify([]) : JSON.stringify({ error: 'Not found', query }));
      return;
    }

    // Fetch activity scores for sorting
    const activityScores = new Map();
    for (const match of matches) {
      try {
        const statsKey = match.type === 'alliance'
          ? `intel:stats:alliance:${match.id}`
          : `intel:stats:corporation:${match.id}`;
        const s = await redis.hmget(statsKey, 'kill_count_total', 'loss_count_total');
        activityScores.set(String(match.id), (parseInt(s[0]) || 0) + (parseInt(s[1]) || 0));
      } catch { activityScores.set(String(match.id), 0); }
    }

    matches.sort((a, b) => {
      if (a.name === query) return -1;
      if (b.name === query) return 1;
      const aStarts = a.name.startsWith(query), bStarts = b.name.startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;
      if (a.matchType === 'name' && b.matchType === 'ticker') return -1;
      if (b.matchType === 'name' && a.matchType === 'ticker') return 1;
      const aAct = activityScores.get(String(a.id)) || 0;
      const bAct = activityScores.get(String(b.id)) || 0;
      if (aAct !== bAct) return bAct - aAct;
      return a.name.length - b.name.length;
    });

    if (multiMode) {
      const results = [];
      for (const match of matches.slice(0, 15)) {
        const idToNameKey   = match.type === 'alliance' ? 'eve:alliance:id_to_name'   : 'eve:corporation:id_to_name';
        const idToTickerKey = match.type === 'alliance' ? 'eve:alliance:id_to_ticker' : 'eve:corporation:id_to_ticker';
        const tickerToIdKey = match.type === 'alliance' ? 'eve:alliance:ticker_to_id' : 'eve:corporation:ticker_to_id';

        const properName = await redis.hget(idToNameKey, match.id) || match.name;
        let ticker = await redis.hget(idToTickerKey, match.id);
        results.push({ id: parseInt(match.id), name: properName, ticker: ticker || null, type: match.type, _needsTicker: !ticker });
      }

      const needTickers = results.filter(r => r._needsTicker).slice(0, 5);
      if (needTickers.length > 0) {
        await Promise.all(needTickers.map(async r => {
          const ticker = await fetchTickerFromESI(r.id, r.type);
          if (ticker) {
            r.ticker = ticker;
            const idToTickerKey = r.type === 'alliance' ? 'eve:alliance:id_to_ticker' : 'eve:corporation:id_to_ticker';
            const tickerToIdKey = r.type === 'alliance' ? 'eve:alliance:ticker_to_id' : 'eve:corporation:ticker_to_id';
            await redis.hset(idToTickerKey, String(r.id), ticker);
            await redis.hset(tickerToIdKey, ticker.toLowerCase(), String(r.id));
          }
        }));
      }
      results.forEach(r => delete r._needsTicker);

      res.writeHead(200);
      res.end(JSON.stringify(results));
      return;
    }

    // Single mode
    const topMatch      = matches[0];
    const idToNameKey   = topMatch.type === 'alliance' ? 'eve:alliance:id_to_name'   : 'eve:corporation:id_to_name';
    const idToTickerKey = topMatch.type === 'alliance' ? 'eve:alliance:id_to_ticker' : 'eve:corporation:id_to_ticker';
    const tickerToIdKey = topMatch.type === 'alliance' ? 'eve:alliance:ticker_to_id' : 'eve:corporation:ticker_to_id';

    const properName = await redis.hget(idToNameKey, topMatch.id);
    let ticker = await redis.hget(idToTickerKey, topMatch.id);

    if (!ticker) {
      ticker = await fetchTickerFromESI(topMatch.id, topMatch.type);
      if (ticker) {
        await redis.hset(idToTickerKey, String(topMatch.id), ticker);
        await redis.hset(tickerToIdKey, ticker.toLowerCase(), String(topMatch.id));
      }
    }

    res.writeHead(200);
    res.end(JSON.stringify({
      id: parseInt(topMatch.id),
      name: properName || topMatch.name,
      ticker: ticker || null,
      type: topMatch.type,
      matches_found: matches.length,
    }));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
};
