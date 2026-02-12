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
