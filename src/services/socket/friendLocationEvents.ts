import type { Socket } from 'socket.io-client';
import type { FriendPosition } from '../../types/models';

// Emit/listen wrappers for the Friends-tab live map — a friend-graph broadcast
// (your position goes out to whoever has you added back), distinct from
// locationEvents.ts's group-room events, which remain stubs (see CLAUDE.md).

export function emitFriendLocationUpdate(socket: Socket, coords: { latitude: number; longitude: number }): void {
  socket.emit('friend:location:update', coords);
}

export function onFriendPosition(socket: Socket, callback: (position: FriendPosition) => void): () => void {
  socket.on('friend:location', callback);
  return () => socket.off('friend:location', callback);
}
