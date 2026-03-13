import { useState, useEffect, useRef } from 'react'
import { useAlliance } from '../../context/AllianceContext'
import { useMapMode } from '../../context/MapModeContext'
import { REGION_GROUPS, REGION_BY_ID } from '../../data/regions'
import './Filters.css'

function Filters({ onDebouncedFiltersChange, stats }) {
  const { activeAllianceIds, activeCorpIds } = useAlliance()
  const { mapMode } = useMapMode()
  const [localFilters, setLocalFilters] = useState({
    roleFilters: [],
    encounterTypes: [],
    shipTypes: [],
    shipTypesTarget: 'victim',
    valueRanges: [],
    spaceTypes: [],
    regionIds: [],
    hideStructures: false,
    hidePods: false,
    hideRookieShips: false
  })

  const [showFilters, setShowFilters] = useState(() => window.innerWidth >= 768)
  const [shipClassesOpen, setShipClassesOpen] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState(null)
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false)
  const [regionSearch, setRegionSearch] = useState('')
  const [localSearchTerm, setLocalSearchTerm] = useState('')
  const regionDropdownRef = useRef(null)

  useEffect(() => {
    const handler = setTimeout(() => {
      onDebouncedFiltersChange?.({ ...localFilters, searchTerm: localSearchTerm });
    }, 500); // 500ms debounce delay for all filters

    return () => {
      clearTimeout(handler);
    };
  }, [localFilters, localSearchTerm, onDebouncedFiltersChange]);

  // React to Map Mode changes (Preset filters)
  useEffect(() => {
    if (mapMode === 'kspace') {
      setLocalFilters(prev => ({
        ...prev,
        spaceTypes: [],
        regionIds: [],
        roleFilters: [],
        encounterTypes: [],
        shipTypes: [],
    shipTypesTarget: 'victim',
        valueRanges: [],
        hideStructures: false,
        hidePods: false,
        hideRookieShips: false
      }));
    } else if (mapMode === 'anoikis') {
      setLocalFilters(prev => ({
        ...prev,
        spaceTypes: ['wh'],
        regionIds: []
      }));
    } else if (mapMode === 'abyssal') {
      setLocalFilters(prev => ({
        ...prev,
        spaceTypes: ['ab'],
        regionIds: []
      }));
    } else if (mapMode === 'overview') {
      setLocalFilters(prev => ({
        ...prev,
        spaceTypes: [],
        regionIds: []
      }));
    } else if (mapMode === 'strategic') {
      setLocalFilters(prev => ({
        ...prev,
        spaceTypes: [],
        regionIds: [],
        roleFilters: [],
        encounterTypes: [],
        shipTypes: [],
    shipTypesTarget: 'victim',
        valueRanges: [],
        hideStructures: false,
        hidePods: false,
        hideRookieShips: false
      }));
    }
  }, [mapMode]);


  const shipCategories = {
    Frigates: [
      { label: 'Frigate', value: 'frigate' },
      { label: 'Interceptor', value: 'interceptor' },
      { label: 'Assault Frig', value: 'assault_frigate' },
      { label: 'Covert Ops', value: 'covert_ops' },
      { label: 'Bomber', value: 'stealth_bomber' },
      { label: 'EWAR Frig', value: 'electronic_attack' },
      { label: 'Logi Frig', value: 'logistics_frigate' }
    ],
    Destroyers: [
      { label: 'Destroyer', value: 'destroyer' },
      { label: 'Interdictor', value: 'interdictor' },
      { label: 'Command DD', value: 'command_destroyer' },
      { label: 'Tactical DD', value: 'tactical_destroyer' }
    ],
    Cruisers: [
      { label: 'Cruiser', value: 'cruiser' },
      { label: 'HAC', value: 'heavy_assault' },
      { label: 'Logi', value: 'logistics' },
      { label: 'Force Recon', value: 'force_recon' },
      { label: 'Combat Recon', value: 'combat_recon' },
      { label: 'Command Ship', value: 'command_ship' },
      { label: 'T3C', value: 'strategic_cruiser' }
    ],
    Battlecruisers: [
      { label: 'BC', value: 'battlecruiser' },
      { label: 'Attack BC', value: 'attack_battlecruiser' }
    ],
    Battleships: [
      { label: 'BS', value: 'battleship' },
      { label: 'Black Ops', value: 'black_ops' },
      { label: 'Marauder', value: 'marauder' }
    ],
    Capital: [
      { label: 'Dread', value: 'dreadnought' },
      { label: 'Lancer', value: 'lancer_dreadnought' },
      { label: 'Carrier', value: 'carrier' },
      { label: 'FAX', value: 'force_auxiliary' },
      { label: 'Super', value: 'supercarrier' },
      { label: 'Titan', value: 'titan' }
    ],
    Mining: [
      { label: 'Mining Frig', value: 'mining_frigate' },
      { label: 'Barge', value: 'mining_barge' },
      { label: 'Exhumer', value: 'exhumer' },
      { label: 'Indy Command', value: 'industrial_command' }
    ],
    Hauling: [
      { label: 'Indy', value: 'industrial_base' },
      { label: 'Hauler', value: 'hauler' },
      { label: 'Blockade', value: 'blockade_runner' },
      { label: 'DST', value: 'deep_space_transport' },
      { label: 'Freighter', value: 'freighter' },
      { label: 'JF', value: 'jump_freighter' }
    ],
    Other: [
      { label: 'Capsule', value: 'capsule' },
      { label: 'Shuttle', value: 'shuttle' },
      { label: 'Fighter', value: 'fighter' },
      { label: 'Structure', value: 'structure' },
      { label: 'Deployable', value: 'deployable' }
    ]
  }

  const valueRanges = [
    { label: '< 10M', value: 'sub10m' },
    { label: '10M-100M', value: '10m-100m' },
    { label: '100M-1B', value: '100m-1b' },
    { label: '1B-10B', value: '1b-10b' },
    { label: '10B-20B', value: '10b-20b' },
    { label: '20B-50B', value: '20b-50b' },
    { label: '50B+', value: '50b' }
  ]

  const spaceTypes = [
    { label: 'HS', value: 'hs' },
    { label: 'LS', value: 'ls' },
    { label: 'NS', value: 'ns' },
    { label: 'Pochven', value: 'poch' },
    { label: 'WH', value: 'wh' },
    { label: 'Abyssal', value: 'ab' }
  ];

  const roleFilters = [
    { label: 'Loss', value: 'loss' },
    { label: 'Kill', value: 'kill' },
    { label: 'Assist', value: 'assist' }
  ]

  const encounterTypes = [
    { label: 'Solo', value: 'solo' },
    { label: 'Fleet', value: 'fleet' },
    { label: 'NPC', value: 'npc' }
  ]

  const toggleShipType = (shipType) => {
    setLocalFilters(prev => {
      const newShipTypes = prev.shipTypes.includes(shipType)
        ? prev.shipTypes.filter(t => t !== shipType)
        : [...prev.shipTypes, shipType]

      return { ...prev, shipTypes: newShipTypes }
    })
  }

  const toggleCategory = (category) => {
    const categoryShips = shipCategories[category].map(s => s.value)
    setLocalFilters(prev => {
      const allSelected = categoryShips.every(shipVal => prev.shipTypes.includes(shipVal))
      const newShipTypes = allSelected
        ? prev.shipTypes.filter(t => !categoryShips.includes(t))
        : [...new Set([...prev.shipTypes, ...categoryShips])]

      return { ...prev, shipTypes: newShipTypes }
    })
  }

  const toggleValueRange = (value) => {
    setLocalFilters(prev => {
      const newValueRanges = prev.valueRanges.includes(value)
        ? prev.valueRanges.filter(v => v !== value)
        : [...prev.valueRanges, value]

      return { ...prev, valueRanges: newValueRanges }
    })
  }

  const toggleSpaceType = (space) => {
    setLocalFilters(prev => ({
      ...prev,
      // Enforce single-selection for space type for clarity
      spaceTypes: prev.spaceTypes.includes(space)
        ? [] // If it's already selected, clear it
        : [space], // Otherwise, select just this one
      // Always clear regions when a space type is selected
      regionIds: []
    }));
    setRegionDropdownOpen(false);
  }

  const toggleRegion = (regionId) => {
    setLocalFilters(prev => {
      const newRegionIds = prev.regionIds.includes(regionId)
        ? prev.regionIds.filter(r => r !== regionId)
        : [...prev.regionIds, regionId]

      // Mutual exclusion: clear space when region is selected
      return { ...prev, regionIds: newRegionIds, spaceTypes: [] }
    })
  }

  const clearRegions = () => {
    setLocalFilters(prev => ({ ...prev, regionIds: [] }))
    setRegionSearch('')
  }

  // Close region dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (regionDropdownRef.current && !regionDropdownRef.current.contains(e.target)) {
        setRegionDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleRoleFilter = (role) => {
    setLocalFilters(prev => {
      const newRoleFilters = prev.roleFilters.includes(role)
        ? prev.roleFilters.filter(r => r !== role)
        : [...prev.roleFilters, role]

      return { ...prev, roleFilters: newRoleFilters }
    })
  }

  const toggleEncounterType = (type) => {
    setLocalFilters(prev => {
      const newTypes = prev.encounterTypes.includes(type)
        ? prev.encounterTypes.filter(t => t !== type)
        : [...prev.encounterTypes, type]

      return { ...prev, encounterTypes: newTypes }
    })
  }

  const toggleHideFilter = (filterType) => {
    setLocalFilters(prev => {
      return { ...prev, [filterType]: !prev[filterType] }
    })
  }

  const clearAllFilters = () => {
    const clearedFilters = {
      roleFilters: [],
      encounterTypes: [],
      shipTypes: [],
    shipTypesTarget: 'victim',
      valueRanges: [],
      spaceTypes: [],
      regionIds: [],
      hideStructures: false,
      hidePods: false,
      hideRookieShips: false
    }
    setLocalFilters(clearedFilters)
    setLocalSearchTerm('')
    setRegionSearch('')
  }

  const isCategoryActive = (category) => {
    const categoryShips = shipCategories[category].map(s => s.value)
    return categoryShips.some(shipVal => localFilters.shipTypes.includes(shipVal))
  }

  const hasActiveFilters =
    localFilters.roleFilters.length > 0 ||
    localFilters.encounterTypes.length > 0 ||
    localFilters.shipTypes.length > 0 ||
    localFilters.valueRanges.length > 0 ||
    localFilters.spaceTypes.length > 0 ||
    localFilters.regionIds.length > 0 ||
    localFilters.hideStructures ||
    localFilters.hidePods ||
    localFilters.hideRookieShips ||
    localSearchTerm !== '';

  return (
    <div className={`filters-container ${!showFilters ? 'collapsed' : ''}`}>
      {/* Search Bar */}
      <div className="filter-search">
        {showFilters && (
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Search ships, systems, characters..."
              value={localSearchTerm}
              onChange={(e) => setLocalSearchTerm(e.target.value)}
              className="search-input"
            />
            {localSearchTerm && (
              <button className="search-clear-btn" onClick={() => setLocalSearchTerm('')}>
                ×
              </button>
            )}
          </div>
        )}
        
        {hasActiveFilters && (
          <button className="clear-filters-btn" onClick={clearAllFilters}>
            Clear All
          </button>
        )}

        <button
          className="toggle-filters-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? 'Hide' : 'Filters'}
        </button>
      </div>

      {showFilters && (
        <>
        <div className="filters-layout">
          {/* Role Filters - Only show when alliances are selected */}
          {(activeAllianceIds.length > 0 || (activeCorpIds && activeCorpIds.length > 0)) && (
            <div className="filter-row">
              <span className="filter-label">ROLE</span>
              <div className="filter-group">
                {roleFilters.map(role => (
                  <button
                    key={role.value}
                    className={`filter-btn role-${role.value} ${localFilters.roleFilters.includes(role.value) ? 'active' : ''}`}
                    onClick={() => toggleRoleFilter(role.value)}
                    title={role.value === 'loss' ? 'Victim in watched alliance' : role.value === 'kill' ? 'Final blow by watched alliance' : 'Assisted by watched alliance'}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="filter-row">
            <span className="filter-label">TYPE</span>
            <div className="filter-group">
              {encounterTypes.map(type => (
                <button
                  key={type.value}
                  className={`filter-btn type-${type.value} ${localFilters.encounterTypes.includes(type.value) ? 'active' : ''}`}
                  onClick={() => toggleEncounterType(type.value)}
                  title={type.value === 'solo' ? 'Single attacker' : type.value === 'fleet' ? 'Multiple attackers' : 'NPC only'}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

      <div className="filter-row">
        <span className="filter-label">VALUE</span>
        <div className="filter-group">
          {valueRanges.map((range, index) => {
            const dist = stats?.isk_distribution?.[range.value];
            const tooltip = dist 
              ? `${range.label}\nDatabase Contribution: ${dist.percent}%\nTotal Kills: ${dist.count.toLocaleString()}`
              : `Filter by value: ${range.label}`;

            return (
              <button
                key={range.value}
                className={`filter-btn val-${index} ${localFilters.valueRanges.includes(range.value) ? 'active' : ''}`}
                onClick={() => toggleValueRange(range.value)}
                title={tooltip}
              >
                {range.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">SPACE</span>
        <div className="filter-group">
          {spaceTypes.map(space => {
            const isBlocked = (mapMode === 'kspace' && ['wh', 'ab'].includes(space.value)) ||
                              (mapMode === 'anoikis' && ['hs', 'ls', 'ns', 'poch', 'ab'].includes(space.value)) ||
                              (mapMode === 'abyssal' && ['hs', 'ls', 'ns', 'poch', 'wh'].includes(space.value)) ||
                              (mapMode === 'strategic' && ['wh', 'ab'].includes(space.value));
            
            return (
            <button
              key={space.value}
              className={`filter-btn space-${space.value.toLowerCase()} ${localFilters.spaceTypes.includes(space.value) ? 'active' : ''} ${localFilters.regionIds.length > 0 ? 'disabled-by-region' : ''}`}
              onClick={() => toggleSpaceType(space.value)}
              title={space.label === 'HS' ? 'High Sec (0.5-1.0)' : space.label === 'LS' ? 'Low Sec (0.1-0.4)' : space.label === 'NS' ? 'Null Sec (<0.0)' : space.label === 'Pochven' ? 'Pochven (Triglavian Space)' : space.label === 'WH' ? 'Wormhole' : 'Abyssal Deadspace'}
              disabled={isBlocked}
              style={isBlocked ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
            >
              {space.label}
            </button>
          )})}
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">REGION</span>
        <div className="filter-group region-filter-group" ref={regionDropdownRef}>
          {/* Selected regions pills */}
          {localFilters.regionIds.map(rid => {
            const region = REGION_BY_ID[rid]
            return region ? (
              <button
                key={rid}
                className="filter-btn region-pill active"
                onClick={() => toggleRegion(rid)}
                title={`Remove ${region.name}`}
              >
                {region.name} ×
              </button>
            ) : null
          })}

          {/* Region dropdown trigger */}
          <div className="region-dropdown-container">
            <button
              className={`filter-category-btn ${localFilters.regionIds.length > 0 ? 'active' : ''} ${localFilters.spaceTypes.length > 0 ? 'disabled-by-space' : ''}`}
              onClick={() => setRegionDropdownOpen(!regionDropdownOpen)}
              title="Filter by specific region (mutually exclusive with Space filter)"
            >
              {localFilters.regionIds.length === 0 ? 'Select Region' : '+ Add'} <span className="toggle-icon">{regionDropdownOpen ? '▼' : '▶'}</span>
            </button>

            {regionDropdownOpen && (
              <div className="region-dropdown">
                <input
                  type="text"
                  className="region-search-input"
                  placeholder="Search regions..."
                  value={regionSearch}
                  onChange={(e) => setRegionSearch(e.target.value)}
                  autoFocus
                />
                <div className="region-list">
                  {Object.entries(REGION_GROUPS).map(([groupName, regions]) => {
                    const matchingRegions = regions.filter(r =>
                      !regionSearch.trim() || r.name.toLowerCase().includes(regionSearch.toLowerCase())
                    )
                    if (matchingRegions.length === 0) return null
                    return (
                      <div key={groupName} className="region-group">
                        <div className="region-group-header">{groupName}</div>
                        {matchingRegions.map(region => (
                          <button
                            key={region.id}
                            className={`region-option ${localFilters.regionIds.includes(region.id) ? 'selected' : ''}`}
                            onClick={() => toggleRegion(region.id)}
                          >
                            {region.name}
                            {localFilters.regionIds.includes(region.id) && <span className="check">✓</span>}
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
                {localFilters.regionIds.length > 0 && (
                  <button className="region-clear-btn" onClick={clearRegions}>
                    Clear All Regions
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">HIDE</span>
        <div className="filter-group">
          <button
            className={`filter-icon-btn ${localFilters.hidePods ? 'active' : ''}`}
            onClick={() => toggleHideFilter('hidePods')}
            title="Hide Capsules"
          >
            🥚
          </button>
          <button
            className={`filter-icon-btn ${localFilters.hideStructures ? 'active' : ''}`}
            onClick={() => toggleHideFilter('hideStructures')}
            title="Hide Citadels, POS, and Deployables"
          >
            🏢
          </button>
          <button
            className={`filter-icon-btn ${localFilters.hideRookieShips ? 'active' : ''}`}
            onClick={() => toggleHideFilter('hideRookieShips')}
            title="Hide Rookie Ships, Shuttles, and Corvettes"
          >
            🚀
          </button>

          <button
            className={`filter-category-btn ${localFilters.shipTypes.length > 0 ? 'active' : ''}`}
            onClick={() => setShipClassesOpen(!shipClassesOpen)}
            title="Filter by specific ship classes"
          >
            Ship Classes <span className="toggle-icon">{shipClassesOpen ? '▼' : '▶'}</span>
          </button>
        </div>
      </div>
      </div>

      {shipClassesOpen && (
        <div className="ship-classes-expanded">
          <div className="filter-row target-toggle-row" style={{ paddingBottom: '12px' }}>
            <span className="filter-label">TARGET</span>
            <div className="filter-group">
              <button 
                className={`filter-btn ${localFilters.shipTypesTarget === 'victim' ? 'active' : ''}`}
                onClick={() => setLocalFilters(prev => ({ ...prev, shipTypesTarget: 'victim' }))}
              >
                Victim
              </button>
              <button 
                className={`filter-btn ${localFilters.shipTypesTarget === 'attacker' ? 'active' : ''}`}
                onClick={() => setLocalFilters(prev => ({ ...prev, shipTypesTarget: 'attacker' }))}
              >
                Attacker
              </button>
              <button 
                className={`filter-btn ${localFilters.shipTypesTarget === 'either' ? 'active' : ''}`}
                onClick={() => setLocalFilters(prev => ({ ...prev, shipTypesTarget: 'either' }))}
              >
                Either
              </button>
            </div>
          </div>
          <div className="filter-row">
            <div className="filter-group advanced-grid">
              {Object.entries(shipCategories).map(([category, ships]) => (
                <div key={category} className="filter-category">
                  <div className="category-header">
                    <button
                      className={`filter-category-btn ${isCategoryActive(category) ? 'active' : ''}`}
                      onClick={() => toggleCategory(category)}
                    >
                      {category}
                    </button>
                    <button 
                      className="mobile-expand-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedCategory(expandedCategory === category ? null : category);
                      }}
                    >
                      {expandedCategory === category ? '−' : '+'}
                    </button>
                  </div>
                  <div className={`filter-category-items ${expandedCategory === category ? 'mobile-visible' : ''}`}>
                    <div className="mobile-category-header">
                      <span className="mobile-category-title">{category}</span>
                      <button 
                        className="mobile-category-close"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCategory(null);
                        }}
                      >
                        ×
                      </button>
                    </div>
                    {ships.map(ship => (
                      <button
                        key={ship.value}
                        className={`filter-btn ${localFilters.shipTypes.includes(ship.value) ? 'active' : ''}`}
                        onClick={() => toggleShipType(ship.value)}
                        title={`Filter: ${ship.label}`}
                      >
                        {ship.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}

export default Filters
