# Banner Art Brief — 25 illustrated banner scenes

The app currently draws banners as CSS gradients with floating emoji. This
brief replaces them with painted scene artwork, the same way the 27 emblems
were upgraded. The app supplies everything around the art (player name,
title, dark text-overlay gradients, rarity ring on cards) — the image is
ONLY the background scene.

## Format rules (every image)

- **1536×512 PNG (3:1 landscape), full-bleed scene** — no transparency, no
  borders, no frame, no text, no watermark, no logo
- One cohesive painted scene per banner; same rendering style as the emblem
  set: soft glossy mobile-game illustration, clean shapes, gentle painted
  shading, subtle sparkle accents
- **Main subject on the RIGHT third of the image.** The app overlays the
  player's avatar, name and title on the LEFT side, and album labels in the
  bottom-left — keep those areas calm (sky, gradient, soft pattern only)
- **Darker toward the bottom edge** so white overlay text always stays
  readable
- **Crop-safe:** banners display at several aspect ratios (wide lobby rows,
  shorter profile cards, small album covers). Keep everything important
  inside the middle 80% of the height and away from the far corners —
  the edges may be cropped or faded on some screens
- Consistent light direction and palette discipline across the whole set —
  it must read as ONE collection
- Rarity = richness: commons stay simple and quiet; epic adds glow and
  atmosphere; legendary/mythic get dramatic lighting, particles, and gold
  accents (the app additionally animates a light sweep over legendary and
  mythic banners — leave room for it to read: avoid pure-white hotspots)

## Base prompt template

> Wide 3:1 painted fantasy banner background for a mobile party game, soft
> glossy mobile-game illustration style, clean shapes, gentle painted
> shading, subtle sparkles, [SCENE], main subject on the right third,
> calm simple area on the left, scene darkens toward the bottom edge,
> no text, no logo, no border, no frame

## The 25 scenes (filename = banner id)

| # | File | Name | Rarity | Scene |
|---|------|------|--------|-------|
| 1 | bn_midnight.png | Midnight | Common | Quiet violet night sky, deep purple gradient (#241052 → #0a0518), a few tiny white stars, no subject — pure calm sky |
| 2 | bn_clouds.png | Daydream | Common | Soft dreamy daytime sky: powder blue into lavender into warm pink, two or three fluffy white clouds drifting on the right |
| 3 | bn_slate.png | Steel | Common | Brushed dark steel surface, blue-grey (#39435c → #0e1220), subtle diagonal machined streaks of light, industrial and minimal |
| 4 | bn_royal.png | Royal Purple | Common | Regal deep-violet hall glow (#4c1d95 → #12062b), soft light falling from above, one small golden crown resting on the right |
| 5 | bn_ice.png | Frostbite | Rare | Frozen blue expanse (#7dd3fc → #0c2247), drifting snowflakes, one large ornate snowflake on the right, frosty sparkle |
| 6 | bn_pixel.png | Pixel Party | Rare | Retro arcade night in purples (#7c3aed → #17073a), faint pixel-grid texture, a cute pixel alien invader on the right, a small joystick lower left-of-center |
| 7 | bn_candy.png | Candy Pop | Rare | Sweet diagonal candy-stripe world, pink into purple (#ff7eb9 → #6d4ad1), a wrapped candy and a lollipop on the right, sugary sparkle |
| 8 | bn_storm.png | Thunderhead | Rare | Brooding storm sky, slate blue-grey (#3c4a6b → #0b0f22), heavy cloud, one bright lightning bolt striking on the right |
| 9 | bn_ocean.png | Deep Ocean | Rare | Deep underwater blue (#0e5f8f → #041627), light rays from above, rising bubbles, one small tropical fish swimming on the right |
| 10 | bn_forest.png | Forest Night | Rare | Dark enchanted forest greens (#14532d → #02130b), fireflies, a drifting leaf and a small glowing butterfly on the right |
| 11 | bn_sakura.png | Cherry Blossom | Epic | Pink blossom evening (#ff9ecb → #4e1436), a blossom branch entering from the right, petals drifting across the whole width |
| 12 | bn_neon.png | Neon City | Epic | Night city skyline silhouette at the bottom, magenta neon glow rising from the left horizon and cyan from the right, dark purple sky (#140a2e), faint scanline texture |
| 13 | bn_nebula.png | Nebula | Epic | Swirling purple-fuchsia nebula clouds (#4c1d95 → #6d28d9), dense tiny stars, one bright sparkle flare on the right |
| 14 | bn_cyber.png | Cyberline | Epic | Dark navy tech world (#0f1b33 → #05070f), thin cyan circuit lines, cool cyan under-glow, a cute robot head and a small gear on the right |
| 15 | bn_crystal.png | Crystal Cave | Epic | Violet crystal cavern (#6d28d9 → #170a33), glowing purple gem clusters on the right, magical pink light haze, floating sparkles |
| 16 | bn_ember.png | Ember | Epic | Smoldering dark furnace (#7c2d12 → #16030b), warm orange glow rising from below, floating ember particles, one flame flicker on the right |
| 17 | bn_temple.png | Ancient Temple | Legendary | Golden ancient temple at dusk (#7a4a12 → #170d02), red torii gate on the right, a paper lantern glowing softly left-of-center, gold dust in the air |
| 18 | bn_gold.png | Gilded | Legendary | Pure luxury: molten gold light on near-black (#b06104 → #1a0f00), drifting gold particles, one four-point gold star sparkle on the right |
| 19 | bn_galaxy.png | Galaxy | Legendary | Deep space vista (#1e1b4b → #050213), rich starfield, violet nebula haze, a ringed planet on the right |
| 20 | bn_spooky.png | Spooky Night | Legendary | Halloween night, purple sky (#2e1065 → #0a0316) with an orange moonglow upper right, a grinning jack-o'-lantern on the right, a tiny ghost and bat in the sky |
| 21 | bn_winter.png | Winter Wonder | Legendary | Festive winter night, teal (#164e63 → #041521), falling snow, a decorated pine tree on the right, a small snowman left-of-center |
| 22 | bn_beta.png | The Workshop | Legendary | Secret inventor's workshop in deep emerald green (#14532d → #01130a), warm gold light from above, a golden wrench and gear on the right with green gem accents — MUST match the gold-and-emerald style of the em_wrench emblem, floating gold sparkles |
| 23 | bn_dragon.png | Dragon Realm | Mythic | Mythic emerald realm (#064e3b → #01120c), green mist, a majestic jade-and-gold dragon coiling in from the right, gold sparkle accents |
| 24 | bn_aurora.png | Aurora | Mythic | Arctic night sky (#312e81 → #060318), flowing aurora curtains in green and cyan filling the sky, stars, snow-covered horizon line low in frame |
| 25 | bn_rainbow.png | Rainbow Road | Mythic | Dreamlike night sky (#1e1b4b) crossed by a soft glowing rainbow ribbon flowing from left to upper right, pastel light bands, star sparkles |

## Delivery

- One PNG per banner, filename exactly as listed (e.g. `bn_midnight.png`)
- Generate in batches and review against the set for style drift before
  continuing — consistency beats individual brilliance
- Conversion to webp and wiring into the app is scripted on our side; the
  renderer falls back to the current CSS scene for any banner without a
  file, so the set can ship one image at a time
