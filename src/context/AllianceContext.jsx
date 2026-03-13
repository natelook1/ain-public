import { createContext, useContext, useState, useEffect } from 'react'
import { searchAlliance } from '../api/search'

const AllianceContext = createContext()

// Color palette for alliances
const ALLIANCE_COLORS = [
  '#ef4444', '#06b6d4', '#f59e0b', '#a855f7',
  '#f97316', '#3b82f6', '#84cc16', '#ec4899',
  '#f87171', '#14b8a6', '#eab308', '#d946ef',
  '#0ea5e9', '#10b981', '#8b5cf6', '#fb7185'
]

// No default alliances - start empty
const DEFAULT_ALLIANCE_SEARCHES = []
const DEFAULT_ALLIANCES = []

export function AllianceProvider({ children }) {
  const [loading, setLoading] = useState(false)
  const [selectionOrderCounter, setSelectionOrderCounter] = useState(() => {
    const saved = localStorage.getItem('ain_selection_counter')
    return saved ? parseInt(saved) : 0
  })

  // Load tracked alliances from localStorage
  const [trackedAlliances, setTrackedAlliances] = useState(() => {
    const saved = localStorage.getItem('ain_tracked_alliances')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.length > 0) {
        return parsed
      }
    }
    return []
  })

  // Active alliances (selected for viewing)
  const [activeAllianceIds, setActiveAllianceIds] = useState(() => {
    const saved = localStorage.getItem('ain_active_alliance_ids')
    if (saved) {
      return JSON.parse(saved)
    }
    return []
  })

  // --- Corporation Tracking ---
  const [trackedCorps, setTrackedCorps] = useState(() => {
    const saved = localStorage.getItem('ain_tracked_corps')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.length > 0) return parsed
    }
    return []
  })

  const [activeCorpIds, setActiveCorpIds] = useState(() => {
    const saved = localStorage.getItem('ain_active_corp_ids')
    if (saved) return JSON.parse(saved)
    return []
  })

  // Focus/Lurker target - the entity being isolated
  const [lurkerTarget, setLurkerTarget] = useState(() => {
    const saved = localStorage.getItem('ain_lurker_target')
    return saved ? parseInt(saved) : null
  })

  // Lurker mode flag - true = global feed with tracking, false = standard single-entity filter
  const [isLurkerMode, setIsLurkerMode] = useState(() => {
    return localStorage.getItem('ain_lurker_mode') === 'true'
  })

  // Fetch default alliances from backend on first load
  useEffect(() => {
    const fetchDefaults = async () => {
      if (trackedAlliances.length > 0) return // Already have alliances

      setLoading(true)
      const fetchedAlliances = []

      for (let i = 0; i < DEFAULT_ALLIANCE_SEARCHES.length; i++) {
        const searchQuery = DEFAULT_ALLIANCE_SEARCHES[i]
        try {
          const result = await searchAlliance(searchQuery)
          if (result.id && result.name) {
            fetchedAlliances.push({
              id: result.id,
              name: result.name,
              ticker: result.ticker || null,
              color: ALLIANCE_COLORS[i % ALLIANCE_COLORS.length],
              selectionOrder: i
            })
          }
        } catch (error) {
          console.error(`Failed to fetch alliance: ${searchQuery}`, error)
        }
      }

      if (fetchedAlliances.length > 0) {
        setTrackedAlliances(fetchedAlliances)
        setActiveAllianceIds(fetchedAlliances.map(a => a.id))
        setSelectionOrderCounter(fetchedAlliances.length)
        localStorage.setItem('ain_selection_counter', fetchedAlliances.length.toString())
      }
      setLoading(false)
    }

    fetchDefaults()
  }, [])

  // Sidebar collapsed state (default: responsive)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('ain_sidebar_collapsed')
    if (saved) return JSON.parse(saved)
    
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768
    }
    return true // Default collapsed if unknown
  })

  // Save to localStorage whenever trackedAlliances changes
  useEffect(() => {
    localStorage.setItem('ain_tracked_alliances', JSON.stringify(trackedAlliances))
  }, [trackedAlliances])

  // Save to localStorage whenever activeAllianceIds changes
  useEffect(() => {
    localStorage.setItem('ain_active_alliance_ids', JSON.stringify(activeAllianceIds))
  }, [activeAllianceIds])

  // Save corps to localStorage
  useEffect(() => {
    localStorage.setItem('ain_tracked_corps', JSON.stringify(trackedCorps))
  }, [trackedCorps])

  useEffect(() => {
    localStorage.setItem('ain_active_corp_ids', JSON.stringify(activeCorpIds))
  }, [activeCorpIds])

  // Save to localStorage whenever sidebarCollapsed changes
  useEffect(() => {
    localStorage.setItem('ain_sidebar_collapsed', JSON.stringify(sidebarCollapsed))
  }, [sidebarCollapsed])

  // Save to localStorage whenever lurkerTarget changes
  useEffect(() => {
    if (lurkerTarget !== null) {
      localStorage.setItem('ain_lurker_target', lurkerTarget.toString())
    } else {
      localStorage.removeItem('ain_lurker_target')
      localStorage.removeItem('ain_lurker_mode')
    }
  }, [lurkerTarget])

  useEffect(() => {
    if (isLurkerMode) {
      localStorage.setItem('ain_lurker_mode', 'true')
    } else {
      localStorage.removeItem('ain_lurker_mode')
    }
  }, [isLurkerMode])

  // Toggle sidebar collapsed state
  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev)
  }

  // Add an alliance to tracking list
  const addAlliance = (alliance) => {
    if (!trackedAlliances.find(a => a.id === alliance.id)) {
      const newAlliance = {
        ...alliance,
        color: alliance.color || ALLIANCE_COLORS[selectionOrderCounter % ALLIANCE_COLORS.length],
        selectionOrder: selectionOrderCounter
      }
      setTrackedAlliances(prev => [...prev, newAlliance])
      setActiveAllianceIds(prev => [...prev, newAlliance.id])
      setSelectionOrderCounter(prev => {
        const newCounter = prev + 1
        localStorage.setItem('ain_selection_counter', newCounter.toString())
        return newCounter
      })
    }
  }

  // Remove an alliance from tracking list
  const removeAlliance = (allianceId) => {
    setTrackedAlliances(prev => prev.filter(a => a.id !== allianceId))
    setActiveAllianceIds(prev => prev.filter(id => id !== allianceId))
  }

  // Toggle alliance active state
  const toggleAlliance = (allianceId) => {
    if (lurkerTarget === allianceId) {
      setLurkerTarget(null)
    }

    setActiveAllianceIds(prev =>
      prev.includes(allianceId)
        ? prev.filter(id => id !== allianceId)
        : [...prev, allianceId]
    )
  }

  // Clear all selections
  const clearSelections = () => {
    setActiveAllianceIds([])
    setLurkerTarget(null)
  }

  // Clear all alliances (with confirmation)
  const clearAlliances = (confirmed = false) => {
    if (!confirmed && trackedAlliances.length > 0) {
      return false // Signal that confirmation is needed
    }
    setTrackedAlliances([])
    setActiveAllianceIds([])
    setLurkerTarget(null)
    return true
  }

  // Export alliance list as JSON
  const exportAlliances = () => {
    const exportData = {
      version: 1,
      exported: new Date().toISOString(),
      alliances: trackedAlliances.map(a => ({
        id: a.id,
        name: a.name,
        ticker: a.ticker,
        color: a.color
      }))
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ain-alliances-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Import alliance list from JSON
  const importAlliances = (jsonData, mode = 'merge') => {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData
      if (!data.alliances || !Array.isArray(data.alliances)) {
        return { success: false, error: 'Invalid file format' }
      }

      const importedAlliances = data.alliances.map((a, index) => ({
        id: a.id,
        name: a.name,
        ticker: a.ticker || null,
        color: a.color || ALLIANCE_COLORS[(selectionOrderCounter + index) % ALLIANCE_COLORS.length],
        selectionOrder: selectionOrderCounter + index
      }))

      if (mode === 'replace') {
        setTrackedAlliances(importedAlliances)
        setActiveAllianceIds(importedAlliances.map(a => a.id))
        setLurkerTarget(null)
        setSelectionOrderCounter(prev => {
          const newCounter = importedAlliances.length
          localStorage.setItem('ain_selection_counter', newCounter.toString())
          return newCounter
        })
      } else {
        // Merge - add only new alliances
        const existingIds = new Set(trackedAlliances.map(a => a.id))
        const newAlliances = importedAlliances.filter(a => !existingIds.has(a.id))

        if (newAlliances.length > 0) {
          setTrackedAlliances(prev => [...prev, ...newAlliances])
          setActiveAllianceIds(prev => [...prev, ...newAlliances.map(a => a.id)])
          setSelectionOrderCounter(prev => {
            const newCounter = prev + newAlliances.length
            localStorage.setItem('ain_selection_counter', newCounter.toString())
            return newCounter
          })
        }
      }

      return { success: true, count: mode === 'replace' ? importedAlliances.length : importedAlliances.filter(a => !new Set(trackedAlliances.map(t => t.id)).has(a.id)).length }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Change alliance color
  const changeAllianceColor = (allianceId, newColor) => {
    setTrackedAlliances(prev =>
      prev.map(a => a.id === allianceId ? { ...a, color: newColor } : a)
    )
  }

  // --- Corporation Actions ---
  const addCorp = (corp) => {
    if (!trackedCorps.find(c => c.id === corp.id)) {
      const newCorp = {
        ...corp,
        color: corp.color || ALLIANCE_COLORS[selectionOrderCounter % ALLIANCE_COLORS.length],
        selectionOrder: selectionOrderCounter
      }
      setTrackedCorps(prev => [...prev, newCorp])
      setActiveCorpIds(prev => [...prev, newCorp.id])
      setSelectionOrderCounter(prev => {
        const newCounter = prev + 1
        localStorage.setItem('ain_selection_counter', newCounter.toString())
        return newCounter
      })
    }
  }

  const removeCorp = (corpId) => {
    setTrackedCorps(prev => prev.filter(c => c.id !== corpId))
    setActiveCorpIds(prev => prev.filter(id => id !== corpId))
  }

  const toggleCorp = (corpId) => {
    setActiveCorpIds(prev =>
      prev.includes(corpId)
        ? prev.filter(id => id !== corpId)
        : [...prev, corpId]
    )
  }

  const changeCorpColor = (corpId, newColor) => {
    setTrackedCorps(prev =>
      prev.map(c => c.id === corpId ? { ...c, color: newColor } : c)
    )
  }

  // Update alliance ticker (used when fetched from ESI)
  const updateAllianceTicker = (allianceId, ticker) => {
    setTrackedAlliances(prev =>
      prev.map(a => a.id === allianceId ? { ...a, ticker } : a)
    )
  }

  // Reset all alliance colors to default palette
  const resetAllColors = () => {
    setTrackedAlliances(prev =>
      prev.map(a => ({ ...a, color: ALLIANCE_COLORS[a.selectionOrder % ALLIANCE_COLORS.length] }))
    )
  }

  // Toggle lurker mode (sidebar eye) — global feed with kill/loss/assist tracking
  const toggleLurkerMode = (targetId) => {
    if (lurkerTarget === targetId && isLurkerMode) {
      setLurkerTarget(null)
      setIsLurkerMode(false)
    } else {
      setLurkerTarget(targetId)
      setIsLurkerMode(true)

      // Deselect other entities so only the lurker target is active
      const strTargetId = String(targetId)
      const isAlliance = trackedAlliances.some(a => String(a.id) === strTargetId)
      const isCorp = trackedCorps.some(c => String(c.id) === strTargetId)

      if (isAlliance) {
        setActiveAllianceIds([targetId])
        setActiveCorpIds([])
      } else if (isCorp) {
        setActiveCorpIds([targetId])
        setActiveAllianceIds([])
      }
    }
  }

  // Focus target (card click) — standard single-entity filter
  const setFocusTarget = (targetId) => {
    if (lurkerTarget === targetId && !isLurkerMode) {
      setLurkerTarget(null)
    } else {
      setLurkerTarget(targetId)
      setIsLurkerMode(false)
    }
  }

  const value = {
    trackedAlliances,
    activeAllianceIds,
    sidebarCollapsed,
    lurkerTarget,
    addAlliance,
    removeAlliance,
    toggleAlliance,
    toggleSidebar,
    clearSelections,
    clearAlliances,
    changeAllianceColor,
    updateAllianceTicker,
    resetAllColors,
    toggleLurkerMode,
    setFocusTarget,
    isLurkerMode,
    setLurkerTarget,
    exportAlliances,
    importAlliances,
    // Corporation tracking
    trackedCorps,
    activeCorpIds,
    addCorp,
    removeCorp,
    toggleCorp,
    changeCorpColor
  }

  return (
    <AllianceContext.Provider value={value}>
      {children}
    </AllianceContext.Provider>
  )
}

// Custom hook to use alliance context
export function useAlliance() {
  const context = useContext(AllianceContext)
  if (!context) {
    throw new Error('useAlliance must be used within AllianceProvider')
  }
  return context
}
