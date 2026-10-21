/** JSON shapes returned by the MiniLedger API. Amounts are rupee strings, not floats. */

export type Session = {
  token: string;
  phone: string;
};

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
