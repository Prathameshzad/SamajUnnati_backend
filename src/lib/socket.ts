// src/lib/socket.ts
/**
 * Authenticated Socket.IO layer.
 *
 * The previous implementation had no authentication whatsoever:
 *
 *     io = new Server(server, { cors: { origin: '*' } });
 *     socket.on('join', async (userId) => { socket.join(userId); ... });
 *
 * Rooms are keyed by user ID, and the ID came straight from the client. Any
 * anonymous websocket client could therefore:
 *   - join an arbitrary user's room and receive their notifications, private
 *     score events and `conversation:new` payloads,
 *   - enumerate a victim's conversation IDs (the handler looked up and joined
 *     every conversation for the supplied ID),
 *   - emit `typing:*` into any conversation room.
 *
 * Now: the handshake requires a valid JWT, the room is derived from the verified
 * token, and conversation rooms are only joined after a membership check.
 */
import { Server, type Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import prisma from './prisma';
import { verifyAuthToken } from './jwt';
import { config } from '../config/env';
import { createLogger } from './logger';

const log = createLogger('socket');

let io: Server | null = null;

interface SocketUser {
  id: string;
  phone: string;
}

/** Typed accessor for the authenticated user attached during the handshake. */
const socketUser = (socket: Socket): SocketUser | undefined => (socket.data as any).user;

/**
 * Pulls a bearer token from the places socket.io-client can supply one.
 * `auth.token` is the documented mechanism; the others are accepted so older
 * app builds that have not been updated yet keep a path to authenticate.
 */
function extractToken(socket: Socket): string | null {
  const auth = socket.handshake.auth as Record<string, unknown> | undefined;
  const fromAuth = auth?.token;
  if (typeof fromAuth === 'string' && fromAuth.trim()) {
    return fromAuth.replace(/^Bearer[ ]+/i, '').trim();
  }

  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.trim()) {
    return header.replace(/^Bearer[ ]+/i, '').trim();
  }

  const fromQuery = socket.handshake.query?.token;
  const queryToken = Array.isArray(fromQuery) ? fromQuery[0] : fromQuery;
  if (typeof queryToken === 'string' && queryToken.trim()) {
    return queryToken.replace(/^Bearer[ ]+/i, '').trim();
  }

  return null;
}

export const initSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    // Same allowlist as the REST API rather than the previous `origin: '*'`.
    cors: {
      origin: config.cors.origins.length > 0 ? config.cors.origins : true,
      credentials: true,
    },
    // Bounds memory per connection; the default 1MB is generous for our payloads.
    maxHttpBufferSize: 256 * 1024,
    pingTimeout: 25_000,
    pingInterval: 20_000,
  });

  /** Handshake gate: no valid token, no connection. */
  io.use((socket, next) => {
    const token = extractToken(socket);
    if (!token) {
      log.debug({ socketId: socket.id }, 'socket rejected: no token');
      next(new Error('UNAUTHENTICATED'));
      return;
    }

    try {
      const payload = verifyAuthToken(token);
      (socket.data as any).user = { id: payload.userId, phone: payload.phone } satisfies SocketUser;
      next();
    } catch (err) {
      log.debug({ socketId: socket.id, err: (err as Error).name }, 'socket rejected: invalid token');
      next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socketUser(socket);
    if (!user) {
      socket.disconnect(true);
      return;
    }

    // The user's personal room is joined from the verified token, not from a
    // client-supplied value. This is the core fix.
    socket.join(user.id);
    log.debug({ socketId: socket.id, userId: user.id }, 'socket connected');

    // Join every conversation this user is genuinely a member of.
    try {
      const memberships = await prisma.conversationMember.findMany({
        where: { userId: user.id },
        select: { conversationId: true },
      });
      for (const membership of memberships) {
        socket.join(membership.conversationId);
      }
    } catch (err) {
      log.error({ err, userId: user.id }, 'failed to join conversation rooms');
    }

    /**
     * Retained for backward compatibility with shipped app builds that still
     * emit `join(userId)`. It is now a no-op: the room is already joined from
     * the token, and any ID the client sends is ignored.
     */
    socket.on('join', () => {
      socket.emit('joined', { userId: user.id });
    });

    /** Joining a conversation room now requires proven membership. */
    socket.on('conversation:join', async (conversationId: unknown) => {
      if (typeof conversationId !== 'string' || conversationId.length === 0) return;
      if (socket.rooms.has(conversationId)) return;

      try {
        const membership = await prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId, userId: user.id } },
          select: { id: true },
        });
        if (!membership) {
          log.warn({ userId: user.id, conversationId }, 'rejected conversation join: not a member');
          return;
        }
        socket.join(conversationId);
      } catch (err) {
        log.error({ err, userId: user.id }, 'conversation join failed');
      }
    });

    /**
     * Typing indicators are only relayed into rooms this socket has already
     * joined, so membership is enforced without an extra DB round-trip.
     * `userId` is taken from the token rather than the payload, so a client
     * cannot forge a typing event as somebody else.
     */
    const relayTyping = (event: 'typing:start' | 'typing:stop') => (payload: unknown) => {
      const conversationId = (payload as any)?.conversationId;
      if (typeof conversationId !== 'string' || !socket.rooms.has(conversationId)) return;
      socket.to(conversationId).emit(event, { conversationId, userId: user.id });
    };

    socket.on('typing:start', relayTyping('typing:start'));
    socket.on('typing:stop', relayTyping('typing:stop'));

    socket.on('disconnect', (reason) => {
      log.debug({ socketId: socket.id, userId: user.id, reason }, 'socket disconnected');
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

/**
 * Emits without throwing when the socket layer is unavailable.
 *
 * Call sites previously wrapped `getIO()` in their own try/catch (scoreService,
 * relationController, postController), each logging differently. Real-time
 * delivery is best-effort by nature: it must never fail the HTTP request that
 * triggered it.
 */
export const emitToUser = (userId: string, event: string, payload: unknown): void => {
  try {
    io?.to(userId).emit(event, payload);
  } catch (err) {
    log.warn({ err, event, userId }, 'socket emit failed');
  }
};

export const emitToRoom = (room: string, event: string, payload: unknown): void => {
  try {
    io?.to(room).emit(event, payload);
  } catch (err) {
    log.warn({ err, event, room }, 'socket emit failed');
  }
};

export const closeSocket = async (): Promise<void> => {
  if (!io) return;
  await io.close();
  io = null;
};
