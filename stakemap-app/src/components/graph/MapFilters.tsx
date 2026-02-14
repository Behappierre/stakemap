import { useState, useRef, useEffect } from 'react';

export interface MapFilterState {
  sentiments: string[];
  seniorities: string[];
  minInfluence: number;
}

interface MapFiltersProps {
  filters: MapFilterState;
  onChange: (filters: MapFilterState) => void;
}

const SENTIMENTS = [
  { value: 'ALLY', label: 'Ally', color: '#059669' },
  { value: 'NEUTRAL', label: 'Neutral', color: '#64748b' },
  { value: 'OPPONENT', label: 'Opponent', color: '#dc2626' },
  { value: 'UNKNOWN', label: 'Unknown', color: '#d97706' },
];

const SENIORITIES = [
  { value: 'C_LEVEL', label: 'C-Level' },
  { value: 'VP', label: 'VP' },
  { value: 'DIRECTOR', label: 'Director' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'IC', label: 'IC' },
];

export function MapFilters({ filters, onChange }: MapFiltersProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeCount =
    filters.sentiments.length +
    filters.seniorities.length +
    (filters.minInfluence > 0 ? 1 : 0);

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

  function toggleSentiment(val: string) {
    const next = filters.sentiments.includes(val)
      ? filters.sentiments.filter((s) => s !== val)
      : [...filters.sentiments, val];
    onChange({ ...filters, sentiments: next });
  }

  function toggleSeniority(val: string) {
    const next = filters.seniorities.includes(val)
      ? filters.seniorities.filter((s) => s !== val)
      : [...filters.seniorities, val];
    onChange({ ...filters, seniorities: next });
  }

  function clearAll() {
    onChange({ sentiments: [], seniorities: [], minInfluence: 0 });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`btn-secondary py-1.5 text-xs ${activeCount > 0 ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : ''}`}
      >
        <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
        </svg>
        Filters{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-gray-200 bg-white shadow-lg fade-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-700">Filter Stakeholders</span>
            {activeCount > 0 && (
              <button onClick={clearAll} className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
                Clear all
              </button>
            )}
          </div>

          {/* Sentiment */}
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sentiment</p>
            <div className="flex flex-wrap gap-1.5">
              {SENTIMENTS.map((s) => {
                const active = filters.sentiments.includes(s.value);
                return (
                  <button
                    key={s.value}
                    onClick={() => toggleSentiment(s.value)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300'
                        : 'bg-gray-50 text-slate-500 hover:bg-gray-100'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seniority */}
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Seniority</p>
            <div className="flex flex-wrap gap-1.5">
              {SENIORITIES.map((s) => {
                const active = filters.seniorities.includes(s.value);
                return (
                  <button
                    key={s.value}
                    onClick={() => toggleSeniority(s.value)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300'
                        : 'bg-gray-50 text-slate-500 hover:bg-gray-100'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Influence */}
          <div className="px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Min Influence: {filters.minInfluence > 0 ? `${filters.minInfluence}+` : 'Any'}
            </p>
            <input
              type="range"
              min={0}
              max={5}
              value={filters.minInfluence}
              onChange={(e) => onChange({ ...filters, minInfluence: +e.target.value })}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Any</span>
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
