import { useEffect, useRef, useState } from 'react'
import { fmtN, fmtMbps, nodeName, relTime, codeDesc } from '../../utils'
import type { TunnelData } from '../../types'
import type { LiveDeltas } from '../../hooks/useLiveHistory'

const LIVE_INTERVAL = 10_000

// ── Poll progress bar ────────────────────────────────────────────────────────
function PollBar() {
  const [width, setWidth] = useState(100)
  const startRef = useRef(Date.now())
  const rafRef = useRef<number>(0)

  useEffect(() => {
    startRef.current = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startRef.current
      setWidth(Math.max(0, 100 - (elapsed / LIVE_INTERVAL) * 100))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div className="poll-bar-wrap">
      <div className="poll-bar" style={{ width: `${width}%`, transition: 'none' }} />
    </div>
  )
}

// ── Stream ticker ────────────────────────────────────────────────────────────
function StreamTicker({ data }: { data: TunnelData }) {
  const total = data.summary.total_active_streams ?? 0
  return (
    <div className="stream-ticker">
      <div className="st-label">Active<br />Streams</div>
      <div className="st-streams">
        {data.nodes.map(n => (
          <div key={n.node_ip} className="st-node">
            <strong>{n.active_streams ?? 0}</strong> {nodeName(n.node_ip)}
          </div>
        ))}
      </div>
      <div className="st-total">{total}<small>streams</small></div>
    </div>
  )
}

// ── Hero cards ───────────────────────────────────────────────────────────────
function HeroCard({ label, dotColor, value, valueColor, unit, sub, delta }: {
  label: string; dotColor: string; value: string; valueColor?: string; unit?: string;
  sub?: string; delta?: { val: string; cls: 'up' | 'down' | 'flat' }
}) {
  const pulseClass = dotColor === 'var(--red)' ? 'pulse-red' : dotColor === 'var(--cyan)' ? 'pulse-cyan' : dotColor === 'var(--green)' ? 'pulse-green' : ''
  return (
    <div className={`lhc ${pulseClass}`}>
      <div className="lhc-label">
        <div className="lhc-label-dot" style={{ color: dotColor }} />
        {label}
      </div>
      <div className={`lhc-val${valueColor ? ' ' + valueColor : ''}`}>
        {value}{unit && <span className="lhc-unit">{unit}</span>}
      </div>
      <div className="lhc-sub">
        {delta && <span className={`lhc-delta ${delta.cls}`}>{delta.val}</span>}
        {sub && <span style={{ color: 'var(--dim)', fontSize: 10, marginLeft: 4 }}>{sub}</span>}
      </div>
    </div>
  )
}

// ── BW sparkline bar ─────────────────────────────────────────────────────────
function BwSpark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data) || 1
  return (
    <div className="bw-spark">
      {data.map((v, i) => (
        <div key={i} className="bw-spark-bar" style={{ height: `${Math.max(5, (v / max) * 100)}%`, background: color, opacity: 0.7 }} />
      ))}
    </div>
  )
}

// ── Error feed ───────────────────────────────────────────────────────────────
function ErrorFeed({ errors }: { errors: TunnelData['error_analytics'] }) {
  if (!errors.length) return <div className="no-data" style={{ padding: 12 }}>No recent errors</div>

  const sorted = [...errors].sort((a, b) => b.count - a.count).slice(0, 8)
  return (
    <>
      {sorted.map((e, i) => {
        const dim = e.dimensions
        const is4 = dim.edgeResponseStatus >= 400 && dim.edgeResponseStatus < 500
        return (
          <div key={i} className="err-item">
            <div>
              <div><span className="err-ip">{dim.clientIP}</span></div>
              <span className={`err-code ${is4 ? 'c4' : 'c5'}`}>{dim.edgeResponseStatus}</span>
              <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 6 }}>{codeDesc(dim.edgeResponseStatus)}</span>
              <div className="err-path">{dim.clientRequestHTTPHost}{dim.clientRequestPath}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>×{e.count}</div>
              <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 2 }}>{relTime(dim.datetimeFiveMinutes)}</div>
            </div>
          </div>
        )
      })}
    </>
  )
}

// ── Node vitals ──────────────────────────────────────────────────────────────
function NodeVitals({ data }: { data: TunnelData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.nodes.map(n => (
        <div key={n.node_ip} className="node-vital">
          <div className="node-vital-hd">
            <span className="node-vital-name">{nodeName(n.node_ip)}</span>
            <span className="node-vital-ip">{n.node_ip}</span>
          </div>
          <div className="node-vital-grid">
            <div className="nv-stat"><div className="nv-label">Requests</div><div className="nv-val">{fmtN(n.total_requests)}</div></div>
            <div className="nv-stat"><div className="nv-label">Streams</div><div className="nv-val" style={{ color: 'var(--cyan)' }}>{n.active_streams ?? 0}</div></div>
            <div className="nv-stat"><div className="nv-label">Load</div><div className="nv-val" style={{ color: 'var(--orange)' }}>{n.load_pct ?? 0}%</div></div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── QUIC mini grid ────────────────────────────────────────────────────────────
function QuicMini({ data }: { data: TunnelData }) {
  const byLoc: Record<string, number[]> = {}
  data.nodes.forEach(n => {
    n.quic_connections?.forEach(c => {
      const loc = c.edge_location ?? 'UNK'
      if (!byLoc[loc]) byLoc[loc] = []
      if (c.smoothed_rtt != null) byLoc[loc].push(c.smoothed_rtt)
    })
  })
  const locs = Object.entries(byLoc).sort(([a], [b]) => a.localeCompare(b))
  if (!locs.length) return <div className="no-data" style={{ padding: 10 }}>No QUIC data</div>

  return (
    <div className="quic-mini-grid">
      {locs.map(([loc, rtts]) => {
        const avg = Math.round(rtts.reduce((s, v) => s + v, 0) / rtts.length)
        return (
          <div key={loc} className="qm">
            <div className="qm-loc">{loc}</div>
            <div className="qm-rtt">{avg}<span className="qm-unit">ms</span></div>
          </div>
        )
      })}
    </div>
  )
}

// ── Live threat strip ─────────────────────────────────────────────────────────
function LiveThreatStrip({ data }: { data: TunnelData }) {
  const ts = data.threat_summary
  const cells = [
    { label: 'Scanners', value: fmtN(ts?.scanners ?? 0), color: 'var(--red)' },
    { label: 'Brute Force', value: fmtN(ts?.brute_force ?? 0), color: 'var(--orange)' },
    { label: 'Probes', value: fmtN(ts?.probes ?? 0), color: 'var(--yellow)' },
    { label: 'Crawlers', value: fmtN(ts?.crawlers ?? 0), color: 'var(--cyan)' },
    { label: 'Unique IPs', value: fmtN(ts?.unique_ips ?? 0), color: 'var(--text)' },
    { label: 'WAF Candidates', value: fmtN(data.waf_candidates?.length ?? 0), color: 'var(--red)' },
  ]
  return (
    <div className="live-threat-strip">
      {cells.map(c => (
        <div key={c.label} className="sc">
          <div className="sl">{c.label}</div>
          <div className="sv" style={{ color: c.color, fontSize: 22 }}>{c.value}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main LiveMode component ───────────────────────────────────────────────────
export function LiveMode({ data, deltas }: { data: TunnelData; deltas: LiveDeltas | null }) {
  const rps = deltas?.rps ?? 0
  const errRate = deltas?.errRate ?? 0
  const rxBps = deltas?.rxBps ?? 0
  const txBps = deltas?.txBps ?? 0
  const sr = deltas?.successRate
  const hist = deltas?.history

  const rxMbps = fmtMbps(rxBps)
  const txMbps = fmtMbps(txBps)

  return (
    <div>
      <PollBar />
      <StreamTicker data={data} />

      <div className="live-hero">
        <HeroCard label="Requests / min" dotColor="var(--text)" value={fmtN(rps)} />
        <HeroCard label="Errors / min" dotColor="var(--red)" value={fmtN(errRate)} valueColor="red" sub="5xx + 4xx" />
        <HeroCard label="Live Bandwidth" dotColor="var(--cyan)" value={rxMbps} valueColor="cyan" unit="Mbps" sub={`↑${txMbps} TX`} />
        <HeroCard label="Success Rate" dotColor="var(--green)" value={sr != null ? `${sr}%` : '—'} valueColor="green" sub={sr == null ? 'awaiting data' : undefined} />
      </div>

      <div className="live-body">
        <div className="live-main">
          {/* BW meter */}
          <div className="bw-panel">
            <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Bandwidth History</div>
            {hist && (
              <>
                <div className="bw-row">
                  <span className="bw-label" style={{ color: 'var(--cyan)' }}>↓ RX</span>
                  <BwSpark data={hist.rx} color="var(--cyan)" />
                  <span className="bw-val" style={{ color: 'var(--cyan)' }}>{rxMbps}<span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 2 }}>Mbps</span></span>
                </div>
                <div className="bw-row">
                  <span className="bw-label" style={{ color: 'var(--orange)' }}>↑ TX</span>
                  <BwSpark data={hist.tx} color="var(--orange)" />
                  <span className="bw-val" style={{ color: 'var(--orange)' }}>{txMbps}<span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 2 }}>Mbps</span></span>
                </div>
                <div className="bw-row">
                  <span className="bw-label" style={{ color: 'var(--red)' }}>Errors</span>
                  <BwSpark data={hist.perr} color="var(--red)" />
                  <span className="bw-val" style={{ color: 'var(--red)' }}>{fmtN(hist.perr[hist.perr.length - 1] ?? 0)}<span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 2 }}>/min</span></span>
                </div>
              </>
            )}
          </div>

          {/* Error feed */}
          <div className="lv-err-feed panel">
            <div className="ph">
              <span className="err-feed-title">Recent Edge Errors</span>
              <span className="badge red">{data.error_analytics?.length ?? 0} entries</span>
            </div>
            <ErrorFeed errors={data.error_analytics ?? []} />
          </div>

          {/* Threat strip */}
          <LiveThreatStrip data={data} />
        </div>

        <div className="live-side">
          <NodeVitals data={data} />

          <div className="panel">
            <div className="ph"><span className="pt">QUIC · Real-time</span><span className="badge cyan">{data.nodes.flatMap(n => n.quic_connections ?? []).length} conns</span></div>
            <QuicMini data={data} />
          </div>
        </div>
      </div>
    </div>
  )
}
