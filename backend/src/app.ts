import cors from 'cors';
import express from 'express';
import { errorHandler } from './http';
import { authRouter } from './routes/auth';
import { ledgerRouter } from './routes/ledger';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Expo web is a browser on another port. Phone builds do not use CORS.
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/auth', authRouter);
  app.use('/api', ledgerRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);
  return app;
}
