import { useEffect } from 'react'
import { useAlliance } from '../../context/AllianceContext'
import './ContextMenu.css'

const ALLIANCE_COLORS = [
  '#ef4444', '#06b6d4', '#f59e0b', '#a855f7',
  '#f97316', '#3b82f6', '#84cc16', '#ec4899',
  '#f87171', '#14b8a6', '#eab308', '#d946ef',
  '#0ea5e9', '#10b981', '#8b5cf6', '#fb7185'
]

function ContextMenu({ x, y, alliance, onClose, onLurkerMode, onRemove, onChangeColor, removeLabel }) {
  const { lurkerTarget } = useAlliance()

  useEffect(() => {
    const handleClick = () => onClose()
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [onClose])

  const isLurkerMode = lurkerTarget === alliance.id

  return (
    <div
      className="context-menu"
      style={{ left: `${x}px`, top: `${y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="context-menu-item-group">
        {onLurkerMode && (
          <div className="cm-lurker-wrap">
            <button
              className="context-menu-item"
              onClick={() => {
                onLurkerMode(alliance.id)
                onClose()
              }}
            >
              {isLurkerMode ? '👁️ Exit Lurker Mode' : '👁️ Enter Lurker Mode'}
            </button>
            <div className="cm-lurker-tooltip">
              {isLurkerMode ? (
                <p className="cm-lt-desc">Stop watching and return to normal feed filtering.</p>
              ) : (
                <>
                  <div className="cm-lt-title">👁️ Lurker Mode</div>
                  <p className="cm-lt-desc">Watch <strong>{alliance.name}</strong> across the entire global kill feed — color-coded by event type.</p>
                  <ul className="cm-lt-list">
                    <li><span className="cm-lt-kill">Kill</span> — they destroyed a ship</li>
                    <li><span className="cm-lt-loss">Loss</span> — they lost a ship</li>
                    <li><span className="cm-lt-assist">Assist</span> — they helped in a kill</li>
                    <li><span className="cm-lt-other">Other</span> — unrelated, shown normally</li>
                  </ul>
                  <p className="cm-lt-note">Their kills appear even when other filters are active.</p>
                </>
              )}
            </div>
          </div>
        )}
        <button
          className="context-menu-item"
          onClick={() => {
            onRemove(alliance.id)
            onClose()
          }}
        >
          {removeLabel || 'Remove Alliance'}
        </button>
      </div>
      <div className="color-palette">
        {ALLIANCE_COLORS.map(color => (
          <div
            key={color}
            className="color-swatch"
            style={{ backgroundColor: color }}
            onClick={() => {
              onChangeColor(alliance.id, color)
              onClose()
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default ContextMenu
