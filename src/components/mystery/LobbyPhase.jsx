import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MysteryPlayer, MysteryRoom } from '@/api/db';
import { useToast } from '@/components/ui/use-toast';
import { Copy, Check, Users, Crown, ArrowRight, ChevronRight, Sparkles, ArrowLeft, HelpCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, CATEGORY_EMOJIS, PACKS, shortCategory } from '@/lib/wordLists';
import { useLang } from '@/lib/LanguageContext';
import GameBackground from '@/components/GameBackground';
import lobbyTitleImage from '../../../lobby-title.webp';
import CategorySelector from './CategorySelector';

function categoryMeta(cat) {
  if (!cat) return null;
  if (CATEGORIES.includes(cat)) {
    return { emoji: CATEGORY_EMOJIS[cat] || '🎯', isFree: true };
  }
  const pack = PACKS.find(p => p.categories.includes(cat));
  return { emoji: pack?.emoji || '⭐', isFree: false, packName: pack?.name };
}

export default function LobbyPhase({ room, players, me, roomCode }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const isHost = room.host_id === me?.id;
  const meta = categoryMeta(selectedCategory);

  const leaveGame = async () => {
    try {
      const myPlayer = players.find(p => p.user_id === me?.id);
      if (myPlayer) await MysteryPlayer.delete(myPlayer.id);
      if (isHost) {
        const remaining = players.filter(p => p.user_id !== me?.id);
        if (remaining.length === 0) {
          await MysteryRoom.delete(room.id);
        } else {
          await MysteryRoom.update(room.id, {
            host_id: remaining[0].user_id,
            host_name: remaining[0].display_name
          });
        }
      }
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
  };

  const startGame = async () => {
    const cat = selectedCategory;
    if (!cat) { toast({ title: 'Pick a category first', variant: 'destructive' }); return; }
    if (players.length < 2) { toast({ title: 'Need at least 2 players', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      await MysteryRoom.update(room.id, { status: 'word_entry', category: cat });
    } catch(e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="h-dvh overflow-hidden text-white flex items-start justify-center p-4 relative"
      style={{ paddingTop: 'max(calc(env(safe-area-inset-top) + 4.25rem), 4.75rem)', paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
    >
      <GameBackground />

      {/* Back button — identical to Home's header buttons */}
      <div className="absolute left-4 z-20" style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <button onClick={() => navigate('/')} className="header-btn">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* How to play button — identical to Home's header buttons */}
      <div className="absolute right-4 z-20" style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <button onClick={() => setShowHowToPlay(true)} className="header-btn">
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* How to play modal — identical to Home's modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card w-full max-w-md bg-slate-900/95 p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">{t.howToPlay}</h2>
              <button onClick={() => setShowHowToPlay(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400">
                <X className="w-4 h-4" />
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

      {/* Everything fits on screen — no scrolling */}
      <div className="relative z-10 w-full max-w-md">
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-3">
          <img src={lobbyTitleImage} alt="The Interactive Guessing Game" className="w-full max-w-[220px] mx-auto"
            style={{ filter: 'drop-shadow(0 0 18px rgba(168,109,255,0.35)) drop-shadow(0 6px 10px rgba(0,0,0,0.45))' }} />
          <p className="text-xs font-semibold text-white/[0.7] tracking-wide mt-0.5">{t.waitingForPlayers}</p>
        </motion.div>

        <div className="space-y-2">
          {/* Room code — hero card, same material as the Home profile card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="glass-card px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300 font-extrabold mb-0.5">{t.roomCode}</p>
              <p className="text-[26px] font-extrabold tracking-[0.14em] text-white leading-none"
                style={{ textShadow: '0 0 20px rgba(157,92,255,0.5)' }}>
                {roomCode}
              </p>
            </div>
            <button onClick={copyCode}
              className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-b from-white/[0.07] to-black/20 backdrop-blur-sm ring-1 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-150 active:scale-[0.98] select-none ${copied ? 'ring-emerald-400/50' : 'ring-white/10 hover:bg-white/10 hover:ring-violet-400/40'}`}>
              <motion.span key={copied ? 'check' : 'copy'} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', duration: 0.35 }}>
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-200" />}
              </motion.span>
            </button>
          </motion.div>

          {/* Players — compact 2-column grid with internal scroll */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass-card p-3">
            <div className="flex items-center gap-1.5 mb-1.5 px-1">
              <Users className="w-3.5 h-3.5 text-violet-300" />
              <span className="text-xs font-bold text-slate-300">{players.length} / 12 players</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-[156px] overflow-y-auto hide-scrollbar" style={{ overscrollBehaviorY: 'none' }}>
              {players.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="glass-tile flex items-center gap-2 h-9 px-2">
                  <div className="relative w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-[0_2px_6px_-1px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25)] overflow-hidden"
                    style={{ backgroundColor: p.color }}>
                    <span className="pointer-events-none absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-white/35 blur-[3px]" />
                    <span className="relative">{p.display_name[0].toUpperCase()}</span>
                  </div>
                  <span className="flex-1 min-w-0 font-semibold text-xs text-white truncate">{p.display_name}</span>
                  {p.user_id === room.host_id && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="currentColor" />}
                  {p.user_id === me?.id && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-violet-500/20 ring-1 ring-violet-400/40 text-[9px] font-bold text-violet-200">
                      {t.you}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>

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
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <button onClick={startGame} disabled={loading || !selectedCategory || players.length < 2}
                className="gold-btn w-full h-16 rounded-[24px] px-3.5 flex items-center gap-2.5">
                <span className="pointer-events-none absolute inset-y-0 w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)', animation: 'shimmerSweep 13s ease-in-out infinite' }} />
                <span className="relative w-10 h-10 rounded-2xl bg-gradient-to-b from-[#190c00] to-[#060300] ring-1 ring-[#ffcf7a]/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.55)] flex items-center justify-center shrink-0">
                  <ArrowRight className="w-5 h-5 text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
                </span>
                <span className="relative text-left flex-1 min-w-0">
                  <span className="block text-sm font-extrabold tracking-tight text-[#2c1500] leading-tight drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">
                    {loading ? t.starting : t.startGame}
                  </span>
                  <span className="block text-[11px] font-medium text-[#4a2c0c] leading-tight truncate">
                    {selectedCategory ? `${t.category}: ${shortCategory(selectedCategory)}` : t.selectCategory}
                  </span>
                </span>
                <span className="relative w-9 h-9 rounded-full bg-gradient-to-b from-[#190c00] to-[#060300] ring-1 ring-[#ffcf7a]/35 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-2px_4px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.55)] flex items-center justify-center shrink-0">
                  <ChevronRight className="w-5 h-5 text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" />
                </span>
              </button>
            </motion.div>
          )}

          {!isHost && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              className="text-center text-slate-400 text-sm font-medium pt-1 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              {t.waitingForHost}
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}
