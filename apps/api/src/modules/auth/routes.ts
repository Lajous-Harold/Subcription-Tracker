import type { CookieOptions, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  AuthResponseSchema,
  CLIENT_PLATFORM_HEADER,
  ClientPlatformSchema,
  DeleteAccountBodySchema,
  LoginBodySchema,
  LogoutBodySchema,
  RefreshBodySchema,
  RegisterBodySchema,
  UserSchema,
  type ClientPlatform,
} from '@subtracker/contracts';
import { getConfig } from '../../core/context';
import { createModule } from '../../core/http';
import { tooManyRequests, unauthorized } from '../../core/errors';
import { deleteAccount } from '../account/deletion';
import * as auth from './service';

const REFRESH_COOKIE = 'st_refresh';
const COOKIE_PATH = '/api/auth';

function platformOf(req: Request): ClientPlatform {
  const parsed = ClientPlatformSchema.safeParse(req.headers[CLIENT_PLATFORM_HEADER]);
  return parsed.success ? parsed.data : 'native';
}

function cookieOptions(expires?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: getConfig().COOKIE_SECURE,
    sameSite: 'strict',
    path: COOKIE_PATH,
    ...(expires ? { expires } : {}),
  };
}

/** Web : refresh token en cookie httpOnly, jamais exposé au JavaScript. Natif : dans la réponse. */
function respondWithTokens(req: Request, res: Response, issued: auth.IssuedTokens) {
  if (platformOf(req) === 'web') {
    res.cookie(REFRESH_COOKIE, issued.refreshToken, cookieOptions(new Date(issued.refreshTokenExpiresAt)));
    const { refreshToken: _omit, ...rest } = issued;
    return rest;
  }
  return issued;
}

function refreshTokenFrom(req: Request, body: { refreshToken?: string }): string | undefined {
  if (platformOf(req) === 'web') return req.cookies?.[REFRESH_COOKIE] as string | undefined;
  return body.refreshToken;
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => getConfig().APP_ENV === 'test',
  handler: (_req, _res, next) => next(tooManyRequests('Trop de tentatives, réessayez plus tard')),
});

const platformNote = `En-tête \`${CLIENT_PLATFORM_HEADER}: web|native\`. Web : refresh token posé en cookie httpOnly. Natif : renvoyé dans la réponse.`;

export const authModule = createModule('/auth', 'Auth');
const { route } = authModule;

route({
  method: 'post',
  path: '/register',
  summary: 'Créer un compte',
  description: platformNote,
  auth: false,
  body: RegisterBodySchema,
  response: AuthResponseSchema,
  errors: [409, 429],
  middlewares: [authLimiter],
  handler: async ({ req, res, body }) =>
    respondWithTokens(req, res, await auth.register(body.email, body.password, platformOf(req))),
});

route({
  method: 'post',
  path: '/login',
  summary: 'Se connecter',
  description: platformNote,
  auth: false,
  status: 200,
  body: LoginBodySchema,
  response: AuthResponseSchema,
  errors: [401, 429],
  middlewares: [authLimiter],
  handler: async ({ req, res, body }) =>
    respondWithTokens(req, res, await auth.login(body.email, body.password, platformOf(req))),
});

route({
  method: 'post',
  path: '/refresh',
  summary: 'Renouveler la session (rotation du refresh token)',
  description: platformNote,
  auth: false,
  status: 200,
  body: RefreshBodySchema,
  response: AuthResponseSchema,
  errors: [401],
  handler: async ({ req, res, body }) => {
    const token = refreshTokenFrom(req, body);
    if (!token) throw unauthorized('Refresh token manquant');
    return respondWithTokens(req, res, await auth.refresh(token, platformOf(req)));
  },
});

route({
  method: 'post',
  path: '/logout',
  summary: 'Se déconnecter (révoque la session)',
  auth: false,
  status: 204,
  body: LogoutBodySchema,
  handler: async ({ req, res, body }) => {
    await auth.logout(refreshTokenFrom(req, body));
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
  },
});

export const meModule = createModule('/me', 'Compte');

meModule.route({
  method: 'get',
  path: '/',
  summary: 'Utilisateur courant',
  response: UserSchema,
  handler: ({ userId }) => auth.getUser(userId),
});

meModule.route({
  method: 'delete',
  path: '/',
  summary: 'Supprimer le compte et toutes ses données',
  description:
    'Supprime la connexion et l’utilisateur Powens, puis toutes les données locales, puis les sessions. Ne résilie aucun contrat externe.',
  status: 204,
  body: DeleteAccountBodySchema,
  errors: [401],
  handler: async ({ userId, body, res }) => {
    const user = await auth.getUser(userId);
    await auth.verifyCredentials(user.email, body.password);
    await deleteAccount(userId);
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
  },
});
