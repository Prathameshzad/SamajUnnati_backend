// src/index.ts
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { initSocket } from './lib/socket';

import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import relationRoutes from './routes/relationRoutes';
import relationTypeRoutes from './routes/relationTypeRoutes';
// If you created notification routes from earlier steps, uncomment next line:
// import notificationRoutes from './routes/notificationRoutes';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'MySociety API running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/relations', relationRoutes);
app.use('/api/relation-types', relationTypeRoutes);
import notificationRoutes from './routes/notificationRoutes';
import uploadRoutes from './routes/uploadRoutes';

// ...

app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const server = http.createServer(app);
const io = initSocket(server);

server.listen(PORT, () => {
  console.log(`MySociety backend running on port ${PORT}`);
});

// Force restart for schema update 2
