import { useState, useEffect, useRef } from 'react'
import { useTunnelData, LIVE_INTERVAL, OVERVIEW_INTERVAL } from './hooks/useTunnelData'
import { useLiveHistory } from './hooks/useLiveHistory'
import { OverviewMode } from './components/overview/OverviewMode'
import { LiveMode } from './components/live/LiveMode'
import { ThreatMode } from './components/threat/ThreatMode'
import type { AppMode } from './types'
import type { LiveDeltas } from './hooks/useLiveHistory'

const SPARK_MAX = 20

export default function App() {
  const [mode, setMode] = useState<AppMode>('overview')
  const interval = mode === 'live' ? LIVE_INTERVAL : OVERVIEW_INTERVAL
  const { data, loading, error, lastFetch, fetchNow } = useTunnelData(interval)
  const { push } = useLiveHistory()

  // Rolling sparkline history for overview strip
  const [reqRates, setReqRates] = useState<number[]>([])
  const [streamRates, setStreamRates] = useState<number[]>([])
  const [errRates, setErrRates] = useState<number[]>([])
  const prevReqsRef = useRef<number | null>(null)
  const prevErrsRef = useRef<number | null>(null)

  // Live deltas
  const [deltas, setDeltas] = useState<LiveDeltas | null>(null)

  useEffect(() => {
    if (!data) return
    const d = push(data)
    setDeltas(d)

    // Accumulate strip sparklines
    setReqRates(prev => {
      const next = [...prev, data.summary.total_requests]
      return next.slice(-SPARK_MAX)
    })
    setStreamRates(prev => {
      const next = [...prev, data.summary.total_active_streams]
      return next.slice(-SPARK_MAX)
    })
    // Error rate = delta from previous
    if (prevErrsRef.current != null) {
      const delta = Math.max(0, data.summary.total_proxy_errors - prevErrsRef.current)
      setErrRates(prev => [...prev, delta].slice(-SPARK_MAX))
    }
    prevErrsRef.current = data.summary.total_proxy_errors
    prevReqsRef.current = data.summary.total_requests
  }, [data, push])

  // Body class for CSS mode switching
  useEffect(() => {
    document.body.className = mode === 'live' ? 'live-mode' : mode === 'threat' ? 'threat-mode' : ''
  }, [mode])

  const ModeBtn = ({ m, label, activeClass }: { m: AppMode; label: string; activeClass: string }) => (
    <div
      className={`mtab${mode === m ? ' ' + activeClass : ''}`}
      onClick={() => setMode(m)}
    >
      {label}
    </div>
  )

  const dotColor = mode === 'live' ? 'var(--green)' : mode === 'threat' ? 'var(--orange)' : 'var(--green)'
  const dotLabel = mode === 'live' ? 'LIVE · 10s' : mode === 'threat' ? 'THREAT' : 'LIVE'

  return (
    <>
      <header>
        <div className="brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h1>LOOKNET<span>.CA</span></h1>
            <p>Cloudflare Tunnel Monitor</p>
          </div>
        </div>

        <div className="hdr-right">
          <div className="mode-toggle">
            <ModeBtn m="overview" label="⊞ Overview" activeClass="active-overview" />
            <ModeBtn m="live"     label="⬤ Live"     activeClass="active-live" />
            <ModeBtn m="threat"   label="⚑ Threat Intel" activeClass="active-threat" />
          </div>
          <div className="live-pill">
            <div className="live-dot" style={{ background: dotColor, boxShadow: `0 0 7px ${dotColor}` }} />
            <span>{dotLabel}</span>
          </div>
          <span style={{ fontSize: 9, color: 'var(--dim)' }}>
            {lastFetch ? lastFetch.toLocaleTimeString() : '—'}
          </span>
          <button className="rbtn" onClick={fetchNow}>↻ Refresh</button>
        </div>
      </header>

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', fontSize: 11 }}>
          Fetching tunnel status…
        </div>
      )}

      {error && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--red)', fontSize: 11 }}>
          {error} — n8n webhook may not be running
        </div>
      )}

      {data && mode === 'overview' && (
        <OverviewMode data={data} reqRates={reqRates} streamRates={streamRates} errRates={errRates} />
      )}

      {data && mode === 'live' && (
        <LiveMode data={data} deltas={deltas} />
      )}

      {data && mode === 'threat' && (
        <ThreatMode data={data} />
      )}
    </>
  )
}
