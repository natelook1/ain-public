import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAlliance } from '../../context/AllianceContext';
import './CompactKillRow.css';
import './KillCard.css'; // For Context Menu Styles

const CompactKillRow = ({ kill }) => {
  const { trackedAlliances, trackedCorps, activeAllianceIds, activeCorpIds, addAlliance, addCorp } = useAlliance();
  
  const finalBlow = kill.attackers?.find(a => a.final_blow) || kill.attackers?.[0] || {};
  const victim = kill.victim || {};
  const attackerCount = kill.attackers?.length || 1;
  const fleetCount = attackerCount - 1;
  const killDate = new Date(kill.killmail_time);

  // Time Ago Helper
  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Tracked Status Logic
  const getTrackedAlliance = (id) => {
    if (!id || id === '0') return null;
    return trackedAlliances.find(ta => String(ta.id) === String(id));
  };
  
  const isTracked = (id) => {
    if (!id || id === '0') return false;
    return activeAllianceIds.some(trackedId => String(trackedId) === String(id)) ||
           activeCorpIds.some(trackedId => String(trackedId) === String(id));
  };

  const victimTracked = getTrackedAlliance(victim.alliance_id);
  const attackerTracked = getTrackedAlliance(finalBlow.alliance_id);

  // Relation Logic
  const victimIsTracked = isTracked(victim.alliance_id);
  const finalBlowIsTracked = isTracked(finalBlow.alliance_id);
  const assistingAllianceIds = [...new Set(
    kill.attackers
      .filter(a => isTracked(a.alliance_id) && !a.final_blow)
      .map(a => String(a.alliance_id))
  )];
  const isLoss = victimIsTracked;
  const isKill = finalBlowIsTracked;
  const isAssist = assistingAllianceIds.length > 0;

  // Label Helper
  const getLabel = () => {
    // 1. Backend-provided relation (Source of Truth if available)
    if (kill._relation) {
        if (kill._relation === 'loss') return <div className="compact-label loss">LOSS</div>;
        if (kill._relation === 'kill') return <div className="compact-label kill">KILL</div>;
        if (kill._relation === 'assist') return <div className="compact-label assist">ASSIST</div>;
    }

    // 2. Tracked Mode Checks
    if (isLoss) return <div className="compact-label loss">LOSS</div>;
    if (isKill) return <div className="compact-label kill">KILL</div>;
    if (isAssist) return <div className="compact-label assist">ASSIST</div>;

    // 3. Fallback
    return <span style={{fontSize: '0.65rem', fontStyle: 'italic', color: '#64748b'}}>by</span>;
  };

  // Helper to generate fleet summary string for tooltip
  const getFleetSummary = () => {
    if (attackerCount <= 1) return null;
    const counts = {};
    kill.attackers.forEach(a => {
        if (!a.ship_type_name) return;
        counts[a.ship_type_name] = (counts[a.ship_type_name] || 0) + 1;
    });
    // Sort by count descending
    return Object.entries(counts)
        .sort(([,a], [,b]) => b - a)
        .map(([name, count]) => `${count}x ${name}`)
        .slice(0, 5) // Top 5
        .join(', ') + (Object.keys(counts).length > 5 ? '...' : '');
  };

  const fleetSummary = getFleetSummary();

  // Context Menu Helpers
  const openLink = (url) => window.open(url, '_blank');
  
  // Context Menu State
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

      if (contextMenu.x + offsetWidth > innerWidth) {
        newX = innerWidth - offsetWidth - 5;
      }
      if (contextMenu.y + offsetHeight > innerHeight) {
        newY = innerHeight - offsetHeight - 5;
      }

      if (newX !== contextMenu.x || newY !== contextMenu.y) {
        setContextMenu({ x: newX, y: newY });
      }
    }
  }, [contextMenu]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Format ISK
  const formatISK = (n) => {
    if (!n) return '0';
    if (n >= 1e12) return <>{(n / 1e12).toFixed(2)}<span className="unit">T</span></>;
    if (n >= 1e9) return <>{(n / 1e9).toFixed(2)}<span className="unit">B</span></>;
    if (n >= 1e6) return <>{(n / 1e6).toFixed(2)}<span className="unit">M</span></>;
    return <>{(n / 1e3).toFixed(0)}<span className="unit">K</span></>;
  };

  // Get ISK Color Class
  const getIskColorClass = (amount) => {
    if (amount >= 50000000000) return 'isk-white';  // 50B+
    if (amount >= 20000000000) return 'isk-red';    // 20B-50B
    if (amount >= 10000000000) return 'isk-orange'; // 10B-20B
    if (amount >= 1000000000) return 'isk-yellow';  // 1B-10B
    if (amount >= 100000000) return 'isk-green';    // 100M-1B
    if (amount >= 10000000) return 'isk-blue';      // 10M-100M
    return 'isk-grey';                              // < 10M
  };

  // Get Security Color Class
  const getSecurityClass = (type) => {
    switch (type) {
      case 'highsec': return 'sec-hs';
      case 'lowsec': return 'sec-ls';
      case 'nullsec': return 'sec-ns';
      case 'pochven': return 'sec-poch';
      case 'wormhole': return 'sec-wh';
      case 'abyssal': return 'sec-ab';
      default: return 'sec-unknown';
    }
  };

  // Get System Name Color Class
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

  // Render standalone emblem (Alliance pref, then Corp)
  const renderEmblem = (pilot, trackedData) => {
     if (pilot.alliance_id && pilot.alliance_id !== '0') {
        return (
            <img 
                src={`https://images.evetech.net/alliances/${pilot.alliance_id}/logo?size=64`} 
                className="compact-emblem" 
                alt={pilot.alliance_name}
                title={pilot.alliance_name}
                style={trackedData ? { borderColor: trackedData.color, boxShadow: `0 0 4px ${trackedData.color}60` } : {}}
            />
        );
     }
     if (pilot.corporation_id && pilot.corporation_id !== '0') {
        return (
            <img 
                src={`https://images.evetech.net/corporations/${pilot.corporation_id}/logo?size=64`} 
                className="compact-emblem" 
                alt={pilot.corporation_name}
                title={pilot.corporation_name}
            />
        );
     }
     return <div className="compact-emblem" style={{background: 'transparent', border:'none'}}></div>; // Spacer
  };

  return (
    <div 
      className={`compact-row ${getSecurityClass(kill.space_type)}`} 
      onClick={() => window.open(`https://zkillboard.com/kill/${kill.killmail_id}/`, '_blank')}
      onContextMenu={handleContextMenu}
    >
      {/* Time */}
      <div className="compact-col-time" title={killDate.toLocaleString()}>
        {getTimeAgo(killDate)}
      </div>

      {/* System */}
      <div className={`compact-col-system ${getSystemColorClass(kill.space_type)}`}>
        {kill.solar_system_name}
      </div>

      {/* Victim (Right Aligned) */}
      <div className="compact-col-pilot right">
        <div className="compact-text-group right">
          <span className="compact-name text-red" title={victim.character_name}>{victim.character_name}</span>
          <span className="compact-ship-name" title={victim.ship_type_name}>{victim.ship_type_name}</span>
          <span className="compact-corp" title={victim.corporation_name}>
            {victim.alliance_id && victim.alliance_id !== '0' ? victim.alliance_name : victim.corporation_name}
          </span>
        </div>
        
        {/* Emblem Beside Ship */}
        {renderEmblem(victim, victimTracked)}

        <div className="compact-ship-wrapper">
            <img 
                src={`https://images.evetech.net/types/${victim.ship_type_id}/render?size=64`} 
                className="compact-ship-img border-red" 
                alt="" 
                title={victim.ship_type_name}
                onError={(e) => e.currentTarget.style.display = 'none'} 
            />
        </div>
      </div>

      {/* CENTER: Label (Kill/Loss/Assist) or 'by' */}
      <div className="compact-col-center">
        {getLabel()}
      </div>

      {/* Killer (Left Aligned) */}
      <div className="compact-col-pilot">
        <div className="compact-ship-wrapper">
            <img 
                src={`https://images.evetech.net/types/${finalBlow.ship_type_id}/render?size=64`} 
                className="compact-ship-img border-green" 
                alt="" 
                title={finalBlow.ship_type_name}
                onError={(e) => e.currentTarget.style.display = 'none'} 
            />
            {fleetCount > 0 && (
                <div 
                    className="compact-fleet-badge"
                    title={`Fleet Composition:\n${fleetSummary}`}
                >
                    +{fleetCount}
                </div>
            )}
        </div>
        
        {/* Emblem Beside Ship */}
        {renderEmblem(finalBlow, attackerTracked)}

        <div className="compact-text-group">
          <span className="compact-name text-green" title={finalBlow.character_name}>{finalBlow.character_name}</span>
          <span className="compact-ship-name" title={finalBlow.ship_type_name}>{finalBlow.ship_type_name}</span>
          <span className="compact-corp" title={finalBlow.corporation_name}>
             {finalBlow.alliance_id && finalBlow.alliance_id !== '0' ? finalBlow.alliance_name : finalBlow.corporation_name}
          </span>
        </div>
      </div>

      {/* Value */}
      <div className={`compact-col-value isk-value ${getIskColorClass(kill.total_value)}`}>
        {formatISK(kill.total_value)}
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

export default CompactKillRow;
