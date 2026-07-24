import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { AuthContext } from './auth-context';
import {
  authConfigurationError,
  authSupabase,
} from '../lib/auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      if (authConfigurationError) {
        if (active) setLoading(false);
        return;
      }

      const {
        data: { user: validatedUser },
        error,
      } = await authSupabase.auth.getUser();

      if (!active) return;
      setUser(error ? null : validatedUser);
      setLoading(false);
    }

    void loadUser();

    const {
      data: { subscription },
    } = authSupabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'INITIAL_SESSION') return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      configurationError: authConfigurationError,
      loading,
      user,
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
