import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { authSupabase } from '../../lib/auth';

export function LoginPage() {
  const { configurationError, loading, user } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const from =
    (
      location.state as {
        from?: { pathname?: string };
      } | null
    )?.from?.pathname || '/';

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: signInError } =
      await authSupabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-600/20">
            SM
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Sign in to StakeMap
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Use the same account as To-do Tracker.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-card-solid space-y-5 p-6"
        >
          <div>
            <label className="label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input"
              placeholder="Your password"
            />
          </div>

          {(configurationError || error) && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {configurationError || error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || loading || Boolean(configurationError)}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          StakeMap and To-do Tracker remain separate applications but share
          this identity.
        </p>
      </div>
    </div>
  );
}
