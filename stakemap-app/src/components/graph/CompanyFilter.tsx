import { useState, useRef, useEffect, useMemo } from 'react';

interface Company {
  id: string;
  name: string;
  count: number;
}

interface CompanyFilterProps {
  companies: Company[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
}

export function CompanyFilter({ companies, selected, onChange }: CompanyFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const allSelected = selected.size === companies.length;
  const noneSelected = selected.size === 0;
  const filterActive = !allSelected && !noneSelected;

  const filtered = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, search]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  // Focus search on open
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(companies.map((c) => c.id)));
  }

  function clearAll() {
    onChange(new Set());
  }

  // Chips: show selected companies (up to 3, then "+N more")
  const selectedCompanies = companies.filter((c) => selected.has(c.id));

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger + chips row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`btn-secondary py-1.5 text-xs ${filterActive ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : ''}`}
        >
          <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
          </svg>
          {allSelected ? 'All Companies' : noneSelected ? 'No Companies' : `${selected.size} of ${companies.length}`}
        </button>

        {/* Chips for selected (when filtering) */}
        {filterActive && (
          <>
            {selectedCompanies.slice(0, 3).map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-slate-600"
              >
                {c.name}
                <button
                  onClick={() => toggle(c.id)}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-gray-200 hover:text-slate-600"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {selectedCompanies.length > 3 && (
              <span className="text-xs text-slate-400">+{selectedCompanies.length - 3} more</span>
            )}
            <button
              onClick={selectAll}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
            >
              Show all
            </button>
          </>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-gray-200 bg-white shadow-lg fade-in">
          {/* Search */}
          <div className="border-b border-gray-100 p-2">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 border-b border-gray-100 px-3 py-1.5">
            <button
              onClick={selectAll}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
            >
              Select all
            </button>
            <span className="text-xs text-slate-300">|</span>
            <button
              onClick={clearAll}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
          </div>

          {/* Company list */}
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">No companies match</p>
            ) : (
              filtered.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/20"
                  />
                  <span className="flex-1 truncate text-xs font-medium text-slate-700">{c.name}</span>
                  <span className="text-[10px] text-slate-400">{c.count}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
