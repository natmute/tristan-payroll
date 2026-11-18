'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase';
import { logAction } from '@/lib/audit';
import { requireRole } from '@/lib/role';
import {
  FormError, checked, dbError, diff, isoDate, optText, pence, required, run, text, type ActionResult,
} from '@/lib/form';

const CATEGORIES = ['government', 'expat_contractor'];
const LEAVE_TIERS = ['standard', 'head_deputy_assistant'];
const STAFF = ['admin', 'payroll_officer'] as const;

async function readEmployee(fd: FormData) {
  const category = text(fd, 'category');
  if (!CATEGORIES.includes(category)) throw new FormError('Choose a category.');
  const leaveTier = text(fd, 'leave_tier');
  if (!LEAVE_TIERS.includes(leaveTier)) throw new FormError('Choose a leave tier.');

  const departmentId = required(fd, 'department_id', 'Department');
  const { data: dept } = await db().from('departments').select('category').eq('id', departmentId).maybeSingle();
  if (!dept) throw new FormError('That department no longer exists.');
  if (dept.category !== category) throw new FormError('The department belongs to a different category. Pick a matching one.');

  const startDate = isoDate(required(fd, 'start_date', 'Start date'), 'Start date');
  const endRaw = text(fd, 'end_date');
  const endDate = endRaw ? isoDate(endRaw, 'End date') : null;
  if (endDate && endDate < startDate) throw new FormError('End date cannot be before the start date.');

  return {
    first_name: required(fd, 'first_name', 'First name'),
    last_name: required(fd, 'last_name', 'Last name'),
    email: optText(fd, 'email'),
    job_title: optText(fd, 'job_title'),
    category,
    department_id: departmentId,
    pay_grade_id: optText(fd, 'pay_grade_id'),
    leave_tier: leaveTier,
    start_date: startDate,
    end_date: endDate,
    salary: pence(required(fd, 'salary', 'Salary'), 'Salary', { allowZero: true }),
    allowance: pence(text(fd, 'allowance') || '0', 'Allowance', { allowZero: true }),
    exempt_from_tax_community_medical: checked(fd, 'exempt'),
    active: checked(fd, 'active'),
  };
}

export async function createEmployee(fd: FormData): Promise<ActionResult> {
  let newId = '';
  const result = await run(async () => {
    await requireRole([...STAFF]);
    const employeeNo = required(fd, 'employee_no', 'Employee number');
    if (!/^[A-Za-z0-9-]{1,20}$/.test(employeeNo)) throw new FormError('Employee number can use letters, numbers and dashes only.');
    const row = { employee_no: employeeNo, ...(await readEmployee(fd)) };
    const { data, error } = await db().from('employees').insert(row).select('id').single();
    if (error) dbError(error, `Employee number ${employeeNo} is already in use.`);
    newId = data!.id;
    await logAction('employee.create', 'employee', newId, { after: row });
  });
  if (result) return result;
  revalidatePath('/employees');
  redirect(`/employees/${newId}`);
}

export async function updateEmployee(id: string, fd: FormData): Promise<ActionResult> {
  const result = await run(async () => {
    await requireRole([...STAFF]);
    const { data: before } = await db().from('employees').select('*').eq('id', id).maybeSingle();
    if (!before) throw new FormError('This employee no longer exists.');
    const after = await readEmployee(fd);
    const change = diff(before, after);
    if (change.changed) {
      const { error } = await db().from('employees').update(after).eq('id', id);
      if (error) dbError(error, 'Could not save: a value clashes with another employee.');
      await logAction('employee.update', 'employee', id, { before: change.before, after: change.after });
    }
  });
  if (result) return result;
  revalidatePath('/employees');
  revalidatePath(`/employees/${id}`);
  redirect(`/employees/${id}`);
}

export async function addDeduction(employeeId: string, fd: FormData): Promise<ActionResult> {
  const result = await run(async () => {
    await requireRole([...STAFF]);
    const typeCode = required(fd, 'type_code', 'Deduction type');
    const amount = pence(required(fd, 'amount', 'Amount'), 'Amount');
    const supabase = db();
    const { data: type } = await supabase.from('deduction_types').select('code, label').eq('code', typeCode).maybeSingle();
    if (!type) throw new FormError('Unknown deduction type.');
    const { data: existing } = await supabase
      .from('custom_deductions').select('id').eq('employee_id', employeeId).eq('type_code', typeCode).eq('active', true);
    if (existing?.length) throw new FormError(`${type.label} is already a recurring deduction. Remove it first to change the amount.`);
    const { data, error } = await supabase
      .from('custom_deductions').insert({ employee_id: employeeId, type_code: typeCode, amount }).select('id').single();
    if (error) dbError(error, 'That deduction already exists.');
    await logAction('deduction.add', 'employee', employeeId, { type: typeCode, amount, deduction_id: data!.id });
  });
  if (result) return result;
  revalidatePath(`/employees/${employeeId}`);
}

export async function removeDeduction(employeeId: string, deductionId: string): Promise<void> {
  await requireRole([...STAFF]).catch(() => { throw new Error('Your role is not allowed to do this.'); });
  const supabase = db();
  const { data: before } = await supabase.from('custom_deductions').select('type_code, amount').eq('id', deductionId).eq('employee_id', employeeId).maybeSingle();
  if (!before) return;
  const { error } = await supabase.from('custom_deductions').delete().eq('id', deductionId).eq('employee_id', employeeId);
  if (error) throw new Error(error.message);
  await logAction('deduction.remove', 'employee', employeeId, { type: before.type_code, amount: before.amount });
  revalidatePath(`/employees/${employeeId}`);
}

export async function addCredit(employeeId: string, fd: FormData): Promise<ActionResult> {
  const result = await run(async () => {
    await requireRole([...STAFF]);
    const row = {
      employee_id: employeeId,
      description: required(fd, 'description', 'Description'),
      amount: pence(required(fd, 'amount', 'Amount'), 'Amount'),
      purchase_date: isoDate(required(fd, 'purchase_date', 'Date'), 'Date'),
    };
    const { data, error } = await db().from('credit_purchases').insert(row).select('id').single();
    if (error) dbError(error, 'That purchase already exists.');
    await logAction('credit.add', 'employee', employeeId, { ...row, credit_id: data!.id });
  });
  if (result) return result;
  revalidatePath(`/employees/${employeeId}`);
}
