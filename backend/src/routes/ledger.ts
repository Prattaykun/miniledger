import fs from 'fs';
import { Router } from 'express';
import { readToken } from '../auth';
import { asyncHandler, currentUser, HttpError } from '../http';
import { createLoan, listLoans, markRepaid, receiptForUser, summarize } from '../loans';
import { acceptLoanBody, discardUpload } from '../uploads';
import { createLoanSchema } from '../validation';

export const ledgerRouter = Router();

ledgerRouter.use((req, _res, next) => {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    next(new HttpError(401, 'Missing token'));
    return;
  }
  try {
    const user = readToken(header.slice('Bearer '.length).trim());
    req.userId = user.userId;
    req.phone = user.phone;
    next();
  } catch (error) {
    next(error);
  }
});

ledgerRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const { userId } = currentUser(req);
    res.json(await summarize(userId));
  }),
);

ledgerRouter.get(
  '/loans',
  asyncHandler(async (req, res) => {
    const { userId } = currentUser(req);
    res.json({ loans: await listLoans(userId) });
  }),
);

ledgerRouter.post(
  '/loans',
  acceptLoanBody,
  asyncHandler(async (req, res) => {
    const { userId } = currentUser(req);
    const filename = req.file?.filename;
    try {
      const input = createLoanSchema.parse(req.body ?? {});
      const loan = await createLoan({
        userId,
        friendName: input.friendName,
        amount: input.amount,
        dueDate: input.dueDate,
        receiptFilename: filename ?? null,
      });
      res.status(201).json({ loan });
    } catch (error) {
      await discardUpload(filename);
      throw error;
    }
  }),
);

ledgerRouter.post(
  '/loans/:id/repay',
  asyncHandler(async (req, res) => {
    const { userId } = currentUser(req);
    res.json({ loan: await markRepaid(userId, req.params.id) });
  }),
);

ledgerRouter.get(
  '/loans/:id/receipt',
  asyncHandler(async (req, res, next) => {
    const { userId } = currentUser(req);
    const file = await receiptForUser(userId, req.params.id);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    const stream = fs.createReadStream(file.absolutePath);
    stream.on('error', next);
    stream.pipe(res);
  }),
);
