// Public site pages (privacy / support / terms).
//
// These are real files in this repo — public/privacy.html, support.html and
// terms.html — and they are published at the base below, which is where the
// owner hosts them. They need an absolute, publicly-resolving URL for two
// reasons: the in-app links open them in a browser (on native, the Capacitor
// webview's origin is not a real address, so a relative path can't work), and
// App Store Connect requires a publicly-resolving Privacy Policy URL.
//
// NOTE: the base deliberately includes the /whatsmypick path segment — the
// pages live under that subpath on the host, NOT at the domain root. Don't
// "simplify" this to the bare origin, and don't derive it from
// window.location.origin: an Origin excludes the path, so that would point at
// /privacy.html and 404.
//
// VITE_SITE_BASE overrides it at build time if the pages ever move.
const RAW_BASE = import.meta.env.VITE_SITE_BASE || 'https://www.jinnieoclock.com/whatsmypick';
const SITE_BASE = String(RAW_BASE).replace(/\/+$/, '');

export const PRIVACY_URL = `${SITE_BASE}/privacy.html`;
export const SUPPORT_URL = `${SITE_BASE}/support.html`;
export const TERMS_URL = `${SITE_BASE}/terms.html`;
