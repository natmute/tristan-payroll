import Link from 'next/link';
import {
  calculatePayslip, nextPayDate, type Category, type PayrollSettings,
} from '@tristan/payroll-engine';
import { db } from '@/lib/supabase';
import { fetchAll } from '@/lib/fetchAll';
import { isStaff } from '@/lib/role';
import { CATEGORY_LABELS, CYCLE_LABELS, gbp, ukDate } from '@/lib/format';
import { Card, Chip, EmptyState, ErrorBox, PageTitle, Td, Th } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Emp = {
  id: string; category: Category; department_id: string; pay_grade_id: string | null; email: string | null;
  salary: number; allowance: number; exempt_from_tax_community_medical: boolean;
};
type Ded = { employee_id: string; type_code: string; amount: number };
type Credit = { employee_id: string; amount: number };
type Cycle = { category: Category; cycle: 'four_weekly' | 'monthly'; pay_day_of_month: number | null; anchor_pay_date: string | null };
type Run = { id: string; category: Category; period_start: string; period_end: string; pay_date: string; status: string };

function Kpi({ label, value, note, projected }: { label: string; value: string; note?: string; projected?: boolean }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-600">{label}</p>
        {projected && <Chip tone="blue">Projected</Chip>}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-primary-900">{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </Card>
  );
}

export default async function Dashboard() {
  // Employees only ever see their own data. Their portal is built separately.
  if (!(await isStaff())) {
    return (
      <>
        <PageTitle title="My portal" />
        <EmptyState>Your payslips, leave balances and deductions will appear here. The employee portal is not built yet.</EmptyState>
      </>
    );
  }

  const supabase = db();
  let emps: Emp[], deds: Ded[], credits: Credit[];
  try {
    [emps, deds, credits] = await Promise.all([
      fetchAll<Emp>((a, b) => supabase.from('employees')
        .select('id, category, department_id, pay_grade_id, email, salary, allowance, exempt_from_tax_community_medical')
        .eq('active', true).range(a, b).returns<Emp[]>()),
      fetchAll<Ded>((a, b) => supabase.from('custom_deductions')
        .select('employee_id, type_code, amount').eq('active', true).range(a, b).returns<Ded[]>()),
      fetchAll<Credit>((a, b) => supabase.from('credit_purchases')
        .select('employee_id, amount').eq('settled', false).range(a, b).returns<Credit[]>()),
    ]);
  } catch (e) {
    return <ErrorBox message={(e as Error).message} />;
  }

  const [settingsRow, types, cycles, depts, runs] = await Promise.all([
    supabase.from('payroll_settings').select('settings').eq('id', 1).single<{ settings: PayrollSettings }>(),
    supabase.from('deduction_types').select('code, label'),
    supabase.from('category_pay_cycles').select('category, cycle, pay_day_of_month, anchor_pay_date').returns<Cycle[]>(),
    supabase.from('departments').select('id, name, category').order('name'),
    supabase.from('pay_runs').select('id, category, period_start, period_end, pay_date, status')
      .order('pay_date', { ascending: false }).limit(5).returns<Run[]>(),
  ]);
  const failed = settingsRow.error ?? types.error ?? cycles.error ?? depts.error ?? runs.error;
  if (failed || !settingsRow.data) return <ErrorBox message={failed?.message ?? 'Payroll settings are missing.'} />;

  const settings = settingsRow.data.settings;
  const labels = new Map((types.data ?? []).map((t) => [t.code, t.label]));
  const dedsBy = new Map<string, Ded[]>();
  for (const d of deds) dedsBy.set(d.employee_id, [...(dedsBy.get(d.employee_id) ?? []), d]);
  const creditBy = new Map<string, number>();
  for (const c of credits) creditBy.set(c.employee_id, (creditBy.get(c.employee_id) ?? 0) + c.amount);

  // Projection: one full pay period per employee, using today's salaries and settings.
  const totals: Record<Category, { employees: number; gross: number; deductions: number; net: number; tax: number }> = {
    government: { employees: 0, gross: 0, deductions: 0, net: 0, tax: 0 },
    expat_contractor: { employees: 0, gross: 0, deductions: 0, net: 0, tax: 0 },
  };
  let carriedForward = 0;
  for (const e of emps) {
    const r = calculatePayslip(
      {
        category: e.category, salary: e.salary, allowance: e.allowance,
        exemptFromTaxCommunityMedical: e.exempt_from_tax_community_medical,
        customDeductions: (dedsBy.get(e.id) ?? []).map((d) => ({ code: d.type_code, label: labels.get(d.type_code) ?? d.type_code, amount: d.amount })),
        creditBalance: creditBy.get(e.id) ?? 0,
      },
      settings,
    );
    const t = totals[e.category];
    t.employees += 1; t.gross += r.totalPay; t.deductions += r.totalDeductions; t.net += r.netPay;
    t.tax += r.deductions.find((d) => d.code === 'tax')?.amount ?? 0;
    if (r.creditCarriedForward > 0) carriedForward += 1;
  }
  const sum = (k: 'employees' | 'gross' | 'deductions' | 'net' | 'tax') => totals.government[k] + totals.expat_contractor[k];

  // TODO(client): what counts as "needs attention" for the CFO? These are sensible defaults.
  const today = new Date().toISOString().slice(0, 10);
  const noEmail = emps.filter((e) => !e.email).length;
  const noGrade = emps.filter((e) => !e.pay_grade_id).length;
  const noSalary = emps.filter((e) => e.salary === 0).length;
  const withCredit = creditBy.size;
  const awaitingApproval = (runs.data ?? []).filter((r) => r.status === 'in_review' || r.status === 'draft').length;
  const pending: { text: string; href: string }[] = [];
  if (awaitingApproval) pending.push({ text: `${awaitingApproval} payroll run(s) not yet approved`, href: '#runs' });
  if (noSalary) pending.push({ text: `${noSalary} employee(s) with no salary set`, href: '/employees' });
  if (noGrade) pending.push({ text: `${noGrade} employee(s) with no pay grade`, href: '/employees?grade=none' });
  if (noEmail) pending.push({ text: `${noEmail} employee(s) with no email: payslips must be downloaded and handed out`, href: '/employees?email=none' });
  if (withCredit) pending.push({ text: `${withCredit} employee(s) with an outstanding credit balance`, href: '/employees' });
  if (carriedForward) pending.push({ text: `${carriedForward} employee(s) whose credit balance exceeds net pay and carries forward`, href: '/employees' });

  const cycleOf = (c: Category) => cycles.data?.find((x) => x.category === c);
  const nextPay = (c: Category) => {
    const cy = cycleOf(c);
    return cy ? nextPayDate({ cycle: cy.cycle, anchorPayDate: cy.anchor_pay_date, payDayOfMonth: cy.pay_day_of_month }, today) : null;
  };
  const headcount = new Map<string, number>();
  for (const e of emps) headcount.set(e.department_id, (headcount.get(e.department_id) ?? 0) + 1);

  return (
    <div className="space-y-8">
      <PageTitle title="Dashboard" subtitle={`Today is ${ukDate(today)}`} />

      <section aria-labelledby="kpis">
        <h2 id="kpis" className="sr-only">Key figures</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi label="Employees" value={String(sum('employees'))} note="Active" />
          <Kpi label="Gross payroll" value={gbp(sum('gross'))} projected />
          <Kpi label="Total deductions" value={gbp(sum('deductions'))} projected />
          <Kpi label="Net payroll" value={gbp(sum('net'))} projected />
          <Kpi label="Tax collected" value={gbp(sum('tax'))} projected />
          <Kpi label="Pending actions" value={String(pending.length)} note={pending.length ? 'See the list below' : 'Nothing needs attention'} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Projected figures cover one full pay period per category, from current salaries, deductions and settings.
          They become actual figures once a payroll run is finalised.
        </p>
      </section>

      <section aria-labelledby="pending">
        <h2 id="pending" className="mb-3 text-lg font-semibold text-primary-900">Pending actions</h2>
        {pending.length === 0 ? (
          <EmptyState>Nothing needs attention right now.</EmptyState>
        ) : (
          <Card>
            <ul className="divide-y divide-slate-100">
              {pending.map((p) => (
                <li key={p.text} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{p.text}</span>
                  <Link href={p.href} className="shrink-0 text-primary-700 hover:underline">Review</Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section aria-labelledby="categories">
        <h2 id="categories" className="mb-3 text-lg font-semibold text-primary-900">By category</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr><Th>Category</Th><Th>Pay cycle</Th><Th>Next pay date</Th><Th right>Employees</Th><Th right>Gross</Th><Th right>Deductions</Th><Th right>Net</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                <tr key={c}>
                  <Td className="font-medium">{CATEGORY_LABELS[c]}</Td>
                  <Td>{cycleOf(c) ? CYCLE_LABELS[cycleOf(c)!.cycle] : '-'}</Td>
                  <Td>{ukDate(nextPay(c))}</Td>
                  <Td right>{totals[c].employees}</Td>
                  <Td right>{gbp(totals[c].gross)}</Td>
                  <Td right>{gbp(totals[c].deductions)}</Td>
                  <Td right>{gbp(totals[c].net)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="runs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="runs" className="text-lg font-semibold text-primary-900">Recent payroll runs</h2>
          {/* The payroll run flow is the next thing to be built. */}
          <span aria-disabled="true" title="Payroll runs are not built yet"
            className="cursor-not-allowed rounded bg-slate-200 px-4 py-1.5 text-sm font-medium text-slate-500">
            New payroll run (coming next)
          </span>
        </div>
        {!runs.data?.length ? (
          <EmptyState>No payroll runs yet. Finalised runs will be listed here.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead><tr><Th>Period</Th><Th>Category</Th><Th>Pay date</Th><Th>Status</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {runs.data.map((r) => (
                  <tr key={r.id}>
                    <Td>{ukDate(r.period_start)} to {ukDate(r.period_end)}</Td>
                    <Td>{CATEGORY_LABELS[r.category]}</Td>
                    <Td>{ukDate(r.pay_date)}</Td>
                    <Td><Chip tone={r.status === 'approved' ? 'green' : r.status === 'draft' ? 'grey' : 'amber'}>{r.status}</Chip></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="depts">
        <h2 id="depts" className="mb-3 text-lg font-semibold text-primary-900">Departments</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {depts.data?.map((d) => (
            <Card key={d.id}>
              <p className="font-medium">{d.name}</p>
              <p className="text-xs text-slate-500">{CATEGORY_LABELS[d.category as Category]}</p>
              <p className="mt-2 text-sm"><strong className="tabular-nums">{headcount.get(d.id) ?? 0}</strong> employees</p>
              <p className="text-sm text-slate-600">Next pay date {ukDate(nextPay(d.category as Category))}</p>
              <Link href={`/employees?dept=${d.id}`} className="mt-2 inline-block text-sm text-primary-700 hover:underline">View employees</Link>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
