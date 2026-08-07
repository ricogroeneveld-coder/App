// Apple In-App Purchase layer for category packs (non-consumables).
//
// App Store rule 3.1.1: digital content sold for real money MUST go through
// Apple IAP — never a web checkout. This module is the single integration
// point:
//
//  - Product catalog: one non-consumable per pack, IDs below must be created
//    identically in App Store Connect.
//  - Native (Capacitor iOS build): wire the marked TODOs to a StoreKit
//    bridge (RevenueCat or @capacitor-community/in-app-purchases). Purchases
//    and restores resolve entitlements, which unlock packs locally via
//    premiumPacks.unlockPack.
//  - Web build: purchasing is unavailable (never fake a charge) — the UI
//    tells players packs unlock in the iOS app. Dev-flagged devices
//    (?dev= URL) can simulate a purchase to keep testing possible.
//
// Restoring purchases is REQUIRED by App Store review for non-consumables;
// ProfileSettings exposes it.

import { unlockPack, isPackUnlocked } from './premiumPacks';

export const PRODUCTS = {
  pop_culture: { productId: 'com.whatsmypick.pack.popculture', price: '$2.99' },
  animals:     { productId: 'com.whatsmypick.pack.animals',    price: '$2.99' },
  world:       { productId: 'com.whatsmypick.pack.world',      price: '$2.99' },
  brands:      { productId: 'com.whatsmypick.pack.brands',     price: '$2.99' },
  fantasy:     { productId: 'com.whatsmypick.pack.fantasy',    price: '$2.99' },
  food:        { productId: 'com.whatsmypick.pack.food',       price: '$2.99' },
};

function isNative() {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
}

function isDevDevice() {
  try { return localStorage.getItem('wmp_dev') === '1'; } catch { return false; }
}

// True when tapping "unlock" can actually complete a purchase on this build.
export function purchasesAvailable() {
  return isNative() || isDevDevice();
}

/**
 * Buy a pack. Resolves { ok } on success, { ok: false, reason } otherwise.
 * reason: 'unavailable' (web build) | 'cancelled' | 'error'
 */
export async function purchasePack(packId) {
  if (isPackUnlocked(packId)) return { ok: true };
  if (isNative()) {
    // TODO(StoreKit): replace with the real bridge once the iOS project
    // exists, e.g. RevenueCat:
    //   const { customerInfo } = await Purchases.purchaseProduct(PRODUCTS[packId].productId);
    //   if (customerInfo.entitlements.active[packId]) { unlockPack(packId); return { ok: true }; }
    return { ok: false, reason: 'error' };
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
    // TODO(StoreKit): e.g. RevenueCat:
    //   const { customerInfo } = await Purchases.restorePurchases();
    //   for (const packId of Object.keys(PRODUCTS))
    //     if (customerInfo.entitlements.active[packId]) unlockPack(packId);
    return { ok: false, reason: 'error' };
  }
  return { ok: false, reason: 'unavailable' };
}
