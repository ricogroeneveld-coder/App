import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';
import { RARITIES, cosmeticById } from '@/lib/cosmetics';
import PlayerAvatar, { AvatarFrame, EmblemTile } from './PlayerAvatar';
import BannerArt from './BannerArt';
import { useLang } from '@/lib/LanguageContext';
import { playUnlock } from '@/lib/sounds';
import { vibrate } from '@/lib/haptics';

function useTickDown(from, to, active, duration = 800, delay = 350) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (!active) return;
    let raf; let start;
    const timer = setTimeout(() => {
      const tick = (ts) => {
        if (start === undefined) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        setValue(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [active, from, to, duration, delay]);
  return active ? value : from;
}

// Preview the cosmetic AS EQUIPPED — composed with the player's current
// loadout, never floating alone. Seeing it on your own profile sells it.
function Artwork({ c, profile }) {
  const myEmblem = profile ? cosmeticById(profile.equipped?.emblem) : null;
  const myBorder = profile ? cosmeticById(profile.equipped?.border) : null;
  const myName = profile?.display_name || 'You';
  if (c.type === 'emblem') {
    const medal = <EmblemTile emblem={c} fontSize={42} breathe />;
    return myBorder?.frame ? (
      <span style={{ filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.55))' }}>
        <AvatarFrame frame={myBorder.frame} size={96}>{medal}</AvatarFrame>
      </span>
    ) : (
      <span className="relative w-24 h-24 rounded-full overflow-hidden flex shadow-[0_8px_16px_-4px_rgba(0,0,0,0.6)]">{medal}</span>
    );
  }
  if (c.type === 'banner') {
    return (
      <span className="relative w-full h-24 rounded-xl overflow-hidden block shadow-[0_8px_16px_-6px_rgba(0,0,0,0.6)]">
        <BannerArt banner={c} animated className="absolute inset-0" />
        <span className="absolute left-3 bottom-2 flex items-center gap-2">
          {profile && (
            <span className="flex" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.55))' }}>
              <PlayerAvatar profile={profile} size={34} />
            </span>
          )}
          <span className="text-sm font-extrabold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{myName}</span>
        </span>
      </span>
    );
  }
  if (c.type === 'border') {
    const inner = myEmblem
      ? <EmblemTile emblem={myEmblem} fontSize={42} breathe />
      : <span className="w-full h-full bg-black/50 flex items-center justify-center text-4xl">🙂</span>;
    return (
      <span style={{ filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.55))' }}>
        <AvatarFrame frame={c.frame} size={96}>{inner}</AvatarFrame>
      </span>
    );
  }
  if (c.type === 'title') {
    const myNameCls = profile ? cosmeticById(profile.equipped?.nameColor)?.cls : null;
    return (
      <span className="flex flex-col items-center gap-1.5">
        <span className={`text-xl font-extrabold ${myNameCls || 'text-white'}`}>{myName}</span>
        <span className={`inline-flex items-center max-w-full h-5 px-2 rounded-full text-[10px] font-extrabold ${RARITIES[c.rarity].chip}`}>
          <span className="truncate">{c.name}</span>
        </span>
      </span>
    );
  }
  return <span className={`text-2xl font-extrabold ${c.cls}`}>{myName}</span>;
}

const CONFETTI_COLORS = ['#ffcb45', '#ff8bd8', '#7db9ff', '#7dffa8', '#c98bff', '#ffd36b'];

/**
 * Premium purchase flow: a rarity-styled confirmation with a large preview,
 * then an unlock celebration — sound cue, glow burst, radiating sparkles,
 * confetti on legendary/mythic, Picks ticking down, and the auto-equip note.
 */
export default function PurchaseModal({ cosmetic: c, balance, typeLabel, profile, onConfirm, onClose }) {
  const { t } = useLang();
  const [phase, setPhase] = useState('confirm'); // confirm | celebrate
  const [confirming, setConfirming] = useState(false);
  const rar = RARITIES[c.rarity];
  const fancy = c.rarity === 'legendary' || c.rarity === 'mythic';
  const price = c.source.price;
  const affordable = balance >= price;
  const shownBalance = useTickDown(balance, balance - price, phase === 'celebrate');

  const confirm = () => {
    if (confirming) return;
    setConfirming(true);
    const res = onConfirm(c);
    if (res?.ok) {
      setPhase('celebrate');
      playUnlock();
      vibrate(35); // soft tick where supported (Android; silently ignored on iOS)
    } else {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6"
      onClick={phase === 'confirm' ? onClose : undefined}>
      <motion.div initial={{ opacity: 0, scale: 0.82, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.45 }}
        onClick={e => e.stopPropagation()}
        className={`glass-card relative overflow-hidden w-full max-w-xs bg-slate-900/95 p-5 text-center ring-1 ${rar.ring} ${rar.cardGlow}`}>
        {fancy && <span aria-hidden className="fx-shine" />}

        {/* Confetti — legendary/mythic celebration */}
        {phase === 'celebrate' && fancy && [...Array(16)].map((_, i) => (
          <motion.span key={`cf${i}`} aria-hidden
            className="absolute left-1/2 top-10 w-1.5 h-2.5 rounded-[2px] pointer-events-none z-20"
            style={{ background: CONFETTI_COLORS[i % CONFETTI_COLORS.length] }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{
              x: (i % 2 ? 1 : -1) * (18 + (i * 37) % 110),
              y: 150 + (i * 23) % 90,
              opacity: 0,
              rotate: (i % 2 ? 1 : -1) * (180 + i * 40),
            }}
            transition={{ duration: 1.15 + (i % 4) * 0.14, ease: 'easeOut' }} />
        ))}

        {/* Rarity + type */}
        <p className={`text-[10px] font-extrabold uppercase tracking-[0.16em] ${rar.text}`}>
          {rar.label} {typeLabel}
        </p>
        <p className="text-lg font-extrabold text-white mt-0.5 mb-4">{c.name}</p>

        {/* Artwork with celebration burst */}
        <div className="relative flex items-center justify-center min-h-[6rem] mb-4">
          <motion.div
            animate={phase === 'celebrate' ? { scale: [1, 1.18, 1] } : {}}
            transition={{ duration: 0.55 }}
            className="relative flex items-center justify-center w-full">
            <Artwork c={c} profile={profile} />
          </motion.div>
          {phase === 'celebrate' && (
            <>
              <motion.span aria-hidden className="absolute w-24 h-24 rounded-full pointer-events-none"
                initial={{ opacity: 0.8, scale: 0.6 }} animate={{ opacity: 0, scale: 2 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                style={{ boxShadow: '0 0 40px 16px rgba(255,203,69,0.55)' }} />
              {[...Array(10)].map((_, i) => (
                <motion.span key={`sp${i}`} aria-hidden
                  className="absolute text-amber-300 text-base leading-none pointer-events-none"
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
                  animate={{
                    x: Math.cos(i * Math.PI / 5) * 74,
                    y: Math.sin(i * Math.PI / 5) * 64,
                    opacity: 0, scale: 1.4,
                  }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}>✦</motion.span>
              ))}
            </>
          )}
        </div>

        <AnimatePresence mode="wait">
          {phase === 'confirm' ? (
            <motion.div key="confirm" exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
              {/* Price */}
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <span className="px-3 py-1 rounded-full bg-gradient-to-b from-[#ffcb45] to-[#e08e05] text-[#2c1500] text-sm font-extrabold tabular-nums shadow-[0_2px_6px_-2px_rgba(0,0,0,0.5)]">
                  {price} Picks
                </span>
              </div>
              <p className={`text-[11px] font-semibold mb-4 ${affordable ? 'text-slate-400' : 'text-rose-400'}`}>
                {t.youHave} {balance} Picks
              </p>
              <p className="text-sm font-bold text-slate-200 mb-4">{t.confirmUnlock}</p>
              <div className="flex gap-2">
                <button onClick={onClose}
                  className="flex-1 h-12 rounded-[16px] bg-white/5 ring-1 ring-white/15 text-sm font-bold text-slate-300 hover:bg-white/10 transition-all duration-150 active:scale-[0.97]">
                  {t.cancel}
                </button>
                <button onClick={confirm} disabled={!affordable || confirming}
                  className="gold-btn flex-1 h-12 rounded-[16px] flex items-center justify-center gap-1.5">
                  {!affordable && <Lock className="relative w-3.5 h-3.5 text-[#2c1500]" />}
                  <span className="relative text-sm font-extrabold tracking-tight text-[#2c1500] drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">
                    {t.unlockNow}
                  </span>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="celebrate" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}>
              <motion.p initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.5 }}
                className="text-lg font-extrabold text-amber-300 mb-1"
                style={{ textShadow: '0 0 18px rgba(255,203,69,0.5)' }}>
                {t.unlocked}!
              </motion.p>
              <p className="text-xs font-bold text-emerald-300 mb-1.5">✓ {t.equippedNow}</p>
              <p className="text-[11px] font-semibold text-slate-400 mb-4 tabular-nums">
                {t.youHave} {shownBalance} Picks
              </p>
              <button onClick={onClose}
                className="violet-solid-btn w-full h-12 rounded-[16px] text-sm font-extrabold text-white">
                {t.niceBtn}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
