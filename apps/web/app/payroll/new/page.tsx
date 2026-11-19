import Link from 'next/link';
import { buildRun, payDatesAround, type Category, type PayCycle } from '@tristan/payroll-engine';
import { db } from '@/lib/supabase';
import { addDays, CATEGORY_LABELS, CYCLE_LABELS, ukDate } from '@/lib/format';
import { loadEmployeesForRun, loadSettings } from '@/lib/payroll';
import { StaffOnly } from '@/components/StaffOnly';
import { ActionForm } from '@/components/ActionForm';
import { SelectField, TextField } from '@/components/FormFields';
import { Card, ErrorBox, PageTitle } from '@/components/ui';
import { createRun } from '../actions';

export const dynamic = 'force-dynamic';

type CycleRow = { category: Category; cycle: 'four_weekly' | 'monthly'; pay_day_of_month: number | null; anchor_pay_date: string | null };

export default async function NewRunPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; dept?: string; pay_date?: string }>;
}) {
  const sp = await searchParams;
  const category: Category = sp.category === 'expat_contractor' ? 'expat_contractor' : 'government';
  const supabase = db();
  const [cycles, depts] = await Promise.all([
    supabase.from('category_pay_cycles').select('category, cycle, pay_day_of_month, anchor_pay_date').returns<CycleRow[]>(),
    supabase.from('departments').select('id, name').eq('category', category).order('name'),
  ]);
  const error = cycles.error ?? depts.error;
  if (error) return <ErrorBox message={error.message} />;

  const row = cycles.data?.find((c) => c.category === category);
  const cycle: PayCycle | null = row ? { cycle: row.cycle, anchorPayDate: row.anchor_pay_date, payDayOfMonth: row.pay_day_of_month } : null;
  const today = new Date().toISOString().slice(0, 10);
  const dates = cycle ? payDatesAround(cycle, today, 3, 1) : [];
  // Default to the latest pay date that has already arrived, otherwise the next one.
  const payDate = sp.pay_date && /^\d{4}-\d{2}-\d{2}$/.test(sp.pay_date)
    ? sp.pay_date
    : [...dates].reverse().find((d) => d <= today) ?? dates[0] ?? '';

  // TODO(client): how does the pay period relate to the pay date? Assumed: the period ends on the pay date
  // and starts the day after the previous pay date (28 days for four-weekly). Both dates can be edited here.
  const previous = cycle && payDate ? (payDatesAround(cycle, payDate, 1, 0)[0] ?? null) : null;
  const periodEnd = payDate;
  const periodStart = previous && previous !== payDate ? addDays(previous, 1) : payDate ? addDays(payDate, -27) : '';

  // How many people would be in this run?
  let count: number | null = null;
  let note: string | null = null;
  if (periodStart && periodEnd) {
    try {
      const employees = await loadEmployeesForRun(category, sp.dept || null, { start: periodStart, end: periodEnd });
      count = buildRun(employees, { start: periodStart, end: periodEnd }, await loadSettings(payDate)).length;
    } catch (e) {
      note = (e as Error).message;
    }
  }

  return (
    <StaffOnly>
      <p className="mb-2 text-sm"><Link href="/payroll" className="text-primary-700 hover:underline">&larr; Payroll</Link></p>
      <PageTitle title="New payroll run" subtitle="Step 1 of 4: set up. Nothing is paid until the run is approved and finalised." />

      <Card className="mb-4">
        <h2 className="mb-3 font-semibold text-primary-900">Who and when</h2>
        <form className="grid gap-4 sm:grid-cols-3" action="/payroll/new">
          <SelectField label="Category" name="category" defaultValue={category}
            options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
            hint={row ? `${CYCLE_LABELS[row.cycle]}` : undefined} />
          <SelectField label="Department" name="dept" defaultValue={sp.dept ?? ''} placeholder="All departments in this category"
            options={(depts.data ?? []).map((d) => ({ value: d.id, label: d.name }))} />
          <SelectField label="Pay date" name="pay_date" id="pay_date_pick" defaultValue={payDate}
            options={dates.map((d) => ({ value: d, label: ukDate(d) }))} />
          <div className="sm:col-span-3">
            <button className="rounded border border-primary-600 px-4 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-50">
              Update period
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold text-primary-900">Confirm and create</h2>
        <p className="mb-4 text-sm text-slate-600">
          {note ? note : count === null ? '' : `${count} employee${count === 1 ? '' : 's'} will be included.`}
          {' '}The calculation is created as a draft you can review and recalculate.
        </p>
        {!payDate ? (
          <p className="text-sm text-amber-800">This category has no pay cycle set up yet.</p>
        ) : (
          <ActionForm action={createRun} submitLabel="Create draft run" cancelHref="/payroll">
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="department_id" value={sp.dept ?? ''} />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Pay date" name="pay_date" type="date" required defaultValue={payDate} />
              <TextField label="Period start" name="period_start" type="date" required defaultValue={periodStart} />
              <TextField label="Period end" name="period_end" type="date" required defaultValue={periodEnd}
                hint="Starters and leavers inside the period are paid by days worked." />
            </div>
          </ActionForm>
        )}
      </Card>
    </StaffOnly>
  );
}
