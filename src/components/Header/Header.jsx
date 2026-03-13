import React, { useState, useEffect } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { useMapMode } from '../../context/MapModeContext'
import CustomThemeModal from './CustomThemeModal'
import { API_ENDPOINTS } from '../../api/config'
import './Header.css'

function Header() {
  const { theme, setTheme, customTheme, applyCustomTheme, removeCustomTheme } = useTheme()
  const { mapMode, toggleMapMode } = useMapMode()
  const [isThemeOpen, setIsThemeOpen] = useState(false)
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [stats, setStats] = useState({ kpm: 0, trend: '→' })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.R2Z2_STATS)
        if (response.ok) {
          const data = await response.json()
          const currentKpm = parseFloat(data.summary?.current_kpm || 0)
          
          // Simple trend logic based on recent logs if available
          let previousKpm = currentKpm
          const logs = data.recent_logs || []
          if (logs.length > 10) {
             const oldLogs = logs.slice(logs.length - 10)
             const sumOld = oldLogs.reduce((acc, l) => acc + (parseFloat(l.kpm) || 0), 0)
             previousKpm = sumOld / oldLogs.length
          }
          const trend = currentKpm > previousKpm ? '↗' : (currentKpm < previousKpm ? '↘' : '→')
          
          setStats({ kpm: currentKpm, trend })
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  const factionImg = (id, name) => <img src={`https://images.evetech.net/corporations/${id}/logo?size=32`} alt={name} />

  const themes = [
    { id: 'dark', label: 'Dark', icon: '🌙' },
    { id: 'light', label: 'Light', icon: '☀️' },
    { id: 'amarr', label: 'Amarr', icon: factionImg(1000125, 'Amarr') },
    { id: 'caldari', label: 'Caldari', icon: factionImg(1000035, 'Caldari') },
    { id: 'gallente', label: 'Gallente', icon: factionImg(1000120, 'Gallente') },
    { id: 'minmatar', label: 'Minmatar', icon: factionImg(1000051, 'Minmatar') },
    { id: 'triglavian', label: 'Triglavian', icon: factionImg(500026, 'Triglavian') },
    { id: 'ore', label: 'ORE', icon: factionImg(1000126, 'ORE') },
    { id: 'soe', label: 'SOE', icon: factionImg(1000130, 'SOE') },
    { id: 'edencom', label: 'EDENCOM', icon: factionImg(500027, 'EDENCOM') },
  ]

  // Add custom theme entry if one is saved
  if (customTheme) {
    themes.push({
      id: 'custom',
      label: customTheme.name,
      icon: <img src={customTheme.logoUrl} alt={customTheme.name} />,
    })
  }

  const currentTheme = themes.find(t => t.id === theme)
  const currentThemeIcon = currentTheme?.icon || '🎨'

  const handleCustomApply = (themeData) => {
    applyCustomTheme(themeData)
    setShowCustomModal(false)
    setIsThemeOpen(false)
  }

  return (
    <header className={`app-header ${theme}`}>
      <div className="header-left">
        <a href="https://ain-zkb.looknet.ca/" target="_blank" rel="noopener noreferrer" className="logo-link" title="System Status">
          <div className="logo-container">
            {/* Swapped blob5.gif for logo.mp4 with background video properties */}
            <video
              autoPlay
              loop
              muted
              playsInline
              className="app-logo"
              poster="https://images.evetech.net/alliances/99013284/logo?size=128"
            >
              <source src="logo.mp4" type="video/mp4" />
              {/* Fallback alliance logo if video fails or is unsupported */}
              <img
                src="https://images.evetech.net/alliances/99013284/logo?size=128"
                alt="AIN Logo"
              />
            </video>
          </div>
        </a>
        <h1 className="app-title">
          <span className="title-desktop">Alfred's Intelligence Network</span>
          <span className="title-mobile">AIN</span>
        </h1>
      </div>

      <div className="header-right">
        <div className="kpm-display" title="Live Kills Per Minute">
          <span className="kpm-value">{stats.kpm.toFixed(1)}</span>
          <span className="kpm-label">KPM</span>
          <span className={`kpm-trend ${stats.trend === '↗' ? 'up' : stats.trend === '↘' ? 'down' : ''}`}>{stats.trend}</span>
        </div>

        <a 
          href="https://discord.gg/p3xZUuwNGU" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="icon-btn discord-btn"
          title="Join Discord"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
        </a>

        <div
          className="theme-dropdown-container"
          onMouseEnter={() => setIsThemeOpen(true)}
          onMouseLeave={() => setIsThemeOpen(false)}
        >
          <button className="icon-btn theme-toggle">
            {currentThemeIcon}
          </button>

          {isThemeOpen && (
            <div className="theme-dropdown" style={{ zIndex: 100001 }}>
              {themes.map(t => (
                <div key={t.id} className="theme-option-row">
                  <button
                    className={`theme-option ${theme === t.id ? 'active' : ''}`}
                    onClick={() => setTheme(t.id)}
                  >
                    <span className="theme-icon">{t.icon}</span>
                    <span className="theme-label">{t.label}</span>
                  </button>
                  {t.id === 'custom' && (
                    <button
                      className="theme-remove"
                      onClick={(e) => { e.stopPropagation(); removeCustomTheme() }}
                      title="Remove custom theme"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
              <div className="theme-divider" />
              <button
                className="theme-option"
                onClick={() => { setShowCustomModal(true); setIsThemeOpen(false) }}
              >
                <span className="theme-icon">✨</span>
                <span className="theme-label">Custom...</span>
              </button>
            </div>
          )}
        </div>

        <button
          className="icon-btn map-toggle-btn"
          onClick={toggleMapMode}
          title={mapMode ? 'Killfeed Mode' : 'Map Mode'}
        >
          {mapMode ? '📰' : '🗺️'}
        </button>
      </div>

      {showCustomModal && (
        <CustomThemeModal
          onApply={handleCustomApply}
          onClose={() => setShowCustomModal(false)}
        />
      )}
    </header>
  )
}

export default Header
