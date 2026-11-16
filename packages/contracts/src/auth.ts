import { z } from 'zod';
import { IdSchema, TimestampSchema } from './common';

export const EmailSchema = z.string().trim().toLowerCase().email('Adresse email invalide').max(254);
export const PasswordSchema = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caractères')
  .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères');

export const RegisterBodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
});
export type RegisterBody = z.infer<typeof RegisterBodySchema>;

export const LoginBodySchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Mot de passe requis').max(128),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

/** Sur mobile, le refresh token voyage dans le corps ; sur web, dans un cookie httpOnly. */
export const RefreshBodySchema = z.object({
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

export const DeleteAccountBodySchema = z.object({
  password: z.string().min(1, 'Mot de passe requis pour confirmer').max(128),
});
export type DeleteAccountBody = z.infer<typeof DeleteAccountBodySchema>;
