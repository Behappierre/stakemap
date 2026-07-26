import { createClient } from '@supabase/supabase-js';

const authSupabaseUrl = import.meta.env.VITE_AUTH_SUPABASE_URL;
const authSupabasePublishableKey =
  import.meta.env.VITE_AUTH_SUPABASE_PUBLISHABLE_KEY;

export const authConfigurationError =
  !authSupabaseUrl || !authSupabasePublishableKey
    ? 'Shared authentication is not configured for this deployment.'
    : null;

export const authSupabase = createClient(
  authSupabaseUrl || 'https://missing-auth-configuration.invalid',
  authSupabasePublishableKey || 'missing-publishable-key',
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
      storageKey: 'stakemap-shared-auth',
    },
  },
);
