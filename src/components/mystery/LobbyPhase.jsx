import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MysteryPlayer, MysteryRoom } from '@/api/db';
import { supabase } from '@/lib/supabaseClient';
import { leaveRoom } from '@/lib/roomLifecycle';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Check, Users, Crown, ArrowRight, ChevronRight, Sparkles, ArrowLeft, HelpCircle, X, Share, Palette, MessageCircle } from 'lucide-react';
import { shareRoomInvite } from '@/lib/share';
import { useNavigate } from 'react-router-dom';
import { shortCategory, categoryMeta } from '@/lib/wordLists';
import { useLang } from '@/lib/LanguageContext';
import GameBackground from '@/components/GameBackground';
import lobbyTitleImage from '../../../lobby-title.webp';
import CategorySelector from './CategorySelector';
import ChatPanel from './ChatPanel';
import RoomTabBar from './RoomTabBar';
import QuickEquip from './QuickEquip';
import EmojiRain from './EmojiRain';
import useUnreadChat from './useUnreadChat';
import PlayerAvatar from '@/components/progression/PlayerAvatar';
import PlayerCardModal from '@/components/progression/PlayerCardModal';
import BannerArt from '@/components/progression/BannerArt';
import usePeerProfiles from '@/components/progression/usePeerProfiles';
import { cosmeticById, RARITIES } from '@/lib/cosmetics';
import { Dialog } from '@/components/ui/dialog';

export default function LobbyPhase({ room, players, me, myPlayer, roomCode }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(room.category || '');
  const [loading, setLoading] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [cardPlayer, setCardPlayer] = useState(null);
  const [tab, setTab] = useState('lobby'); // 'lobby' | 'profile' | 'chat'
  const [starting, setStarting] = useState(false);
  const [startCountdown, setStartCountdown] = useState(3);
  const profiles = usePeerProfiles(players);
  const isHost = room.host_id === me?.id;
  const meta = categoryMeta(selectedCategory);
  const [rain, setRain] = useState({ emote: null, trigger: 0 });
  const unreadChat = useUnreadChat(roomCode, me?.id, tab === 'chat',
    (emote) => setRain(r => ({ emote, trigger: r.trigger + 1 })));

  // Presence — iOS never fires beforeunload when the app is killed, so a
  // player's row can linger in the lobby for hours ("ghost" seats the host
  // waits on). Everyone in the lobby tracks themselves on a presence
  // channel; rows with no live presence show as "away" so the host knows
  // to kick (or not wait for) them. Recently-created rows get a grace
  // period: a joiner's row arrives via realtime before their presence does.
  const [presentIds, setPresentIds] = useState(null);
  useEffect(() => {
    if (!me?.id) return;
    const channel = supabase.channel(`lobby-presence-${roomCode}`, {
      config: { presence: { key: me.id } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        setPresentIds(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channel.track({}).catch(() => {});
      });
    return () => { supabase.removeChannel(channel); };
  }, [roomCode, me?.id]);
  const isAway = (p) => {
    // Practice bots have no device, so they never appear in presence —
    // they're always "here" by definition.
    if (p.user_id?.startsWith('bot_')) return false;
    if (!presentIds || p.user_id === me?.id) return false;
    if (presentIds.has(p.user_id)) return false;
    const age = Date.now() - new Date(p.created_date).getTime();
    return age > 15000;
  };

  const leaveGame = async () => {
    try {
      const myPlayer = players.find(p => p.user_id === me?.id);
      await leaveRoom({ room, players, me, myPlayer, mode: 'delete' });
      navigate('/');
    } catch(e) {
      navigate('/');
    }
  };

  const copyCode = () => {
    // UX-10: only flash the "copied" confirmation once the write actually
    // succeeds (and swallow the rejection so it isn't an unhandled promise),
    // instead of showing a checkmark even when the clipboard write failed.
    Promise.resolve(navigator.clipboard?.writeText(roomCode))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  const shareInvite = async () => {
    const result = await shareRoomInvite(roomCode, t);
    if (result === 'copied') toast({ title: t.linkCopied });
  };

  const selectCategory = (cat) => {
    setSelectedCategory(cat);
    setShowCategorySelector(false);
    // Persist immediately so everyone in the lobby sees the pick live —
    // startGame writes it again, so a failure here is harmless.
    MysteryRoom.update(room.id, { category: cat }).catch(() => {});
  };

  // Tapping Start Game shows a 3-2-1 countdown (cancelable) instead of
  // starting immediately — an accidental tap, or a last-second "wait, one
  // more person is joining," shouldn't force everyone into Word Entry.
  const startGame = () => {
    if (!selectedCategory) { toast({ title: t.pickCategoryFirst, variant: 'destructive' }); return; }
    if (players.length < 2) { toast({ title: t.needTwoPlayers, variant: 'destructive' }); return; }
    setStartCountdown(3);
    setStarting(true);
  };

  const cancelStartCountdown = () => setStarting(false);

  useEffect(() => {
    if (!starting) return;
    if (startCountdown <= 0) {
      setStarting(false);
      doStartGame();
      return;
    }
    const timer = setTimeout(() => setStartCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [starting, startCountdown]);

  const doStartGame = async () => {
    const cat = selectedCategory;
    setLoading(true);
    try {
      // Category is a normal (still client-writable) column; the status
      // transition + the shared word-entry deadline are minted server-side by
      // the validated RPC (migration 0012), so a skewed host clock can't
      // shorten the window for everyone (GAME-N6).
      await MysteryRoom.update(room.id, { category: cat });
      const res = await MysteryRoom.setStatus(roomCode, 'lobby', 'word_entry');
      if (res && res.ok === false) {
        toast({ title: t.errorTitle, description: res.reason === 'need_players' ? t.needTwoPlayers : t.tryAgain, variant: 'destructive' });
      }
    } catch(e) {
      toast({ title: t.errorTitle, description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="h-dvh overflow-hidden text-white flex items-start justify-center p-4 relative"
      style={{ paddingTop: 'max(calc(env(safe-area-inset-top) + 4.25rem), 4.75rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.75rem)' }}
    >
      <GameBackground />
      <EmojiRain emote={rain.emote} trigger={rain.trigger} />

      {/* Back button — identical to Home's header buttons */}
      <div className="absolute left-4 z-20" style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <button onClick={() => setShowLeaveConfirm(true)} className="header-btn" aria-label={t.backLabel}>
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Leave confirmation — same pattern as Playing, so exiting mid-setup
          carries the same accidental-tap protection as exiting mid-round */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <Dialog onClose={() => setShowLeaveConfirm(false)} titleId="lobby-leave-title"
            panelClassName="glass-card bg-slate-900/95 p-5 max-w-sm">
            <p id="lobby-leave-title" className="font-extrabold text-lg mb-1">{t.leaveQuestion}</p>
            <p className="text-slate-400 text-sm mb-4">{t.leaveBody}</p>
            <div className="flex gap-2.5">
              <button onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-semibold">{t.cancel}</button>
              <button onClick={leaveGame}
                className="flex-1 h-11 rounded-xl bg-rose-500 hover:bg-rose-600 border-0 font-bold text-white">{t.leave}</button>
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* How to play button — identical to Home's header buttons */}
      <div className="absolute right-4 z-20" style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <button onClick={() => setShowHowToPlay(true)} className="header-btn" aria-label={t.howToPlayShort}>
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Room code — lives in the header between back and help (same spot the
          playing phase shows it), tap anywhere on the pill to copy */}
      <div className="absolute inset-x-16 z-20 flex justify-center" style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <button onClick={copyCode} aria-label={t.roomCode}
          className={`h-11 px-4 rounded-full bg-gradient-to-b from-white/[0.08] to-black/[0.18] backdrop-blur-md ring-1 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.1)] flex items-center gap-2.5 transition-all duration-150 active:scale-[0.97] select-none ${copied ? 'ring-emerald-400/50' : 'ring-white/15 hover:ring-violet-400/40'}`}>
          {/* All-caps text has no descenders — nudge down 1px so it sits on
              the pill's optical center instead of floating high */}
          <span className="text-[9px] uppercase tracking-[0.16em] text-slate-400 font-extrabold leading-none translate-y-[1px]">{t.roomCode}</span>
          <span className="text-lg font-extrabold tracking-[0.14em] text-white leading-none translate-y-[1px]"
            style={{ textShadow: '0 0 16px rgba(157,92,255,0.5)' }}>
            {roomCode}
          </span>
          <motion.span key={copied ? 'check' : 'copy'} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', duration: 0.35 }}>
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
          </motion.span>
        </button>
      </div>

      {/* How to play modal — accessible Dialog (focus trap, Escape, scroll lock) */}
      {showHowToPlay && (
        <Dialog onClose={() => setShowHowToPlay(false)} placement="bottom" titleId="lobby-howto-title"
          panelClassName="glass-card bg-slate-900/95 p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 id="lobby-howto-title" className="text-lg font-bold text-white">{t.howToPlay}</h2>
              <button onClick={() => setShowHowToPlay(false)} className="w-11 h-11 -m-1 rounded-xl hover:bg-white/10 text-slate-400 flex items-center justify-center" aria-label={t.gotIt}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 text-sm text-slate-300">
              {t.howToPlaySteps.map(({ title, body }, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-violet-500/20 ring-1 ring-violet-400/30 flex items-center justify-center shrink-0 text-violet-300 font-bold text-xs mt-0.5">{idx + 1}</div>
                  <div>
                    <p className="font-semibold text-white">{title}</p>
                    <p className="text-slate-400 mt-0.5">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowHowToPlay(false)}
              className="violet-solid-btn mt-6 w-full h-11 text-sm">
              {t.gotIt}
            </button>
        </Dialog>
      )}

      {/* Category selector — full-screen overlay */}
      <AnimatePresence>
        {showCategorySelector && (
          <CategorySelector
            selectedCategory={selectedCategory}
            onSelect={selectCategory}
            onClose={() => setShowCategorySelector(false)}
          />
        )}
      </AnimatePresence>

      {/* Everything fits on screen — no scrolling. Full-height column:
          info (title, code, players) reads top-down, while the host's two
          actions (category + start) sink to the bottom thumb zone — the
          spacer collapses on short screens so nothing ever clips. */}
      {tab === 'lobby' && (
      <div className="relative z-10 w-full max-w-md flex flex-col min-h-0 self-stretch">
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-2">
          <img src={lobbyTitleImage} alt="The Interactive Guessing Game" className="lobby-logo w-full mx-auto"
            style={{ filter: 'drop-shadow(0 0 18px rgba(168,109,255,0.35)) drop-shadow(0 6px 10px rgba(0,0,0,0.45))' }} />
        </motion.div>

        <div className="flex-1 min-h-0 flex flex-col space-y-2">
          {/* Players — one wide row each so banners, emblems, and titles
              actually show (the lobby is the cosmetics showcase). The frame
              fills the space down to the host actions and scrolls internally,
              same pattern as the in-game question history. */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass-card p-3 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-1.5 mb-1.5 px-1 shrink-0">
              <Users className="w-3.5 h-3.5 text-violet-300" />
              <span className="text-xs font-bold text-slate-300">{t.playersCount(players.length)}</span>
              <span className="ml-auto flex items-center gap-1.5 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${players.length >= 12 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  style={players.length >= 12 ? undefined : { animation: 'livePulse 2s ease-in-out infinite' }} />
                <span className="text-[10px] font-semibold text-slate-400 truncate">{players.length >= 12 ? t.lobbyFull : t.waitingForPlayers}</span>
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar space-y-1.5" style={{ overscrollBehaviorY: 'contain' }}>
              {players.map((p, i) => {
                const pProfile = profiles[p.user_id];
                const pBanner = pProfile ? cosmeticById(pProfile.equipped?.banner) : null;
                const pNameCls = pProfile ? cosmeticById(pProfile.equipped?.nameColor)?.cls : null;
                const pTitle = pProfile ? cosmeticById(pProfile.equipped?.title) : null;
                return (
                  <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    onClick={() => setCardPlayer(p)} role="button" tabIndex={0}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setCardPlayer(p)}
                    className="glass-tile relative overflow-hidden flex items-center gap-2.5 h-14 px-2.5 cursor-pointer transition-transform duration-150 active:scale-[0.97]">
                    {pBanner && (
                      <>
                        <BannerArt banner={pBanner} className="absolute inset-0" motifScale={0.8} />
                        <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-black/45" />
                      </>
                    )}
                    {/* flex: an inline span reserves baseline space below the avatar,
                        pushing it visibly above the row's true center */}
                    <span className="relative shrink-0 flex" style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.5))' }}>
                      <PlayerAvatar profile={pProfile} name={p.display_name} color={p.color} size={40} />
                    </span>
                    <span className="relative flex-1 min-w-0 flex flex-col justify-center">
                      <span className={`font-bold text-sm truncate leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] ${pNameCls || 'text-white'}`}>{p.display_name}</span>
                      {pTitle && (
                        <span className={`self-start inline-flex items-center max-w-full h-4 mt-1 px-1.5 rounded-full text-[9px] font-extrabold ${RARITIES[pTitle.rarity].chip}`}>
                          <span className="truncate leading-none">{pTitle.name}</span>
                        </span>
                      )}
                    </span>
                    {isAway(p) && (
                      <span className="relative shrink-0 px-1.5 py-0.5 rounded-full bg-amber-500/15 ring-1 ring-amber-400/30 text-[9px] font-bold text-amber-300">
                        {t.away}
                      </span>
                    )}
                    {p.user_id === room.host_id && <Crown className="relative w-4 h-4 text-amber-400 shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" fill="currentColor" />}
                    {p.user_id === me?.id && (
                      <span className="relative shrink-0 px-1.5 py-0.5 rounded-full bg-violet-500/20 ring-1 ring-violet-400/40 text-[9px] font-bold text-violet-200">
                        {t.you}
                      </span>
                    )}
                  </motion.div>
                );
              })}
              {players.length === 1 && (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  onClick={shareInvite}
                  className="w-full py-6 flex flex-col items-center gap-1.5 text-center rounded-2xl border border-dashed border-white/10 hover:border-violet-400/40 hover:bg-white/[0.03] transition-colors">
                  <Share className="w-4 h-4 text-violet-300" />
                  <span className="text-xs font-semibold text-slate-400 px-6 leading-relaxed">{t.inviteHint}</span>
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>

        <div className="shrink-0 h-2" />

        <div className="space-y-2">
          {/* Selected Category — host only, entire card is tappable */}
          {isHost && (
            <motion.button type="button" onClick={() => setShowCategorySelector(true)}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="glass-card w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-all duration-150 active:scale-[0.98]">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-slate-300 font-extrabold mb-0.5 whitespace-nowrap">{t.selectedCategory}</p>
                {selectedCategory ? (
                  <>
                    <p className="text-base font-extrabold text-white truncate leading-tight">{meta.emoji} {shortCategory(selectedCategory)}</p>
                    <p className="text-[11px] font-semibold text-amber-300/80 truncate">
                      {meta.isFree ? t.freeCategory : t.includedWith(meta.packName)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-bold text-slate-400 truncate">{t.selectCategory}</p>
                )}
              </div>
              <span
                className="shrink-0 px-2.5 py-1.5 rounded-lg bg-transparent ring-1 ring-violet-400/50 text-[11px] font-bold text-violet-200 select-none whitespace-nowrap">
                {t.changeCategory}
              </span>
            </motion.button>
          )}

          {/* Start Game — exact reuse of the Home Create Game hero CTA.
              Tapping it doesn't start immediately: the same button frame
              transforms in place into a 3-2-1 countdown that's itself the
              cancel control, instead of popping a separate confirm dialog. */}
          {isHost && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={starting ? '' : 'gold-breathe'}>
              {starting ? (
                <button onClick={cancelStartCountdown}
                  className="gold-btn w-full h-16 rounded-[24px] px-3.5 flex items-center gap-2.5">
                  <span className="relative w-10 h-10 rounded-2xl bg-gradient-to-b from-[#190c00] to-[#060300] ring-1 ring-[#ffcf7a]/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.55)] flex items-center justify-center shrink-0 overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.span key={startCountdown} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.18 }}
                        className="text-lg font-extrabold text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
                        {startCountdown}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  <span className="relative text-left flex-1 min-w-0">
                    <span className="block text-sm font-extrabold tracking-tight text-[#2c1500] leading-tight drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">
                      {t.startingIn}
                    </span>
                    <span className="block text-[11px] font-medium text-[#4a2c0c] leading-tight truncate">
                      {t.tapToCancel}
                    </span>
                  </span>
                  <span className="relative w-9 h-9 rounded-full bg-gradient-to-b from-[#190c00] to-[#060300] ring-1 ring-[#ffcf7a]/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.55)] flex items-center justify-center shrink-0">
                    <X className="w-5 h-5 text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
                  </span>
                </button>
              ) : (
                <button onClick={startGame} disabled={loading || !selectedCategory || players.length < 2}
                  className="gold-btn w-full h-16 rounded-[24px] px-3.5 flex items-center gap-2.5">
                  <span className="pointer-events-none absolute inset-y-0 left-[-45%] w-[45%]" style={{ background: 'linear-gradient(105deg, transparent 15%, rgba(255,255,255,0.45) 50%, transparent 85%)', animation: 'shimmerSweep 5s linear infinite', willChange: 'transform, opacity' }} />
                  <span className="relative w-10 h-10 rounded-2xl bg-gradient-to-b from-[#190c00] to-[#060300] ring-1 ring-[#ffcf7a]/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.55)] flex items-center justify-center shrink-0">
                    <ArrowRight className="w-5 h-5 text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
                  </span>
                  <span className="relative text-left flex-1 min-w-0">
                    <span className="block text-sm font-extrabold tracking-tight text-[#2c1500] leading-tight drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">
                      {loading ? t.starting : t.startGame}
                    </span>
                    <span className="block text-[11px] font-medium text-[#4a2c0c] leading-tight truncate">
                      {!selectedCategory ? t.selectCategory
                        : players.length < 2 ? t.needTwoPlayers
                        : `${t.category}: ${shortCategory(selectedCategory)}`}
                    </span>
                  </span>
                  <span className="relative w-9 h-9 rounded-full bg-gradient-to-b from-[#190c00] to-[#060300] ring-1 ring-[#ffcf7a]/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.55)] flex items-center justify-center shrink-0">
                    <ChevronRight className="w-5 h-5 text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
                  </span>
                </button>
              )}
            </motion.div>
          )}

          {!isHost && room.category && (() => {
            const guestMeta = categoryMeta(room.category);
            return (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="glass-card px-4 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-slate-300 font-extrabold mb-0.5 whitespace-nowrap">{t.selectedCategory}</p>
                <p className="text-base font-extrabold text-white truncate leading-tight">{guestMeta.emoji} {shortCategory(room.category)}</p>
                <p className="text-[11px] font-semibold text-amber-300/80 truncate">
                  {guestMeta.isFree ? t.freeCategory : t.includedWith(guestMeta.packName)}
                </p>
              </motion.div>
            );
          })()}

          {!isHost && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              className="text-center text-slate-400 text-sm font-medium pt-1 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              {t.waitingForHost}
            </motion.p>
          )}
        </div>
      </div>
      )}

      {tab === 'profile' && (
        <div className="relative z-10 w-full max-w-md flex-1 min-h-0 overflow-y-auto hide-scrollbar self-stretch pt-1">
          <QuickEquip />
        </div>
      )}

      {tab === 'chat' && (
        <div className="relative z-10 w-full max-w-md flex-1 min-h-0 flex flex-col self-stretch">
          <ChatPanel roomCode={roomCode} me={me} myPlayer={myPlayer} onEmoteRain={() => {}} />
        </div>
      )}

      {cardPlayer && (
        <PlayerCardModal player={cardPlayer} profile={profiles[cardPlayer.user_id]} meId={me?.id} roomCode={roomCode} onClose={() => setCardPlayer(null)}
          onKick={isHost && cardPlayer.user_id !== me?.id ? async () => {
            // UX-4: surface a failed kick instead of swallowing it — a silent
            // failure looks identical to success and the ghost player stays.
            try { await MysteryPlayer.delete(cardPlayer.id); }
            catch (e) { toast({ title: t.errorTitle, description: t.tryAgain, variant: 'destructive' }); }
            setCardPlayer(null);
          } : undefined} />
      )}

      <RoomTabBar
        active={tab}
        onChange={setTab}
        items={[
          { id: 'lobby', label: t.tabLobby, icon: Users },
          { id: 'profile', label: t.tabProfile, icon: Palette },
          { id: 'chat', label: t.tabChat, icon: MessageCircle, badge: unreadChat },
        ]}
      />
    </div>
  );
}
