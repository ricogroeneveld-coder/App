// Cosmetic catalog — everything a player can own and equip. Purely visual,
// never gameplay. Each item: { id, type, name, rarity, source }.
// source: { type: 'starter' } owned by everyone
//         { type: 'shop', price } purchasable with Picks
//         { type: 'level', level } auto-granted at that level
//         { type: 'challenge' } granted by season challenges
//
// Art direction: kawaii mobile-game collectibles. Emblems are expressive
// characters on vivid, glossy radial tiles — every tile has its own color
// story, never flat. Banners are layered scenes (gradient + pattern +
// motifs + lighting). Borders are rarity frames around the avatar: silver →
// glow → crystal → animated gold → animated rainbow aura. Name colors go up
// to animated rainbow text. Rendering lives in PlayerAvatar/BannerArt and
// the .name-* / .frame-* / .fx-* classes in index.css.

export const RARITIES = {
  common:    { label: 'Common',    ring: 'ring-slate-400/40',  text: 'text-slate-300',
               chip: 'bg-slate-500/20 text-slate-300 ring-1 ring-slate-400/30', cardGlow: '' },
  rare:      { label: 'Rare',      ring: 'ring-sky-400/50',    text: 'text-sky-300',
               chip: 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/40', cardGlow: '' },
  epic:      { label: 'Epic',      ring: 'ring-violet-400/60', text: 'text-violet-300',
               chip: 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-400/40',
               cardGlow: 'shadow-[0_0_18px_-9px_rgba(157,92,255,0.6)]' },
  legendary: { label: 'Legendary', ring: 'ring-amber-400/70',  text: 'text-amber-300',
               chip: 'bg-gradient-to-b from-[#ffcb45] to-[#e08e05] text-[#2c1500]',
               cardGlow: 'shadow-[0_0_20px_-9px_rgba(255,180,60,0.65)]' },
  mythic:    { label: 'Mythic',    ring: 'ring-fuchsia-400/70', text: 'text-fuchsia-300',
               chip: 'bg-gradient-to-b from-fuchsia-400 to-purple-700 text-white',
               cardGlow: 'shadow-[0_0_22px_-9px_rgba(232,121,249,0.7)]' },
};

// Glossy character tiles — light hits top-left, deep color at the base.
const tile = (light, mid, deep) =>
  `radial-gradient(130% 130% at 30% 20%, ${light} 0%, ${mid} 52%, ${deep} 100%)`;
// A tile with tiny stars baked in (for space-y characters)
const starTile = (light, mid, deep) =>
  `radial-gradient(1.5px 1.5px at 72% 24%, rgba(255,255,255,0.9), transparent 100%),` +
  `radial-gradient(1px 1px at 28% 68%, rgba(255,255,255,0.7), transparent 100%),` +
  `radial-gradient(1px 1px at 82% 74%, rgba(255,255,255,0.6), transparent 100%),` +
  tile(light, mid, deep);

export const EMBLEMS = [
  // Starters
  { id: 'em_detective', type: 'emblem', name: 'Detective',   emoji: '🕵️', rarity: 'common',    source: { type: 'starter' },            tile: tile('#8f6bff', '#41209b', '#160837') },
  { id: 'em_card',      type: 'emblem', name: 'Wild Card',   emoji: '🃏', rarity: 'common',    source: { type: 'starter' },            tile: tile('#ff8bd8', '#8f1d6b', '#2b0521') },
  // Commons — cute, instantly likeable
  { id: 'em_kitten',    type: 'emblem', name: 'Mochi',       emoji: '😺', rarity: 'common',    source: { type: 'shop', price: 100 },   tile: tile('#ffce93', '#f2740d', '#5e2405') },
  { id: 'em_penguin', collection: 'col_winter',   type: 'emblem', name: 'Waddles',     emoji: '🐧', rarity: 'common',    source: { type: 'shop', price: 100 },   tile: tile('#bfe9ff', '#2f96d4', '#0a3355') },
  { id: 'em_ghost',     type: 'emblem', name: 'Boo',         emoji: '👻', rarity: 'common',    source: { type: 'shop', price: 100 },   tile: tile('#cfdcff', '#5c78dd', '#182561') },
  { id: 'em_fox',       type: 'emblem', name: 'Sly Fox',     emoji: '🦊', rarity: 'common',    source: { type: 'shop', price: 100 },   tile: tile('#ffb35c', '#dd540a', '#571302') },
  { id: 'em_dice',      type: 'emblem', name: 'High Roller', emoji: '🎲', rarity: 'common',    source: { type: 'shop', price: 100 },   tile: tile('#7dffc0', '#0d9865', '#03301e') },
  // Rares — personality picks
  { id: 'em_panda',     type: 'emblem', name: 'Bamboo',      emoji: '🐼', rarity: 'rare',      source: { type: 'shop', price: 300 },   tile: tile('#c8f7dd', '#2fb87b', '#07402a') },
  { id: 'em_boba',      type: 'emblem', name: 'Boba Break',  emoji: '🧋', rarity: 'rare',      source: { type: 'shop', price: 300 },   tile: tile('#ffe2b8', '#bd7f43', '#42250e') },
  { id: 'em_alien',     type: 'emblem', name: 'Visitor',     emoji: '👽', rarity: 'rare',      source: { type: 'shop', price: 300 },   tile: tile('#b6ff7d', '#4bab10', '#123c02') },
  { id: 'em_ninja',     type: 'emblem', name: 'Shadow',      emoji: '🥷', rarity: 'rare',      source: { type: 'shop', price: 300 },   tile: tile('#8fa3c2', '#2c3a55', '#0a0f1c') },
  { id: 'em_owl',       type: 'emblem', name: 'Night Owl',   emoji: '🦉', rarity: 'rare',      source: { type: 'shop', price: 300 },   tile: tile('#c9a1ff', '#5f2cae', '#1c0b3a') },
  { id: 'em_pixel',     type: 'emblem', name: 'Pixel Pal',   emoji: '👾', rarity: 'rare',      source: { type: 'level', level: 3 },    tile: tile('#cd8bff', '#7c2fe0', '#230a4e') },
  { id: 'em_brain',     type: 'emblem', name: 'Mastermind',  emoji: '🧠', rarity: 'rare',      source: { type: 'level', level: 5 },    tile: tile('#ff9ad5', '#d3357c', '#4b0a2c') },
  // Epics — showpieces
  { id: 'em_robot', collection: 'col_cyber',     type: 'emblem', name: 'Botto',       emoji: '🤖', rarity: 'epic',      source: { type: 'shop', price: 800 },   tile: tile('#84f4ff', '#0e93cf', '#07304f') },
  { id: 'em_unicorn',   type: 'emblem', name: 'Sparklehorn', emoji: '🦄', rarity: 'epic',      source: { type: 'shop', price: 800 },   tile: tile('#ffd3f6', '#c25ede', '#43126b') },
  { id: 'em_wizard',    type: 'emblem', name: 'Word Wizard', emoji: '🧙', rarity: 'epic',      source: { type: 'shop', price: 800 },   tile: starTile('#b394ff', '#6524d6', '#1e0850') },
  { id: 'em_dragon', collection: 'col_dragon',    type: 'emblem', name: 'Dragon',      emoji: '🐉', rarity: 'epic',      source: { type: 'shop', price: 800 },   tile: tile('#8bf7c6', '#0f9d6c', '#043321') },
  { id: 'em_crystal',   type: 'emblem', name: 'Oracle',      emoji: '🔮', rarity: 'epic',      source: { type: 'level', level: 10 },   tile: starTile('#f3b1ff', '#a325bd', '#3c0754') },
  { id: 'em_sakura', collection: 'col_sakura',    type: 'emblem', name: 'Sakura',      emoji: '🌸', rarity: 'epic',      source: { type: 'level', level: 12 },   tile: tile('#ffe0ee', '#f4649f', '#6e1440') },
  // Legendaries — status symbols
  { id: 'em_oni',       type: 'emblem', name: 'Oni Mask',    emoji: '👺', rarity: 'legendary', source: { type: 'shop', price: 2000 },  tile: tile('#ff9d76', '#d92c1c', '#4d0703') },
  { id: 'em_crown', collection: 'col_royal',     type: 'emblem', name: 'Royalty',     emoji: '👑', rarity: 'legendary', source: { type: 'shop', price: 2000 },  tile: tile('#ffdf75', '#cd8306', '#4b2a00') },
  { id: 'em_trophy',    type: 'emblem', name: 'Champion',    emoji: '🏆', rarity: 'legendary', source: { type: 'level', level: 20 },   tile: tile('#ffd75e', '#c47b08', '#402400') },
  { id: 'em_star',      type: 'emblem', name: 'Superstar',   emoji: '🌟', rarity: 'legendary', source: { type: 'level', level: 25 },   tile: starTile('#fff0a8', '#e3a008', '#4d3000') },
  // Mythics — the chase
  { id: 'em_phoenix', collection: 'col_inferno',   type: 'emblem', name: 'Phoenix',     emoji: '🔥', rarity: 'mythic',    source: { type: 'shop', price: 5000 },  tile: tile('#ffc46b', '#f04c13', '#560b06') },
  { id: 'em_planet', collection: 'col_galaxy',    type: 'emblem', name: 'Ringworld',   emoji: '🪐', rarity: 'mythic',    source: { type: 'shop', price: 5000 },  tile: starTile('#c4b5fd', '#5b21b6', '#11043a') },
  { id: 'em_galaxy', collection: 'col_founder',    type: 'emblem', name: 'Cosmic Mind', emoji: '🌌', rarity: 'mythic',    source: { type: 'challenge' },          tile: starTile('#8b7cff', '#3b1a8f', '#0a0620') },
];

// Banner scenes — layered backgrounds (patterns + gradients baked into one
// css string) plus floating emoji motifs for depth. shine adds a slow
// sweep of light on legendary/mythic scenes.
const dots = (spots) => spots.map(([x, y, s, o]) =>
  `radial-gradient(${s}px ${s}px at ${x}% ${y}%, rgba(255,255,255,${o}), transparent 100%)`).join(',');

export const BANNERS = [
  { id: 'bn_midnight', type: 'banner', name: 'Midnight',       rarity: 'common', source: { type: 'starter' },
    css: `${dots([[18, 30, 1.5, 0.8], [76, 22, 1, 0.6], [55, 65, 1, 0.5], [88, 58, 1.5, 0.55]])}, linear-gradient(120deg, #241052 0%, #12072b 55%, #0a0518 100%)` },
  { id: 'bn_clouds',   type: 'banner', name: 'Daydream',       rarity: 'common', source: { type: 'shop', price: 100 },
    css: 'linear-gradient(180deg, #7fb2f2 0%, #a68df0 60%, #e2a6d9 100%)',
    motifs: [{ e: '☁️', x: '8%', y: '18%', s: 22, o: 0.85 }, { e: '☁️', x: '62%', y: '48%', s: 30, o: 0.9 }, { e: '☁️', x: '84%', y: '10%', s: 16, o: 0.7 }] },
  { id: 'bn_slate',    type: 'banner', name: 'Steel',          rarity: 'common', source: { type: 'shop', price: 100 },
    css: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 9px), linear-gradient(120deg, #39435c 0%, #1a2030 60%, #0e1220 100%)' },
  { id: 'bn_royal', collection: 'col_royal',    type: 'banner', name: 'Royal Purple',   rarity: 'common', source: { type: 'shop', price: 100 },
    css: `${dots([[80, 24, 1.5, 0.5]])}, radial-gradient(90% 100% at 50% 0%, rgba(157,92,255,0.35), transparent 60%), linear-gradient(160deg, #4c1d95 0%, #2a1150 55%, #12062b 100%)`,
    motifs: [{ e: '👑', x: '76%', y: '34%', s: 18, o: 0.85, r: 8 }] },
  { id: 'bn_ice',      type: 'banner', name: 'Frostbite',      rarity: 'rare',   source: { type: 'shop', price: 300 },
    css: `${dots([[24, 30, 1.5, 0.7], [70, 60, 1, 0.5]])}, linear-gradient(150deg, #7dd3fc 0%, #2563ab 50%, #0c2247 100%)`,
    motifs: [{ e: '❄️', x: '74%', y: '18%', s: 20, o: 0.9, r: 12 }, { e: '❄️', x: '14%', y: '52%', s: 13, o: 0.7, r: -20 }] },
  { id: 'bn_pixel',    type: 'banner', name: 'Pixel Party',    rarity: 'rare',   source: { type: 'shop', price: 300 },
    css: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 6px, transparent 6px 12px), repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0 6px, transparent 6px 12px), linear-gradient(120deg, #7c3aed 0%, #3b1a8f 55%, #17073a 100%)',
    motifs: [{ e: '👾', x: '72%', y: '26%', s: 22, o: 0.95 }, { e: '🕹️', x: '12%', y: '48%', s: 15, o: 0.8, r: -10 }] },
  { id: 'bn_candy',    type: 'banner', name: 'Candy Pop',      rarity: 'rare',   source: { type: 'level', level: 10 },
    css: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.14) 0 12px, transparent 12px 26px), linear-gradient(120deg, #ff7eb9 0%, #c86bdd 55%, #6d4ad1 100%)',
    motifs: [{ e: '🍬', x: '76%', y: '18%', s: 18, o: 0.9, r: 18 }, { e: '🍭', x: '10%', y: '46%', s: 20, o: 0.9, r: -14 }] },
  { id: 'bn_storm',    type: 'banner', name: 'Thunderhead',    rarity: 'rare',   source: { type: 'level', level: 4 },
    css: `${dots([[70, 20, 1.5, 0.6]])}, linear-gradient(160deg, #3c4a6b 0%, #1c2440 45%, #0b0f22 100%)`,
    motifs: [{ e: '⚡', x: '72%', y: '30%', s: 24, o: 0.9, r: 10 }, { e: '☁️', x: '8%', y: '14%', s: 20, o: 0.55 }] },
  { id: 'bn_ocean',    type: 'banner', name: 'Deep Ocean',     rarity: 'rare',   source: { type: 'shop', price: 300 },
    css: `${dots([[22, 28, 2, 0.25], [38, 60, 1.5, 0.2], [30, 42, 1, 0.25]])}, linear-gradient(180deg, #0e5f8f 0%, #093a5e 45%, #041627 100%)`,
    motifs: [{ e: '🫧', x: '14%', y: '22%', s: 16, o: 0.7 }, { e: '🐠', x: '74%', y: '44%', s: 18, o: 0.85, r: -8 }] },
  { id: 'bn_forest',   type: 'banner', name: 'Forest Night',   rarity: 'rare',   source: { type: 'shop', price: 300 },
    css: `${dots([[26, 40, 1.5, 0.5], [64, 26, 1, 0.45], [80, 62, 1.5, 0.4]])}, linear-gradient(160deg, #14532d 0%, #093321 55%, #02130b 100%)`,
    motifs: [{ e: '🍃', x: '78%', y: '16%', s: 16, o: 0.8, r: 24 }, { e: '🦋', x: '12%', y: '52%', s: 14, o: 0.75, r: -10 }] },
  { id: 'bn_sakura', collection: 'col_sakura',   type: 'banner', name: 'Cherry Blossom', rarity: 'epic',   source: { type: 'shop', price: 800 },
    css: 'linear-gradient(160deg, #ff9ecb 0%, #c2578f 45%, #4e1436 100%)',
    motifs: [{ e: '🌸', x: '74%', y: '10%', s: 24, o: 0.95, r: -12 }, { e: '🌸', x: '12%', y: '46%', s: 16, o: 0.8, r: 20 }, { e: '🌸', x: '48%', y: '66%', s: 12, o: 0.6, r: -30 }] },
  { id: 'bn_neon',     type: 'banner', name: 'Neon City',      rarity: 'epic',   source: { type: 'shop', price: 800 },
    css: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 2px, transparent 2px 5px), radial-gradient(90% 120% at 20% 100%, rgba(255,62,175,0.55), transparent 60%), radial-gradient(90% 120% at 85% 100%, rgba(0,225,255,0.5), transparent 60%), linear-gradient(180deg, #140a2e 0%, #1e0f45 100%)',
    motifs: [{ e: '🌆', x: '66%', y: '24%', s: 26, o: 0.9 }] },
  { id: 'bn_nebula',   type: 'banner', name: 'Nebula',         rarity: 'epic',   source: { type: 'shop', price: 800 },
    css: `${dots([[20, 25, 1.5, 0.9], [45, 60, 1, 0.7], [70, 30, 1.5, 0.8], [88, 66, 1, 0.6], [58, 14, 1, 0.7]])}, radial-gradient(80% 100% at 70% 20%, rgba(232,121,249,0.4), transparent 60%), linear-gradient(120deg, #4c1d95 0%, #1c0b3a 55%, #6d28d9 100%)`,
    motifs: [{ e: '✨', x: '80%', y: '48%', s: 14, o: 0.9 }] },
  { id: 'bn_cyber', collection: 'col_cyber',    type: 'banner', name: 'Cyberline',      rarity: 'epic',   source: { type: 'shop', price: 800 },
    css: 'repeating-linear-gradient(105deg, rgba(0,255,213,0.10) 0 2px, transparent 2px 16px), radial-gradient(80% 120% at 50% 110%, rgba(0,225,255,0.35), transparent 60%), linear-gradient(160deg, #0f1b33 0%, #0a1024 55%, #05070f 100%)',
    motifs: [{ e: '🤖', x: '74%', y: '28%', s: 20, o: 0.9 }, { e: '⚙️', x: '12%', y: '22%', s: 14, o: 0.7, r: 20 }] },
  { id: 'bn_crystal',  type: 'banner', name: 'Crystal Cave',   rarity: 'epic',   source: { type: 'shop', price: 800 },
    css: `${dots([[30, 26, 1.5, 0.8], [62, 58, 1, 0.6]])}, radial-gradient(70% 100% at 70% 100%, rgba(232,121,249,0.35), transparent 60%), linear-gradient(150deg, #6d28d9 0%, #3b1a6b 50%, #170a33 100%)`,
    motifs: [{ e: '💎', x: '72%', y: '30%', s: 20, o: 0.95, r: -8 }, { e: '🔮', x: '14%', y: '48%', s: 14, o: 0.8 }] },
  { id: 'bn_ember', collection: 'col_inferno',    type: 'banner', name: 'Ember',          rarity: 'epic',   source: { type: 'level', level: 8 },
    css: `${dots([[30, 30, 1.5, 0.5], [60, 50, 1, 0.4]])}, radial-gradient(100% 120% at 50% 110%, rgba(255,120,40,0.55), transparent 60%), linear-gradient(160deg, #7c2d12 0%, #431407 55%, #16030b 100%)`,
    motifs: [{ e: '🔥', x: '76%', y: '34%', s: 20, o: 0.85 }] },
  { id: 'bn_temple',   type: 'banner', name: 'Ancient Temple', rarity: 'legendary', source: { type: 'shop', price: 2000 }, shine: true,
    css: 'repeating-linear-gradient(90deg, rgba(255,203,69,0.06) 0 14px, transparent 14px 28px), linear-gradient(160deg, #7a4a12 0%, #3d2408 55%, #170d02 100%)',
    motifs: [{ e: '⛩️', x: '72%', y: '20%', s: 28, o: 0.95 }, { e: '🏮', x: '12%', y: '42%', s: 16, o: 0.8 }] },
  { id: 'bn_gold',     type: 'banner', name: 'Gilded',         rarity: 'legendary', source: { type: 'shop', price: 2000 }, shine: true,
    css: `${dots([[24, 32, 1.5, 0.6], [70, 60, 1, 0.5]])}, linear-gradient(120deg, #b06104 0%, #3a2400 55%, #1a0f00 100%)`,
    motifs: [{ e: '✦', x: '80%', y: '22%', s: 14, o: 0.9 }] },
  { id: 'bn_galaxy', collection: 'col_galaxy',   type: 'banner', name: 'Galaxy',         rarity: 'legendary', source: { type: 'level', level: 16 }, shine: true,
    css: `${dots([[12, 20, 1.5, 0.9], [30, 55, 1, 0.7], [48, 25, 1, 0.8], [66, 62, 1.5, 0.7], [84, 30, 1, 0.8], [92, 70, 1, 0.6]])}, radial-gradient(70% 90% at 30% 40%, rgba(109,40,217,0.5), transparent 65%), linear-gradient(140deg, #1e1b4b 0%, #0c0724 60%, #050213 100%)`,
    motifs: [{ e: '🪐', x: '72%', y: '38%', s: 22, o: 0.95, r: -10 }] },
  { id: 'bn_spooky',   type: 'banner', name: 'Spooky Night',   rarity: 'legendary', source: { type: 'shop', price: 2000 }, shine: true,
    css: `${dots([[22, 24, 1.5, 0.6], [60, 18, 1, 0.5]])}, radial-gradient(60% 80% at 78% 30%, rgba(249,115,22,0.35), transparent 60%), linear-gradient(170deg, #2e1065 0%, #1a0836 55%, #0a0316 100%)`,
    motifs: [{ e: '🎃', x: '74%', y: '38%', s: 22, o: 0.95 }, { e: '👻', x: '14%', y: '20%', s: 16, o: 0.8, r: -10 }, { e: '🦇', x: '44%', y: '14%', s: 12, o: 0.7, r: 12 }] },
  { id: 'bn_winter', collection: 'col_winter',   type: 'banner', name: 'Winter Wonder',  rarity: 'legendary', source: { type: 'shop', price: 2000 }, shine: true,
    css: `${dots([[16, 20, 1.5, 0.9], [40, 44, 1, 0.7], [66, 22, 1.5, 0.8], [86, 52, 1, 0.7]])}, linear-gradient(170deg, #164e63 0%, #0c2f42 55%, #041521 100%)`,
    motifs: [{ e: '🎄', x: '74%', y: '30%', s: 22, o: 0.95 }, { e: '⛄', x: '12%', y: '44%', s: 16, o: 0.85 }, { e: '❄️', x: '46%', y: '16%', s: 11, o: 0.7, r: 18 }] },
  { id: 'bn_dragon', collection: 'col_dragon',   type: 'banner', name: 'Dragon Realm',   rarity: 'mythic', source: { type: 'shop', price: 5000 }, shine: true,
    css: `${dots([[20, 28, 1.5, 0.5]])}, radial-gradient(90% 110% at 80% 100%, rgba(16,185,129,0.4), transparent 60%), linear-gradient(150deg, #064e3b 0%, #022c22 55%, #01120c 100%)`,
    motifs: [{ e: '🐉', x: '66%', y: '16%', s: 34, o: 0.95, r: -6 }, { e: '✦', x: '18%', y: '30%', s: 12, o: 0.8 }] },
  { id: 'bn_aurora',   type: 'banner', name: 'Aurora',         rarity: 'mythic', source: { type: 'level', level: 30 }, shine: true,
    css: `${dots([[16, 24, 1.5, 0.8], [80, 20, 1, 0.7], [60, 60, 1, 0.6]])}, radial-gradient(100% 90% at 30% 0%, rgba(52,211,153,0.45), transparent 55%), radial-gradient(100% 90% at 75% 0%, rgba(56,189,248,0.4), transparent 55%), linear-gradient(160deg, #312e81 0%, #131044 55%, #060318 100%)`,
    motifs: [{ e: '❄️', x: '84%', y: '52%', s: 12, o: 0.7 }] },
  { id: 'bn_rainbow',  type: 'banner', name: 'Rainbow Road',   rarity: 'mythic', source: { type: 'shop', price: 5000 }, shine: true,
    css: `${dots([[20, 22, 1.5, 0.9], [78, 48, 1, 0.7]])}, linear-gradient(100deg, rgba(255,139,216,0.55) 0%, rgba(255,211,107,0.5) 25%, rgba(125,255,168,0.45) 50%, rgba(125,185,255,0.5) 75%, rgba(201,139,255,0.55) 100%), linear-gradient(160deg, #1e1b4b 0%, #0c0724 100%)`,
    motifs: [{ e: '🌈', x: '72%', y: '24%', s: 24, o: 0.95 }, { e: '✨', x: '14%', y: '40%', s: 14, o: 0.85 }] },
];

// Avatar frames — the ring instantly communicates rarity: silver → colored
// glow → crystal facets → animated gold → animated rainbow aura.
export const BORDERS = [
  { id: 'bd_none',     type: 'border', name: 'Silver',        rarity: 'common',    source: { type: 'starter' },
    frame: { ring: 'linear-gradient(160deg, #f1f5fb 0%, #8b98ad 55%, #cdd6e4 100%)' } },
  { id: 'bd_violet',   type: 'border', name: 'Violet Glow',   rarity: 'common',    source: { type: 'shop', price: 100 },
    frame: { ring: 'linear-gradient(180deg, #c4b5fd, #7c3aed)', glow: '0 0 10px 0 rgba(157,92,255,0.65)' } },
  { id: 'bd_sky',      type: 'border', name: 'Ice Glow',      rarity: 'rare',      source: { type: 'shop', price: 300 },
    frame: { ring: 'linear-gradient(180deg, #d5f2ff, #38bdf8 60%, #0284c7)', glow: '0 0 12px 0 rgba(56,189,248,0.7)', pulse: true } },
  { id: 'bd_emerald',  type: 'border', name: 'Emerald Glow',  rarity: 'rare',      source: { type: 'level', level: 6 },
    frame: { ring: 'linear-gradient(180deg, #a7f3d0, #10b981 60%, #047857)', glow: '0 0 12px 0 rgba(52,211,153,0.7)', pulse: true } },
  { id: 'bd_summer',   type: 'border', name: 'Sunkissed',     rarity: 'rare',      source: { type: 'level', level: 9 },
    frame: { ring: 'linear-gradient(180deg, #fde68a, #f97316 60%, #c2410c)', glow: '0 0 12px 0 rgba(249,115,22,0.6)' } },
  { id: 'bd_electric', type: 'border', name: 'Electric',      rarity: 'epic',      source: { type: 'shop', price: 800 },
    frame: { ring: 'conic-gradient(#facc15, #22d3ee, #facc15, #22d3ee, #facc15)', glow: '0 0 13px 0 rgba(250,204,21,0.6)', pulse: true } },
  { id: 'bd_sakura', collection: 'col_sakura',   type: 'border', name: 'Sakura Bloom',  rarity: 'epic',      source: { type: 'shop', price: 800 },
    frame: { ring: 'conic-gradient(#ffe3ef, #fb7fb9, #ffd7e8, #f472b6, #ffe3ef)', glow: '0 0 13px 0 rgba(244,114,182,0.6)', pulse: true } },
  { id: 'bd_snow', collection: 'col_winter',     type: 'border', name: 'Frostfall',     rarity: 'epic',      source: { type: 'shop', price: 800 },
    frame: { ring: 'conic-gradient(#ffffff, #bae6fd, #e0f2fe, #7dd3fc, #ffffff)', glow: '0 0 13px 0 rgba(186,230,253,0.65)', pulse: true } },
  { id: 'bd_cyber', collection: 'col_cyber',    type: 'border', name: 'Circuit',       rarity: 'epic',      source: { type: 'shop', price: 800 },
    frame: { ring: 'conic-gradient(#5eead4, #0f766e, #99f6e4, #134e4a, #5eead4)', glow: '0 0 13px 0 rgba(94,234,212,0.6)', spin: true } },
  { id: 'bd_crystal',  type: 'border', name: 'Amethyst',      rarity: 'epic',      source: { type: 'shop', price: 800 },
    frame: { ring: 'conic-gradient(#e9d5ff, #7c3aed, #4c1d95, #a78bfa, #6d28d9, #e9d5ff)', glow: '0 0 13px 0 rgba(157,92,255,0.65)' } },
  { id: 'bd_void',     type: 'border', name: 'Void',          rarity: 'epic',      source: { type: 'shop', price: 800 },
    frame: { ring: 'conic-gradient(#4c1d95, #0b0114, #7c3aed, #05010a, #4c1d95)', glow: '0 0 13px 0 rgba(124,58,237,0.6)', pulse: true } },
  { id: 'bd_fire', collection: 'col_inferno',     type: 'border', name: 'Flame',         rarity: 'epic',      source: { type: 'level', level: 18 },
    frame: { ring: 'conic-gradient(#fed7aa, #f97316, #dc2626, #f97316, #fed7aa)', glow: '0 0 14px 0 rgba(249,115,22,0.7)', pulse: true } },
  { id: 'bd_gold',     type: 'border', name: 'Royal Gold',    rarity: 'legendary', source: { type: 'shop', price: 2000 },
    frame: { ring: 'conic-gradient(#fff3c4, #ffcb45, #a85800, #ffcb45, #fff3c4, #e08e05, #fff3c4)', glow: '0 0 15px 0 rgba(255,180,60,0.75)', spin: true, sparkle: true } },
  { id: 'bd_diamond',  type: 'border', name: 'Diamond',       rarity: 'legendary', source: { type: 'level', level: 35 },
    frame: { ring: 'conic-gradient(#ffffff, #bae6fd, #7dd3fc, #ffffff, #e0f2fe, #ffffff)', glow: '0 0 15px 0 rgba(186,230,253,0.8)', spin: true, sparkle: true } },
  { id: 'bd_champion', collection: 'col_founder', type: 'border', name: 'Champion',      rarity: 'legendary', source: { type: 'challenge' },
    frame: { ring: 'conic-gradient(#ffcb45, #9d5cff, #ffcb45, #9d5cff, #ffcb45)', glow: '0 0 15px 0 rgba(255,203,69,0.7)', spin: true, sparkle: true } },
  { id: 'bd_royal', collection: 'col_royal',    type: 'border', name: 'Regalia',       rarity: 'legendary', source: { type: 'shop', price: 2000 },
    frame: { ring: 'conic-gradient(#ffcb45, #6d28d9 25%, #ffe9a8 50%, #4c1d95 75%, #ffcb45)', glow: '0 0 15px 0 rgba(157,92,255,0.7)', spin: true, sparkle: true } },
  { id: 'bd_dragonscale', collection: 'col_dragon', type: 'border', name: 'Dragonscale', rarity: 'mythic',   source: { type: 'shop', price: 5000 },
    frame: { ring: 'conic-gradient(#6ee7b7, #065f46 20%, #a7f3d0 40%, #047857 60%, #ffd36b 80%, #6ee7b7)', glow: '0 0 16px 1px rgba(52,211,153,0.75)', spin: true, pulse: true, sparkle: true } },
  { id: 'bd_mythic',   type: 'border', name: 'Rainbow Aura',  rarity: 'mythic',    source: { type: 'shop', price: 5000 },
    frame: { ring: 'conic-gradient(#ff8bd8, #ffd36b, #7dffa8, #7db9ff, #c98bff, #ff8bd8)', glow: '0 0 18px 1px rgba(232,121,249,0.8)', spin: true, pulse: true, sparkle: true } },
];

export const TITLES = [
  { id: 't_rookie',    type: 'title', name: 'Rookie',           rarity: 'common',    source: { type: 'starter' } },
  { id: 't_guesser',   type: 'title', name: 'Quick Guesser',    rarity: 'common',    source: { type: 'level', level: 2 } },
  { id: 't_bluffer',   type: 'title', name: 'Master Bluffer',   rarity: 'rare',      source: { type: 'shop', price: 300 } },
  { id: 't_lucky',     type: 'title', name: 'Lucky Guesser',    rarity: 'rare',      source: { type: 'level', level: 8 } },
  { id: 't_truthseeker', type: 'title', name: 'Truth Seeker',   rarity: 'rare',      source: { type: 'shop', price: 300 } },
  { id: 't_sleuth',    type: 'title', name: 'Sharp Sleuth',     rarity: 'rare',      source: { type: 'level', level: 4 } },
  { id: 't_mind',      type: 'title', name: 'Mind Reader',      rarity: 'epic',      source: { type: 'shop', price: 800 } },
  { id: 't_untouch',   type: 'title', name: 'The Untouchable',  rarity: 'epic',      source: { type: 'level', level: 15 } },
  { id: 't_elite',     type: 'title', name: 'Elite',            rarity: 'epic',      source: { type: 'level', level: 22 } },
  { id: 't_explorer',  type: 'title', name: 'World Explorer',   rarity: 'epic',      source: { type: 'shop', price: 800 } },
  { id: 't_legend',    type: 'title', name: 'Living Legend',    rarity: 'legendary', source: { type: 'shop', price: 2000 } },
  { id: 't_guessmstr', type: 'title', name: 'Guess Master',     rarity: 'legendary', source: { type: 'level', level: 28 } },
  { id: 't_myth',      type: 'title', name: 'Myth Hunter',      rarity: 'mythic',    source: { type: 'shop', price: 5000 } },
  { id: 't_founder', collection: 'col_founder',   type: 'title', name: 'Founder',          rarity: 'mythic',    source: { type: 'challenge' } },
];

// Name styles — rendering classes live in index.css (.name-*).
export const NAME_COLORS = [
  { id: 'nc_default',  type: 'nameColor', name: 'Classic',       rarity: 'common',    source: { type: 'starter' },           cls: 'text-white' },
  { id: 'nc_violet',   type: 'nameColor', name: 'Violet',        rarity: 'common',    source: { type: 'shop', price: 100 },  cls: 'text-violet-300' },
  { id: 'nc_sky', collection: 'col_winter',      type: 'nameColor', name: 'Ice',           rarity: 'rare',      source: { type: 'shop', price: 300 },  cls: 'name-ice' },
  { id: 'nc_emerald',  type: 'nameColor', name: 'Emerald',       rarity: 'rare',      source: { type: 'shop', price: 300 },  cls: 'name-emerald' },
  { id: 'nc_neon', collection: 'col_cyber',     type: 'nameColor', name: 'Neon',          rarity: 'epic',      source: { type: 'shop', price: 800 },  cls: 'name-neon' },
  { id: 'nc_gold', collection: 'col_royal',     type: 'nameColor', name: 'Gold',          rarity: 'legendary', source: { type: 'level', level: 12 },  cls: 'name-gold' },
  { id: 'nc_fire', collection: 'col_inferno',     type: 'nameColor', name: 'Fire Glow',     rarity: 'legendary', source: { type: 'shop', price: 2000 }, cls: 'name-fire' },
  { id: 'nc_champion', type: 'nameColor', name: 'Champion Glow', rarity: 'legendary', source: { type: 'shop', price: 2000 }, cls: 'name-champion' },
  { id: 'nc_mythic',   type: 'nameColor', name: 'Rainbow',       rarity: 'mythic',    source: { type: 'shop', price: 5000 }, cls: 'name-rainbow' },
  { id: 'nc_sakura',   type: 'nameColor', name: 'Rose Gold',     rarity: 'epic',      source: { type: 'shop', price: 800 },  cls: 'name-rosegold', collection: 'col_sakura' },
  { id: 'nc_celestial',type: 'nameColor', name: 'Celestial',     rarity: 'epic',      source: { type: 'shop', price: 800 },  cls: 'name-celestial', collection: 'col_galaxy' },
  // Collection completion rewards — never sold, only earned.
  { id: 'nc_founder',  type: 'nameColor', name: 'Founder Glow',  rarity: 'mythic',    source: { type: 'reward' }, cls: 'name-founder' },
];

// Completion-reward titles (source 'reward' — granted when a collection is
// finished, never purchasable).
export const REWARD_TITLES = [
  { id: 't_hanami',     type: 'title', name: 'Hanami Spirit', rarity: 'epic',      source: { type: 'reward' } },
  { id: 't_dragontamer',type: 'title', name: 'Dragon Tamer',  rarity: 'mythic',    source: { type: 'reward' } },
  { id: 't_chosen',     type: 'title', name: 'Chosen One',    rarity: 'mythic',    source: { type: 'reward' } },
  { id: 't_puzzleking', type: 'title', name: 'Puzzle King',   rarity: 'legendary', source: { type: 'reward' } },
  { id: 't_frostwalker',type: 'title', name: 'Frost Walker',  rarity: 'epic',      source: { type: 'reward' } },
  { id: 't_neonrunner', type: 'title', name: 'Neon Runner',   rarity: 'epic',      source: { type: 'reward' } },
  { id: 't_reborn',     type: 'title', name: 'Reborn',        rarity: 'legendary', source: { type: 'reward' } },
];

// Collectible collections — matching sets across cosmetic types. Completing
// one grants an exclusive reward. Founder is limited to Season 1 forever.
export const COLLECTIONS = [
  { id: 'col_founder', name: 'Founder',  emoji: '🏆', cover: 'bn_gold',   reward: 'nc_founder',   limited: true,
    lore: 'Season 1 only. These will never return.' },
  { id: 'col_sakura',  name: 'Sakura',   emoji: '🌸', cover: 'bn_sakura', reward: 't_hanami',
    lore: 'Petals fall for those who notice.' },
  { id: 'col_dragon',  name: 'Dragon',   emoji: '🐉', cover: 'bn_dragon', reward: 't_dragontamer',
    lore: 'Old scales keep older secrets.' },
  { id: 'col_galaxy',  name: 'Galaxy',   emoji: '🌌', cover: 'bn_galaxy', reward: 't_chosen',
    lore: 'Somewhere out there, your word is hiding.' },
  { id: 'col_royal',   name: 'Royal',    emoji: '👑', cover: 'bn_royal',  reward: 't_puzzleking',
    lore: 'Crowns are earned one guess at a time.' },
  { id: 'col_winter',  name: 'Winter',   emoji: '❄️', cover: 'bn_winter', reward: 't_frostwalker',
    lore: 'Cold hands, warm streaks.' },
  { id: 'col_cyber',   name: 'Cyber',    emoji: '⚡', cover: 'bn_cyber',  reward: 't_neonrunner',
    lore: 'The city never stops guessing.' },
  { id: 'col_inferno', name: 'Inferno',  emoji: '🔥', cover: 'bn_ember',  reward: 't_reborn',
    lore: 'Rise. Burn. Guess again.' },
];

// Illustrated emblem art — drop `<id>.webp` into src/assets/emblems/ and the
// matching emblem renders the artwork on a dark disc inside its rarity rim
// instead of the emoji (see EmblemTile). Entries without a file keep the
// emoji path untouched, so the set can grow one file at a time.
const EMBLEM_ART = import.meta.glob('../assets/emblems/*.webp', { eager: true, import: 'default' });
for (const e of EMBLEMS) {
  const art = EMBLEM_ART[`../assets/emblems/${e.id}.webp`];
  if (art) e.art = art;
}

export const ALL_COSMETICS = [...EMBLEMS, ...BANNERS, ...BORDERS, ...TITLES, ...REWARD_TITLES, ...NAME_COLORS];

const byId = Object.fromEntries(ALL_COSMETICS.map(c => [c.id, c]));
export function cosmeticById(id) { return byId[id] || null; }

// Highest rarity among a player's equipped cosmetics — drives the overall
// presentation of their profile card (ring, glow), so a Legendary loadout
// reads as Legendary before you read a single word.
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];
export function topEquippedRarity(equipped) {
  let best = 'common';
  for (const id of Object.values(equipped || {})) {
    const c = byId[id];
    if (c && RARITY_ORDER.indexOf(c.rarity) > RARITY_ORDER.indexOf(best)) best = c.rarity;
  }
  return best;
}

export const STARTER_OWNED = ALL_COSMETICS.filter(c => c.source.type === 'starter').map(c => c.id);

export const DEFAULT_EQUIPPED = {
  emblem: 'em_detective',
  banner: 'bn_midnight',
  border: 'bd_none',
  title: 't_rookie',
  nameColor: 'nc_default',
};

export function collectionItems(colId) {
  return ALL_COSMETICS.filter(c => c.collection === colId);
}
export function collectionProgress(colId, owned) {
  const items = collectionItems(colId);
  const have = items.filter(i => (owned || []).includes(i.id)).length;
  return { have, total: items.length };
}

export function levelUnlocks(level) {
  return ALL_COSMETICS.filter(c => c.source.type === 'level' && c.source.level === level);
}

// Grids always list common → rare → epic → legendary → mythic.
const RARITY_RANK = Object.fromEntries(Object.keys(RARITIES).map((r, i) => [r, i]));
export function sortByRarity(items) {
  return [...items].sort((a, b) => (RARITY_RANK[a.rarity] ?? 9) - (RARITY_RANK[b.rarity] ?? 9));
}

export const TYPE_LABELS = {
  emblem: 'Emblems', banner: 'Banners', border: 'Borders',
  title: 'Titles', nameColor: 'Name Colors',
};
