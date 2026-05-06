import { useRef, useCallback } from 'react'
import type { TunnelData } from '../types'

const SPARK_MAX = 20

export interface LiveHistory {
  rx: number[]
  tx: number[]
  perr: number[]
  reqs: number[]
  errs: number[]
}

export interface LiveDeltas {
  rps: number        // requests per minute
  errRate: number    // errors per minute
  rxBps: number      // bytes/sec
  txBps: number      // bytes/sec
  successRate: number | null
  history: LiveHistory
}

export function useLiveHistory() {
  const histRef = useRef<LiveHistory>({ rx: [], tx: [], perr: [], reqs: [], errs: [] })
  const lastDataRef = useRef<TunnelData | null>(null)
  const lastTimeRef = useRef<number>(0)

  const push = useCallback((data: TunnelData): LiveDeltas => {
    const now = Date.now()
    const prev = lastDataRef.current
    const prevTime = lastTimeRef.current
    const elapsedSec = prevTime ? (now - prevTime) / 1000 : 1

    lastDataRef.current = data
    lastTimeRef.current = now

    const h = histRef.current

    // Cumulative → per-second deltas
    const rxDelta = prev ? Math.max(0, (data.summary.total_rx_bytes ?? 0) - (prev.summary.total_rx_bytes ?? 0)) : 0
    const txDelta = prev ? Math.max(0, (data.summary.total_tx_bytes ?? 0) - (prev.summary.total_tx_bytes ?? 0)) : 0
    const perrDelta = prev ? Math.max(0, (data.summary.total_proxy_errors ?? 0) - (prev.summary.total_proxy_errors ?? 0)) : 0
    const reqDelta = prev ? Math.max(0, (data.summary.total_requests ?? 0) - (prev.summary.total_requests ?? 0)) : 0

    const rxBps = rxDelta / elapsedSec
    const txBps = txDelta / elapsedSec
    const rps = (reqDelta / elapsedSec) * 60
    const errRate = (perrDelta / elapsedSec) * 60

    // Rolling history for sparklines
    const push1 = (arr: number[], val: number) => {
      arr.push(val)
      if (arr.length > SPARK_MAX) arr.shift()
    }
    push1(h.rx, rxBps)
    push1(h.tx, txBps)
    push1(h.perr, perrDelta)
    push1(h.reqs, reqDelta)
    push1(h.errs, perrDelta)

    // Success rate from history diff
    let successRate: number | null = null
    if (data.history && data.history.length >= 2) {
      const latest = data.history[data.history.length - 1]
      const second = data.history[data.history.length - 2]
      const rcDiff: Record<string, number> = {}
      for (const [k, v] of Object.entries(latest.response_codes ?? {})) {
        rcDiff[k] = v - (second.response_codes?.[k] ?? 0)
      }
      const tot = Object.values(rcDiff).reduce((s, v) => s + v, 0)
      if (tot > 0) {
        const ok = Object.entries(rcDiff)
          .filter(([k]) => k.startsWith('2') || k.startsWith('3'))
          .reduce((s, [, v]) => s + v, 0)
        successRate = parseFloat(((ok / tot) * 100).toFixed(2))
      }
    }

    return { rps, errRate, rxBps, txBps, successRate, history: { ...h } }
  }, [])

  return { push }
}
