import { authSupabase } from './auth';
import { supabase } from './supabase';
import { getFeatureWorkspaceId } from './featureStore';
import type {
  Company,
  MapLayout,
  Relationship,
  Stakeholder,
} from '../types/database';

export const canonicalReadsEnabled =
  import.meta.env.VITE_CANONICAL_READS_ENABLED === 'true';

export const canonicalWritesEnabled =
  canonicalReadsEnabled &&
  import.meta.env.VITE_CANONICAL_WRITES_ENABLED === 'true';

export const canonicalEntityClient = canonicalWritesEnabled
  ? authSupabase
  : supabase;

export function normalizeCanonicalName(value: string): string {
  return value.trim().toLowerCase();
}

export async function scopeCanonicalInsert<
  T extends Record<string, unknown>,
>(row: T): Promise<T | (T & { workspace_id: string })> {
  if (!canonicalWritesEnabled) return row;

  const workspaceId = await getFeatureWorkspaceId();
  if (!workspaceId) {
    throw new Error('The shared stakeholder workspace is unavailable.');
  }

  return { ...row, workspace_id: workspaceId };
}

export interface StakeholderSourceAlias {
  source_stakeholder_id: string;
  workspace_id: string;
  canonical_stakeholder_id: string;
  is_primary: boolean;
}

export type StakeholderWithCompany = Stakeholder & {
  companies: Company;
};

export async function fetchCompanies(
  status: 'active' | 'archived' = 'active',
): Promise<Company[]> {
  const client = canonicalReadsEnabled ? authSupabase : supabase;
  const { data, error } = await client
    .from('companies')
    .select(
      'id, name, industry, region, parent_company_id, tags, status, created_at, updated_at',
    )
    .eq('status', status)
    .order('name');

  if (error) throw error;
  return (data as Company[] | null) ?? [];
}

export async function fetchStakeholders(
  status: 'active' | 'archived' = 'active',
): Promise<StakeholderWithCompany[]> {
  if (!canonicalReadsEnabled) {
    const { data, error } = await supabase
      .from('stakeholders')
      .select('*, companies(*)')
      .eq('status', status)
      .order('full_name');

    if (error) throw error;
    return (data as StakeholderWithCompany[] | null) ?? [];
  }

  const [stakeholdersResult, companies] = await Promise.all([
    authSupabase
      .from('stakeholders')
      .select(
        'id, company_id, full_name, title, department, seniority_level, influence_score, sentiment, sentiment_confidence, notes, email, phone, linkedin_url, status, created_at, updated_at',
      )
      .eq('status', status)
      .order('full_name'),
    fetchCompanies('active'),
  ]);

  if (stakeholdersResult.error) throw stakeholdersResult.error;

  const companiesById = new Map(companies.map((company) => [company.id, company]));
  return ((stakeholdersResult.data as Stakeholder[] | null) ?? [])
    .map((stakeholder) => {
      const company = companiesById.get(stakeholder.company_id);
      return company ? { ...stakeholder, companies: company } : null;
    })
    .filter((stakeholder): stakeholder is StakeholderWithCompany =>
      Boolean(stakeholder),
    );
}

export async function fetchStakeholderSourceAliases(): Promise<
  StakeholderSourceAlias[]
> {
  if (!canonicalReadsEnabled) return [];

  const { data, error } = await authSupabase
    .from('stakeholder_source_aliases')
    .select(
      'source_stakeholder_id, workspace_id, canonical_stakeholder_id, is_primary',
    );

  if (error) throw error;
  return (data as StakeholderSourceAlias[] | null) ?? [];
}

export async function getLegacySourceIds(
  canonicalStakeholderId: string,
): Promise<string[]> {
  if (!canonicalReadsEnabled) return [canonicalStakeholderId];

  const { data, error } = await authSupabase
    .from('stakeholder_source_aliases')
    .select('source_stakeholder_id')
    .eq('canonical_stakeholder_id', canonicalStakeholderId);

  if (error) throw error;

  const sourceIds = (
    (data as Array<{ source_stakeholder_id: string }> | null) ?? []
  ).map((row) => row.source_stakeholder_id);

  return sourceIds.length > 0 ? sourceIds : [canonicalStakeholderId];
}

export function remapLegacyRelationships(
  relationships: Relationship[],
  aliases: StakeholderSourceAlias[],
): Relationship[] {
  if (!canonicalReadsEnabled) return relationships;

  const canonicalBySource = new Map(
    aliases.map((alias) => [
      alias.source_stakeholder_id,
      alias.canonical_stakeholder_id,
    ]),
  );

  return relationships
    .map((relationship) => ({
      ...relationship,
      from_stakeholder_id:
        canonicalBySource.get(relationship.from_stakeholder_id) ??
        relationship.from_stakeholder_id,
      to_stakeholder_id:
        canonicalBySource.get(relationship.to_stakeholder_id) ??
        relationship.to_stakeholder_id,
    }))
    .filter(
      (relationship) =>
        relationship.from_stakeholder_id !== relationship.to_stakeholder_id,
    );
}

export function remapLegacyLayouts(
  layouts: MapLayout[],
  aliases: StakeholderSourceAlias[],
): MapLayout[] {
  if (!canonicalReadsEnabled) return layouts;

  const canonicalBySource = new Map(
    aliases.map((alias) => [
      alias.source_stakeholder_id,
      alias.canonical_stakeholder_id,
    ]),
  );
  const primarySources = new Set(
    aliases
      .filter((alias) => alias.is_primary)
      .map((alias) => alias.source_stakeholder_id),
  );
  const layoutByCanonicalId = new Map<
    string,
    { layout: MapLayout; primary: boolean }
  >();

  for (const layout of layouts) {
    const canonicalId =
      canonicalBySource.get(layout.stakeholder_id) ?? layout.stakeholder_id;
    const primary = primarySources.has(layout.stakeholder_id);
    const existing = layoutByCanonicalId.get(canonicalId);

    if (!existing || (primary && !existing.primary)) {
      layoutByCanonicalId.set(canonicalId, {
        layout: { ...layout, stakeholder_id: canonicalId },
        primary,
      });
    }
  }

  return Array.from(layoutByCanonicalId.values(), ({ layout }) => layout);
}
