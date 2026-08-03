// Guest identity stored in localStorage — no account needed
const KEY_ID = 'mystery_guest_id';
const KEY_NAME = 'mystery_guest_name';

function generateId() {
  return 'guest_' + Math.random().toString(36).slice(2, 11);
}

export function getGuestIdentity() {
  let id = localStorage.getItem(KEY_ID);
  if (!id) {
    id = generateId();
    localStorage.setItem(KEY_ID, id);
  }
  const name = localStorage.getItem(KEY_NAME) || '';
  return { id, name };
}

export function setGuestName(name) {
  localStorage.setItem(KEY_NAME, name.trim());
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