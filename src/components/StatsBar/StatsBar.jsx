import { useState, useEffect } from 'react'
import { useMapMode } from '../../context/MapModeContext'
import { fetchStats, fetchPilotCount } from '../../api/stats'
import './StatsBar.css'
import ActivityChart from './ActivityChart'

function StatsBar({ isMinimized, onToggleMinimize }) {
  const { mapMode, isMobile } = useMapMode()
  const [stats, setStats] = useState(null)
  const [pilotCount, setPilotCount] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    async function loadStats() {
      setLoading(true)
      setError(null)
      try {
        const [statsData, pilotCountData] = await Promise.all([
          fetchStats(),
          fetchPilotCount()
        ])
        setStats(statsData)
        setPilotCount(pilotCountData)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  const formatISK = (n) => {
    if (!n) return '0 ISK'
    if (n >= 1e12) return <>{(n / 1e12).toFixed(2)}<span className="unit-suffix">T</span></>
    if (n >= 1e9) return <>{(n / 1e9).toFixed(2)}<span className="unit-suffix">B</span></>
    if (n >= 1e6) return <>{(n / 1e6).toFixed(2)}<span className="unit-suffix">M</span></>
    return <>{Math.floor(n).toLocaleString()} <span className="unit-suffix">ISK</span></>
  }

  const getTrendIcon = (trend) => {
    if (!trend || trend === 'stable') return <span className="trend-neutral">-</span>
    if (trend === 'rising' || trend === 'heating') return <span className="trend-up">▲</span>
    if (trend === 'falling' || trend === 'cooling') return <span className="trend-down">▼</span>
    return <span className="trend-neutral">-</span>
  }

  const handleToggleMinimize = () => {
    if (onToggleMinimize) {
      onToggleMinimize()
    }
  }

  if (loading && !stats) {
    return <div className="stats-bar-container">Loading stats...</div>
  }

  if (error) {
    return <div className="stats-bar-container">Error: {error}</div>
  }

  const loadingStyle = {
    opacity: loading ? 0.6 : 1,
    transition: 'opacity 0.2s ease-in-out',
    pointerEvents: loading ? 'none' : 'auto'
  }

  return (
    <div className={`stats-bar-container ${isMinimized ? 'minimized' : ''} ${mapMode ? 'map-mode' : ''}`} style={loadingStyle}>
      <button onClick={handleToggleMinimize} className="minimize-button">
        {isMinimized ? '▲' : '▼'}
      </button>
      {!isMinimized && (
        <div className="stats-bar">
          <div className="stat-item" title="Live pilots online in New Eden">
            <span className="stat-label">Pilots:</span>
            <span className="stat-value">{pilotCount ? pilotCount.toLocaleString() : '-'}</span>
          </div>
          <div className="stat-item" title="Total kills in the last 24 hours">
            <span className="stat-label">Kills (24h):</span>
            <span className="stat-value">{stats && stats.stats_24h ? stats.stats_24h.kills.toLocaleString() : '-'}</span>
            {stats && stats.trends && getTrendIcon(stats.trends.kills)}
          </div>
          <div className="stat-item" title="Total value of kills in the last 24 hours">
            <span className="stat-label">Value (24h):</span>
            <span className="stat-value">{stats && stats.stats_24h ? formatISK(stats.stats_24h.isk) : '-'}</span>
            {stats && stats.trends && getTrendIcon(stats.trends.isk)}
          </div>
          <div className="stat-item" title="Average value per kill in the last 24 hours">
            <span className="stat-label">Avg Value (24h):</span>
            <span className="stat-value">{stats && stats.stats_24h && stats.stats_24h.kills > 0 ? formatISK(stats.stats_24h.isk / stats.stats_24h.kills) : '-'}</span>
            {stats && stats.trends && getTrendIcon(stats.trends.avgValue)}
          </div>
          <div className="stat-item" title="Total kills in the last 30 days">
            <span className="stat-label">Kills (30d):</span>
            <span className="stat-value">{stats ? stats.total_count.toLocaleString() : '-'}</span>
            {stats && stats.trends && getTrendIcon(stats.trends.total30d)}
          </div>
          <div className="stat-item" title="Average daily kills over the last 30 days">
            <span className="stat-label">Avg Kills (30d):</span>
            <span className="stat-value">{stats ? Math.round(stats.total_count / 30).toLocaleString() : '-'}</span>
          </div>
        </div>
      )}
      {stats && (
        <div className={`activity-chart-container`}>
          <ActivityChart 
            isMinimized={isMinimized}
            heatmapData={stats.activity_heatmap} 
            dailyStats={stats.daily_stats}
            topSystems={stats.top_systems}
          />
        </div>
      )}
    </div>
  )
}

export default StatsBar
