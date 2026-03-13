import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAlliance } from '../../context/AllianceContext';
import { fetchStats, fetchAllianceInfo } from '../../api/stats';
import KillCard from './KillCard';
import CompactKillRow from './CompactKillRow';
import MosaicCard, { KillTooltip } from './MosaicCard';
import './KillFeed.css';

// --- Internal Icon Components (replacing lucide-react) ---
const LayoutList = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
    <path d="M14 4h7" />
    <path d="M14 9h7" />
    <path d="M14 15h7" />
    <path d="M14 20h7" />
  </svg>
);

const AlignJustify = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" x2="21" y1="6" y2="6" />
    <line x1="3" x2="21" y1="12" y2="12" />
    <line x1="3" x2="21" y1="18" y2="18" />
  </svg>
);

const Grid = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
);

function KillFeed({ 
  filters: _filters, 
  killFeedData, 
  loading, 
  loadingMore, 
  hasMore, 
  onLoadMore, 
  scrollContainerRef, 
  error, 
  onViewChange,
  fingerprint,
  currentView
}) {
  // Destructure setLurkerTarget to allow changing focus
  const { activeAllianceIds, lurkerTarget, setFocusTarget, isLurkerMode, trackedAlliances, updateAllianceTicker, trackedCorps, activeCorpIds } = useAlliance();
  
  // VIEW MODE STATE
  // Initialize from Local Storage if available, default to 'standard'
  const [viewMode, setViewMode] = useState(() => {
    try {
      const savedMode = localStorage.getItem('killFeedViewMode');
      if (savedMode) return savedMode;
      return window.innerWidth < 768 ? 'compact' : 'standard';
    } catch (e) {
      return 'standard';
    }
  });

  // Sync initial view mode to parent on mount so analytics represent the loaded state, not just defaults
  useEffect(() => {
      if (onViewChange) {
          onViewChange(viewMode);
      }
  }, []); // Run once on mount

  // Callback wrapper for changing view mode
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('killFeedViewMode', mode);
    } catch (e) {
      console.error('Failed to save view mode:', e);
    }
    
    if (onViewChange) {
      onViewChange(mode);
    }
  };

  const [allianceDataList, setAllianceDataList] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const allianceScrollRef = useRef(null);
  const sentinelRef = useRef(null);

  // Hover tooltip state for ALLIANCE STATS (Standard)
  const [hoveredAlliance, setHoveredAlliance] = useState(null);
  const [allianceTooltipPos, setAllianceTooltipPos] = useState({ top: 0, left: 0 });
  
  // Hover state for MOSAIC CARDS
  const [hoveredKill, setHoveredKill] = useState(null);
  const [mosaicTooltipPos, setMosaicTooltipPos] = useState({ x: 0, y: 0 });

  const hoverTimeoutRef = useRef(null);

  // Use killFeedData passed from parent. 
  const kills = killFeedData || [];

  // Helper to extract sequence id from various provider fields
  const getSeq = (k) => {
      // Check standard ZKB location first, then others
      return k?.zkb?.sequence ?? 
             k?.r2z2_sequence ?? 
             k?.r2z2_seq ?? 
             k?.sequence ?? 
             k?.sequence_id ?? 
             k?.seq ?? 
             0;
  };

  // --- 1. SORT FOR LIST/COMPACT VIEW (Chronological) ---
  const sortedKillsForList = useMemo(() => {
    if (!kills || kills.length === 0) return [];
    // Strict date sort descending
    return [...kills].sort((a, b) => new Date(b.killmail_time) - new Date(a.killmail_time));
  }, [kills]);

  // --- 2. SORT FOR MOSAIC VIEW (Sequence/Arrival Order) ---
  // We want the grid to reflect the feed order exactly (Newest/Highest Sequence at top)
  const sortedKillsForMosaic = useMemo(() => {
    if (!kills || kills.length === 0) return [];
    
    return [...kills].sort((a, b) => {
        // Try sequence first
        const seqA = Number(getSeq(a)) || 0;
        const seqB = Number(getSeq(b)) || 0;
        
        // Aggressive Sort: If either item has a sequence, use sequence logic.
        // This forces delayed kills (High Sequence, Low ID) to beat kills with missing sequence or lower sequence.
        if (seqA > 0 || seqB > 0) {
            return seqB - seqA; // Descending Sequence (High to Low)
        }
        
        // Fallback to Kill ID ONLY if both completely lack sequence data
        return Number(b.killmail_id) - Number(a.killmail_id);
    });
  }, [kills]);

  // Track known kill IDs to distinguish initial population from newly arriving kills
  const knownKillIdsRef = useRef(new Set());
  const initializedRef = useRef(false);
  const canAnimateRef = useRef(false); // Controls the grace period
  const spawnTimersRef = useRef({});
  const [spawnInfoMap, setSpawnInfoMap] = useState({});

  // Long pulse durations for better visibility
  const getPulseDurationFromValue = (value) => {
    const v = Number(value) || 0;
    if (v >= 20e9) return 60; // 20b+ -> 60s
    if (v >= 5e9) return 45;  // 5b+ -> 45s
    if (v >= 1e9) return 30;  // 1b+ -> 30s
    if (v >= 100e6) return 20; // 100m+ -> 20s
    return 15; // Base -> 15s
  };

  // UPDATED: "Live Stream" Animation Logic
  // Purely state-based with a "Grace Period" for supplemental loads
  useEffect(() => {
    const currentKills = kills || [];
    if (currentKills.length === 0) return;

    // Convert IDs to strings for consistent Set storage
    const incomingIds = currentKills.map(k => String(k.killmail_id));

    // 1. INITIALIZATION: First load
    // Just mark everything as known so we don't flash the initial page.
    if (!initializedRef.current) {
        incomingIds.forEach(id => knownKillIdsRef.current.add(id));
        initializedRef.current = true;
        
        // Start a grace period (2.5 seconds) where we ignore "new" items
        // This swallows up the "supplemental load" that arrives shortly after init
        setTimeout(() => {
            canAnimateRef.current = true;
        }, 2500);
        return;
    }

    // 2. BACKFILL / PAGINATION:
    // If loadingMore is true, we are fetching older history. 
    // We add these to known IDs silently (no animation).
    if (loadingMore) {
        incomingIds.forEach(id => knownKillIdsRef.current.add(id));
        return;
    }

    // 3. LIVE UPDATE:
    // Any ID in the incoming list that we haven't seen before is a LIVE EVENT.
    // We animate it regardless of its timestamp or age.
    const newSpawnEntries = {};
    let hasNew = false;

    for (const id of incomingIds) {
        if (!knownKillIdsRef.current.has(id)) {
            // It is new and we aren't backfilling.
            // ONLY animate if the grace period has expired.
            if (canAnimateRef.current) {
                const kill = currentKills.find(k => String(k.killmail_id) === id);
                
                if (kill) {
                    const value = kill.total_value || kill.totalValue || (kill.zkb && kill.zkb.totalValue) || 0;
                    const duration = getPulseDurationFromValue(value);
                    
                    newSpawnEntries[id] = { duration, value };
                    
                    // Set cleanup timer to remove highlight after duration
                    if (spawnTimersRef.current[id]) clearTimeout(spawnTimersRef.current[id]);
                    spawnTimersRef.current[id] = setTimeout(() => {
                        setSpawnInfoMap(prev => {
                            const copy = { ...prev };
                            delete copy[id];
                            return copy;
                        });
                        delete spawnTimersRef.current[id];
                    }, duration * 1000 + 500); // 500ms buffer
                    
                    hasNew = true;
                }
            }
            // Mark as known so we don't animate it again next render
            knownKillIdsRef.current.add(id);
        }
    }

    if (hasNew) {
        setSpawnInfoMap(prev => ({ ...prev, ...newSpawnEntries }));
    }

    // Cleanup on unmount
    return () => {
      // (Optional) We could clear timers here, but leaving them running is usually fine
      // to avoid state update warnings on unmount, we can just leave them.
    };
  }, [kills, loadingMore]);

  // Scroll to top when the filter target changes to indicate a new list is loading/loaded
  useEffect(() => {
    if (scrollContainerRef?.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [lurkerTarget, scrollContainerRef]);

  // --- Handlers for Alliance Stats Tooltip ---
  const handleCardMouseEnter = (data, event) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    const rect = event.currentTarget.getBoundingClientRect();
    setAllianceTooltipPos({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2
    });
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredAlliance(data);
    }, 200);
  };

  const handleCardMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredAlliance(null);
  };

  // --- Handlers for Mosaic Card Tooltip ---
  const handleMosaicHover = (kill, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredKill(kill);
    setMosaicTooltipPos({ x: rect.right, y: rect.top });
  };
  
  const handleMosaicLeave = () => {
    setHoveredKill(null);
  };

  // Click handler for focusing an entity (standard single-entity filter, not lurker mode)
  const handleCardClick = (data) => {
    setFocusTarget(String(lurkerTarget) === String(data.id) ? null : data.id);
  };

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollContainerRef?.current;
    if (!sentinel || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          onLoadMore();
        }
      },
      { root: root || null, rootMargin: '600px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore, scrollContainerRef, kills.length, viewMode]);

  // Fetch stats for all active alliances/corps
  useEffect(() => {
    let stale = false;

    async function loadStats() {
      let allianceIds = [...activeAllianceIds];
      let corpIds = [...activeCorpIds];

      // Fallback: If empty but we have a target (Permalink mode), show the target
      if (allianceIds.length === 0 && corpIds.length === 0 && lurkerTarget) {
        if (trackedAlliances.some(a => String(a.id) === String(lurkerTarget))) {
          allianceIds.push(lurkerTarget);
        } else if (trackedCorps.some(c => String(c.id) === String(lurkerTarget))) {
          corpIds.push(lurkerTarget);
        }
      }

      if (allianceIds.length === 0 && corpIds.length === 0) {
        setAllianceDataList([]);
        setStatsLoading(false);
        return;
      }

      setStatsLoading(true);

      try {
        // Updated to pass identity and view context along with the IDs
        // Note: passing fingerprint/view as the 3rd argument 'options' object
        // assuming api/stats.js supports or ignores it safely.
        const statsData = await fetchStats(
          allianceIds.length > 0 ? allianceIds.join(',') : null,
          corpIds.length > 0 ? corpIds.join(',') : null,
          { fingerprint, view: currentView }
        );
        if (stale) return;

        const allianceStatsMap = statsData?.alliance_stats || {};
        const corpStatsMap = statsData?.corporation_stats || {};

        const processEntity = async (id, type) => {
             const list = type === 'alliance' ? trackedAlliances : trackedCorps;
             const entity = list.find(item => String(item.id) === String(id));
             if (!entity) return null;

             let stats = {};
             if (type === 'alliance') {
                 stats = allianceStatsMap[id] || allianceStatsMap[String(id)] || {};
             } else {
                 stats = corpStatsMap[id] || corpStatsMap[String(id)] || {};
             }

             // Fallback to summary if single entity and no specific stats found
             if ((allianceIds.length + corpIds.length) === 1 && Object.keys(stats).length === 0) {
                 stats = statsData?.alliance_summary || statsData?.corporation_summary || {};
             }

             let extraInfo = {};
             if (type === 'alliance') {
                 try {
                    const info = await fetchAllianceInfo(id);
                    if (stale) return null;
                    if (info) {
                        extraInfo.corpCount = info.corporation_count;
                        if (!entity.ticker && info.ticker) updateAllianceTicker(id, info.ticker);
                    }
                 } catch(e) { /* ignore */ }
             }

             return {
                 ...entity,
                 id: Number(id),
                 type,
                 corpCount: extraInfo.corpCount,
                 stats: {
                    kills: stats.kills || 0,
                    losses: stats.losses || 0,
                    isk_destroyed: stats.isk_destroyed || 0,
                    isk_lost: stats.isk_lost || 0,
                    efficiency: stats.efficiency?.toFixed(1) || '0.0',
                    ratio: stats.ratio?.toFixed(2) || '0.00',
                    activePilots: stats.activePilots || '-',
                    lastSeen: stats.lastSeen || null,
                    topShip: stats.topShip || null,
                    topShipId: stats.topShipId || null,
                    maxKill: stats.maxKill || null,
                    maxLoss: stats.maxLoss || null
                 }
             };
        };

        const alliancePromises = allianceIds.map(id => processEntity(id, 'alliance'));
        const corpPromises = corpIds.map(id => processEntity(id, 'corporation'));

        const results = await Promise.all([...alliancePromises, ...corpPromises]);
        if (stale) return;
        setAllianceDataList(results.filter(Boolean));

      } catch (err) {
        if (stale) return;
        console.error('Failed to load stats:', err);
        setAllianceDataList([]);
      } finally {
        if (!stale) setStatsLoading(false);
      }
    }
    loadStats();

    return () => { stale = true; };
  }, [
    activeAllianceIds,
    activeCorpIds,
    lurkerTarget,
    trackedAlliances,
    trackedCorps,
    updateAllianceTicker,
    fingerprint,
    currentView
  ]);

  // Horizontal scroll on wheel for multi-alliance mode (ONLY for 4+ items)
  useEffect(() => {
    const el = allianceScrollRef.current;
    if (!el || allianceDataList.length < 4) return;

    const handleWheel = (e) => {
      if (e.deltaY === 0) return;
      const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth;
      const isAtStart = el.scrollLeft === 0;

      if ((e.deltaY > 0 && !isAtEnd) || (e.deltaY < 0 && !isAtStart)) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [allianceDataList.length]);

  const formatISK = (n) => {
    if (!n) return '0';
    if (n >= 1e12) return <>{(n / 1e12).toFixed(2)}<span className="isk-suffix">T</span></>;
    if (n >= 1e9) return <>{(n / 1e9).toFixed(2)}<span className="isk-suffix">B</span></>;
    if (n >= 1e6) return <>{(n / 1e6).toFixed(2)}<span className="isk-suffix">M</span></>;
    return Math.floor(n).toLocaleString();
  };

  const allianceCount = allianceDataList.length;
  const isSingleAlliance = allianceCount === 1;

  // Render full expanded stats for single alliance
  const renderFullStats = (data) => {
    const { stats } = data;
    const maxKill = stats.maxKill;
    const isActive = String(lurkerTarget) === String(data.id);

    return (
      <div 
        key={data.id} 
        className={`alliance-stats-bar single-alliance ${isActive ? 'active-filter' : ''}`}
        onClick={() => handleCardClick(data)}
        onMouseEnter={(e) => handleCardMouseEnter(data, e)}
        onMouseLeave={handleCardMouseLeave}
        style={{ cursor: 'pointer' }}
      >
        <div className="alliance-identity">
          <img
            src={`https://images.evetech.net/${data.type}s/${data.id}/logo?size=64`}
            alt={data.name}
            className="alliance-logo-large"
          />
          <div className="alliance-info">
            <span className="alliance-name" style={{ color: data.color }}>
              {data.name}
            </span>
            <span className="alliance-ticker">
              {data.ticker && `[${data.ticker}]`}
              {data.corpCount && <span className="corp-count">{data.ticker ? ' · ' : ''}{data.corpCount} corps</span>}
            </span>
          </div>
        </div>
        <div className="alliance-stats-grid">
          <div className="alliance-stat">
            <span className="stat-value">{stats.kills.toLocaleString()}</span>
            <span className="stat-label">Kills</span>
          </div>
          <div className="alliance-stat">
            <span className="stat-value loss">{stats.losses.toLocaleString()}</span>
            <span className="stat-label">Losses</span>
          </div>
          <div className="alliance-stat">
            <span className="stat-value isk">{formatISK(stats.isk_destroyed)}</span>
            <span className="stat-label">Destroyed</span>
          </div>
          <div className="alliance-stat">
            <span className="stat-value loss">{formatISK(stats.isk_lost)}</span>
            <span className="stat-label">Lost</span>
          </div>
          <div className="alliance-stat">
            <span className="stat-value efficiency">{stats.efficiency}%</span>
            <span className="stat-label">Efficiency</span>
          </div>
          <div className="alliance-stat">
            <span className="stat-value">{stats.ratio}:1</span>
            <span className="stat-label">Ratio</span>
          </div>
          <div className="alliance-stat">
            <span className="stat-value active">{stats.activePilots}</span>
            <span className="stat-label">Active</span>
          </div>
          {stats.topShip && (
            <div className="alliance-stat top-ship-stat">
              {stats.topShipId && (
                <img
                  src={`https://images.evetech.net/types/${stats.topShipId}/icon?size=32`}
                  alt={stats.topShip}
                  className="top-ship-icon"
                />
              )}
              <span className="stat-value">{stats.topShip}</span>
              <span className="stat-label">Top Ship</span>
            </div>
          )}
        </div>
        {maxKill && (
          <div className="mvp-section">
            <div className="mvp-label">MVP KILL</div>
            <div className="mvp-content">
              <img
                src={`https://images.evetech.net/types/${maxKill.victim?.ship_type_id || maxKill.victim_ship_id}/icon?size=32`}
                alt="Victim ship"
                className="mvp-ship-icon"
              />
              <div className="mvp-details">
                <span className="mvp-value">{formatISK(maxKill.total_value)}</span>
                <span className="mvp-ship">{maxKill.victim?.ship_type_name || maxKill.victim_ship_name}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render 2-player mode (Versus) with balanced MVP/Top Ship footer
  const renderVersusCard = (data, position) => {
    const { stats } = data;
    const efficiencyNum = parseFloat(stats.efficiency) || 0;
    const maxKill = stats.maxKill;
    const isActive = String(lurkerTarget) === String(data.id);

    return (
      <div
        key={data.id}
        className={`versus-card ${position} ${isActive ? 'active-filter' : ''}`}
        onClick={() => handleCardClick(data)}
        onMouseEnter={(e) => handleCardMouseEnter(data, e)}
        onMouseLeave={handleCardMouseLeave}
      >
        <div className="versus-identity">
          <img
            src={`https://images.evetech.net/${data.type}s/${data.id}/logo?size=128`}
            alt={data.name}
            className="versus-logo"
          />
          <div className="versus-info">
            <span className="versus-name" style={{ color: data.color || '#fff' }}>
              {data.name}
            </span>
            <span className="versus-ticker">
              {data.ticker && `[${data.ticker}]`}
              {data.corpCount && <span className="versus-corp-count"> · {data.corpCount} corps</span>}
            </span>
          </div>
        </div>

        <div className="versus-efficiency-wrapper">
          <span className="versus-efficiency-label">{stats.efficiency}% efficiency</span>
          <div className="versus-efficiency-bar">
            <div className="versus-efficiency-fill" style={{
              width: `${efficiencyNum}%`,
              backgroundColor: efficiencyNum >= 50 ? 'var(--success)' : 'var(--danger)'
            }} />
          </div>
        </div>

        <div className="versus-stats-grid">
          <div className="versus-stat">
            <span className="versus-stat-value">{stats.kills.toLocaleString()}</span>
            <span className="versus-stat-label">Kills</span>
          </div>
          <div className="versus-stat">
            <span className="versus-stat-value loss">{stats.losses.toLocaleString()}</span>
            <span className="versus-stat-label">Losses</span>
          </div>
          <div className="versus-stat">
            <span className="versus-stat-value isk">{formatISK(stats.isk_destroyed)}</span>
            <span className="versus-stat-label">Destroyed</span>
          </div>
          <div className="versus-stat">
            <span className="versus-stat-value loss">{formatISK(stats.isk_lost)}</span>
            <span className="versus-stat-label">Lost</span>
          </div>
          <div className="versus-stat">
            <span className="versus-stat-value">{stats.ratio}:1</span>
            <span className="versus-stat-label">Ratio</span>
          </div>
          <div className="versus-stat">
            <span className="versus-stat-value active">{stats.activePilots}</span>
            <span className="versus-stat-label">Active</span>
          </div>
        </div>

        {/* Footer: Flex row for MVP and Top Ship */}
        <div className="versus-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            
            {/* Left: MVP */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                {maxKill ? (
                    <>
                        <div className="versus-mvp-label" style={{ fontSize: '0.7rem', color: '#a0aec0', marginBottom: '4px' }}>MVP KILL</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img
                                src={`https://images.evetech.net/types/${maxKill.victim?.ship_type_id || maxKill.victim_ship_id}/icon?size=32`}
                                alt="MVP"
                                className="versus-mvp-icon"
                                style={{ width: '32px', height: '32px', borderRadius: '4px' }}
                            />
                            <div className="versus-mvp-details" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                                <span className="versus-mvp-value" style={{ color: '#48bb78', fontWeight: 'bold', fontSize: '0.9rem' }}>{formatISK(maxKill.total_value)}</span>
                                <span className="versus-mvp-ship" style={{ fontSize: '0.75rem', color: '#cbd5e0' }}>{maxKill.victim?.ship_type_name || maxKill.victim_ship_name}</span>
                            </div>
                        </div>
                    </>
                ) : (
                   <span style={{ fontSize: '0.75rem', color: '#718096' }}>No MVP data</span>
                )}
            </div>

            {/* Right: Top Ship */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                {stats.topShip && stats.topShipId ? (
                    <>
                        <span style={{ fontSize: '0.7rem', color: '#a0aec0', marginBottom: '4px' }}>TOP SHIP</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: 'row-reverse' }}>
                            <img
                                src={`https://images.evetech.net/types/${stats.topShipId}/icon?size=32`}
                                alt={stats.topShip}
                                className="versus-ship-icon"
                                style={{ width: '32px', height: '32px', borderRadius: '4px' }}
                                onError={(e) => e.target.style.display = 'none'} 
                            />
                            <span className="versus-ship-name" style={{ fontSize: '0.85rem', color: '#cbd5e0' }}>{stats.topShip}</span>
                        </div>
                    </>
                ) : (
                    <span style={{ fontSize: '0.75rem', color: '#718096' }}>No Ship data</span>
                )}
            </div>
        </div>
      </div>
    );
  };

  const renderMediumCard = (data) => {
    const { stats } = data;
    const efficiencyNum = parseFloat(stats.efficiency) || 0;
    const isActive = String(lurkerTarget) === String(data.id);

    return (
      <div
        key={data.id}
        className={`medium-card ${isActive ? 'active-filter' : ''}`}
        onClick={() => handleCardClick(data)}
        onMouseEnter={(e) => handleCardMouseEnter(data, e)}
        onMouseLeave={handleCardMouseLeave}
      >
        <div className="medium-header">
          <img
            src={`https://images.evetech.net/${data.type}s/${data.id}/logo?size=64`}
            alt={data.name}
            className="medium-logo"
          />
          <div className="medium-info">
            <span className="medium-name" style={{ color: data.color || '#fff' }}>{data.name}</span>
            <span className="medium-ticker">
                {data.ticker ? `[${data.ticker}]` : (data.name?.substring(0, 8))}
            </span>
          </div>
        </div>

        <div className="medium-efficiency-wrapper">
          <span className="medium-efficiency-label">{stats.efficiency}%</span>
          <div className="medium-efficiency-bar">
            <div className="medium-efficiency-fill" style={{
              width: `${efficiencyNum}%`,
              backgroundColor: efficiencyNum >= 50 ? 'var(--success)' : 'var(--danger)'
            }} />
          </div>
        </div>

        <div className="medium-stats-row">
          <div className="medium-stat">
            <span className="medium-stat-value">{stats.kills.toLocaleString()}</span>
            <span className="medium-stat-label">K</span>
          </div>
          <div className="medium-stat">
            <span className="medium-stat-value loss">{stats.losses.toLocaleString()}</span>
            <span className="medium-stat-label">L</span>
          </div>
          <div className="medium-stat">
            <span className="medium-stat-value isk">{formatISK(stats.isk_destroyed)}</span>
            <span className="medium-stat-label">ISK</span>
          </div>
          <div className="medium-stat">
            <span className="medium-stat-value active">{stats.activePilots}</span>
            <span className="medium-stat-label">👥</span>
          </div>
        </div>

        {stats.topShipId && (
          <div className="medium-top-ship">
            <img
              src={`https://images.evetech.net/types/${stats.topShipId}/icon?size=24`}
              className="medium-ship-icon"
              alt={stats.topShip}
              onError={(e) => e.target.style.display = 'none'} 
            />
          </div>
        )}
      </div>
    );
  };

  const renderCompactCard = (data) => {
    const { stats } = data;
    const efficiencyNum = parseFloat(stats.efficiency) || 0;
    const isActive = String(lurkerTarget) === String(data.id);

    return (
      <div
        key={data.id}
        className={`compact-card ${isActive ? 'active-filter' : ''}`}
        onClick={() => handleCardClick(data)}
        onMouseEnter={(e) => handleCardMouseEnter(data, e)}
        onMouseLeave={handleCardMouseLeave}
      >
        <img
          src={`https://images.evetech.net/${data.type}s/${data.id}/logo?size=64`}
          alt={data.name}
          className="compact-logo"
        />
        <div className="compact-info">
          <span className="compact-ticker" style={{ color: data.color || '#a0aec0' }}>
            {data.ticker || data.name?.substring(0, 5)}
          </span>
          <div className="compact-gauge">
            <div className="compact-gauge-fill" style={{
              width: `${efficiencyNum}%`,
              backgroundColor: efficiencyNum >= 50 ? 'var(--success)' : 'var(--danger)'
            }} />
          </div>
          <div className="compact-isk">
            <span className="compact-isk-value isk">{formatISK(stats.isk_destroyed)}</span>
            <span className="compact-isk-value loss">{formatISK(stats.isk_lost)}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderAllianceTooltipContent = (data) => {
    const { stats } = data;
    const maxKill = stats.maxKill;

    return (
      <div className="alliance-tooltip-content">
        <div className="tooltip-header">
          <img
            src={`https://images.evetech.net/${data.type}s/${data.id}/logo?size=64`}
            alt={data.name}
            className="tooltip-logo"
          />
          <div className="tooltip-info">
            <span className="tooltip-name" style={{ color: data.color }}>{data.name}</span>
            <span className="tooltip-ticker">
              {data.ticker && `[${data.ticker}]`}
              {data.corpCount && ` · ${data.corpCount} corps`}
            </span>
          </div>
        </div>
        <div className="tooltip-stats-grid">
          <div className="tooltip-stat">
            <span className="tooltip-stat-value">{stats.kills.toLocaleString()}</span>
            <span className="tooltip-stat-label">Kills</span>
          </div>
          <div className="tooltip-stat">
            <span className="tooltip-stat-value loss">{stats.losses.toLocaleString()}</span>
            <span className="tooltip-stat-label">Losses</span>
          </div>
          <div className="tooltip-stat">
            <span className="tooltip-stat-value isk">{formatISK(stats.isk_destroyed)}</span>
            <span className="tooltip-stat-label">Destroyed</span>
          </div>
          <div className="tooltip-stat">
            <span className="tooltip-stat-value loss">{formatISK(stats.isk_lost)}</span>
            <span className="tooltip-stat-label">Lost</span>
          </div>
          <div className="tooltip-stat">
            <span className="tooltip-stat-value efficiency">{stats.efficiency}%</span>
            <span className="tooltip-stat-label">Efficiency</span>
          </div>
          <div className="tooltip-stat">
            <span className="tooltip-stat-value">{stats.ratio}:1</span>
            <span className="tooltip-stat-label">Ratio</span>
          </div>
          <div className="tooltip-stat">
            <span className="tooltip-stat-value active">{stats.activePilots}</span>
            <span className="tooltip-stat-label">Active</span>
          </div>
          {stats.topShip && (
            <div className="tooltip-stat">
              <span className="tooltip-stat-value">{stats.topShip}</span>
              <span className="tooltip-stat-label">Top Ship</span>
            </div>
          )}
        </div>
        {maxKill && (
          <div className="tooltip-mvp">
            <span className="tooltip-mvp-label">MVP Kill:</span>
            <span className="tooltip-mvp-value">{formatISK(maxKill.total_value)}</span>
            <span className="tooltip-mvp-ship">{maxKill.victim?.ship_type_name || maxKill.victim_ship_name}</span>
          </div>
        )}
        <div className="tooltip-hint">Click to enter 👁️ Lurker Mode — watch kills, losses &amp; assists across the entire global feed</div>
      </div>
    );
  };

  const focusedItem = allianceDataList.find(a => String(a.id) === String(lurkerTarget));
  const focusedType = focusedItem ? focusedItem.type : 'entity';
  const focusedEntityName = lurkerTarget && focusedItem?.name;

  return (
    <div className={`kill-feed view-mode-${viewMode}`}>
      {/* Stats Bar / Header Area */}
      <div className="feed-header">
        <div className="feed-title-row">
          <h2>Killmail Feed</h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             {/* VIEW SWITCHER */}
             <div className="view-switcher">
                <button 
                  className={`view-btn ${viewMode === 'standard' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('standard')}
                  title="Standard View"
                >
                  <LayoutList />
                </button>
                <button 
                  className={`view-btn ${viewMode === 'compact' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('compact')}
                  title="Compact List"
                >
                  <AlignJustify />
                </button>
                <button 
                  className={`view-btn ${viewMode === 'mosaic' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('mosaic')}
                  title="Mosaic Grid"
                >
                  <Grid />
                </button>
             </div>
             
             <span className="kill-count">{kills.length} kills</span>
          </div>
        </div>

        {/* Focus/Lurker mode indicator */}
        {lurkerTarget && (
          <div className="temp-filter-banner">
            {isLurkerMode ? (
              <span className="lurker-banner-text">
                👁️ Lurker Mode — watching <strong>{focusedEntityName || 'entity'}</strong> across global feed
                <span className="lurker-info-wrap">
                  ⓘ
                  <div className="lurker-info-tooltip">
                    <div className="lurker-info-title">How Lurker Mode Works</div>
                    <p className="lurker-info-desc">
                      The global feed runs normally — <strong>nothing is hidden</strong>. Every kill appears.
                      Kills involving <strong>{focusedEntityName}</strong> are color-coded:
                    </p>
                    <ul className="lurker-info-list">
                      <li>
                        <span className="li-kill">Kill</span>
                        <span className="li-example">{focusedEntityName} destroyed a ship → colored border &amp; glow</span>
                      </li>
                      <li>
                        <span className="li-loss">Loss</span>
                        <span className="li-example">{focusedEntityName}'s ship was destroyed → red highlight</span>
                      </li>
                      <li>
                        <span className="li-assist">Assist</span>
                        <span className="li-example">{focusedEntityName} helped in a kill → orange tint</span>
                      </li>
                      <li>
                        <span className="li-other">Other</span>
                        <span className="li-example">Unrelated kills appear with no special styling</span>
                      </li>
                    </ul>
                    <p className="lurker-info-note">
                      Their kills always appear even when other filters (ship type, value, etc.) are active — filters apply to everything <em>except</em> lurked entity events.
                    </p>
                    <p className="lurker-info-note">Unlike Focus Mode (clicking an entity card), Lurker Mode never hides kills from your feed.</p>
                  </div>
                </span>
              </span>
            ) : (
              <span>Focusing: <strong>{focusedEntityName || 'Selected Entity'}</strong> — showing only this {focusedType}'s kills</span>
            )}
            {!isLurkerMode && (
              <button onClick={() => setFocusTarget(null)} className="clear-filter-btn">
                Show All
              </button>
            )}
          </div>
        )}

        {statsLoading && allianceDataList.length === 0 && (
          <div className="alliance-stats-bar single-alliance skeleton-pulse">
            Loading Alliance Intel...
          </div>
        )}

        {/* 1 Alliance */}
        {isSingleAlliance && renderFullStats(allianceDataList[0])}

        {/* 2 Alliances */}
        {allianceCount === 2 && (
          <div className="alliance-stats-bar layout-versus">
            {renderVersusCard(allianceDataList[0], 'left')}
            <div className="versus-divider">VS</div>
            {renderVersusCard(allianceDataList[1], 'right')}
          </div>
        )}

        {/* 3 Alliances */}
        {allianceCount === 3 && (
          <div className="alliance-stats-bar layout-3">
            {allianceDataList.map(data => renderMediumCard(data))}
          </div>
        )}

        {/* 4+ Alliances (Horizontal Scroll) */}
        {allianceCount >= 4 && (
          <div ref={allianceScrollRef} className="alliance-stats-bar layout-scroll">
            {allianceDataList.map(data => renderCompactCard(data))}
          </div>
        )}
      </div>

      {/* FEED CONTENT AREA */}
      <div className="feed-content">
        {loading && kills.length === 0 ? (
          <div className="feed-status">Loading killmails...</div>
        ) : error ? (
          <div className="feed-error">{error}</div>
        ) : kills.length === 0 ? (
          <div className="feed-empty">
             <p>{lurkerTarget
                ? "No recent kills found for this entity." 
                : "No killmails found. Try adjusting your settings!"}</p>
             
             {hasMore && !loadingMore && (
                 <button 
                    className="clear-filter-btn" 
                    style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
                    onClick={onLoadMore}
                 >
                    Load Older Kills
                 </button>
             )}
          </div>
        ) : (
          <>
            {/* --- LIST RENDER LOGIC --- */}
            {viewMode === 'standard' && (
               <div className="kill-list">
                  {sortedKillsForList.map(kill => <KillCard key={kill.killmail_id} kill={kill} />)}
               </div>
            )}

            {viewMode === 'compact' && (
               <div className="kill-list" style={{ gap: '2px' }}>
                  {sortedKillsForList.map(kill => <CompactKillRow key={kill.killmail_id} kill={kill} />)}
               </div>
            )}

            {viewMode === 'mosaic' && (
               <div className="mosaic-grid">
                  {sortedKillsForMosaic.map(kill => (
                    <MosaicCard 
                      key={kill.killmail_id} 
                      kill={kill} 
                      spawnInfo={spawnInfoMap[String(kill.killmail_id)]}
                      onHover={handleMosaicHover}
                      onLeave={handleMosaicLeave}
                    />
                  ))}
               </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="scroll-sentinel" />

            {loadingMore && (
              <div className="load-more-indicator">
                <div className="load-more-spinner" />
                <span>Loading more killmails...</span>
              </div>
            )}

            {!hasMore && kills.length > 0 && (
              <div className="end-of-results">
                End of results
              </div>
            )}
          </>
        )}
      </div>

      {/* ALLIANCE STATS TOOLTIP PORTAL */}
      {hoveredAlliance && createPortal(
        <div
          className="alliance-tooltip-portal"
          style={{
            position: 'fixed',
            top: allianceTooltipPos.top,
            left: allianceTooltipPos.left,
            transform: 'translateX(-50%)',
            zIndex: 99999
          }}
        >
          {renderAllianceTooltipContent(hoveredAlliance)}
        </div>,
        document.body
      )}

      {/* MOSAIC CARD TOOLTIP PORTAL */}
      {hoveredKill && viewMode === 'mosaic' && (
         <KillTooltip data={hoveredKill} position={mosaicTooltipPos} />
      )}
    </div>
  );
}

export default KillFeed;
