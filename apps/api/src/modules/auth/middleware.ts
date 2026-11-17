import type { RequestHandler } from 'express';
import { unauthorized } from '../../core/errors';
import { verifyAccessToken } from './tokens';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: { userId: string; sessionId: string };
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const auth = token ? verifyAccessToken(token) : null;
  if (!auth) {
    next(unauthorized());
    return;
  }
  req.auth = auth;
  next();
};
