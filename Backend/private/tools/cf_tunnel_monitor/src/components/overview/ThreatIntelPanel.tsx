import { useState } from 'react'
import { fmtN } from '../../utils'
import { TcBadge } from '../shared/TcBadge'
import type { ThreatLogEntry, ThreatSummary, WafCandidate } from '../../types'

function ActivityLog({ entries }: { entries: ThreatLogEntry[] }) {
  if (!entries.length) return <div className="no-data">No threat activity in past hour</div>

  // Aggregate by IP so a single scanner doesn't flood 50 rows
  const byIp: Record<string, { ip: string; country: string; total: number; classes: Set<string>; paths: string[]; statuses: Set<number>; ua: string }> = {}
  entries.forEach(e => {
    if (!byIp[e.ip]) byIp[e.ip] = { ip: e.ip, country: e.country, total: 0, classes: new Set(), paths: [], statuses: new Set(), ua: e.ua }
    byIp[e.ip].total += e.count
    byIp[e.ip].classes.add(e.threat_class)
    byIp[e.ip].statuses.add(e.status)
    if (byIp[e.ip].paths.length < 4 && !byIp[e.ip].paths.includes(e.path)) byIp[e.ip].paths.push(e.path)
  })
  const rows = Object.values(byIp).sort((a, b) => b.total - a.total).slice(0, 40)

  return (
    <div className="tbl-wrap">
      <table className="threat-table">
        <thead>
          <tr><th>IP</th><th>Country</th><th>Class</th><th>Sample Paths</th><th>Statuses</th><th>Total Hits</th></tr>
        </thead>
        <tbody>
          {rows.map(e => (
            <tr key={e.ip}>
              <td style={{ fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap' }}>{e.ip}</td>
              <td style={{ fontSize: 10 }}>{e.country || '—'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{[...e.classes].map(c => <TcBadge key={c} cls={c} />)}</td>
              <td style={{ maxWidth: 200, fontSize: 9, color: 'var(--dim)' }}>
                {e.paths.map(p => <div key={p} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p}>{p}</div>)}
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {[...e.statuses].map(s => (
                  <span key={s} style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 700, marginRight: 4, color: s >= 500 ? 'var(--red)' : s >= 400 ? 'var(--yellow)' : 'var(--muted)' }}>{s}</span>
                ))}
              </td>
              <td style={{ fontWeight: 700, color: 'var(--orange)', whiteSpace: 'nowrap' }}>{fmtN(e.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WafCandidates({ candidates }: { candidates: WafCandidate[] }) {
  if (!candidates.length) return <div className="no-data">No WAF candidates</div>
  return (
    <div style={{ padding: 12 }}>
      {candidates.map((c, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: c.severity === 'high' ? 'var(--red)' : 'var(--yellow)' }}>{c.ip}</span>
            <span style={{ fontSize: 9, color: 'var(--dim)' }}>{c.country}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--orange)', fontWeight: 700 }}>{fmtN(c.total_hits)} hits</span>
            {c.threat_classes.map(tc => <TcBadge key={tc} cls={tc} />)}
          </div>
          <div className="waf-rule-box">
            <code>{c.waf_rule}</code>
            <button className="waf-copy-btn" onClick={() => {
              navigator.clipboard.writeText(c.waf_rule).then(() => {})
            }}>Copy</button>
          </div>
          <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 4 }}>
            Action: <strong style={{ color: c.waf_action === 'block' ? 'var(--red)' : 'var(--yellow)' }}>{c.waf_action.toUpperCase()}</strong>
            {c.sample_paths.length > 0 && <> · Paths: {c.sample_paths.slice(0, 3).join(', ')}</>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ThreatIntelPanel({ threatLog, threatSummary, wafCandidates }: {
  threatLog: ThreatLogEntry[]
  threatSummary: ThreatSummary | null
  wafCandidates: WafCandidate[]
}) {
  const [tab, setTab] = useState<'log' | 'waf'>('log')

  const cells = [
    { label: 'Scanners', value: fmtN(threatSummary?.scanners ?? 0), color: 'var(--red)' },
    { label: 'Brute Force', value: fmtN(threatSummary?.brute_force ?? 0), color: 'var(--orange)' },
    { label: 'Probes', value: fmtN(threatSummary?.probes ?? 0), color: 'var(--yellow)' },
    { label: 'Crawlers', value: fmtN(threatSummary?.crawlers ?? 0), color: 'var(--cyan)' },
    { label: 'Anomalies', value: fmtN(threatSummary?.anomalies ?? 0), color: 'var(--muted)' },
    { label: 'Unique IPs', value: fmtN(threatSummary?.unique_ips ?? 0), color: 'var(--text)' },
    { label: 'High Severity', value: fmtN(threatSummary?.high_severity ?? 0), color: 'var(--red)' },
    { label: 'WAF Candidates', value: fmtN(wafCandidates.length), color: 'var(--red)' },
  ]

  return (
    <>
      {threatSummary && (
        <div style={{ padding: '14px 16px 0' }}>
          <div className="ti-summary">
            {cells.map(c => (
              <div key={c.label} className="ti-cell">
                <div className="ti-label">{c.label}</div>
                <div className="ti-val" style={{ color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>
          {threatSummary.top_countries && threatSummary.top_countries.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', alignSelf: 'center' }}>Top Countries</span>
              {threatSummary.top_countries.map(c => (
                <span key={c.country} style={{ fontSize: 10, color: 'var(--dim)' }}>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{c.country}</span>
                  {' '}<span style={{ color: 'var(--orange)', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700 }}>{fmtN(c.hits)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="ti-tabs">
        <div className={`ti-tab${tab === 'log' ? ' active' : ''}`} onClick={() => setTab('log')}>Activity Log</div>
        <div className={`ti-tab${tab === 'waf' ? ' active' : ''}`} onClick={() => setTab('waf')}>WAF Candidates</div>
      </div>
      <div className={`ti-pane overflow${tab === 'log' ? ' active' : ''}`}>
        <ActivityLog entries={threatLog} />
      </div>
      <div className={`ti-pane${tab === 'waf' ? ' active' : ''}`}>
        <WafCandidates candidates={wafCandidates} />
      </div>
    </>
  )
}
