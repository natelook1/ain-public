import { fmtN, codeDesc } from '../../utils'
import type { NodeData } from '../../types'

export function ResponseCodes({ nodes }: { nodes: NodeData[] }) {
  const agg: Record<string, number> = {}
  nodes.forEach(n => Object.entries(n.response_codes ?? {}).forEach(([k, v]) => { agg[k] = (agg[k] ?? 0) + v }))

  const sorted = Object.entries(agg).filter(([, v]) => v > 0).sort(([a], [b]) => +a - +b)
  const total = sorted.reduce((s, [, v]) => s + v, 0)
  const ok = sorted.filter(([k]) => k.startsWith('2') || k.startsWith('3')).reduce((s, [, v]) => s + v, 0)
  const sr = total > 0 ? ((ok / total) * 100).toFixed(2) : null

  if (!sorted.length) return <div className="no-data">No response code data</div>

  return (
    <>
      {sr != null && (
        <div style={{ padding: '10px 16px 0', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 700, color: +sr >= 99 ? 'var(--green)' : +sr >= 90 ? 'var(--yellow)' : 'var(--red)' }}>
          {sr}% <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'inherit', fontWeight: 400 }}>success</span>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table className="rct">
          <thead>
            <tr><th>Code</th><th>Meaning</th><th>Count</th><th>Distribution</th><th>%</th></tr>
          </thead>
          <tbody>
            {sorted.map(([code, cnt]) => {
              const pct = total > 0 ? (cnt / total) * 100 : 0
              const isGood = code.startsWith('2') || code.startsWith('3')
              const is4xx = code.startsWith('4')
              const barColor = isGood ? 'var(--green)' : is4xx ? 'var(--yellow)' : 'var(--red)'
              return (
                <tr key={code}>
                  <td style={{ fontWeight: 700, color: isGood ? 'var(--green)' : is4xx ? 'var(--yellow)' : 'var(--red)' }}>{code}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 10 }}>{codeDesc(code)}</td>
                  <td style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 700 }}>{fmtN(cnt)}</td>
                  <td style={{ width: 120 }}>
                    <div className="rc-bar-wrap"><div className="rc-bar" style={{ width: `${pct}%`, background: barColor }} /></div>
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 10 }}>{pct.toFixed(0)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
