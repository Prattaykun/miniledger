import { pool } from '../src/db';
import { prepareDatabase } from '../src/schema';

const DEMO_PHONE = '+919876543210';

async function seed() {
  await prepareDatabase();
  const user = await pool.query<{ id: string }>(
    `INSERT INTO users (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING id`,
    [DEMO_PHONE],
  );
  const userId = user.rows[0]?.id;
  if (!userId) throw new Error('Could not create the demo user');

  const existing = await pool.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM loans WHERE user_id = $1',
    [userId],
  );
  if ((existing.rows[0]?.n ?? 0) > 0) {
    console.log(`Demo phone 9876543210 already has entries. Nothing new was inserted.`);
    return;
  }

  // Dates come from the database clock in Asia/Kolkata, same rule as the summary.
  await pool.query(
    `INSERT INTO loans (user_id, friend_name, amount, due_date, repaid_at) VALUES
       ($1, 'Priya Nair', 2500.00, (now() AT TIME ZONE 'Asia/Kolkata')::date + 10, NULL),
       ($1, 'Arjun Mehta', 800.00, (now() AT TIME ZONE 'Asia/Kolkata')::date - 1, NULL),
       ($1, 'Neha Shah', 1200.00, (now() AT TIME ZONE 'Asia/Kolkata')::date - 20, now() - interval '2 days')`,
    [userId],
  );
  console.log('Seeded 3 entries for 9876543210.');
  console.log('Sign in with that number. The OTP is printed by the API, not by this script.');
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
