import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Company } from '../../types/database';

export function CompanyList() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCompanies() {
      try {
        const { data, error: err } = await supabase
          .from('companies')
          .select('*')
          .order('name');
        if (err) throw err;
        setCompanies((data as Company[]) || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load companies');
      } finally {
        setLoading(false);
      }
    }
    fetchCompanies();
  }, []);

  if (loading) return <div className="text-slate-400">Loading companies...</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Companies</h1>
        <Link
          to="/companies/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
        >
          Add Company
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-700">
        <table className="w-full">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">Industry</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">Region</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {companies.map((c) => (
              <tr key={c.id} className="hover:bg-slate-800/30">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-slate-400">{c.industry || '—'}</td>
                <td className="px-4 py-3 text-slate-400">{c.region || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/companies/${c.id}/edit`}
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {companies.length === 0 && (
        <p className="mt-4 text-slate-400">No companies yet. Add your first company to get started.</p>
      )}
    </div>
  );
}
