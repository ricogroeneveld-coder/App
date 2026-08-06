import React from 'react';
import { cosmeticById } from '@/lib/cosmetics';

/**
 * The one avatar renderer. With a progression profile it shows the equipped
 * emblem on its gradient tile inside the equipped border; without one it
 * falls back to the classic glossy letter circle so pre-migration players
 * still look right.
 */
export default function PlayerAvatar({ profile, name = '?', color = '#6d28d9', size = 32, className = '' }) {
  const emblem = profile ? cosmeticById(profile.equipped?.emblem) : null;
  const border = profile ? cosmeticById(profile.equipped?.border) : null;

  const ringColor = border?.ringColor || 'rgba(255,255,255,0.15)';
  const glow = border?.shadow && border.shadow !== 'none' ? `, ${border.shadow}` : '';

  if (emblem) {
    return (
      <span
        className={`relative rounded-full flex items-center justify-center shrink-0 overflow-hidden select-none ${className}`}
        style={{
          width: size, height: size,
          background: emblem.tile,
          boxShadow: `inset 0 1px 1px rgba(255,255,255,0.2), 0 2px 6px -1px rgba(0,0,0,0.5), 0 0 0 1.5px ${ringColor}${glow}`,
        }}
      >
        {border?.animated && (
          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: `inset 0 0 0 1.5px ${ringColor}`, animation: 'livePulse 2.4s ease-in-out infinite' }} />
        )}
        <span style={{ fontSize: size * 0.55, lineHeight: 1 }}>{emblem.emoji}</span>
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
