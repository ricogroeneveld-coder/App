import React, { useEffect } from 'react';

/**
 * The bottom tab bar shared by Lobby, Word Entry, and Finished — same
 * visual pattern PlayingPhase already uses for its Questions/Notebook/
 * Players/Chat bar, so the whole room lifecycle reads as one consistent
 * hub instead of chat (and now Profile) being bolted on differently in
 * every phase.
 */
export default function RoomTabBar({ items, active, onChange }) {
  // Toasts are fixed to the bottom of the viewport at a higher z-index than
  // this bar — without this, a toast (daily reward, an error, "reconnecting")
  // renders on top of it. See --toast-bottom-offset in index.css.
  useEffect(() => {
    document.body.classList.add('has-bottom-tab-bar');
    return () => document.body.classList.remove('has-bottom-tab-bar');
  }, []);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 flex bg-[#0a0616]/95 backdrop-blur-md border-t border-white/10 shadow-[0_-4px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
    >
      {items.map(({ id, label, icon: Icon, badge }) => (
        <button key={id} onClick={() => onChange(id)}
          className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold transition ${active === id ? 'text-violet-300' : 'text-slate-400'}`}>
          {active === id && (
            <span className="pointer-events-none absolute top-0 inset-x-6 h-0.5 rounded-full bg-gradient-to-r from-transparent via-violet-400 to-transparent" />
          )}
          <Icon className={`w-5 h-5 transition-transform ${active === id ? 'text-violet-400 scale-110 drop-shadow-[0_0_6px_rgba(157,92,255,0.6)]' : ''}`} />
          {label}
          {!!badge && (
            <span className="absolute top-1 left-[calc(50%+6px)] min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-b from-rose-400 to-rose-600 text-[9px] font-extrabold text-white flex items-center justify-center leading-none shadow-[0_1px_3px_rgba(0,0,0,0.5)] ring-2 ring-[#0a0616]">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
