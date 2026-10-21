import fs from 'fs';
import path from 'path';
import { afterAll, beforeEach } from 'vitest';
import { config } from '../src/config';
import { pool } from '../src/db';
import { prepareDatabase } from '../src/schema';

if (!/\/miniledger_test(\?|$)/.test(config.databaseUrl)) {
  throw new Error(`Refusing to run tests against ${config.databaseUrl}`);
}

let migrated = false;

beforeEach(async () => {
  if (!migrated) {
    await prepareDatabase();
    migrated = true;
  }
  await pool.query('TRUNCATE TABLE loans, otp_challenges, users RESTART IDENTITY CASCADE');
  for (const name of await fs.promises.readdir(config.uploadsDir)) {
    if (name === '.gitkeep') continue;
    await fs.promises.unlink(path.join(config.uploadsDir, name));
  }
});

afterAll(async () => {
  await pool.end();
});
