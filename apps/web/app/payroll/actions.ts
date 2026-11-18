'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { buildRun, checkRun, compareRuns, type Category } from '@tristan/payroll-engine';
import { db } from '@/lib/supabase';
import { actor, logAction } from '@/lib/audit';
import { requireRole } from '@/lib/role';
import { FormError, checked, isoDate, optText, required, run, text, type ActionResult } from '@/lib/form';
import {
  lineToRow, loadEmployeesForRun, loadPreviousRun, loadRun, loadSettings, toLine, type RunStatus,
} from '@/lib/payroll';

const STAFF = ['admin', 'payroll_officer'] as const;
const CATEGORIES = ['government', 'expat_contractor'];

function refresh(id?: string) {
  revalidatePath('/payroll');
  revalidatePath('/');
  if (id) revalidatePath(`/payroll/${id}`);
}

/** Moves a run from one of the allowed statuses to another. Fails if someone else moved it first. */
async function transition(id: string, from: RunStatus[], to: RunStatus, extra: Record<string, unknown> = {}) {
  const { data, error } = await db().from('pay_runs').update({ status: to, ...extra }).eq('id', id).in('status', from).select('id');
  if (error) throw new FormError(`Could not save: ${error.message}`);
  if (!data?.length) throw new FormError('This run has changed since you opened it. Reload the page.');
}

/** Blocking errors stop a run being submitted or approved. */
async function assertNoBlockingErrors(id: string) {
  const loaded = await loadRun(id);
  if (!loaded) throw new FormError('This run no longer exists.');
  const previous = await loadPreviousRun(loaded.run);
  const settings = loaded.run.settings_snapshot ?? (await loadSettings());
  const lines = loaded.lines.map(toLine);
  const changes = previous ? compareRuns(lines, previous.lines.map(toLine), settings.netChangeWarningBps).changes : [];
  const { blocking } = checkRun(lines, changes);
  if (blocking.length) throw new FormError(`Fix ${blocking.length} blocking error(s) first. They are listed under Pre-run checks.`);
  if (lines.length === 0) throw new FormError('This run has no employees.');
}

export async function createRun(fd: FormData): Promise<ActionResult> {
  let newId = '';
  const result = await run(async () => {
    await requireRole([...STAFF]);
    const category = text(fd, 'category');
    if (!CATEGORIES.includes(category)) throw new FormError('Choose a category.');
    const departmentId = optText(fd, 'department_id');
    const start = isoDate(required(fd, 'period_start', 'Period start'), 'Period start');
    const end = isoDate(required(fd, 'period_end', 'Period end'), 'Period end');
    const payDate = isoDate(required(fd, 'pay_date', 'Pay date'), 'Pay date');
    if (end < start) throw new FormError('The period end cannot be before the period start.');

    const supabase = db();
    if (departmentId) {
      const { data: d } = await supabase.from('departments').select('category').eq('id', departmentId).maybeSingle();
      if (!d || d.category !== category) throw new FormError('That department is not in the chosen category.');
    }
    let dup = supabase.from('pay_runs').select('id').eq('category', category).eq('pay_date', payDate);
    dup = departmentId ? dup.eq('department_id', departmentId) : dup.is('department_id', null);
    const { data: existing } = await dup;
    if (existing?.length) throw new FormError('A run for this category and pay date already exists. Open it from the Payroll list.');

    const settings = await loadSettings();
    const employees = await loadEmployeesForRun(category as Category, departmentId, { start, end });
    let lines;
    try {
      lines = buildRun(employees, { start, end }, settings);
    } catch (e) {
      throw new FormError((e as Error).message);
    }
    if (lines.length === 0) throw new FormError('No employees are due pay in this period.');

    const { data: created, error } = await supabase.from('pay_runs')
      .insert({ category, department_id: departmentId, period_start: start, period_end: end, pay_date: payDate, status: 'draft', settings_snapshot: settings })
      .select('id').single();
    if (error) throw new FormError(`Could not create the run: ${error.message}`);
    newId = created.id;

    const { error: lineError } = await supabase.from('payslips').insert(lines.map((l) => lineToRow(newId, l)));
    if (lineError) {
      await supabase.from('pay_runs').delete().eq('id', newId); // draft only, so this is allowed
      throw new FormError(`Could not save the payslip lines: ${lineError.message}`);
    }
    await logAction('run.create', 'pay_run', newId, { category, pay_date: payDate, period: [start, end], employees: lines.length });
  });
  if (result) return result;
  refresh();
  redirect(`/payroll/${newId}`);
}

/** Re-reads employees, deductions and settings and rebuilds a draft's lines. */
export async function recalculateRun(id: string): Promise<ActionResult> {
  return run(async () => {
    await requireRole([...STAFF]);
    const loaded = await loadRun(id);
    if (!loaded) throw new FormError('This run no longer exists.');
    const { run: r } = loaded;
    if (r.status !== 'draft') throw new FormError('Only a draft can be recalculated. Send it back to draft first.');

    const settings = await loadSettings();
    const period = { start: r.period_start, end: r.period_end };
    const lines = buildRun(await loadEmployeesForRun(r.category, r.department_id, period), period, settings);
    if (lines.length === 0) throw new FormError('No employees are due pay in this period.');

    const supabase = db();
    const { error: delError } = await supabase.from('payslips').delete().eq('pay_run_id', id);
    if (delError) throw new FormError(`Could not recalculate: ${delError.message}`);
    const { error } = await supabase.from('payslips').insert(lines.map((l) => lineToRow(id, l)));
    if (error) throw new FormError(`Could not save the new lines: ${error.message}. Recalculate again.`);
    await supabase.from('pay_runs').update({ settings_snapshot: settings }).eq('id', id).eq('status', 'draft');
    await logAction('run.recalculate', 'pay_run', id, { employees: lines.length });
    refresh(id);
  });
}

export async function submitRun(id: string): Promise<ActionResult> {
  return run(async () => {
    await requireRole([...STAFF]);
    await assertNoBlockingErrors(id);
    const who = await actor();
    await transition(id, ['draft'], 'in_review', { submitted_by: who.name, submitted_at: new Date().toISOString() });
    await logAction('run.submit', 'pay_run', id);
    refresh(id);
  });
}

// Only an administrator can approve. A payroll officer can prepare and submit.
export async function approveRun(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireRole(['admin']);
    await assertNoBlockingErrors(id);
    const note = optText(fd, 'note');
    const who = await actor();
    await transition(id, ['in_review'], 'approved', { approved_by: who.name, approved_at: new Date().toISOString(), approval_note: note });
    await logAction('run.approve', 'pay_run', id, { note });
    refresh(id);
  });
}

// A run can go backwards only with a reason, and the move is logged.
export async function sendBack(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireRole(['admin']);
    const reason = required(fd, 'reason', 'Reason');
    await transition(id, ['in_review', 'approved'], 'draft', {
      submitted_by: null, submitted_at: null, approved_by: null, approved_at: null, approval_note: null,
    });
    await logAction('run.send_back', 'pay_run', id, { reason });
    refresh(id);
  });
}

export async function finaliseRun(id: string, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    await requireRole(['admin']);
    if (!checked(fd, 'confirm')) throw new FormError('Tick the box to confirm you have reviewed this run.');
    const who = await actor();
    // One database transaction: settles credit purchases, stores totals, locks the run, writes the audit entry.
    const { error } = await db().rpc('finalise_pay_run', { p_run: id, p_actor_role: who.role, p_actor_name: who.name });
    if (error) throw new FormError(error.message);
    refresh(id);
  });
}

export async function deleteDraft(id: string): Promise<ActionResult> {
  const result = await run(async () => {
    await requireRole([...STAFF]);
    const { data, error } = await db().from('pay_runs').delete().eq('id', id).eq('status', 'draft').select('id');
    if (error) throw new FormError(`Could not delete: ${error.message}`);
    if (!data?.length) throw new FormError('Only a draft can be deleted.');
    await logAction('run.delete', 'pay_run', id);
  });
  if (result) return result;
  refresh();
  redirect('/payroll');
}
