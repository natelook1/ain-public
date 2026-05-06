'use strict';

const redis = require('../lib/redis');

const STATS_WINDOW_DAYS = 30;
const CACHE_TTL         = 300;
const KEY_KILLS_ALL     = 'intel:kills:all';
const KEY_STATS_24H     = 'intel:kills:24h_stats';
const KEY_KILL_DATA     = 'intel:kill:data';
const KEY_CACHED_STATS  = 'intel:cached:stats';
const KEY_CACHED_TRENDS = 'intel:cached:trends';
const ISK_BUCKETS       = ['sub10m','10m-100m','100m-1b','1b-10b','10b-20b','20b-50b','50b'];

function getTrend(curr, prev) {
  if (prev === 0) return 'stable';
  const chg = ((curr - prev) / prev) * 100;
  return chg >= 50 ? 'heating' : (chg >= 10 ? 'rising' : (chg <= -50 ? 'cooling' : (chg <= -10 ? 'falling' : 'stable')));
}

async function calculateGlobalStats() {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo    = now - 86400 * 30;
  const twentyFourHAgo   = now - 86400;
  const fortyEightHAgo   = now - 86400 * 2;
  const sixtyDaysAgo     = now - 86400 * 60;

  const pipe = redis.pipeline();
  pipe.zcount(KEY_KILLS_ALL, thirtyDaysAgo, now);
  pipe.zcount(KEY_KILLS_ALL, sixtyDaysAgo, now);
  pipe.zrangebyscore(KEY_STATS_24H, twentyFourHAgo, now, 'WITHSCORES');
  pipe.zrangebyscore(KEY_STATS_24H, fortyEightHAgo, twentyFourHAgo, 'WITHSCORES');
  pipe.zrevrange(KEY_KILLS_ALL, 0, 0, 'WITHSCORES');
  for (let h = 0; h < 24; h++) pipe.zcount(`intel:kills:hour:${h}`, thirtyDaysAgo, now);
  for (let i = 29; i >= 0; i--) {
    pipe.zcount(KEY_KILLS_ALL, now - ((i + 1) * 86400), now - (i * 86400));
  }
  const results = await pipe.exec();

  const total_count      = results[0][1] || 0;
  const total_count_60d  = results[1][1] || 0;
  const kills24hRaw      = results[2][1] || [];
  const killsPrev24hRaw  = results[3][1] || [];
  const newestKillId     = results[4][1]?.[0] || null;

  let isk24h = 0, top_systems = [], allianceUpdates = {};

  if (kills24hRaw.length > 0) {
    const p = redis.pipeline();
    for (let i = 0; i < kills24hRaw.length; i += 2) p.hget(KEY_KILL_DATA, kills24hRaw[i]);
    const res = await p.exec();
    const systemCounts = {};
    res.forEach(([err, json]) => {
      if (!err && json) {
        const k = JSON.parse(json);
        isk24h += (Number(k.total_value) || 0);
        const sys = k.solar_system_name || 'Unknown';
        systemCounts[sys] = (systemCounts[sys] || 0) + 1;
        const killTime = new Date(k.killmail_time).getTime() / 1000;
        const check = id => { if (id) { const sid = String(id); if (!allianceUpdates[sid] || killTime > allianceUpdates[sid]) allianceUpdates[sid] = killTime; } };
        if (k.victim?.alliance_id) check(k.victim.alliance_id);
        if (k.attackers) k.attackers.forEach(a => check(a.alliance_id));
      }
    });
    top_systems = Object.entries(systemCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
  }

  let iskPrev24h = 0;
  if (killsPrev24hRaw.length > 0) {
    const p = redis.pipeline();
    for (let i = 0; i < killsPrev24hRaw.length; i += 2) p.hget(KEY_KILL_DATA, killsPrev24hRaw[i]);
    const res = await p.exec();
    res.forEach(([err, json]) => { if (!err && json) iskPrev24h += (Number(JSON.parse(json).total_value) || 0); });
  }

  const kills_24h      = kills24hRaw.length / 2;
  const kills_prev_24h = killsPrev24hRaw.length / 2;

  const stats_24h = { kills: kills_24h, isk: isk24h };
  const trends = {
    kills:   getTrend(kills_24h, kills_prev_24h),
    isk:     getTrend(isk24h, iskPrev24h),
    total30d: getTrend(total_count, total_count_60d - total_count),
  };

  const bucket = list => {
    const b = new Array(24).fill(0);
    for (let i = 0; i < list.length; i += 2) b[new Date(parseFloat(list[i + 1]) * 1000).getUTCHours()]++;
    return b;
  };
  const todayB = bucket(kills24hRaw);
  const yestB  = bucket(killsPrev24hRaw);
  const activity_heatmap = {};
  for (let h = 0; h < 24; h++) {
    activity_heatmap[h] = { avg: Math.round((results[5 + h][1] || 0) / 30), today: todayB[h], yesterday: yestB[h] };
  }

  const daily_stats = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() - ((29 - i) * 86400000));
    daily_stats.push({ label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, count: results[29 + i][1] || 0 });
  }

  const cacheObj = { stats_24h, total_count, activity_heatmap, daily_stats, top_systems, latest_db_killmail_time: newestKillId ? new Date().toISOString() : null };

  const writePipe = redis.pipeline()
    .set(KEY_CACHED_STATS, JSON.stringify(cacheObj), 'EX', CACHE_TTL)
    .set(KEY_CACHED_TRENDS, JSON.stringify(trends), 'EX', CACHE_TTL);
  Object.entries(allianceUpdates).forEach(([id, ts]) => writePipe.hset(`alliance:summary:${id}`, 'lastSeen', ts));
  await writePipe.exec();

  return { stats: cacheObj, trends };
}

module.exports = async function stats(req, res, url) {
  const p = url.searchParams;
  const allianceIds = new Set((p.get('alliance_id') || '').split(',').map(s => s.trim()).filter(Boolean));
  const corpIds     = new Set((p.get('corporation_id') || '').split(',').map(s => s.trim()).filter(Boolean));
  const idsList     = Array.from(allianceIds);
  const corpIdsList = Array.from(corpIds);

  try {
    const now = Math.floor(Date.now() / 1000);
    const win = now - (STATS_WINDOW_DAYS * 86400);

    const pipe = redis.pipeline();
    pipe.get(KEY_CACHED_STATS);
    pipe.get(KEY_CACHED_TRENDS);
    ISK_BUCKETS.forEach(f => pipe.zcount(`intel:kills:isk:${f}`, win, '+inf'));
    idsList.forEach(id => pipe.hgetall(`alliance:summary:${id}`));
    corpIdsList.forEach(id => pipe.hgetall(`corporation:summary:${id}`));

    let matrixPairs = [];
    if (idsList.length >= 2 && idsList.length <= 10) {
      for (let i = 0; i < idsList.length; i++)
        for (let j = 0; j < idsList.length; j++)
          if (i !== j) { matrixPairs.push({ k: idsList[i], v: idsList[j] }); pipe.zcount(`intel:interaction:${idsList[i]}:${idsList[j]}`, win, '+inf'); }
    }

    const res2 = await pipe.exec();

    let statsData, trendsData;
    if (res2[0][1] && res2[1][1]) {
      statsData  = JSON.parse(res2[0][1]);
      trendsData = JSON.parse(res2[1][1]);
    } else {
      const computed = await calculateGlobalStats();
      statsData  = computed.stats;
      trendsData = computed.trends;
    }

    const t30 = statsData.total_count || 1;
    const isk_distribution = {};
    ISK_BUCKETS.forEach((k, i) => {
      isk_distribution[k] = { count: res2[2 + i][1], percent: parseFloat(((res2[2 + i][1] / t30) * 100).toFixed(1)) };
    });

    const allianceOffset = 9;
    const allianceStatsDict = {};
    let allianceSummary = null;
    idsList.forEach((id, i) => {
      const s = res2[allianceOffset + i][1];
      if (s && Object.keys(s).length > 0) {
        allianceStatsDict[id] = {
          kills: Number(s.kills), losses: Number(s.losses),
          isk_destroyed: Number(s.iskDestroyed || 0), isk_lost: Number(s.iskLost || 0),
          efficiency: Number(s.efficiency),
          ratio: Number(s.losses) > 0 ? Number(s.kills) / Number(s.losses) : Number(s.kills),
          activePilots: Number(s.activePilots), topShip: s.topShip, lastSeen: Number(s.lastSeen),
        };
      }
    });
    if (idsList.length === 1) allianceSummary = allianceStatsDict[idsList[0]] || null;

    const corpOffset = allianceOffset + idsList.length;
    const corpStatsDict = {};
    corpIdsList.forEach((id, i) => {
      const s = res2[corpOffset + i][1];
      if (s && Object.keys(s).length > 0) {
        corpStatsDict[id] = {
          kills: Number(s.kills), losses: Number(s.losses),
          isk_destroyed: Number(s.iskDestroyed || 0), isk_lost: Number(s.iskLost || 0),
          efficiency: Number(s.efficiency),
          ratio: Number(s.losses) > 0 ? Number(s.kills) / Number(s.losses) : Number(s.kills),
          activePilots: Number(s.activePilots), topShip: s.topShip, lastSeen: Number(s.lastSeen),
        };
      }
    });

    const matrixOffset = corpOffset + corpIdsList.length;
    let interactionMatrix = null, vsHeadToHead = null;
    if (matrixPairs.length > 0) {
      interactionMatrix = {};
      matrixPairs.forEach((pair, i) => {
        if (!interactionMatrix[pair.k]) interactionMatrix[pair.k] = {};
        interactionMatrix[pair.k][pair.v] = res2[matrixOffset + i][1] || 0;
      });
      if (idsList.length === 2) {
        const [a, b] = idsList;
        vsHeadToHead = { alliance_a: a, alliance_b: b, a_killed_b: interactionMatrix[a]?.[b] || 0, b_killed_a: interactionMatrix[b]?.[a] || 0 };
      }
    }

    res.writeHead(200);
    res.end(JSON.stringify({
      total_count:            statsData.total_count,
      stats_24h:              statsData.stats_24h,
      trends:                 trendsData,
      isk_distribution,
      activity_heatmap:       statsData.activity_heatmap,
      daily_stats:            statsData.daily_stats,
      top_systems:            statsData.top_systems,
      alliance_stats:         allianceStatsDict,
      alliance_summary:       allianceSummary,
      corporation_stats:      corpStatsDict,
      latest_db_killmail_time: statsData.latest_db_killmail_time,
      vs_head_to_head:        vsHeadToHead,
      interaction_matrix:     interactionMatrix,
    }));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
};
