import { nodeName } from '../../utils'
import type { NodeData } from '../../types'

const COLORS = ['var(--orange)', 'var(--cyan)', 'var(--green)']

export function RTT({ nodes }: { nodes: NodeData[] }) {
  const withQuic = nodes.filter(n => n.quic_connections?.length)
  if (!withQuic.length) return <div className="no-data">No QUIC data available</div>

  return (
    <div className="pb">
      {withQuic.map((n, ni) => {
        const conns = n.quic_connections
        const avg = Math.round(conns.reduce((s, c) => s + (c.smoothed_rtt ?? 0), 0) / conns.length)
        const mn = Math.min(...conns.map(c => c.min_rtt ?? 99))
        const mx = Math.max(...conns.map(c => c.latest_rtt ?? 0))
        const color = COLORS[nodes.indexOf(n)] ?? COLORS[0]
        return (
          <div key={n.node_ip} style={{ marginBottom: ni < withQuic.length - 1 ? 14 : 0, paddingBottom: ni < withQuic.length - 1 ? 14 : 0, borderBottom: ni < withQuic.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color }}>{nodeName(n.node_ip)} <span style={{ fontSize: 9, color: 'var(--dim)' }}>{n.node_ip}</span></span>
              <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 26, fontWeight: 700 }}>{avg}<span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 2 }}>ms</span></span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 10, color: 'var(--muted)' }}>
              <span>min <span style={{ color: 'var(--green)' }}>{mn}ms</span></span>
              <span>max <span style={{ color: 'var(--yellow)' }}>{mx}ms</span></span>
              <span>{conns.length} QUIC conns</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
