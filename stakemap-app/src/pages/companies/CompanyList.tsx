import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../lib/audit';
import type { Company } from '../../types/database';

export function CompanyList() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchCompanies() {
    try {
      const { data, error: err } = await supabase
        .from('companies')
        .select('*')
        .eq('status', 'active')
        .order('name');
      if (err) throw err;
      setCompanies((data as Company[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCompanies();
  }, []);

  async function deleteCompany(id: string) {
    // Guard: check for active stakeholders
    const { count, error: countErr } = await supabase
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
      const { error: err } = await supabase.from('companies').update({ status: 'archived' }).eq('id', id);
      if (err) throw err;
      logAudit('company', id, 'archive');
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
        <Link to="/companies/new" className="btn-primary">
          Add Company
        </Link>
      </div>
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
