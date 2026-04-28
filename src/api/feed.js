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

  queryParams.append('sse_client', 'true')

  const url = `${API_ENDPOINTS.FEED}?${queryParams.toString()}`

  // Combine caller signal with a 10s timeout to prevent hung requests.
  // AbortSignal.timeout / AbortSignal.any require Chrome 103+/Firefox 102+/Safari 16.1+;
  // fall back to a plain fetch (no timeout) on older browsers.
  let combinedSignal;
  try {
    const timeout = AbortSignal.timeout(10000);
    combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  } catch {
    combinedSignal = signal ?? undefined;
  }

  const response = await fetch(url, { signal: combinedSignal })

  if (!response.ok) {
    throw new Error(`Feed API error: ${response.status}`)
  }

  const data = await response.json()
  return data
}
