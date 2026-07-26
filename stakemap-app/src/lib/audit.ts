import { featureSupabase, scopeFeatureRow } from './featureStore';

type EntityType = 'stakeholder' | 'company' | 'relationship';
type Action = 'create' | 'update' | 'archive' | 'restore' | 'delete';

export async function logAudit(
  entityType: EntityType,
  entityId: string,
  action: Action,
  diffJson?: Record<string, unknown>
) {
  try {
    const payload = await scopeFeatureRow({
      entity_type: entityType,
      entity_id: entityId,
      action,
      diff_json: diffJson ?? null,
    });
    await featureSupabase.from('audit_events').insert(payload);
  } catch {
    // Audit failures must never break the main flow
  }
}
