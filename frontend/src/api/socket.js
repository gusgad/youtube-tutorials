import { io } from 'socket.io-client';
import { getToken } from './client.js';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io',
      auth: { token: getToken() },
      autoConnect: true,
    });
  }
  return socket;
}
