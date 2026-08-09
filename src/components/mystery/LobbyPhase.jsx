import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MysteryPlayer, MysteryRoom } from '@/api/db';
import { leaveRoom } from '@/lib/roomLifecycle';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Check, Users, Crown, ArrowRight, ChevronRight, Sparkles, ArrowLeft, HelpCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { shortCategory, categoryMeta } from '@/lib/wordLists';
import { useLang } from '@/lib/LanguageContext';
import GameBackground from '@/components/GameBackground';
import lobbyTitleImage from '../../../lobby-title.webp';
import CategorySelector from './CategorySelector';
import PlayerAvatar from '@/components/progression/PlayerAvatar';
import PlayerCardModal from '@/components/progression/PlayerCardModal';
import BannerArt from '@/components/progression/BannerArt';
import usePeerProfiles from '@/components/progression/usePeerProfiles';
import { cosmeticById, RARITIES } from '@/lib/cosmetics';

export default function LobbyPhase({ room, players, me, roomCode }) {
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
  const profiles = usePeerProfiles(players);
  const isHost = room.host_id === me?.id;
  const meta = categoryMeta(selectedCategory);

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
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectCategory = (cat) => {
    setSelectedCategory(cat);
    setShowCategorySelector(false);
    // Persist immediately so everyone in the lobby sees the pick live —
    // startGame writes it again, so a failure here is harmless.
    MysteryRoom.update(room.id, { category: cat }).catch(() => {});
  };

  const startGame = async () => {
    const cat = selectedCategory;
    if (!cat) { toast({ title: t.pickCategoryFirst, variant: 'destructive' }); return; }
    if (players.length < 2) { toast({ title: t.needTwoPlayers, variant: 'destructive' }); return; }
    setLoading(true);
    try {
      await MysteryRoom.update(room.id, { status: 'word_entry', category: cat });
    } catch(e) {
      toast({ title: t.errorTitle, description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="h-dvh overflow-hidden text-white flex items-start justify-center p-4 relative"
      style={{ paddingTop: 'max(calc(env(safe-area-inset-top) + 4.25rem), 4.75rem)', paddingBottom: 'max(calc(env(safe-area-inset-bottom) + 0.75rem), 1.75rem)' }}
    >
      <GameBackground />

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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass-card bg-slate-900/95 p-5 max-w-sm w-full">
              <p className="font-extrabold text-lg mb-1">{t.leaveQuestion}</p>
              <p className="text-slate-400 text-sm mb-4">{t.leaveBody}</p>
              <div className="flex gap-2.5">
                <button onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-semibold">{t.cancel}</button>
                <button onClick={leaveGame}
                  className="flex-1 h-11 rounded-xl bg-rose-500 hover:bg-rose-600 border-0 font-bold text-white">{t.leave}</button>
              </div>
            </motion.div>
          </motion.div>
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

      {/* How to play modal — identical to Home's modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card w-full max-w-md bg-slate-900/95 p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">{t.howToPlay}</h2>
              <button onClick={() => setShowHowToPlay(false)} className="p-2.5 -m-1 rounded-xl hover:bg-white/10 text-slate-400" aria-label={t.gotIt}>
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
          </motion.div>
        </div>
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
                    <span className="relative shrink-0" style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.5))' }}>
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
                  onClick={copyCode}
                  className="w-full py-6 flex flex-col items-center gap-1.5 text-center rounded-2xl border border-dashed border-white/10 hover:border-violet-400/40 hover:bg-white/[0.03] transition-colors">
                  <Copy className="w-4 h-4 text-violet-300" />
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

          {/* Start Game — exact reuse of the Home Create Game hero CTA */}
          {isHost && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="gold-breathe">
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

      {cardPlayer && (
        <PlayerCardModal player={cardPlayer} profile={profiles[cardPlayer.user_id]} meId={me?.id} roomCode={roomCode} onClose={() => setCardPlayer(null)}
          onKick={isHost && cardPlayer.user_id !== me?.id ? async () => {
            try { await MysteryPlayer.delete(cardPlayer.id); } catch (e) { console.error(e); }
            setCardPlayer(null);
          } : undefined} />
      )}
    </div>
  );
}
