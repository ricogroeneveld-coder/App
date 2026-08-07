import React from 'react';

// Ambient live effects per banner — slow, elegant, clipped by the banner
// frame. Only rendered when `animated` (big surfaces: profile cards), so
// lobby tiles stay calm and cheap.
// kind: fall | rise | drift | twinkle | pulse | aurora
const BANNER_FX = {
  bn_midnight: { kind: 'twinkle', tint: '#e0e7ff', s: 9 },
  bn_clouds:   { kind: 'drift', e: '☁️', s: 16 },
  bn_royal:    { kind: 'twinkle', tint: '#ffd36b', s: 10 },
  bn_candy:    { kind: 'fall', e: '🍬', s: 11 },
  bn_ice:      { kind: 'fall', e: '❄️', s: 11 },
  bn_pixel:    { kind: 'twinkle', tint: '#c084fc', s: 10 },
  bn_storm:    { kind: 'pulse', e: '⚡', s: 16 },
  bn_ocean:    { kind: 'rise', e: '🫧', s: 12 },
  bn_forest:   { kind: 'rise', tint: '#a3e635', s: 8 },
  bn_sakura:   { kind: 'fall', e: '🌸', s: 12 },
  bn_neon:     { kind: 'pulse', tintBg: 'linear-gradient(180deg, rgba(0,225,255,0.22), transparent 60%)' },
  bn_nebula:   { kind: 'twinkle', tint: '#f0abfc', s: 10 },
  bn_ember:    { kind: 'rise', tint: '#fb923c', s: 9 },
  bn_cyber:    { kind: 'pulse', tintBg: 'linear-gradient(0deg, rgba(0,255,213,0.2), transparent 70%)' },
  bn_crystal:  { kind: 'twinkle', tint: '#e879f9', s: 10 },
  bn_temple:   { kind: 'rise', tint: '#ffcb45', s: 8 },
  bn_gold:     { kind: 'twinkle', tint: '#ffe9a8', s: 11 },
  bn_galaxy:   { kind: 'twinkle', tint: '#bae6fd', s: 10 },
  bn_spooky:   { kind: 'drift', e: '👻', s: 13 },
  bn_winter:   { kind: 'fall', e: '❄️', s: 11 },
  bn_dragon:   { kind: 'rise', tint: '#6ee7b7', s: 9 },
  bn_aurora:   { kind: 'aurora' },
  bn_rainbow:  { kind: 'twinkle', tint: '#ffd36b', s: 11 },
};

const FX_SPOTS = [
  { x: '16%', delay: '0s', scale: 1 },
  { x: '54%', delay: '3.8s', scale: 0.72 },
  { x: '82%', delay: '7.4s', scale: 0.9 },
];

function FxLayer({ fx }) {
  if (!fx) return null;
  if (fx.kind === 'aurora') {
    return (
      <span className="fx-aurora absolute pointer-events-none"
        style={{ inset: '-25% -12%', background: 'linear-gradient(100deg, transparent 18%, rgba(94,234,212,0.3) 38%, rgba(125,185,255,0.28) 56%, rgba(201,139,255,0.2) 68%, transparent 82%)' }} />
    );
  }
  if (fx.kind === 'pulse' && !fx.e) {
    return <span className="fx-pulse absolute inset-0 pointer-events-none" style={{ background: fx.tintBg }} />;
  }
  const cls = { fall: 'fx-fall', rise: 'fx-rise', drift: 'fx-drift', twinkle: 'fx-twinkle', pulse: 'fx-pulse' }[fx.kind];
  return FX_SPOTS.map((p, i) => (
    <span key={i} className={`absolute select-none pointer-events-none leading-none ${cls}`}
      style={{
        left: p.x,
        ...(fx.kind === 'rise' ? { bottom: '-12%' } : fx.kind === 'fall' ? { top: '-14%' } : { top: `${14 + i * 24}%` }),
        fontSize: Math.round((fx.s || 12) * p.scale),
        color: fx.tint,
        textShadow: fx.tint ? `0 0 6px ${fx.tint}` : undefined,
        animationDelay: p.delay,
      }}>
      {fx.e || '✦'}
    </span>
  ));
}

/**
 * Banner scene renderer — layered gradients/patterns from the catalog css,
 * floating emoji motifs for depth, a top light edge, soft vignette, a slow
 * shine sweep on legendary/mythic, and (when `animated`) slow ambient
 * particles per theme: falling petals, rising embers, drifting clouds,
 * twinkling stars, aurora shimmer. Fills its parent; place it as the first
 * (absolute) child behind banner content.
 */
export default function BannerArt({ banner, className = '', style = {}, motifScale = 1, animated = false }) {
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
      {animated && <FxLayer fx={BANNER_FX[b.id]} />}
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <span className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 30%, rgba(0,0,0,0.28) 100%)' }} />
      {b.shine && <span className="fx-shine" />}
    </span>
  );
}
