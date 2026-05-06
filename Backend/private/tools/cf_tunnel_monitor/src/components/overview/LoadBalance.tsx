import { nodeName, avgRtt } from '../../utils'
import type { LoadBalance as LB, NodeData } from '../../types'

export function LoadBalance({ lb, nodes }: { lb: LB; nodes: NodeData[] }) {
  const nodeByIp = Object.fromEntries(nodes.map(n => [n.node_ip, n]))

  const rows = [
    { ip: lb.node1_ip, pct: lb.node1_pct, cls: 'n1' },
    { ip: lb.node2_ip, pct: lb.node2_pct, cls: 'n2' },
    ...(lb.node3_ip != null ? [{ ip: lb.node3_ip, pct: lb.node3_pct ?? 0, cls: 'n3' }] : []),
  ]

  const pcts = rows.map(r => r.pct)
  const maxDelta = Math.max(...pcts) - Math.min(...pcts)
  const ideal = Math.round(100 / rows.length)
  const perf = maxDelta > 30
  const balanced = maxDelta <= 20
  const minPct = Math.min(...pcts)
  const minRow = rows.find(r => r.pct === minPct)!

  return (
    <div className="pb">
      {rows.map(r => {
        const rtt = avgRtt(nodeByIp[r.ip])
        return (
          <div key={r.ip} className="lbrow">
            <div className="lblabel">
              {nodeName(r.ip)}
              <span>{r.ip}{rtt ? ` · ~${rtt}ms RTT` : ''}</span>
            </div>
            <div className="lbtrack"><div className={`lbfill ${r.cls}`} style={{ width: `${r.pct}%` }} /></div>
            <div className={`lbpct ${r.cls}`}>{r.pct}%</div>
          </div>
        )
      })}
      <div className={`lbnote ${perf ? 'info' : balanced ? 'ok' : 'warn'}`}>
        {perf
          ? `↗ Cloudflare is routing by performance. ${nodeName(minRow.ip)} (slower node) handles less traffic — this is expected and healthy.`
          : balanced
            ? `✓ Traffic is evenly distributed (~${ideal}% per node).`
            : `⚠ Skew of ${maxDelta}% — investigate if unexpected.`}
      </div>
    </div>
  )
}
