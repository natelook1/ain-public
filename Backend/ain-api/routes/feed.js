'use strict';

const redis = require('../lib/redis');

const FETCH_LIMIT_DEFAULT      = 50;
const MAX_EXECUTION_TIME_MS    = 2500;
const MAX_ITEMS_TO_SCAN        = 5000;
const BATCH_SIZE               = 500;
const HISTORY_WINDOW_SECONDS   = 30 * 24 * 60 * 60;

const KEY_KILLS_ALL = 'intel:kills:all';
const KEY_KILLS_NPC = 'intel:kills:npc';
const KEY_KILL_DATA = 'intel:kill:data';

const ISK_BUCKETS = ['sub10m','10m-100m','100m-1b','1b-10b','10b-20b','20b-50b','50b'];

const DETAILED_CLASSES_SET = new Set([
  'interceptor','assault_frigate','covert_ops','stealth_bomber','electronic_attack',
  'logistics_frigate','mining_frigate','expedition_frigate','rookie_ship',
  'interdictor','command_destroyer','tactical_destroyer','logistics_destroyer',
  'heavy_assault','logistics','force_recon','combat_recon','command_ship',
  'strategic_cruiser','flag_cruiser','attack_battlecruiser','battlecruiser',
  'marauder','black_ops','battleship','lancer_dreadnought','force_auxiliary',
  'supercarrier','titan','capital_industrial','blockade_runner','deep_space_transport',
  'mining_barge','exhumer','jump_freighter','industrial_command','hauler','freighter',
  'industrial_base','light_fighter','heavy_fighter','control_tower','starbase_structure',
  'sentry_gun','orbital_infrastructure','mobile_cyno','mobile_warp_disruptor',
  'mobile_tractor_unit','mobile_observatory',
]);

function parseValue(valStr) {
  if (typeof valStr !== 'string') return 0;
  const lower = valStr.toLowerCase();
  const num = parseFloat(lower);
  if (lower.endsWith('b')) return num * 1e9;
  if (lower.endsWith('m')) return num * 1e6;
  if (lower.endsWith('k')) return num * 1e3;
  return num;
}

function parseIskRange(rangeStr) {
  const map = {
    'sub10m':   { min: 0, max: 1e7 },
    '10m-100m': { min: 1e7, max: 1e8 },
    '100m-1b':  { min: 1e8, max: 1e9 },
    '1b-10b':   { min: 1e9, max: 1e10 },
    '10b-20b':  { min: 1e10, max: 2e10 },
    '20b-50b':  { min: 2e10, max: 5e10 },
    '50b':      { min: 5e10, max: Infinity },
  };
  if (map[rangeStr]) return map[rangeStr];
  const parts = rangeStr.split('-');
  if (parts.length === 2) return { min: parseValue(parts[0]), max: parseValue(parts[1]) };
  return null;
}

module.exports = async function feed(req, res, url) {
  const START_TIME = Date.now();
  const p = url.searchParams;

  const FETCH_LIMIT = parseInt(p.get('limit')) || FETCH_LIMIT_DEFAULT;
  const OLDEST_ALLOWED_TS = (Date.now() / 1000) - HISTORY_WINDOW_SECONDS;

  const latestKnownId  = p.get('latest_known_id') ? String(p.get('latest_known_id')) : null;
  const beforeKillId   = p.get('before_kill_id')  ? String(p.get('before_kill_id'))  : null;
  const allianceIds    = new Set((p.get('alliance_id')    || '').split(',').map(s => s.trim()).filter(Boolean));
  const corpIds        = new Set((p.get('corporation_id') || '').split(',').map(s => s.trim()).filter(Boolean));
  const filtersMain    = new Set((p.get('filters_main')   || '').split(',').filter(Boolean));
  const filtersSpace   = new Set((p.get('filters_space')  || '').split(',').filter(Boolean));
  const filtersRegion  = new Set((p.get('filters_region') || '').split(',').filter(Boolean));
  const filtersIsk     = new Set((p.get('filters_isk')    || '').split(',').filter(Boolean));
  const filtersShip    = new Set((p.get('filters_ship')   || '').split(',').filter(Boolean));
  const filtersAttackerShip = new Set((p.get('filters_attacker_ship') || '').split(',').filter(Boolean));
  const searchQuery    = (p.get('search_query') || '').toLowerCase().trim();
  const lurkerMode     = p.get('lurker') === 'true';
  const viewType       = p.get('view') || 'standard';
  const fingerprint    = p.get('fingerprint') || 'unknown_pilot';

  function filterKill(kill) {
    if (!kill) return false;

    let isTrackedKill = false;
    let rel = 'none';

    if (allianceIds.size > 0 || corpIds.size > 0) {
      const vAid = String(kill.victim?.alliance_id || '0');
      const vCid = String(kill.victim?.corporation_id || '0');
      if (allianceIds.has(vAid) || corpIds.has(vCid)) {
        isTrackedKill = true; rel = 'loss';
      } else if (kill.attackers) {
        const myAttacker = kill.attackers.find(a =>
          allianceIds.has(String(a.alliance_id || '0')) ||
          corpIds.has(String(a.corporation_id || '0'))
        );
        if (myAttacker) { isTrackedKill = true; rel = myAttacker.final_blow ? 'kill' : 'assist'; }
      }
      if (!lurkerMode && !isTrackedKill) return false;
    }

    kill._relation = rel;

    if (filtersMain.has('loss') || filtersMain.has('kill') || filtersMain.has('assist')) {
      if (!filtersMain.has(rel)) return false;
    }

    if (!lurkerMode || !isTrackedKill) {
      if (filtersMain.size > 0) {
        if (filtersMain.has('hide-pods') && kill.victim_ship_class === 'capsule') return false;
        if (filtersMain.has('hide-trash') && ['rookie_ship','shuttle'].includes(kill.victim_ship_class)) return false;
        if (filtersMain.has('hide-structures')) {
          const b = (kill.victim_ship_class || '').toLowerCase();
          const d = (kill.victim_ship_class_detailed || '').toLowerCase();
          const s = new Set(['structure','pos','control_tower','starbase_structure','sentry_gun','deployable','mobile_cyno','customs_office','fighter','light_fighter','heavy_fighter','orbital_infrastructure','mobile_warp_disruptor','mobile_tractor_unit','mobile_observatory']);
          if (s.has(b) || s.has(d)) return false;
        }
        if (filtersMain.has('solo') || filtersMain.has('fleet') || filtersMain.has('npc')) {
          const numAttackers = kill.attackers ? kill.attackers.length : 0;
          const hasNpc = kill.attackers ? kill.attackers.some(a => a.is_npc) : false;
          let matchesType = false;
          if (filtersMain.has('solo')  && numAttackers === 1 && !hasNpc) matchesType = true;
          if (filtersMain.has('fleet') && numAttackers > 1  && !hasNpc) matchesType = true;
          if (filtersMain.has('npc')   && hasNpc)                        matchesType = true;
          if (!matchesType) return false;
        }
      }

      if (filtersSpace.size > 0) {
        const st  = (kill.space_type || 'unknown').toLowerCase();
        const rid = parseInt(kill.region_id || 0);
        const map = { hs:'highsec', ls:'lowsec', ns:'nullsec', poch:'pochven', wh:'wormhole', ab:'abyssal' };
        let match = false;
        for (const f of filtersSpace) {
          if (map[f] === st) match = true;
          if (f === 'poch' && rid === 10000070) match = true;
        }
        if (!match) return false;
      }

      if (filtersRegion.size > 0) {
        if (!filtersRegion.has(String(kill.region_id || '0'))) return false;
      }

      if (filtersIsk.size > 0) {
        const v = parseFloat(kill.total_value) || 0;
        let m = false;
        for (const rangeStr of filtersIsk) {
          const range = parseIskRange(rangeStr);
          if (range && v >= range.min && v < range.max) { m = true; break; }
        }
        if (!m) return false;
      }

      if (filtersShip.size > 0) {
        if (!filtersShip.has(kill.victim_ship_class) && !filtersShip.has(kill.victim_ship_class_detailed)) return false;
      }

      if (filtersAttackerShip.size > 0) {
        if (!kill.attackers || !kill.attackers.some(a => filtersAttackerShip.has(String(a.ship_type_id)))) return false;
      }
    }

    if (searchQuery.length > 0) {
      const text = [
        kill.killmail_id, kill.solar_system_name,
        kill.victim?.character_name, kill.victim?.corporation_name,
        kill.victim?.alliance_name, kill.victim?.ship_type_name,
        kill.victim_ship_class, kill.victim_ship_class_detailed,
      ].join(' ').toLowerCase();
      if (!text.includes(searchQuery)) return false;
    }

    return true;
  }

  try {
    let finalKills = [];
    let oldest_kill_id_for_client = beforeKillId;
    let isk_distribution = {};
    let totalItemsScanned = 0;
    let timedOut = false;
    let endOfResults = false;
    let deployToken = null;

    // Determine source keys
    let sourceKeys = [];
    const highValueIsk = filtersIsk.has('50b') || filtersIsk.has('20b-50b') || filtersIsk.has('10b-20b');
    const rareShips = [...filtersShip].some(s => ['titan','supercarrier','keepstar','sotiyo'].includes(s));

    if (highValueIsk) {
      filtersIsk.forEach(f => { if (ISK_BUCKETS.includes(f)) sourceKeys.push(`intel:kills:isk:${f}`); });
    } else if (rareShips) {
      filtersShip.forEach(s => {
        if (['titan','supercarrier','keepstar','sotiyo'].includes(s)) {
          sourceKeys.push(DETAILED_CLASSES_SET.has(s)
            ? `intel:losses:ship_class_detailed:${s}`
            : `intel:losses:ship_class:${s}`);
        }
      });
    } else if ((allianceIds.size > 0 || corpIds.size > 0) && !lurkerMode) {
      allianceIds.forEach(id => sourceKeys.push(`intel:followed:alliance:${id}`));
      corpIds.forEach(id => {
        sourceKeys.push(`intel:kills:corporation:${id}`);
        sourceKeys.push(`intel:losses:corporation:${id}`);
      });
    } else if (filtersAttackerShip.size > 0) {
      filtersAttackerShip.forEach(id => sourceKeys.push(`intel:kills:ship:${id}`));
    } else if (filtersShip.size > 0) {
      filtersShip.forEach(s => sourceKeys.push(DETAILED_CLASSES_SET.has(s)
        ? `intel:losses:ship_class_detailed:${s}`
        : `intel:losses:ship_class:${s}`));
    } else if (filtersIsk.size > 0) {
      filtersIsk.forEach(f => { if (ISK_BUCKETS.includes(f)) sourceKeys.push(`intel:kills:isk:${f}`); });
    } else if (filtersMain.has('npc') && !filtersMain.has('solo') && !filtersMain.has('fleet')) {
      sourceKeys.push(KEY_KILLS_NPC);
    } else if (filtersSpace.size > 0) {
      const map = { hs:'highsec', ls:'lowsec', ns:'nullsec', poch:'pochven', wh:'wormhole', ab:'abyssal' };
      filtersSpace.forEach(f => { if (map[f]) sourceKeys.push(`intel:kills:space:${map[f]}`); });
    } else if (filtersRegion.size > 0) {
      filtersRegion.forEach(r => sourceKeys.push(`intel:kills:region:${r}`));
    } else {
      sourceKeys.push(KEY_KILLS_ALL);
    }

    sourceKeys = [...new Set(sourceKeys)];
    const useTimeWindow = sourceKeys.length === 1 && sourceKeys[0] === KEY_KILLS_ALL;

    if (latestKnownId) {
      const latestScore = await redis.zscore(KEY_KILLS_ALL, latestKnownId);
      if (!latestScore) {
        res.writeHead(200);
        res.end(JSON.stringify({ kills: [], oldest_kill_id: null, partial_result: false, end_of_results: false }));
        return;
      }
      const pipe = redis.pipeline();
      sourceKeys.forEach(k => pipe.zrangebyscore(k, `(${latestScore}`, '+inf', 'WITHSCORES'));
      const results = await pipe.exec();

      let allIds = [];
      results.forEach(([err, ids]) => {
        if (!err && ids) for (let i = 0; i < ids.length; i += 2) allIds.push({ id: ids[i], ts: parseFloat(ids[i + 1]) });
      });

      const unique = Array.from(new Map(allIds.map(i => [i.id, i])).values())
        .sort((a, b) => b.ts - a.ts).slice(0, 200);
      if (unique.length > 0) {
        const dataPipe = redis.pipeline();
        unique.forEach(i => dataPipe.hget(KEY_KILL_DATA, i.id));
        const data = await dataPipe.exec();
        finalKills = data.filter(([e, j]) => !e && j).map(([, j]) => JSON.parse(j)).filter(k => k && filterKill(k));
      }
      if (finalKills.length > 0) oldest_kill_id_for_client = finalKills[finalKills.length - 1].killmail_id;

    } else {
      let cursor = beforeKillId;
      let cursorScore = cursor ? await redis.zscore(KEY_KILLS_ALL, cursor) : null;
      if (!cursorScore && cursor) cursorScore = await redis.zscore(sourceKeys[0], cursor);

      while (finalKills.length < FETCH_LIMIT) {
        if (Date.now() - START_TIME > MAX_EXECUTION_TIME_MS) { timedOut = true; break; }
        if (totalItemsScanned >= MAX_ITEMS_TO_SCAN)           { timedOut = true; break; }

        const pipe = redis.pipeline();
        sourceKeys.forEach(k => {
          const max = cursorScore ? `(${cursorScore}` : '+inf';
          pipe.fetchBatch(k, max, BATCH_SIZE);
        });
        const pipeResults = await pipe.exec();

        let batch = [];
        pipeResults.forEach(([err, flatArray]) => {
          if (!err && flatArray) {
            for (let i = 0; i < flatArray.length; i += 3) {
              batch.push({ id: flatArray[i], ts: parseFloat(flatArray[i + 1]), json: flatArray[i + 2] });
            }
          }
        });

        if (batch.length === 0) { endOfResults = true; break; }

        const sorted = Array.from(new Map(batch.map(i => [i.id, i])).values()).sort((a, b) => b.ts - a.ts);
        const withinWindow = useTimeWindow ? sorted.filter(i => i.ts >= OLDEST_ALLOWED_TS) : sorted;
        if (withinWindow.length === 0) { endOfResults = true; break; }

        const lastValid = withinWindow[withinWindow.length - 1];
        cursor = lastValid.id;
        cursorScore = lastValid.ts;
        oldest_kill_id_for_client = cursor;
        totalItemsScanned += withinWindow.length;

        const validKills = withinWindow
          .map(item => { try { return item.json ? JSON.parse(item.json) : null; } catch { return null; } })
          .filter(k => k && filterKill(k));

        finalKills.push(...validKills);
      }

      finalKills = finalKills.slice(0, FETCH_LIMIT);
      if (finalKills.length > 0) oldest_kill_id_for_client = String(finalKills[finalKills.length - 1].killmail_id);
    }

    // ISK distribution (only if time budget allows)
    if (Date.now() - START_TIME < MAX_EXECUTION_TIME_MS * 0.8) {
      const statPipe = redis.pipeline();
      const win = Math.floor(Date.now() / 1000) - (30 * 86400);
      statPipe.zcount(KEY_KILLS_ALL, win, '+inf');
      ISK_BUCKETS.forEach(f => statPipe.zcount(`intel:kills:isk:${f}`, win, '+inf'));
      const res2 = await statPipe.exec();
      const total = res2[0][1] || 1;
      ISK_BUCKETS.forEach((k, i) => {
        isk_distribution[k] = { count: res2[i + 1][1], percent: parseFloat(((res2[i + 1][1] / total) * 100).toFixed(1)) };
      });
    }

    // Telemetry
    const execTime = Date.now() - START_TIME;
    const headers  = req.headers;
    const ip       = headers['cf-connecting-ip']
      || (headers['x-forwarded-for'] || '').split(',')[0].trim()
      || headers['x-real-ip']
      || 'unknown';
    const ua = headers['user-agent'] || 'unknown';
    const intent = searchQuery.length > 0 ? 'Feed Search' : `Feed ${viewType.charAt(0).toUpperCase() + viewType.slice(1)}`;

    const telPipe = redis.pipeline();
    telPipe.hincrby('intel:usage:stats', `feed_${viewType}`, 1);
    telPipe.hincrby('intel:usage:stats', 'feed_items_served', finalKills.length);
    telPipe.zremrangebyscore('intel:active:pilots', 0, Math.floor(Date.now() / 1000) - 900);

    if (fingerprint !== 'unknown_pilot') {
      telPipe.zadd('intel:active:pilots', Math.floor(Date.now() / 1000), fingerprint);
      const pilotKey = `intel:${fingerprint}`;
      telPipe.hset(pilotKey, 'last_seen', Math.floor(Date.now() / 1000), 'view', viewType, 'ip', ip, 'ua', ua);
      telPipe.expire(pilotKey, 900);
    }

    if (!p.get('sse_client')) {
      const logEntry = JSON.stringify({
        id: fingerprint, ip, geo: null, ua,
        ts: Math.floor(Date.now() / 1000),
        intent, view: viewType,
        query: Object.fromEntries(p),
        perf: { ms: execTime, scanned: totalItemsScanned, returned: finalKills.length },
      });
      telPipe.lpush('intel:logs:connections', logEntry);
    }

    telPipe.ltrim('intel:logs:connections', 0, 49999);
    telPipe.get('ain:deploy_token');

    const telResults = await telPipe.exec().catch(() => []);
    deployToken = telResults.length ? (telResults[telResults.length - 1][1] || null) : null;

    res.writeHead(200);
    res.end(JSON.stringify({
      kills: finalKills,
      oldest_kill_id: oldest_kill_id_for_client,
      isk_distribution,
      partial_result: timedOut,
      end_of_results: endOfResults,
      deploy_token: deployToken,
    }));
  } catch (err) {
    console.error('[feed]', err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
};
