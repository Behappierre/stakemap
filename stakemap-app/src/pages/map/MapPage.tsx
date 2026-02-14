import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { GraphCanvas } from '../../components/graph/GraphCanvas';
import type { GraphCanvasHandle } from '../../components/graph/GraphCanvas';
import { CompanyFilter } from '../../components/graph/CompanyFilter';
import { AddRelationshipForm } from '../../components/relationships/AddRelationshipForm';
import { supabase } from '../../lib/supabase';
import { DEFAULT_MAP_ID } from '../../lib/constants';
import type { Stakeholder } from '../../types/database';
import type { Relationship } from '../../types/database';
import type { MapLayout } from '../../types/database';

const SENTIMENT_BADGE: Record<string, string> = {
  ALLY: 'badge badge-ally',
  NEUTRAL: 'badge badge-neutral',
  OPPONENT: 'badge badge-opponent',
  UNKNOWN: 'badge badge-unknown',
};

export function MapPage() {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [layouts, setLayouts] = useState<MapLayout[]>([]);
  const [selectedStakeholder, setSelectedStakeholder] = useState<Stakeholder | null>(null);
  const [showAddRelationship, setShowAddRelationship] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clustering, setClustering] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const graphRef = useRef<GraphCanvasHandle>(null);

  // Build company list with stakeholder counts for the filter
  const companyList = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const s of stakeholders) {
      const companyName = (s as Stakeholder & { companies?: { name: string } }).companies?.name;
      if (!s.company_id || !companyName) continue;
      const existing = map.get(s.company_id);
      if (existing) {
        existing.count++;
      } else {
        map.set(s.company_id, { name: companyName, count: 1 });
      }
    }
    return Array.from(map.entries()).map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [stakeholders]);

  // Initialize selectedCompanies to all when stakeholders load
  useEffect(() => {
    if (companyList.length > 0 && selectedCompanies.size === 0) {
      setSelectedCompanies(new Set(companyList.map((c) => c.id)));
    }
  }, [companyList]);

  // Filtered stakeholders based on company selection
  const filteredStakeholders = useMemo(() => {
    if (selectedCompanies.size === 0 || selectedCompanies.size === companyList.length) {
      return stakeholders;
    }
    return stakeholders.filter((s) => selectedCompanies.has(s.company_id));
  }, [stakeholders, selectedCompanies, companyList.length]);

  function exportPng() {
    const dataUri = graphRef.current?.exportPng();
    if (!dataUri) return;
    const link = document.createElement('a');
    link.download = `stakemap-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataUri;
    link.click();
  }

  const selectedRelationships = useMemo(() => {
    if (!selectedStakeholder) return [];
    return relationships
      .filter(
        (r) =>
          r.from_stakeholder_id === selectedStakeholder.id ||
          r.to_stakeholder_id === selectedStakeholder.id
      )
      .map((r) => {
        const from = stakeholders.find((s) => s.id === r.from_stakeholder_id);
        const to = stakeholders.find((s) => s.id === r.to_stakeholder_id);
        return {
          ...r,
          fromName: from?.full_name ?? 'Unknown',
          toName: to?.full_name ?? 'Unknown',
        };
      });
  }, [selectedStakeholder, relationships, stakeholders]);

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

  if (loading) return <div className="text-slate-500">Loading map...</div>;

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-6">
      <div className="flex-1">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900">Stakeholder Map</h1>
          <div className="flex items-center gap-3">
            {companyList.length > 1 && (
              <CompanyFilter
                companies={companyList}
                selected={selectedCompanies}
                onChange={setSelectedCompanies}
              />
            )}
            <button
              onClick={clusterByCompany}
              disabled={clustering || stakeholders.length === 0}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              {clustering ? 'Clustering...' : 'Cluster by Company'}
            </button>
            <button
              onClick={exportPng}
              disabled={stakeholders.length === 0}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Export PNG
            </button>
          </div>
        </div>
        <GraphCanvas
          ref={graphRef}
          stakeholders={filteredStakeholders}
          relationships={relationships}
          layouts={layouts}
          onNodeClick={setSelectedStakeholder}
          onLayoutChange={loadData}
        />
      </div>

      <aside className="w-80 shrink-0 space-y-4">
        {/* Empty state */}
        {!selectedStakeholder && !showAddRelationship && (
          <div className="glass-card-solid p-6 text-center fade-in">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700">Select a stakeholder</p>
            <p className="mt-1 text-xs text-slate-500">Click a node on the map to view details</p>
            <p className="mt-1 text-xs text-slate-400">Drag nodes to reposition</p>
          </div>
        )}

        {/* Add Relationship form */}
        {showAddRelationship && (
          <div className="glass-card-solid p-5 slide-in-right">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Add Relationship</h3>
              <button
                onClick={() => setShowAddRelationship(false)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-gray-100 hover:text-slate-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <AddRelationshipForm
              fromStakeholderId={selectedStakeholder?.id}
              onAdded={() => {
                loadData();
                setShowAddRelationship(false);
              }}
            />
          </div>
        )}

        {/* Rich stakeholder detail panel */}
        {selectedStakeholder && !showAddRelationship && (
          <div className="glass-card-solid divide-y divide-gray-100 slide-in-right">
            {/* Header: avatar, name, company */}
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">
                    {selectedStakeholder.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {selectedStakeholder.full_name}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {selectedStakeholder.title || 'No title'}
                      {' @ '}
                      {(selectedStakeholder as Stakeholder & { companies?: { name: string } }).companies?.name ?? 'Unknown'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStakeholder(null)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-gray-100 hover:text-slate-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mt-3">
                <span className={SENTIMENT_BADGE[selectedStakeholder.sentiment] || 'badge badge-neutral'}>
                  {selectedStakeholder.sentiment}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Influence</p>
                <div className="mt-1.5 influence-dots">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div
                      key={n}
                      className={`influence-dot ${n <= (selectedStakeholder.influence_score ?? 0) ? 'influence-dot-filled' : 'influence-dot-empty'}`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-500">{selectedStakeholder.influence_score ?? 0}/5</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Seniority</p>
                <p className="mt-1.5 text-sm font-medium text-slate-700">
                  {selectedStakeholder.seniority_level?.replace('_', ' ') ?? 'N/A'}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-5">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">Actions</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/stakeholders/${selectedStakeholder.id}/edit`}
                  className="btn-secondary py-1.5 text-xs"
                >
                  Edit
                </Link>
                <button
                  onClick={() => setShowAddRelationship(true)}
                  className="btn-secondary py-1.5 text-xs"
                >
                  Add Relationship
                </button>
                <button
                  onClick={() => deleteStakeholder(selectedStakeholder.id)}
                  disabled={deleting}
                  className="btn-danger py-1.5 text-xs disabled:opacity-50"
                >
                  {deleting ? 'Archiving...' : 'Archive'}
                </button>
              </div>
            </div>

            {/* Relationships list */}
            <div className="p-5">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
                Relationships ({selectedRelationships.length})
              </p>
              {selectedRelationships.length === 0 ? (
                <p className="text-xs text-slate-400">No relationships yet</p>
              ) : (
                <ul className="space-y-2">
                  {selectedRelationships.map((r) => {
                    const isFrom = r.from_stakeholder_id === selectedStakeholder.id;
                    const otherName = isFrom ? r.toName : r.fromName;
                    const direction = isFrom ? '\u2192' : '\u2190';
                    return (
                      <li key={r.id} className="flex items-center gap-2 text-sm">
                        <span className="text-slate-400">{direction}</span>
                        <span className="font-medium text-slate-700">{otherName}</span>
                        <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-slate-500">
                          {r.relation_type.replace(/_/g, ' ')}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Empty data warning */}
        {stakeholders.length === 0 && (
          <div className="glass-card-solid border-amber-200 bg-amber-50 p-5 text-sm fade-in">
            <p className="font-medium text-amber-800">No stakeholders yet</p>
            <p className="mt-1 text-amber-600">Add companies and stakeholders first, then they will appear on the map.</p>
          </div>
        )}

        {/* Legend */}
        <div className="glass-card-solid p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Legend</p>

          {/* Sentiment colors */}
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-medium text-slate-500">Sentiment</p>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#059669]" />
                <span className="text-xs text-slate-600">Ally</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#dc2626]" />
                <span className="text-xs text-slate-600">Opponent</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#64748b]" />
                <span className="text-xs text-slate-600">Neutral</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#d97706]" />
                <span className="text-xs text-slate-600">Unknown</span>
              </div>
            </div>
          </div>

          {/* Seniority shapes */}
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-medium text-slate-500">Seniority (shape)</p>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 16 16"><polygon points="8,1 10,6 16,6 11,9.5 13,15 8,11.5 3,15 5,9.5 0,6 6,6" fill="currentColor" /></svg>
                <span className="text-xs text-slate-600">C-Level</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 16 16"><polygon points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5" fill="currentColor" /></svg>
                <span className="text-xs text-slate-600">VP</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 16 16"><polygon points="8,1 15,6 12.5,14.5 3.5,14.5 1,6" fill="currentColor" /></svg>
                <span className="text-xs text-slate-600">Director</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 16 16"><polygon points="8,1 15,8 8,15 1,8" fill="currentColor" /></svg>
                <span className="text-xs text-slate-600">Manager</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 16 16"><polygon points="8,2 15,14 1,14" fill="currentColor" /></svg>
                <span className="text-xs text-slate-600">IC</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-3.5 w-3.5 items-center justify-center"><span className="h-3 w-3 rounded-full bg-slate-500" /></span>
                <span className="text-xs text-slate-600">Unset</span>
              </div>
            </div>
          </div>

          {/* Edge / border info */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">Other</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border-[3px] border-blue-500 bg-transparent" />
                <span className="text-xs text-slate-600">Border = company</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3.5 bg-slate-300" />
                <span className="text-xs text-slate-600">Line thickness = strength</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
