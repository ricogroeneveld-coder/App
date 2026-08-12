// Practice-bot knowledge: per-category fact matrices + the generic bot brain.
//
// The bots are honest by construction — they answer from hand-authored fact
// matrices (word × question → yes/no/sometimes), never by guessing:
//   * 'sometimes' cells are genuinely ambiguous in real life; the bot commits
//     to one interpretation of its own word per game (so it never contradicts
//     itself), and when READING the player's answers it never eliminates a
//     'sometimes' word — consistent with either answer.
//   * free-text questions are matched to matrix rows by normalized text, then
//     by token overlap; each matrix also carries answer-only "extra" rows for
//     common phrasings outside the ask-bank ("is it alive?", "can you eat
//     it?") so far more player questions hit real facts.
//   * a question no row covers gets a flat, consistent "No" — the
//     least-lying blind policy (most arbitrary properties are false of most
//     words), and re-asking can never contradict an earlier answer.
import { WORD_LISTS } from '@/lib/wordLists';
import household from './matrices/household';
import pets from './matrices/pets';
import europeanCountries from './matrices/europeanCountries';

const MATRICES = {
  [household.category]: household,
  [pets.category]: pets,
  [europeanCountries.category]: europeanCountries,
};

export const PRACTICE_CATEGORIES = Object.keys(MATRICES);
export const DEFAULT_PRACTICE_CATEGORY = household.category;

export function matrixFor(category) {
  return MATRICES[category] || MATRICES[DEFAULT_PRACTICE_CATEGORY];
}
export function wordsFor(category) {
  return WORD_LISTS[matrixFor(category).category] || [];
}

// Dev-only typo guard: every word a matrix references must exist in its
// category's word list, or the bot would silently answer "no" for it.
if (import.meta.env.DEV) {
  for (const matrix of Object.values(MATRICES)) {
    const words = WORD_LISTS[matrix.category] || [];
    for (const question of matrix.questions) {
      for (const w of [...question.yes, ...question.some]) {
        if (!words.includes(w)) console.warn(`[botKnowledge] ${matrix.category}: unknown word "${w}" in "${question.id}"`);
      }
    }
  }
}

export function questionById(matrix, id) {
  return matrix.questions.find(x => x.id === id);
}

function cellFor(matrix, word, question) {
  if (question.yes.includes(word)) return 'yes';
  if (question.some.includes(word)) return 'some';
  return 'no';
}

// The bot's committed interpretation of its own word: every 'sometimes' cell
// resolves to a fixed yes/no at game start.
export function makeCommit(matrix, word) {
  const commit = {};
  for (const question of matrix.questions) {
    if (cellFor(matrix, word, question) === 'some') commit[question.id] = Math.random() < 0.5;
  }
  return commit;
}

// Honest answer about the bot's own word.
export function answerFor(matrix, word, questionId, commit) {
  const question = questionById(matrix, questionId);
  if (!question) return false;
  const cell = cellFor(matrix, word, question);
  if (cell === 'some') return !!commit[questionId];
  return cell === 'yes';
}

// Bot learning: keep every word consistent with the player's answer; a
// 'sometimes' word survives either answer. An answer that would empty the set
// (subjective/mistaken player) teaches nothing rather than "proving" the
// impossible.
export function filterCandidates(matrix, candidates, questionId, humanSaidYes) {
  const question = questionById(matrix, questionId);
  if (!question) return candidates;
  const next = candidates.filter(w => {
    const cell = cellFor(matrix, w, question);
    return cell === 'some' || (cell === 'yes') === humanSaidYes;
  });
  return next.length > 0 ? next : candidates;
}

// Information gain: prefer the question that splits the candidate set closest
// to 50/50 ('sometimes' counts half toward each side). Answer-only extras are
// excluded — bots ask like players do, from the real bank.
function splitScore(matrix, question, candidates) {
  let yesWeight = 0;
  for (const w of candidates) {
    const cell = cellFor(matrix, w, question);
    if (cell === 'yes') yesWeight += 1;
    else if (cell === 'some') yesWeight += 0.5;
  }
  return Math.abs(yesWeight - candidates.length / 2); // lower is better
}

export function pickBotQuestion(matrix, candidates, askedIds, difficulty) {
  const open = matrix.questions.filter(question => !question.extra && !askedIds.includes(question.id));
  if (open.length === 0) return null;
  if (difficulty === 'easy') return open[Math.floor(Math.random() * open.length)];
  const ranked = [...open].sort((a, b) => splitScore(matrix, a, candidates) - splitScore(matrix, b, candidates));
  const pool = difficulty === 'hard' ? ranked.slice(0, 2) : ranked.slice(0, 5);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Truthful hint material: matrix rows (bank rows only, so the phrasing looks
// like the game's own questions) whose committed answer for the word is known.
export function hintQuestions(matrix) {
  return matrix.questions.filter(q => !q.extra);
}

// ── free-text question matching ────────────────────────────────────────────
const STOP = new Set([
  'is', 'it', 'the', 'a', 'an', 'does', 'do', 'can', 'you', 'your', 'to', 'of', 'in', 'on', 'for',
  'with', 'when', 'would', 'usually', 'made', 'they', 'them', 'this', 'that', 'have', 'has',
  'het', 'een', 'de', 'je', 'kun', 'kan', 'er', 'op', 'voor', 'met', 'bij', 'zou', 'meestal',
  'heeft', 'vind', 'vindt', 'van', 'ermee', 'erop', 'men', 'land', 'country',
]);
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => new Set(norm(s).split(' ').filter(w => w && !STOP.has(w)));

const matchCache = new Map(); // `${category}|${normText}` → question id | null

export function matchQuestion(matrix, text) {
  const key = `${matrix.category}|${norm(text)}`;
  if (!norm(text)) return null;
  if (matchCache.has(key)) return matchCache.get(key);

  let found = null;
  const normText = norm(text);
  for (const q of matrix.questions) {
    if (norm(q.en) === normText || norm(q.nl) === normText) { found = q.id; break; }
  }

  if (!found) {
    // Token-overlap scoring with a margin requirement, plus a boost when the
    // player's text contains a token unique to one matrix question ("electr…"
    // can only mean the electricity rows).
    const tk = tokens(text);
    if (tk.size) {
      const tokenOwners = new Map(); // token → Set of question ids
      const scored = [];
      for (const q of matrix.questions) {
        const lt = new Set([...tokens(q.en), ...tokens(q.nl)]);
        for (const w of lt) {
          if (!tokenOwners.has(w)) tokenOwners.set(w, new Set());
          tokenOwners.get(w).add(q.id);
        }
        const inter = [...tk].filter(w => lt.has(w)).length;
        const union = new Set([...tk, ...lt]).size || 1;
        scored.push({ id: q.id, score: inter / union, inter, lt });
      }
      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];
      const second = scored[1];
      const margin = best.score - (second?.score || 0);
      const hasUniqueToken = [...tk].some(w => best.lt.has(w) && tokenOwners.get(w)?.size === 1);
      if (best.inter > 0 && (
        best.score >= 0.6 ||
        (best.score >= 0.4 && margin >= 0.15) ||
        (hasUniqueToken && best.score >= 0.25)
      )) {
        found = best.id;
      }
    }
  }

  matchCache.set(key, found);
  return found;
}

// Unmatched questions: a flat, consistent "No". Most arbitrary properties are
// false of most words, so this is the least-lying blind answer — and it can
// never contradict itself on a re-ask.
export function fallbackAnswer() {
  return false;
}

export const BOT_NAMES = ['Rico (BOT)', 'Koen (BOT)', 'Vietje (BOT)', 'Louis (BOT)', 'Jinnie (BOT)'];
