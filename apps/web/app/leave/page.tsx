import Link from 'next/link';
import { leaveEntitlement, type LeaveTier } from '@tristan/payroll-engine';
import { db } from '@/lib/supabase';
import { fetchAll } from '@/lib/fetchAll';
import { isAdmin } from '@/lib/role';
import { fullName } from '@/lib/format';
import { loadSettings } from '@/lib/payroll';
import { StaffOnly } from '@/components/StaffOnly';
import { ActionForm } from '@/components/ActionForm';
import { Card, Chip, ErrorBox, PageTitle, Td, Th } from '@/components/ui';
import { setLeaveTaken } from './actions';

export const dynamic = 'force-dynamic';

type Emp = { id: string; employee_no: string; first_name: string; last_name: string; leave_tier: LeaveTier; start_date: string };
type Bal = { employee_id: string; annual_taken: number; sick_taken: number };

const num = 'w-16 rounded border border-slate-300 bg-white px-2 py-1 text-right text-sm tabular-nums';

export default async function LeavePage() {
  const supabase = db();
  let emps: Emp[], bals: Bal[], settings;
  try {
    [emps, bals, settings] = await Promise.all([
      fetchAll<Emp>((a, b) => supabase.from('employees').select('id, employee_no, first_name, last_name, leave_tier, start_date')
        .eq('active', true).order('employee_no').range(a, b).returns<Emp[]>()),
      fetchAll<Bal>((a, b) => supabase.from('leave_balances').select('employee_id, annual_taken, sick_taken').range(a, b).returns<Bal[]>()),
      loadSettings(),
    ]);
  } catch (e) {
    return <ErrorBox message={(e as Error).message} />;
  }
  const admin = await isAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const taken = new Map(bals.map((b) => [b.employee_id, b]));

  return (
    <StaffOnly>
      <PageTitle
        title="Leave"
        subtitle="Entitlements come from Settings and each person's start date. Leave taken is entered by hand. There are no requests or approvals in this version."
      />
      <Card className="mb-4 text-sm text-slate-700">
        Annual leave: {settings.leave.annualDays} days ({settings.leave.annualDaysLongService} after {settings.leave.longServiceYears} years),
        or {settings.leave.annualDaysSenior} for heads of department, deputies and assistants. Sick leave: {settings.leave.sickDays} days.{' '}
        {/* TODO(client): which dates define the leave year, and are half days allowed? */}
        <Chip tone="amber">Leave year not yet confirmed</Chip>
        {admin && <> <Link href="/settings" className="text-primary-700 hover:underline">Change entitlements</Link></>}
      </Card>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr><Th>No.</Th><Th>Name</Th><Th>Rule</Th><Th right>Annual entitled</Th><Th right>Annual taken</Th><Th right>Annual left</Th><Th right>Sick entitled</Th><Th right>Sick taken</Th><Th right>Sick left</Th>{admin && <Th />}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {emps.map((e) => {
              const ent = leaveEntitlement(settings.leave, { tier: e.leave_tier, startDate: e.start_date }, today);
              const t = taken.get(e.id) ?? { annual_taken: 0, sick_taken: 0 };
              const form = `leave-${e.id}`;
              return (
                <tr key={e.id}>
                  <Td>{e.employee_no}</Td>
                  <Td><Link href={`/employees/${e.id}`} className="text-primary-700 hover:underline">{fullName(e)}</Link></Td>
                  <Td className="text-xs text-slate-600">{e.leave_tier === 'standard' ? 'Standard' : 'Head, deputy or assistant'}</Td>
                  <Td right>{ent.annual}</Td>
                  <Td right>{admin ? <input form={form} name="annual_taken" aria-label={`Annual leave taken, ${fullName(e)}`} defaultValue={t.annual_taken} inputMode="numeric" className={num} /> : t.annual_taken}</Td>
                  <Td right className={ent.annual - t.annual_taken < 0 ? 'font-semibold text-red-800' : ''}>{ent.annual - t.annual_taken}</Td>
                  <Td right>{ent.sick}</Td>
                  <Td right>{admin ? <input form={form} name="sick_taken" aria-label={`Sick leave taken, ${fullName(e)}`} defaultValue={t.sick_taken} inputMode="numeric" className={num} /> : t.sick_taken}</Td>
                  <Td right className={ent.sick - t.sick_taken < 0 ? 'font-semibold text-red-800' : ''}>{ent.sick - t.sick_taken}</Td>
                  {admin && (
                    <Td>
                      <ActionForm action={setLeaveTaken.bind(null, e.id)} submitLabel="Save" compact id={form} />
                    </Td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </StaffOnly>
  );
}
