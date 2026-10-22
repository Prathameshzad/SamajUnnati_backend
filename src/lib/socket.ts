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

/**
 * Online presence.
 *
 * Tracked as a Set of active socket IDs per user. This accurately tracks multi-socket
 * devices (e.g. Chat, Score, and Notification providers) without counter drift.
 */
const userActiveSockets = new Map<string, Set<string>>();

export const isOnline = (userId: string): boolean => (userActiveSockets.get(userId)?.size ?? 0) > 0;

function markOnline(userId: string, socketId: string): boolean {
  let sockets = userActiveSockets.get(userId);
  const wasOffline = !sockets || sockets.size === 0;
  if (!sockets) {
    sockets = new Set<string>();
    userActiveSockets.set(userId, sockets);
  }
  sockets.add(socketId);
  return wasOffline;
}

/** Returns true if this was the transition from online to offline (last socket closed). */
function markOffline(userId: string, socketId?: string): boolean {
  const sockets = userActiveSockets.get(userId);
  if (!sockets) return false;
  if (socketId) {
    sockets.delete(socketId);
  } else {
    sockets.clear();
  }
  if (sockets.size === 0) {
    userActiveSockets.delete(userId);
    return true;
  }
  return false;
}

/** Current online user IDs, for a freshly-connecting client to seed its UI without waiting for individual events. */
export const getOnlineUserIds = (): string[] => Array.from(userActiveSockets.keys());

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

    // Join every conversation this user is genuinely a member of. Tracked in a
    // mutable set (not just `socket.rooms`) because Socket.IO has already
    // removed a socket from its rooms by the time the `disconnect` event fires,
    // so this is the only record left of which rooms to announce presence into.
    const joinedConversationIds = new Set<string>();
    try {
      const memberships = await prisma.conversationMember.findMany({
        where: { userId: user.id },
        select: { conversationId: true },
      });
      for (const membership of memberships) {
        socket.join(membership.conversationId);
        joinedConversationIds.add(membership.conversationId);
      }
    } catch (err) {
      log.error({ err, userId: user.id }, 'failed to join conversation rooms');
    }

    /**
     * Presence ("Active now" in the chat header). The transition is only
     * announced on the first socket for this user (see `markOnline`/`markOffline`
     * ref-counting above) — a second tab/device connecting must not re-announce
     * "online" to everyone, since the user never went offline in the first place.
     */
    const wasOffline = markOnline(user.id, socket.id);
    if (wasOffline) {
      for (const conversationId of joinedConversationIds) {
        io?.to(conversationId).emit('presence:online', { userId: user.id });
      }
      io?.to(`presence:${user.id}`).emit('presence:online', { userId: user.id });
    }

    /** Lets a client query presence of userIds and automatically subscribes to live updates for them */
    socket.on('presence:query', (userIds: unknown) => {
      if (!Array.isArray(userIds)) return;
      const result: Record<string, boolean> = {};
      for (const id of userIds) {
        if (typeof id === 'string' && id.trim()) {
          result[id] = isOnline(id);
          socket.join(`presence:${id}`);
        }
      }
      socket.emit('presence:snapshot', result);
    });

    /** Client app state notification (foreground/background) */
    socket.on('presence:state', (payload: unknown) => {
      const state = (payload as any)?.state;
      if (state === 'background') {
        const becameOffline = markOffline(user.id);
        if (becameOffline) {
          for (const conversationId of joinedConversationIds) {
            io?.to(conversationId).emit('presence:offline', { userId: user.id });
          }
          io?.to(`presence:${user.id}`).emit('presence:offline', { userId: user.id });
        }
      } else if (state === 'active') {
        const transitioned = markOnline(user.id, socket.id);
        if (transitioned) {
          for (const conversationId of joinedConversationIds) {
            io?.to(conversationId).emit('presence:online', { userId: user.id });
          }
          io?.to(`presence:${user.id}`).emit('presence:online', { userId: user.id });
        }
      }
    });

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
        joinedConversationIds.add(conversationId);
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

      const becameOffline = markOffline(user.id, socket.id);
      if (becameOffline) {
        for (const conversationId of joinedConversationIds) {
          io?.to(conversationId).emit('presence:offline', { userId: user.id });
        }
        io?.to(`presence:${user.id}`).emit('presence:offline', { userId: user.id });
      }
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
