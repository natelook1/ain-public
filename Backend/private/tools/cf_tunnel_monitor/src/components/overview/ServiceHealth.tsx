import type { HistoryPoint, TunnelData } from '../../types'
import { fmtN } from '../../utils'

function MiniSpark({ vals, color }: { vals: number[]; color: string }) {
  if (!vals.length) return null
  const max = Math.max(...vals) || 1
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 28, flex: 1 }}>
      {vals.map((v, i) => (
        <div key={i} style={{
          flex: 1, borderRadius: '1px 1px 0 0',
          background: color, opacity: 0.75,
          height: `${Math.max(5, Math.round((v / max) * 100))}%`
        }} title={String(v)} />
      ))}
    </div>
  )
}

function StatRow({ label, current, vals, color, warn }: {
  label: string; current: number; vals: number[]; color: string; warn?: boolean
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 60px 1fr', alignItems: 'center', gap: 10, padding: '7px 16px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 10, color: warn && current > 0 ? color : 'var(--muted)' }}>{label}</span>
      <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 700, color: current > 0 ? color : 'var(--dim)', textAlign: 'right' }}>
        {fmtN(current)}
      </span>
      <MiniSpark vals={vals} color={color} />
    </div>
  )
}

interface Props {
  history: HistoryPoint[]
  data: TunnelData
}

export function ServiceHealth({ history, data }: Props) {
  const SPARK = 30

  // 503s — queue exhaustion indicator
  const vals503 = history.map(h => h.err503 ?? (h.response_codes?.['503'] ?? 0)).slice(-SPARK)
  const cur503 = vals503[vals503.length - 1] ?? 0

  // 504s — upstream timeout indicator
  const vals504 = history.map(h => h.err504 ?? (h.response_codes?.['504'] ?? 0)).slice(-SPARK)
  const cur504 = vals504[vals504.length - 1] ?? 0

  // Authentik errors from history
  const valsAuthentik = history.map(h => h.authentik_errors ?? 0).slice(-SPARK)
  const curAuthentik = valsAuthentik[valsAuthentik.length - 1] ?? 0

  // Current-hour Authentik errors from error_analytics for detail
  const authentikErrors = (data.error_analytics ?? [])
    .filter(e => (e.dimensions?.clientRequestHTTPHost ?? '').includes('authentik'))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const totalAuthentik = valsAuthentik.reduce((s, v) => s + v, 0)

  const hasIssues = cur503 > 0 || cur504 > 100 || curAuthentik > 0

  return (
    <>
      <div style={{ padding: '8px 16px 0' }}>
        {hasIssues ? (
          <div style={{ fontSize: 10, color: 'var(--yellow)', background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
            ⚠ Service degradation detected — check 503/504 trends
          </div>
        ) : (
          <div style={{ fontSize: 10, color: 'var(--green)', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
            ✓ All services nominal
          </div>
        )}
      </div>

      <StatRow label="503 Service Unavail" current={cur503} vals={vals503} color="var(--red)" warn />
      <StatRow label="504 Gateway Timeout" current={cur504} vals={vals504} color="var(--orange)" warn />
      <StatRow label="Authentik errors" current={curAuthentik} vals={valsAuthentik} color="var(--yellow)" warn />

      {authentikErrors.length > 0 && (
        <div style={{ padding: '8px 16px' }}>
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
            Authentik · Current Hour
          </div>
          {authentikErrors.map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 10 }}>
              <span style={{ color: 'var(--dim)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.dimensions.clientRequestPath}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--yellow)' }}>
                  {e.dimensions.edgeResponseStatus}
                </span>
                <span style={{ color: 'var(--orange)', fontWeight: 700 }}>×{e.count}</span>
              </div>
            </div>
          ))}
          {totalAuthentik > 0 && (
            <div style={{ fontSize: 9, color: 'var(--dim)', marginTop: 6 }}>
              {fmtN(totalAuthentik)} authentik errors in history window
            </div>
          )}
        </div>
      )}

      {history.length < 2 && (
        <div className="no-data">Accumulating history — trends appear after 2+ cycles</div>
      )}
    </>
  )
}
