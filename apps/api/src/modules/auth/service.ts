import argon2 from 'argon2';
import {
  REFRESH_SUPERSEDED_ERROR_CODE,
  type AuthResponse,
  type ClientPlatform,
  type User,
} from '@subtracker/contracts';
import { getConfig } from '../../core/context';
import { randomToken, sha256 } from '../../core/crypto';
import { AppError, conflict, unauthorized } from '../../core/errors';
import { SessionModel, UserModel, type UserDoc } from './models';
import { signAccessToken } from './tokens';

/** Vérifié quand l'email est inconnu : temps de réponse constant, contre l'énumération des comptes. */
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= argon2.hash('mot-de-passe-factice-pour-temps-constant'));

const invalidCredentials = () => unauthorized('Email ou mot de passe incorrect');

/** Plusieurs onglets partagent le cookie du refresh token et peuvent le présenter presque en même temps. */
export const CONCURRENT_ROTATION_GRACE_MS = 30_000;

const refreshSuperseded = () =>
  new AppError(401, REFRESH_SUPERSEDED_ERROR_CODE, 'Session déjà renouvelée par une autre requête, réessayez');

function wasRotatedWithinGracePeriod(rotatedAt: Date | null | undefined): boolean {
  return rotatedAt != null && Date.now() - rotatedAt.getTime() < CONCURRENT_ROTATION_GRACE_MS;
}

function toUserDto(user: Pick<UserDoc, '_id' | 'email' | 'createdAt'>): User {
  return { id: user._id.toString(), email: user.email, createdAt: user.createdAt.toISOString() };
}

export interface IssuedTokens extends AuthResponse {
  /** Toujours renseigné en interne ; retiré de la réponse pour le web (cookie). */
  refreshToken: string;
}

async function issueSession(
  user: Pick<UserDoc, '_id' | 'email' | 'createdAt'>,
  platform: ClientPlatform,
  familyId = randomToken(16),
): Promise<IssuedTokens> {
  const config = getConfig();
  const refreshToken = randomToken(48);
  const refreshTokenExpiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  const session = await SessionModel.create({
    userId: user._id,
    refreshTokenHash: sha256(refreshToken),
    familyId,
    platform,
    expiresAt: refreshTokenExpiresAt,
  });
  const access = signAccessToken(user._id.toString(), session._id.toString());
  return {
    user: toUserDto(user),
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt.toISOString(),
    refreshToken,
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
  };
}

export async function register(email: string, password: string, platform: ClientPlatform) {
  const existing = await UserModel.exists({ email });
  if (existing) throw conflict('EMAIL_ALREADY_USED', 'Un compte existe déjà avec cette adresse');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  try {
    const user = await UserModel.create({ email, passwordHash });
    return issueSession(user, platform);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw conflict('EMAIL_ALREADY_USED', 'Un compte existe déjà avec cette adresse');
    }
    throw error;
  }
}

export async function verifyCredentials(email: string, password: string): Promise<UserDoc> {
  const user = await UserModel.findOne({ email }).lean<UserDoc>();
  if (!user) {
    await argon2.verify(await getDummyHash(), password).catch(() => false);
    throw invalidCredentials();
  }
  const valid = await argon2.verify(user.passwordHash, password).catch(() => false);
  if (!valid) throw invalidCredentials();
  return user;
}

export async function login(email: string, password: string, platform: ClientPlatform) {
  const user = await verifyCredentials(email, password);
  return issueSession(user, platform);
}

/**
 * Chaque refresh token ne sert qu'une fois : une réutilisation révoque toute la famille (vol probable),
 * sauf juste après sa rotation, où elle trahit plutôt un renouvellement concurrent.
 */
export async function refresh(refreshToken: string, platform: ClientPlatform) {
  const session = await SessionModel.findOne({ refreshTokenHash: sha256(refreshToken) });
  if (!session) throw unauthorized('Session invalide');
  if (session.revokedAt) {
    if (wasRotatedWithinGracePeriod(session.rotatedAt)) throw refreshSuperseded();
    await SessionModel.updateMany({ familyId: session.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    throw unauthorized('Session révoquée');
  }
  if (session.expiresAt.getTime() <= Date.now()) throw unauthorized('Session expirée');

  const user = await UserModel.findById(session.userId).lean<UserDoc>();
  if (!user) throw unauthorized('Session invalide');

  // Révocation atomique : deux refresh concurrents ne peuvent pas tourner le même token.
  // Date de l'horloge Node plutôt que $currentDate : elle est comparée à Date.now() au prochain refresh.
  const rotatedAt = new Date();
  const claimed = await SessionModel.findOneAndUpdate(
    { _id: session._id, revokedAt: null },
    { $set: { revokedAt: rotatedAt, rotatedAt } },
  );
  if (!claimed) throw refreshSuperseded();

  return issueSession(user, platform, session.familyId);
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  await SessionModel.updateOne(
    { refreshTokenHash: sha256(refreshToken), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

export async function getUser(userId: string): Promise<User> {
  const user = await UserModel.findById(userId).lean<UserDoc>();
  if (!user) throw unauthorized('Compte introuvable');
  return toUserDto(user);
}
