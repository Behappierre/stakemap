import { supabase } from './supabase';

type EntityType = 'stakeholder' | 'company' | 'relationship';
type Action = 'create' | 'update' | 'archive' | 'restore' | 'delete';

export async function logAudit(
  entityType: EntityType,
  entityId: string,
  action: Action,
  diffJson?: Record<string, unknown>
) {
  try {
    await supabase.from('audit_events').insert({
      entity_type: entityType,
      entity_id: entityId,
      action,
      diff_json: diffJson ?? null,
    });
  } catch {
    // Audit failures must never break the main flow
  }
}
