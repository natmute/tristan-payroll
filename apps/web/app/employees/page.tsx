import Link from 'next/link';
import { db } from '@/lib/supabase';
import { CATEGORY_LABELS, fullName, gbp } from '@/lib/format';
import type { Category } from '@tristan/payroll-engine';
import { StaffOnly } from '@/components/StaffOnly';
import { Card, Chip, EmptyState, ErrorBox, PageTitle, Td, Th } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; employee_no: string; first_name: string; last_name: string; category: Category;
  salary: number; allowance: number; active: boolean; end_date: string | null;
  departments: { name: string } | null; pay_grades: { code: string } | null;
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; dept?: string; grade?: string; status?: string }>;
}) {
  const { q = '', category = '', dept = '', grade = '', status = '' } = await searchParams;
  const supabase = db();

  let query = supabase
    .from('employees')
    .select('id, employee_no, first_name, last_name, category, salary, allowance, active, end_date, departments(name), pay_grades(code)')
    .order('employee_no');
  // Strip characters that have a meaning inside a PostgREST filter string.
  const term = q.replace(/[,()%*]/g, ' ').trim();
  if (term) query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,employee_no.ilike.%${term}%`);
  if (category) query = query.eq('category', category);
  if (dept) query = query.eq('department_id', dept);
  if (grade) query = query.eq('pay_grade_id', grade);
  if (status === 'active') query = query.eq('active', true);
  if (status === 'inactive') query = query.eq('active', false);

  const [{ data, error }, { data: depts }, { data: grades }] = await Promise.all([
    query.returns<Row[]>(),
    supabase.from('departments').select('id, name').order('name'),
    supabase.from('pay_grades').select('id, code').order('code'),
  ]);

  const field = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';
  return (
    <StaffOnly>
      <PageTitle
        title="Employees"
        subtitle={data ? `${data.length} shown` : undefined}
        actions={
          <Link href="/employees/new" className="rounded bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700">
            Add employee
          </Link>
        }
      />
      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-3" role="search">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Search</span>
            <input name="q" defaultValue={q} placeholder="Name or number" className={field} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Category</span>
            <select name="category" defaultValue={category} className={field}>
              <option value="">All</option>
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Department</span>
            <select name="dept" defaultValue={dept} className={field}>
              <option value="">All</option>
              {depts?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Grade</span>
            <select name="grade" defaultValue={grade} className={field}>
              <option value="">All</option>
              {grades?.map((g) => <option key={g.id} value={g.id}>{g.code}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Status</span>
            <select name="status" defaultValue={status} className={field}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <button className="rounded bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700">Filter</button>
          <Link href="/employees" className="px-2 py-1.5 text-sm text-primary-700 hover:underline">Clear</Link>
        </form>
      </Card>

      {error ? (
        <ErrorBox message={error.message} />
      ) : !data?.length ? (
        <EmptyState>No employees match these filters. <Link href="/employees" className="text-primary-700 underline">Clear filters</Link></EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr><Th>No.</Th><Th>Name</Th><Th>Department</Th><Th>Category</Th><Th>Grade</Th><Th right>Salary</Th><Th right>Allowance</Th><Th>Status</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((e) => (
                <tr key={e.id} className="hover:bg-primary-50">
                  <Td>{e.employee_no}</Td>
                  <Td><Link href={`/employees/${e.id}`} className="font-medium text-primary-700 hover:underline">{fullName(e)}</Link></Td>
                  <Td>{e.departments?.name ?? '-'}</Td>
                  <Td>{CATEGORY_LABELS[e.category]}</Td>
                  <Td>{e.pay_grades?.code ?? '-'}</Td>
                  <Td right>{gbp(e.salary)}</Td>
                  <Td right>{gbp(e.allowance)}</Td>
                  <Td>{e.active ? <Chip tone="green">Active</Chip> : <Chip>Inactive</Chip>}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StaffOnly>
  );
}
