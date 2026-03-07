import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import type { Stakeholder } from '../../types/database';

const SENTIMENT_BADGE: Record<string, string> = {
  ALLY: 'badge badge-ally',
  NEUTRAL: 'badge badge-neutral',
  OPPONENT: 'badge badge-opponent',
  UNKNOWN: 'badge badge-unknown',
};

export function ArchivedStakeholders() {
  const [stakeholders, setStakeholders] = useState<(Stakeholder & { companies: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function fetchArchived() {
    try {
      const { data, error: err } = await supabase
        .from('stakeholders')
        .select('*, companies(name)')
        .eq('status', 'archived')
        .order('full_name');
      if (err) throw err;
      setStakeholders((data as (Stakeholder & { companies: { name: string } })[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load archived stakeholders');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchArchived();
  }, []);

  async function restore(id: string) {
    if (!window.confirm('Restore this stakeholder? They will reappear on the map.')) return;
    setRestoringId(id);
    try {
      const { error: err } = await supabase.from('stakeholders').update({ status: 'active' }).eq('id', id);
      if (err) throw err;
      logAudit('stakeholder', id, 'restore');
      await fetchArchived();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Failed to restore');
    } finally {
      setRestoringId(null);
    }
  }

  if (loading) return <div className="text-slate-500">Loading archived stakeholders...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Archived Stakeholders</h1>
          <p className="mt-1 text-sm text-slate-500">Restore any stakeholder to make them visible again on the map.</p>
        </div>
        <Link to="/stakeholders" className="btn-secondary">
          ← Back to Stakeholders
        </Link>
      </div>

      {stakeholders.length === 0 ? (
        <p className="mt-6 text-center text-slate-500">No archived stakeholders.</p>
      ) : (
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
                    <button
                      onClick={() => restore(s.id)}
                      disabled={restoringId === s.id}
                      className="font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                    >
                      {restoringId === s.id ? 'Restoring...' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
