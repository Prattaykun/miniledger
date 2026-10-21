import { Pool, types } from 'pg';
import { config } from './config';

// node-pg otherwise turns a DATE into a JS Date at local midnight, and JSON then
// shifts the calendar day. Keep 'YYYY-MM-DD' as a string the whole way through.
types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 5000,
});
