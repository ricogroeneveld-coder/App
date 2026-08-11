import React, { useEffect, useState } from 'react';
import { getProfile, loadProfile, subscribeProfile, equipCosmetic } from '@/lib/playerProfile';
import { ALL_COSMETICS, RARITIES, TYPE_LABELS } from '@/lib/cosmetics';
import { EmblemTile, AvatarFrame } from '@/components/progression/PlayerAvatar';
import BannerArt from '@/components/progression/BannerArt';
import { vibrate } from '@/lib/haptics';
import { useLang } from '@/lib/LanguageContext';

const TYPE_ORDER = ['emblem', 'banner', 'border', 'title', 'nameColor'];

/**
 * Swap between cosmetics you already own, live, without leaving the room —
 * the Lobby/Word Entry/Finished "Profile" tab. Quick-equip only: no shop,
 * no Picks, no purchase flow (that's the full Profile screen's job) — just
 * what's already unlocked, one tap to wear it.
 */
export default function QuickEquip() {
  const { t } = useLang();
  const [profile, setProfile] = useState(getProfile());

  useEffect(() => {
    let live = true;
    loadProfile().then(p => { if (live) setProfile(p); });
    const unsub = subscribeProfile(setProfile);
    return () => { live = false; unsub(); };
  }, []);

  const owned = ALL_COSMETICS.filter(c => profile.owned?.includes(c.id));
  // UX-11: never render a blank panel — if there's nothing equippable in any
  // bucket, show a message instead of an empty container.
  const hasAny = TYPE_ORDER.some(type => owned.some(c => c.type === type));
  if (!hasAny) {
    return (
      <div className="w-full max-w-lg mx-auto text-center text-slate-400 text-sm py-10">
        {t.collectionEmpty}
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-3">
      {TYPE_ORDER.map(type => {
        const items = owned.filter(c => c.type === type);
        if (!items.length) return null;
        const equippedId = profile.equipped?.[type];
        return (
          <div key={type}>
            <p className="section-label mb-1.5 px-1">{TYPE_LABELS[type]}</p>
            {/* overflow-x-auto implicitly makes overflow-y 'auto' too (per the
                CSS overflow spec, and WebKit enforces this) — without top
                padding here, that clips the ring/glow on every card's top
                edge instead of just scrolling horizontally. */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pt-1.5 pb-1 px-1" style={{ overscrollBehaviorX: 'contain' }}>
              {items.map(c => {
                const equipped = c.id === equippedId;
                const rar = RARITIES[c.rarity];
                return (
                  <button key={c.id} onClick={() => { equipCosmetic(c.id); vibrate(20); }}
                    className={`shrink-0 w-20 glass-panel rounded-2xl p-2 flex flex-col items-center text-center transition-all duration-150 active:scale-[0.96] ring-[1.5px] ${equipped ? 'ring-[#ffcf7a]/80' : rar.ring}`}>
                    <span className="relative h-10 w-full flex items-center justify-center">
                      {type === 'emblem' && (
                        <span className="relative w-10 h-10 rounded-full overflow-hidden flex shadow-[0_2px_6px_-1px_rgba(0,0,0,0.5)]">
                          <EmblemTile emblem={c} fontSize={20} />
                        </span>
                      )}
                      {type === 'banner' && <BannerArt banner={c} className="relative w-full h-10 rounded-lg" />}
                      {type === 'border' && (
                        <AvatarFrame frame={c.frame} size={40}>
                          <span className="w-full h-full rounded-full" style={{ background: 'radial-gradient(120% 120% at 32% 18%, #2b3245 0%, #171c2b 55%, #0d1019 100%)' }} />
                        </AvatarFrame>
                      )}
                      {type === 'title' && (
                        <span className={`relative w-full text-[10px] font-extrabold leading-tight ${rar.text}`}
                          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {c.name}
                        </span>
                      )}
                      {type === 'nameColor' && (
                        <span className={`relative w-full text-xs font-extrabold truncate ${c.cls}`}>{profile.display_name || 'Name'}</span>
                      )}
                    </span>
                    <span className="h-3.5 w-full mt-1 text-[9px] font-bold text-white leading-[14px] truncate">
                      {type === 'title' ? '' : c.name}
                    </span>
                    <span className="h-3.5 mt-0.5 text-[8px] font-extrabold text-amber-300">
                      {equipped ? t.equippedNow : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
