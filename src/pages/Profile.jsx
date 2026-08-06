import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Settings, Lock, Check, Sparkles } from 'lucide-react';
import GameBackground from '@/components/GameBackground';
import PlayerAvatar from '@/components/progression/PlayerAvatar';
import { useToast } from '@/components/ui/use-toast';
import { useLang } from '@/lib/LanguageContext';
import {
  loadProfile, getProfile, subscribeProfile, purchaseCosmetic, equipCosmetic,
  challengeState, favoriteCategory, devUnlockAll, devResetProfile,
} from '@/lib/playerProfile';
import { ALL_COSMETICS, cosmeticById, RARITIES, TYPE_LABELS } from '@/lib/cosmetics';
import { shortCategory } from '@/lib/wordLists';
import { SEASON_NAME, todayKey, levelFromXp } from '@/lib/progression';

const TYPE_ORDER = ['emblem', 'banner', 'border', 'title', 'nameColor'];

function sourceLabel(c, t) {
  if (c.source.type === 'shop') return `${c.source.price} Picks`;
  if (c.source.type === 'level') return `${t.level} ${c.source.level}`;
  if (c.source.type === 'challenge') return SEASON_NAME;
  return '';
}

/**
 * The one cosmetic card. Fixed vertical slots — status (lock/equipped),
 * artwork, name, rarity badge, footer (price or unlock source) — so every
 * card in every grid is pixel-identical in size, padding, and rhythm.
 */
function CosmeticCard({ c, owned, equipped, onTap, justUnlocked, footer, footerClass }) {
  const rar = RARITIES[c.rarity];
  return (
    <motion.button onClick={() => onTap(c)}
      animate={justUnlocked ? { scale: [0.7, 1.12, 1] } : {}}
      transition={{ duration: 0.45 }}
      className={`glass-panel w-full rounded-2xl p-2 flex flex-col items-center text-center transition-all duration-150 active:scale-[0.97] hover:-translate-y-0.5 ring-1 ${equipped ? 'ring-[#ffcf7a]/70' : rar.ring} ${!owned && !footer ? 'opacity-80' : ''}`}>
      {/* Status slot — equipped check, lock, or empty; always 16px tall */}
      <span className="h-4 flex items-center justify-center">
        {equipped ? (
          <span className="w-4 h-4 rounded-full bg-gradient-to-b from-[#ffcb45] to-[#e08e05] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
            <Check className="w-2.5 h-2.5 text-[#2c1500]" strokeWidth={3.5} />
          </span>
        ) : !owned ? (
          <Lock className="w-3 h-3 text-slate-400" />
        ) : null}
      </span>
      {/* Artwork slot — always 44px tall */}
      <span className="h-11 w-full flex items-center justify-center mt-1">
        {c.type === 'emblem' && (
          <span className="w-11 h-11 rounded-full flex items-center justify-center text-xl"
            style={{ background: c.tile, boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2)' }}>{c.emoji}</span>
        )}
        {c.type === 'banner' && (
          <span className="w-full h-11 rounded-lg" style={{ background: c.css, boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.15)' }} />
        )}
        {c.type === 'border' && (
          <span className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center"
            style={{ boxShadow: `inset 0 0 0 2px ${c.ringColor}${c.shadow !== 'none' ? `, ${c.shadow}` : ''}` }}>
            <span className="text-lg">🙂</span>
          </span>
        )}
        {c.type === 'title' && (
          <span className={`w-full text-[11px] font-extrabold leading-tight ${rar.text}`}>“{c.name}”</span>
        )}
        {c.type === 'nameColor' && (
          <span className={`text-sm font-extrabold ${c.cls}`}>Name</span>
        )}
      </span>
      {/* Name slot — one line, always 16px tall */}
      <span className="h-4 w-full mt-1.5 text-[10px] font-bold text-slate-100 leading-4 truncate">{c.name}</span>
      {/* Rarity slot — always 16px tall */}
      <span className={`h-4 mt-1 px-2 flex items-center rounded-full text-[8px] font-extrabold ${rar.chip}`}>
        {rar.label}
      </span>
      {/* Footer slot — price or unlock source; always 16px tall */}
      <span className={`h-4 mt-1 flex items-center text-[10px] font-extrabold tabular-nums ${footerClass || 'text-amber-300'}`}>
        {footer || ' '}
      </span>
    </motion.button>
  );
}

function ChallengeRow({ def, bucket }) {
  const progress = Math.min(bucket.progress[def.id] || 0, def.target);
  const done = !!bucket.claimed[def.id];
  return (
    <div className="glass-tile px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-bold ${done ? 'text-emerald-300' : 'text-white'}`}>
          {done ? '✓ ' : ''}{def.name}
        </span>
        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-gradient-to-b from-[#ffcb45] to-[#e08e05] text-[#2c1500]">
          +{def.picks}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-black/40 overflow-hidden">
          <div className={`h-full rounded-full ${done ? 'bg-emerald-400' : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'}`}
            style={{ width: `${(progress / def.target) * 100}%`, transition: 'width 500ms ease' }} />
        </div>
        <span className="text-[10px] font-bold text-slate-400 tabular-nums">{progress}/{def.target}</span>
      </div>
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLang();
  const [profile, setProfile] = useState(getProfile());
  const [tab, setTab] = useState('collection'); // collection | shop | challenges
  const [justUnlocked, setJustUnlocked] = useState(null);

  useEffect(() => {
    loadProfile().then(setProfile);
    return subscribeProfile(setProfile);
  }, []);

  // TEMP: visible test switch — everything owned + 99999 Picks on, fresh
  // profile off. Remove before release.
  const testModeOn = ALL_COSMETICS.every(c => profile.owned?.includes(c.id));
  const toggleTestMode = () => {
    (testModeOn ? devResetProfile() : devUnlockAll()).then(() => {
      toast({ title: testModeOn ? 'Profile reset' : 'Everything unlocked!' });
    });
  };

  const banner = cosmeticById(profile.equipped?.banner);
  const title = cosmeticById(profile.equipped?.title);
  const nameColor = cosmeticById(profile.equipped?.nameColor);
  const games = profile.games_played || 0;
  const winRate = games > 0 ? Math.round(((profile.wins || 0) / games) * 100) : 0;
  const fav = favoriteCategory();
  const lvl = levelFromXp(profile.xp || 0);

  const onTapCosmetic = (c) => {
    const owned = profile.owned.includes(c.id);
    if (owned) {
      equipCosmetic(c.id);
      return;
    }
    if (c.source.type === 'shop') {
      const res = purchaseCosmetic(c.id);
      if (res.ok) {
        setJustUnlocked(c.id);
        toast({ title: `${t.unlocked} ${c.name}!`, description: `-${c.source.price} Picks` });
        setTimeout(() => setJustUnlocked(null), 600);
      } else if (res.reason === 'picks') {
        toast({ title: t.notEnoughPicks, variant: 'destructive' });
      }
    } else if (c.source.type === 'level') {
      toast({ title: `${t.unlockAtLevel} ${c.source.level}` });
    } else {
      toast({ title: `${SEASON_NAME} — ${t.challenges}` });
    }
  };

  const shopItems = ALL_COSMETICS.filter(c => c.source.type === 'shop');
  // Two featured items rotate daily
  const seed = Number(todayKey().replaceAll('-', ''));
  const notOwnedShop = shopItems.filter(c => !profile.owned.includes(c.id));
  const featured = [0, 1].map(i => notOwnedShop[(seed + i * 3) % Math.max(notOwnedShop.length, 1)]).filter(Boolean);
  const ch = challengeState();

  return (
    <div className="h-dvh overflow-hidden text-white flex flex-col relative"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)', paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
      <GameBackground />

      {/* Header */}
      <div className="shrink-0 w-full max-w-md mx-auto px-4 flex items-center gap-3 pb-2.5">
        <button onClick={() => navigate(-1)} className="header-btn shrink-0" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight flex-1">{t.profileTitle}</h1>
        <Link to="/profile-settings" className="header-btn shrink-0" aria-label={t.settings}>
          <Settings className="w-5 h-5" />
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar w-full max-w-md mx-auto px-4 pb-2" style={{ overscrollBehaviorY: 'contain' }}>
        {/* Identity card */}
        <div className="glass-card mb-3">
          <div className="relative h-20" style={{ background: banner?.css }}>
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="absolute -bottom-7 left-4">
              <PlayerAvatar profile={profile} name={profile.display_name} size={56} />
            </div>
            <span className="absolute -bottom-3 left-[52px] px-1.5 py-0.5 rounded-full bg-gradient-to-b from-violet-400 to-violet-700 ring-2 ring-[#12081f] text-[10px] font-extrabold leading-none">
              {lvl.level}
            </span>
            <span className="absolute right-3 bottom-2 px-2.5 py-1 rounded-full bg-gradient-to-b from-[#ffcb45] to-[#e08e05] text-[#2c1500] text-xs font-extrabold shadow-[0_2px_6px_-2px_rgba(0,0,0,0.5)] tabular-nums">
              {profile.picks || 0} Picks
            </span>
          </div>
          <div className="px-4 pt-8 pb-3">
            <p className={`text-lg font-extrabold leading-tight truncate ${nameColor?.cls || 'text-white'}`}>{profile.display_name || '—'}</p>
            {title && <p className={`text-xs font-bold ${RARITIES[title.rarity]?.text}`}>{title.name}</p>}
            {/* XP bar */}
            <div className="flex items-center gap-2 mt-2.5">
              <span className="text-[11px] font-extrabold text-violet-300 shrink-0">Lv {lvl.level}</span>
              <div className="flex-1 h-2 rounded-full bg-black/40 ring-1 ring-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                  style={{ width: `${(lvl.into / lvl.need) * 100}%` }} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 shrink-0 tabular-nums">{lvl.into}/{lvl.need} XP</span>
            </div>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-1.5 mt-3">
              {[[t.statGames, games], [t.statWins, profile.wins || 0], [t.statWinRate, `${winRate}%`], [t.statGuesses, profile.correct_guesses || 0]].map(([label, value]) => (
                <div key={label} className="glass-tile px-1 py-1.5 text-center">
                  <p className="text-sm font-extrabold leading-tight tabular-nums">{value}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 truncate">{label}</p>
                </div>
              ))}
            </div>
            {fav && (
              <p className="text-[11px] font-semibold text-slate-400 mt-2">
                {t.statFavorite}: <span className="text-violet-300 font-bold">{shortCategory(fav)}</span>
              </p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-3">
          {[['collection', t.collection], ['shop', t.shop], ['challenges', t.challenges]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 h-9 rounded-xl text-xs font-extrabold transition-all active:scale-[0.98] ${tab === id
                ? 'bg-gradient-to-b from-violet-400 via-violet-500 to-violet-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_6px_-2px_rgba(0,0,0,0.5)]'
                : 'bg-white/5 ring-1 ring-white/10 text-slate-300 hover:bg-white/10'}`}>
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'collection' && (
            <motion.div key="collection" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>
              {TYPE_ORDER.map(type => (
                <div key={type} className="mb-4">
                  <p className="section-label mb-2">{TYPE_LABELS[type]}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {ALL_COSMETICS.filter(c => c.type === type).map(c => {
                      const owned = profile.owned.includes(c.id);
                      return (
                        <CosmeticCard key={c.id} c={c} owned={owned}
                          equipped={profile.equipped?.[c.type] === c.id}
                          onTap={onTapCosmetic} justUnlocked={justUnlocked === c.id}
                          footer={owned ? '' : sourceLabel(c, t)}
                          footerClass={owned ? '' : 'text-slate-500'} />
                      );
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {tab === 'shop' && (
            <motion.div key="shop" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>
              {featured.length > 0 && (
                <div className="mb-4">
                  <p className="section-label mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" /> {t.featured}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {featured.map(c => (
                      <CosmeticCard key={c.id} c={c} owned={false} equipped={false}
                        onTap={onTapCosmetic} justUnlocked={justUnlocked === c.id}
                        footer={`${c.source.price} Picks`} />
                    ))}
                  </div>
                </div>
              )}
              {TYPE_ORDER.map(type => {
                const items = shopItems.filter(c => c.type === type && !profile.owned.includes(c.id));
                if (!items.length) return null;
                return (
                  <div key={type} className="mb-4">
                    <p className="section-label mb-2">{TYPE_LABELS[type]}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {items.map(c => (
                        <CosmeticCard key={c.id} c={c} owned={false} equipped={false}
                          onTap={onTapCosmetic} justUnlocked={justUnlocked === c.id}
                          footer={`${c.source.price} Picks`} />
                      ))}
                    </div>
                  </div>
                );
              })}
              <p className="text-center text-[11px] text-slate-500 font-medium pb-2">{t.shopFootnote}</p>
            </motion.div>
          )}

          {tab === 'challenges' && (
            <motion.div key="challenges" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>
              <p className="section-label mb-2">{t.dailyChallenges}</p>
              <div className="space-y-1.5 mb-4">
                {ch.daily.defs.map(def => <ChallengeRow key={def.id} def={def} bucket={ch.daily.bucket} />)}
              </div>
              <p className="section-label mb-2">{t.weeklyChallenges}</p>
              <div className="space-y-1.5 mb-4">
                {ch.weekly.defs.map(def => <ChallengeRow key={def.id} def={def} bucket={ch.weekly.bucket} />)}
              </div>
              <p className="section-label mb-2">{SEASON_NAME}</p>
              <div className="space-y-1.5 mb-2">
                {ch.season.defs.map(def => <ChallengeRow key={def.id} def={def} bucket={ch.season.bucket} />)}
              </div>
              <p className="text-center text-[11px] text-slate-500 font-medium pb-2">{t.seasonFootnote}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TEMP: test-mode switch — remove before release */}
        <div className="glass-tile flex items-center justify-between gap-3 px-3 py-2.5 mt-1 mb-2">
          <div className="min-w-0">
            <p className="text-xs font-bold text-white">Test mode</p>
            <p className="text-[10px] text-slate-400 font-medium">Unlock all cosmetics + 99,999 Picks. Off resets the profile.</p>
          </div>
          <button onClick={toggleTestMode} role="switch" aria-checked={testModeOn} aria-label="Test mode"
            className={`shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ${testModeOn
              ? 'bg-gradient-to-b from-[#ffcb45] to-[#e08e05]'
              : 'bg-black/40 ring-1 ring-white/15'}`}>
            <span className={`block w-5 h-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.5)] transition-transform duration-200 ${testModeOn ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
