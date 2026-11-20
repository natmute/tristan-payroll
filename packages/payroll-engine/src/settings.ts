export type Category = 'government' | 'expat_contractor';

/** A percentage-of-total-pay line (rate in basis points). */
export interface PercentRule {
  code: string;
  label: string;
  bps: number;
  enabled: boolean;
  /** Skipped for employees flagged exemptFromTaxCommunityMedical. */
  exemptable: boolean;
  /** Employer matching rate in bps (pension only). Not deducted from the employee. */
  employerBps?: number;
}

/** A flat amount per pay period (pence). */
export interface FlatRule {
  code: string;
  label: string;
  amount: number;
  enabled: boolean;
  exemptable: boolean;
}

export interface CategoryRules {
  percent: PercentRule[];
  flat: FlatRule[];
  /** Standard hours in one pay period; used for the overtime hourly rate. */
  standardHoursPerPeriod: number;
}

export interface PayrollSettings {
  categories: Record<Category, CategoryRules>;
  overtime: {
    weekdayAndSaturdayBps: number; // 15000 = 1.5x
    sundayAndHolidayBps: number; // 20000 = 2x
  };
  /** TODO(client): calendar days or working days for starters/leavers? */
  proRataBasis: 'calendar_days' | 'working_days';
  /**
   * TODO(client): do tax, pension, community service and medical apply to overtime pay?
   * Questionnaire says 13% "on all earnings"; the sample sheet only shows salary + allowance.
   */
  deductionsApplyToOvertime: boolean;
  /**
   * TODO(client): is the 3% transfer commission a fixed rule? Seen in the sample sheet.
   * Added as its own line after a "transfers" custom deduction. 0 = no commission.
   */
  transferCommissionBps: number;
  /**
   * A payroll run flags employees whose net pay moved by more than this, compared with the previous run.
   * 1000 = 10%. TODO(client): confirm the threshold the CFO wants.
   */
  netChangeWarningBps: number;
  /** Leave entitlements, in days. */
  leave: LeaveSettings;
  /**
   * Payslips list every deduction line, even at 0.00, as the client's current paper payslip does.
   * Off: only lines that apply to the employee are shown (statutory lines always are).
   * Presentation only. It never changes an amount.
   * TODO(client): confirm they want every line on the PDF payslips that are emailed.
   */
  payslipShowAllLines: boolean;
}

export interface LeaveSettings {
  annualDays: number;
  /** Annual days once someone has served `longServiceYears` full years. */
  annualDaysLongService: number;
  longServiceYears: number;
  /** Heads of department, deputies and assistants. */
  annualDaysSenior: number;
  sickDays: number;
}

// All of these are editable on the Settings page; none are hard-coded elsewhere.
export const defaultSettings: PayrollSettings = {
  categories: {
    government: {
      // TODO(client): 4 weeks x 40 hours assumed for the overtime hourly rate. Confirm.
      standardHoursPerPeriod: 160,
      percent: [
        { code: 'tax', label: 'Income tax', bps: 1300, enabled: true, exemptable: true },
        { code: 'pension', label: 'Employee pension', bps: 750, enabled: true, exemptable: false, employerBps: 750 },
        { code: 'community', label: 'Community service', bps: 300, enabled: true, exemptable: true },
        { code: 'medical', label: 'Medical', bps: 400, enabled: true, exemptable: true },
      ],
      flat: [
        // TODO(client): does the disaster fund apply to employees exempt from tax/community/medical?
        { code: 'disaster', label: 'Disaster fund', amount: 200, enabled: true, exemptable: true },
      ],
    },
    expat_contractor: {
      // TODO(client): monthly hours assumed 4.33 weeks x 40. Confirm.
      standardHoursPerPeriod: 173,
      percent: [
        // TODO(client): do expats/contractors pay pension? Unknown, so disabled by default.
        { code: 'pension', label: 'Employee pension', bps: 750, enabled: false, exemptable: false, employerBps: 750 },
      ],
      flat: [
        { code: 'cdf', label: 'Community Development Fee', amount: 1250, enabled: true, exemptable: false },
        { code: 'heating_gas', label: 'Heating gas', amount: 2000, enabled: true, exemptable: false },
      ],
    },
  },
  overtime: { weekdayAndSaturdayBps: 15000, sundayAndHolidayBps: 20000 },
  proRataBasis: 'calendar_days',
  deductionsApplyToOvertime: true,
  transferCommissionBps: 300,
  netChangeWarningBps: 1000,
  // TODO(client): which dates define the leave year, and are half days allowed? Entitlements are from the client's rules.
  leave: { annualDays: 15, annualDaysLongService: 21, longServiceYears: 5, annualDaysSenior: 25, sickDays: 25 },
  payslipShowAllLines: true,
};

/** Older saved settings may lack newer fields. Fill the gaps from the defaults. */
export function withDefaults(saved: Partial<PayrollSettings>): PayrollSettings {
  return { ...defaultSettings, ...saved, leave: { ...defaultSettings.leave, ...(saved.leave ?? {}) } };
}
