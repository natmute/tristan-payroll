import 'server-only';
import { db } from './supabase';
import { currentRole, ROLE_LABELS } from './role';

// Every admin action goes through here. The prototype logs the role-switcher user.
export async function logAction(action: string, entity?: string, entityId?: string, detail?: unknown) {
  const role = await currentRole();
  const { error } = await db().from('audit_log').insert({
    actor_role: role,
    actor_name: `${ROLE_LABELS[role]} (demo)`,
    action,
    entity,
    entity_id: entityId,
    detail: detail ?? null,
  });
  if (error) throw new Error(`Audit log failed: ${error.message}`);
}
