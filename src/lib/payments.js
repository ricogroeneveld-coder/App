// Apple In-App Purchase layer for category packs (non-consumables).
//
// App Store rule 3.1.1: digital content sold for real money MUST go through
// Apple IAP — never a web checkout. This module is the single integration
// point, backed by RevenueCat (StoreKit under the hood):
//
//  - Product catalog: one non-consumable per pack, IDs below must be created
//    identically in App Store Connect, and mirrored as Products +
//    Entitlements (same key, e.g. "pop_culture") in the RevenueCat
//    dashboard.
//  - Native (Capacitor iOS build): configure() runs once at app startup
//    (see App.jsx) and purchasePack/restorePurchases call the real
//    RevenueCat SDK, which resolves entitlements and unlocks packs locally
//    via premiumPacks.unlockPack.
//  - Web build: purchasing is unavailable (never fake a charge) — the UI
//    tells players packs unlock in the iOS app. Dev-flagged devices
//    (?dev= URL) can simulate a purchase to keep testing possible.
//
// Restoring purchases is REQUIRED by App Store review for non-consumables;
// ProfileSettings exposes it.

import { Purchases } from '@revenuecat/purchases-capacitor';
import { unlockPack, isPackUnlocked, reconcilePacks } from './premiumPacks';
import { isNativeApp, isDevToolsEnabled } from './platform';

export const PRODUCTS = {
  // Apple permanently blocks reuse of a deleted product ID, even after it
  // was only briefly created with the wrong type — this one had to move
  // to .popculture2 for that reason. Prices are NOT stored here — they come
  // localized from StoreKit at runtime (getPackPrices below).
  pop_culture: { productId: 'com.whatsmypick.pack.popculture2' },
  animals:     { productId: 'com.whatsmypick.pack.animals2' },
  world:       { productId: 'com.whatsmypick.pack.world' },
  brands:      { productId: 'com.whatsmypick.pack.brands' },
  fantasy:     { productId: 'com.whatsmypick.pack.fantasy' },
  food:        { productId: 'com.whatsmypick.pack.food' },
};

const isNative = isNativeApp;

function isDevDevice() {
  if (!isDevToolsEnabled()) return false;
  try { return localStorage.getItem('wmp_dev') === '1'; } catch { return false; }
}

// True when tapping "unlock" can actually complete a purchase on this build.
export function purchasesAvailable() {
  return isNative() || isDevDevice();
}

let configured = false;

// Call once at app startup (see App.jsx). No-op on web — RevenueCat only
// matters on the native iOS build.
export async function configurePurchases() {
  if (configured || !isNative()) return;
  const apiKey = import.meta.env.VITE_REVENUECAT_IOS_KEY;
  if (!apiKey) return; // build without the key still runs; purchases just stay unavailable
  configured = true;
  await Purchases.configure({ apiKey });
  // Silent auto-restore: pack unlock flags live in localStorage, which dies
  // with a reinstall — but the entitlements live with the Apple ID. Re-sync
  // them at startup so a reinstalling buyer never sees their pack locked
  // (Settings → Restore Purchases stays as the manual, Apple-required path).
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    // RevenueCat is the source of truth (SEC-4): mirror its active entitlements
    // exactly, which unlocks a reinstalling buyer's packs AND strips any
    // hand-edited localStorage unlock that isn't actually owned.
    reconcilePacks(Object.keys(PRODUCTS).filter(packId => customerInfo.entitlements.active[packId]));
  } catch { /* offline — RevenueCat's cache/Restore Purchases still covers it */ }
}

// Localized store prices, e.g. { pop_culture: "€2,99" }. Fetched once from
// StoreKit via RevenueCat — NEVER hardcoded in UI strings, so every
// storefront sees its real local price and App Store Connect price changes
// apply without an app update. Returns {} on web / before configure.
let priceCache = null;
export async function getPackPrices() {
  if (priceCache) return priceCache;
  if (!isNative() || !configured) return {};
  try {
    const ids = Object.values(PRODUCTS).map(p => p.productId);
    const { products } = await Purchases.getProducts({ productIdentifiers: ids });
    const byProductId = Object.fromEntries((products || []).map(p => [p.identifier, p.priceString]));
    priceCache = Object.fromEntries(
      Object.entries(PRODUCTS).map(([packId, { productId }]) => [packId, byProductId[productId]])
    );
    return priceCache;
  } catch {
    return {};
  }
}

/**
 * Buy a pack. Resolves { ok } on success, { ok: false, reason } otherwise.
 * reason: 'unavailable' (web build) | 'cancelled' | 'error'
 */
export async function purchasePack(packId) {
  if (isPackUnlocked(packId)) return { ok: true };
  if (isNative()) {
    try {
      const productId = PRODUCTS[packId].productId;
      const { products } = await Purchases.getProducts({ productIdentifiers: [productId] });
      const product = products?.[0];
      if (!product) return { ok: false, reason: 'error' };
      const { customerInfo } = await Purchases.purchaseStoreProduct({ product });
      if (customerInfo.entitlements.active[packId]) {
        unlockPack(packId);
        return { ok: true };
      }
      return { ok: false, reason: 'error' };
    } catch (e) {
      if (e?.userCancelled) return { ok: false, reason: 'cancelled' };
      return { ok: false, reason: 'error' };
    }
  }
  if (isDevDevice()) {
    // Simulated purchase for testing on dev-flagged web devices.
    unlockPack(packId);
    return { ok: true };
  }
  return { ok: false, reason: 'unavailable' };
}

/**
 * Restore previous purchases (required for non-consumables).
 * Resolves { ok, restored: number } or { ok: false, reason }.
 */
export async function restorePurchases() {
  if (isNative()) {
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      let restored = 0;
      for (const packId of Object.keys(PRODUCTS)) {
        if (customerInfo.entitlements.active[packId] && !isPackUnlocked(packId)) {
          unlockPack(packId);
          restored++;
        }
      }
      return { ok: true, restored };
    } catch {
      return { ok: false, reason: 'error' };
    }
  }
  return { ok: false, reason: 'unavailable' };
}
