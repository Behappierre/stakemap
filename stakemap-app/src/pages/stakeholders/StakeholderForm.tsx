import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Stakeholder } from '../../types/database';
import type { Company } from '../../types/database';
import type { SentimentType, SeniorityLevel } from '../../types/database';

const SENTIMENT_OPTIONS: SentimentType[] = ['ALLY', 'NEUTRAL', 'OPPONENT', 'UNKNOWN'];
const SENIORITY_OPTIONS: SeniorityLevel[] = ['C_LEVEL', 'VP', 'DIRECTOR', 'MANAGER', 'IC'];

export function StakeholderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    title: '',
    company_id: '',
    department: '',
    seniority_level: '' as SeniorityLevel | '',
    influence_score: 3,
    sentiment: 'UNKNOWN' as SentimentType,
    sentiment_confidence: 3,
  });

  useEffect(() => {
    async function loadCompanies() {
      const { data } = await supabase.from('companies').select('*').order('name');
      setCompanies((data as Company[]) || []);
    }
    loadCompanies();
  }, []);

  useEffect(() => {
    const loadId = id;
    if (!loadId) return;
    async function load() {
      const { data, error: err } = await supabase.from('stakeholders').select('*').eq('id', loadId).single();
      if (err) {
        setError(err.message);
        return;
      }
      const s = data as Stakeholder;
      setForm({
        full_name: s.full_name,
        title: s.title || '',
        company_id: s.company_id,
        department: s.department || '',
        seniority_level: s.seniority_level || '',
        influence_score: s.influence_score ?? 3,
        sentiment: s.sentiment,
        sentiment_confidence: s.sentiment_confidence ?? 3,
      });
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      full_name: form.full_name.trim(),
      title: form.title.trim() || null,
      company_id: form.company_id,
      department: form.department.trim() || null,
      seniority_level: form.seniority_level || null,
      influence_score: form.influence_score,
      sentiment: form.sentiment,
      sentiment_confidence: form.sentiment_confidence,
      updated_at: new Date().toISOString(),
    };

    try {
      if (isEdit) {
        const { error: err } = await supabase.from('stakeholders').update(payload).eq('id', id!);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('stakeholders').insert({
          ...payload,
          updated_at: undefined,
        });
        if (err) throw err;
      }
      navigate('/stakeholders');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (!window.confirm('Archive this stakeholder? They will be removed from the map.')) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase.from('stakeholders').update({ status: 'archived' }).eq('id', id);
      if (err) throw err;
      navigate('/stakeholders');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
      setDeleting(false);
    }
  }

  if (loading) return <div className="text-slate-500">Loading...</div>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">{isEdit ? 'Edit Stakeholder' : 'Add Stakeholder'}</h1>
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
        <div>
          <label className="label">Full Name *</label>
          <input
            type="text"
            required
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            className="input"
          />
        </div>
        <div>
          <label className="label">Company *</label>
          <select
            required
            value={form.company_id}
            onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value }))}
            className="input"
          >
            <option value="">Select company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Job Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="input"
          />
        </div>
        <div>
          <label className="label">Department</label>
          <input
            type="text"
            value={form.department}
            onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            className="input"
          />
        </div>
        <div>
          <label className="label">Seniority</label>
          <select
            value={form.seniority_level}
            onChange={(e) => setForm((f) => ({ ...f, seniority_level: e.target.value as SeniorityLevel }))}
            className="input"
          >
            <option value="">--</option>
            {SENIORITY_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Influence Score (1-5)</label>
          <input
            type="number"
            min={1}
            max={5}
            value={form.influence_score}
            onChange={(e) => setForm((f) => ({ ...f, influence_score: +e.target.value }))}
            className="input"
          />
        </div>
        <div>
          <label className="label">Sentiment</label>
          <select
            value={form.sentiment}
            onChange={(e) => setForm((f) => ({ ...f, sentiment: e.target.value as SentimentType }))}
            className="input"
          >
            {SENTIMENT_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Sentiment Confidence (1-5)</label>
          <input
            type="number"
            min={1}
            max={5}
            value={form.sentiment_confidence}
            onChange={(e) => setForm((f) => ({ ...f, sentiment_confidence: +e.target.value }))}
            className="input"
          />
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button type="submit" className="btn-primary">
            {isEdit ? 'Save' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/stakeholders')}
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
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
