import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { CsvImport } from '../../components/stakeholders/CsvImport';
import type { Stakeholder } from '../../types/database';

const SENTIMENT_COLORS: Record<string, string> = {
  ALLY: 'text-emerald-400',
  NEUTRAL: 'text-slate-400',
  OPPONENT: 'text-red-400',
  UNKNOWN: 'text-amber-400',
};

export function StakeholderList() {
  const [stakeholders, setStakeholders] = useState<(Stakeholder & { companies: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function deleteStakeholder(id: string) {
    if (!window.confirm('Archive this stakeholder? They will be removed from the map.')) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from('stakeholders').update({ status: 'archived' }).eq('id', id);
      if (error) throw error;
      setRefreshKey((k) => k + 1);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }

  async function fetchStakeholders() {
      try {
        const { data, error: err } = await supabase
          .from('stakeholders')
          .select('*, companies(name)')
          .eq('status', 'active')
          .order('full_name');
        if (err) throw err;
        setStakeholders((data as (Stakeholder & { companies: { name: string } })[]) || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load stakeholders');
      } finally {
        setLoading(false);
      }
  }

  useEffect(() => {
    fetchStakeholders();
  }, [refreshKey]);

  if (loading) return <div className="text-slate-400">Loading stakeholders...</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Stakeholders</h1>
        <Link
          to="/stakeholders/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
        >
          Add Stakeholder
        </Link>
      </div>
      <div className="mb-6 rounded-lg border border-slate-700 bg-slate-800/30 p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-300">Import from CSV</h3>
        <CsvImport onImportComplete={() => setRefreshKey((k) => k + 1)} />
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-700">
        <table className="w-full">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">Company</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">Sentiment</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {stakeholders.map((s) => (
              <tr key={s.id} className="hover:bg-slate-800/30">
                <td className="px-4 py-3 font-medium">{s.full_name}</td>
                <td className="px-4 py-3 text-slate-400">
                  {s.companies?.name ?? '—'}
                </td>
                <td className="px-4 py-3 text-slate-400">{s.title || '—'}</td>
                <td className={`px-4 py-3 ${SENTIMENT_COLORS[s.sentiment] || 'text-slate-400'}`}>
                  {s.sentiment}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/stakeholders/${s.id}/edit`}
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    Edit
                  </Link>
                  {' · '}
                  <button
                    onClick={() => deleteStakeholder(s.id)}
                    disabled={deletingId === s.id}
                    className="text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    {deletingId === s.id ? 'Deleting…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {stakeholders.length === 0 && (
        <p className="mt-4 text-slate-400">
          No stakeholders yet. Add a company first, then add stakeholders.
        </p>
      )}
    </div>
  );
}
