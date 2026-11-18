import { StaffOnly } from '@/components/StaffOnly';
import { AdminOnly } from '@/components/AdminOnly';
import { Card, PageTitle } from '@/components/ui';
import { GradeForm } from '../GradeForm';
import { saveGrade } from '../actions';

export default function NewGradePage() {
  return (
    <StaffOnly>
      <AdminOnly>
        <PageTitle title="Add pay grade" />
        <Card><GradeForm action={saveGrade.bind(null, null)} /></Card>
      </AdminOnly>
    </StaffOnly>
  );
}
