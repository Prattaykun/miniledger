import { z } from 'zod';

/**
 * Accepts the shapes a person actually types:
 *   9876543210, 09876543210, 919876543210, +91 98765 43210
 * Stores the canonical +91XXXXXXXXXX form.
 */
export function normalizeIndianMobile(input: string): string | null {
  const compact = input.replace(/[\s-]/g, '');
  let national = compact;
  if (national.startsWith('+91')) national = national.slice(3);
  else if (national.startsWith('91') && national.length === 12) national = national.slice(2);
  else if (national.startsWith('0') && national.length === 11) national = national.slice(1);

  if (!/^[6-9]\d{9}$/.test(national)) return null;
  return `+91${national}`;
}

const phoneSchema = z.string().trim().transform((value, ctx) => {
  const phone = normalizeIndianMobile(value);
  if (!phone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enter a valid 10-digit Indian mobile number',
    });
    return z.NEVER;
  }
  return phone;
});

export const requestOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// Strings and JSON numbers both end up here. Rejecting more than 2 decimal places
// avoids binary float surprises such as 0.1 + 0.2.
const amountSchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const raw = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Amount must be a positive number with at most 2 decimal places',
    });
    return z.NEVER;
  }
  const amount = Number(raw);
  if (!(amount > 0) || amount > 10_000_000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Amount must be between 0.01 and 10000000',
    });
    return z.NEVER;
  }
  return amount.toFixed(2);
});

export const createLoanSchema = z.object({
  friendName: z
    .string()
    .trim()
    .min(1, 'Friend name is required')
    .max(80, 'Friend name must be 80 characters or fewer'),
  amount: amountSchema,
  dueDate: z
    .string()
    .trim()
    .refine(isRealDate, 'Due date must be a real calendar date as YYYY-MM-DD'),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
