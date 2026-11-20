// Tax years. Pure date maths on "YYYY-MM-DD" strings.

export interface TaxYear {
  /** First day, "YYYY-MM-DD". */
  start: string;
  /** Last day, "YYYY-MM-DD". */
  end: string;
  /** For example "Dec 2025 to Nov 2026". */
  label: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** The tax year that contains `date`, for a tax year that starts on the 1st of `startMonth` (1 to 12). */
export function taxYearOf(date: string, startMonth: number): TaxYear {
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) throw new Error('Tax year start month must be 1 to 12.');
  const [y, m] = date.split('-').map(Number);
  const startYear = m >= startMonth ? y : y - 1;
  const start = `${startYear}-${pad(startMonth)}-01`;

  // The year ends on the last day of the month before the start month, one year on (or the same year if it starts in January).
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const endYear = startMonth === 1 ? startYear : startYear + 1;
  const lastDay = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
  const end = `${endYear}-${pad(endMonth)}-${pad(lastDay)}`;

  const label = startMonth === 1
    ? `${startYear}`
    : `${MONTHS[startMonth - 1]} ${startYear} to ${MONTHS[endMonth - 1]} ${endYear}`;
  return { start, end, label };
}

/** One finalised payslip's figures, for the year-to-date sum. All amounts in pence. */
export interface YtdSlip {
  gross: number;
  tax: number;
  pension: number;
  deductions: number;
  net: number;
}

export interface YearToDate extends YtdSlip {
  /** How many payslips are in the totals. */
  payslips: number;
}

export function sumYearToDate(slips: YtdSlip[]): YearToDate {
  return slips.reduce<YearToDate>(
    (t, s) => ({
      gross: t.gross + s.gross, tax: t.tax + s.tax, pension: t.pension + s.pension,
      deductions: t.deductions + s.deductions, net: t.net + s.net, payslips: t.payslips + 1,
    }),
    { gross: 0, tax: 0, pension: 0, deductions: 0, net: 0, payslips: 0 },
  );
}
