import React, { useState, useEffect, useRef } from 'react'
import './ActivityChart.css'

function ActivityChart({ heatmapData, dailyStats, topSystems, isMinimized }) {
  const [activeTab, setActiveTab] = useState('hourly')
  const containerRef = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width)
      }
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  if (!heatmapData && !dailyStats && !topSystems) {
    return <div className="activity-chart-wrapper">Loading chart data...</div>
  }

  const chartHeight = isMinimized ? 40 : 100
  const chartWidth = width || 600
  const paddingLeft = 40
  const paddingTop = 5

  const graphHeight = chartHeight - 25
  const heatmapY = chartHeight - 15
  const heatmapHeight = 15

  const renderHourlyChart = () => {
    if (!heatmapData || Object.keys(heatmapData).length === 0) return <div>No hourly data</div>

    const currentHour = new Date().getUTCHours()
    const dataPoints = Array.from({ length: 24 }, (_, i) => {
      const hourData = heatmapData[i] || { avg: 0, today: 0, yesterday: 0 }
      return {
        hour: i,
        today: hourData.today !== undefined ? hourData.today : (hourData.count || 0),
        yesterday: hourData.yesterday || 0,
        avg: hourData.avg || 0
      }
    })

    const maxKills = Math.max(...dataPoints.map(d => Math.max(d.today, d.yesterday, d.avg)), 10)
    const blockWidth = (chartWidth - paddingLeft * 2) / 24
    const getX = (hour) => paddingLeft + (hour * blockWidth) + (blockWidth / 2)
    const getY = (kills) => graphHeight - (kills / maxKills) * (graphHeight - paddingTop)

    const createPath = (key, limitToCurrent = false) => dataPoints
      .filter(p => !limitToCurrent || p.hour <= currentHour)
      .map(p => `${getX(p.hour)},${getY(p[key])}`)
      .join(' L ')

    const todayLine = createPath('today', true)
    const yesterdayLine = createPath('yesterday')
    const avgLine = createPath('avg')
    const areaPath = `M ${getX(0)},${graphHeight} L ${todayLine} L ${getX(Math.min(currentHour, 23))},${graphHeight} Z`

    const yAxisLabels = [
      { value: maxKills, y: getY(maxKills) },
      { value: Math.round(maxKills / 2), y: getY(maxKills / 2) },
      { value: 0, y: getY(0) },
    ]

    return (
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="activity-chart-svg">
        {!isMinimized && yAxisLabels.map(label => (
          <g key={label.value} className="y-axis-group">
            <text x={paddingLeft - 5} y={label.y + 4} className="ac-axis-label ac-y-axis-label">
              {Math.round(label.value)}
            </text>
            <line x1={paddingLeft} y1={label.y} x2={chartWidth - paddingLeft} y2={label.y} className="ac-grid-line" />
          </g>
        ))}
        <defs>
          <linearGradient id="area-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--chart-today)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--chart-today)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#area-gradient)" />
        <path d={`M ${avgLine}`} fill="none" className="ac-line-path ac-avg-line" />
        <path d={`M ${yesterdayLine}`} fill="none" className="ac-line-path ac-yesterday-line" />
        <path d={`M ${todayLine}`} fill="none" className="ac-line-path ac-today-line" />
        {dataPoints[currentHour] && (
          <g>
            <circle cx={getX(currentHour)} cy={getY(dataPoints[currentHour].today)} r="3" fill="var(--chart-today)" stroke="var(--bg-secondary)" strokeWidth="1" />
            <line x1={getX(currentHour)} y1={getY(dataPoints[currentHour].today)} x2={getX(currentHour)} y2={graphHeight} stroke="var(--chart-today)" strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />
          </g>
        )}
        {dataPoints.map((p) => {
          const intensity = Math.min(p.today / (maxKills || 1), 1)
          return (
            <g key={p.hour}>
              <rect
                x={paddingLeft + p.hour * blockWidth}
                y={heatmapY}
                width={blockWidth - 1}
                height={heatmapHeight}
                fill="var(--chart-today)"
                opacity={0.1 + (intensity * 0.9)}
                rx="2"
                className="ac-heatmap-block"
              >
                <title>{`Hour: ${String(p.hour).padStart(2, '0')}:00\nToday: ${p.today}\nYesterday: ${p.yesterday}\nAvg: ${p.avg}`}</title>
              </rect>
              {!isMinimized && (p.hour % 6 === 0) && (
                <text x={paddingLeft + p.hour * blockWidth + blockWidth / 2} y={heatmapY + heatmapHeight + 9} className="ac-axis-label ac-x-axis-label">
                  {String(p.hour).padStart(2, '0')}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    )
  }

  const renderDailyChart = () => {
    const data = (dailyStats && dailyStats.length > 0) ? dailyStats : Array.from({ length: 30 }, (_, i) => ({ label: `${i + 1}`, count: Math.floor(Math.random() * 100) + 10 }))
    const maxVal = Math.max(...data.map(d => d.count), 10)
    const barWidth = (chartWidth - paddingLeft * 2) / data.length
    const labelHeight = isMinimized ? 0 : 20
    const graphBottom = chartHeight - labelHeight
    const availableHeight = graphBottom - paddingTop
    const getY = (val) => graphBottom - (val / maxVal) * availableHeight

    return (
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="activity-chart-svg">
        {data.map((d, i) => {
          const x = paddingLeft + i * barWidth
          const y = getY(d.count)
          const height = graphBottom - y
          return (
            <g key={i}>
              <rect x={x + 1} y={y} width={barWidth - 2} height={height} fill="var(--chart-today)" opacity="0.8">
                <title>{`${d.label}: ${d.count} kills`}</title>
              </rect>
              {!isMinimized && i % 5 === 0 && (
                <text x={x + barWidth / 2} y={chartHeight - 5} className="ac-axis-label ac-x-axis-label">
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    )
  }

  const renderSystemsChart = () => {
    const data = (topSystems && topSystems.length > 0) ? topSystems : [
      { name: 'Jita', count: 1200 }, { name: 'Amarr', count: 950 }, { name: 'Dodixie', count: 800 }, { name: 'Hek', count: 600 }, { name: 'Rens', count: 450 }
    ]
    const maxVal = Math.max(...data.map(s => s.count), 1)

    return (
      <div className={`systems-chart-container ${isMinimized ? 'minimized' : ''}`}>
        {data.map((sys, i) => (
          <div key={i} className="system-bar-row">
            <span className="system-name">{sys.name}</span>
            <div className="system-bar-track">
              <div className="system-bar-fill" style={{ width: `${(sys.count / maxVal) * 100}%` }}></div>
            </div>
            <span className="system-count">{sys.count}</span>
          </div>
        ))}
      </div>
    )
  }
  
  return (
    <div className={`activity-chart-wrapper ${isMinimized ? 'minimized' : ''}`}>
      <div className="chart-tabs-vertical">
        <button className={`chart-tab ${activeTab === 'hourly' ? 'active' : ''}`} onClick={() => setActiveTab('hourly')}>Hourly</button>
        <button className={`chart-tab ${activeTab === 'daily' ? 'active' : ''}`} onClick={() => setActiveTab('daily')}>Daily</button>
        <button className={`chart-tab ${activeTab === 'systems' ? 'active' : ''}`} onClick={() => setActiveTab('systems')}>Systems</button>
      </div>
      <div className="activity-chart-container" ref={containerRef}>
        <div className="chart-content">
          {activeTab === 'hourly' && renderHourlyChart()}
          {activeTab === 'daily' && renderDailyChart()}
          {activeTab === 'systems' && renderSystemsChart()}
        </div>
      </div>
      <div className="chart-legend-vertical">
        {activeTab === 'hourly' && (
          <>
            <span className="legend-item"><span className="dot today"></span>Today</span>
            <span className="legend-item"><span className="dot yesterday"></span>Yesterday</span>
            <span className="legend-item"><span className="dot avg"></span>Avg</span>
          </>
        )}
      </div>
    </div>
  )
}

export default ActivityChart
