import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { supabase } from '../../lib/supabase';
import { downloadCsvTemplate } from '../../lib/csvTemplate';
import type { SentimentType, SeniorityLevel } from '../../types/database';

const VALID_SENTIMENTS: SentimentType[] = ['ALLY', 'NEUTRAL', 'OPPONENT', 'UNKNOWN'];
const VALID_SENIORITY: SeniorityLevel[] = ['C_LEVEL', 'VP', 'DIRECTOR', 'MANAGER', 'IC'];

interface CsvImportProps {
  onImportComplete?: () => void;
}

export function CsvImport({ onImportComplete }: CsvImportProps) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; created: number; errors: string[] } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function normalizeColumnKey(header: string): string {
    const trimmed = header.trim();
    const lower = trimmed.toLowerCase().replace(/\s+/g, '_');
    if (lower.startsWith('full_name') || lower.startsWith('fullname') || lower === 'name') return 'full_name';
    if (lower.startsWith('company')) return 'company';
    if (lower.startsWith('title') || lower === 'job_title') return 'title';
    if (lower.startsWith('department')) return 'department';
    if (lower.startsWith('seniority')) return 'seniority_level';
    if (lower.startsWith('influence')) return 'influence_score';
    if (lower.startsWith('sentiment') && !lower.includes('confidence')) return 'sentiment';
    if (lower.startsWith('sentiment_confidence') || lower === 'confidence') return 'sentiment_confidence';
    return lower;
  }

  function parseRow(row: Record<string, string>): { full_name: string; company: string; [k: string]: string } | null {
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      const key = normalizeColumnKey(k);
      if (key && v !== undefined && v !== null) normalized[key] = String(v).trim();
    }
    const full_name = normalized.full_name || normalized.name;
    const company = normalized.company || normalized.company_name;
    if (!full_name || !company) return null;
    return { full_name, company, ...normalized };
  }

  function validateAndCoerce(parsed: Record<string, string>): { valid: boolean; errors: string[]; data: Record<string, unknown> } {
    const errors: string[] = [];
    const full_name = (parsed.full_name || '').trim();
    const company = (parsed.company || '').trim();

    if (!full_name) errors.push(`Row: missing full_name`);
    if (!company) errors.push(`Row: missing company`);

    let seniority_level: SeniorityLevel | null = null;
    const sl = (parsed.seniority_level || parsed.seniority || '').trim().toUpperCase().replace(/[-\s]/g, '_');
    if (sl && VALID_SENIORITY.includes(sl as SeniorityLevel)) seniority_level = sl as SeniorityLevel;

    let sentiment: SentimentType = 'UNKNOWN';
    const sent = (parsed.sentiment || '').trim().toUpperCase();
    if (sent && VALID_SENTIMENTS.includes(sent as SentimentType)) sentiment = sent as SentimentType;

    let influence_score: number | null = null;
    const inf = parsed.influence_score || parsed.influence;
    if (inf) {
      const n = parseInt(inf, 10);
      if (!isNaN(n) && n >= 1 && n <= 5) influence_score = n;
    }

    let sentiment_confidence: number | null = null;
    const conf = parsed.sentiment_confidence || parsed.confidence;
    if (conf) {
      const n = parseInt(conf, 10);
      if (!isNaN(n) && n >= 1 && n <= 5) sentiment_confidence = n;
    }

    return {
      valid: errors.length === 0,
      errors,
      data: {
        full_name,
        company,
        title: parsed.title?.trim() || null,
        department: parsed.department?.trim() || null,
        seniority_level,
        influence_score,
        sentiment,
        sentiment_confidence: sentiment_confidence ?? 3,
      },
    };
  }

  async function handleFile(file: File) {
    setResult(null);
    setImporting(true);
    const errors: string[] = [];
    let imported = 0;
    let companiesCreated = 0;
    const companyCache = new Map<string, string>();

    try {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      if (!parsed.data?.length) {
        setResult({ imported: 0, created: 0, errors: ['No rows found in CSV. Ensure the file has a header row and at least one data row.'] });
        return;
      }

      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i];
        const parsedRow = parseRow(row);
        if (!parsedRow) {
          errors.push(`Row ${i + 2}: Missing required fields (full_name and company)`);
          continue;
        }

        const { valid, errors: rowErrors, data } = validateAndCoerce(parsedRow);
        if (!valid && rowErrors.length) {
          errors.push(`Row ${i + 2}: ${rowErrors.join('; ')}`);
          continue;
        }

        try {
          let companyId = companyCache.get((data.company as string).toLowerCase());
          if (!companyId) {
            const { data: existing } = await supabase.from('companies').select('id').ilike('name', (data.company as string).trim()).limit(1).maybeSingle();
            if (existing?.id) {
              companyId = existing.id as string;
              companyCache.set(String(data.company).toLowerCase(), companyId);
            } else {
              const companyName = String(data.company).trim();
              const { data: created, error: insertErr } = await supabase.from('companies').insert({ name: companyName }).select('id').single();
              if (insertErr) throw insertErr;
              if (!created?.id) throw new Error('Failed to create company');
              companyId = created.id as string;
              companyCache.set(companyName.toLowerCase(), companyId);
              companiesCreated++;
            }
          }

          if (!companyId) {
            errors.push(`Row ${i + 2}: Could not resolve company`);
            continue;
          }

          const { error: stakeErr } = await supabase.from('stakeholders').insert({
            company_id: companyId,
            full_name: data.full_name as string,
            title: data.title as string | null,
            department: data.department as string | null,
            seniority_level: data.seniority_level as SeniorityLevel | null,
            influence_score: data.influence_score as number | null,
            sentiment: data.sentiment as SentimentType,
            sentiment_confidence: data.sentiment_confidence as number,
          });
          if (stakeErr) throw stakeErr;
          imported++;
        } catch (e) {
          errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'Import failed'}`);
        }
      }

      setResult({ imported, created: companiesCreated, errors });
      onImportComplete?.();
    } catch (e) {
      setResult({
        imported: 0,
        created: 0,
        errors: [e instanceof Error ? e.message : 'Failed to parse CSV'],
      });
    } finally {
      setImporting(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.csv') || file?.type === 'text/csv') handleFile(file);
    else setResult({ imported: 0, created: 0, errors: ['Please select a CSV file.'] });
  }

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={downloadCsvTemplate}
          className="btn-secondary text-sm"
        >
          Download blank CSV template
        </button>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={`rounded-lg border-2 border-dashed px-4 py-3 text-center text-sm transition ${dragActive ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 text-slate-500 hover:border-gray-400'}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={onFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Drop CSV here or click to browse'}
          </button>
        </div>
      </div>

      {result && (
        <div className={`rounded-lg border p-3 text-sm ${result.errors.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <p className="font-medium text-slate-900">
            Imported {result.imported} stakeholder{result.imported !== 1 ? 's' : ''}
            {result.created > 0 && ` · Created ${result.created} new compan${result.created !== 1 ? 'ies' : 'y'}`}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-amber-700">
              {result.errors.slice(0, 10).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
              {result.errors.length > 10 && (
                <li>...and {result.errors.length - 10} more</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
