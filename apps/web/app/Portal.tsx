import Link from 'next/link';
import { leaveEntitlement, nextPayDate, type Category, type LeaveTier, type PayslipResult } from '@tristan/payroll-engine';
import { db } from '@/lib/supabase';
import { currentEmployeeId } from '@/lib/role';
import { CATEGORY_LABELS, gbp, ukDate } from '@/lib/format';
import { loadSettings } from '@/lib/payroll';
import { displayLabel } from '@/lib/payslip';
import { Card, EmptyState, ErrorBox, PageTitle, Td, Th } from '@/components/ui';

type Slip = {
  id: string; total_pay: number; total_deductions: number; net_pay: number; result: PayslipResult;
  pay_runs: { pay_date: string; period_start: string; period_end: string };
};

// The Employee portal. Everything here is filtered to the one demo employee: employees only ever see their own data.
export async function Portal() {
  const me = await currentEmployeeId();
  if (!me) return <EmptyState>Pick an employee in the header, then press Switch.</EmptyState>;

  const supabase = db();
  const [emp, slips, bal, cycle, settings] = await Promise.all([
    supabase.from('employees').select('first_name, last_name, employee_no, category, leave_tier, start_date')
      .eq('id', me).maybeSingle<{ first_name: string; last_name: string; employee_no: string; category: Category; leave_tier: LeaveTier; start_date: string }>(),
    // Only finalised payslips of this one employee.
    supabase.from('payslips').select('id, total_pay, total_deductions, net_pay, result, pay_runs!inner(pay_date, period_start, period_end, status)')
      .eq('employee_id', me).eq('pay_runs.status', 'finalised').returns<Slip[]>(),
    supabase.from('leave_balances').select('annual_taken, sick_taken').eq('employee_id', me).maybeSingle(),
    supabase.from('category_pay_cycles').select('category, cycle, pay_day_of_month, anchor_pay_date'),
    loadSettings(),
  ]);
  const error = emp.error ?? slips.error ?? bal.error ?? cycle.error;
  if (error) return <ErrorBox message={error.message} />;
  if (!emp.data) return <EmptyState>This employee could not be found. Pick another in the header.</EmptyState>;

  const e = emp.data;
  const history = (slips.data ?? []).sort((a, b) => b.pay_runs.pay_date.localeCompare(a.pay_runs.pay_date));
  const today = new Date().toISOString().slice(0, 10);
  const c = cycle.data?.find((x) => x.category === e.category);
  const next = c ? nextPayDate({ cycle: c.cycle, anchorPayDate: c.anchor_pay_date, payDayOfMonth: c.pay_day_of_month }, today) : null;
  const ent = leaveEntitlement(settings.leave, { tier: e.leave_tier, startDate: e.start_date }, today);
  const annualTaken = bal.data?.annual_taken ?? 0;
  const sickTaken = bal.data?.sick_taken ?? 0;

  // Deduction history: each deduction type across the last four finalised payslips.
  const recent = history.slice(0, 4);
  const labels = new Map<string, string>();
  for (const s of recent) for (const d of s.result.deductions) if (d.amount > 0) labels.set(d.code, displayLabel(d.code, d.label));

  return (
    <div className="space-y-6">
      <PageTitle title={`Hello, ${e.first_name}`} subtitle={`${e.employee_no} · ${CATEGORY_LABELS[e.category]}. You can see only your own information.`} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-600">Latest net pay</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-primary-900">{history[0] ? gbp(history[0].net_pay) : '-'}</p>
          {history[0] && <p className="text-xs text-slate-500">Paid {ukDate(history[0].pay_runs.pay_date)}</p>}
        </Card>
        <Card>
          <p className="text-sm text-slate-600">Next pay date</p>
          <p className="mt-1 text-2xl font-semibold text-primary-900">{ukDate(next)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-600">Leave left</p>
          <p className="mt-1 text-sm">Annual <strong className="tabular-nums">{ent.annual - annualTaken}</strong> of {ent.annual} days</p>
          <p className="text-sm">Sick <strong className="tabular-nums">{ent.sick - sickTaken}</strong> of {ent.sick} days</p>
        </Card>
      </div>

      <section aria-labelledby="slips">
        <h2 id="slips" className="mb-3 text-lg font-semibold text-primary-900">Your payslips</h2>
        {history.length === 0 ? (
          <EmptyState>No payslips yet. They appear here once a payroll run is finalised.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead><tr><Th>Pay date</Th><Th>Period</Th><Th right>Gross</Th><Th right>Deductions</Th><Th right>Net</Th><Th /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((s) => (
                  <tr key={s.id}>
                    <Td><Link href={`/portal/payslips/${s.id}`} className="font-medium text-primary-700 hover:underline">{ukDate(s.pay_runs.pay_date)}</Link></Td>
                    <Td>{ukDate(s.pay_runs.period_start)} to {ukDate(s.pay_runs.period_end)}</Td>
                    <Td right>{gbp(s.total_pay)}</Td><Td right>{gbp(s.total_deductions)}</Td><Td right className="font-semibold">{gbp(s.net_pay)}</Td>
                    <Td right><a href={`/api/payslips/${s.id}/pdf`} download className="text-primary-700 hover:underline">Download PDF</a></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="deds">
        <h2 id="deds" className="mb-3 text-lg font-semibold text-primary-900">What was taken from your pay</h2>
        {recent.length === 0 ? (
          <EmptyState>Nothing to show yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead><tr><Th>Deduction</Th>{recent.map((s) => <Th key={s.id} right>{ukDate(s.pay_runs.pay_date)}</Th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {[...labels].map(([code, label]) => (
                  <tr key={code}>
                    <Td>{label}</Td>
                    {recent.map((s) => <Td key={s.id} right>{gbp(s.result.deductions.filter((d) => d.code === code).reduce((n, d) => n + d.amount, 0))}</Td>)}
                  </tr>
                ))}
                <tr className="bg-slate-100 font-semibold">
                  <Td>Total deductions</Td>{recent.map((s) => <Td key={s.id} right>{gbp(s.total_deductions)}</Td>)}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
