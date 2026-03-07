import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { InteractionLog } from '../../types/database';

const CHANNEL_OPTIONS = ['email', 'call', 'meeting', 'message', 'other'];

interface Props {
  stakeholderId: string;
}

export function InteractionLogSection({ stakeholderId }: Props) {
  const [logs, setLogs] = useState<InteractionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    interaction_date: new Date().toISOString().slice(0, 10),
    channel: 'meeting',
    summary: '',
    outcome: '',
    next_action: '',
  });

  async function fetchLogs() {
    const { data } = await supabase
      .from('interaction_logs')
      .select('*')
      .eq('stakeholder_id', stakeholderId)
      .order('interaction_date', { ascending: false });
    setLogs((data as InteractionLog[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchLogs();
  }, [stakeholderId]);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!form.summary.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('interaction_logs').insert({
        stakeholder_id: stakeholderId,
        interaction_date: form.interaction_date,
        channel: form.channel || null,
        summary: form.summary.trim(),
        outcome: form.outcome.trim() || null,
        next_action: form.next_action.trim() || null,
      });
      if (error) throw error;
      setForm({ interaction_date: new Date().toISOString().slice(0, 10), channel: 'meeting', summary: '', outcome: '', next_action: '' });
      setShowForm(false);
      await fetchLogs();
    } catch (e) {
      console.error('Failed to add interaction log:', e);
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!window.confirm('Delete this interaction log entry?')) return;
    await supabase.from('interaction_logs').delete().eq('id', id);
    await fetchLogs();
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Interaction Log</h3>
        <button onClick={() => setShowForm((v) => !v)} className="btn-secondary py-1 text-xs">
          {showForm ? 'Cancel' : '+ Add Entry'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addEntry} className="mb-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 fade-in">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Date</label>
              <input
                type="date"
                value={form.interaction_date}
                onChange={(e) => setForm((f) => ({ ...f, interaction_date: e.target.value }))}
                className="input py-1.5 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="label">Channel</label>
              <select
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                className="input py-1.5 text-sm"
              >
                {CHANNEL_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Summary *</label>
            <textarea
              required
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              rows={2}
              placeholder="What happened?"
              className="input resize-none text-sm"
            />
          </div>
          <div>
            <label className="label">Outcome</label>
            <input
              type="text"
              value={form.outcome}
              onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
              placeholder="Result or decision…"
              className="input py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="label">Next Action</label>
            <input
              type="text"
              value={form.next_action}
              onChange={(e) => setForm((f) => ({ ...f, next_action: e.target.value }))}
              placeholder="Follow-up task…"
              className="input py-1.5 text-sm"
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full py-1.5 text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Entry'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-slate-400">No interactions logged yet.</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => (
            <li key={log.id} className="rounded-lg border border-gray-100 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{log.interaction_date}</span>
                    {log.channel && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 capitalize">{log.channel}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{log.summary}</p>
                  {log.outcome && <p className="mt-0.5 text-xs text-slate-500"><span className="font-medium">Outcome:</span> {log.outcome}</p>}
                  {log.next_action && <p className="mt-0.5 text-xs text-emerald-600"><span className="font-medium">Next:</span> {log.next_action}</p>}
                </div>
                <button
                  onClick={() => deleteEntry(log.id)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-500"
                  title="Delete"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
