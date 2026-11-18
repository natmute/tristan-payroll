import Link from 'next/link';
import { db } from '@/lib/supabase';
import { CATEGORY_LABELS, gbp, ukDate } from '@/lib/format';
import { STATUS_LABELS, STATUS_TONES, type RunStatus } from '@/lib/payroll';
import type { Category } from '@tristan/payroll-engine';
import { StaffOnly } from '@/components/StaffOnly';
import { Chip, EmptyState, ErrorBox, PageTitle, Td, Th } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; category: Category; period_start: string; period_end: string; pay_date: string; status: RunStatus;
  total_gross: number | null; total_net: number | null;
  departments: { name: string } | null; payslips: { total_pay: number; net_pay: number }[];
};

export default async function PayrollPage() {
  const { data, error } = await db().from('pay_runs')
    .select('id, category, period_start, period_end, pay_date, status, total_gross, total_net, departments(name), payslips(total_pay, net_pay)')
    .order('pay_date', { ascending: false }).returns<Row[]>();

  return (
    <StaffOnly>
      <PageTitle
        title="Payroll"
        subtitle="Each run is set up, reviewed, approved and finalised. A finalised run is locked."
        actions={
          <Link href="/payroll/new" className="rounded bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700">
            New payroll run
          </Link>
        }
      />
      {error ? (
        <ErrorBox message={error.message} />
      ) : !data?.length ? (
        <EmptyState>No payroll runs yet. <Link href="/payroll/new" className="text-primary-700 underline">Start the first one</Link>.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr><Th>Pay date</Th><Th>Category</Th><Th>Period</Th><Th right>Employees</Th><Th right>Gross</Th><Th right>Net</Th><Th>Status</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((r) => {
                // Finalised runs use the totals stored at finalisation; others are summed live.
                const gross = r.total_gross ?? r.payslips.reduce((s, p) => s + p.total_pay, 0);
                const net = r.total_net ?? r.payslips.reduce((s, p) => s + p.net_pay, 0);
                return (
                  <tr key={r.id} className="hover:bg-primary-50">
                    <Td><Link href={`/payroll/${r.id}`} className="font-medium text-primary-700 hover:underline">{ukDate(r.pay_date)}</Link></Td>
                    <Td>{CATEGORY_LABELS[r.category]}{r.departments ? `, ${r.departments.name}` : ''}</Td>
                    <Td>{ukDate(r.period_start)} to {ukDate(r.period_end)}</Td>
                    <Td right>{r.payslips.length}</Td>
                    <Td right>{gbp(gross)}</Td>
                    <Td right>{gbp(net)}</Td>
                    <Td><Chip tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Chip></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </StaffOnly>
  );
}
