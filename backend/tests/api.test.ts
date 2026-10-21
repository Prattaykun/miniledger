import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { config } from '../src/config';
import { pool } from '../src/db';

const app = createApp();

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function requestCode(phone: string) {
  const logs: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  try {
    const res = await request(app).post('/api/auth/otp').send({ phone });
    const code = logs.join('\n').match(/is (\d{6})/)?.[1] ?? '';
    return { code, status: res.status, body: res.body as { error?: string; ok?: boolean } };
  } finally {
    console.log = original;
  }
}

async function login(phone: string): Promise<string> {
  const issued = await requestCode(phone);
  expect(issued.status).toBe(200);
  expect(issued.code).toMatch(/^\d{6}$/);
  const res = await request(app).post('/api/auth/verify').send({ phone, code: issued.code });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

async function kolkataToday(): Promise<string> {
  const result = await pool.query<{ today: string }>(
    `SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS today`,
  );
  const today = result.rows[0]?.today;
  if (!today) throw new Error('Could not read today from Postgres');
  return today;
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

describe('health', () => {
  it('responds ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('phone login', () => {
  it('rejects a number that is not an Indian mobile', async () => {
    const res = await request(app).post('/api/auth/otp').send({ phone: '12345' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Indian mobile/);
  });

  it('prints the OTP in the server log and does not return it', async () => {
    const issued = await requestCode('+91 98765-43210');
    expect(issued.status).toBe(200);
    expect(issued.body).toEqual({ ok: true, expiresInSeconds: 300 });
    expect(issued.code).toMatch(/^\d{6}$/);
    expect(JSON.stringify(issued.body)).not.toContain(issued.code);
  });

  it('treats 0, 91, and +91 as the same phone', async () => {
    const issued = await requestCode('09876543210');
    const res = await request(app)
      .post('/api/auth/verify')
      .send({ phone: '919876543210', code: issued.code });
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe('+919876543210');
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('rejects a wrong code, then accepts the right one once', async () => {
    const issued = await requestCode('9876543210');
    const wrongCode = issued.code === '000000' ? '111111' : '000000';
    const wrong = await request(app)
      .post('/api/auth/verify')
      .send({ phone: '9876543210', code: wrongCode });
    expect(wrong.status).toBe(401);

    const right = await request(app)
      .post('/api/auth/verify')
      .send({ phone: '9876543210', code: issued.code });
    expect(right.status).toBe(200);

    const again = await request(app)
      .post('/api/auth/verify')
      .send({ phone: '9876543210', code: issued.code });
    expect(again.status).toBe(401);
  });

  it('rejects an expired code', async () => {
    const issued = await requestCode('9876543210');
    await pool.query(
      `UPDATE otp_challenges SET expires_at = now() - interval '1 minute' WHERE phone = $1`,
      ['+919876543210'],
    );
    const res = await request(app)
      .post('/api/auth/verify')
      .send({ phone: '9876543210', code: issued.code });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/expired/i);
  });

  it('locks the code after five wrong guesses', async () => {
    const issued = await requestCode('9876543210');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const res = await request(app)
        .post('/api/auth/verify')
        .send({ phone: '9876543210', code: '000000' });
      expect(res.status).toBe(401);
    }
    const res = await request(app)
      .post('/api/auth/verify')
      .send({ phone: '9876543210', code: issued.code });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Too many attempts/);
  });

  it('invalidates the previous code when a new one is requested', async () => {
    const first = await requestCode('9876543210');
    const second = await requestCode('9876543210');
    expect(first.code).not.toBe(second.code);

    const stale = await request(app)
      .post('/api/auth/verify')
      .send({ phone: '9876543210', code: first.code });
    expect(stale.status).toBe(401);

    const current = await request(app)
      .post('/api/auth/verify')
      .send({ phone: '9876543210', code: second.code });
    expect(current.status).toBe(200);
  });

  it('rate limits OTP requests', async () => {
    expect((await requestCode('9876543210')).status).toBe(200);
    expect((await requestCode('9876543210')).status).toBe(200);
    expect((await requestCode('9876543210')).status).toBe(200);
    const blocked = await requestCode('9876543210');
    expect(blocked.status).toBe(429);
  });

  it('rejects missing and forged tokens', async () => {
    const missing = await request(app).get('/api/loans');
    expect(missing.status).toBe(401);

    const forged = await request(app).get('/api/summary').set(bearer('not-a-jwt'));
    expect(forged.status).toBe(401);
  });
});

describe('loans', () => {
  it('rejects invalid entries', async () => {
    const token = await login('9876543210');
    const cases = [
      { friendName: '   ', amount: '10', dueDate: '2026-12-01' },
      { friendName: 'Asha', amount: '-5', dueDate: '2026-12-01' },
      { friendName: 'Asha', amount: '10.555', dueDate: '2026-12-01' },
      { friendName: 'Asha', amount: '10', dueDate: '2026-02-31' },
    ];
    for (const body of cases) {
      const res = await request(app).post('/api/loans').set(bearer(token)).send(body);
      expect(res.status).toBe(400);
      expect(typeof res.body.error).toBe('string');
    }
  });

  it('creates, lists, summarizes, and marks repaid', async () => {
    const token = await login('9876543210');
    const today = await kolkataToday();

    const created = await request(app).post('/api/loans').set(bearer(token)).send({
      friendName: '  Asha Sharma  ',
      amount: 1500.5,
      dueDate: addDays(today, 3),
    });
    expect(created.status).toBe(201);
    expect(created.body.loan).toMatchObject({
      friendName: 'Asha Sharma',
      amount: '1500.50',
      dueDate: addDays(today, 3),
      repaidAt: null,
      overdue: false,
      hasReceipt: false,
    });

    await request(app)
      .post('/api/loans')
      .set(bearer(token))
      .send({ friendName: 'Ravi', amount: '100.50', dueDate: addDays(today, -1) });
    await request(app)
      .post('/api/loans')
      .set(bearer(token))
      .send({ friendName: 'Due today', amount: '40', dueDate: today });
    const repaid = await request(app)
      .post('/api/loans')
      .set(bearer(token))
      .send({ friendName: 'Already paid', amount: '10', dueDate: addDays(today, -2) });

    const firstRepay = await request(app)
      .post(`/api/loans/${repaid.body.loan.id}/repay`)
      .set(bearer(token));
    expect(firstRepay.status).toBe(200);
    expect(firstRepay.body.loan.overdue).toBe(false);
    expect(firstRepay.body.loan.repaidAt).toEqual(expect.any(String));

    const secondRepay = await request(app)
      .post(`/api/loans/${repaid.body.loan.id}/repay`)
      .set(bearer(token));
    expect(secondRepay.body.loan.repaidAt).toBe(firstRepay.body.loan.repaidAt);

    const list = await request(app).get('/api/loans').set(bearer(token));
    expect(list.status).toBe(200);
    expect(list.body.loans.map((loan: { friendName: string }) => loan.friendName)).toEqual([
      'Ravi',
      'Due today',
      'Asha Sharma',
      'Already paid',
    ]);
    expect(list.body.loans[0]).toMatchObject({ friendName: 'Ravi', overdue: true });
    expect(list.body.loans.find((loan: { friendName: string }) => loan.friendName === 'Due today')).toMatchObject({
      overdue: false,
    });

    const summary = await request(app).get('/api/summary').set(bearer(token));
    expect(summary.status).toBe(200);
    expect(summary.body).toEqual({
      totalLent: '1651.00',
      totalRepaid: '10.00',
      overdueAmount: '100.50',
    });

    const empty = await request(app).get('/api/summary').set(bearer(await login('9123456789')));
    expect(empty.body).toEqual({
      totalLent: '0.00',
      totalRepaid: '0.00',
      overdueAmount: '0.00',
    });
  });

  it('hides entries that belong to someone else', async () => {
    const owner = await login('9876543210');
    const other = await login('9123456789');
    const created = await request(app).post('/api/loans').set(bearer(owner)).send({
      friendName: 'Asha',
      amount: '20',
      dueDate: '2026-12-01',
    });
    const id = created.body.loan.id as string;

    const list = await request(app).get('/api/loans').set(bearer(other));
    expect(list.body.loans).toEqual([]);

    const repay = await request(app).post(`/api/loans/${id}/repay`).set(bearer(other));
    expect(repay.status).toBe(404);

    const missing = await request(app)
      .post('/api/loans/00000000-0000-4000-8000-000000000000/repay')
      .set(bearer(owner));
    expect(missing.status).toBe(404);

    const badId = await request(app).post('/api/loans/not-a-uuid/repay').set(bearer(owner));
    expect(badId.status).toBe(400);
  });

  it('stores a receipt image and serves it only to the owner', async () => {
    const owner = await login('9876543210');
    const other = await login('9123456789');

    const created = await request(app)
      .post('/api/loans')
      .set(bearer(owner))
      .field('friendName', 'Meera')
      .field('amount', '250')
      .field('dueDate', '2026-12-01')
      .attach('receipt', PNG, { filename: 'receipt.png', contentType: 'image/png' });
    expect(created.status).toBe(201);
    expect(created.body.loan.hasReceipt).toBe(true);
    expect(created.body.loan.receiptFilename).toBeUndefined();

    const receipt = await request(app)
      .get(`/api/loans/${created.body.loan.id}/receipt`)
      .set(bearer(owner))
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(receipt.status).toBe(200);
    expect(receipt.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(receipt.body as Buffer, PNG)).toBe(0);

    const stolen = await request(app)
      .get(`/api/loans/${created.body.loan.id}/receipt`)
      .set(bearer(other));
    expect(stolen.status).toBe(404);

    const unauthenticated = await request(app).get(`/api/loans/${created.body.loan.id}/receipt`);
    expect(unauthenticated.status).toBe(401);
  });

  it('rejects a non-image and deletes the file when the form is invalid', async () => {
    const token = await login('9876543210');

    const gif = await request(app)
      .post('/api/loans')
      .set(bearer(token))
      .field('friendName', 'Meera')
      .field('amount', '250')
      .field('dueDate', '2026-12-01')
      .attach('receipt', Buffer.from('GIF89a'), { filename: 'r.gif', contentType: 'image/gif' });
    expect(gif.status).toBe(400);
    expect(gif.body.error).toMatch(/JPEG, PNG, or WebP/);

    const invalid = await request(app)
      .post('/api/loans')
      .set(bearer(token))
      .field('friendName', '')
      .field('amount', '250')
      .field('dueDate', '2026-12-01')
      .attach('receipt', PNG, { filename: 'receipt.png', contentType: 'image/png' });
    expect(invalid.status).toBe(400);

    const leftovers = (await fs.promises.readdir(config.uploadsDir)).filter((name) => name !== '.gitkeep');
    expect(leftovers).toEqual([]);
    expect(fs.existsSync(path.join(config.uploadsDir, 'receipt.png'))).toBe(false);
  });
});
