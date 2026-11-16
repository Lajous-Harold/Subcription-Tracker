import jwt from 'jsonwebtoken';
import { getConfig } from '../../core/context';

interface AccessPayload {
  sub: string;
  sid: string;
}

export function signAccessToken(userId: string, sessionId: string): { token: string; expiresAt: Date } {
  const config = getConfig();
  const token = jwt.sign({ sid: sessionId } satisfies Omit<AccessPayload, 'sub'>, config.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
    issuer: 'subtracker-api',
  });
  return { token, expiresAt: new Date(Date.now() + config.ACCESS_TOKEN_TTL_SECONDS * 1000) };
}

export function verifyAccessToken(token: string): { userId: string; sessionId: string } | null {
  try {
    const payload = jwt.verify(token, getConfig().JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: 'subtracker-api',
    }) as jwt.JwtPayload & Partial<AccessPayload>;
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}
