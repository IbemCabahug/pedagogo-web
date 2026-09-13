/**
 * Pedagogo Desk: Handheld Device Notice 🌿
 * Calm, once-per-session notice when a phone/tablet visits the PC-first Desk,
 * pointing the user to the Pedagogo Android app download (or a calm
 * "coming soon" note until the app is deployed). A phone visitor cannot scan
 * the Desk's own QR, so the QR deep-link was replaced by this link.
 * Zero red language, no nagging — mirrors the calm-dialog / toast house style.
 */

const NOTICE_DISMISS_KEY = 'pedagogo_mobile_notice_dismissed_v1';

/**
 * TODO(deploy): set this to the public Pedagogo Android app URL — the Play
 * Store listing or a hosted APK page — once the app is built and deployed.
 * While it stays null, the banner shows a calm "coming soon" note instead of
 * a dead link. ONE constant to update, nothing else to touch.
 */
export const PEDAGOGO_APP_URL = null;

/** Phone/tablet user agents (phone = Android with /Mobile, iPhone, iPod, feature phones). */
const PHONE_UA_RE = /Android.*Mobile|iPhone|iPod|Windows Phone|Windows Mobile|BlackBerry|Opera Mini|IEMobile|webOS|webOS.*Pre/i;
/** Tablet-flavored user agents (iPad, Android tablets without /Mobile, Kindle, Surface RT). */
const TABLET_UA_RE = /iPad|Tablet|PlayBook|Silk|Kindle|Nexus (?:7|10)|Android(?!.*Mobile)/i;

/**
 * Classify a device from environment facts. Pure — no DOM, no globals —
 * so the 10x loop can pin it headlessly (house pattern: verify_today_strip.mjs).
 *
 * @param {object} env
 * @param {string} [env.userAgent]
 * @param {number} [env.maxTouchPoints]  navigator.maxTouchPoints (0 on desktops)
 * @param {boolean} [env.pointerCoarse]  matchMedia('(pointer: coarse)').matches
 * @param {boolean} [env.hoverNone]      matchMedia('(hover: none)').matches
 * @param {boolean} [env.isMac]          Mac platform flag (iPadOS 13+ masquerades as Mac)
 * @returns {'phone'|'tablet'|'desktop'}
 */
export function classifyDevice(env = {}) {
  const ua = String(env.userAgent || '');
  const touchPoints = Number.isFinite(env.maxTouchPoints) ? env.maxTouchPoints : 0;
  const coarse = env.pointerCoarse === true;
  const hoverNone = env.hoverNone === true;

  if (!PHONE_UA_RE.test(ua) && !TABLET_UA_RE.test(ua)) {
    // iPadOS 13+ reports as Macintosh but carries touch points — the one
    // "Mac" that should still get the handheld notice.
    if (env.isMac === true && touchPoints > 1) {
      return 'tablet';
    }
    // Desktops with touchscreens (Windows laptop, Surface w/ keyboard, Chromebox):
    // a fine pointer OR hover capability always means the full Desk experience.
    if (!coarse || !hoverNone) {
      return 'desktop';
    }
    // UA-less touchscreen handheld: pointer/touch heuristics. maxTouchPoints
    // cannot reliably split phone vs tablet (both report 5-10), and the banner
    // copy is identical for either — default to 'phone', the common case.
    return 'phone';
  }

  // UA explicitly handheld — trust it over pointer heuristics.
  if (PHONE_UA_RE.test(ua)) return 'phone';
  return 'tablet';
}

/**
 * Notice visibility rule. Pure. Once-per-session; desktops never see it.
 * @param {'phone'|'tablet'|'desktop'} device
 * @param {boolean} dismissedThisSession
 */
export function shouldShowHandheldNotice(device, dismissedThisSession) {
  return device !== 'desktop' && dismissedThisSession !== true;
}

/** Calm microcopy — Taglish-friendly helper tone (audit §11 language guidance). */
export const DEVICE_NOTICE_COPY = {
  title: 'You\'re on a phone or tablet',
  body: 'Pedagogo Desk is designed for PC. For the best experience on this device, use the Pedagogo mobile app.',
  ctaDownload: 'Download the Pedagogo app',
  comingSoon: 'The mobile app is coming soon — this Desk works best on PC for now.',
  dismiss: 'Got it'
};

function readSessionFlag(win) {
  try {
    return win.sessionStorage.getItem(NOTICE_DISMISS_KEY) === 'true';
  } catch (e) {
    // Safari private mode etc. — treat as not dismissed (banner stays dismissible anyway)
    return false;
  }
}

function writeSessionFlag(win) {
  try {
    win.sessionStorage.setItem(NOTICE_DISMISS_KEY, 'true');
  } catch (e) { /* best-effort only */ }
}

/**
 * Detect the device and, if handheld, show the app-download guidance banner.
 * Called once at app startup from main.js. Safe to call repeatedly (idempotent).
 * @param {Window} [win]
 * @param {Document} [doc]
 * @param {{ appUrl?: string|null }} [options] override the download URL (tests)
 */
export function initDeviceNotice(win = window, doc = document, options = {}) {
  if (!win || !win.matchMedia || !doc || !doc.body) return null;
  if (doc.getElementById('pedagogo-device-notice')) return null; // idempotent

  const navigator = win.navigator || {};
  const device = classifyDevice({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    pointerCoarse: win.matchMedia('(pointer: coarse)').matches,
    hoverNone: win.matchMedia('(hover: none)').matches,
    isMac: /Mac/i.test(String(navigator.platform || navigator.userAgent || ''))
  });

  if (!shouldShowHandheldNotice(device, readSessionFlag(win))) return null;

  const copy = DEVICE_NOTICE_COPY;
  const appUrl = (typeof options.appUrl === 'string' && options.appUrl)
    ? options.appUrl
    : PEDAGOGO_APP_URL;

  const banner = doc.createElement('div');
  banner.id = 'pedagogo-device-notice';
  banner.className = 'device-notice-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');

  const title = doc.createElement('div');
  title.className = 'device-notice-title';
  title.textContent = `📱 ${copy.title}`;

  const body = doc.createElement('p');
  body.className = 'device-notice-body';
  body.textContent = copy.body;

  const actions = doc.createElement('div');
  actions.className = 'device-notice-actions';

  if (appUrl) {
    // Real download link (set via PEDAGOGO_APP_URL after deployment)
    const cta = doc.createElement('a');
    cta.className = 'device-notice-btn device-notice-btn-primary';
    cta.setAttribute('href', appUrl);
    cta.setAttribute('target', '_blank');
    cta.setAttribute('rel', 'noopener noreferrer');
    cta.textContent = copy.ctaDownload;
    cta.addEventListener('click', () => {
      // Opening the store counts as handled — stop showing the banner
      writeSessionFlag(win);
      dismissBanner();
    });
    actions.appendChild(cta);
  } else {
    // App not deployed yet — calm "coming soon" note, never a dead link
    const soon = doc.createElement('div');
    soon.className = 'device-notice-soon';
    soon.textContent = copy.comingSoon;
    actions.appendChild(soon);
  }

  const dismissBtn = doc.createElement('button');
  dismissBtn.className = 'device-notice-btn device-notice-btn-quiet';
  dismissBtn.type = 'button';
  dismissBtn.textContent = copy.dismiss;
  dismissBtn.setAttribute('aria-label', 'Dismiss the mobile notice for this session');
  dismissBtn.addEventListener('click', () => {
    writeSessionFlag(win);
    dismissBanner();
  });

  actions.appendChild(dismissBtn);
  banner.appendChild(title);
  banner.appendChild(body);
  banner.appendChild(actions);
  doc.body.appendChild(banner);

  // Entrance animation (same two-phase pattern as the toast engine)
  const raf = typeof win.requestAnimationFrame === 'function'
    ? win.requestAnimationFrame.bind(win)
    : (cb) => setTimeout(cb, 16);
  raf(() => banner.classList.add('device-notice-visible'));

  function dismissBanner() {
    banner.classList.remove('device-notice-visible');
    banner.classList.add('device-notice-hiding');
    setTimeout(() => {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 300);
  }

  return banner;
}
