import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorResponse } from '@subtracker/contracts';
import { logger } from './logger';

/** Erreur métier convertie en enveloppe `{ error: { code, message, hint? } }`. Code en MAJUSCULES_SNAKE. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly hint?: string,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Ressource') => new AppError(404, 'NOT_FOUND', `${what} introuvable`);
export const badRequest = (code: string, message: string, hint?: string) => new AppError(400, code, message, hint);
export const invalidInput = (message: string) => badRequest('INVALID_INPUT', message);
export const conflict = (code: string, message: string, hint?: string) => new AppError(409, code, message, hint);
export const unauthorized = (message = 'Authentification requise') => new AppError(401, 'UNAUTHORIZED', message);
export const tooManyRequests = (message: string) => new AppError(429, 'TOO_MANY_REQUESTS', message);
export const serviceUnavailable = (message: string) => new AppError(503, 'SERVICE_UNAVAILABLE', message);

function sendError(res: Response, status: number, error: ApiErrorResponse['error']): void {
  const body: ApiErrorResponse = { error };
  res.status(status).json(body);
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  sendError(res, 404, { code: 'NOT_FOUND', message: 'Route introuvable' });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    sendError(res, 400, {
      code: 'INVALID_INPUT',
      message: 'Requête invalide',
      fields: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
    return;
  }
  if (error instanceof AppError) {
    sendError(res, error.status, {
      code: error.code,
      message: error.message,
      ...(error.hint ? { hint: error.hint } : {}),
    });
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    sendError(res, 400, { code: 'INVALID_INPUT', message: 'Corps JSON invalide' });
    return;
  }
  // Les identifiants d'URL sont validés en amont (IdParamsSchema) : un CastError trahit une entrée mal typée.
  if (error?.name === 'CastError') {
    sendError(res, 400, { code: 'INVALID_INPUT', message: 'Requête invalide' });
    return;
  }
  logger.error({ err: error, path: req.path }, 'Erreur non gérée');
  sendError(res, 500, { code: 'INTERNAL_ERROR', message: 'Erreur interne' });
};
