import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAlliance } from '../../context/AllianceContext';
import './MosaicCard.css';

// --- HELPER FOR FLEET COMP (Full implementation for detailed tooltips) ---
const getFleetComp = (attackers, trackedAlliances, trackedCorps, activeAllianceIds, activeCorpIds) => {
    if (!attackers || attackers.length <= 1) return null;
    const counts = {};
    attackers.forEach(a => {
      if (a.ship_type_id && !a.is_npc) {
        const allianceIdStr = String(a.alliance_id || 0);
        const corpIdStr = String(a.corporation_id || 0);
        
        let trackedData = trackedAlliances.find(ta => String(ta.id) === allianceIdStr && activeAllianceIds.some(id => String(id) === String(ta.id)));
        if (!trackedData) {
            trackedData = trackedCorps.find(tc => String(tc.id) === corpIdStr && activeCorpIds.some(id => String(id) === String(tc.id)));
        }
        
        const key = trackedData ? `${a.ship_type_id}_${trackedData.id}` : `${a.ship_type_id}_neutral`;

        if (!counts[key]) {
          counts[key] = { 
            id: a.ship_type_id, 
            count: 0, 
            name: a.ship_type_name || 'Unknown Ship',
            trackedData, 
            pilots: []
          };
        }
        counts[key].count += 1;
        if (trackedData && a.character_name) counts[key].pilots.push(a.character_name);
      }
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 16); // Show up to 16 groups
};

// --- TOOLTIP COMPONENT ---
export const KillTooltip = ({ data, position }) => {
  if (!data) return null;
  const { trackedAlliances, trackedCorps, activeAllianceIds, activeCorpIds } = useAlliance();

  const victim = data.victim || {};
  const finalBlow = data.attackers?.find(a => a.final_blow) || data.attackers?.[0] || {};
  const attackerCount = data.attackers?.length || 1;
  const fleetCount = attackerCount - 1;
  const fleetComp = getFleetComp(data.attackers, trackedAlliances, trackedCorps, activeAllianceIds, activeCorpIds);

  const getSystemColorClass = (type) => {
    switch (type) {
      case 'highsec': return 'text-sec-hs';
      case 'lowsec': return 'text-sec-ls';
      case 'nullsec': return 'text-sec-ns';
      case 'pochven': return 'text-sec-poch';
      case 'wormhole': return 'text-sec-wh';
      case 'abyssal': return 'text-sec-ab';
      default: return 'text-sec-unknown';
    }
  };

  const systemColorClass = getSystemColorClass(data.space_type);

  const style = { top: position.y, left: position.x + 20 };
  if (window.innerWidth - position.x < 360) {
      style.left = 'auto';
      style.right = window.innerWidth - position.x + 20;
  }

  const formatISK = (val) => {
    if (val >= 1e9) return (val / 1e9).toFixed(2) + 'b';
    if (val >= 1e6) return (val / 1e6).toFixed(2) + 'm';
    if (val >= 1e3) return (val / 1e3).toFixed(0) + 'k';
    return Math.floor(val).toLocaleString();
  };

  return createPortal(
    <div className="mosaic-tooltip" style={style}>
      <div className="mt-header">
        <div>
           <div className={`mt-system ${systemColorClass}`}>{data.solar_system_name}</div>
           <div className="mt-region">{data.region_name || 'Unknown Region'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
           <div className="mt-value">{formatISK(data.total_value)} ISK</div>
           <div className="mt-time">{new Date(data.killmail_time).toLocaleTimeString()}</div>
        </div>
      </div>
      <div className="mt-body">
         <div className="mt-pilot-col">
            <div className="mt-img-stack">
               <img src={`https://images.evetech.net/types/${victim.ship_type_id}/render?size=64`} className="mt-ship-img" style={{ borderColor: 'rgba(248, 113, 113, 0.5)' }} alt="" />
               <img src={`https://images.evetech.net/characters/${victim.character_id}/portrait?size=32`} className="mt-char-img" alt="" />
            </div>
            <div className="mt-name" style={{ color: '#f87171' }}>{victim.character_name}</div>
            <div className="mt-ship-type">{victim.ship_type_name}</div>
            
            <div className="mt-org-row">
                {victim.alliance_id && victim.alliance_id !== '0' && (
                    <img src={`https://images.evetech.net/alliances/${victim.alliance_id}/logo?size=32`} className="mt-org-logo" alt={victim.alliance_name} title={victim.alliance_name} />
                )}
                {victim.corporation_id && (
                    <img src={`https://images.evetech.net/corporations/${victim.corporation_id}/logo?size=32`} className="mt-org-logo" alt={victim.corporation_name} title={victim.corporation_name} />
                )}
            </div>
            <div className="mt-org-text">
                {victim.alliance_id && victim.alliance_id !== '0' && <div className="mt-alliance-name">{victim.alliance_name}</div>}
                <div className="mt-corp-name">{victim.corporation_name}</div>
            </div>
         </div>

         <div className="mt-vs-col">
            <div className="mt-vs-label">KILLED BY</div>
         </div>

         <div className="mt-pilot-col">
            <div className="mt-img-stack">
               <img src={`https://images.evetech.net/types/${finalBlow.ship_type_id}/render?size=64`} className="mt-ship-img" style={{ borderColor: 'rgba(74, 222, 128, 0.5)' }} alt="" />
               <img src={`https://images.evetech.net/characters/${finalBlow.character_id}/portrait?size=32`} className="mt-char-img" alt="" />
               {fleetCount > 0 && <div className="mt-badge">+{fleetCount}</div>}
            </div>
            <div className="mt-name" style={{ color: '#4ade80' }}>{finalBlow.character_name}</div>
            <div className="mt-ship-type">{finalBlow.ship_type_name}</div>
            
            <div className="mt-org-row">
                {finalBlow.alliance_id && finalBlow.alliance_id !== '0' && (
                    <img src={`https://images.evetech.net/alliances/${finalBlow.alliance_id}/logo?size=32`} className="mt-org-logo" alt={finalBlow.alliance_name} title={finalBlow.alliance_name} />
                )}
                {finalBlow.corporation_id && (
                    <img src={`https://images.evetech.net/corporations/${finalBlow.corporation_id}/logo?size=32`} className="mt-org-logo" alt={finalBlow.corporation_name} title={finalBlow.corporation_name} />
                )}
            </div>
            <div className="mt-org-text">
                {finalBlow.alliance_id && finalBlow.alliance_id !== '0' && <div className="mt-alliance-name">{finalBlow.alliance_name}</div>}
                <div className="mt-corp-name">{finalBlow.corporation_name}</div>
            </div>
         </div>
      </div>
      
      {fleetComp && (
          <div className="mt-footer">
              <div className="mt-label-row">
                  <span className="mt-label">INVOLVED</span>
                  <span className="mt-label" style={{ color: '#94a3b8' }}>{attackerCount} Pilots</span>
              </div>
              <div className="mt-fleet-grid">
                  {fleetComp.map(({ id, count, name, trackedData, pilots }) => (
                    <div 
                        key={`${id}_${trackedData ? trackedData.id : 'n'}`} 
                        className="mt-fleet-item" 
                        title={trackedData ? `${count}x ${name}\n[${trackedData.ticker || trackedData.name}]\n${pilots.join(', ')}` : `${count}x ${name}`}
                        style={trackedData ? { borderColor: trackedData.color, boxShadow: `0 0 4px ${trackedData.color}40` } : {}}
                    >
                      <img src={`https://images.evetech.net/types/${id}/icon?size=32`} className="mt-fleet-icon" alt="" />
                      {count > 1 && <span className="mt-fleet-count">{count}</span>}
                    </div>
                  ))}
              </div>
          </div>
      )}
    </div>,
    document.body
  );
};

// --- CARD COMPONENT ---
const MosaicCard = ({ kill, onHover, onLeave, spawnInfo }) => {
  const { trackedAlliances, trackedCorps, activeAllianceIds, activeCorpIds, addAlliance, addCorp } = useAlliance();
  
  const value = kill.total_value || 0;
  const shipClass = kill.victim?.victim_ship_class || 'Ship';
  const killDate = new Date(kill.killmail_time);
  
  const attackerCount = kill.attackers?.length || 1;
  const fleetCount = attackerCount - 1;

  // Live Stream Logic: Only treat a card as "new" when `spawnInfo` is provided
  const isNewKill = Boolean(spawnInfo);

  // Sizing Logic
  const isCapsule = ['Capsule', 'Shuttle', 'Rookie', 'Corvette'].some(s => shipClass.includes(s));
  const isTiny = isCapsule || value < 10000000; 
  const isSuper = value > 20000000000 || ['Titan', 'Supercarrier', 'Keepstar', 'Sotiyo'].some(s => shipClass.includes(s));
  const isHigh = !isSuper && (value > 1000000000 || ['Battleship', 'Dreadnought', 'Carrier', 'Freighter'].some(s => shipClass.includes(s)));

  let variantClass = 'mc-standard'; 
  if (isSuper) variantClass = 'mc-super'; 
  else if (isHigh) variantClass = 'mc-high'; 
  else if (isTiny) variantClass = 'mc-tiny';

  // NEW TIER LOGIC
  const getTier = (val) => {
    const n = Number(val) || 0;
    if (n >= 20e9) return 'mythic';
    if (n >= 5e9) return 'legendary';
    if (n >= 1e9) return 'epic';
    if (n >= 100e6) return 'rare';
    if (n >= 10e6) return 'uncommon';
    return 'common';
  };
  const tierClass = `mc-tier-${getTier(value)}`;

  const getSystemColorClass = (type) => {
    switch (type) {
      case 'highsec': return 'text-sec-hs';
      case 'lowsec': return 'text-sec-ls';
      case 'nullsec': return 'text-sec-ns';
      case 'pochven': return 'text-sec-poch';
      case 'wormhole': return 'text-sec-wh';
      case 'abyssal': return 'text-sec-ab';
      default: return 'text-sec-unknown';
    }
  };

  const finalBlow = kill.attackers?.find(a => a.final_blow) || kill.attackers?.[0] || { character_name: 'Unknown' };
  const victim = kill.victim || {};
  const shipTypeId = kill.victim?.ship_type_id || 0;
  const imgSize = isSuper ? 512 : isHigh ? 256 : 128;

  const isTracked = (id) => {
    if (!id || id === '0') return false;
    return activeAllianceIds.some(trackedId => String(trackedId) === String(id)) ||
           activeCorpIds.some(trackedId => String(trackedId) === String(id));
  };

  const victimTrackedData = trackedAlliances.find(ta => String(ta.id) === String(victim.alliance_id));
  const victimIsTracked = isTracked(victim.alliance_id);
  const finalBlowIsTracked = isTracked(finalBlow.alliance_id);
  const assistingTracked = kill.attackers?.some(a => isTracked(a.alliance_id) && !a.final_blow);

  const isLoss = victimIsTracked;
  const isKill = finalBlowIsTracked;
  const isAssist = assistingTracked;

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getLabel = () => {
    if (kill._relation) {
        if (kill._relation === 'loss') return <div className="mc-label label-loss">LOSS</div>;
        if (kill._relation === 'kill') return <div className="mc-label label-kill">KILL</div>;
        if (kill._relation === 'assist') return <div className="mc-label label-assist">ASSIST</div>;
    }
    if (isLoss) return <div className="mc-label label-loss">LOSS</div>;
    if (isKill) return <div className="mc-label label-kill">KILL</div>;
    if (isAssist) return <div className="mc-label label-assist">ASSIST</div>;
    return null;
  };

  const getTrackedAlliance = (id) => {
    if (!id || id === '0') return null;
    return trackedAlliances.find(ta => String(ta.id) === String(id));
  };

  const victimAllianceId = victim.alliance_id;
  const victimCorpId = victim.corporation_id;

  const openLink = (url) => window.open(url, '_blank');
  
  const [contextMenu, setContextMenu] = useState(null);
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const menuRef = useRef(null);

  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
    setActiveSubmenu(null);
  };

  useEffect(() => {
    if (contextMenu && menuRef.current) {
      const menu = menuRef.current;
      const { innerWidth, innerHeight } = window;
      const { offsetWidth, offsetHeight } = menu;
      let newX = contextMenu.x;
      let newY = contextMenu.y;
      if (contextMenu.x + offsetWidth > innerWidth) newX = innerWidth - offsetWidth - 5;
      if (contextMenu.y + offsetHeight > innerHeight) newY = innerHeight - offsetHeight - 5;
      if (newX !== contextMenu.x || newY !== contextMenu.y) setContextMenu({ x: newX, y: newY });
    }
  }, [contextMenu]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const formatISK = (n) => {
    if (!n) return '0';
    if (n >= 1e12) return <>{(n / 1e12).toFixed(2)}<span className="unit">T</span></>;
    if (n >= 1e9) return <>{(n / 1e9).toFixed(2)}<span className="unit">B</span></>;
    if (n >= 1e6) return <>{(n / 1e6).toFixed(2)}<span className="unit">M</span></>;
    return <>{(n / 1e3).toFixed(0)}<span className="unit">K</span></>;
  };

  const getIskColorClass = (amount) => {
    if (amount >= 50000000000) return 'isk-white';  
    if (amount >= 20000000000) return 'isk-red';    
    if (amount >= 10000000000) return 'isk-orange'; 
    if (amount >= 1000000000) return 'isk-yellow';  
    if (amount >= 1000000000) return 'isk-green';    
    if (amount >= 10000000) return 'isk-blue';      
    return 'isk-grey';                              
  };

  const spawnStyle = spawnInfo ? { '--spawn-duration': `${spawnInfo.duration}s` } : undefined;

  return (
    <div 
      className={`mosaic-card ${variantClass} ${tierClass} ${isNewKill ? 'mc-animate-new' : ''} ${spawnInfo ? 'mc-spawning' : ''}`}
      style={spawnStyle}
      onMouseEnter={(e) => onHover(kill, e)}
      onMouseLeave={onLeave}
      onClick={() => window.open(`https://zkillboard.com/kill/${kill.killmail_id}/`, '_blank')}
      onContextMenu={handleContextMenu}
    >
      <div className="mc-bg-wrapper">
         <img src={`https://images.evetech.net/types/${shipTypeId}/render?size=${imgSize}`} className="mc-bg-img" alt="" onError={(e) => e.currentTarget.style.display = 'none'} />
         <div className="mc-gradient" style={{ background: isTiny ? 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' : 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.4), transparent)' }} />
      </div>

      {/* SIDE-BY-SIDE EMBLEMS */}
      <div className="mc-emblem-container">
          {victimAllianceId && victimAllianceId !== '0' && (
              <img src={`https://images.evetech.net/alliances/${victimAllianceId}/logo?size=64`} className="mc-alliance-overlay" alt="" style={victimTrackedData ? { borderColor: victimTrackedData.color, boxShadow: `0 0 4px ${victimTrackedData.color}60` } : {}} />
          )}
          {victimCorpId && victimCorpId !== '0' && (
              <img src={`https://images.evetech.net/corporations/${victimCorpId}/logo?size=64`} className="mc-corp-overlay" alt="" />
          )}
      </div>

      <div className="mc-content">
        <div className="mc-header">
            {/* TIME AGO in TOP LEFT */}
            <div className="mc-time" title={killDate.toLocaleString()}>{getTimeAgo(killDate)}</div>
            {getLabel()}
            {!isTiny && (isHigh || isSuper) && <div className="mc-zap">⚡</div>}
        </div>

        {isTiny ? (
          <div className="mc-tiny-row">
            <div className={getSystemColorClass(kill.space_type)} style={{ fontWeight: 'bold', fontFamily: 'Orbitron' }}>{kill.solar_system_name}</div>
            <div className={`mc-tiny-val isk-value ${getIskColorClass(value)}`}>{formatISK(value)}</div>
          </div>
        ) : (
          <div className="mc-info">
             <div className={`mc-sys-name ${getSystemColorClass(kill.space_type)}`} style={{ fontWeight: 'bold' }}>{kill.solar_system_name}</div>
             <div className="mc-ship-name">{victim.ship_type_name}</div>
             <div className="mc-participants">
                <span style={{ color: '#f87171', fontWeight: 'bold' }}>{victim.character_name}</span>
                <span style={{ color: '#64748b', fontStyle: 'italic', margin: '0 4px', fontSize: '0.6rem' }}>by</span>
                <span style={{ color: '#4ade80' }}>
                   {finalBlow.character_name}
                   {fleetCount > 0 && <span style={{ color: '#60a5fa', fontWeight: 'bold', marginLeft: '4px' }}>+{fleetCount}</span>}
                </span>
             </div>
             <div className={`mc-bottom-val isk-value ${getIskColorClass(value)}`} style={{ fontSize: isSuper ? '1.1rem' : '0.8rem' }}>{formatISK(value)}</div>
          </div>
        )}
      </div>

      {contextMenu && createPortal(
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <div className="context-header">Killmail #{kill.killmail_id}</div>
          <div className="context-item" onClick={() => openLink(`https://zkillboard.com/kill/${kill.killmail_id}/`)}>Open in zKillboard</div>
          <div className="context-item" onClick={() => navigator.clipboard.writeText(`https://zkillboard.com/kill/${kill.killmail_id}/`)}>Copy Link</div>
          <div className="context-item" onClick={() => openLink(`https://zkillboard.com/kill/${kill.killmail_id}/`)}>View Fitting</div>
          <div className="context-separator"></div>

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
                {victim.alliance_id && victim.alliance_id !== '0' && !getTrackedAlliance(victim.alliance_id) && (
                  <div className="context-item sub context-item-action" onClick={() => { addAlliance({ id: victim.alliance_id, name: victim.alliance_name }); setContextMenu(null); }}><span>+</span> Track Alliance</div>
                )}
                {victim.corporation_id && victim.corporation_id !== '0' && !trackedCorps.some(c => String(c.id) === String(victim.corporation_id)) && (
                  <div className="context-item sub context-item-action" onClick={() => { addCorp({ id: victim.corporation_id, name: victim.corporation_name }); setContextMenu(null); }}><span>+</span> Track Corporation</div>
                )}
              </div>
            )}
          </div>

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
                {finalBlow.alliance_id && finalBlow.alliance_id !== '0' && !getTrackedAlliance(finalBlow.alliance_id) && (
                  <div className="context-item sub context-item-action" onClick={() => { addAlliance({ id: finalBlow.alliance_id, name: finalBlow.alliance_name }); setContextMenu(null); }}><span>+</span> Track Alliance</div>
                )}
                {finalBlow.corporation_id && finalBlow.corporation_id !== '0' && !trackedCorps.some(c => String(c.id) === String(finalBlow.corporation_id)) && (
                  <div className="context-item sub context-item-action" onClick={() => { addCorp({ id: finalBlow.corporation_id, name: finalBlow.corporation_name }); setContextMenu(null); }}><span>+</span> Track Corporation</div>
                )}
              </div>
            )}
          </div>

          <div className={`context-submenu ${activeSubmenu === 'system' ? 'open' : ''}`}>
            <div className="context-submenu-header" onClick={() => setActiveSubmenu(activeSubmenu === 'system' ? null : 'system')}>
              <span className="submenu-arrow">{activeSubmenu === 'system' ? '▼' : '▶'}</span>
              <span className="submenu-label">System:</span>
              <span className="submenu-name">{kill.solar_system_name}</span>
            </div>
            {activeSubmenu === 'system' && (
              <div className="context-submenu-items">
                <div className="context-item sub" onClick={() => { navigator.clipboard.writeText(kill.solar_system_name); setContextMenu(null); }}>Copy Name</div>
                <div className="context-item sub" onClick={() => openLink(`https://zkillboard.com/system/${kill.solar_system_id}/`)}>zKillboard</div>
              </div>
            )}
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default MosaicCard;
