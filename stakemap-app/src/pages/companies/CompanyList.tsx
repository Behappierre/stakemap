import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { logAudit } from '../../lib/audit';
import type { Company } from '../../types/database';
import {
  canonicalEntityClient,
  canonicalReadsEnabled,
  canonicalWritesEnabled,
  fetchCompanies as loadCompanies,
} from '../../lib/canonical';

export function CompanyList() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchCompanies() {
    try {
      setCompanies(await loadCompanies('active'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    void loadCompanies('active')
      .then((records) => {
        if (active) setCompanies(records);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load companies',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function deleteCompany(id: string) {
    // Guard: check for active stakeholders
    const { count, error: countErr } = await canonicalEntityClient
      .from('stakeholders')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', id)
      .eq('status', 'active');
    if (countErr) { window.alert('Could not verify stakeholders. Try again.'); return; }
    if ((count ?? 0) > 0) {
      window.alert(`This company has ${count} active stakeholder${count === 1 ? '' : 's'}. Archive or reassign them before deleting the company.`);
      return;
    }
    if (!window.confirm('Archive this company? It will be hidden from all views.')) return;
    setDeletingId(id);
    try {
      const { error: err } = await canonicalEntityClient
        .from('companies')
        .update({ status: 'archived' })
        .eq('id', id);
      if (err) throw err;
      await logAudit('company', id, 'archive');
      await fetchCompanies();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Failed to archive company');
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <div className="text-slate-500">Loading companies...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Companies</h1>
        {(!canonicalReadsEnabled || canonicalWritesEnabled) && (
          <Link to="/companies/new" className="btn-primary">
            Add Company
          </Link>
        )}
      </div>
      {canonicalReadsEnabled && (
        <div className="mb-5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          {canonicalWritesEnabled
            ? 'Using the shared canonical company register. Changes made here are shared with To-do Tracker.'
            : 'Reading the shared canonical company register. Company changes are paused during preview validation.'}
        </div>
      )}
      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th>Name</th>
              <th>Industry</th>
              <th>Region</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="table-row">
                <td className="font-medium text-slate-900">{c.name}</td>
                <td className="text-slate-500">{c.industry || '—'}</td>
                <td className="text-slate-500">{c.region || '—'}</td>
                <td className="text-right">
                  {canonicalReadsEnabled && !canonicalWritesEnabled ? (
                    <span className="text-xs font-medium text-indigo-600">
                      Canonical
                    </span>
                  ) : (
                    <>
                      <Link
                        to={`/companies/${c.id}/edit`}
                        className="font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        Edit
                      </Link>
                      {' · '}
                      <button
                        onClick={() => deleteCompany(c.id)}
                        disabled={deletingId === c.id}
                        className="font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                      >
                        {deletingId === c.id ? 'Archiving...' : 'Archive'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {companies.length === 0 && (
        <p className="mt-6 text-center text-slate-500">No companies yet. Add your first company to get started.</p>
      )}
    </div>
  );
}
