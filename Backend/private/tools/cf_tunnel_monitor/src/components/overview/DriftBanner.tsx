import type { NodeData } from '../../types'
import { nodeName } from '../../utils'

export function DriftBanner({ nodes }: { nodes: NodeData[] }) {
  const versioned = nodes
    .map(n => ({ ip: n.node_ip, v: n.cloudflared_version?.version }))
    .filter((x): x is { ip: string; v: string } => !!x.v)

  if (versioned.length < 2) return null
  const versions = [...new Set(versioned.map(x => x.v))]
  if (versions.length <= 1) return null

  const details = versioned.map(x => `${nodeName(x.ip)} v${x.v}`).join(', ')

  return (
    <div style={{ padding: '12px 16px 0' }}>
      <div className="drift-banner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" style={{ flexShrink: 0 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div>
          <strong>Version Drift Detected:</strong> {details}. Cloudflare may be performing a rolling upgrade, or a package manager update is pending.
        </div>
      </div>
    </div>
  )
}
