import { useState, useEffect, useRef, useCallback } from 'react'
import type { TunnelData } from '../types'

const WEBHOOK = 'https://api-ain.looknet.ca/webhook/cloudflare-tunnel-status'

export const LIVE_INTERVAL = 10_000
export const OVERVIEW_INTERVAL = 60_000

interface UseTunnelDataResult {
  data: TunnelData | null
  loading: boolean
  error: string | null
  lastFetch: Date | null
  fetchNow: () => void
}

export function useTunnelData(interval: number): UseTunnelDataResult {
  const [data, setData] = useState<TunnelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchNow = useCallback(async () => {
    try {
      const res = await fetch(WEBHOOK)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      // n8n sometimes wraps in array
      const d: TunnelData = Array.isArray(json) ? json[0] : json
      setData(d)
      setError(null)
      setLastFetch(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNow()
    timerRef.current = setInterval(fetchNow, interval)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchNow, interval])

  return { data, loading, error, lastFetch, fetchNow }
}
