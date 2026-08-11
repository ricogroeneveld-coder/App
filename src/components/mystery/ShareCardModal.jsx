import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Share, Loader2 } from 'lucide-react';
import { useLang } from '@/lib/LanguageContext';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { renderShareCard, canvasToBlob } from '@/lib/shareCard';
import { shareImage, shareText } from '@/lib/share';
import { vibrate } from '@/lib/haptics';

// One generated card per results screen — regenerating on every open would
// waste work and (worse) could subtly differ. Keyed by the card data's
// fingerprint so a "Play Again" round gets a fresh card.
let cached = { key: null, blob: null, url: null };

/**
 * Share-card preview: tapping Share on the results screen opens this,
 * shows the freshly rendered card (the reveal IS the reward moment), and
 * a single gold Share action that hands the PNG to the OS share sheet.
 * Cancelling the sheet just returns here; rendering failure falls back to
 * the plain text share so the button never dead-ends.
 */
export default function ShareCardModal({ data, fallbackText, onClose }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [url, setUrl] = useState(cached.key === data.key ? cached.url : null);
  const [sharing, setSharing] = useState(false);
  const failedRef = useRef(false);

  useEffect(() => {
    if (cached.key === data.key && cached.url) return;
    let live = true;
    (async () => {
      try {
        const canvas = await renderShareCard(data);
        const blob = await canvasToBlob(canvas);
        if (cached.url) URL.revokeObjectURL(cached.url);
        cached = { key: data.key, blob, url: URL.createObjectURL(blob) };
        if (live) setUrl(cached.url);
      } catch {
        // Card couldn't render (canvas/memory edge case) — don't strand the
        // user: share the text version instead and close.
        failedRef.current = true;
        if (live) {
          shareText(fallbackText);
          onClose();
        }
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.key]);

  const doShare = async () => {
    if (!cached.blob || sharing) return;
    setSharing(true);
    vibrate(20);
    try {
      const result = await shareImage(cached.blob, 'whats-my-pick-result.png', "What's My Pick!");
      if (result === 'saved') toast({ title: t.shareCardSaved });
      else if (result === 'error') {
        // Image share genuinely unavailable — text share still works.
        const textResult = await shareText(fallbackText);
        if (textResult === 'copied') toast({ title: t.linkCopied });
      }
      // 'shared' and 'cancelled' need no feedback — the sheet said it all.
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog onClose={onClose} placement="center" title={t.shareResult}
      className="bg-black/75 backdrop-blur-md p-6"
      panelClassName="max-w-xs flex flex-col items-center bg-transparent">
        {/* The card — presented like the collectible it is */}
        <div className="relative w-full rounded-[24px] overflow-hidden ring-1 ring-white/20 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8),0_0_40px_-12px_rgba(157,92,255,0.5)]"
          style={{ aspectRatio: '3 / 4' }}>
          {url ? (
            <motion.img initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
              src={url} alt={t.shareResult} className="w-full h-full object-cover" draggable={false} />
          ) : (
            <div className="w-full h-full bg-[#0d0716] flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin drop-shadow-[0_0_8px_rgba(157,92,255,0.5)]" />
            </div>
          )}
          <button onClick={onClose} aria-label={t.close}
            className="absolute right-2 top-2 p-2.5 rounded-xl bg-black/35 backdrop-blur-sm hover:bg-black/50 text-white/85 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <button onClick={doShare} disabled={!url || sharing}
          className="gold-btn w-full h-14 mt-4 rounded-[20px] flex items-center justify-center gap-2 disabled:opacity-60">
          {sharing
            ? <Loader2 className="relative w-4 h-4 text-[#2c1500] animate-spin" />
            : <Share className="relative w-4 h-4 text-[#2c1500]" />}
          <span className="relative text-sm font-extrabold tracking-tight text-[#2c1500] drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">
            {t.shareCardCta}
          </span>
        </button>
    </Dialog>
  );
}
