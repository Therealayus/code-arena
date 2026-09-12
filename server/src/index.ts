import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { log } from './utils/logger';
import { initSocket } from './sockets';
import { startEngine, ensureInitialRound } from './services/roundEngine';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import gameRoutes from './routes/game';
import adminRoutes from './routes/admin';
import paymentRoutes from './routes/payment';
import bonusRoutes from './routes/bonus';
import supportRoutes from './routes/support';
import { errorHandler, notFound } from './middleware/errorHandler';
import { xssSanitizer } from './middleware/security';
import path from 'path';

const app = express();
const server = http.createServer(app);

app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(xssSanitizer);

const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false });
app.use(globalLimiter);

// Health should be before rate limiter? Keep after but exempt via separate limiter
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/bonuses', bonusRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/support', supportRoutes);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use(notFound);
app.use(errorHandler);

async function bootstrap() {
  try {
    // Fix deprecation: Mongoose strictQuery
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.mongoUri);
    log.info(`MongoDB connected: ${config.mongoUri}`);

    // Ensure admin user exists
    const { User } = await import('./models/User');
    const bcrypt = await import('bcryptjs');
    let admin = await User.findOne({ email: config.adminEmail.toLowerCase() });
    if (!admin) {
      const hash = await bcrypt.hash(config.adminPassword, 10);
      admin = await User.create({
        name: 'Admin',
        email: config.adminEmail.toLowerCase(),
        passwordHash: hash,
        virtualBalance: 1000000,
        role: 'admin',
      });
      log.info(`Admin created: ${admin.email} / ${config.adminPassword}`);
    } else if (admin.role !== 'admin') {
      admin.role = 'admin';
      await admin.save();
      log.info('Promoted existing user to admin');
    }

    initSocket(server);
    await ensureInitialRound();
    startEngine();

    server.listen(config.port, () => {
      log.info(`Server running on http://localhost:${config.port}`);
      log.info(`CORS origin: ${config.corsOrigin}`);
    });
  } catch (err) {
    log.error('Bootstrap failed', err);
    process.exit(1);
  }
}

bootstrap();

// Graceful shutdown
process.on('SIGINT', async () => {
  const { stopEngine } = await import('./services/roundEngine');
  stopEngine();
  await mongoose.disconnect();
  process.exit(0);
});
