import Link from 'next/link';
import { db } from '@/lib/supabase';
import { StaffOnly } from '@/components/StaffOnly';
import { EmptyState, ErrorBox, PageTitle, Td, Th } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function GradesPage() {
  const supabase = db();
  const [grades, emps] = await Promise.all([
    supabase.from('pay_grades').select('id, code, name').order('code'),
    supabase.from('employees').select('pay_grade_id').eq('active', true),
  ]);
  const error = grades.error ?? emps.error;
  if (error) return <ErrorBox message={error.message} />;

  const count = new Map<string, number>();
  for (const e of emps.data ?? []) count.set(e.pay_grade_id, (count.get(e.pay_grade_id) ?? 0) + 1);

  return (
    <StaffOnly>
      <PageTitle
        title="Pay grades"
        // TODO(client): do pay grades carry fixed salary scales? Names below are placeholders.
        subtitle="Grade names are placeholders until the client confirms them. Salary scales are not modelled yet."
      />
      {!grades.data?.length ? (
        <EmptyState>No pay grades yet.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead><tr><Th>Code</Th><Th>Name</Th><Th right>Active employees</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {grades.data.map((g) => (
                <tr key={g.id}>
                  <Td>{g.code}</Td>
                  <Td>{g.name}</Td>
                  <Td right>
                    {count.get(g.id) ? (
                      <Link href={`/employees?grade=${g.id}`} className="text-primary-700 hover:underline">{count.get(g.id)}</Link>
                    ) : 0}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StaffOnly>
  );
}
