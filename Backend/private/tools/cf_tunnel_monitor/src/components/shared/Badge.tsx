interface BadgeProps {
  children: React.ReactNode
  color?: 'green' | 'red' | 'orange' | 'cyan' | 'purple' | 'yellow' | 'muted'
  id?: string
}

export function Badge({ children, color, id }: BadgeProps) {
  return (
    <span id={id} className={`badge${color ? ' ' + color : ''}`}>
      {children}
    </span>
  )
}
