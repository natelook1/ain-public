import { SummaryStrip } from './SummaryStrip'
import { DriftBanner } from './DriftBanner'
import { TunnelDetail } from './TunnelDetail'
import { NodeTabs } from './NodeTabs'
import { QuicTable } from './QuicTable'
import { LoadBalance } from './LoadBalance'
import { RTT } from './RTT'
import { ResponseCodes } from './ResponseCodes'
import { EdgeErrors } from './EdgeErrors'
import { Timeline } from './Timeline'
import { ThreatIntelPanel } from './ThreatIntelPanel'
import { ServiceHealth } from './ServiceHealth'
import { Panel } from '../shared/Panel'
import { Badge } from '../shared/Badge'
import { fmtN } from '../../utils'
import type { TunnelData } from '../../types'

interface Props {
  data: TunnelData
  reqRates: number[]
  streamRates: number[]
  errRates: number[]
}

export function OverviewMode({ data, reqRates, streamRates, errRates }: Props) {
  const nodes = data.nodes ?? []
  const tunnels = data.tunnels ?? []
  const lb = data.load_balance

  const allQuic = nodes.flatMap(n => n.quic_connections ?? [])
  const allCodes: Record<string, number> = {}
  nodes.forEach(n => Object.entries(n.response_codes ?? {}).forEach(([k, v]) => { allCodes[k] = (allCodes[k] ?? 0) + v }))
  const tot = Object.values(allCodes).reduce((s, v) => s + v, 0)
  const ok = Object.entries(allCodes).filter(([k]) => k.startsWith('2') || k.startsWith('3')).reduce((s, [, v]) => s + v, 0)
  const sr = tot > 0 ? ((ok / tot) * 100).toFixed(2) : null

  return (
    <div>
      <SummaryStrip data={data} reqRates={reqRates} streamRates={streamRates} errRates={errRates} />
      <DriftBanner nodes={nodes} />

      <div className="b-grid">
        {/* LEFT */}
        <div className="col">
          <Panel title="Tunnel Detail" badge={<Badge color="muted">{tunnels.length} tunnel{tunnels.length !== 1 ? 's' : ''}</Badge>}>
            <TunnelDetail tunnels={tunnels} />
          </Panel>

          <Panel title="Per-Node Deep Dive" badge={<Badge color="purple">Prometheus</Badge>}>
            <NodeTabs nodes={nodes} />
          </Panel>

          <Panel title="QUIC Connection Details" badge={<Badge color="cyan">{allQuic.length} conns</Badge>}>
            {allQuic.length ? <QuicTable nodes={nodes} /> : <div className="no-data">No QUIC data available</div>}
          </Panel>
        </div>

        {/* RIGHT */}
        <div className="col">
          {lb && (
            <Panel title="CF Load Distribution" badge={
              <Badge color={
                (() => {
                  const pcts = [lb.node1_pct, lb.node2_pct, lb.node3_pct].filter((v): v is number => v != null)
                  const delta = Math.max(...pcts) - Math.min(...pcts)
                  return delta > 30 ? 'cyan' : delta <= 20 ? 'green' : 'orange'
                })()
              }>
                {(() => {
                  const pcts = [lb.node1_pct, lb.node2_pct, lb.node3_pct].filter((v): v is number => v != null)
                  const delta = Math.max(...pcts) - Math.min(...pcts)
                  return delta > 30 ? 'Perf-Routed' : delta <= 20 ? 'Balanced' : 'Skewed'
                })()}
              </Badge>
            }>
              <LoadBalance lb={lb} nodes={nodes} />
            </Panel>
          )}

          <Panel title="Avg RTT to Edge" badge={<Badge color="cyan">QUIC · ms</Badge>}>
            <RTT nodes={nodes} />
          </Panel>

          <Panel title="Response Codes" badge={<Badge color={sr != null ? (+sr >= 99 ? 'green' : +sr >= 90 ? 'yellow' : 'red') : 'muted'}>{sr != null ? `${sr}%` : '—'}</Badge>}>
            <ResponseCodes nodes={nodes} />
          </Panel>

          <Panel title="Service Health" badge={
            <Badge color={(() => {
              const h = data.history ?? []
              const cur503 = h.length ? (h[h.length-1].err503 ?? h[h.length-1].response_codes?.['503'] ?? 0) : 0
              const curAuth = h.length ? (h[h.length-1].authentik_errors ?? 0) : 0
              return cur503 > 0 || curAuth > 0 ? 'red' : 'green'
            })()}>
              {(() => {
                const h = data.history ?? []
                const cur503 = h.length ? (h[h.length-1].err503 ?? h[h.length-1].response_codes?.['503'] ?? 0) : 0
                return cur503 > 0 ? `${fmtN(cur503)} 503s` : 'Nominal'
              })()}
            </Badge>
          }>
            <ServiceHealth history={data.history ?? []} data={data} />
          </Panel>

          <Panel title="Recent Edge Errors" badge={<Badge color="red">Past Hour</Badge>}>
            <EdgeErrors errors={data.error_analytics ?? []} />
          </Panel>

          <Panel title="Event Timeline" badge={<Badge color="muted">Connection Events</Badge>}>
            <Timeline tunnels={tunnels} />
          </Panel>
        </div>

        {/* THREAT INTEL — full width */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Panel
            title="Threat Intel · Past Hour"
            badge={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge color="red">{data.threat_summary ? `${data.threat_summary.total} events` : '—'}</Badge>
                <Badge color="muted">{data.threat_summary ? `${data.threat_summary.unique_ips} IPs` : '—'}</Badge>
              </div>
            }
          >
            <ThreatIntelPanel
              threatLog={data.threat_log ?? []}
              threatSummary={data.threat_summary}
              wafCandidates={data.waf_candidates ?? []}
            />
          </Panel>
        </div>
      </div>

      <footer>
        {(() => {
          const ageMs = data.fetched_at ? Date.now() - new Date(data.fetched_at).getTime() : null
          const ageSec = ageMs != null ? Math.round(ageMs / 1000) : null
          const ageColor = ageSec == null ? 'var(--dim)' : ageSec < 150 ? 'var(--green)' : ageSec < 600 ? 'var(--yellow)' : 'var(--red)'
          const ageLabel = ageSec == null ? '—' : ageSec < 60 ? `${ageSec}s` : ageSec < 3600 ? `${Math.floor(ageSec/60)}m ${ageSec%60}s` : `${Math.floor(ageSec/3600)}h ${Math.floor((ageSec%3600)/60)}m`
          return <>
            Tunnel ID: {tunnels[0]?.tunnel_id?.slice(0, 8) ?? '—'}&nbsp;·&nbsp;
            Data from: {data.fetched_at ? new Date(data.fetched_at).toLocaleTimeString() : '—'}&nbsp;·&nbsp;
            Cache age: <span style={{ color: ageColor, fontWeight: ageSec != null && ageSec >= 600 ? 700 : 'inherit' }}>{ageLabel}{ageSec != null && ageSec >= 600 ? ' ⚠ STALE' : ''}</span>
          </>
        })()}
      </footer>
    </div>
  )
}
