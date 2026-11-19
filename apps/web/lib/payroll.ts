import 'server-only';
import { withDefaults } from '@tristan/payroll-engine';
import type {
  Category, EmployeeInput, PayrollSettings, PayslipResult, RunEmployee, RunLine, Period,
} from '@tristan/payroll-engine';
import { db } from './supabase';
import { fetchAll } from './fetchAll';

export type RunStatus = 'draft' | 'in_review' | 'approved' | 'finalised';

export type RunRow = {
  id: string; category: Category; department_id: string | null;
  period_start: string; period_end: string; pay_date: string; status: RunStatus;
  settings_snapshot: PayrollSettings | null;
  submitted_by: string | null; submitted_at: string | null;
  approved_by: string | null; approved_at: string | null; approval_note: string | null;
  finalised_by: string | null; finalised_at: string | null;
  total_gross: number | null; total_deductions: number | null; total_net: number | null; employer_pension: number | null;
  created_at: string;
};

export type LineRow = {
  id: string; pay_run_id: string; employee_id: string;
  inputs: EmployeeInput; result: PayslipResult;
  total_pay: number; total_deductions: number; net_pay: number; employer_pension: number; credit_carried_forward: number;
};

export const STATUS_LABELS: Record<RunStatus, string> = {
  draft: 'Draft', in_review: 'In review', approved: 'Approved', finalised: 'Finalised',
};
export const STATUS_TONES: Record<RunStatus, 'grey' | 'amber' | 'blue' | 'green'> = {
  draft: 'grey', in_review: 'amber', approved: 'blue', finalised: 'green',
};

export const toLine = (l: LineRow): RunLine => ({ employeeId: l.employee_id, input: l.inputs, result: l.result });

/** The settings version in force on `forDate` (default today). Changes apply from their effective date onwards. */
export async function loadSettings(forDate: string = new Date().toISOString().slice(0, 10)): Promise<PayrollSettings> {
  const { data, error } = await db().from('settings_versions').select('settings')
    .lte('effective_from', forDate)
    .order('effective_from', { ascending: false }).order('created_at', { ascending: false })
    .limit(1).maybeSingle<{ settings: Partial<PayrollSettings> }>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('No payroll settings are in force on ' + forDate + '.');
  return withDefaults(data.settings);
}

/** Everyone who could be paid in this period, with their recurring deductions and credit balance. */
export async function loadEmployeesForRun(category: Category, departmentId: string | null, period: Period): Promise<RunEmployee[]> {
  const supabase = db();
  type E = {
    id: string; category: Category; salary: number; allowance: number; exempt_from_tax_community_medical: boolean;
    start_date: string; end_date: string | null; active: boolean;
  };
  let q = supabase.from('employees')
    .select('id, category, salary, allowance, exempt_from_tax_community_medical, start_date, end_date, active')
    .eq('category', category).lte('start_date', period.end);
  if (departmentId) q = q.eq('department_id', departmentId);
  const { data, error } = await q.returns<E[]>();
  if (error) throw new Error(error.message);
  // Active staff, plus leavers who were still employed during the period.
  const emps = (data ?? []).filter((e) => (e.active || e.end_date !== null) && (!e.end_date || e.end_date >= period.start));
  const ids = new Set(emps.map((e) => e.id));

  const [deds, credits, types] = await Promise.all([
    fetchAll<{ employee_id: string; type_code: string; amount: number }>((a, b) =>
      supabase.from('custom_deductions').select('employee_id, type_code, amount').eq('active', true).range(a, b)
        .returns<{ employee_id: string; type_code: string; amount: number }[]>()),
    fetchAll<{ employee_id: string; amount: number; paid: number }>((a, b) =>
      supabase.from('credit_purchases').select('employee_id, amount, paid').eq('settled', false).range(a, b)
        .returns<{ employee_id: string; amount: number; paid: number }[]>()),
    supabase.from('deduction_types').select('code, label, sort_order'),
  ]);
  const typeInfo = new Map((types.data ?? []).map((t) => [t.code, t]));

  return emps.map((e) => ({
    id: e.id, category: e.category, salary: e.salary, allowance: e.allowance,
    exemptFromTaxCommunityMedical: e.exempt_from_tax_community_medical,
    startDate: e.start_date, endDate: e.end_date,
    customDeductions: deds
      .filter((d) => d.employee_id === e.id)
      .sort((a, b) => (typeInfo.get(a.type_code)?.sort_order ?? 0) - (typeInfo.get(b.type_code)?.sort_order ?? 0))
      .map((d) => ({ code: d.type_code, label: typeInfo.get(d.type_code)?.label ?? d.type_code, amount: d.amount })),
    creditBalance: credits.filter((c) => c.employee_id === e.id).reduce((s, c) => s + (c.amount - c.paid), 0),
  })).filter((e) => ids.has(e.id));
}

export function lineToRow(runId: string, l: RunLine) {
  return {
    pay_run_id: runId, employee_id: l.employeeId, inputs: l.input, result: l.result,
    total_pay: l.result.totalPay, total_deductions: l.result.totalDeductions, net_pay: l.result.netPay,
    employer_pension: l.result.employerPension, credit_carried_forward: l.result.creditCarriedForward,
  };
}

export async function loadRun(id: string) {
  const supabase = db();
  const [run, lines] = await Promise.all([
    supabase.from('pay_runs').select('*').eq('id', id).maybeSingle<RunRow>(),
    supabase.from('payslips').select('*').eq('pay_run_id', id).returns<LineRow[]>(),
  ]);
  if (run.error) throw new Error(run.error.message);
  if (lines.error) throw new Error(lines.error.message);
  if (!run.data) return null;

  const ids = (lines.data ?? []).map((l) => l.employee_id);
  const { data: emps, error } = ids.length
    ? await supabase.from('employees').select('id, employee_no, first_name, last_name').in('id', ids)
    : { data: [], error: null };
  if (error) throw new Error(error.message);
  const names = new Map((emps ?? []).map((e) => [e.id, { no: e.employee_no, name: `${e.first_name} ${e.last_name}` }]));
  const rows = (lines.data ?? []).sort((a, b) => (names.get(a.employee_id)?.no ?? '').localeCompare(names.get(b.employee_id)?.no ?? ''));
  return { run: run.data, lines: rows, names };
}

/** The latest finalised run before this one, for the same category and department. */
export async function loadPreviousRun(run: RunRow) {
  let q = db().from('pay_runs').select('*').eq('category', run.category).eq('status', 'finalised').lt('pay_date', run.pay_date);
  q = run.department_id ? q.eq('department_id', run.department_id) : q.is('department_id', null);
  const { data, error } = await q.order('pay_date', { ascending: false }).limit(1).returns<RunRow[]>();
  if (error) throw new Error(error.message);
  if (!data?.length) return null;
  const { data: lines, error: e2 } = await db().from('payslips').select('*').eq('pay_run_id', data[0].id).returns<LineRow[]>();
  if (e2) throw new Error(e2.message);
  return { run: data[0], lines: lines ?? [] };
}

// Payslip line order follows the client's current paper format (see CLAUDE.md).
const STATUTORY_ORDER = ['pension', 'disaster', 'community', 'tax', 'medical', 'cdf', 'heating_gas'];

export async function deductionOrder(): Promise<(code: string) => number> {
  const { data } = await db().from('deduction_types').select('code, sort_order');
  const custom = new Map((data ?? []).map((t) => [t.code, t.sort_order as number]));
  return (code) => {
    const s = STATUTORY_ORDER.indexOf(code);
    if (s >= 0) return s;
    if (code === 'credit') return 10_000; // always last
    return 100 + (custom.get(code) ?? 9_000);
  };
}

/** 750 -> "7.5%", 1300 -> "13%". Integer maths. */
export function pct(bps: number): string {
  const whole = Math.floor(bps / 100);
  const frac = bps % 100;
  return frac === 0 ? `${whole}%` : `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}%`;
}
