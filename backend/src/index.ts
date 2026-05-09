import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import assetRoutes from './routes/assets';
import liabilityRoutes from './routes/liabilities';
import snapshotRoutes from './routes/snapshots';
import plaidRoutes from './routes/plaid';
import cryptoRoutes from './routes/crypto';
import propertyRoutes from './routes/property';
import uploadRoutes from './routes/upload';

import { startDailySnapshotJob } from './jobs/dailySnapshot';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// ── Parsers ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/liabilities', liabilityRoutes);
app.use('/api/snapshots', snapshotRoutes);
app.use('/api/plaid', plaidRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/property', propertyRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── DB + Server ───────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/netempo');
    console.log('✅ MongoDB connected');

    app.listen(PORT, () => {
      console.log(`🚀 NeTempo API running on port ${PORT}`);
    });

    // Start the daily cron job after DB is ready
    startDailySnapshotJob();
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
  }
}

bootstrap();

export default app;
