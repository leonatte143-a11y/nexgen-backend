import 'dotenv/config';
import app from './app.js';
import { sequelize } from './config/database.js';
import { syncDatabase } from './models/index.js';

const port = parseInt(process.env.PORT || '4000', 10);
const host = process.env.HOST || '0.0.0.0';

async function main() {
  await syncDatabase({ alter: true });
  app.listen(port, host, () => {
    console.log(`NEXGEN API listening on http://${host}:${port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
