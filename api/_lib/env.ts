import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local for vercel dev (production uses Vercel's env injection)
const root = process.cwd();
config({ path: resolve(root, '.env.local') });
config({ path: resolve(root, '.env') });
