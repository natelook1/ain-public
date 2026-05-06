'use strict';

const redis = require('../lib/redis');

module.exports = async function r2z2Stats(req, res) {
  try {
    const metrics    = await redis.hgetall('r2z2:metrics') || {};
    const baseSleep  = await redis.get('r2z2:base_sleep_ms');
    if (baseSleep) metrics.adaptive_sleep = baseSleep;

    const heartbeat = await redis.get('r2z2:ingestion.active');
    const ttl       = await redis.ttl('r2z2:ingestion.active');

    const cachedSummary = await redis.get('r2z2:cached_summary');
    if (cachedSummary) {
      const cached       = JSON.parse(cachedSummary);
      const recentLogsRaw = await redis.lrange('r2z2:perf_log', 0, 99);
      const recentLogs   = recentLogsRaw
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(l => l !== null);
      res.writeHead(200);
      res.end(JSON.stringify({
        status: heartbeat ? 'active' : 'inactive',
        heartbeat_ttl: ttl,
        metrics,
        summary: cached,
        recent_logs: recentLogs,
      }));
      return;
    }

    const logsRaw = await redis.lrange('r2z2:perf_log', 0, 1999);
    const logs = logsRaw
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(l => l !== null);

    const total_runs = logs.length;
    let ids_checked = 0, total_hits = 0, total_new_items = 0, total_dupes = 0,
        total_404s = 0, total_errors = 0, total_latency = 0, total_sleep = 0,
        max_gap_streak = 0, max_success_streak = 0;

    logs.forEach(l => {
      const run_checked = (l.found || 0) + (l.not_found || 0) + (l.err || 0);
      ids_checked    += run_checked;
      total_hits     += (l.found || 0);
      total_new_items += (l.queued || 0);
      total_dupes    += (l.dupes || 0);
      total_404s     += (l.not_found || 0);
      total_errors   += (l.err || 0);
      total_latency  += (l.dur_ms || 0);
      total_sleep    += (l.sleep_ms || 0);
      if ((l.gap_streak || 0) > max_gap_streak) max_gap_streak = l.gap_streak;
      if ((l.success_streak || 0) > max_success_streak) max_success_streak = l.success_streak;
    });

    const avg_latency_ms = total_runs > 0 ? Math.round(total_latency / total_runs) : 0;
    const hit_rate = ids_checked > 0
      ? ((total_hits / ids_checked) * 100).toFixed(1) + '%'
      : '0.0%';

    let reqs_per_min = 0, kills_per_min = 0, current_kpm = 0;

    if (logs.length > 0) {
      const now = new Date(logs[0].ts).getTime();
      const shortWindow = now - (15 * 60 * 1000);
      const recentLogs = logs.filter(l => new Date(l.ts).getTime() >= shortWindow);

      if (recentLogs.length > 1) {
        const recentStart = new Date(recentLogs[recentLogs.length - 1].ts).getTime();
        const recentEnd   = new Date(recentLogs[0].ts).getTime();
        const recentDiffMin = (recentEnd - recentStart) / 60000;
        if (recentDiffMin > 0.5) {
          const recentKills = recentLogs.reduce((sum, l) => sum + (l.queued || 0), 0);
          current_kpm = parseFloat((recentKills / recentDiffMin).toFixed(2));
        } else {
          current_kpm = parseFloat(recentLogs[0].kpm || 0);
        }
      } else if (recentLogs.length === 1) {
        current_kpm = parseFloat(recentLogs[0].kpm || 0);
      }
    }

    if (logs.length > 1) {
      const total_active_ms = total_latency + total_sleep;
      const active_min = total_active_ms / 60000;
      if (active_min > 0) {
        reqs_per_min  = parseFloat((ids_checked / active_min).toFixed(1));
        kills_per_min = parseFloat((total_new_items / active_min).toFixed(2));
      } else {
        const start    = new Date(logs[logs.length - 1].ts).getTime();
        const end      = new Date(logs[0].ts).getTime();
        const diff_min = (end - start) / 60000;
        if (diff_min > 0) {
          reqs_per_min  = parseFloat((ids_checked / diff_min).toFixed(1));
          kills_per_min = parseFloat((total_new_items / diff_min).toFixed(2));
        }
      }
    }

    const current_lag       = logs.length > 0 ? (logs[0].lag || 0) : 0;
    const error_rate        = ids_checked > 0 ? ((total_errors / ids_checked) * 100).toFixed(2) : '0.00';
    const duplicate_rate    = total_hits > 0 ? ((total_dupes / total_hits) * 100).toFixed(2) : '0.00';
    const api_reliability   = ids_checked > 0 ? (((total_hits + total_404s) / ids_checked) * 100).toFixed(1) : '0.0';
    const network_efficiency = total_runs > 0 ? (total_new_items / total_runs).toFixed(2) : '0.00';
    const peak_kpm          = logs.length > 0 ? Math.max(...logs.map(l => parseFloat(l.kpm) || 0)).toFixed(2) : '0.00';
    const uptime_minutes    = logs.length > 1
      ? Math.round((new Date(logs[0].ts).getTime() - new Date(logs[logs.length - 1].ts).getTime()) / 60000)
      : 0;
    const avg_sleep_ms = total_runs > 0 ? Math.round(total_sleep / total_runs) : 0;

    const summary = {
      total_runs, ids_checked, total_hits, hit_rate, total_new_items, total_dupes,
      total_404s, total_errors, avg_latency_ms, reqs_per_min, kills_per_min,
      current_kpm, current_lag, max_gap_streak, max_success_streak, error_rate,
      duplicate_rate, api_reliability, network_efficiency, peak_kpm,
      uptime_minutes, avg_sleep_ms,
    };

    await redis.setex('r2z2:cached_summary', 60, JSON.stringify(summary));

    res.writeHead(200);
    res.end(JSON.stringify({
      status: heartbeat ? 'active' : 'inactive',
      heartbeat_ttl: ttl,
      metrics,
      summary,
      recent_logs: logs.slice(0, 100),
    }));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
};
