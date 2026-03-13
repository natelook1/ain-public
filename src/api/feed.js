import { API_ENDPOINTS } from './config'

/**
 * Fetch killmail feed with optional filters
 * @param {Object} params - Query parameters
 * @param {AbortSignal} [params.signal] - AbortSignal for cancellation
 * @returns {Promise<Object>} Feed data with kills array
 */
export async function fetchKillFeed(params = {}) {
  const queryParams = new URLSearchParams()

  const { signal, ...queryParamsObj } = params;

  Object.entries(queryParamsObj).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, value)
    }
  })

  const url = `${API_ENDPOINTS.FEED}?${queryParams.toString()}`

  // Combine caller signal with a 10s timeout to prevent hung requests
  const timeout = AbortSignal.timeout(10000);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeout])
    : timeout;

  const response = await fetch(url, { signal: combinedSignal })

  if (!response.ok) {
    throw new Error(`Feed API error: ${response.status}`)
  }

  const data = await response.json()
  return data
}
