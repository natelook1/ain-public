import { useState } from 'react'
import { nodeName, fmtN, fmtBytes, relTime } from '../../utils'
import type { NodeData } from '../../types'

function NodeContent({ n }: { n: NodeData }) {
  const uptime = n.process_start_time ? Math.floor((Date.now() / 1000 - n.process_start_time) / 60) : null
  return (
    <div className="ntc active">
      {/* Process */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Process</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {[
            ['Version', n.cloudflared_version?.version ?? n.version ?? '—'],
            ['Protocol', n.protocol ?? '—'],
            ['Goroutines', fmtN(n.goroutines)],
            ['Threads', fmtN(n.threads)],
            ['GC Count', fmtN(n.gc_count)],
            ['GC Pause', n.gc_pause_ms != null ? `${n.gc_pause_ms.toFixed(1)}ms` : '—'],
            ['Open FDs', fmtN(n.open_fds)],
            ['Max FDs', fmtN(n.max_fds)],
          ].map(([label, val]) => (
            <div key={label}><div className="ml">{label}</div><div className="mv">{val}</div></div>
          ))}
        </div>
      </div>

      {/* Tunnel Runtime */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Tunnel Runtime</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {[
            ['Requests', fmtN(n.total_requests)],
            ['Streams', fmtN(n.active_streams)],
            ['HA Conns', fmtN(n.ha_connections)],
            ['Errors', fmtN(n.request_errors)],
            ['TCP Sessions', fmtN(n.tcp_total_sessions)],
            ['Reg Success', fmtN(n.register_success)],
            ['Config Pushes', fmtN(n.config_pushes)],
            ['Uptime', uptime != null ? `${uptime}m` : '—'],
          ].map(([label, val]) => (
            <div key={label}><div className="ml">{label}</div><div className="mv">{val}</div></div>
          ))}
        </div>
      </div>

      {/* Memory */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Memory</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {[
            ['Resident', fmtBytes(n.resident_memory_bytes)],
            ['Heap Alloc', fmtBytes(n.heap_alloc_bytes)],
            ['Heap InUse', fmtBytes(n.heap_inuse_bytes)],
            ['Virtual', fmtBytes(n.virtual_memory_bytes)],
          ].map(([label, val]) => (
            <div key={label}><div className="ml">{label}</div><div className="mv">{val}</div></div>
          ))}
        </div>
      </div>

      {/* Network I/O */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Network I/O (since start)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          <div><div className="ml">RX</div><div className="mv" style={{ color: 'var(--cyan)' }}>{fmtBytes(n.network_rx_bytes)}</div></div>
          <div><div className="ml">TX</div><div className="mv" style={{ color: 'var(--orange)' }}>{fmtBytes(n.network_tx_bytes)}</div></div>
          <div><div className="ml">CPU Total</div><div className="mv">{n.cpu_seconds_total != null ? `${n.cpu_seconds_total.toFixed(1)}s` : '—'}</div></div>
          <div><div className="ml">Process Start</div><div className="mv">{relTime(n.process_start_time ? new Date(n.process_start_time * 1000).toISOString() : null)}</div></div>
        </div>
      </div>

      {/* Edge PoPs */}
      {n.server_locations && n.server_locations.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Edge PoPs</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {n.server_locations.map((loc, i) => (
              <span key={i} style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', color: 'var(--cyan)', borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 700 }}>
                {loc.loc}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* RPC */}
      {n.rpc_operations && n.rpc_operations.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>RPC Operations</div>
          <div className="rpc-row rpc-header">
            <span>Method</span><span>Count</span><span>Failures</span><span>Avg Latency</span>
          </div>
          {n.rpc_operations.map(op => (
            <div key={op.method} className="rpc-row">
              <span style={{ color: 'var(--text)' }}>{op.method}</span>
              <span>{fmtN(op.count)}</span>
              <span style={{ color: op.failures > 0 ? 'var(--red)' : 'var(--muted)' }}>{fmtN(op.failures)}</span>
              <span>{op.latency_avg != null ? `${(op.latency_avg * 1000).toFixed(0)}ms` : '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function NodeTabs({ nodes }: { nodes: NodeData[] }) {
  const [active, setActive] = useState(0)
  if (!nodes.length) return <div className="no-data">No node data</div>

  return (
    <>
      <div className="ntabs">
        {nodes.map((n, i) => (
          <div key={n.node_ip} className={`ntab${i === active ? ' active' : ''}`} onClick={() => setActive(i)}>
            {nodeName(n.node_ip)} <span style={{ fontSize: 9, opacity: .5 }}>{n.node_ip}</span>
          </div>
        ))}
      </div>
      {nodes.map((n, i) => (
        <div key={n.node_ip} style={{ display: i === active ? 'block' : 'none', padding: '14px 16px' }}>
          <NodeContent n={n} />
        </div>
      ))}
    </>
  )
}
