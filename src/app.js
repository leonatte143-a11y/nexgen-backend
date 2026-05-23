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

app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' }, message: 'NEXGEN API' });
});

app.use('/api', api);
app.use(errorHandler);

export default app;
