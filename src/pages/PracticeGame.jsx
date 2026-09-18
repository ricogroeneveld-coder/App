import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import GameBackground from '@/components/GameBackground';
import { getGuestIdentity, hasGuestName } from '@/lib/guestIdentity';
import { useLang } from '@/lib/LanguageContext';
import { createPracticeGame } from '@/lib/practice/localGame';
import { hasFullApp, isDevToolsEnabled } from '@/lib/platform';

// Practice-vs-bots bootstrap: creates the local in-memory room (see
// lib/practice/localGame.js) and forwards straight into the REAL game page —
// lobby, word entry, playing, and results are the exact same screens as a
// live multiplayer match; only the backend is swapped for the on-device one.
//
// Web is join-only — it can't create ANY game, practice included — so this
// route actively redirects home on web instead of just having no linked
// entry point, the same guard Profile.jsx uses for the shop. isDevToolsEnabled()
// (VITE_ENABLE_DEV_TOOLS=1, never set for a real deployed build — see
// .env.example) lets an internal QA/CI build still reach this route directly,
// the same escape hatch the ?dev= URL mechanism already uses elsewhere; the
// e2e practice-match test (tests/e2e-practice.mjs) relies on it since Home no
// longer links here at all on web.
export default function PracticeGame() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!hasFullApp() && !isDevToolsEnabled()) { navigate('/', { replace: true }); return; }
    const guest = getGuestIdentity();
    const code = createPracticeGame({
      hostId: guest.id,
      // Nameless first-time visitors get MysteryGame's own name gate before
      // their player row is created — same flow as an invite link.
      hostName: hasGuestName() ? guest.name : '',
      lang,
    });
    navigate(`/mystery/${code}`, { replace: true });
  }, [navigate, lang]);

  return (
    <div className="h-dvh overflow-hidden flex items-center justify-center relative"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <GameBackground />
      <Loader2 className="w-8 h-8 text-violet-400 animate-spin drop-shadow-[0_0_8px_rgba(157,92,255,0.5)]" />
    </div>
  );
}
