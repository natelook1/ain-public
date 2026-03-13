import { API_ENDPOINTS } from './config'

/**
 * Search for alliances by name
 * @param {string} query - Search query (min 2 chars)
 * @returns {Promise<Object>} Alliance data with id, name, ticker
 */
export async function searchAlliance(query) {
  if (!query || query.trim().length < 2) {
    throw new Error('Query must be at least 2 characters')
  }

  const url = `${API_ENDPOINTS.SEARCH}?q=${encodeURIComponent(query.trim())}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Search API error: ${response.status}`)
  }

  return response.json()
}

/**
 * Search for alliances AND corporations by name or ticker, returning multiple results
 * Backend (webhook_search.json) handles both alliances and corporations via ESI
 * @param {string} query - Search query (min 2 chars)
 * @returns {Promise<Array>} Array of alliance/corp data with id, name, ticker, type
 */
export async function searchAlliances(query) {
  if (!query || query.trim().length < 2) {
    return []
  }

  const url = `${API_ENDPOINTS.SEARCH}?q=${encodeURIComponent(query.trim())}&multi=true`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Search API error: ${response.status}`)
  }

  const data = await response.json()
  // Backend returns array directly when multi=true
  return Array.isArray(data) ? data : (data ? [data] : [])
}
