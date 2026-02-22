import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: Server | null = null;

export const initSocket = (server: HttpServer) => {
    io = new Server(server, { cors: { origin: '*' } });

    io.on('connection', (socket) => {
        // When a user connects, they join a room with their userId
        socket.on('join', (userId: string) => {
            if (userId) {
                socket.join(userId);
                console.log(`Socket ${socket.id} joined room ${userId}`);
            }
        });

        socket.on('disconnect', () => {
            // Logic for disconnect if needed
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        // Return a dummy object if not initialized to prevent crashing before server start,
        // though realistically this should not be called before init.
        // Or throw error. Since we use it in controllers which run after server start, throw is safe.
        throw new Error('Socket.io not initialized!');
    }
    return io;
};
