import { supabase } from '@/lib/supabaseClient';

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
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },

    async create(fields) {
      const { data, error } = await supabase.from(table).insert(fields).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, patch) {
      const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
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
export const MysteryPlayer = createEntity('mystery_players');
export const MysteryQuestion = createEntity('mystery_questions');
export const MysteryGuess = createEntity('mystery_guesses');
export const MysteryChat = createEntity('mystery_chats');

// Secret words live in their own table with NO select policy and are NOT in
// the Realtime publication (migration 0007), so a raw secret never reaches a
// client. Write-only from the browser: a player sets/updates/clears their own
// word; correctness is judged server-side by the submit_mystery_guess RPC.
export const MysterySecret = {
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
