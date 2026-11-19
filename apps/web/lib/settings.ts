import 'server-only';
import type { Category, PayrollSettings } from '@tristan/payroll-engine';
import { db } from './supabase';
import { CATEGORY_LABELS, gbp } from './format';
import { FormError, checked, pence, scaled, text, whole } from './form';
import { pct } from './payroll';

export type VersionRow = {
  id: string; effective_from: string; settings: PayrollSettings; reason: string; created_by: string; created_at: string;
};

/** Newest first: the version that takes effect last comes first. */
export async function loadVersions(): Promise<VersionRow[]> {
  const { data, error } = await db().from('settings_versions').select('*')
    .order('effective_from', { ascending: false }).order('created_at', { ascending: false }).returns<VersionRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

// The form names its inputs like pct__government__tax, so one function can read them all back.
export function applyForm(base: PayrollSettings, fd: FormData): PayrollSettings {
  const next: PayrollSettings = structuredClone(base);
  for (const cat of Object.keys(next.categories) as Category[]) {
    const rules = next.categories[cat];
    const where = CATEGORY_LABELS[cat];
    rules.standardHoursPerPeriod = whole(text(fd, `hours__${cat}`), `${where}: standard hours per period`, 1, 400);
    for (const p of rules.percent) {
      p.bps = scaled(text(fd, `pct__${cat}__${p.code}`), 100, `${where}: ${p.label} rate`, 10_000);
      p.enabled = checked(fd, `on__${cat}__${p.code}`);
      p.exemptable = checked(fd, `exempt__${cat}__${p.code}`);
      if (p.employerBps !== undefined) p.employerBps = scaled(text(fd, `employer__${cat}__${p.code}`), 100, `${where}: employer ${p.label} rate`, 10_000);
    }
    for (const f of rules.flat) {
      f.amount = pence(text(fd, `flat__${cat}__${f.code}`), `${where}: ${f.label}`, { allowZero: true });
      f.enabled = checked(fd, `flaton__${cat}__${f.code}`);
      f.exemptable = checked(fd, `flatexempt__${cat}__${f.code}`);
    }
  }
  next.overtime.weekdayAndSaturdayBps = scaled(text(fd, 'ot_weekday'), 10_000, 'Overtime multiplier (weekdays and Saturdays)', 50_000);
  next.overtime.sundayAndHolidayBps = scaled(text(fd, 'ot_sunday'), 10_000, 'Overtime multiplier (Sundays and public holidays)', 50_000);
  const basis = text(fd, 'proRataBasis');
  if (basis !== 'calendar_days' && basis !== 'working_days') throw new FormError('Choose how part periods are counted.');
  next.proRataBasis = basis;
  next.deductionsApplyToOvertime = checked(fd, 'deductionsApplyToOvertime');
  next.transferCommissionBps = scaled(text(fd, 'transferCommission'), 100, 'Transfer commission', 10_000);
  next.netChangeWarningBps = scaled(text(fd, 'netChangeWarning'), 100, 'Net pay change warning', 100_000);
  next.leave = {
    annualDays: whole(text(fd, 'leave_annual'), 'Annual leave days', 0, 366),
    annualDaysLongService: whole(text(fd, 'leave_long'), 'Annual leave days after long service', 0, 366),
    longServiceYears: whole(text(fd, 'leave_years'), 'Years of service for the longer leave', 0, 60),
    annualDaysSenior: whole(text(fd, 'leave_senior'), 'Annual leave days for heads, deputies and assistants', 0, 366),
    sickDays: whole(text(fd, 'leave_sick'), 'Sick leave days', 0, 366),
  };
  return next;
}

const onOff = (b: boolean) => (b ? 'on' : 'off');

/** Plain-English list of what changed between two versions. Used on screen and in the audit log. */
export function describeChanges(before: PayrollSettings, after: PayrollSettings): string[] {
  const out: string[] = [];
  for (const cat of Object.keys(after.categories) as Category[]) {
    const a = after.categories[cat];
    const b = before.categories[cat];
    const where = CATEGORY_LABELS[cat];
    if (a.standardHoursPerPeriod !== b.standardHoursPerPeriod) out.push(`${where}: standard hours ${b.standardHoursPerPeriod} to ${a.standardHoursPerPeriod}`);
    for (const p of a.percent) {
      const o = b.percent.find((x) => x.code === p.code);
      if (!o) continue;
      if (o.bps !== p.bps) out.push(`${where}: ${p.label} rate ${pct(o.bps)} to ${pct(p.bps)}`);
      if (o.employerBps !== p.employerBps) out.push(`${where}: employer ${p.label} rate ${pct(o.employerBps ?? 0)} to ${pct(p.employerBps ?? 0)}`);
      if (o.enabled !== p.enabled) out.push(`${where}: ${p.label} ${onOff(o.enabled)} to ${onOff(p.enabled)}`);
      if (o.exemptable !== p.exemptable) out.push(`${where}: ${p.label} ${p.exemptable ? 'no longer charged' : 'now charged'} to exempt employees`);
    }
    for (const f of a.flat) {
      const o = b.flat.find((x) => x.code === f.code);
      if (!o) continue;
      if (o.amount !== f.amount) out.push(`${where}: ${f.label} ${gbp(o.amount)} to ${gbp(f.amount)}`);
      if (o.enabled !== f.enabled) out.push(`${where}: ${f.label} ${onOff(o.enabled)} to ${onOff(f.enabled)}`);
      if (o.exemptable !== f.exemptable) out.push(`${where}: ${f.label} ${f.exemptable ? 'no longer charged' : 'now charged'} to exempt employees`);
    }
  }
  const mult = (bps: number) => `${pct(bps / 100)}`.replace('%', 'x');
  if (before.overtime.weekdayAndSaturdayBps !== after.overtime.weekdayAndSaturdayBps) out.push(`Overtime weekdays and Saturdays ${mult(before.overtime.weekdayAndSaturdayBps)} to ${mult(after.overtime.weekdayAndSaturdayBps)}`);
  if (before.overtime.sundayAndHolidayBps !== after.overtime.sundayAndHolidayBps) out.push(`Overtime Sundays and public holidays ${mult(before.overtime.sundayAndHolidayBps)} to ${mult(after.overtime.sundayAndHolidayBps)}`);
  if (before.proRataBasis !== after.proRataBasis) out.push(`Part periods counted by ${before.proRataBasis === 'calendar_days' ? 'calendar' : 'working'} days to ${after.proRataBasis === 'calendar_days' ? 'calendar' : 'working'} days`);
  if (before.deductionsApplyToOvertime !== after.deductionsApplyToOvertime) out.push(`Deductions apply to overtime: ${onOff(before.deductionsApplyToOvertime)} to ${onOff(after.deductionsApplyToOvertime)}`);
  if (before.transferCommissionBps !== after.transferCommissionBps) out.push(`Transfer commission ${pct(before.transferCommissionBps)} to ${pct(after.transferCommissionBps)}`);
  if (before.netChangeWarningBps !== after.netChangeWarningBps) out.push(`Net pay change warning ${pct(before.netChangeWarningBps)} to ${pct(after.netChangeWarningBps)}`);
  const l: [keyof PayrollSettings['leave'], string][] = [
    ['annualDays', 'Annual leave days'], ['annualDaysLongService', 'Annual leave days after long service'],
    ['longServiceYears', 'Years for the longer leave'], ['annualDaysSenior', 'Annual leave days for heads, deputies and assistants'], ['sickDays', 'Sick leave days'],
  ];
  for (const [k, label] of l) if (before.leave[k] !== after.leave[k]) out.push(`${label} ${before.leave[k]} to ${after.leave[k]}`);
  return out;
}
