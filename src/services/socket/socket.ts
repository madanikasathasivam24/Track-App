import { io, Socket } from 'socket.io-client';

// Singleton socket instance — not connected yet. Full real-time wiring comes after
// Auth + GroupsListScreen is reviewed (see WHAT NOT TO BUILD YET).
let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io(process.env.EXPO_PUBLIC_API_URL, {
    transports: ['websocket'],
    auth: { token },
    autoConnect: false,
  });
  socket.connect();
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
