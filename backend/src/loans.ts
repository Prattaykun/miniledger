import { z } from 'zod';
import { pool } from './db';
import { HttpError } from './http';
import { formatMoney } from './money';
import { resolveReceipt } from './uploads';

export type Loan = {
  id: string;
  friendName: string;
  amount: string;
  dueDate: string;
  repaidAt: string | null;
  overdue: boolean;
  hasReceipt: boolean;
  createdAt: string;
};

export type Summary = {
  totalLent: string;
  totalRepaid: string;
  overdueAmount: string;
};

type LoanRow = {
  id: string;
  friend_name: string;
  amount: string;
  due_date: string;
  repaid_at: Date | null;
  receipt_filename: string | null;
  created_at: Date;
  overdue: boolean;
};

// due_date is formatted in SQL so it cannot shift a day when it becomes JSON.
// Overdue uses the calendar date in India, not the UTC date and not a stored flag.
const LOAN_COLUMNS = `
  id,
  friend_name,
  amount::text AS amount,
  to_char(due_date, 'YYYY-MM-DD') AS due_date,
  repaid_at,
  receipt_filename,
  created_at,
  (
    repaid_at IS NULL
    AND due_date < (now() AT TIME ZONE 'Asia/Kolkata')::date
  ) AS overdue
`;

function toLoan(row: LoanRow): Loan {
  return {
    id: row.id,
    friendName: row.friend_name,
    amount: formatMoney(row.amount),
    dueDate: row.due_date,
    repaidAt: row.repaid_at ? row.repaid_at.toISOString() : null,
    overdue: row.overdue,
    hasReceipt: row.receipt_filename !== null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createLoan(input: {
  userId: string;
  friendName: string;
  amount: string;
  dueDate: string;
  receiptFilename: string | null;
}): Promise<Loan> {
  const result = await pool.query<LoanRow>(
    `INSERT INTO loans (user_id, friend_name, amount, due_date, receipt_filename)
     VALUES ($1, $2, $3::numeric, $4::date, $5)
     RETURNING ${LOAN_COLUMNS}`,
    [input.userId, input.friendName, input.amount, input.dueDate, input.receiptFilename],
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(500, 'Something went wrong');
  return toLoan(row);
}

export async function listLoans(userId: string): Promise<Loan[]> {
  const result = await pool.query<LoanRow>(
    `SELECT ${LOAN_COLUMNS}
     FROM loans
     WHERE user_id = $1
     ORDER BY (repaid_at IS NULL) DESC, due_date ASC, created_at DESC`,
    [userId],
  );
  return result.rows.map(toLoan);
}

export async function summarize(userId: string): Promise<Summary> {
  const result = await pool.query<{
    total_lent: string;
    total_repaid: string;
    overdue_amount: string;
  }>(
    `SELECT
       COALESCE(SUM(amount), 0)::text AS total_lent,
       COALESCE(SUM(amount) FILTER (WHERE repaid_at IS NOT NULL), 0)::text AS total_repaid,
       COALESCE(SUM(amount) FILTER (
         WHERE repaid_at IS NULL
           AND due_date < (now() AT TIME ZONE 'Asia/Kolkata')::date
       ), 0)::text AS overdue_amount
     FROM loans
     WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(500, 'Something went wrong');
  return {
    totalLent: formatMoney(row.total_lent),
    totalRepaid: formatMoney(row.total_repaid),
    overdueAmount: formatMoney(row.overdue_amount),
  };
}

export async function markRepaid(userId: string, loanId: string): Promise<Loan> {
  const id = parseLoanId(loanId);
  const result = await pool.query<LoanRow>(
    `UPDATE loans
     SET repaid_at = COALESCE(repaid_at, now())
     WHERE id = $1 AND user_id = $2
     RETURNING ${LOAN_COLUMNS}`,
    [id, userId],
  );
  const row = result.rows[0];
  // Same 404 for a missing id and for someone else's loan, so we don't reveal it exists.
  if (!row) throw new HttpError(404, 'Entry not found');
  return toLoan(row);
}

export async function receiptForUser(
  userId: string,
  loanId: string,
): Promise<{ absolutePath: string; contentType: string }> {
  const id = parseLoanId(loanId);
  const result = await pool.query<{ receipt_filename: string | null }>(
    `SELECT receipt_filename FROM loans WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  const row = result.rows[0];
  if (!row) throw new HttpError(404, 'Entry not found');
  if (!row.receipt_filename) throw new HttpError(404, 'No receipt on this entry');
  return resolveReceipt(row.receipt_filename);
}

function parseLoanId(loanId: string): string {
  const parsed = z.string().uuid('Invalid id').safeParse(loanId);
  if (!parsed.success) throw new HttpError(400, 'Invalid id');
  return parsed.data;
}
