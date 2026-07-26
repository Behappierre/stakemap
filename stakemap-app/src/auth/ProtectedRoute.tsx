import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

export function ProtectedRoute() {
  const { configurationError, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (configurationError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="glass-card-solid max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">
            Authentication unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-600">{configurationError}</p>
          <p className="mt-3 text-xs text-slate-500">
            Configure the shared Supabase URL and publishable key for this
            deployment.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
