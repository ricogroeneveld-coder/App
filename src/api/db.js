import { supabase } from '@/lib/supabaseClient';
import { serverNow } from '@/lib/serverTime';

const rpcMissing = (error) => error && (error.code === 'PGRST202' || error.code === '42883'
  || /does not exist|could not find the function/i.test(error.message || ''));

// Thin wrapper around Supabase's client that mimics the small slice of the
// base44 entities SDK this app used (`filter`, `create`, `update`, `delete`,
// `subscribe`). Keeping the same shape meant every call site in the app
// (Home, MysteryGame, LobbyPhase, PlayingPhase, GuessModal, ChatPanel, ...)
// only had to change its import, not its logic.
//
// Every table here has fully open row-level-security policies (see
// supabase/migrations/0001_init.sql) — anyone with the public anon key can
// read/write any row. That mirrors this app's original design: there's no
// login system, "identity" is just a random guest ID a player picks for
// themselves, and the game only works if every player in a room can freely
// read and write the shared room/players/questions/guesses/chat state. Don't
// put anything sensitive in these tables.

// NET-6: a Supabase one-shot request (a dead socket, a stalled fetch, a proxy
// black hole) can hang forever with no error, leaving the caller spinning on
// an await that never settles. Race every one-shot query against a timeout
// that REJECTS, so the caller's existing try/catch surfaces an error instead
// of the UI hanging. The realtime `.subscribe` path is deliberately NOT
// wrapped — it's a long-lived channel, not a request that should time out.
const REQUEST_TIMEOUT_MS = 10000;

function withTimeout(thenable, table) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Supabase ${table} request timed out`)),
      REQUEST_TIMEOUT_MS
    );
  });
  // Promise.race accepts the PostgREST builder (a thenable); awaiting it kicks
  // off the request exactly once. clearTimeout stops the pending rejection from
  // firing (and leaking the timer) once the real call wins the race.
  return Promise.race([Promise.resolve(thenable), timeout]).finally(() => clearTimeout(timer));
}

function createEntity(table) {
  return {
    /**
     * @param {Object} query - equality filters, e.g. { room_code: 'ABCD' }
     * @param {string} [sort] - column name; prefix with "-" for descending.
     *                          Defaults to "created_date" ascending.
     * @param {number} [limit]
     */
    async filter(query = {}, sort, limit) {
      let q = supabase.from(table).select('*');
      for (const [key, value] of Object.entries(query)) {
        q = q.eq(key, value);
      }
      const sortSpec = sort || 'created_date';
      const descending = sortSpec.startsWith('-');
      q = q.order(descending ? sortSpec.slice(1) : sortSpec, { ascending: !descending });
      if (limit) q = q.limit(limit);
      const { data, error } = await withTimeout(q, table); // NET-6
      if (error) throw error;
      return data;
    },

    async create(fields) {
      const { data, error } = await withTimeout(
        supabase.from(table).insert(fields).select().single(), table); // NET-6
      if (error) throw error;
      return data;
    },

    async update(id, patch) {
      const { data, error } = await withTimeout(
        supabase.from(table).update(patch).eq('id', id).select().single(), table); // NET-6
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await withTimeout(
        supabase.from(table).delete().eq('id', id), table); // NET-6
      if (error) throw error;
      return true;
    },

    /**
     * Subscribes to INSERT/UPDATE/DELETE on this table (Supabase Realtime).
     * Returns an unsubscribe function.
     *
     * @param {(status: string, err?: Error) => void} [onStatus] - optional;
     *   called with the underlying channel's status ('SUBSCRIBED',
     *   'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED') whenever it changes, so a
     *   caller can surface a dropped connection instead of silently going
     *   stale.
     * @param {string} [filter] - optional server-side realtime filter, e.g.
     *   `room_code=eq.ABCD12`. Without it every client receives every row
     *   change across ALL rooms (and traffic scales with total app usage,
     *   not room size) — pass one wherever the caller only cares about a
     *   single room. Callers must still re-check the payload: DELETE events
     *   match against the OLD row (REPLICA IDENTITY FULL makes that work).
     */
    subscribe(callback, onStatus, filter) {
      const channelName = `${table}-${Math.random().toString(36).slice(2)}`;
      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, (payload) => {
          const type = payload.eventType === 'INSERT' ? 'create'
            : payload.eventType === 'DELETE' ? 'delete'
            : 'update';
          const data = type === 'delete' ? payload.old : payload.new;
          callback({ type, data });
        })
        .subscribe((status, err) => { onStatus?.(status, err); });
      return () => { supabase.removeChannel(channel); };
    },
  };
}

export const MysteryRoom = createEntity('mystery_rooms');

// Room status changes ONLY through the validated server RPC (migration 0012):
// the client can no longer write `status` directly, so force-finish (which
// leaked every secret via the reveal trigger), premature start, and mid-game
// reset are impossible. The RPC mints phase deadlines server-side too, so a
// skewed device clock can't shorten them for everyone (GAME-N6).
//   from/to ∈ 'lobby' | 'word_entry' | 'playing' | 'finished'
//   opts.questionerId — first asker's user_id (only for → 'playing')
// Returns { ok, reason }. Falls back to a best-effort direct write only if the
// RPC isn't deployed yet (in which case status isn't revoked either).
MysteryRoom.setStatus = async (roomCode, from, to, opts = {}) => {
  const { data, error } = await supabase.rpc('mystery_set_status', {
    p_room: roomCode, p_from: from, p_to: to, p_questioner_id: opts.questionerId ?? null,
  });
  if (!error) return data || { ok: true };
  if (!rpcMissing(error)) throw error;
  // Pre-0012 fallback: status isn't revoked yet, so replicate the RPC's writes.
  const rooms = await MysteryRoom.filter({ room_code: roomCode });
  const r = rooms?.[0];
  if (!r) return { ok: false, reason: 'no_room' };
  if (to === 'word_entry') {
    await MysteryRoom.update(r.id, { status: 'word_entry', question_deadline: new Date(serverNow() + 60000).toISOString() });
  } else if (to === 'playing') {
    await MysteryRoom.update(r.id, { status: 'playing', current_questioner_id: opts.questionerId ?? null, current_questioner_index: 0, round_number: 1, question_deadline: new Date(serverNow() + 30000).toISOString() });
  } else if (to === 'lobby') {
    await supabase.from('mystery_secrets').delete().eq('room_code', roomCode).then(() => {}, () => {});
    await supabase.from('mystery_players').update({ word_submitted: false, secret_word: '' }).eq('room_code', roomCode);
    await MysteryRoom.update(r.id, { status: 'lobby', question_deadline: null });
  } else if (to === 'finished') {
    await MysteryRoom.update(r.id, { status: 'finished' });
  }
  return { ok: true };
};
export const MysteryPlayer = createEntity('mystery_players');
export const MysteryQuestion = createEntity('mystery_questions');
export const MysteryGuess = createEntity('mystery_guesses');
export const MysteryChat = createEntity('mystery_chats');

// Secret words live in their own table with NO select policy and are NOT in
// the Realtime publication (migration 0007), so a raw secret never reaches a
// client. Write-only from the browser: a player sets/updates/clears their own
// word; correctness is judged server-side by the submit_mystery_guess RPC.
export const MysterySecret = {
  // Lock a player's word in. Prefers the SECURITY DEFINER RPC (migration 0010),
  // which writes the secret AND flips word_submitted while bypassing RLS — so a
  // policy misconfig on mystery_secrets can't block lock-in. Falls back to the
  // direct writes if the RPC isn't deployed yet (needs the mystery_secrets
  // insert policy present).
  async submit(roomCode, userId, word) {
    const { data, error } = await supabase.rpc('submit_mystery_word', {
      p_room: roomCode, p_user: userId, p_word: word,
    });
    if (!error) {
      // 0012 returns { ok, reason }; a rejection (room already started, or an
      // empty/unguessable word) should surface, not silently no-op.
      if (data && data.ok === false) {
        throw new Error(data.reason || 'submit_failed');
      }
      return;
    }
    if (!rpcMissing(error)) throw error;
    await MysterySecret.set(roomCode, userId, word);
    const { error: pErr } = await supabase.from('mystery_players')
      .update({ word_submitted: true }).eq('room_code', roomCode).eq('user_id', userId);
    if (pErr) throw pErr;
  },
  async set(roomCode, userId, word) {
    const { error } = await supabase
      .from('mystery_secrets')
      .upsert(
        { room_code: roomCode, user_id: userId, word, updated_date: new Date().toISOString() },
        { onConflict: 'room_code,user_id' }
      );
    if (error) throw error;
  },
  async clearRoom(roomCode) {
    const { error } = await supabase.from('mystery_secrets').delete().eq('room_code', roomCode);
    if (error) throw error;
  },
};
