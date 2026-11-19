import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildPayslip } from '@/lib/payslip';
import { StaffOnly } from '@/components/StaffOnly';
import { ActionForm } from '@/components/ActionForm';
import { PayslipView } from '@/components/PayslipView';
import { PrintButton } from '@/components/PrintButton';
import { ErrorBox } from '@/components/ui';
import { resendPayslip } from '../../actions';

export const dynamic = 'force-dynamic';

// The staff view of a payslip: the payslip itself, plus download, print and the stubbed resend.
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

  return (
    <StaffOnly>
      <p className="no-print mb-2 text-sm"><Link href={`/payroll/${p.runId}`} className="text-primary-700 hover:underline">&larr; Back to the run</Link></p>
      <PayslipView p={p} />

      <div className="no-print mx-auto mt-4 max-w-2xl space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <a href={`/api/payslips/${p.lineId}/pdf`} download
            className="rounded bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700">
            Download PDF
          </a>
          <PrintButton />
        </div>
        {p.employee.email ? (
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
