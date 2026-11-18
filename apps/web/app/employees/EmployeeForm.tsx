import { formatPounds } from '@tristan/payroll-engine';
import { ActionForm } from '@/components/ActionForm';
import { CheckField, SelectField, TextField } from '@/components/FormFields';
import { CATEGORY_LABELS } from '@/lib/format';
import type { ActionResult } from '@/lib/form';

export type EmployeeValues = {
  employee_no: string; first_name: string; last_name: string; email: string | null; job_title: string | null;
  category: string; department_id: string; pay_grade_id: string | null; leave_tier: string;
  start_date: string; end_date: string | null; salary: number; allowance: number;
  exempt_from_tax_community_medical: boolean; active: boolean;
};

export function EmployeeForm({
  action, initial, departments, grades, cancelHref,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  initial?: EmployeeValues;
  departments: { id: string; name: string; category: string }[];
  grades: { id: string; code: string; name: string }[];
  cancelHref: string;
}) {
  const isNew = !initial;
  return (
    <ActionForm action={action} submitLabel={isNew ? 'Add employee' : 'Save changes'} cancelHref={cancelHref}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Employee number" name="employee_no" defaultValue={initial?.employee_no} required readOnly={!isNew}
          hint={isNew ? 'Letters, numbers and dashes. Cannot be changed later.' : 'Cannot be changed.'} />
        <div />
        <TextField label="First name" name="first_name" defaultValue={initial?.first_name} required />
        <TextField label="Last name" name="last_name" defaultValue={initial?.last_name} required />
        <TextField label="Email" name="email" type="email" defaultValue={initial?.email}
          hint="Optional. Without one, the payslip PDF is downloaded and handed out." />
        <TextField label="Job title" name="job_title" defaultValue={initial?.job_title} />
        <SelectField label="Category" name="category" required defaultValue={initial?.category ?? 'government'}
          options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
        <SelectField label="Department" name="department_id" required defaultValue={initial?.department_id} placeholder="Choose..."
          hint="Must belong to the chosen category."
          options={departments.map((d) => ({ value: d.id, label: `${d.name} (${CATEGORY_LABELS[d.category as keyof typeof CATEGORY_LABELS]})` }))} />
        <SelectField label="Pay grade" name="pay_grade_id" defaultValue={initial?.pay_grade_id} placeholder="None"
          options={grades.map((g) => ({ value: g.id, label: `${g.code} ${g.name}` }))} />
        <SelectField label="Leave tier" name="leave_tier" required defaultValue={initial?.leave_tier ?? 'standard'}
          hint="Heads of department, deputies and assistants get 25 days."
          options={[{ value: 'standard', label: 'Standard' }, { value: 'head_deputy_assistant', label: 'Head, deputy or assistant' }]} />
        <TextField label="Start date" name="start_date" type="date" defaultValue={initial?.start_date} required />
        <TextField label="End date" name="end_date" type="date" defaultValue={initial?.end_date}
          hint="Leavers only. Pay is by days worked." />
        <TextField label="Salary per period (£)" name="salary" inputMode="decimal" required
          defaultValue={initial ? formatPounds(initial.salary) : ''} placeholder="271.86" />
        <TextField label="Allowance per period (£)" name="allowance" inputMode="decimal"
          defaultValue={initial ? formatPounds(initial.allowance) : '0.00'} placeholder="49.74" />
      </div>
      <div className="mt-4 space-y-3">
        <CheckField label="Exempt from tax, community service and medical (pays pension only)" name="exempt"
          defaultChecked={initial?.exempt_from_tax_community_medical}
          hint="Needs client confirmation: the rule behind this exemption is not yet known." />
        <CheckField label="Active" name="active" defaultChecked={initial?.active ?? true} />
      </div>
    </ActionForm>
  );
}
