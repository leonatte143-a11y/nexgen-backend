import 'dotenv/config';
import './loadEnv.js';
import { assertJwtSecretsConfigured } from './utils/jwt.js';
import app from './app.js';
import { connectDatabase, syncDatabase } from './models/index.js';

const port = parseInt(process.env.PORT || '4000', 10);
const host = process.env.HOST || '0.0.0.0';

async function main() {
  assertJwtSecretsConfigured();

  const shouldSync = process.env.DB_SYNC === 'true';
  if (shouldSync) {
    await syncDatabase({ alter: true });
  } else {
    await connectDatabase();
  }

  app.listen(port, host, () => {
    console.log(`NEXGEN API listening on http://${host}:${port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
