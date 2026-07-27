import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';

let io = null;

function room(conversationId) {
  return `conversation:${conversationId}`;
}

/** Attach Socket.IO to the existing HTTP server for real-time Super-Chat sync
 * across the User app, Partner app, and Admin web dashboard. */
export function initChatSocket(server) {
  io = new Server(server, {
    path: '/socket.io',
    cors: { origin: '*' },
  });

  io.use((socket, next) => {
    const { token, role } = socket.handshake.auth || {};
    if (!token || !role || !['user', 'partner', 'admin'].includes(role)) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyToken(token, role);
      if (payload.role !== role) return next(new Error('Invalid token for this resource'));
      socket.data.role = role;
      socket.data.subjectId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_conversation', (conversationId) => {
      if (conversationId) socket.join(room(conversationId));
    });
    socket.on('leave_conversation', (conversationId) => {
      if (conversationId) socket.leave(room(conversationId));
    });
  });

  return io;
}

export function emitToConversation(conversationId, event, payload) {
  if (!io) return;
  io.to(room(conversationId)).emit(event, payload);
}
