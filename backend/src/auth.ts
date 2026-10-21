import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { pool } from './db';
import { HttpError } from './http';

const OTP_LIMIT = 3;
const OTP_WINDOW_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

/** crypto.randomInt is unbiased across 000000–999999. Math.random() is not. */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * A 6-digit code can be guessed offline if we store a plain hash.
 * HMAC with the server secret means a database copy alone is not enough.
 */
export function hashOtp(phone: string, code: string): string {
  return createHmac('sha256', config.jwtSecret).update(`${phone}:${code}`).digest('hex');
}

export function otpMatches(phone: string, code: string, hash: string): boolean {
  const actual = Buffer.from(hashOtp(phone, code), 'hex');
  const expected = Buffer.from(hash, 'hex');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export async function requestOtp(phone: string): Promise<string> {
  const recent = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n
     FROM otp_challenges
     WHERE phone = $1
       AND created_at > now() - make_interval(mins => $2::int)`,
    [phone, OTP_WINDOW_MINUTES],
  );
  if ((recent.rows[0]?.n ?? 0) >= OTP_LIMIT) {
    throw new HttpError(429, 'Too many codes. Wait a few minutes and try again');
  }

  const code = generateOtp();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Only the newest code should work. Older unused codes are closed out.
    await client.query(
      `UPDATE otp_challenges
       SET consumed_at = now()
       WHERE phone = $1 AND consumed_at IS NULL`,
      [phone],
    );
    await client.query(
      `INSERT INTO otp_challenges (phone, code_hash, expires_at)
       VALUES ($1, $2, now() + make_interval(secs => $3::int))`,
      [phone, hashOtp(phone, code), config.otpTtlSeconds],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return code;
}

export async function verifyOtp(
  phone: string,
  code: string,
): Promise<{ id: string; phone: string }> {
  const client = await pool.connect();
  let failure: HttpError | null = null;
  let user: { id: string; phone: string } | null = null;

  try {
    await client.query('BEGIN');
    const found = await client.query<{
      id: string;
      code_hash: string;
      expires_at: Date;
      attempts: number;
    }>(
      `SELECT id, code_hash, expires_at, attempts
       FROM otp_challenges
       WHERE phone = $1 AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [phone],
    );
    const row = found.rows[0];

    if (!row) {
      failure = new HttpError(401, 'Request a code first');
    } else if (row.expires_at.getTime() <= Date.now()) {
      failure = new HttpError(401, 'Code expired. Request a new one');
    } else if (row.attempts >= MAX_ATTEMPTS) {
      failure = new HttpError(401, 'Too many attempts. Request a new code');
    } else if (!otpMatches(phone, code, row.code_hash)) {
      await client.query('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1', [
        row.id,
      ]);
      failure = new HttpError(401, 'Incorrect code');
    } else {
      await client.query('UPDATE otp_challenges SET consumed_at = now() WHERE id = $1', [row.id]);
      const inserted = await client.query<{ id: string; phone: string }>(
        `INSERT INTO users (phone) VALUES ($1)
         ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
         RETURNING id, phone`,
        [phone],
      );
      user = inserted.rows[0] ?? null;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  if (failure) throw failure;
  if (!user) throw new HttpError(500, 'Something went wrong');
  return user;
}

export function signToken(user: { id: string; phone: string }): string {
  return jwt.sign({ phone: user.phone }, config.jwtSecret, {
    subject: user.id,
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

export function readToken(token: string): { userId: string; phone: string } {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (
      typeof payload === 'string' ||
      typeof payload.sub !== 'string' ||
      typeof payload.phone !== 'string'
    ) {
      throw new Error('Unexpected token payload');
    }
    return { userId: payload.sub, phone: payload.phone };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, 'Invalid or expired token');
  }
}
