import { renderToBuffer } from '@react-pdf/renderer';
import { logAction } from '@/lib/audit';
import { isStaff } from '@/lib/role';
import { buildPayslip } from '@/lib/payslip';
import { PayslipPdf } from '@/components/PayslipPdf';

export const dynamic = 'force-dynamic';

// GET /api/payslips/<line id>/pdf. Staff only for now. Employees get their own payslips through the portal later.
export async function GET(_req: Request, { params }: { params: Promise<{ lineId: string }> }) {
  const { lineId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(lineId)) return new Response('Not found', { status: 404 });
  if (!(await isStaff())) return new Response('Not available to this role', { status: 403 });

  try {
    const data = await buildPayslip(lineId);
    if (!data) return new Response('Not found', { status: 404 });
    const pdf = await renderToBuffer(<PayslipPdf data={data} />);
    await logAction('payslip.download', 'payslip', lineId, { employee_no: data.employee.no, pay_date: data.payDate, draft: data.draft });
    const filename = `payslip-${data.employee.no}-${data.payDate}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return new Response(`Could not create the payslip PDF: ${(e as Error).message}`, { status: 500 });
  }
}
