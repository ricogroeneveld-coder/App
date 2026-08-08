import React from 'react';
import { cosmeticById } from '@/lib/cosmetics';

/**
 * Rarity frame around an avatar (or any circular content). Renders the
 * border cosmetic's ring (solid, gradient, or conic "crystal" facets), an
 * optional breathing glow, slow rotation on animated frames, and tiny
 * twinkling stars on legendary/mythic. Content fills the inside.
 */
export function AvatarFrame({ frame, size, className = '', children }) {
  const w = Math.max(1.5, size * 0.055);
  return (
    <span className={`relative inline-flex rounded-full shrink-0 select-none ${className}`} style={{ width: size, height: size }}>
      {frame.glow && (
        <span aria-hidden className={`absolute -inset-px rounded-full pointer-events-none ${frame.pulse ? 'frame-breathe' : ''}`}
          style={{ boxShadow: frame.glow }} />
      )}
      <span aria-hidden className={`absolute inset-0 rounded-full ${frame.spin ? 'frame-spin' : ''}`}
        style={{ background: frame.ring }} />
      {/* Ring relief — top light, bottom shade, so the metal feels turned */}
      <span aria-hidden className="absolute inset-0 rounded-full pointer-events-none"
        style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), inset 0 -1px 2px rgba(0,0,0,0.45)' }} />
      <span className="absolute rounded-full overflow-hidden flex" style={{ inset: w }}>
        {children}
      </span>
      {frame.sparkle && size >= 36 && (
        <>
          <span aria-hidden className="fx-twinkle absolute leading-none" style={{ top: -3, right: -1, fontSize: Math.max(8, size * 0.18) }}>✦</span>
          <span aria-hidden className="fx-twinkle absolute leading-none" style={{ bottom: -2, left: -3, fontSize: Math.max(7, size * 0.14), animationDelay: '2.8s' }}>✦</span>
        </>
      )}
    </span>
  );
}

// Metal rim per rarity — the medallion's trim instantly signals its tier:
// polished silver, sapphire, amethyst crystal, turned gold, holographic.
const RIM = {
  common:    'conic-gradient(from 220deg, #f8fafc, #8b98ad 22%, #e2e8f0 45%, #64748b 70%, #cbd5e1 88%, #f8fafc)',
  rare:      'conic-gradient(from 220deg, #e0f2fe, #38bdf8 22%, #bae6fd 45%, #0369a1 70%, #7dd3fc 88%, #e0f2fe)',
  epic:      'conic-gradient(from 220deg, #f3e8ff, #a855f7 22%, #e9d5ff 45%, #6d28d9 70%, #c084fc 88%, #f3e8ff)',
  legendary: 'conic-gradient(from 220deg, #fff7d6, #ffcb45 20%, #b06104 42%, #ffe9a8 58%, #e08e05 78%, #fff7d6)',
  mythic:    'conic-gradient(from 220deg, #ff8bd8, #ffd36b 20%, #7dffa8 40%, #7db9ff 60%, #c98bff 80%, #ff8bd8)',
};

/**
 * Collectible medallion — a metal rim in the emblem's rarity material around
 * a glossy enamel disc: vivid radial color, embossed inner shadows, a hard
 * gloss crescent, and the character grounded with a cast shadow. `breathe`
 * adds a slow idle scale on big surfaces.
 */
// Illustrated emblems trade the colored enamel for a near-black disc so the
// artwork carries the color and the rarity rim reads as a clean ring
// (proven in live tests against the alternative of art-on-enamel).
const ART_DISC = 'radial-gradient(120% 120% at 32% 18%, #23232b 0%, #101016 55%, #050508 100%)';

export function EmblemTile({ emblem, fontSize, breathe = false }) {
  return (
    <span className="relative w-full h-full flex select-none">
      <span aria-hidden className="absolute inset-0 rounded-full" style={{ background: RIM[emblem.rarity] || RIM.common }} />
      <span aria-hidden className="absolute inset-0 rounded-full pointer-events-none"
        style={{ boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.55), inset 0 -1px 2px rgba(0,0,0,0.5)' }} />
      <span className="absolute rounded-full overflow-hidden flex items-center justify-center"
        style={{ inset: '9%', background: emblem.art ? ART_DISC : emblem.tile,
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.45), inset 0 -3px 6px -1px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.15)' }}>
        <span aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(130% 65% at 32% -6%, rgba(255,255,255,0.42), rgba(255,255,255,0.08) 40%, transparent 58%)' }} />
        {emblem.art ? (
          <img src={emblem.art} alt={emblem.name} draggable={false}
            className={`relative ${breathe ? 'medal-breathe' : ''}`}
            style={{ width: '88%', height: '88%', objectFit: 'contain', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))' }} />
        ) : (
          <span className={`relative ${breathe ? 'medal-breathe' : ''}`}
            style={{ fontSize, lineHeight: 1, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))' }}>
            {emblem.emoji}
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * The one avatar renderer. With a progression profile it shows the equipped
 * emblem medallion inside the equipped rarity frame; without one it falls
 * back to the classic glossy letter circle so pre-migration players still
 * look right. Medallions breathe gently at profile sizes (≥48px).
 */
export default function PlayerAvatar({ profile, name = '?', color = '#6d28d9', size = 32, className = '' }) {
  const emblem = profile ? cosmeticById(profile.equipped?.emblem) : null;
  const border = profile ? cosmeticById(profile.equipped?.border) : null;

  if (emblem) {
    const inner = <EmblemTile emblem={emblem} fontSize={size * 0.44} breathe={size >= 48} />;
    if (border?.frame) {
      return <AvatarFrame frame={border.frame} size={size} className={className}>{inner}</AvatarFrame>;
    }
    return (
      <span className={`relative rounded-full overflow-hidden flex shrink-0 select-none ${className}`}
        style={{ width: size, height: size, boxShadow: '0 2px 6px -1px rgba(0,0,0,0.5)' }}>
        {inner}
      </span>
    );
  }

  return (
    <span
      className={`relative rounded-full flex items-center justify-center font-bold text-white shrink-0 overflow-hidden select-none ${className}`}
      style={{
        width: size, height: size, backgroundColor: color,
        fontSize: Math.max(10, size * 0.38),
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.25), 0 2px 6px -1px rgba(0,0,0,0.5)',
      }}
    >
      <span aria-hidden className="pointer-events-none absolute rounded-full bg-white/35"
        style={{ top: -size * 0.14, left: -size * 0.14, width: size * 0.5, height: size * 0.5, filter: 'blur(3px)' }} />
      <span className="relative">{(name || '?')[0].toUpperCase()}</span>
    </span>
  );
}
