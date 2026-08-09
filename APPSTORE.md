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

### Option A — No Mac: build in the cloud (recommended)

`.github/workflows/ios-testflight.yml` builds and uploads to TestFlight
from GitHub's cloud Macs. One-time browser setup:

1. **Register the bundle ID** — developer.apple.com → Certificates,
   Identifiers & Profiles → Identifiers → "+" → App ID →
   `com.whatsmypick.app`. (The Sign in with Apple capability on the App ID
   is harmless if already ticked — the native v1 ships without accounts.)
2. **Create the app record** — App Store Connect → Apps → "+" →
   New App → iOS, pick the bundle ID.
3. **Create an API key** — App Store Connect → Users and Access →
   Integrations → App Store Connect API → "+". Role must be **Admin**
   (cloud signing creates the certificate/profile for you). Download the
   `.p8` file — it can only be downloaded once.
4. **Add four GitHub secrets** — repo → Settings → Secrets and
   variables → Actions:
   - `APPLE_TEAM_ID` — 10-char Team ID (developer.apple.com → Membership)
   - `APPSTORE_ISSUER_ID` — shown above the key list
   - `APPSTORE_KEY_ID` — the key's ID
   - `APPSTORE_P8` — paste the entire contents of the `.p8` file
5. GitHub → **Actions → "iOS · TestFlight" → Run workflow**. When it
   finishes, the build appears in App Store Connect → TestFlight.

### Option B — On a Mac (needs Xcode 16+)

```bash
npm install
npm run ios          # builds the web app + syncs it into ios/
npx cap open ios     # opens Xcode
```

In Xcode, the only remaining setup is **Signing & Capabilities**: pick
your Apple Developer team, then archive/upload as usual. Xcode resolves
the Capacitor Swift packages automatically on first open.

## 2. In-App Purchases (packs are real-money → Apple IAP only) — ✅ CODE DONE

The app's purchase layer lives in `src/lib/payments.js`, wired to
**RevenueCat** (`@revenuecat/purchases-capacitor`, already installed and
synced into `ios/`). It:
- defines one **non-consumable** product per pack,
- calls `configurePurchases()` once at app startup (native only),
- routes all purchase buttons through `purchasePack()` (real StoreKit
  purchase via RevenueCat, checks the matching entitlement),
- exposes `restorePurchases()` (Settings → Restore Purchases — Apple
  requires this for non-consumables),
- refuses to fake purchases on the web build.

Remaining setup is all in the browser — no code changes needed:

1. **App Store Connect → your app → In-App Purchases**, create 6
   non-consumables with EXACTLY these product IDs (prices are suggestions):

   | Product ID | Pack | Price |
   |---|---|---|
   | `com.whatsmypick.pack.popculture2` | Pop Culture Pack | $2.99 |
   | `com.whatsmypick.pack.animals2` | Animal Pack | $2.99 |
   | `com.whatsmypick.pack.world` | World Pack | $2.99 |
   | `com.whatsmypick.pack.brands` | Brands Pack | $2.99 |
   | `com.whatsmypick.pack.fantasy` | Fantasy Pack | $2.99 |
   | `com.whatsmypick.pack.food` | Food Pack | $2.99 |

2. **Create a free RevenueCat account** (revenuecat.com) → new Project →
   add an **iOS app** with bundle ID `com.whatsmypick.app`, connected via
   an App Store Connect API key (Users and Access → Integrations — the
   same kind of key used for `APPSTORE_P8`, minimum role **App Manager**).
3. In RevenueCat, create **6 Products** matching the product IDs above,
   then **6 Entitlements** with these EXACT identifiers (the code checks
   these names): `pop_culture`, `animals`, `world`, `brands`, `fantasy`,
   `food`. Attach each Product to its matching Entitlement.
4. RevenueCat → Project → **API Keys** → copy the **Apple App Store**
   public app key (starts with `appl_`) → add it as the GitHub secret
   `VITE_REVENUECAT_IOS_KEY` (same place as the other build secrets) so
   the CI build embeds it.
5. Test with a Sandbox tester account (App Store Connect → Users and
   Access → Sandbox Testers) before submitting for review.

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

## 5. Accounts — native v1 ships WITHOUT sign-in

The native app hides the whole sign-in flow (`src/lib/platform.js`):
players are guests, which is the real experience anyway — gameplay and
progression always run on the guest identity, and pack purchases belong
to the player's Apple ID (restorable via Settings → Restore Purchases),
so nothing of value depends on an account.

This deliberately takes guideline 4.8 (Sign in with Apple) out of scope:
it only applies to apps that OFFER third-party login, and the native
build offers none. Guests can still delete their local profile + game
data in Settings. The web build keeps the optional email/Google/Apple
sign-in as before.

If accounts come back in a future native version, that's when to do:
native Apple sign-in plugin, Google via system browser + deep links,
Supabase provider setup, and linking guest progression to accounts.

## 6. Review notes to include with the submission

> Multiplayer party game. No accounts — guest play only, no login of any
> kind is offered in this app. All real-money
> purchases use Apple IAP (category packs, non-consumable, restorable via
> Settings → Restore Purchases). The in-game "Picks" currency is earned by
> playing only and buys cosmetics only. UGC (chat/names/custom words) is
> profanity-filtered; players can be reported from their player card and
> removed by the lobby host.

## 6b. iCloud reinstall recovery — one-time App ID checkbox

Progression (Picks/XP/cosmetics/name) is backed up to the player's iCloud
key-value store, so it survives reinstalls and follows them to a new
iPhone. The code ships in the repo (ICloudKVPlugin.swift +
src/lib/cloudBackup.js + App.entitlements); the only manual step is
enabling the capability on the App ID:

1. developer.apple.com → Certificates, Identifiers & Profiles →
   Identifiers → `com.whatsmypick.app`
2. Tick **iCloud** in the capability list (key-value storage needs no
   container — don't create one) → Save
3. Next TestFlight build picks it up automatically (cloud signing
   regenerates the profile with the entitlement).

Also uses Supabase **anonymous sign-ins** (Dashboard → Authentication →
Sign In / Providers → "Allow anonymous sign-ins" → ON) together with
migration 0004 — without those, profile cloud sync pauses (local play
is unaffected).

## 7. Before every store build

- `dist/` built from a clean `npm run build`
- Supabase migrations 0001–0003 applied
- Don't set `VITE_ENABLE_DEV_TOOLS` for a store build — without it, the
  `?dev=unlock` / `?dev=reset` URLs (test-mode unlock, profile reset,
  simulated web purchases) are inert at the code level, not just hidden, so
  there's nothing to remember to turn off per-device. If a device was
  flagged by an older build, visiting `?dev=off` still clears it.
