import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, ChevronRight, Lock, Sparkles } from 'lucide-react';
import { CATEGORIES, CATEGORY_EMOJIS, PACKS } from '@/lib/wordLists';
import { isPackUnlocked, unlockPack } from '@/lib/premiumPacks';
import { useLang } from '@/lib/LanguageContext';

function SelectionCard({ emoji, label, selected, onClick }) {
  return (
    <button onClick={onClick}
      className={`relative h-14 px-3 rounded-2xl flex items-center gap-2.5 text-left transition-all duration-150 active:scale-[0.98] ${
        selected
          ? 'bg-gradient-to-b from-[#3a2400] to-[#1a0f00] ring-1 ring-[#ffcf7a]/70 shadow-[0_2px_3px_rgba(0,0,0,0.4),0_4px_10px_-8px_rgba(0,0,0,0.45),0_0_10px_-6px_rgba(255,180,60,0.4),inset_0_1px_1px_rgba(255,220,150,0.25)]'
          : 'bg-gradient-to-b from-white/[0.07] to-black/[0.15] ring-1 ring-white/10 shadow-[0_2px_3px_rgba(0,0,0,0.4),0_4px_10px_-8px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.1)] hover:ring-white/20 hover:-translate-y-0.5'
      }`}>
      <span className="text-xl shrink-0">{emoji}</span>
      <span className={`text-sm font-bold truncate ${selected ? 'text-amber-200' : 'text-slate-200'}`}>{label}</span>
      <AnimatePresence>
        {selected && (
          <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-b from-[#ffcb45] to-[#e08e05] ring-2 ring-[#1a0f00] flex items-center justify-center shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
            <Check className="w-2.5 h-2.5 text-[#2c1500]" strokeWidth={3.5} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export default function CategorySelector({ selectedCategory, onSelect, onClose }) {
  const { t } = useLang();
  const [view, setView] = useState('categories'); // 'categories' | 'packPreview' | 'packCategories'
  const [activePack, setActivePack] = useState(null);
  const [, forceRerender] = useState(0);

  const openPack = (pack) => {
    setActivePack(pack);
    setView(isPackUnlocked(pack.id) ? 'packCategories' : 'packPreview');
  };

  const handleBack = () => {
    if (view === 'categories') { onClose(); return; }
    setView('categories');
    setActivePack(null);
  };

  const handlePurchase = () => {
    unlockPack(activePack.id);
    forceRerender(n => n + 1);
    setView('packCategories');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 h-dvh overflow-hidden text-white"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)', paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
    >
      {/* Background — identical to Home / Lobby */}
      <div className="fixed inset-0 -z-10 bg-[#07040f]" />
      <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 120% 38% at 50% -8%, rgba(255,255,255,0.05), transparent 60%)' }} />
      <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 90% 55% at 50% 15%, rgba(140,90,220,0.22), transparent 70%)' }} />
      <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 100% 60% at 50% 100%, rgba(70,32,140,0.18), transparent 62%)' }} />
      <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 55% 26% at 50% 96%, rgba(140,70,20,0.07), transparent 65%)' }} />
      <div className="fixed inset-0 -z-10 opacity-70" style={{
        backgroundImage: 'radial-gradient(1.5px 1.5px at 12% 12%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 28% 6%, rgba(255,255,255,0.5), transparent), radial-gradient(1.5px 1.5px at 65% 5%, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 80% 14%, rgba(255,255,255,0.5), transparent), radial-gradient(1.5px 1.5px at 92% 8%, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 6% 30%, rgba(255,255,255,0.4), transparent), radial-gradient(1.5px 1.5px at 95% 28%, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 4% 55%, rgba(255,255,255,0.4), transparent), radial-gradient(1.5px 1.5px at 93% 50%, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 15% 68%, rgba(255,255,255,0.35), transparent), radial-gradient(1.5px 1.5px at 88% 70%, rgba(255,255,255,0.45), transparent), radial-gradient(1px 1px at 40% 78%, rgba(255,255,255,0.3), transparent), radial-gradient(1.5px 1.5px at 70% 88%, rgba(255,255,255,0.4), transparent), radial-gradient(1px 1px at 25% 92%, rgba(255,255,255,0.3), transparent), radial-gradient(1.5px 1.5px at 55% 95%, rgba(255,255,255,0.35), transparent)',
        backgroundSize: '100% 100%',
        animation: 'twinkle 6s ease-in-out infinite alternate, driftSlow 50s ease-in-out infinite alternate',
        willChange: 'transform, opacity',
      }} />
      <div className="fixed inset-0 -z-10" style={{ boxShadow: 'inset 0 0 min(42vw,290px) rgba(0,0,0,0.92)' }} />

      {/* Back button — identical to Home's header buttons */}
      <div className="absolute left-4 z-20" style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <button onClick={handleBack}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-gradient-to-b from-white/[0.07] to-black/20 backdrop-blur-sm ring-1 ring-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-white/10 hover:ring-violet-400/40 transition-all duration-150 active:scale-[0.98] select-none-interactive text-slate-200">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="relative z-10 h-full overflow-y-auto hide-scrollbar">
        <div className="w-full max-w-md mx-auto px-4 pt-16 pb-6">

          {view === 'categories' && (
            <motion.div key="categories" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
              <div className="text-center mb-4">
                <h1 className="text-xl font-extrabold tracking-tight text-white">{t.chooseCategory}</h1>
                <p className="text-xs font-semibold text-white/[0.7] tracking-wide mt-0.5">{t.chooseCategorySub}</p>
              </div>

              <p className="text-xs font-bold text-slate-400 mb-2 px-1 uppercase tracking-wide">{t.selectCategory}</p>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {CATEGORIES.map(cat => (
                  <SelectionCard key={cat} emoji={CATEGORY_EMOJIS[cat] || '🎯'} label={cat}
                    selected={selectedCategory === cat} onClick={() => onSelect(cat)} />
                ))}
              </div>

              <p className="text-xs font-bold text-slate-400 mb-2 px-1 uppercase tracking-wide">{t.moreCategories}</p>
              <div className="space-y-2">
                {PACKS.map(pack => {
                  const owned = isPackUnlocked(pack.id);
                  const preview = pack.categories.slice(0, 3).join(', ');
                  const moreN = pack.categories.length - 3;
                  return (
                    <button key={pack.id} onClick={() => openPack(pack)}
                      className="relative w-full rounded-[20px] bg-gradient-to-b from-white/[0.07] to-black/[0.16] ring-1 ring-white/10 shadow-[0_2px_3px_rgba(0,0,0,0.4),0_5px_12px_-8px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.12)] p-3 flex items-center gap-2.5 text-left transition-all duration-150 active:scale-[0.98] hover:-translate-y-0.5 hover:ring-white/20">
                      <span className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#2a1150] to-[#0d0620] ring-1 ring-violet-400/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_2px_6px_rgba(0,0,0,0.4)] flex items-center justify-center shrink-0 text-xl">
                        {pack.emoji}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white truncate">{pack.name}</p>
                          <span className={`shrink-0 text-[9px] font-extrabold tracking-wider px-1.5 py-0.5 rounded-full ${
                            owned ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30' : 'bg-gradient-to-b from-[#ffcb45] to-[#e08e05] text-[#2c1500]'
                          }`}>
                            {owned ? t.ownedBadge : t.premiumBadge}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
                          {t.unlocksLabel}: {preview}{moreN > 0 ? ` ${t.moreCount(moreN)}` : ''}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {view === 'packPreview' && activePack && (
            <motion.div key="preview" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}
              className="text-center">
              <div className="w-20 h-20 mx-auto rounded-[24px] bg-gradient-to-b from-[#2a1150] to-[#0d0620] ring-1 ring-violet-400/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_5px_12px_-8px_rgba(0,0,0,0.45)] flex items-center justify-center text-5xl mb-3">
                {activePack.emoji}
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-white mb-1">{activePack.name}</h1>
              <p className="text-xs font-semibold text-white/[0.7] mb-4">
                {t.unlocksLabel} {activePack.categories.length} {t.moreCategories.toLowerCase()}
              </p>

              <div className="rounded-[20px] bg-gradient-to-b from-white/[0.07] to-black/[0.16] ring-1 ring-white/10 shadow-[0_2px_3px_rgba(0,0,0,0.4),0_5px_12px_-8px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.12)] p-3 mb-4">
                <div className="grid grid-cols-2 gap-1.5">
                  {activePack.categories.map(cat => (
                    <div key={cat} className="py-1.5 px-3 rounded-lg bg-black/20 ring-1 ring-white/5 text-xs font-semibold text-slate-300 text-left truncate">
                      {cat}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-violet-300 mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                {t.unlockForever}
              </div>

              <button onClick={handlePurchase}
                className="relative w-full h-14 mb-2.5 rounded-[20px] bg-[linear-gradient(180deg,#fdeeb8_0%,#ffcb45_16%,#e08e05_40%,#a85800_66%,#5e2c00_100%)] shadow-[0_2px_3px_rgba(0,0,0,0.4),0_8px_14px_-8px_rgba(0,0,0,0.5),0_0_6px_-6px_rgba(255,180,60,0.18),0_0_0_1px_rgba(255,214,120,0.45),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-6px_10px_-6px_rgba(110,45,0,0.4)] flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] hover:-translate-y-0.5 hover:brightness-[1.04] overflow-hidden">
                <span className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 55% 60% at 50% -8%, rgba(255,255,255,0.55), transparent 70%)' }} />
                <Lock className="relative w-4 h-4 text-[#2c1500]" />
                <span className="relative text-sm font-extrabold tracking-tight text-[#2c1500] drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">{t.unlockFor}</span>
              </button>
              <button onClick={handleBack}
                className="w-full h-11 rounded-2xl bg-gradient-to-b from-white/[0.06] to-black/10 ring-1 ring-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] text-sm font-bold text-slate-300 transition-all duration-150 active:scale-[0.98] hover:bg-white/10">
                {t.cancel}
              </button>
            </motion.div>
          )}

          {view === 'packCategories' && activePack && (
            <motion.div key="packcats" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
              <div className="text-center mb-4">
                <h1 className="text-xl font-extrabold tracking-tight text-white">{activePack.emoji} {activePack.name}</h1>
                <p className="text-xs font-semibold text-white/[0.7] tracking-wide mt-0.5">{t.chooseCategorySub}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {activePack.categories.map(cat => (
                  <SelectionCard key={cat} emoji="⭐" label={cat}
                    selected={selectedCategory === cat} onClick={() => onSelect(cat)} />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
