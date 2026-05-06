import type { NodeData, QuicConnection } from './types'

export const NODE_NAMES: Record<string, string> = {
  '192.168.30.67': 'PVE1',
  '192.168.30.68': 'PVE2',
  '192.168.30.69': 'PVE3',
}

export const nodeName = (ip: string) => NODE_NAMES[ip] ?? ip

export function fmtN(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(Math.round(n))
}

export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' KB'
  return n + ' B'
}

export function fmtMbps(bytesPerSec: number): string {
  return (bytesPerSec * 8 / 1e6).toFixed(2)
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

export function avgRtt(node: NodeData): number | null {
  const conns = node.quic_connections ?? []
  if (!conns.length) return null
  const valid = conns.filter((c: QuicConnection) => c.smoothed_rtt != null)
  if (!valid.length) return null
  return Math.round(valid.reduce((s: number, c: QuicConnection) => s + (c.smoothed_rtt ?? 0), 0) / valid.length)
}

export function codeDesc(code: number | string): string {
  const map: Record<number, string> = {
    200: 'OK', 201: 'Created', 204: 'No Content', 206: 'Partial Content',
    301: 'Moved Permanently', 302: 'Found', 303: 'See Other', 304: 'Not Modified',
    307: 'Temp Redirect', 308: 'Perm Redirect',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    405: 'Method Not Allowed', 406: 'Not Acceptable', 409: 'Conflict',
    422: 'Unprocessable Entity', 429: 'Too Many Requests',
    500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
    504: 'Gateway Timeout', 506: 'Variant Also Negotiates',
  }
  return map[Number(code)] ?? ''
}

export function codeClass(code: number | string): string {
  const s = String(code)
  if (s.startsWith('2') || s.startsWith('3')) return 'c2'
  if (s.startsWith('4')) return 'c4'
  return 'c5'
}

export function tcBadgeClass(cls: string): string {
  return 'tc-' + cls.replace(/-/g, '')
}

export function severityClass(sev: string): string {
  if (sev === 'high') return 'th-severity-high'
  if (sev === 'medium') return 'th-severity-medium'
  return 'th-severity-low'
}
