import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAlliance } from '../../context/AllianceContext'
import './KillCard.css'

function KillCard({ kill }) {
  if (!kill) return null

  const {
    victim,
    attackers,
    solar_system_name,
    killmail_time,
    total_value,
    space_type,
    dropped_value,
    destroyed_value,
    victim_ship_class,
    victim_ship_class_detailed
  } = kill

  const { addAlliance, addCorp, trackedAlliances, trackedCorps, activeAllianceIds, activeCorpIds } = useAlliance()

  const finalBlow = attackers.find(a => a.final_blow) || attackers[0]
  const killDate = new Date(killmail_time)
  const attackerCount = attackers.length

  const getTrackedAlliance = (id) => {
    if (!id || id === '0') return null
    return trackedAlliances.find(ta => String(ta.id) === String(id))
  }

  const isTracked = (id) => {
    if (!id || id === '0') return false
    return activeAllianceIds.some(trackedId => String(trackedId) === String(id)) ||
           activeCorpIds.some(trackedId => String(trackedId) === String(id))
  }

  const victimTracked = getTrackedAlliance(victim.alliance_id)
  const attackerTracked = getTrackedAlliance(finalBlow.alliance_id)
  
  const isValidName = (name) => name && name !== 'None' && !name.toLowerCase().startsWith('unknown')

  // Helper for context menu actions
  const openLink = (url) => window.open(url, '_blank')

  // Context Menu State
  const [contextMenu, setContextMenu] = useState(null)
  const [activeSubmenu, setActiveSubmenu] = useState(null)
  const menuRef = useRef(null)

  const handleContextMenu = (e) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
    setActiveSubmenu(null)
  }

  useEffect(() => {
    if (contextMenu && menuRef.current) {
      const menu = menuRef.current
      const { innerWidth, innerHeight } = window
      const { offsetWidth, offsetHeight } = menu

      let newX = contextMenu.x
      let newY = contextMenu.y

      if (contextMenu.x + offsetWidth > innerWidth) {
        newX = innerWidth - offsetWidth - 5
      }
      if (contextMenu.y + offsetHeight > innerHeight) {
        newY = innerHeight - offsetHeight - 5
      }

      if (newX !== contextMenu.x || newY !== contextMenu.y) {
        setContextMenu({ x: newX, y: newY })
      }
    }
  }, [contextMenu])

  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  // Backend-aligned Ship Class Map
  const RAW_TO_DISPLAY_MAP = {
    'interceptor': 'Interceptor', 'assault_frigate': 'Assault Frigate', 'covert_ops': 'Covert Ops',
    'stealth_bomber': 'Stealth Bomber', 'electronic_attack': 'Electronic Attack', 'logistics_frigate': 'Logistics Frigate',
    'mining_frigate': 'Mining Frigate', 'expedition_frigate': 'Expedition Frigate',
    'interdictor': 'Interdictor', 'command_destroyer': 'Command Destroyer', 'tactical_destroyer': 'Tactical Destroyer',
    'logistics_destroyer': 'Logistics Destroyer',
    'heavy_assault': 'HAC', 'logistics': 'Logistics', 'force_recon': 'Force Recon', 'combat_recon': 'Combat Recon',
    'command_ship': 'Command Ship', 'strategic_cruiser': 'T3 Cruiser', 'flag_cruiser': 'Flag Cruiser',
    'attack_battlecruiser': 'Attack BC', 'battlecruiser': 'Battlecruiser',
    'battleship': 'Battleship', 'black_ops': 'Black Ops', 'marauder': 'Marauder',
    'dreadnought': 'Dreadnought', 'lancer_dreadnought': 'Lancer Dread', 'force_auxiliary': 'FAX', 
    'supercarrier': 'Supercarrier', 'titan': 'Titan', 'carrier': 'Carrier',
    'mining_barge': 'Mining Barge', 'exhumer': 'Exhumer', 'blockade_runner': 'Blockade Runner',
    'deep_space_transport': 'DST', 'industrial': 'Industrial', 'hauler': 'Hauler',
    'freighter': 'Freighter', 'jump_freighter': 'Jump Freighter', 'capital_industrial': 'Capital Industrial',
    'industrial_command': 'Industrial Command',
    'mining_expedition_frigate': 'Mining Frigate', 'ore_hauler': 'Industrial',
    'command_ind': 'Command Industrial', 'mining_haul': 'Mining Ship',
    'large_industrial_ship': 'Large Industrial', 'capsule': 'Capsule',
    'mobile_cyno': 'Mobile Cyno', 'customs_office': 'POCO', 'orbital_infrastructure': 'Skyhook',
    'shuttle': 'Shuttle', 'fighter': 'Fighter', 'light_fighter': 'Light Fighter', 'heavy_fighter': 'Heavy Fighter',
    'deployable': 'Deployable', 'structure': 'Structure', 'mobile_warp_disruptor': 'Bubble',
    'industrial_base': 'Industrial Base', 'freighter_cap': 'Freighter', 'control_tower': 'POS Tower',
    'starbase_structure': 'POS Mod', 'sentry_gun': 'Sentry Gun', 
    'mobile_tractor_unit': 'MTU', 'mobile_observatory': 'Mobile Observatory',
    'rookie_ship': 'Corvette', 'frigate': 'Frigate', 'destroyer': 'Destroyer', 'cruiser': 'Cruiser',
    'faction_frigate': 'Faction Frigate', 'faction_cruiser': 'Faction Cruiser', 'faction_battlecruiser': 'Faction BC',
    'faction_battleship': 'Faction BS', 'heavy_interdiction_cruiser': 'HIC'
  }
  
  // Format Time (HH:MM)
  const timeString = killDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  
  // Format Time Ago
  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  // Format ISK
  const formatISK = (n) => {
    if (n >= 1e12) return <>{(n / 1e12).toFixed(2)}<span className="unit">T</span></>
    if (n >= 1e9) return <>{(n / 1e9).toFixed(2)}<span className="unit">B</span></>
    if (n >= 1e6) return <>{(n / 1e6).toFixed(2)}<span className="unit">M</span></>
    return <>{(n / 1e3).toFixed(0)}<span className="unit">K</span></>
  }

  // Get ISK Color Class
  const getIskColorClass = (amount) => {
    if (amount >= 50000000000) return 'isk-white'  // 50B+
    if (amount >= 20000000000) return 'isk-red'    // 20B-50B
    if (amount >= 10000000000) return 'isk-orange' // 10B-20B
    if (amount >= 1000000000) return 'isk-yellow'  // 1B-10B
    if (amount >= 100000000) return 'isk-green'    // 100M-1B
    if (amount >= 10000000) return 'isk-blue'      // 10M-100M
    return 'isk-grey'                              // < 10M
  }

  // Get Ship Class Color Class
  const getShipClassColorClass = (shipName, backendClass = null) => {
    if (backendClass) {
        const c = backendClass.toLowerCase();
        if (['frigate','assault_frigate','covert_ops','interceptor','logistics_frigate','stealth_bomber','electronic_attack','rookie_ship','mining_frigate','faction_frigate','expedition_frigate'].includes(c)) return 'ship-frigate';
        if (['destroyer','interdictor','command_destroyer','tactical_destroyer','logistics_destroyer'].includes(c)) return 'ship-destroyer';
        if (['cruiser','command_ship','heavy_assault','logistics','force_recon','combat_recon','strategic_cruiser','flag_cruiser','faction_cruiser','heavy_interdiction_cruiser','heavy_assault_cruiser','combat_recon_ship','force_recon_ship','logistics_cruiser'].includes(c)) return 'ship-cruiser';
        if (['battlecruiser','attack_battlecruiser','faction_battlecruiser','combat_battlecruiser'].includes(c)) return 'ship-bc';
        if (['battleship','black_ops','marauder','faction_battleship'].includes(c)) return 'ship-bs';
        if (['dreadnought','carrier','force_auxiliary','lancer_dreadnought','fax','capital_industrial','supercarrier','titan','super'].includes(c)) return 'ship-capital';
        if (['industrial','transport','freighter','mining','mining_barge','exhumer','hauler','blockade_runner','deep_space_transport','industrial_command','jump_freighter'].includes(c)) return 'ship-industrial';
        if (['capsule'].includes(c)) return 'ship-capsule';
        if (['shuttle'].includes(c)) return 'ship-shuttle';
        if (['fighter','light_fighter','heavy_fighter'].includes(c)) return 'ship-fighter';
        if (['structure','citadel','engineering_complex','refinery','starbase','control_tower','mobile_depot','mobile_tractor_unit','mobile_cyno','mobile_observatory'].includes(c)) return 'ship-structure';
    }

    if (!shipName) return 'ship-unknown'
    const clean = shipName.toLowerCase()
    if (clean.includes('frigate') || clean.includes('interceptor') || clean.includes('covert')) return 'ship-frigate'
    if (clean.includes('destroyer') || clean.includes('interdictor')) return 'ship-destroyer'
    if (clean.includes('cruiser') || clean.includes('recon') || clean.includes('stratios')) return 'ship-cruiser'
    if (clean.includes('battlecruiser') || clean.includes('gnosis')) return 'ship-bc'
    if (clean.includes('battleship') || clean.includes('marauder') || clean.includes('praxis')) return 'ship-bs'
    if (clean.includes('dreadnought') || clean.includes('carrier') || clean.includes('titan') || clean.includes('super') || clean.includes('fax') || clean.includes('auxiliary')) return 'ship-capital'
    if (clean.includes('industrial') || clean.includes('transport') || clean.includes('freighter') || clean.includes('hauler') || clean.includes('mining')) return 'ship-industrial'
    if (clean.includes('capsule')) return 'ship-capsule'
    if (clean.includes('shuttle')) return 'ship-shuttle'
    if (clean.includes('fighter')) return 'ship-fighter'
    return 'ship-unknown'
  }

  // Get Ship Class Display Name
  const getShipClassDisplay = (shipName, backendClass = null) => {
    // Prefer backend classification if available
    if (backendClass && RAW_TO_DISPLAY_MAP[backendClass]) return RAW_TO_DISPLAY_MAP[backendClass];
    
    if (!shipName) return 'Unknown'
    const clean = shipName.toLowerCase()
    if (clean.includes('frigate') || clean.includes('interceptor') || clean.includes('covert')) return 'Frigate'
    if (clean.includes('destroyer') || clean.includes('interdictor')) return 'Destroyer'
    if (clean.includes('cruiser') || clean.includes('recon') || clean.includes('stratios')) return 'Cruiser'
    if (clean.includes('battlecruiser') || clean.includes('gnosis')) return 'Battlecruiser'
    if (clean.includes('battleship') || clean.includes('marauder') || clean.includes('praxis')) return 'Battleship'
    if (clean.includes('dreadnought') || clean.includes('carrier') || clean.includes('titan') || clean.includes('super') || clean.includes('fax') || clean.includes('auxiliary')) return 'Capital'
    if (clean.includes('industrial') || clean.includes('transport') || clean.includes('freighter') || clean.includes('hauler') || clean.includes('mining')) return 'Industrial'
    if (clean.includes('capsule')) return 'Capsule'
    if (clean.includes('shuttle')) return 'Shuttle'
    if (clean.includes('fighter')) return 'Fighter'
    return 'Ship'
  }

  // Get Security Color Class
  const getSecurityClass = (type) => {
    switch (type) {
      case 'highsec': return 'sec-hs'
      case 'lowsec': return 'sec-ls'
      case 'nullsec': return 'sec-ns'
      case 'pochven': return 'sec-poch'
      case 'wormhole': return 'sec-wh'
      case 'abyssal': return 'sec-ab'
      default: return 'sec-unknown'
    }
  }

  // Get System Name Color Class
  const getSystemColorClass = (type) => {
    switch (type) {
      case 'highsec': return 'text-sec-hs'
      case 'lowsec': return 'text-sec-ls'
      case 'nullsec': return 'text-sec-ns'
      case 'pochven': return 'text-sec-poch'
      case 'wormhole': return 'text-sec-wh'
      case 'abyssal': return 'text-sec-ab'
      default: return 'text-sec-unknown'
    }
  }

  // Fleet Comp Logic
  const getFleetComp = () => {
    if (attackerCount <= 1) return null
    const counts = {}
    attackers.forEach(a => {
      if (a.ship_type_id && !a.is_npc) { // Include all player ships
        const allianceIdStr = String(a.alliance_id || 0)
        const corpIdStr = String(a.corporation_id || 0)

        // Check if this attacker belongs to a tracked alliance
        let trackedData = trackedAlliances.find(ta => String(ta.id) === allianceIdStr && activeAllianceIds.some(id => String(id) === String(ta.id)))
        
        // If not alliance tracked, check if belongs to a tracked corp
        if (!trackedData) {
            trackedData = trackedCorps.find(tc => String(tc.id) === corpIdStr && activeCorpIds.some(id => String(id) === String(tc.id)))
        }
        
        // Group key: ShipID + (TrackedID if tracked, else 'neutral')
        const key = trackedData 
            ? `${a.ship_type_id}_${trackedData.id}` 
            : `${a.ship_type_id}_neutral`

        if (!counts[key]) {
          counts[key] = { 
            id: a.ship_type_id, 
            count: 0, 
            name: a.ship_type_name || 'Unknown Ship',
            trackedData, // Pass entity data for color/tooltip
            pilots: []
          }
        }
        counts[key].count += 1
        if (trackedData && a.character_name) {
            counts[key].pilots.push(a.character_name)
        }
      }
    })
    return Object.values(counts)
      .sort((a, b) => {
          // Prioritize tracked groups first
          if (a.trackedData && !b.trackedData) return -1
          if (!a.trackedData && b.trackedData) return 1
          return b.count - a.count
      })
      .slice(0, 14) // Increased limit for "as much detail as possible"
  }

  // Determine Roles based on tracked alliances
  const victimIsTracked = isTracked(victim.alliance_id)
  const finalBlowIsTracked = isTracked(finalBlow.alliance_id)
  
  const assistingAllianceIds = [...new Set(
    attackers
      .filter(a => isTracked(a.alliance_id) && !a.final_blow)
      .map(a => String(a.alliance_id))
  )]

  const isLoss = victimIsTracked
  const isKill = finalBlowIsTracked
  const isAssist = assistingAllianceIds.length > 0 ? assistingAllianceIds : false

  // Stack Label Logic
  const getStackLabel = (isVictim) => {
    // 1. Backend-provided relation (The Source of Truth)
    if (kill._relation) {
      if (isVictim) {
        return kill._relation === 'loss' 
          ? <div className="stack-label label-loss">LOSS</div>
          : <div className="stack-label label-neutral">LOSS</div>
      } else {
        if (kill._relation === 'kill') return <div className="stack-label label-kill">KILL</div>
        if (kill._relation === 'assist') return <div className="stack-label label-assist">ASSIST</div>
        return <div className="stack-label label-neutral">KILL</div>
      }
    }

    // 2. Standard Mode (No alliances/corps tracked)
    if (activeAllianceIds.length === 0 && activeCorpIds.length === 0) {
      if (isVictim) return <div className="stack-label label-loss">LOSS</div>
      return <div className="stack-label label-kill">KILL</div>
    }
    
    // 3. Tracked Mode (Fallback)
    if (isVictim) {
      if (isLoss) return <div className="stack-label label-loss">LOSS</div>
      return <div className="stack-label label-neutral">LOSS</div>
    } else {
      if (isKill) return <div className="stack-label label-kill">KILL</div>
      if (isAssist) return <div className="stack-label label-assist">ASSIST</div>
      return <div className="stack-label label-neutral">KILL</div>
    }
  }

  return (
    <div 
      className={`kill-card ${getSecurityClass(space_type)}`} 
      onClick={() => window.open(`https://zkillboard.com/kill/${kill.killmail_id}/`, '_blank')}
      onContextMenu={handleContextMenu}
    >
      <div className="kill-card-bg"></div>
      
      {/* LEFT: VICTIM */}
      <div className="card-section left">
        <div className="visual-stack">
          <div className="ship-icon-wrapper">
            {getStackLabel(true)}
            <img 
              src={`https://images.evetech.net/types/${victim.ship_type_id}/render?size=128`} 
              alt={victim.ship_type_name} 
              loading="lazy" className="ship-icon"
              onError={(e) => { e.target.style.display = 'none' }}
              title={`Ship: ${victim.ship_type_name} (${getShipClassDisplay(victim.ship_type_name, victim_ship_class_detailed || victim_ship_class)})\nPilot: ${victim.character_name}\nCorp: ${victim.corporation_name}`}
            />
            {/* Emblem Logic: Alliance -> Corp -> None */}
            {victim.alliance_id && victim.alliance_id !== '0' ? (
              <>
                <img 
                  src={`https://images.evetech.net/alliances/${victim.alliance_id}/logo?size=64`} 
                  loading="lazy" className="alliance-overlay" 
                  alt="" 
                  style={victimTracked ? { borderColor: victimTracked.color, boxShadow: `0 0 4px ${victimTracked.color}60` } : {}}
                />
                {victim.corporation_id && victim.corporation_id !== '0' && (
                  <img 
                    src={`https://images.evetech.net/corporations/${victim.corporation_id}/logo?size=64`} 
                    loading="lazy" className="corp-overlay-sub" 
                    alt="" 
                  />
                )}
              </>
            ) : (victim.corporation_id && victim.corporation_id !== '0' && (
              <img src={`https://images.evetech.net/corporations/${victim.corporation_id}/logo?size=64`} loading="lazy" className="alliance-overlay" alt="" />
            ))}
          </div>
          <div className={`ship-label ${getShipClassColorClass(victim.ship_type_name, victim_ship_class_detailed || victim_ship_class)}`}>{victim.ship_type_name}</div>
        </div>
        <div className="info-block">
          {victim.character_id && (
            <img 
              src={`https://images.evetech.net/characters/${victim.character_id}/portrait?size=128`} 
              alt="" 
              loading="lazy" className="bg-portrait"
            />
          )}
          <div className="char-name" title={victim.character_name}>{victim.character_name}</div>
          <div className={`ship-class ${getShipClassColorClass(victim.ship_type_name, victim_ship_class_detailed || victim_ship_class)}`} title={victim.ship_type_name}>
            {getShipClassDisplay(victim.ship_type_name, victim_ship_class_detailed || victim_ship_class)}
          </div>
          
          {isValidName(victim.corporation_name) && (
            <div className="corp-line" title={victim.corporation_name}>
              {victim.corporation_id && <img src={`https://images.evetech.net/corporations/${victim.corporation_id}/logo?size=32`} loading="lazy" className="corp-icon" alt="" />}
              <span className="corp-name">{victim.corporation_name}</span>
            </div>
          )}
          
          {victim.alliance_id && victim.alliance_id !== '0' && isValidName(victim.alliance_name) && (
            <div className="alliance-name" 
                 title={victim.alliance_name}
                 style={victimTracked ? { color: victimTracked.color, textShadow: `0 0 10px ${victimTracked.color}40` } : {}}>
              {victim.alliance_name}
            </div>
          )}
        </div>
        
        {/* EXPANDED DETAILS (Left) - Visible on large screens */}
        <div className="expanded-details left">
            <div className="detail-row centered">
                <span className="detail-label" title="Value Breakdown">DESTROYED / DROPPED</span>
                <div className="isk-breakdown centered">
                    <span className="destroyed" title={`Destroyed: ${formatISK(destroyed_value || total_value)} (${((destroyed_value/total_value)*100).toFixed(0)}%)`}>{formatISK(destroyed_value || total_value)}</span> / <span className="dropped" title={`Dropped: ${formatISK(dropped_value || 0)} (${((dropped_value/total_value)*100).toFixed(0)}%)`}>{formatISK(dropped_value || 0)}</span>
                </div>
            </div>
            <div className="detail-row centered" onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); window.open(`https://zkillboard.com/kill/${kill.killmail_id}/`, '_blank'); }}>
                <span className="detail-label">FITTING</span>
                <span className="detail-value" title="Right-click to view full fitting on zKillboard">{victim.items ? `${victim.items.length} Items` : 'Unknown'}</span>
            </div>
        </div>
      </div>

      {/* CENTER: STATS */}
      <div className="card-section center">
        <div className={`isk-value ${getIskColorClass(total_value)}`}>
          {formatISK(total_value)}
        </div>
        <div className={`system-name ${getSystemColorClass(space_type)}`} title={`System: ${solar_system_name} (${space_type})`}>{solar_system_name}</div>
        <div className="kill-time" title={`Exact Time: ${killDate.toLocaleString()}`}>{timeString}</div>
        <div className="time-ago" title={killDate.toLocaleString()}>{getTimeAgo(killDate)}</div>
      </div>

      {/* RIGHT: KILLER */}
      <div className="card-section right">
        {/* EXPANDED DETAILS (Right) - Visible on large screens */}
        <div className="expanded-details right">
            {attackerCount > 1 ? (
                <div className="detail-row centered">
                    <span className="detail-label">FLEET COMPOSITION</span>
                    <div className="fleet-comp expanded">
                      {getFleetComp().map(({ id, count, name, trackedData, pilots }) => (
                        <div 
                            key={`${id}_${trackedData ? trackedData.id : 'n'}`} 
                            className="fleet-item" 
                            title={trackedData ? `${count}x ${name}\n[${trackedData.ticker || trackedData.name}]\n${pilots.join(', ')}` : `${count}x ${name}`}
                            style={trackedData ? { borderColor: trackedData.color, boxShadow: `0 0 4px ${trackedData.color}40` } : {}}
                        >
                          <img src={`https://images.evetech.net/types/${id}/icon?size=32`} loading="lazy" className="fleet-icon" alt="" />
                          {count > 1 && <span className="fleet-count">{count}</span>}
                        </div>
                      ))}
                    </div>
                </div>
            ) : (
                <>
                    <div className="detail-row centered">
                        <span className="detail-value">{finalBlow.damage_done ? finalBlow.damage_done.toLocaleString() : '0'}</span>
                        <span className="detail-label">DAMAGE DEALT</span>
                    </div>
                    <div className="detail-row centered">
                        <div className="weapon-info">
                            {finalBlow.weapon_type_id && <img src={`https://images.evetech.net/types/${finalBlow.weapon_type_id}/icon?size=32`} loading="lazy" className="weapon-icon" alt="" />}
                            <span className="detail-value">{finalBlow.weapon_type_name || 'Unknown Weapon'}</span>
                        </div>
                    </div>
                </>
            )}
        </div>

        <div className="info-block right-align">
          {finalBlow.character_id && (
            <img 
              src={`https://images.evetech.net/characters/${finalBlow.character_id}/portrait?size=128`} 
              alt="" 
              loading="lazy" className="bg-portrait"
            />
          )}
          
          {attackerCount === 1 && !finalBlow.is_npc && <div className="kill-label label-solo">SOLO KILL</div>}
          {finalBlow.is_npc && <div className="kill-label label-npc">NPC KILL</div>}
          
          <div className="char-name">
            <span title={finalBlow.character_name}>{finalBlow.character_name}</span>
          </div>
          {attackerCount > 1 && <div className="plus-x">+{attackerCount - 1}</div>}
          <div className={`ship-class ${getShipClassColorClass(finalBlow.ship_type_name, finalBlow.ship_class_detailed || finalBlow.ship_class)}`} title={finalBlow.ship_type_name}>
            {getShipClassDisplay(finalBlow.ship_type_name, finalBlow.ship_class_detailed || finalBlow.ship_class)}
          </div>
          
          {isValidName(finalBlow.corporation_name) && (
            <div className="corp-line right-align" title={finalBlow.corporation_name}>
              <span className="corp-name">{finalBlow.corporation_name}</span>
              {finalBlow.corporation_id && <img src={`https://images.evetech.net/corporations/${finalBlow.corporation_id}/logo?size=32`} loading="lazy" className="corp-icon" alt="" />}
            </div>
          )}
          
          {finalBlow.alliance_id && finalBlow.alliance_id !== '0' && isValidName(finalBlow.alliance_name) && (
            <div className="alliance-name" 
                 title={finalBlow.alliance_name}
                 style={attackerTracked ? { color: attackerTracked.color, textShadow: `0 0 10px ${attackerTracked.color}40` } : {}}>
              {finalBlow.alliance_name}
            </div>
          )}
          
          {/* Show compact fleet comp on small screens, hide on large (handled by expanded-details) */}
          {getFleetComp() && attackerCount > 1 && (
            <div className="fleet-comp">
              {getFleetComp().map(({ id, count, name, trackedData, pilots }) => (
                <div 
                    key={`${id}_${trackedData ? trackedData.id : 'n'}`} 
                    className="fleet-item" 
                    title={trackedData ? `${count}x ${name}\n${pilots.join(', ')}` : `${count}x ${name}`}
                    style={trackedData ? { borderColor: trackedData.color } : {}}
                >
                  <img src={`https://images.evetech.net/types/${id}/icon?size=32`} loading="lazy" className="fleet-icon" alt="" />
                  {count > 1 && <span className="fleet-count">{count}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="visual-stack">
          <div className="ship-icon-wrapper">
            {getStackLabel(false)}
            <img 
              src={`https://images.evetech.net/types/${finalBlow.ship_type_id}/render?size=128`} 
              alt={finalBlow.ship_type_name} 
              loading="lazy" className="ship-icon"
              onError={(e) => { e.target.style.display = 'none' }}
              title={`Ship: ${finalBlow.ship_type_name} (${getShipClassDisplay(finalBlow.ship_type_name)})\nPilot: ${finalBlow.character_name}\nCorp: ${finalBlow.corporation_name}`}
            />
            {/* Emblem Logic: Alliance -> Corp -> None */}
            {finalBlow.alliance_id && finalBlow.alliance_id !== '0' ? (
              <>
                <img 
                  src={`https://images.evetech.net/alliances/${finalBlow.alliance_id}/logo?size=64`} 
                  loading="lazy" className="alliance-overlay" 
                  alt="" 
                  style={attackerTracked ? { borderColor: attackerTracked.color, boxShadow: `0 0 4px ${attackerTracked.color}60` } : {}}
                />
                {finalBlow.corporation_id && finalBlow.corporation_id !== '0' && (
                  <img 
                    src={`https://images.evetech.net/corporations/${finalBlow.corporation_id}/logo?size=64`} 
                    loading="lazy" className="corp-overlay-sub" 
                    alt="" 
                  />
                )}
              </>
            ) : (finalBlow.corporation_id && finalBlow.corporation_id !== '0' && (
              <img src={`https://images.evetech.net/corporations/${finalBlow.corporation_id}/logo?size=64`} loading="lazy" className="alliance-overlay" alt="" />
            ))}
          </div>
          <div className={`ship-label ${getShipClassColorClass(finalBlow.ship_type_name, finalBlow.ship_class_detailed || finalBlow.ship_class)}`}>{finalBlow.ship_type_name}</div>
        </div>
      </div>

      {/* Custom Context Menu */}
      {contextMenu && createPortal(
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <div className="context-header">Killmail #{kill.killmail_id}</div>
          <div className="context-item" onClick={() => openLink(`https://zkillboard.com/kill/${kill.killmail_id}/`)}>Open in zKillboard</div>
          <div className="context-item" onClick={() => navigator.clipboard.writeText(`https://zkillboard.com/kill/${kill.killmail_id}/`)}>Copy Link</div>
          <div className="context-item" onClick={() => openLink(`https://zkillboard.com/kill/${kill.killmail_id}/`)}>View Fitting</div>

          <div className="context-separator"></div>

          {/* VICTIM SUBMENU */}
          <div className={`context-submenu ${activeSubmenu === 'victim' ? 'open' : ''}`}>
            <div className="context-submenu-header" onClick={() => setActiveSubmenu(activeSubmenu === 'victim' ? null : 'victim')}>
              <span className="submenu-arrow">{activeSubmenu === 'victim' ? '▼' : '▶'}</span>
              <span className="submenu-label" style={{color:'#ef4444'}}>Victim:</span>
              <span className="submenu-name">{victim.character_name}</span>
            </div>
            {activeSubmenu === 'victim' && (
              <div className="context-submenu-items">
                {victim.character_id && (
                  <>
                    <div className="context-item sub" onClick={() => openLink(`https://zkillboard.com/character/${victim.character_id}/`)}>zKillboard</div>
                    <div className="context-item sub" onClick={() => openLink(`https://evewho.com/character/${victim.character_id}`)}>EveWho</div>
                  </>
                )}
                {victim.corporation_id && <div className="context-item sub" onClick={() => openLink(`https://zkillboard.com/corporation/${victim.corporation_id}/`)}>Corp: {victim.corporation_name}</div>}
                {victim.alliance_id && <div className="context-item sub" onClick={() => openLink(`https://zkillboard.com/alliance/${victim.alliance_id}/`)}>Alliance: {victim.alliance_name}</div>}
                {!getTrackedAlliance(victim.alliance_id) && victim.alliance_id && victim.alliance_id !== '0' && (
                  <div className="context-item sub context-item-action" onClick={() => { addAlliance({ id: victim.alliance_id, name: victim.alliance_name }); setContextMenu(null); }}>
                    <span>+</span> Track Alliance
                  </div>
                )}
                {victim.corporation_id && victim.corporation_id !== '0' && !trackedCorps.some(c => String(c.id) === String(victim.corporation_id)) && (
                  <div className="context-item sub context-item-action" onClick={() => { addCorp({ id: victim.corporation_id, name: victim.corporation_name }); setContextMenu(null); }}>
                    <span>+</span> Track Corporation
                  </div>
                )}
              </div>
            )}
          </div>

          {/* KILLER SUBMENU */}
          <div className={`context-submenu ${activeSubmenu === 'killer' ? 'open' : ''}`}>
            <div className="context-submenu-header" onClick={() => setActiveSubmenu(activeSubmenu === 'killer' ? null : 'killer')}>
              <span className="submenu-arrow">{activeSubmenu === 'killer' ? '▼' : '▶'}</span>
              <span className="submenu-label" style={{color:'#4ade80'}}>Killer:</span>
              <span className="submenu-name">{finalBlow.character_name || finalBlow.ship_type_name || 'NPC'}</span>
            </div>
            {activeSubmenu === 'killer' && (
              <div className="context-submenu-items">
                {finalBlow.character_id && (
                  <>
                    <div className="context-item sub" onClick={() => openLink(`https://zkillboard.com/character/${finalBlow.character_id}/`)}>zKillboard</div>
                    <div className="context-item sub" onClick={() => openLink(`https://evewho.com/character/${finalBlow.character_id}`)}>EveWho</div>
                  </>
                )}
                {finalBlow.corporation_id && <div className="context-item sub" onClick={() => openLink(`https://zkillboard.com/corporation/${finalBlow.corporation_id}/`)}>Corp: {finalBlow.corporation_name}</div>}
                {finalBlow.alliance_id && <div className="context-item sub" onClick={() => openLink(`https://zkillboard.com/alliance/${finalBlow.alliance_id}/`)}>Alliance: {finalBlow.alliance_name}</div>}
                {!getTrackedAlliance(finalBlow.alliance_id) && finalBlow.alliance_id && finalBlow.alliance_id !== '0' && (
                  <div className="context-item sub context-item-action" onClick={() => { addAlliance({ id: finalBlow.alliance_id, name: finalBlow.alliance_name }); setContextMenu(null); }}>
                    <span>+</span> Track Alliance
                  </div>
                )}
                {finalBlow.corporation_id && finalBlow.corporation_id !== '0' && !trackedCorps.some(c => String(c.id) === String(finalBlow.corporation_id)) && (
                  <div className="context-item sub context-item-action" onClick={() => { addCorp({ id: finalBlow.corporation_id, name: finalBlow.corporation_name }); setContextMenu(null); }}>
                    <span>+</span> Track Corporation
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SYSTEM SUBMENU */}
          <div className={`context-submenu ${activeSubmenu === 'system' ? 'open' : ''}`}>
            <div className="context-submenu-header" onClick={() => setActiveSubmenu(activeSubmenu === 'system' ? null : 'system')}>
              <span className="submenu-arrow">{activeSubmenu === 'system' ? '▼' : '▶'}</span>
              <span className="submenu-label">System:</span>
              <span className="submenu-name">{solar_system_name}</span>
            </div>
            {activeSubmenu === 'system' && (
              <div className="context-submenu-items">
                <div className="context-item sub" onClick={() => { navigator.clipboard.writeText(solar_system_name); setContextMenu(null); }}>Copy Name</div>
                <div className="context-item sub" onClick={() => openLink(`https://zkillboard.com/system/${kill.solar_system_id}/`)}>zKillboard</div>
              </div>
            )}
          </div>
        </div>
      , document.body)}
    </div>
  )
}

export default KillCard
