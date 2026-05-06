import { relTime, codeDesc } from '../../utils'
import type { ErrorAnalyticsEntry } from '../../types'

interface GroupedEntry {
  ip: string
  total: number
  latest: Date | null
  items: {
    key: string
    status: number
    host: string
    path: string
    count: number
    latest: Date | null
    buckets: Map<string, number>
  }[]
}

export function EdgeErrors({ errors }: { errors: ErrorAnalyticsEntry[] }) {
  if (!errors.length) {
    return <div className="no-data" style={{ color: 'var(--dim)' }}>No recent 4xx/5xx edge errors found in the past hour.</div>
  }

  const grouped: Record<string, GroupedEntry> = {}
  errors.forEach(err => {
    const dim = err.dimensions
    const ip = dim.clientIP || 'Unknown IP'
    if (!grouped[ip]) grouped[ip] = { ip, total: 0, latest: null, items: [] }
    grouped[ip].total += err.count

    const dateObj = dim.datetimeFiveMinutes ? new Date(dim.datetimeFiveMinutes) : null
    if (dateObj && (!grouped[ip].latest || dateObj > grouped[ip].latest!)) grouped[ip].latest = dateObj

    const key = `${dim.edgeResponseStatus}-${dim.clientRequestHTTPHost}-${dim.clientRequestPath}`
    let existing = grouped[ip].items.find(i => i.key === key)
    if (existing) {
      existing.count += err.count
      if (dateObj && (!existing.latest || dateObj > existing.latest)) existing.latest = dateObj
      existing.buckets.set(dim.datetimeFiveMinutes, (existing.buckets.get(dim.datetimeFiveMinutes) ?? 0) + err.count)
    } else {
      const buckets = new Map<string, number>()
      if (dim.datetimeFiveMinutes) buckets.set(dim.datetimeFiveMinutes, err.count)
      grouped[ip].items.push({ key, status: dim.edgeResponseStatus, host: dim.clientRequestHTTPHost, path: dim.clientRequestPath, count: err.count, latest: dateObj, buckets })
    }
  })

  const sorted = Object.values(grouped).sort((a, b) => b.total - a.total).slice(0, 10)

  return (
    <div>
      {sorted.map(g => (
        <div key={g.ip} style={{ borderBottom: '1px solid var(--border)', padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className="err-ip">{g.ip}</span>
            <span style={{ fontSize: 9, color: 'var(--dim)' }}>last seen {g.latest ? relTime(g.latest.toISOString()) : '—'} · {g.total} total</span>
          </div>
          {g.items.sort((a, b) => b.count - a.count).slice(0, 3).map((item) => {
            const is4 = item.status >= 400 && item.status < 500
            const bucketEntries = [...item.buckets.entries()].sort(([a], [b]) => a.localeCompare(b))
            const maxB = Math.max(...bucketEntries.map(([, v]) => v), 1)
            return (
              <div key={item.key} className="err-item">
                <div>
                  <span className={`err-code ${is4 ? 'c4' : 'c5'}`}>{item.status}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 8 }}>{codeDesc(item.status)}</span>
                  <div className="err-path">{item.host}{item.path}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>×{item.count}</span>
                  {bucketEntries.length > 1 && (
                    <div className="err-buckets">
                      {bucketEntries.map(([ts, v]) => (
                        <div key={ts} className="err-bucket" style={{ height: `${(v / maxB) * 20}px`, background: is4 ? 'var(--yellow)' : 'var(--red)' }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
