import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
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

/** 48 distinct company ring colors (no two companies share a color) */
const COMPANY_RING_COLORS = [
  '#2563eb', '#1d4ed8', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', // blues
  '#7c3aed', '#6d28d9', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', // violets
  '#db2777', '#be185d', '#ec4899', '#f472b6', '#f9a8d4', '#fbcfe8', // pinks
  '#dc2626', '#b91c1c', '#ef4444', '#f87171', '#fca5a5', '#fecaca', // reds
  '#ea580c', '#c2410c', '#f97316', '#fb923c', '#fdba74', '#fed7aa', // oranges
  '#ca8a04', '#a16207', '#eab308', '#facc15', '#fde047', '#fef08a', // yellows
  '#059669', '#047857', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', // greens
  '#0d9488', '#0f766e', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', // teals
];

/** Build company -> color map so each company gets a unique color (no duplication) */
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

/** Node shapes by seniority (PRD: distinct by role level) */
const SENIORITY_SHAPES: Record<string, string> = {
  C_LEVEL: 'star',
  VP: 'hexagon',
  DIRECTOR: 'pentagon',
  MANAGER: 'diamond',
  IC: 'triangle',
};

export interface GraphCanvasHandle {
  exportPng: () => string | null;
}

interface GraphCanvasProps {
  stakeholders: Stakeholder[];
  relationships: Relationship[];
  layouts: MapLayout[];
  onNodeClick?: (stakeholder: Stakeholder) => void;
  onLayoutChange?: () => void;
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas({
  stakeholders,
  relationships,
  layouts,
  onNodeClick,
  onLayoutChange,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

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
            width: 36,
            height: 36,
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
        {
          selector: 'edge',
          style: {
            width: (ele: cytoscape.EdgeSingular) => Math.max(1, (ele.data('strength') || 3) * 0.8),
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'line-color': '#cbd5e1',
            'target-arrow-color': '#cbd5e1',
            'line-opacity': 0.7,
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

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const data = (node.data() as { stakeholder: Stakeholder }).stakeholder;
      onNodeClick?.(data);
    });

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

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [stakeholders, relationships, layouts, layoutMap, onNodeClick, onLayoutChange]);

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[500px] w-full rounded-xl border border-gray-200 bg-white shadow-sm"
    />
  );
});
