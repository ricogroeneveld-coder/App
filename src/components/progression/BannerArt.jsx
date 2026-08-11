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

// Scene layers turn a gradient into a miniature illustration: silhouette
// midgrounds (mountains, skylines, trees), fog bands, light rays, glow orbs
// (sun/planet), and rain. Painted between the base gradient and the motifs.
const SIL = {
  mountains: 'polygon(0% 100%, 0% 58%, 16% 34%, 30% 62%, 47% 26%, 63% 66%, 79% 42%, 100% 68%, 100% 100%)',
  skyline: 'polygon(0% 100%, 0% 62%, 7% 62%, 7% 40%, 15% 40%, 15% 66%, 25% 66%, 25% 30%, 33% 30%, 33% 56%, 45% 56%, 45% 46%, 53% 46%, 53% 70%, 63% 70%, 63% 36%, 71% 36%, 71% 60%, 83% 60%, 83% 50%, 91% 50%, 91% 74%, 100% 74%, 100% 100%)',
  trees: 'polygon(0% 100%, 0% 52%, 6% 76%, 11% 40%, 17% 78%, 23% 34%, 30% 80%, 36% 46%, 43% 82%, 100% 100%)',
  temple: 'polygon(0% 100%, 22% 100%, 26% 74%, 34% 74%, 30% 56%, 40% 56%, 36% 40%, 50% 28%, 64% 40%, 60% 56%, 70% 56%, 66% 74%, 74% 74%, 78% 100%, 100% 100%)',
};

const BANNER_LAYERS = {
  bn_sakura: [
    { t: 'rays', from: '75% -10%', tint: 'rgba(255,235,200,0.2)' },
    { t: 'sil', clip: SIL.mountains, color: 'rgba(90,25,60,0.5)', h: '46%' },
    { t: 'fog', y: '58%', o: 0.2 },
  ],
  bn_dragon: [
    { t: 'orb', x: '78%', y: '18%', s: 46, color: 'rgba(110,231,183,0.35)' },
    { t: 'sil', clip: SIL.mountains, color: 'rgba(1,18,12,0.75)', h: '52%' },
    { t: 'fog', y: '52%', o: 0.16 },
  ],
  bn_neon: [
    { t: 'sil', clip: SIL.skyline, color: 'rgba(8,4,24,0.85)', h: '62%' },
    { t: 'rain' },
  ],
  bn_cyber: [
    { t: 'sil', clip: SIL.skyline, color: 'rgba(2,8,16,0.8)', h: '55%' },
    { t: 'rain' },
  ],
  bn_galaxy: [
    { t: 'orb', x: '20%', y: '30%', s: 52, color: 'rgba(157,92,255,0.4)' },
  ],
  bn_forest: [
    { t: 'rays', from: '25% -10%', tint: 'rgba(220,255,180,0.14)' },
    { t: 'sil', clip: SIL.trees, color: 'rgba(1,12,6,0.8)', h: '58%' },
    { t: 'fog', y: '62%', o: 0.14 },
  ],
  bn_aurora: [
    { t: 'sil', clip: SIL.mountains, color: 'rgba(3,2,14,0.85)', h: '42%' },
  ],
  bn_temple: [
    { t: 'rays', from: '50% -20%', tint: 'rgba(255,203,69,0.16)' },
    { t: 'sil', clip: SIL.temple, color: 'rgba(20,8,0,0.75)', h: '64%' },
  ],
  bn_ocean: [
    { t: 'rays', from: '40% -20%', tint: 'rgba(150,220,255,0.16)' },
  ],
  bn_ember: [
    { t: 'sil', clip: SIL.mountains, color: 'rgba(10,2,0,0.7)', h: '44%' },
    { t: 'fog', y: '50%', o: 0.12 },
  ],
  bn_winter: [
    { t: 'sil', clip: SIL.mountains, color: 'rgba(210,235,255,0.22)', h: '40%' },
  ],
  bn_gold: [
    { t: 'rays', from: '50% -20%', tint: 'rgba(255,220,140,0.18)' },
  ],
};

function SceneLayer({ l }) {
  if (l.t === 'sil') {
    return <span className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: l.h, background: l.color, clipPath: l.clip }} />;
  }
  if (l.t === 'fog') {
    return <span className="absolute inset-x-[-10%] pointer-events-none" style={{ top: l.y, height: '34%', background: `linear-gradient(180deg, transparent, rgba(255,255,255,${l.o}), transparent)`, filter: 'blur(5px)' }} />;
  }
  if (l.t === 'rays') {
    return <span className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: 'screen',
      background: `conic-gradient(from 160deg at ${l.from}, transparent 0deg, ${l.tint} 10deg, transparent 22deg, ${l.tint} 32deg, transparent 46deg, ${l.tint} 58deg, transparent 70deg)` }} />;
  }
  if (l.t === 'orb') {
    return <span className="absolute rounded-full pointer-events-none" style={{ left: l.x, top: l.y, width: l.s, height: l.s, transform: 'translate(-50%, -50%)', background: `radial-gradient(50% 50% at 50% 50%, ${l.color}, transparent 70%)` }} />;
  }
  if (l.t === 'rain') {
    return <span className="fx-rain absolute inset-0 pointer-events-none" />;
  }
  return null;
}

const FX_SPOTS = [
  { x: '16%', delay: '0s', scale: 1 },
  { x: '54%', delay: '3.8s', scale: 0.72 },
  { x: '82%', delay: '7.4s', scale: 0.9 },
];

// Tint used when an emoji effect is converted to particles over painted art —
// keeps each banner's character without the literal sticker.
const EMOJI_TINT = {
  '☁️': 'rgba(255,255,255,0.9)', '🍬': '#f9a8d4', '❄️': '#bae6fd', '⚡': '#ffd36b',
  '🫧': '#a5f3fc', '🌸': '#fbcfe8', '👻': '#ddd6fe',
};

// Painted-art banners keep the ambient MOTION but drop the emoji. The artwork
// already depicts the scene, so a literal ⚡ or ❄️ drifting over it reads as a
// leftover sticker from before the art existed — the CSS motifs are already
// suppressed on art banners for exactly this reason, but the FX layer was not.
// Emoji-less effects (the tinted ✦ particles) are what the art-era banners are
// designed around, so those pass through untouched.
function fxForBanner(b) {
  const fx = BANNER_FX[b.id];
  if (!fx || !b.art || !fx.e) return fx;
  return {
    ...fx,
    // A pulse without an emoji needs a tintBg to show anything at all, so
    // convert it to twinkling particles instead of leaving it invisible.
    kind: fx.kind === 'pulse' && !fx.tintBg ? 'twinkle' : fx.kind,
    e: undefined,
    tint: fx.tint || EMOJI_TINT[fx.e] || 'rgba(255,255,255,0.85)',
  };
}

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
      {/* Painted scene art replaces the CSS scene layers and emoji motifs
          entirely (they're baked into the image); the CSS gradient stays
          behind it as the loading fallback. Ambient FX, lighting overlays,
          vignette, and the shine sweep still apply on top. */}
      {b.art && (
        <img src={b.art} alt="" draggable={false}
          className="absolute inset-0 w-full h-full object-cover" />
      )}
      {!b.art && (BANNER_LAYERS[b.id] || []).map((l, i) => <SceneLayer key={`l${i}`} l={l} />)}
      {!b.art && (b.motifs || []).map((m, i) => (
        <span key={i} className="absolute select-none"
          style={{
            left: m.x, top: m.y, fontSize: m.s * motifScale, lineHeight: 1,
            opacity: m.o ?? 0.6, transform: `rotate(${m.r || 0}deg)`,
            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))',
          }}>
          {m.e}
        </span>
      ))}
      {animated && <FxLayer fx={fxForBanner(b)} />}
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <span className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 30%, rgba(0,0,0,0.28) 100%)' }} />
      {/* Edge vignette + hairline frame — scenes dim softly into every edge
          instead of ending in a hard bright slice (which reads as the art
          being cropped off), and the faint inner ring makes the boundary
          look like a picture frame rather than a cut. */}
      <span className="absolute inset-0"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.09), inset 0 16px 22px -9px rgba(0,0,0,0.68), inset 0 -8px 14px -8px rgba(0,0,0,0.45), inset 10px 0 14px -10px rgba(0,0,0,0.45), inset -10px 0 14px -10px rgba(0,0,0,0.45)' }} />
      {b.shine && <span className="fx-shine" />}
    </span>
  );
}
