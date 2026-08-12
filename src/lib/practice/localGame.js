// Local practice game: an in-memory stand-in for the Supabase backend so the
// REAL game screens (LobbyPhase → WordEntryPhase → PlayingPhase →
// FinishedPhase) run unchanged against a room that lives only on this device,
// with bot opponents driven by the honest fact matrices in botKnowledge.js.
//
// Room codes are prefixed "BOT" — the letter O is excluded from real room-code
// generation (Home.jsx), so a practice code can never collide with a live
// room. db.js routes every entity call and gameplay RPC for such codes here;
// everything else goes to Supabase exactly as before. One practice room can
// exist at a time; state dies with the page (a refresh ends the practice
// match, which is acceptable for an offline solo mode).
import { serverNow } from '@/lib/serverTime';
import { normalizeWord } from '@/lib/normalizeWord';
import {
  PRACTICE_CATEGORIES, DEFAULT_PRACTICE_CATEGORY, matrixFor, wordsFor,
  makeCommit, answerFor, filterCandidates, pickBotQuestion, hintQuestions,
  matchQuestion, fallbackAnswer, BOT_NAMES,
} from './botKnowledge';

const PREFIX = 'BOT';
const TABLES = ['mystery_rooms', 'mystery_players', 'mystery_questions', 'mystery_guesses', 'mystery_chats'];
// Chance a bot fails to "process" an answer it heard — softens play so two
// honest bots don't dissect each other (and the human) with machine precision.
const FORGET_P = 0.2;
const QUESTION_TIMER_MS = 30000;
const WORD_ENTRY_TIMER_MS = 60000;

let idSeq = 1;
const newId = () => `loc_${idSeq++}_${Math.random().toString(36).slice(2, 7)}`;
const nowIso = () => new Date(serverNow()).toISOString();
const rand = (min, max) => min + Math.floor(Math.random() * (max - min));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const state = {
  active: false,
  roomCode: null,
  humanId: null,
  tables: {},
  secrets: new Map(),        // user_id → word
  listeners: new Map(),      // table → Set<cb>
  bots: [],                  // bot brain records
  pending: new Map(),        // action key → timeout id
  interval: null,
  wordCycle: 0,              // bumps every play-again so word keys re-arm
};

// ── ownership checks (used by db.js to route) ──────────────────────────────
export function ownsCode(code) { return typeof code === 'string' && code.toUpperCase().startsWith(PREFIX); }
export function ownsId(id) { return typeof id === 'string' && id.startsWith('loc_'); }
export function ownsSubscribeFilter(filter) {
  const m = /^room_code=eq\.(.+)$/.exec(filter || '');
  return !!m && ownsCode(m[1]);
}
export function ownsRpc(name, params = {}) {
  if (ownsCode(params.p_room)) return true;
  if (ownsId(params.q_id) || ownsId(params.p_question_id)) return true;
  return false;
}

// ── store primitives (same contracts as db.js's createEntity) ──────────────
function rows(table) { return state.tables[table] || []; }
function emit(table, type, data) {
  const payload = { type, data: { ...data } };
  const subs = state.listeners.get(table);
  if (subs) setTimeout(() => subs.forEach(cb => { try { cb(payload); } catch { /* consumer error */ } }), 0);
  scheduleTick();
}

export async function filter(table, query = {}, sort, limit) {
  let out = rows(table).filter(r => Object.entries(query).every(([k, v]) => r[k] === v));
  const spec = sort || 'created_date';
  const desc = spec.startsWith('-');
  const col = desc ? spec.slice(1) : spec;
  out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (desc ? -1 : 1));
  if (limit) out = out.slice(0, limit);
  return out.map(r => ({ ...r }));
}

export async function create(table, fields) {
  const row = { id: newId(), created_date: nowIso(), updated_date: nowIso(), ...fields };
  rows(table).push(row);
  emit(table, 'create', row);
  checkLifecycle();
  return { ...row };
}

export async function update(table, id, patch) {
  const row = rows(table).find(r => r.id === id);
  if (!row) throw new Error(`local ${table}: row not found`);
  // Practice rooms only allow categories the bots have an honesty matrix for
  // (the lobby selector is filtered to these too — this is the backstop).
  if (table === 'mystery_rooms' && patch.category && !PRACTICE_CATEGORIES.includes(patch.category)) {
    patch = { ...patch, category: row.category || DEFAULT_PRACTICE_CATEGORY };
  }
  Object.assign(row, patch, { updated_date: nowIso() });
  emit(table, 'update', row);
  checkLifecycle();
  return { ...row };
}

export async function remove(table, id) {
  const list = rows(table);
  const i = list.findIndex(r => r.id === id);
  if (i < 0) return true;
  const [old] = list.splice(i, 1);
  emit(table, 'delete', old);
  checkLifecycle();
  return true;
}

export function subscribe(table, callback, onStatus) {
  if (!state.listeners.has(table)) state.listeners.set(table, new Set());
  state.listeners.get(table).add(callback);
  setTimeout(() => onStatus?.('SUBSCRIBED'), 0);
  return () => { state.listeners.get(table)?.delete(callback); };
}

// ── views over the store (mirror PlayingPhase's derived state) ─────────────
function room() { return rows('mystery_rooms')[0] || null; }
function activeMatrix() { return matrixFor(room()?.category); }
function players() { return rows('mystery_players'); }
function sortedQuestions() {
  // Same ordering the UI sees: MysteryGame sorts by round_number (stable).
  return [...rows('mystery_questions')].sort((a, b) => a.round_number - b.round_number);
}
function isHint(q) { return q.question_text?.startsWith('[HINT]'); }
function askingPlayers() {
  return players().filter(p => !p.is_eliminated)
    .sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime());
}
function activePlayers() { return players().filter(p => !p.is_eliminated && !p.word_revealed); }
function nextAskerAfter(fromId) {
  const sorted = askingPlayers();
  if (!sorted.length) return null;
  const i = sorted.findIndex(p => p.user_id === fromId);
  return sorted[(i + 1) % sorted.length]?.user_id || sorted[0].user_id;
}
function latestQuestion() { const qs = sortedQuestions(); return qs[qs.length - 1] || null; }
function questionPending(q) {
  if (!q || q.status !== 'answering') return false;
  const nonAskers = activePlayers().filter(p => p.user_id !== q.asker_id);
  return !nonAskers.every(p => (q.answers || {})[p.user_id] !== undefined);
}
function hintState() {
  const qs = sortedQuestions();
  const normal = qs.filter(q => !isHint(q));
  const lastNormal = normal[normal.length - 1];
  const perCycle = Math.max(askingPlayers().length, 1) * 5;
  const phaseNumber = Math.floor(normal.length / perCycle);
  const inPhase = (!lastNormal || lastNormal.status === 'complete')
    && phaseNumber > 0 && normal.length % perCycle === 0;
  const submitted = (uid) => qs.some(q => isHint(q) && q.asker_id === uid && Number(q.round_number) === phaseNumber);
  const allIn = inPhase && activePlayers().every(p => submitted(p.user_id));
  return { inPhase, phaseNumber, allIn, submitted };
}
function revealAllSecrets() {
  for (const p of players()) {
    const secret = state.secrets.get(p.user_id);
    if (secret !== undefined) void update('mystery_players', p.id, { secret_word: secret });
  }
}

// ── gameplay RPCs (local versions of migrations 0007/0010/0011/0012) ───────
export async function rpc(name, params = {}) {
  const ok = (data) => ({ data, error: null });
  const r = room();

  if (name === 'mystery_set_status') {
    if (!r) return ok({ ok: false, reason: 'no_room' });
    if (r.status !== params.p_from) return ok({ ok: false, reason: 'stale', status: r.status });
    const to = params.p_to;
    if (to === 'word_entry') {
      if (players().length < 2) return ok({ ok: false, reason: 'need_players' });
      await update('mystery_rooms', r.id, {
        status: 'word_entry',
        question_deadline: new Date(serverNow() + WORD_ENTRY_TIMER_MS).toISOString(),
      });
    } else if (to === 'playing') {
      const roster = players();
      if (roster.length < 2 || roster.some(p => !p.word_submitted)) {
        return ok({ ok: false, reason: 'not_all_submitted' });
      }
      await update('mystery_rooms', r.id, {
        status: 'playing',
        current_questioner_id: params.p_questioner_id ?? null,
        current_questioner_index: 0,
        round_number: 1,
        question_deadline: new Date(serverNow() + QUESTION_TIMER_MS).toISOString(),
      });
    } else if (to === 'lobby') {
      state.secrets.clear();
      for (const p of players()) await update('mystery_players', p.id, { word_submitted: false, secret_word: '' });
      await update('mystery_rooms', r.id, { status: 'lobby', question_deadline: null });
      resetBotWords();
    } else if (to === 'finished') {
      if (activePlayers().length > 1) return ok({ ok: false, reason: 'not_finished' });
      revealAllSecrets();
      await update('mystery_rooms', r.id, { status: 'finished' });
    } else {
      return ok({ ok: false, reason: 'bad_transition' });
    }
    return ok({ ok: true });
  }

  if (name === 'submit_mystery_word') {
    if (!r || r.status !== 'word_entry') return ok({ ok: false, reason: 'not_word_entry' });
    if (!normalizeWord(params.p_word || '')) return ok({ ok: false, reason: 'bad_word' });
    const p = players().find(x => x.user_id === params.p_user);
    if (!p) return ok({ ok: false, reason: 'not_member' });
    state.secrets.set(params.p_user, params.p_word);
    await update('mystery_players', p.id, { word_submitted: true });
    return ok({ ok: true });
  }

  if (name === 'post_mystery_question') {
    // Mirror of migration 0017: atomic post + turn advance. Single-threaded
    // here, but the checks keep parity with the server (and the bots use the
    // same path as the UI).
    if (!r || r.status !== 'playing') return ok({ ok: false, reason: 'not_playing' });
    const askerRow = players().find(p => p.user_id === params.p_asker && !p.is_eliminated);
    if (!askerRow) return ok({ ok: false, reason: 'not_member' });
    if (r.current_questioner_id && r.current_questioner_id !== params.p_asker) {
      return ok({ ok: false, reason: 'not_your_turn' });
    }
    const qCount = rows('mystery_questions').length;
    if (params.p_known_count !== null && params.p_known_count !== undefined && qCount !== params.p_known_count) {
      return ok({ ok: false, reason: 'stale' });
    }
    const latest = latestQuestion();
    if (latest && !isHint(latest) && questionPending(latest)) {
      return ok({ ok: false, reason: 'question_pending' });
    }
    const text = (params.p_text || '').trim().slice(0, 200);
    if (!text) return ok({ ok: false, reason: 'empty' });
    await create('mystery_questions', {
      room_code: r.room_code, round_number: r.round_number, question_text: text,
      asker_id: params.p_asker, asker_name: askerRow.display_name,
      is_ai: !!params.p_is_ai, answers: {}, status: 'answering',
    });
    await update('mystery_rooms', r.id, {
      round_number: r.round_number + 1,
      current_questioner_id: nextAskerAfter(params.p_asker),
      current_questioner_index: (r.current_questioner_index + 1) % Math.max(askingPlayers().length, 1),
      question_deadline: new Date(serverNow() + QUESTION_TIMER_MS).toISOString(),
    });
    return ok({ ok: true });
  }

  if (name === 'submit_mystery_answer') {
    const q = rows('mystery_questions').find(x => x.id === params.q_id);
    if (!q) return ok({ ok: false, reason: 'no_question' });
    const answers = { ...(q.answers || {}), [params.answerer_id]: params.answer };
    const nonAskers = activePlayers().filter(p => p.user_id !== q.asker_id);
    const allAnswered = nonAskers.every(p => answers[p.user_id] !== undefined);
    await update('mystery_questions', q.id, { answers, status: allAnswered ? 'complete' : 'answering' });
    // GAME-N4: completing a question refreshes the next asker's shared deadline.
    if (allAnswered && r) {
      await update('mystery_rooms', r.id, { question_deadline: new Date(serverNow() + QUESTION_TIMER_MS).toISOString() });
    }
    return ok({ ok: true });
  }

  if (name === 'resolve_stalled_question') {
    const q = rows('mystery_questions').find(x => x.id === params.p_question_id);
    if (q && q.status === 'answering') {
      await update('mystery_questions', q.id, { status: 'complete' });
      if (r) await update('mystery_rooms', r.id, { question_deadline: new Date(serverNow() + QUESTION_TIMER_MS).toISOString() });
    }
    return ok({ ok: true });
  }

  if (name === 'submit_mystery_guess') {
    if (!r || r.status !== 'playing') return ok({ ok: false, reason: 'not_playing' });
    const guesser = players().find(p => p.user_id === params.p_guesser_id);
    const target = players().find(p => p.id === params.p_target_player_id);
    if (!guesser || guesser.is_eliminated) return ok({ ok: false, reason: 'not_member' });
    if (!target || target.is_eliminated || target.word_revealed) return ok({ ok: false, reason: 'bad_target' });
    if (target.user_id === guesser.user_id) return ok({ ok: false, reason: 'self' });
    const qCount = rows('mystery_questions').length;
    const cooldownAt = (guesser.last_guess_at_question_count || 0) + Math.max(activePlayers().length, 1);
    if ((guesser.last_guess_at_question_count || 0) > 0 && qCount < cooldownAt) {
      return ok({ ok: false, reason: 'cooldown' });
    }
    const secret = state.secrets.get(target.user_id) || '';
    const correct = !!secret && normalizeWord(params.p_guessed || '') === normalizeWord(secret);
    await create('mystery_guesses', {
      room_code: r.room_code,
      guesser_id: guesser.user_id,
      guesser_name: params.p_guesser_name || guesser.display_name,
      // Stored as the target's user_id (matching migration 0012) — every
      // reader (Notebook, correct-guess alert, re-guess filter) compares this
      // against user ids.
      target_player_id: target.user_id,
      target_player_name: target.display_name,
      guessed_word: params.p_guessed,
      correct,
    });
    await update('mystery_players', guesser.id, { last_guess_at_question_count: qCount });
    if (!correct) return ok({ correct: false });
    await update('mystery_players', target.id, { word_revealed: true, secret_word: secret });
    await update('mystery_players', guesser.id, { score: (guesser.score || 0) + 1 });
    if (activePlayers().length <= 1) {
      revealAllSecrets();
      await update('mystery_rooms', r.id, { status: 'finished' });
    }
    return ok({ correct: true, revealed_word: secret });
  }

  if (name === 'play_again_mystery') {
    if (!r || r.status !== 'finished') return ok({ ok: false, reason: 'not_finished' });
    for (const q of [...rows('mystery_questions')]) await remove('mystery_questions', q.id);
    for (const g of [...rows('mystery_guesses')]) await remove('mystery_guesses', g.id);
    state.secrets.clear();
    for (const p of players()) {
      await update('mystery_players', p.id, {
        secret_word: '', word_submitted: false, word_revealed: false,
        is_eliminated: false, last_guess_at_question_count: 0,
      });
    }
    // Deviation from the server RPC (which clears category): a practice room
    // keeps it, so the host lands back in the lobby with Start ready to tap.
    await update('mystery_rooms', r.id, {
      status: 'lobby', round_number: 1, current_questioner_index: 0,
      current_questioner_id: null, question_deadline: null, category: r.category || DEFAULT_PRACTICE_CATEGORY,
    });
    resetBotWords();
    return ok({ ok: true });
  }

  return ok({ ok: false, reason: 'unknown_rpc' });
}

export async function secretSubmit(roomCode, userId, word) {
  const { data } = await rpc('submit_mystery_word', { p_room: roomCode, p_user: userId, p_word: word });
  if (data && data.ok === false) throw new Error(data.reason || 'submit_failed');
}
export async function secretClearRoom(_roomCode) { state.secrets.clear(); }

// ── the bot driver ─────────────────────────────────────────────────────────
function schedule(key, delayMs, fn) {
  if (state.pending.has(key)) return;
  state.pending.set(key, setTimeout(async () => {
    state.pending.delete(key);
    if (!state.active) return;
    try { await fn(); } catch { /* practice bots fail silently */ }
    scheduleTick();
  }, delayMs));
}

let tickTimer = null;
function scheduleTick() {
  if (!state.active || tickTimer) return;
  tickTimer = setTimeout(() => { tickTimer = null; tick(); }, 150);
}

function resetBotWords() {
  for (const bot of state.bots) {
    bot.word = null;
    bot.commit = null;
    bot.candidates = new Map();
    bot.asked = new Set();
    bot.processed = new Set();
    bot.hinted = new Set();
  }
  state.wordCycle += 1;
}

function botRow(bot) { return players().find(p => p.user_id === bot.userId); }

function candidatesFor(bot, targetUid) {
  if (!bot.candidates.has(targetUid)) bot.candidates.set(targetUid, wordsFor(room()?.category));
  return bot.candidates.get(targetUid);
}

function tick() {
  if (!state.active) return;
  const r = room();
  if (!r) return;

  if (r.status === 'lobby') {
    // Bots stroll in a moment after the room appears.
    state.bots.forEach((bot, i) => {
      if (botRow(bot)) return;
      schedule(`join:${bot.userId}`, 700 + i * 900, async () => {
        if (!room() || room().status !== 'lobby' || botRow(bot)) return;
        await create('mystery_players', {
          room_code: state.roomCode, user_id: bot.userId, display_name: bot.name,
          score: 0, word_submitted: false, word_revealed: false, is_eliminated: false, color: bot.color,
        });
      });
    });
    if (!r.category) schedule('category', 400, () => update('mystery_rooms', r.id, { category: DEFAULT_PRACTICE_CATEGORY }));
    return;
  }

  if (r.status === 'word_entry') {
    for (const bot of state.bots) {
      const row = botRow(bot);
      if (!row || row.word_submitted) continue;
      schedule(`word:${bot.userId}:${state.wordCycle}`, rand(1500, 4500), async () => {
        const fresh = botRow(bot);
        if (!fresh || fresh.word_submitted || room()?.status !== 'word_entry') return;
        bot.word = pick(wordsFor(room()?.category));
        bot.commit = makeCommit(activeMatrix(), bot.word);
        bot.candidates = new Map();
        bot.asked = new Set();
        bot.processed = new Set();
        bot.hinted = new Set();
        await rpc('submit_mystery_word', { p_room: state.roomCode, p_user: bot.userId, p_word: bot.word });
      });
    }
    return;
  }

  if (r.status === 'playing') {
    const qs = sortedQuestions();
    const latest = latestQuestion();
    const hint = hintState();

    // 1. Learn from every recorded answer (bots hear everyone's answers).
    const matrix = activeMatrix();
    for (const q of qs) {
      if (isHint(q)) continue;
      const matched = matchQuestion(matrix, q.question_text);
      for (const [uid, ans] of Object.entries(q.answers || {})) {
        for (const bot of state.bots) {
          if (uid === bot.userId) continue;
          const key = `${q.id}:${uid}:${bot.userId}`;
          if (bot.processed.has(key)) continue;
          bot.processed.add(key);
          if (matched && Math.random() >= FORGET_P) {
            bot.candidates.set(uid, filterCandidates(matrix, candidatesFor(bot, uid), matched, ans === true));
          }
        }
      }
    }

    // 2. Answer a pending question (honestly, from the matrix).
    if (latest && !isHint(latest) && latest.status === 'answering') {
      for (const bot of state.bots) {
        const row = botRow(bot);
        if (!row || row.is_eliminated || row.word_revealed) continue;
        if (latest.asker_id === bot.userId) continue;
        if ((latest.answers || {})[bot.userId] !== undefined) continue;
        schedule(`answer:${bot.userId}:${latest.id}`, rand(1200, 3800), async () => {
          const q = rows('mystery_questions').find(x => x.id === latest.id);
          const fresh = botRow(bot);
          if (!q || q.status !== 'answering' || !fresh || fresh.is_eliminated || fresh.word_revealed) return;
          if ((q.answers || {})[bot.userId] !== undefined) return;
          const matched = matchQuestion(activeMatrix(), q.question_text);
          const answer = matched && bot.word
            ? answerFor(activeMatrix(), bot.word, matched, bot.commit || {})
            : fallbackAnswer();
          await rpc('submit_mystery_answer', { q_id: q.id, answerer_id: bot.userId, answer });
        });
      }
    }

    // 3. Hint round: each active bot shares one true fact about its word.
    if (hint.inPhase && !hint.allIn) {
      for (const bot of state.bots) {
        const row = botRow(bot);
        if (!row || row.is_eliminated || row.word_revealed) continue;
        if (hint.submitted(bot.userId)) continue;
        schedule(`hint:${bot.userId}:${hint.phaseNumber}`, rand(2000, 6000), async () => {
          const h = hintState();
          if (!h.inPhase || h.submitted(bot.userId) || !bot.word) return;
          const langKey = room()?.language === 'nl' ? 'nl' : 'en';
          const bank = hintQuestions(activeMatrix());
          const truths = bank.filter(q =>
            !bot.hinted.has(q.id) && answerFor(activeMatrix(), bot.word, q.id, bot.commit || {}));
          const q = truths.length ? pick(truths) : pick(bank);
          bot.hinted.add(q.id);
          const yes = answerFor(activeMatrix(), bot.word, q.id, bot.commit || {});
          await create('mystery_questions', {
            room_code: state.roomCode, round_number: h.phaseNumber,
            question_text: `[HINT] ${q[langKey]} ${yes ? '✅' : '❌'}`,
            asker_id: bot.userId, asker_name: bot.name, is_ai: false, answers: {}, status: 'complete',
          });
          // Last hint in → refresh the turn deadline, like submitHint does.
          if (hintState().allIn) {
            const rr = room();
            if (rr) await update('mystery_rooms', rr.id, { question_deadline: new Date(serverNow() + QUESTION_TIMER_MS).toISOString() });
          }
        });
      }
      return; // question flow stays blocked during the break
    }

    // 4. On its turn: maybe guess, then ask.
    const asker = askingPlayers().find(p => p.user_id === r.current_questioner_id);
    const bot = state.bots.find(b => asker && b.userId === asker.user_id);
    if (bot && !questionPending(latest)) {
      const row = botRow(bot);
      if (row && !row.is_eliminated) {
        // Guess when the cooldown allows and some opponent is pinned down.
        const qCount = rows('mystery_questions').length;
        const canGuess = qCount >= (row.last_guess_at_question_count || 0) + Math.max(activePlayers().length, 1);
        const targets = players().filter(p => p.user_id !== bot.userId && !p.is_eliminated && !p.word_revealed);
        const ready = canGuess ? targets
          .map(p => ({ p, cands: candidatesFor(bot, p.user_id) }))
          .filter(x => x.cands.length > 0 && x.cands.length <= 2)
          .sort((a, b) => a.cands.length - b.cands.length)[0] : null;
        if (ready) {
          schedule(`guess:${bot.userId}:${qCount}`, rand(1800, 3500), async () => {
            const fresh = botRow(bot);
            const target = players().find(p => p.id === ready.p.id);
            if (!fresh || fresh.is_eliminated || !target || target.word_revealed || room()?.status !== 'playing') return;
            const word = pick(candidatesFor(bot, target.user_id));
            const { data } = await rpc('submit_mystery_guess', {
              p_room: state.roomCode, p_guesser_id: bot.userId, p_guesser_name: bot.name,
              p_target_player_id: target.id, p_guessed: word,
            });
            if (data && data.correct === false) {
              bot.candidates.set(target.user_id, candidatesFor(bot, target.user_id).filter(w => w !== word));
            }
          });
        }
        // Ask: pick the highest-information question for the tightest target.
        schedule(`ask:${bot.userId}:${qs.length}`, rand(2500, 5500), async () => {
          const rr = room();
          if (!rr || rr.status !== 'playing') return;
          if (rr.current_questioner_id !== bot.userId) return;
          if (questionPending(latestQuestion())) return;
          if (hintState().inPhase && !hintState().allIn) return;
          const fresh = botRow(bot);
          if (!fresh || fresh.is_eliminated) return;
          const opponents = players().filter(p => p.user_id !== bot.userId && !p.is_eliminated && !p.word_revealed);
          const m = activeMatrix();
          const focus = opponents
            .map(p => candidatesFor(bot, p.user_id))
            .filter(c => c.length > 1)
            .sort((a, b) => a.length - b.length)[0] || wordsFor(room()?.category);
          const alreadyAsked = new Set([...bot.asked]);
          for (const q of sortedQuestions()) {
            if (!isHint(q)) { const mm = matchQuestion(m, q.question_text); if (mm) alreadyAsked.add(mm); }
          }
          const q = pickBotQuestion(m, focus, [...alreadyAsked], 'normal') || pickBotQuestion(m, focus, [...bot.asked], 'normal');
          if (!q) return;
          bot.asked.add(q.id);
          const langKey = rr.language === 'nl' ? 'nl' : 'en';
          await rpc('post_mystery_question', {
            p_room: state.roomCode, p_asker: bot.userId, p_text: q[langKey], p_is_ai: false,
          });
        });
      }
    }
    return;
  }

  if (r.status === 'finished') {
    const key = `gg:${state.wordCycle}`;
    if (!state.pending.has(key) && !state.ggSent?.has(state.wordCycle)) {
      (state.ggSent ||= new Set()).add(state.wordCycle);
      const bot = pick(state.bots);
      schedule(key, rand(1500, 3000), async () => {
        if (room()?.status !== 'finished' || !botRow(bot)) return;
        await create('mystery_chats', {
          room_code: state.roomCode, user_id: bot.userId, display_name: bot.name,
          color: bot.color, message: 'GG 🎉', has_emote: true, emote: '🎉',
        });
      });
    }
  }
}

// The practice room dies the moment the human is out of it: their row gone or
// eliminated (Leave), or the host handed off to a bot (leaveRoom's handoff on
// the way home). Delay a beat so in-flight leave writes finish first. Only
// armed once the human's row has existed — a nameless invite-gate visitor
// joins a few seconds after the room is created.
function checkLifecycle() {
  if (!state.active) return;
  const r = room();
  const human = players().find(p => p.user_id === state.humanId);
  if (human) state.humanJoined = true;
  if (!r) { schedule('destroy', 1500, destroy); return; }
  if (!state.humanJoined) return;
  if (!human || human.is_eliminated || r.host_id !== state.humanId) {
    schedule('destroy', 1500, destroy);
  }
}

export function destroy() {
  state.active = false;
  for (const id of state.pending.values()) clearTimeout(id);
  state.pending.clear();
  clearTimeout(tickTimer); tickTimer = null;
  clearInterval(state.interval); state.interval = null;
  state.tables = {};
  state.secrets.clear();
  state.bots = [];
  state.ggSent = new Set();
  state.roomCode = null;
  state.humanId = null;
  state.humanJoined = false;
}

// ── entry point ────────────────────────────────────────────────────────────
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BOT_COLORS = ['#ec4899', '#10b981'];

export function createPracticeGame({ hostId, hostName, lang }) {
  destroy();
  state.active = true;
  state.humanId = hostId;
  state.roomCode = PREFIX + Array.from({ length: 3 }, () => pick(CODE_CHARS.split(''))).join('');
  for (const t of TABLES) state.tables[t] = [];
  state.wordCycle = 0;

  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, 2);
  state.bots = names.map((name, i) => ({
    userId: `bot_${Math.random().toString(36).slice(2, 9)}`,
    name, color: BOT_COLORS[i],
    word: null, commit: null, candidates: new Map(),
    asked: new Set(), processed: new Set(), hinted: new Set(),
  }));

  void create('mystery_rooms', {
    room_code: state.roomCode, host_id: hostId, host_name: hostName || '',
    status: 'lobby', current_questioner_index: 0, round_number: 1, max_rounds: 10,
    is_public: false, language: lang || 'en', category: DEFAULT_PRACTICE_CATEGORY, question_deadline: null,
  });
  if (hostName) {
    void create('mystery_players', {
      room_code: state.roomCode, user_id: hostId, display_name: hostName,
      score: 0, word_submitted: false, word_revealed: false, is_eliminated: false, color: '#6366f1',
    });
  }
  // Safety net for purely time-based conditions (nothing emits an event when
  // a delay elapses) — cheap, and only while a practice room is live.
  state.interval = setInterval(() => scheduleTick(), 2000);
  scheduleTick();
  return state.roomCode;
}
