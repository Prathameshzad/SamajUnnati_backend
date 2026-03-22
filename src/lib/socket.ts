import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import prisma from './prisma';

let io: Server | null = null;

export const initSocket = (server: HttpServer) => {
    io = new Server(server, { cors: { origin: '*' } });

    io.on('connection', (socket) => {
        // Join user's personal room for notifications
        socket.on('join', async (userId: string) => {
            if (!userId) return;
            socket.join(userId);
            console.log(`Socket ${socket.id} joined user room ${userId}`);

            // Also join all conversation rooms the user is part of
            try {
                const memberships = await prisma.conversationMember.findMany({
                    where: { userId },
                    select: { conversationId: true },
                });
                for (const m of memberships) {
                    socket.join(m.conversationId);
                }
                console.log(`Socket ${socket.id} joined ${memberships.length} conversation rooms`);
            } catch (e) {
                console.error('Error joining conversation rooms', e);
            }
        });

        // Join a specific conversation room (after creating a new one)
        socket.on('conversation:join', (conversationId: string) => {
            if (conversationId) {
                socket.join(conversationId);
            }
        });

        socket.on('typing:start', ({ conversationId, userId }: { conversationId: string; userId: string }) => {
            socket.to(conversationId).emit('typing:start', { conversationId, userId });
        });

        socket.on('typing:stop', ({ conversationId, userId }: { conversationId: string; userId: string }) => {
            socket.to(conversationId).emit('typing:stop', { conversationId, userId });
        });

        socket.on('disconnect', () => {
            console.log(`Socket ${socket.id} disconnected`);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};
