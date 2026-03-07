import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import type { AuditEvent } from '../../types/database';

const ACTION_BADGE: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-blue-100 text-blue-700',
  archive: 'bg-amber-100 text-amber-700',
  restore: 'bg-violet-100 text-violet-700',
  delete: 'bg-red-100 text-red-700',
};

const ENTITY_BADGE: Record<string, string> = {
  stakeholder: 'bg-slate-100 text-slate-600',
  company: 'bg-slate-100 text-slate-600',
  relationship: 'bg-slate-100 text-slate-600',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

const ENTITY_TYPES = ['stakeholder', 'company', 'relationship'];
const ACTIONS = ['create', 'update', 'archive', 'restore', 'delete'];

export function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    async function fetchEvents() {
      const { data } = await supabase
        .from('audit_events')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(300);
      setEvents((data as AuditEvent[]) || []);
      setLoading(false);
    }
    fetchEvents();
  }, []);

  const filtered = useMemo(() => {
    let result = events;
    if (entityFilter) result = result.filter((e) => e.entity_type === entityFilter);
    if (actionFilter) result = result.filter((e) => e.action === actionFilter);
    return result;
  }, [events, entityFilter, actionFilter]);

  if (loading) return <div className="text-slate-500">Loading audit log...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Audit Log</h1>
          <p className="mt-1 text-sm text-slate-500">Last 300 changes across all entities.</p>
        </div>
        <div className="flex gap-3">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          >
            <option value="">All entity types</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card-solid p-8 text-center">
          <p className="text-sm text-slate-500">No audit events found.</p>
          <p className="mt-1 text-xs text-slate-400">Events are recorded when stakeholders, companies, or relationships are created, edited, or archived.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="w-full">
            <thead className="table-header">
              <tr>
                <th>Entity</th>
                <th>Action</th>
                <th>Entity ID</th>
                <th>Details</th>
                <th className="text-right">When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((evt) => (
                <tr key={evt.id} className="table-row">
                  <td>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ENTITY_BADGE[evt.entity_type] || 'bg-gray-100 text-gray-600'}`}>
                      {evt.entity_type}
                    </span>
                  </td>
                  <td>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ACTION_BADGE[evt.action] || 'bg-gray-100 text-gray-600'}`}>
                      {evt.action}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-slate-400" title={evt.entity_id}>
                    {evt.entity_id.slice(0, 8)}…
                  </td>
                  <td className="max-w-xs truncate text-xs text-slate-500">
                    {evt.diff_json ? JSON.stringify(evt.diff_json) : '—'}
                  </td>
                  <td className="text-right text-xs text-slate-400" title={evt.changed_at}>
                    {relativeTime(evt.changed_at)}
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
