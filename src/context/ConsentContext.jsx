import { createContext, useContext, useState, useEffect } from 'react';

const ConsentContext = createContext();

const GA_ID = 'G-SD80ZQ01XR';

const initializeGA = () => {
  if (document.getElementById('ga-script')) return;
  const script1 = document.createElement('script');
  script1.id = 'ga-script';
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script1);

  const script2 = document.createElement('script');
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_ID}');
  `;
  document.head.appendChild(script2);
};

export const ConsentProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBannerOpen, setIsBannerOpen] = useState(false);

  useEffect(() => {
    // Check local storage on load
    const consent = localStorage.getItem('alfred_cookie_accepted');
    if (consent === 'true') {
      setIsAuthenticated(true);
      setIsBannerOpen(false);
      initializeGA();
    } else {
      setIsAuthenticated(false);
      setIsBannerOpen(true); // Force open if not accepted yet
    }
  }, []);

  const authenticate = () => {
    localStorage.setItem('alfred_cookie_accepted', 'true');
    window['ga-disable-' + GA_ID] = false;
    setIsAuthenticated(true);
    setIsBannerOpen(false);
    initializeGA();
  };

  const reject = () => {
    window['ga-disable-' + GA_ID] = true;
    setIsAuthenticated(false); // Remains unauthenticated
    setIsBannerOpen(false);    // Allow them to see the app (restricted mode)
  };

  const promptAuth = () => {
    setIsBannerOpen(true); // Re-open the modal
  };

  return (
    <ConsentContext.Provider value={{ isAuthenticated, isBannerOpen, authenticate, reject, promptAuth }}>
      {children}
    </ConsentContext.Provider>
  );
};

export const useConsent = () => useContext(ConsentContext);
