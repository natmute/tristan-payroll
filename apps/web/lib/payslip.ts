import 'server-only';
import type { Category, PayslipResult } from '@tristan/payroll-engine';
import { db } from './supabase';
import { CATEGORY_LABELS, gbp } from './format';
import { deductionOrder, pct, type LineRow, type RunRow } from './payroll';

// One shape feeds both the on-screen payslip and the PDF, so they can never disagree.

export type PayslipLine = {
  code: string;
  label: string;
  amount: number;
  /** Extra detail for the screen, e.g. a transfer and its commission. */
  detail?: string;
};

export type PayslipData = {
  lineId: string;
  employeeId: string;
  runId: string;
  /** True until the run is finalised. The PDF says so. */
  draft: boolean;
  runStatus: RunRow['status'];
  category: Category;
  categoryLabel: string;
  employee: { name: string; no: string; department: string; grade: string; jobTitle: string; email: string | null };
  payDate: string;
  periodStart: string;
  periodEnd: string;
  earnings: PayslipLine[];
  total: number;
  deductions: PayslipLine[];
  net: number;
  employerPension: number;
  partPeriod: { daysWorked: number; daysInPeriod: number } | null;
  creditCarriedForward: number;
  /** Rates that were applied, for the screen. */
  rates: string[];
};

// "Medical tax" is the 4% statutory deduction. The custom "Medical" column is prescriptions. Never merge them.
const STATUTORY_LABELS: Record<string, string> = {
  pension: 'Pension', disaster: 'Disaster fund', community: 'Community service', tax: 'Income tax',
  medical: 'Medical tax', cdf: 'Community Development Fee', heating_gas: 'Heating gas',
};
export const displayLabel = (code: string, label: string) => STATUTORY_LABELS[code] ?? label;

// Statutory lines are always shown (as £0.00 when they do not apply). Everything else only when it is there.
const ALWAYS_SHOWN: Record<Category, string[]> = {
  government: ['pension', 'disaster', 'community', 'tax', 'medical'],
  expat_contractor: ['cdf', 'heating_gas'],
};

export async function buildPayslip(lineId: string): Promise<PayslipData | null> {
  const supabase = db();
  const { data: line, error } = await supabase.from('payslips').select('*').eq('id', lineId).maybeSingle<LineRow>();
  if (error) throw new Error(error.message);
  if (!line) return null;

  type Emp = {
    employee_no: string; first_name: string; last_name: string; email: string | null; job_title: string | null;
    departments: { name: string } | null; pay_grades: { code: string; name: string } | null;
  };
  const [run, emp, order] = await Promise.all([
    supabase.from('pay_runs').select('*').eq('id', line.pay_run_id).single<RunRow>(),
    supabase.from('employees').select('employee_no, first_name, last_name, email, job_title, departments(name), pay_grades(code, name)')
      .eq('id', line.employee_id).single<Emp>(),
    deductionOrder(),
  ]);
  if (run.error) throw new Error(run.error.message);
  if (emp.error) throw new Error(emp.error.message);
  const r: PayslipResult = line.result;
  const category = run.data.category;

  const earnings: PayslipLine[] = [
    { code: 'salary', label: 'Salary', amount: r.salary },
    { code: 'allowance', label: 'Allowance', amount: r.allowance },
  ];
  if (r.overtimePay > 0) earnings.push({ code: 'overtime', label: 'Overtime', amount: r.overtimePay });

  // Statutory lines first (always shown), then everything the engine produced, in the client's order.
  const byCode = new Map(r.deductions.map((d) => [d.code, d]));
  const codes = [...new Set([...ALWAYS_SHOWN[category], ...r.deductions.map((d) => d.code)])]
    .sort((a, b) => order(a) - order(b));
  let deductions: PayslipLine[] = codes.map((code) => {
    const d = byCode.get(code);
    return { code, label: displayLabel(code, d?.label ?? code), amount: d?.amount ?? 0 };
  });

  // Transfers: one "Transfers" line (amount plus commission). The screen shows the split.
  const transfers = deductions.find((d) => d.code === 'transfers');
  const commission = deductions.find((d) => d.code === 'transfer_commission');
  if (transfers && commission) {
    transfers.detail = `${gbp(transfers.amount)} transferred + ${gbp(commission.amount)} commission`;
    transfers.amount += commission.amount;
    deductions = deductions.filter((d) => d.code !== 'transfer_commission');
  }

  const rules = run.data.settings_snapshot?.categories[category];
  const rates = (rules?.percent ?? []).filter((p) => p.enabled)
    .map((p) => `${displayLabel(p.code, p.label)} ${pct(p.bps)}`);

  return {
    lineId, employeeId: line.employee_id, runId: run.data.id, draft: run.data.status !== 'finalised', runStatus: run.data.status,
    category, categoryLabel: CATEGORY_LABELS[category],
    employee: {
      name: `${emp.data.first_name} ${emp.data.last_name}`, no: emp.data.employee_no,
      department: emp.data.departments?.name ?? '-', grade: emp.data.pay_grades ? `${emp.data.pay_grades.code} ${emp.data.pay_grades.name}` : '-',
      jobTitle: emp.data.job_title ?? '-', email: emp.data.email,
    },
    payDate: run.data.pay_date, periodStart: run.data.period_start, periodEnd: run.data.period_end,
    earnings, total: r.totalPay, deductions, net: r.netPay, employerPension: r.employerPension,
    partPeriod: line.inputs.proRata ?? null, creditCarriedForward: r.creditCarriedForward, rates,
  };
}
