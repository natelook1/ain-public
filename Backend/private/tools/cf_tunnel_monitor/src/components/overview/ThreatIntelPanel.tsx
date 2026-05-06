import { useState } from 'react'
import { fmtN } from '../../utils'
import { TcBadge } from '../shared/TcBadge'
import type { ThreatLogEntry, ThreatSummary, WafCandidate } from '../../types'

function ActivityLog({ entries }: { entries: ThreatLogEntry[] }) {
  if (!entries.length) return <div className="no-data">No threat activity in past hour</div>
  const sorted = [...entries].sort((a, b) => b.count - a.count).slice(0, 50)
  return (
    <table className="threat-table">
      <thead>
        <tr><th>IP</th><th>Country</th><th>Class</th><th>Path</th><th>UA</th><th>Status</th><th>Count</th></tr>
      </thead>
      <tbody>
        {sorted.map((e, i) => (
          <tr key={i}>
            <td style={{ fontFamily: 'monospace', fontSize: 10 }}>{e.ip}</td>
            <td style={{ fontSize: 10 }}>{e.country || '—'}</td>
            <td><TcBadge cls={e.threat_class} /></td>
            <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }} title={e.path}>{e.path || '—'}</td>
            <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9, color: 'var(--dim)' }} title={e.ua}>{e.ua || '—'}</td>
            <td style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 700, color: e.status >= 500 ? 'var(--red)' : e.status >= 400 ? 'var(--yellow)' : 'var(--muted)' }}>{e.status || '—'}</td>
            <td style={{ fontWeight: 700, color: 'var(--orange)' }}>{fmtN(e.count)}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
