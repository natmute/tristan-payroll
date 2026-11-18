import 'server-only';
import { db } from './supabase';
import { currentRole, ROLE_LABELS } from './role';

/** The demo user behind this request. Real auth replaces this in the full build. */
export async function actor() {
  const role = await currentRole();
  return { role, name: `${ROLE_LABELS[role]} (demo)` };
}

// Every admin action goes through here. The prototype logs the role-switcher user.
export async function logAction(action: string, entity?: string, entityId?: string, detail?: unknown) {
  const who = await actor();
  const { error } = await db().from('audit_log').insert({
    actor_role: who.role,
    actor_name: who.name,
    action,
    entity,
    entity_id: entityId,
    detail: detail ?? null,
  });
  if (error) throw new Error(`Audit log failed: ${error.message}`);
}
