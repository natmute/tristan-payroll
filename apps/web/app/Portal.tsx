import Link from 'next/link';
import { leaveEntitlement, nextPayDate, type Category, type LeaveTier, type PayslipResult } from '@tristan/payroll-engine';
import { db } from '@/lib/supabase';
import { currentEmployeeId } from '@/lib/role';
import { CATEGORY_LABELS, daysBetween, gbp, ukDate } from '@/lib/format';
import { deductionOrder, loadSettings } from '@/lib/payroll';
import { displayLabel } from '@/lib/payslip';
import { EmptyState, ErrorBox, PageTitle, Td, Th } from '@/components/ui';

type Slip = {
  id: string; total_pay: number; total_deductions: number; net_pay: number; employer_pension: number; result: PayslipResult;
  pay_runs: { pay_date: string; period_start: string; period_end: string };
};

// A tile in the style of other payroll self-service homes (for example Sage): a title bar, a summary, and a link to the detail.
function Tile({ title, id, children, links }: { title: string; id: string; children: React.ReactNode; links?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <h2 id={id} className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-primary-900">{title}</h2>
      <div className="flex-1 p-4">{children}</div>
      {links && <div className="flex flex-wrap justify-end gap-4 border-t border-slate-100 px-4 py-2 text-sm">{links}</div>}
    </section>
  );
}

function Meter({ label, taken, entitled }: { label: string; taken: number; entitled: number }) {
  const left = entitled - taken;
  const used = entitled > 0 ? Math.min(100, Math.round((taken * 100) / entitled)) : 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={left < 0 ? 'font-semibold text-red-800' : ''}><strong className="tabular-nums">{left}</strong> available</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded bg-slate-200" role="img" aria-label={`${label}: ${taken} of ${entitled} days taken`}>
        <div className="h-full bg-primary-600" style={{ width: `${used}%` }} />
      </div>
      <p className="mt-0.5 text-xs text-slate-500">{taken} taken of {entitled} days</p>
    </div>
  );
}

const taxOf = (r: PayslipResult) => r.deductions.find((d) => d.code === 'tax')?.amount ?? 0;
const pensionOf = (r: PayslipResult) => r.deductions.find((d) => d.code === 'pension')?.amount ?? 0;

// The Employee portal. Everything here is filtered to the one demo employee: employees only ever see their own data.
// TODO(client): what should employees see first? Layout follows common payroll self-service homes: latest pay, time off, pension, history.
export async function Portal() {
  const me = await currentEmployeeId();
  if (!me) return <EmptyState>Pick an employee in the header, then press Show.</EmptyState>;

  const supabase = db();
  const [emp, slips, bal, cycle, settings, order] = await Promise.all([
    supabase.from('employees').select('first_name, last_name, employee_no, category, leave_tier, start_date')
      .eq('id', me).maybeSingle<{ first_name: string; last_name: string; employee_no: string; category: Category; leave_tier: LeaveTier; start_date: string }>(),
    // Only finalised payslips of this one employee.
    supabase.from('payslips').select('id, total_pay, total_deductions, net_pay, employer_pension, result, pay_runs!inner(pay_date, period_start, period_end, status)')
      .eq('employee_id', me).eq('pay_runs.status', 'finalised').returns<Slip[]>(),
    supabase.from('leave_balances').select('annual_taken, sick_taken').eq('employee_id', me).maybeSingle(),
    supabase.from('category_pay_cycles').select('category, cycle, pay_day_of_month, anchor_pay_date'),
    loadSettings(),
    deductionOrder(),
  ]);
  const error = emp.error ?? slips.error ?? bal.error ?? cycle.error;
  if (error) return <ErrorBox message={error.message} />;
  if (!emp.data) return <EmptyState>This employee could not be found. Pick another in the header.</EmptyState>;

  const e = emp.data;
  const history = (slips.data ?? []).sort((a, b) => b.pay_runs.pay_date.localeCompare(a.pay_runs.pay_date));
  const latest = history[0];
  const today = new Date().toISOString().slice(0, 10);
  const c = cycle.data?.find((x) => x.category === e.category);
  const next = c ? nextPayDate({ cycle: c.cycle, anchorPayDate: c.anchor_pay_date, payDayOfMonth: c.pay_day_of_month }, today) : null;
  const ent = leaveEntitlement(settings.leave, { tier: e.leave_tier, startDate: e.start_date }, today);

  // Deduction history: each deduction type across the last four finalised payslips.
  const recent = history.slice(0, 4);
  // Same order as the payslip, and the transfer commission is part of the Transfers line, as on the payslip.
  const keyOf = (code: string) => (code === 'transfer_commission' ? 'transfers' : code);
  const labels = new Map<string, string>();
  for (const s of recent) for (const d of s.result.deductions) {
    if (d.amount > 0 && d.code !== 'transfer_commission') labels.set(d.code, displayLabel(d.code, d.label));
  }
  const rows = [...labels].sort((x, y) => order(x[0]) - order(y[0]));

  const days = next ? daysBetween(today, next) : null;
  return (
    <div className="space-y-6">
      <PageTitle
        title={`Hello, ${e.first_name}`}
        subtitle={`${e.employee_no} · ${CATEGORY_LABELS[e.category]}. You can see only your own information.`}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Tile
          id="tile-latest" title="My Latest Payslip"
          links={latest && (
            <>
              <Link href={`/portal/payslips/${latest.id}`} className="text-primary-700 hover:underline">View payslip</Link>
              <a href={`/api/payslips/${latest.id}/pdf`} download className="text-primary-700 hover:underline">Download PDF</a>
            </>
          )}
        >
          {latest ? (
            <>
              <p className="text-xs text-slate-500">Paid {ukDate(latest.pay_runs.pay_date)}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-primary-900">{gbp(latest.net_pay)}</p>
              <p className="text-xs text-slate-500">net pay</p>
              <dl className="mt-3 space-y-0.5 text-sm">
                <div className="flex justify-between"><dt className="text-slate-600">Gross pay</dt><dd className="tabular-nums">{gbp(latest.total_pay)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-600">Deductions</dt><dd className="tabular-nums">{gbp(latest.total_deductions)}</dd></div>
              </dl>
            </>
          ) : (
            <p className="text-sm text-slate-600">No payslips yet. They appear here once a payroll run is finalised.</p>
          )}
          <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-600">
            Next pay date: <strong>{ukDate(next)}</strong>{days === null ? '' : days === 0 ? ' (today)' : days === 1 ? ' (tomorrow)' : ` (in ${days} days)`}
          </p>
        </Tile>

        <Tile id="tile-leave" title="My Time Off">
          <Meter label="Annual leave" taken={bal.data?.annual_taken ?? 0} entitled={ent.annual} />
          <Meter label="Sick leave" taken={bal.data?.sick_taken ?? 0} entitled={ent.sick} />
          <p className="mt-3 text-xs text-slate-500">Leave taken is recorded by the payroll office.</p>
        </Tile>

        <Tile id="tile-pension" title="My Pension" links={latest && <Link href={`/portal/payslips/${latest.id}`} className="text-primary-700 hover:underline">Details</Link>}>
          {latest && pensionOf(latest.result) > 0 ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-600">You pay each pay day</dt><dd className="font-semibold tabular-nums">{gbp(pensionOf(latest.result))}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-600">Your employer pays</dt><dd className="font-semibold tabular-nums">{gbp(latest.employer_pension)}</dd></div>
              <p className="text-xs text-slate-500">From your latest payslip. The employer part is not taken from your pay.</p>
            </dl>
          ) : (
            <p className="text-sm text-slate-600">No pension contribution on your latest payslip.</p>
          )}
        </Tile>
      </div>

      <Tile id="tile-history" title="My Pay History">
        {history.length === 0 ? (
          <p className="text-sm text-slate-600">No payslips yet.</p>
        ) : (
          <div className="-m-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr><Th>Pay date</Th><Th>Period</Th><Th right>Gross</Th><Th right>Tax withheld</Th><Th right>Deductions</Th><Th right>Net</Th><Th /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((s) => (
                  <tr key={s.id}>
                    <Td><Link href={`/portal/payslips/${s.id}`} className="font-medium text-primary-700 hover:underline">{ukDate(s.pay_runs.pay_date)}</Link></Td>
                    <Td>{ukDate(s.pay_runs.period_start)} to {ukDate(s.pay_runs.period_end)}</Td>
                    <Td right>{gbp(s.total_pay)}</Td><Td right>{gbp(taxOf(s.result))}</Td><Td right>{gbp(s.total_deductions)}</Td>
                    <Td right className="font-semibold">{gbp(s.net_pay)}</Td>
                    <Td right><a href={`/api/payslips/${s.id}/pdf`} download className="text-primary-700 hover:underline">Download PDF</a></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tile>

      <Tile id="tile-deductions" title="My Deductions">
        {recent.length === 0 ? (
          <p className="text-sm text-slate-600">Nothing to show yet.</p>
        ) : (
          <div className="-m-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr><Th>What was taken from your pay</Th>{recent.map((s) => <Th key={s.id} right>{ukDate(s.pay_runs.pay_date)}</Th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(([code, label]) => (
                  <tr key={code}>
                    <Td>{label}</Td>
                    {recent.map((s) => <Td key={s.id} right>{gbp(s.result.deductions.filter((d) => keyOf(d.code) === code).reduce((n, d) => n + d.amount, 0))}</Td>)}
                  </tr>
                ))}
                <tr className="bg-slate-100 font-semibold">
                  <Td>Total taken from your pay</Td>{recent.map((s) => <Td key={s.id} right>{gbp(s.total_deductions)}</Td>)}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Tile>
    </div>
  );
}
