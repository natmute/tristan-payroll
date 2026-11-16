import { percentOf } from './money';
import type { Category, PayrollSettings } from './settings';

export type OvertimeKind = 'weekday' | 'saturday' | 'sunday' | 'public_holiday';

export interface EmployeeInput {
  category: Category;
  /** Salary for the full period, in pence. */
  salary: number;
  /** Fixed allowance for the full period, in pence. */
  allowance: number;
  /** TODO(client): rule unknown for why some staff pay pension only. Flag for now. */
  exemptFromTaxCommunityMedical: boolean;
  customDeductions: { code: string; label: string; amount: number }[];
  /** Outstanding credit-purchase balance, in pence. */
  creditBalance: number;
  /** Overtime hours worked. Hours may be fractional (e.g. 1.5). */
  overtime?: { kind: OvertimeKind; hours: number }[];
  /** For starters and leavers. Omit for a full period. */
  proRata?: { daysWorked: number; daysInPeriod: number };
}

export interface PayLine {
  code: string;
  label: string;
  amount: number;
}

export interface PayslipResult {
  salary: number;
  allowance: number;
  overtimePay: number;
  /** Salary + allowance + overtime, after any pro-rata. Percentage deductions apply to this. */
  totalPay: number;
  deductions: PayLine[];
  totalDeductions: number;
  netPay: number;
  employerPension: number;
  /** Credit balance not collected because net pay ran out. TODO(client): cap or negative? */
  creditCarriedForward: number;
}

export function calculatePayslip(emp: EmployeeInput, settings: PayrollSettings): PayslipResult {
  const rules = settings.categories[emp.category];

  // Starters/leavers: paid by days worked. Pro-rata applies to salary and allowance.
  // TODO(client): confirm allowance is also pro-rated, and confirm calendar vs working days.
  const scale = (amt: number) =>
    emp.proRata ? Math.floor((amt * emp.proRata.daysWorked * 2 + emp.proRata.daysInPeriod) / (emp.proRata.daysInPeriod * 2)) : amt;
  const salary = scale(emp.salary);
  const allowance = scale(emp.allowance);

  // Overtime: hourly rate from FULL-period salary, so pro-rata does not change it.
  // TODO(client): confirm overtime is taxable and hourly rate = salary / standard hours.
  let overtimePay = 0;
  for (const ot of emp.overtime ?? []) {
    const bps =
      ot.kind === 'sunday' || ot.kind === 'public_holiday'
        ? settings.overtime.sundayAndHolidayBps
        : settings.overtime.weekdayAndSaturdayBps;
    // pay = salary x hours x multiplier / standard hours, rounded once per entry
    overtimePay += percentOf(Math.round((emp.salary * ot.hours) / rules.standardHoursPerPeriod), bps);
  }

  const totalPay = salary + allowance + overtimePay;
  const deductions: PayLine[] = [];
  let employerPension = 0;

  for (const r of rules.percent) {
    if (!r.enabled || (r.exemptable && emp.exemptFromTaxCommunityMedical)) continue;
    deductions.push({ code: r.code, label: r.label, amount: percentOf(totalPay, r.bps) });
    if (r.employerBps) employerPension += percentOf(totalPay, r.employerBps);
  }
  for (const f of rules.flat) {
    if (!f.enabled || (f.exemptable && emp.exemptFromTaxCommunityMedical)) continue;
    deductions.push({ code: f.code, label: f.label, amount: f.amount });
  }
  for (const c of emp.customDeductions) deductions.push({ ...c });

  const beforeCredit = deductions.reduce((s, d) => s + d.amount, 0);
  const availableForCredit = Math.max(0, totalPay - beforeCredit);
  const creditTaken = Math.min(emp.creditBalance, availableForCredit);
  if (creditTaken > 0) deductions.push({ code: 'credit', label: 'Credit purchases', amount: creditTaken });

  const totalDeductions = beforeCredit + creditTaken;
  return {
    salary,
    allowance,
    overtimePay,
    totalPay,
    deductions,
    totalDeductions,
    netPay: totalPay - totalDeductions,
    employerPension,
    creditCarriedForward: emp.creditBalance - creditTaken,
  };
}
