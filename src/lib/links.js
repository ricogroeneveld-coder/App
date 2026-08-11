// Public site pages (privacy / support / terms). Base is configurable via
// VITE_SITE_BASE so it can point at wherever the static files in /public
// actually deploy. The files (public/privacy.html etc.) are served at the site
// ROOT by the static host (see public/_redirects, vercel.json) — so the base is
// an ORIGIN with NO subpath. The store build injects VITE_SITE_BASE in CI and
// FAILS if it's unset (see .github/workflows/ios-testflight.yml), so a build
// can't ship the placeholder. Trailing slashes are trimmed so the base can be
// given with or without one.
const RAW_BASE = import.meta.env.VITE_SITE_BASE || 'https://whatsmypick.com';
const SITE_BASE = RAW_BASE.replace(/\/+$/, '');
export const PRIVACY_URL = `${SITE_BASE}/privacy.html`;
export const SUPPORT_URL = `${SITE_BASE}/support.html`;
export const TERMS_URL = `${SITE_BASE}/terms.html`;
