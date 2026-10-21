import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      phone?: string;
    }
  }
}

export function currentUser(req: Request): { userId: string; phone: string } {
  if (!req.userId || !req.phone) {
    throw new HttpError(401, 'Missing token');
  }
  return { userId: req.userId, phone: req.phone };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid input' });
    return;
  }
  if (isBodyTooLarge(err)) {
    res.status(413).json({ error: 'Request body is too large' });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
}

function isBodyTooLarge(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'status' in err && err.status === 413;
}
