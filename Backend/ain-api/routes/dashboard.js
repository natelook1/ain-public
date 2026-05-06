'use strict';

// webhook_cache.json — "Get Dashboard Data" node (the webhook path).
// Note: "Calculate and Cache Stats" is a scheduled n8n job (every 30s) and
// is NOT an HTTP endpoint — it stays in n8n. This route only serves the
// on-demand read path.

const redis = require('../lib/redis');

const KEY_KILLS_ALL     = 'intel:kills:all';
const KEY_KILLS_NPC     = 'intel:kills:npc';
const KEY_KILL_DATA     = 'intel:kill:data';
const KEY_CACHED_STATS  = 'intel:cached:stats';
const KEY_CACHED_TRENDS = 'intel:cached:trends';
const STATS_WINDOW_DAYS = 30;

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

module.exports = async function dashboard(req, res, url) {
  const p = url.searchParams;
  const FETCH_LIMIT       = parseInt(p.get('limit')) || 50;
  const DEEP_SEARCH_LIMIT = 200;

  const latestKnownId = p.get('latest_known_id') ? String(p.get('latest_known_id')) : null;
  const beforeKillId  = p.get('before_kill_id')  ? String(p.get('before_kill_id'))  : null;
  const allianceIds   = new Set((p.get('alliance_id') || '').split(',').map(s => s.trim()).filter(Boolean));
  const filtersMain   = new Set((p.get('filters_main')   || '').split(',').filter(Boolean));
  const filtersSpace  = new Set((p.get('filters_space')  || '').split(',').filter(Boolean));
  const filtersIsk    = new Set((p.get('filters_isk')    || '').split(',').filter(Boolean));
  const filtersShipTarget = p.get('filters_ship_target') || 'victim';
  const filtersShip   = new Set((p.get('filters_ship')   || '').split(',').filter(Boolean));
  const searchQuery   = (p.get('search_query') || '').toLowerCase().trim();

  function filterKill(kill) {
    if (allianceIds.size > 0) {
      const vId  = String(kill.victim?.alliance_id || '0');
      const aIds = new Set((kill.attackers || []).map(a => String(a.alliance_id || '0')));
      if (!allianceIds.has(vId) && ![...aIds].some(id => allianceIds.has(id))) return false;
    }
    if (filtersMain.size > 0) {
      if (filtersMain.has('solo') && !kill.is_solo) return false;
      if (filtersMain.has('fleet') && kill.is_solo) return false;
      if (filtersMain.has('npc')) { const fb = (kill.attackers||[]).find(a => a.final_blow); if (!fb || !fb.is_npc) return false; }
      if (filtersMain.has('hide-pods') && kill.victim_ship_class === 'capsule') return false;
      if (filtersMain.has('hide-structures')) {
        const b = (kill.victim_ship_class || '').toLowerCase();
        const d = (kill.victim_ship_class_detailed || '').toLowerCase();
        const s = ['structure','pos','control_tower','starbase_structure','sentry_gun','deployable','mobile_cyno','customs_office','fighter','light_fighter','heavy_fighter','orbital_infrastructure','mobile_warp_disruptor','mobile_tractor_unit','mobile_observatory'];
        if (s.includes(b) || s.includes(d)) return false;
      }
      if (filtersMain.has('hide-trash') && ['rookie_ship','shuttle'].includes(kill.victim_ship_class)) return false;
    }
    if (filtersSpace.size > 0) {
      const st = (kill.space_type || 'unknown').toLowerCase();
      const map = { hs:'highsec', ls:'lowsec', ns:'nullsec', wh:'wormhole', ab:'abyssal' };
      if (![...filtersSpace].some(f => map[f] === st)) return false;
    }
    if (filtersIsk.size > 0) {
      const v = parseFloat(kill.total_value) || 0;
      const matches = Array.from(filtersIsk).some(f => {
        if (f === 'sub10m')   return v < 1e7;
        if (f === '10m-100m') return v >= 1e7  && v < 1e8;
        if (f === '100m-1b')  return v >= 1e8  && v < 1e9;
        if (f === '1b-10b')   return v >= 1e9  && v < 1e10;
        if (f === '10b-20b')  return v >= 1e10 && v < 2e10;
        if (f === '20b-50b')  return v >= 2e10 && v < 5e10;
        if (f === '50b')      return v >= 5e10;
        return false;
      });
      if (!matches) return false;
    }
    if (filtersShip.size > 0) {
      const matchVictim   = filtersShip.has(kill.victim_ship_class) || filtersShip.has(kill.victim_ship_class_detailed) || filtersShip.has(String(kill.victim?.ship_type_id));
      const matchAttacker = (kill.attackers||[]).some(a => filtersShip.has(a.ship_class) || filtersShip.has(a.ship_class_detailed) || filtersShip.has(String(a.ship_type_id)));
      if (filtersShipTarget === 'victim'   && !matchVictim)                     return false;
      if (filtersShipTarget === 'attacker' && !matchAttacker)                   return false;
      if (filtersShipTarget === 'either'   && !matchVictim && !matchAttacker)   return false;
    }
    if (searchQuery.length > 0) {
      const terms = searchQuery.split(' ').filter(t => t.length > 0);
      const text  = [kill.killmail_id, kill.solar_system_name, kill.victim?.character_name, kill.victim?.corporation_name, kill.victim?.alliance_name, kill.victim?.ship_type_name, kill.victim_ship_class, kill.victim_ship_class_detailed].join(' ').toLowerCase();
      if (!terms.every(t => text.includes(t))) return false;
    }
    return true;
  }

  try {
    let finalKills = [], oldest_kill_id_for_client = null;

    // Determine source keys
    let sourceKeys = [];
    if (allianceIds.size > 0) {
      allianceIds.forEach(id => sourceKeys.push(`intel:followed:alliance:${id}`));
    } else if (filtersShip.size > 0) {
      for (const s of filtersShip) {
        const isDetailed = DETAILED_CLASSES_SET.has(s);
        if (filtersShipTarget === 'victim'   || filtersShipTarget === 'either') sourceKeys.push(isDetailed ? `intel:losses:ship_class_detailed:${s}` : `intel:losses:ship_class:${s}`);
        if (filtersShipTarget === 'attacker' || filtersShipTarget === 'either') sourceKeys.push(isDetailed ? `intel:kills:ship_class_detailed:${s}`  : `intel:kills:ship_class:${s}`);
      }
    } else if (filtersMain.has('npc')) {
      sourceKeys = [KEY_KILLS_NPC];
    } else if (filtersIsk.size > 0) {
      filtersIsk.forEach(f => { if (['sub10m','10m-100m','100m-1b','1b-10b','10b-20b','20b-50b','50b'].includes(f)) sourceKeys.push(`intel:kills:isk:${f}`); });
    } else {
      sourceKeys = [KEY_KILLS_ALL];
    }

    if (latestKnownId) {
      const results = [];
      for (const k of sourceKeys) {
        const s = await redis.zscore(k, latestKnownId);
        if (s) {
          const ids = await redis.zrangebyscore(k, `(${s}`, '+inf', 'WITHSCORES');
          for (let i = 0; i < ids.length; i += 2) results.push({ id: ids[i], ts: parseFloat(ids[i + 1]) });
        }
      }
      const unique = Array.from(new Map(results.map(i => [i.id, i])).values()).sort((a, b) => b.ts - a.ts);
      if (unique.length > 0) {
        const pipe = redis.pipeline();
        unique.forEach(i => pipe.hget(KEY_KILL_DATA, i.id));
        const data = await pipe.exec();
        finalKills = data.filter(([e]) => !e).map(([, j]) => JSON.parse(j)).filter(filterKill);
      }
    } else {
      let iter = 0, cursor = beforeKillId;
      while (iter < DEEP_SEARCH_LIMIT && finalKills.length < FETCH_LIMIT) {
        let batch = [];
        const bSize = FETCH_LIMIT >= 500 ? 10000 : (iter >= 10 ? 10000 : 500);
        for (const k of sourceKeys) {
          let ids;
          if (cursor) {
            const score = await redis.zscore(k, cursor);
            ids = score
              ? await redis.zrevrangebyscore(k, `(${score}`, '-inf', 'WITHSCORES', 'LIMIT', 0, bSize)
              : await redis.zrevrange(k, 0, bSize, 'WITHSCORES');
          } else {
            ids = await redis.zrevrange(k, 0, bSize, 'WITHSCORES');
          }
          for (let i = 0; i < ids.length; i += 2) batch.push({ id: ids[i], ts: parseFloat(ids[i + 1]) });
        }
        if (batch.length === 0) break;
        const sorted = Array.from(new Map(batch.map(i => [i.id, i])).values()).sort((a, b) => b.ts - a.ts);
        cursor = sorted[sorted.length - 1].id;
        const pipe = redis.pipeline();
        sorted.forEach(i => pipe.hget(KEY_KILL_DATA, i.id));
        const data = await pipe.exec();
        finalKills.push(...data.filter(([e]) => !e).map(([, j]) => JSON.parse(j)).filter(filterKill));
        iter++;
      }
      finalKills = finalKills.slice(0, FETCH_LIMIT);
    }

    if (finalKills.length > 0) oldest_kill_id_for_client = finalKills[finalKills.length - 1].killmail_id;

    // Stats & ISK distribution
    const [csRes, ctRes] = await redis.pipeline().get(KEY_CACHED_STATS).get(KEY_CACHED_TRENDS).exec();
    let stats_24h = { kills: 0, isk: 0 }, total_count = 0, trends = {}, latest_db_killmail_time = null;
    if (csRes[1]) { const cs = JSON.parse(csRes[1]); stats_24h = cs.stats_24h; total_count = cs.total_count; latest_db_killmail_time = cs.latest_db_killmail_time; }
    if (ctRes[1]) trends = JSON.parse(ctRes[1]);

    const win = Math.floor(Date.now() / 1000) - (STATS_WINDOW_DAYS * 86400);
    const statPipe = redis.pipeline();
    statPipe.zcount(KEY_KILLS_ALL, win, '+inf');
    ['sub10m','10m-100m','100m-1b','1b-10b','10b-20b','20b-50b','50b'].forEach(f => statPipe.zcount(`intel:kills:isk:${f}`, win, '+inf'));
    for (let h = 0; h < 24; h++) statPipe.zcount(`intel:kills:hour:${h}`, win, '+inf');

    const idsList = Array.from(allianceIds);
    idsList.forEach(id => statPipe.hgetall(`alliance:summary:${id}`));

    const statRes = await statPipe.exec();
    const t30 = statRes[0][1] || 1;
    const isk_distribution = {};
    ['sub10m','10m-100m','100m-1b','1b-10b','10b-20b','20b-50b','50b'].forEach((k, i) => {
      isk_distribution[k] = { count: statRes[i + 1][1], percent: parseFloat(((statRes[i + 1][1] / t30) * 100).toFixed(1)) };
    });
    const activity_heatmap = {};
    for (let h = 0; h < 24; h++) activity_heatmap[h] = { count: statRes[h + 8][1], percent: parseFloat(((statRes[h + 8][1] / t30) * 100).toFixed(1)) };

    let allianceStatsDict = {}, allianceSummary = null, vsHeadToHead = null, interactionMatrix = null;
    if (idsList.length > 0) {
      const extraIds = new Set();
      statRes.slice(32).forEach((r, i) => {
        const s = r[1];
        if (s && Object.keys(s).length > 0) {
          const id = idsList[i];
          allianceStatsDict[id] = { kills: Number(s.kills), losses: Number(s.losses), isk_destroyed: Number(s.iskDestroyed), isk_lost: Number(s.iskLost), efficiency: Number(s.efficiency), ratio: Number(s.ratio), activePilots: Number(s.activePilots), lastSeen: Number(s.lastSeen), topShip: s.topShip, topShipId: s.topShipId || null, maxKillId: s.maxKillId, maxLossId: s.maxLossId, kills_final: Number(s.killsFinal), kills_assist: Number(s.killsAssist) };
          if (s.maxKillId) extraIds.add(s.maxKillId);
          if (s.maxLossId) extraIds.add(s.maxLossId);
        }
      });
      if (extraIds.size > 0) {
        const kPipe = redis.pipeline();
        extraIds.forEach(id => kPipe.hget(KEY_KILL_DATA, id));
        const kRes = await kPipe.exec();
        const kMap = {};
        kRes.forEach(([e, j]) => { if (!e && j) { const k = JSON.parse(j); kMap[k.killmail_id] = k; } });
        Object.values(allianceStatsDict).forEach(s => { if (s.maxKillId) s.maxKill = kMap[s.maxKillId]; if (s.maxLossId) s.maxLoss = kMap[s.maxLossId]; });
      }
      if (idsList.length === 1) allianceSummary = allianceStatsDict[idsList[0]];
      if (idsList.length === 2) {
        const [a, b] = idsList;
        const [avb, bva] = await redis.pipeline().zcount(`intel:interaction:${a}:${b}`, win, '+inf').zcount(`intel:interaction:${b}:${a}`, win, '+inf').exec();
        vsHeadToHead = { alliance_a: a, alliance_b: b, a_killed_b: avb[1]||0, b_killed_a: bva[1]||0 };
      }
      if (idsList.length >= 3) {
        interactionMatrix = {};
        const mPipe = redis.pipeline();
        const pairs = [];
        for (let i = 0; i < idsList.length; i++) for (let j = 0; j < idsList.length; j++) if (i !== j) { pairs.push({ k: idsList[i], v: idsList[j] }); mPipe.zcount(`intel:interaction:${idsList[i]}:${idsList[j]}`, win, '+inf'); }
        const mRes = await mPipe.exec();
        pairs.forEach((pair, i) => { if (!interactionMatrix[pair.k]) interactionMatrix[pair.k] = {}; interactionMatrix[pair.k][pair.v] = mRes[i][1]||0; });
      }
    }

    res.writeHead(200);
    res.end(JSON.stringify({
      kills: finalKills, total_count, stats_24h, trends,
      isk_distribution, activity_heatmap,
      alliance_stats: allianceStatsDict,
      alliance_summary: allianceSummary,
      oldest_kill_id: oldest_kill_id_for_client,
      latest_db_killmail_time,
      vs_head_to_head: vsHeadToHead,
      interaction_matrix: interactionMatrix,
    }));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
};
