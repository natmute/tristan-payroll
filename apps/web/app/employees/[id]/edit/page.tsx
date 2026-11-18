import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase';
import { fullName } from '@/lib/format';
import { StaffOnly } from '@/components/StaffOnly';
import { Card, ErrorBox, PageTitle } from '@/components/ui';
import { EmployeeForm, type EmployeeValues } from '../../EmployeeForm';
import { updateEmployee } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = db();
  const [emp, depts, grades] = await Promise.all([
    supabase.from('employees').select('*').eq('id', id).maybeSingle<EmployeeValues>(),
    supabase.from('departments').select('id, name, category').order('name'),
    supabase.from('pay_grades').select('id, code, name').order('code'),
  ]);
  const error = emp.error ?? depts.error ?? grades.error;
  if (error) return <ErrorBox message={error.message} />;
  if (!emp.data) notFound();

  return (
    <StaffOnly>
      <PageTitle title={`Edit ${fullName(emp.data)}`} subtitle={`Every change is recorded in the audit log.`} />
      <Card>
        <EmployeeForm
          action={updateEmployee.bind(null, id)}
          initial={emp.data}
          departments={depts.data ?? []}
          grades={grades.data ?? []}
          cancelHref={`/employees/${id}`}
        />
      </Card>
    </StaffOnly>
  );
}
