import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { api } from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();
app.use(helmet());
// Mobile dev (Expo) — allow LAN devices to call API.
app.use(cors({ origin: '*', credentials: false }));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' }, message: 'NEXGEN API' });
});

app.use('/api', api);
app.use(errorHandler);

export default app;
