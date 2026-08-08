import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cosmeticById, RARITIES } from '@/lib/cosmetics';
import { useLang } from '@/lib/LanguageContext';

function useCountUp(target, duration = 900, delay = 250) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf; let start;
    const timer = setTimeout(() => {
      const tick = (ts) => {
        if (start === undefined) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        setValue(Math.round(target * (1 - Math.pow(1 - p, 3)))); // ease-out cubic
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [target, duration, delay]);
  return value;
}

const ROW_LABEL_KEYS = {
  complete: 'rwComplete', guesses: 'rwGuesses', winner: 'rwWinner',
  perfect: 'rwPerfect', host: 'rwHost', streak: 'rwStreak',
};

/**
 * Post-match reward panel: counting Picks/XP, an animated XP bar, level-up
 * celebration, challenge completions, and cosmetic unlocks.
 */
export default function RewardSummary({ breakdown }) {
  const { t } = useLang();
  const picks = useCountUp(breakdown.totalPicks);
  const xp = useCountUp(breakdown.totalXp);
  const [barPct, setBarPct] = useState((breakdown.before.into / breakdown.before.need) * 100);
  const leveled = breakdown.after.level > breakdown.before.level;

  useEffect(() => {
    const id = setTimeout(() => {
      setBarPct((breakdown.after.into / breakdown.after.need) * 100);
    }, 500);
    return () => clearTimeout(id);
  }, [breakdown]);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      className="glass-card p-3.5 mb-3">
      <div className="flex items-center justify-between mb-2">
        <p className="section-label">{t.rewardsTitle}</p>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-gradient-to-b from-[#ffcb45] to-[#e08e05] text-[#2c1500] text-xs font-extrabold tabular-nums">
            +{picks} Picks
          </span>
          <span className="px-2 py-0.5 rounded-full bg-violet-500/20 ring-1 ring-violet-400/40 text-violet-200 text-xs font-extrabold tabular-nums">
            +{xp} XP
          </span>
        </div>
      </div>

      <div className="space-y-1 mb-3">
        {breakdown.rows.map(row => (
          <div key={row.label} className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">
              {t[ROW_LABEL_KEYS[row.label]] || row.label}
              {row.label === 'streak' && breakdown.streak ? ` ×${breakdown.streak}` : ''}
            </span>
            <span className="text-amber-300 font-bold tabular-nums">+{row.picks}</span>
          </div>
        ))}
        {breakdown.challenges.map(c => (
          <div key={c.name} className="flex items-center justify-between text-xs">
            <span className="text-emerald-300 font-medium">✓ {(c.id && t.challengeNames[c.id]) || c.name}</span>
            <span className="text-amber-300 font-bold tabular-nums">+{c.picks}</span>
          </div>
        ))}
      </div>

      {/* XP bar */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-extrabold text-violet-300 shrink-0">Lv {breakdown.after.level}</span>
        <div className="flex-1 h-2.5 rounded-full bg-black/40 ring-1 ring-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
            style={{ width: `${barPct}%`, transition: 'width 900ms cubic-bezier(0.22, 1, 0.36, 1)' }} />
        </div>
        <span className="text-[10px] font-bold text-slate-400 shrink-0 tabular-nums">
          {breakdown.after.into}/{breakdown.after.need}
        </span>
      </div>

      {leveled && (
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.6, delay: 0.9 }}
          className="mt-2.5 rounded-xl bg-gradient-to-b from-[#3a2400] to-[#1a0f00] ring-1 ring-[#ffcf7a]/60 shadow-[0_0_16px_-4px_rgba(255,180,60,0.5),inset_0_1px_1px_rgba(255,220,150,0.25)] px-3 py-2 text-center">
          <p className="text-sm font-extrabold text-amber-200">
            🎉 {t.levelUp} {breakdown.after.level}!
          </p>
        </motion.div>
      )}

      {breakdown.unlocks.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {breakdown.unlocks.map(id => {
            const c = cosmeticById(id);
            if (!c) return null;
            return (
              <motion.div key={id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.1 }}
                className="glass-tile flex items-center gap-2 px-2.5 py-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="text-xs font-bold text-white flex-1 truncate">{c.emoji ? `${c.emoji} ` : ''}{c.name}</span>
                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${RARITIES[c.rarity].chip}`}>
                  {RARITIES[c.rarity].label}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
