import { useEffect, useState } from 'react';
import { GraphCanvas } from '../../components/graph/GraphCanvas';
import { AddRelationshipForm } from '../../components/relationships/AddRelationshipForm';
import { supabase } from '../../lib/supabase';
import { DEFAULT_MAP_ID } from '../../lib/constants';
import type { Stakeholder } from '../../types/database';
import type { Relationship } from '../../types/database';
import type { MapLayout } from '../../types/database';

export function MapPage() {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [layouts, setLayouts] = useState<MapLayout[]>([]);
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  const [showAddRelationship, setShowAddRelationship] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clustering, setClustering] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deleteStakeholder(id: string) {
    if (!window.confirm('Archive this stakeholder? They will be removed from the map.')) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('stakeholders').update({ status: 'archived' }).eq('id', id);
      if (error) throw error;
      setSelectedStakeholder(null);
      await loadData();
    } catch (e) {
      console.error('Delete failed:', e);
      window.alert('Failed to delete stakeholder.');
    } finally {
      setDeleting(false);
    }
  }

  async function clusterByCompany() {
    if (stakeholders.length === 0) return;
    setClustering(true);
    try {
      const byCompany = new Map<string, (Stakeholder & { companies?: { name: string } })[]>();
      for (const s of stakeholders) {
        const key = s.company_id;
        if (!byCompany.has(key)) byCompany.set(key, []);
        byCompany.get(key)!.push(s as Stakeholder & { companies?: { name: string } });
      }
      const companies = Array.from(byCompany.keys());
      const R = 350;
      const clusterRadius = 80;
      const layoutsToUpsert: { map_id: string; stakeholder_id: string; x: number; y: number }[] = [];
      companies.forEach((_companyId, ci) => {
        const cx = R * Math.cos((2 * Math.PI * ci) / Math.max(1, companies.length));
        const cy = R * Math.sin((2 * Math.PI * ci) / Math.max(1, companies.length));
        const members = byCompany.get(companies[ci])!;
        members.forEach((s, mi) => {
          const angle = (2 * Math.PI * mi) / Math.max(1, members.length);
          const r = Math.min(clusterRadius * 0.6, 25 * members.length);
          layoutsToUpsert.push({
            map_id: DEFAULT_MAP_ID,
            stakeholder_id: s.id,
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle),
          });
        });
      });
      const { error } = await supabase.from('map_layouts').upsert(layoutsToUpsert, {
        onConflict: 'map_id,stakeholder_id',
      });
      if (error) throw error;
      await loadData();
    } catch (e) {
      console.error('Cluster failed:', e);
    } finally {
      setClustering(false);
    }
  }

  async function loadData() {
    const [stakeholdersRes, relationshipsRes, layoutsRes] = await Promise.all([
      supabase.from('stakeholders').select('*, companies(name)').eq('status', 'active'),
      supabase.from('relationships').select('*'),
      supabase.from('map_layouts').select('*').eq('map_id', DEFAULT_MAP_ID),
    ]);
    setStakeholders((stakeholdersRes.data as Stakeholder[]) || []);
    setRelationships((relationshipsRes.data as Relationship[]) || []);
    setLayouts((layoutsRes.data as MapLayout[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <div className="text-slate-400">Loading map...</div>;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="flex-1">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Stakeholder Map</h1>
          <div className="flex gap-2">
            <button
              onClick={clusterByCompany}
              disabled={clustering || stakeholders.length === 0}
              className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-600 disabled:opacity-50"
            >
              {clustering ? 'Clustering…' : 'Cluster by company'}
            </button>
            <button
              onClick={() => setShowAddRelationship((v) => !v)}
              className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-600"
            >
              {showAddRelationship ? 'Cancel' : 'Add Relationship'}
            </button>
          </div>
        </div>
        <GraphCanvas
          stakeholders={stakeholders}
          relationships={relationships}
          layouts={layouts}
          onNodeClick={setSelectedStakeholder}
          onLayoutChange={loadData}
          onNodeRightClick={(s) => {
            setSelectedStakeholder(s);
            setShowAddRelationship(true);
          }}
          onNodeDelete={(s) => deleteStakeholder(s.id)}
        />
      </div>
      <aside className="w-80 shrink-0 space-y-4">
        {showAddRelationship && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <h3 className="mb-3 text-sm font-medium text-slate-300">Add Relationship</h3>
            <AddRelationshipForm
              fromStakeholderId={selectedStakeholder?.id}
              onAdded={() => {
                loadData();
                setShowAddRelationship(false);
              }}
            />
          </div>
        )}
        {selectedStakeholder && !showAddRelationship && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <h3 className="mb-2 text-sm font-medium text-slate-300">Stakeholder Details</h3>
            <dl className="space-y-1.5 text-sm">
              <div>
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium">{selectedStakeholder.full_name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Company</dt>
                <dd>{(selectedStakeholder as Stakeholder & { companies?: { name: string } }).companies?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Title</dt>
                <dd>{selectedStakeholder.title || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Sentiment</dt>
                <dd
                  className={
                    selectedStakeholder.sentiment === 'ALLY'
                      ? 'text-emerald-400'
                      : selectedStakeholder.sentiment === 'OPPONENT'
                        ? 'text-red-400'
                        : 'text-slate-400'
                  }
                >
                  {selectedStakeholder.sentiment}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Influence</dt>
                <dd>{selectedStakeholder.influence_score ?? '—'}/5</dd>
              </div>
            </dl>
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => setSelectedStakeholder(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
              <button
                onClick={() => selectedStakeholder && deleteStakeholder(selectedStakeholder.id)}
                disabled={deleting}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )}
        {!selectedStakeholder && !showAddRelationship && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 text-center text-slate-500">
            <p className="text-sm">Click a node to view details</p>
            <p className="mt-1 text-xs">Drag nodes to reposition (positions are saved)</p>
          </div>
        )}
        {stakeholders.length === 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            <p>No stakeholders yet.</p>
            <p className="mt-1">Add companies and stakeholders first, then they will appear on the map.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
