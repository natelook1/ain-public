import { Sparkline } from '../shared/Sparkline'
import { fmtN, fmtMbps, nodeName } from '../../utils'
import type { TunnelData } from '../../types'

interface Props {
  data: TunnelData
  reqRates: number[]
  streamRates: number[]
  errRates: number[]
}

function KPI({ label, value, color, sub, spark, sparkColor }: {
  label: string
  value: string
  color?: string
  sub?: string
  spark?: number[]
  sparkColor?: string
}) {
  return (
    <div className="sc">
      <div className="sl">{label}</div>
      <div className="sv" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="ss">{sub}</div>}
      {spark && <Sparkline data={spark} color={sparkColor} />}
    </div>
  )
}

export function SummaryStrip({ data, reqRates, streamRates, errRates }: Props) {
  const sum = data.summary
  const nodes = data.nodes ?? []
  const lb = data.load_balance

  const allOk = sum.healthy === sum.total_tunnels && sum.total_tunnels > 0
  const healthColor = allOk ? 'var(--green)' : sum.healthy > 0 ? 'var(--yellow)' : 'var(--red)'
  const healthSub = `${sum.healthy}/${sum.total_tunnels} healthy`

  const haConns = nodes.reduce((s, n) => s + (n.ha_connections ?? 0), 0)

  const pcts = [lb?.node1_pct, lb?.node2_pct, lb?.node3_pct].filter((v): v is number => v != null)
  const maxDelta = pcts.length ? Math.max(...pcts) - Math.min(...pcts) : 0
  const perf = maxDelta > 30
  const balanced = maxDelta <= 20
  const routingLabel = perf ? 'PERF-BASED' : balanced ? 'BALANCED' : 'SKEWED'
  const routingColor = perf ? 'var(--accent)' : balanced ? 'var(--green)' : 'var(--yellow)'
  const routingSub = perf
    ? 'CF routing by latency'
    : lb ? pcts.map(p => `${p}%`).join(' / ') : '—'

  const agg: Record<string, number> = {}
  nodes.forEach(n => Object.entries(n.response_codes ?? {}).forEach(([k, v]) => { agg[k] = (agg[k] ?? 0) + v }))
  const tot = Object.values(agg).reduce((s, v) => s + v, 0)
  const ok = Object.entries(agg).filter(([k]) => k.startsWith('2') || k.startsWith('3')).reduce((s, [, v]) => s + v, 0)
  const sr = tot > 0 ? parseFloat(((ok / tot) * 100).toFixed(2)) : null
  const srColor = sr == null ? undefined : sr >= 99 ? 'var(--green)' : sr >= 90 ? 'var(--yellow)' : 'var(--red)'

  const rollingErrs = errRates.reduce((s, v) => s + v, 0)
  const errsColor = rollingErrs === 0 ? 'var(--green)' : rollingErrs < 50 ? 'var(--yellow)' : 'var(--red)'

  const history = data.history ?? []
  let rxBps = 0, txBps = 0
  if (history.length >= 2) {
    const cur = history[history.length - 1]
    const prev = history[history.length - 2]
    const elapsedSec = (new Date(cur.time).getTime() - new Date(prev.time).getTime()) / 1000 || 120
    rxBps = Math.max(0, cur.rx - prev.rx) / elapsedSec
    txBps = Math.max(0, cur.tx - prev.tx) / elapsedSec
  }
  const totalMbps = (rxBps + txBps) * 8 / 1e6
  const trafficLabel = history.length >= 2 ? (totalMbps > 0.01 ? totalMbps.toFixed(1) : '0.0') : '—'
  const trafficSub = history.length < 2 ? 'gathering data…' : `↓ ${fmtMbps(rxBps)} · ↑ ${fmtMbps(txBps)} Mbps`

  return (
    <div className="strip">
      <KPI label="Tunnel Health" value={sum.healthy === sum.total_tunnels && sum.total_tunnels > 0 ? 'HEALTHY' : sum.healthy > 0 ? 'DEGRADED' : 'DOWN'} color={healthColor} sub={healthSub} />
      <KPI label="HA Connections" value={fmtN(haConns)} color="var(--accent)" sub="per node" />
      <KPI label="Total Requests" value={fmtN(sum.total_requests)} sub={`${nodes.map(n => nodeName(n.node_ip)).join(' + ')}`} spark={reqRates} sparkColor="var(--text)" />
      <KPI label="Active Streams" value={fmtN(sum.total_active_streams)} color="var(--cyan)" sub="concurrent" spark={streamRates} sparkColor="var(--cyan)" />
      <KPI label="CF Routing" value={lb ? routingLabel : '—'} color={lb ? routingColor : undefined} sub={routingSub} />
      <KPI label="Success Rate" value={sr != null ? `${sr}%` : '—'} color={srColor} sub="2xx / total" />
      <KPI label="Proxy Errors" value={fmtN(rollingErrs)} color={errsColor} sub="past hour" spark={errRates} sparkColor="var(--red)" />
      <KPI label="Live Traffic" value={history.length >= 2 ? `${trafficLabel} Mbps` : trafficLabel} sub={trafficSub} spark={reqRates} sparkColor="var(--accent)" />
    </div>
  )
}
