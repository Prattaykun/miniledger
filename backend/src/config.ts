import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// src/ when running via tsx, dist/ after `npm run build`. Either way the parent is backend/.
export const packageRoot = path.resolve(__dirname, '..');

const envFile = process.env.DOTENV_PATH
  ? path.resolve(process.env.DOTENV_PATH)
  : path.join(packageRoot, '.env');

dotenv.config({ path: envFile });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy backend/.env.example to backend/.env and fill it in.`);
  }
  return value;
}

function resolveDir(value: string | undefined, fallback: string): string {
  const chosen = value && value.length > 0 ? value : fallback;
  return path.isAbsolute(chosen) ? chosen : path.join(packageRoot, chosen);
}

const uploadsDir = resolveDir(process.env.UPLOADS_DIR, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS ?? 300),
  uploadsDir,
};
