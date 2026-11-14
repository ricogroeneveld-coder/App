# App Store screenshots — What's My Pick!

Made following Apple's [asset best practices](https://developer.apple.com/app-store/asset-best-practices/)
and [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications):
real app UI (no mock-ups), one short headline per image, a story from
first look to collecting, no prices / URLs / awards / other platforms, 4+
safe, and localized for every language the app supports (EN + NL).

## What's here

| Folder | Pixels | App Store Connect slot | Needed? |
|---|---|---|---|
| `*/iphone-6.9in_1320x2868/` | 1320 × 2868 | iPhone — Dynamic Island, large display (6.9") | **Required.** App Store Connect scales it down for smaller iPhones. |
| `*/ipad-13in_2064x2752/` | 2064 × 2752 | iPad 13" | **Required** (the app runs on iPad). |
| `*/iphone-duo-outer_1398x2034/` | 1398 × 2034 | iPhone Duo — outer display | Shows the "made for iPhone Duo" badge. Required from April 2027 for builds made with the iOS 27.1 SDK or later. |
| `*/iphone-duo-inner_2853x2007/` | 2853 × 2007 (landscape) | iPhone Duo — inner display | Same as above. |

`en/` = English (U.S.) listing, `nl/` = Dutch listing. JPEG, RGB, no
transparency (App Store Connect rejects alpha channels).

## Order (upload in this order — it tells the story)

| # | File | EN headline | NL headline |
|---|---|---|---|
| 1 | `1-home.jpg` | Guess what your **friends** picked | Raad wat je **vrienden** kozen |
| 2 | `2-word.jpg` | Pick your **secret word** | Kies je **geheime woord** |
| 3 | `3-questions.jpg` | Ask sharp **yes/no** questions | Stel slimme **ja/nee**-vragen |
| 4 | `4-notebook.jpg` | Every clue in your **notebook** | Elke aanwijzing in je **notitieboek** |
| 5 | `5-lobby.jpg` | Practice anytime against **bots** | Oefen altijd tegen **bots** |
| 6 | `6-shop.jpg` | Unlock **banners** & emblems | Ontgrendel **banners** en emblemen |

The first three are the ones that can show in search results, so they
carry the core loop (what the game is, pick a word, ask questions).

## Uploading

App Store Connect → your app → the version → **App Store** tab →
*Previews and Screenshots* → pick the language (top-right) → drag each
folder's six images into the matching device slot, in the order above.

## Regenerating (after a UI change)

The images are real captures of the app: `tools/capture.js` drives a
practice match against the bots in a headless browser at each device's
exact size (simulating the iOS shell and the Duo's status-bar strip), and
`tools/compose.js` adds the background and headline.

```bash
# 1. run the app locally (dummy Supabase values are fine)
VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=dummy npx vite --port 5179
# 2. in another terminal, from this folder
node tools/capture.js en iphone raw/en && node tools/capture.js en ipad raw/en
node tools/capture.js nl iphone raw/nl && node tools/capture.js nl ipad raw/nl
node tools/compose.js raw/en en out/en && node tools/compose.js raw/nl nl out/nl
```

Then convert `out/` to RGB JPEG (no alpha) at the folder names above.
Needs Playwright with Chromium and the Inter / Inter Display fonts.

## Not included (yet)

- **App icon (Liquid Glass):** Apple recommends layered icons made in
  Icon Composer, which runs on a Mac only.
- **App previews (video, up to 3):** optional.
- **Creative assets (product page header, search results card):**
  optional, shown on iOS 27 and later.
