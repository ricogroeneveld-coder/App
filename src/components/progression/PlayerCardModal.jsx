import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import BannerArt from './BannerArt';
import { cosmeticById, RARITIES } from '@/lib/cosmetics';
import { useLang } from '@/lib/LanguageContext';

/**
 * Premium player card — banner, emblem, level, title, and lifetime stats.
 * Works with a partial or missing profile (pre-migration players).
 * Pass onKick to show a host-only "remove from game" action.
 */
export default function PlayerCardModal({ player, profile, onClose, onKick }) {
  const { t } = useLang();
  if (!player) return null;
  const banner = profile ? cosmeticById(profile.equipped?.banner) : null;
  const title = profile ? cosmeticById(profile.equipped?.title) : null;
  const nameColor = profile ? cosmeticById(profile.equipped?.nameColor) : null;
  const games = profile?.games_played || 0;
  const wins = profile?.wins || 0;
  const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        className="glass-card w-full max-w-sm bg-slate-900/95 p-0"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}>
        {/* Banner */}
        <div className="relative h-20 overflow-hidden rounded-t-[24px]">
          <BannerArt banner={banner} className="absolute inset-0" />
          <button onClick={onClose} aria-label="Close"
            className="absolute right-2 top-2 p-2.5 rounded-xl hover:bg-black/30 text-white/70">
            <X className="w-5 h-5" />
          </button>
          <div className="absolute -bottom-7 left-4">
            <PlayerAvatar profile={profile} name={player.display_name} color={player.color} size={56} />
          </div>
          {profile && (
            <span className="absolute -bottom-3 left-[52px] px-1.5 py-0.5 rounded-full bg-gradient-to-b from-violet-400 to-violet-700 ring-2 ring-slate-900 text-[10px] font-extrabold text-white leading-none">
              {profile.level}
            </span>
          )}
        </div>

        <div className="px-4 pt-9 pb-2">
          <p className={`text-lg font-extrabold leading-tight truncate ${nameColor?.cls || 'text-white'}`}>
            {player.display_name}
          </p>
          {title && (
            <p className={`text-xs font-bold ${RARITIES[title.rarity]?.text || 'text-slate-400'}`}>{title.name}</p>
          )}

          <div className="grid grid-cols-3 gap-1.5 mt-3">
            {[['Games', games], ['Wins', wins], ['Win rate', `${winRate}%`]].map(([label, value]) => (
              <div key={label} className="glass-tile px-2 py-2 text-center">
                <p className="text-base font-extrabold text-white leading-tight">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
              </div>
            ))}
          </div>
          {!profile && (
            <p className="text-[11px] text-slate-500 font-medium mt-3 text-center">No profile stats yet.</p>
          )}
          {onKick && (
            <button onClick={onKick}
              className="w-full h-11 mt-3 rounded-xl bg-rose-500/15 ring-1 ring-rose-400/40 text-rose-300 text-sm font-bold hover:bg-rose-500/25 transition-all duration-150 active:scale-[0.98]">
              {t.removeFromGame}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
