import { StaffOnly } from '@/components/StaffOnly';
import { AdminOnly } from '@/components/AdminOnly';
import { Card, PageTitle } from '@/components/ui';
import { DepartmentForm } from '../DepartmentForm';
import { saveDepartment } from '../actions';

export default function NewDepartmentPage() {
  return (
    <StaffOnly>
      <AdminOnly>
        <PageTitle title="Add department" />
        <Card><DepartmentForm action={saveDepartment.bind(null, null)} /></Card>
      </AdminOnly>
    </StaffOnly>
  );
}
