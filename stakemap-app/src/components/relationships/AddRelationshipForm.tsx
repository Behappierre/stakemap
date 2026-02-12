import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Stakeholder } from '../../types/database';
import type { Company } from '../../types/database';
import type { RelationType } from '../../types/database';

const RELATION_TYPES: RelationType[] = [
  'REPORTS_TO',
  'PEER_OF',
  'INFLUENCES',
  'COLLABORATES_WITH',
  'ADVISES',
  'BLOCKS',
  'SPONSORS',
  'GATEKEEPER_FOR',
];

interface AddRelationshipFormProps {
  onAdded?: () => void;
  fromStakeholderId?: string;
}

export function AddRelationshipForm({ onAdded, fromStakeholderId }: AddRelationshipFormProps) {
  const [stakeholders, setStakeholders] = useState<(Stakeholder & { companies: Company })[]>([]);
  const [fromId, setFromId] = useState(fromStakeholderId || '');
  const [toId, setToId] = useState('');
  const [relationType, setRelationType] = useState<RelationType>('COLLABORATES_WITH');
  const [strength, setStrength] = useState(3);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('stakeholders')
        .select('*, companies(name)')
        .eq('status', 'active')
        .order('full_name');
      setStakeholders((data as (Stakeholder & { companies: Company })[]) || []);
    }
    load();
  }, []);

  useEffect(() => {
    if (fromStakeholderId) setFromId(fromStakeholderId);
  }, [fromStakeholderId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fromId || !toId || fromId === toId) {
      setError('Select different From and To stakeholders.');
      return;
    }
    try {
      const { error: err } = await supabase.from('relationships').insert({
        from_stakeholder_id: fromId,
        to_stakeholder_id: toId,
        relation_type: relationType,
        strength,
      });
      if (err) throw err;
      setFromId(fromStakeholderId || '');
      setToId('');
      onAdded?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add relationship');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="rounded bg-red-500/20 p-2 text-sm text-red-400">{error}</div>}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">From</label>
        <select
          value={fromId}
          onChange={(e) => setFromId(e.target.value)}
          required
          disabled={!!fromStakeholderId}
          className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
        >
          <option value="">Select stakeholder</option>
          {stakeholders.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name} ({(s.companies as Company)?.name ?? '?'})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">To</label>
        <select
          value={toId}
          onChange={(e) => setToId(e.target.value)}
          required
          className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
        >
          <option value="">Select stakeholder</option>
          {stakeholders.filter((s) => s.id !== fromId).map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name} ({(s.companies as Company)?.name ?? '?'})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Relationship Type</label>
        <select
          value={relationType}
          onChange={(e) => setRelationType(e.target.value as RelationType)}
          className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
        >
          {RELATION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Strength (1–5)</label>
        <input
          type="number"
          min={1}
          max={5}
          value={strength}
          onChange={(e) => setStrength(+e.target.value)}
          className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
        />
      </div>
      <button
        type="submit"
        className="w-full rounded bg-emerald-600 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
      >
        Add Relationship
      </button>
    </form>
  );
}
