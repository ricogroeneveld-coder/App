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

/** Mirrors useDuoWide() onto <html class="duo-wide"> for the CSS in index.css. */
export function useDuoWideClass() {
  const on = useDuoWide();
  useEffect(() => {
    document.documentElement.classList.toggle('duo-wide', on);
    return () => document.documentElement.classList.remove('duo-wide');
  }, [on]);
}
