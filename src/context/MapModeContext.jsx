import React, { createContext, useState, useContext, useEffect } from 'react';

const MapModeContext = createContext();

export function useMapMode() {
  return useContext(MapModeContext);
}

// Helper to update URL without page reload
const updateUrlParam = (viewMap) => {
  const url = new URL(window.location);
  if (viewMap) {
    url.searchParams.set('view', 'map');
  } else {
    url.searchParams.delete('view');
  }
  window.history.replaceState({}, '', url);
};

export function MapModeProvider({ children }) {
  const [mapMode, setMapMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setMapMode(false);
        updateUrlParam(false);
      }
    };

    // Check URL param on mount
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const mobile = window.innerWidth < 768;

    if (viewParam === 'map' && !mobile) {
      setMapMode(true);
    }

    // Check on mount
    checkMobile();

    // Check on resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleMapMode = () => {
    if (isMobile) return; // Prevent enabling on mobile
    setMapMode(prevMapMode => {
      const newMode = !prevMapMode;
      updateUrlParam(newMode);
      return newMode;
    });
  };

  const setMapModeSafe = (value) => {
    if (isMobile && value === true) return;
    setMapMode(value);
    updateUrlParam(value);
  }

  return (
    <MapModeContext.Provider value={{ mapMode, setMapMode: setMapModeSafe, toggleMapMode, isMobile }}>
      {children}
    </MapModeContext.Provider>
  );
}
