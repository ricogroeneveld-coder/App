import React from 'react';

/**
 * Banner scene renderer — layered gradients/patterns from the catalog css,
 * floating emoji motifs for depth, a top light edge, soft vignette, and a
 * slow shine sweep on legendary/mythic scenes. Fills its parent; place it
 * as the first (absolute) child behind banner content.
 */
export default function BannerArt({ banner, className = '', style = {}, motifScale = 1 }) {
  const b = banner || {};
  return (
    <span aria-hidden className={`block overflow-hidden pointer-events-none ${className}`}
      style={{ background: b.css || 'linear-gradient(120deg, #1c0b3a 0%, #0d0620 100%)', ...style }}>
      {(b.motifs || []).map((m, i) => (
        <span key={i} className="absolute select-none"
          style={{
            left: m.x, top: m.y, fontSize: m.s * motifScale, lineHeight: 1,
            opacity: m.o ?? 0.6, transform: `rotate(${m.r || 0}deg)`,
            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))',
          }}>
          {m.e}
        </span>
      ))}
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <span className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 30%, rgba(0,0,0,0.28) 100%)' }} />
      {b.shine && <span className="fx-shine" />}
    </span>
  );
}
