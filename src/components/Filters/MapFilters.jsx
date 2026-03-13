import { useState, useEffect } from 'react'
import { useAlliance } from '../../context/AllianceContext'
import './Filters.css'

export default function MapFilters({ onDebouncedFiltersChange, stats }) {
  const { activeAllianceIds, activeCorpIds } = useAlliance()
  const [localFilters, setLocalFilters] = useState({
    roleFilters: [],
    encounterTypes: [],
    shipTypes: [],
    shipTypesTarget: 'victim',
    valueRanges: [],
    spaceTypes: [],
    hideStructures: false,
    hidePods: false,
    hideRookieShips: false
  })

  const [showFilters, setShowFilters] = useState(true)
  const [shipClassesOpen, setShipClassesOpen] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState(null)
  const [localSearchTerm, setLocalSearchTerm] = useState('')

  useEffect(() => {
    const handler = setTimeout(() => {
      onDebouncedFiltersChange?.({ ...localFilters, searchTerm: localSearchTerm });
    }, 500); // 500ms debounce delay for all filters

    return () => {
      clearTimeout(handler);
    };
  }, [localFilters, localSearchTerm, onDebouncedFiltersChange]);



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
    { label: 'WH', value: 'wh' },
    { label: 'Abyssal', value: 'ab' }
  ]

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
    setLocalFilters(prev => {
      const newSpaceTypes = prev.spaceTypes.includes(space)
        ? prev.spaceTypes.filter(s => s !== space)
        : [...prev.spaceTypes, space]

      return { ...prev, spaceTypes: newSpaceTypes }
    })
  }

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
      hideStructures: false,
      hidePods: false,
      hideRookieShips: false
    }
    setLocalFilters(clearedFilters)
    setLocalSearchTerm('')
  }

  const isCategoryActive = (category) => {
    const categoryShips = shipCategories[category].map(s => s.value)
    return categoryShips.some(shipVal => localFilters.shipTypes.includes(shipVal))
  }

  return (
    <div className="filters-container map-filters">
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
          {spaceTypes.map(space => (
            <button
              key={space.value}
              className={`filter-btn space-${space.value.toLowerCase()} ${localFilters.spaceTypes.includes(space.value) ? 'active' : ''}`}
              onClick={() => toggleSpaceType(space.value)}
              title={space.label === 'HS' ? 'High Sec (0.5-1.0)' : space.label === 'LS' ? 'Low Sec (0.1-0.4)' : space.label === 'NS' ? 'Null Sec (<0.0)' : space.label === 'WH' ? 'Wormhole' : 'Abyssal Deadspace'}
            >
              {space.label}
            </button>
          ))}
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
