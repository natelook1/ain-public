import { useState, useEffect, useRef, useCallback } from 'react'
import { useAlliance } from '../../context/AllianceContext'
import { searchAlliances } from '../../api/search'
import ContextMenu from '../ContextMenu/ContextMenu'
import './Sidebar.css'

// Icons
const ScaleIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>
  </svg>
)

function Sidebar({ onOpenLegal }) {
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [showConfirmClear, setShowConfirmClear] = useState(false)
  const [importMessage, setImportMessage] = useState(null)
  const fileInputRef = useRef(null)
  
  const {
    trackedAlliances,
    activeAllianceIds,
    sidebarCollapsed,
    lurkerTarget,
    addAlliance,
    removeAlliance,
    toggleAlliance,
    toggleSidebar,
    changeAllianceColor,
    toggleLurkerMode,
    resetAllColors,
    clearSelections,
    clearAlliances, 
    exportAlliances,
    importAlliances,
    trackedCorps,
    activeCorpIds,
    addCorp,
    removeCorp,
    toggleCorp,
    changeCorpColor,
    clearCorps 
  } = useAlliance()

  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [searchActive, setSearchActive] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const searchRef = useRef(null)
  const debounceRef = useRef(null)

  const totalTrackedCount = trackedAlliances.length + trackedCorps.length
  const hasSelections = activeAllianceIds.length > 0 || activeCorpIds.length > 0 || lurkerTarget !== null

  // Track scroll position for back-to-top button
  useEffect(() => {
    const mainContent = document.querySelector('.main-content')
    if (!mainContent) return

    const handleScroll = () => {
      setShowBackToTop(mainContent.scrollTop > 400)
    }
    mainContent.addEventListener('scroll', handleScroll)
    return () => mainContent.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    const mainContent = document.querySelector('.main-content')
    if (mainContent) {
      mainContent.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchActive(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const onSearchChange = useCallback((e) => {
    const term = e.target.value
    setSearchQuery(term)
    setSearchError(null)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (term.trim().length < 2) {
      setSearchResults([])
      setSearchActive(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await searchAlliances(term)
        const filtered = results.filter(r => {
          if (r.type === 'corporation') return !trackedCorps.some(c => c.id === r.id)
          return !trackedAlliances.some(a => a.id === r.id)
        })
        setSearchResults(filtered.slice(0, 8))
        setSearchActive(filtered.length > 0)
      } catch (error) {
        setSearchError(error.message)
        setSearchResults([])
        setSearchActive(false)
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [trackedAlliances, trackedCorps])

  const handleSelectResult = (result) => {
    if (result.type === 'corporation') {
      addCorp({ id: result.id, name: result.name, ticker: result.ticker })
    } else {
      addAlliance({ id: result.id, name: result.name, ticker: result.ticker })
    }
    setSearchQuery('')
    setSearchResults([])
    setSearchActive(false)
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (searchQuery.trim().length < 2) return

    setSearching(true)
    setSearchError(null)

    try {
      const results = await searchAlliances(searchQuery)
      if (results.length === 0) {
        setSearchError('No results found')
        setSearchResults([])
        setSearchActive(false)
      } else if (results.length === 1) {
        handleSelectResult(results[0])
      } else {
        const filtered = results.filter(r => {
          if (r.type === 'corporation') return !trackedCorps.some(c => c.id === r.id)
          return !trackedAlliances.some(a => a.id === r.id)
        })
        setSearchResults(filtered.slice(0, 8))
        setSearchActive(filtered.length > 0)
      }
    } catch (error) {
      setSearchError(error.message)
    } finally {
      setSearching(false)
    }
  }

  const handleContextMenu = (e, item, type) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, item, type })
  }

  const handleLurkerMode = (id, type = 'alliance') => {
    toggleLurkerMode(id, type)
  }

  // --- FIX 1: Manual Corp Selection Clearing ---
  const handleClearSelections = () => {
    // 1. Call context clear (handles alliances/lurker)
    if (clearSelections) clearSelections()
    
    // 2. Manually untoggle all active corporations
    if (activeCorpIds && activeCorpIds.length > 0) {
      activeCorpIds.forEach(id => toggleCorp(id))
    }
  }

  const handleClearAll = () => {
    if (totalTrackedCount === 0) return
    setShowConfirmClear(true)
  }

  // --- FIX 2: Robust Clear All (Fallback if clearCorps is missing) ---
  const confirmClearAll = () => {
    // 1. Clear Alliances
    if (clearAlliances) clearAlliances(true)
    
    // 2. Clear Corps
    if (clearCorps) {
      clearCorps(true)
    } else {
      // Fallback: If context doesn't have clearCorps, remove them one by one
      trackedCorps.forEach(c => removeCorp(c.id))
    }
    
    setShowConfirmClear(false)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = importAlliances(event.target.result, 'merge')
      if (result.success) {
        setImportMessage({ type: 'success', text: `Imported ${result.count} item(s)` })
      } else {
        setImportMessage({ type: 'error', text: result.error })
      }
      setTimeout(() => setImportMessage(null), 3000)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        onClick={toggleSidebar}
        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {sidebarCollapsed ? '→' : '←'}
      </button>

      <div className="sidebar-header">
        <div className="search-form-container" ref={searchRef}>
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Search Alliance or Corp..."
              value={searchQuery}
              onChange={onSearchChange}
              onKeyDown={(e) => e.stopPropagation()}
              className="search-input"
            />
            <button type="submit" className="btn-add" disabled={searching}>
              {searching ? '...' : '+'}
            </button>
          </form>
          {searchActive && searchResults.length > 0 && (
            <div className="alliance-search-results">
              {searchResults.map((result) => (
                <div
                  key={`${result.type || 'alliance'}-${result.id}`}
                  className="alliance-search-item"
                  onClick={() => handleSelectResult(result)}
                >
                  <img
                    src={`https://images.evetech.net/${result.type === 'corporation' ? 'corporations' : 'alliances'}/${result.id}/logo?size=32`}
                    alt=""
                    className="alliance-search-icon"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                  <div className="alliance-search-info">
                    <span className="alliance-search-name">{result.name}</span>
                    <div className="alliance-search-meta">
                      {result.ticker && <span className="alliance-search-ticker">[{result.ticker}]</span>}
                      {result.type === 'corporation' && <span className="alliance-search-type">Corp</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {sidebarCollapsed && (
        <div className="sidebar-actions-collapsed">
          <button
            onClick={handleClearSelections} 
            className="btn-clear-selections"
            title="Clear all selections"
            disabled={!hasSelections}
          >
            ×
          </button>
        </div>
      )}

      {searchError && <div className="search-error">{searchError}</div>}

      <div className="alliance-list">
        {totalTrackedCount === 0 ? (
          <p className="empty-message">No alliances or corps tracked yet</p>
        ) : (
          <>
            {/* Alliances Section */}
            {trackedAlliances.length > 0 && (
              <>
                {trackedCorps.length > 0 && <div className="list-divider">Alliances</div>}
                {trackedAlliances.map(alliance => {
                  const isLurker = lurkerTarget === alliance.id
                  const isActive = activeAllianceIds.includes(alliance.id)
                  const isGreyedOut = lurkerTarget !== null && lurkerTarget !== alliance.id

                  return (
                    <div
                      key={alliance.id}
                      className={`alliance-item ${isActive ? 'active' : ''} ${isLurker ? 'lurker' : ''} ${isGreyedOut ? 'greyed-out' : ''}`}
                      onClick={() => toggleAlliance(alliance.id)}
                      onContextMenu={(e) => handleContextMenu(e, alliance, 'alliance')}
                      title={sidebarCollapsed ? alliance.name : (isLurker ? "Lurker Mode" : isActive ? "Hide from feed" : "Show in feed")}
                      style={{
                        '--alliance-color': alliance.color,
                        '--item-bg-color': isLurker ? `${alliance.color}30` : (isActive ? `${alliance.color}15` : undefined)
                      }}
                    >
                      <img
                        src={`https://images.evetech.net/alliances/${alliance.id}/logo?size=128`}
                        alt={alliance.name}
                        className="alliance-icon"
                      />
                      {!sidebarCollapsed && (
                        <>
                          <div className="alliance-info">
                            <div className="alliance-name" title={alliance.name}>{alliance.name}</div>
                            {alliance.ticker && <div className="alliance-ticker">[{alliance.ticker}]</div>}
                            {isLurker && <div className="lurker-indicator">Lurker Mode</div>}
                          </div>
                          <div className="alliance-actions">
                            <div className="lurker-tooltip-wrap">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleLurkerMode(alliance.id) }}
                                className={`btn-lurker ${isLurker ? 'active' : ''}`}
                              >👁️</button>
                              <div className="lurker-tooltip">
                                {isLurker ? (
                                  <>
                                    <div className="lurker-tooltip-title">👁️ Lurker Mode Active</div>
                                    <p className="lurker-tooltip-desc">Watching <strong>{alliance.name}</strong> across the global kill feed. Click to exit.</p>
                                  </>
                                ) : (
                                  <>
                                    <div className="lurker-tooltip-title">👁️ Lurker Mode</div>
                                    <p className="lurker-tooltip-desc">Watch this entity across the <em>entire</em> global kill feed. Their kills always appear even when other filters are active.</p>
                                    <ul className="lurker-tooltip-list">
                                      <li><span className="lt-kill">Kill</span> — they destroyed a ship</li>
                                      <li><span className="lt-loss">Loss</span> — they lost a ship</li>
                                      <li><span className="lt-assist">Assist</span> — they helped in a kill</li>
                                      <li><span className="lt-other">Other</span> — unrelated kills, shown normally</li>
                                    </ul>
                                  </>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeAlliance(alliance.id) }}
                              className="btn-remove"
                              title="Remove"
                            >×</button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </>
            )}

            {/* Corporations Section */}
            {trackedCorps.length > 0 && (
              <>
                {trackedAlliances.length > 0 && <div className="list-divider">Corps</div>}
                {trackedCorps.map(corp => {
                  const isLurker = lurkerTarget === corp.id
                  const isActive = activeCorpIds.includes(corp.id)
                  const isGreyedOut = lurkerTarget !== null && lurkerTarget !== corp.id

                  return (
                    <div
                      key={`corp-${corp.id}`}
                      className={`alliance-item ${isActive ? 'active' : ''} ${isLurker ? 'lurker' : ''} ${isGreyedOut ? 'greyed-out' : ''}`}
                      onClick={() => toggleCorp(corp.id)}
                      onContextMenu={(e) => handleContextMenu(e, corp, 'corporation')}
                      title={sidebarCollapsed ? corp.name : (isLurker ? "Lurker Mode" : isActive ? "Hide from feed" : "Show in feed")}
                      style={{
                        '--alliance-color': corp.color,
                        '--item-bg-color': isLurker ? `${corp.color}30` : (isActive ? `${corp.color}15` : undefined)
                      }}
                    >
                      <img
                        src={`https://images.evetech.net/corporations/${corp.id}/logo?size=128`}
                        alt={corp.name}
                        className="alliance-icon"
                      />
                      {!sidebarCollapsed && (
                        <>
                          <div className="alliance-info">
                            <div className="alliance-name" title={corp.name}>{corp.name}</div>
                            {corp.ticker && <div className="alliance-ticker">[{corp.ticker}]</div>}
                            {isLurker && <div className="lurker-indicator">Lurker Mode</div>}
                          </div>
                          <div className="alliance-actions">
                            <div className="lurker-tooltip-wrap">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleLurkerMode(corp.id) }}
                                className={`btn-lurker ${isLurker ? 'active' : ''}`}
                              >👁️</button>
                              <div className="lurker-tooltip">
                                {isLurker ? (
                                  <>
                                    <div className="lurker-tooltip-title">👁️ Lurker Mode Active</div>
                                    <p className="lurker-tooltip-desc">Watching <strong>{corp.name}</strong> across the global kill feed. Click to exit.</p>
                                  </>
                                ) : (
                                  <>
                                    <div className="lurker-tooltip-title">👁️ Lurker Mode</div>
                                    <p className="lurker-tooltip-desc">Watch this entity across the <em>entire</em> global kill feed. Their kills always appear even when other filters are active.</p>
                                    <ul className="lurker-tooltip-list">
                                      <li><span className="lt-kill">Kill</span> — they destroyed a ship</li>
                                      <li><span className="lt-loss">Loss</span> — they lost a ship</li>
                                      <li><span className="lt-assist">Assist</span> — they helped in a kill</li>
                                      <li><span className="lt-other">Other</span> — unrelated kills, shown normally</li>
                                    </ul>
                                  </>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeCorp(corp.id) }}
                              className="btn-remove"
                              title="Remove"
                            >×</button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}
      </div>

      {!sidebarCollapsed && (
        <div className="sidebar-footer">
          <div className="footer-row">
            <button onClick={exportAlliances} className="btn-clear" title="Export tracked items" disabled={totalTrackedCount === 0}>Export</button>
            <button onClick={handleImportClick} className="btn-clear" title="Import tracked items">Import</button>
            <button onClick={resetAllColors} className="btn-clear" title="Reset all custom colors">Reset Colors</button>
          </div>
          <div className="footer-row">
            <button
              onClick={handleClearSelections}
              className="btn-clear"
              title="Clear active filters"
              disabled={!hasSelections}
            >
              Clear Selections
            </button>
            <button 
              onClick={handleClearAll} 
              className="btn-clear btn-danger" 
              title="Remove everything from tracking" 
              disabled={totalTrackedCount === 0}
            >
              Clear All
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImport}
            accept=".json"
            style={{ display: 'none' }}
          />
          <div className="sidebar-legal-container">
            <button onClick={onOpenLegal} className="btn-legal">
              <ScaleIcon />
              <span>LEGAL / LICENSE</span>
            </button>
            <div className="legal-copyright">
              &#169; 2014 CCP hf. All rights reserved. "EVE", "EVE Online", "CCP", and all related logos and images are trademarks or registered trademarks of CCP hf.
            </div>
          </div>
        </div>
      )}
      
      {sidebarCollapsed && (
        <div className="sidebar-legal-collapsed">
           <button onClick={onOpenLegal} className="btn-legal-icon" title="LEGAL / LICENSE">
              <ScaleIcon />
           </button>
        </div>
      )}

      {importMessage && (
        <div className={`import-message ${importMessage.type}`}>
          {importMessage.text}
        </div>
      )}

      {showConfirmClear && (
        <div className="confirm-overlay" onClick={() => setShowConfirmClear(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>Clear all {totalTrackedCount} tracked item(s)?</p>
            <div className="confirm-buttons">
              <button onClick={() => setShowConfirmClear(false)} className="btn-cancel">Cancel</button>
              <button onClick={confirmClearAll} className="btn-confirm-danger">Clear All</button>
            </div>
          </div>
        </div>
      )}

      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="btn-back-to-top"
          title="Back to top"
        >
          ↑
        </button>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          alliance={contextMenu.item}
          type={contextMenu.type}
          onClose={() => setContextMenu(null)}
          onLurkerMode={(id) => handleLurkerMode(id, contextMenu.type)}
          onRemove={contextMenu.type === 'corporation' ? removeCorp : removeAlliance}
          removeLabel={contextMenu.type === 'corporation' ? "Remove Corp" : "Remove Alliance"}
          onChangeColor={contextMenu.type === 'corporation' ? changeCorpColor : changeAllianceColor}
        />
      )}
    </aside>
  )
}

export default Sidebar
