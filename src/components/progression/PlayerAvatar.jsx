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

/** Glossy character tile — vivid radial color, top-light sheen, grounded emoji. */
export function EmblemTile({ emblem, fontSize }) {
  return (
    <span className="relative w-full h-full flex items-center justify-center" style={{ background: emblem.tile }}>
      <span aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(85% 55% at 30% 12%, rgba(255,255,255,0.35), transparent 62%)' }} />
      <span aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: 'inset 0 -4px 8px -4px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.25)' }} />
      <span className="relative" style={{ fontSize, lineHeight: 1, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.45))' }}>
        {emblem.emoji}
      </span>
    </span>
  );
}

/**
 * The one avatar renderer. With a progression profile it shows the equipped
 * emblem inside the equipped rarity frame; without one it falls back to the
 * classic glossy letter circle so pre-migration players still look right.
 */
export default function PlayerAvatar({ profile, name = '?', color = '#6d28d9', size = 32, className = '' }) {
  const emblem = profile ? cosmeticById(profile.equipped?.emblem) : null;
  const border = profile ? cosmeticById(profile.equipped?.border) : null;

  if (emblem) {
    const inner = <EmblemTile emblem={emblem} fontSize={size * 0.5} />;
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
