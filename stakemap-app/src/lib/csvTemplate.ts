/** CSV columns for stakeholder import. Order matters for template. */
export const STAKEHOLDER_CSV_COLUMNS = [
  'full_name',
  'company',
  'title',
  'department',
  'seniority_level',
  'influence_score',
  'sentiment',
  'sentiment_confidence',
] as const;

/** Simple headers without commas - commas in CSV break column parsing */
export const STAKEHOLDER_CSV_HEADERS = [
  'Full Name',
  'Company',
  'Title',
  'Department',
  'Seniority',
  'Influence Score',
  'Sentiment',
  'Sentiment Confidence',
] as const;

export function buildCsvTemplateContent(): string {
  const headerRow = STAKEHOLDER_CSV_HEADERS.join(',');
  return headerRow + '\n';
}

export function downloadCsvTemplate(): void {
  const content = buildCsvTemplateContent();
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'stakemap-stakeholders-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(val: string | number | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export interface ExportStakeholder {
  full_name: string;
  title?: string | null;
  department?: string | null;
  seniority_level?: string | null;
  influence_score?: number | null;
  sentiment: string;
  sentiment_confidence?: number | null;
  companies?: { name: string } | null;
}

export interface ExportRelationship {
  fromName: string;
  toName: string;
  relation_type: string;
  strength?: number | null;
  notes?: string | null;
}

export function exportStakeholdersCsv(stakeholders: ExportStakeholder[], filename?: string): void {
  const headers = ['Full Name', 'Company', 'Title', 'Department', 'Seniority', 'Influence Score', 'Sentiment', 'Sentiment Confidence'];
  const rows = stakeholders.map((s) => [
    escapeCsv(s.full_name),
    escapeCsv(s.companies?.name),
    escapeCsv(s.title),
    escapeCsv(s.department),
    escapeCsv(s.seniority_level),
    escapeCsv(s.influence_score),
    escapeCsv(s.sentiment),
    escapeCsv(s.sentiment_confidence),
  ].join(','));
  downloadCsvString(headers.join(',') + '\n' + rows.join('\n'), filename || `stakeholders-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportRelationshipsCsv(relationships: ExportRelationship[], filename?: string): void {
  const headers = ['From', 'To', 'Type', 'Strength', 'Notes'];
  const rows = relationships.map((r) => [
    escapeCsv(r.fromName),
    escapeCsv(r.toName),
    escapeCsv(r.relation_type.replace(/_/g, ' ')),
    escapeCsv(r.strength),
    escapeCsv(r.notes),
  ].join(','));
  downloadCsvString(headers.join(',') + '\n' + rows.join('\n'), filename || `relationships-${new Date().toISOString().slice(0, 10)}.csv`);
}

function downloadCsvString(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
