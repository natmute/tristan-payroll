import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase';
import { StaffOnly } from '@/components/StaffOnly';
import { AdminOnly } from '@/components/AdminOnly';
import { Card, ErrorBox, PageTitle } from '@/components/ui';
import { DepartmentForm } from '../../DepartmentForm';
import { saveDepartment } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditDepartmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data, error } = await db().from('departments').select('code, name, category').eq('id', id).maybeSingle();
  if (error) return <ErrorBox message={error.message} />;
  if (!data) notFound();
  return (
    <StaffOnly>
      <AdminOnly>
        <PageTitle title={`Edit ${data.name}`} subtitle="Every change is recorded in the audit log." />
        <Card><DepartmentForm action={saveDepartment.bind(null, id)} initial={data} /></Card>
      </AdminOnly>
    </StaffOnly>
  );
}
