'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase';
import { logAction } from '@/lib/audit';
import { requireRole } from '@/lib/role';
import { FormError, dbError, diff, required, run, type ActionResult } from '@/lib/form';

// Pass id = null to create. Administrators only.
export async function saveGrade(id: string | null, fd: FormData): Promise<ActionResult> {
  const result = await run(async () => {
    await requireRole(['admin']);
    const supabase = db();
    const row = { code: required(fd, 'code', 'Code'), name: required(fd, 'name', 'Name') };

    if (!id) {
      const { data, error } = await supabase.from('pay_grades').insert(row).select('id').single();
      if (error) dbError(error, 'A pay grade with that code already exists.');
      await logAction('grade.create', 'pay_grade', data!.id, { after: row });
      return;
    }

    const { data: before } = await supabase.from('pay_grades').select('code, name').eq('id', id).maybeSingle();
    if (!before) throw new FormError('This pay grade no longer exists.');
    const change = diff(before, row);
    if (!change.changed) return;
    const { error } = await supabase.from('pay_grades').update(row).eq('id', id);
    if (error) dbError(error, 'A pay grade with that code already exists.');
    await logAction('grade.update', 'pay_grade', id, { before: change.before, after: change.after });
  });
  if (result) return result;
  revalidatePath('/grades');
  redirect('/grades');
}
