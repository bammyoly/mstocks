// Loads contract/.env BEFORE any other module reads process.env.
// Must be the first import in every entrypoint script.
import { config } from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(here, '.env');

if (fs.existsSync(envPath)) {
  config({ path: envPath });
} else {
  console.warn(`[env] no .env found at ${envPath} — using built-in defaults`);
}
