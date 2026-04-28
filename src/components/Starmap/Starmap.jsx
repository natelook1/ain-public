import React, { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { systemsData as sdeSystemsData } from './systemsData.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { useAlliance } from '../../context/AllianceContext';
import { useTheme } from '../../context/ThemeContext';
import { useMapMode } from '../../context/MapModeContext';
import { fetchKillFeed } from '../../api/feed';
import { API_ENDPOINTS } from '../../api/config';
import './Starmap.css';

// Utility for class names
function cn(...classes) {
    return classes.filter(Boolean).join(' ');
}

// --- ICONS (Inline) ---
const HomeIcon = ({ size = 24, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);
const MapPin = ({ size = 24, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
);
const Check = ({ size = 24, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"/></svg>
);
const Layers = ({ size = 24, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
);
const Video = ({ size = 24, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
);
const Search = ({ size = 24, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
);
const Zap = ({ size = 24, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);
const Settings = ({ size = 24, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);
const HelpIcon = ({ size = 24, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
);
const Clock = ({ size = 24, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);
const XCircle = ({ size = 24, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
);
const Download = ({ size = 24, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
);

// --- CONSTANTS ---
const FOG_DENSITY = 0.00025; // Reduced fog for better visibility of distant clusters
const FAR_DISTANCE = 8000;
const SYSTEM_INTEL_ENDPOINT = API_ENDPOINTS.SYSTEM_INTEL;
const SCALING_FACTOR = 1000000000000000;
const SYSTEM_RADIUS = 0.8;
const URL_JUMPS = 'https://www.fuzzwork.co.uk/dump/latest/mapSolarSystemJumps.csv';
const URL_REGIONS = 'https://www.fuzzwork.co.uk/dump/latest/mapRegions.csv';
const MAJOR_HUBS = ["Jita", "Amarr", "Dodixie", "Rens", "Hek", "1DQ1-A", "Ahbazon", "Tama", "Uedama", "M2-XFE", "Thera"];
const POCHVEN_REGION_ID = '10000070';
const ANOIKIS_REGION_ID = '11000001';
const POCHVEN_ELEVATION = 0;
const POCHVEN_SYSTEM_ORDER = [
    "Kino", "Nalvula", "Konola", "Krirald", "Otanuomi", "Urhinichi", "Nani", "Skarkon", "Raravoss",
    "Niarja", "Harva", "Tunudan", "Kuharah", "Ahtila", "Senda", "Wirashoda", "Ala", "Vale",
    "Archee", "Angymonne", "Ichoriya", "Kaunokka", "Arvasaras", "Sakenta", "Komo", "Ignebaener", "Otela"
];

// --- ABYSSAL ZONE CONFIGURATION ---
const ABYSSAL_ZONE = { x: 0, y: -200, z: 0, spread: 30 }; // Centered under New Eden
const ABYSSAL_SYSTEM_COUNT = 20; // Number of visible stars in the Abyssal cloud
const ANOIKIS_ZONE = { x: 0, y: -400, z: 0 }; // Centered under New Eden


// Helper to generate deterministic positions for Abyssal systems based on ID
const getAbyssalPosition = (id) => {
    const seed = id * 9301 + 49297;
    const rng = (s) => {
        var t = s += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const r = rng(seed) * ABYSSAL_ZONE.spread;
    const theta = rng(seed + 1) * Math.PI * 2;
    const phi = Math.acos(2 * rng(seed + 2) - 1);
    return {
        x: ABYSSAL_ZONE.x + r * Math.sin(phi) * Math.cos(theta),
        y: ABYSSAL_ZONE.y + r * Math.sin(phi) * Math.sin(theta),
        z: ABYSSAL_ZONE.z + r * Math.cos(phi)
    };
};

const formatIsk = (val) => {
    const v = parseFloat(val);
    if (isNaN(v)) return { number: '0', suffix: '' };
    if (v >= 1e12) return { number: (v / 1e12).toFixed(1), suffix: 't' }; 
    if (v >= 1e9) return { number: (v / 1e9).toFixed(1), suffix: 'b' }; 
    if (v >= 1e6) return { number: (v / 1e6).toFixed(1), suffix: 'm' }; 
    if (v >= 1e3) return { number: (v / 1e3).toFixed(1), suffix: 'k' }; 
    return { number: Math.floor(v).toString(), suffix: '' };
};
const formatClass = (str) => str ? str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : "";
const formatDate = (timestamp) => new Date(timestamp).toISOString().replace('T', ' ').substring(0, 16);
const getTimeAgo = (timestamp) => {
    const s = Math.floor((Date.now() - timestamp) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return '>1d ago';
};
const getEmblemUrl = (allianceId, corpId) => allianceId ? `https://images.evetech.net/alliances/${allianceId}/logo?size=64` : (corpId ? `https://images.evetech.net/corporations/${corpId}/logo?size=64` : null);
const getBorderColor = (val) => val >= 5e10 ? '#ffffff' : val >= 2e10 ? '#e74c3c' : val >= 1e10 ? '#e67e22' : val >= 1e9 ? '#f1c40f' : val >= 1e8 ? '#2ecc71' : val >= 1e7 ? '#3498db' : '#bdc3c7';
const getSecColor = (sec) => sec >= 0.5 ? '#4ade80' : sec > 0 ? '#f59e0b' : '#ef4444';
const getSecBg = (sec, isActive) => isActive ? 'rgba(255,255,255,0.1)' : sec >= 0.5 ? 'rgba(74, 222, 128, 0.08)' : sec > 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)';

// GOLDEN ANGLE COLOR GENERATOR
const getRegionColor = (regionId) => {
    const id = parseInt(regionId) || 0; 
    const hue = (id * 137.508) % 360; 
    
    // Jove Space (Teal/Cyan)
    if (['10000004', '10000017', '10000019'].includes(regionId)) {
        return new THREE.Color(0x00ffff); 
    }

    // Anoikis (Wormhole Space)
    if (id >= 11000000 && id < 12000000) {
        if (id === 11000033) return new THREE.Color(0xff0000); // Drifter (Bright Red)
        // Distinct hues for regions to keep them distinguishable
        return new THREE.Color().setHSL(hue / 360, 0.6, 0.3); 
    }
    
    return new THREE.Color(`hsl(${hue}, 75%, 55%)`); 
};

const isAnoikisRegion = (regionId) => {
    const id = parseInt(regionId);
    return id >= 11000000 && id < 12000000;
};

const RAW_JUMPS_CSV = `0,0,30000142,30000144,0,0\n0,0,30000144,30000145,0,0\n0,0,30000144,30002813,0,0\n0,0,30002187,30005196,0,0\n0,0,30002659,30002510,0,0\n0,0,30002053,30004759,0,0`;

// Shared geometry for kill markers to reduce memory overhead
const SHARED_KILL_SPHERE_GEO = new THREE.SphereGeometry(1, 12, 12);

const TimeAgo = ({ timestamp }) => {
    const [text, setText] = useState(getTimeAgo(timestamp));
    useEffect(() => { const t = setInterval(() => setText(getTimeAgo(timestamp)), 1000); return () => clearInterval(t); }, [timestamp]);
    return <span style={{ color: '#888', fontSize: '9px' }}>{text}</span>;
};

// --- HELPER FOR TEXT VALIDATION ---
const isValidText = (t) => t && t !== "undefined" && t !== "null" && t !== "None" && t !== "None (undefined)" && t !== "Unknown";

// --- HELPER FOR COORDINATE VALIDATION ---
const isValidNumber = (n) => typeof n === 'number' && !isNaN(n) && isFinite(n);
const isValidVector = (v) => v && isValidNumber(v.x) && isValidNumber(v.y) && isValidNumber(v.z);
const safeVector = (v, fallback) => isValidVector(v) ? v : fallback;

const DEFAULT_HOME_POS = new THREE.Vector3(-745, 531, 1095);
const DEFAULT_HOME_LOOKAT = new THREE.Vector3(232, -480, -150);

// --- MAIN COMPONENT ---
export default function Starmap({ killFeedData, filters, onMapViewChange, fingerprint, currentView }) {
    const { addAlliance, trackedAlliances, activeAllianceIds } = useAlliance();
    const { theme } = useTheme();
    const { mapMode, setMapMode } = useMapMode();
    const containerRef = useRef(null);
    const starmapContainerRef = useRef(null);
    const [, setStatus] = useState("Initializing...");
    const [formattedKillFeed, setFormattedKillFeed] = useState([]);
    const [activeKillId, setActiveKillId] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [hoveredKillId, setHoveredKillId] = useState(null);
    const [selectedSystem, setSelectedSystem] = useState(null);
    const [systemIntel, setSystemIntel] = useState(null);
    const [hoveredSystem, setHoveredSystem] = useState(null);
    const [hoveredKillMarker, setHoveredKillMarker] = useState(null); // For 3D marker hover info
    const [hoveredKillCardTooltip, setHoveredKillCardTooltip] = useState(null); // { x, y, count }
    const [isAutoLocate, setIsAutoLocate] = useState(false);
    const [autoLocateCriteria, setAutoLocateCriteria] = useState('all');
    const [killMarkerLimit, setKillMarkerLimit] = useState(100);
    const [killMarkerTimeLimit, setKillMarkerTimeLimit] = useState(120);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [layoutMode, setLayoutMode] = useState('REG'); // 'REG' (active) | 'MAP' (coming soon)
    useEffect(() => { layoutModeRef.current = layoutMode; }, [layoutMode]);
    const [searchActive, setSearchActive] = useState(false);
    const [resetActive, setResetActive] = useState(false);
    const [regionMode, setRegionMode] = useState('TAC');
    const [isHD, setIsHD] = useState(false);
    const [is2D, setIs2D] = useState(true);
    const [brightness, setBrightness] = useState(1.0);
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const [idleResetEnabled, setIdleResetEnabled] = useState(true);
    const [idleResetTime, setIdleResetTime] = useState(15);
    const [showControls, setShowControls] = useState(false);
    const [debugInfo, setDebugInfo] = useState({ camPos: {x:0,y:0,z:0}, lookAt: {x:0,y:0,z:0} });

    // Refs moved up to avoid TDZ issues
    const isHDRef = useRef(isHD);
    const is2DRef = useRef(is2D);
    const brightnessRef = useRef(1.0);
    const hideAnoikisRef = useRef(true);
    const layoutModeRef = useRef(layoutMode);
    const hideKSpaceRef = useRef(false);
    const hideAbyssalRef = useRef(false);

    // 2D Mode Settings
    const [killCardLifespan2D, setKillCardLifespan2D] = useState(60);
    const killCardLifespan2DRef = useRef(60);
    useEffect(() => { killCardLifespan2DRef.current = killCardLifespan2D; }, [killCardLifespan2D]);

    // Store center for 2D layout
    const layoutCentersRef = useRef({ REG: {x:0, z:0} });

    // --- MULTI-HOME VIEWS STATE ---
    const DEFAULT_VIEWS = [
        { id: 'kspace', name: 'New Eden', shortcut: '1', pos: {x: -117, y: 653, z: 727}, lookAt: {x: -117, y: -36, z: 36} },
        { id: 'overview', name: 'Cluster', shortcut: '2', pos: {x: -745, y: 531, z: 1095}, lookAt: {x: 232, y: -480, z: -150} },
        { id: 'anoikis', name: 'Anoikis', shortcut: '3', pos: {x: 0, y: -300, z: 1400}, lookAt: {x: 0, y: -650, z: 50} },
        { id: 'abyssal', name: 'Abyssal', shortcut: '4', pos: {x: 0, y: -150, z: 250}, lookAt: {x: 0, y: -200, z: 0} },
        { id: 'strategic', name: 'Home', shortcut: '1', is2D: true, pos: {x: 0, y: 1700, z: 0}, lookAt: {x: 0, y: 0, z: 0} },
    ];

    const [savedViews, setSavedViews] = useState(() => {
        try {
            const saved = localStorage.getItem('starmap_saved_views');
            if (saved) {
                const parsed = JSON.parse(saved);
                const updatedDefaults = DEFAULT_VIEWS.map(def => {
                    const found = parsed.find(p => p.id === def.id);
                    return found ? { ...def, pos: found.pos, lookAt: found.lookAt, visibility: found.visibility, is2D: def.is2D } : def;
                });
                const customViews = parsed.filter(p => !DEFAULT_VIEWS.some(d => d.id === p.id));
                return [...updatedDefaults, ...customViews];
            }
        } catch (e) { console.warn("Failed to load saved views", e); }
        return DEFAULT_VIEWS;
    });
    const [viewContextMenu, setViewContextMenu] = useState(null);
    const [activeViewId, setActiveViewId] = useState('strategic');
    const [hideAnoikis, setHideAnoikis] = useState(true);
    useEffect(() => { hideAnoikisRef.current = hideAnoikis; }, [hideAnoikis]);
    const [hideKSpace, setHideKSpace] = useState(false);
    useEffect(() => { hideKSpaceRef.current = hideKSpace; }, [hideKSpace]);
    const [hideAbyssal, setHideAbyssal] = useState(true);
    useEffect(() => { hideAbyssalRef.current = hideAbyssal; }, [hideAbyssal]);
    const hasInitializedRef = useRef(false);

    // Report map view mode changes to parent for telemetry
    useEffect(() => {
        if (onMapViewChange) {
            const mode = !is2D ? 'map_3d' : layoutMode === 'MAP' ? 'map_flat' : 'map_2d';
            onMapViewChange(mode);
        }
    }, [is2D, layoutMode, onMapViewChange]);

    // Sync Starmap state with MapModeContext
    useEffect(() => {
        if (mapMode) {
            hasInitializedRef.current = true;

            if (mapMode === 'strategic') {
                return;
            }

            const view = savedViews.find(v => v.id === mapMode);
            if (view) {
                if (activeViewId !== mapMode) setActiveViewId(mapMode);
                
                if (view.visibility) {
                    setHideAnoikis(view.visibility.hideAnoikis);
                    setHideKSpace(view.visibility.hideKSpace);
                    setHideAbyssal(view.visibility.hideAbyssal || false);
                } else if (view.id === 'kspace') {
                    setHideAnoikis(true);
                    setHideKSpace(false);
                    setHideAbyssal(true);
                } else if (view.id === 'anoikis') {
                    setHideAnoikis(false);
                    setHideKSpace(true);
                    setHideAbyssal(true);
                } else if (view.id === 'abyssal') {
                    setHideAnoikis(true);
                    setHideKSpace(true);
                    setHideAbyssal(false);
                } else if (view.id === 'strategic') {
                    setHideAnoikis(true);
                    setHideKSpace(false);
                    setHideAbyssal(true);
                } else {
                    setHideAnoikis(false);
                    setHideKSpace(false);
                    setHideAbyssal(false);
                }
            } else {
                // Fallback if mapMode points to a non-existent view
                setMapMode('strategic');
            }
        } else if (!mapMode && setMapMode && !hasInitializedRef.current) {
            // Check URL params for view=map
            const params = new URLSearchParams(window.location.search);
            if (params.get('view') === 'map') {
                setMapMode('strategic');
            }
            hasInitializedRef.current = true;
        }
    }, [mapMode, setMapMode, savedViews]);

    // Ref to track the currently active view for the reset function and idle timer
    const activeViewRef = useRef(savedViews[0]);
    useEffect(() => {
        activeViewRef.current = savedViews.find(v => v.id === activeViewId) || savedViews[0];
    }, [activeViewId, savedViews]);

    // --- RESIZABLE FEED STATE ---
    // CHANGED: Default width set to 170px (collapsed view)
    const [feedWidth, setFeedWidth] = useState(170); 
    const [isDragging, setIsDragging] = useState(false);

    const [systemsLoaded, setSystemsLoaded] = useState(false);
    const [initAttempt, setInitAttempt] = useState(0);
    const isInitializedRef = useRef(false);
    const feedScrollRef = useRef(null);
    const wasAtTopRef = useRef(true);

    // --- CINEMATIC FOCUS STATE ---
    const isFocusingRef = useRef(false);

    // --- FEED CONTEXT MENU STATE ---
    const [feedContextMenu, setFeedContextMenu] = useState(null);
    const [openSubmenu, setOpenSubmenu] = useState(null); // 'victim' | 'killer' | 'system'
    const feedMenuRef = useRef(null);
    const tooltipRef = useRef(null);

    // --- CINEMATIC FILTER EFFECT (CAMERA & ANIMATION) ---
    useEffect(() => {
        if (!filters || !systemsLoaded || galaxyMeshesRef.current.length === 0) return;

        // Normalize regionIds to strings for comparison (system regionIds are strings)
        const activeRegions = (filters.regionIds || []).map(id => String(id));
        const spaceTypes = filters.spaceTypes || [];

        // Pochven only activates if it's the ONLY space type selected (no high/low/null alongside it)
        const otherSpaceTypes = spaceTypes.filter(t => t !== 'poch');
        const isPochvenOnlySpaceType = spaceTypes.includes('poch') && otherSpaceTypes.length === 0;
        const isPochvenActive = isPochvenOnlySpaceType || activeRegions.includes(POCHVEN_REGION_ID);

        // Check if any Anoikis region is active
        const isAnoikisActive = activeRegions.some(id => {
            return isAnoikisRegion(id);
        });

        const hasActiveFilters = isPochvenActive || activeRegions.length > 0;

        // 1. Calculate Centroid & Target Systems
        let centroid = new THREE.Vector3(0, 0, 0);
        let count = 0;
        let targetSystems = [];

        systemsRef.current.forEach(sys => {
            let isActive = false;
            if (isPochvenActive && sys.regionId === POCHVEN_REGION_ID) isActive = true;
            else if (activeRegions.includes(sys.regionId)) isActive = true;

            if (isActive) {
                // Use 2D coordinates when in 2D mode
                if (is2D) {
                    centroid.x += sys.x2d;
                    centroid.y += 0; // Keep at ground level in 2D
                    centroid.z += sys.z2d;
                } else {
                    centroid.x += sys.x;
                    centroid.y += sys.y;
                    centroid.z += sys.z;
                }
                count++;
                targetSystems.push(sys);
            }
        });

        // 2. Cinematic Camera Move
        if (count > 0) {
            centroid.divideScalar(count);

            // Calculate spread for auto-zoom
            let maxDistSq = 0;
            targetSystems.forEach(sys => {
                // Use 2D coordinates when in 2D mode
                const dx = is2D ? (sys.x2d - centroid.x) : (sys.x - centroid.x);
                const dy = is2D ? 0 : (sys.y - centroid.y);
                const dz = is2D ? (sys.z2d - centroid.z) : (sys.z - centroid.z);
                const dSq = dx*dx + dy*dy + dz*dz;
                if(dSq > maxDistSq) maxDistSq = dSq;
            });
            const radius = Math.sqrt(maxDistSq);

            // Handle Anoikis Visuals (Rings) Visibility
            if (anoikisVisualsRef.current) {
                anoikisVisualsRef.current.visible = !hideAnoikis && (!hasActiveFilters || isAnoikisActive);
            }
            
            // Handle Anoikis Vortex Visibility
            if (anoikisFlowRef.current) {
                anoikisFlowRef.current.visible = !hideAnoikis && isHD && (!hasActiveFilters || isAnoikisActive);
            }

            // --- POCHVEN TRIANGLE ANIMATION ---
            if (isPochvenActive && !wasPochvenActiveRef.current && !is2D) {
                // Transition INTO Pochven triangle mode (3D only)
                const constellationGroups = new Map();
                targetSystems.forEach(sys => {
                    const cId = sys.constellationId;
                    if (!constellationGroups.has(cId)) constellationGroups.set(cId, []);
                    constellationGroups.get(cId).push(sys);
                });

                const constellationIds = [...constellationGroups.keys()];
                const sysById = new Map();
                targetSystems.forEach(s => sysById.set(s.id, s));

                // Build intra-constellation gate chains using jump connection data
                function buildChain(systems) {
                    const sysSet = new Set(systems.map(s => s.id));
                    const adj = new Map();
                    systems.forEach(s => adj.set(s.id, []));
                    jumpPairsRef.current.forEach(pair => {
                        if (sysSet.has(pair.s1.id) && sysSet.has(pair.s2.id)) {
                            adj.get(pair.s1.id).push(pair.s2.id);
                            adj.get(pair.s2.id).push(pair.s1.id);
                        }
                    });
                    // Endpoints = degree 1 (connect to other constellations, not this one)
                    const endpoints = [];
                    adj.forEach((neighbors, id) => { if (neighbors.length <= 1) endpoints.push(id); });
                    if (endpoints.length === 0) return systems.map(s => s.id);
                    // Walk from first endpoint to build ordered chain
                    const chain = [];
                    let cur = endpoints[0];
                    const visited = new Set();
                    while (cur) {
                        chain.push(cur);
                        visited.add(cur);
                        cur = (adj.get(cur) || []).find(n => !visited.has(n)) || null;
                    }
                    return chain;
                }

                const chains = new Map();
                constellationIds.forEach(cId => chains.set(cId, buildChain(constellationGroups.get(cId))));

                // Find which constellation each chain endpoint connects to (inter-constellation gates)
                const endpointNeighbor = new Map(); // sysId -> neighborConstellationId
                jumpPairsRef.current.forEach(pair => {
                    if (pair.s1.regionId !== POCHVEN_REGION_ID || pair.s2.regionId !== POCHVEN_REGION_ID) return;
                    const s1 = sysById.get(pair.s1.id), s2 = sysById.get(pair.s2.id);
                    if (!s1 || !s2 || s1.constellationId === s2.constellationId) return;
                    const c1 = chains.get(s1.constellationId), c2 = chains.get(s2.constellationId);
                    
                    // SAFEGUARD: Check if chains exist and have elements to avoid reading '0' of undefined
                    if (c1 && c1.length > 0 && (c1[0] === s1.id || c1[c1.length - 1] === s1.id)) endpointNeighbor.set(s1.id, s2.constellationId);
                    if (c2 && c2.length > 0 && (c2[0] === s2.id || c2[c2.length - 1] === s2.id)) endpointNeighbor.set(s2.id, s1.constellationId);
                });

                // Walk the constellation cycle using endpoint connections
                const conCycle = [];
                const visitedCons = new Set();
                let curCon = constellationIds[0];
                let topologyValid = true; // NEW: Track topology validity

                if (curCon) {
                    for (let i = 0; i < 3; i++) {
                        visitedCons.add(curCon);
                        const chain = chains.get(curCon);
                        
                        // SAFEGUARD: Chain must exist
                        if (!chain || chain.length === 0) {
                            // console.warn("Pochven Animation: Empty/Missing chain for", curCon);
                            topologyValid = false; // Topology validation Failed
                            break; 
                        }

                        const startNeighbor = endpointNeighbor.get(chain[0]);
                        const endNeighbor = endpointNeighbor.get(chain[chain.length - 1]);

                        let orientedChain, nextCon;
                       if (i === 0) {
                            // First constellation: pick either orientation
                            orientedChain = [...chain];
                            // If no connection found via gates, try either end (fallback)
                            nextCon = endNeighbor || startNeighbor;
                        } else {
                            // Orient so chain starts where previous constellation ended (shared vertex)
                            const prevCon = conCycle[i - 1].cId;
                            if (startNeighbor === prevCon) {
                                orientedChain = [...chain];
                                nextCon = endNeighbor;
                            } else {
                                orientedChain = [...chain].reverse();
                                nextCon = startNeighbor;
                            }
                        }
                        
                        if (!nextCon && i < 2) {
                             // If we can't find the next constellation, topology is broken (likely missing jump data)
                             // console.warn("Pochven Animation: Broken topology at", curCon);
                             topologyValid = false;
                             break;
                        }

                        conCycle.push({ cId: curCon, chain: orientedChain });
                        
                        curCon = nextCon;
                    }
                } else {
                    topologyValid = false;
                    // console.warn("Pochven Animation: CurCon check failed"); // Topology validation Failed
                }
                 
                // --- CALCULATE CONSTELLATION POSITIONS ---
                const constellationPositions = new Map();
                constellationGroups.forEach((systems, constellationId) => {
                    let totalX = 0, totalY = 0, totalZ = 0;
                    systems.forEach(sys => {
                        totalX += sys.x;
                        totalY += sys.y;
                        totalZ += sys.z;
                    });
                    const avgX = totalX / systems.length;
                    const avgY = totalY / systems.length;
                    const avgZ = totalZ / systems.length;
                    constellationPositions.set(constellationId, new THREE.Vector3(avgX, avgY, avgZ));
                });

                // Triangle vertices — equilateral in XZ plane, apex pointing up (-Z)
                // Triangle vertices — equilateral in XZ plane, apex pointing up (-Z)
                // Triangle vertices — equilateral in XZ plane, apex pointing up (-Z)
                const TRIANGLE_RADIUS = 200;
                const sin60 = Math.sin(Math.PI / 3);
                const v0 = new THREE.Vector3(centroid.x,                           centroid.y, centroid.z - TRIANGLE_RADIUS);       // Top
                const v1 = new THREE.Vector3(centroid.x - TRIANGLE_RADIUS * sin60, centroid.y, centroid.z + TRIANGLE_RADIUS * 0.5); // Bottom-left
                const v2 = new THREE.Vector3(centroid.x + TRIANGLE_RADIUS * sin60, centroid.y, centroid.z + TRIANGLE_RADIUS * 0.5); // Bottom-right

                const edges = [
                    [v0, v1], // Top → Bottom-left
                    [v1, v2], // Bottom-left → Bottom-right
                    [v2, v0], // Bottom-right → Top
                ];

                const systemIndexMap = new Map();
                systemsRef.current.forEach((sys, i) => systemIndexMap.set(sys.id, i));

                const anim = pochvenAnimRef.current;
                anim.systemMap.clear();
                anim.centroid = centroid.clone();

                // Use Hardcoded Order for Perfect Triangle
                POCHVEN_SYSTEM_ORDER.forEach((sysName, index) => {
                    const sys = systemMapRef.current.get(sysName);
                    if (!sys) return;

                    let edgeIndex, t;
                    if (index < 9) {
                        // Edge 0: Top -> BR (Indices 0-9)
                        edgeIndex = 0;
                        t = index / 9;
                    } else if (index < 18) {
                        // Edge 1: BR -> BL (Indices 9-18)
                        edgeIndex = 1;
                        t = (index - 9) / 9;
                    } else {
                        // Edge 2: BL -> Top (Indices 18-27)
                        edgeIndex = 2;
                        t = (index - 18) / 9;
                    }

                    const [start, end] = edges[edgeIndex];
                    const triPos = new THREE.Vector3().lerpVectors(start, end, t);

                    anim.systemMap.set(sys.id, {
                        realPos: new THREE.Vector3(sys.x, sys.y, sys.z),
                        triPos: triPos,
                        currentPos: new THREE.Vector3(sys.x, sys.y, sys.z),
                        instanceIndex: systemIndexMap.get(sys.id),
                        constellationId: sys.constellationId,
                    });
                });

                // Identify Pochven jump line pairs for position updates during animation
                anim.jumpLineIndices = [];
                jumpPairsRef.current.forEach((pair, i) => {
                    if (pair.s1.regionId === POCHVEN_REGION_ID && pair.s2.regionId === POCHVEN_REGION_ID) {
                        // Interpolate line start and end positions
                        const s1Anim = anim.systemMap.get(pair.s1.id);
                        const s2Anim = anim.systemMap.get(pair.s2.id);

                        if (s1Anim && s2Anim) {
                            anim.jumpLineIndices.push({
                                pairIndex: i,
                                s1Id: pair.s1.id,
                                s2Id: pair.s2.id,
                            });
                        }
                    }
                });


                // Collect non-Pochven system instance indices for fade-out
                if (anim.systemMap.size > 0) {
                    const pochvenSystemIds = new Set(anim.systemMap.keys());

                    anim.nonPochvenIndices = [];
                    systemsRef.current.forEach((sys, i) => {
                        if (!pochvenSystemIds.has(sys.id)) anim.nonPochvenIndices.push(i);
                    });

                    // Collect non-Pochven jump line pair indices for color fade
                    anim.nonPochvenLineIndices = [];
                    jumpPairsRef.current.forEach((pair, i) => {
                        const isPochLine = pair.s1.regionId === POCHVEN_REGION_ID && pair.s2.regionId === POCHVEN_REGION_ID;
                        if (!isPochLine) anim.nonPochvenLineIndices.push(i);
                    });

                    anim.progress = 0;
                    anim.active = true;
                    anim.targetProgress = 1;
                } else {
                    anim.active = false;
                    // SAFETY: If animation fails to activate but we are in Pochven mode,
                    // ensure we reset any lingering fade effects from previous runs.
                    const pochMesh = galaxyMeshesRef.current[0];
                    if (pochMesh) {
                        const matArr = pochMesh.instanceMatrix.array;
                        for (let i = 0; i < systemsRef.current.length; i++) {
                            const off = i * 16;
                            matArr[off] = 1; matArr[off + 5] = 1; matArr[off + 10] = 1;
                        }
                        pochMesh.instanceMatrix.needsUpdate = true;
                    }
                }
            } else if ((!isPochvenActive || is2D) && wasPochvenActiveRef.current) {
                // Transition OUT of Pochven triangle - reverse animation (when filter removed OR switching to 2D)
                pochvenAnimRef.current.targetProgress = 0;
            }

            // --- RESTORE CAMERA STATE ---
            if (isPochvenActive !== wasPochvenActiveRef.current) {
                if (isPochvenActive) {
                    // Always go to Pochven Home
                    if (homeStatesRef.current.pochven) {
                        targetControlsLookAt.current = homeStatesRef.current.pochven.lookAt.clone();
                        targetCameraPos.current = homeStatesRef.current.pochven.pos.clone();
                    } else {
                        // Default Pochven Home (Triangle Center) if not set
                        let targetCenter = centroid.clone();

                        // In 2D mode, keep at ground level; in 3D mode, add elevation
                        if (!is2D) {
                            targetCenter.y += POCHVEN_ELEVATION;
                        }

                        const zoom = is2D ? 800 : 600; // Higher zoom for 2D to see all systems
                        // Overhead view: High Y, small Z offset
                        const offset = new THREE.Vector3(0, zoom, is2D ? 0 : 10);
                        targetControlsLookAt.current = targetCenter;
                        targetCameraPos.current = targetCenter.clone().add(offset);

                        // Save as default home for future
                        homeStatesRef.current.pochven = {
                            pos: targetCameraPos.current.clone(),
                            lookAt: targetControlsLookAt.current.clone()
                        };
                    }
                } else {
                    // Always go to Cluster Home
                    const def = homeStatesRef.current.default;
                    targetControlsLookAt.current = def.lookAt.clone();
                    targetCameraPos.current = def.pos.clone();
                }
                isAutoPiling.current = true;
            }

            wasPochvenActiveRef.current = isPochvenActive;
        } else if (!hasActiveFilters) {
            // Reset to Home View if filters cleared
            if (wasPochvenActiveRef.current) {
                pochvenAnimRef.current.targetProgress = 0;
            }
            wasPochvenActiveRef.current = false;
            
            if (anoikisVisualsRef.current) {
                anoikisVisualsRef.current.visible = !hideAnoikis;
            }
            if (anoikisFlowRef.current) {
                anoikisFlowRef.current.visible = !hideAnoikis && isHD;
            }
            handleResetView();
        }
    }, [filters, systemsLoaded, hideAnoikis]);

    // --- VISUALS EFFECT (GHOST MODE & REGION MODES) ---
    useEffect(() => {
        if (!filters || !systemsLoaded || galaxyMeshesRef.current.length === 0) return;

        // Normalize regionIds to strings for comparison
        const activeRegions = (filters.regionIds || []).map(id => String(id));
        const spaceTypes = filters.spaceTypes || [];

        // Pochven only activates if it's the ONLY space type selected
        const otherSpaceTypes = spaceTypes.filter(t => t !== 'poch');
        const isPochvenOnlySpaceType = spaceTypes.includes('poch') && otherSpaceTypes.length === 0;
        const isPochvenActive = isPochvenOnlySpaceType || activeRegions.includes(POCHVEN_REGION_ID);

        const hasActiveFilters = isPochvenActive || activeRegions.length > 0;

        // 3. Visual "Ghost Mode" Updates
        const mesh = galaxyMeshesRef.current[0];
        if (mesh) mesh.visible = !is2D; // Hide 3D mesh in 2D mode
        
        if (mesh && mesh.geometry.attributes.aActive && !is2D) {
            // Ensure shader mixing respects the current regionMode
            // TAC/NEB = 0.0 (sec colors), DYN = 1.0 (distance-based), REG = 2.0 (force region)
            if (mesh.material.uniforms && mesh.material.uniforms.mixState) {
                let mixVal = 0.0;
                if (regionMode === 'DYN') mixVal = 1.0;
                else if (regionMode === 'REG') mixVal = 2.0;
                mesh.material.uniforms.mixState.value = mixVal;
            }

            const activeArr = mesh.geometry.attributes.aActive.array;
            let needsUpdate = false;

            if (isPochvenActive) {
                // Pochven isolation: keep all aActive=1.0
                // Animation loop handles fading via instanceMatrix scale
                systemsRef.current.forEach((_, i) => {
                    if (activeArr[i] !== 1.0) { activeArr[i] = 1.0; needsUpdate = true; }
                });
            } else {
                systemsRef.current.forEach((sys, i) => {
                    let isActive = true;

                    // Determine Active State - match centroid logic
                    if (hasActiveFilters) {
                        isActive = false;
                        if (activeRegions.includes(sys.regionId)) isActive = true;
                    }

                    // Update Attribute Buffer (0.0 for Inactive/Ghost, 1.0 for Active)
                    const newVal = isActive ? 1.0 : 0.0;
                    if (activeArr[i] !== newVal) {
                        activeArr[i] = newVal;
                        needsUpdate = true;
                    }
                });
            }

            if (needsUpdate) {
                mesh.geometry.attributes.aActive.needsUpdate = true;
            }
        }

        // Update 2D Mesh (Strategic View)
        if (is2D && galaxyMeshes2DRef.current.length > 0) {
            const mesh2D = galaxyMeshes2DRef.current[0];
            if (mesh2D && mesh2D.geometry.attributes.aActive) {
                const activeArr = mesh2D.geometry.attributes.aActive.array;
                let needsUpdate = false;
                const systems2D = mesh2D.userData.systems;

                if (systems2D) {
                    systems2D.forEach((sys, i) => {
                        let isActive = true;
                        if (hasActiveFilters) {
                            isActive = false;
                            if (isPochvenActive && sys.regionId === POCHVEN_REGION_ID) isActive = true;
                            else if (activeRegions.includes(sys.regionId)) isActive = true;
                        }

                        const newVal = isActive ? 1.0 : 0.0;
                        if (activeArr[i] !== newVal) {
                            activeArr[i] = newVal;
                            needsUpdate = true;
                        }
                    });
                }

                if (needsUpdate) mesh2D.geometry.attributes.aActive.needsUpdate = true;
            }
        }

        // 4. Update Lines Visibility (skip during Pochven - animation loop handles smooth fade)
        if (linesRef.current) linesRef.current.visible = !is2D; // Hide 3D lines in 2D mode, show in 3D (Pochven anim handles fades)
        if (linesRef.current && jumpPairsRef.current.length > 0 && !isPochvenActive && !is2D) {
            const colors = linesRef.current.geometry.attributes.color.array;
            const baseColor = new THREE.Color(0x4488bb);
            const hiddenColor = new THREE.Color(0x000000); // Completely black = invisible with AdditiveBlending

            jumpPairsRef.current.forEach((pair, i) => {
                const idx = i * 6; // 2 vertices * 3 components
                let isVisible = true;

                if (hideKSpace) {
                    isVisible = false;
                } else if (hasActiveFilters) {
                    // Check if each endpoint is in an active region (consistent with system logic)
                    const s1Visible = (isPochvenActive && pair.s1.regionId === POCHVEN_REGION_ID) || activeRegions.includes(pair.s1.regionId);
                    const s2Visible = (isPochvenActive && pair.s2.regionId === POCHVEN_REGION_ID) || activeRegions.includes(pair.s2.regionId);
                    isVisible = s1Visible && s2Visible;
                }

                // With AdditiveBlending, black (0,0,0) = completely invisible
                const c = isVisible ? baseColor : hiddenColor;

                colors[idx] = c.r; colors[idx+1] = c.g; colors[idx+2] = c.b;
                colors[idx+3] = c.r; colors[idx+4] = c.g; colors[idx+5] = c.b;
            });
            linesRef.current.geometry.attributes.color.needsUpdate = true;
        }

        // 5. Update Kill Markers Visibility based on filter
        if (recentKillsGroupRef.current) {
            recentKillsGroupRef.current.children.forEach(group => {
                const sys = group.userData.systemData;
                if (!sys) return;
                const killRegionId = sys.regionId;

                if (is2D && (isAnoikisRegion(killRegionId) || killRegionId === '12000001')) {
                    group.visible = false;
                } else if (hideAnoikis && isAnoikisRegion(killRegionId)) {
                    group.visible = false;
                } else if (hideKSpace && !isAnoikisRegion(killRegionId) && killRegionId !== '12000001') {
                    group.visible = false;
                } else if (hideAbyssal && killRegionId === '12000001') {
                    group.visible = false;
                } else if (hasActiveFilters) {
                    // Consistent with system/line logic
                    let isInActiveRegion = (isPochvenActive && killRegionId === POCHVEN_REGION_ID) || activeRegions.includes(killRegionId);
                    group.visible = isInActiveRegion;
                } else {
                    // No filter active - show all
                    group.visible = true;
                }
            });
        }

        // 6. Update Static Anoikis Systems Visibility
        if (mesh && anoikisSystemsRef.current.length > 0) {
            const dummy = new THREE.Object3D();
            let needsUpdate = false;
            anoikisSystemsRef.current.forEach(sys => {
                if (!sys.anoikisData && sys.instanceIndex !== undefined) { // Static systems only
                    dummy.position.set(sys.x, sys.y, sys.z);
                    dummy.scale.setScalar((hideAnoikis || is2D) ? 0 : 1); // Hide in 2D
                    dummy.updateMatrix();
                    mesh.setMatrixAt(sys.instanceIndex, dummy.matrix);
                    needsUpdate = true;
                }
            });
            if (needsUpdate) mesh.instanceMatrix.needsUpdate = true;
        }

        // 7. Update K-Space Systems Visibility
        if (mesh && kSpaceSystemsRef.current.length > 0) {
            const dummy = new THREE.Object3D();
            let needsUpdate = false;
            kSpaceSystemsRef.current.forEach(sys => {
                if (sys.instanceIndex !== undefined) {
                    dummy.position.set(sys.x, sys.y, sys.z);
                    dummy.scale.setScalar((hideKSpace || is2D) ? 0 : 1); // Hide in 2D
                    dummy.updateMatrix();
                    mesh.setMatrixAt(sys.instanceIndex, dummy.matrix);
                    needsUpdate = true;
                }
            });
            if (needsUpdate) mesh.instanceMatrix.needsUpdate = true;
        }

        // 9. Update Bridge (Funnel) Visibility
        if (bridgeGroupRef.current) {
            bridgeGroupRef.current.visible = !hideAbyssal && !is2D;
        }

        // 8. Update Abyssal Systems Visibility (Static fallback for non-HD)
        if (mesh && abyssalSystemsRef.current.length > 0) {
            const dummy = new THREE.Object3D();
            let needsUpdate = false;
            abyssalSystemsRef.current.forEach(sys => {
                if (sys.instanceIndex !== undefined) {
                    dummy.position.set(sys.x, sys.y, sys.z);
                    dummy.scale.setScalar((hideAbyssal || is2D) ? 0 : 1); // Hide in 2D
                    dummy.updateMatrix();
                    mesh.setMatrixAt(sys.instanceIndex, dummy.matrix);
                    needsUpdate = true;
                }
            });
            if (needsUpdate) mesh.instanceMatrix.needsUpdate = true;
        }

        // --- HIDE 3D ELEMENTS IN 2D MODE ---
        if (abyssalEffectRef.current) abyssalEffectRef.current.visible = isHD && !hideAbyssal && !is2D;
        if (trafficMeshRef.current) trafficMeshRef.current.visible = isHD && !is2D;
        if (anoikisVisualsRef.current) anoikisVisualsRef.current.visible = !hideAnoikis && (!hasActiveFilters || isAnoikisActive) && !is2D;
        if (drifterVisualsRef.current) drifterVisualsRef.current.visible = isHD && !hideAnoikis && !is2D;
        if (anoikisFlowRef.current) anoikisFlowRef.current.visible = !hideAnoikis && isHD && (!hasActiveFilters || isAnoikisActive) && !is2D;
        if (card3DGroupRef.current) card3DGroupRef.current.visible = true; // Always visible

        // --- SHOW 2D ELEMENTS IN 2D MODE ---
        if (galaxyMeshes2DRef.current) {
            galaxyMeshes2DRef.current.forEach(m => {
                m.visible = is2D;
            });
        }
        if (lines2DRef.current) lines2DRef.current.visible = is2D;
        if (lines2DInterRegionalRef.current) lines2DInterRegionalRef.current.visible = is2D;

        // Labels visible in both 2D and 3D modes
        if (labelGroupRef.current) labelGroupRef.current.visible = true;
        if (regionLabelGroupRef.current) regionLabelGroupRef.current.visible = true;
        if (recentKillsGroupRef.current) recentKillsGroupRef.current.visible = true; // Re-enable markers
    }, [filters, systemsLoaded, regionMode, hideAnoikis, hideKSpace, hideAbyssal, is2D]);

    // --- DRAG HANDLERS ---
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            const newWidth = window.innerWidth - e.clientX - 20;
            // CHANGED: Min constraint reduced to 160px
            if (newWidth >= 160 && newWidth <= 1000) {
                setFeedWidth(newWidth);
            }
        };
        const handleMouseUp = () => {
            setIsDragging(false);
            document.body.style.userSelect = ''; // Re-enable text selection
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = 'none'; // Disable select while dragging
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    // --- SCROLL TO TOP ON FILTER CHANGE ---
    useEffect(() => {
        if (feedScrollRef.current) feedScrollRef.current.scrollTop = 0;
    }, [filters, activeAllianceIds]);


    // Camera & Home Position State
    const homeStatesRef = useRef({
        default: { pos: new THREE.Vector3(-745, 531, 1095), lookAt: new THREE.Vector3(232, -480, -150) }, // 3D cluster view
        pochven: null,
        regMode2D: { pos: new THREE.Vector3(0, 2200, 0), lookAt: new THREE.Vector3(0, 0, 0) }, // REG mode home (rotatable, good overview)
        flatMode2D: { pos: new THREE.Vector3(0, 1500, 0), lookAt: new THREE.Vector3(0, 0, 0) } // FLAT mode home (locked top-down)
    });

    // Ref to track seen kills to handle backfill logic
    const processedKillIdsRef = useRef(new Set());
    const latestKnownId = useRef(0);

    // Refs for Animation Loop Access
    const activeKillIdRef = useRef(null);
    const hoveredKillIdRef = useRef(null);
    const selectedSystemRef = useRef(null);
    const lastTrackedSysIdRef = useRef(null);
    const lastTrackedPosRef = useRef(new THREE.Vector3());
    const mouseDownRef = useRef({ x: 0, y: 0 });
    const shouldTrackActiveKillRef = useRef(false);

    useEffect(() => { activeKillIdRef.current = activeKillId; }, [activeKillId]);
    useEffect(() => { hoveredKillIdRef.current = hoveredKillId; }, [hoveredKillId]);
    useEffect(() => { selectedSystemRef.current = selectedSystem; }, [selectedSystem]);

    const systemsRef = useRef([]); 
    const nearbySystemsRef = useRef([]); 
    const systemMapRef = useRef(new Map());
    const regionMapRef = useRef(new Map());
    const jumpPairsRef = useRef([]); 
    const systemsHighSecRef = useRef([]);
    const systemsLowSecRef = useRef([]);
    const systemsNullSecRef = useRef([]);
    const latestKillIdRef = useRef(null);
    const killFeedRef = useRef([]); 
    const targetCameraPos = useRef(null);
    const targetControlsLookAt = useRef(null);
    const isAutoPiling = useRef(false);
    const controlsRef = useRef(null);
    const raycasterRef = useRef(new THREE.Raycaster());
    const mouseRef = useRef(new THREE.Vector2());
    const perspectiveCamRef = useRef(null);
    const activeCameraRef = useRef(null);
    const labelGroupRef = useRef(new THREE.Group());
    const regionLabelGroupRef = useRef(new THREE.Group()); 
    const card3DGroupRef = useRef(new THREE.Group());
    const cardsBySystemRef = useRef(new Map()); // Map<systemName, {kills, cards, primaryIdx, expanded, systemPos, ghostShadows}>
    const solarSystemGroupRef = useRef(new THREE.Group());
    const recentKillsGroupRef = useRef(new THREE.Group());
    const killCountLabelsRef = useRef(new THREE.Group());
    const galaxyMeshesRef = useRef([]);
    const galaxyMeshes2DRef = useRef([]);
    const lines2DRef = useRef(null);
    const lines2DInterRegionalRef = useRef(null);
    const hover2DIndicatorRef = useRef(null); // Highlight ring for 2D system hover
    const anoikisVisualsRef = useRef(new THREE.Group());
    const drifterVisualsRef = useRef(new THREE.Group());
    const drifterParticlesRef = useRef(null);
    const anoikisRotatorIndicesRef = useRef([]); // Track indices of rotating Anoikis systems
    const anoikisFlowRef = useRef(null); // Ref for the vortex particle system
    const bridgeCurveRef = useRef(null);
    const kSpaceSystemsRef = useRef([]);
    const anoikisSystemsRef = useRef([]);
    const abyssalSystemsRef = useRef([]);
    const nextTrafficSpawnRef = useRef(0);
    const trafficRef = useRef([]);
    const trafficMeshRef = useRef(null);
    const bridgeGroupRef = useRef(null);
    const linesRef = useRef(null);
    const abyssalEffectRef = useRef(null);
    const starMaterialRef = useRef(null);
    const gridHelperRef = useRef(null);
    const pochvenAnimRef = useRef({
        active: false,
        progress: 0,         // 0 = real positions, 1 = triangle positions
        targetProgress: 0,
        centroid: null,
        systemMap: new Map(), // systemId -> { realPos, triPos, currentPos, instanceIndex }
        jumpLineIndices: [],  // { pairIndex, s1Id, s2Id }
        nonPochvenIndices: [],       // instance indices of non-Pochven systems
        nonPochvenLineIndices: [],   // jump pair indices for non-Pochven lines
    });
    const wasPochvenActiveRef = useRef(false);
    const shockwavesRef = useRef([]);
    const activeCardRef = useRef(null);
    const hoveredKillSysRef = useRef(null); // tracks system name of currently hovered kill marker/card (for wheel cycling)
    const flipAnimRef = useRef(null); // { entry, targetIdx, direction, phase:'out'|'in', startTime:ms }
    const hoveredKillCardGroupRef = useRef(null); // card THREE.Group whose highlight is currently shown
    const renderPassRef = useRef(null);
    const prevHoveredSystemRef = useRef(null);
    const hoveredSystemRef = useRef(null);
    const lastInteractionRef = useRef(Date.now());
    const rendererRef = useRef(null);
    const composerRef = useRef(null);
    const isAutoLocateRef = useRef(isAutoLocate);
    const autoLocateCriteriaRef = useRef(autoLocateCriteria);
    const killMarkerLimitRef = useRef(killMarkerLimit);
    const killMarkerTimeLimitRef = useRef(killMarkerTimeLimit);
    const interactionTimeoutRef = useRef(null);
    const regionModeRef = useRef(regionMode);
    const filtersRef = useRef(filters);

    // Keep filtersRef in sync
    useEffect(() => { filtersRef.current = filters; }, [filters]);

    // --- HELPER FUNCTION FOR LABELS ---
    const getLabelSprite = (text, pos, isMajor, type) => {
        const canvas = document.createElement('canvas');
        const w = isMajor ? 512 : 256; const h = isMajor ? 128 : 64;
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.font = isMajor ? `bold 56px "Segoe UI"` : `32px "Segoe UI"`;
        ctx.fillStyle = isMajor ? '#fff' : (type==='kill'?'#fc0':'rgba(200,200,200,0.7)');
        ctx.textAlign = "center";
        
        ctx.shadowColor = 'black'; 
        ctx.shadowBlur = 4; 
        ctx.lineWidth = 0; 
        
        const tx = w/2;
        const ty = h/2 + (isMajor ? 20 : 10);
        
        ctx.fillText(text, tx, ty);
        ctx.fillText(text, tx, ty);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: !isMajor, depthWrite: false });
        const sprite = new THREE.Sprite(mat);
        if(isMajor) sprite.renderOrder = 999;
        sprite.position.set(pos.x, pos.y+(isMajor?8:4), pos.z);
        // UPDATED: store basePos so we can dynamically adjust height in animate loop
        sprite.userData = { isMajor, type, text, basePos: { x: pos.x, y: pos.y, z: pos.z } };
        return sprite;
    };

    const getRegionLabelSprite = (text, pos, textColor) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 72px "Segoe UI"';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Dark background pill for contrast in dense areas
        const metrics = ctx.measureText(text.toUpperCase());
        const textW = metrics.width;
        const pillW = textW + 40;
        const pillH = 90;
        const pillX = 512 - pillW / 2;
        const pillY = 128 - pillH / 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 16);
        ctx.fill();

        // Thick black outline/stroke for readability
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.lineWidth = 12;
        ctx.lineJoin = 'round';
        ctx.strokeText(text.toUpperCase(), 512, 128);

        // Beige fill with subtle glow
        ctx.shadowColor = textColor || 'rgba(245, 222, 179, 0.5)'; // Wheat/beige color
        ctx.shadowBlur = 10;
        ctx.fillStyle = textColor || 'rgba(245, 222, 179, 0.85)'; // Wheat/beige color
        ctx.fillText(text.toUpperCase(), 512, 128);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(150, 37.5, 1);
        sprite.position.set(pos.x, pos.y, pos.z);
        sprite.renderOrder = 1;
        return sprite;
    };

    // Kill count badge sprite (e.g., "3x") with black outline for visibility
    const getKillCountSprite = (count, colorHex) => {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const text = `${count}x`;

        // Draw black outline first
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, 64, 32);

        // Draw colored glow
        ctx.shadowColor = new THREE.Color(colorHex).getStyle();
        ctx.shadowBlur = 8;

        // Draw white fill
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, 64, 32);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(8, 4, 1);
        return sprite;
    };

    useEffect(() => { isAutoLocateRef.current = isAutoLocate; }, [isAutoLocate]);
    // Update refs and re-render kill markers when filter settings change
    useEffect(() => {
        killMarkerLimitRef.current = killMarkerLimit;
        killMarkerTimeLimitRef.current = killMarkerTimeLimit;

        // Re-render markers with updated filter values
        if (killFeedRef.current.length > 0 && recentKillsGroupRef.current) {
            updateRecentKillsVisuals(killFeedRef.current);
        }
    }, [killMarkerLimit, killMarkerTimeLimit]);
    useEffect(() => { autoLocateCriteriaRef.current = autoLocateCriteria; }, [autoLocateCriteria]);
    useEffect(() => {
        regionModeRef.current = regionMode;
        
        const updateMixState = (mesh) => {
            if(mesh.material.uniforms && mesh.material.uniforms.mixState) {
                // TAC/NEB = 0.0 (sec colors), DYN = 1.0 (distance-based), REG = 2.0 (force region)
                let mixVal = 0.0;
                if (regionMode === 'DYN') mixVal = 1.0;
                else if (regionMode === 'REG') mixVal = 2.0;
                mesh.material.uniforms.mixState.value = mixVal;
            } else if (mesh.material.userData.shader && mesh.material.userData.shader.uniforms && mesh.material.userData.shader.uniforms.mixState) {
                 // Handle PointsMaterial where uniforms are on shader object in userData
                 let mixVal = 0.0;
                 if (regionMode === 'DYN') mixVal = 1.0;
                 else if (regionMode === 'REG') mixVal = 2.0;
                 mesh.material.userData.shader.uniforms.mixState.value = mixVal;
            }
        };

        galaxyMeshesRef.current.forEach(updateMixState);
        galaxyMeshes2DRef.current.forEach(updateMixState);
    }, [regionMode, is2D]);

    // --- BRIGHTNESS UPDATER ---
    useEffect(() => {
        const updateBrightness = (mesh) => {
            if (mesh.material.uniforms && mesh.material.uniforms.brightness) {
                mesh.material.uniforms.brightness.value = brightness;
            } else if (mesh.material.userData.shader && mesh.material.userData.shader.uniforms && mesh.material.userData.shader.uniforms.brightness) {
                mesh.material.userData.shader.uniforms.brightness.value = brightness;
            }
        };

        galaxyMeshesRef.current.forEach(updateBrightness);
        galaxyMeshes2DRef.current.forEach(updateBrightness);
    }, [brightness]);

    // --- THEME LISTENER FOR STARS ---
    useEffect(() => {
        if (starMaterialRef.current) {
            // Invert stars to black for light theme, otherwise white
            starMaterialRef.current.color.setHex(theme === 'light' ? 0x000000 : 0xffffff);
        }
    }, [theme]);

    const fetchSystemIntel = async (systemData) => {
        try {
            // Mock Intel for Abyssal Systems
            if (systemData.regionId === '12000001') {
                return {
                    report: {
                        executive_summary: {
                            name: systemData.name,
                            id: systemData.id,
                            security_class: 'Abyssal Deadspace',
                            threat_level: 'high',
                            sovereignty: 'Triglavian Collective'
                        },
                        threat_intelligence: {
                            kills_last_1h: 'N/A',
                            kills_last_24h: 'N/A',
                            value_destroyed_24h_isk: 0,
                            top_hunters: { top_hunter_corps: [], top_victim_ships: [] }
                        }
                    },
                    isFallback: true
                };
            }

            // Mock Intel for Anoikis (Wormhole) Systems
            if (parseInt(systemData.regionId) >= 11000000 && parseInt(systemData.regionId) < 12000000) {
                return {
                    report: {
                        executive_summary: {
                            name: systemData.name,
                            id: systemData.id,
                            security_class: 'Wormhole Space',
                            threat_level: 'unknown',
                            sovereignty: 'Unclaimed'
                        },
                        threat_intelligence: {
                            kills_last_1h: 'N/A',
                            kills_last_24h: 'N/A',
                            value_destroyed_24h_isk: 0,
                            top_hunters: { top_hunter_corps: [], top_victim_ships: [] }
                        }
                    },
                    isFallback: true
                };
            }

            const response = await fetch(SYSTEM_INTEL_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query_name: systemData.name, query_type: 'system' })
            });
            if (!response.ok) throw new Error('Intel Fetch Failed');
            const data = await response.json();
            const result = Array.isArray(data) ? data[0] : data;
            return result;
        } catch (e) {
            const recentKills = killFeedRef.current.filter(k => k.system === systemData.name);
            const threatScore = recentKills.length;
            let threatLevel = 'minimal';
            if (threatScore > 5) threatLevel = 'high';
            else if (threatScore > 0) threatLevel = 'medium';
            else if (systemData.sec <= 0) threatLevel = 'low';

            return {
                report: {
                    executive_summary: {
                        name: systemData.name,
                        id: systemData.id,
                        security_class: systemData.sec >= 0.5 ? 'High-Sec' : systemData.sec > 0 ? 'Low-Sec' : 'Null-Sec',
                        threat_level: threatLevel,
                        sovereignty: 'Unknown (Offline)'
                    },
                    threat_intelligence: {
                        kills_last_1h: recentKills.length,
                        kills_last_24h: 'N/A',
                        value_destroyed_24h_isk: recentKills.reduce((sum, k) => sum + k.rawVal, 0),
                        top_hunters: { top_hunter_corps: [], top_victim_ships: [] }
                    }
                },
                isFallback: true
            };
        }
    };

    const checkVisibility = (regionId) => {
        if (regionId === 'ANOIKIS_ALL' || regionId === 'WSPACE_ALL') return !hideAnoikisRef.current;
        const id = parseInt(regionId);
        const isAnoikis = id >= 11000000 && id < 12000000;
        const isAbyssal = id === 12000001;
        const isKSpace = !isAnoikis && !isAbyssal;

        if (isKSpace && hideKSpaceRef.current) return false;
        if (isAnoikis && hideAnoikisRef.current) return false;
        if (isAbyssal && hideAbyssalRef.current) return false;
        return true;
    };

    const handleSystemSearch = async (sysName = null) => {
        const term = sysName || searchTerm.trim();
        if (!term) return; 
        
        // 1. Check for Region Match
        const regions = Array.from(regionMapRef.current.values());
        const foundRegion = regions.find(r => r.name.toLowerCase() === term.toLowerCase() && checkVisibility(r.id));

        if (foundRegion) {
            // Calculate Centroid of Region
            let cx=0, cy=0, cz=0, count=0;
            systemsRef.current.forEach(s => {
                if (s.regionId === foundRegion.id) {
                    cx+=s.x; cy+=s.y; cz+=s.z; count++;
                }
            });
            
            if (count > 0) {
                activateInteractionLock();
                const center = new THREE.Vector3(cx/count, cy/count, cz/count);
                targetControlsLookAt.current = center;
                targetCameraPos.current = new THREE.Vector3(center.x, center.y + 400, center.z + 400);
                isAutoPiling.current = true;
                setSearchTerm(''); setSearchResults([]); setSearchActive(false);
                return;
            }
        }

        // 2. Fallback to System Search
        let foundSys = null;
        const systems = Array.from(systemMapRef.current.values());
        
        foundSys = systems.find(s => s.name.toLowerCase() === term.toLowerCase() && checkVisibility(s.regionId));
        
        if (foundSys) {
             activateInteractionLock(); // Blocks auto-pan
             const regionInfo = regionMapRef.current.get(foundSys.regionId);
             setSelectedSystem({ ...foundSys, regionName: regionInfo?.name || 'Unknown Region' });
             setActiveKillId(null);
             if (card3DGroupRef.current) {
                 card3DGroupRef.current.clear();
                 cardsBySystemRef.current.clear(); flipAnimRef.current = null; hoveredKillCardGroupRef.current = null;
             }
             activeCardRef.current = null;

             if (is2DRef.current && foundSys.x2d !== undefined) {
                 targetControlsLookAt.current = new THREE.Vector3(foundSys.x2d, 0, foundSys.z2d);
                 targetCameraPos.current = new THREE.Vector3(foundSys.x2d, 225, foundSys.z2d + 225);
             } else {
                 targetControlsLookAt.current = new THREE.Vector3(foundSys.x, foundSys.y, foundSys.z);
                 targetCameraPos.current = new THREE.Vector3(foundSys.x + 80, foundSys.y + 20, foundSys.z + 80);
             }
             isAutoPiling.current = true;

             setSystemIntel(null);
             const intel = await fetchSystemIntel(foundSys);
             setSystemIntel(intel);
             setSearchTerm(''); 
             setSearchResults([]);
             setSearchActive(false);
        }
    };

    const onSearchChange = (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        if (term.length > 1) {
            const systems = Array.from(systemMapRef.current.values());
            const regions = Array.from(regionMapRef.current.values());
            const results = [];
            const seenIds = new Set();

            // Search Regions
            for (const r of regions) {
                if (checkVisibility(r.id) && r.name.toLowerCase().startsWith(term.toLowerCase())) {
                    results.push({ ...r, type: 'region' });
                }
            }

            // Search Systems
            for (const s of systems) {
                if (checkVisibility(s.regionId) && s.name.toLowerCase().startsWith(term.toLowerCase())) {
                    if (!seenIds.has(s.id)) {
                        seenIds.add(s.id);
                        results.push({ ...s, type: 'system' });
                    }
                }
            }
            setSearchResults(results.slice(0, 10));
            setSearchActive(true);
        } else {
            setSearchResults([]);
            setSearchActive(false);
        }
    };

    // --- DATA TRANSFORMATION HELPER ---
    const processKills = useCallback((rawKills) => {
        if (!systemMapRef.current.size) return [];
        return rawKills.map(k => {
            let s = systemMapRef.current.get(k.solar_system_name);
            
            // Handle Abyssal Systems (IDs > 32000000) or missing systems
            if (!s && k.solar_system_id >= 32000000) {
                // Map to one of the pre-generated Abyssal systems (AD X)
                const index = k.solar_system_id % ABYSSAL_SYSTEM_COUNT;
                s = systemMapRef.current.get(`Abyssal_${index}`);
                // Register in map so interactions work
                systemMapRef.current.set(s.name, s);
                systemMapRef.current.set(s.id, s);
            }

            // Handle Wormhole Systems (IDs 31000000 - 31999999)
            if (!s && k.solar_system_id >= 31000000 && k.solar_system_id < 32000000) {
                // With real SDE data loaded, we should find the system directly by name or ID.
                // If not found, it might be a new system or missing from SDE, but we no longer procedural map it.
                // We can try a direct lookup by ID if name lookup failed above.
                if (!s) s = systemMapRef.current.get(k.solar_system_id);
            }

            if (!s) return null; // Still null? Skip it.

            const fb = k.attackers?.find(a => a.final_blow) || k.attackers?.[0];
            const iskData = formatIsk(k.total_value);
            const comp = {};
            if(k.attackers) {
                k.attackers.forEach(a => {
                    if(a.ship_type_name) {
                        comp[a.ship_type_name] = (comp[a.ship_type_name] || 0) + 1;
                    }
                });
            }
            const compArr = Object.entries(comp).sort((a,b)=>b[1]-a[1]).map(e => `${e[1]}x ${e[0]}`);

            const killerIsNpc = !fb?.character_id;
            const attackerCount = k.attackers ? k.attackers.length : 1;
            const isSolo = !killerIsNpc && attackerCount === 1;

            return {
                id: k.killmail_id,
                systemId: s.id,
                timestamp: new Date(k.killmail_time).getTime(),
                system: s.name, // Use mapped name (e.g. "AD 5" or "J-123")
                regionId: s.regionId,
                sec: s.sec,
                secColor: s.regionId === '10000070' ? '#e85d04' : (s.regionId === '12000001' ? '#3b82f6' : (s.sec >= 0.5 ? '#4ade80' : s.sec > 0 ? '#fbbf24' : '#ef4444')),
                pilot: k.victim?.character_name || "Unknown",
                pilotId: k.victim?.character_id,
                shipId: k.victim?.ship_type_id,
                ship: k.victim?.ship_type_name || "Unknown Ship",
                shipClass: k.victim_ship_class,
                killer: fb?.character_name || (killerIsNpc ? (fb?.ship_type_name || "NPC") : "Unknown"),
                killerId: fb?.character_id,
                killerShipId: fb?.ship_type_id,
                killerShip: fb?.ship_type_name || "Unknown Ship",
                victimAllianceId: k.victim?.alliance_id,
                victimCorpId: k.victim?.corporation_id,
                killerAllianceId: fb?.alliance_id,
                killerCorpId: fb?.corporation_id,
                rawVal: parseFloat(k.total_value),
                value: iskData.number,
                valueSuffix: iskData.suffix,
                victimCorp: k.victim?.corporation_name || "Unknown Corp",
                victimAlliance: k.victim?.alliance_name, 
                killerCorp: fb?.corporation_name || "Unknown Corp",
                killerAlliance: fb?.alliance_name, 
                attackersCount: attackerCount,
                isSolo: isSolo,
                isNpc: killerIsNpc,
                finalBlowWeapon: fb?.weapon_type_name || "Unknown Weapon",
                finalBlowWeaponId: fb?.weapon_type_id,
                fleetComp: compArr
            };
        }).filter(Boolean);
    }, []);

    // --- LIVE POLLING LOGIC ---
    const pollFeed = useCallback(async () => {
        // Only fetch new kills by passing latest_known_id
        if (!latestKnownId.current) return;

        const params = {
            limit: 25,
            latest_known_id: latestKnownId.current,
            view: !is2D ? 'map_3d' : layoutMode === 'MAP' ? 'map_flat' : 'map_2d',
            fingerprint: fingerprint
        };

        // Pass active filters to polling
        if (filters.spaceTypes?.length > 0) params.filters_space = filters.spaceTypes.join(',');
        if (filters.regionIds?.length > 0) params.filters_region = filters.regionIds.join(',');
        if (filters.encounterTypes?.length > 0) params.filters_main = filters.encounterTypes.join(',');

        try {
            const data = await fetchKillFeed(params);
            
            if (data?.kills?.length > 0) {
                const newKills = data.kills;
                
                // Update high-water mark
                const maxId = Math.max(...newKills.map(k => k.killmail_id));
                if (maxId > latestKnownId.current) latestKnownId.current = maxId;

                const processed = processKills(newKills);
                
                if (processed.length > 0) {
                    // Trigger Auto-Follow Logic for NEW items only
                    const trulyNew = processed.filter(k => !processedKillIdsRef.current.has(k.id));
                    if (trulyNew.length > 0) {
                        trulyNew.forEach(k => processedKillIdsRef.current.add(k.id));
                        
                        if (is2DRef.current) {
                            // In 2D, spawn cards for ALL new kills
                            trulyNew.forEach(k => handleFeedClick(k, 'auto'));
                        } else {
                            // In 3D, only focus on the primary (highest value) kill
                            const primary = trulyNew.sort((a, b) => b.rawVal - a.rawVal)[0];
                            const sys = systemMapRef.current.get(primary.system);
                            if(sys) spawnShockwave(sys, primary.rawVal > 1000000000 ? 0xef4444 : 0xffffff);
                            handleFeedClick(primary, 'auto');
                        }
                    }

                    setFormattedKillFeed(prev => {
                        const combined = [...processed, ...prev];
                        // Remove duplicates by ID
                        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
                        unique.sort((a, b) => b.timestamp - a.timestamp);
                        const sliced = unique.slice(0, 100);

                        // Side Effect: Update Visuals for new kills
                        updateRecentKillsVisuals(sliced);
                        killFeedRef.current = sliced; // Sync Ref
                        
                        return sliced; 
                    });
                }
            }
        } catch (e) {
            // silent fail on poll
        }
    }, [filters, processKills, is2D, layoutMode, fingerprint]);

    // Poll every 5 seconds
    useEffect(() => { 
        const interval = setInterval(pollFeed, 5000); 
        return () => clearInterval(interval); 
    }, [pollFeed]);

    // --- INITIAL DATA LOAD EFFECT ---
    useEffect(() => {
        if (!killFeedData || !systemsLoaded || systemMapRef.current.size === 0) return;
        
        const transformed = processKills(killFeedData);
        transformed.sort((a, b) => b.timestamp - a.timestamp);

        setFormattedKillFeed(transformed);
        killFeedRef.current = transformed;
        updateRecentKillsVisuals(transformed);

        // Update High Water Mark from Initial Data
        if (transformed.length > 0) {
            const maxId = Math.max(...transformed.map(k => k.id));
            if (maxId > latestKnownId.current) latestKnownId.current = maxId;
        }

        // --- NEW AUTO-FOLLOW LOGIC ---
        // Find kills we haven't processed yet
        const newKills = [];
        transformed.forEach(k => {
            if (!processedKillIdsRef.current.has(k.id)) {
                newKills.push(k);
                processedKillIdsRef.current.add(k.id);
            }
        });

        // Trigger auto-follow if we have new kills and it's not the initial massive load
        if (newKills.length > 0) {
            // Pick highest value kill for drama, fallback to newest.
            const primaryKill = newKills.sort((a, b) => b.rawVal - a.rawVal)[0];
            
            const sys = systemMapRef.current.get(primaryKill.system);
            if(sys) spawnShockwave(sys, primaryKill.rawVal > 1000000000 ? 0xef4444 : 0xffffff);
            
            if (processedKillIdsRef.current.size > newKills.length) {
                handleFeedClick(primaryKill, 'auto');
            } else {
               const absoluteNewest = transformed[0];
               if (absoluteNewest) latestKillIdRef.current = absoluteNewest.id;
            }
        }

    }, [killFeedData, systemsLoaded, killMarkerLimit, killMarkerTimeLimit, processKills]);

    const [isShiftPressed, setIsShiftPressed] = useState(false);

    // --- VIEW CONTROLS (Moved up for access in keydown listener) ---
    const handleGoToView = (view) => {
        if (!view || !view.pos || !view.lookAt) return;

        // Check Pochven Mode - Override view if active
        const activeRegions = (filtersRef.current.regionIds || []).map(id => String(id));
        const spaceTypes = filtersRef.current.spaceTypes || [];
        const otherSpaceTypes = spaceTypes.filter(t => t !== 'poch');
        const isPochvenOnlySpaceType = spaceTypes.includes('poch') && otherSpaceTypes.length === 0;
        const isPochvenActive = isPochvenOnlySpaceType || activeRegions.includes(POCHVEN_REGION_ID);

        if (isPochvenActive) {
            if (homeStatesRef.current.pochven) {
                targetCameraPos.current = homeStatesRef.current.pochven.pos.clone();
                targetControlsLookAt.current = homeStatesRef.current.pochven.lookAt.clone();
            } else if (pochvenAnimRef.current.centroid) {
                const targetCenter = pochvenAnimRef.current.centroid.clone();
                targetCenter.y += POCHVEN_ELEVATION;
                const zoom = 600;
                // Overhead view: High Y, small Z offset to prevent gimbal lock
                const offset = new THREE.Vector3(0, zoom, 10);
                targetControlsLookAt.current = targetCenter;
                targetCameraPos.current = targetCenter.clone().add(offset);
            }
        } else {
            targetCameraPos.current = new THREE.Vector3(view.pos.x, view.pos.y, view.pos.z);
            targetControlsLookAt.current = new THREE.Vector3(view.lookAt.x, view.lookAt.y, view.lookAt.z);
            setActiveViewId(view.id);
            if (setMapMode) setMapMode(view.id);

            // View-based Visibility Logic
            if (view.visibility) {
                setHideAnoikis(view.visibility.hideAnoikis);
                setHideKSpace(view.visibility.hideKSpace);
                setHideAbyssal(view.visibility.hideAbyssal || false);
            } else if (view.id === 'kspace') {
                setHideAnoikis(true);
                setHideKSpace(false);
                setHideAbyssal(true);
            } else if (view.id === 'anoikis') {
                setHideAnoikis(false);
                setHideKSpace(true);
                setHideAbyssal(true);
            } else if (view.id === 'abyssal') {
                setHideAnoikis(true);
                setHideKSpace(true);
                setHideAbyssal(false);
            } else if (view.id === 'strategic') {
                setHideAnoikis(true);
                setHideKSpace(false);
                setHideAbyssal(true);
            } else {
                setHideAnoikis(false);
                setHideKSpace(false);
                setHideAbyssal(false);
            }
        }

        // Handle Mode Switching based on View Type
        if (view.is2D && !is2D) {
            setIs2D(true);
        } else if (!view.is2D && is2D) {
            setIs2D(false);
        }
        isAutoPiling.current = true;
    };

    const handleCreateView = () => {
        if (!activeCameraRef.current || !controlsRef.current) return;
        const name = prompt("Enter name for new view:");
        if (!name) return;

        const customViewsCount = savedViews.filter(v => !DEFAULT_VIEWS.some(d => d.id === v.id)).length;
        if (customViewsCount >= 5) {
            alert("Maximum number of custom views reached (5). Please delete some to add more.");
            return;
        }

        const newPos = activeCameraRef.current.position;
        const newLookAt = controlsRef.current.target;

        // Find next available shortcut (1-9)
        const usedShortcuts = new Set(savedViews.map(v => v.shortcut).filter(Boolean));
        let shortcut = null;
        for (let i = 1; i <= 9; i++) {
            if (!usedShortcuts.has(String(i))) {
                shortcut = String(i);
                break;
            }
        }

        const newView = {
            id: `custom_${Date.now()}`,
            name,
            shortcut,
            pos: { x: newPos.x, y: newPos.y, z: newPos.z },
            lookAt: { x: newLookAt.x, y: newLookAt.y, z: newLookAt.z },
            visibility: { hideAnoikis, hideKSpace, hideAbyssal },
            is2D: is2D
        };

        setSavedViews(prev => {
            const next = [...prev, newView];
            localStorage.setItem('starmap_saved_views', JSON.stringify(next));
            return next;
        });
        setActiveViewId(newView.id);
    };

    const handleDeleteView = () => {
        if (!viewContextMenu) return;
        const isDeletedView2D = viewContextMenu.view.is2D;
        setSavedViews(prev => {
            const next = prev.filter(v => v.id !== viewContextMenu.view.id);
            localStorage.setItem('starmap_saved_views', JSON.stringify(next));
            return next;
        });
        if (activeViewId === viewContextMenu.view.id) {
            if (isDeletedView2D) {
                handleGoToView(DEFAULT_VIEWS.find(v => v.id === 'strategic'));
            } else {
                handleGoToView(DEFAULT_VIEWS[0]);
            }
        }
        setViewContextMenu(null);
    };

    const handleViewContextMenu = (e, view) => {
        e.preventDefault();
        e.stopPropagation();
        isAutoPiling.current = false; // Pause automated movement
        setViewContextMenu({ x: e.clientX, y: e.clientY, view });
    };

    const handleSaveView = () => {
        if (!viewContextMenu || !activeCameraRef.current || !controlsRef.current) return;
        const newPos = activeCameraRef.current.position;
        const newLookAt = controlsRef.current.target;
        
        setSavedViews(prev => {
            const next = prev.map(v => {
                if (v.id === viewContextMenu.view.id) {
                    return { 
                        ...v, 
                        pos: { x: newPos.x, y: newPos.y, z: newPos.z }, 
                        lookAt: { x: newLookAt.x, y: newLookAt.y, z: newLookAt.z },
                        visibility: { hideAnoikis, hideKSpace, hideAbyssal }
                    };
                }
                return v;
            });
            localStorage.setItem('starmap_saved_views', JSON.stringify(next));
            return next;
        });
        setViewContextMenu(null);
    };

    const handleToggleViewVisibility = (view, type) => {
        const currentVis = view.visibility || { hideAnoikis: false, hideKSpace: false, hideAbyssal: false };
        const newVis = { ...currentVis };
        if (type === 'kspace') newVis.hideKSpace = !newVis.hideKSpace;
        if (type === 'anoikis') newVis.hideAnoikis = !newVis.hideAnoikis;
        if (type === 'abyssal') newVis.hideAbyssal = !newVis.hideAbyssal;

        setSavedViews(prev => {
            const next = prev.map(v => v.id === view.id ? { ...v, visibility: newVis } : v);
            localStorage.setItem('starmap_saved_views', JSON.stringify(next));
            return next;
        });

        if (activeViewId === view.id) {
            setHideKSpace(newVis.hideKSpace);
            setHideAnoikis(newVis.hideAnoikis);
            setHideAbyssal(newVis.hideAbyssal);
        }
        setViewContextMenu(null);
    };

    const handleResetViewToDefault = () => {
        if (!viewContextMenu) return;
        const def = DEFAULT_VIEWS.find(v => v.id === viewContextMenu.view.id);
        if (def) {
            setSavedViews(prev => {
                const next = prev.map(v => {
                    if (v.id === def.id) return def;
                    return v;
                });
                localStorage.setItem('starmap_saved_views', JSON.stringify(next));
                return next;
            });
        }
        setViewContextMenu(null);
    };

    const handleExportLayout = () => {
        const exportData = {};
        
        // Group all systems by regionId first
        const systemsByRegion = {};
        systemsRef.current.forEach(sys => {
            if (!systemsByRegion[sys.regionId]) systemsByRegion[sys.regionId] = [];
            systemsByRegion[sys.regionId].push(sys);
        });

        // Iterate grouped regions
        Object.keys(systemsByRegion).forEach(rId => {
            const regionName = regionMapRef.current.get(rId)?.name || `Region ${rId}`;
            
            // Calculate Region Centroid for 2D
            let cx = 0, cz = 0, count = 0;
            systemsByRegion[rId].forEach(s => {
                if (s.x2d !== undefined) {
                    cx += s.x2d;
                    cz += s.z2d;
                    count++;
                }
            });
            const centroid2D = count > 0 ? { x: cx / count, y: cz / count } : null;

            const systems = systemsByRegion[rId].map(s => ({
                id: s.id,
                name: s.name,
                x2d: s.x2d,
                z2d: s.z2d,
                baseX: s.baseX,
                baseY: s.baseY,
                baseZ: s.baseZ,
                constellationId: s.constellationId,
                sec: s.sec
            })).sort((a, b) => a.name.localeCompare(b.name));

            exportData[regionName] = {
                id: rId,
                name: regionName,
                centroid2D: centroid2D,
                systems: systems
            };
        });

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Shift') setIsShiftPressed(true);
            
            const controls = controlsRef.current;
            const activeCam = activeCameraRef.current;
            if (!controls || !activeCam) return;

            // Calculate distance to scale speed dynamically
            const distance = activeCam.position.distanceTo(controls.target);
            const sprintMult = isShiftPressed ? 3 : 1;
            const baseSpeed = distance * 0.04; 
            const moveSpeed = Math.max(2, Math.min(baseSpeed, 150)) * sprintMult;
            const rotationSpeed = 0.04 * sprintMult; 

            const forward = new THREE.Vector3();
            const right = new THREE.Vector3();

            if (is2DRef.current) {
                forward.set(0, 0, -1); // Up on screen (North)
                right.set(1, 0, 0);    // Right on screen (East)
            } else {
                activeCam.getWorldDirection(forward);
                forward.y = 0; forward.normalize();
                right.crossVectors(forward, activeCam.up).normalize();
            }
            const up = new THREE.Vector3(0, 1, 0);

            // FOCUS COMMAND
            if (e.key.toLowerCase() === 'f' && hoveredSystemRef.current) {
                const sys = hoveredSystemRef.current;
                targetControlsLookAt.current = new THREE.Vector3(sys.x, sys.y, sys.z);
                targetCameraPos.current = new THREE.Vector3(sys.x + 80, sys.y + 20, sys.z + 80);
                isAutoPiling.current = true;
                return;
            }

            // View Shortcuts (1-9)
            if (e.key >= '1' && e.key <= '9') {
                const view = savedViews.find(v => v.shortcut === e.key && (!!v.is2D === is2D));
                if (view) {
                    handleGoToView(view);
                    return;
                }
            }

            switch(e.key) {
                case 'ArrowUp': 
                    activeCam.position.addScaledVector(up, moveSpeed); 
                    controls.target.addScaledVector(up, moveSpeed); break;
                case 'ArrowDown': 
                    // Prevent translating through the floor (Y=0)
                    if (activeCam.position.y > 50) {
                        activeCam.position.addScaledVector(up, -moveSpeed); 
                        controls.target.addScaledVector(up, -moveSpeed); 
                    }
                    break;
                case 'ArrowLeft':
                    activeCam.position.sub(controls.target);
                    activeCam.position.applyAxisAngle(up, rotationSpeed);
                    activeCam.position.add(controls.target); break;
                case 'ArrowRight':
                    activeCam.position.sub(controls.target);
                    activeCam.position.applyAxisAngle(up, -rotationSpeed);
                    activeCam.position.add(controls.target); break;
                case 'w': case 'W': 
                    activeCam.position.addScaledVector(forward, moveSpeed); 
                    controls.target.addScaledVector(forward, moveSpeed); break;
                case 's': case 'S': 
                    activeCam.position.addScaledVector(forward, -moveSpeed); 
                    controls.target.addScaledVector(forward, -moveSpeed); break;
                case 'a': case 'A': 
                    activeCam.position.addScaledVector(right, -moveSpeed); 
                    controls.target.addScaledVector(right, -moveSpeed); break;
                case 'd': case 'D': 
                    activeCam.position.addScaledVector(right, moveSpeed); 
                    controls.target.addScaledVector(right, moveSpeed); break;
                case 'h': case 'H':
                    handleResetView();
                    break;
                case 'r': case 'R':
                    toggleRegionMode();
                    break;
                case 'Escape':
                    setActiveKillId(null);
                    setSelectedSystem(null);
                    setSystemIntel(null);
                    if (card3DGroupRef.current && !is2DRef.current) {
                        card3DGroupRef.current.clear();
                        activeCardRef.current = null;
                    }
                    isAutoPiling.current = false;
                    setSearchTerm('');
                    setSearchResults([]);
                    setSearchActive(false);
                    break;
            }
            resetIdleTimer(); 
        };

        const handleKeyUp = (e) => { if (e.key === 'Shift') setIsShiftPressed(false); };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isShiftPressed, savedViews]); // is2DRef is used inside, so no dep needed

    useEffect(() => {
        if (!activeKillId) return;
        const timeoutDuration = is2D ? (killCardLifespan2D * 1000) : 20000; // Configurable for 2D, 20s for 3D
        const timer = setTimeout(() => {
            setActiveKillId(null);
            if (card3DGroupRef.current && !is2D) {
                card3DGroupRef.current.clear();
                activeCardRef.current = null;
            }
            isAutoPiling.current = false;
        }, timeoutDuration);
        return () => clearTimeout(timer);
    }, [activeKillId, is2D, killCardLifespan2D]);

    // Auto-close controls when system/kill card opens
    useEffect(() => {
        if (selectedSystem || activeKillId) {
            setShowControls(false);
        }
    }, [selectedSystem, activeKillId]);

    // Auto-close controls after timeout
    useEffect(() => {
        if (showControls) {
            const timer = setTimeout(() => setShowControls(false), 15000);
            return () => clearTimeout(timer);
        }
    }, [showControls]);

    // IDLE TIMER LOGIC
    useEffect(() => {
        if (!idleResetEnabled) return;

        const idleInterval = setInterval(() => {
            const idleTime = Date.now() - lastInteractionRef.current;
            if (idleTime > (idleResetTime * 1000) && !activeKillId && !selectedSystem && !isAutoPiling.current && perspectiveCamRef.current) {
                // Determine where "Home" is right now
                let homePos = null;
                
                if (is2D) {
                    const view = activeViewRef.current;
                    if (view && view.pos) {
                        homePos = new THREE.Vector3(view.pos.x, view.pos.y, view.pos.z);
                    } else {
                        // Fallback to layout center overhead
                        const mode = layoutModeRef.current;
                        const center = layoutCentersRef.current[mode] || {x:0, z:0};
                        homePos = new THREE.Vector3(center.x, 1700, center.z);
                    }
                } else {
                    // Check Pochven Mode
                    const activeRegions = (filtersRef.current.regionIds || []).map(id => String(id));
                    const spaceTypes = filtersRef.current.spaceTypes || [];
                    const otherSpaceTypes = spaceTypes.filter(t => t !== 'poch');
                    const isPochvenOnlySpaceType = spaceTypes.includes('poch') && otherSpaceTypes.length === 0;
                    const isPochvenActive = isPochvenOnlySpaceType || activeRegions.includes(POCHVEN_REGION_ID);

                    if (isPochvenActive && homeStatesRef.current.pochven) {
                        homePos = homeStatesRef.current.pochven.pos;
                    } else if (isPochvenActive && pochvenAnimRef.current.centroid) {
                        // Default Pochven Home Calculation for Idle Check
                        const targetCenter = pochvenAnimRef.current.centroid.clone();
                        targetCenter.y += POCHVEN_ELEVATION;
                        const zoom = 600;
                        const offset = new THREE.Vector3(0, zoom, 10);
                        homePos = targetCenter.clone().add(offset);
                    } else if (!isPochvenActive && activeViewRef.current) {
                        // Use the active view from the top bar
                        homePos = new THREE.Vector3(activeViewRef.current.pos.x, activeViewRef.current.pos.y, activeViewRef.current.pos.z);
                    }
                }

                if (homePos && perspectiveCamRef.current.position.distanceTo(homePos) > 10) {
                    handleResetView();
                }
            }
        }, 5000);
        return () => clearInterval(idleInterval);
    }, [activeKillId, selectedSystem, idleResetEnabled, idleResetTime, is2D]);

    // --- REFACTORED MATERIAL SETUP FOR SINGLE MESH ---
    const setupInstancedMeshMaterial = () => {
        // White base color so instanceColor tints it correctly
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        material.onBeforeCompile = (shader) => {
            // UPDATED INITIALIZATION: Use regionModeRef to set initial mix state
            // TAC/NEB = 0.0 (sec colors), DYN = 1.0 (distance-based), REG = 2.0 (force region)
            let initialMix = 0.0;
            if (regionModeRef.current === 'DYN') initialMix = 1.0;
            else if (regionModeRef.current === 'REG') initialMix = 2.0;
            shader.uniforms.mixState = { value: initialMix };
            shader.uniforms.brightness = { value: brightnessRef.current };

            shader.vertexShader = `
                attribute vec3 aRegionColor;
                attribute float aActive;
                attribute float aIsAnoikis;
                uniform float mixState;
                uniform float brightness;
                ${shader.vertexShader}
            `;
            
            // Inject color mixing logic
            shader.vertexShader = shader.vertexShader.replace(
                '#include <color_vertex>',
                `
                #include <color_vertex>
                
                // Color Logic
                // mixState: 0.0 = TAC/NEB (sec only), 1.0 = DYN (distance-based), 2.0 = REG (region only)
                float mixFactor = 0.0;
                if (mixState > 1.5) {
                    // REG mode: Force full region color (Skips distance calc)
                    mixFactor = 1.0;
                } else if (mixState > 0.5) {
                    // DYN mode: Distance-based mixing
                    // Calculate distance ONLY if needed (Optimization for Tactical Mode)
                    vec4 instanceWorldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                    float dist = distance(instanceWorldPos.xyz, cameraPosition);

                    if (aIsAnoikis > 0.5) {
                        mixFactor = 0.0; // Force Sec Color (Purple Gradient) for Anoikis in DYN mode
                    } else {
                        float t = (600.0 - dist) / (600.0 - 200.0);
                        t = clamp(t, 0.0, 1.0);
                        // t=1 means Close (Sec Color), t=0 means Far (Region Color)
                        mixFactor = 1.0 - t;
                    }
                }

                // Mix Sec Color with Region Color
                vColor = mix(vColor, aRegionColor, mixFactor);

                // Apply brightness adjustment
                vColor *= brightness;

                // GHOST MODE OVERRIDE
                // If aActive < 0.5 (inactive), force very dim appearance
                if (aActive < 0.5) {
                    vColor = vec3(0.12, 0.12, 0.15) * brightness; // Much darker, subtle blue tint
                }
                `
            );
            
            // Re-inject scale logic in begin_vertex
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                
                // Recalculate dist for scaling
                vec4 instPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                float d = distance(instPos.xyz, cameraPosition);
                float s = 1.0;
                
                // Original Distance Scaling (Only if Active)
                if (aActive > 0.5) {
                    if (d > 400.0) { s = 1.0 + (d - 400.0) / 400.0; }
                    if (s > 6.0) s = 6.0;
                } else {
                    // Inactive (Ghost) Scaling - very small to fade into background
                    s = 0.2;
                }
                
                transformed *= s;
                `
            );

            material.uniforms = shader.uniforms;
        };
        
        return material;
    };

    // --- REFACTORED MATERIAL SETUP FOR 2D POINTS ---
    const setup2DPointsMaterial = () => {
        const material = new THREE.PointsMaterial({ size: 6, vertexColors: true, sizeAttenuation: false });

        material.onBeforeCompile = (shader) => {
            let initialMix = 0.0;
            if (regionModeRef.current === 'DYN') initialMix = 1.0;
            else if (regionModeRef.current === 'REG') initialMix = 2.0;
            shader.uniforms.mixState = { value: initialMix };
            shader.uniforms.time = { value: 0.0 }; // Add time uniform for animation
            shader.uniforms.brightness = { value: brightnessRef.current };

            shader.vertexShader = `
                attribute vec3 aRegionColor;
                attribute float aActive;
                attribute float aPulsePhase;
                uniform float mixState;
                uniform float time;
                uniform float brightness;
                ${shader.vertexShader}
            `;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <color_vertex>',
                `
                #include <color_vertex>

                float mixFactor = 0.0;
                if (mixState > 1.5) {
                    mixFactor = 1.0; // REG (Skips distance calc)
                } else if (mixState > 0.5) {
                    // DYN - Distance based (2D View ~1700 units up)
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    float dist = distance(worldPos.xyz, cameraPosition);

                    float t = (2500.0 - dist) / (2500.0 - 800.0);
                    t = clamp(t, 0.0, 1.0);
                    mixFactor = 1.0 - t;
                }

                vColor = mix(vColor, aRegionColor, mixFactor);

                // Apply brightness adjustment
                vColor *= brightness;

                if (aActive < 0.5) {
                    vColor = vec3(0.12, 0.12, 0.15) * brightness;
                }
                `
            );

            // Add circle animation and distance-based size attenuation
            // Replace the size calculation section
            shader.vertexShader = shader.vertexShader.replace(
                'gl_PointSize = size;',
                `
                // Distance-based size scaling to emulate 3D perspective behavior
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                float dist = distance(worldPos.xyz, cameraPosition);
                
                // Logic derived from 3D behavior:
                // d < 400: s=1. Apparent ~ 1/d. (Gets bigger)
                // 400 < d < 2400: s grows linearly. Apparent ~ Constant.
                // d > 2400: s clamped. Apparent ~ 1/d. (Gets smaller)
                
                float scaleFactor = 1.0;
                
                if (dist < 400.0) {
                     // Close range: Grow as we get closer (Perspective-like)
                     // Clamp min dist to prevent covering screen
                     scaleFactor = 400.0 / max(dist, 80.0);
                } else if (dist < 2400.0) {
                     // Mid range: Constant size (Compensated)
                     scaleFactor = 1.0;
                } else {
                     // Far range: Shrink (Perspective-like)
                     scaleFactor = 2400.0 / dist;
                     // Clamp min scale to ensure visibility at extreme range
                     scaleFactor = max(scaleFactor, 0.2); 
                }

                gl_PointSize = size * scaleFactor;
                `
            );

            // Make points circular instead of square
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>

                // Create circular points by discarding pixels outside circle
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                if (dist > 0.5) discard;

                // Soft edge for anti-aliasing
                float alpha = 1.0 - smoothstep(0.4, 0.5, dist);
                diffuseColor.a *= alpha;
                `
            );

            material.userData.shader = shader;
        };

        return material;
    };

    const spawnShockwave = (sys, colorHex) => {
        const color = new THREE.Color(colorHex);
        const geo = new THREE.RingGeometry(SYSTEM_RADIUS*3, SYSTEM_RADIUS*4, 32);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity:1, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthTest: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(sys.x, sys.y, sys.z);
        mesh.lookAt(activeCameraRef.current.position); 
        shockwavesRef.current.push({ mesh, age: 0, speed: 0.03, maxAge: 1.0 });
        if (labelGroupRef.current && labelGroupRef.current.parent) labelGroupRef.current.parent.add(mesh);
    };

    const updateRecentKillsVisuals = (currentKills) => {
        if (!recentKillsGroupRef.current) return;
        
        // CLEANUP: Dispose of old geometries and materials to prevent memory leaks
        recentKillsGroupRef.current.children.forEach(group => {
            group.children.forEach(child => {
                if (child.geometry && child.geometry !== SHARED_KILL_SPHERE_GEO) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        });
        recentKillsGroupRef.current.clear();
        killCountLabelsRef.current.clear();

        const now = Date.now();
        const timeLimitMs = killMarkerTimeLimitRef.current * 60 * 1000;
        const countLimit = killMarkerLimitRef.current;
        const recent = currentKills.filter(kill => (now - kill.timestamp) <= timeLimitMs).slice(0, countLimit);

        // Group kills by system
        const systemGroups = {};
        recent.forEach(kill => {
            if (!systemGroups[kill.system]) systemGroups[kill.system] = [];
            systemGroups[kill.system].push(kill);
        });

        // Create ONE marker per system
        Object.entries(systemGroups).forEach(([sysName, kills]) => {
            const sys = systemMapRef.current.get(sysName);
            if (!sys) return;

            // Sort to find primary (highest value) and newest kills
            const sortedByValue = [...kills].sort((a, b) => b.rawVal - a.rawVal);
            const sortedByTime = [...kills].sort((a, b) => b.timestamp - a.timestamp);
            const primaryKill = sortedByValue[0]; // Highest value
            const newestKill = sortedByTime[0]; // Most recent
            const killCount = kills.length;
            const totalValue = kills.reduce((sum, k) => sum + k.rawVal, 0);

            // Color based on highest value kill
            const colorHex = getBorderColor(primaryKill.rawVal);
            const color = new THREE.Color(colorHex);

            // Scale based on highest value (larger = more valuable)
            let baseScale = 1.5;
            if (primaryKill.rawVal > 10000000000) baseScale = 3.5;      // >10b
            else if (primaryKill.rawVal > 5000000000) baseScale = 3.0;  // >5b
            else if (primaryKill.rawVal > 1000000000) baseScale = 2.5;  // >1b
            else if (primaryKill.rawVal > 100000000) baseScale = 2.0;   // >100m

            // Ring gets thicker with more kills
            const ringThickness = Math.min(0.8 + (killCount * 0.15), 2.0);

            // Create sphere (core)
            // Use shared geometry and scale the mesh instead of creating new geometry
            const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1.0 });
            const mesh = new THREE.Mesh(SHARED_KILL_SPHERE_GEO, mat);
            mesh.scale.setScalar(baseScale);

            // Create ring
            const ringInner = baseScale * 1.6;
            const ringOuter = ringInner + ringThickness;
            const ringGeo = new THREE.RingGeometry(ringInner, ringOuter, 24);
            const ringMat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);

            const group = new THREE.Group();
            group.add(mesh);
            group.add(ring);
            
            if (is2DRef.current && sys.x2d !== undefined) {
                group.position.set(sys.x2d, 0, sys.z2d);
            } else {
                group.position.set(sys.x, sys.y, sys.z);
            }

            // Determine Initial Visibility based on current state
            let isVisible = true;
            const regionId = sys.regionId;
            
            // 1. Check Mode (New Eden vs Cluster)
            if (is2DRef.current && (isAnoikisRegion(regionId) || regionId === '12000001')) {
                isVisible = false;
            } else if (hideAnoikisRef.current && isAnoikisRegion(regionId)) {
                isVisible = false;
            } else if (hideKSpaceRef.current && !isAnoikisRegion(regionId) && regionId !== '12000001') {
                isVisible = false;
            } else {
                // 2. Check Filters
                const filters = filtersRef.current;
                const activeRegions = (filters.regionIds || []).map(id => String(id));
                const spaceTypes = filters.spaceTypes || [];
                const otherSpaceTypes = spaceTypes.filter(t => t !== 'poch');
                const isPochvenOnlySpaceType = spaceTypes.includes('poch') && otherSpaceTypes.length === 0;
                const isPochvenActive = isPochvenOnlySpaceType || activeRegions.includes(POCHVEN_REGION_ID);
                const hasActiveFilters = isPochvenActive || activeRegions.length > 0;
                
                if (hasActiveFilters) {
                    const isInActiveRegion = (isPochvenActive && regionId === POCHVEN_REGION_ID) || activeRegions.includes(regionId);
                    if (!isInActiveRegion) isVisible = false;
                }
            }
            group.visible = isVisible;

            // Store all kill data for hover info and feed highlighting
            group.userData = {
                systemName: sysName,
                systemData: sys,
                kills: kills,                    // All kills in this system
                killIds: kills.map(k => k.id),   // For quick lookup when hovering feed
                primaryKill: primaryKill,        // Highest value
                newestKill: newestKill,          // Most recent
                newestTimestamp: newestKill.timestamp,
                killCount: killCount,
                totalValue: totalValue,
                baseScale: baseScale,
                colorHex: colorHex,
                pulsePhase: Math.random() * Math.PI * 2
            };

            recentKillsGroupRef.current.add(group);

            // Add count label if multiple kills
            if (killCount > 1) {
                const countSprite = getKillCountSprite(killCount, colorHex);
                // Position slightly above and to the right
                countSprite.position.set(baseScale * 1.2, baseScale * 1.2, 0);
                group.add(countSprite);
            }
        });
    };

    const toggleFullscreen = () => setIsFullscreen(prev => !prev);
    useEffect(() => { setTimeout(() => window.dispatchEvent(new Event('resize')), 100); }, [isFullscreen]);
    
    // --- UPDATED INTERACTION LOGIC ---
    const resetIdleTimer = () => {
        lastInteractionRef.current = Date.now();
    };

    const activateInteractionLock = () => { 
        resetIdleTimer();
        if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
        interactionTimeoutRef.current = setTimeout(() => { 
            interactionTimeoutRef.current = null; 
        }, 15000);
    };

    useEffect(() => {
        const close = () => setViewContextMenu(null);
        if (viewContextMenu) window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [viewContextMenu]);

    const handleResetView = () => {
        setResetActive(true);
        const controls = controlsRef.current;
        setTimeout(() => setResetActive(false), 200);

        if (is2DRef.current) {
            // 2D Home: Use active view (same approach as 3D)
            const view = activeViewRef.current;
            if (view && isValidVector(view.pos) && isValidVector(view.lookAt)) {
                targetCameraPos.current = new THREE.Vector3(view.pos.x, view.pos.y, view.pos.z);
                targetControlsLookAt.current = new THREE.Vector3(view.lookAt.x, view.lookAt.y, view.lookAt.z);
            } else {
                // Fallback: center of 2D layout, overhead
                const mode = layoutModeRef.current;
                const center = layoutCentersRef.current[mode] || {x:0, z:0};
                targetCameraPos.current = new THREE.Vector3(center.x, 1700, center.z);
                targetControlsLookAt.current = new THREE.Vector3(center.x, 0, center.z);
            }
            isAutoPiling.current = true;
            return;
        }

        // 3D Home Logic
        const activeRegions = (filtersRef.current.regionIds || []).map(id => String(id));
        const spaceTypes = filtersRef.current.spaceTypes || [];
        const otherSpaceTypes = spaceTypes.filter(t => t !== 'poch');
        const isPochvenOnlySpaceType = spaceTypes.includes('poch') && otherSpaceTypes.length === 0;
        const isPochvenActive = isPochvenOnlySpaceType || activeRegions.includes(POCHVEN_REGION_ID);

        if (isPochvenActive) {
            if (homeStatesRef.current.pochven) {
                // Recall Saved Pochven Home
                targetCameraPos.current = homeStatesRef.current.pochven.pos.clone();
                targetControlsLookAt.current = homeStatesRef.current.pochven.lookAt.clone();
            } else if (pochvenAnimRef.current.centroid) {
                // Default Pochven Home (Triangle Center) if not set
                const targetCenter = pochvenAnimRef.current.centroid.clone();
                targetCenter.y += POCHVEN_ELEVATION;
                const zoom = 600;
                const offset = new THREE.Vector3(0, zoom, 10);
                targetControlsLookAt.current = targetCenter;
                targetCameraPos.current = targetCenter.clone().add(offset);
            }
        } else {
            // Reset to Currently Selected View (Home Button Logic)
            const view = activeViewRef.current;
            if (view && isValidVector(view.pos) && isValidVector(view.lookAt)) {
                targetCameraPos.current = new THREE.Vector3(view.pos.x, view.pos.y, view.pos.z);
                targetControlsLookAt.current = new THREE.Vector3(view.lookAt.x, view.lookAt.y, view.lookAt.z);
                isAutoPiling.current = true;
            } else {
                // Fallback to default if saved view is corrupted
                const def = DEFAULT_VIEWS[0];
                targetCameraPos.current = new THREE.Vector3(def.pos.x, def.pos.y, def.pos.z);
                targetControlsLookAt.current = new THREE.Vector3(def.lookAt.x, def.lookAt.y, def.lookAt.z);
                isAutoPiling.current = true;
            }
        }

        setActiveKillId(null);
        setSelectedSystem(null);
        setSystemIntel(null);
    };

    // --- REGION MODE TOGGLE ---
    const toggleRegionMode = () => {
        setRegionMode(prev => {
            if (prev === 'TAC') return 'DYN';
            if (prev === 'DYN') return 'REG';
            if (prev === 'REG') return 'TAC';
            return 'TAC';
        });
    };

    // --- LAYOUT MODE TOGGLE (REG <-> MAP) ---
    const toggleLayoutMode = () => {
        setLayoutMode(prev => prev === 'REG' ? 'MAP' : 'REG');
    };

    // --- CLOUD TEXTURE GENERATOR ---
    const getCloudTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64; // Increased res
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32,32,0, 32,32,32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,64,64);
        return new THREE.CanvasTexture(canvas);
    };

    // --- RESTORED & UPGRADED HANDLEFEEDCLICK ---
    const handleFeedClick = async (kill, triggerType = 'manual') => {
        const sys = systemMapRef.current.get(kill.system);
        if (!sys) return; 

        // VISIBILITY CHECK: Do not process if the region type is hidden
        const isAnoikis = isAnoikisRegion(sys.regionId);
        const isAbyssal = sys.regionId === '12000001';
        const isKSpace = !isAnoikis && !isAbyssal;

        if (isKSpace && hideKSpaceRef.current) return;
        if (isAnoikis && hideAnoikisRef.current) return;
        if (isAbyssal && hideAbyssalRef.current) return;
        
        // CHECK PAUSE: Only block 'auto' if interaction timeout is ACTIVE
        if (triggerType === 'auto') {
            // In 2D mode, allow spawning even if interacting (cards just appear)
            if (!is2DRef.current && interactionTimeoutRef.current) return;

            // Auto-Locate Filters
            if (autoLocateCriteriaRef.current === '1b' && kill.rawVal < 1000000000) return;
            if (autoLocateCriteriaRef.current === '5b' && kill.rawVal < 5000000000) return;
            if (autoLocateCriteriaRef.current === 'caps') {
                const sClass = (kill.shipClass || '').toLowerCase();
                const isCap = sClass.includes('capital') || sClass.includes('titan') || sClass.includes('dread') || sClass.includes('carrier') || sClass.includes('super') || sClass.includes('rorqual');
                if (!isCap) return;
            }
        }

        const shouldMoveCamera = triggerType === 'manual' || (triggerType === 'auto' && isAutoLocateRef.current);
        shouldTrackActiveKillRef.current = shouldMoveCamera;

        // Use animated position for Pochven systems if triangle animation is active
        let displayPos = { x: sys.x, y: sys.y, z: sys.z };
        if (pochvenAnimRef.current.active && !is2DRef.current) {
            const animData = pochvenAnimRef.current.systemMap.get(sys.id);
            if (animData?.currentPos) displayPos = animData.currentPos;
        } else if (is2DRef.current && sys.x2d !== undefined) {
             displayPos = { x: sys.x2d, y: 0, z: sys.z2d };
        }

        // Safety check: skip if position is invalid
        if (!isValidNumber(displayPos.x) || !isValidNumber(displayPos.y) || !isValidNumber(displayPos.z)) {
            console.warn(`Skipping card creation for kill ${kill.id} due to invalid position for system:`, sys.name);
            return;
        }

        setActiveKillId(kill.id);

        // Scroll the list to this kill item ONLY if triggered manually
        if (triggerType === 'manual') {
            setTimeout(() => {
                const el = document.getElementById(`kill-item-${kill.id}`);
                if(el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
        }

        if (!is2DRef.current) {
            // 3D mode: one card at a time, clear all
            if (card3DGroupRef.current) card3DGroupRef.current.clear();
            cardsBySystemRef.current.clear(); flipAnimRef.current = null; hoveredKillCardGroupRef.current = null;
            const card = createKillCard(kill, displayPos);
            card.userData.systemId = sys.id;
            card.userData.killId = kill.id;
            card3DGroupRef.current.add(card);
            activeCardRef.current = card;
        } else {
            // 2D mode: multi-kill stack management per system
            const sysName = kill.system;
            const entry = cardsBySystemRef.current.get(sysName);

            if (!entry) {
                // First kill for this system
                const card = createKillCard(kill, displayPos);
                card.userData.systemId = sys.id;
                card.userData.killId = kill.id;
                card.userData.systemName = sysName;
                card3DGroupRef.current.add(card);
                activeCardRef.current = card;
                cardsBySystemRef.current.set(sysName, {
                    kills: [kill], cards: [card],
                    primaryIdx: 0, expanded: false,
                    systemPos: displayPos, ghostShadows: []
                });
                // Per-kill expiry timeout
                setTimeout(() => {
                    removeKillFromSystem(kill.id, sysName);
                    const remaining = cardsBySystemRef.current.get(sysName);
                    activeCardRef.current = remaining?.cards[remaining?.primaryIdx] ?? null;
                }, killCardLifespan2DRef.current * 1000);
            } else {
                const existingIdx = entry.kills.findIndex(k => k.id === kill.id);

                if (existingIdx !== -1) {
                    // Kill already tracked (user clicked it in feed) — just switch which is shown
                    entry.primaryIdx = existingIdx;
                    collapseToStack(entry);
                } else {
                    // New kill for this system — add card, make it the primary shown
                    const card = createKillCard(kill, displayPos);
                    card.userData.systemId = sys.id;
                    card.userData.killId = kill.id;
                    card.userData.systemName = sysName;
                    card.visible = false; // collapseToStack sets visibility
                    card3DGroupRef.current.add(card);
                    entry.kills.push(kill);
                    entry.cards.push(card);
                    entry.primaryIdx = entry.kills.length - 1; // newest becomes primary
                    collapseToStack(entry);
                    // Per-kill expiry timeout only for new cards
                    setTimeout(() => {
                        removeKillFromSystem(kill.id, sysName);
                        const remaining = cardsBySystemRef.current.get(sysName);
                        activeCardRef.current = remaining?.cards[remaining?.primaryIdx] ?? null;
                    }, killCardLifespan2DRef.current * 1000);
                }
                activeCardRef.current = entry.cards[entry.primaryIdx];
            }
        }

        if (shouldMoveCamera && isValidNumber(displayPos.x) && isValidNumber(displayPos.y) && isValidNumber(displayPos.z)) {
             if (is2DRef.current) {
                 const lookAt = new THREE.Vector3(displayPos.x, 0, displayPos.z);
                 const camPos = new THREE.Vector3(displayPos.x, 225, displayPos.z + 225);
                 targetControlsLookAt.current = lookAt;
                 targetCameraPos.current = camPos;
             } else {
                 const lookAt = new THREE.Vector3(displayPos.x, displayPos.y + 30, displayPos.z);
                 const camPos = new THREE.Vector3(displayPos.x + 120, displayPos.y + 50, displayPos.z + 120);
                 targetControlsLookAt.current = lookAt;
                 targetCameraPos.current = camPos;
             }
             isAutoPiling.current = true;
        } else if (triggerType === 'auto') {
             // Ensure we don't pile if we shouldn't (e.g. previous pile in progress)
             isAutoPiling.current = false;
        }
        
        if (triggerType === 'manual') {
            activateInteractionLock(); 
            const regionInfo = regionMapRef.current.get(sys.regionId);
            setSelectedSystem({ ...sys, regionName: regionInfo?.name || 'Unknown Region' });
            setSystemIntel(null);
            const intel = await fetchSystemIntel(sys);
            setSystemIntel(intel);
        } else {
             setSelectedSystem(null);
        }
    };

    // --- MULTI-KILL CARD MANAGEMENT (2D MODE) ---
    const STACK_FAN_DIST = 28; // Units from system center when expanded

    const computeFanOffset = (cardIdx, totalCards) => {
        const angle = (cardIdx / totalCards) * Math.PI * 2;
        return { x: Math.sin(angle) * STACK_FAN_DIST, z: Math.cos(angle) * STACK_FAN_DIST };
    };

    const refreshGhostShadows = (entry) => {
        entry.ghostShadows.forEach(m => {
            if (m.parent) m.parent.remove(m);
            m.geometry.dispose();
            m.material.dispose();
        });
        entry.ghostShadows = [];

        const primaryCard = entry.cards[entry.primaryIdx];
        if (!primaryCard || entry.kills.length <= 1) return;
        const cardMesh = primaryCard.userData.cardMesh;
        if (!cardMesh?.material?.map) return;

        const numShadows = Math.min(entry.kills.length - 1, 2);
        for (let i = 0; i < numShadows; i++) {
            const opacity = i === 0 ? 0.3 : 0.15;
            const scale = i === 0 ? 0.92 : 0.84;
            const geo = new THREE.PlaneGeometry(80 * scale, 35 * scale);
            const mat = new THREE.MeshBasicMaterial({
                map: cardMesh.material.map,
                transparent: true, opacity,
                side: THREE.DoubleSide, depthTest: false
            });
            const shadow = new THREE.Mesh(geo, mat);
            // Add to cardMesh so it inherits the card's rotation (flat in MAP mode, billboard in REG/3D).
            // Offset in cardMesh local XY space — with MAP mode's -π/2 X rotation this becomes
            // a diagonal XZ shift in world space, making the stack visible from above.
            shadow.position.set((i + 1) * 4, (i + 1) * 4, 0.1);
            shadow.renderOrder = 9998 - i;
            cardMesh.add(shadow);
            entry.ghostShadows.push(shadow);
        }
    };

    const repositionFan = (entry) => {
        const total = entry.kills.length;
        entry.cards.forEach((card, i) => {
            const offset = computeFanOffset(i, total);
            card.position.set(
                entry.systemPos.x + offset.x,
                entry.systemPos.y,
                entry.systemPos.z + offset.z
            );
            // Update stalk to point from system center back to card base
            const stalk = card.children.find(c => c.isLine);
            if (stalk?.geometry?.attributes?.position) {
                const pos = stalk.geometry.attributes.position;
                pos.setXYZ(0, -offset.x, 0, -offset.z);
                pos.setXYZ(1, 0, 42.5, 0);
                pos.needsUpdate = true;
            }
            card.visible = true;
        });
        entry.ghostShadows.forEach(m => { if (m.parent) m.parent.remove(m); });
        entry.ghostShadows = [];
    };

    const collapseToStack = (entry) => {
        entry.cards.forEach((card, i) => {
            card.visible = i === entry.primaryIdx;
            if (i === entry.primaryIdx) {
                card.position.set(entry.systemPos.x, entry.systemPos.y, entry.systemPos.z);
                const stalk = card.children.find(c => c.isLine);
                if (stalk?.geometry?.attributes?.position) {
                    const pos = stalk.geometry.attributes.position;
                    pos.setXYZ(0, 0, 0, 0);
                    pos.setXYZ(1, 0, 42.5, 0);
                    pos.needsUpdate = true;
                }
            }
        });
        refreshGhostShadows(entry);
    };

    const toggleSystemExpanded = (sysName) => {
        const entry = cardsBySystemRef.current.get(sysName);
        if (!entry || entry.kills.length <= 1) return;
        entry.expanded = !entry.expanded;
        if (entry.expanded) {
            repositionFan(entry);
        } else {
            collapseToStack(entry);
        }
    };

    const removeKillFromSystem = (killId, sysName) => {
        const entry = cardsBySystemRef.current.get(sysName);
        if (!entry) return;
        const idx = entry.kills.findIndex(k => k.id === killId);
        if (idx === -1) return;

        const card = entry.cards[idx];
        if (card?.parent) card.parent.remove(card);

        if (idx === entry.primaryIdx) {
            entry.ghostShadows.forEach(m => { if (m.parent) m.parent.remove(m); });
            entry.ghostShadows = [];
        }

        entry.kills.splice(idx, 1);
        entry.cards.splice(idx, 1);

        if (entry.kills.length === 0) {
            cardsBySystemRef.current.delete(sysName);
            return;
        }

        if (entry.primaryIdx >= entry.kills.length) entry.primaryIdx = 0;

        if (entry.expanded) {
            repositionFan(entry);
        } else {
            collapseToStack(entry);
        }
    };
    // --- END MULTI-KILL CARD MANAGEMENT ---

    // --- COMPLETE 3D KILL CARD OVERHAUL (HUD STYLE) ---
    const createKillCard = (killData, systemPos, fanOffset = { x: 0, z: 0 }) => {
        const group = new THREE.Group();
        const width = 1600; const height = 700; // Aspect ratio adjusted for HUD layout
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        const centerX = width / 2; // DEFINED HERE TO FIX REFERENCE ERROR
        const isHighValue = killData.rawVal > 1000000000;
        const sysRegion = regionMapRef.current.get(killData.regionId || "10000002")?.name || "Unknown Region";
        const secColorStr = killData.secColor || getSecColor(killData.sec);
        const killColor = getBorderColor(killData.rawVal); // Used for ISK value
        const borderColor = killColor; // FIXED: ensure borderColor is defined for usage later

        
        const fitText = (text, maxWidth, fontFace, weight = 'bold') => {
            if (!text) return 20; // safe default
            let s = 70; ctx.font = `${weight} ${s}px "${fontFace}"`;
            while(ctx.measureText(text).width > maxWidth && s > 20) { s-=2; ctx.font = `${weight} ${s}px "${fontFace}"`; }
            return s;
        };
        
        const truncateText = (text, maxWidth) => {
            if (!isValidText(text)) return "";
            if (ctx.measureText(text).width <= maxWidth) return text;
            let truncated = text;
            while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
                truncated = truncated.slice(0, -1);
            }
            return truncated + '...';
        };

        // Helper for Outline + Fill
        const drawText = (text, x, y, lw = 4) => {
            if (!isValidText(text)) return; // Safety check for undefined or None
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.lineWidth = lw;
            ctx.lineJoin = 'round'; 
            ctx.strokeText(text, x, y);
            ctx.fillText(text, x, y);
        };

        // Helper: Rounded Rect Path
        const roundRect = (x, y, w, h, r) => {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        };

        // 1. Background Gradient (Dark Red -> Dark Green)
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, 'rgba(60, 10, 10, 0.85)'); // Dark Red left
        grad.addColorStop(0.5, 'rgba(20, 20, 20, 0.85)'); // Dark Center
        grad.addColorStop(1, 'rgba(10, 60, 10, 0.85)'); // Dark Green right
        
        ctx.fillStyle = grad;
        
        // Draw Main Card Shape with Thick Rounded Border
        const cornerRadius = 40;
        roundRect(5, 5, width-10, height-10, cornerRadius);
        ctx.fill();

        // Thick Rounded Border
        ctx.lineWidth = 12;
        ctx.strokeStyle = '#333'; // Dark Grey HUD frame
        ctx.stroke();
        
        // Inner Highlight Border
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.stroke();
        
        // 2. Content Layout (Centered, NO side bar)
        // Previous contentX was 70. Now we use 40 to pad from the rounded edge.
        const contentX = 50; 
        const safeWidth = width - (contentX * 2);
        
        // --- HEADER SECTION (CENTERED) ---
        ctx.textAlign = 'center';
        
        // System Name & Sec
        ctx.fillStyle = '#eee'; ctx.font = 'bold 90px "Segoe UI"';
        drawText(killData.system, centerX, 100, 8);
        
        ctx.fillStyle = secColorStr; ctx.font = 'bold 50px "Segoe UI"';
        drawText(`${killData.sec.toFixed(1)}  //  ${sysRegion.toUpperCase()}`, centerX, 160, 5);
        
        // Timestamp
        ctx.fillStyle = '#888'; ctx.font = '40px monospace';
        drawText(formatDate(killData.timestamp), centerX, 220, 4);

        // Divider
        ctx.beginPath(); ctx.moveTo(contentX + 50, 240); ctx.lineTo(width - contentX - 50, 240);
        ctx.strokeStyle = '#444'; ctx.lineWidth = 4; ctx.stroke();
        
        // --- COMBATANTS (Far Sides) ---
        const midY = 420;
        
        // --- VICTIM COLUMN (Left Side) ---
        // Image is mesh, at X=-35. Canvas mapping ~ X=150
        const vColX = 250; 
        
        ctx.textAlign = 'center';
        // Ship Name (Under Image)
        ctx.fillStyle = '#ccc'; ctx.font = 'bold 50px "Segoe UI"';
        drawText(killData.ship, vColX, 280, 5);
        
        // Victim Name
        ctx.fillStyle = '#ef4444'; // Red
        fitText(killData.pilot, 500, "Segoe UI");
        drawText(truncateText(killData.pilot, 500), vColX, 350, 5);
        
        // Corp
        if (isValidText(killData.victimCorp)) {
            ctx.fillStyle = '#aaa'; ctx.font = '40px "Segoe UI"';
            drawText(truncateText(killData.victimCorp, 500), vColX, 420, 4);
        }
        
        // Alliance
        if (isValidText(killData.victimAlliance)) {
             ctx.fillStyle = '#888'; ctx.font = '35px "Segoe UI"';
             drawText(truncateText(killData.victimAlliance, 500), vColX, 470, 4);
        }

        // Ship Class
        if (killData.shipClass) {
            ctx.fillStyle = '#666'; ctx.font = 'italic 35px "Segoe UI"';
            drawText(formatClass(killData.shipClass), vColX, 550, 4);
        }


        // --- KILLER COLUMN (Right Side) ---
        // Image is mesh, at X=35. Canvas mapping ~ X=1350
        const kColX = 1350;

        // Ship Name (Under Image)
        ctx.fillStyle = '#ccc'; ctx.font = 'bold 50px "Segoe UI"';
        drawText(killData.killerShip, kColX, 280, 5);
        
        // Killer Name
        ctx.fillStyle = '#4ade80'; // Green
        fitText(killData.killer, 500, "Segoe UI");
        drawText(truncateText(killData.killer, 500), kColX, 350, 5);

        // Corp
        if (isValidText(killData.killerCorp)) {
            ctx.fillStyle = '#aaa'; ctx.font = '40px "Segoe UI"';
            drawText(truncateText(killData.killerCorp, 500), kColX, 420, 4);
        }

        // Alliance
        if (isValidText(killData.killerAlliance)) {
             ctx.fillStyle = '#888'; ctx.font = '35px "Segoe UI"';
             drawText(truncateText(killData.killerAlliance, 500), kColX, 470, 4);
        }

        // Weapon
        if (isValidText(killData.finalBlowWeapon)) {
            ctx.fillStyle = '#666'; ctx.font = 'italic 35px "Segoe UI"';
            drawText(`Using: ${truncateText(killData.finalBlowWeapon, 400)}`, kColX, 550, 4);
        }
        
        // --- CENTER "KILLED" TEXT ---
        ctx.textAlign = 'center';
        ctx.font = '900 50px "Segoe UI"'; // Bump size slightly for "stand out" + outline space
        ctx.fillStyle = '#e5e5e5'; // Light Grey

        drawText("KILLED", centerX, 330, 6);
        drawText("BY", centerX, 380, 6);


        // --- FOOTER ---
        const footerY = height - 50;
        
        // Value (Bottom CENTERED)
        const isk = formatIsk(killData.rawVal);
        const iskNumber = isk.number;
        const engNotation = isk.suffix;
        const currencyLabel = " ISK";
        
        ctx.font = 'bold 100px monospace';
        const wNum = ctx.measureText(iskNumber).width;
        const wEng = ctx.measureText(engNotation).width;
        const wCur = ctx.measureText(currencyLabel).width;
        const totalW = wNum + wEng + wCur;
        const startX = (width / 2) - (totalW / 2);

        // Draw Number (Colored)
        ctx.textAlign = 'left';
        ctx.fillStyle = killColor; 
        drawText(iskNumber, startX, footerY, 8);
        
        // Draw Engineering Notation (WHITE)
        ctx.fillStyle = '#ffffff'; // White for 'b', 'm', etc.
        drawText(engNotation, startX + wNum, footerY, 8);

        // Draw Currency Label (Grey)
        ctx.fillStyle = '#666'; 
        drawText(currencyLabel, startX + wNum + wEng, footerY, 8);

        // Badge (Bottom RIGHT - Killer Side)
        if (killData.isSolo) {
             ctx.textAlign = 'right'; 
             ctx.fillStyle = '#3b82f6';
             ctx.font = 'bold 50px "Segoe UI"';
             drawText("SOLO KILL", width - contentX - 20, footerY - 15, 5);
        } else if (killData.isNpc) { // ADDED: Check if NPC kill
             ctx.textAlign = 'right';
             ctx.fillStyle = '#9ca3af'; // Grey for PvE
             ctx.font = 'bold 50px "Segoe UI"';
             drawText("PVE LOSS", width - contentX - 20, footerY - 15, 5);
        } else {
             ctx.textAlign = 'right'; 
             ctx.fillStyle = '#f59e0b';
             ctx.font = 'bold 50px "Segoe UI"';
             drawText(`${killData.attackersCount} PILOTS`, width - contentX - 20, footerY - 15, 5);
        }

        // --- MESH GENERATION ---
        const texture = new THREE.CanvasTexture(canvas);
        const geometry = new THREE.PlaneGeometry(80, 35); 
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthTest: false });
        
        // CARD ELEVATION AND STICK LOGIC
        const cardHeight = 60; 
        const cardMesh = new THREE.Mesh(geometry, material);
        cardMesh.position.set(0, cardHeight, 0); 
        cardMesh.renderOrder = 9999; 
        group.add(cardMesh);
        group.userData.cardMesh = cardMesh;
        
        const loader = new THREE.TextureLoader();

        // --- ROUNDED MESH HELPER ---
        const addRoundedImage = (url, x, y, size, borderColor) => {
             loader.load(url, (t) => {
                 // Create Shape with Rounded Corners
                 const shape = new THREE.Shape();
                 const s = size / 2; 
                 const r = size * 0.15; // 15% rounding radius for that "chiclet" look
                 
                 shape.moveTo(-s + r, s);
                 shape.lineTo(s - r, s);
                 shape.quadraticCurveTo(s, s, s, s - r);
                 shape.lineTo(s, -s + r);
                 shape.quadraticCurveTo(s, -s, s - r, -s);
                 shape.lineTo(-s + r, -s);
                 shape.quadraticCurveTo(-s, -s, -s, -s + r);
                 shape.lineTo(-s, s - r);
                 shape.quadraticCurveTo(-s, s, -s + r, s);
                 
                 const geom = new THREE.ShapeGeometry(shape);
                 
                 // Fix UVs manually so the image maps 0..1 across the shape
                 const pos = geom.attributes.position;
                 const uv = geom.attributes.uv;
                 for(let i=0; i<pos.count; i++){
                     const px = pos.getX(i);
                     const py = pos.getY(i);
                     uv.setXY(i, (px+s)/size, (py+s)/size);
                 }
                 
                 const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthTest: false });
                 const mesh = new THREE.Mesh(geom, mat);
                 mesh.position.set(x, y, 2);
                 mesh.renderOrder = 10000;
                 cardMesh.add(mesh);
                 
                 // Add Border Line Loop
                 const points = shape.getPoints();
                 const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                 const lineLoop = new THREE.LineLoop(lineGeo, new THREE.LineBasicMaterial({ color: borderColor, transparent: true, opacity: 0.8 }));
                 lineLoop.position.set(0,0,0.1); // Slightly in front of mesh
                 mesh.add(lineLoop);
             });
        };

        const addEmblem = (url, x, y, size) => {
             loader.load(url, (t) => {
                // Background Circle for contrast
                const bgGeo = new THREE.CircleGeometry((size/2) + 0.5, 32);
                const bgMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false });
                const bg = new THREE.Mesh(bgGeo, bgMat);
                bg.position.set(x, y, 2.4); 
                bg.renderOrder = 10001;
                cardMesh.add(bg);

                // Emblem Image
                const m = new THREE.Mesh(new THREE.CircleGeometry(size/2, 32), new THREE.MeshBasicMaterial({map:t, transparent:true, side:THREE.DoubleSide, depthTest:false}));
                m.position.set(x, y, 2.5); 
                m.renderOrder=10002; 
                cardMesh.add(m); 
            });
        };
        
        // --- SHIP ICONS (Top of Stacks) ---
        // Top flanking position: x = +/- 27.5, y = 11 (Moved up further)
        // VICTIM (Left) Size 10
        if(killData.shipId) addRoundedImage(`https://images.evetech.net/types/${killData.shipId}/icon?size=128`, -27.5, 11, 10, 0xef4444);

        // KILLER (Right) Size 10
        if(killData.killerShipId) addRoundedImage(`https://images.evetech.net/types/${killData.killerShipId}/icon?size=128`, 27.5, 11, 10, 0x4ade80);
        
        // --- EMBLEMS (Moved to inside of ship, towards center) ---
        // Ship x = +/- 27.5. Size 10. Inner edge ~ +/- 22.5.
        // We place emblems at +/- 18 to sit between ship and center line.
        
        // Victim Emblems (Left Side -> Move Right towards center)
        if(killData.victimAllianceId || killData.victimCorpId) {
             const emblem = getEmblemUrl(killData.victimAllianceId, killData.victimCorpId);
             if(emblem) addEmblem(emblem, -18, 11, 6); 
        }

        // Killer Emblems (Right Side -> Move Left towards center)
        if(killData.killerAllianceId || killData.killerCorpId) {
             const emblem = getEmblemUrl(killData.killerAllianceId, killData.killerCorpId);
             if(emblem) addEmblem(emblem, 18, 11, 6); 
        }

        // Stalk Line - Connects system center to card base (diagonal when fanned out)
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-fanOffset.x, 0, -fanOffset.z), // Anchor at system center (world)
            new THREE.Vector3(0, 42.5, 0)                     // Anchor at card base
        ]);
        const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: borderColor, transparent: true, opacity: 1.0, depthTest: false }));
        group.add(line);

        // Hover highlight — a rectangle outline slightly larger than the card.
        // Added as a child of cardMesh so it inherits flat/billboard orientation.
        // Card is PlaneGeometry(80, 35) → extents ±40 X, ±17.5 Y; highlight at ±41.5 X, ±18.5 Y.
        const hlPoints = [
            new THREE.Vector3(-41.5, -18.5, 0.6),
            new THREE.Vector3( 41.5, -18.5, 0.6),
            new THREE.Vector3( 41.5,  18.5, 0.6),
            new THREE.Vector3(-41.5,  18.5, 0.6),
        ];
        const hlGeo = new THREE.BufferGeometry().setFromPoints(hlPoints);
        const hlMat = new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.9, depthTest: false });
        const hlLoop = new THREE.LineLoop(hlGeo, hlMat);
        hlLoop.renderOrder = 10001;
        hlLoop.visible = false;
        cardMesh.add(hlLoop);
        group.userData.highlightLine = hlLoop;

        // Position group at system coords plus fan offset
        group.position.set(systemPos.x + fanOffset.x, systemPos.y, systemPos.z + fanOffset.z);
        return group;
    };

    const handleDoubleClick = async (event) => {
        event.preventDefault();
        // Calculate distance moved to detect drag vs double-click
        const dx = event.clientX - mouseDownRef.current.x;
        const dy = event.clientY - mouseDownRef.current.y;
        if (Math.sqrt(dx*dx + dy*dy) > 10) return; // Ignore drags

        if (!activeCameraRef.current || !containerRef.current || galaxyMeshesRef.current.length === 0) return;
        const rect = containerRef.current.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycasterRef.current.setFromCamera(mouseRef.current, activeCameraRef.current);

        const meshes = is2DRef.current ? galaxyMeshes2DRef.current : galaxyMeshesRef.current;
        if (is2DRef.current) {
            raycasterRef.current.params.Points.threshold = 6; // Match point radius for accurate detection
        }
        const intersects = raycasterRef.current.intersectObjects(meshes);

        if (intersects.length > 0) {
            const hit = intersects[0];
            let sysData = null;

            // --- FIX START: Handle Index Mismatch between 2D (Points) and 3D (InstancedMesh) ---
            if (is2DRef.current) {
                // In 2D, use the system list attached to the mesh (subset of all systems)
                if (hit.object.userData && hit.object.userData.systems) {
                    sysData = hit.object.userData.systems[hit.index];
                }
            } else {
                // In 3D, use the global reference list
                const instanceId = hit.instanceId ?? hit.index;
                sysData = systemsRef.current[instanceId];
            }
            // --- FIX END ---

            if (sysData) {
                activateInteractionLock();
                if (is2DRef.current && sysData.x2d !== undefined) {
                    targetControlsLookAt.current = new THREE.Vector3(sysData.x2d, 0, sysData.z2d);
                    targetCameraPos.current = new THREE.Vector3(sysData.x2d, 225, sysData.z2d + 225);
                } else {
                    targetControlsLookAt.current = new THREE.Vector3(sysData.x, sysData.y, sysData.z); // Look at the system
                    targetCameraPos.current = new THREE.Vector3(sysData.x + 80, sysData.y + 20, sysData.z + 80); // Position camera nearby
                }
                isAutoPiling.current = true;
                const regionInfo = regionMapRef.current.get(sysData.regionId);
                setSelectedSystem({ ...sysData, regionName: regionInfo?.name || 'Unknown Region' });
                setActiveKillId(null);
                if (card3DGroupRef.current) {
                    card3DGroupRef.current.clear();
                }
                activeCardRef.current = null;
                const intel = await fetchSystemIntel(sysData);
                setSystemIntel(intel);
            }
        }
    };

    const handleMouseDown = (event) => {
        mouseDownRef.current = { x: event.clientX, y: event.clientY };
    };

    const handleCanvasClick = async (event) => {
        // Calculate distance moved to detect drag vs click
        const dx = event.clientX - mouseDownRef.current.x;
        const dy = event.clientY - mouseDownRef.current.y;
        if (Math.sqrt(dx*dx + dy*dy) > 10) return; // Ignore drags (camera rotation/pan)

        if (!activeCameraRef.current || !containerRef.current || galaxyMeshesRef.current.length === 0) return;
        const rect = containerRef.current.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycasterRef.current.setFromCamera(mouseRef.current, activeCameraRef.current);
        
        // In 2D mode, check kill markers first for expand/collapse toggle
        if (is2DRef.current && recentKillsGroupRef.current?.children.length > 0) {
            const killMeshes = recentKillsGroupRef.current.children
                .filter(g => g.children[0])
                .map(g => g.children[0]);
            const killHits = raycasterRef.current.intersectObjects(killMeshes);
            if (killHits.length > 0) {
                const parentGroup = killHits[0].object.parent;
                const sysName = parentGroup?.userData?.systemName;
                if (sysName && parentGroup.userData.killCount > 1) {
                    toggleSystemExpanded(sysName);
                    return; // consume click, don't process system selection
                }
            }
        }

        const meshes = is2DRef.current ? galaxyMeshes2DRef.current : galaxyMeshesRef.current;
        if (is2DRef.current) {
            raycasterRef.current.params.Points.threshold = 6; // Match point radius for accurate detection
        }
        const intersects = raycasterRef.current.intersectObjects(meshes);

        if (intersects.length > 0) {
            const hit = intersects[0];
            let sysData = null;

            // --- FIX START ---
            if (is2DRef.current) {
                if (hit.object.userData && hit.object.userData.systems) {
                    sysData = hit.object.userData.systems[hit.index];
                }
            } else {
                const instanceId = hit.instanceId ?? hit.index;
                sysData = systemsRef.current[instanceId];
            }
            // --- FIX END ---

            if (sysData) {
                activateInteractionLock();
                const regionInfo = regionMapRef.current.get(sysData.regionId);
                setSelectedSystem({ ...sysData, regionName: regionInfo?.name || 'Unknown Region' });
                setActiveKillId(null);
                // Clear 3D card when clicking system directly
                if (card3DGroupRef.current) {
                    card3DGroupRef.current.clear();
                    cardsBySystemRef.current.clear(); flipAnimRef.current = null; hoveredKillCardGroupRef.current = null;
                }
                activeCardRef.current = null;
                const intel = await fetchSystemIntel(sysData);
                setSystemIntel(intel);
            }
        } else {
            setSelectedSystem(null);
            setSystemIntel(null);
            setActiveKillId(null);
            if (card3DGroupRef.current && !is2DRef.current) {
                card3DGroupRef.current.clear();
                activeCardRef.current = null;
            }
            isAutoPiling.current = false;
        }
    };

    const handlePointerMove = (event) => {
        if (!activeCameraRef.current || !containerRef.current || galaxyMeshesRef.current.length === 0) return;
        const rect = containerRef.current.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycasterRef.current.setFromCamera(mouseRef.current, activeCameraRef.current);

        // Re-enable zoom by default every frame; disabled below if hovering a multi-kill card
        if (controlsRef.current) controlsRef.current.enableZoom = true;

        // Check kill markers first (they're in front)
        if (recentKillsGroupRef.current && recentKillsGroupRef.current.children.length > 0) {
            // Get all meshes from kill marker groups (sphere is child[0])
            const killMeshes = recentKillsGroupRef.current.children
                .filter(g => g.children[0])
                .map(g => g.children[0]);
            const killIntersects = raycasterRef.current.intersectObjects(killMeshes);
            if (killIntersects.length > 0) {
                const hitMesh = killIntersects[0].object;
                const parentGroup = hitMesh.parent;
                if (parentGroup && parentGroup.userData && parentGroup.userData.killIds) {
                    const x = event.clientX - rect.left;
                    const y = event.clientY - rect.top;

                    hoveredKillSysRef.current = parentGroup.userData.systemName;

                    if (!hoveredKillMarker || hoveredKillMarker.systemName !== parentGroup.userData.systemName) {
                        setHoveredKillMarker({ ...parentGroup.userData, x, y });
                    } else if (tooltipRef.current) {
                        tooltipRef.current.style.left = x + 'px';
                        tooltipRef.current.style.top = (y + 15) + 'px';
                    }

                    // Pointer cursor hints that multi-kill markers are clickable to expand
                    if (containerRef.current) {
                        containerRef.current.style.cursor =
                            parentGroup.userData.killCount > 1 ? 'pointer' : 'default';
                    }

                    setHoveredSystem(null);
                    hoveredSystemRef.current = null;
                    return;
                }
            }
        }
        setHoveredKillMarker(null);

        // Check kill cards — the visible card plane is the scroll-to-cycle target
        let hoveredCard = false;
        if (is2DRef.current && card3DGroupRef.current.children.length > 0) {
            const cardMeshes = card3DGroupRef.current.children
                .filter(g => g.visible && g.userData?.cardMesh)
                .map(g => g.userData.cardMesh);
            if (cardMeshes.length > 0) {
                const cardHits = raycasterRef.current.intersectObjects(cardMeshes, false);
                if (cardHits.length > 0) {
                    const cardGroup = cardHits[0].object.parent;
                    const sysName = cardGroup?.userData?.systemName;
                    if (sysName) {
                        hoveredKillSysRef.current = sysName;
                        hoveredCard = true;
                        const entry = cardsBySystemRef.current.get(sysName);
                        const isMulti = entry && entry.kills.length > 1;

                        // Show highlight on this card; hide the previous one if different
                        if (hoveredKillCardGroupRef.current !== cardGroup) {
                            if (hoveredKillCardGroupRef.current?.userData?.highlightLine) {
                                hoveredKillCardGroupRef.current.userData.highlightLine.visible = false;
                            }
                            hoveredKillCardGroupRef.current = cardGroup;
                        }
                        if (cardGroup.userData.highlightLine) {
                            cardGroup.userData.highlightLine.visible = true;
                        }

                        if (isMulti) {
                            if (containerRef.current) containerRef.current.style.cursor = 'ns-resize';
                            if (controlsRef.current) controlsRef.current.enableZoom = false;
                            const cx = event.clientX - rect.left;
                            const cy = event.clientY - rect.top;
                            setHoveredKillCardTooltip({ x: cx, y: cy, count: entry.kills.length });
                        } else {
                            if (containerRef.current) containerRef.current.style.cursor = 'default';
                            setHoveredKillCardTooltip(null);
                        }
                    }
                }
            }
        }
        if (!hoveredCard) {
            // Hide highlight on the previously hovered card
            if (hoveredKillCardGroupRef.current?.userData?.highlightLine) {
                hoveredKillCardGroupRef.current.userData.highlightLine.visible = false;
            }
            hoveredKillCardGroupRef.current = null;
            hoveredKillSysRef.current = null;
            setHoveredKillCardTooltip(null);
            if (containerRef.current) containerRef.current.style.cursor = 'default';
        }

        // Then check system points
        const meshes = is2DRef.current ? galaxyMeshes2DRef.current : galaxyMeshesRef.current;
        if (is2DRef.current) {
            raycasterRef.current.params.Points.threshold = 6; // Match point radius for accurate detection
        }
        const intersects = raycasterRef.current.intersectObjects(meshes);

        if (intersects.length > 0) {
            const hit = intersects[0];
            let sysData = null;
            let instanceId = -1;

            // --- FIX START ---
            if (is2DRef.current) {
                if (hit.object.userData && hit.object.userData.systems) {
                    sysData = hit.object.userData.systems[hit.index];
                    // IMPORTANT: For hover effects in 2D, we cannot use the 3D 'instanceId' for matrix updates easily
                    // because the 2D mesh is Points, not InstancedMesh.
                    // We map back to the global instanceId if needed, or simply handle 2D hover differently.
                    if (sysData) {
                        instanceId = sysData.instanceIndex;
                    }
                }
            } else {
                instanceId = hit.instanceId ?? hit.index;
                sysData = systemsRef.current[instanceId];
            }
            // --- FIX END ---

            if (sysData) {
                // Pass instanceId (global index) so the 3D hover effect still works if we switch back
                const hovered = { ...sysData, instanceId, meshIndex: 0 };
                setHoveredSystem(hovered);
                hoveredSystemRef.current = hovered;
            } else { setHoveredSystem(null); hoveredSystemRef.current = null; }
        } else { setHoveredSystem(null); hoveredSystemRef.current = null; }
    };

    useEffect(() => { isHDRef.current = isHD; }, [isHD]);
    useEffect(() => { is2DRef.current = is2D; }, [is2D]);
    useEffect(() => { brightnessRef.current = brightness; }, [brightness]);
    
    // --- MODE SWITCH MEMORY ---
    const saved3DVisibilityRef = useRef({ hideAnoikis: true, hideKSpace: false, hideAbyssal: false });
    const saved2DVisibilityRef = useRef(null);
    const isFirstModeSwitchRef = useRef(true);

    // --- 2D MODE TOGGLE LOGIC ---
    useEffect(() => {
        if (isFirstModeSwitchRef.current) {
            isFirstModeSwitchRef.current = false;
            return;
        }

        if (is2D) {
            // Switching TO 2D
            // 1. Save current 3D state
            saved3DVisibilityRef.current = {
                hideAnoikis: hideAnoikisRef.current,
                hideKSpace: hideKSpaceRef.current,
                hideAbyssal: hideAbyssalRef.current,
                viewId: activeViewRef.current ? activeViewRef.current.id : 'kspace'
            };

            // 2. ALWAYS Default to K-Space only (Strategic View defaults)
            setHideKSpace(false);
            setHideAnoikis(true);
            setHideAbyssal(true);

            // 3. Trigger external filter reset (treat as K-Space view)
            if (typeof setMapMode === 'function') setMapMode('strategic');

            // 4. Apply 2D Home Position (animate camera to 2D view)
            const view2D = savedViews.find(v => v.id === 'strategic') || DEFAULT_VIEWS.find(v => v.is2D);
            if (view2D && view2D.pos && view2D.lookAt) {
                targetCameraPos.current = new THREE.Vector3(view2D.pos.x, view2D.pos.y, view2D.pos.z);
                targetControlsLookAt.current = new THREE.Vector3(view2D.lookAt.x, view2D.lookAt.y, view2D.lookAt.z);
                isAutoPiling.current = true;
            }
        } else {
            // Switching TO 3D
            // 1. Save current 2D state
            saved2DVisibilityRef.current = {
                hideAnoikis: hideAnoikisRef.current,
                hideKSpace: hideKSpaceRef.current,
                hideAbyssal: hideAbyssalRef.current
            };

            // 2. Default to New Eden (K-Space)
            setHideKSpace(false);
            setHideAnoikis(true);
            setHideAbyssal(true);
            
            // 3. Set map mode to kspace
            if (typeof setMapMode === 'function') {
                 setMapMode('kspace');
            }

            // 4. Apply Home Position (Reset Camera)
            const view = savedViews.find(v => v.id === 'kspace') || DEFAULT_VIEWS[0];
            if (view && view.pos && view.lookAt) {
                targetCameraPos.current = new THREE.Vector3(view.pos.x, view.pos.y, view.pos.z);
                targetControlsLookAt.current = new THREE.Vector3(view.lookAt.x, view.lookAt.y, view.lookAt.z);
                isAutoPiling.current = true;
            }
        }

        if (gridHelperRef.current) {
            gridHelperRef.current.visible = is2D;
        }

        // Update Kill Markers Positions for 2D/3D
        if (recentKillsGroupRef.current) {
            recentKillsGroupRef.current.children.forEach(group => {
                const sys = group.userData.systemData;
                if (sys) {
                    if (is2D && sys.x2d !== undefined) {
                        group.position.set(sys.x2d, 0, sys.z2d);
                    } else {
                        group.position.set(sys.x, sys.y, sys.z);
                    }
                }
            });
        }

        // Clear 3D Card if active when switching
        if (activeCardRef.current || card3DGroupRef.current.children.length > 0) {
             card3DGroupRef.current.clear();
             activeCardRef.current = null;
             // Don't clear activeKillId here, just the visual card, so state remains
        }
    }, [is2D, systemsLoaded]);


    // --- 2D MODE CAMERA CONTROLS ---
    useEffect(() => {
        const controls = controlsRef.current;
        const camera = perspectiveCamRef.current;
        if (!controls || !camera) return;

        if (is2D && layoutMode === 'MAP') {
            // Entering FLAT mode: go to FLAT home position
            const flatHome = homeStatesRef.current.flatMode2D;
            targetCameraPos.current = flatHome.pos.clone();
            targetControlsLookAt.current = flatHome.lookAt.clone();
            isAutoPiling.current = true;

            // Lock controls for flat mode - straight down view
            controls.enableRotate = false;
            controls.minPolarAngle = 0; // Lock to top-down view
            controls.maxPolarAngle = 0; // Lock to top-down view
            controls.minAzimuthAngle = 0; // Lock horizontal rotation
            controls.maxAzimuthAngle = 0; // Lock horizontal rotation
            controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
        } else if (is2D) {
            // Returning to REG mode: go to REG home position
            const regHome = homeStatesRef.current.regMode2D;
            targetCameraPos.current = regHome.pos.clone();
            targetControlsLookAt.current = regHome.lookAt.clone();
            isAutoPiling.current = true;

            // REG mode: allow rotation but prevent going below map plane
            controls.enableRotate = true;
            controls.minPolarAngle = 0;
            controls.maxPolarAngle = Math.PI / 2;
            controls.minAzimuthAngle = -Infinity; // Allow free horizontal rotation
            controls.maxAzimuthAngle = Infinity;
            controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
        } else {
            // 3D: allow full rotation
            controls.enableRotate = true;
            controls.minPolarAngle = 0;
            controls.maxPolarAngle = Math.PI;
            controls.minAzimuthAngle = -Infinity; // Allow free horizontal rotation
            controls.maxAzimuthAngle = Infinity;
            controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
        }
    }, [is2D, layoutMode]);

    // --- PERFORMANCE: PIXEL RATIO HANDLER ---
    useEffect(() => {
        if (rendererRef.current && containerRef.current) {
            const pr = isHD ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 1.5);
            rendererRef.current.setPixelRatio(pr);
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;
            rendererRef.current.setSize(w, h);
            if (composerRef.current) composerRef.current.setSize(w, h);
        }
    }, [isHD]);

    const handleClearCards = () => {
        if (card3DGroupRef.current) {
            card3DGroupRef.current.clear();
            activeCardRef.current = null;
        }
        setActiveKillId(null);
    };

    // --- SCROLL PRESERVATION LOGIC ---
    useLayoutEffect(() => {
        const el = feedScrollRef.current;
        if (!el) return;
        
        // If we were at the top, STAY at the top (scrollTop = 0)
        // Otherwise, the browser's scroll anchoring usually keeps the visible items in place,
        // effectively increasing scrollTop. We assume that's desired behavior for non-top positions.
        if (wasAtTopRef.current) {
            el.scrollTop = 0;
        }
    }, [formattedKillFeed]);

    const handleFeedScroll = (e) => {
        // Allow some tolerance (e.g. 10px) to consider "at top"
        wasAtTopRef.current = e.target.scrollTop < 10;
    };

    // --- FEED CONTEXT MENU HANDLER ---
    const handleFeedContextMenu = (e, kill) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenSubmenu(null);
        // Position menu to the left of cursor (menu is ~200px wide)
        const menuWidth = 200;
        const x = Math.max(10, e.clientX - menuWidth);
        setFeedContextMenu({ x, y: e.clientY, kill });
    };

    // Close feed context menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (feedMenuRef.current && !feedMenuRef.current.contains(e.target)) {
                setFeedContextMenu(null);
            }
        };
        if (feedContextMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [feedContextMenu]);

    const openLink = (url) => {
        window.open(url, '_blank', 'noopener,noreferrer');
        setFeedContextMenu(null);
    };

    useEffect(() => {
        if (!containerRef.current || isInitializedRef.current) return;
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        if (width === 0 || height === 0) { setTimeout(() => setInitAttempt(prev => prev + 1), 200); return; }
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) { setTimeout(() => setInitAttempt(prev => prev + 1), 200); return; }

        isInitializedRef.current = true;
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x050505, FOG_DENSITY);
        const pCam = new THREE.PerspectiveCamera(60, width / height, 0.1, FAR_DISTANCE);
        if (is2DRef.current) {
            pCam.position.set(0, 1700, 0);
            pCam.lookAt(0, 0, 0);
        } else {
            pCam.position.copy(homeStatesRef.current.default.pos); pCam.lookAt(homeStatesRef.current.default.lookAt);
        }
        perspectiveCamRef.current = pCam; activeCameraRef.current = pCam;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height); 
        renderer.setPixelRatio(isHDRef.current ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 1.5));
        renderer.toneMapping = THREE.ReinhardToneMapping;
        containerRef.current.appendChild(renderer.domElement); rendererRef.current = renderer;
        const controls = new OrbitControls(pCam, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 10; controls.maxDistance = 3500; controls.autoRotate = false;
        controls.zoomSpeed = 1.3; // Increased scroll speed
        if (is2DRef.current) {
            controls.target.set(0, 0, 0);
            if (layoutModeRef.current === 'MAP') {
                // MAP mode: locked top-down
                controls.enableRotate = false;
                controls.minPolarAngle = Math.PI / 2;
                controls.maxPolarAngle = Math.PI / 2;
                controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
            } else {
                // REG mode: allow rotation
                controls.maxPolarAngle = Math.PI / 2;
                controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
            }
        } else {
            controls.target.copy(homeStatesRef.current.default.lookAt);
        }
        controlsRef.current = controls;
        controls.addEventListener('start', () => { 
            resetIdleTimer();
            // Always disable auto-piling on user interaction to prevent fighting
            isAutoPiling.current = false;
        });
        renderer.domElement.addEventListener('mousedown', handleMouseDown);
        renderer.domElement.addEventListener('click', handleCanvasClick);
        // Scroll over a hovered kill card to cycle through stacked kills (animated flip)
        const handleWheel = (e) => {
            if (!is2DRef.current || !hoveredKillSysRef.current) return;
            const entry = cardsBySystemRef.current.get(hoveredKillSysRef.current);
            if (!entry || entry.kills.length <= 1) return;
            e.preventDefault();
            e.stopPropagation();
            if (flipAnimRef.current) return; // ignore scroll while a flip is running
            const direction = e.deltaY > 0 ? 1 : -1;
            const targetIdx = (entry.primaryIdx + direction + entry.kills.length) % entry.kills.length;
            flipAnimRef.current = { entry, targetIdx, direction, phase: 'out', startTime: performance.now() };
        };
        renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
        const renderScene = new RenderPass(scene, pCam); renderPassRef.current = renderScene;
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.1, 0.2, 0.1);
        
        // HDR render target for bloom post-processing.
        // No samples here — antialias is handled by the WebGLRenderer (antialias: true above).
        // MSAA on a render target uses immutable GL storage that cannot be resized, causing
        // GL_INVALID_OPERATION errors when the composer is resized.
        const renderTarget = new THREE.WebGLRenderTarget(width, height, {
            type: THREE.HalfFloatType,
            format: THREE.RGBAFormat,
        });
        
        const composer = new EffectComposer(renderer, renderTarget); composerRef.current = composer;
        composer.addPass(renderScene); 
        composer.addPass(bloomPass);
        composer.addPass(new OutputPass()); // Tone Mapping & Color Space

        const bgGeo = new THREE.BufferGeometry();
        const bgCount = 30000; // Increased for Desktop
        const bgPos = new Float32Array(bgCount*3);
        const bgCol = new Float32Array(bgCount*3);
        for(let i=0; i<bgCount; i++) {
            const i3 = i*3; const r = 4000 + Math.random() * 4000; const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1);
            bgPos[i3] = r * Math.sin(phi) * Math.cos(theta); bgPos[i3+1] = r * Math.sin(phi) * Math.sin(theta); bgPos[i3+2] = r * Math.cos(phi);
            const s = 0.3 + Math.random() * 0.7; bgCol[i3]=s; bgCol[i3+1]=s; bgCol[i3+2]=s;
        }
        bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos,3));
        bgGeo.setAttribute('color', new THREE.BufferAttribute(bgCol,3));
        const starMaterial = new THREE.PointsMaterial({ size: 3, vertexColors: true });
        starMaterialRef.current = starMaterial;
        starMaterial.onBeforeCompile = (shader) => { shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nvec2 cxy = 2.0 * gl_PointCoord - 1.0; if (dot(cxy, cxy) > 1.0) discard;'); };
        scene.add(new THREE.Points(bgGeo, starMaterial));

        // --- TACTICAL GRID (2D Mode) ---
        const gridHelper = new THREE.GridHelper(3000, 60, 0x333333, 0x111111);
        gridHelper.position.y = -10; // Slightly below stars
        gridHelper.visible = false;
        scene.add(gridHelper);
        gridHelperRef.current = gridHelper;

        // --- PROCEDURAL DISTANT GALAXIES ---
        // Seeded RNG for consistent galaxy generation
        let seed = 12345;
        const sRandom = () => {
            const x = Math.sin(seed++) * 10000;
            return x - Math.floor(x);
        };

        const galaxyCount = 6;
        const galaxyTexture = getCloudTexture(); // Reuse texture

        for(let i=0; i<galaxyCount; i++) {
            const angle = (i / galaxyCount) * Math.PI * 2;
            const dist = FAR_DISTANCE * 0.75; // Keep them in background
            const gx = Math.cos(angle) * dist;
            const gz = Math.sin(angle) * dist;
            const gy = (sRandom() - 0.5) * 4000;
            
            const gPCount = 2000;
            const gPos = new Float32Array(gPCount*3);
            const gCol = new Float32Array(gPCount*3);
            
            // Galaxy parameters
            const arms = 2 + Math.floor(sRandom() * 3); // 2-4 arms
            const armSpread = 0.8;
            const coreColor = new THREE.Color().setHSL(sRandom(), 0.8, 0.6);
            const armColor = new THREE.Color().setHSL(sRandom(), 0.6, 0.4);

            for(let j=0; j<gPCount; j++) {
                // Distribution: dense core, sparse edges
                const t = sRandom();
                const r = Math.pow(t, 2) * 800; // Radius up to 800
                
                // Spiral equation
                const spin = r * 0.003;
                const armId = Math.floor(sRandom() * arms);
                const armAngle = (armId / arms) * Math.PI * 2;
                const theta = spin + armAngle + (sRandom() - 0.5) * armSpread;

                const x = r * Math.cos(theta);
                const y = (sRandom() - 0.5) * (r * 0.15 + 20); // Flattened disk
                const z = r * Math.sin(theta);

                gPos[j*3] = x;
                gPos[j*3+1] = y;
                gPos[j*3+2] = z;

                // Color gradient from core to edge
                const mix = Math.sqrt(r / 800);
                const c = new THREE.Color().lerpColors(coreColor, armColor, mix);
                // Add noise
                c.r += (sRandom() - 0.5) * 0.1;
                c.g += (sRandom() - 0.5) * 0.1;
                c.b += (sRandom() - 0.5) * 0.1;

                gCol[j*3] = c.r;
                gCol[j*3+1] = c.g;
                gCol[j*3+2] = c.b;
            }
            
            const gGeo = new THREE.BufferGeometry();
            gGeo.setAttribute('position', new THREE.BufferAttribute(gPos,3));
            gGeo.setAttribute('color', new THREE.BufferAttribute(gCol,3));
            
            const gMat = new THREE.PointsMaterial({
                size: 20, 
                map: galaxyTexture, 
                vertexColors: true, 
                transparent: true, 
                opacity: 0.3, 
                blending: THREE.AdditiveBlending, 
                depthWrite: false,
                fog: false
            });

            const gMesh = new THREE.Points(gGeo, gMat);
            gMesh.position.set(gx, gy, gz); 
            gMesh.rotation.set(sRandom() * Math.PI, sRandom() * Math.PI, sRandom() * Math.PI);
            gMesh.scale.setScalar(1 + sRandom());
            scene.add(gMesh);
        }

        // --- FILAMENT BRIDGE (K-Space <-> Abyssal <-> Anoikis) ---
        const bridgeCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),       // K-Space Center
            new THREE.Vector3(0, -100, 0),
            new THREE.Vector3(0, -200, 0),   // Abyssal Zone (Apex)
            new THREE.Vector3(0, -300, 0),
            new THREE.Vector3(0, -550, 0)     // Anoikis Top
        ]);
        bridgeCurveRef.current = bridgeCurve;
        
        const bridgeGeo = new THREE.BufferGeometry();
        const bridgeCount = 8000;
        const bridgePos = new Float32Array(bridgeCount * 3);
        const bridgeCol = new Float32Array(bridgeCount * 3);
        
        const c1 = new THREE.Color(0x3b82f6); // Abyssal Blue
        const c2 = new THREE.Color(0xef4444); // Triglavian Red
        
        for(let i=0; i<bridgeCount; i++) {
            const t = Math.random();
            const pt = bridgeCurve.getPoint(t);
            
            // Funnel effect: Wide at ends (t=0, t=1), narrow in middle (t=0.5)
            // Spreads out to cover more systems at the clusters, condenses in the bridge
            const distFromCenter = Math.abs(t - 0.5);
            const spread = 15 + Math.pow(distFromCenter * 2, 2.5) * 450; 
            
            const r = Math.sqrt(Math.random()) * spread;
            const theta = Math.random() * Math.PI * 2;
            
            bridgePos[i*3] = pt.x + r * Math.cos(theta);
            bridgePos[i*3+1] = pt.y + (Math.random() - 0.5) * 20;
            bridgePos[i*3+2] = pt.z + r * Math.sin(theta);
            
            const c = Math.random() > 0.5 ? c1 : c2;
            // Fade out at the ends to avoid cluttering the view
            const alpha = 0.1 + Math.pow(Math.sin(t * Math.PI), 2) * 0.9;
            
            bridgeCol[i*3] = c.r * alpha + (Math.random()-0.5)*0.05;
            bridgeCol[i*3+1] = c.g * alpha + (Math.random()-0.5)*0.05;
            bridgeCol[i*3+2] = c.b * alpha + (Math.random()-0.5)*0.05;
        }
        
        bridgeGeo.setAttribute('position', new THREE.BufferAttribute(bridgePos, 3));
        bridgeGeo.setAttribute('color', new THREE.BufferAttribute(bridgeCol, 3));
        
        const bridgeMat = new THREE.PointsMaterial({ size: 3, vertexColors: true, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
        
        // Add distance fading to bridge particles to prevent clutter when close
        bridgeMat.onBeforeCompile = (shader) => {
            shader.vertexShader = `
                varying float vDistAlpha;
                ${shader.vertexShader}
            `.replace('#include <fog_vertex>', `
                #include <fog_vertex>
                float d = length(mvPosition.xyz);
                vDistAlpha = smoothstep(200.0, 1000.0, d);
            `);
            shader.fragmentShader = `
                varying float vDistAlpha;
                ${shader.fragmentShader}
            `.replace('#include <color_fragment>', `
                #include <color_fragment>
                diffuseColor.a *= vDistAlpha;
            `);
        };

        const bridgeMesh = new THREE.Points(bridgeGeo, bridgeMat);
        scene.add(bridgeMesh);
        bridgeGroupRef.current = bridgeMesh;

        // --- ABYSSAL TURBULENCE (HD) ---
        const abyssalGeo = new THREE.BufferGeometry();
        const abyssalCount = 400;
        const abyssalPos = new Float32Array(abyssalCount * 3);
        const abyssalCol = new Float32Array(abyssalCount * 3);
        const cRed = new THREE.Color(0xaa0000);
        const cBlack = new THREE.Color(0x111111);
        
        for(let i=0; i<abyssalCount; i++) {
            const r = Math.random() * 60; // Slightly larger than system spread
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            abyssalPos[i*3] = ABYSSAL_ZONE.x + r * Math.sin(phi) * Math.cos(theta);
            abyssalPos[i*3+1] = ABYSSAL_ZONE.y + r * Math.sin(phi) * Math.sin(theta);
            abyssalPos[i*3+2] = ABYSSAL_ZONE.z + r * Math.cos(phi);
            
            const mix = Math.random();
            const c = new THREE.Color().lerpColors(cBlack, cRed, mix);
            abyssalCol[i*3] = c.r; abyssalCol[i*3+1] = c.g; abyssalCol[i*3+2] = c.b;
        }
        abyssalGeo.setAttribute('position', new THREE.BufferAttribute(abyssalPos, 3));
        abyssalGeo.setAttribute('color', new THREE.BufferAttribute(abyssalCol, 3));
        
        const abyssalMat = new THREE.PointsMaterial({
            size: 40,
            map: getCloudTexture(),
            vertexColors: true,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const abyssalMesh = new THREE.Points(abyssalGeo, abyssalMat);
        abyssalMesh.visible = false;
        scene.add(abyssalMesh);
        abyssalEffectRef.current = abyssalMesh;

        // --- TRAFFIC PARTICLES ---
        const trafficCount = 500; // Increased buffer for batches
        const trafficGeo = new THREE.BufferGeometry();
        const trafficPos = new Float32Array(trafficCount * 3);
        trafficPos.fill(99999); // Initialize off-screen
        trafficGeo.setAttribute('position', new THREE.BufferAttribute(trafficPos, 3));
        const trafficMat = new THREE.PointsMaterial({ size: 15, color: 0xaaddff, map: getCloudTexture(), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
        const trafficMesh = new THREE.Points(trafficGeo, trafficMat);
        trafficMesh.frustumCulled = false; // IMPORTANT: Prevent culling since points move in/out of view
        scene.add(trafficMesh);
        trafficMeshRef.current = trafficMesh;

        scene.add(labelGroupRef.current); scene.add(regionLabelGroupRef.current); // ADDED REGION LABELS
        scene.add(card3DGroupRef.current); scene.add(recentKillsGroupRef.current);
        scene.add(anoikisVisualsRef.current);
        scene.add(drifterVisualsRef.current);

        // Create 2D hover indicator (animated ring) - sized to match point size
        const hoverRingGeo = new THREE.RingGeometry(8, 10, 32);
        const hoverRingMat = new THREE.MeshBasicMaterial({
            color: 0x4ade80,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthTest: false
        });
        const hoverRing = new THREE.Mesh(hoverRingGeo, hoverRingMat);
        hoverRing.rotation.x = -Math.PI / 2; // Lay flat
        hoverRing.visible = false;
        scene.add(hoverRing);
        hover2DIndicatorRef.current = hoverRing;

        const sunGeo = new THREE.SphereGeometry(SYSTEM_RADIUS*2, 32, 32);
        const sunMat = new THREE.MeshStandardMaterial({ emissive: 0xffaa00, emissiveIntensity: 1.5, color:0x000000 });
        const sun = new THREE.Mesh(sunGeo, sunMat);
        const detailSys = new THREE.Group(); detailSys.add(sun); detailSys.add(new THREE.PointLight(0xffaa00, 1.5, 100));
        detailSys.visible = false; solarSystemGroupRef.current = detailSys; scene.add(detailSys);



        const animStartTime = performance.now();
        let frameCount = 0;
        const LABEL_UPDATE_INTERVAL = 6; // Update labels every 6 frames (~10Hz at 60fps)
        const dummy = new THREE.Object3D(); // Reusable object for matrix updates to reduce GC

        const animate = () => {
            const time = (performance.now() - animStartTime) / 1000;
            const now = Date.now();
            const controls = controlsRef.current;
            const activeCam = activeCameraRef.current;
            frameCount++;

            // --- UPDATE ANOIKIS SYSTEMS (ROTATION & VISIBILITY) - 3D ONLY ---
            // We need to update visibility even if not in HD mode
            if (anoikisRotatorIndicesRef.current.length > 0 && systemsRef.current.length > 0) {
                const mesh = galaxyMeshesRef.current[0];
                if (mesh) {
                    const shouldRotate = isHDRef.current;
                    const currentRot = time * 0.05;

                    anoikisRotatorIndicesRef.current.forEach(idx => {
                        const sys = systemsRef.current[idx];
                        if (!sys || !sys.anoikisData) return;
                        const ad = sys.anoikisData;

                        // Only calculate new position if rotating (HD mode)
                        if (shouldRotate) {
                            const rAngle = ad.angle + (currentRot * ad.speed);
                            sys.x = ANOIKIS_ZONE.x + Math.cos(rAngle) * ad.dist + ad.localX;
                            sys.z = ANOIKIS_ZONE.z + Math.sin(rAngle) * ad.dist + ad.localZ;
                            sys.y = ad.startY + ad.localY;
                        }

                        dummy.position.set(sys.x, sys.y, sys.z);
                        // Apply visibility based on hideAnoikis AND 2D mode (hide in 2D)
                        dummy.scale.setScalar((hideAnoikisRef.current || is2DRef.current) ? 0 : 1);
                        dummy.updateMatrix();
                        mesh.setMatrixAt(idx, dummy.matrix);
                    });
                    mesh.instanceMatrix.needsUpdate = true;
                }
            }

            // Rotate Anoikis Labels (Hide if hideAnoikis is true)
            if (isHDRef.current) {
                regionLabelGroupRef.current.children.forEach(label => {
                    if (label.userData && label.userData.anoikisData) {
                        const ad = label.userData.anoikisData;
                        const rAngle = ad.angle + (time * 0.05 * ad.speed);
                        label.position.x = ANOIKIS_ZONE.x + Math.cos(rAngle) * ad.dist;
                        label.position.z = ANOIKIS_ZONE.z + Math.sin(rAngle) * ad.dist;
                    }
                });

                // Update Anoikis Vortex Shader Time
                if (anoikisFlowRef.current && anoikisFlowRef.current.visible) {
                    anoikisFlowRef.current.material.uniforms.uTime.value = time;
                }
            }

            // Update 2D Points Animation Time
            if (is2DRef.current && galaxyMeshes2DRef.current) {
                galaxyMeshes2DRef.current.forEach(mesh => {
                    if (mesh.material && mesh.material.userData && mesh.material.userData.shader) {
                        mesh.material.userData.shader.uniforms.time.value = time;
                    }
                });
            }


            // 2. Abyssal Animation (Procedural Appearance) - Always run to keep positions updated
            const activeAbyssalIds = new Set();
            if (recentKillsGroupRef.current) {
                recentKillsGroupRef.current.children.forEach(g => {
                    if (g.userData?.systemData?.regionId === '12000001') {
                        activeAbyssalIds.add(g.userData.systemData.id);
                    }
                });
            }

            if (isHDRef.current) {
                const mesh = galaxyMeshesRef.current[0];
                const totalSys = systemsRef.current.length;
                for (let i = 0; i < ABYSSAL_SYSTEM_COUNT; i++) {
                    const idx = totalSys - ABYSSAL_SYSTEM_COUNT + i;
                    const sys = systemsRef.current[idx];
                    if (sys && sys.regionId === '12000001') {
                        // Reset to base position (no rotation)
                        sys.x = sys.baseX;
                        sys.y = sys.baseY;
                        sys.z = sys.baseZ;

                        let scale = 0;
                        
                        if (activeAbyssalIds.has(sys.id)) {
                            // Has active kill: Visible and pulsing slightly
                            scale = 1.0 + Math.sin(time * 2 + i) * 0.1;
                        } else {
                            // Procedural appearance (Blinking / Breathing)
                            // Slower, more active (1-2 per second feel)
                            const freq = 0.2 + (i % 5) * 0.1; 
                            const offset = i * 132.5;
                            const wave = Math.sin(time * freq + offset);
                            if (wave > 0.0) scale = wave; // Visible for half the cycle
                        }

                        if (hideAbyssalRef.current || is2DRef.current) scale = 0; // Hide in 2D

                        dummy.position.set(sys.x, sys.y, sys.z);
                        dummy.scale.setScalar(scale);
                        dummy.updateMatrix();
                        if (mesh) mesh.setMatrixAt(idx, dummy.matrix);
                    }
                }
                if (mesh) mesh.instanceMatrix.needsUpdate = true;
            }

            // --- ABYSSAL EFFECT ANIMATION ---
            if (abyssalEffectRef.current) {
                abyssalEffectRef.current.visible = isHDRef.current && !hideAbyssalRef.current;
                if (isHDRef.current) {
                    abyssalEffectRef.current.rotation.y = time * 0.05;
                    abyssalEffectRef.current.rotation.z = Math.sin(time * 0.1) * 0.1;
                    abyssalEffectRef.current.material.opacity = 0.2 + Math.sin(time * 2) * 0.1;
                }
            }

            // Update Drifter Visuals (Pulse Animation)
            if (drifterVisualsRef.current) {
                drifterVisualsRef.current.visible = isHDRef.current && !hideAnoikisRef.current && !is2DRef.current;
                if (drifterVisualsRef.current.visible) {
                    drifterVisualsRef.current.children.forEach(sprite => {
                        if (sprite.isSprite) {
                            const ud = sprite.userData;
                            // Calmer pulse
                            const pulse = 1 + Math.sin(time * 3 + ud.phase) * 0.1;
                            sprite.scale.setScalar(ud.baseScale * pulse);
                            sprite.material.opacity = 0.7 + Math.sin(time * 2 + ud.phase) * 0.2;
                        }
                    });
                    
                    // Animate Drifter Particles
                    if (drifterParticlesRef.current) {
                        drifterParticlesRef.current.rotation.y += 0.001; // Slow spin, other way
                        // Jitter is handled by shader or simple rotation for performance
                    }
                }
            }

            // --- TRAFFIC ANIMATION (CAPSULEER BLIPS) ---
            if (trafficMeshRef.current) {
                trafficMeshRef.current.visible = isHDRef.current && !is2DRef.current;
                
                if (isHDRef.current && kSpaceSystemsRef.current.length > 0 && anoikisSystemsRef.current.length > 0) {
                const positions = trafficMeshRef.current.geometry.attributes.position.array;
                const traffic = trafficRef.current;
                const maxParticles = positions.length / 3;
                const nowTime = time;
                
                // Spawn Logic: Random intervals and batches
                if (nowTime > nextTrafficSpawnRef.current) {
                    // Schedule next spawn (variable delay: short burst or long pause)
                    const isBurst = Math.random() < 0.4; // 40% chance of short delay
                    const delay = isBurst ? (0.1 + Math.random() * 0.8) : (2.0 + Math.random() * 8.0);
                    nextTrafficSpawnRef.current = nowTime + delay;

                    // Determine batch size (1-3 ships)
                    const batchSize = Math.floor(Math.random() * 3) + 1;
                    const dir = Math.random() > 0.5 ? 1 : -1;

                    // Pick Random Endpoints
                    const kSys = kSpaceSystemsRef.current[Math.floor(Math.random() * kSpaceSystemsRef.current.length)];
                    const aSys = anoikisSystemsRef.current[Math.floor(Math.random() * anoikisSystemsRef.current.length)];

                    if (kSys && aSys) {
                        // Create unique flight path passing through the bridge funnel
                        const path = new THREE.CatmullRomCurve3([
                            new THREE.Vector3(kSys.x, kSys.y, kSys.z),
                            new THREE.Vector3(0, -100, 0),   // Bridge Entry
                            new THREE.Vector3(0, -200, 0),  // Bridge Apex (Abyssal)
                            new THREE.Vector3(0, -300, 0),  // Bridge Exit
                            new THREE.Vector3(aSys.x, aSys.y, aSys.z)
                        ]);

                        for(let b=0; b<batchSize; b++) {
                            if (traffic.length < maxParticles) {
                                traffic.push({
                                    t: dir === 1 ? 0 : 1,
                                    speed: 0.002 + Math.random() * 0.003, // Variable speed
                                    dir: dir,
                                    curve: path
                                });
                            }
                        }
                    }
                }

                let activeCount = 0;
                for (let i = traffic.length - 1; i >= 0; i--) {
                    const p = traffic[i];
                    p.t += p.speed * p.dir;
                    if (p.t < 0 || p.t > 1) {
                        traffic.splice(i, 1); // Remove if finished
                        continue;
                    }
                    
                    const point = p.curve.getPoint(p.t);
                    if (point && isValidNumber(point.x) && isValidNumber(point.y) && isValidNumber(point.z)) {
                        positions[activeCount * 3] = point.x;
                        positions[activeCount * 3 + 1] = point.y;
                        positions[activeCount * 3 + 2] = point.z;
                        activeCount++;
                    }
                }
                
                // Hide unused points by moving them far away
                for (let i = activeCount; i < maxParticles; i++) {
                    positions[i * 3] = 99999;
                    positions[i * 3 + 1] = 99999;
                    positions[i * 3 + 2] = 99999;
                }
                trafficMeshRef.current.geometry.attributes.position.needsUpdate = true;
            }
            }

            // --- CAMERA TRACKING LOGIC ---
            let trackingSys = null;
            if (!is2DRef.current && activeKillIdRef.current && shouldTrackActiveKillRef.current) {
                const k = killFeedRef.current.find(k => k.id === activeKillIdRef.current);
                if (k) trackingSys = systemMapRef.current.get(k.systemId);
            } else if (!is2DRef.current && selectedSystemRef.current) {
                trackingSys = systemMapRef.current.get(selectedSystemRef.current.id);
            }

            if (trackingSys) {
                const currPos = new THREE.Vector3(trackingSys.x, trackingSys.y, trackingSys.z);
                // Handle Pochven Animation Position override
                if (pochvenAnimRef.current.active) {
                    const animData = pochvenAnimRef.current.systemMap.get(trackingSys.id);
                    if (animData?.currentPos) currPos.copy(animData.currentPos);
                }

                // Calculate movement delta since last frame
                const delta = new THREE.Vector3();
                if (lastTrackedSysIdRef.current === trackingSys.id) {
                    delta.subVectors(currPos, lastTrackedPosRef.current);
                }

                if (isAutoPiling.current) {
                    // Update targets to follow the system
                    if (targetControlsLookAt.current) targetControlsLookAt.current.add(delta);
                    if (targetCameraPos.current) targetCameraPos.current.add(delta);
                } else {
                    // Manual Mode: "Ride" the system + Lock Target
                    // 1. Move camera and target with the system (Riding)
                    if (activeCam) activeCam.position.add(delta);
                    if (controls) controls.target.add(delta);

                    // 2. Force target to system center (Locking)
                    // This prevents panning away and ensures rotation is around the object
                    const lockTarget = currPos.clone();
                    if (activeKillIdRef.current) lockTarget.y += 30;
                    if (controls) controls.target.lerp(lockTarget, 0.2);
                }
                
                lastTrackedSysIdRef.current = trackingSys.id;
                lastTrackedPosRef.current.copy(currPos);
            } else {
                lastTrackedSysIdRef.current = null;
            }

            requestAnimationFrame(animate); 
            if (controls) controls.update();
            if (composer.passes.length>0) composer.passes[0].camera = activeCam;
            if(activeCam === pCam) {
                let closest = 9999, cSys = null;
                const check = []; MAJOR_HUBS.forEach(h => { const s = systemMapRef.current.get(h); if(s) check.push(s); });
                
                // Animate Bridge Pulse
                if (bridgeGroupRef.current) {
                    bridgeGroupRef.current.visible = !hideAbyssalRef.current && !is2DRef.current;
                    if (isHDRef.current) {
                        bridgeGroupRef.current.material.opacity = 0.25 + Math.sin(time * 1.5) * 0.1;
                    } else {
                        bridgeGroupRef.current.material.opacity = 0.25;
                    }
                }

                killFeedRef.current.forEach(k => { const s = systemMapRef.current.get(k.system); if(s) check.push(s); });
                check.forEach(s => { const d = activeCam.position.distanceTo(new THREE.Vector3(s.x, s.y, s.z)); if(d<closest) { closest = d; cSys = s; } });
                if(cSys && closest < 50 && !is2DRef.current) { solarSystemGroupRef.current.visible = true; solarSystemGroupRef.current.position.set(cSys.x, cSys.y, cSys.z); } else solarSystemGroupRef.current.visible = false;
            } else solarSystemGroupRef.current.visible = false;

            if(isAutoPiling.current && targetCameraPos.current && activeCam === pCam) {
                activeCam.position.lerp(targetCameraPos.current, 0.05);
                if (controls) controls.target.lerp(targetControlsLookAt.current, 0.05);
                if(activeCam.position.distanceTo(targetCameraPos.current) < 0.5) {
                    activeCam.position.copy(targetCameraPos.current);
                    if (controls) controls.target.copy(targetControlsLookAt.current);
                    isAutoPiling.current = false;
                }
            }
            
            // Kill card flip animation (scroll-to-cycle)
            if (flipAnimRef.current) {
                const flip = flipAnimRef.current;
                const PHASE_MS = 120; // ms per phase; total flip = 240 ms
                const elapsed = performance.now() - flip.startTime;
                const t = Math.min(1, elapsed / PHASE_MS);

                if (flip.phase === 'out') {
                    const outCard = flip.entry.cards[flip.entry.primaryIdx];
                    const cm = outCard?.userData?.cardMesh;
                    if (cm) {
                        cm.scale.x = 1 - t;
                        cm.position.x = t * 40 * flip.direction; // slide out in scroll direction
                    }
                    if (t >= 1) {
                        // Reset outgoing card (it will be hidden by collapseToStack)
                        if (cm) { cm.scale.x = 1; cm.position.x = 0; }
                        flip.entry.primaryIdx = flip.targetIdx;
                        flip.entry.expanded = false;
                        collapseToStack(flip.entry);
                        activeCardRef.current = flip.entry.cards[flip.entry.primaryIdx];
                        flip.phase = 'in';
                        flip.startTime = performance.now();
                        // Prime the incoming card at scale 0, offset from opposite side
                        const inCard = flip.entry.cards[flip.entry.primaryIdx];
                        const inCm = inCard?.userData?.cardMesh;
                        if (inCm) { inCm.scale.x = 0; inCm.position.x = -40 * flip.direction; }
                    }
                } else { // 'in'
                    const inCard = flip.entry.cards[flip.entry.primaryIdx];
                    const cm = inCard?.userData?.cardMesh;
                    if (cm) {
                        cm.scale.x = t;
                        cm.position.x = (1 - t) * -40 * flip.direction; // slide into centre
                    }
                    if (t >= 1) {
                        if (cm) { cm.scale.x = 1; cm.position.x = 0; }
                        flipAnimRef.current = null;
                    }
                }
            }

            // Update ALL active cards (Rotation & Position)
            if (card3DGroupRef.current.children.length > 0 && activeCam === pCam) {
                card3DGroupRef.current.children.forEach(card => {
                    const cardMesh = card.userData.cardMesh;
                    if(cardMesh) {
                        // In FLAT mode, keep killcards horizontal; otherwise face camera
                        if (is2DRef.current && layoutModeRef.current === 'MAP') {
                            cardMesh.rotation.x = -Math.PI / 2; // Lay flat
                            cardMesh.rotation.y = 0;
                            cardMesh.rotation.z = 0;
                        } else {
                            cardMesh.lookAt(activeCam.position);
                        }
                    }

                    const sysId = card.userData.systemId;
                    if (sysId) {
                        if (pochvenAnimRef.current.active) {
                            const cardAnimData = pochvenAnimRef.current.systemMap.get(sysId);
                            if (cardAnimData?.currentPos) card.position.copy(cardAnimData.currentPos);
                        } else if (!is2DRef.current) {
                            const sys = systemMapRef.current.get(sysId);
                            if (sys && sys.anoikisData) {
                                card.position.set(sys.x, sys.y, sys.z);
                            }
                        }
                    }
                });
            }
            
            const currentHovered = hoveredSystemRef.current;
            const prev = prevHoveredSystemRef.current;

            if (prev && galaxyMeshesRef.current.length > 0) {
                const mesh = galaxyMeshesRef.current[prev.meshIndex];
                if (mesh) { dummy.position.set(prev.x, prev.y, prev.z); dummy.scale.setScalar(1); dummy.updateMatrix(); mesh.setMatrixAt(prev.instanceId, dummy.matrix); mesh.instanceMatrix.needsUpdate = true; }
            }
            if (currentHovered && galaxyMeshesRef.current.length > 0) {
                const mesh = galaxyMeshesRef.current[currentHovered.meshIndex];
                if (mesh) { 
                    const camDist = activeCam.position.distanceTo(new THREE.Vector3(currentHovered.x, currentHovered.y, currentHovered.z)); 
                    const hoverScaleFactor = Math.min(15, Math.max(3, camDist / 100)); // Cap max scale to 15x
                    dummy.position.set(currentHovered.x, currentHovered.y, currentHovered.z); dummy.scale.setScalar(hoverScaleFactor); dummy.updateMatrix(); mesh.setMatrixAt(currentHovered.instanceId, dummy.matrix); mesh.instanceMatrix.needsUpdate = true; 
                }
            }
            prevHoveredSystemRef.current = currentHovered;

            // --- 2D HOVER/SELECTION INDICATOR (Ring Animation) ---
            if (hover2DIndicatorRef.current) {
                // Show for either hovered or selected system in 2D mode
                const targetSys = currentHovered || selectedSystemRef.current;
                if (targetSys && is2DRef.current) {
                    // Show and position the ring at the target system
                    const x = targetSys.x2d !== undefined ? targetSys.x2d : targetSys.x;
                    const z = targetSys.z2d !== undefined ? targetSys.z2d : targetSys.z;
                    hover2DIndicatorRef.current.position.set(x, 0.5, z); // Slightly above ground
                    hover2DIndicatorRef.current.visible = true;

                    // Calculate distance-based scale attenuation (same logic as system circles)
                    const camDist = activeCam.position.distanceTo(hover2DIndicatorRef.current.position);
                    const optimalDist = 350.0;
                    let distScale = 1.0;

                    if (camDist < optimalDist) {
                        distScale = THREE.MathUtils.lerp(0.4, 1.0, camDist / optimalDist);
                    } else {
                        const farDist = camDist - optimalDist;
                        const normalizedDist = farDist / 2000.0;
                        const falloff = THREE.MathUtils.smoothstep(normalizedDist, 0.0, 1.0);
                        distScale = THREE.MathUtils.lerp(1.0, 0.15, falloff);
                    }

                    // Animate the ring (pulse scale and opacity) combined with distance scale
                    const pulseScale = 1.0 + Math.sin(time * 4) * 0.15;
                    hover2DIndicatorRef.current.scale.setScalar(pulseScale * distScale);
                    hover2DIndicatorRef.current.material.opacity = 0.6 + Math.sin(time * 4) * 0.2;
                } else {
                    // Hide when not hovering/selected or not in 2D mode
                    hover2DIndicatorRef.current.visible = false;
                }
            }

            // --- POCHVEN TRIANGLE ANIMATION ---
            if (pochvenAnimRef.current.active) {
                const anim = pochvenAnimRef.current;
                anim.progress = THREE.MathUtils.lerp(anim.progress, anim.targetProgress, 0.05);

                // Snap to target if close
                if (Math.abs(anim.progress - anim.targetProgress) < 0.001) {
                    anim.progress = anim.targetProgress;
                }

                const pochMesh = galaxyMeshesRef.current[0];
                if (pochMesh && anim.systemMap.size > 0) {
                    const hovSys = hoveredSystemRef.current;

                    anim.systemMap.forEach((data, sysId) => {
                        const pos = data.realPos.clone().lerp(data.triPos, anim.progress);
                        data.currentPos.copy(pos);

                        // Scale up Pochven systems: 1x -> 3x at full isolation
                        let scale = 1 + anim.progress * 2;
                        if (hovSys && hovSys.id === sysId) {
                            const camDist = activeCam.position.distanceTo(pos);
                            scale = Math.max(scale, Math.max(3, camDist / 100));
                        }

                        dummy.position.copy(pos);
                        dummy.scale.setScalar(scale);
                        dummy.updateMatrix();
                        pochMesh.setMatrixAt(data.instanceIndex, dummy.matrix);
                    });

                    // Fade non-Pochven systems by scaling to 0 (write directly to matrix buffer)
                    const fadeScale = 1 - anim.progress;
                    const matArr = pochMesh.instanceMatrix.array;
                    for (let j = 0; j < anim.nonPochvenIndices.length; j++) {
                        const off = anim.nonPochvenIndices[j] * 16;
                        matArr[off] = fadeScale;      // scaleX
                        matArr[off + 5] = fadeScale;  // scaleY
                        matArr[off + 10] = fadeScale; // scaleZ
                    }

                    pochMesh.instanceMatrix.needsUpdate = true;

                    // Update Pochven jump line positions + all line colors
                    if (linesRef.current) {
                        const posAttr = linesRef.current.geometry.getAttribute('position');
                        anim.jumpLineIndices.forEach(({ pairIndex, s1Id, s2Id }) => {
                            // Correctly interpolate jump lines with triangle positions
                            const s1Data = anim.systemMap.get(s1Id);
                            const s2Data = anim.systemMap.get(s2Id);
                            if (!s1Data || !s2Data) return;
                            const idx = pairIndex * 6;
                            posAttr.array[idx]     = isValidNumber(s1Data.currentPos.x) ? s1Data.currentPos.x : 0;
                            posAttr.array[idx + 1] = isValidNumber(s1Data.currentPos.y) ? s1Data.currentPos.y : 0;
                            posAttr.array[idx + 2] = isValidNumber(s1Data.currentPos.z) ? s1Data.currentPos.z : 0;
                            posAttr.array[idx + 3] = isValidNumber(s2Data.currentPos.x) ? s2Data.currentPos.x : 0;
                            posAttr.array[idx + 4] = isValidNumber(s2Data.currentPos.y) ? s2Data.currentPos.y : 0;
                            posAttr.array[idx + 5] = isValidNumber(s2Data.currentPos.z) ? s2Data.currentPos.z : 0;
                        });
                        posAttr.needsUpdate = true;

                        // Fade non-Pochven line colors to black (invisible with additive blending)
                        const colorAttr = linesRef.current.geometry.getAttribute('color');
                        const bR = 0.267, bG = 0.533, bB = 0.733; // baseColor 0x4488bb
                        const fade = 1 - anim.progress;
                        for (let j = 0; j < anim.nonPochvenLineIndices.length; j++) {
                            const cidx = anim.nonPochvenLineIndices[j] * 6;
                            const r = bR * fade, g = bG * fade, b = bB * fade;
                            colorAttr.array[cidx] = r; colorAttr.array[cidx+1] = g; colorAttr.array[cidx+2] = b;
                            colorAttr.array[cidx+3] = r; colorAttr.array[cidx+4] = g; colorAttr.array[cidx+5] = b;
                        }

                        // Brighten Pochven lines to orange (>1.0 OK with additive blending)
                        const pR = 3.0, pG = 1.5, pB = 0.1;
                        anim.jumpLineIndices.forEach(({ pairIndex }) => {
                            const cidx = pairIndex * 6;
                            const r = bR + (pR - bR) * anim.progress;
                            const g = bG + (pG - bG) * anim.progress;
                            const b = bB + (pB - bB) * anim.progress;
                            colorAttr.array[cidx] = r; colorAttr.array[cidx+1] = g; colorAttr.array[cidx+2] = b;
                            colorAttr.array[cidx+3] = r; colorAttr.array[cidx+4] = g; colorAttr.array[cidx+5] = b;
                        });
                        colorAttr.needsUpdate = true;
                    }
                }

                // CLEANUP: Only clear data AFTER the final frame has been rendered
                if (anim.progress === anim.targetProgress && anim.targetProgress === 0) {
                    anim.active = false;
                    anim.systemMap.clear();
                    anim.jumpLineIndices = [];
                    anim.nonPochvenIndices = [];
                    anim.nonPochvenLineIndices = [];
                }
            }

            // --- KILL MARKER ANIMATION ---
            const hKillId = hoveredKillIdRef.current;
            const aKillId = activeKillIdRef.current;
            const maxAgeMs = killMarkerTimeLimitRef.current * 60 * 1000;

            recentKillsGroupRef.current.children.forEach(group => {
                const ud = group.userData;
                if (!ud.killIds) return; // Safety check

                // Move kill markers with Pochven animation
                if (!is2DRef.current) {
                    if (pochvenAnimRef.current.active && ud.systemData) {
                        const sysAnimData = pochvenAnimRef.current.systemMap.get(ud.systemData.id);
                        if (sysAnimData?.currentPos) {
                            group.position.copy(sysAnimData.currentPos);
                        }
                    } else if (ud.systemData && parseInt(ud.systemData.regionId) >= 11000000) {
                        // Move kill markers with Anoikis systems
                        if (ud.systemData.x !== undefined) {
                            group.position.set(ud.systemData.x, ud.systemData.y, ud.systemData.z);
                        }
                    }
                } else {
                    // 2D Mode: Ensure markers stay at 2D coordinates
                    if (ud.systemData && ud.systemData.x2d !== undefined) {
                        // Only update if position is wrong (optimization)
                        if (group.position.x !== ud.systemData.x2d) 
                            group.position.set(ud.systemData.x2d, 0, ud.systemData.z2d);
                    }
                }

                const dist = activeCam.position.distanceTo(group.position);

                // Check if ANY kill in this system is hovered or active from feed
                const isHovered = hKillId && ud.killIds.includes(hKillId);
                const isActive = aKillId && ud.killIds.includes(aKillId);

                // Age-based opacity (newest kill determines freshness)
                const ageMs = now - ud.newestTimestamp;
                const lifeRatio = Math.max(0, 1.0 - (ageMs / maxAgeMs));
                // Non-linear curve: stays bright longer, then fades faster near end
                const baseOpacity = Math.pow(lifeRatio, 0.4);

                // Pulse speed: newer kills pulse faster (more urgent feeling)
                const pulseSpeed = 2 + (lifeRatio * 4); // 2-6 Hz based on freshness
                const pulse = Math.sin(time * pulseSpeed + ud.pulsePhase) * 0.15 + 1.0;

                // Ring pulse (inverse - ring expands as sphere contracts)
                const ringPulse = Math.sin(time * pulseSpeed + ud.pulsePhase + Math.PI) * 0.1 + 1.0;

                // Distance-based scaling so markers stay visible when zoomed out
                const distScale = Math.max(1.0, dist / 250);

                // Hover/active state
                let hoverMult = 1.0;
                let sphereColor = new THREE.Color(ud.colorHex);
                let ringColor = new THREE.Color(ud.colorHex);
                let sphereOpacity = baseOpacity * 0.9;
                let ringOpacity = baseOpacity * 0.5;

                if (isHovered) {
                    hoverMult = 2.5;
                    sphereColor.setHex(0xffffff);
                    ringColor.setHex(0x00ff00);
                    sphereOpacity = 1.0;
                    ringOpacity = 1.0;
                } else if (isActive) {
                    hoverMult = 2.0;
                    sphereColor.setHex(0xffffff);
                    sphereOpacity = 1.0;
                    ringOpacity = 0.8;
                }

                // Apply final scale
                const finalScale = pulse * hoverMult * distScale;
                group.scale.setScalar(finalScale);

                // Apply materials (sphere is child[0], ring is child[1])
                if (group.children[0] && group.children[0].material) {
                    group.children[0].material.color.copy(sphereColor);
                    group.children[0].material.opacity = sphereOpacity;
                }
                if (group.children[1] && group.children[1].material) {
                    group.children[1].material.color.copy(ringColor);
                    group.children[1].material.opacity = ringOpacity * ringPulse;
                    group.children[1].lookAt(activeCam.position); // Ring faces camera
                }

                // Count label (child[2] if exists) - keep it facing camera
                if (group.children[2] && group.children[2].isSprite) {
                    group.children[2].material.opacity = baseOpacity;
                }
            });

            // Get hovered kill system name for label highlighting
            let hoveredKillSysName = null;
            if (hKillId) {
                const k = killFeedRef.current.find(k => k.id === hKillId);
                if (k) hoveredKillSysName = k.system;
            }

            // --- THROTTLED LABEL MANAGEMENT LOGIC ---
            // Only run expensive proximity calculations every LABEL_UPDATE_INTERVAL frames
            const camPos = activeCam.position;
            
            const activeRegions = (filtersRef.current.regionIds || []).map(id => String(id));
            const hasRegionFilters = activeRegions.length > 0;

            if (frameCount % LABEL_UPDATE_INTERVAL === 0) {
                const currentLabels = labelGroupRef.current.children;
                const visibleNames = new Set();

                // --- STEP 10: Conditional Label Visibility ---
                const isPochvenMode = pochvenAnimRef.current.active && pochvenAnimRef.current.progress > 0.1;

                if (isPochvenMode) {
                     // POCHVEN ISOLATION: Show ONLY Pochven systems
                     const anim = pochvenAnimRef.current;
                     // Show all systems in the triangle
                     anim.systemMap.forEach((_, sysId) => {
                         const sys = systemsRef.current[_.instanceIndex];
                         if (sys) visibleNames.add(sys.name);
                     });
                     
                     // Ensure hovered system is visible if it's in Pochven
                     if (currentHovered && anim.systemMap.has(currentHovered.id)) {
                         visibleNames.add(currentHovered.name);
                     }
                     
                     // Ensure Active/Hovered Kills are visible if in Pochven
                     killFeedRef.current.forEach(k => {
                         if (anim.systemMap.has(k.systemId)) visibleNames.add(k.system);
                     });

                } else {
                    // STANDARD MODE
                    // 1. Always Visible
                    MAJOR_HUBS.forEach(n => visibleNames.add(n));
                    killFeedRef.current.forEach(k => visibleNames.add(k.system));
                    if (currentHovered) visibleNames.add(currentHovered.name);
                    
                    // Always include Abyssal Systems in candidate list so they can animate
                    for(let i=0; i<ABYSSAL_SYSTEM_COUNT; i++) visibleNames.add(`AD ${i}`);

                    // 2. Proximity Based (expensive - throttled)
                    const camX = camPos.x, camY = camPos.y, camZ = camPos.z;
                    const maxDistSq = 1500 * 1500;
                    for (let i = 0, len = systemsRef.current.length; i < len; i++) {
                        const s = systemsRef.current[i];
                        
                        // Determine position based on mode for proximity check
                        let sx = s.x, sy = s.y, sz = s.z;
                        if (is2DRef.current && s.x2d !== undefined) {
                            sx = s.x2d; sy = 0; sz = s.z2d;
                        }

                        const dx = sx - camX;
                        const dy = sy - camY;
                        const dz = sz - camZ;
                        const distSq = dx*dx + dy*dy + dz*dz;
                        if (distSq > maxDistSq) continue;
                        const dist = Math.sqrt(distSq);
                        const sysHash = parseInt(s.id) || 0;
                        if (dist < 200) visibleNames.add(s.name);
                        else if (dist < 500) { if (sysHash % 5 === 0 || is2DRef.current) visibleNames.add(s.name); } // Show more in 2D
                        else if (dist < 1200) { if (sysHash % 20 === 0) visibleNames.add(s.name); }
                    }
                }

                // 3. REMOVE Unused
                const existingNames = new Set();
                for(let i=currentLabels.length-1; i>=0; i--) {
                    const l = currentLabels[i];
                    if(l.isSprite) {
                        if(!visibleNames.has(l.userData.text)) {
                            labelGroupRef.current.remove(l);
                            // SAFEGUARD: Dispose resources to prevent WebGL warnings
                            if (l.material.map) l.material.map.dispose();
                            l.material.dispose();
                        } else {
                            existingNames.add(l.userData.text);
                        }
                    }
                }

                // 4. ADD Missing (ONLY if not in existingNames)
                visibleNames.forEach(n => {
                    if (!existingNames.has(n)) {
                        const s = systemMapRef.current.get(n);
                        if(s) {
                            const isMajor = MAJOR_HUBS.includes(n);
                            const isHovered = currentHovered && currentHovered.name === n;
                            const isKillHovered = hoveredKillSysName === n;
                            // Use animated position for Pochven systems
                            let labelPos = {x:s.x, y:s.y, z:s.z};
                            
                            if (is2DRef.current && s.x2d !== undefined) {
                                labelPos = {x:s.x2d, y:0, z:s.z2d};
                            } else if (pochvenAnimRef.current.active) {
                                const animData = pochvenAnimRef.current.systemMap.get(s.id);
                                if (animData?.currentPos) labelPos = {x:animData.currentPos.x, y:animData.currentPos.y, z:animData.currentPos.z};
                            }
                            labelGroupRef.current.add(getLabelSprite(n, labelPos, isMajor || isHovered || isKillHovered, 'local'));
                        }
                    }
                });
            }

            labelGroupRef.current.children.forEach(l => {
                if(!l.isSprite) return;
                let base = l.userData.basePos;

                // Update label position for rotating systems (Anoikis & Abyssal) and check visibility
                if (l.userData.text) {
                    const s = systemMapRef.current.get(l.userData.text);
                    // Hide K-Space System Labels if hideKSpace is true
                    if (hideKSpaceRef.current && s && !isAnoikisRegion(s.regionId) && s.regionId !== '12000001' && !l.userData.isMajor) {
                        l.visible = false;
                        return;
                    }
                    if (s && (s.anoikisData || s.regionId === '12000001')) {
                        base = { x: s.x, y: s.y, z: s.z };
                        l.userData.basePos = base;
                        l.position.x = base.x;
                        l.position.z = base.z;
                    }
                    // Update 2D position if in 2D mode, OR restore 3D position if in 3D mode
                    if (s) {
                        if (is2DRef.current && s.x2d !== undefined) {
                            base = { x: s.x2d, y: 0, z: s.z2d };
                            l.userData.basePos = base;
                        } else if (!is2DRef.current) {
                            // RESTORE 3D POSITION
                            // This ensures labels don't get stuck in 2D positions when switching back
                            // Check for Pochven Animation Position override
                            let pos3D = { x: s.x, y: s.y, z: s.z };
                            if (pochvenAnimRef.current.active) {
                                const animData = pochvenAnimRef.current.systemMap.get(s.id);
                                if (animData?.currentPos) pos3D = animData.currentPos;
                            }
                            base = pos3D;
                            l.userData.basePos = base;
                        }
                    }
                }

                const isPochvenMode = pochvenAnimRef.current.active && pochvenAnimRef.current.progress > 0.1;

                // Update label position for Pochven animated systems (3D only)
                if (pochvenAnimRef.current.active && base) {
                    const s = systemMapRef.current.get(l.userData.text);
                    if (s) {
                        const animData = pochvenAnimRef.current.systemMap.get(s.id);
                        if (animData?.currentPos) {
                            base = { x: animData.currentPos.x, y: animData.currentPos.y, z: animData.currentPos.z };
                            l.userData.basePos = base;
                            l.position.x = base.x;
                            l.position.z = base.z;
                        }
                    }
                }

                const sysPos = base ? new THREE.Vector3(base.x, base.y, base.z) : l.position;
                const dist = camPos.distanceTo(sysPos);
                const isHoveredLabel = currentHovered && l.userData.text === currentHovered.name;
                const isKillHoveredLabel = hoveredKillSysName && l.userData.text === hoveredKillSysName;
                
                let target = 0;
                if(l.userData.isMajor || isHoveredLabel || isKillHoveredLabel) {
                    target = 1;
                    const baseScale = isKillHoveredLabel ? 300 : 200; // Larger for kill hover
                    const beaconScale = Math.max(1.0, dist / baseScale);
                    const s = Math.min(beaconScale, 5.0); 
                    
                    if (isKillHoveredLabel) {
                         l.scale.set(30*s, 8*s, 1); // VERY VISIBLE
                    } else {
                         l.scale.set(20*s, 5*s, 1);
                    }
                    l.renderOrder = 9999;
                    l.material.depthTest = false; // Ensure it draws on top
                } else {
                    target = 0.8;
                    const s = Math.max(0.6, dist/200);
                    l.scale.set(12*s, 3*s, 1);
                    l.renderOrder = 1;
                    l.material.depthTest = true;

                    // POCHVEN OVERRIDE
                    if (isPochvenMode) {
                        // Make labels uniformly readable in the triangle
                        l.scale.set(60, 15, 1); 
                        target = 1.0;
                        l.renderOrder = 999; // Bring to front
                        l.material.depthTest = false;
                    }
                }
                
                if (base) {
                    const defaultOffset = l.userData.isMajor ? 8 : 4;
                    let dynamicOffset = defaultOffset;
                    if (dist < 100) {
                        const closeOffset = l.userData.isMajor ? 3 : 1.5;
                        const t = Math.max(0, dist / 100); 
                        dynamicOffset = THREE.MathUtils.lerp(closeOffset, defaultOffset, t);
                    }
                    l.position.y = base.y + dynamicOffset;
                }
                // FADE OUT SYSTEM LABELS WHEN FAR
                // Distance threshold 400 matches the region label fade in
                if (!isPochvenMode && dist > 400) {
                    target = 0; // Fade out system labels when far
                }

                // ABYSSAL LABEL ANIMATION SYNC
                if (l.userData.text) { 
                    const s = systemMapRef.current.get(l.userData.text); 
                    if (s && s.regionId === '12000001') {
                        if (hideAbyssalRef.current) {
                            target = 0;
                        } else {
                            const parts = s.id.split('_');
                            if (parts.length === 2) {
                                const i = parseInt(parts[1]);
                                if (activeAbyssalIds.has(s.id)) {
                                    target = 1.0;
                                } else {
                                    const freq = 0.2 + (i % 5) * 0.1; 
                                    const offset = i * 132.5;
                                    const wave = Math.sin(time * freq + offset);
                                    // Sync visibility with system mesh
                                    target = wave > 0.0 ? Math.min(1, wave * 1.5) : 0;
                                }
                            }
                        }
                    }
                }
                
                // Hide Anoikis System Labels if hideAnoikis is true
                if (hideAnoikisRef.current && l.userData.text && !l.userData.isMajor) {
                    const s = systemMapRef.current.get(l.userData.text);
                    if (s && isAnoikisRegion(s.regionId)) target = 0;
                }

                l.material.opacity = THREE.MathUtils.lerp(l.material.opacity, target, 0.1);
                l.visible = l.material.opacity > 0.05;
            });
            
            // UPDATE REGION LABELS OPACITY
            regionLabelGroupRef.current.children.forEach(r => {
                const { regionId: rId, isAnoikisLabel } = r.userData;
                let target = 0;

                // Update Position for 2D/3D
                if (is2DRef.current && r.userData.pos2D) {
                    // In 2D mode: different heights and positions for REG vs FLAT
                    if (layoutModeRef.current === 'REG') {
                        // REG mode: use centroid at height 35
                        r.position.set(r.userData.pos2D.x, 35, r.userData.pos2D.z);
                        r.renderOrder = 1;
                    } else if (layoutModeRef.current === 'MAP') {
                        // FLAT mode: Place BELOW systems and render BEHIND
                        r.position.set(r.userData.pos2D.x, -20, r.userData.pos2D.z);
                        r.renderOrder = -1;
                    } else {
                        // Fallback to centroid
                        r.position.set(r.userData.pos2D.x, 0, r.userData.pos2D.z);
                        r.renderOrder = 1;
                    }
                } else if (!is2DRef.current && r.userData.pos3D) {
                    // Restore 3D position (unless it's Anoikis rotating, handled above)
                    if (!isAnoikisLabel) r.position.set(r.userData.pos3D.x, r.userData.pos3D.y, r.userData.pos3D.z);
                    r.renderOrder = 1;
                }

                // Calculate distance for visibility logic (after position is set)
                const dist = camPos.distanceTo(r.position);

                // Filter Logic: Hide label if filters are active and this region is not selected
                let isVisibleByFilter = true;
                if (hasRegionFilters && rId && !activeRegions.includes(String(rId))) {
                    isVisibleByFilter = false;
                }

                // Visibility logic for region labels
                // Priority order: filters first, then mode-specific visibility
                if (pochvenAnimRef.current.active) {
                    // Hide all region labels during Pochven filter
                    target = 0.8 * (1.0 - pochvenAnimRef.current.progress);
                    if (pochvenAnimRef.current.progress > 0.9) target = 0;
                } else if (is2DRef.current && (isAnoikisRegion(rId) || isAnoikisLabel || rId === '12000001')) {
                    // Force hide Anoikis/Abyssal labels in 2D mode
                    target = 0;
                } else if (hideAnoikisRef.current && (isAnoikisRegion(rId) || isAnoikisLabel)) {
                    // Explicitly hide Anoikis region labels when filter active
                    target = 0;
                } else if (hideKSpaceRef.current && !isAnoikisRegion(rId) && !isAnoikisLabel && rId !== '12000001') {
                    // Hide K-Space when filter active
                    target = 0;
                } else if (hideAbyssalRef.current && rId === '12000001') {
                    // Hide Abyssal when filter active
                    target = 0;
                } else if (!isVisibleByFilter) {
                    // Hide if region filters are active and this region is not selected
                    target = 0;
                } else if (is2DRef.current && layoutModeRef.current === 'MAP') {
                    // FLAT mode: show labels at perimeter positions (non-blocking)
                    target = 0.8;
                } else if (is2DRef.current && layoutModeRef.current === 'REG') {
                    // REG mode (2D rotatable): show labels at centroids
                    target = 0.8;
                } else if (!is2DRef.current && dist > 400) {
                    // 3D mode: fade in when far (dist > 400)
                    target = 0.8;
                } else if (r.userData.type === 'kill') {
                    // Kill labels always visible
                    target = 0.8;
                }

                r.material.opacity = THREE.MathUtils.lerp(r.material.opacity, target, 0.05);
                r.visible = r.material.opacity > 0.05;
            });
            
            for(let i=shockwavesRef.current.length-1; i>=0; i--) {
                const sw = shockwavesRef.current[i]; sw.age += sw.speed; sw.mesh.scale.setScalar(1 + sw.age*20); sw.mesh.lookAt(activeCam.position);
                sw.mesh.visible = !is2DRef.current;
                if(sw.age < 0.1) sw.mesh.material.opacity = sw.age * 10; else sw.mesh.material.opacity = Math.max(0, 1.0 - sw.age);
                if(sw.age >= 1.0) { if(sw.mesh.parent) sw.mesh.parent.remove(sw.mesh); else scene.remove(sw.mesh); sw.mesh.geometry.dispose(); sw.mesh.material.dispose(); shockwavesRef.current.splice(i,1); }
            }
            
            // --- DEBUG INFO UPDATE (throttled) ---
            if (frameCount % 30 === 0 && controlsRef.current) {
                setDebugInfo({
                    camPos: { x: Math.round(activeCam.position.x), y: Math.round(activeCam.position.y), z: Math.round(activeCam.position.z) },
                    lookAt: { x: Math.round(controlsRef.current.target.x), y: Math.round(controlsRef.current.target.y), z: Math.round(controlsRef.current.target.z) }
                });
            }

            // --- RENDERER TOGGLE ---
            if (isHDRef.current) {
                composer.render();
            } else {
                renderer.render(scene, activeCam);
            }
        };
        animate();

        const loadData = async () => {
            setStatus("Loading Map...");
            try {
                // 1. Load Data (Systems from imported SDE + Jumps/Regions CSV)
                let sysData, jumpT, regT;
                sysData = sdeSystemsData;
                try {
                    const [jR, rR] = await Promise.all([fetch(URL_JUMPS), fetch(URL_REGIONS)]);
                    jumpT = await jR.text();
                    regT = await rR.text();
                } catch(e) {
                    console.warn("Fetch failed for jumps/regions, using fallbacks", e);
                    jumpT = RAW_JUMPS_CSV;
                    regT = '';
                }
                
                const rMap = new Map();
                if(regT) regT.trim().split('\n').forEach(l => { const c = l.split(','); if(c.length>1 && c[0]!=='regionID') rMap.set(c[0], {id:c[0], name:c[1]}); });
                rMap.set('12000001', {id: '12000001', name: 'Abyssal Pocket'});
                rMap.set('11000031', {id: '11000031', name: 'Thera'}); // Explicit name for Thera
                regionMapRef.current = rMap;
                
                const jLines = jumpT.trim().split('\n'); const connIds = new Set(); jLines.forEach(l => { const c=l.split(','); if(c.length<4)return; connIds.add(c[2]); connIds.add(c[3]); });
                const sList = []; const sMap = new Map();
                
                // Track Region Centers for Labels
                const regionCenters = new Map(); // regionId -> {x, y, z, count}
                regionLabelGroupRef.current.clear(); // Clear previous labels to prevent duplicates

                const jSpaceSystems = []; // Temp storage for J-Space to calculate centroid
                
                // Reset Traffic Data
                kSpaceSystemsRef.current = [];
                anoikisSystemsRef.current = [];
                abyssalSystemsRef.current = [];
                trafficRef.current = [];
                nextTrafficSpawnRef.current = 0;

                // Normalize Data (Handle SDE format from JSONL)
                sysData = sysData.map(d => ({
                    id: String(d._key || d.solarSystemID), regionId: String(d.regionID), constellationId: String(d.constellationID),
                    name: d.name && d.name.en ? d.name.en : d.name, x: d.position ? d.position.x : d.x, y: d.position ? d.position.y : d.y,
                    z: d.position ? d.position.z : d.z, sec: d.securityStatus !== undefined ? d.securityStatus : d.sec,
                    position2D: d.position2D || null,
                }));

                sysData.forEach(data => {
                    const id = String(data.id);
                    const regionId = String(data.regionId);
                    
                    // Allow Region 10000070 (Pochven) even if not connected (no stargates)
                    
                    // Check for J-Space (Regions 1100xxxx)
                    const isJSpace = parseInt(regionId) >= 11000000 && parseInt(regionId) < 12000000;
                    // Check for Jove (Regions 10000004, 10000017, 10000019)
                    const isJove = ['10000004', '10000017', '10000019'].includes(regionId);
                    
                    // FILTER: Exclude Abyssal (1200xxxx) or very high ID systems (Penalty/Dev)
                    // Allow J-Space (31xxxxxx) and K-Space
                    if(parseInt(id)>=32000000 || parseInt(regionId) >= 12000000) return;
                    
                    // Filter unconnected K-Space (but allow Pochven, J-Space, and Jove)
                    if(!isJSpace && !isJove && !connIds.has(id) && regionId !== POCHVEN_REGION_ID) return;
                    
                    // Validate Coordinates (Prevent NaN)
                    const rawX = parseFloat(data.x);
                    const rawY = parseFloat(data.y);
                    const rawZ = parseFloat(data.z);
                    // Rigorous check for all coordinates to prevent NaN propagation
                    if (!isValidNumber(rawX) || !isValidNumber(rawY) || !isValidNumber(rawZ)) {
                        console.warn(`Skipping system ${data.name} (${id}) due to invalid 3D coordinates.`);
                        return; // Skip this system entirely if any 3D coordinate is invalid
                    }

                    let sec = data.sec;
                    // Force Pochven to Null-Sec status for correct coloring
                    if (regionId === POCHVEN_REGION_ID) sec = -1.0;

                    const K_STRETCH = 1.0;
                    
                    const sys = {
                        id,
                        regionId: regionId,
                        constellationId: String(data.constellationId),
                        name: data.name,
                        x: (rawX/SCALING_FACTOR) * K_STRETCH,
                        y: (rawY/SCALING_FACTOR) * K_STRETCH,
                        z: -(rawZ/SCALING_FACTOR), // Invert Z for ThreeJS
                        sec: sec,
                        baseX: (rawX/SCALING_FACTOR) * K_STRETCH,
                        baseY: (rawY/SCALING_FACTOR) * K_STRETCH,
                        baseZ: -(rawZ/SCALING_FACTOR),
                    };

                    // Use CCP's official 2D map coordinates from SDE
                    if (data.position2D) {
                        const raw2Dx = parseFloat(data.position2D.x);
                        const raw2Dy = parseFloat(data.position2D.y);
                        if (isValidNumber(raw2Dx) && isValidNumber(raw2Dy)) {
                            sys.x2d = raw2Dx / SCALING_FACTOR;
                            sys.z2d = -(raw2Dy / SCALING_FACTOR);
                        }
                    }
                    
                    if (isJSpace) {
                        jSpaceSystems.push(sys);
                    } else {
                        sList.push(sys); sMap.set(sys.name, sys); sMap.set(id, sys);
                        
                        // Accumulate Region Center Data
                        if(!regionCenters.has(sys.regionId)) regionCenters.set(sys.regionId, {x:0, y:0, z:0, count:0});
                        const rc = regionCenters.get(sys.regionId);
                        rc.x += sys.x; rc.y += sys.y; rc.z += sys.z;
                        rc.count++;
                        sys.instanceIndex = sList.length - 1;
                        kSpaceSystemsRef.current.push(sys); // Store for traffic
                    }
                });

                // --- PROCESS J-SPACE SYSTEMS (CONSTELLATION CLUSTERING MODEL) ---
                if (jSpaceSystems.length > 0) {
                    anoikisVisualsRef.current.clear();
                    drifterVisualsRef.current.clear();
                    drifterParticlesRef.current = null;
                    
                    // Group by Class (derived from Region)
                    const classGroups = {
                        'C1': [], 'C2': [], 'C3': [], 'C4': [], 'C5': [], 'C6': [],
                        'C13': [], 'Thera': [], 'Drifter': [], 'Other': []
                    };

                    jSpaceSystems.forEach(s => {
                        const rId = parseInt(s.regionId);
                        if (rId === 11000031) classGroups['Thera'].push(s);
                        else if (rId === 11000033) classGroups['Drifter'].push(s);
                        else if (rId === 11000032) classGroups['C13'].push(s);
                        else if (rId >= 11000001 && rId <= 11000030) {
                            // Standard Wormhole Regions (1-30)
                            // Map all 30 regions into 6 pseudo-classes for visualization
                            const norm = rId - 11000001; // 0 to 29
                            const bucket = Math.floor(norm / 5) + 1; // 1 to 6 (5 regions per class)
                            classGroups[`C${bucket}`].push(s);
                        } else {
                            classGroups['Other'].push(s);
                        }
                    });

                    const tempRotatorIndices = [];
                    
                    // Config for each layer - COLLAPSED / COMPACT VORTEX with VARIABLE SPEED
                    const layerConfig = {
                        'C1': { y: -150, r: 600, speed: 0.2 },    // Just under High Sec, Slowest
                        'C2': { y: -200, r: 500, speed: 0.3 },
                        'C3': { y: -250, r: 400, speed: 0.4 },
                        'C4': { y: -300, r: 300, speed: 0.5 },
                        'C5': { y: -350, r: 200, speed: 0.8 },
                        'C6': { y: -400, r: 100, speed: 1.5 },    // Deep Core, Fast
                        'C13': { y: -250, r: 700, speed: 0.4 },   // Halo Ring (Shattered)
                        'Thera': { y: -100, r: 0, speed: 0 },     // Apex (Static)
                        'Drifter': { y: -500, r: 80, speed: 0.0 } // Deep below, separated
                    };

                    const drifterTex = getCloudTexture();

                    Object.entries(classGroups).forEach(([cls, systems]) => {
                        let drifterIndex = 0;
                        if (systems.length === 0) return;
                        const cfg = layerConfig[cls] || { y: -600, r: 200, speed: 1 };
                        const layerY = cfg.y + ANOIKIS_ZONE.y;
                        
                        // Visual Ring Guide
                        if (cfg.r > 0) {
                            const ringGeo = new THREE.RingGeometry(cfg.r - 2, cfg.r + 2, 128);
                            const ringMat = new THREE.MeshBasicMaterial({ color: 0x444444, side: THREE.DoubleSide, transparent: true, opacity: 0.25, depthWrite: false });
                            const ring = new THREE.Mesh(ringGeo, ringMat);
                            ring.rotation.x = Math.PI / 2;
                            ring.position.set(ANOIKIS_ZONE.x, layerY, ANOIKIS_ZONE.z);
                            anoikisVisualsRef.current.add(ring);
                        }
                        
                        if (cfg.r > 0 && cls !== 'Drifter') {
                            const sprite = getLabelSprite(cls, {x: ANOIKIS_ZONE.x + cfg.r + 80, y: layerY, z: ANOIKIS_ZONE.z}, false, 'kill');
                            sprite.scale.set(160, 40, 1); sprite.material.opacity = 0.9;
                            // Removed anoikisData so these legend labels stay static
                            sprite.userData.isAnoikisLabel = true; // Tag for visibility filtering
                            regionLabelGroupRef.current.add(sprite);
                        }

                        // Group systems by Constellation to create "Islands"
                        const constellations = {};
                        systems.forEach(s => {
                            if (!constellations[s.constellationId]) constellations[s.constellationId] = [];
                            constellations[s.constellationId].push(s);
                        });
                        
                        const constKeys = Object.keys(constellations);
                        const constCount = constKeys.length;

                        constKeys.forEach((cId, cIndex) => {
                            const cSystems = constellations[cId];
                            
                            // Constellation Center on the Ring
                            const cAngle = (cIndex / constCount) * Math.PI * 2 + (Math.random() * 0.2);
                            const cRadius = cfg.r + (Math.random() - 0.5) * 50; // Tighter cloud
                            
                            const cx = ANOIKIS_ZONE.x + Math.cos(cAngle) * cRadius;
                            const cz = ANOIKIS_ZONE.z + Math.sin(cAngle) * cRadius;
                            
                            // Distribute systems around this constellation center
                            cSystems.forEach((s, i) => {
                                if (cls === 'Drifter') {
                                    // Force Pentagon Formation
                                    const angle = (drifterIndex / 5) * Math.PI * 2;
                                    s.x = ANOIKIS_ZONE.x + Math.cos(angle) * cfg.r;
                                    s.y = layerY;
                                    s.z = ANOIKIS_ZONE.z + Math.sin(angle) * cfg.r;
                                    drifterIndex++;
                                } else {
                                const sOffset = 30 + Math.random() * 40;
                                const sAngle = Math.random() * Math.PI * 2;
                                
                                // Final position
                                s.x = cx + Math.cos(sAngle) * sOffset;
                                s.y = layerY + (Math.random() - 0.5) * 120; // Increased vertical jitter
                                s.z = cz + Math.sin(sAngle) * sOffset;
                                }
                                
                                s.baseX = s.x; s.baseY = s.y; s.baseZ = s.z;

                                // Rotation Logic
                                if (cfg.r > 0) {
                                    const distFromAxis = Math.sqrt(Math.pow(s.x - ANOIKIS_ZONE.x, 2) + Math.pow(s.z - ANOIKIS_ZONE.z, 2));
                                    const currentAngle = Math.atan2(s.z - ANOIKIS_ZONE.z, s.x - ANOIKIS_ZONE.x);
                                    
                                    s.anoikisData = {
                                        angle: currentAngle,
                                        dist: distFromAxis,
                                        startY: s.y,
                                        speed: cfg.speed,
                                        localX: 0, localY: 0, localZ: 0
                                    };
                                    tempRotatorIndices.push(sList.length); 
                                }
                                
                                sList.push(s); sMap.set(s.name, s); sMap.set(s.id, s);
                                if(!regionCenters.has(s.regionId)) regionCenters.set(s.regionId, {x:0, y:0, z:0, count:0});
                                s.instanceIndex = sList.length - 1;
                                
                                // Store speed in region center data for label rotation
                                const rcData = regionCenters.get(s.regionId);
                                rcData.speed = cfg.speed;

                                const rc = regionCenters.get(s.regionId);
                                rc.x += s.x; rc.y += s.y; rc.z += s.z; rc.count++;
                                anoikisSystemsRef.current.push(s); 

                                // Add Drifter Visuals
                                if (cls === 'Drifter') {
                                    const spriteMat = new THREE.SpriteMaterial({ 
                                        map: drifterTex, 
                                        color: 0xff0000, 
                                        transparent: true, 
                                        opacity: 0.6,
                                        blending: THREE.AdditiveBlending,
                                        depthWrite: false
                                    });
                                    const sprite = new THREE.Sprite(spriteMat);
                                    sprite.position.set(s.x, s.y, s.z);
                                    sprite.userData = { phase: Math.random() * Math.PI * 2, baseScale: 120 }; // Larger scale
                                    drifterVisualsRef.current.add(sprite);
                                }
                            });
                        });

                        // Create Drifter Particle Cloud
                        if (cls === 'Drifter') {
                            const pCount = 600;
                            const pGeo = new THREE.BufferGeometry();
                            const pPos = new Float32Array(pCount * 3);
                            const pCol = new Float32Array(pCount * 3);
                            const color = new THREE.Color(0xff0000);
                            
                            for(let i=0; i<pCount; i++) {
                                const angle = Math.random() * Math.PI * 2;
                                const r = 20 + Math.random() * 120; // Tighter cloud around the pentagon
                                pPos[i*3] = ANOIKIS_ZONE.x + Math.cos(angle) * r;
                                pPos[i*3+1] = layerY + (Math.random() - 0.5) * 100;
                                pPos[i*3+2] = ANOIKIS_ZONE.z + Math.sin(angle) * r;
                                pCol[i*3] = color.r; pCol[i*3+1] = Math.random() * 0.5; pCol[i*3+2] = 0; // Red/Orange
                            }
                            pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
                            pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
                            const pMat = new THREE.PointsMaterial({ size: 12, vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, map: drifterTex });
                            const pMesh = new THREE.Points(pGeo, pMat);
                            drifterVisualsRef.current.add(pMesh);
                            drifterParticlesRef.current = pMesh;
                        }
                    });

                    anoikisRotatorIndicesRef.current = tempRotatorIndices;
                }

                // --- GENERATE ANOIKIS VORTEX PARTICLES (HD) ---
                if (jSpaceSystems.length > 0) {
                    const vortexCount = 4000;
                    const vGeo = new THREE.BufferGeometry();
                    const vPos = new Float32Array(vortexCount * 3);
                    const vInfo = new Float32Array(vortexCount * 3); // x=radius, y=speed, z=offset
                    const vColor = new Float32Array(vortexCount * 3);

                    for(let i=0; i<vortexCount; i++) {
                        // Distribute along the cone (C1 top to Drifter bottom)
                        // C1 Y ~ -550, Drifter Y ~ -850 (relative to 0,0,0)
                        const t = Math.random(); 
                        const y = -550 - (t * 300); 
                        
                        // Radius: C1 ~ 600, Drifter ~ 50
                        const rBase = 600 * (1.0 - t) + 50 * t;
                        const r = rBase + (Math.random() - 0.5) * 150; // Add spread
                        const angle = Math.random() * Math.PI * 2;

                        vPos[i*3] = ANOIKIS_ZONE.x + Math.cos(angle) * r;
                        vPos[i*3+1] = y;
                        vPos[i*3+2] = ANOIKIS_ZONE.z + Math.sin(angle) * r;

                        // Speed increases with depth (t)
                        const speed = 0.2 + (t * 0.8); 
                        
                        vInfo[i*3] = r;
                        vInfo[i*3+1] = speed;
                        vInfo[i*3+2] = Math.random() * 100; // Random phase offset

                        // Color: Light Purple top -> Dark Red bottom
                        const c = new THREE.Color();
                        // Gradient matching the systems
                        const h = 260 + (t * 80);
                        const l = 75 - (t * 40);
                        c.setHSL(h/360, 0.8, l/100);
                        
                        vColor[i*3] = c.r; vColor[i*3+1] = c.g; vColor[i*3+2] = c.b;
                    }

                    vGeo.setAttribute('position', new THREE.BufferAttribute(vPos, 3));
                    vGeo.setAttribute('aInfo', new THREE.BufferAttribute(vInfo, 3));
                    vGeo.setAttribute('color', new THREE.BufferAttribute(vColor, 3));

                    const vMat = new THREE.ShaderMaterial({
                        uniforms: { uTime: { value: 0 }, uTexture: { value: getCloudTexture() } },
                        vertexShader: `
                            uniform float uTime; attribute vec3 aInfo; attribute vec3 color; varying vec3 vColor;
                            void main() { vColor = color; float speed = aInfo.y; float offset = aInfo.z;
                                float angle = (uTime * speed * 0.5) + offset; float c = cos(angle); float s = sin(angle);
                                vec3 pos = position; float x = pos.x * c - pos.z * s; float z = pos.x * s + pos.z * c;
                                vec4 mvPosition = modelViewMatrix * vec4(x, pos.y, z, 1.0); gl_Position = projectionMatrix * mvPosition; gl_PointSize = (400.0 / -mvPosition.z); }`,
                        fragmentShader: `uniform sampler2D uTexture; varying vec3 vColor; void main() { vec4 tex = texture2D(uTexture, gl_PointCoord); if (tex.a < 0.05) discard; gl_FragColor = vec4(vColor, tex.a * 0.25); }`,
                        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
                    });
                    const vMesh = new THREE.Points(vGeo, vMat);
                    anoikisFlowRef.current = vMesh;
                    scene.add(vMesh);
                }

                // --- GENERATE ABYSSAL SYSTEMS ---
                for(let i=0; i<ABYSSAL_SYSTEM_COUNT; i++) {
                    const pos = getAbyssalPosition(i * 123456); // Spread seeds
                    const sys = {
                        id: `Abyssal_${i}`,
                        regionId: '12000001',
                        constellationId: '0',
                        name: `AD ${i}`,
                        x: pos.x, y: pos.y, z: pos.z,
                        baseX: pos.x, baseY: pos.y, baseZ: pos.z,
                        sec: -1.0,
                    };
                    sList.push(sys);
                    sMap.set(sys.id, sys);
                    sMap.set(sys.name, sys);
                    sys.instanceIndex = sList.length - 1;
                    abyssalSystemsRef.current.push(sys);
                }

                // Manually add Abyssal Region Center for Label
                regionCenters.set('12000001', { x: ABYSSAL_ZONE.x, y: ABYSSAL_ZONE.y, z: ABYSSAL_ZONE.z, count: 1 });

                systemsRef.current = sList; systemMapRef.current = sMap;
                
                // Calculate 2D Region Centroids AND Bounding Boxes from Layout Data
                const regionCentroids2D = new Map();
                const regionBounds2D = new Map();
                sList.forEach(sys => {
                    if (sys.x2d !== undefined && sys.z2d !== undefined) {
                        // Centroid calculation
                        if (!regionCentroids2D.has(sys.regionId)) regionCentroids2D.set(sys.regionId, {x: 0, y: 0, count: 0});
                        const r = regionCentroids2D.get(sys.regionId);
                        r.x += sys.x2d;
                        r.y += sys.z2d;
                        r.count++;

                        // Bounding box calculation
                        if (!regionBounds2D.has(sys.regionId)) {
                            regionBounds2D.set(sys.regionId, {
                                minX: sys.x2d, maxX: sys.x2d,
                                minZ: sys.z2d, maxZ: sys.z2d
                            });
                        } else {
                            const b = regionBounds2D.get(sys.regionId);
                            b.minX = Math.min(b.minX, sys.x2d);
                            b.maxX = Math.max(b.maxX, sys.x2d);
                            b.minZ = Math.min(b.minZ, sys.z2d);
                            b.maxZ = Math.max(b.maxZ, sys.z2d);
                        }
                    }
                });
                regionCentroids2D.forEach(r => { r.x /= r.count; r.y /= r.count; });

                // GENERATE REGION LABELS
                regionCenters.forEach((rc, rId) => {
                    // Filter out J-Space and Abyssal Regions from Labels
                    const isJSpace = isAnoikisRegion(rId);
                    // Allow J-Space labels now, but still exclude other special regions (except Abyssal which is handled manually)
                    if (parseInt(rId) >= 12000000 && String(rId) !== '12000001') return; 

                    const avgX = rc.x / rc.count;
                    const avgY = rc.y / rc.count;
                    const avgZ = rc.z / rc.count;
                    const rName = rMap.get(rId)?.name || (parseInt(rId) >= 11000000 && parseInt(rId) < 12000000 ? `Region ${rId}` : null);
                    if(rName) {
                        const isThera = String(rId) === '11000031';
                        const isJove = ['10000004', '10000017', '10000019'].includes(String(rId));
                        let labelColor = null;
                        if (isThera) labelColor = '#00e5ff'; // Cyan for Thera
                        else if (isJove) labelColor = '#00ced1'; // Teal for Jove regions

                        // Store 3D position
                        const pos3D = {x:avgX, y:avgY, z:avgZ};

                        // Get 2D centroid and perimeter position for this region
                        const c2d = regionCentroids2D.get(rId);
                        const bounds = regionBounds2D.get(rId);

                        // Calculate perimeter position (top-right corner with offset)
                        let pos2DPerimeter = null;
                        if (bounds) {
                            const offsetX = 80; // Offset from edge to avoid blocking systems
                            const offsetZ = 80;
                            pos2DPerimeter = {
                                x: bounds.maxX + offsetX,
                                z: bounds.maxZ + offsetZ
                            };
                        }

                        const label = getRegionLabelSprite(rName, {x:avgX, y:avgY, z:avgZ}, labelColor);
                        label.userData = {
                            regionId: rId,
                            pos3D: pos3D,
                            pos2D: c2d ? {x: c2d.x, z: c2d.y} : null,
                            pos2DPerimeter: pos2DPerimeter
                        };

                        // If J-Space, attach rotation data so the label moves with the system cluster
                        if (isJSpace && rc.speed !== undefined) {
                            const dx = avgX - ANOIKIS_ZONE.x;
                            const dz = avgZ - ANOIKIS_ZONE.z;
                            label.userData.anoikisData = {
                                angle: Math.atan2(dz, dx),
                                dist: Math.sqrt(dx*dx + dz*dz),
                                startY: avgY,
                                speed: rc.speed
                            };
                        }

                        regionLabelGroupRef.current.add(label);
                    }
                });

                // Add Jovian Empire cluster label
                const joveRegionIds = ['10000004', '10000017', '10000019'];
                const joveCenters = joveRegionIds.map(id => regionCenters.get(id)).filter(Boolean);
                if (joveCenters.length > 0) {
                    // Calculate 3D centroid of all Jove regions
                    let joveX = 0, joveY = 0, joveZ = 0, joveCount = 0;
                    joveCenters.forEach(rc => {
                        joveX += rc.x;
                        joveY += rc.y;
                        joveZ += rc.z;
                        joveCount += rc.count;
                    });
                    joveX /= joveCount;
                    joveY /= joveCount;
                    joveZ /= joveCount;

                    // Calculate 2D centroid
                    const joveCentroids2D = joveRegionIds.map(id => regionCentroids2D.get(id)).filter(Boolean);
                    let jove2DX = 0, jove2DZ = 0;
                    if (joveCentroids2D.length > 0) {
                        joveCentroids2D.forEach(c => {
                            jove2DX += c.x;
                            jove2DZ += c.y; // y in 2D map is z in 3D
                        });
                        jove2DX /= joveCentroids2D.length;
                        jove2DZ /= joveCentroids2D.length;
                    }

                    // Calculate combined bounding box for Jovian Empire
                    const joveBounds = joveRegionIds.map(id => regionBounds2D.get(id)).filter(Boolean);
                    let jove2DPerimeter = null;
                    if (joveBounds.length > 0) {
                        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
                        joveBounds.forEach(b => {
                            minX = Math.min(minX, b.minX);
                            maxX = Math.max(maxX, b.maxX);
                            minZ = Math.min(minZ, b.minZ);
                            maxZ = Math.max(maxZ, b.maxZ);
                        });
                        jove2DPerimeter = {
                            x: maxX + 80,
                            z: maxZ + 80
                        };
                    }

                    // Create special cluster label (◇ represents their advanced, mysterious nature)
                    const labelHeight = 40; // Lower height to position over the regions
                    const joveClusterLabel = getRegionLabelSprite('◇ JOVIAN EMPIRE', {x: joveX, y: joveY + labelHeight, z: joveZ}, '#00ced1');
                    joveClusterLabel.scale.set(200, 50, 1); // Larger for visibility
                    joveClusterLabel.userData = {
                        regionId: 'jove_cluster',
                        isJovianLabel: true,
                        pos3D: {x: joveX, y: joveY + labelHeight, z: joveZ},
                        pos2D: joveCentroids2D.length > 0 ? {x: jove2DX, z: jove2DZ} : null,
                        pos2DPerimeter: jove2DPerimeter
                    };
                    regionLabelGroupRef.current.add(joveClusterLabel);
                }

                // --- SINGLE INSTANCED MESH ---
                // Consolidate High/Low/Null into one mesh logic
                const mAll = new THREE.InstancedMesh(new THREE.SphereGeometry(SYSTEM_RADIUS, 32, 32), setupInstancedMeshMaterial(), sList.length);
                mAll.frustumCulled = false; // Prevent culling issues
                
                // Explicitly initialize instanceColor attribute if not present
                if (!mAll.instanceColor) {
                     mAll.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(sList.length * 3), 3);
                }

                const dummy = new THREE.Object3D();
                const regionColors = new Float32Array(sList.length * 3);
                const activeAttributes = new Float32Array(sList.length); // NEW: Active State
                const isAnoikisAttribute = new Float32Array(sList.length); // NEW: Identify Anoikis for Shader
                
                sList.forEach((s, i) => {
                    dummy.position.set(s.x, s.y, s.z);
                    dummy.updateMatrix();
                    mAll.setMatrixAt(i, dummy.matrix);
                    
                    // Set instanceColor (Sec Status) - Used as 'vColor' in shader
                    const isJove = ['10000004', '10000017', '10000019'].includes(s.regionId);
                    let secColor = new THREE.Color();
                    if(s.regionId === "10000070") secColor.setHex(0xe85d04); // Pochven Orange
                    else if(s.regionId === "12000001") secColor.setHex(0x3b82f6); // Abyssal Blue
                    else if(isJove) secColor.setHex(0x00ced1); // Jove Teal
                    else if(parseInt(s.regionId) >= 11000000 && parseInt(s.regionId) < 12000000) {
                        // Color by Class (C1-C6, Thera, Drifter)
                        const rId = parseInt(s.regionId);
                        if (rId === 11000031) secColor.setHex(0xffffff); // Thera (White)
                        else if (rId === 11000033) secColor.setHex(0xff0000); // Drifter (Bright Red)
                        else if (rId === 11000032) secColor.setHex(0x00ffff); // C13 (Electric Cyan - Shattered)
                        else {
                            // C1-C6 Spectrum: Light Friendly Purple -> Dark Angry Purple/Red
                            const norm = rId - 11000001;
                            const cClass = Math.floor(norm / 5) + 1;
                            // Map 1..6 to Purple..Red-Purple
                            // C1: Light Purple (260, 80%, 75%) -> C6: Dark Red-Purple (340, 100%, 35%)
                            const t = (cClass - 1) / 5;
                            const h = 260 + (t * 80);
                            const l = 75 - (t * 40);
                            secColor.setHSL(h/360, 0.9, l/100);
                        }
                    }
                    else if(s.sec >= 0.5) secColor.setHex(0x4ade80);
                    else if(s.sec > 0) secColor.setHex(0xffaa00);
                    else secColor.setHex(0xef4444);
                    mAll.setColorAt(i, secColor);

                    // Set Region Color Attribute
                    let rColor;
                    if (s.regionId === '12000001') rColor = new THREE.Color(0x3b82f6);
                    else rColor = getRegionColor(s.regionId);
                    
                    regionColors[i*3] = rColor.r;
                    regionColors[i*3+1] = rColor.g;
                    regionColors[i*3+2] = rColor.b;

                    // Initialize Active State (Default 1.0)
                    activeAttributes[i] = 1.0;

                    // Identify Anoikis Systems
                    isAnoikisAttribute[i] = isAnoikisRegion(s.regionId) ? 1.0 : 0.0;
                });
                
                mAll.geometry.setAttribute('aRegionColor', new THREE.InstancedBufferAttribute(regionColors, 3));
                mAll.geometry.setAttribute('aActive', new THREE.InstancedBufferAttribute(activeAttributes, 1)); // NEW
                mAll.geometry.setAttribute('aIsAnoikis', new THREE.InstancedBufferAttribute(isAnoikisAttribute, 1)); // NEW
                mAll.instanceMatrix.needsUpdate = true;
                if(mAll.instanceColor) mAll.instanceColor.needsUpdate = true;
                
                scene.add(mAll);
                galaxyMeshesRef.current.push(mAll);

                const pos = []; 
                const lineColors = [];
                const pairs = [];
                const baseLineColor = new THREE.Color(0x4488bb);
                
                jLines.forEach(l => { 
                    const c=l.split(','); 
                    if(c.length<4) return; 
                    const s1 = sMap.get(c[2]), s2 = sMap.get(c[3]); 
                    if(s1 && s2) {
                        pos.push(s1.x, s1.y, s1.z, s2.x, s2.y, s2.z);
                        // Push Default Colors (2 vertices per line)
                        lineColors.push(baseLineColor.r, baseLineColor.g, baseLineColor.b);
                        lineColors.push(baseLineColor.r, baseLineColor.g, baseLineColor.b);
                        pairs.push({s1, s2});
                    } 
                });
                jumpPairsRef.current = pairs;

                const lGeo = new THREE.BufferGeometry(); 
                lGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
                lGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
                
                const lMat = new THREE.LineBasicMaterial({ 
                    vertexColors: true, // ENABLED
                    transparent: true, 
                    opacity: 0.15, 
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });
                linesRef.current = new THREE.LineSegments(lGeo, lMat); scene.add(linesRef.current);

                // --- GENERATE 2D LAYOUT (Using CCP SDE position2D) ---
                const pos2D = [];
                const col2D = [];
                const regionCol2D = [];
                const linePos2D = []; // Intra-regional jumps
                const lineCol2D = [];
                const linePos2DInterRegional = []; // Inter-regional jumps
                const lineCol2DInterRegional = [];
                const baseColor2D = new THREE.Color(0x4488bb);
                const interRegionalColor = new THREE.Color(0x667788); // Lighter, more subtle
                const systems2D = [];

                // 1. Group K-Space systems by Region (needed for REG layout centroids)
                const regionGroups = new Map();
                
                sList.forEach(sys => {
                    // Only process K-Space (Region < 11000000)
                    if (parseInt(sys.regionId) >= 11000000) return;

                    if (!regionGroups.has(sys.regionId)) regionGroups.set(sys.regionId, { x: 0, z: 0, count: 0, systems: [] });
                    const rGroup = regionGroups.get(sys.regionId);
                    
                    // Accumulate for centroids (using base coordinates)
                    rGroup.x += sys.baseX;
                    rGroup.z += sys.baseZ;
                    rGroup.count++;
                    rGroup.systems.push(sys);
                });

                // 2. Build 2D positions (SDE position2D primary, procedural fallback)
                regionGroups.forEach(rGroup => {
                    const cx = rGroup.x / rGroup.count;
                    const cz = rGroup.z / rGroup.count;

                    rGroup.systems.forEach(sys => {
                        if (sys.x2d === undefined) {
                            // Fallback for systems missing SDE position2D
                            const REGION_EXPANSION = 1.5;
                            // Ensure centroids are valid numbers
                            if (!isNaN(cx) && !isNaN(cz)) {
                                const expandedCx = cx * REGION_EXPANSION;
                                const expandedCz = cz * REGION_EXPANSION;
                                const dx = sys.baseX - cx;
                                const dz = sys.baseZ - cz;
                                sys.x2d = expandedCx + dx;
                                sys.z2d = expandedCz + dz;
                            } else {
                                sys.x2d = sys.baseX; sys.z2d = sys.baseZ; // Fallback to 3D coords flattened
                            }
                        }
                        
                        // Final Safety Check
                        if (isValidNumber(sys.x2d) && isValidNumber(sys.z2d)) {
                            pos2D.push(sys.x2d, 0, sys.z2d);
                            systems2D.push(sys);

                            let secColor = new THREE.Color();
                            if(sys.regionId === "10000070") secColor.setHex(0xe85d04);
                            else if(sys.regionId === "12000001") secColor.setHex(0x3b82f6);
                            else if(['10000004', '10000017', '10000019'].includes(sys.regionId)) secColor.setHex(0x00ced1);
                            else if(sys.sec >= 0.5) secColor.setHex(0x4ade80);
                            else if(sys.sec > 0) secColor.setHex(0xffaa00);
                            else secColor.setHex(0xef4444);

                            const rColor = getRegionColor(sys.regionId);
                            col2D.push(secColor.r, secColor.g, secColor.b);
                            regionCol2D.push(rColor.r, rColor.g, rColor.b);
                        }
                    });
                });

                // Calculate Layout Center for Home Button
                let centerX = 0, centerZ = 0, kCount = 0;
                systems2D.forEach(s => {
                    centerX += s.x2d || 0;
                    centerZ += s.z2d || 0;
                    kCount++;
                });
                if (kCount > 0) {
                    layoutCentersRef.current.REG = { x: centerX/kCount, z: centerZ/kCount };
                }

                // 4. Generate 2D Jump Lines (separate intra-regional from inter-regional)
                jLines.forEach(l => {
                    const c = l.split(',');
                    if (c.length < 4) return;
                    const s1 = sMap.get(c[2]);
                    const s2 = sMap.get(c[3]);

                    // Only draw if both systems have 2D coords (i.e., are K-Space)
                    if (s1 && s2 && isValidNumber(s1.x2d) && isValidNumber(s1.z2d) && isValidNumber(s2.x2d) && isValidNumber(s2.z2d)) {
                        const isInterRegional = s1.regionId !== s2.regionId;

                        if (isInterRegional) {
                            // Inter-regional jump: lighter color, will be dashed
                            linePos2DInterRegional.push(s1.x2d, 0, s1.z2d, s2.x2d, 0, s2.z2d);
                            lineCol2DInterRegional.push(interRegionalColor.r, interRegionalColor.g, interRegionalColor.b);
                            lineCol2DInterRegional.push(interRegionalColor.r, interRegionalColor.g, interRegionalColor.b);
                        } else {
                            // Intra-regional jump: normal color, solid
                            linePos2D.push(s1.x2d, 0, s1.z2d, s2.x2d, 0, s2.z2d);
                            lineCol2D.push(baseColor2D.r, baseColor2D.g, baseColor2D.b);
                            lineCol2D.push(baseColor2D.r, baseColor2D.g, baseColor2D.b);
                        }
                    }
                });

                // 5. Create 2D Meshes
                if (pos2D.length > 0) {
                    const geo2D = new THREE.BufferGeometry();
                    geo2D.setAttribute('position', new THREE.Float32BufferAttribute(pos2D, 3));
                    geo2D.setAttribute('color', new THREE.Float32BufferAttribute(col2D, 3));
                    geo2D.setAttribute('aRegionColor', new THREE.Float32BufferAttribute(regionCol2D, 3));

                    // Initialize aActive for 2D
                    const activeArr = new Float32Array(pos2D.length / 3).fill(1.0);
                    geo2D.setAttribute('aActive', new THREE.Float32BufferAttribute(activeArr, 1));

                    // Add pulse phase for circle animation
                    const pulsePhaseArr = new Float32Array(pos2D.length / 3);
                    for (let i = 0; i < pulsePhaseArr.length; i++) {
                        pulsePhaseArr[i] = Math.random() * Math.PI * 2;
                    }
                    geo2D.setAttribute('aPulsePhase', new THREE.Float32BufferAttribute(pulsePhaseArr, 1));

                    const mat2D = setup2DPointsMaterial();
                    const mesh2D = new THREE.Points(geo2D, mat2D);
                    mesh2D.userData = { systems: systems2D };
                    mesh2D.visible = false; // Hidden by default
                    scene.add(mesh2D);
                    galaxyMeshes2DRef.current.push(mesh2D);
                }

                // Intra-regional jumps (solid lines)
                if (linePos2D.length > 0) {
                    const lGeo2D = new THREE.BufferGeometry();
                    lGeo2D.setAttribute('position', new THREE.Float32BufferAttribute(linePos2D, 3));
                    lGeo2D.setAttribute('color', new THREE.Float32BufferAttribute(lineCol2D, 3));
                    const lMat2D = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false });
                    const lines2D = new THREE.LineSegments(lGeo2D, lMat2D);
                    lines2D.visible = false;
                    scene.add(lines2D);
                    lines2DRef.current = lines2D;
                }

                // Inter-regional jumps (dashed lines, lighter)
                if (linePos2DInterRegional.length > 0) {
                    const lGeo2DInter = new THREE.BufferGeometry();
                    lGeo2DInter.setAttribute('position', new THREE.Float32BufferAttribute(linePos2DInterRegional, 3));
                    lGeo2DInter.setAttribute('color', new THREE.Float32BufferAttribute(lineCol2DInterRegional, 3));
                    const lMat2DInter = new THREE.LineDashedMaterial({
                        vertexColors: true,
                        transparent: true,
                        opacity: 0.2, // More subtle than intra-regional
                        depthWrite: false,
                        dashSize: 8,
                        gapSize: 6
                    });
                    const lines2DInter = new THREE.LineSegments(lGeo2DInter, lMat2DInter);
                    lines2DInter.computeLineDistances(); // Required for dashed lines
                    lines2DInter.visible = false;
                    scene.add(lines2DInter);
                    lines2DInterRegionalRef.current = lines2DInter;
                }

                setStatus("Connected."); setSystemsLoaded(true);
            } catch(e) { console.error(e); setStatus("Error loading data"); }
        };
        loadData();
        const handleResize = () => { if(!containerRef.current) return; const w = containerRef.current.clientWidth; const h = containerRef.current.clientHeight; pCam.aspect = w/h; pCam.updateProjectionMatrix(); renderer.setSize(w, h); composer.setSize(w, h); };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            renderer.domElement.removeEventListener('wheel', handleWheel);
            if (containerRef.current && renderer.domElement) containerRef.current.removeChild(renderer.domElement);
            composer.dispose();
            renderTarget.dispose();
            renderer.dispose();
        };
    }, [initAttempt]);

    return (
        <>
            <div ref={starmapContainerRef} className={`starmap-container ${isFullscreen ? 'fullscreen' : ''} ${theme}`}>
                <button className="fullscreen-btn" onClick={toggleFullscreen} title="Fullscreen">⛶</button>
                {/* DEBUG: Camera position readout */}
                <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    background: 'rgba(10, 10, 15, 0.6)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontFamily: 'monospace',
                    fontSize: '9px',
                    color: 'rgba(255,255,255,0.4)',
                    zIndex: 100,
                    pointerEvents: 'none'
                }}>
                    <span style={{color: 'rgba(100,200,255,0.5)'}}>CAM:</span> {debugInfo.camPos.x}, {debugInfo.camPos.y}, {debugInfo.camPos.z}
                    <span style={{marginLeft: '8px', color: 'rgba(200,100,255,0.5)'}}>LOOK:</span> {debugInfo.lookAt.x}, {debugInfo.lookAt.y}, {debugInfo.lookAt.z}
                </div>
                
                {/* VIEW PANEL (Top Center) */}
                <div className="view-panel">
                    {savedViews.filter(view => !!view.is2D === is2D).map(view => (
                        <button 
                            key={view.id}
                            className={`view-btn ${activeViewId === view.id ? 'active' : ''}`} 
                            onClick={() => handleGoToView(view)}
                            onContextMenu={(e) => handleViewContextMenu(e, view)}
                            title={`${view.name} (Right-click to Manage)`}
                        >
                            {view.name}
                            {view.shortcut && <span className="view-shortcut">{view.shortcut}</span>}
                        </button>
                    ))}
                    <button className="view-btn add-view-btn" onClick={handleCreateView} title="Save Current View">+</button>
                </div>

                <div className="control-bar">
                    <div className="divider" />
                    <button className={`map-btn ${resetActive ? 'active' : ''}`} onClick={handleResetView} title="Go to Home View">
                        <HomeIcon size={16} />
                    </button>
                    <div className="divider" />
                    <button 
                        className={`map-btn blue ${!is2D ? 'active' : ''}`} 
                        disabled={!is2D}
                        onClick={() => setIs2D(false)} 
                        title="3D View"
                    >
                        3D
                    </button>
                    
                    {!is2D ? (
                        <button
                            className="map-btn blue"
                            onClick={() => {
                                handleGoToView(savedViews.find(v => v.id === 'strategic'));
                            }}
                            title="2D View"
                        >
                            2D
                        </button>
                    ) : (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '2px', width: '100%'}}>
                            <button
                                className={`map-btn blue active`}
                                onClick={toggleLayoutMode}
                                title={layoutMode === 'REG' ? "Regional Map (CCP 2D Layout) - Click to toggle to Flat Mode" : "Flat Mode (Locked Top-Down) - Click to toggle to Regional Map"}
                                style={{fontSize: '9px', height: '20px'}}
                            >
                                {layoutMode === 'REG' ? 'REG' : 'FLAT'}
                            </button>
                            <button
                                className="map-btn"
                                disabled
                                style={{fontSize: '9px', height: '20px', opacity: 0.35, cursor: 'default'}}
                                title="Mapping Mode (Coming Soon - Similar to Pathfinder)"
                            >
                                MAP
                            </button>
                        </div>
                    )}
                    
                    <div className="divider" />
                    <button className={`map-btn blue ${regionMode !== 'TAC' ? 'active' : ''}`} onClick={toggleRegionMode} title="Toggle Region Mode: Tactical / Dynamic / Nebula">
                        <Layers size={16} /> <span style={{marginLeft:'4px', fontSize:'9px'}}>{regionMode}</span>
                    </button>
                    
                    <div className="divider" />
                    <button 
                        className={`map-btn blue ${isHD ? 'active' : ''}`} 
                        onClick={() => setIsHD(!isHD)} 
                        title={isHD ? "HD Mode Enabled (Bloom + Effects)" : "SD Mode Enabled (Performance)"}
                    >
                        <Zap size={16} /> <span style={{marginLeft:'4px', fontSize:'9px'}}>{isHD ? 'HD' : 'SD'}</span>
                    </button>

                    <div className="divider" />
                    <button className={`map-btn ${showSettingsPanel ? 'active' : ''}`} onClick={() => setShowSettingsPanel(!showSettingsPanel)} title="Settings">
                        <Settings size={16} />
                    </button>
                    
                    {is2D && (
                        <>
                            <div className="divider" />
                            <button className="map-btn alert" onClick={handleClearCards} title="Clear All Cards">
                                <XCircle size={16} />
                            </button>
                        </>
                    )}
                </div>
                {showSettingsPanel && (
                    <div className="settings-panel">
                        <div className="settings-row">
                            <span className="settings-label">Auto Reset</span>
                            <button 
                                className={`map-btn ${idleResetEnabled ? 'active' : ''}`} 
                                onClick={() => setIdleResetEnabled(!idleResetEnabled)} 
                                title={idleResetEnabled ? "Auto-Reset View Enabled" : "Auto-Reset View Disabled"}
                            >
                                <Clock size={16} />
                            </button>
                            {idleResetEnabled && (
                                <select className="map-selector" onChange={(e) => setIdleResetTime(parseInt(e.target.value))} value={idleResetTime} title="Idle timeout">
                                    <option value="15">15s</option> <option value="30">30s</option> <option value="60">1m</option> <option value="120">2m</option> <option value="300">5m</option>
                                </select>
                            )}
                        </div>
                        <div className="settings-row">
                            <span className="settings-label">Auto Camera</span>
                            <button className={`map-btn alert ${isAutoLocate ? 'active' : ''}`} onClick={() => setIsAutoLocate(!isAutoLocate)} title={isAutoLocate ? "Auto-Camera Active" : "Enable Auto-Camera"}><Video size={16} /></button>
                            {isAutoLocate && (
                                <select className="map-selector" onChange={(e) => setAutoLocateCriteria(e.target.value)} value={autoLocateCriteria}>
                                    <option value="all">ANY</option> <option value="1b">&gt; 1B</option> <option value="5b">&gt; 5B</option> <option value="caps">CAPS</option>
                                </select>
                            )}
                        </div>
                        <div className="settings-row">
                            <span className="settings-label">History Limit</span>
                            <select className="map-selector" onChange={(e) => setKillMarkerLimit(parseInt(e.target.value))} value={killMarkerLimit} title="Number of kill markers to show">
                                <option value="10">10</option> <option value="25">25</option> <option value="50">50</option> <option value="75">75</option> <option value="100">100</option>
                            </select>
                        </div>
                        <div className="settings-row">
                            <span className="settings-label">History Time</span>
                            <select className="map-selector" onChange={(e) => setKillMarkerTimeLimit(parseInt(e.target.value))} value={killMarkerTimeLimit} title="Time window for kill markers">
                                <option value="15">15m</option> <option value="30">30m</option> <option value="60">1h</option> <option value="90">1.5h</option> <option value="120">2h</option>
                            </select>
                        </div>
                        <div className="settings-row">
                            <span className="settings-label">Brightness</span>
                            <input
                                type="range"
                                min="0.3"
                                max="2.0"
                                step="0.1"
                                value={brightness}
                                onChange={(e) => setBrightness(parseFloat(e.target.value))}
                                style={{flex: 1, marginLeft: '8px'}}
                                title={`Adjust color intensity (${brightness.toFixed(1)}x)`}
                            />
                            <span style={{marginLeft: '8px', fontSize: '11px', opacity: 0.7}}>{brightness.toFixed(1)}x</span>
                        </div>
                        {is2D && (
                            <div className="settings-row">
                                <span className="settings-label">2D Card Time</span>
                                <select className="map-selector" onChange={(e) => setKillCardLifespan2D(parseInt(e.target.value))} value={killCardLifespan2D} title="Lifespan of kill cards in 2D mode">
                                    <option value="30">30s</option> <option value="60">1m</option> <option value="120">2m</option> <option value="300">5m</option> <option value="600">10m</option>
                                </select>
                            </div>
                        )}
                    </div>
                )}
                {/* SYSTEM SEARCH BAR */}
                <div className="system-search">
                    <div className="search-bar-wrap">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="SEARCH SYSTEM..."
                            value={searchTerm}
                            onChange={onSearchChange}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') handleSystemSearch();
                            }}
                            onKeyUp={(e) => e.stopPropagation()}
                        />
                        <button className="search-btn" onClick={() => handleSystemSearch()}>
                            <Search size={14} />
                        </button>
                    </div>
                    <button 
                        className={`map-btn ${showControls ? 'active' : ''}`} 
                        onClick={() => setShowControls(!showControls)} 
                        title="Controls Guide"
                        style={{ width: '36px', marginLeft: '8px', height: '100%', padding: 0, flexShrink: 0 }}
                    >
                        <HelpIcon size={16} />
                    </button>
                    {searchActive && searchResults.length > 0 && (
                        <div className="search-results">
                            {searchResults.map((sys, index) => (
                                <div 
                                    key={`${sys.id}-${index}`}
                                    className="search-result-item"
                                    onClick={() => handleSystemSearch(sys.name)}
                                >
                                    {sys.type === 'region' ? <span style={{color:'#f59e0b'}}>[REG] </span> : ''}
                                    {sys.name} 
                                    {sys.type === 'system' && <span style={{color:'#666', fontSize:'10px'}}> ({sys.sec.toFixed(1)})</span>}
                                </div>
                            ))}
                        </div>
                    )}
                    {showControls && (
                        <div className="nav-guide">
                            <div className="nav-header">Flight Controls</div>
                            <div className="nav-row"><span>WASD</span> Horizontal Move</div>
                            <div className="nav-row"><span>↑ / ↓</span> Vertical Move</div>
                            <div className="nav-row"><span>← / →</span> Rotate Camera</div>
                            <div className="nav-row"><span>SHIFT</span> Turbo Boost</div>
                            <div className="nav-row"><span>L-CLICK</span> Select System</div>
                            <div className="nav-row"><span>R-CLICK</span> Pan Camera</div>
                            <div className="nav-row"><span>DBL-CLICK</span> Focus System</div>
                            <div className="nav-row"><span>F</span> Focus Hover</div>
                            <div className="nav-row"><span>H</span> Home View</div>
                            <div className="nav-row"><span>R</span> Region Mode</div>
                            <div className="nav-row"><span>ESC</span> Clear Selection</div>
                        </div>
                    )}
                </div>

                {/* TRACKING INDICATOR */}
                {!is2D && (selectedSystem || activeKillId) && (
                    <div style={{
                        position: 'absolute',
                        bottom: '80px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        pointerEvents: 'auto',
                        zIndex: 40,
                        cursor: 'pointer'
                    }}
                    onClick={() => {
                        setActiveKillId(null);
                        setSelectedSystem(null);
                        setSystemIntel(null);
                        if (card3DGroupRef.current) {
                            card3DGroupRef.current.clear();
                            cardsBySystemRef.current.clear(); flipAnimRef.current = null; hoveredKillCardGroupRef.current = null;
                            activeCardRef.current = null;
                        }
                        isAutoPiling.current = false;
                    }}>
                        <div style={{
                            color: '#4ade80',
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            letterSpacing: '2px',
                            animation: 'pulse-text 2s infinite'
                        }}>
                            [ TRACKING ACTIVE ]
                        </div>
                        <div style={{
                            color: '#666',
                            fontSize: '9px',
                            fontFamily: '"Segoe UI", sans-serif',
                            textTransform: 'uppercase'
                        }}>
                            Press ESC or Click to Release
                        </div>
                    </div>
                )}

                <div ref={containerRef} style={{ width: '100%', height: '100%' }} onPointerMove={handlePointerMove} onDoubleClick={handleDoubleClick} />
                
                {/* DYNAMIC WIDTH FEED CONTAINER */}
                <div className="kill-feed-container" style={{ width: feedWidth }}>
                    {/* DRAG HANDLE */}
                    <div 
                        className={`resize-handle ${isDragging ? 'dragging' : ''}`}
                        onMouseDown={() => setIsDragging(true)}
                    />
                    
                    <div className="feed-header">INTELLIGENCE FEED</div>
                    <div className="feed-scroll" ref={feedScrollRef} onScroll={handleFeedScroll}>
                        {formattedKillFeed.filter(k => {
                            if (is2D && (isAnoikisRegion(k.regionId) || k.regionId === '12000001')) return false;
                            if (hideAnoikis && isAnoikisRegion(k.regionId)) return false;
                            if (hideKSpace && !isAnoikisRegion(k.regionId) && k.regionId !== '12000001') return false;
                            if (hideAbyssal && k.regionId === '12000001') return false;
                            return true;
                        }).map((k, index) => {
                            const isOpened = activeKillId === k.id;
                            const isHovered = hoveredKillId === k.id;
                            let borderStyle = `3px solid ${getBorderColor(k.rawVal)}`;
                            let extraStyle = {};
                            if (isOpened) { borderStyle = `4px solid #fff`; extraStyle = { boxShadow: `0 0 10px ${getBorderColor(k.rawVal)}` }; } 
                            else if (isHovered) { borderStyle = `3px solid #aaa`; }
                            const killerEmblem = getEmblemUrl(k.killerAllianceId, k.killerCorpId);
                            const victimEmblem = getEmblemUrl(k.victimAllianceId, k.victimCorpId);
                            
                            // RESPONSIVE LOGIC
                            const showNames = feedWidth > 350;
                            const showCorp = feedWidth > 500;
                            const showWeapon = feedWidth > 650;
                            
                            const isCompact = feedWidth < 220;
                            const columnGap = isCompact ? '0px' : '8px';
                            const mainGap = isCompact ? 0 : 4;

                            return (
                                <div id={`kill-item-${k.id}`} key={`${k.id}-${index}`} className={`kill-item ${k.rawVal > 30000000000 ? 'high-val' : ''} ${isOpened ? 'active-pulse' : ''}`} onClick={() => handleFeedClick(k)} onContextMenu={(e) => handleFeedContextMenu(e, k)} onMouseEnter={() => setHoveredKillId(k.id)} onMouseLeave={() => setHoveredKillId(null)} style={{ borderLeft: borderStyle, background: getSecBg(k.sec, isHovered || isOpened), gap: mainGap, ...extraStyle }}>
                                    
                                    {/* VICTIM GROUP (Left) */}
                                    <div style={{display:'flex', gap: columnGap, alignItems:'center', flex: 1, minWidth: 0}}>
                                        <div className="feed-img-wrap"> 
                                            <img className="kill-ship-icon" src={`https://images.evetech.net/types/${k.shipId}/icon?size=32`} style={{borderColor: '#ef4444'}} title={formatClass(k.shipClass)} alt="" onError={(e) => { e.target.style.display = 'none'; }} /> 
                                            {victimEmblem && <div className="feed-sub-icon" style={{backgroundImage:`url(${victimEmblem})`}} />}
                                        </div>
                                        {/* OPTIONAL DETAILS */}
                                        {showNames && (
                                            <div className="kill-text-col" style={{textAlign:'left', alignItems:'flex-start'}}>
                                                <div className="kill-name" style={{color:'#ef4444'}} title={k.pilot}>{k.pilot}</div>
                                                {showCorp && isValidText(k.victimCorp) && <div className="kill-corp" title={k.victimCorp}>{k.victimCorp}</div>}
                                            </div>
                                        )}
                                    </div>

                                    {/* CENTER INFO */}
                                    <div className="kill-mid" style={{flex: '0 0 auto'}}> 
                                        <span style={{ color: getBorderColor(k.rawVal), fontSize: 10, fontWeight: 'bold' }}> {k.value}<span className="eng-note">{k.valueSuffix}</span> </span> 
                                        <TimeAgo timestamp={k.timestamp} /> 
                                        <div className="sys-pill" style={{ color: k.secColor, borderColor: k.secColor }}> {k.system} </div> 
                                    </div>
                                    
                                    {/* KILLER GROUP (Right) */}
                                    <div style={{display:'flex', gap: columnGap, alignItems:'center', justifyContent:'flex-end', flex: 1, minWidth: 0}}>
                                        {/* OPTIONAL DETAILS */}
                                        {showNames && (
                                            <div className="kill-text-col" style={{textAlign:'right', alignItems:'flex-end'}}>
                                                <div className="kill-name" style={{color:'#4ade80'}} title={k.killer}>{k.killer}</div>
                                                {showCorp && isValidText(k.killerCorp) && <div className="kill-corp" title={k.killerCorp}>{k.killerCorp}</div>}
                                                {showWeapon && isValidText(k.finalBlowWeapon) && <div style={{fontSize:'8px', fontStyle:'italic', color:'#666', marginTop:'1px'}}>{k.finalBlowWeapon}</div>}
                                            </div>
                                        )}
                                        <div className="feed-img-wrap" style={{flexShrink:0}}> 
                                            <img className="kill-ship-icon" src={`https://images.evetech.net/types/${k.killerShipId}/icon?size=32`} style={{borderColor: '#4ade80'}} alt="" onError={(e) => { e.target.style.display = 'none'; }} /> 
                                            {killerEmblem && <div className="feed-sub-icon" style={{backgroundImage:`url(${killerEmblem})`}} />}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                {selectedSystem && (
                    <div className="system-intel-card">
                        <button className="intel-close-btn" onClick={() => {
                            setSelectedSystem(null);
                            setSystemIntel(null);
                            setActiveKillId(null);
                            if (card3DGroupRef.current) {
                                card3DGroupRef.current.clear();
                                cardsBySystemRef.current.clear(); flipAnimRef.current = null; hoveredKillCardGroupRef.current = null;
                                activeCardRef.current = null;
                            }
                            isAutoPiling.current = false;
                        }}>×</button>
                        <div className="intel-header"> <h3 className="intel-system-name">{selectedSystem.name}</h3> <span className="intel-sec" style={{ color: getSecColor(selectedSystem.sec) }}> {selectedSystem.sec.toFixed(2)} </span> </div>
                        <div className="intel-region">{selectedSystem.regionName}</div>
                        {systemIntel === null ? ( <div className="intel-loading">Loading intel...</div> ) : systemIntel?.report ? (
                            <>
                                {systemIntel.report.executive_summary?.threat_level && ( <div className={`intel-threat-badge threat-${systemIntel.report.executive_summary.threat_level}`}> {systemIntel.report.executive_summary.threat_level.toUpperCase()} THREAT </div> )}
                                {systemIntel.report.executive_summary?.sovereignty && systemIntel.report.executive_summary.sovereignty !== 'Unclaimed' && ( <div className="intel-sovereignty"> SOVEREIGNTY: <span className="intel-sov-name">{systemIntel.report.executive_summary.sovereignty}</span> </div> )}
                                <div className="intel-stats"> <div className="intel-stat"> <span className="intel-stat-label">24H KILLS</span> <span className="intel-stat-value" style={{color: '#ef4444'}}>{systemIntel.report.threat_intelligence?.kills_last_24h || 0}</span> </div> <div className="intel-stat"> <span className="intel-stat-label">1H KILLS</span> <span className="intel-stat-value" style={{color: '#f59e0b'}}>{systemIntel.report.threat_intelligence?.kills_last_1h || 0}</span> </div> <div className="intel-stat"> <span className="intel-stat-label">ISK LOST (24H)</span> <span className="intel-stat-value">{formatIsk(systemIntel.report.threat_intelligence?.value_destroyed_24h_isk || 0).number}{formatIsk(systemIntel.report.threat_intelligence?.value_destroyed_24h_isk || 0).suffix}</span> </div> <div className="intel-stat"> <span className="intel-stat-label">SECURITY</span> <span className="intel-stat-value">{systemIntel.report.executive_summary?.security_class || 'N/A'}</span> </div> </div>
                                <div className="intel-list"> <h4 className="intel-list-title">TOP HUNTERS (24H)</h4> {systemIntel.report.threat_intelligence?.top_hunters?.top_hunter_corps?.length > 0 ? ( systemIntel.report.threat_intelligence.top_hunters.top_hunter_corps.slice(0, 5).map((corp, i) => ( <div key={i} className="intel-hunter-row"> <span className="intel-hunter-name">{corp.name}</span> <span className="intel-hunter-count">{corp.count} kills</span> </div> )) ) : ( <div className="intel-no-data">No data available</div> )} </div>
                                <div className="intel-list"> <h4 className="intel-list-title">DANGEROUS SHIPS</h4> {systemIntel.report.threat_intelligence?.top_hunters?.top_victim_ships?.length > 0 ? ( systemIntel.report.threat_intelligence.top_hunters.top_victim_ships.slice(0, 5).map((ship, i) => ( <div key={i} className="intel-hunter-row"> <span className="intel-ship-name">{ship.name}</span> <span className="intel-hunter-count">{ship.count} losses</span> </div> )) ) : ( <div className="intel-no-data">No data available</div> )} </div>
                                {systemIntel.isFallback && ( <div className="intel-fallback-notice">Using cached data</div> )}
                            </>
                        ) : ( <div className="intel-unavailable">No intel available</div> )}
                        <a className="intel-zkill-link" href={`https://zkillboard.com/system/${selectedSystem.id}/`} target="_blank" rel="noopener noreferrer"> View on zKillboard </a>
                    </div>
                )}
                {/* KILL MARKER HOVER TOOLTIP */}
                {hoveredKillMarker && (
                    <div className="kill-marker-tooltip" ref={tooltipRef} style={{
                        position: 'absolute',
                        top: (hoveredKillMarker.y + 15) + 'px',
                        left: hoveredKillMarker.x + 'px',
                        transform: 'translateX(-50%)',
                        background: 'rgba(10, 10, 15, 0.95)',
                        border: `1px solid ${hoveredKillMarker.colorHex}`,
                        borderRadius: '8px',
                        padding: '12px 16px',
                        minWidth: '280px',
                        maxWidth: '400px',
                        zIndex: 1000,
                        boxShadow: `0 0 20px ${hoveredKillMarker.colorHex}40`,
                        pointerEvents: 'none'
                    }}>
                        {/* Header: System name + sec */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '6px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#fff' }}>{hoveredKillMarker.systemName}</span>
                            <span style={{ color: getSecColor(hoveredKillMarker.systemData?.sec || 0), fontSize: '12px', fontWeight: 'bold' }}>
                                {(hoveredKillMarker.systemData?.sec || 0).toFixed(2)}
                            </span>
                        </div>

                        {/* Most Recent Kill */}
                        <div style={{ marginBottom: '6px' }}>
                            <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase', marginBottom: '2px' }}>Most Recent</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img
                                    src={`https://images.evetech.net/types/${hoveredKillMarker.newestKill.shipId}/icon?size=32`}
                                    style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #ef4444' }}
                                    alt=""
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '11px', color: '#ef4444' }}>{hoveredKillMarker.newestKill.pilot}</div>
                                    <div style={{ fontSize: '10px', color: '#888' }}>{formatClass(hoveredKillMarker.newestKill.shipClass)}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '11px', color: getBorderColor(hoveredKillMarker.newestKill.rawVal), fontWeight: 'bold' }}>
                                        {formatIsk(hoveredKillMarker.newestKill.rawVal).number}{formatIsk(hoveredKillMarker.newestKill.rawVal).suffix}
                                    </div>
                                    <div style={{ fontSize: '9px', color: '#666' }}>{getTimeAgo(hoveredKillMarker.newestKill.timestamp)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Biggest Kill (if different from newest) */}
                        {hoveredKillMarker.primaryKill.id !== hoveredKillMarker.newestKill.id && (
                            <div style={{ marginBottom: '6px' }}>
                                <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase', marginBottom: '2px' }}>Highest Value</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <img
                                        src={`https://images.evetech.net/types/${hoveredKillMarker.primaryKill.shipId}/icon?size=32`}
                                        style={{ width: '24px', height: '24px', borderRadius: '4px', border: `1px solid ${hoveredKillMarker.colorHex}` }}
                                        alt=""
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '11px', color: '#ef4444' }}>{hoveredKillMarker.primaryKill.pilot}</div>
                                        <div style={{ fontSize: '10px', color: '#888' }}>{formatClass(hoveredKillMarker.primaryKill.shipClass)}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '11px', color: getBorderColor(hoveredKillMarker.primaryKill.rawVal), fontWeight: 'bold' }}>
                                            {formatIsk(hoveredKillMarker.primaryKill.rawVal).number}{formatIsk(hoveredKillMarker.primaryKill.rawVal).suffix}
                                        </div>
                                        <div style={{ fontSize: '9px', color: '#666' }}>{getTimeAgo(hoveredKillMarker.primaryKill.timestamp)}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Total Summary */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '8px',
                            paddingTop: '6px',
                            borderTop: '1px solid #333',
                            fontSize: '11px'
                        }}>
                            <span style={{ color: '#aaa' }}>
                                {hoveredKillMarker.killCount} kill{hoveredKillMarker.killCount > 1 ? 's' : ''} in system
                            </span>
                            <span style={{ color: hoveredKillMarker.colorHex, fontWeight: 'bold' }}>
                                {formatIsk(hoveredKillMarker.totalValue).number}{formatIsk(hoveredKillMarker.totalValue).suffix} total
                            </span>
                        </div>
                    </div>
                )}

                {/* KILL CARD SCROLL HINT TOOLTIP */}
                {hoveredKillCardTooltip && (
                    <div style={{
                        position: 'absolute',
                        top: (hoveredKillCardTooltip.y - 44) + 'px',
                        left: hoveredKillCardTooltip.x + 'px',
                        transform: 'translateX(-50%)',
                        background: 'rgba(10, 10, 20, 0.92)',
                        border: '1px solid #60a5fa',
                        borderRadius: '6px',
                        padding: '5px 12px',
                        color: '#60a5fa',
                        fontSize: '11px',
                        fontWeight: '500',
                        letterSpacing: '0.03em',
                        zIndex: 1001,
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 0 12px #60a5fa40',
                    }}>
                        ↑↓ Scroll to flip · {hoveredKillCardTooltip.count} kills
                    </div>
                )}
            </div>

            {/* FEED CONTEXT MENU */}
            {feedContextMenu && createPortal(
                <div
                    className="feed-context-menu"
                    style={{ top: feedContextMenu.y, left: feedContextMenu.x }}
                    ref={feedMenuRef}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="context-header">Killmail #{feedContextMenu.kill.id}</div>
                    <div className="context-item" onClick={() => openLink(`https://zkillboard.com/kill/${feedContextMenu.kill.id}/`)}>Open in zKillboard</div>
                    <div className="context-item" onClick={() => { navigator.clipboard.writeText(`https://zkillboard.com/kill/${feedContextMenu.kill.id}/`); setFeedContextMenu(null); }}>Copy Link</div>
                    <div className="context-item" onClick={() => openLink(`https://zkillboard.com/kill/${feedContextMenu.kill.id}/`)}>View Fitting</div>

                    <div className="context-separator"></div>

                    {/* VICTIM SUBMENU */}
                    <div className={`context-submenu ${openSubmenu === 'victim' ? 'open' : ''}`}>
                        <div className="context-submenu-header" onClick={() => setOpenSubmenu(openSubmenu === 'victim' ? null : 'victim')}>
                            <span className="submenu-arrow">{openSubmenu === 'victim' ? '▼' : '▶'}</span>
                            <span className="submenu-label" style={{color:'#ef4444'}}>Victim:</span>
                            <span className="submenu-name">{feedContextMenu.kill.pilot}</span>
                        </div>
                        {openSubmenu === 'victim' && (
                            <div className="context-submenu-items">
                                {feedContextMenu.kill.pilotId && (
                                    <>
                                        <div className="context-item sub" onClick={() => openLink(`https://zkillboard.com/character/${feedContextMenu.kill.pilotId}/`)}>zKillboard</div>
                                        <div className="context-item sub" onClick={() => openLink(`https://evewho.com/character/${feedContextMenu.kill.pilotId}`)}>EveWho</div>
                                    </>
                                )}
                                {feedContextMenu.kill.victimCorpId && (
                                    <div className="context-item sub" onClick={() => openLink(`https://zkillboard.com/corporation/${feedContextMenu.kill.victimCorpId}/`)}>Corp: {feedContextMenu.kill.victimCorp}</div>
                                )}
                                {feedContextMenu.kill.victimAllianceId && (
                                    <div className="context-item sub" onClick={() => openLink(`https://zkillboard.com/alliance/${feedContextMenu.kill.victimAllianceId}/`)}>Alliance: {feedContextMenu.kill.victimAlliance}</div>
                                )}
                                {feedContextMenu.kill.victimAllianceId && !trackedAlliances.some(ta => String(ta.id) === String(feedContextMenu.kill.victimAllianceId)) && (
                                    <div className="context-item sub context-item-action" onClick={() => { addAlliance({ id: feedContextMenu.kill.victimAllianceId, name: feedContextMenu.kill.victimAlliance }); setFeedContextMenu(null); }}>
                                        <span>+</span> Track Alliance
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* KILLER SUBMENU */}
                    {!feedContextMenu.kill.isNpc && (
                        <div className={`context-submenu ${openSubmenu === 'killer' ? 'open' : ''}`}>
                            <div className="context-submenu-header" onClick={() => setOpenSubmenu(openSubmenu === 'killer' ? null : 'killer')}>
                                <span className="submenu-arrow">{openSubmenu === 'killer' ? '▼' : '▶'}</span>
                                <span className="submenu-label" style={{color:'#4ade80'}}>Killer:</span>
                                <span className="submenu-name">{feedContextMenu.kill.killer}</span>
                            </div>
                            {openSubmenu === 'killer' && (
                                <div className="context-submenu-items">
                                    {feedContextMenu.kill.killerId && (
                                        <>
                                            <div className="context-item sub" onClick={() => openLink(`https://zkillboard.com/character/${feedContextMenu.kill.killerId}/`)}>zKillboard</div>
                                            <div className="context-item sub" onClick={() => openLink(`https://evewho.com/character/${feedContextMenu.kill.killerId}`)}>EveWho</div>
                                        </>
                                    )}
                                    {feedContextMenu.kill.killerCorpId && (
                                        <div className="context-item sub" onClick={() => openLink(`https://zkillboard.com/corporation/${feedContextMenu.kill.killerCorpId}/`)}>Corp: {feedContextMenu.kill.killerCorp}</div>
                                    )}
                                    {feedContextMenu.kill.killerAllianceId && (
                                        <div className="context-item sub" onClick={() => openLink(`https://zkillboard.com/alliance/${feedContextMenu.kill.killerAllianceId}/`)}>Alliance: {feedContextMenu.kill.killerAlliance}</div>
                                    )}
                                    {feedContextMenu.kill.killerAllianceId && !trackedAlliances.some(ta => String(ta.id) === String(feedContextMenu.kill.killerAllianceId)) && (
                                        <div className="context-item sub context-item-action" onClick={() => { addAlliance({ id: feedContextMenu.kill.killerAllianceId, name: feedContextMenu.kill.killerAlliance }); setFeedContextMenu(null); }}>
                                            <span>+</span> Track Alliance
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* SYSTEM SUBMENU */}
                    <div className={`context-submenu ${openSubmenu === 'system' ? 'open' : ''}`}>
                        <div className="context-submenu-header" onClick={() => setOpenSubmenu(openSubmenu === 'system' ? null : 'system')}>
                            <span className="submenu-arrow">{openSubmenu === 'system' ? '▼' : '▶'}</span>
                            <span className="submenu-label">System:</span>
                            <span className="submenu-name">{feedContextMenu.kill.system}</span>
                        </div>
                        {openSubmenu === 'system' && (
                            <div className="context-submenu-items">
                                <div className="context-item sub" onClick={() => { navigator.clipboard.writeText(feedContextMenu.kill.system); setFeedContextMenu(null); }}>Copy Name</div>
                                {feedContextMenu.kill.systemId && (
                                    <div className="context-item sub" onClick={() => openLink(`https://zkillboard.com/system/${feedContextMenu.kill.systemId}/`)}>zKillboard</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            , document.body)}

            {/* VIEW CONTEXT MENU */}
            {viewContextMenu && createPortal(
                <div className="feed-context-menu" style={{ top: viewContextMenu.y, left: viewContextMenu.x }} onClick={(e) => e.stopPropagation()}>
                    <div className="context-header">Manage View: {viewContextMenu.view.name}</div>
                    <div className="context-item" onClick={handleSaveView}>Update with Current Position</div>
                    
                    {/* Visibility Options for Custom Views */}
                    {!DEFAULT_VIEWS.some(v => v.id === viewContextMenu.view.id) && !viewContextMenu.view.is2D && (
                        <>
                            <div className="context-separator"></div>
                            <div className="context-header">Visibility</div>
                            <div className="context-item" onClick={() => handleToggleViewVisibility(viewContextMenu.view, 'kspace')}>
                                {viewContextMenu.view.visibility?.hideKSpace ? 'Show' : 'Hide'} New Eden
                            </div>
                            <div className="context-item" onClick={() => handleToggleViewVisibility(viewContextMenu.view, 'anoikis')}>
                                {viewContextMenu.view.visibility?.hideAnoikis ? 'Show' : 'Hide'} Anoikis
                            </div>
                            <div className="context-item" onClick={() => handleToggleViewVisibility(viewContextMenu.view, 'abyssal')}>
                                {viewContextMenu.view.visibility?.hideAbyssal ? 'Show' : 'Hide'} Abyssal
                            </div>
                            <div className="context-separator"></div>
                        </>
                    )}

                    {DEFAULT_VIEWS.some(v => v.id === viewContextMenu.view.id) ? (
                        <div className="context-item" onClick={handleResetViewToDefault}>Reset to Default</div>
                    ) : (
                        <div className="context-item" onClick={handleDeleteView} style={{color: '#ef4444'}}>Delete View</div>
                    )}
                </div>
            , document.body)}
        </>
    );
}
