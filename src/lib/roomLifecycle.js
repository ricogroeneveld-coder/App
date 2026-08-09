import { MysteryPlayer, MysteryRoom } from '@/api/db';

/**
 * Leaving-room cleanup shared by every phase. Only LobbyPhase used to do
 * this — Word Entry, Playing, and Finished all let a departing host take
 * `room.host_id` with them, permanently stranding everyone else (nothing
 * but the host can advance "Everyone Ready" / "Play Again"). Centralizing
 * the hand-off here means every exit path gets it for free.
 *
 * mode: 'delete' removes the caller's player row outright (lobby, word
 * entry, finished — nothing to resume). 'eliminate' flags it eliminated
 * instead, matching PlayingPhase's existing rejoin support (see
 * MysteryGame's isEliminated screen), so leaving mid-round still lets the
 * player rejoin later.
 */
export async function leaveRoom({ room, players, me, myPlayer, mode = 'delete' }) {
  if (!room || !me) return;

  const remaining = players.filter(p => p.user_id !== me.id && !p.is_eliminated);

  if (myPlayer) {
    if (mode === 'eliminate') {
      await MysteryPlayer.update(myPlayer.id, { is_eliminated: true });
    } else {
      await MysteryPlayer.delete(myPlayer.id);
    }
  }

  if (room.host_id === me.id) {
    if (remaining.length === 0) {
      await MysteryRoom.delete(room.id);
    } else {
      await MysteryRoom.update(room.id, {
        host_id: remaining[0].user_id,
        host_name: remaining[0].display_name,
      });
    }
  }
}
