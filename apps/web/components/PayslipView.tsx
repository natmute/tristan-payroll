import { gbp, ukDate } from '@/lib/format';
import type { PayslipData } from '@/lib/payslip';
import { Card, Chip, Td } from './ui';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

// The payslip as shown on screen. Staff and employees see exactly the same thing, and it matches the PDF.
export function PayslipView({ p }: { p: PayslipData }) {
  const e = p.employee;
  return (
    <Card className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          {/* TODO(client): confirm the coat of arms may be used on payslips, and whether a different payslip look will be supplied. */}
          <img src="/logo.png" alt="Tristan da Cunha coat of arms" width={44} height={48} className="h-12 w-auto" />
          <div>
            <h1 className="text-lg font-semibold text-primary-900">Government of Tristan da Cunha</h1>
            <p className="text-sm text-slate-600">Payslip</p>
          </div>
        </div>
        <div className="text-right text-sm">
          <p>Pay date {ukDate(p.payDate)}</p>
          <p className="text-slate-600">Period {ukDate(p.periodStart)} to {ukDate(p.periodEnd)}</p>
        </div>
      </div>

      {p.draft && (
        <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
          <Chip tone="amber">Draft</Chip> This payroll run is not finalised. Figures may change.
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Field label="Employee">{e.name}</Field>
        <Field label="Number">{e.no}</Field>
        <Field label="Category">{p.categoryLabel}</Field>
        <Field label="Department">{e.department}</Field>
        <Field label="Grade">{e.grade}</Field>
        <Field label="Job title">{e.jobTitle}</Field>
      </dl>

      {p.partPeriod && (
        <p className="mt-3 text-sm text-amber-900"><Chip tone="amber">Part period</Chip> Paid for {p.partPeriod.daysWorked} of {p.partPeriod.daysInPeriod} days.</p>
      )}

      <table className="mt-4 w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          <tr><td colSpan={2} className="pt-2 text-xs font-semibold uppercase tracking-wide text-primary-900">Earnings</td></tr>
          {p.earnings.map((l) => <tr key={l.code}><Td>{l.label}{l.detail && <span className="block text-xs text-slate-500">{l.detail}</span>}</Td><Td right>{gbp(l.amount)}</Td></tr>)}
          <tr className="bg-slate-100 font-semibold"><Td>Total</Td><Td right>{gbp(p.total)}</Td></tr>
          <tr><td colSpan={2} className="pt-3 text-xs font-semibold uppercase tracking-wide text-primary-900">Deductions</td></tr>
          {p.deductions.map((l) => (
            <tr key={l.code}>
              <Td>{l.label}{l.detail && <span className="block text-xs text-slate-500">{l.detail}</span>}</Td>
              <Td right>{l.amount > 0 ? '-' : ''}{gbp(l.amount)}</Td>
            </tr>
          ))}
          <tr className="bg-primary-900 text-base font-semibold text-white"><Td>Net pay</Td><Td right>{gbp(p.net)}</Td></tr>
        </tbody>
      </table>

      <table className="mt-4 w-full text-sm" aria-label="Year to date">
        <caption className="pb-1 text-left text-xs font-semibold uppercase tracking-wide text-primary-900">
          Year to date, tax year {p.ytd.taxYear}{p.draft ? ' (finalised payslips plus this one)' : ''}
        </caption>
        <tbody className="divide-y divide-slate-100">
          <tr><Td>Total pay</Td><Td right>{gbp(p.ytd.totals.gross)}</Td></tr>
          <tr><Td>Income tax</Td><Td right>{gbp(p.ytd.totals.tax)}</Td></tr>
          <tr><Td>Pension (employee)</Td><Td right>{gbp(p.ytd.totals.pension)}</Td></tr>
          <tr><Td>Net pay</Td><Td right>{gbp(p.ytd.totals.net)}</Td></tr>
        </tbody>
      </table>

      <p className="mt-3 text-xs text-slate-600">Employer pension contribution (paid by the employer, not deducted from the employee): {gbp(p.employerPension)}</p>
      {p.creditCarriedForward > 0 && (
        <p className="mt-1 text-xs text-amber-900">Credit balance carried forward to the next pay: {gbp(p.creditCarriedForward)}</p>
      )}
      {p.rates.length > 0 && <p className="mt-1 text-xs text-slate-500">Rates applied: {p.rates.join(', ')}.</p>}
    </Card>
  );
}
