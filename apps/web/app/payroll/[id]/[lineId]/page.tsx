import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildPayslip } from '@/lib/payslip';
import { gbp, ukDate } from '@/lib/format';
import { StaffOnly } from '@/components/StaffOnly';
import { ActionForm } from '@/components/ActionForm';
import { PrintButton } from '@/components/PrintButton';
import { Card, Chip, ErrorBox, Td } from '@/components/ui';
import { resendPayslip } from '../../actions';

export const dynamic = 'force-dynamic';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

// The payslip: the same data as the PDF, in the client's line order.
export default async function PayslipPage({ params }: { params: Promise<{ id: string; lineId: string }> }) {
  const { id, lineId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(lineId)) notFound();

  let p;
  try {
    p = await buildPayslip(lineId);
  } catch (e) {
    return <ErrorBox message={(e as Error).message} />;
  }
  if (!p || p.runId !== id) notFound();
  const e = p.employee;

  return (
    <StaffOnly>
      <p className="no-print mb-2 text-sm"><Link href={`/payroll/${p.runId}`} className="text-primary-700 hover:underline">&larr; Back to the run</Link></p>

      <Card className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            {/* TODO(client): the real logo will be sent by the client. Neutral placeholder for now. */}
            <div aria-hidden="true" className="flex h-12 w-12 items-center justify-center bg-primary-900 text-sm font-semibold text-white">TDC</div>
            <div>
              <h1 className="text-lg font-semibold text-primary-900">Government of Tristan da Cunha</h1>
              <p className="text-sm text-slate-600">Payslip</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p>Pay date {ukDate(p.payDate)}</p>
            <p className="text-slate-600">Period {ukDate(p.periodStart)} to {ukDate(p.periodEnd)}</p>
          </div>
        </div>

        {p.draft && (
          <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
            <Chip tone="amber">Draft</Chip> This payroll run is not finalised. Figures may change.
          </p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Field label="Employee">{e.name}</Field>
          <Field label="Number">{e.no}</Field>
          <Field label="Category">{p.categoryLabel}</Field>
          <Field label="Department">{e.department}</Field>
          <Field label="Grade">{e.grade}</Field>
          <Field label="Job title">{e.jobTitle}</Field>
        </dl>

        {p.partPeriod && (
          <p className="mt-3 text-sm text-amber-900"><Chip tone="amber">Part period</Chip> Paid for {p.partPeriod.daysWorked} of {p.partPeriod.daysInPeriod} days.</p>
        )}

        <table className="mt-4 w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            <tr><td colSpan={2} className="pt-2 text-xs font-semibold uppercase tracking-wide text-primary-900">Earnings</td></tr>
            {p.earnings.map((l) => <tr key={l.code}><Td>{l.label}</Td><Td right>{gbp(l.amount)}</Td></tr>)}
            <tr className="bg-slate-100 font-semibold"><Td>Total</Td><Td right>{gbp(p.total)}</Td></tr>
            <tr><td colSpan={2} className="pt-3 text-xs font-semibold uppercase tracking-wide text-primary-900">Deductions</td></tr>
            {p.deductions.map((l) => (
              <tr key={l.code}>
                <Td>{l.label}{l.detail && <span className="block text-xs text-slate-500">{l.detail}</span>}</Td>
                <Td right>{l.amount > 0 ? '-' : ''}{gbp(l.amount)}</Td>
              </tr>
            ))}
            <tr className="bg-primary-900 text-base font-semibold text-white"><Td>Net pay</Td><Td right>{gbp(p.net)}</Td></tr>
          </tbody>
        </table>

        <p className="mt-3 text-xs text-slate-600">Employer pension contribution (paid by the employer, not deducted from the employee): {gbp(p.employerPension)}</p>
        {p.creditCarriedForward > 0 && (
          <p className="mt-1 text-xs text-amber-900">Credit balance carried forward to the next pay: {gbp(p.creditCarriedForward)}</p>
        )}
        {p.rates.length > 0 && <p className="mt-1 text-xs text-slate-500">Rates applied: {p.rates.join(', ')}.</p>}
      </Card>

      <div className="no-print mx-auto mt-4 max-w-2xl space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <a href={`/api/payslips/${p.lineId}/pdf`} download
            className="rounded bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700">
            Download PDF
          </a>
          <PrintButton />
        </div>
        {e.email ? (
          <ActionForm action={resendPayslip.bind(null, p.lineId)} submitLabel="Resend email (demo)" compact
            successMessage="Demo only: no email was sent. In the full build the PDF is attached to an email to the employee.">
            {null}
          </ActionForm>
        ) : (
          <p className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
            No email on file: download the PDF and hand it out.
          </p>
        )}
        {p.draft && <p className="text-xs text-slate-500">Emails can be sent once the run is finalised.</p>}
      </div>
    </StaffOnly>
  );
}
