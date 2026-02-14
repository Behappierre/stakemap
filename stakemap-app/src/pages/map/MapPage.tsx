import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraphCanvas } from '../../components/graph/GraphCanvas';
import type { GraphCanvasHandle } from '../../components/graph/GraphCanvas';
import { CompanyFilter } from '../../components/graph/CompanyFilter';
import { MapFilters } from '../../components/graph/MapFilters';
import { AddRelationshipForm } from '../../components/relationships/AddRelationshipForm';
import { supabase } from '../../lib/supabase';
import { DEFAULT_MAP_ID } from '../../lib/constants';
import { exportStakeholdersCsv, exportRelationshipsCsv } from '../../lib/csvTemplate';
import type { Stakeholder } from '../../types/database';
import type { Relationship, RelationType } from '../../types/database';
import type { MapLayout } from '../../types/database';

const RELATION_TYPES: RelationType[] = [
  'REPORTS_TO', 'PEER_OF', 'INFLUENCES', 'COLLABORATES_WITH',
  'ADVISES', 'BLOCKS', 'SPONSORS', 'GATEKEEPER_FOR',
];

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
  const [editingRelId, setEditingRelId] = useState<string | null>(null);
  const [editRelType, setEditRelType] = useState<RelationType>('COLLABORATES_WITH');
  const [editRelStrength, setEditRelStrength] = useState(3);
  const [editRelNotes, setEditRelNotes] = useState('');
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [mapFilters, setMapFilters] = useState({ sentiments: [] as string[], seniorities: [] as string[], minInfluence: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<GraphCanvasHandle>(null);
  const navigate = useNavigate();

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

  // Filtered stakeholders based on company selection + map filters
  const filteredStakeholders = useMemo(() => {
    let result = stakeholders;
    if (selectedCompanies.size > 0 && selectedCompanies.size < companyList.length) {
      result = result.filter((s) => selectedCompanies.has(s.company_id));
    }
    if (mapFilters.sentiments.length > 0) {
      result = result.filter((s) => mapFilters.sentiments.includes(s.sentiment));
    }
    if (mapFilters.seniorities.length > 0) {
      result = result.filter((s) => s.seniority_level && mapFilters.seniorities.includes(s.seniority_level));
    }
    if (mapFilters.minInfluence > 0) {
      result = result.filter((s) => (s.influence_score ?? 0) >= mapFilters.minInfluence);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => {
        const companyName = (s as Stakeholder & { companies?: { name: string } }).companies?.name ?? '';
        return s.full_name.toLowerCase().includes(q) ||
          (s.title ?? '').toLowerCase().includes(q) ||
          companyName.toLowerCase().includes(q);
      });
    }
    return result;
  }, [stakeholders, selectedCompanies, companyList.length, mapFilters, searchQuery]);

  // Close export menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showExportMenu]);

  function exportPng() {
    const dataUri = graphRef.current?.exportPng();
    if (!dataUri) return;
    const link = document.createElement('a');
    link.download = `stakemap-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataUri;
    link.click();
    setShowExportMenu(false);
  }

  function exportCsvStakeholders() {
    exportStakeholdersCsv(filteredStakeholders as (Stakeholder & { companies?: { name: string } })[]);
    setShowExportMenu(false);
  }

  function exportCsvRelationships() {
    const visibleIds = new Set(filteredStakeholders.map((s) => s.id));
    const visibleRels = relationships
      .filter((r) => visibleIds.has(r.from_stakeholder_id) && visibleIds.has(r.to_stakeholder_id))
      .map((r) => ({
        ...r,
        fromName: stakeholders.find((s) => s.id === r.from_stakeholder_id)?.full_name ?? 'Unknown',
        toName: stakeholders.find((s) => s.id === r.to_stakeholder_id)?.full_name ?? 'Unknown',
      }));
    exportRelationshipsCsv(visibleRels);
    setShowExportMenu(false);
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

  async function deleteRelationship(id: string) {
    if (!window.confirm('Delete this relationship?')) return;
    try {
      const { error } = await supabase.from('relationships').delete().eq('id', id);
      if (error) throw error;
      await loadData();
    } catch (e) {
      console.error('Delete relationship failed:', e);
    }
  }

  function startEditRelationship(r: Relationship) {
    setEditingRelId(r.id);
    setEditRelType(r.relation_type);
    setEditRelStrength(r.strength ?? 3);
    setEditRelNotes(r.notes ?? '');
  }

  async function saveRelationship() {
    if (!editingRelId) return;
    try {
      const { error } = await supabase.from('relationships').update({
        relation_type: editRelType,
        strength: editRelStrength,
        notes: editRelNotes || null,
      }).eq('id', editingRelId);
      if (error) throw error;
      setEditingRelId(null);
      await loadData();
    } catch (e) {
      console.error('Update relationship failed:', e);
    }
  }

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

  // Stats dashboard data
  const stats = useMemo(() => {
    const allies = stakeholders.filter((s) => s.sentiment === 'ALLY').length;
    const opponents = stakeholders.filter((s) => s.sentiment === 'OPPONENT').length;
    const neutral = stakeholders.filter((s) => s.sentiment === 'NEUTRAL').length;
    const unknown = stakeholders.filter((s) => s.sentiment === 'UNKNOWN').length;
    const total = stakeholders.length;

    const avgInfluence = total > 0
      ? +(stakeholders.reduce((sum, s) => sum + (s.influence_score ?? 0), 0) / total).toFixed(1)
      : 0;

    // Most connected person
    const connectionCount = new Map<string, number>();
    relationships.forEach((r) => {
      connectionCount.set(r.from_stakeholder_id, (connectionCount.get(r.from_stakeholder_id) ?? 0) + 1);
      connectionCount.set(r.to_stakeholder_id, (connectionCount.get(r.to_stakeholder_id) ?? 0) + 1);
    });
    let mostConnected: { name: string; count: number } | null = null as { name: string; count: number } | null;
    connectionCount.forEach((count, id) => {
      if (!mostConnected || count > mostConnected.count) {
        const found = stakeholders.find((st) => st.id === id);
        if (found) mostConnected = { name: found.full_name, count };
      }
    });

    // Orphan nodes (no relationships)
    const connectedIds = new Set([
      ...relationships.map((r) => r.from_stakeholder_id),
      ...relationships.map((r) => r.to_stakeholder_id),
    ]);
    const orphans = stakeholders.filter((s) => !connectedIds.has(s.id));

    return { allies, opponents, neutral, unknown, total, avgInfluence, mostConnected, orphans };
  }, [stakeholders, relationships]);

  // Context menu handler
  function handleContextAction(action: string, target: { stakeholder?: Stakeholder; edgeId?: string }) {
    if (action === 'edit' && target.stakeholder) {
      navigate(`/stakeholders/${target.stakeholder.id}/edit`);
    } else if (action === 'add-relationship' && target.stakeholder) {
      setSelectedStakeholder(target.stakeholder);
      setShowAddRelationship(true);
    } else if (action === 'focus' && target.stakeholder) {
      setSelectedStakeholder(target.stakeholder);
    } else if (action === 'archive' && target.stakeholder) {
      deleteStakeholder(target.stakeholder.id);
    } else if (action === 'edit-edge' && target.edgeId) {
      const rel = relationships.find((r) => r.id === target.edgeId);
      if (rel) {
        // Find the stakeholder involved and open sidebar with edit
        const s = stakeholders.find((s) => s.id === rel.from_stakeholder_id);
        if (s) {
          setSelectedStakeholder(s);
          startEditRelationship(rel);
        }
      }
    } else if (action === 'delete-edge' && target.edgeId) {
      deleteRelationship(target.edgeId);
    }
  }

  if (loading) return <div className="text-slate-500">Loading map...</div>;

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-6">
      <div className="flex-1">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900">Stakeholder Map</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, title, company..."
                className="w-52 rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {companyList.length > 1 && (
              <CompanyFilter
                companies={companyList}
                selected={selectedCompanies}
                onChange={setSelectedCompanies}
              />
            )}
            <MapFilters filters={mapFilters} onChange={setMapFilters} />
            <button
              onClick={clusterByCompany}
              disabled={clustering || stakeholders.length === 0}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              {clustering ? 'Clustering...' : 'Cluster by Company'}
            </button>
            <div ref={exportMenuRef} className="relative">
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                disabled={stakeholders.length === 0}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg fade-in">
                  <button onClick={exportPng} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-gray-50">
                    <span className="text-slate-400">PNG</span> Map snapshot
                  </button>
                  <button onClick={exportCsvStakeholders} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-gray-50">
                    <span className="text-slate-400">CSV</span> Stakeholders
                  </button>
                  <button onClick={exportCsvRelationships} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-gray-50">
                    <span className="text-slate-400">CSV</span> Relationships
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <GraphCanvas
          ref={graphRef}
          stakeholders={filteredStakeholders}
          relationships={relationships}
          layouts={layouts}
          onNodeClick={setSelectedStakeholder}
          onLayoutChange={loadData}
          onContextAction={handleContextAction}
        />
      </div>

      <aside className="w-80 shrink-0 space-y-4">
        {/* Stats dashboard (when nothing selected) */}
        {!selectedStakeholder && !showAddRelationship && stakeholders.length > 0 && (
          <div className="glass-card-solid divide-y divide-gray-100 fade-in">
            {/* Overview */}
            <div className="p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Overview</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                  <p className="text-[10px] font-medium uppercase text-slate-400">Stakeholders</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900">{relationships.length}</p>
                  <p className="text-[10px] font-medium uppercase text-slate-400">Relationships</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900">{stats.avgInfluence}</p>
                  <p className="text-[10px] font-medium uppercase text-slate-400">Avg Influence</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-2xl font-bold text-slate-900">{companyList.length}</p>
                  <p className="text-[10px] font-medium uppercase text-slate-400">Companies</p>
                </div>
              </div>
            </div>

            {/* Sentiment breakdown */}
            <div className="p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Sentiment</p>
              {stats.total > 0 && (
                <div className="mb-2 flex h-2 overflow-hidden rounded-full">
                  {stats.allies > 0 && <div className="bg-emerald-500" style={{ width: `${(stats.allies / stats.total) * 100}%` }} />}
                  {stats.neutral > 0 && <div className="bg-slate-400" style={{ width: `${(stats.neutral / stats.total) * 100}%` }} />}
                  {stats.unknown > 0 && <div className="bg-amber-400" style={{ width: `${(stats.unknown / stats.total) * 100}%` }} />}
                  {stats.opponents > 0 && <div className="bg-red-500" style={{ width: `${(stats.opponents / stats.total) * 100}%` }} />}
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-slate-600">{stats.allies} Allies</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-slate-600">{stats.opponents} Opponents</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-slate-600">{stats.neutral} Neutral</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="text-slate-600">{stats.unknown} Unknown</span>
                </div>
              </div>
            </div>

            {/* Key person */}
            {stats.mostConnected && (
              <div className="p-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Most Connected</p>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
                    {stats.mostConnected.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{stats.mostConnected.name}</p>
                    <p className="text-xs text-slate-400">{stats.mostConnected.count} connections</p>
                  </div>
                </div>
              </div>
            )}

            {/* Blind spots */}
            {stats.orphans.length > 0 && (
              <div className="p-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-500">Blind Spots</p>
                <p className="mb-2 text-xs text-slate-500">{stats.orphans.length} stakeholder{stats.orphans.length > 1 ? 's' : ''} with no relationships:</p>
                <div className="flex flex-wrap gap-1">
                  {stats.orphans.slice(0, 5).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStakeholder(s)}
                      className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
                    >
                      {s.full_name}
                    </button>
                  ))}
                  {stats.orphans.length > 5 && (
                    <span className="px-1 py-0.5 text-xs text-slate-400">+{stats.orphans.length - 5} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Tip */}
            <div className="p-4 text-center">
              <p className="text-xs text-slate-400">Click a node to view details. Right-click for quick actions.</p>
            </div>
          </div>
        )}

        {/* Empty data state */}
        {!selectedStakeholder && !showAddRelationship && stakeholders.length === 0 && !loading && (
          <div className="glass-card-solid p-6 text-center fade-in">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700">No stakeholders yet</p>
            <p className="mt-1 text-xs text-slate-500">Add companies and stakeholders first.</p>
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
                <ul className="space-y-1">
                  {selectedRelationships.map((r) => {
                    const isFrom = r.from_stakeholder_id === selectedStakeholder.id;
                    const otherName = isFrom ? r.toName : r.fromName;
                    const direction = isFrom ? '\u2192' : '\u2190';
                    const isEditing = editingRelId === r.id;
                    return (
                      <li key={r.id} className="rounded-lg border border-transparent hover:border-gray-100 hover:bg-gray-50/50">
                        <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                          <span className="text-slate-400">{direction}</span>
                          <span className="flex-1 truncate font-medium text-slate-700">{otherName}</span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-slate-500">
                            {r.relation_type.replace(/_/g, ' ')}
                          </span>
                          <button
                            onClick={() => isEditing ? setEditingRelId(null) : startEditRelationship(r)}
                            className="flex h-5 w-5 items-center justify-center rounded text-slate-300 hover:bg-gray-200 hover:text-slate-600"
                            title={isEditing ? 'Cancel' : 'Edit'}
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              {isEditing ? (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                              )}
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteRelationship(r.id)}
                            className="flex h-5 w-5 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-500"
                            title="Delete"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                        {/* Inline edit form */}
                        {isEditing && (
                          <div className="border-t border-gray-100 px-2 py-2 space-y-2 fade-in">
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="text-[10px] font-medium uppercase text-slate-400">Type</label>
                                <select
                                  value={editRelType}
                                  onChange={(e) => setEditRelType(e.target.value as RelationType)}
                                  className="input py-1 text-xs"
                                >
                                  {RELATION_TYPES.map((t) => (
                                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="w-20">
                                <label className="text-[10px] font-medium uppercase text-slate-400">Strength</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={5}
                                  value={editRelStrength}
                                  onChange={(e) => setEditRelStrength(+e.target.value)}
                                  className="input py-1 text-xs"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-medium uppercase text-slate-400">Notes</label>
                              <input
                                type="text"
                                value={editRelNotes}
                                onChange={(e) => setEditRelNotes(e.target.value)}
                                placeholder="Optional notes..."
                                className="input py-1 text-xs"
                              />
                            </div>
                            <button onClick={saveRelationship} className="btn-primary w-full py-1 text-xs">
                              Save Changes
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="glass-card-solid p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Legend</p>

          {/* Sentiment colors */}
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-medium text-slate-500">Sentiment (node color)</p>
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

          {/* Relationship edge colors */}
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-medium text-slate-500">Relationship (edge color)</p>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3.5 bg-[#3b82f6]" />
                <span className="text-xs text-slate-600">Collaborates</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3.5 bg-[#ef4444]" />
                <span className="text-xs text-slate-600">Blocks</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3.5 bg-[#10b981]" />
                <span className="text-xs text-slate-600">Sponsors</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3.5 bg-[#f59e0b]" />
                <span className="text-xs text-slate-600">Influences</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3.5 bg-[#94a3b8]" />
                <span className="text-xs text-slate-600">Reports to</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3.5 bg-[#06b6d4]" />
                <span className="text-xs text-slate-600">Advises</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3.5 border-t-2 border-dashed border-[#a78bfa]" />
                <span className="text-xs text-slate-600">Peer of</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3.5 bg-[#f97316]" />
                <span className="text-xs text-slate-600">Gatekeeper</span>
              </div>
            </div>
          </div>

          {/* Other visual info */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">Other</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border-[3px] border-blue-500 bg-transparent" />
                <span className="text-xs text-slate-600">Border = company</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-end gap-0.5">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="h-3.5 w-3.5 rounded-full bg-slate-400" />
                </div>
                <span className="text-xs text-slate-600">Size = influence</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3.5 bg-slate-300" />
                <span className="text-xs text-slate-600">Thickness = strength</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
