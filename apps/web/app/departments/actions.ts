'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase';
import { logAction } from '@/lib/audit';
import { requireRole } from '@/lib/role';
import { FormError, dbError, diff, required, run, text, type ActionResult } from '@/lib/form';

// Pass id = null to create. Administrators only.
export async function saveDepartment(id: string | null, fd: FormData): Promise<ActionResult> {
  const result = await run(async () => {
    await requireRole(['admin']);
    const supabase = db();
    const category = text(fd, 'category');
    if (!['government', 'expat_contractor'].includes(category)) throw new FormError('Choose a category.');
    const row = { code: required(fd, 'code', 'Code'), name: required(fd, 'name', 'Name'), category };

    if (!id) {
      const { data, error } = await supabase.from('departments').insert(row).select('id').single();
      if (error) dbError(error, 'A department with that code or name already exists.');
      await logAction('department.create', 'department', data!.id, { after: row });
      return;
    }

    const { data: before } = await supabase.from('departments').select('code, name, category').eq('id', id).maybeSingle();
    if (!before) throw new FormError('This department no longer exists.');
    const change = diff(before, row);
    if (!change.changed) return;
    if (before.category !== category) {
      const { count } = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('department_id', id);
      if (count) throw new FormError(`${count} employees are in this department. Move them first before changing its category.`);
    }
    const { error } = await supabase.from('departments').update(row).eq('id', id);
    if (error) dbError(error, 'A department with that code or name already exists.');
    await logAction('department.update', 'department', id, { before: change.before, after: change.after });
  });
  if (result) return result;
  revalidatePath('/departments');
  redirect('/departments');
}
