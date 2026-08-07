# App Store Submission Guide — What's My Pick!

The web app is compliance-ready. This checklist covers the native wrapper and
App Store Connect setup that must happen outside this repository.

## 1. Wrap with Capacitor — ✅ DONE (checked into the repo)

The `ios/` folder is a ready Xcode project (Capacitor 8, Swift Package
Manager — **no CocoaPods needed**). Already configured:

- Bundle ID `com.whatsmypick.app`, display name "What's My Pick!"
- Portrait-only, forced dark UI, dark launch screen (`#07040f`)
- App icon generated from `logo.webp` (replace
  `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
  with final art anytime — 1024×1024, no transparency)
- `ITSAppUsesNonExemptEncryption=false` (skips the TestFlight export
  compliance question — the app only uses HTTPS)

On your Mac (needs Xcode 16+):

```bash
npm install
npm run ios          # builds the web app + syncs it into ios/
npx cap open ios     # opens Xcode
```

In Xcode, the only remaining setup is **Signing & Capabilities**: pick
your Apple Developer team, then archive/upload as usual. Xcode resolves
the Capacitor Swift packages automatically on first open.

## 2. In-App Purchases (packs are real-money → Apple IAP only)

The app's purchase layer lives in `src/lib/payments.js`. It already:
- defines one **non-consumable** product per pack,
- routes all purchase buttons through `purchasePack()`,
- exposes `restorePurchases()` (Settings → Restore Purchases — Apple
  requires this for non-consumables),
- refuses to fake purchases on the web build.

To go live:
1. In **App Store Connect → In-App Purchases**, create non-consumables with
   EXACTLY these product IDs (prices are suggestions):

   | Product ID | Pack | Price |
   |---|---|---|
   | `com.whatsmypick.pack.popculture` | Pop Culture Pack | $2.99 |
   | `com.whatsmypick.pack.animals` | Animal Pack | $2.99 |
   | `com.whatsmypick.pack.world` | World Pack | $2.99 |
   | `com.whatsmypick.pack.brands` | Brands Pack | $2.99 |
   | `com.whatsmypick.pack.fantasy` | Fantasy Pack | $2.99 |
   | `com.whatsmypick.pack.food` | Food Pack | $2.99 |

2. Install a StoreKit bridge — **RevenueCat is recommended**
   (`npm install @revenuecat/purchases-capacitor`), create one entitlement
   per pack, then fill in the two `TODO(StoreKit)` blocks in
   `src/lib/payments.js` (purchase + restore). Each is 3–5 lines; the
   comments show the exact calls.
3. Test with a Sandbox tester account before submitting.

Picks/cosmetics need NO IAP setup — they are earned by playing only.

## 3. App Privacy (App Store Connect questionnaire)

- **Data collected:** Name (display name), User Content (chat, game words),
  Identifiers (auto-generated player ID), Purchases (if using RevenueCat).
- **Linked to identity:** No (guest IDs are random). **Tracking:** No.
- **Privacy policy URL:** `https://<your-domain>/privacy.html`
  (shipped in this repo at `public/privacy.html` — edit the contact line).

## 4. UGC compliance (guideline 1.2) — already implemented

- Report: every player card has "Report player" → `player_reports` table
  (**run `supabase/migrations/0003_player_reports.sql`**).
- Moderation: hosts can remove players; profanity filter (EN/NL) on names,
  chat, and custom words (`src/lib/cleanText.js`).
- Mention these three in the App Review notes to preempt questions.

## 5. Sign in with Apple

Login already shows "Continue with Apple" alongside Google (guideline 4.8
satisfied). Enable the Apple provider in Supabase Auth and the
"Sign in with Apple" capability in Xcode. Account deletion exists in
Settings (guideline 5.1.1(v)).

## 6. Review notes to include with the submission

> Multiplayer party game. No account required (guest play). All real-money
> purchases use Apple IAP (category packs, non-consumable, restorable via
> Settings → Restore Purchases). The in-game "Picks" currency is earned by
> playing only and buys cosmetics only. UGC (chat/names/custom words) is
> profanity-filtered; players can be reported from their player card and
> removed by the lobby host.

## 7. Before every store build

- `dist/` built from a clean `npm run build`
- Supabase migrations 0001–0003 applied
- Do NOT ship a device with the dev flag: visit any URL with `?dev=off`
