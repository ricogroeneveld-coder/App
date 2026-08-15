# Social assets

## Instagram story — "how it works" (1080 × 1920)

- `instagram-story-how-to-play-nl.png` — Dutch
- `instagram-story-how-to-play-en.png` — English

A one-story explainer for **What's My Pick!**. Content sits inside the
Instagram safe area (≈210 px from the top, ≈200 px from the bottom), so the
profile header and the reply bar don't cover anything.

The five steps are a condensed version of the in-app How to Play sheet
(`howToPlaySteps` in `src/lib/LanguageContext.jsx`) — keep them in sync when
either changes.

The worked example says **"Categorie Pets"** on purpose: category names are not
translated in the app, so that is genuinely what a Dutch player sees. Only the
secret words themselves are localised.

### Regenerating

`build-story.mjs` holds the copy for both languages and inlines `logo.webp` as
a data URI, so the generated HTML is fully self-contained — open it in any
browser to preview or tweak.

```bash
cd docs/social
for L in en nl; do
  node build-story.mjs $L instagram-story-how-to-play-$L.html
  chromium --headless --window-size=1080,1920 --force-device-scale-factor=1 \
           --hide-scrollbars --virtual-time-budget=2000 \
           --screenshot=instagram-story-how-to-play-$L.png \
           file://$PWD/instagram-story-how-to-play-$L.html
done
```

### Suggested sticker / caption text

**Dutch** — story text, if you'd rather type it over the image:

> Iedereen kiest stiekem een woord. Stel ja/nee-vragen. Wie het eerst raadt, wint 🕵️

Link sticker label: **Gratis spelen**

Feed or Reel-cover caption:

> Nieuwe vaste prik voor spelletjesavond 🕵️ **What's My Pick!**
> Iedereen kiest stiekem een woord uit dezelfde categorie. Daarna stel je om
> de beurt ja/nee-vragen tot iemand het kraakt. Elk antwoord wordt
> automatisch als aanwijzing opgeslagen — pen en papier niet nodig.
> 2–12 spelers · gratis · geen account nodig.
> #spelletjesavond #partyspel #raadspel #20vragen #mobilegame

**English** — story text:

> Everyone picks a secret word. Ask yes/no questions. First to guess wins 🕵️

Link sticker label: **Play free**

Feed or Reel-cover caption:

> New game night fix 🕵️ **What's My Pick!**
> Everyone secretly picks a word from the same category, then you take turns
> asking yes/no questions until someone cracks it. Every answer is saved as a
> clue for you automatically — no pen and paper needed.
> 2–12 players · free · no account needed.
> #partygame #gamenight #20questions #guessinggame #mobilegame
