import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withDefaults, type OvertimeKind } from '@tristan/payroll-engine';
import { CATEGORY_LABELS, gbp, ukDate } from '@/lib/format';
import { loadRun, loadSettings, pct } from '@/lib/payroll';
import { StaffOnly } from '@/components/StaffOnly';
import { ActionForm } from '@/components/ActionForm';
import { Card, ErrorBox, PageTitle, Td, Th } from '@/components/ui';
import { saveOvertime } from '../../actions';

export const dynamic = 'force-dynamic';

const KINDS: { kind: OvertimeKind; label: string }[] = [
  { kind: 'weekday', label: 'Weekday' },
  { kind: 'saturday', label: 'Saturday' },
  { kind: 'sunday', label: 'Sunday' },
  { kind: 'public_holiday', label: 'Public holiday' },
];

// Overtime hours for a whole run, one row per employee. Saving recalculates each payslip.
// TODO(client): overtime hours are typed in here per run. Does the client want a timesheet import, or approval of overtime?
export default async function OvertimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  let loaded, settings;
  try {
    loaded = await loadRun(id);
    if (!loaded) notFound();
    settings = loaded.run.settings_snapshot ? withDefaults(loaded.run.settings_snapshot) : await loadSettings(loaded.run.pay_date);
  } catch (e) {
    return <ErrorBox message={(e as Error).message} />;
  }
  const { run, lines, names } = loaded;
  const editable = run.status === 'draft';
  const hours = (l: (typeof lines)[number], kind: OvertimeKind) =>
    l.inputs.overtime?.filter((o) => o.kind === kind).reduce((n, o) => n + o.hours, 0) ?? 0;
  const mult = (bps: number) => pct(bps / 100).replace('%', 'x');
  const std = settings.categories[run.category].standardHoursPerPeriod;

  return (
    <StaffOnly>
      <p className="mb-2 text-sm"><Link href={`/payroll/${run.id}`} className="text-primary-700 hover:underline">&larr; Back to the run</Link></p>
      <PageTitle
        title="Overtime"
        subtitle={`${CATEGORY_LABELS[run.category]} payroll, ${ukDate(run.pay_date)}. Enter the hours each person worked in the period.`}
      />

      <Card className="mb-4 text-sm text-slate-700">
        <p>
          Weekdays and Saturdays are paid at {mult(settings.overtime.weekdayAndSaturdayBps)}, Sundays and public holidays at {mult(settings.overtime.sundayAndHolidayBps)}.
          The hourly rate is salary divided by {std} standard hours for the period. These are settings an Administrator can change.
          {settings.deductionsApplyToOvertime ? ' Tax, pension, community service and medical are also taken from overtime.' : ' Tax, pension, community service and medical are not taken from overtime.'}
        </p>
        <p className="mt-2 text-xs text-slate-500">Use whole or part hours, for example 7 or 7.5. Leave a box empty for none.</p>
      </Card>

      {!editable && (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          This run is not a draft, so overtime cannot be changed here. An Administrator can send it back to draft first.
        </p>
      )}

      <ActionForm action={saveOvertime.bind(null, run.id)} submitLabel="Save overtime and recalculate" successMessage="Overtime saved. The payslips have been recalculated." hideSubmit={!editable}>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr><Th>No.</Th><Th>Name</Th>{KINDS.map((k) => <Th key={k.kind} right>{k.label} hours</Th>)}<Th right>Overtime pay</Th><Th right>Net pay</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l) => {
                const name = names.get(l.employee_id)?.name ?? 'Unknown employee';
                return (
                  <tr key={l.id}>
                    <Td>{names.get(l.employee_id)?.no}</Td>
                    <Td>{name}</Td>
                    {KINDS.map((k) => {
                      const h = hours(l, k.kind);
                      return (
                        <Td key={k.kind} right>
                          <input
                            type="text" inputMode="decimal" name={`ot_${l.id}_${k.kind}`} id={`ot_${l.id}_${k.kind}`}
                            aria-label={`${name}: ${k.label} overtime hours`}
                            defaultValue={h > 0 ? String(h) : ''} disabled={!editable}
                            className="w-20 rounded border border-slate-300 px-2 py-1 text-right tabular-nums disabled:bg-slate-100"
                          />
                        </Td>
                      );
                    })}
                    <Td right>{l.result.overtimePay > 0 ? gbp(l.result.overtimePay) : <span className="text-slate-400">-</span>}</Td>
                    <Td right className="font-semibold">{gbp(l.net_pay)}</Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-semibold">
                <Td /><Td>Total</Td>
                {KINDS.map((k) => <Td key={k.kind} right>{lines.reduce((n, l) => n + hours(l, k.kind), 0) || '-'}</Td>)}
                <Td right>{gbp(lines.reduce((n, l) => n + l.result.overtimePay, 0))}</Td>
                <Td right>{gbp(lines.reduce((n, l) => n + l.net_pay, 0))}</Td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ActionForm>
    </StaffOnly>
  );
}
