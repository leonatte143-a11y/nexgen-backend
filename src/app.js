import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { api } from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { requestTraceMiddleware } from './middlewares/requestTrace.js';
import { isDevLoggingEnabled } from './utils/devLogger.js';

const app = express();
app.use(helmet());
const corsOrigins = process.env.CORS_ORIGIN?.trim();
app.use(
  cors({
    origin: corsOrigins
      ? corsOrigins.split(',').map((o) => o.trim()).filter(Boolean)
      : '*',
    credentials: false,
  }),
);

if (isDevLoggingEnabled()) {
  app.use(requestTraceMiddleware);
} else {
  app.use(morgan('combined'));
}

// Photos/banners are sent as base64 data URLs in JSON bodies (no multipart upload pipeline).
// Client-side compression keeps typical payloads well under 1MB, but raise the ceiling as a
// safety margin (e.g. multi-photo gallery uploads) instead of relying on compression alone.
app.use(express.json({ limit: '6mb' }));

app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' }, message: 'KAIRO API' });
});

app.use('/api', api);
app.use(errorHandler);

export default app;
