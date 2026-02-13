import { Outlet, NavLink } from 'react-router-dom';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50 text-slate-900">
      <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-4 sm:px-6">
          <NavLink
            to="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 transition hover:text-emerald-600"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
              SM
            </span>
            StakeMap
          </NavLink>
          <div className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? 'nav-pill-active' : 'nav-pill-inactive'
              }
            >
              Map
            </NavLink>
            <NavLink
              to="/companies"
              className={({ isActive }) =>
                isActive ? 'nav-pill-active' : 'nav-pill-inactive'
              }
            >
              Companies
            </NavLink>
            <NavLink
              to="/stakeholders"
              className={({ isActive }) =>
                isActive ? 'nav-pill-active' : 'nav-pill-inactive'
              }
            >
              Stakeholders
            </NavLink>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
