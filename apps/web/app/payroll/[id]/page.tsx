import Link from 'next/link';
import { notFound } from 'next/navigation';
import { checkRun, compareRuns, totalsOf, type Category } from '@tristan/payroll-engine';
import { currentRole } from '@/lib/role';
import { CATEGORY_LABELS, gbp, signedGbp, signedPct, ukDate } from '@/lib/format';
import {
  STATUS_LABELS, STATUS_TONES, loadPreviousRun, loadRun, loadSettings, pct, toLine, type RunStatus,
} from '@/lib/payroll';
import { StaffOnly } from '@/components/StaffOnly';
import { ActionForm } from '@/components/ActionForm';
import { CheckField, TextField } from '@/components/FormFields';
import { Card, Chip, ErrorBox, PageTitle, Td, Th } from '@/components/ui';
import { approveRun, deleteDraft, finaliseRun, recalculateRun, sendBack, submitRun } from '../actions';

export const dynamic = 'force-dynamic';

const STEPS: { label: string; done: RunStatus[]; current: RunStatus }[] = [
  { label: 'Set up', done: ['draft', 'in_review', 'approved', 'finalised'], current: 'draft' },
  { label: 'Review', done: ['in_review', 'approved', 'finalised'], current: 'draft' },
  { label: 'Approve', done: ['approved', 'finalised'], current: 'in_review' },
  { label: 'Finalise', done: ['finalised'], current: 'approved' },
];

function Steps({ status }: { status: RunStatus }) {
  return (
    <ol className="flex flex-wrap gap-2 text-sm" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = s.done.includes(status) && !(i === 1 && status === 'draft');
        const current = !done && s.current === status;
        return (
          <li key={s.label} aria-current={current ? 'step' : undefined}
            className={`rounded-full border px-3 py-1 ${done ? 'border-green-300 bg-green-50 text-green-900' : current ? 'border-primary-600 bg-primary-50 font-medium text-primary-900' : 'border-slate-200 text-slate-500'}`}>
            {i + 1}. {s.label}{done ? ' (done)' : current ? ' (now)' : ''}
          </li>
        );
      })}
    </ol>
  );
}

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  let loaded, previous, settings;
  try {
    loaded = await loadRun(id);
    if (!loaded) notFound();
    previous = await loadPreviousRun(loaded.run);
    settings = loaded.run.settings_snapshot ?? (await loadSettings());
  } catch (e) {
    return <ErrorBox message={(e as Error).message} />;
  }
  const { run, lines, names } = loaded;
  const role = await currentRole();
  const isAdmin = role === 'admin';

  const runLines = lines.map(toLine);
  const comparison = previous ? compareRuns(runLines, previous.lines.map(toLine), settings.netChangeWarningBps) : null;
  const { blocking, warnings } = checkRun(runLines, comparison?.changes ?? []);
  const totals = totalsOf(runLines);
  const who = (employeeId: string) => names.get(employeeId)?.name ?? 'Unknown employee';
  const flagged = new Set((comparison?.changes ?? []).filter((c) => c.flagged).map((c) => c.employeeId));

  const amount = (l: (typeof lines)[number], code: string) => l.result.deductions.find((d) => d.code === code)?.amount;
  const STAT = ['pension', 'disaster', 'community', 'tax', 'medical'];
  const other = (l: (typeof lines)[number]) =>
    l.result.deductions.filter((d) => !STAT.includes(d.code) && d.code !== 'credit').reduce((s, d) => s + d.amount, 0);
  const cell = (n: number | undefined) => (n === undefined ? <span className="text-slate-400">-</span> : gbp(n));

  const rules = settings.categories[run.category as Category];
  const locked = run.status === 'finalised';

  return (
    <StaffOnly>
      <p className="mb-2 text-sm"><Link href="/payroll" className="text-primary-700 hover:underline">&larr; Payroll</Link></p>
      <PageTitle
        title={`${CATEGORY_LABELS[run.category]} payroll, ${ukDate(run.pay_date)}`}
        subtitle={`Period ${ukDate(run.period_start)} to ${ukDate(run.period_end)} · ${lines.length} employees`}
        actions={<Chip tone={STATUS_TONES[run.status]}>{STATUS_LABELS[run.status]}</Chip>}
      />
      <Steps status={run.status} />

      {locked && (
        <p className="mt-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Finalised {ukDate(run.finalised_at?.slice(0, 10))} by {run.finalised_by}. This run is locked and cannot be changed.
          A mistake is fixed with a correction run, never by editing this one.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm text-slate-600">Gross pay</p><p className="mt-1 text-xl font-semibold tabular-nums text-primary-900">{gbp(run.total_gross ?? totals.gross)}</p></Card>
        <Card><p className="text-sm text-slate-600">Total deductions</p><p className="mt-1 text-xl font-semibold tabular-nums text-primary-900">{gbp(run.total_deductions ?? totals.deductions)}</p></Card>
        <Card><p className="text-sm text-slate-600">Net to pay</p><p className="mt-1 text-xl font-semibold tabular-nums text-primary-900">{gbp(run.total_net ?? totals.net)}</p></Card>
      </div>

      <section className="mt-6" aria-labelledby="checks">
        <h2 id="checks" className="mb-2 text-lg font-semibold text-primary-900">Pre-run checks</h2>
        <Card>
          {blocking.length === 0 && warnings.length === 0 ? (
            <p className="text-sm text-green-900">No issues found.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {blocking.map((i, n) => (
                <li key={`b${n}`} className="flex gap-2"><Chip tone="amber">Blocking</Chip>
                  <span><Link href={`/employees/${i.employeeId}`} className="font-medium text-primary-700 hover:underline">{who(i.employeeId)}</Link>: {i.message}</span></li>
              ))}
              {warnings.map((i, n) => (
                <li key={`w${n}`} className="flex gap-2"><Chip>Warning</Chip>
                  <span><Link href={`/employees/${i.employeeId}`} className="font-medium text-primary-700 hover:underline">{who(i.employeeId)}</Link>: {i.message}</span></li>
              ))}
            </ul>
          )}
          {blocking.length > 0 && <p className="mt-3 text-sm text-red-800">A run with blocking errors cannot be submitted or approved. Fix them, then recalculate.</p>}
        </Card>
      </section>

      <section className="mt-6" aria-labelledby="compare">
        <h2 id="compare" className="mb-2 text-lg font-semibold text-primary-900">Comparison with the previous run</h2>
        <Card>
          {!previous || !comparison ? (
            <p className="text-sm text-slate-600">There is no earlier finalised run for this category to compare with.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-600">
                Previous run: <Link href={`/payroll/${previous.run.id}`} className="text-primary-700 hover:underline">{ukDate(previous.run.pay_date)}</Link>.
                Employees are flagged when net pay moves by more than {pct(settings.netChangeWarningBps)}.
              </p>
              <table className="mb-4 w-full max-w-xl text-sm">
                <thead><tr><Th /><Th right>Previous</Th><Th right>This run</Th><Th right>Change</Th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {([['Gross', 'gross'], ['Deductions', 'deductions'], ['Net', 'net']] as const).map(([label, k]) => (
                    <tr key={k}>
                      <Td>{label}</Td><Td right>{gbp(comparison.previous[k])}</Td><Td right>{gbp(comparison.current[k])}</Td>
                      <Td right>{signedGbp(comparison.current[k] - comparison.previous[k])}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {comparison.changes.length === 0 ? (
                <p className="text-sm text-slate-600">No employee's net pay changed.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr><Th>Employee</Th><Th right>Previous net</Th><Th right>Net now</Th><Th right>Change</Th><Th>Why</Th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {comparison.changes.map((c) => (
                      <tr key={c.employeeId} className={c.flagged ? 'bg-amber-50' : ''}>
                        <Td>{who(c.employeeId)} {c.flagged && <Chip tone="amber">Check</Chip>}</Td>
                        <Td right>{gbp(c.previousNet)}</Td><Td right>{gbp(c.currentNet)}</Td>
                        <Td right>{signedPct(c.bps)}</Td><Td>{c.reasons.join(', ')}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {comparison.added.length > 0 && <p className="mt-3 text-sm">New in this run: {comparison.added.map(who).join(', ')}.</p>}
              {comparison.removed.length > 0 && <p className="mt-1 text-sm">{comparison.removed.length} employee(s) in the previous run are not in this one (left, or not yet started).</p>}
            </>
          )}
        </Card>
      </section>

      <section className="mt-6" aria-labelledby="lines">
        <h2 id="lines" className="mb-2 text-lg font-semibold text-primary-900">Payslip lines</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr><Th>No.</Th><Th>Name</Th><Th right>Total pay</Th><Th right>Pension</Th><Th right>Disaster</Th><Th right>Community</Th><Th right>Tax</Th><Th right>Medical tax</Th><Th right>Other</Th><Th right>Credit</Th><Th right>Net</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l) => (
                <tr key={l.id} className={flagged.has(l.employee_id) ? 'bg-amber-50' : 'hover:bg-primary-50'}>
                  <Td>{names.get(l.employee_id)?.no}</Td>
                  <Td>
                    <Link href={`/payroll/${run.id}/${l.id}`} className="font-medium text-primary-700 hover:underline">{who(l.employee_id)}</Link>
                    {l.inputs.proRata && <> <Chip>Part period</Chip></>}
                  </Td>
                  <Td right>{gbp(l.total_pay)}</Td>
                  {STAT.map((c) => <Td key={c} right>{cell(amount(l, c))}</Td>)}
                  <Td right>{gbp(other(l))}</Td>
                  <Td right>{cell(amount(l, 'credit'))}</Td>
                  <Td right className="font-semibold">{gbp(l.net_pay)}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-semibold">
                <Td />
                <Td>Total</Td>
                <Td right>{gbp(totals.gross)}</Td>
                {STAT.map((c) => <Td key={c} right>{gbp(lines.reduce((s, l) => s + (amount(l, c) ?? 0), 0))}</Td>)}
                <Td right>{gbp(lines.reduce((s, l) => s + other(l), 0))}</Td>
                <Td right>{gbp(lines.reduce((s, l) => s + (amount(l, 'credit') ?? 0), 0))}</Td>
                <Td right>{gbp(totals.net)}</Td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">Employer pension (not deducted from staff): {gbp(run.employer_pension ?? lines.reduce((s, l) => s + l.employer_pension, 0))}. Click a name for the full breakdown.</p>
      </section>

      <section className="mt-6" aria-labelledby="settings">
        <details className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <summary id="settings" className="cursor-pointer font-semibold text-primary-900">Settings applied to this run</summary>
          <p className="mt-2 text-xs text-slate-500">A copy of the settings is kept with the run, so later changes never alter it.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {rules.percent.map((r) => <li key={r.code}>{r.label}: {pct(r.bps)} {r.enabled ? '' : '(off)'}{r.employerBps ? `, employer ${pct(r.employerBps)}` : ''}</li>)}
            {rules.flat.map((f) => <li key={f.code}>{f.label}: {gbp(f.amount)} {f.enabled ? '' : '(off)'}</li>)}
            <li>Overtime: {pct(settings.overtime.weekdayAndSaturdayBps)} weekdays and Saturdays, {pct(settings.overtime.sundayAndHolidayBps)} Sundays and public holidays</li>
            <li>Part periods: by {settings.proRataBasis === 'calendar_days' ? 'calendar' : 'working'} days</li>
            <li>Deductions apply to overtime: {settings.deductionsApplyToOvertime ? 'yes' : 'no'}</li>
            <li>Transfer commission: {pct(settings.transferCommissionBps)}</li>
          </ul>
        </details>
      </section>

      {(run.submitted_by || run.approved_by) && (
        <p className="mt-4 text-sm text-slate-600">
          {run.submitted_by && <>Submitted by {run.submitted_by}. </>}
          {run.approved_by && <>Approved by {run.approved_by}{run.approval_note ? `: "${run.approval_note}"` : ''}.</>}
        </p>
      )}

      {!locked && (
        <section className="mt-8" aria-labelledby="actions">
          <h2 id="actions" className="mb-2 text-lg font-semibold text-primary-900">Next step</h2>
          <Card className="space-y-6">
            {run.status === 'draft' && (
              <>
                <p className="text-sm text-slate-700">Review the checks and figures above. If an employee's details changed, recalculate. Then submit for approval.</p>
                <div className="flex flex-wrap items-start gap-4">
                  <ActionForm action={submitRun.bind(null, run.id)} submitLabel="Submit for approval" compact>{null}</ActionForm>
                  <ActionForm action={recalculateRun.bind(null, run.id)} submitLabel="Recalculate" compact>{null}</ActionForm>
                  <ActionForm action={deleteDraft.bind(null, run.id)} submitLabel="Delete draft" compact>{null}</ActionForm>
                </div>
              </>
            )}

            {run.status === 'in_review' && (isAdmin ? (
              <>
                <ActionForm action={approveRun.bind(null, run.id)} submitLabel="Approve run">
                  <div className="max-w-xl"><TextField label="Note (optional)" name="note" hint="Kept with the run and in the audit log." /></div>
                </ActionForm>
                <ActionForm action={sendBack.bind(null, run.id)} submitLabel="Send back to draft" compact>
                  <div className="max-w-xl"><TextField label="Reason for sending back" name="reason" required /></div>
                </ActionForm>
              </>
            ) : (
              <p className="text-sm text-slate-700">Waiting for an Administrator to approve. A payroll officer can prepare and submit a run but cannot approve it.</p>
            ))}

            {run.status === 'approved' && (isAdmin ? (
              <>
                <p className="text-sm text-slate-700">
                  Finalising locks this run for good, deducts credit purchases and records the totals: {lines.length} employees, net to pay {gbp(totals.net)}.
                  Payslip emails are stubbed in the prototype.
                </p>
                <ActionForm action={finaliseRun.bind(null, run.id)} submitLabel="Finalise run">
                  <CheckField label="I have reviewed this run and the figures are correct" name="confirm" required />
                </ActionForm>
                <ActionForm action={sendBack.bind(null, run.id)} submitLabel="Send back to draft" compact>
                  <div className="max-w-xl"><TextField label="Reason for sending back" name="reason" required /></div>
                </ActionForm>
              </>
            ) : (
              <p className="text-sm text-slate-700">Approved. Waiting for an Administrator to finalise it.</p>
            ))}
          </Card>
        </section>
      )}
    </StaffOnly>
  );
}
