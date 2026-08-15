# Google Play Submission Guide — What's My Pick!

The Android app is a Capacitor wrapper around the same web build the iOS app
ships, so gameplay, progression, cosmetics and the Supabase backend are
identical. This file covers what is already done in the repo and what still has
to happen in the browser (Play Console, RevenueCat).

Everything in §1 is committed and verified. Everything in §2 onward needs you.

---

## 1. In the repo — DONE

- **Android platform added** (`android/`, Capacitor 8). Package
  `com.whatsmypick.app`, the same id as iOS, so the listing matches.
- **compileSdk / targetSdk 36, minSdk 24.** Play requires target API 35+ for new
  apps; 36 is current.
- **Portrait locked** (`android:screenOrientation="portrait"`), matching iOS.
  The layout is designed to a phone-portrait budget.
- **Dark chrome end to end.** `#07040F` on the window, splash, status bar and
  navigation bar, so a light-mode device never flashes white on launch.
- **Icons and splashes generated** from the app's own logo, including a proper
  adaptive icon (full-bleed background layer + safe-zone foreground) for every
  density.
- **Cleartext HTTP disabled** (`usesCleartextTraffic="false"`), remote webview
  debugging off, mixed content blocked.
- **Hardware/gesture Back handled.** Without this Capacitor closes the whole app
  from any screen; now Back walks history and only exits at the home screen.
- **Platform-specific code split properly:**
  - iCloud identity backup is iOS-only and no longer runs on Android. Android
    gets equivalent reinstall protection for free from Google's Auto Backup
    (`android:allowBackup="true"`), which includes the WebView's localStorage
    where the guest identity and progression live.
  - RevenueCat picks the Play public key (`VITE_REVENUECAT_ANDROID_KEY`) on
    Android and the Apple key on iOS.
  - The iOS-only keyboard-resize workaround on the name gate no longer applies
    on Android, which uses the platform default.
- **Signed release pipeline**: `.github/workflows/android-play.yml` builds a
  signed `.aab` on a cloud runner and verifies the signature before uploading
  the artifact.

Build locally (needs the Android SDK, which this repo does not require to
develop the web app):

```bash
npm run android      # vite build + cap sync android
npx cap open android # opens Android Studio
```

---

## 2. Create the app in Play Console

1. Go to [Play Console](https://play.google.com/console) → **Create app**.
   - App name: **What's My Pick!**
   - Default language: Dutch or English (both are supported in-app; the app
     follows the device language).
   - Type: **Game**, Category: **Word** (or Trivia).
   - Free.
2. Keep **Play App Signing** enabled (the default). Play then holds the real
   signing key and your CI keystore is only the *upload* key, which can be
   reset if lost. Without it, losing the keystore ends your ability to update
   the listing forever.

## 3. Create the upload keystore

Run once, locally, and back the file up somewhere safe:

```bash
keytool -genkeypair -v -keystore upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Then add four GitHub secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -i upload-keystore.jks` output |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | key password |

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are already set for the iOS
workflow and are reused.

## 4. Build and upload

GitHub → **Actions → "Android · Play Store" → Run workflow**, entering a version
name (e.g. `1.0.0`) and a version code (`1`, then `2`, `3`… — Play rejects a
re-used code). Download the `app-release-bundle` artifact and upload the `.aab`
in Play Console under **Release → Testing → Internal testing** first.

Start with **Internal testing**: it goes live in minutes, versus days for
production review.

The workflow also produces an **`app-release-apk`** artifact. Play itself only
accepts the `.aab`, but an `.aab` cannot be installed directly, so the APK is
what you use to actually play the game when you have no Android device (see
§4a).

## 4a. Testing without owning an Android phone

Publishing needs no device at all. Testing does, and these all work from a
browser or a desktop:

1. **Pre-launch report (free, zero setup).** The moment you upload a build to
   any test track, Google runs it automatically on a set of real physical
   devices and reports crashes, screenshots of every screen it reached,
   performance and accessibility issues. Play Console → Test and release →
   Pre-launch report. This is the fastest way to catch an Android-only crash.
2. **Android emulator (free, most complete).** Install Android Studio on your
   Mac or PC, create a Pixel virtual device with a **Google Play** system image
   (important: the plain AOSP images have no Play Store, so purchases cannot be
   tested), then drag the APK onto the emulator window. This is the only free
   option where you can complete a test purchase end to end.
3. **Cloud device farm.** BrowserStack App Live or LambdaTest give you a real
   Android phone in the browser; upload the APK and play. Both have free
   trials. Good for checking real-device feel and different screen sizes.
4. **Someone else's phone.** Add their Google account as an internal tester and
   send them the opt-in link. Useful anyway, since the game is multiplayer and
   deserves a real cross-device test.

For in-app purchase testing you need option 2 or 4: the automated report and
most device farms cannot complete a Play purchase flow.

## 5. In-app purchases (the 6 category packs)

Play does not share Apple's products; they must be recreated.

1. Play Console → **Monetise → Products → In-app products** → create one
   **non-consumable** managed product per pack. Use the same ids the app asks
   for, which live in `src/lib/payments.js`:
   `com.whatsmypick.pack.popculture2`, `.animals2`, `.world`, `.brands`,
   `.fantasy`, `.food`.
   - A product can only be created after a build containing the billing library
     has been uploaded to a track, so do §4 first.
2. RevenueCat → your project → **Apps → + Google Play**. Upload the Play service
   account credentials it asks for, then add the same products and attach them
   to the existing entitlements (one per pack id: `pop_culture`, `animals`,
   `world`, `brands`, `fantasy`, `food`).
3. Copy RevenueCat's **Google Play public key** (starts with `goog_`) into the
   `VITE_REVENUECAT_ANDROID_KEY` GitHub secret and re-run the workflow.
4. Test a purchase with a licence tester account (Play Console → Setup →
   Licence testing).

Until step 3 is done the app runs fine; the packs simply report purchases as
unavailable, exactly like the web build.

## 6. Store listing content

You can reuse the App Store assets:

- **Screenshots**: at least 2 phone screenshots (the gameplay and Notebook
  captures work; Play wants 16:9 or 9:16, 1080×1920 or larger).
- **Feature graphic**: 1024×500, required. The Instagram story artwork can be
  re-cropped, or ask and I will generate one.
- **Short description** (80 chars) and **full description** (4000).
- **App icon**: 512×512 PNG — export from `assets/icon.png`.
- **Privacy policy URL**: the same one the App Store uses
  (`https://www.jinnieoclock.com/whatsmypick/privacy.html`).

## 7. Policy declarations (the part that fails submissions)

- **Data safety form.** Declare honestly, matching the privacy policy:
  - Collected: a random guest ID, the display name the player types, chat
    messages, in-game progression, and pseudonymous analytics events.
  - No real name, email, address or location on the native build (accounts are
    hidden on native — see `platform.js`).
  - Data is encrypted in transit (HTTPS/WSS to Supabase).
  - Users can request deletion in-app: Settings → delete profile/data.
- **Content rating questionnaire.** The app has **user-to-user chat**, so answer
  yes to "users can interact" and "shares user-generated content". That will
  push the rating up (typically PEGI 12 / Teen). This is expected and matches
  the moderation controls the app already ships (profanity filter, report, mute,
  host kick).
- **Target audience**: 13+. Do not select a children's audience — the chat makes
  Families policy apply otherwise.
- **Ads**: none. Declare no ads.
- **App access**: gameplay needs no login. Tell reviewers they can play a full
  solo game with no account and no second device via **Create Game → Practice vs
  Bot**, which is offline and instant.

## 8. Known gaps, deliberately deferred

- **Push notifications are off on Android too.** The client flag
  (`VITE_PUSH_ENABLED`) gates it, so no notification permission is requested and
  nothing is sent. Enabling it on Android additionally needs Firebase: a
  `google-services.json` in `android/app/`, the `com.google.gms.google-services`
  Gradle plugin, and FCM credentials in the `notify-turn` Edge Function. The
  Firebase library ships in the build already but stays dormant without it.
- **The Beta Tester cosmetics are iOS/TestFlight-only.** Detection reads the
  sandbox App Store receipt, which has no Play equivalent yet. Android testers
  simply do not receive that set.
- **No deep links on either platform.** Invite sharing passes the room code, not
  a URL, by design for now.
- **No tablet-specific layout.** The app is portrait phone-first; it runs on
  tablets but the layout is not optimised for them.
