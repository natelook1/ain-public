interface PanelProps {
  title: string
  badge?: React.ReactNode
  children: React.ReactNode
  style?: React.CSSProperties
}

export function Panel({ title, badge, children, style }: PanelProps) {
  return (
    <div className="panel" style={style}>
      <div className="ph">
        <span className="pt">{title}</span>
        {badge}
      </div>
      {children}
    </div>
  )
}
