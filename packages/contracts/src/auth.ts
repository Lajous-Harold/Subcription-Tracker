import { z } from 'zod';
import { IdSchema, TimestampSchema } from './common';

export const EmailSchema = z.string().trim().toLowerCase().email('Adresse email invalide').max(254);
export const PASSWORD_MIN_LENGTH = 8;

/** Politique appliquée à l'inscription seulement : la connexion accepte tout mot de passe existant. */
export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`)
  .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères')
  .regex(/\p{Lu}/u, 'Le mot de passe doit contenir au moins une majuscule')
  .regex(/\p{Ll}/u, 'Le mot de passe doit contenir au moins une minuscule')
  .regex(/\d/, 'Le mot de passe doit contenir au moins un chiffre')
  .regex(/[^\p{L}\d]/u, 'Le mot de passe doit contenir au moins un symbole (caractère ni lettre ni chiffre)');

export const RegisterBodySchema = z.strictObject({
  email: EmailSchema,
  password: PasswordSchema,
});
export type RegisterBody = z.infer<typeof RegisterBodySchema>;

export const LoginBodySchema = z.strictObject({
  email: EmailSchema,
  password: z.string().min(1, 'Mot de passe requis').max(128),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

/** Sur mobile, le refresh token voyage dans le corps ; sur web, dans un cookie httpOnly. */
export const RefreshBodySchema = z.strictObject({
  refreshToken: z.string().min(20).optional(),
});
export type RefreshBody = z.infer<typeof RefreshBodySchema>;

export const LogoutBodySchema = RefreshBodySchema;

export const UserSchema = z.object({
  id: IdSchema,
  email: z.string(),
  createdAt: TimestampSchema,
});
export type User = z.infer<typeof UserSchema>;

export const AuthResponseSchema = z.object({
  user: UserSchema,
  accessToken: z.string(),
  accessTokenExpiresAt: TimestampSchema,
  /** Présent uniquement pour les clients natifs. */
  refreshToken: z.string().optional(),
  refreshTokenExpiresAt: TimestampSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const DeleteAccountBodySchema = z.strictObject({
  password: z.string().min(1, 'Mot de passe requis pour confirmer').max(128),
});
export type DeleteAccountBody = z.infer<typeof DeleteAccountBodySchema>;
