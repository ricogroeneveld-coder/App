// Guest identity stored in localStorage — no account needed
const KEY_ID = 'mystery_guest_id';
const KEY_NAME = 'mystery_guest_name';

// Hard cap so names always fit player tiles, scoreboards, and player cards.
export const MAX_NAME_LENGTH = 14;

// Trim, collapse inner whitespace runs, and cap the length.
export function normalizeName(name) {
  return (name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim();
}

function generateId() {
  return 'guest_' + Math.random().toString(36).slice(2, 11);
}

export function getGuestIdentity() {
  let id = localStorage.getItem(KEY_ID);
  if (!id) {
    id = generateId();
    localStorage.setItem(KEY_ID, id);
  }
  // Normalize on read too, so names saved before the length cap existed
  // (or edited by hand) still render nicely everywhere.
  const name = normalizeName(localStorage.getItem(KEY_NAME) || '');
  return { id, name };
}

export function setGuestName(name) {
  localStorage.setItem(KEY_NAME, normalizeName(name));
  // Ensure an ID exists
  if (!localStorage.getItem(KEY_ID)) {
    localStorage.setItem(KEY_ID, generateId());
  }
}

export function hasGuestName() {
  return !!localStorage.getItem(KEY_NAME);
}

export function clearGuestIdentity() {
  localStorage.removeItem(KEY_ID);
  localStorage.removeItem(KEY_NAME);
}