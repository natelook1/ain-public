import { fmtN } from '../../utils'
import type { NodeData } from '../../types'

const COLORS = ['var(--orange)', 'var(--cyan)', 'var(--green)']

const CONGESTION_STATES: Record<number, string> = { 1: 'Slow Start', 2: 'Cong Avoid', 3: 'Steady', 4: 'App Limited' }

export function QuicTable({ nodes }: { nodes: NodeData[] }) {
  const all = nodes.flatMap((n, ni) =>
    (n.quic_connections ?? []).map(c => ({ ...c, nodeColor: COLORS[ni] ?? COLORS[0], nodeIp: n.node_ip }))
  )
  if (!all.length) return <div className="no-data">No QUIC data available</div>

  const maxCw = Math.max(...all.map(c => c.congestion_window ?? 0))
  const maxRtt = Math.max(...all.map(c => c.latest_rtt ?? 0))

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="qt">
        <thead>
          <tr>
            <th>#</th><th>Node</th><th>PoP</th>
            <th>Latest RTT</th><th>Smoothed RTT</th><th>Min RTT</th>
            <th>State</th><th>CW</th><th>Lost Pkts</th>
          </tr>
        </thead>
        <tbody>
          {all.map((c, i) => {
            const lostTotal = c.lost_packets?.reduce((s, l) => s + (l.count ?? 0), 0) ?? 0
            return (
              <tr key={i}>
                <td style={{ color: c.nodeColor, fontWeight: 700 }}>{i + 1}</td>
                <td style={{ fontSize: 9, color: 'var(--dim)' }}>{c.nodeIp}</td>
                <td><span style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--cyan)', borderRadius: 3, padding: '2px 5px', fontSize: 9, fontWeight: 700 }}>{c.edge_location ?? '—'}</span></td>
                <td><span className="rtt-val" style={{ color: c.latest_rtt != null && maxRtt > 0 ? `hsl(${120 - (c.latest_rtt / maxRtt) * 120},70%,55%)` : undefined }}>{c.latest_rtt ?? '—'}</span>{c.latest_rtt != null && <span style={{ fontSize: 9, color: 'var(--muted)' }}>ms</span>}</td>
                <td>{c.smoothed_rtt != null ? `${c.smoothed_rtt}ms` : '—'}</td>
                <td>{c.min_rtt != null ? `${c.min_rtt}ms` : '—'}</td>
                <td style={{ fontSize: 9 }}>{c.congestion_state != null ? (CONGESTION_STATES[c.congestion_state] ?? c.congestion_state) : '—'}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10 }}>{fmtN(c.congestion_window)}</span>
                    {c.congestion_window != null && maxCw > 0 && (
                      <div className="cw-bar-wrap"><div className="cw-bar" style={{ width: `${(c.congestion_window / maxCw) * 100}%` }} /></div>
                    )}
                  </div>
                </td>
                <td style={{ color: lostTotal > 0 ? 'var(--red)' : 'var(--muted)' }}>{lostTotal}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
