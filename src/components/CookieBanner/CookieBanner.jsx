import { createPortal } from 'react-dom';
import { useConsent } from '../../context/ConsentContext';
import './CookieBanner.css';

const CookieIcon = ({ size = 32, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10"></circle>
    <circle cx="8" cy="9" r="1" fill="currentColor"></circle>
    <circle cx="15" cy="8" r="1" fill="currentColor"></circle>
    <circle cx="10" cy="14" r="1" fill="currentColor"></circle>
    <circle cx="16" cy="13" r="1" fill="currentColor"></circle>
    <circle cx="12" cy="11" r="1" fill="currentColor"></circle>
  </svg>
);

const CookieBanner = () => {
  const { isBannerOpen, authenticate, reject } = useConsent();

  if (!isBannerOpen) return null;

  return createPortal(
    <div className="cookie-banner-overlay">
      <div className="cookie-banner-modal">
        {/* Header */}
        <div className="cookie-header">
          <CookieIcon className="cookie-icon" />
          <div>
            <h4 className="cookie-title">Cookie Preferences</h4>
            <p className="cookie-subtitle">Help us improve AIN</p>
          </div>
        </div>

        {/* Content */}
        <div className="cookie-content">
          <p>
            We use <span className="highlight">Google Analytics</span> to understand how pilots use AIN,
            helping us improve features and fix issues.
          </p>
          <p className="cookie-note">
            Your tracked alliances are saved locally in your browser regardless of this choice.
          </p>
        </div>

        {/* Actions */}
        <div className="cookie-actions">
          <button
            onClick={reject}
            className="btn-reject"
          >
            Decline
          </button>
          <button
            onClick={authenticate}
            className="btn-accept"
          >
            Accept Cookies
          </button>
        </div>

        {/* Legal Footer */}
        <div className="cookie-legal">
          AIN is a third-party tool and is not affiliated with CCP Games.
          EVE Online and all related trademarks are property of CCP hf.
          See the sidebar for full legal &amp; license information.
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CookieBanner;
