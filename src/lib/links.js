// Public site pages (privacy / support / terms).
//
// These are real files in this repo — public/privacy.html, support.html and
// terms.html — which Vite copies to the ROOT of the build output. They need a
// public URL for two reasons: the in-app links open them in a browser, and
// App Store Connect requires a publicly-resolving Privacy Policy URL.
//
// Resolution order, so no domain has to be guessed:
//
//  1. VITE_SITE_BASE, if set — an explicit ORIGIN (no subpath), e.g.
//     https://example.com. This is what the native build uses; the iOS CI
//     workflow injects it and FAILS the build when it's missing, so a store
//     build can never ship a dead link.
//  2. On WEB, the app's own origin. The pages deploy alongside the app, so
//     they are same-origin by construction — whatever domain the site is on,
//     /privacy.html resolves. (Both hosts' SPA rewrites serve real static
//     files before falling through to index.html, so these aren't swallowed.)
//  3. Only as a last resort — a native build somehow made without
//     VITE_SITE_BASE — fall back to the relative path. It won't resolve
//     inside the Capacitor webview, which is exactly why CI hard-fails
//     instead of relying on this.
//
// The point: on web there is nothing to configure, and on native the value is
// yours to set — this file never invents a domain.

const ENV_BASE = import.meta.env.VITE_SITE_BASE;

function siteBase() {
  if (ENV_BASE) return String(ENV_BASE).replace(/\/+$/, '');
  // capacitor:// / ionic:// origins are the webview's internal scheme, not a
  // real address — never build a public link out of one.
  if (typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)) {
    return window.location.origin;
  }
  return '';
}

const SITE_BASE = siteBase();

export const PRIVACY_URL = `${SITE_BASE}/privacy.html`;
export const SUPPORT_URL = `${SITE_BASE}/support.html`;
export const TERMS_URL = `${SITE_BASE}/terms.html`;
