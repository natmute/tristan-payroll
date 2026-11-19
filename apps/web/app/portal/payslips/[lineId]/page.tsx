import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildPayslip } from '@/lib/payslip';
import { currentEmployeeId, currentRole } from '@/lib/role';
import { PayslipView } from '@/components/PayslipView';
import { PrintButton } from '@/components/PrintButton';
import { EmptyState, ErrorBox } from '@/components/ui';

export const dynamic = 'force-dynamic';

// An employee's own payslip. Another employee's payslip, or one from a run that is not finalised, is a 404.
export default async function PortalPayslip({ params }: { params: Promise<{ lineId: string }> }) {
  const { lineId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(lineId)) notFound();
  if ((await currentRole()) !== 'employee') {
    return <EmptyState>This page is the employee portal. Switch to the Employee role to view it, or open payslips from the Payroll screen.</EmptyState>;
  }
  const me = await currentEmployeeId();

  let p;
  try {
    p = await buildPayslip(lineId);
  } catch (e) {
    return <ErrorBox message={(e as Error).message} />;
  }
  if (!p || !me || p.employeeId !== me || p.draft) notFound();

  return (
    <>
      <p className="no-print mb-2 text-sm"><Link href="/" className="text-primary-700 hover:underline">&larr; My portal</Link></p>
      <PayslipView p={p} />
      <div className="no-print mx-auto mt-4 flex max-w-2xl flex-wrap items-center gap-3">
        <a href={`/api/payslips/${p.lineId}/pdf`} download className="rounded bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700">
          Download PDF
        </a>
        <PrintButton />
      </div>
    </>
  );
}
