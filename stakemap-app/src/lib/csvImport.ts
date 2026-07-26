import Papa from 'papaparse';
import type { SentimentType, SeniorityLevel } from '../types/database';

const VALID_SENTIMENTS: SentimentType[] = [
  'ALLY',
  'NEUTRAL',
  'OPPONENT',
  'UNKNOWN',
];
const VALID_SENIORITY: SeniorityLevel[] = [
  'C_LEVEL',
  'VP',
  'DIRECTOR',
  'MANAGER',
  'IC',
];

export interface CsvStakeholderData {
  full_name: string;
  company: string;
  title: string | null;
  department: string | null;
  seniority_level: SeniorityLevel | null;
  influence_score: number | null;
  sentiment: SentimentType;
  sentiment_confidence: number;
}

export interface CsvCompanyReference {
  id: string;
  name: string;
  status: string;
}

export interface CsvStakeholderReference {
  id: string;
  company_id: string;
  full_name: string;
  status: string;
}

export type CsvPreviewStatus = 'ready' | 'duplicate' | 'error';

export interface CsvPreviewRow {
  rowNumber: number;
  status: CsvPreviewStatus;
  data: CsvStakeholderData;
  companyId: string | null;
  companyAction: 'existing' | 'create' | 'blocked';
  errors: string[];
  warnings: string[];
}

export interface CsvPreview {
  fileName: string;
  rows: CsvPreviewRow[];
  parseErrors: string[];
}

function normalizeColumnKey(header: string): string {
  const lower = header.trim().toLowerCase().replace(/\s+/g, '_');
  if (
    lower.startsWith('full_name') ||
    lower.startsWith('fullname') ||
    lower === 'name'
  ) {
    return 'full_name';
  }
  if (lower === 'company_id' || lower.startsWith('company_id_')) {
    return 'company_id';
  }
  if (lower.startsWith('company')) return 'company';
  if (lower.startsWith('title') || lower === 'job_title') return 'title';
  if (lower.startsWith('department')) return 'department';
  if (lower.startsWith('seniority')) return 'seniority_level';
  if (lower.startsWith('influence')) return 'influence_score';
  if (lower.startsWith('sentiment') && !lower.includes('confidence')) {
    return 'sentiment';
  }
  if (
    lower.startsWith('sentiment_confidence') ||
    lower === 'confidence'
  ) {
    return 'sentiment_confidence';
  }
  return lower;
}

export function normalizeCompanyName(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeStakeholderName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeRow(row: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      normalizeColumnKey(key),
      String(value ?? '').trim(),
    ]),
  );
}

function parseOptionalScore(
  value: string | undefined,
  label: string,
  errors: string[],
): number | null {
  if (!value) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 5) {
    errors.push(`${label} must be a whole number from 1 to 5`);
    return null;
  }
  return number;
}

function validateRow(
  row: Record<string, string>,
): {
  data: CsvStakeholderData;
  sourceCompanyId: string;
  errors: string[];
} {
  const normalized = normalizeRow(row);
  const errors: string[] = [];
  const fullName = normalized.full_name ?? '';
  const company = normalized.company ?? '';
  const sourceCompanyId = normalized.company_id ?? '';

  if (!fullName) errors.push('Full Name is required');
  if (!company && !sourceCompanyId) {
    errors.push('Company or Company ID is required');
  }

  let seniorityLevel: SeniorityLevel | null = null;
  if (normalized.seniority_level) {
    const candidate = normalized.seniority_level
      .toUpperCase()
      .replace(/[-\s]/g, '_') as SeniorityLevel;
    if (VALID_SENIORITY.includes(candidate)) {
      seniorityLevel = candidate;
    } else {
      errors.push(
        `Seniority must be one of ${VALID_SENIORITY.join(', ')}`,
      );
    }
  }

  let sentiment: SentimentType = 'UNKNOWN';
  if (normalized.sentiment) {
    const candidate = normalized.sentiment.toUpperCase() as SentimentType;
    if (VALID_SENTIMENTS.includes(candidate)) {
      sentiment = candidate;
    } else {
      errors.push(`Sentiment must be one of ${VALID_SENTIMENTS.join(', ')}`);
    }
  }

  const influenceScore = parseOptionalScore(
    normalized.influence_score,
    'Influence Score',
    errors,
  );
  const sentimentConfidence =
    parseOptionalScore(
      normalized.sentiment_confidence,
      'Sentiment Confidence',
      errors,
    ) ?? 3;

  return {
    data: {
      full_name: fullName,
      company,
      title: normalized.title || null,
      department: normalized.department || null,
      seniority_level: seniorityLevel,
      influence_score: influenceScore,
      sentiment,
      sentiment_confidence: sentimentConfidence,
    },
    sourceCompanyId,
    errors,
  };
}

export function buildCsvPreview(
  fileName: string,
  csvText: string,
  companies: CsvCompanyReference[],
  stakeholders: CsvStakeholderReference[],
): CsvPreview {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
  });
  const parseErrors = parsed.errors.map(
    (error) =>
      `Row ${(error.row ?? 0) + 2}: ${error.message || 'CSV parse error'}`,
  );
  const companiesByName = new Map<string, CsvCompanyReference>();
  const companiesById = new Map<string, CsvCompanyReference>();
  for (const company of companies) {
    companiesById.set(company.id.toLowerCase(), company);
    const key = normalizeCompanyName(company.name);
    const existing = companiesByName.get(key);
    if (!existing || (existing.status !== 'active' && company.status === 'active')) {
      companiesByName.set(key, company);
    }
  }

  const stakeholdersByCompanyAndName = new Map<
    string,
    CsvStakeholderReference
  >();
  for (const stakeholder of stakeholders) {
    const key = `${stakeholder.company_id}:${normalizeStakeholderName(stakeholder.full_name)}`;
    const existing = stakeholdersByCompanyAndName.get(key);
    if (
      !existing ||
      (existing.status !== 'active' && stakeholder.status === 'active')
    ) {
      stakeholdersByCompanyAndName.set(key, stakeholder);
    }
  }
  const firstCsvRowByKey = new Map<string, number>();

  if (parsed.data.length > 500) {
    parseErrors.push(
      `This file has ${parsed.data.length} rows. Split it into batches of 500 or fewer.`,
    );
  }

  const rows = parsed.data.slice(0, 500).map((rawRow, index): CsvPreviewRow => {
    const rowNumber = index + 2;
    const validated = validateRow(rawRow);
    let data = validated.data;
    const { sourceCompanyId, errors } = validated;
    const warnings: string[] = [];
    let company: CsvCompanyReference | undefined;
    let companyId: string | null = null;
    let companyAction: CsvPreviewRow['companyAction'] = 'create';
    let status: CsvPreviewStatus = errors.length > 0 ? 'error' : 'ready';

    if (sourceCompanyId) {
      company = companiesById.get(sourceCompanyId.toLowerCase());
      if (!company) {
        errors.push(
          `Company ID "${sourceCompanyId}" is not in the canonical register; replace it with a current company name or ID`,
        );
        companyAction = 'blocked';
        status = 'error';
      } else if (
        data.company &&
        normalizeCompanyName(data.company) !== normalizeCompanyName(company.name)
      ) {
        errors.push(
          `Company name "${data.company}" does not match Company ID "${sourceCompanyId}" (${company.name})`,
        );
        companyAction = 'blocked';
        status = 'error';
      } else {
        data = { ...data, company: company.name };
      }
    } else {
      company = companiesByName.get(normalizeCompanyName(data.company));
    }

    if (company?.status === 'active' && companyAction !== 'blocked') {
      companyId = company.id;
      companyAction = 'existing';
    } else if (company) {
      companyAction = 'blocked';
      errors.push(
        `Company "${company.name}" is ${company.status}; restore it or use its active replacement before importing`,
      );
      status = 'error';
    }

    const csvKey = `${normalizeCompanyName(data.company)}:${normalizeStakeholderName(data.full_name)}`;
    const firstCsvRow = firstCsvRowByKey.get(csvKey);
    if (firstCsvRow) {
      warnings.push(`Duplicate of CSV row ${firstCsvRow}; this row will be skipped`);
      status = 'duplicate';
    } else if (
      data.full_name &&
      data.company &&
      status !== 'error'
    ) {
      firstCsvRowByKey.set(csvKey, rowNumber);
    }

    if (companyId && status !== 'error') {
      const existing = stakeholdersByCompanyAndName.get(
        `${companyId}:${normalizeStakeholderName(data.full_name)}`,
      );
      if (existing) {
        warnings.push(
          existing.status === 'active'
            ? 'Stakeholder already exists in this company; this row will be skipped'
            : `Stakeholder is already ${existing.status}; restore or review that record instead`,
        );
        status = 'duplicate';
      }
    }

    return {
      rowNumber,
      status,
      data,
      companyId,
      companyAction,
      errors,
      warnings,
    };
  });

  if (rows.length === 0 && parseErrors.length === 0) {
    parseErrors.push(
      'No rows found. Include a header row and at least one stakeholder.',
    );
  }

  return { fileName, rows, parseErrors };
}
