// iPhone Duo inner-screen detection, shared by App.jsx (sets html.duo-wide)
// and any screen that needs a Duo-only layout in JSX.
//
// It can only ever be true in the native iOS app, on an iPhone (iPad's
// user agent says "iPad"), in a window at least 600px wide. Regular iPhones
// are portrait-locked (see AppDelegate.allowedOrientations) and never wider
// than ~440px, and the web build isn't iOS-native, so for them this is
// always false and their layout is exactly what it was. Re-evaluated on
// every resize, because folding/unfolding the Duo resizes the running app.
import { useEffect, useState } from 'react';
import { isIOS } from '@/lib/platform';

const WIDE = '(min-width: 600px)';

function canBeDuo() {
  return typeof window !== 'undefined' && isIOS() && /iPhone/.test(navigator.userAgent);
}

/** True on the Duo's inner screen. `extra` adds a media condition, e.g. '(orientation: landscape)'. */
export function useDuoWide(extra = '') {
  const query = extra ? `${WIDE} and ${extra}` : WIDE;
  const [on, setOn] = useState(() => canBeDuo() && window.matchMedia(query).matches);
  useEffect(() => {
    if (!canBeDuo()) return undefined;
    const mq = window.matchMedia(query);
    const update = () => setOn(mq.matches);
    update();
    // The media-query 'change' event alone isn't reliable when the whole
    // window moves between the Duo's screens, so also re-check on every
    // resize/orientation change (rAF: measure after the new size settles).
    let frame = 0;
    const onResize = () => {
      update();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    mq.addEventListener('change', update);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(frame);
      mq.removeEventListener('change', update);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [query]);
  return on;
}

// Width of the right-hand safe area (where the iPhone Duo puts its status
// bar on both screens). A regular iPhone in portrait always reports 0 here.
function rightSafeArea() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-right:env(safe-area-inset-right)';
  document.body.appendChild(probe);
  const px = parseFloat(getComputedStyle(probe).paddingRight) || 0;
  probe.remove();
  return px;
}

/**
 * True when the status bar sits in a strip on the right edge (iPhone Duo,
 * outer and inner screen). Same gate as useDuoWide (native iOS app, iPhone),
 * plus a right safe area of at least 20px, which a portrait-locked regular
 * iPhone never has, so it's always false there.
 */
export function useDuoSideBar() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!canBeDuo()) return undefined;
    let frame = 0;
    const update = () => setOn(rightSafeArea() >= 20);
    const onResize = () => {
      update();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return on;
}

/**
 * Mirrors useDuoWide() / useDuoSideBar() onto <html class="duo-wide
 * duo-side-bar"> for the CSS in index.css.
 */
export function useDuoWideClass() {
  const wide = useDuoWide();
  const sideBar = useDuoSideBar();
  useEffect(() => {
    document.documentElement.classList.toggle('duo-wide', wide);
    document.documentElement.classList.toggle('duo-side-bar', sideBar);
    return () => document.documentElement.classList.remove('duo-wide', 'duo-side-bar');
  }, [wide, sideBar]);
}
