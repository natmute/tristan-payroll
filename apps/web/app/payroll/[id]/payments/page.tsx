import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase';
import { CATEGORY_LABELS, gbp, monthYear, ukDate } from '@/lib/format';
import { loadRun } from '@/lib/payroll';
import { StaffOnly } from '@/components/StaffOnly';
import { PrintButton } from '@/components/PrintButton';
import { Card, Chip, EmptyState, ErrorBox, Td, Th } from '@/components/ui';

export const dynamic = 'force-dynamic';

// Payment summary (a list to tick off) and receipt slips (one per employee, to sign), as on the current paper process.
// TODO(client): do they want to keep signed receipt slips? The signature column and line can be switched off here.
export default async function PaymentsPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; signature?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const view = sp.view === 'receipts' ? 'receipts' : 'summary';
  const signature = sp.signature !== '0';

  let loaded;
  let depts: Map<string, string>;
  try {
    loaded = await loadRun(id);
    if (!loaded) notFound();
    const ids = loaded.lines.map((l) => l.employee_id);
    const { data, error } = ids.length
      ? await db().from('employees').select('id, departments(name)').in('id', ids).returns<{ id: string; departments: { name: string } | null }[]>()
      : { data: [], error: null };
    if (error) throw new Error(error.message);
    depts = new Map((data ?? []).map((e) => [e.id, e.departments?.name ?? '']));
  } catch (e) {
    return <ErrorBox message={(e as Error).message} />;
  }
  const { run, lines, names } = loaded;
  const totalNet = lines.reduce((n, l) => n + l.net_pay, 0);
  const field = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';

  return (
    <StaffOnly>
      <p className="no-print mb-2 text-sm"><Link href={`/payroll/${run.id}`} className="text-primary-700 hover:underline">&larr; Back to the run</Link></p>
      <h1 className="text-2xl font-semibold text-primary-900">{view === 'summary' ? 'Payment summary' : 'Receipt slips'}</h1>
      <p className="mb-4 text-sm text-slate-600">
        {CATEGORY_LABELS[run.category]}, pay date {ukDate(run.pay_date)} · {lines.length} employees · net to pay <strong>{gbp(totalNet)}</strong>
      </p>

      <Card className="no-print mb-4">
        <form className="flex flex-wrap items-end gap-3">
          <label className="text-sm"><span className="mb-1 block text-slate-600">Show</span>
            <select name="view" defaultValue={view} className={field}>
              <option value="summary">Payment summary (one list)</option>
              <option value="receipts">Receipt slips (one per employee)</option>
            </select>
          </label>
          <label className="text-sm"><span className="mb-1 block text-slate-600">Signature</span>
            <select name="signature" defaultValue={signature ? '1' : '0'} className={field}>
              <option value="1">With signature</option>
              <option value="0">Without signature</option>
            </select>
          </label>
          <button className="rounded border border-primary-600 px-4 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-50">Update</button>
          <PrintButton />
        </form>
      </Card>

      {run.status !== 'finalised' && (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
          <Chip tone="amber">Draft</Chip> This run is not finalised. Do not pay from this list yet: figures may change.
        </p>
      )}

      {lines.length === 0 ? (
        <EmptyState>This run has no employees.</EmptyState>
      ) : view === 'summary' ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead><tr><Th>No.</Th><Th>Name</Th><Th>Department</Th><Th right>Net pay</Th>{signature && <Th>Signature</Th>}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l, i) => (
                <tr key={l.id} className="break-inside-avoid">
                  <Td>{i + 1}</Td>
                  <Td>{names.get(l.employee_id)?.name}</Td>
                  <Td>{depts.get(l.employee_id)}</Td>
                  <Td right className="font-semibold">{gbp(l.net_pay)}</Td>
                  {signature && <Td className="w-64 border-b border-slate-300">&nbsp;</Td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-semibold"><Td /><Td>Total</Td><Td /><Td right>{gbp(totalNet)}</Td>{signature && <Td />}</tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {lines.map((l, i) => (
            <div key={l.id} className="break-inside-avoid border-2 border-slate-900 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span><strong>Name</strong> {names.get(l.employee_id)?.name}</span>
                <span><strong>Date</strong> {monthYear(run.pay_date)}</span>
                <strong>No.{i + 1} {depts.get(l.employee_id)}</strong>
              </div>
              <div className="mt-6 flex items-end justify-between gap-6">
                {signature ? (
                  <span className="flex flex-1 items-end gap-2"><strong>Signature</strong><span className="mb-0.5 flex-1 border-b border-slate-900" /></span>
                ) : <span className="flex-1" />}
                <span><strong>Total:</strong> <span className="tabular-nums">{gbp(l.net_pay)}</span></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </StaffOnly>
  );
}
