// src/index.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { initSocket } from './lib/socket';

import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import relationRoutes from './routes/relationRoutes';
import relationTypeRoutes from './routes/relationTypeRoutes';
import notificationRoutes from './routes/notificationRoutes';
import uploadRoutes from './routes/uploadRoutes';
import friendRoutes from './routes/friendRoutes';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8000;

app.use(cors());

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.json());

// JSON Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    console.error('JSON Syntax Error detected:', err.message);
    console.error('Malformed Request Body Fragment:', (err as any).body.slice(0, 100));
    return res.status(400).json({ status: 'error', message: 'Invalid JSON body' });
  }
  next(err);
});

app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'MySociety API running' });
});

app.get('/health', async (req: Request, res: Response) => {
  try {
    const prisma = (await import('./lib/prisma')).default;
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'connected', uptime: process.uptime() });
  } catch (error: any) {
    res.status(500).json({ status: 'error', database: 'failed', error: error.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/relations', relationRoutes);
app.use('/api/relation-types', relationTypeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/friends', friendRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const server = http.createServer(app);
const io = initSocket(server);

server.listen(PORT, () => {
  console.log(`MySociety backend running on port ${PORT}`);
});
