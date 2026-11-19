'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/supabase';
import { ROLES, ROLE_LABELS, type Role } from '@/lib/role';

// Prototype only: the switcher stands in for real login. Every switch is written to the audit log.
export async function setRole(formData: FormData) {
  const role = String(formData.get('role'));
  if (!ROLES.includes(role as Role)) return;
  const jar = await cookies();
  const before = jar.get('demo_role')?.value ?? 'admin';
  const employeeBefore = jar.get('demo_employee')?.value ?? null;
  jar.set('demo_role', role, { path: '/', sameSite: 'lax' });

  let employeeId: string | null = employeeBefore;
  if (role === 'employee') {
    const chosen = String(formData.get('employee') ?? '');
    employeeId = /^[0-9a-f-]{36}$/i.test(chosen) ? chosen : employeeBefore;
    if (!employeeId) {
      // First time as an employee: start with the first active employee.
      const { data } = await db().from('employees').select('id').eq('active', true).order('employee_no').limit(1).maybeSingle();
      employeeId = data?.id ?? null;
    }
    if (employeeId) jar.set('demo_employee', employeeId, { path: '/', sameSite: 'lax' });
  }

  if (before !== role || (role === 'employee' && employeeId !== employeeBefore)) {
    const { error } = await db().from('audit_log').insert({
      actor_role: role, actor_name: `${ROLE_LABELS[role as Role]} (demo)`, action: 'role.switch', entity: 'session',
      detail: { from: before, to: role, ...(role === 'employee' ? { employee_id: employeeId } : {}) },
    });
    if (error) console.warn('[audit] could not record the role switch:', error.message);
  }
  revalidatePath('/', 'layout');
}
