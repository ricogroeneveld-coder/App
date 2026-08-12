// Practice-mode bot for the 'Household Objects' category (prototype).
//
// The bot is honest by construction: instead of "understanding" questions it
// answers from a hand-authored fact matrix (word × question → yes/no/sometimes),
// the same way 20Q-style toys work. Questions are the category's real question
// bank, so practice teaches the exact vocabulary of a live game.
//
// 'sometimes' cells are genuinely ambiguous in real life (is a table found in
// the kitchen?). The bot commits to one interpretation of its own word at game
// start (so its answers never contradict each other), and when *reading* the
// human's answers it never eliminates a 'sometimes' word — consistent with
// either answer.
import { WORD_LISTS, WORD_LISTS_NL } from '@/lib/wordLists';

export const PRACTICE_CATEGORY = 'Household Objects';

// Canonical (EN) word list — display names localize by index, same convention
// as WordEntryPhase.
export const WORDS = WORD_LISTS[PRACTICE_CATEGORY];
const WORDS_NL = WORD_LISTS_NL[PRACTICE_CATEGORY];

export function displayWord(word, lang) {
  if (lang !== 'nl') return word;
  const i = WORDS.indexOf(word);
  return i >= 0 ? (WORDS_NL[i] || word) : word;
}

// q(id, en, nl, yesList, someList) — every word not listed is a NO.
const q = (id, en, nl, yes, some = []) => ({ id, en, nl, yes, some });

export const QUESTIONS = [
  q('kitchen', 'Is it found in the kitchen?', 'Vind je het in de keuken?',
    ['Refrigerator', 'Microwave', 'Oven', 'Knife', 'Mug', 'Kettle', 'Toaster', 'Coffee Machine'],
    ['Washing Machine', 'Table', 'Chair', 'Clock', 'Towel', 'Soap', 'Broom']),
  q('bathroom', 'Is it found in the bathroom?', 'Vind je het in de badkamer?',
    ['Toothbrush', 'Toilet', 'Shower', 'Towel', 'Soap', 'Mirror'],
    ['Washing Machine']),
  q('livingroom', 'Is it found in the living room?', 'Vind je het in de woonkamer?',
    ['Sofa', 'Television', 'Remote Control', 'Bookshelf', 'Lamp'],
    ['Table', 'Chair', 'Clock', 'Pillow', 'Mirror', 'Desk']),
  q('bedroom', 'Is it found in the bedroom?', 'Vind je het in de slaapkamer?',
    ['Bed', 'Wardrobe', 'Pillow'],
    ['Lamp', 'Mirror', 'Clock', 'Desk', 'Phone Charger', 'Television', 'Chair']),
  q('garage', 'Is it found in the garage?', 'Vind je het in de garage?',
    [],
    ['Broom', 'Washing Machine']),
  q('daily', 'Is it used every day?', 'Wordt het elke dag gebruikt?',
    ['Chair', 'Table', 'Sofa', 'Bed', 'Wardrobe', 'Refrigerator', 'Television', 'Lamp', 'Mirror', 'Pillow',
     'Toothbrush', 'Toilet', 'Mug', 'Clock', 'Towel', 'Soap', 'Shower', 'Phone Charger', 'Remote Control'],
    ['Microwave', 'Oven', 'Knife', 'Kettle', 'Toaster', 'Coffee Machine', 'Desk', 'Bookshelf', 'Washing Machine']),
  q('electronic', 'Is it electronic?', 'Is het elektronisch?',
    ['Refrigerator', 'Microwave', 'Oven', 'Washing Machine', 'Television', 'Vacuum Cleaner', 'Kettle',
     'Toaster', 'Coffee Machine', 'Remote Control', 'Phone Charger'],
    ['Clock', 'Lamp']),
  q('electricity', 'Does it use electricity?', 'Gebruikt het elektriciteit?',
    ['Refrigerator', 'Microwave', 'Oven', 'Washing Machine', 'Television', 'Lamp', 'Vacuum Cleaner',
     'Kettle', 'Toaster', 'Coffee Machine', 'Remote Control', 'Clock', 'Phone Charger'],
    ['Toothbrush']),
  q('batteries', 'Does it use batteries?', 'Gebruikt het batterijen?',
    ['Remote Control'],
    ['Clock', 'Toothbrush', 'Vacuum Cleaner']),
  q('small', 'Is it small?', 'Is het klein?',
    ['Toothbrush', 'Knife', 'Mug', 'Remote Control', 'Soap', 'Phone Charger'],
    ['Clock', 'Lamp', 'Towel', 'Pillow', 'Kettle', 'Toaster']),
  q('large', 'Is it large?', 'Is het groot?',
    ['Sofa', 'Bed', 'Wardrobe', 'Refrigerator', 'Washing Machine', 'Bookshelf'],
    ['Table', 'Television', 'Desk', 'Oven', 'Shower']),
  q('onehand', 'Can you hold it in one hand?', 'Kun je het met één hand vasthouden?',
    ['Toothbrush', 'Knife', 'Mug', 'Remote Control', 'Soap', 'Phone Charger'],
    ['Clock', 'Towel', 'Kettle', 'Lamp', 'Pillow']),
  q('metal', 'Is it made of metal?', 'Is het van metaal?',
    ['Knife', 'Kettle', 'Toaster', 'Refrigerator', 'Washing Machine', 'Oven', 'Microwave'],
    ['Lamp', 'Coffee Machine', 'Broom', 'Clock', 'Desk', 'Chair', 'Table', 'Bed']),
  q('plastic', 'Is it made of plastic?', 'Is het van plastic?',
    ['Remote Control', 'Phone Charger', 'Toothbrush'],
    ['Vacuum Cleaner', 'Coffee Machine', 'Kettle', 'Broom', 'Clock', 'Lamp', 'Chair']),
  q('glass', 'Is it made of glass?', 'Is het van glas?',
    ['Mirror'],
    ['Television', 'Lamp', 'Table', 'Oven', 'Mug', 'Coffee Machine']),
  q('wood', 'Is it made of wood?', 'Is het van hout?',
    ['Bookshelf', 'Wardrobe', 'Desk', 'Table'],
    ['Chair', 'Bed', 'Broom', 'Mirror']),
  q('fabric', 'Is it made of fabric?', 'Is het van stof?',
    ['Pillow', 'Towel', 'Sofa'],
    ['Bed', 'Chair']),
  q('sharp', 'Is it sharp?', 'Is het scherp?',
    ['Knife'],
    []),
  q('hollow', 'Is it hollow?', 'Is het hol?',
    ['Mug', 'Kettle'],
    ['Wardrobe', 'Refrigerator', 'Microwave', 'Oven', 'Washing Machine', 'Toilet', 'Toaster', 'Coffee Machine']),
  q('cook', 'Can you cook with it?', 'Kun je ermee koken?',
    ['Oven', 'Microwave'],
    ['Knife', 'Kettle', 'Toaster']),
  q('cleanwith', 'Can you clean with it?', 'Kun je ermee schoonmaken?',
    ['Vacuum Cleaner', 'Broom', 'Soap', 'Washing Machine'],
    ['Towel', 'Toothbrush', 'Shower']),
  q('forcleaning', 'Is it used for cleaning?', 'Wordt het gebruikt om schoon te maken?',
    ['Vacuum Cleaner', 'Broom', 'Soap', 'Washing Machine'],
    ['Towel', 'Toothbrush', 'Shower']),
  q('sit', 'Can you sit on it?', 'Kun je erop zitten?',
    ['Chair', 'Sofa', 'Bed', 'Toilet'],
    ['Table', 'Desk', 'Pillow']),
  q('store', 'Can you store things in it?', 'Kun je er spullen in bewaren?',
    ['Wardrobe', 'Refrigerator', 'Bookshelf'],
    ['Desk']),
  q('eatwith', 'Do you eat with it?', 'Eet je ermee?',
    ['Knife'],
    ['Mug', 'Table']),
  q('screen', 'Does it have a screen?', 'Heeft het een scherm?',
    ['Television'],
    ['Microwave', 'Oven', 'Washing Machine', 'Coffee Machine', 'Clock']),
  q('noise', 'Does it make noise?', 'Maakt het geluid?',
    ['Washing Machine', 'Vacuum Cleaner', 'Television', 'Kettle', 'Coffee Machine', 'Microwave'],
    ['Toaster', 'Clock', 'Refrigerator', 'Toilet', 'Shower', 'Oven']),
  q('cord', 'Does it have a cord?', 'Heeft het een snoer?',
    ['Lamp', 'Television', 'Refrigerator', 'Microwave', 'Oven', 'Washing Machine', 'Kettle', 'Toaster',
     'Coffee Machine', 'Phone Charger'],
    ['Vacuum Cleaner']),
  q('heavy', 'Is it heavy?', 'Is het zwaar?',
    ['Sofa', 'Bed', 'Wardrobe', 'Refrigerator', 'Washing Machine', 'Bookshelf'],
    ['Table', 'Television', 'Desk', 'Oven', 'Vacuum Cleaner', 'Microwave', 'Toilet']),
  q('lightweight', 'Is it light?', 'Is het licht?',
    ['Toothbrush', 'Remote Control', 'Soap', 'Phone Charger', 'Towel', 'Pillow', 'Knife'],
    ['Mug', 'Broom', 'Clock', 'Lamp']),
  q('breakable', 'Is it breakable?', 'Is het breekbaar?',
    ['Mirror', 'Television', 'Lamp', 'Mug'],
    ['Clock', 'Toilet', 'Coffee Machine']),
  q('waterproof', 'Is it waterproof?', 'Is het waterdicht?',
    ['Toilet', 'Shower', 'Mug'],
    ['Washing Machine', 'Kettle']),
  q('white', 'Is it usually white?', 'Is het meestal wit?',
    ['Refrigerator', 'Washing Machine', 'Toilet'],
    ['Microwave', 'Oven', 'Pillow', 'Towel', 'Shower', 'Toothbrush', 'Soap']),
  q('usuallymetal', 'Is it usually metal?', 'Is het meestal van metaal?',
    ['Knife', 'Kettle', 'Toaster'],
    ['Refrigerator', 'Washing Machine', 'Oven', 'Microwave', 'Lamp']),
  q('usuallyplastic', 'Is it usually plastic?', 'Is het meestal van plastic?',
    ['Remote Control', 'Phone Charger', 'Toothbrush'],
    ['Vacuum Cleaner', 'Coffee Machine', 'Broom', 'Clock', 'Kettle']),
  q('buttons', 'Does it have buttons?', 'Heeft het knoppen?',
    ['Microwave', 'Washing Machine', 'Remote Control', 'Coffee Machine'],
    ['Television', 'Oven', 'Toaster', 'Vacuum Cleaner', 'Clock']),
  q('handle', 'Does it have a handle?', 'Heeft het een handvat?',
    ['Mug', 'Knife', 'Broom', 'Vacuum Cleaner', 'Kettle', 'Refrigerator', 'Oven'],
    ['Microwave', 'Wardrobe', 'Washing Machine', 'Toilet', 'Desk']),
  q('lid', 'Does it have a lid?', 'Heeft het een deksel?',
    ['Kettle', 'Toilet'],
    ['Coffee Machine', 'Washing Machine', 'Mug']),
  q('switch', 'Does it have a switch?', 'Heeft het een schakelaar?',
    ['Lamp', 'Kettle', 'Vacuum Cleaner'],
    ['Television', 'Toaster', 'Coffee Machine', 'Microwave', 'Oven', 'Washing Machine', 'Clock']),
  q('washreg', 'Do you wash it regularly?', 'Was je het regelmatig?',
    ['Mug', 'Knife', 'Towel'],
    ['Pillow', 'Toothbrush', 'Mirror', 'Toilet', 'Shower']),
  q('set', 'Is it part of a set?', 'Is het onderdeel van een set?',
    [],
    ['Chair', 'Knife', 'Mug', 'Towel', 'Pillow', 'Table']),
  q('socket', 'Does it plug into a wall socket?', 'Steek je het in een stopcontact?',
    ['Lamp', 'Television', 'Refrigerator', 'Microwave', 'Oven', 'Washing Machine', 'Vacuum Cleaner',
     'Kettle', 'Toaster', 'Coffee Machine', 'Phone Charger'],
    []),
  q('water', 'Does it use water?', 'Gebruikt het water?',
    ['Washing Machine', 'Toilet', 'Shower', 'Kettle', 'Coffee Machine'],
    ['Toothbrush', 'Soap', 'Towel', 'Mug']),
  q('furniture', 'Is it furniture?', 'Is het een meubelstuk?',
    ['Chair', 'Table', 'Sofa', 'Bed', 'Wardrobe', 'Bookshelf', 'Desk'],
    ['Mirror']),
  q('decorative', 'Is it decorative?', 'Is het decoratief?',
    [],
    ['Mirror', 'Lamp', 'Clock', 'Pillow', 'Bookshelf']),
  q('tool', 'Is it a tool?', 'Is het gereedschap?',
    ['Knife', 'Broom'],
    ['Vacuum Cleaner', 'Toothbrush']),
  q('moving', 'Would you pack it when moving houses?', 'Zou je het inpakken bij een verhuizing?',
    ['Chair', 'Table', 'Sofa', 'Bed', 'Wardrobe', 'Refrigerator', 'Microwave', 'Washing Machine',
     'Television', 'Lamp', 'Mirror', 'Pillow', 'Toothbrush', 'Vacuum Cleaner', 'Knife', 'Mug', 'Kettle',
     'Toaster', 'Coffee Machine', 'Remote Control', 'Bookshelf', 'Desk', 'Clock', 'Towel', 'Soap',
     'Phone Charger', 'Broom'],
    ['Oven']),
  q('dangerous', 'Is it dangerous to children?', 'Is het gevaarlijk voor kinderen?',
    ['Knife'],
    ['Oven', 'Kettle', 'Toaster']),
];

// Dev-only typo guard: every word referenced by the matrix must exist in the
// category's word list, or the bot silently answers "no" for it.
if (import.meta.env.DEV) {
  for (const question of QUESTIONS) {
    for (const w of [...question.yes, ...question.some]) {
      if (!WORDS.includes(w)) console.warn(`[householdBot] unknown word "${w}" in question "${question.id}"`);
    }
  }
}

export function questionById(id) {
  return QUESTIONS.find(x => x.id === id);
}

function cellFor(word, question) {
  if (question.yes.includes(word)) return 'yes';
  if (question.some.includes(word)) return 'some';
  return 'no';
}

// The bot's committed interpretation of its own word: every 'sometimes' cell
// is resolved to a fixed yes/no at game start, so its answers stay
// self-consistent no matter how often you probe the same fact.
export function makeCommit(word) {
  const commit = {};
  for (const question of QUESTIONS) {
    if (cellFor(word, question) === 'some') commit[question.id] = Math.random() < 0.5;
  }
  return commit;
}

// Honest answer about the bot's own word.
export function answerFor(word, questionId, commit) {
  const question = questionById(questionId);
  const cell = cellFor(word, question);
  if (cell === 'some') return !!commit[questionId];
  return cell === 'yes';
}

// Bot learning: keep every word consistent with the human's answer. A
// 'sometimes' word is consistent with either answer, so it survives.
// If the answer would empty the set (the human answered subjectively or made
// a mistake), the bot learns nothing rather than "knowing" the impossible.
export function filterCandidates(candidates, questionId, humanSaidYes) {
  const question = questionById(questionId);
  const next = candidates.filter(w => {
    const cell = cellFor(w, question);
    return cell === 'some' || (cell === 'yes') === humanSaidYes;
  });
  return next.length > 0 ? next : candidates;
}

// Information gain: prefer the question that splits the candidate set closest
// to 50/50 ('sometimes' counts half toward each side).
function splitScore(question, candidates) {
  let yesWeight = 0;
  for (const w of candidates) {
    const cell = cellFor(w, question);
    if (cell === 'yes') yesWeight += 1;
    else if (cell === 'some') yesWeight += 0.5;
  }
  return Math.abs(yesWeight - candidates.length / 2); // lower is better
}

export function pickBotQuestion(candidates, askedIds, difficulty) {
  const open = QUESTIONS.filter(question => !askedIds.includes(question.id));
  if (open.length === 0) return null;
  if (difficulty === 'easy') return open[Math.floor(Math.random() * open.length)];
  const ranked = [...open].sort((a, b) => splitScore(a, candidates) - splitScore(b, candidates));
  const pool = difficulty === 'hard' ? ranked.slice(0, 2) : ranked.slice(0, 5);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Guess when the candidate set is small enough for the difficulty. Returns
// the word to guess, or null to keep asking.
export function maybeBotGuess(candidates, difficulty) {
  const threshold = difficulty === 'easy' ? 1 : 2;
  if (candidates.length === 0 || candidates.length > threshold) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Easy bots occasionally "forget" to process an answer entirely.
export function botForgets(difficulty) {
  return difficulty === 'easy' && Math.random() < 0.35;
}

export const BOT_NAMES = ['Rico (BOT)', 'Koen (BOT)', 'Vietje (BOT)', 'Louis (BOT)', 'Jinnie (BOT)'];
export function randomBotName() {
  return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
}
