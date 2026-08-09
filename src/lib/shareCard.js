// Share win card — a dedicated social graphic rendered on an offscreen
// canvas (1080×1440, 3:4 portrait), never a screenshot of the UI. The
// composition mirrors the app's design language: the cosmic backdrop from
// GameBackground, EmblemTile's medallion recipe (rarity metal rim → dark
// art disc → gloss crescent → artwork), the gold/violet type hierarchy,
// and the real logo as subtle bottom branding.
//
// Pure module: takes plain data in, returns a canvas/Blob. No React, no
// DOM mounting — so it can be re-skinned or reused (e.g. streak cards)
// without touching any screen.
import logoUrl from '../../logo.webp';

export const CARD_W = 1080;
export const CARD_H = 1440;

// Rarity accent colors (mirrors RARITIES in cosmetics.js / index.css).
const RARITY_COLOR = {
  common:    { main: '#cbd5e1', glow: 'rgba(148,163,184,0.35)' },
  rare:      { main: '#7dd3fc', glow: 'rgba(56,189,248,0.4)' },
  epic:      { main: '#c4a1ff', glow: 'rgba(157,92,255,0.45)' },
  legendary: { main: '#ffcb45', glow: 'rgba(255,180,60,0.45)' },
  mythic:    { main: '#e879f9', glow: 'rgba(232,121,249,0.45)' },
};

// EmblemTile's metal rim, translated to canvas stops (conic where
// supported, vertical gradient fallback on older WebKit).
const RIM_STOPS = {
  common:    ['#f8fafc', '#8b98ad', '#e2e8f0', '#64748b', '#cbd5e1', '#f8fafc'],
  rare:      ['#e0f2fe', '#38bdf8', '#bae6fd', '#0369a1', '#7dd3fc', '#e0f2fe'],
  epic:      ['#f3e8ff', '#a855f7', '#e9d5ff', '#6d28d9', '#c084fc', '#f3e8ff'],
  legendary: ['#fff7d6', '#ffcb45', '#b06104', '#ffe9a8', '#e08e05', '#fff7d6'],
  mythic:    ['#ff8bd8', '#ffd36b', '#7dffa8', '#7db9ff', '#c98bff', '#ff8bd8'],
};

const FONT = (weight, px) =>
  `${weight} ${px}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;

// Deterministic star field — same sky on every render/device.
const STARS = [
  [0.08, 0.06, 2.2, 0.8], [0.22, 0.11, 1.4, 0.5], [0.36, 0.05, 1.8, 0.65],
  [0.58, 0.08, 1.4, 0.5], [0.74, 0.04, 2.0, 0.7], [0.90, 0.09, 1.5, 0.55],
  [0.05, 0.22, 1.5, 0.5], [0.93, 0.24, 1.8, 0.6], [0.14, 0.38, 1.3, 0.4],
  [0.88, 0.42, 1.4, 0.45], [0.06, 0.58, 1.6, 0.45], [0.94, 0.62, 1.3, 0.4],
  [0.10, 0.76, 1.4, 0.35], [0.90, 0.80, 1.5, 0.4], [0.28, 0.90, 1.3, 0.3],
  [0.70, 0.93, 1.4, 0.35], [0.48, 0.97, 1.2, 0.3],
];

// Celebration flecks around the headline zone (winner cards only) —
// deterministic, sparse, in the game's gold/violet/pink palette.
const CONFETTI = [
  [0.13, 0.13, -24, '#ffcb45'], [0.24, 0.07, 12, '#c98bff'],
  [0.78, 0.06, -12, '#ff8bd8'], [0.88, 0.14, 30, '#ffd36b'],
  [0.08, 0.30, 18, '#7db9ff'], [0.91, 0.31, -30, '#a78bfa'],
  [0.17, 0.21, 40, '#7dffa8'], [0.84, 0.22, -40, '#ffcb45'],
];

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // missing art → emoji fallback
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Shrink a font size until `text` fits maxWidth at that size.
function fitFont(ctx, text, weight, px, maxWidth) {
  let size = px;
  ctx.font = FONT(weight, size);
  while (size > 24 && ctx.measureText(text).width > maxWidth) {
    size -= 4;
    ctx.font = FONT(weight, size);
  }
  return size;
}

// Extract the three colors from an emblem tile() gradient string —
// `radial-gradient(130% 130% at 30% 20%, LIGHT 0%, MID 52%, DEEP 100%)`.
function tileColors(tileCss) {
  const m = (tileCss || '').match(/,\s*(#[0-9a-fA-F]{6}) 0%,\s*(#[0-9a-fA-F]{6}) 52%,\s*(#[0-9a-fA-F]{6}) 100%/);
  return m ? [m[1], m[2], m[3]] : ['#8f6bff', '#41209b', '#160837'];
}

function drawBackground(ctx, celebratory) {
  // Deep-space base (GameBackground's palette)
  ctx.fillStyle = '#07040f';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Overhead light
  let g = ctx.createRadialGradient(CARD_W / 2, -CARD_H * 0.1, 0, CARD_W / 2, -CARD_H * 0.1, CARD_H * 0.55);
  g.addColorStop(0, 'rgba(255,255,255,0.06)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Ambient violet wash
  g = ctx.createRadialGradient(CARD_W / 2, CARD_H * 0.16, 0, CARD_W / 2, CARD_H * 0.16, CARD_H * 0.72);
  g.addColorStop(0, celebratory ? 'rgba(150,95,230,0.30)' : 'rgba(140,90,220,0.24)');
  g.addColorStop(1, 'rgba(140,90,220,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Warm undertone at the base
  g = ctx.createRadialGradient(CARD_W / 2, CARD_H * 1.02, 0, CARD_W / 2, CARD_H * 1.02, CARD_H * 0.5);
  g.addColorStop(0, 'rgba(140,70,20,0.10)');
  g.addColorStop(1, 'rgba(140,70,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Star field
  for (const [x, y, r, o] of STARS) {
    ctx.fillStyle = `rgba(255,255,255,${o})`;
    ctx.beginPath();
    ctx.arc(x * CARD_W, y * CARD_H, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (celebratory) {
    for (const [x, y, rot, color] of CONFETTI) {
      ctx.save();
      ctx.translate(Number(x) * CARD_W, Number(y) * CARD_H);
      ctx.rotate((Number(rot) * Math.PI) / 180);
      ctx.fillStyle = String(color);
      ctx.globalAlpha = 0.85;
      roundRect(ctx, -7, -13, 14, 26, 5);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // Vignette — keeps the eye in the center, matches every screen's edges
  g = ctx.createRadialGradient(CARD_W / 2, CARD_H / 2, CARD_H * 0.34, CARD_W / 2, CARD_H / 2, CARD_H * 0.82);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
}

// EmblemTile, faithfully: rarity metal rim → near-black art disc (or the
// emblem's enamel tile for emoji emblems) → gloss crescent → artwork.
function drawMedallion(ctx, cx, cy, radius, emblem, artImg) {
  const rarity = emblem?.rarity || 'common';

  // Rarity aura behind the medallion
  const aura = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius * 2.1);
  aura.addColorStop(0, RARITY_COLOR[rarity].glow);
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(cx - radius * 2.2, cy - radius * 2.2, radius * 4.4, radius * 4.4);

  // Ground shadow — the medallion sits IN the scene, not pasted on it
  ctx.save();
  ctx.translate(cx, cy + radius * 1.18);
  ctx.scale(1, 0.28);
  const ground = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.95);
  ground.addColorStop(0, 'rgba(0,0,0,0.55)');
  ground.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ground;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.95, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Metal rim
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  const stops = RIM_STOPS[rarity] || RIM_STOPS.common;
  let rim;
  if (typeof ctx.createConicGradient === 'function') {
    rim = ctx.createConicGradient((220 * Math.PI) / 180, cx, cy);
    const pos = [0, 0.22, 0.45, 0.7, 0.88, 1];
    stops.forEach((c, i) => rim.addColorStop(pos[i], c));
  } else {
    rim = ctx.createLinearGradient(cx, cy - radius, cx, cy + radius);
    rim.addColorStop(0, stops[0]);
    rim.addColorStop(0.5, stops[1]);
    rim.addColorStop(1, stops[3]);
  }
  ctx.fillStyle = rim;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = radius * 0.22;
  ctx.shadowOffsetY = radius * 0.09;
  ctx.fill();
  ctx.restore();

  // Disc — dark for illustrated art, the emblem's enamel tile for emoji
  const discR = radius * 0.91;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, discR, 0, Math.PI * 2);
  ctx.clip();
  const disc = ctx.createRadialGradient(
    cx - discR * 0.36, cy - discR * 0.64, 0,
    cx - discR * 0.36, cy - discR * 0.64, discR * 2.3
  );
  if (artImg) {
    disc.addColorStop(0, '#23232b');
    disc.addColorStop(0.55, '#101016');
    disc.addColorStop(1, '#050508');
  } else {
    const [light, mid, deep] = tileColors(emblem?.tile);
    disc.addColorStop(0, light);
    disc.addColorStop(0.52, mid);
    disc.addColorStop(1, deep);
  }
  ctx.fillStyle = disc;
  ctx.fillRect(cx - discR, cy - discR, discR * 2, discR * 2);

  // Inner emboss
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = radius * 0.05;
  ctx.beginPath();
  ctx.arc(cx, cy, discR - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();

  // Artwork / emoji
  if (artImg) {
    const s = discR * 2 * 0.88;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 6;
    const ratio = Math.min(s / artImg.width, s / artImg.height);
    const w = artImg.width * ratio, h = artImg.height * ratio;
    ctx.drawImage(artImg, cx - w / 2, cy - h / 2, w, h);
    ctx.shadowColor = 'transparent';
  } else if (emblem?.emoji) {
    ctx.font = `${Math.round(discR * 1.05)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emblem.emoji, cx, cy + discR * 0.06);
  }

  // Gloss crescent
  const gloss = ctx.createRadialGradient(
    cx - discR * 0.35, cy - discR * 1.1, 0,
    cx - discR * 0.35, cy - discR * 1.1, discR * 1.5
  );
  gloss.addColorStop(0, 'rgba(255,255,255,0.4)');
  gloss.addColorStop(0.45, 'rgba(255,255,255,0.08)');
  gloss.addColorStop(0.62, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(cx - discR, cy - discR, discR * 2, discR * 2);
  ctx.restore();

  // Rim relief highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 1, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();

  // Sparkles on legendary/mythic — same ✦ the UI uses
  if (rarity === 'legendary' || rarity === 'mythic') {
    ctx.fillStyle = RARITY_COLOR[rarity].main;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = FONT(400, Math.round(radius * 0.22));
    ctx.fillText('✦', cx + radius * 0.92, cy - radius * 0.86);
    ctx.font = FONT(400, Math.round(radius * 0.15));
    ctx.fillText('✦', cx - radius * 1.02, cy + radius * 0.62);
  }
}

// Rounded pill chip with centered text; returns nothing, caller positions.
function drawChip(ctx, cx, y, text, { fill, ring, color, px = 30 }) {
  ctx.font = FONT(800, px);
  const w = ctx.measureText(text).width + 56;
  const h = px + 34;
  ctx.save();
  roundRect(ctx, cx - w / 2, y, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = ring;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + h / 2 + 1);
  ctx.restore();
  return w;
}

function chipWidth(ctx, text, px = 30) {
  ctx.font = FONT(800, px);
  return ctx.measureText(text).width + 56;
}

/**
 * Render the card. All strings arrive pre-localized from the caller.
 *
 * @param {Object} d
 * @param {'perfect'|'win'|'place'} d.variant
 * @param {string} d.headline      e.g. "PERFECT!", "VICTORY!", "#2 PLACE"
 * @param {string} d.scoreText     e.g. "3/3"
 * @param {string} d.scoreLabel    e.g. "WORDS GUESSED"
 * @param {string} [d.name]        player display name ('' → omitted)
 * @param {Object} [d.emblem]      cosmetics.js emblem object (art/emoji/tile/rarity)
 * @param {string[]} [d.chips]     up to 2 extra chips, e.g. ["🔥 3 WIN STREAK"]
 * @param {Object} [d.unlockChip]  { text, rarity } → rarity-colored chip
 * @param {string} [d.categoryText] e.g. "🐶 Pets"
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderShareCard(d) {
  const [artImg, logoImg] = await Promise.all([
    loadImage(d.emblem?.art),
    loadImage(logoUrl),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  const cx = CARD_W / 2;
  const isWin = d.variant === 'perfect' || d.variant === 'win';

  drawBackground(ctx, isWin);

  // ── Category chip (context, quiet) ───────────────────────────────
  if (d.categoryText) {
    drawChip(ctx, cx, 118, d.categoryText, {
      fill: 'rgba(255,255,255,0.06)', ring: 'rgba(255,255,255,0.14)',
      color: '#cbd5e1', px: 30,
    });
  }

  // ── Headline ─────────────────────────────────────────────────────
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const headlinePx = fitFont(ctx, d.headline, 900, 148, CARD_W - 200);
  const hy = 348;
  ctx.save();
  if (isWin) {
    // Gold treatment — the same #fdeeb8→#ffcb45→#a85800 ramp as gold-btn
    ctx.shadowColor = 'rgba(255,180,60,0.55)';
    ctx.shadowBlur = 60;
    const grad = ctx.createLinearGradient(0, hy - headlinePx, 0, hy + 16);
    grad.addColorStop(0, '#fdeeb8');
    grad.addColorStop(0.42, '#ffcb45');
    grad.addColorStop(0.8, '#e08e05');
    grad.addColorStop(1, '#a85800');
    ctx.fillStyle = grad;
  } else {
    ctx.shadowColor = 'rgba(157,92,255,0.55)';
    ctx.shadowBlur = 55;
    const grad = ctx.createLinearGradient(0, hy - headlinePx, 0, hy + 16);
    grad.addColorStop(0, '#e6d9ff');
    grad.addColorStop(0.55, '#b794ff');
    grad.addColorStop(1, '#7c3aed');
    ctx.fillStyle = grad;
  }
  ctx.font = FONT(900, headlinePx);
  ctx.fillText(d.headline, cx, hy);
  // Crisp re-stroke of the top edge so small previews stay sharp
  ctx.shadowColor = 'transparent';
  ctx.fillText(d.headline, cx, hy);
  ctx.restore();

  // ── Score ────────────────────────────────────────────────────────
  const scorePx = fitFont(ctx, d.scoreText, 900, 108, 620);
  ctx.save();
  ctx.font = FONT(900, scorePx);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(157,92,255,0.5)';
  ctx.shadowBlur = 34;
  ctx.fillText(d.scoreText, cx, 486);
  ctx.restore();
  ctx.font = FONT(800, 30);
  ctx.fillStyle = 'rgba(203,213,225,0.85)';
  ctx.save();
  // section-label styling: caps + tracking
  const label = d.scoreLabel;
  ctx.font = FONT(800, 30);
  const spaced = label.split('').join('  ');
  ctx.fillText(spaced, cx, 538);
  ctx.restore();

  // ── Medallion focal ─────────────────────────────────────────────
  // Sparse cards (no chips, no name) let the medallion take a touch more
  // room so the composition never reads as an empty band.
  const hasChips = !!((d.chips && d.chips.length) || d.unlockChip);
  const sparse = !hasChips && !d.name;
  drawMedallion(ctx, cx, sparse ? 830 : 810, sparse ? 218 : 200, d.emblem, artImg);

  // ── Chips row ────────────────────────────────────────────────────
  const chips = [];
  for (const text of d.chips || []) {
    chips.push({ text, style: { fill: 'rgba(255,255,255,0.07)', ring: 'rgba(255,255,255,0.16)', color: '#e2e8f0' } });
  }
  if (d.unlockChip) {
    const rc = RARITY_COLOR[d.unlockChip.rarity] || RARITY_COLOR.epic;
    chips.push({ text: d.unlockChip.text, style: { fill: 'rgba(20,10,40,0.6)', ring: rc.main, color: rc.main } });
  }
  if (chips.length) {
    const gap = 22;
    const widths = chips.map(c => chipWidth(ctx, c.text));
    const total = widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1);
    let x = cx - total / 2;
    const y = 1058;
    chips.forEach((c, i) => {
      drawChip(ctx, x + widths[i] / 2, y, c.text, c.style);
      x += widths[i] + gap;
    });
  }

  // ── Player name ──────────────────────────────────────────────────
  if (d.name) {
    const namePx = fitFont(ctx, d.name, 800, 54, 760);
    ctx.font = FONT(800, namePx);
    ctx.fillStyle = '#ffffff';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    ctx.fillText(d.name, cx, chips.length ? 1178 : 1148);
    ctx.restore();
  }

  // ── Branding — the actual logo, small, bottom-anchored ──────────
  // No tagline: the 3D logo already carries the identity, and text under
  // it read as clutter (and an ad) in visual tests.
  if (logoImg) {
    const lw = 210;
    const lh = (logoImg.height / logoImg.width) * lw;
    ctx.save();
    ctx.shadowColor = 'rgba(168,109,255,0.4)';
    ctx.shadowBlur = 34;
    ctx.drawImage(logoImg, cx - lw / 2, CARD_H - lh - 52, lw, lh);
    ctx.restore();
  }

  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png'
    );
  });
}
