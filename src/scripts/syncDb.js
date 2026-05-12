import 'dotenv/config';
import { syncDatabase } from '../models/index.js';

syncDatabase({ alter: true })
  .then(() => {
    console.log('Database synced');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
