import { fmtN, severityClass } from '../../utils'
import { TcBadge } from '../shared/TcBadge'
import { Panel } from '../shared/Panel'
import { Badge } from '../shared/Badge'
import { ThreatIntelPanel } from '../overview/ThreatIntelPanel'
import type { TunnelData, ThreatHistoryPoint } from '../../types'

// ── 24h summary strip ─────────────────────────────────────────────────────────
function ThreatStrip({ history, wafHighCount }: { history: ThreatHistoryPoint[]; wafHighCount: number }) {
  let totScanners = 0, totBrute = 0, totProbes = 0, totCrawlers = 0
  const allIps = new Set<string>()

  history.forEach(snap => {
    totScanners += snap.summary.scanners ?? 0
    totBrute    += snap.summary.brute_force ?? 0
    totProbes   += snap.summary.probes ?? 0
    totCrawlers += snap.summary.crawlers ?? 0
    snap.top_offenders?.forEach(o => allIps.add(o.ip))
  })

  const cells = [
    { label: '24h Scanners',   value: fmtN(totScanners), color: 'var(--red)',    sub: 'scan tool UA' },
    { label: '24h Brute Force',value: fmtN(totBrute),    color: 'var(--orange)', sub: 'auth path 401/403' },
    { label: '24h Probes',     value: fmtN(totProbes),   color: 'var(--yellow)', sub: 'path fingerprinting' },
    { label: '24h Crawlers',   value: fmtN(totCrawlers), color: 'var(--cyan)',   sub: 'bot user-agents' },
    { label: 'Unique IPs',     value: fmtN(allIps.size), color: 'var(--text)',   sub: 'across all snapshots' },
    { label: 'WAF Candidates', value: fmtN(wafHighCount),color: 'var(--red)',    sub: 'high-severity IPs' },
  ]

  return (
    <div className="th-strip">
      {cells.map(c => (
        <div key={c.label} className="sc">
          <div className="sl">{c.label}</div>
          <div className="sv" style={{ color: c.color }}>{c.value}</div>
          <div className="ss">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ── Trend sparklines ──────────────────────────────────────────────────────────
function ThreatTrend({ history }: { history: ThreatHistoryPoint[] }) {
  if (!history.length) {
    return <div className="no-data" style={{ padding: '20px 0' }}>Accumulating history — snapshots appear every 2 minutes.</div>
  }

  const oldest = history[0].time
  const newest = history[history.length - 1].time
  const snapCount = history.length
  const hours = (Math.round(snapCount * 2 / 60 * 10) / 10)

  const rows = [
    { label: 'Scanners',    vals: history.map(s => s.summary.scanners ?? 0),    color: 'var(--red)' },
    { label: 'Brute Force', vals: history.map(s => s.summary.brute_force ?? 0), color: 'var(--orange)' },
    { label: 'Probes',      vals: history.map(s => s.summary.probes ?? 0),      color: 'var(--yellow)' },
    { label: 'Crawlers',    vals: history.map(s => s.summary.crawlers ?? 0),    color: 'var(--cyan)' },
  ]

  return (
    <>
      <div className="th-snapshot-age">
        From {new Date(oldest).toLocaleString()} to {new Date(newest).toLocaleString()}
      </div>
      <div className="th-history-chart">
        {rows.map(row => {
          const mx = Math.max(...row.vals) || 1
          return (
            <div key={row.label} className="th-spark-row">
              <span className="th-label" style={{ color: row.color }}>{row.label}</span>
              <div className="th-bars">
                {row.vals.map((v, i) => (
                  <div key={i} className="th-bar" style={{ height: `${Math.max(8, Math.round((v / mx) * 100))}%`, background: row.color, opacity: 0.8 }} title={String(v)} />
                ))}
              </div>
              <span style={{ minWidth: 30, textAlign: 'right', fontSize: 10 }}>{fmtN(row.vals[row.vals.length - 1] ?? 0)}</span>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 9, color: 'var(--dim)', padding: '0 16px 8px' }}>{snapCount} snapshots · ~{hours}h of history</div>
    </>
  )
}

// ── Top offenders table (aggregated 24h) ──────────────────────────────────────
function TopOffenders({ history }: { history: ThreatHistoryPoint[] }) {
  const ipMap: Record<string, {
    ip: string; country: string; total_hits: number;
    severity: string; threat_classes: Set<string>; sample_paths: Set<string>
  }> = {}

  history.forEach(snap => {
    snap.top_offenders?.forEach(o => {
      if (!ipMap[o.ip]) ipMap[o.ip] = { ip: o.ip, country: o.country, total_hits: 0, severity: o.severity, threat_classes: new Set(), sample_paths: new Set() }
      ipMap[o.ip].total_hits += o.total_hits
      o.threat_classes?.forEach(c => ipMap[o.ip].threat_classes.add(c))
      o.sample_paths?.forEach(p => ipMap[o.ip].sample_paths.add(p))
      if (o.severity === 'high') ipMap[o.ip].severity = 'high'
      else if (o.severity === 'medium' && ipMap[o.ip].severity !== 'high') ipMap[o.ip].severity = 'medium'
    })
  })

  const sorted = Object.values(ipMap).sort((a, b) => b.total_hits - a.total_hits).slice(0, 20)

  if (!sorted.length) return <div className="no-data">No offenders tracked yet</div>

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="th-offenders-table">
        <thead>
          <tr><th>IP</th><th>Country</th><th>Hits</th><th>Class</th><th>Severity</th><th>Sample Paths</th></tr>
        </thead>
        <tbody>
          {sorted.map(o => (
            <tr key={o.ip}>
              <td style={{ fontFamily: 'monospace', fontSize: 10 }}>{o.ip}</td>
              <td style={{ fontSize: 10 }}>{o.country || '—'}</td>
              <td style={{ fontWeight: 700, color: 'var(--orange)' }}>{fmtN(o.total_hits)}</td>
              <td>{[...o.threat_classes].map(c => <TcBadge key={c} cls={c} />)}</td>
              <td className={severityClass(o.severity)}>{o.severity}</td>
              <td style={{ maxWidth: 160 }}>
                {[...o.sample_paths].slice(0, 3).map(p => <code key={p} style={{ display: 'block', fontSize: 9, opacity: .8 }}>{p}</code>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main ThreatMode component ─────────────────────────────────────────────────
export function ThreatMode({ data }: { data: TunnelData }) {
  const history = data.threat_history ?? []
  const wafHighCount = (data.waf_candidates ?? []).filter(c => c.severity === 'high').length
  const snapCount = history.length

  return (
    <div>
      <ThreatStrip history={history} wafHighCount={wafHighCount} />

      <div className="b-grid" style={{ marginTop: 0 }}>
        {/* LEFT: trend + top offenders */}
        <div className="col">
          <Panel
            title="Threat Trend · 24h"
            badge={<Badge color="muted">{snapCount} snapshot{snapCount !== 1 ? 's' : ''}</Badge>}
          >
            <ThreatTrend history={history} />
          </Panel>

          <Panel
            title="Top Offenders · 24h"
            badge={<Badge color="red">{Object.keys(history.flatMap(h => h.top_offenders ?? []).reduce((m, o) => { m[o.ip] = true; return m }, {} as Record<string, boolean>)).length} IPs</Badge>}
          >
            <TopOffenders history={history} />
          </Panel>
        </div>

        {/* RIGHT: current hour detail */}
        <div className="col">
          <Panel title="Current Hour · Activity Log" badge={<Badge color="muted">Latest snapshot</Badge>}>
            <ThreatIntelPanel
              threatLog={data.threat_log ?? []}
              threatSummary={data.threat_summary}
              wafCandidates={data.waf_candidates ?? []}
            />
          </Panel>
        </div>
      </div>
    </div>
  )
}
