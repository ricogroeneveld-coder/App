// Public site pages (privacy / support / terms). Base is configurable via
// VITE_SITE_BASE so it can point at wherever the static files in /public
// actually deploy (root vs a subpath). MUST be verified to resolve on the real
// domain before store submission (LAUNCH-2).
const SITE_BASE = import.meta.env.VITE_SITE_BASE || 'https://jinnieoclock.com/whatsmypick';
export const PRIVACY_URL = `${SITE_BASE}/privacy.html`;
export const SUPPORT_URL = `${SITE_BASE}/support.html`;
export const TERMS_URL = `${SITE_BASE}/terms.html`;
