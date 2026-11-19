import type { Category, PayrollSettings } from '@tristan/payroll-engine';
import { formatPounds } from '@tristan/payroll-engine';
import { CATEGORY_LABELS } from '@/lib/format';
import { pct } from '@/lib/payroll';
import { Card, Chip } from '@/components/ui';

// Inputs are named like pct__government__tax so the save action can read every one back.
const box = 'w-24 rounded border border-slate-300 bg-white px-2 py-1 text-right text-sm tabular-nums';
const rate = (bps: number) => pct(bps).replace('%', '');
const mult = (bps: number) => rate(bps / 100); // 15000 -> "1.5"

function Confirm({ children = 'Needs client confirmation' }: { children?: string }) {
  return <Chip tone="amber">{children}</Chip>;
}

function Check({ name, label, on }: { name: string; label: string; on: boolean }) {
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={on} className="h-4 w-4 rounded border-slate-300" />
      <span>{label}</span>
    </label>
  );
}

function Num({ name, label, value, suffix, prefix, wide }: { name: string; label: string; value: string; suffix?: string; prefix?: string; wide?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      {prefix}
      <input name={name} aria-label={label} defaultValue={value} inputMode="decimal" className={wide ? box.replace('w-24', 'w-28') : box} />
      {suffix}
    </span>
  );
}

function CategoryCard({ cat, s }: { cat: Category; s: PayrollSettings }) {
  const rules = s.categories[cat];
  return (
    <Card>
      <h3 className="mb-1 text-base font-semibold text-primary-900">{CATEGORY_LABELS[cat]}</h3>
      {cat === 'government' ? (
        <p className="mb-3 text-xs text-slate-500">Tax is flat and not cumulative: each pay period stands alone. No bands, tax codes or allowances.</p>
      ) : (
        <p className="mb-3 text-xs text-slate-500">No tax and no medical. Fixed fees apply each period.</p>
      )}
      <div className="space-y-3">
        {rules.percent.map((p) => (
          <div key={p.code} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 pb-3">
            <span className="w-44 text-sm font-medium">{p.code === 'medical' ? 'Medical tax' : p.label}</span>
            <Num name={`pct__${cat}__${p.code}`} label={`${p.label} rate`} value={rate(p.bps)} suffix="%" />
            {p.employerBps !== undefined && (
              <span className="text-sm text-slate-600">Employer <Num name={`employer__${cat}__${p.code}`} label={`Employer ${p.label} rate`} value={rate(p.employerBps)} suffix="%" /></span>
            )}
            <Check name={`on__${cat}__${p.code}`} label="On" on={p.enabled} />
            <Check name={`exempt__${cat}__${p.code}`} label="Not charged to exempt employees" on={p.exemptable} />
            {cat === 'expat_contractor' && p.code === 'pension' && <Confirm />}
          </div>
        ))}
        {rules.flat.map((f) => (
          <div key={f.code} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 pb-3">
            <span className="w-44 text-sm font-medium">{f.label}</span>
            <Num name={`flat__${cat}__${f.code}`} label={`${f.label} amount`} value={formatPounds(f.amount)} prefix="£" />
            <Check name={`flaton__${cat}__${f.code}`} label="On" on={f.enabled} />
            <Check name={`flatexempt__${cat}__${f.code}`} label="Not charged to exempt employees" on={f.exemptable} />
            {f.code === 'disaster' && <Confirm />}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="w-44 text-sm font-medium">Standard hours per period</span>
          <Num name={`hours__${cat}`} label="Standard hours per period" value={String(rules.standardHoursPerPeriod)} />
          <span className="text-xs text-slate-500">Used for the overtime hourly rate.</span>
          <Confirm />
        </div>
      </div>
    </Card>
  );
}

export function SettingsFields({ s }: { s: PayrollSettings }) {
  return (
    <div className="space-y-4">
      <CategoryCard cat="government" s={s} />
      <CategoryCard cat="expat_contractor" s={s} />

      <Card>
        <h3 className="mb-3 text-base font-semibold text-primary-900">Overtime</h3>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span>Weekdays and Saturdays <Num name="ot_weekday" label="Overtime multiplier weekdays and Saturdays" value={mult(s.overtime.weekdayAndSaturdayBps)} suffix="x" /></span>
          <span>Sundays and public holidays <Num name="ot_sunday" label="Overtime multiplier Sundays and public holidays" value={mult(s.overtime.sundayAndHolidayBps)} suffix="x" /></span>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold text-primary-900">Pay rules</h3>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="proRataBasis" className="w-72">Part periods (starters and leavers) are counted by</label>
            <select id="proRataBasis" name="proRataBasis" defaultValue={s.proRataBasis} className="rounded border border-slate-300 bg-white px-2 py-1">
              <option value="calendar_days">Calendar days</option>
              <option value="working_days">Working days (Monday to Friday)</option>
            </select>
            <Confirm />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Check name="deductionsApplyToOvertime" label="Tax, pension, community service and medical also apply to overtime pay" on={s.deductionsApplyToOvertime} />
            <Confirm />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-72">Transfer commission</span>
            <Num name="transferCommission" label="Transfer commission" value={rate(s.transferCommissionBps)} suffix="%" />
            <Confirm />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-72">Flag net pay changes bigger than</span>
            <Num name="netChangeWarning" label="Net pay change warning" value={rate(s.netChangeWarningBps)} suffix="%" />
            <span className="text-xs text-slate-500">compared with the previous run</span>
            <Confirm />
          </div>
          <p className="text-xs text-slate-500">Rounding is to the nearest penny, half up. Credit larger than net pay is capped and the rest carries forward.</p>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold text-primary-900">Leave</h3>
        <div className="space-y-2 text-sm">
          <div>Annual leave <Num name="leave_annual" label="Annual leave days" value={String(s.leave.annualDays)} suffix="days" /></div>
          <div>After <Num name="leave_years" label="Years of service for the longer leave" value={String(s.leave.longServiceYears)} suffix="years" /> of service <Num name="leave_long" label="Annual leave days after long service" value={String(s.leave.annualDaysLongService)} suffix="days" /></div>
          <div>Heads of department, deputies and assistants <Num name="leave_senior" label="Annual leave days for heads, deputies and assistants" value={String(s.leave.annualDaysSenior)} suffix="days" /></div>
          <div>Sick leave <Num name="leave_sick" label="Sick leave days" value={String(s.leave.sickDays)} suffix="days" /> <Confirm>Leave year not yet confirmed</Confirm></div>
        </div>
      </Card>
    </div>
  );
}
