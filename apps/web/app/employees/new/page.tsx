import { db } from '@/lib/supabase';
import { StaffOnly } from '@/components/StaffOnly';
import { Card, ErrorBox, PageTitle } from '@/components/ui';
import { EmployeeForm } from '../EmployeeForm';
import { createEmployee } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewEmployeePage() {
  const supabase = db();
  const [depts, grades] = await Promise.all([
    supabase.from('departments').select('id, name, category').order('name'),
    supabase.from('pay_grades').select('id, code, name').order('code'),
  ]);
  const error = depts.error ?? grades.error;
  return (
    <StaffOnly>
      <PageTitle title="Add employee" />
      {error ? (
        <ErrorBox message={error.message} />
      ) : (
        <Card>
          <EmployeeForm action={createEmployee} departments={depts.data ?? []} grades={grades.data ?? []} cancelHref="/employees" />
        </Card>
      )}
    </StaffOnly>
  );
}
