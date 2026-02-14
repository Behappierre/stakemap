import { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import cytoscape, { type Core, type NodeSingular } from 'cytoscape';
import { supabase } from '../../lib/supabase';
import { DEFAULT_MAP_ID } from '../../lib/constants';
import type { Stakeholder } from '../../types/database';
import type { Relationship } from '../../types/database';
import type { MapLayout } from '../../types/database';

const SENTIMENT_COLORS: Record<string, string> = {
  ALLY: '#059669',
  NEUTRAL: '#64748b',
  OPPONENT: '#dc2626',
  UNKNOWN: '#d97706',
};

const SENTIMENT_LABELS: Record<string, string> = {
  ALLY: 'Ally', NEUTRAL: 'Neutral', OPPONENT: 'Opponent', UNKNOWN: 'Unknown',
};

/** Edge colors by relationship type */
const RELATION_COLORS: Record<string, string> = {
  REPORTS_TO: '#94a3b8',      // slate — hierarchy, structural
  PEER_OF: '#a78bfa',         // violet — lateral
  INFLUENCES: '#f59e0b',      // amber — power flow
  COLLABORATES_WITH: '#3b82f6', // blue — positive working
  ADVISES: '#06b6d4',         // cyan — guidance
  BLOCKS: '#ef4444',          // red — adversarial
  SPONSORS: '#10b981',        // emerald — support
  GATEKEEPER_FOR: '#f97316',  // orange — access control
};

const RELATION_LINE_STYLE: Record<string, string> = {
  REPORTS_TO: 'solid',
  PEER_OF: 'dashed',
  BLOCKS: 'solid',
};

/** 48 distinct company ring colors */
const COMPANY_RING_COLORS = [
  '#2563eb', '#1d4ed8', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe',
  '#7c3aed', '#6d28d9', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe',
  '#db2777', '#be185d', '#ec4899', '#f472b6', '#f9a8d4', '#fbcfe8',
  '#dc2626', '#b91c1c', '#ef4444', '#f87171', '#fca5a5', '#fecaca',
  '#ea580c', '#c2410c', '#f97316', '#fb923c', '#fdba74', '#fed7aa',
  '#ca8a04', '#a16207', '#eab308', '#facc15', '#fde047', '#fef08a',
  '#059669', '#047857', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0',
  '#0d9488', '#0f766e', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4',
];

function buildCompanyColorMap(stakeholders: Stakeholder[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of stakeholders) {
    if (!s.company_id) continue;
    if (!map.has(s.company_id)) {
      map.set(s.company_id, COMPANY_RING_COLORS[map.size % COMPANY_RING_COLORS.length]);
    }
  }
  return map;
}

const SENIORITY_SHAPES: Record<string, string> = {
  C_LEVEL: 'star',
  VP: 'hexagon',
  DIRECTOR: 'pentagon',
  MANAGER: 'diamond',
  IC: 'triangle',
};

/** Scale node size by influence: 1→24px, 5→52px */
function influenceSize(score: number | null): number {
  const s = Math.max(1, Math.min(5, score ?? 2));
  return 24 + (s - 1) * 7;
}

/** Compute convex hull points for a set of positions with padding */
function convexHull(points: { x: number; y: number }[], padding: number): { x: number; y: number }[] {
  if (points.length < 2) return points;
  // Graham scan
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: { x: number; y: number }[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: { x: number; y: number }[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) upper.pop();
    upper.push(sorted[i]);
  }
  upper.pop();
  lower.pop();
  const hull = lower.concat(upper);
  if (hull.length === 0) return points;
  // Expand hull outward by padding
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
  return hull.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: p.x + (dx / dist) * padding, y: p.y + (dy / dist) * padding };
  });
}

export interface GraphCanvasHandle {
  exportPng: () => string | null;
}

interface ContextMenuState {
  x: number;
  y: number;
  stakeholder?: Stakeholder;
  edgeId?: string;
}

interface GraphCanvasProps {
  stakeholders: Stakeholder[];
  relationships: Relationship[];
  layouts: MapLayout[];
  onNodeClick?: (stakeholder: Stakeholder) => void;
  onLayoutChange?: () => void;
  onContextAction?: (action: string, target: { stakeholder?: Stakeholder; edgeId?: string }) => void;
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas({
  stakeholders,
  relationships,
  layouts,
  onNodeClick,
  onLayoutChange,
  onContextAction,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const hullCanvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; stakeholder: Stakeholder } | null>(null);
  const [edgeTooltip, setEdgeTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    exportPng: () => {
      if (!cyRef.current) return null;
      return cyRef.current.png({ output: 'base64uri', bg: '#ffffff', full: true, scale: 2 });
    },
  }));

  const layoutMap = useCallback(
    (id: string) => layouts.find((l) => l.stakeholder_id === id),
    [layouts]
  );

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    function handleClick() { setContextMenu(null); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  // Draw company hulls
  const drawHulls = useCallback(() => {
    const cy = cyRef.current;
    const canvas = hullCanvasRef.current;
    if (!cy || !canvas) return;
    const container = containerRef.current;
    if (!container) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Group nodes by company
    const groups = new Map<string, { positions: { x: number; y: number }[]; color: string; name: string }>();
    cy.nodes().forEach((node) => {
      const d = node.data() as { company_id?: string; company_name?: string; stakeholder: Stakeholder };
      const cid = d.company_id;
      if (!cid) return;
      const rp = node.renderedPosition();
      if (!groups.has(cid)) {
        const companyColorMap = buildCompanyColorMap(stakeholders);
        groups.set(cid, {
          positions: [],
          color: companyColorMap.get(cid) ?? '#94a3b8',
          name: d.company_name ?? '',
        });
      }
      groups.get(cid)!.positions.push({ x: rp.x, y: rp.y });
    });

    groups.forEach(({ positions, color, name }) => {
      if (positions.length < 2) return; // Need at least 2 nodes to draw a hull
      const hull = convexHull(positions, 40);
      if (hull.length < 3) return;

      ctx.beginPath();
      ctx.moveTo(hull[0].x, hull[0].y);
      for (let i = 1; i < hull.length; i++) {
        ctx.lineTo(hull[i].x, hull[i].y);
      }
      ctx.closePath();

      // Soft fill
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.06)`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label at centroid
      const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
      // Place label above the hull
      const topY = Math.min(...hull.map((p) => p.y));
      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.55)`;
      ctx.textAlign = 'center';
      ctx.fillText(name, cx, topY - 8);
    });
  }, [stakeholders]);

  useEffect(() => {
    if (!containerRef.current || stakeholders.length === 0) return;

    const companyColorMap = buildCompanyColorMap(stakeholders);
    const R = 300;
    const graphStakeholders = stakeholders.filter((s) => {
      const companyName = (s as Stakeholder & { companies?: { name: string } }).companies?.name;
      if (!companyName) return true;
      if (s.full_name.trim().toLowerCase() === companyName.trim().toLowerCase()) return false;
      return true;
    });
    const elements: cytoscape.ElementDefinition[] = graphStakeholders.map((s, i) => {
      const layout = layoutMap(s.id);
      const position = layout
        ? { x: layout.x, y: layout.y }
        : { x: R * Math.cos((2 * Math.PI * i) / graphStakeholders.length), y: R * Math.sin((2 * Math.PI * i) / graphStakeholders.length) };
      return {
        group: 'nodes',
        data: {
          id: s.id,
          label: s.full_name,
          stakeholder: s,
          company_id: s.company_id,
          company_name: (s as Stakeholder & { companies?: { name: string } }).companies?.name,
        },
        position,
      };
    });

    const graphIds = new Set(graphStakeholders.map((s) => s.id));
    relationships.forEach((r) => {
      if (!graphIds.has(r.from_stakeholder_id) || !graphIds.has(r.to_stakeholder_id)) return;
      elements.push({
        group: 'edges',
        data: {
          id: r.id,
          source: r.from_stakeholder_id,
          target: r.to_stakeholder_id,
          strength: r.strength ?? 3,
          relation_type: r.relation_type,
        },
      });
    });

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (ele: NodeSingular) => {
              const s = (ele.data() as { stakeholder: Stakeholder }).stakeholder;
              return SENTIMENT_COLORS[s.sentiment] || SENTIMENT_COLORS.UNKNOWN;
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            shape: ((ele: NodeSingular) => {
              const s = (ele.data() as { stakeholder: Stakeholder }).stakeholder;
              return (s.seniority_level && SENIORITY_SHAPES[s.seniority_level]) || 'ellipse';
            }) as any,
            label: 'data(label)',
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'font-size': 12,
            'font-family': 'Inter, sans-serif',
            color: '#334155',
            'text-outline-width': 2,
            'text-outline-color': '#ffffff',
            // Influence-scaled sizing
            width: (ele: NodeSingular) => {
              const s = (ele.data() as { stakeholder: Stakeholder }).stakeholder;
              return influenceSize(s.influence_score);
            },
            height: (ele: NodeSingular) => {
              const s = (ele.data() as { stakeholder: Stakeholder }).stakeholder;
              return influenceSize(s.influence_score);
            },
            'border-width': 4,
            'border-color': (ele: NodeSingular) => {
              const d = ele.data() as { company_id?: string };
              return companyColorMap.get(d.company_id ?? '') ?? '#94a3b8';
            },
            'overlay-padding': 6,
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 5,
            'border-color': '#059669',
            'overlay-opacity': 0.08,
            'overlay-color': '#059669',
          },
        },
        // Dimmed nodes (focus mode)
        {
          selector: 'node.dimmed',
          style: {
            opacity: 0.12,
          },
        },
        {
          selector: 'edge',
          style: {
            width: (ele: cytoscape.EdgeSingular) => Math.max(1, (ele.data('strength') || 3) * 0.8),
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'line-color': (ele: cytoscape.EdgeSingular) => {
              const rt = ele.data('relation_type') as string;
              return RELATION_COLORS[rt] || '#cbd5e1';
            },
            'target-arrow-color': (ele: cytoscape.EdgeSingular) => {
              const rt = ele.data('relation_type') as string;
              return RELATION_COLORS[rt] || '#cbd5e1';
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            'line-style': ((ele: cytoscape.EdgeSingular) => {
              const rt = ele.data('relation_type') as string;
              return RELATION_LINE_STYLE[rt] || 'solid';
            }) as any,
            'line-opacity': 0.65,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#059669',
            'target-arrow-color': '#059669',
            'line-opacity': 1,
            width: 3,
          },
        },
        // Dimmed edges (focus mode)
        {
          selector: 'edge.dimmed',
          style: {
            opacity: 0.08,
          },
        },
      ],
      layout: {
        name: 'preset',
        fit: true,
        padding: 60,
      },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: true,
    });

    cyRef.current = cy;

    // Node click — select + focus mode
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const data = (node.data() as { stakeholder: Stakeholder }).stakeholder;
      onNodeClick?.(data);

      // Focus mode: highlight neighborhood
      const nodeId = node.id();
      if (focusedNodeId === nodeId) {
        // Clicking same node again: exit focus
        setFocusedNodeId(null);
        cy.elements().removeClass('dimmed');
      } else {
        setFocusedNodeId(nodeId);
        const neighborhood = node.neighborhood().add(node);
        cy.elements().addClass('dimmed');
        neighborhood.removeClass('dimmed');
      }
    });

    // Click canvas background: exit focus
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setFocusedNodeId(null);
        cy.elements().removeClass('dimmed');
      }
    });

    // Node hover tooltip
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      const s = (node.data() as { stakeholder: Stakeholder }).stakeholder;
      const renderedPos = node.renderedPosition();
      const container = containerRef.current!;
      const rect = container.getBoundingClientRect();
      setTooltip({
        x: rect.left + renderedPos.x,
        y: rect.top + renderedPos.y,
        stakeholder: s,
      });
    });

    cy.on('mouseout', 'node', () => {
      setTooltip(null);
    });

    // Edge hover tooltip
    cy.on('mouseover', 'edge', (evt) => {
      const edge = evt.target;
      const rt = (edge.data('relation_type') as string || '').replace(/_/g, ' ');
      const strength = edge.data('strength') || '?';
      const mp = edge.renderedMidpoint();
      const container = containerRef.current!;
      const rect = container.getBoundingClientRect();
      setEdgeTooltip({
        x: rect.left + mp.x,
        y: rect.top + mp.y,
        label: `${rt} (${strength}/5)`,
      });
    });

    cy.on('mouseout', 'edge', () => {
      setEdgeTooltip(null);
    });

    cy.on('drag', 'node', () => {
      setTooltip(null);
    });

    // Right-click context menu
    cy.on('cxttap', 'node', (evt) => {
      evt.originalEvent.preventDefault();
      const node = evt.target;
      const s = (node.data() as { stakeholder: Stakeholder }).stakeholder;
      const renderedPos = node.renderedPosition();
      const container = containerRef.current!;
      const rect = container.getBoundingClientRect();
      setContextMenu({
        x: rect.left + renderedPos.x,
        y: rect.top + renderedPos.y,
        stakeholder: s,
      });
    });

    cy.on('cxttap', 'edge', (evt) => {
      evt.originalEvent.preventDefault();
      const edge = evt.target;
      const mp = edge.renderedMidpoint();
      const container = containerRef.current!;
      const rect = container.getBoundingClientRect();
      setContextMenu({
        x: rect.left + mp.x,
        y: rect.top + mp.y,
        edgeId: edge.id(),
      });
    });

    // Save position on drag
    cy.on('dragfree', 'node', async (evt) => {
      const node = evt.target;
      const pos = node.position();
      const stakeholderId = node.id();

      try {
        const { error: upsertErr } = await supabase
          .from('map_layouts')
          .upsert(
            {
              map_id: DEFAULT_MAP_ID,
              stakeholder_id: stakeholderId,
              x: pos.x,
              y: pos.y,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'map_id,stakeholder_id' }
          );
        if (upsertErr) throw upsertErr;
        onLayoutChange?.();
      } catch (e) {
        console.error('Failed to save layout:', e);
      }
    });

    // Draw hulls on render/viewport changes
    const redrawHulls = () => requestAnimationFrame(drawHulls);
    cy.on('render viewport', redrawHulls);
    redrawHulls();

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stakeholders, relationships, layouts, layoutMap, onNodeClick, onLayoutChange, drawHulls]);

  function handleContextAction(action: string) {
    if (!contextMenu) return;
    onContextAction?.(action, {
      stakeholder: contextMenu.stakeholder,
      edgeId: contextMenu.edgeId,
    });
    setContextMenu(null);
  }

  return (
    <div className="relative h-full min-h-[500px] w-full">
      {/* Dot grid canvas background */}
      <div
        ref={containerRef}
        className="h-full w-full rounded-xl border border-gray-200 shadow-sm"
        style={{
          backgroundColor: '#fafbfc',
          backgroundImage: 'radial-gradient(circle, #d1d5db 0.8px, transparent 0.8px)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* Company hull overlay */}
      <canvas
        ref={hullCanvasRef}
        className="pointer-events-none absolute inset-0 rounded-xl"
      />
      {/* Node tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-100 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm"
          style={{ left: tooltip.x + 16, top: tooltip.y - 12 }}
        >
          <p className="text-sm font-semibold text-slate-900">{tooltip.stakeholder.full_name}</p>
          <p className="text-xs text-slate-500">
            {tooltip.stakeholder.title || 'No title'}
            {' @ '}
            {(tooltip.stakeholder as Stakeholder & { companies?: { name: string } }).companies?.name ?? 'Unknown'}
          </p>
          <div className="mt-1.5 flex items-center gap-3 text-xs">
            <span
              className="rounded-full px-1.5 py-0.5 text-white"
              style={{ backgroundColor: SENTIMENT_COLORS[tooltip.stakeholder.sentiment] || SENTIMENT_COLORS.UNKNOWN }}
            >
              {SENTIMENT_LABELS[tooltip.stakeholder.sentiment] || 'Unknown'}
            </span>
            <span className="text-slate-400">
              Influence: {tooltip.stakeholder.influence_score ?? '?'}/5
            </span>
            {tooltip.stakeholder.seniority_level && (
              <span className="text-slate-400">
                {tooltip.stakeholder.seniority_level.replace('_', ' ')}
              </span>
            )}
          </div>
        </div>
      )}
      {/* Edge tooltip */}
      {edgeTooltip && (
        <div
          className="pointer-events-none fixed z-100 rounded-md border border-gray-200 bg-white/95 px-2 py-1 text-xs font-medium text-slate-600 shadow-md backdrop-blur-sm"
          style={{ left: edgeTooltip.x + 12, top: edgeTooltip.y - 8 }}
        >
          {edgeTooltip.label}
        </div>
      )}
      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-100 min-w-40 rounded-xl border border-gray-200 bg-white py-1 shadow-xl fade-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.stakeholder ? (
            <>
              <div className="border-b border-gray-100 px-3 py-1.5">
                <p className="text-xs font-semibold text-slate-900">{contextMenu.stakeholder.full_name}</p>
              </div>
              <button onClick={() => handleContextAction('edit')} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-gray-50">
                <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" /></svg>
                Edit Stakeholder
              </button>
              <button onClick={() => handleContextAction('add-relationship')} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-gray-50">
                <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.06a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.343 8.28" /></svg>
                Add Relationship
              </button>
              <button onClick={() => handleContextAction('focus')} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-gray-50">
                <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5M20.25 16.5V18A2.25 2.25 0 0118 20.25h-1.5M3.75 16.5V18A2.25 2.25 0 006 20.25h1.5" /></svg>
                Focus Network
              </button>
              <div className="my-1 border-t border-gray-100" />
              <button onClick={() => handleContextAction('archive')} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                Archive
              </button>
            </>
          ) : contextMenu.edgeId ? (
            <>
              <button onClick={() => handleContextAction('edit-edge')} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-gray-50">
                <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" /></svg>
                Edit Relationship
              </button>
              <button onClick={() => handleContextAction('delete-edge')} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                Delete Relationship
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
});
