import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Settings, Lock, Check, Sparkles, Pencil, ChevronDown } from 'lucide-react';
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
import { ALL_COSMETICS, cosmeticById, RARITIES, TYPE_LABELS, topEquippedRarity, COLLECTIONS, collectionItems, collectionProgress, sortByRarity, isHiddenCosmetic } from '@/lib/cosmetics';
import { shortCategory } from '@/lib/wordLists';
import { setGuestName, normalizeName, MAX_NAME_LENGTH } from '@/lib/guestIdentity';
import { SEASON_NAME, todayKey, msUntilNextDay, levelFromXp } from '@/lib/progression';
import { serverNow } from '@/lib/serverTime';
import { isDevToolsEnabled } from '@/lib/platform';

const TYPE_ORDER = ['emblem', 'banner', 'border', 'title', 'nameColor'];

function sourceLabel(c, t) {
  if (c.source.type === 'shop') return `${c.source.price} Picks`;
  if (c.source.type === 'level') return `${t.level} ${c.source.level}`;
  if (c.source.type === 'challenge') return SEASON_NAME;
  if (c.source.type === 'reward') return t.collectionReward;
  if (c.source.type === 'beta') return t.betaExclusive;
  return '';
}

/** Album cover for one collection — live scene, progress, limited tag. */
function CollectionCover({ col, owned, onOpen }) {
  const { have, total } = collectionProgress(col.id, owned);
  const done = have >= total && total > 0;
  return (
    <motion.button onClick={onOpen} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`relative h-24 rounded-2xl overflow-hidden text-left ring-1 transition-transform duration-150 active:scale-[0.97] hover:-translate-y-0.5 ${done ? 'ring-[#ffcf7a]/70 shadow-[0_0_18px_-8px_rgba(255,203,69,0.6)]' : 'ring-white/15'}`}>
      <BannerArt banner={cosmeticById(col.cover)} className="absolute inset-0" motifScale={0.8} />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/20" />
      {col.limited && (
        <span className="absolute right-1.5 top-1.5 px-1.5 py-0.5 rounded bg-gradient-to-b from-rose-400 to-rose-700 text-[8px] font-extrabold text-white uppercase tracking-wide shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
          Limited
        </span>
      )}
      <span className="absolute inset-x-2.5 bottom-2">
        <span className="flex items-center gap-1.5">
          <span className="text-base leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]">{col.emoji}</span>
          <span className="text-sm font-extrabold text-white truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{col.name}</span>
          <span className={`ml-auto text-[10px] font-extrabold tabular-nums ${done ? 'text-amber-300' : 'text-slate-300'}`}>
            {done ? '✓' : `${have}/${total}`}
          </span>
        </span>
        <span className="mt-1 block h-1 rounded-full bg-black/50 overflow-hidden">
          <span className={`block h-full rounded-full ${done ? 'bg-gradient-to-r from-[#ffcb45] to-[#e08e05]' : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'}`}
            style={{ width: `${total ? (have / total) * 100 : 0}%` }} />
        </span>
      </span>
    </motion.button>
  );
}

// Soft rarity light behind the artwork — sells the piece as an exhibit.
const ART_GLOW = {
  common: 'rgba(148,163,184,0.12)',
  rare: 'rgba(56,189,248,0.16)',
  epic: 'rgba(157,92,255,0.2)',
  legendary: 'rgba(255,180,60,0.2)',
  mythic: 'rgba(232,121,249,0.2)',
};

/**
 * The one cosmetic card. Fixed vertical slots — ownership status, artwork on
 * a rarity-lit backdrop, name, rarity badge, price/source — pixel-identical
 * in every grid. Ownership is always explicit: gold check = equipped, muted
 * check = owned, lock = locked. Prices render as pills (gold when
 * affordable). Border previews show the ring itself around a neutral disc.
 */
function CosmeticCard({ c, owned, equipped, onTap, justUnlocked, sourceText = undefined, price = undefined, affordable = false, playerName }) {
  const rar = RARITIES[c.rarity];
  const fancy = c.rarity === 'legendary' || c.rarity === 'mythic' || c.rarity === 'special';
  return (
    <motion.button onClick={() => onTap(c)}
      animate={justUnlocked ? { scale: [0.7, 1.12, 1] } : {}}
      transition={{ duration: 0.45 }}
      className={`glass-panel relative overflow-hidden w-full rounded-2xl p-2.5 flex flex-col items-center text-center transition-all duration-150 active:scale-[0.97] hover:-translate-y-0.5 ${equipped ? 'ring-[1.5px] ring-[#ffcf7a]/80' : c.rarity === 'mythic' ? '' : `ring-[1.5px] ${rar.ring}`} ${rar.cardGlow}`}>
      {/* Glass relief — top highlight, soft base shadow */}
      <span aria-hidden className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.09), inset 0 -8px 14px -10px rgba(0,0,0,0.55)' }} />
      {c.rarity === 'mythic' && !equipped && <span aria-hidden className="rainbow-border" />}
      {c.rarity === 'epic' && !equipped && (
        <span aria-hidden className="frame-breathe absolute inset-0 rounded-2xl pointer-events-none"
          style={{ boxShadow: '0 0 16px -7px rgba(157,92,255,0.5), inset 0 0 12px -8px rgba(157,92,255,0.4)' }} />
      )}
      {equipped && (
        <span aria-hidden className="frame-breathe absolute inset-0 rounded-2xl pointer-events-none"
          style={{ boxShadow: '0 0 14px -5px rgba(255,203,69,0.5), inset 0 0 10px -7px rgba(255,203,69,0.35)' }} />
      )}
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
      {/* Ownership slot — always explicit; always 16px tall */}
      <span className="h-4 flex items-center justify-center">
        {equipped ? (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.4 }}
            className="w-4 h-4 rounded-full bg-gradient-to-b from-[#ffcb45] to-[#e08e05] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
            <Check className="w-2.5 h-2.5 text-[#2c1500]" strokeWidth={3.5} />
          </motion.span>
        ) : owned ? (
          <span className="w-4 h-4 rounded-full bg-white/10 ring-1 ring-white/20 flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-slate-300" strokeWidth={3} />
          </span>
        ) : (
          <span className="w-4 h-4 rounded-full bg-black/40 ring-1 ring-white/15 flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
            <Lock className="w-2.5 h-2.5 text-slate-300" />
          </span>
        )}
      </span>
      {/* Artwork slot — object artwork (emblems, banners, borders) sits on a
          soft rarity-lit backdrop; text artwork (titles, name styles) gets no
          backdrop — a glow blob behind text reads as a smudge. */}
      <span className="relative h-11 w-full flex items-center justify-center mt-1">
        {c.type !== 'title' && c.type !== 'nameColor' && (
          <span aria-hidden className="absolute w-14 h-11 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(50% 60% at 50% 50%, ${ART_GLOW[c.rarity]}, transparent 75%)` }} />
        )}
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
            <span className="w-full h-full rounded-full"
              style={{ background: 'radial-gradient(120% 120% at 32% 18%, #2b3245 0%, #171c2b 55%, #0d1019 100%)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.12), inset 0 -2px 4px rgba(0,0,0,0.5)' }} />
          </AvatarFrame>
        )}
        {c.type === 'title' && (
          <span className={`relative w-full text-[11px] font-extrabold leading-tight ${rar.text}`}
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {c.name}
          </span>
        )}
        {c.type === 'nameColor' && (
          <span className={`relative w-full text-sm font-extrabold truncate ${c.cls}`}>{playerName || 'Name'}</span>
        )}
      </span>
      {/* Name slot — one line, always 16px tall (titles already show their
          name as the artwork, so it isn't repeated) */}
      <span className="h-4 w-full mt-1.5 text-[10px] font-bold text-white leading-4 truncate">{c.type === 'title' ? '' : c.name}</span>
      {/* Rarity slot — always 16px tall */}
      <span className={`h-4 mt-1 px-2 flex items-center rounded-full text-[8px] font-extrabold ${rar.chip}`}>
        {rar.label}
      </span>
      {/* Price / source slot — always 18px tall */}
      <span className="h-[18px] mt-1 flex items-center justify-center">
        {owned ? null : price != null ? (
          <span className={`inline-flex items-center gap-0.5 h-[18px] px-2 rounded-full text-[9px] font-extrabold tabular-nums ${affordable
            ? 'bg-gradient-to-b from-[#ffcb45] to-[#e08e05] text-[#2c1500] shadow-[0_2px_4px_-2px_rgba(0,0,0,0.6)]'
            : 'bg-black/40 ring-1 ring-white/15 text-slate-400'}`}>
            {!affordable && <Lock className="w-2 h-2" />}
            {price} Picks
          </span>
        ) : sourceText ? (
          <span className="inline-flex items-center h-[18px] max-w-full px-2 rounded-full bg-white/5 ring-1 ring-white/10 text-[9px] font-bold text-slate-400 whitespace-nowrap truncate">
            {sourceText}
          </span>
        ) : null}
      </span>
    </motion.button>
  );
}

/**
 * Large featured showcase — the day's headline item presented inside a live
 * banner scene with its equipped-context preview, like a storefront window.
 */
function HeroFeatured({ c, profile, onTap, featuredLabel }) {
  const rar = RARITIES[c.rarity];
  const myEmblem = cosmeticById(profile.equipped?.emblem);
  const bannerBg = c.type === 'banner' ? c : cosmeticById(profile.equipped?.banner);
  const affordable = (profile.picks || 0) >= c.source.price;
  return (
    <motion.button onClick={() => onTap(c)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`relative w-full h-28 mb-2 rounded-2xl overflow-hidden text-left ring-1 ${rar.ring} ${rar.cardGlow} transition-transform duration-150 active:scale-[0.98] hover:-translate-y-0.5`}>
      <BannerArt banner={bannerBg} animated className="absolute inset-0" />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-black/55" />
      <span aria-hidden className="fx-shine" />
      <span className="relative h-full flex items-center gap-3.5 px-4">
        {c.type === 'emblem' && (
          <span className="relative w-16 h-16 rounded-full overflow-hidden flex shrink-0"
            style={{ filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.55))' }}>
            <EmblemTile emblem={c} fontSize={30} breathe />
          </span>
        )}
        {c.type === 'border' && (
          <span className="shrink-0" style={{ filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.55))' }}>
            <AvatarFrame frame={c.frame} size={64}>
              {myEmblem
                ? <EmblemTile emblem={myEmblem} fontSize={28} />
                : <span className="w-full h-full bg-black/50 flex items-center justify-center text-2xl">🙂</span>}
            </AvatarFrame>
          </span>
        )}
        {c.type === 'title' && (
          <span className={`inline-flex items-center max-w-[45%] h-7 px-3 rounded-full text-xs font-extrabold ${rar.chip} shadow-[0_4px_10px_-4px_rgba(0,0,0,0.6)]`}>
            <span className="truncate">{c.name}</span>
          </span>
        )}
        {c.type === 'nameColor' && (
          <span className={`shrink-0 text-xl font-extrabold ${c.cls} drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]`}>{profile.display_name || 'Name'}</span>
        )}
        <span className="flex-1 min-w-0">
          <span className={`block text-[10px] font-extrabold uppercase tracking-[0.14em] ${rar.text}`}>
            {rar.label} · {featuredLabel}
          </span>
          <span className="block text-lg font-extrabold text-white leading-tight truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">{c.name}</span>
          <span className={`inline-flex items-center mt-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold tabular-nums shadow-[0_2px_6px_-2px_rgba(0,0,0,0.6)] ${affordable
            ? 'bg-gradient-to-b from-[#ffcb45] to-[#e08e05] text-[#2c1500]'
            : 'bg-black/40 ring-1 ring-white/20 text-slate-300'}`}>
            {c.source.price} Picks
          </span>
        </span>
      </span>
    </motion.button>
  );
}

/**
 * Collection album page — themed hero art, lore, progress, the full matching
 * set in equipped-context cards, and the exclusive completion reward.
 */
function CollectionPanel({ col, profile, onTap, justUnlocked, onClose, t }) {
  const items = sortByRarity(collectionItems(col.id));
  const { have, total } = collectionProgress(col.id, profile.owned);
  const done = have >= total && total > 0;
  const reward = cosmeticById(col.reward);
  const rewardOwned = profile.owned.includes(col.reward);
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', duration: 0.45 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-sm max-h-[85dvh] rounded-[24px] overflow-hidden ring-1 ring-white/15 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.8)] flex flex-col"
        style={{ background: '#10141f' }}>
        <div className="relative h-24 shrink-0">
          <BannerArt banner={cosmeticById(col.cover)} animated className="absolute inset-0" />
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
            style={{ background: 'linear-gradient(180deg, transparent, #10141f)' }} />
          <button onClick={onClose} aria-label="Close"
            className="absolute right-2 top-2 p-2.5 rounded-xl bg-black/25 backdrop-blur-sm hover:bg-black/40 text-white/80 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="absolute left-4 bottom-2 flex items-center gap-2">
            <span className="text-2xl leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">{col.emoji}</span>
            <span className="text-lg font-extrabold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{col.name}</span>
            {col.limited && (
              <span className="px-1.5 py-0.5 rounded bg-gradient-to-b from-rose-400 to-rose-700 text-[8px] font-extrabold text-white uppercase tracking-wide">Limited</span>
            )}
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar px-4 pt-1 pb-4">
          <p className="text-[11px] font-semibold text-slate-400 italic mt-1 mb-2">“{col.lore}”</p>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-1.5 rounded-full bg-black/40 ring-1 ring-white/10 overflow-hidden">
              <div className={`h-full rounded-full ${done ? 'bg-gradient-to-r from-[#ffcb45] to-[#e08e05]' : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'}`}
                style={{ width: `${total ? (have / total) * 100 : 0}%`, transition: 'width 500ms ease' }} />
            </div>
            <span className="text-[10px] font-extrabold text-slate-300 tabular-nums">{have}/{total}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {items.map(c => (
              <CosmeticCard key={c.id} c={c} owned={profile.owned.includes(c.id)}
                equipped={profile.equipped?.[c.type] === c.id}
                onTap={onTap} justUnlocked={justUnlocked === c.id}
                sourceText={c.source.type !== 'shop' ? sourceLabel(c, t) : undefined}
                price={c.source.type === 'shop' ? c.source.price : undefined}
                affordable={(profile.picks || 0) >= (c.source.price || 0)}
                playerName={profile.display_name} />
            ))}
          </div>
          {/* Completion reward */}
          {reward && (
            <div className={`mt-3 rounded-2xl p-3 flex items-center gap-3 ring-1 ${rewardOwned
              ? 'bg-gradient-to-b from-[#3a2400]/70 to-[#1a0f00]/70 ring-[#ffcf7a]/50'
              : 'bg-white/5 ring-white/10'}`}>
              <span className="text-xl">{rewardOwned ? '🏆' : '🔒'}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{t.completionReward}</span>
                <span className={`block text-sm font-extrabold truncate ${reward.cls || RARITIES[reward.rarity].text}`}>{reward.name}</span>
              </span>
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${RARITIES[reward.rarity].chip}`}>{RARITIES[reward.rarity].label}</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ChallengeRow({ def, bucket }) {
  const { t } = useLang();
  const progress = Math.min(bucket.progress[def.id] || 0, def.target);
  const done = !!bucket.claimed[def.id];
  return (
    <div className="glass-tile px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-bold ${done ? 'text-emerald-300' : 'text-white'}`}>
          {done ? '✓ ' : ''}{t.challengeNames[def.id] || def.name}
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
  const [openCollection, setOpenCollection] = useState(null); // collection id
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  // Collapsed shop sections, remembered across visits
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wmp_shop_collapsed') || '{}'); } catch { return {}; }
  });
  const toggleSection = (type) => setCollapsed(prev => {
    const next = { ...prev, [type]: !prev[type] };
    try { localStorage.setItem('wmp_shop_collapsed', JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  // "New stock in 5h 12m" — a rotation without a visible clock reads as
  // static inventory. Ticks each minute; only rendered on the shop tab.
  const [rotateLeft, setRotateLeft] = useState(msUntilNextDay(new Date(serverNow())));
  useEffect(() => {
    if (tab !== 'shop') return;
    setRotateLeft(msUntilNextDay(new Date(serverNow())));
    const iv = setInterval(() => setRotateLeft(msUntilNextDay(new Date(serverNow()))), 60000);
    return () => clearInterval(iv);
  }, [tab]);
  const rotateCountdown = (() => {
    const mins = Math.max(1, Math.round(rotateLeft / 60000));
    const h = Math.floor(mins / 60); const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })();

  const saveRename = async () => {
    const clean = normalizeName(nameDraft);
    if (!clean) return;
    setGuestName(clean);
    await loadProfile(); // syncs display_name from the guest identity
    setRenaming(false);
    toast({ title: t.nameSaved });
  };

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
  // Developer UI (test-mode toggle, sync diagnostics) only on flagged
  // devices in a build compiled with dev tools enabled — never in a real
  // production build, regardless of what's sitting in localStorage.
  const devMode = (() => {
    if (!isDevToolsEnabled()) return false;
    try { return localStorage.getItem('wmp_dev') === '1'; } catch { return false; }
  })();

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
    } else if (c.source.type === 'reward') {
      toast({ title: t.completeCollectionHint });
    } else if (c.source.type === 'beta') {
      toast({ title: t.betaExclusive });
    } else {
      toast({ title: `${SEASON_NAME} — ${t.challenges}` });
    }
  };

  const confirmPurchase = (c) => {
    const res = purchaseCosmetic(c.id);
    if (res.ok) {
      setJustUnlocked(c.id);
      setTimeout(() => setJustUnlocked(null), 900);
      for (const col of res.completed || []) {
        const reward = cosmeticById(col.reward);
        toast({ title: `🏆 ${col.emoji} ${col.name} — ${t.collectionComplete}`, description: reward ? `${t.unlocked}: ${reward.name}` : undefined });
      }
    } else if (res.reason === 'picks') {
      toast({ title: t.notEnoughPicks, variant: 'destructive' });
    }
    return res;
  };

  const shopItems = ALL_COSMETICS.filter(c => c.source.type === 'shop' && !isHiddenCosmetic(c.id));
  // The whole shop rotates every 24h: a deterministic date-seeded shuffle
  // picks one row (3 items) per section, so every visit after midnight shows
  // fresh stock. This daily rotation is intentional (the "come back tomorrow
  // for the item you want" hook) — an item that isn't in stock today comes
  // back around on a later day. Collection-set items are also buyable anytime
  // from their album; other items wait for their rotation slot.
  const seed = Number(todayKey(new Date(serverNow())).replaceAll('-', ''));
  const seededPick = (arr, n, s) => {
    const a = [...arr];
    let x = s || 1;
    const rand = () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; };
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  };
  const notOwnedShop = shopItems.filter(c => !profile.owned.includes(c.id));
  const featured = [...new Set([0, 1, 2].map(i => notOwnedShop[(seed + i * 3) % Math.max(notOwnedShop.length, 1)]))].filter(Boolean);
  const featuredIds = new Set(featured.map(c => c.id));
  // Rows stay 3 wide even late-game: when fewer than 3 unowned items remain
  // in a type, owned ones (shown with their check) pad out the row. A type
  // with nothing left to buy disappears entirely.
  const dailyStock = Object.fromEntries(TYPE_ORDER.map((type, i) => {
    const pool = shopItems.filter(c => c.type === type && !featuredIds.has(c.id));
    const unowned = pool.filter(c => !profile.owned.includes(c.id));
    if (!unowned.length) return [type, []];
    const picks = seededPick(unowned, 3, seed + i * 7919);
    if (picks.length < 3) {
      const ownedPool = pool.filter(c => profile.owned.includes(c.id));
      picks.push(...seededPick(ownedPool, 3 - picks.length, seed + i * 104729));
    }
    return [type, sortByRarity(picks)];
  }));
  // "Earn by Playing" = the LEVEL unlocks, ordered low → high level so the
  // next milestone shows first. Collection-set rewards (source 'reward') are
  // earned by completing a set, not by levelling, so they live in the
  // Collection albums, not here. Beta gifts stay out entirely.
  const earnItems = ALL_COSMETICS
    .filter(c => c.source.type === 'level' && !isHiddenCosmetic(c.id) && !profile.owned.includes(c.id))
    .sort((a, b) => a.source.level - b.source.level);
  const ch = challengeState();

  return (
    <div className="h-dvh overflow-hidden text-white flex flex-col relative"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)', paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}>
      <GameBackground />

      {/* Header */}
      <div className="shrink-0 w-full max-w-md mx-auto px-4 flex items-center gap-3 pb-2.5">
        <button onClick={() => navigate(-1)} className="header-btn shrink-0" aria-label={t.backLabel}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight flex-1">{t.profileTitle}</h1>
        <Link to="/profile-settings" className="header-btn shrink-0" aria-label={t.settings}>
          <Settings className="w-5 h-5" />
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar w-full max-w-md mx-auto px-4 pt-1 pb-2" style={{ overscrollBehaviorY: 'contain' }}>
        {/* Identity card — the player's collectible self. Ring and glow follow
            the highest equipped rarity; the banner is a live scene the avatar
            sits in, blended into the card body. */}
        <div className={`relative mb-3 rounded-[24px] overflow-hidden ring-1 ${RARITIES[topEquippedRarity(profile.equipped)].ring} ${RARITIES[topEquippedRarity(profile.equipped)].cardGlow} shadow-[0_16px_32px_-14px_rgba(0,0,0,0.7)]`}
          style={{ background: '#10141f' }}>
          <div className="relative h-24">
            <BannerArt banner={banner} animated className="absolute inset-0" />
            <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
              style={{ background: 'linear-gradient(180deg, transparent 0%, #10141f 100%)' }} />
          </div>
          <div className="relative px-4 -mt-9">
            <span aria-hidden className="absolute left-4 top-10 w-18 h-4 rounded-full"
              style={{ width: 72, background: 'radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.55), transparent 70%)', filter: 'blur(3px)' }} />
            <div className="relative inline-flex" style={{ filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.55))' }}>
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
            <div className="relative flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className={`text-lg font-extrabold leading-tight truncate ${nameColor?.cls || 'text-white'}`}>{profile.display_name || '—'}</p>
                  <button onClick={() => { setNameDraft(profile.display_name || ''); setRenaming(true); }}
                    aria-label={t.editName}
                    className="shrink-0 w-8 h-8 -my-1 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-150 active:scale-[0.95]">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
                {title && (
                  <span className={`inline-flex items-center max-w-full h-5 mt-1 px-2 rounded-full text-[10px] font-extrabold ${RARITIES[title.rarity].chip}`}>
                    <span className="truncate">{title.name}</span>
                  </span>
                )}
              </div>
              <span className="shrink-0 mt-0.5 px-2.5 py-1 rounded-full bg-gradient-to-b from-[#ffcb45] to-[#e08e05] text-[#2c1500] text-xs font-extrabold shadow-[0_2px_6px_-2px_rgba(0,0,0,0.5)] tabular-nums">
                {profile.picks || 0} Picks
              </span>
            </div>
            {/* XP bar */}
            <div className="relative flex items-center gap-2 mt-2.5">
              <span className="text-[11px] font-extrabold text-violet-300 shrink-0">Lv {lvl.level}</span>
              <div className="flex-1 h-2 rounded-full bg-black/40 ring-1 ring-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-[0_0_8px_rgba(157,92,255,0.5)]"
                  style={{ width: `${Math.min((lvl.into / lvl.need) * 100, 100)}%` }} />
              </div>
              {/* ECON-8: at the cap show MAX instead of an overflowing ratio. */}
              <span className="text-[10px] font-bold text-slate-400 shrink-0 tabular-nums">{lvl.maxed ? 'MAX' : `${lvl.into}/${lvl.need} XP`}</span>
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
              className={`flex-1 h-11 rounded-xl text-xs font-extrabold transition-all active:scale-[0.98] ${tab === id
                ? 'bg-gradient-to-b from-violet-400 via-violet-500 to-violet-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_6px_-2px_rgba(0,0,0,0.5)]'
                : 'bg-white/5 ring-1 ring-white/10 text-slate-300 hover:bg-white/10'}`}>
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'collection' && (
            <motion.div key="collection" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>
              {/* The locker: only items the player actually owns. Buying happens
                  exclusively in the Shop (daily rotation) — the counter still
                  shows collection progress against the full catalog. */}
              {TYPE_ORDER.map(type => {
                // Owned hidden items still show; unowned ones don't count
                // toward the total, so the counter stays honestly reachable.
                const all = sortByRarity(ALL_COSMETICS.filter(c => c.type === type &&
                  (!isHiddenCosmetic(c.id) || profile.owned.includes(c.id))));
                const items = all.filter(c => profile.owned.includes(c.id));
                const key = `col_${type}`;
                const isCollapsed = !!collapsed[key];
                return (
                  <div key={type} className="mb-3">
                    <button onClick={() => toggleSection(key)} aria-expanded={!isCollapsed}
                      className="w-full min-h-[44px] flex items-center justify-between px-1 rounded-xl transition-colors hover:bg-white/5 active:scale-[0.99]">
                      <span className="section-label">{TYPE_LABELS[type]}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500 tabular-nums">
                          {items.length}/{all.length}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                      </span>
                    </button>
                    <motion.div initial={false}
                      animate={{ height: isCollapsed ? 0 : 'auto', opacity: isCollapsed ? 0 : 1 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden -mx-3 px-3">
                      {items.length === 0 ? (
                        <p className="text-[11px] font-semibold text-slate-400 px-1 pt-1 pb-2">{t.collectionEmpty}</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 pt-1 pb-1">
                          {items.map(c => (
                            <CosmeticCard key={c.id} c={c} owned
                              equipped={profile.equipped?.[c.type] === c.id}
                              onTap={onTapCosmetic} justUnlocked={justUnlocked === c.id}
                              playerName={profile.display_name} />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </div>
                );
              })}
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
                    <p className="text-[10px] font-bold text-slate-400">{t.newStockIn(rotateCountdown)}</p>
                  </div>
                  <HeroFeatured c={featured[0]} profile={profile} onTap={onTapCosmetic} featuredLabel={t.featured} />
                </div>
              )}
              {/* Collections — matching sets with exclusive completion rewards */}
              <div className="mb-4">
                <p className="section-label mb-2">{t.collectionsLabel}</p>
                <div className="grid grid-cols-2 gap-2">
                  {COLLECTIONS.filter(col =>
                    // Hidden collections (Royal, Founder) are stashed for a
                    // later release; the beta album only exists for players
                    // who hold a piece of it.
                    !col.hidden &&
                    (col.id !== 'col_beta' ||
                    collectionItems(col.id).some(i => profile.owned.includes(i.id)))
                  ).map(col => (
                    <CollectionCover key={col.id} col={col} owned={profile.owned}
                      onOpen={() => setOpenCollection(col.id)} />
                  ))}
                </div>
              </div>
              <div className="flex items-end justify-between mb-1 px-1">
                <p className="section-label">{t.todaysShop}</p>
                <p className="text-[10px] font-bold text-slate-400">{t.newStockIn(rotateCountdown)}</p>
              </div>
              {TYPE_ORDER.map(type => {
                const items = dailyStock[type];
                if (!items.length) return null;
                const isCollapsed = !!collapsed[type];
                return (
                  <div key={type} className="mb-3">
                    <button onClick={() => toggleSection(type)} aria-expanded={!isCollapsed}
                      className="w-full min-h-[44px] flex items-center justify-between px-1 rounded-xl transition-colors hover:bg-white/5 active:scale-[0.99]">
                      <span className="section-label">{TYPE_LABELS[type]}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500 tabular-nums">{items.length}</span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                      </span>
                    </button>
                    <motion.div initial={false}
                      animate={{ height: isCollapsed ? 0 : 'auto', opacity: isCollapsed ? 0 : 1 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden -mx-3 px-3">
                      <div className="grid grid-cols-3 gap-2 pt-1 pb-1">
                        {items.map(c => (
                          <CosmeticCard key={c.id} c={c} owned={profile.owned.includes(c.id)}
                            equipped={profile.equipped?.[c.type] === c.id}
                            onTap={onTapCosmetic} justUnlocked={justUnlocked === c.id}
                            price={c.source.price} affordable={(profile.picks || 0) >= c.source.price}
                            playerName={profile.display_name} />
                        ))}
                      </div>
                    </motion.div>
                  </div>
                );
              })}
              {earnItems.length > 0 && (
                <div className="mb-3">
                  <button onClick={() => toggleSection('earn')} aria-expanded={!collapsed.earn}
                    className="w-full min-h-[44px] flex items-center justify-between px-1 rounded-xl transition-colors hover:bg-white/5 active:scale-[0.99]">
                    <span className="section-label">{t.earnByPlaying}</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-500 tabular-nums">{earnItems.length}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${collapsed.earn ? '-rotate-90' : ''}`} />
                    </span>
                  </button>
                  <motion.div initial={false}
                    animate={{ height: collapsed.earn ? 0 : 'auto', opacity: collapsed.earn ? 0 : 1 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden -mx-3 px-3">
                    <div className="grid grid-cols-3 gap-2 pt-1 pb-1">
                      {earnItems.map(c => (
                        <CosmeticCard key={c.id} c={c} owned={false}
                          equipped={false}
                          onTap={onTapCosmetic} justUnlocked={justUnlocked === c.id}
                          sourceText={sourceLabel(c, t)}
                          playerName={profile.display_name} />
                      ))}
                    </div>
                  </motion.div>
                </div>
              )}
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
              <p className="text-center text-[11px] text-slate-400 font-medium pb-2">{t.seasonFootnote}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dev-only: test-mode switch (visible only after a ?dev= visit) */}
        {devMode && (
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
        )}

        {/* Sync health — tells players (and the developer) whether cosmetics
            actually reach other players. */}
        {!devMode ? null : remoteStatus() === 'missing' ? (
          <p className="text-center text-[10px] font-semibold text-amber-400/90 leading-relaxed px-2 pb-2">
            ⚠ {t.syncMissing}
          </p>
        ) : remoteStatus() === 'ok' ? (
          <p className="text-center text-[10px] font-medium text-emerald-400/70 pb-2">
            ● {t.syncOk}
          </p>
        ) : null}
      </div>

      {renaming && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => setRenaming(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', duration: 0.4 }}
            onClick={e => e.stopPropagation()}
            className="glass-card w-full max-w-xs bg-slate-900/95 p-5">
            <p className="text-base font-extrabold text-white mb-3">{t.editName}</p>
            <input value={nameDraft} onChange={e => setNameDraft(e.target.value.slice(0, MAX_NAME_LENGTH))}
              onKeyDown={e => e.key === 'Enter' && saveRename()}
              maxLength={MAX_NAME_LENGTH} enterKeyHint="done" autoFocus
              placeholder={t.displayNamePlaceholder}
              className="inset-input w-full h-12 px-4 text-base rounded-xl mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setRenaming(false)}
                className="flex-1 h-11 rounded-[14px] bg-white/5 ring-1 ring-white/15 text-sm font-bold text-slate-300 hover:bg-white/10 transition-all duration-150 active:scale-[0.97]">
                {t.cancel}
              </button>
              <button onClick={saveRename} disabled={!normalizeName(nameDraft)}
                className="gold-btn flex-1 h-11 rounded-[14px] flex items-center justify-center">
                <span className="relative text-sm font-extrabold tracking-tight text-[#2c1500] drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">{t.saveBtn}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {openCollection && (
        <CollectionPanel col={COLLECTIONS.find(c => c.id === openCollection)} profile={profile}
          onTap={onTapCosmetic} justUnlocked={justUnlocked} onClose={() => setOpenCollection(null)} t={t} />
      )}
      {purchase && (
        <PurchaseModal cosmetic={purchase.c} balance={purchase.balance}
          typeLabel={TYPE_LABELS[purchase.c.type].replace(/s$/, '')} profile={profile}
          onConfirm={confirmPurchase} onClose={() => setPurchase(null)} />
      )}
    </div>
  );
}
