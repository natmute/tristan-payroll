import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase';
import { StaffOnly } from '@/components/StaffOnly';
import { AdminOnly } from '@/components/AdminOnly';
import { Card, ErrorBox, PageTitle } from '@/components/ui';
import { GradeForm } from '../../GradeForm';
import { saveGrade } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditGradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data, error } = await db().from('pay_grades').select('code, name').eq('id', id).maybeSingle();
  if (error) return <ErrorBox message={error.message} />;
  if (!data) notFound();
  return (
    <StaffOnly>
      <AdminOnly>
        <PageTitle title={`Edit grade ${data.code}`} subtitle="Every change is recorded in the audit log." />
        <Card><GradeForm action={saveGrade.bind(null, id)} initial={data} /></Card>
      </AdminOnly>
    </StaffOnly>
  );
}
