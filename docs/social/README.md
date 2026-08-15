# Social assets

## `instagram-story-how-to-play.png` — 1080 × 1920

A one-story "how it works" explainer for **What's My Pick!**. Content sits
inside the Instagram safe area (≈210 px from the top, ≈200 px from the
bottom), so the profile header and the reply bar don't cover anything.

The rules shown match the in-app How to Play sheet
(`howToPlaySteps` in `src/lib/LanguageContext.jsx`), condensed to five steps.

### Regenerating

```bash
node docs/social/build-story.js /tmp/story.html
chromium --headless --window-size=1080,1920 --force-device-scale-factor=1 \
         --hide-scrollbars --screenshot=story.png file:///tmp/story.html
```

`build-story.js` inlines `logo.webp` as a data URI, so the generated HTML is
fully self-contained — open it in any browser to preview or tweak.

### Suggested caption / sticker text

Story text (if you'd rather type it over the image):

> Everyone picks a secret word. Ask yes/no questions. First to guess wins 🕵️

Link sticker label: **Play free**

If you cross-post it to the feed or a Reel cover, this caption works:

> New game night fix 🕵️ **What's My Pick!**
> Everyone secretly picks a word from the same category, then you take turns
> asking yes/no questions until someone cracks it. Every answer is saved as a
> clue for you automatically — no pen and paper needed.
> 2–12 players · free · no account needed.
> #partygame #gamenight #20questions #guessinggame #mobilegame
