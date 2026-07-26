import { createContext } from 'react';
import type { User } from '@supabase/supabase-js';

export interface AuthContextValue {
  configurationError: string | null;
  loading: boolean;
  user: User | null;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
