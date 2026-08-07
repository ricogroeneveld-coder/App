import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Settings, Lock, Check, Sparkles } from 'lucide-react';
import GameBackground from '@/components/GameBackground';
import PlayerAvatar, { AvatarFrame, EmblemTile } from '@/components/progression/PlayerAvatar';
import BannerArt from '@/components/progression/BannerArt';
import PurchaseModal from '@/components/progression/PurchaseModal';
import { useToast } from '@/components/ui/use-toast';
import { useLang } from '@/lib/LanguageContext';
import {
  loadProfile, getProfile, subscribeProfile, purchaseCosmetic, equipCosmetic,
  challengeState, favoriteCategory, devUnlockAll, devResetProfile, remoteStatus,
} from '@/lib/playerProfile';
import { ALL_COSMETICS, cosmeticById, RARITIES, TYPE_LABELS, topEquippedRarity } from '@/lib/cosmetics';
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
 * Higher rarities feel alive: soft glow, a slow shine sweep, and twinkles.
 */
function CosmeticCard({ c, owned, equipped, onTap, justUnlocked, footer, footerClass }) {
  const rar = RARITIES[c.rarity];
  const fancy = c.rarity === 'legendary' || c.rarity === 'mythic';
  return (
    <motion.button onClick={() => onTap(c)}
      animate={justUnlocked ? { scale: [0.7, 1.12, 1] } : {}}
      transition={{ duration: 0.45 }}
      className={`glass-panel relative overflow-hidden w-full rounded-2xl p-2 flex flex-col items-center text-center transition-all duration-150 active:scale-[0.97] hover:-translate-y-0.5 ring-1 ${equipped ? 'ring-[#ffcf7a]/70' : rar.ring} ${rar.cardGlow} ${!owned && !footer ? 'opacity-80' : ''}`}>
      {fancy && <span aria-hidden className="fx-shine" />}
      {c.rarity === 'mythic' && (
        <span aria-hidden className="fx-twinkle absolute top-1.5 right-2 text-[9px] leading-none">✦</span>
      )}
      {justUnlocked && [...Array(6)].map((_, i) => (
        <motion.span key={i} aria-hidden
          className="absolute left-1/2 top-1/2 text-amber-300 text-sm leading-none pointer-events-none z-10"
          initial={{ x: -4, y: -8, opacity: 1, scale: 0.5 }}
          animate={{ x: Math.cos(i * Math.PI / 3) * 44 - 4, y: Math.sin(i * Math.PI / 3) * 44 - 8, opacity: 0, scale: 1.3 }}
          transition={{ duration: 0.75, ease: 'easeOut' }}>✦</motion.span>
      ))}
      {/* Status slot — equipped check, lock, or empty; always 16px tall */}
      <span className="h-4 flex items-center justify-center">
        {equipped ? (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.4 }}
            className="w-4 h-4 rounded-full bg-gradient-to-b from-[#ffcb45] to-[#e08e05] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
            <Check className="w-2.5 h-2.5 text-[#2c1500]" strokeWidth={3.5} />
          </motion.span>
        ) : !owned ? (
          <Lock className="w-3 h-3 text-slate-400" />
        ) : null}
      </span>
      {/* Artwork slot — always 44px tall */}
      <span className="h-11 w-full flex items-center justify-center mt-1">
        {c.type === 'emblem' && (
          <span className="relative w-11 h-11 rounded-full overflow-hidden flex shadow-[0_2px_6px_-1px_rgba(0,0,0,0.5)]">
            <EmblemTile emblem={c} fontSize={22} />
          </span>
        )}
        {c.type === 'banner' && (
          <BannerArt banner={c} className="relative w-full h-11 rounded-lg" />
        )}
        {c.type === 'border' && (
          <AvatarFrame frame={c.frame} size={44}>
            <span className="w-full h-full bg-black/50 flex items-center justify-center text-lg">🙂</span>
          </AvatarFrame>
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
  const [tab, setTab] = useState(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab');
    return ['collection', 'shop', 'challenges'].includes(wanted) ? wanted : 'collection';
  });
  const [justUnlocked, setJustUnlocked] = useState(null);
  const [purchase, setPurchase] = useState(null); // { c, balance } captured at tap

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
      setPurchase({ c, balance: profile.picks || 0 });
    } else if (c.source.type === 'level') {
      toast({ title: `${t.unlockAtLevel} ${c.source.level}` });
    } else {
      toast({ title: `${SEASON_NAME} — ${t.challenges}` });
    }
  };

  const confirmPurchase = (c) => {
    const res = purchaseCosmetic(c.id);
    if (res.ok) {
      setJustUnlocked(c.id);
      setTimeout(() => setJustUnlocked(null), 900);
    } else if (res.reason === 'picks') {
      toast({ title: t.notEnoughPicks, variant: 'destructive' });
    }
    return res;
  };

  const shopItems = ALL_COSMETICS.filter(c => c.source.type === 'shop');
  // Two featured items rotate daily
  const seed = Number(todayKey().replaceAll('-', ''));
  const notOwnedShop = shopItems.filter(c => !profile.owned.includes(c.id));
  const featured = [...new Set([0, 1, 2].map(i => notOwnedShop[(seed + i * 3) % Math.max(notOwnedShop.length, 1)]))].filter(Boolean);
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
        {/* Identity card — the player's collectible self. Ring and glow follow
            the highest equipped rarity; the banner is a live scene the avatar
            sits in, blended into the card body. */}
        <div className={`relative mb-3 rounded-[24px] overflow-hidden ring-1 ${RARITIES[topEquippedRarity(profile.equipped)].ring} ${RARITIES[topEquippedRarity(profile.equipped)].cardGlow} shadow-[0_16px_32px_-14px_rgba(0,0,0,0.7)]`}
          style={{ background: '#10141f' }}>
          <div className="relative h-24">
            <BannerArt banner={banner} animated className="absolute inset-0" />
            <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
              style={{ background: 'linear-gradient(180deg, transparent 0%, #10141f 100%)' }} />
            <span className="absolute right-3 top-2.5 px-2.5 py-1 rounded-full bg-gradient-to-b from-[#ffcb45] to-[#e08e05] text-[#2c1500] text-xs font-extrabold shadow-[0_2px_6px_-2px_rgba(0,0,0,0.5)] tabular-nums">
              {profile.picks || 0} Picks
            </span>
          </div>
          <div className="relative px-4 -mt-9">
            <span aria-hidden className="absolute left-4 top-10 w-18 h-4 rounded-full"
              style={{ width: 72, background: 'radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.55), transparent 70%)', filter: 'blur(3px)' }} />
            <div className="relative inline-block" style={{ filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.55))' }}>
              <PlayerAvatar profile={profile} name={profile.display_name} size={64} />
              <span className="absolute -bottom-1 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-gradient-to-b from-violet-400 to-violet-700 flex items-center justify-center text-[11px] font-extrabold text-white leading-none"
                style={{ boxShadow: '0 0 0 3px #10141f, 0 2px 5px rgba(0,0,0,0.6)' }}>
                {lvl.level}
              </span>
            </div>
          </div>
          <div className="relative px-4 pt-1.5 pb-3">
            <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-6 h-36"
              style={{ background: 'radial-gradient(70% 70% at 50% 0%, rgba(157,92,255,0.09), transparent 70%)' }} />
            <p className={`relative text-lg font-extrabold leading-tight truncate ${nameColor?.cls || 'text-white'}`}>{profile.display_name || '—'}</p>
            {title && (
              <span className={`relative inline-flex items-center h-5 mt-1 px-2 rounded-full text-[10px] font-extrabold ${RARITIES[title.rarity].chip}`}>
                {title.name}
              </span>
            )}
            {/* XP bar */}
            <div className="relative flex items-center gap-2 mt-2.5">
              <span className="text-[11px] font-extrabold text-violet-300 shrink-0">Lv {lvl.level}</span>
              <div className="flex-1 h-2 rounded-full bg-black/40 ring-1 ring-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-[0_0_8px_rgba(157,92,255,0.5)]"
                  style={{ width: `${(lvl.into / lvl.need) * 100}%` }} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 shrink-0 tabular-nums">{lvl.into}/{lvl.need} XP</span>
            </div>
            {/* Stats */}
            <div className="relative grid grid-cols-4 gap-1.5 mt-3">
              {[[t.statGames, games], [t.statWins, profile.wins || 0], [t.statWinRate, `${winRate}%`], [t.statGuesses, profile.correct_guesses || 0]].map(([label, value]) => (
                <div key={label} className="rounded-xl px-1 py-1.5 text-center bg-gradient-to-b from-white/[0.07] to-black/25 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_6px_-3px_rgba(0,0,0,0.5)]">
                  <p className="text-sm font-extrabold leading-tight tabular-nums">{value}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400 truncate">{label}</p>
                </div>
              ))}
            </div>
            {fav && (
              <p className="relative text-[11px] font-semibold text-slate-400 mt-2">
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
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="section-label flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" /> {t.featured}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500">{t.rotatesDaily}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {featured.map(c => (
                      <div key={c.id} className="featured-float">
                        <CosmeticCard c={c} owned={false} equipped={false}
                          onTap={onTapCosmetic} justUnlocked={justUnlocked === c.id}
                          footer={`${c.source.price} Picks`}
                          footerClass={(profile.picks || 0) >= c.source.price ? 'text-amber-300' : 'text-slate-500'} />
                      </div>
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
                          footer={`${c.source.price} Picks`}
                          footerClass={(profile.picks || 0) >= c.source.price ? 'text-amber-300' : 'text-slate-500'} />
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

        {/* Sync health — tells players (and the developer) whether cosmetics
            actually reach other players. */}
        {remoteStatus() === 'missing' ? (
          <p className="text-center text-[10px] font-semibold text-amber-400/90 leading-relaxed px-2 pb-2">
            ⚠ {t.syncMissing}
          </p>
        ) : remoteStatus() === 'ok' ? (
          <p className="text-center text-[10px] font-medium text-emerald-400/70 pb-2">
            ● {t.syncOk}
          </p>
        ) : null}
      </div>

      {purchase && (
        <PurchaseModal cosmetic={purchase.c} balance={purchase.balance}
          typeLabel={TYPE_LABELS[purchase.c.type].replace(/s$/, '')}
          onConfirm={confirmPurchase} onClose={() => setPurchase(null)} />
      )}
    </div>
  );
}
