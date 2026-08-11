// Canonical word normalization, shared by the guess comparison (GuessModal)
// and the word-entry validity check (WordEntryPhase). MUST stay in sync with
// the server's mystery_norm() in migration 0007: lowercase, strip accents,
// drop everything outside [a-z0-9]. A word that normalizes to '' (emoji,
// punctuation-only, non-Latin script, or a fully profanity-masked word) can
// never be matched by a guess, so word entry rejects it up front (STUCK-3).
export const normalizeWord = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '');
