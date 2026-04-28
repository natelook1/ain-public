// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE || 'https://api-ain.looknet.ca/webhook'
const SSE_BASE_URL = import.meta.env.VITE_SSE_BASE || 'http://localhost:3001'

export const API_ENDPOINTS = {
  FEED:         `${API_BASE_URL}/feed`,
  STATS:        `${API_BASE_URL}/stats`,
  SEARCH:       `${API_BASE_URL}/search`,
  R2Z2_STATS:   `${API_BASE_URL}/r2z2-stats`,
  SYSTEM_INTEL: `${API_BASE_URL}/system`,
  SSE:          `${SSE_BASE_URL}/sse`,
  SSE_PRESENCE: `${API_BASE_URL}/sse-presence`,
}

export default API_ENDPOINTS
