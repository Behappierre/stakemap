import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Company } from '../../types/database';

export function CompanyForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState({
    name: '',
    industry: '',
    region: '',
    parent_company_id: '',
    tags: '',
  });

  useEffect(() => {
    async function loadAll() {
      const { data } = await supabase.from('companies').select('*').eq('status', 'active').order('name');
      setAllCompanies((data as Company[]) || []);
    }
    loadAll();
  }, []);

  useEffect(() => {
    const loadId = id;
    if (!loadId) return;
    async function load() {
      const { data, error: err } = await supabase.from('companies').select('*').eq('id', loadId).single();
      if (err) {
        setError(err.message);
        return;
      }
      const c = data as Company;
      setForm({
        name: c.name,
        industry: c.industry || '',
        region: c.region || '',
        parent_company_id: c.parent_company_id || '',
        tags: Array.isArray(c.tags) ? c.tags.join(', ') : '',
      });
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const tags = form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    const payload = {
      name: form.name.trim(),
      industry: form.industry.trim() || null,
      region: form.region.trim() || null,
      parent_company_id: form.parent_company_id || null,
      tags,
      updated_at: new Date().toISOString(),
    };

    try {
      if (isEdit) {
        const { error: err } = await supabase.from('companies').update(payload).eq('id', id!);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('companies').insert({
          ...payload,
          updated_at: undefined,
        });
        if (err) throw err;
      }
      navigate('/companies');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }

  async function handleDelete() {
    if (!id) return;
    const { count } = await supabase
      .from('stakeholders')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', id)
      .eq('status', 'active');
    if ((count ?? 0) > 0) {
      window.alert(`This company has ${count} active stakeholder${count === 1 ? '' : 's'}. Archive or reassign them before archiving the company.`);
      return;
    }
    if (!window.confirm('Archive this company?')) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase.from('companies').update({ status: 'archived' }).eq('id', id);
      if (err) throw err;
      navigate('/companies');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to archive');
      setDeleting(false);
    }
  }

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">{isEdit ? 'Edit Company' : 'Add Company'}</h1>
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
        <div>
          <label className="label">Name *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="input"
          />
        </div>
        <div>
          <label className="label">Industry</label>
          <input
            type="text"
            value={form.industry}
            onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
            className="input"
          />
        </div>
        <div>
          <label className="label">Region</label>
          <input
            type="text"
            value={form.region}
            onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
            className="input"
          />
        </div>
        <div>
          <label className="label">Parent Company</label>
          <select
            value={form.parent_company_id}
            onChange={(e) => setForm((f) => ({ ...f, parent_company_id: e.target.value }))}
            className="input"
          >
            <option value="">None</option>
            {allCompanies.filter((c) => c.id !== id).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tags (comma-separated)</label>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
            placeholder="e.g. enterprise, B2B"
            className="input"
          />
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button type="submit" className="btn-primary">
            {isEdit ? 'Save' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/companies')}
            className="btn-secondary"
          >
            Cancel
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="btn-danger ml-auto disabled:opacity-50"
            >
              {deleting ? 'Archiving...' : 'Archive'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
