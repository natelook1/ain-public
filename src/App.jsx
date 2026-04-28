import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react'
import { AllianceProvider, useAlliance } from './context/AllianceContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { MapModeProvider, useMapMode } from './context/MapModeContext'
import { ConsentProvider } from './context/ConsentContext'
import Header from './components/Header/Header'
import StatsBar from './components/StatsBar/StatsBar'
import Sidebar from './components/Sidebar/Sidebar'
import KillFeed from './components/Feed/KillFeed'
import Heatmap from './components/Heatmap/Heatmap'
import Filters from './components/Filters/Filters'
import CookieBanner from './components/CookieBanner/CookieBanner'
import LegalModal from './components/Legal/LegalModal'
import Footer from './components/Footer/Footer'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import { fetchKillFeed } from './api/feed';
import { API_ENDPOINTS } from './api/config';

const Starmap = lazy(() => import('./components/Starmap/Starmap'));

const getFingerprint = () => {
  if (typeof window === 'undefined') return 'unknown_pilot';
  let fp = localStorage.getItem('intel_fingerprint');
  if (!fp) {
    fp = 'pilot_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('intel_fingerprint', fp);
  }
  return fp;
};

function AppContent() {
  const { mapMode, isMobile } = useMapMode();
  const { activeAllianceIds, activeCorpIds, lurkerTarget, isLurkerMode, trackedCorps } = useAlliance();
  const { theme } = useTheme();
  const [isLegalOpen, setIsLegalOpen] = useState(false);

  // StatsBar minimized state hoisted from StatsBar component
  const [isStatsMinimized, setIsStatsMinimized] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });

  // Enforce default positions on mode/view changes
  useEffect(() => {
    if (mapMode) {
      setIsStatsMinimized(true);
    } else if (isMobile) {
      setIsStatsMinimized(true);
    } else {
      setIsStatsMinimized(false);
    }
  }, [mapMode, isMobile]);

  // Default filters open on desktop, closed on mobile
  const [showFilters, setShowFilters] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });

  // UNIFIED IDENTITY & VIEW STATE
  const [feedViewMode, setFeedViewMode] = useState('standard');
  const [mapViewMode, setMapViewMode] = useState('map_2d');
  
  // Initialize Identity
  const fingerprint = useMemo(() => getFingerprint(), []);
  const activeViewFingerprint = mapMode ? mapViewMode : feedViewMode;

  const [filters, setFilters] = useState({
    roleFilters: [],
    encounterTypes: [],
    shipTypes: [],
    valueRanges: [],
    spaceTypes: [],
    regionIds: [],
    hideStructures: false,
    hidePods: false,
    hideRookieShips: false,
    searchTerm: ''
  });

  const [killFeedData, setKillFeedData] = useState([]);
  
  // PERFORMANCE FIX: Separate state for Starmap prevents background updates when map is hidden
  const [starmapData, setStarmapData] = useState([]);

  const [loadingKillFeed, setLoadingKillFeed] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [errorKillFeed, setErrorKillFeed] = useState(null);

  // Pagination cursors
  const oldestKillIdRef = useRef(null);
  const latestKnownIdRef = useRef(null);
  
  // Track last fetched params to prevent duplicate fetches
  const lastFetchParamsRef = useRef('');
  const abortControllerRef = useRef(null);
  const loadingMoreRef = useRef(false);

  const killfeedWrapperRef = useRef(null);

  // --- SYNC STARMAP DATA SAFELY ---
  // Only push updates to the heavy Starmap component if it is actually visible.
  useEffect(() => {
    if (mapMode) {
      setStarmapData(killFeedData);
    }
  }, [killFeedData, mapMode]);

  const buildFilterParams = useCallback(() => {
    const params = {};
    if (lurkerTarget) {
      const isCorp = trackedCorps.some(c => String(c.id) === String(lurkerTarget));
      if (isCorp) {
        params.corporation_id = String(lurkerTarget);
      } else {
        params.alliance_id = String(lurkerTarget);
      }
      if (isLurkerMode) {
        params.lurker = 'true';
      }
    } else {
      if (activeAllianceIds.length > 0) {
        params.alliance_id = activeAllianceIds.join(',');
      }
      if (activeCorpIds && activeCorpIds.length > 0) {
        params.corporation_id = activeCorpIds.join(',');
      }
    }
    if (filters.searchTerm) {
      params.search_query = filters.searchTerm;
    }
    if (filters.roleFilters?.length > 0) {
      params.filters_main = (params.filters_main ? params.filters_main + ',' : '') + filters.roleFilters.join(',');
    }
    if (filters.encounterTypes?.length > 0) {
      params.filters_main = (params.filters_main ? params.filters_main + ',' : '') + filters.encounterTypes.join(',');
    }
    if (filters.hidePods) {
      params.filters_main = (params.filters_main ? params.filters_main + ',' : '') + 'hide-pods';
    }
    if (filters.hideStructures) {
      params.filters_main = (params.filters_main ? params.filters_main + ',' : '') + 'hide-structures';
    }
    if (filters.hideRookieShips) {
      params.filters_main = (params.filters_main ? params.filters_main + ',' : '') + 'hide-trash';
    }
    if (filters.spaceTypes?.length > 0) {
      params.filters_space = filters.spaceTypes.join(',');
    }
    if (filters.valueRanges?.length > 0) {
      params.filters_isk = filters.valueRanges.join(',');
    }
    if (filters.shipTypes?.length > 0) {
      params.filters_ship = filters.shipTypes.join(',');
      if (filters.shipTypesTarget) {
        params.filters_ship_target = filters.shipTypesTarget;
      }
    }
    if (filters.regionIds?.length > 0) {
      params.filters_region = filters.regionIds.join(',');
    }
    return params;
  }, [filters, activeAllianceIds, activeCorpIds, lurkerTarget, isLurkerMode, trackedCorps]);

  const deduplicateKills = (kills) => {
    return [...new Map(kills.map(k => [k.killmail_id, k])).values()];
  };

  // Load More - with capped auto-retry for sparse filters
  const MAX_AUTO_RETRIES = 3;
  const loadMoreKills = useCallback(async (isRecursive = false, retryCount = 0) => {
    if (!oldestKillIdRef.current || (loadingMoreRef.current && !isRecursive)) return;

    if (!isRecursive) {
        setLoadingMore(true);
        loadingMoreRef.current = true;
    }

    try {
      const params = {
        ...buildFilterParams(),
        limit: 50,
        before_kill_id: oldestKillIdRef.current,
        view: activeViewFingerprint,
        fingerprint: fingerprint
      };

      const data = await fetchKillFeed(params);

      if (!data.error) {
        const newKills = data.kills || [];
        const prevCursor = oldestKillIdRef.current;

        oldestKillIdRef.current = data.oldest_kill_id || null;

        const isExplicitEnd = data.end_of_results === true;
        const isStuck = data.oldest_kill_id && data.oldest_kill_id === prevCursor;
        const isEmpty = newKills.length === 0;
        const isFinished = isExplicitEnd || isStuck || (isEmpty && !data.partial_result);

        setHasMore(!isFinished);

        if (newKills.length > 0) {
          setKillFeedData(prev => deduplicateKills([...prev, ...newKills]).slice(0, 1000));
        }

        // Auto-continue for sparse results, but with a hard cap on retries
        if (!isFinished && (isEmpty || newKills.length < 10) && retryCount < MAX_AUTO_RETRIES) {
             setTimeout(() => {
                 loadMoreKills(true, retryCount + 1);
             }, 500); // 500ms between retries (was 100ms)
             return;
        }
      }
    } catch (err) {
      console.error('Failed to load more kills:', err);
    }

    setLoadingMore(false);
    loadingMoreRef.current = false;
  }, [buildFilterParams, activeViewFingerprint, fingerprint]);

  // Initial fetch - Resets list
  const fetchFilteredKillFeed = useCallback(async () => {
    const params = buildFilterParams();
    // Include identity in param string check to ensure view/fingerprint changes trigger fetch
    const paramString = JSON.stringify({ ...params, view: activeViewFingerprint, fingerprint });

    if (loadingKillFeed && paramString === lastFetchParamsRef.current) return;
    lastFetchParamsRef.current = paramString;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoadingKillFeed(true);
    setErrorKillFeed(null);
    setHasMore(true);
    oldestKillIdRef.current = null;
    latestKnownIdRef.current = null;
    loadingMoreRef.current = false; // Reset lock

    try {
      const fetchParams = { 
        ...params, 
        limit: 50, 
        signal, 
        view: activeViewFingerprint, 
        fingerprint: fingerprint 
      };
      const data = await fetchKillFeed(fetchParams);
      
      if (signal.aborted) return;
      if (data.error) throw new Error(data.error);

      const kills = deduplicateKills(data.kills || []);
      setKillFeedData(kills);

      oldestKillIdRef.current = data.oldest_kill_id || null;
      if (kills.length > 0) {
        latestKnownIdRef.current = String(kills[0].killmail_id);
      }

      const noMore = data.end_of_results || (kills.length === 0 && !data.partial_result);
      setHasMore(!noMore);
      
      // Auto-start loadMore if initial result was sparse/partial
      if (kills.length === 0 && data.partial_result && !data.end_of_results) {
           setTimeout(() => loadMoreKills(false), 100); // Standard load, allows loadingMore state to engage
      }

    } catch (err) {
      if (err.name === 'AbortError') return;
      setErrorKillFeed('Failed to load kill feed data.');
    } finally {
      if (!signal.aborted) {
        setLoadingKillFeed(false);
      }
    }
  }, [buildFilterParams, loadMoreKills, activeViewFingerprint, fingerprint]);

  // Initial load
  useEffect(() => {
    fetchFilteredKillFeed();
  }, [fetchFilteredKillFeed]);

  // Keep a ref to the latest filter builder so the SSE effect can read
  // current filters without needing to re-subscribe every time they change.
  const buildFilterParamsRef = useRef(buildFilterParams);
  useEffect(() => { buildFilterParamsRef.current = buildFilterParams; }, [buildFilterParams]);

  const activeViewFingerprintRef = useRef(activeViewFingerprint);
  useEffect(() => { activeViewFingerprintRef.current = activeViewFingerprint; }, [activeViewFingerprint]);

  // SSE — reconnects whenever filters or alliance selection changes
  useEffect(() => {
    const filterParams = buildFilterParamsRef.current();

    // In lurker mode, drop alliance/corp scope from SSE so all kills stream in.
    // The feed UI handles highlighting lurked kills client-side.
    const sseParams = { ...filterParams };
    if (sseParams.lurker === 'true') {
      delete sseParams.alliance_id;
      delete sseParams.corporation_id;
    }

    const qs = new URLSearchParams();
    Object.entries(sseParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const url = `${API_ENDPOINTS.SSE}?${qs.toString()}`;

    const sendPresence = () => {
      const params = buildFilterParamsRef.current();
      fetch(API_ENDPOINTS.SSE_PRESENCE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ view: activeViewFingerprintRef.current, query: params, fingerprint: getFingerprint() }),
        keepalive: true,
      }).catch(() => {});
    };

    let es = new EventSource(url);

    es.addEventListener('kill', (e) => {
      try {
        const kill = JSON.parse(e.data);
        latestKnownIdRef.current = String(kill.killmail_id);
        setKillFeedData(prev => deduplicateKills([kill, ...prev]).slice(0, 1000));
      } catch {
        // malformed event — ignore
      }
    });

    es.onopen = () => sendPresence();
    es.onerror = () => {};

    const presenceInterval = setInterval(sendPresence, 60_000);

    return () => {
      es.close();
      clearInterval(presenceInterval);
    };
  }, [activeAllianceIds, activeCorpIds, lurkerTarget, isLurkerMode, filters]);

  // Cleanup fetch abort on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (killfeedWrapperRef.current) {
      killfeedWrapperRef.current.scrollTop = 0;
    }
  }, [filters, activeAllianceIds, activeCorpIds, lurkerTarget]);

  return (
    <div className={`app ${theme} ${isStatsMinimized ? 'stats-minimized' : ''}`}>
      <CookieBanner />
      <LegalModal isOpen={isLegalOpen} onClose={() => setIsLegalOpen(false)} />

      <Header />
      <StatsBar 
        isMinimized={isStatsMinimized} 
        onToggleMinimize={() => setIsStatsMinimized(prev => !prev)} 
      />
      <div className="app-body">
        <Sidebar onOpenLegal={() => setIsLegalOpen(true)} />
        <main className={`main-content ${mapMode ? 'starmap-active' : ''}`}>
          {!mapMode && <Heatmap />}
          <Filters 
            onDebouncedFiltersChange={setFilters} 
            showFilters={showFilters}
            setShowFilters={setShowFilters}
          />
          <div className="main-view-container">
            <div className={`starmap-wrapper ${mapMode ? 'visible' : 'hidden'}`}>
              <ErrorBoundary fallback={<div className="map-error">Map failed to load. <button onClick={() => window.location.reload()}>Reload</button></div>}>
                <Suspense fallback={<div className="map-loading">Loading map…</div>}>
                  <Starmap
                    killFeedData={starmapData}
                    filters={filters}
                    onMapViewChange={setMapViewMode}
                    fingerprint={fingerprint}
                    currentView={activeViewFingerprint}
                  />
                </Suspense>
              </ErrorBoundary>
            </div>

            <div
              className={`killfeed-wrapper ${!mapMode ? 'visible' : 'hidden'}`}
              ref={killfeedWrapperRef}
              style={{ display: mapMode ? 'none' : 'block' }}
            >
              <ErrorBoundary>
                <KillFeed
                  filters={filters}
                  killFeedData={killFeedData}
                  loading={loadingKillFeed}
                  loadingMore={loadingMore}
                  hasMore={hasMore}
                  onLoadMore={() => loadMoreKills(false)}
                  scrollContainerRef={killfeedWrapperRef}
                  error={errorKillFeed}
                  showFilters={showFilters}
                  setShowFilters={setShowFilters}
                  onViewChange={setFeedViewMode}
                  fingerprint={fingerprint}
                  currentView={activeViewFingerprint}
                />
              </ErrorBoundary>
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <ConsentProvider>
        <AllianceProvider>
          <MapModeProvider>
            <AppContent />
          </MapModeProvider>
        </AllianceProvider>
      </ConsentProvider>
    </ThemeProvider>
  )
}

export default App
