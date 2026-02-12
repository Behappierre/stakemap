import { Outlet, NavLink } from 'react-router-dom';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <NavLink
            to="/"
            className="font-semibold text-emerald-400 transition hover:text-emerald-300"
          >
            StakeMap
          </NavLink>
          <div className="flex gap-4">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `text-sm transition ${isActive ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`
              }
            >
              Map
            </NavLink>
            <NavLink
              to="/companies"
              className={({ isActive }) =>
                `text-sm transition ${isActive ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`
              }
            >
              Companies
            </NavLink>
            <NavLink
              to="/stakeholders"
              className={({ isActive }) =>
                `text-sm transition ${isActive ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`
              }
            >
              Stakeholders
            </NavLink>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
