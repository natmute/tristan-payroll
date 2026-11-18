import Link from 'next/link';
import { notFound } from 'next/navigation';
import { calculatePayslip, type Category, type PayrollSettings } from '@tristan/payroll-engine';
import { db } from '@/lib/supabase';
import { CATEGORY_LABELS, fullName, gbp, ukDate } from '@/lib/format';
import { StaffOnly } from '@/components/StaffOnly';
import { ActionForm } from '@/components/ActionForm';
import { SelectField, TextField } from '@/components/FormFields';
import { Card, Chip, ErrorBox, PageTitle, Td, Th } from '@/components/ui';
import { addCredit, addDeduction, removeDeduction } from '../actions';

export const dynamic = 'force-dynamic';

type Employee = {
  id: string; employee_no: string; first_name: string; last_name: string; email: string | null;
  category: Category; job_title: string | null; leave_tier: string; start_date: string; end_date: string | null;
  salary: number; allowance: number; exempt_from_tax_community_medical: boolean; active: boolean;
  departments: { name: string; code: string } | null; pay_grades: { code: string; name: string } | null;
};
type Deduction = { id: string; type_code: string; amount: number; active: boolean; deduction_types: { label: string; sort_order: number } | null };
type Credit = { id: string; purchase_date: string; description: string | null; amount: number; paid: number; settled: boolean };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{children}</dd>
    </div>
  );
}

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = db();

  const [emp, deds, credits, settingsRow, types] = await Promise.all([
    supabase.from('employees')
      .select('*, departments(name, code), pay_grades(code, name)').eq('id', id).maybeSingle<Employee>(),
    supabase.from('custom_deductions')
      .select('id, type_code, amount, active, deduction_types(label, sort_order)').eq('employee_id', id).returns<Deduction[]>(),
    supabase.from('credit_purchases')
      .select('id, purchase_date, description, amount, paid, settled').eq('employee_id', id).order('purchase_date').returns<Credit[]>(),
    supabase.from('payroll_settings').select('settings').eq('id', 1).single<{ settings: PayrollSettings }>(),
    // Transfer commission is added by the engine, so it is not offered as a manual deduction.
    supabase.from('deduction_types').select('code, label').neq('code', 'transfer_commission').order('sort_order'),
  ]);

  if (emp.error) return <ErrorBox message={emp.error.message} />;
  if (!emp.data) notFound();
  const e = emp.data;

  const deductions = (deds.data ?? [])
    .filter((d) => d.active)
    .sort((a, b) => (a.deduction_types?.sort_order ?? 0) - (b.deduction_types?.sort_order ?? 0));
  const creditBalance = (credits.data ?? []).filter((c) => !c.settled).reduce((s, c) => s + (c.amount - c.paid), 0);

  // Preview uses the live settings and a full period. Real runs add pro-rata and overtime.
  const preview = settingsRow.data
    ? calculatePayslip(
        {
          category: e.category,
          salary: e.salary,
          allowance: e.allowance,
          exemptFromTaxCommunityMedical: e.exempt_from_tax_community_medical,
          customDeductions: deductions.map((d) => ({ code: d.type_code, label: d.deduction_types?.label ?? d.type_code, amount: d.amount })),
          creditBalance,
        },
        settingsRow.data.settings,
      )
    : null;

  return (
    <StaffOnly>
      <p className="mb-2 text-sm"><Link href="/employees" className="text-primary-700 hover:underline">&larr; Employees</Link></p>
      <PageTitle
        title={fullName(e)}
        subtitle={`${e.employee_no} · ${e.job_title ?? 'No job title'}`}
        actions={
          <div className="flex items-center gap-3">
            {e.active ? <Chip tone="green">Active</Chip> : <Chip>Inactive</Chip>}
            <Link href={`/employees/${e.id}/edit`} className="rounded bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700">
              Edit
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-primary-900">Details</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Department">{e.departments ? `${e.departments.name} (${e.departments.code})` : '-'}</Field>
            <Field label="Category">{CATEGORY_LABELS[e.category]}</Field>
            <Field label="Pay grade">{e.pay_grades ? `${e.pay_grades.code} ${e.pay_grades.name}` : '-'}</Field>
            <Field label="Email">{e.email ?? <span className="text-amber-800">None: download and hand out payslip</span>}</Field>
            <Field label="Start date">{ukDate(e.start_date)}</Field>
            <Field label="End date">{ukDate(e.end_date)}</Field>
            <Field label="Leave tier">{e.leave_tier === 'standard' ? 'Standard' : 'Head, deputy or assistant'}</Field>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-primary-900">Pay</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Salary per period">{gbp(e.salary)}</Field>
            <Field label="Allowance per period">{gbp(e.allowance)}</Field>
            <Field label="Exempt from tax, community service and medical">
              {e.exempt_from_tax_community_medical ? <Chip tone="amber">Yes (pension only)</Chip> : 'No'}
            </Field>
          </dl>
          {e.exempt_from_tax_community_medical && (
            // TODO(client): what is the rule for staff who pay pension only?
            <p className="mt-3 text-xs text-slate-500">Needs client confirmation: the rule behind this exemption is not yet known.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-primary-900">Recurring deductions</h2>
          {deductions.length === 0 ? (
            <p className="text-sm text-slate-600">No recurring deductions.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr><Th>Type</Th><Th right>Amount</Th><Th /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {deductions.map((d) => (
                  <tr key={d.id}>
                    <Td>{d.deduction_types?.label ?? d.type_code}</Td>
                    <Td right>{gbp(d.amount)}</Td>
                    <Td right>
                      <form action={removeDeduction.bind(null, e.id, d.id)}>
                        <button className="text-xs text-red-700 hover:underline" aria-label={`Remove ${d.deduction_types?.label ?? d.type_code}`}>Remove</button>
                      </form>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <h3 className="mb-2 text-sm font-medium text-slate-700">Add a deduction</h3>
            <ActionForm action={addDeduction.bind(null, e.id)} submitLabel="Add" resetOnSuccess compact>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Type" name="type_code" id="deduction-type" required placeholder="Choose..."
                  options={(types.data ?? []).map((t) => ({ value: t.code, label: t.label }))}
                  hint="Transfers add the transfer commission automatically." />
                <TextField label="Amount (£)" name="amount" id="deduction-amount" required inputMode="decimal" placeholder="10.00" />
              </div>
            </ActionForm>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-primary-900">Credit purchases</h2>
          {!credits.data?.length ? (
            <p className="text-sm text-slate-600">No credit purchases.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr><Th>Date</Th><Th>Description</Th><Th right>Amount</Th><Th>Status</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {credits.data.map((c) => (
                  <tr key={c.id}>
                    <Td>{ukDate(c.purchase_date)}</Td><Td>{c.description}</Td><Td right>{gbp(c.amount)}</Td>
                    <Td>{c.settled ? <Chip>Settled</Chip> : c.paid > 0 ? <Chip tone="amber">Part paid ({gbp(c.paid)})</Chip> : <Chip tone="amber">Outstanding</Chip>}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-sm">Outstanding balance, deducted from the next salary: <strong>{gbp(creditBalance)}</strong></p>
          <div className="mt-4 border-t border-slate-100 pt-3">
            <h3 className="mb-2 text-sm font-medium text-slate-700">Record a credit purchase</h3>
            <ActionForm action={addCredit.bind(null, e.id)} submitLabel="Add" resetOnSuccess compact>
              <div className="grid grid-cols-3 gap-3">
                <TextField label="Description" name="description" required placeholder="Island store" />
                <TextField label="Amount (£)" name="amount" id="credit-amount" required inputMode="decimal" placeholder="18.00" />
                <TextField label="Date" name="purchase_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
            </ActionForm>
          </div>
        </Card>
      </div>

      {preview && (
        <Card className="mt-4">
          <h2 className="font-semibold text-primary-900">Calculation preview</h2>
          <p className="mb-3 text-xs text-slate-500">
            Full period using the current settings. Overtime and part-period pay are added in a payroll run.
          </p>
          <table className="w-full max-w-lg text-sm">
            <tbody className="divide-y divide-slate-100">
              <tr><Td>Salary</Td><Td right>{gbp(preview.salary)}</Td></tr>
              <tr><Td>Allowance</Td><Td right>{gbp(preview.allowance)}</Td></tr>
              <tr className="font-semibold"><Td>Total pay</Td><Td right>{gbp(preview.totalPay)}</Td></tr>
              {preview.deductions.map((d) => (
                <tr key={d.code}><Td className="text-slate-700">{d.label}</Td><Td right>-{gbp(d.amount)}</Td></tr>
              ))}
              <tr className="bg-primary-900 font-semibold text-white"><Td>Net pay</Td><Td right>{gbp(preview.netPay)}</Td></tr>
              <tr className="text-slate-600"><Td>Employer pension (not deducted)</Td><Td right>{gbp(preview.employerPension)}</Td></tr>
              {preview.creditCarriedForward > 0 && (
                <tr className="text-amber-900"><Td>Credit carried forward</Td><Td right>{gbp(preview.creditCarriedForward)}</Td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </StaffOnly>
  );
}
