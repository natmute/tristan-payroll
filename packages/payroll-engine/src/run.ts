// Building a payroll run: who is included, part-period pay, pre-run checks, and the comparison
// with the previous run. Pure functions only. No database, UI or network code.
import { calculatePayslip, type EmployeeInput, type OvertimeKind, type PayslipResult } from './calculate';
import type { Category, PayrollSettings } from './settings';

/** Inclusive dates, "YYYY-MM-DD". */
export interface Period {
  start: string;
  end: string;
}

export interface RunEmployee {
  id: string;
  category: Category;
  salary: number;
  allowance: number;
  exemptFromTaxCommunityMedical: boolean;
  startDate: string;
  endDate: string | null;
  customDeductions: { code: string; label: string; amount: number }[];
  /** Outstanding credit-purchase balance, in pence. */
  creditBalance: number;
  overtime?: { kind: OvertimeKind; hours: number }[];
}

/** One payslip line of a run. `input` is everything the calculation used, so it can be reproduced. */
export interface RunLine {
  employeeId: string;
  input: EmployeeInput;
  result: PayslipResult;
}

const toUtc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/**
 * Days in an inclusive range. 'working_days' counts Monday to Friday.
 * TODO(client): public holidays are not excluded from working days. Confirm.
 */
export function countDays(startIso: string, endIso: string, basis: PayrollSettings['proRataBasis']): number {
  let n = 0;
  for (let t = toUtc(startIso); t <= toUtc(endIso); t += 86_400_000) {
    const dow = new Date(t).getUTCDay();
    if (basis === 'calendar_days' || (dow >= 1 && dow <= 5)) n++;
  }
  return n;
}

/**
 * Turns employees into payslip lines for a period. Employees who started after the period ended,
 * or left before it began, are left out. Starters and leavers are paid by days worked.
 */
export function buildRun(employees: RunEmployee[], period: Period, settings: PayrollSettings): RunLine[] {
  if (period.end < period.start) throw new Error('Period end is before period start.');
  const daysInPeriod = countDays(period.start, period.end, settings.proRataBasis);
  if (daysInPeriod === 0) throw new Error('The period has no payable days.');

  const lines: RunLine[] = [];
  for (const e of employees) {
    if (e.startDate > period.end) continue;
    if (e.endDate && e.endDate < period.start) continue;

    const from = e.startDate > period.start ? e.startDate : period.start;
    const to = e.endDate && e.endDate < period.end ? e.endDate : period.end;
    const daysWorked = countDays(from, to, settings.proRataBasis);

    const input: EmployeeInput = {
      category: e.category,
      salary: e.salary,
      allowance: e.allowance,
      exemptFromTaxCommunityMedical: e.exemptFromTaxCommunityMedical,
      customDeductions: e.customDeductions.map((d) => ({ ...d })),
      creditBalance: e.creditBalance,
      overtime: e.overtime,
      proRata: daysWorked < daysInPeriod ? { daysWorked, daysInPeriod } : undefined,
    };
    lines.push({ employeeId: e.id, input, result: calculatePayslip(input, settings) });
  }
  return lines;
}

// ---- Pre-run checks ----

export interface Issue {
  code: 'no_salary' | 'negative_net' | 'part_period' | 'no_deductions' | 'credit_carried_forward' | 'net_change';
  employeeId: string;
  /** Does not include the employee's name. The screen adds it. */
  message: string;
}

export interface CheckResult {
  blocking: Issue[];
  warnings: Issue[];
}

/** Blocking errors stop approval. Warnings are shown for the approver to read. */
export function checkRun(lines: RunLine[], changes: Comparison['changes'] = []): CheckResult {
  const blocking: Issue[] = [];
  const warnings: Issue[] = [];
  for (const l of lines) {
    const id = l.employeeId;
    if (l.input.salary === 0) blocking.push({ code: 'no_salary', employeeId: id, message: 'Has no salary set.' });
    if (l.result.netPay < 0) blocking.push({ code: 'negative_net', employeeId: id, message: 'Net pay is negative: deductions are more than pay.' });
    if (l.input.proRata) {
      warnings.push({
        code: 'part_period', employeeId: id,
        message: `Part period: paid for ${l.input.proRata.daysWorked} of ${l.input.proRata.daysInPeriod} days (new starter or leaver).`,
      });
    }
    if (l.input.customDeductions.length === 0) {
      warnings.push({ code: 'no_deductions', employeeId: id, message: 'Has no recurring deductions.' });
    }
    if (l.result.creditCarriedForward > 0) {
      warnings.push({ code: 'credit_carried_forward', employeeId: id, message: 'Credit balance is more than net pay: the rest carries forward.' });
    }
  }
  for (const c of changes.filter((x) => x.flagged)) {
    warnings.push({ code: 'net_change', employeeId: c.employeeId, message: `Net pay changed a lot since the previous run: ${c.reasons.join(', ')}.` });
  }
  return { blocking, warnings };
}

// ---- Comparison with the previous run ----

export interface RunTotals {
  gross: number;
  deductions: number;
  net: number;
}

export interface Comparison {
  current: RunTotals;
  previous: RunTotals;
  changes: {
    employeeId: string;
    previousNet: number;
    currentNet: number;
    /** Change in net pay as basis points of the previous net (1000 = 10%). */
    bps: number;
    flagged: boolean;
    reasons: string[];
  }[];
  /** In this run but not the previous one. */
  added: string[];
  /** In the previous run but not this one. */
  removed: string[];
}

export function totalsOf(lines: RunLine[]): RunTotals {
  return lines.reduce(
    (t, l) => ({ gross: t.gross + l.result.totalPay, deductions: t.deductions + l.result.totalDeductions, net: t.net + l.result.netPay }),
    { gross: 0, deductions: 0, net: 0 },
  );
}

const dedKey = (l: RunLine) =>
  JSON.stringify([...l.input.customDeductions].map((d) => [d.code, d.amount]).sort());
const creditTaken = (l: RunLine) => l.result.deductions.find((d) => d.code === 'credit')?.amount ?? 0;

/** Employees whose net pay moved by more than `thresholdBps` are flagged, with the likely reasons. */
export function compareRuns(current: RunLine[], previous: RunLine[], thresholdBps: number): Comparison {
  const prev = new Map(previous.map((l) => [l.employeeId, l]));
  const cur = new Map(current.map((l) => [l.employeeId, l]));
  const changes: Comparison['changes'] = [];

  for (const c of current) {
    const p = prev.get(c.employeeId);
    if (!p || p.result.netPay === c.result.netPay) continue;
    const bps = p.result.netPay === 0 ? 10000 : Math.round(((c.result.netPay - p.result.netPay) * 10000) / p.result.netPay);

    const reasons: string[] = [];
    if (p.input.salary !== c.input.salary) reasons.push('salary changed');
    if (p.input.allowance !== c.input.allowance) reasons.push('allowance changed');
    if (dedKey(p) !== dedKey(c)) reasons.push('deductions changed');
    if (!!p.input.proRata !== !!c.input.proRata) reasons.push(c.input.proRata ? 'part period' : 'back to a full period');
    if (p.result.overtimePay !== c.result.overtimePay) reasons.push('overtime changed');
    if (creditTaken(p) !== creditTaken(c)) reasons.push('credit repayment changed');
    if (p.input.exemptFromTaxCommunityMedical !== c.input.exemptFromTaxCommunityMedical) reasons.push('exemption changed');
    if (reasons.length === 0) reasons.push('rates or settings changed');

    changes.push({
      employeeId: c.employeeId, previousNet: p.result.netPay, currentNet: c.result.netPay,
      bps, flagged: Math.abs(bps) > thresholdBps, reasons,
    });
  }

  return {
    current: totalsOf(current),
    previous: totalsOf(previous),
    changes,
    added: current.filter((l) => !prev.has(l.employeeId)).map((l) => l.employeeId),
    removed: previous.filter((l) => !cur.has(l.employeeId)).map((l) => l.employeeId),
  };
}
