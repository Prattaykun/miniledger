import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

// Injected into the test worker via `test.env`, so the suite never reads backend/.env
// and cannot truncate the development database.
const root = path.dirname(fileURLToPath(import.meta.url));
const testEnv = dotenv.parse(fs.readFileSync(path.join(root, '.env.test')));

export default defineConfig({
  test: {
    environment: 'node',
    env: testEnv,
    fileParallelism: false,
    maxWorkers: 1,
    setupFiles: ['./tests/setup.ts'],
    hookTimeout: 30_000,
    testTimeout: 20_000,
  },
});
