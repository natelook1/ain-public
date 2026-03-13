import { API_ENDPOINTS } from './config'

export async function fetchPilotCount() {
  const url = 'https://esi.evetech.net/latest/status/?datasource=tranquility'
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`ESI API error: ${response.status}`)
    }
    const data = await response.json()
    return data.players
  } catch (error) {
    console.error('Fetch pilot count error:', error)
    return null
  }
}

/**
 * Fetch alliance info from ESI (member count, ticker, etc.)
 * @param {number} allianceId - Alliance ID
 * @returns {Promise<Object|null>} Alliance info with member_count
 */
export async function fetchAllianceInfo(allianceId) {
  const url = `https://esi.evetech.net/latest/alliances/${allianceId}/?datasource=tranquility`
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`ESI API error: ${response.status}`)
    }
    const data = await response.json()
    // ESI doesn't return member_count directly, need to fetch corporations
    const corpsUrl = `https://esi.evetech.net/latest/alliances/${allianceId}/corporations/?datasource=tranquility`
    const corpsResponse = await fetch(corpsUrl)
    let memberCount = null
    if (corpsResponse.ok) {
      const corpIds = await corpsResponse.json()
      data.corporation_count = corpIds.length
    }
    return data
  } catch (error) {
    console.error('Fetch alliance info error:', error)
    return null
  }
}

/**
 * Fetch statistics for tracked alliances
 * @param {string} allianceIds - Comma-separated alliance IDs (optional)
 * @param {string} corporationIds - Comma-separated corporation IDs (optional)
 * @returns {Promise<Object>} Stats data with 24h stats, trends, distributions
 */
export async function fetchStats(allianceIds = null, corporationIds = null) {
  let url = API_ENDPOINTS.STATS
  const params = new URLSearchParams()
  
  if (allianceIds) {
    params.append('alliance_id', allianceIds)
  }
  if (corporationIds) {
    params.append('corporation_id', corporationIds)
  }

  const queryString = params.toString()
  if (queryString) {
    url += `?${queryString}`
  }

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Fetch stats error:', error)
    return null
  }
}
