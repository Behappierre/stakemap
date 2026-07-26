import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CsvImport } from '../../components/stakeholders/CsvImport';
import {
  canonicalEntityClient,
  canonicalCsvImportEnabled,
  canonicalReadsEnabled,
  canonicalWritesEnabled,
  fetchStakeholders as loadStakeholders,
  type StakeholderWithCompany,
} from '../../lib/canonical';
import { logAudit } from '../../lib/audit';

const SENTIMENT_BADGE: Record<string, string> = {
  ALLY: 'badge badge-ally',
  NEUTRAL: 'badge badge-neutral',
  OPPONENT: 'badge badge-opponent',
  UNKNOWN: 'badge badge-unknown',
};

export function StakeholderList() {
  const [stakeholders, setStakeholders] = useState<StakeholderWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function deleteStakeholder(id: string) {
    if (!window.confirm('Archive this stakeholder? They will be removed from the map.')) return;
    setDeletingId(id);
    try {
      const { data, error } = await canonicalEntityClient
        .from('stakeholders')
        .update({ status: 'archived' })
        .eq('id', id)
        .eq('status', 'active')
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (data) await logAudit('stakeholder', id, 'archive');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    let active = true;

    void loadStakeholders('active')
      .then((records) => {
        if (active) setStakeholders(records);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load stakeholders',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (loading) return <div className="text-slate-500">Loading stakeholders...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Stakeholders</h1>
        <div className="flex items-center gap-3">
          <Link to="/stakeholders/archived" className="text-sm text-slate-500 hover:text-slate-700">
            View archived
          </Link>
          {(!canonicalReadsEnabled || canonicalWritesEnabled) && (
            <Link to="/stakeholders/new" className="btn-primary">
              Add Stakeholder
            </Link>
          )}
        </div>
      </div>
      {canonicalReadsEnabled ? (
        <div className="mb-5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          {canonicalWritesEnabled
            ? canonicalCsvImportEnabled
              ? 'Using the shared canonical stakeholder register. Changes and confirmed CSV imports are shared with To-do Tracker.'
              : 'Using the shared canonical stakeholder register. Changes made here are shared with To-do Tracker. CSV import remains paused.'
            : 'Reading the shared canonical stakeholder register. Direct stakeholder changes and CSV import are paused during preview validation.'}
        </div>
      ) : null}
      {(!canonicalReadsEnabled || canonicalCsvImportEnabled) && (
        <div className="glass-card-solid mb-6 p-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">
            Import from CSV
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Validate the file first. Nothing is written until you review the
            preview and confirm the valid rows.
          </p>
          <CsvImport onImportComplete={() => setRefreshKey((k) => k + 1)} />
        </div>
      )}
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
                <td className="text-slate-500">{s.companies?.name ?? 'â€”'}</td>
                <td className="text-slate-500">{s.title || 'â€”'}</td>
                <td>
                  <span className={SENTIMENT_BADGE[s.sentiment] || 'badge badge-neutral'}>
                    {s.sentiment}
                  </span>
                </td>
                <td className="text-right">
                  {canonicalReadsEnabled && !canonicalWritesEnabled ? (
                    <span className="text-xs font-medium text-indigo-600">
                      Canonical
                    </span>
                  ) : (
                    <>
                      <Link
                        to={`/stakeholders/${s.id}/edit`}
                        className="font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        Edit
                      </Link>
                      {' Â· '}
                      <button
                        onClick={() => deleteStakeholder(s.id)}
                        disabled={deletingId === s.id}
                        className="font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                      >
                        {deletingId === s.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </>
                  )}
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

