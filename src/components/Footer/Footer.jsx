import './Footer.css';

// --- Edit your supporters list here ---
const SUPPORTERS = [
  'Axium Cog',
  'ATKO',
  'Nora Efthimia',
  'Samalya Birchall',
];

// --- Edit your donation links here ---
const KOFI_URL    = 'https://ko-fi.com/ain4eve';
const PATREON_URL = 'https://www.patreon.com/cw/AIN4EVE';

const CHAR_ID = 2122803608;

const SCROLL_THRESHOLD = 5; // start scrolling once there are this many supporters

export default function Footer() {
  const shouldScroll = SUPPORTERS.length >= SCROLL_THRESHOLD;
  // Only duplicate for the seamless loop when scrolling is active
  const tickerItems = shouldScroll ? [...SUPPORTERS, ...SUPPORTERS] : SUPPORTERS;

  return (
    <footer className="app-footer">

      {/* Left: data credit */}
      <div className="footer-left">
        <span>R2Z2 feed by&nbsp;</span>
        <a
          href="https://zkillboard.com"
          target="_blank"
          rel="noopener noreferrer"
          title="zKillboard by Squizz"
        >
          Squizz · zKillboard.com
        </a>
      </div>

      {/* Center: supporter list — static when few, scrolling when many */}
      <div className="footer-center">
        <span className="ticker-label">♥ Supporters:</span>
        <div className={shouldScroll ? 'ticker-wrapper' : 'ticker-static'}>
          <div className={shouldScroll ? 'ticker-track' : 'ticker-track-static'}>
            {tickerItems.map((name, i) => (
              <span key={i} className="ticker-item">{name}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Right: donation links + dev credit */}
      <div className="footer-right">
        <a
          href={KOFI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link footer-kofi"
          title="Support on Ko-fi"
        >
          ☕ Ko-fi
        </a>
        <a
          href={PATREON_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link footer-patreon"
          title="Support on Patreon"
        >
          ♥ Patreon
        </a>
        <div className="footer-dev">
          <img
            src={`https://images.evetech.net/characters/${CHAR_ID}/portrait?size=32`}
            alt="Shaayaa"
            className="footer-avatar"
          />
          <span>Dev: Shaayaa</span>
        </div>
      </div>

    </footer>
  );
}
