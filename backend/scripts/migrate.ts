import { pool } from '../src/db';
import { prepareDatabase } from '../src/schema';

prepareDatabase()
  .then((applied) => {
    if (applied.length === 0) {
      console.log('No pending migrations.');
      return;
    }
    console.log(`Applied: ${applied.join(', ')}`);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
