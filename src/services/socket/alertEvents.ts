import type { Socket } from 'socket.io-client';
import type { PeerAlert } from '../../types/models';

// Listen wrapper for incoming peer alerts — private, emitted only to the
// recipient's own `user:<id>` room (see AlertsService.send on the backend),
// never a broadcast. Sending is a plain REST call (alerts.api.ts), so there's
// no matching `emit` here.
export function onPeerAlert(socket: Socket, callback: (alert: PeerAlert) => void): () => void {
  socket.on('peer-alert', callback);
  return () => socket.off('peer-alert', callback);
}
