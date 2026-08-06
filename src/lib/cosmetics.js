// Cosmetic catalog — everything a player can own and equip. Purely visual,
// never gameplay. Each item: { id, type, name, rarity, source }.
// source: { type: 'starter' } owned by everyone
//         { type: 'shop', price } purchasable with Picks
//         { type: 'level', level } auto-granted at that level
//         { type: 'challenge' } granted by season challenges
// Emblems are emoji on a gradient tile; banners are CSS gradients; borders
// are ring/glow treatments around the avatar; titles and name colors are
// text styling. All styling reuses the game's existing material language.

export const RARITIES = {
  common:    { label: 'Common',    ring: 'ring-slate-400/40',  text: 'text-slate-300',
               chip: 'bg-slate-500/20 text-slate-300 ring-1 ring-slate-400/30' },
  rare:      { label: 'Rare',      ring: 'ring-sky-400/50',    text: 'text-sky-300',
               chip: 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/40' },
  epic:      { label: 'Epic',      ring: 'ring-violet-400/60', text: 'text-violet-300',
               chip: 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-400/40' },
  legendary: { label: 'Legendary', ring: 'ring-amber-400/70',  text: 'text-amber-300',
               chip: 'bg-gradient-to-b from-[#ffcb45] to-[#e08e05] text-[#2c1500]' },
  mythic:    { label: 'Mythic',    ring: 'ring-fuchsia-400/70', text: 'text-fuchsia-300',
               chip: 'bg-gradient-to-b from-fuchsia-400 to-purple-700 text-white' },
};

const TILE = {
  slate:  'linear-gradient(180deg, #2b3245 0%, #141824 100%)',
  violet: 'linear-gradient(180deg, #2a1150 0%, #0d0620 100%)',
  sky:    'linear-gradient(180deg, #0a2233 0%, #040d16 100%)',
  green:  'linear-gradient(180deg, #062217 0%, #020c08 100%)',
  gold:   'linear-gradient(180deg, #3a2400 0%, #1a0f00 100%)',
  rose:   'linear-gradient(180deg, #3b0a1e 0%, #16030b 100%)',
};

export const EMBLEMS = [
  { id: 'em_detective', type: 'emblem', name: 'Detective',    emoji: '🕵️', tile: TILE.violet, rarity: 'common',    source: { type: 'starter' } },
  { id: 'em_card',      type: 'emblem', name: 'Wild Card',    emoji: '🃏', tile: TILE.violet, rarity: 'common',    source: { type: 'starter' } },
  { id: 'em_dice',      type: 'emblem', name: 'High Roller',  emoji: '🎲', tile: TILE.slate,  rarity: 'common',    source: { type: 'shop', price: 100 } },
  { id: 'em_ghost',     type: 'emblem', name: 'Ghost',        emoji: '👻', tile: TILE.slate,  rarity: 'common',    source: { type: 'shop', price: 100 } },
  { id: 'em_fox',       type: 'emblem', name: 'Sly Fox',      emoji: '🦊', tile: TILE.rose,   rarity: 'common',    source: { type: 'shop', price: 100 } },
  { id: 'em_alien',     type: 'emblem', name: 'Visitor',      emoji: '👽', tile: TILE.green,  rarity: 'rare',      source: { type: 'shop', price: 300 } },
  { id: 'em_ninja',     type: 'emblem', name: 'Shadow',       emoji: '🥷', tile: TILE.slate,  rarity: 'rare',      source: { type: 'shop', price: 300 } },
  { id: 'em_owl',       type: 'emblem', name: 'Night Owl',    emoji: '🦉', tile: TILE.violet, rarity: 'rare',      source: { type: 'shop', price: 300 } },
  { id: 'em_brain',     type: 'emblem', name: 'Mastermind',   emoji: '🧠', tile: TILE.rose,   rarity: 'rare',      source: { type: 'level', level: 5 } },
  { id: 'em_wizard',    type: 'emblem', name: 'Word Wizard',  emoji: '🧙', tile: TILE.violet, rarity: 'epic',      source: { type: 'shop', price: 800 } },
  { id: 'em_dragon',    type: 'emblem', name: 'Dragon',       emoji: '🐉', tile: TILE.green,  rarity: 'epic',      source: { type: 'shop', price: 800 } },
  { id: 'em_crystal',   type: 'emblem', name: 'Oracle',       emoji: '🔮', tile: TILE.violet, rarity: 'epic',      source: { type: 'level', level: 10 } },
  { id: 'em_crown',     type: 'emblem', name: 'Royalty',      emoji: '👑', tile: TILE.gold,   rarity: 'legendary', source: { type: 'shop', price: 2000 } },
  { id: 'em_trophy',    type: 'emblem', name: 'Champion',     emoji: '🏆', tile: TILE.gold,   rarity: 'legendary', source: { type: 'level', level: 20 } },
  { id: 'em_phoenix',   type: 'emblem', name: 'Phoenix',      emoji: '🔥', tile: TILE.rose,   rarity: 'mythic',    source: { type: 'shop', price: 5000 } },
  { id: 'em_galaxy',    type: 'emblem', name: 'Cosmic Mind',  emoji: '🌌', tile: TILE.violet, rarity: 'mythic',    source: { type: 'challenge' } },
];

export const BANNERS = [
  { id: 'bn_midnight', type: 'banner', name: 'Midnight',      rarity: 'common',    source: { type: 'starter' },
    css: 'linear-gradient(120deg, #1c0b3a 0%, #0d0620 100%)' },
  { id: 'bn_slate',    type: 'banner', name: 'Slate',         rarity: 'common',    source: { type: 'shop', price: 100 },
    css: 'linear-gradient(120deg, #2b3245 0%, #10131c 100%)' },
  { id: 'bn_ocean',    type: 'banner', name: 'Deep Ocean',    rarity: 'rare',      source: { type: 'shop', price: 300 },
    css: 'linear-gradient(120deg, #0a2a44 0%, #071726 55%, #040d16 100%)' },
  { id: 'bn_forest',   type: 'banner', name: 'Forest Night',  rarity: 'rare',      source: { type: 'shop', price: 300 },
    css: 'linear-gradient(120deg, #0d3624 0%, #062217 55%, #02130b 100%)' },
  { id: 'bn_nebula',   type: 'banner', name: 'Nebula',        rarity: 'epic',      source: { type: 'shop', price: 800 },
    css: 'linear-gradient(120deg, #3b0f8f 0%, #1c0b3a 45%, #6d28d9 100%)' },
  { id: 'bn_ember',    type: 'banner', name: 'Ember',         rarity: 'epic',      source: { type: 'level', level: 8 },
    css: 'linear-gradient(120deg, #7c2d12 0%, #3b0a1e 55%, #16030b 100%)' },
  { id: 'bn_gold',     type: 'banner', name: 'Gilded',        rarity: 'legendary', source: { type: 'shop', price: 2000 },
    css: 'linear-gradient(120deg, #a85800 0%, #3a2400 55%, #1a0f00 100%)' },
  { id: 'bn_aurora',   type: 'banner', name: 'Aurora',        rarity: 'mythic',    source: { type: 'level', level: 30 },
    css: 'linear-gradient(120deg, #6d28d9 0%, #0e7490 40%, #065f46 75%, #1c0b3a 100%)' },
];

export const BORDERS = [
  { id: 'bd_none',   type: 'border', name: 'Standard',    rarity: 'common',    source: { type: 'starter' },
    shadow: 'none', ringColor: 'rgba(255,255,255,0.15)' },
  { id: 'bd_violet', type: 'border', name: 'Violet Ring', rarity: 'common',    source: { type: 'shop', price: 100 },
    shadow: '0 0 10px -2px rgba(157,92,255,0.7)', ringColor: 'rgba(157,92,255,0.8)' },
  { id: 'bd_sky',    type: 'border', name: 'Ice Ring',    rarity: 'rare',      source: { type: 'shop', price: 300 },
    shadow: '0 0 10px -2px rgba(56,189,248,0.7)', ringColor: 'rgba(56,189,248,0.8)' },
  { id: 'bd_emerald',type: 'border', name: 'Emerald Ring',rarity: 'rare',      source: { type: 'level', level: 6 },
    shadow: '0 0 10px -2px rgba(52,211,153,0.7)', ringColor: 'rgba(52,211,153,0.8)' },
  { id: 'bd_gold',   type: 'border', name: 'Golden Ring', rarity: 'legendary', source: { type: 'shop', price: 2000 },
    shadow: '0 0 14px -2px rgba(255,180,60,0.8)', ringColor: 'rgba(255,203,69,0.9)' },
  { id: 'bd_mythic', type: 'border', name: 'Mythic Aura', rarity: 'mythic',    source: { type: 'shop', price: 5000 },
    shadow: '0 0 16px -2px rgba(232,121,249,0.9)', ringColor: 'rgba(232,121,249,0.9)', animated: true },
];

export const TITLES = [
  { id: 't_rookie',    type: 'title', name: 'Rookie',           rarity: 'common',    source: { type: 'starter' } },
  { id: 't_guesser',   type: 'title', name: 'Quick Guesser',    rarity: 'common',    source: { type: 'shop', price: 100 } },
  { id: 't_bluffer',   type: 'title', name: 'Master Bluffer',   rarity: 'rare',      source: { type: 'shop', price: 300 } },
  { id: 't_sleuth',    type: 'title', name: 'Sharp Sleuth',     rarity: 'rare',      source: { type: 'level', level: 4 } },
  { id: 't_mind',      type: 'title', name: 'Mind Reader',      rarity: 'epic',      source: { type: 'shop', price: 800 } },
  { id: 't_untouch',   type: 'title', name: 'The Untouchable',  rarity: 'epic',      source: { type: 'level', level: 15 } },
  { id: 't_legend',    type: 'title', name: 'Living Legend',    rarity: 'legendary', source: { type: 'shop', price: 2000 } },
  { id: 't_founder',   type: 'title', name: 'Founder',          rarity: 'mythic',    source: { type: 'challenge' } },
];

export const NAME_COLORS = [
  { id: 'nc_default', type: 'nameColor', name: 'Classic',  rarity: 'common',    source: { type: 'starter' }, cls: 'text-white' },
  { id: 'nc_violet',  type: 'nameColor', name: 'Violet',   rarity: 'common',    source: { type: 'shop', price: 100 }, cls: 'text-violet-300' },
  { id: 'nc_sky',     type: 'nameColor', name: 'Ice',      rarity: 'rare',      source: { type: 'shop', price: 300 }, cls: 'text-sky-300' },
  { id: 'nc_gold',    type: 'nameColor', name: 'Gold',     rarity: 'legendary', source: { type: 'level', level: 12 },
    cls: 'text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500' },
  { id: 'nc_mythic',  type: 'nameColor', name: 'Prism',    rarity: 'mythic',    source: { type: 'shop', price: 5000 },
    cls: 'text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 via-violet-300 to-sky-300' },
];

export const ALL_COSMETICS = [...EMBLEMS, ...BANNERS, ...BORDERS, ...TITLES, ...NAME_COLORS];

const byId = Object.fromEntries(ALL_COSMETICS.map(c => [c.id, c]));
export function cosmeticById(id) { return byId[id] || null; }

export const STARTER_OWNED = ALL_COSMETICS.filter(c => c.source.type === 'starter').map(c => c.id);

export const DEFAULT_EQUIPPED = {
  emblem: 'em_detective',
  banner: 'bn_midnight',
  border: 'bd_none',
  title: 't_rookie',
  nameColor: 'nc_default',
};

export function levelUnlocks(level) {
  return ALL_COSMETICS.filter(c => c.source.type === 'level' && c.source.level === level);
}

export const TYPE_LABELS = {
  emblem: 'Emblems', banner: 'Banners', border: 'Borders',
  title: 'Titles', nameColor: 'Name Colors',
};
