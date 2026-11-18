import Link from 'next/link';
import { db } from '@/lib/supabase';
import { CATEGORY_LABELS, CYCLE_LABELS } from '@/lib/format';
import type { Category } from '@tristan/payroll-engine';
import { StaffOnly } from '@/components/StaffOnly';
import { Card, Chip, EmptyState, ErrorBox, PageTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Dept = { id: string; code: string; name: string; category: Category };
type Cycle = { category: Category; cycle: string; pay_day_of_month: number | null };

export default async function DepartmentsPage() {
  const supabase = db();
  const [depts, cycles, emps] = await Promise.all([
    supabase.from('departments').select('id, code, name, category').order('name').returns<Dept[]>(),
    supabase.from('category_pay_cycles').select('category, cycle, pay_day_of_month').returns<Cycle[]>(),
    supabase.from('employees').select('department_id').eq('active', true),
  ]);
  const error = depts.error ?? cycles.error ?? emps.error;
  if (error) return <ErrorBox message={error.message} />;

  const headcount = new Map<string, number>();
  for (const e of emps.data ?? []) headcount.set(e.department_id, (headcount.get(e.department_id) ?? 0) + 1);

  return (
    <StaffOnly>
      <PageTitle
        title="Departments"
        subtitle="Departments sit inside one of two categories. The pay cycle belongs to the category."
      />
      {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => {
        const cycle = cycles.data?.find((c) => c.category === cat);
        const list = depts.data?.filter((d) => d.category === cat) ?? [];
        return (
          <section key={cat} className="mb-8">
            <div className="mb-3 flex flex-wrap items-baseline gap-3">
              <h2 className="text-lg font-semibold text-primary-900">{CATEGORY_LABELS[cat]}</h2>
              {cycle && (
                <span className="text-sm text-slate-600">
                  {CYCLE_LABELS[cycle.cycle]}
                  {cycle.pay_day_of_month ? `, around day ${cycle.pay_day_of_month} of the month` : ''}
                </span>
              )}
            </div>
            {list.length === 0 ? (
              <EmptyState>No departments in this category yet.</EmptyState>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((d) => (
                  <Card key={d.id}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{d.name}</h3>
                      {/* TODO(client): real department codes are awaited from Paul. */}
                      <Chip tone="amber">Placeholder code</Chip>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Code {d.code}</p>
                    <p className="mt-3 text-2xl font-semibold tabular-nums text-primary-800">{headcount.get(d.id) ?? 0}</p>
                    <p className="text-xs text-slate-500">active employees</p>
                    <Link href={`/employees?dept=${d.id}`} className="mt-3 inline-block text-sm text-primary-700 hover:underline">
                      View employees
                    </Link>
                  </Card>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </StaffOnly>
  );
}
