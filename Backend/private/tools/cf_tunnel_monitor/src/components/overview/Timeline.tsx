import { relTime } from '../../utils'
import type { Tunnel } from '../../types'

interface TlEvent { label: string; sub: string; color: string; time: string | null }

export function Timeline({ tunnels }: { tunnels: Tunnel[] }) {
  const events: TlEvent[] = []
  tunnels.forEach(t => {
    if (t.created_at) events.push({ label: `${t.tunnel_name} created`, sub: 'Tunnel provisioned in CF dashboard', color: 'var(--cyan)', time: t.created_at })
    if (t.conns_active_at) events.push({ label: `${t.tunnel_name} became active`, sub: 'First connector established', color: 'var(--green)', time: t.conns_active_at })
    t.connectors.forEach((c, i) => {
      if (c.opened_at) events.push({ label: `Connector #${i + 1} opened`, sub: c.colo_name ? `via ${c.colo_name}` : `${c.arch ?? ''} ${c.client_version ? 'v' + c.client_version : ''}`.trim(), color: 'var(--orange)', time: c.opened_at })
    })
  })
  events.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))

  if (!events.length) return <div className="no-data">No events</div>

  return (
    <div style={{ padding: '10px 16px' }}>
      {events.map((e, i) => (
        <div key={i} className="tl-item">
          <div className="tl-dot" style={{ background: e.color }} />
          <div className="tl-line">
            <div className="tl-label">{e.label}</div>
            <div className="tl-sub">{e.sub} · {relTime(e.time)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
