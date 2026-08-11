import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import PlayerAvatar from './PlayerAvatar';
import BannerArt from './BannerArt';
import { cosmeticById, RARITIES, topEquippedRarity } from '@/lib/cosmetics';
import { reportPlayer, hasReported } from '@/lib/reports';
import { isMuted, setMuted } from '@/lib/mutes';
import { useLang } from '@/lib/LanguageContext';

const CARD_BG = '#10141f';

/**
 * Premium player card — a live banner scene the avatar sits IN (ground glow,
 * cast shadow, blended edge), name and title as cosmetic identity, and a
 * stat wall. The card's ring and glow follow the player's highest equipped
 * rarity, so a Legendary profile reads Legendary at a glance.
 * Pass onKick to show a host-only "remove from game" action.
 */
export default function PlayerCardModal({ player, profile, onClose, onKick = undefined, meId, roomCode }) {
  const { t } = useLang();
  const [reported, setReported] = useState(() => hasReported(roomCode, player?.user_id));
  const [muted, setMutedState] = useState(() => isMuted(player?.user_id));
  if (!player) return null;
  const canReport = player.user_id && meId && player.user_id !== meId;
  const toggleMute = () => {
    setMuted(player.user_id, !muted);
    setMutedState(!muted);
  };
  const banner = profile ? cosmeticById(profile.equipped?.banner) : null;
  const title = profile ? cosmeticById(profile.equipped?.title) : null;
  const nameColor = profile ? cosmeticById(profile.equipped?.nameColor) : null;
  const rar = RARITIES[profile ? topEquippedRarity(profile.equipped) : 'common'];
  const games = profile?.games_played || 0;
  const wins = profile?.wins || 0;
  const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;
  const stats = [
    [t.statGames, games], [t.statWins, wins], [t.statWinRate, `${winRate}%`],
    [t.statGuesses, profile?.correct_guesses || 0], [t.statStreak, profile?.win_streak || 0], [t.statLevel, profile?.level || 1],
  ];

  return (
    <Dialog onClose={onClose} placement="bottom" titleId="player-card-title"
      className="bg-black/70"
      panelClassName={`relative max-w-sm rounded-[24px] overflow-hidden ring-1 ${rar.ring} ${rar.cardGlow} shadow-[0_24px_48px_-16px_rgba(0,0,0,0.8)]`}
      style={{ background: CARD_BG, marginBottom: 'max(env(safe-area-inset-bottom), 0rem)' }}>
        {/* Live banner scene, melting into the card body */}
        <div className="relative h-24">
          <BannerArt banner={banner} animated className="absolute inset-0" />
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
            style={{ background: `linear-gradient(180deg, transparent 0%, ${CARD_BG} 100%)` }} />
          <button onClick={onClose} aria-label="Close"
            className="absolute right-2 top-2 p-2.5 rounded-xl bg-black/25 backdrop-blur-sm hover:bg-black/40 text-white/80 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Avatar — sitting in the scene, not pasted on it */}
        <div className="relative px-5 -mt-9">
          <span aria-hidden className="absolute left-5 top-10 w-20 h-4 rounded-full"
            style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.55), transparent 70%)', filter: 'blur(3px)' }} />
          <div className="relative inline-flex" style={{ filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.55))' }}>
            <PlayerAvatar profile={profile} name={player.display_name} color={player.color} size={68} />
            {profile && (
              <span className="absolute -bottom-1 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-gradient-to-b from-violet-400 to-violet-700 flex items-center justify-center text-[11px] font-extrabold text-white leading-none shadow-[0_2px_5px_rgba(0,0,0,0.6)]"
                style={{ boxShadow: `0 0 0 3px ${CARD_BG}, 0 2px 5px rgba(0,0,0,0.6)` }}>
                {profile.level}
              </span>
            )}
          </div>
        </div>

        <div className="px-5 pt-2 pb-4">
          {/* Ambient inner light so the body isn't a flat slab */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-16 h-40"
            style={{ background: 'radial-gradient(70% 70% at 50% 0%, rgba(157,92,255,0.09), transparent 70%)' }} />

          <p id="player-card-title" className={`relative text-xl font-extrabold leading-tight truncate ${nameColor?.cls || 'text-white'}`}>
            {player.display_name}
          </p>
          {title && (
            <span className={`relative inline-flex items-center max-w-full h-5 mt-1 px-2 rounded-full text-[10px] font-extrabold ${RARITIES[title.rarity].chip}`}>
              <span className="truncate">{title.name}</span>
            </span>
          )}

          <div className="relative grid grid-cols-3 gap-1.5 mt-3.5">
            {stats.map(([label, value], i) => (
              <motion.div key={label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + i * 0.05 }}
                className="rounded-xl px-2 py-2 text-center bg-gradient-to-b from-white/[0.07] to-black/25 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_6px_-3px_rgba(0,0,0,0.5)]">
                <p className="text-base font-extrabold text-white leading-tight tabular-nums">{value}</p>
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 truncate">{label}</p>
              </motion.div>
            ))}
          </div>
          {!profile && (
            <p className="relative text-[11px] text-slate-400 font-medium mt-3 text-center">{t.noStatsYet}</p>
          )}
          {onKick && (
            <button onClick={onKick}
              className="relative w-full h-11 mt-3.5 rounded-xl bg-rose-500/15 ring-1 ring-rose-400/40 text-rose-300 text-sm font-bold hover:bg-rose-500/25 transition-all duration-150 active:scale-[0.98]">
              {t.removeFromGame}
            </button>
          )}
          {/* Mute — the personal "block this user" Apple's UGC guideline
              expects: hides their chat and emote rains on this device only. */}
          {canReport && (
            <button onClick={toggleMute}
              className={`relative w-full h-11 mt-2 rounded-xl text-sm font-bold transition-all duration-150 active:scale-[0.98] ring-1 ${muted
                ? 'bg-white/5 ring-white/15 text-slate-300 hover:bg-white/10'
                : 'bg-amber-500/10 ring-amber-400/30 text-amber-300 hover:bg-amber-500/20'}`}>
              {muted ? t.unmutePlayer : t.mutePlayer}
            </button>
          )}
          {canReport && (
            <button disabled={reported}
              onClick={() => { reportPlayer({ userId: player.user_id, name: player.display_name, roomCode }); setReported(true); }}
              className={`relative w-full h-11 mt-2 rounded-xl text-xs font-bold transition-all duration-150 active:scale-[0.98] ${reported
                ? 'text-emerald-300'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
              {reported ? `✓ ${t.reportThanks}` : t.reportPlayer}
            </button>
          )}
        </div>
    </Dialog>
  );
}
