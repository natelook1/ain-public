interface SparklineProps {
  data: number[]
  color?: string
}

export function Sparkline({ data, color = 'currentColor' }: SparklineProps) {
  if (!data.length) return null
  const max = Math.max(...data) || 1
  return (
    <div className="spark" style={{ color }}>
      {data.map((v, i) => (
        <div
          key={i}
          className="spark-bar"
          style={{ height: `${Math.max(5, (v / max) * 100)}%` }}
          title={String(Math.round(v))}
        />
      ))}
    </div>
  )
}
