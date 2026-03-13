import React, { useState, useRef, useCallback } from 'react'
import { extractColorsFromImage } from '../../utils/colorExtractor'
import { searchAlliances } from '../../api/search'
import './CustomThemeModal.css'

const IMG_BASE = 'https://images.evetech.net'

function CustomThemeModal({ onApply, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [applying, setApplying] = useState(false)
  const debounceRef = useRef(null)

  // Autocomplete search with debounce
  const handleQueryChange = useCallback((e) => {
    const value = e.target.value
    setQuery(value)
    setError(null)

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (value.trim().length < 2) {
      setResults([])
      return
    }

    // Debounce API call for autocomplete
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchAlliances(value.trim())
        if (data.length === 0) {
          setError('No alliance or corporation found.')
        }
        setResults(data)
      } catch (err) {
        setError('Search failed. Try again.')
        console.error('Custom theme search error:', err)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  // Manual search on Enter or button click
  const search = async () => {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2) return

    setLoading(true)
    setError(null)

    try {
      const data = await searchAlliances(trimmed)
      if (data.length === 0) {
        setError('No alliance or corporation found.')
      }
      setResults(data)
    } catch (err) {
      setError('Search failed. Try again.')
      console.error('Custom theme search error:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  // Stop all keyboard events from bubbling out of the modal
  // so they don't trigger app-level shortcuts while typing
  const stopPropagation = (e) => e.stopPropagation()

  const handleKeyDown = (e) => {
    e.stopPropagation()
    if (e.key === 'Enter') search()
    if (e.key === 'Escape') onClose()
  }

  const applyTheme = async (result) => {
    setApplying(true)
    setError(null)

    const logoUrl = `${IMG_BASE}/${result.type === 'alliance' ? 'alliances' : 'corporations'}/${result.id}/logo?size=128`

    try {
      const palette = await extractColorsFromImage(logoUrl)
      onApply({
        id: result.id,
        name: result.name,
        type: result.type,
        logoUrl: `${IMG_BASE}/${result.type === 'alliance' ? 'alliances' : 'corporations'}/${result.id}/logo?size=32`,
        palette,
      })
    } catch (err) {
      setError('Could not extract colors from logo. Try another.')
      console.error('Color extraction error:', err)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="custom-theme-overlay" onClick={onClose}>
      <div className="custom-theme-modal" onClick={(e) => e.stopPropagation()} onKeyDown={stopPropagation} onKeyUp={stopPropagation}>
        <div className="custom-theme-header">
          <h3>Custom Theme</h3>
          <button className="custom-theme-close" onClick={onClose}>&times;</button>
        </div>

        <p className="custom-theme-hint">
          Search for any alliance or corporation to generate a theme from their logo.
        </p>

        <div className="custom-theme-search">
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder="Start typing alliance or corp name..."
            autoFocus
          />
          <button onClick={search} disabled={loading || !query.trim()}>
            {loading ? '...' : 'Search'}
          </button>
        </div>

        {error && <p className="custom-theme-error">{error}</p>}

        <div className="custom-theme-results">
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              className="custom-theme-result"
              onClick={() => applyTheme(r)}
              disabled={applying}
            >
              <img
                src={`${IMG_BASE}/${r.type === 'alliance' ? 'alliances' : 'corporations'}/${r.id}/logo?size=32`}
                alt={r.name}
              />
              <div className="custom-theme-result-info">
                <span className="custom-theme-result-name">{r.name}</span>
                <span className="custom-theme-result-type">{r.type}</span>
              </div>
            </button>
          ))}
        </div>

        {applying && <p className="custom-theme-applying">Generating theme...</p>}
      </div>
    </div>
  )
}

export default CustomThemeModal
