import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase';
import { CATEGORY_LABELS, gbp, ukDate } from '@/lib/format';
import { deductionOrder, loadRun, pct, type LineRow } from '@/lib/payroll';
import { StaffOnly } from '@/components/StaffOnly';
import { Card, Chip, ErrorBox, PageTitle, Td } from '@/components/ui';

export const dynamic = 'force-dynamic';

// Full breakdown of one payslip line, in the client's payslip order, with the rates that were applied.
export default async function LinePage({ params }: { params: Promise<{ id: string; lineId: string }> }) {
  const { id, lineId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(lineId)) notFound();

  let loaded, order;
  try {
    loaded = await loadRun(id);
    order = await deductionOrder();
  } catch (e) {
    return <ErrorBox message={(e as Error).message} />;
  }
  if (!loaded) notFound();
  const line = loaded.lines.find((l: LineRow) => l.id === lineId);
  if (!line) notFound();

  const { run, names } = loaded;
  const emp = names.get(line.employee_id);
  const { data: e } = await db().from('employees').select('job_title, departments(name)').eq('id', line.employee_id).maybeSingle<{ job_title: string | null; departments: { name: string } | null }>();
  const r = line.result;
  const settings = run.settings_snapshot;
  const rules = settings?.categories[run.category];
  const deductions = [...r.deductions].sort((a, b) => order(a.code) - order(b.code));
  // Rate lines show the rate used. Fixed amounts have no rate.
  const rateOf = (code: string) => {
    const p = rules?.percent.find((x) => x.code === code);
    return p ? ` (${pct(p.bps)})` : '';
  };

  return (
    <StaffOnly>
      <p className="mb-2 text-sm"><Link href={`/payroll/${run.id}`} className="text-primary-700 hover:underline">&larr; Back to the run</Link></p>
      <PageTitle
        title={emp?.name ?? 'Employee'}
        subtitle={`${emp?.no ?? ''} · ${e?.departments?.name ?? ''} · ${CATEGORY_LABELS[run.category]} · pay date ${ukDate(run.pay_date)}`}
      />
      <Card className="max-w-xl">
        {line.inputs.proRata && (
          <p className="mb-3 text-sm text-amber-900"><Chip tone="amber">Part period</Chip> Paid for {line.inputs.proRata.daysWorked} of {line.inputs.proRata.daysInPeriod} days.</p>
        )}
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            <tr><Td>Salary</Td><Td right>{gbp(r.salary)}</Td></tr>
            <tr><Td>Allowance</Td><Td right>{gbp(r.allowance)}</Td></tr>
            {r.overtimePay > 0 && <tr><Td>Overtime</Td><Td right>{gbp(r.overtimePay)}</Td></tr>}
            <tr className="font-semibold"><Td>Total</Td><Td right>{gbp(r.totalPay)}</Td></tr>
            {deductions.map((d, i) => (
              <tr key={`${d.code}-${i}`}><Td className="text-slate-700">{d.label}{rateOf(d.code)}</Td><Td right>-{gbp(d.amount)}</Td></tr>
            ))}
            <tr className="bg-primary-900 font-semibold text-white"><Td>Net pay</Td><Td right>{gbp(r.netPay)}</Td></tr>
            <tr className="text-slate-600"><Td>Employer pension (employer contribution, not deducted)</Td><Td right>{gbp(r.employerPension)}</Td></tr>
            {r.creditCarriedForward > 0 && <tr className="text-amber-900"><Td>Credit carried forward to the next run</Td><Td right>{gbp(r.creditCarriedForward)}</Td></tr>}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate-500">Rates shown are from the settings kept with this run. The printable payslip and PDF are built next.</p>
      </Card>
    </StaffOnly>
  );
}
