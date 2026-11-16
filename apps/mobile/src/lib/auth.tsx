import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { User } from '@subtracker/contracts';
import { applyAuthResponse, authRequest, logoutSession, onSessionChange, refreshSession } from './http';
import { queryClient } from './query';

type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return value;
}

/**
 * Session : access token en mémoire uniquement ; refresh token en trousseau sécurisé (natif)
 * ou en cookie httpOnly (web). Au démarrage, on tente un refresh pour restaurer la session.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onSessionChange((response) => {
      setUser(response?.user ?? null);
      setStatus(response ? 'signedIn' : 'signedOut');
      if (!response) queryClient.clear();
    });
    refreshSession()
      .then((response) => {
        if (!response) setStatus('signedOut');
      })
      .catch(() => setStatus('signedOut'));
    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await applyAuthResponse(await authRequest('/auth/login', { email, password }));
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    await applyAuthResponse(await authRequest('/auth/register', { email, password }));
  }, []);

  const signOut = useCallback(async () => {
    await logoutSession().catch(() => applyAuthResponse(null));
  }, []);

  const value = useMemo(() => ({ status, user, signIn, signUp, signOut }), [status, user, signIn, signUp, signOut]);
  return <AuthContext value={value}>{children}</AuthContext>;
}
