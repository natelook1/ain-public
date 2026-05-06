import { tcBadgeClass } from '../../utils'

export function TcBadge({ cls }: { cls: string }) {
  return (
    <span className={`tc-badge ${tcBadgeClass(cls)}`}>{cls}</span>
  )
}
