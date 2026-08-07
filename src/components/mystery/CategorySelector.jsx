import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, ChevronRight, Lock, Sparkles } from 'lucide-react';
import { CATEGORIES, CATEGORY_EMOJIS, PACKS, shortCategory } from '@/lib/wordLists';
import { isPackUnlocked } from '@/lib/premiumPacks';
import { purchasePack, purchasesAvailable } from '@/lib/payments';
import { useToast } from '@/components/ui/use-toast';
import { useLang } from '@/lib/LanguageContext';
import GameBackground from '@/components/GameBackground';

function SelectionCard({ emoji, label, selected, onClick }) {
  return (
    <button onClick={onClick}
      className={`relative h-12 px-3 rounded-2xl flex items-center gap-2 text-left transition-all duration-150 active:scale-[0.98] ${
        selected
          ? 'bg-gradient-to-b from-[#3a2400] to-[#1a0f00] ring-1 ring-[#ffcf7a]/70 shadow-[0_2px_3px_rgba(0,0,0,0.4),0_4px_10px_-8px_rgba(0,0,0,0.45),0_0_10px_-6px_rgba(255,180,60,0.4),inset_0_1px_1px_rgba(255,220,150,0.25)]'
          : 'bg-gradient-to-b from-white/[0.07] to-black/[0.15] ring-1 ring-white/10 shadow-[0_2px_3px_rgba(0,0,0,0.4),0_4px_10px_-8px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.1)] hover:ring-white/20 hover:-translate-y-0.5'
      }`}>
      <span className="text-lg shrink-0">{emoji}</span>
      <span className={`text-[13px] font-bold truncate ${selected ? 'text-amber-200' : 'text-slate-200'}`}>{shortCategory(label)}</span>
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
  const { toast } = useToast();
  const [view, setView] = useState('categories'); // 'categories' | 'packPreview' | 'packCategories'
  const [activePack, setActivePack] = useState(null);
  const [buying, setBuying] = useState(false);
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

  // Real-money packs go through Apple In-App Purchase (App Store rule
  // 3.1.1). On builds without a store (plain web), the button explains that
  // packs unlock in the iOS app instead of faking a charge.
  const handlePurchase = async () => {
    if (buying) return;
    setBuying(true);
    try {
      const res = await purchasePack(activePack.id);
      if (res.ok) {
        forceRerender(n => n + 1);
        setView('packCategories');
      } else if (res.reason === 'unavailable') {
        toast({ title: t.purchaseUnavailable });
      } else if (res.reason !== 'cancelled') {
        toast({ title: t.purchaseFailed, variant: 'destructive' });
      }
    } finally {
      setBuying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 h-dvh overflow-hidden text-white"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)', paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
    >
      <GameBackground />

      {/* Back button — identical to Home's header buttons */}
      <div className="absolute left-4 z-20" style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}>
        <button onClick={handleBack} className="header-btn" aria-label="Back">
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

              <p className="section-label mb-2 px-1">{t.selectCategory}</p>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {CATEGORIES.map(cat => (
                  <SelectionCard key={cat} emoji={CATEGORY_EMOJIS[cat] || '🎯'} label={cat}
                    selected={selectedCategory === cat} onClick={() => onSelect(cat)} />
                ))}
              </div>

              <p className="section-label mb-2 px-1">{t.moreCategories}</p>
              <div className="space-y-2">
                {PACKS.map(pack => {
                  const owned = isPackUnlocked(pack.id);
                  const preview = pack.categories.slice(0, 3).join(', ');
                  const moreN = pack.categories.length - 3;
                  return (
                    <button key={pack.id} onClick={() => openPack(pack)}
                      className="glass-panel w-full p-2.5 flex items-center gap-2.5 text-left transition-all duration-150 active:scale-[0.98] hover:-translate-y-0.5 hover:ring-white/20">
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-b from-[#2a1150] to-[#0d0620] ring-1 ring-violet-400/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_2px_6px_rgba(0,0,0,0.4)] flex items-center justify-center shrink-0 text-lg">
                        {pack.emoji}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-bold text-white truncate">{pack.name}</p>
                          <span className={`shrink-0 text-[9px] font-extrabold tracking-wider px-1.5 py-0.5 rounded-full ${
                            owned ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30' : 'bg-gradient-to-b from-[#ffcb45] to-[#e08e05] text-[#2c1500]'
                          }`}>
                            {owned ? t.ownedBadge : t.premiumBadge}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-400 truncate">
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

              <div className="glass-panel p-3 mb-4">
                <div className="grid grid-cols-2 gap-1.5">
                  {activePack.categories.map(cat => (
                    <div key={cat} className="py-1.5 px-3 rounded-lg bg-black/20 ring-1 ring-white/5 text-xs font-semibold text-slate-300 text-left truncate">
                      {shortCategory(cat)}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-violet-300 mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                {t.unlockForever}
              </div>

              <button onClick={handlePurchase} disabled={buying}
                className="gold-btn w-full h-14 mb-2.5 rounded-[20px] flex items-center justify-center gap-2">
                <Lock className="relative w-4 h-4 text-[#2c1500]" />
                <span className="relative text-sm font-extrabold tracking-tight text-[#2c1500] drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">
                  {buying ? t.purchasing : t.unlockFor}
                </span>
              </button>
              {!purchasesAvailable() && (
                <p className="text-center text-[11px] font-semibold text-slate-400 mb-2.5">{t.purchaseUnavailable}</p>
              )}
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
