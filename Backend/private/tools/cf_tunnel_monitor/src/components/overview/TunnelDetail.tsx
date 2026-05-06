import { fmtN, relTime, nodeName, codeClass } from '../../utils'
import { Badge } from '../shared/Badge'
import type { Tunnel } from '../../types'

export function TunnelDetail({ tunnels }: { tunnels: Tunnel[] }) {
  if (!tunnels.length) return <div className="no-data">No tunnels</div>

  return (
    <>
      {tunnels.map((t, ti) => (
        <div key={t.tunnel_id}>
          {ti > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '0 16px' }} />}
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 700, color: '#fff' }}>{t.tunnel_name || 'Unnamed'}</div>
                <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 3 }}>ID: {t.tunnel_id || '—'}</div>
              </div>
              <div className={`spill ${t.status}`}><div className="sdot" />{t.status || 'unknown'}</div>
            </div>

            <div className="mg">
              <div className="mc"><div className="ml">Connectors</div><div className="mv big orange">{t.connector_count ?? t.connectors.length}</div></div>
              <div className="mc"><div className="ml">Active Since</div><div className="mv">{relTime(t.conns_active_at)}</div></div>
              <div className="mc"><div className="ml">Created</div><div className="mv">{relTime(t.created_at)}</div></div>
              <div className="mc"><div className="ml">Last Inactive</div><div className="mv">{t.conns_inactive_at ? relTime(t.conns_inactive_at) : 'Never'}</div></div>
            </div>

            {t.connectors.map((c, i) => {
              const m = c.metrics
              const srCls = m?.success_rate != null ? (m.success_rate >= 99 ? 'green' : m.success_rate >= 90 ? '' : 'red') : ''
              return (
                <div key={c.id || i} className="cc">
                  <div className="ch">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="cnum">#{i + 1}</span>
                      <span className="cid">{c.id ? c.id.slice(0, 8) + '…' : `conn-${i}`}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {m?.node_ip && <span style={{ fontSize: 10, color: 'var(--dim)' }}>{nodeName(m.node_ip)}</span>}
                      {c.is_pending_reconnect && <Badge color="orange">Reconnecting</Badge>}
                    </div>
                  </div>
                  <div className="cbody">
                    <div className="cstats">
                      <div><div className="csl">Requests</div><div className="csv">{m?.total_requests != null ? fmtN(m.total_requests) : '—'}</div></div>
                      <div><div className="csl">Streams</div><div className="csv cyan">{m?.active_streams ?? '—'}</div></div>
                      <div><div className="csl">Success</div><div className={`csv ${srCls}`}>{m?.success_rate != null ? `${m.success_rate}%` : '—'}</div></div>
                    </div>
                    {m?.load_pct != null && (
                      <div className="bw">
                        <div className="bt"><div className="bf" style={{ width: `${m.load_pct}%`, background: 'linear-gradient(90deg,var(--orange),#fbbf24)' }} /></div>
                        <div className="bl">CF traffic share: {m.load_pct}%</div>
                      </div>
                    )}
                    {m?.response_codes && (
                      <div className="rcs">
                        {Object.entries(m.response_codes).filter(([, v]) => v > 0).sort(([a], [b]) => +a - +b).map(([code, cnt]) => (
                          <span key={code} className={`rc ${codeClass(code)}`}>{code}: {fmtN(cnt)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="cfoot">
                    {c.arch && <span>{c.arch}</span>}
                    {c.client_version && <span>v{c.client_version}</span>}
                    <span>Opened {relTime(c.opened_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
