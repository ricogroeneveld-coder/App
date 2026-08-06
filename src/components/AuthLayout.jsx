import React from "react";
import GameBackground from "@/components/GameBackground";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    // `dark` re-scopes the shadcn theme tokens so the form controls inside
    // (Input, Button, Label) render dark regardless of the device scheme —
    // the game is dark-only.
    <div className="dark h-dvh overflow-y-auto hide-scrollbar flex items-center justify-center text-white px-4 py-8 pt-[max(env(safe-area-inset-top),2rem)] pb-[max(env(safe-area-inset-bottom),2rem)] relative">
      <GameBackground />
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[18px] bg-gradient-to-b from-[#2a1150] to-[#0d0620] ring-1 ring-violet-400/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_5px_12px_-8px_rgba(0,0,0,0.45)] mb-3">
            <Icon className="w-7 h-7 text-violet-300" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="text-sm font-medium text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className="glass-card p-6">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm font-medium text-slate-400 mt-5">{footer}</p>
        )}
      </div>
    </div>
  );
}
