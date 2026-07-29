import { useRef, useState } from 'react';
import {
  canonicalEntityClient,
  getCanonicalWorkspaceId,
} from '../../lib/canonical';
import {
  buildCsvPreview,
  normalizeCompanyName,
  type CsvCompanyReference,
  type CsvPreview,
  type CsvStakeholderReference,
} from '../../lib/csvImport';
import { downloadCsvTemplate } from '../../lib/csvTemplate';

interface CsvImportProps {
  onImportComplete?: () => void;
}

interface ImportResult {
  imported: number;
  companiesCreated: number;
  errors: string[];
}

const STATUS_STYLES = {
  ready: 'bg-emerald-100 text-emerald-700',
  duplicate: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
} as const;

export function CsvImport({ onImportComplete }: CsvImportProps) {
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function validateFile(file: File) {
    setPreview(null);
    setResult(null);
    setValidating(true);

    try {
      const [csvText, companiesResult, stakeholdersResult] = await Promise.all([
        file.text(),
        canonicalEntityClient
          .from('companies')
          .select('id, name, status'),
        canonicalEntityClient
          .from('stakeholders')
          .select('id, company_id, full_name, status'),
      ]);

      if (companiesResult.error) throw companiesResult.error;
      if (stakeholdersResult.error) throw stakeholdersResult.error;

      setPreview(
        buildCsvPreview(
          file.name,
          csvText,
          (companiesResult.data as CsvCompanyReference[] | null) ?? [],
          (stakeholdersResult.data as CsvStakeholderReference[] | null) ?? [],
        ),
      );
    } catch (error) {
      setResult({
        imported: 0,
        companiesCreated: 0,
        errors: [
          error instanceof Error ? error.message : 'CSV validation failed',
        ],
      });
    } finally {
      setValidating(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    const readyRows = preview.rows.filter((row) => row.status === 'ready');
    if (readyRows.length === 0 || preview.parseErrors.length > 0) return;

    setImporting(true);
    setResult(null);

    try {
      const workspaceId = await getCanonicalWorkspaceId();
      const rows = readyRows.map((row) => ({
        ...row.data,
        row_number: row.rowNumber,
      }));
      const { data, error } = await canonicalEntityClient.rpc(
        'import_canonical_stakeholders',
        {
          p_workspace_id: workspaceId,
          p_file_name: preview.fileName,
          p_rows: rows,
        },
      );
      if (error) throw error;

      const summary = data as {
        imported?: number;
        companies_created?: number;
      } | null;
      const imported = summary?.imported ?? 0;
      setResult({
        imported,
        companiesCreated: summary?.companies_created ?? 0,
        errors: [],
      });
      setPreview(null);
      if (imported > 0) onImportComplete?.();
    } catch (error) {
      setResult({
        imported: 0,
        companiesCreated: 0,
        errors: [
          error instanceof Error
            ? error.message
            : 'The atomic import failed and no rows were written',
        ],
      });
    } finally {
      setImporting(false);
    }
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files[0];
    if (file?.name.toLowerCase().endsWith('.csv') || file?.type === 'text/csv') {
      void validateFile(file);
    } else {
      setResult({
        imported: 0,
        companiesCreated: 0,
        errors: ['Please select a CSV file.'],
      });
    }
  }

  function onFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void validateFile(file);
    event.target.value = '';
  }

  const readyCount =
    preview?.rows.filter((row) => row.status === 'ready').length ?? 0;
  const duplicateCount =
    preview?.rows.filter((row) => row.status === 'duplicate').length ?? 0;
  const errorCount =
    (preview?.rows.filter((row) => row.status === 'error').length ?? 0) +
    (preview?.parseErrors.length ?? 0);
  const newCompanyCount = new Set(
    preview?.rows
      .filter(
        (row) => row.status === 'ready' && row.companyAction === 'create',
      )
      .map((row) => normalizeCompanyName(row.data.company)) ?? [],
  ).size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={downloadCsvTemplate}
          className="btn-secondary text-sm"
        >
          Download blank CSV template
        </button>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={`rounded-lg border-2 border-dashed px-4 py-3 text-center text-sm transition ${
            dragActive
              ? 'border-emerald-500 bg-emerald-50'
              : 'border-gray-300 text-slate-500 hover:border-gray-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={validating || importing}
            className="font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
          >
            {validating
              ? 'Validating...'
              : 'Drop CSV here or click to validate'}
          </button>
        </div>
      </div>

      {preview && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold text-slate-900">
                Review {preview.fileName}
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Nothing has been imported. Review every row, then confirm the
                valid records.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreview(null)}
              disabled={importing}
              className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            <PreviewMetric label="Ready" value={readyCount} tone="emerald" />
            <PreviewMetric
              label="Duplicates"
              value={duplicateCount}
              tone="amber"
            />
            <PreviewMetric label="Errors" value={errorCount} tone="red" />
            <PreviewMetric
              label="New companies"
              value={newCompanyCount}
              tone="indigo"
            />
          </div>

          {preview.parseErrors.length > 0 && (
            <ul className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {preview.parseErrors.map((error, index) => (
                <li key={`${index}-${error}`}>{error}</li>
              ))}
            </ul>
          )}

          <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Stakeholder</th>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-500">
                      {row.rowNumber}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {row.data.full_name || '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {row.data.company || '—'}
                      {row.status === 'ready' && (
                        <span className="ml-1 text-xs text-slate-400">
                          (
                          {row.companyAction === 'create'
                            ? 'new'
                            : 'existing'}
                          )
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="max-w-sm px-3 py-2 text-xs">
                      {row.errors.map((error) => (
                        <p key={error} className="text-red-600">
                          {error}
                        </p>
                      ))}
                      {row.warnings.map((warning) => (
                        <p key={warning} className="text-amber-700">
                          {warning}
                        </p>
                      ))}
                      {row.errors.length === 0 &&
                        row.warnings.length === 0 && (
                          <span className="text-emerald-700">
                            Ready to import
                          </span>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Duplicate and invalid rows are never inserted.
            </p>
            <button
              type="button"
              onClick={() => void confirmImport()}
              disabled={
                importing ||
                readyCount === 0 ||
                preview.parseErrors.length > 0
              }
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing
                ? 'Importing...'
                : `Confirm import of ${readyCount} stakeholder${
                    readyCount === 1 ? '' : 's'
                  }`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            result.errors.length > 0
              ? 'border-amber-200 bg-amber-50'
              : 'border-emerald-200 bg-emerald-50'
          }`}
        >
          <p className="font-medium text-slate-900">
            Imported {result.imported} stakeholder
            {result.imported === 1 ? '' : 's'}
            {result.companiesCreated > 0 &&
              ` · Created ${result.companiesCreated} new ${
                result.companiesCreated === 1 ? 'company' : 'companies'
              }`}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-amber-700">
              {result.errors.map((error, index) => (
                <li key={`${index}-${error}`}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'amber' | 'red' | 'indigo';
}) {
  const styles = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  };

  return (
    <div className={`rounded-lg border px-3 py-2 ${styles[tone]}`}>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
