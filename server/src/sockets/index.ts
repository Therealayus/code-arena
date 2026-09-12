import { Server as IOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';

let io: IOServer;

export function initSocket(server: any): IOServer {
  io = new IOServer(server, {
    cors: { origin: config.corsOrigin, credentials: true },
  });

  io.use((socket, next) => {
    const token = (socket.handshake.auth as any)?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (token) {
      try {
        const payload: any = jwt.verify(token, config.jwtSecret);
        (socket as any).userId = payload.id;
        (socket as any).userRole = payload.role;
      } catch {}
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on('join:round', () => {
      // client requests current state - engine will emit ticks regularly
    });

    socket.on('disconnect', () => {});
  });

  return io;
}

export function getIO(): IOServer {
  if (!io) throw new Error('Socket IO not initialized');
  return io;
}
