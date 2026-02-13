import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { CsvImport } from '../../components/stakeholders/CsvImport';
import type { Stakeholder } from '../../types/database';

const SENTIMENT_BADGE: Record<string, string> = {
  ALLY: 'badge badge-ally',
  NEUTRAL: 'badge badge-neutral',
  OPPONENT: 'badge badge-opponent',
  UNKNOWN: 'badge badge-unknown',
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

  if (loading) return <div className="text-slate-500">Loading stakeholders...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Stakeholders</h1>
        <Link to="/stakeholders/new" className="btn-primary">
          Add Stakeholder
        </Link>
      </div>
      <div className="glass-card-solid mb-6 p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Import from CSV</h3>
        <CsvImport onImportComplete={() => setRefreshKey((k) => k + 1)} />
      </div>
      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Title</th>
              <th>Sentiment</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stakeholders.map((s) => (
              <tr key={s.id} className="table-row">
                <td className="font-medium text-slate-900">{s.full_name}</td>
                <td className="text-slate-500">{s.companies?.name ?? '—'}</td>
                <td className="text-slate-500">{s.title || '—'}</td>
                <td>
                  <span className={SENTIMENT_BADGE[s.sentiment] || 'badge badge-neutral'}>
                    {s.sentiment}
                  </span>
                </td>
                <td className="text-right">
                  <Link
                    to={`/stakeholders/${s.id}/edit`}
                    className="font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Edit
                  </Link>
                  {' · '}
                  <button
                    onClick={() => deleteStakeholder(s.id)}
                    disabled={deletingId === s.id}
                    className="font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                  >
                    {deletingId === s.id ? 'Deleting...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {stakeholders.length === 0 && (
        <p className="mt-6 text-center text-slate-500">
          No stakeholders yet. Add a company first, then add stakeholders.
        </p>
      )}
    </div>
  );
}
