'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/supabase';
import { logAction } from '@/lib/audit';
import { requireRole } from '@/lib/role';
import { FormError, run, text, whole, type ActionResult } from '@/lib/form';

// Leave taken is entered by hand (no requests or approvals: that is a Premium feature). Administrators only.
export async function setLeaveTaken(employeeId: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireRole(['admin']);
    const annual = whole(text(fd, 'annual_taken'), 'Annual leave taken', 0, 366);
    const sick = whole(text(fd, 'sick_taken'), 'Sick leave taken', 0, 366);
    const supabase = db();
    const { data: emp } = await supabase.from('employees').select('id').eq('id', employeeId).maybeSingle();
    if (!emp) throw new FormError('This employee no longer exists.');
    const { data: before } = await supabase.from('leave_balances').select('annual_taken, sick_taken').eq('employee_id', employeeId).maybeSingle();
    const was = { annual_taken: before?.annual_taken ?? 0, sick_taken: before?.sick_taken ?? 0 };
    if (was.annual_taken === annual && was.sick_taken === sick) return;
    const { error } = await supabase.from('leave_balances')
      .upsert({ employee_id: employeeId, annual_taken: annual, sick_taken: sick, updated_at: new Date().toISOString() });
    if (error) throw new FormError(`Could not save: ${error.message}`);
    await logAction('leave.update', 'employee', employeeId, { before: was, after: { annual_taken: annual, sick_taken: sick } });
    revalidatePath('/leave');
  });
}
