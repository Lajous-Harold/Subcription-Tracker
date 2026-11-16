import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { Problem } from '@subtracker/contracts';
import { logger } from './logger';

/** Erreur métier convertie en application/problem+json. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly detail?: string,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Ressource') => new AppError(404, 'not_found', `${what} introuvable`);
export const badRequest = (code: string, message: string, detail?: string) => new AppError(400, code, message, detail);
export const conflict = (code: string, message: string, detail?: string) => new AppError(409, code, message, detail);
export const unauthorized = (message = 'Authentification requise') => new AppError(401, 'unauthorized', message);

function problem(status: number, code: string, title: string, extra: Partial<Problem> = {}): Problem {
  return { type: `https://subtracker.local/problems/${code}`, title, status, code, ...extra };
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res
    .status(404)
    .type('application/problem+json')
    .json(problem(404, 'route_not_found', 'Route introuvable'));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    res
      .status(400)
      .type('application/problem+json')
      .json(
        problem(400, 'validation_error', 'Requête invalide', {
          errors: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        }),
      );
    return;
  }
  if (error instanceof AppError) {
    res
      .status(error.status)
      .type('application/problem+json')
      .json(problem(error.status, error.code, error.message, error.detail ? { detail: error.detail } : {}));
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    res
      .status(400)
      .type('application/problem+json')
      .json(problem(400, 'invalid_json', 'Corps JSON invalide'));
    return;
  }
  if (error?.name === 'CastError') {
    res
      .status(404)
      .type('application/problem+json')
      .json(problem(404, 'not_found', 'Ressource introuvable'));
    return;
  }
  logger.error({ err: error, path: req.path }, 'Erreur non gérée');
  res
    .status(500)
    .type('application/problem+json')
    .json(problem(500, 'internal_error', 'Erreur interne'));
};
