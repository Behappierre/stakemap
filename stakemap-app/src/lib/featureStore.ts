import { authSupabase } from './auth';
import { supabase } from './supabase';

export const sharedFeatureStoreEnabled =
  import.meta.env.VITE_CANONICAL_READS_ENABLED === 'true';

export const featureSupabase = sharedFeatureStoreEnabled
  ? authSupabase
  : supabase;

let workspaceIdPromise: Promise<string> | null = null;

async function loadWorkspaceId(): Promise<string> {
  const { data, error } = await authSupabase
    .from('workspaces')
    .select('id')
    .eq('slug', 'business-development')
    .single();

  if (error) throw error;
  return data.id as string;
}

export function getFeatureWorkspaceId(): Promise<string | null> {
  if (!sharedFeatureStoreEnabled) return Promise.resolve(null);
  workspaceIdPromise ??= loadWorkspaceId();
  return workspaceIdPromise;
}

export async function scopeFeatureRow<T extends Record<string, unknown>>(
  row: T,
): Promise<T | (T & { workspace_id: string })> {
  const workspaceId = await getFeatureWorkspaceId();
  return workspaceId ? { ...row, workspace_id: workspaceId } : row;
}

export async function scopeFeatureRows<T extends Record<string, unknown>>(
  rows: T[],
): Promise<Array<T | (T & { workspace_id: string })>> {
  const workspaceId = await getFeatureWorkspaceId();
  return workspaceId
    ? rows.map((row) => ({ ...row, workspace_id: workspaceId }))
    : rows;
}
