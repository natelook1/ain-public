'use strict';

// webhook_system.json — four sequential Code nodes extracted in order:
//   1. [SYSTEM] Fetch SDE Profile (Adaptive)
//   2. [SYSTEM] Fetch Live Data (Adaptive)     — uses fetch() instead of n8n this.helpers.httpRequest
//   3. Enrich Killmails & Analyze
//   4. Format Final Report (Adaptive)

const redis = require('../lib/redis');

// ---------------------------------------------------------------------------
// Node 1 — Fetch SDE Profile
// ---------------------------------------------------------------------------
async function fetchSdeProfile(body) {
  const getField = key => body[key] !== undefined ? body[key] : null;
  const rawQueryName    = getField('query_name');
  const originalQueryName = String(rawQueryName || '').trim();
  const queryName         = originalQueryName.toLowerCase();

  if (!queryName) throw new Error('Missing query_name. Ensure JSON body contains "query_name".');

  const queryType = getField('query_type') || body.query_type;

  // System ID lookup
  let systemId;
  const lookupNames = [queryName, originalQueryName, queryName.replace('-', '')];
  for (const name of lookupNames) {
    systemId = await redis.hget('eve:solar_system_name_to_id', name);
    if (systemId) break;
  }

  if (!systemId && /^j\d{6}$/i.test(queryName)) {
    const numeric = parseInt(queryName.match(/\d+/)[0], 10);
    systemId = String(31000000 + numeric);
  }
  if (systemId) systemId = String(systemId);

  const isWormhole = systemId && systemId >= '31000000' && systemId < '32000000';
  let system = null, systemDetailsFromSDE = false;

  if (systemId) {
    const sysRaw = await redis.hget('eve:system_details', systemId);
    if (sysRaw) { system = JSON.parse(sysRaw); systemDetailsFromSDE = true; }
  }

  if (isWormhole && !system) {
    system = { id: parseInt(systemId), name: originalQueryName.toUpperCase(), security: -0.99, securityClass: 'wormhole' };
    systemDetailsFromSDE = false;
  }

  let wormhole = null;
  if (isWormhole && systemId) {
    const whComprehensive = await redis.hget('eve:wh_system_comprehensive', systemId);
    if (whComprehensive) {
      const whData = JSON.parse(whComprehensive);
      wormhole = { class: whData.class, effect: whData.effect || 'None', threatType: whData.threatType || 'Sleeper NPCs', statics: whData.statics || [], verified: whData.verified || false, source: whData.source || 'redis_comprehensive' };
    } else {
      const whRaw  = await redis.hget('eve:wh_system_class', systemId);
      const statRaw = await redis.hget('eve:wh_static_connections', systemId);
      if (whRaw) {
        const whClass = JSON.parse(whRaw);
        const statics = statRaw ? JSON.parse(statRaw) : null;
        wormhole = { class: whClass.class || 'N/A', effect: whClass.effect || 'None', threatType: 'Sleeper NPCs', statics: statics?.static_types || [], source: 'redis_legacy' };
      } else {
        wormhole = { class: 'N/A', effect: 'None', threatType: 'Unknown', statics: [], source: 'missing' };
      }
    }
  }

  const [sovRaw, region, constellation, stations, stargates] = await Promise.all([
    systemId ? redis.hget('eve:sovereignty_map', systemId) : null,
    system?.regionID ? redis.hget('eve:id_to_name', system.regionID) : null,
    system?.constellationID ? redis.hget('eve:id_to_name', system.constellationID) : null,
    systemId ? redis.scard(`eve:stations:system:${systemId}`) : 0,
    systemId ? redis.scard(`eve:stargates:system:${systemId}`) : 0,
  ]);

  const sov      = sovRaw ? JSON.parse(sovRaw) : null;
  const alliance = sov?.allianceID ? await redis.hget('eve:id_to_name', sov.allianceID) : null;

  const sde_profile = {
    system_id: parseInt(systemId), name: system?.name || originalQueryName,
    security_status: system?.security, security_class: system?.securityClass || (isWormhole ? 'wormhole' : 'unknown'),
    region_id: system?.regionID, region_name: region,
    constellation_id: system?.constellationID, constellation_name: constellation,
    sovereignty: sov ? { alliance_id: sov.allianceID, alliance_name: alliance } : null,
    wormhole_data: wormhole,
    infrastructure: { stations, stargates },
    data_source: systemDetailsFromSDE ? 'redis-sde' : 'esi-fallback',
  };

  return { ...body, query_name: originalQueryName, query_type: queryType, system_id: sde_profile.system_id, sde_profile, source: sde_profile.data_source };
}

// ---------------------------------------------------------------------------
// Node 2 — Fetch Live Data
// ---------------------------------------------------------------------------
async function fetchLiveData(input) {
  if (!input.system_id) throw new Error('Missing system_id — Fetch SDE Profile failed.');
  const systemId = parseInt(input.system_id, 10);

  let liveJumps = 0, liveNpcKills = 0, liveShipKills = 0, livePodKills = 0;

  const ESI_CACHE_TTL = 300; // ESI updates these every 5 minutes
  try {
    const [cachedJumps, cachedKills] = await Promise.all([
      redis.get('esi:cache:system_jumps'),
      redis.get('esi:cache:system_kills'),
    ]);

    let jumpData, killData;
    const toFetch = [];
    if (!cachedJumps) toFetch.push('jumps');
    if (!cachedKills) toFetch.push('kills');

    if (toFetch.length > 0) {
      const fetches = await Promise.all([
        toFetch.includes('jumps') ? fetch('https://esi.evetech.net/latest/universe/system_jumps/', { headers: { 'User-Agent': 'AIN-API/1.0' }, signal: AbortSignal.timeout(10000) }).then(r => r.json()) : null,
        toFetch.includes('kills') ? fetch('https://esi.evetech.net/latest/universe/system_kills/', { headers: { 'User-Agent': 'AIN-API/1.0' }, signal: AbortSignal.timeout(10000) }).then(r => r.json()) : null,
      ]);
      if (toFetch.includes('jumps')) {
        jumpData = fetches[0];
        redis.set('esi:cache:system_jumps', JSON.stringify(jumpData), 'EX', ESI_CACHE_TTL).catch(() => {});
      }
      if (toFetch.includes('kills')) {
        killData = fetches[toFetch.includes('jumps') ? 1 : 0];
        redis.set('esi:cache:system_kills', JSON.stringify(killData), 'EX', ESI_CACHE_TTL).catch(() => {});
      }
    }

    jumpData = jumpData || JSON.parse(cachedJumps);
    killData = killData || JSON.parse(cachedKills);
    const sj = jumpData.find(s => s.system_id === systemId);
    if (sj) liveJumps = sj.ship_jumps || 0;
    const sk = killData.find(s => s.system_id === systemId);
    if (sk) { liveNpcKills = sk.npc_kills || 0; liveShipKills = sk.ship_kills || 0; livePodKills = sk.pod_kills || 0; }
    redis.hset(`intel:stats:system:${systemId}`, 'jumps_1h', liveJumps, 'npc_kills_1h', liveNpcKills, 'ship_kills_1h', liveShipKills, 'pod_kills_1h', livePodKills, 'last_updated', new Date().toISOString()).catch(() => {});
  } catch (esiErr) {
    try {
      const cached = await redis.hgetall(`intel:stats:system:${systemId}`);
      if (cached && Object.keys(cached).length > 0) {
        liveJumps = parseInt(cached.jumps_1h || 0, 10);
        liveNpcKills = parseInt(cached.npc_kills_1h || 0, 10);
        liveShipKills = parseInt(cached.ship_kills_1h || 0, 10);
        livePodKills = parseInt(cached.pod_kills_1h || 0, 10);
      }
    } catch {}
  }

  let recentKills = [];
  try {
    const killKey = `intel:kills:system:${systemId}`;
    const keyType = await redis.type(killKey);
    let killIds = [];
    if      (keyType === 'zset') killIds = await redis.zrevrange(killKey, 0, 299);
    else if (keyType === 'list') killIds = await redis.lrange(killKey, 0, 299);
    if (killIds.length > 0) {
      const rawData = await redis.hmget('intel:kill:data', ...killIds);
      recentKills = rawData.map((k, idx) => {
        if (!k) return null;
        try { return JSON.parse(k); } catch { return null; }
      }).filter(Boolean);
    }
  } catch {}

  let live_intel = { killmails_1h: [], killmails_24h: [] };
  if (recentKills.length > 0) {
    const now = Math.floor(Date.now() / 1000);
    live_intel.killmails_24h = recentKills.filter(k => {
      const t = k.killmail_time || k.time || k.killTime;
      if (!t) return false;
      try { return Math.floor(new Date(t).getTime() / 1000) >= now - 86400; } catch { return false; }
    });
    live_intel.killmails_1h = live_intel.killmails_24h.filter(k => {
      const t = k.killmail_time || k.time || k.killTime;
      return Math.floor(new Date(t).getTime() / 1000) >= Math.floor(Date.now() / 1000) - 3600;
    });
  }

  const isk_1h  = live_intel.killmails_1h.reduce((s, k)  => s + (k.total_value || k.zkb?.totalValue || 0), 0);
  const isk_24h = live_intel.killmails_24h.reduce((s, k) => s + (k.total_value || k.zkb?.totalValue || 0), 0);

  return { ...input, esi_live_stats: { activity_last_hour: { ship_kills: liveShipKills, isk_destroyed: isk_1h, ship_jumps: liveJumps, npc_kills: liveNpcKills, pod_kills: livePodKills }, activity_last_24h: { ship_kills: live_intel.killmails_24h.length, isk_destroyed: isk_24h } }, live_intel };
}

// ---------------------------------------------------------------------------
// Node 3 — Enrich Killmails & Analyze
// ---------------------------------------------------------------------------
async function enrichKillmails(input) {
  if (!input.live_intel?.killmails_1h || !input.live_intel?.killmails_24h) {
    input.live_intel = { killmails_1h: [], killmails_24h: [], ...(input.live_intel || {}) };
  }

  const killmails_1h_raw  = input.live_intel.killmails_1h;
  const killmails_24h_raw = input.live_intel.killmails_24h;
  const allKillmailsRaw   = [...killmails_1h_raw, ...killmails_24h_raw];

  const idsToResolve = new Set();
  for (const kill of allKillmailsRaw) {
    if (!kill) continue;
    idsToResolve.add(kill.solar_system_id || kill.system_id);
    if (kill.victim) { idsToResolve.add(kill.victim.ship_type_id); idsToResolve.add(kill.victim.corporation_id); idsToResolve.add(kill.victim.alliance_id); idsToResolve.add(kill.victim.character_id); }
    if (Array.isArray(kill.attackers)) {
      for (const a of kill.attackers) { idsToResolve.add(a.corporation_id); idsToResolve.add(a.alliance_id); idsToResolve.add(a.character_id); idsToResolve.add(a.ship_type_id); idsToResolve.add(a.weapon_type_id); }
    }
  }
  idsToResolve.delete(null); idsToResolve.delete(undefined); idsToResolve.delete(0);

  const uniqueIdsArray = Array.from(idsToResolve).map(String);
  const resolvedNamesMap = new Map();
  if (uniqueIdsArray.length > 0) {
    const namesArray = await redis.hmget('eve:id_to_name', ...uniqueIdsArray);
    uniqueIdsArray.forEach((id, i) => { if (namesArray[i]) resolvedNamesMap.set(id, namesArray[i]); });
  }

  const getName = id => id ? (resolvedNamesMap.get(String(id)) || null) : null;
  const getIskValue = kill => {
    for (const v of [kill.total_value, kill.zkb?.totalValue, kill.zkb?.total_value, kill.totalValue, kill.value, kill.isk_value]) {
      if (typeof v === 'number' && !isNaN(v) && v > 0) return v;
    }
    return 0;
  };

  const enrichKillmail = kill => {
    if (!kill) return null;
    const em = { killmail_id: kill.killmail_id, killmail_time: kill.killmail_time || kill.time || kill.killTime, total_value: getIskValue(kill), system_id: kill.solar_system_id || kill.system_id, system_name: getName(kill.solar_system_id || kill.system_id) };
    if (kill.victim) { em.victim_ship_id = kill.victim.ship_type_id; em.victim_ship_name = getName(kill.victim.ship_type_id); em.victim_corp_id = kill.victim.corporation_id; em.victim_corp_name = getName(kill.victim.corporation_id); em.victim_alliance_id = kill.victim.alliance_id; em.victim_alliance_name = getName(kill.victim.alliance_id); em.victim_character_id = kill.victim.character_id; em.victim_character_name = getName(kill.victim.character_id); }
    const fb = kill.attackers?.find(a => a.final_blow);
    if (fb) { em.attacker_corp_id = fb.corporation_id; em.attacker_corp_name = getName(fb.corporation_id); em.attacker_alliance_id = fb.alliance_id; em.attacker_alliance_name = getName(fb.alliance_id); em.attacker_character_id = fb.character_id; em.attacker_character_name = getName(fb.character_id); em.attacker_ship_id = fb.ship_type_id; em.attacker_ship_name = getName(fb.ship_type_id); em.attacker_weapon_id = fb.weapon_type_id; em.attacker_weapon_name = getName(fb.weapon_type_id); }
    return em;
  };

  const enriched_1h  = killmails_1h_raw.map(enrichKillmail).filter(Boolean);
  const enriched_24h = killmails_24h_raw.map(enrichKillmail).filter(Boolean);

  const hunter_analysis = { top_hunter_corps: {}, top_hunter_alliances: {}, top_hunter_ships: {}, top_victim_ships: {} };
  const agg = (map, key) => { if (key) map[key] = (map[key] || 0) + 1; };
  for (const kill of enriched_24h) { agg(hunter_analysis.top_hunter_corps, kill.attacker_corp_name); agg(hunter_analysis.top_hunter_alliances, kill.attacker_alliance_name); agg(hunter_analysis.top_hunter_ships, kill.attacker_ship_name); agg(hunter_analysis.top_victim_ships, kill.victim_ship_name); }
  const toArr = obj => Object.entries(obj).sort(([, a], [, b]) => b - a).map(([name, count]) => ({ name, count }));
  hunter_analysis.top_hunter_corps      = toArr(hunter_analysis.top_hunter_corps).slice(0, 5);
  hunter_analysis.top_hunter_alliances  = toArr(hunter_analysis.top_hunter_alliances).slice(0, 5);
  hunter_analysis.top_hunter_ships      = toArr(hunter_analysis.top_hunter_ships).slice(0, 10);
  hunter_analysis.top_victim_ships      = toArr(hunter_analysis.top_victim_ships).slice(0, 10);

  return { ...input, resolved_intel: { resolved_killmails_1h: enriched_1h, resolved_killmails_24h: enriched_24h, hunter_analysis } };
}

// ---------------------------------------------------------------------------
// Node 4 — Format Final Report
// ---------------------------------------------------------------------------
async function formatReport(input) {
  function formatISK(value) {
    if (!value || isNaN(value)) return '0 ISK';
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T ISK`;
    if (value >= 1e9)  return `${(value / 1e9).toFixed(1)}B ISK`;
    if (value >= 1e6)  return `${(value / 1e6).toFixed(1)}M ISK`;
    if (value >= 1e3)  return `${(value / 1e3).toFixed(0)}K ISK`;
    return `${Math.round(value).toLocaleString()} ISK`;
  }

  async function resolveWormholeStatics(staticCodes) {
    if (!staticCodes || staticCodes.length === 0) return 'None';
    try {
      const whTypeDataRaw = await redis.hmget('eve:wormhole_types', ...staticCodes);
      return staticCodes.map((code, i) => {
        const jsonData = whTypeDataRaw[i];
        if (jsonData) { try { const d = JSON.parse(jsonData); if (d?.destination) return `${code} (→ ${d.destination})`; } catch {} }
        return code;
      }).join(', ');
    } catch { return staticCodes.join(', '); }
  }

  let final_report = { query: { type: input.query_type, name: input.query_name }, metadata: { generated_at: new Date().toISOString(), data_sources: ['SDE','ESI','Live Killmails','Wormhole Database'] }, report: {}, templated_response_data: {} };

  if (input.query_type === 'system') {
    const sde   = input.sde_profile;
    const live  = input.esi_live_stats;
    const intel = input.resolved_intel;

    const kills_1h  = intel?.resolved_killmails_1h?.length  || 0;
    const kills_24h = intel?.resolved_killmails_24h?.length || 0;
    const value_1h  = intel?.resolved_killmails_1h?.reduce((s, k) => s + (k.total_value || 0), 0) || 0;
    const value_24h = intel?.resolved_killmails_24h?.reduce((s, k) => s + (k.total_value || 0), 0) || 0;
    const jumps_1h  = live?.activity_last_hour?.ship_jumps || 0;
    const npc_1h    = live?.activity_last_hour?.npc_kills  || 0;

    let threat_level = 'minimal';
    if (kills_1h > 2 || kills_24h > 20) threat_level = 'high';
    else if (kills_1h > 0 || kills_24h > 5) threat_level = 'medium';
    else if (kills_24h > 0) threat_level = 'low';

    const topAttackerChars1h = {};
    for (const kill of (intel?.resolved_killmails_1h || [])) {
      if (kill.attacker_character_name) topAttackerChars1h[kill.attacker_character_name] = (topAttackerChars1h[kill.attacker_character_name] || 0) + 1;
    }
    const sortedAttackerChars1h = Object.entries(topAttackerChars1h).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);
    const mostValuableKill24h = intel?.resolved_killmails_24h?.length > 0
      ? [...intel.resolved_killmails_24h].sort((a, b) => (b.total_value || 0) - (a.total_value || 0))[0]
      : null;

    const whData = sde?.wormhole_data;
    let whClass = String(whData?.class || '');
    let classLabel = '', systemTypeLabel = '';

    if (sde?.security_class === 'wormhole' && whData) {
      if      (whClass === '12')         { classLabel = 'C12 (THERA)';   systemTypeLabel = 'THERA - SPECIAL WORMHOLE SYSTEM'; }
      else if (whClass === '13')         { classLabel = 'C13 (DRIFTER)'; systemTypeLabel = 'DRIFTER WORMHOLE SYSTEM'; }
      else if (/^[1-6]$/.test(whClass)) { classLabel = `C${whClass}`;   systemTypeLabel = `CLASS ${whClass} WORMHOLE`; }
      else if (whClass === 'N/A' || whClass === '0') { classLabel = 'UNKNOWN'; systemTypeLabel = 'J-SPACE SYSTEM (UNCLASSIFIED)'; }
      else { classLabel = `C${whClass}`; systemTypeLabel = `CLASS ${whClass} WORMHOLE`; }
      if (whData.effect?.toLowerCase().includes('shattered')) systemTypeLabel += ' (SHATTERED)';
    } else if (sde?.security_class !== 'wormhole') {
      const sec = sde?.security_status || 0.0;
      if      (sec >= 0.5) systemTypeLabel = 'HIGH-SEC SYSTEM';
      else if (sec > 0.0)  systemTypeLabel = 'LOW-SEC SYSTEM';
      else {
        const sovName = sde?.sovereignty?.alliance_name;
        systemTypeLabel = sovName ? `NULL-SEC SYSTEM (${sovName})` : 'NULL-SEC SYSTEM (UNCLAIMED)';
      }
    } else { systemTypeLabel = 'UNKNOWN SPACE'; }

    const resolvedStatics = await resolveWormholeStatics(whData?.statics || []);

    final_report.templated_response_data = {
      type: 'system_snapshot', query_name: sde?.name || input.query_name,
      security_class: sde?.security_class || 'N/A', threat_level,
      full_location: sde?.region_name && sde?.constellation_name && sde?.name ? `${sde.region_name} > ${sde.constellation_name} > ${sde.name}` : (sde?.name || input.query_name),
      last_hour_ship_kills: kills_1h, last_hour_npc_kills: npc_1h, last_hour_jumps: jumps_1h,
      kills_last_24h: kills_24h, value_destroyed_24h_isk: value_24h,
      last_hour_killmails_count: kills_1h, last_hour_isk_destroyed_formatted: formatISK(value_1h),
      most_recent_kill_summary: intel?.resolved_killmails_1h?.length > 0 ? `${intel.resolved_killmails_1h[0].victim_ship_name || 'Ship'} (${formatISK(intel.resolved_killmails_1h[0].total_value)}) by ${intel.resolved_killmails_1h[0].attacker_character_name || 'Attacker'}` : 'No recent kills',
      recent_victim_ships_summary: intel?.hunter_analysis?.top_victim_ships?.map(v => v.name).join(', ') || 'None',
      recent_attacker_chars_summary: sortedAttackerChars1h.join(', ') || 'None',
      stations: sde?.infrastructure?.stations || 0, stargates: sde?.infrastructure?.stargates || 0,
      system_type_label: systemTypeLabel, wormhole_class: classLabel || whData?.class || 'N/A',
      wormhole_class_numeric: whData?.class || 0, wormhole_effects: whData?.effect || 'None',
      wormhole_statics_list: resolvedStatics, wormhole_statics_raw: whData?.statics || [],
      wormhole_verified: whData?.verified || false, wormhole_data_source: whData?.source || 'N/A',
      static_threat_npc: whData?.threatType || (sde?.security_class === 'wormhole' ? 'Sleeper NPCs' : 'None'),
      top_hunters_24h_list: intel?.hunter_analysis?.top_hunter_corps?.map(h => `${h.name} (${h.count})`).join(', ') || 'None',
      top_victims_24h_list: intel?.hunter_analysis?.top_victim_ships?.map(v => `${v.name} (${v.count})`).join(', ') || 'None',
      value_destroyed_24h_isk_formatted: formatISK(value_24h),
      most_valuable_kill_24h_summary: mostValuableKill24h ? `${mostValuableKill24h.victim_ship_name || 'Ship'} (${formatISK(mostValuableKill24h.total_value)}) by ${mostValuableKill24h.attacker_character_name || 'Attacker'}` : 'None',
    };
    final_report.report = { type: 'SystemProfile', executive_summary: { name: sde?.name || input.query_name, id: sde?.id || null, full_location: final_report.templated_response_data.full_location, security_class: sde?.security_class || 'N/A', sovereignty: sde?.sovereignty?.alliance_name || 'Unclaimed', threat_level, wormhole_info: whData || null }, threat_intelligence: { kills_last_1h: kills_1h, kills_last_24h: kills_24h, value_destroyed_24h_isk: value_24h, top_hunters: intel?.hunter_analysis || {} }, static_profile: { ...sde } };

  } else if (input.query_type === 'region') {
    const region = input.region_profile;
    const live   = input.esi_live_stats;
    const intel  = input.resolved_intel;

    const kills_1h  = intel?.resolved_killmails_1h?.length  || 0;
    const kills_24h = intel?.resolved_killmails_24h?.length || 0;
    const value_24h = intel?.resolved_killmails_24h?.reduce((s, k) => s + (k.total_value || 0), 0) || 0;
    const value_1h  = intel?.resolved_killmails_1h?.reduce((s, k) => s + (k.total_value || 0), 0) || 0;

    let threat_level = 'minimal';
    if (region?.total_systems > 0 && (kills_24h / region.total_systems > 2)) threat_level = 'high';
    else if (region?.total_systems > 0 && (kills_24h / region.total_systems > 0.5)) threat_level = 'medium';
    else if (kills_24h > 0) threat_level = 'low';

    const mostValuableKill24h = intel?.resolved_killmails_24h?.length > 0
      ? [...intel.resolved_killmails_24h].sort((a, b) => (b.total_value || 0) - (a.total_value || 0))[0]
      : null;

    final_report.templated_response_data = {
      type: 'region_snapshot', query_name: region?.name || input.query_name,
      system_count: region?.total_systems || 0, threat_level,
      last_hour_jumps: live?.total_jumps || 0, last_hour_ship_kills: kills_1h,
      last_hour_npc_kills: live?.total_npc_kills || 0, last_hour_killmails_count: kills_1h,
      last_hour_isk_destroyed_formatted: formatISK(value_1h),
      top_active_systems_list: live?.top_5_active_systems?.map(s => `${s.name} (${s.score})`).join(', ') || 'None',
      top_regional_hunters_24h_list: intel?.hunter_analysis?.top_hunter_corps?.map(h => `${h.name} (${h.count})`).join(', ') || 'None',
      top_victims_24h_list: intel?.hunter_analysis?.top_victim_ships?.map(v => `${v.name} (${v.count})`).join(', ') || 'None',
      value_destroyed_24h_isk_formatted: formatISK(value_24h),
      most_valuable_kill_24h_summary: mostValuableKill24h ? `${mostValuableKill24h.victim_ship_name || 'Ship'} (${formatISK(mostValuableKill24h.total_value)}) in ${mostValuableKill24h.system_name || 'N/A'}` : 'None',
      kills_last_24h: kills_24h, value_destroyed_24h_isk: value_24h,
    };
    final_report.report = { type: 'RegionProfile', executive_summary: { name: region?.name || input.query_name, id: region?.id || null, system_count: region?.total_systems || 0, threat_level }, threat_intelligence: { kills_last_1h: kills_1h, kills_last_24h: kills_24h, value_destroyed_24h_isk: value_24h, top_regional_hunters: intel?.hunter_analysis || {}, hottest_systems_by_activity: live?.top_5_active_systems || [] } };
  }

  return { ...input, ...final_report };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
module.exports = async function system(req, res, _url, body) {
  if (!body || !body.query_name) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Missing query_name in request body' }));
    return;
  }

  try {
    const step1 = await fetchSdeProfile(body);
    const step2 = await fetchLiveData(step1);
    const step3 = await enrichKillmails(step2);
    const step4 = await formatReport(step3);
    res.writeHead(200);
    res.end(JSON.stringify(step4));
  } catch (err) {
    console.error('[system]', err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
};
