import { useState, useCallback, useRef } from 'react'
import { fmtN, severityClass } from '../../utils'
import { TcBadge } from '../shared/TcBadge'
import { Panel } from '../shared/Panel'
import { Badge } from '../shared/Badge'
import { ThreatIntelPanel } from '../overview/ThreatIntelPanel'
import type { TunnelData, ThreatHistoryPoint, ThreatLibraryEntry } from '../../types'

const WEBHOOK = 'https://api-ain.looknet.ca/webhook/cloudflare-tunnel-status'

// ── 24h summary strip ─────────────────────────────────────────────────────────
function ThreatStrip({ history, wafCount }: { history: ThreatHistoryPoint[]; wafCount: number }) {
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
    { label: '24h Scanners',    value: fmtN(totScanners), color: 'var(--red)',    sub: 'scan tool UA' },
    { label: '24h Brute Force', value: fmtN(totBrute),    color: 'var(--orange)', sub: 'auth path 401/403' },
    { label: '24h Probes',      value: fmtN(totProbes),   color: 'var(--yellow)', sub: 'path fingerprinting' },
    { label: '24h Crawlers',    value: fmtN(totCrawlers), color: 'var(--cyan)',   sub: 'bot user-agents' },
    { label: 'Unique IPs',      value: fmtN(allIps.size), color: 'var(--text)',   sub: 'across all snapshots' },
    { label: 'WAF Candidates',  value: fmtN(wafCount),    color: 'var(--red)',    sub: 'high-sev · active 7d' },
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

  const oldest   = history[0].time
  const newest   = history[history.length - 1].time
  const snapCount = history.length
  const hours    = Math.round(snapCount * 2 / 60 * 10) / 10

  const rows = [
    { label: 'Scanners',    vals: history.map(s => s.summary.scanners ?? 0),    color: 'var(--red)' },
    { label: 'Brute Force', vals: history.map(s => s.summary.brute_force ?? 0), color: 'var(--orange)' },
    { label: 'Probes',      vals: history.map(s => s.summary.probes ?? 0),      color: 'var(--yellow)' },
    { label: 'Crawlers',    vals: history.map(s => s.summary.crawlers ?? 0),    color: 'var(--cyan)' },
  ]

  return (
    <>
      <div className="th-snapshot-age">
        {new Date(oldest).toLocaleString()} — {new Date(newest).toLocaleString()}
      </div>
      <div className="th-history-chart">
        {rows.map(row => {
          const mx = Math.max(...row.vals) || 1
          return (
            <div key={row.label} className="th-spark-row">
              <span className="th-label" style={{ color: row.color }}>{row.label}</span>
              <div className="th-bars">
                {row.vals.map((v, i) => (
                  <div key={i} className="th-bar"
                    style={{ height: `${Math.max(8, Math.round((v / mx) * 100))}%`, background: row.color, opacity: 0.8 }}
                    title={String(v)} />
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
    <div className="tbl-wrap">
      <table className="th-offenders-table">
        <thead>
          <tr><th>IP</th><th>Country</th><th>Hits</th><th>Class</th><th>Severity</th><th className="hide-mobile">Sample Paths</th></tr>
        </thead>
        <tbody>
          {sorted.map(o => (
            <tr key={o.ip}>
              <td style={{ fontFamily: 'monospace', fontSize: 10 }}>{o.ip}</td>
              <td style={{ fontSize: 10 }}>{o.country || '—'}</td>
              <td style={{ fontWeight: 700, color: 'var(--orange)' }}>{fmtN(o.total_hits)}</td>
              <td>{[...o.threat_classes].map(c => <TcBadge key={c} cls={c} />)}</td>
              <td className={severityClass(o.severity)}>{o.severity}</td>
              <td className="hide-mobile" style={{ maxWidth: 160 }}>
                {[...o.sample_paths].slice(0, 3).map(p => <code key={p} style={{ display: 'block', fontSize: 9, opacity: .8 }}>{p}</code>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── WAF action panel (prominent) ──────────────────────────────────────────────
function WafActionPanel({ candidates }: { candidates: TunnelData['waf_candidates'] }) {
  const [copied, setCopied] = useState<string | null>(null)

  if (!candidates || candidates.length === 0) {
    return (
      <div className="waf-empty">
        <div style={{ fontSize: 11, color: 'var(--dim)' }}>No actionable WAF candidates — all high-severity IPs are either dormant or hitting only internal paths.</div>
      </div>
    )
  }

  const copyAll = () => {
    const rules = candidates.map(c => c.waf_rule).join(' or ')
    navigator.clipboard.writeText(rules).then(() => { setCopied('all'); setTimeout(() => setCopied(null), 1800) })
  }

  return (
    <div className="waf-panel">
      <div className="waf-panel-hd">
        <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700 }}>{candidates.length} IPs ready to block</span>
        <button className="waf-copy-btn" onClick={copyAll} style={{ fontSize: 10 }}>
          {copied === 'all' ? 'Copied!' : 'Copy all rules'}
        </button>
      </div>
      <div className="waf-cards-scroll">
        {candidates.map(c => (
          <div key={c.ip} className="waf-card">
            <div className="waf-card-hd">
              <span className="waf-ip" style={{ color: c.severity === 'high' ? 'var(--red)' : 'var(--yellow)' }}>{c.ip}</span>
              <span className="waf-country">{c.country}</span>
              <span className="waf-hits">{fmtN(c.total_hits)} hits</span>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>{c.threat_classes.map(tc => <TcBadge key={tc} cls={tc} />)}</div>
            </div>
            <div className="waf-rule-box">
              <code style={{ flex: 1, fontSize: 10, wordBreak: 'break-all' }}>{c.waf_rule}</code>
              <button className="waf-copy-btn" onClick={() => {
                navigator.clipboard.writeText(c.waf_rule).then(() => { setCopied(c.ip); setTimeout(() => setCopied(null), 1800) })
              }}>{copied === c.ip ? 'Copied!' : 'Copy'}</button>
            </div>
            {c.sample_paths.length > 0 && (
              <div className="waf-paths">
                {c.sample_paths.slice(0, 4).map(p => <code key={p} className="waf-path-item">{p}</code>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Library filter state ──────────────────────────────────────────────────────
interface LibraryFilters {
  severity: '' | 'high' | 'medium' | 'low'
  search: string
  activeOnly: boolean
  sort: 'last_seen' | 'total_hits' | 'severity'
  offset: number
}

// ── Persistent threat library ─────────────────────────────────────────────────
function ThreatLibrary({ initialData, initialMeta }: {
  initialData: ThreatLibraryEntry[]
  initialMeta: TunnelData['library_meta']
}) {
  const [filters, setFilters] = useState<LibraryFilters>({ severity: '', search: '', activeOnly: false, sort: 'last_seen', offset: 0 })
  const [rows, setRows] = useState<ThreatLibraryEntry[]>(initialData)
  const [meta, setMeta] = useState(initialMeta)
  const [loading, setLoading] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchLibrary = useCallback(async (f: LibraryFilters) => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (f.severity)    p.set('severity', f.severity)
      if (f.search)      p.set('search', f.search)
      if (f.activeOnly)  p.set('active', '1')
      if (f.sort)        p.set('sort', f.sort)
      if (f.offset)      p.set('offset', String(f.offset))
      p.set('limit', '200')
      const res = await fetch(`${WEBHOOK}?${p}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const d = Array.isArray(json) ? json[0] : json
      if (f.offset > 0) {
        setRows(prev => [...prev, ...(d.threat_library ?? [])])
      } else {
        setRows(d.threat_library ?? [])
      }
      setMeta(d.library_meta)
    } catch {
      // keep existing rows on error
    } finally {
      setLoading(false)
    }
  }, [])

  const update = useCallback((patch: Partial<LibraryFilters>, immediate = false) => {
    setFilters(prev => {
      const next = { ...prev, ...patch, offset: patch.offset !== undefined ? patch.offset : 0 }
      if (searchRef.current) clearTimeout(searchRef.current)
      if (immediate) {
        fetchLibrary(next)
      } else {
        searchRef.current = setTimeout(() => fetchLibrary(next), 300)
      }
      return next
    })
  }, [fetchLibrary])

  const loadMore = () => {
    const next = { ...filters, offset: filters.offset + 200 }
    setFilters(next)
    fetchLibrary(next)
  }

  const total = meta?.total ?? rows.length
  const hasMore = meta?.has_more ?? false

  return (
    <div className="lib-root">
      {/* Filter bar */}
      <div className="lib-filters">
        <div className="lib-filter-row1">
          <input
            className="lib-search"
            type="text"
            placeholder="Search IP, path, country..."
            value={filters.search}
            onChange={e => update({ search: e.target.value })}
          />
          <div className="lib-sev-pills">
            {(['', 'high', 'medium', 'low'] as const).map(s => (
              <button key={s || 'all'} className={`sev-pill${filters.severity === s ? ' active' : ''}${s ? ` sev-${s}` : ''}`}
                onClick={() => update({ severity: s }, true)}>
                {s || 'All'}
              </button>
            ))}
          </div>
          <button className={`lib-toggle${filters.activeOnly ? ' active' : ''}`} onClick={() => update({ activeOnly: !filters.activeOnly }, true)}>
            {filters.activeOnly ? 'Active only' : 'All'}
          </button>
          <div className="lib-sort">
            <span style={{ fontSize: 9, color: 'var(--dim)' }}>Sort:</span>
            {(['last_seen', 'total_hits', 'severity'] as const).map(s => (
              <button key={s} className="rbtn" style={{ opacity: filters.sort === s ? 1 : 0.45, padding: '3px 8px' }}
                onClick={() => update({ sort: s }, true)}>
                {s === 'last_seen' ? 'Recent' : s === 'total_hits' ? 'Hits' : 'Sev'}
              </button>
            ))}
          </div>
        </div>
        <span className="lib-count">{loading ? '…' : `${rows.length} / ${fmtN(total)}`}</span>
      </div>

      {/* Table */}
      <div className="tbl-wrap">
        <table className="th-offenders-table lib-table">
          <thead>
            <tr>
              <th>IP</th>
              <th className="hide-mobile">Country</th>
              <th>Total Hits</th>
              <th>Severity</th>
              <th className="hide-mobile">Classes</th>
              <th className="hide-small">First Seen</th>
              <th>Last Seen</th>
              <th className="hide-mobile">Sample Paths</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(e => (
              <tr key={e.ip} style={{ opacity: e.dormant ? 0.4 : 1 }}>
                <td style={{ fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap' }}>
                  {e.ip}
                  {e.dormant && <span className="lib-dormant-tag">dormant</span>}
                </td>
                <td className="hide-mobile" style={{ fontSize: 10 }}>{(e.countries ?? []).join(', ') || '—'}</td>
                <td style={{ fontWeight: 700, color: 'var(--orange)' }}>{fmtN(e.total_hits_alltime ?? 0)}</td>
                <td className={severityClass(e.severity_peak)}>{e.severity_peak}</td>
                <td className="hide-mobile">{(e.threat_classes ?? []).map(c => <TcBadge key={c} cls={c} />)}</td>
                <td className="hide-small" style={{ fontSize: 9, color: 'var(--dim)', whiteSpace: 'nowrap' }}>
                  {e.first_seen ? new Date(e.first_seen).toLocaleDateString() : '—'}
                </td>
                <td style={{ fontSize: 9, color: 'var(--dim)', whiteSpace: 'nowrap' }}>
                  {e.last_seen ? new Date(e.last_seen).toLocaleString() : '—'}
                </td>
                <td className="hide-mobile" style={{ maxWidth: 160 }}>
                  {(e.sample_paths ?? []).slice(0, 3).map(p => <code key={p} style={{ display: 'block', fontSize: 9, opacity: .8 }}>{p}</code>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="lib-load-more">
          <button className="rbtn" onClick={loadMore} disabled={loading}>
            {loading ? 'Loading...' : `Load more (${fmtN(total - rows.length)} remaining)`}
          </button>
        </div>
      )}
      {!rows.length && !loading && (
        <div className="no-data">No IPs match current filters.</div>
      )}
    </div>
  )
}

type ThreatTab = '24h' | 'waf' | 'library'

// ── Main ThreatMode component ─────────────────────────────────────────────────
export function ThreatMode({ data }: { data: TunnelData }) {
  const [tab, setTab] = useState<ThreatTab>('waf')
  const history  = data.threat_history ?? []
  const library  = data.threat_library ?? []
  const wafCandidates = data.waf_candidates ?? []
  const snapCount = history.length
  const uniqueIpCount = Object.keys(history.flatMap(h => h.top_offenders ?? []).reduce((m, o) => { m[o.ip] = true; return m }, {} as Record<string, boolean>)).length

  return (
    <div>
      {/* Sub-tab nav — same pill container as header mode toggle */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="mode-toggle">
          <div className={`mtab${tab === 'waf' ? ' active-threat' : ''}`} onClick={() => setTab('waf')}>
            WAF Action
            {wafCandidates.length > 0 && (
              <span style={{ marginLeft: 5, background: 'var(--red)', color: '#fff', borderRadius: 10, fontSize: 8, fontWeight: 700, padding: '1px 5px', verticalAlign: 'middle' }}>
                {wafCandidates.length}
              </span>
            )}
          </div>
          <div className={`mtab${tab === '24h' ? ' active-threat' : ''}`} onClick={() => setTab('24h')}>
            24h Window
          </div>
          <div className={`mtab${tab === 'library' ? ' active-threat' : ''}`} onClick={() => setTab('library')}>
            Library {data.library_meta && <Badge color="orange">{fmtN(data.library_meta.total)}</Badge>}
          </div>
        </div>
      </div>

      {tab === 'waf' && (
        <div style={{ padding: '16px' }}>
          <Panel
            title="WAF Candidates"
            badge={<Badge color="red">{wafCandidates.length} IPs · high-sev · active 7d</Badge>}
          >
            <WafActionPanel candidates={wafCandidates} />
          </Panel>
        </div>
      )}

      {tab === '24h' && (
        <>
          <ThreatStrip history={history} wafCount={wafCandidates.length} />
          <div className="b-grid" style={{ marginTop: 0 }}>
            <div className="col">
              <Panel
                title="Threat Trend · 24h"
                badge={<Badge color="muted">{snapCount} snapshot{snapCount !== 1 ? 's' : ''}</Badge>}
              >
                <ThreatTrend history={history} />
              </Panel>

              <Panel
                title="Top Offenders · 24h"
                badge={<Badge color="red">{uniqueIpCount} IPs</Badge>}
              >
                <TopOffenders history={history} />
              </Panel>
            </div>

            <div className="col">
              <Panel title="Live Activity · Current Snapshot" badge={<Badge color="muted">Latest</Badge>}>
                <ThreatIntelPanel
                  threatLog={data.threat_log ?? []}
                  threatSummary={data.threat_summary}
                  wafCandidates={wafCandidates}
                />
              </Panel>
            </div>
          </div>
        </>
      )}

      {tab === 'library' && (
        <div style={{ padding: '0 0 24px' }}>
          <Panel
            title="Threat Library · All-Time IPs"
            badge={<Badge color="orange">{data.library_meta ? fmtN(data.library_meta.total) : library.length} known</Badge>}
          >
            <ThreatLibrary initialData={library} initialMeta={data.library_meta} />
          </Panel>
        </div>
      )}
    </div>
  )
}
