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
     * Subscribes to every INSERT/UPDATE/DELETE on this table (Supabase
     * Realtime, not filtered server-side — call sites filter by room_code
     * themselves once the payload arrives, same as the old base44 events).
     * Returns an unsubscribe function.
     *
     * @param {(status: string, err?: Error) => void} [onStatus] - optional;
     *   called with the underlying channel's status ('SUBSCRIBED',
     *   'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED') whenever it changes, so a
     *   caller can surface a dropped connection instead of silently going
     *   stale.
     */
    subscribe(callback, onStatus) {
      const channelName = `${table}-${Math.random().toString(36).slice(2)}`;
      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
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
