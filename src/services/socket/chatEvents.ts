import type { Socket } from 'socket.io-client';
import type { ChatMessage } from '../../types/models';

// Listen wrapper for the group chat's fan-out broadcast (see ChatService.send
// on the backend — every other group member's `user:<id>` room gets this,
// no dedicated chat room). Sending is a plain REST call (chat.api.ts).
export function onGroupMessage(socket: Socket, callback: (message: ChatMessage) => void): () => void {
  socket.on('group:message', callback);
  return () => socket.off('group:message', callback);
}
