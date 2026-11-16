import { describe, it, expect } from 'vitest';
import { calculatePayslip, defaultSettings, type EmployeeInput } from '../src';

// Real figures from the client's sample sheet. All amounts in pence.
// Rule: each line = round-half-up(total pay x rate), calculated separately.
const p = (pounds: string) => Math.round(parseFloat(pounds) * 100);

const base: Omit<EmployeeInput, 'salary' | 'allowance'> = {
  category: 'government',
  exemptFromTaxCommunityMedical: false,
  customDeductions: [],
  creditBalance: 0,
};

const cases = [
  { salary: '271.86', allowance: '49.74', pension: '24.12', community: '9.65', tax: '41.81', medical: '12.86' },
  { salary: '843.18', allowance: '49.74', pension: '66.97', community: '26.79', tax: '116.08', medical: '35.72' },
  { salary: '454.02', allowance: '49.74', pension: '37.78', community: '15.11', tax: '65.49', medical: '20.15' },
  { salary: '547.58', allowance: '49.74', pension: '44.80', community: '17.92', tax: '77.65', medical: '23.89' },
  { salary: '249.78', allowance: '49.74', pension: '22.46', community: '8.99', tax: '38.94', medical: '11.98' },
];

const line = (r: ReturnType<typeof calculatePayslip>, code: string) =>
  r.deductions.find((d) => d.code === code)?.amount;

describe('client sample sheet fixtures', () => {
  for (const c of cases) {
    it(`${c.salary} + ${c.allowance}`, () => {
      const r = calculatePayslip(
        { ...base, salary: p(c.salary), allowance: p(c.allowance) },
        defaultSettings,
      );
      expect(r.totalPay).toBe(p(c.salary) + p(c.allowance));
      expect(line(r, 'pension')).toBe(p(c.pension));
      expect(line(r, 'community')).toBe(p(c.community));
      expect(line(r, 'tax')).toBe(p(c.tax));
      expect(line(r, 'medical')).toBe(p(c.medical));
      expect(line(r, 'disaster')).toBe(200);
    });
  }

  it('333.96 + 0: pension only (exempt flag; rule unknown, TODO)', () => {
    const r = calculatePayslip(
      { ...base, salary: p('333.96'), allowance: 0, exemptFromTaxCommunityMedical: true },
      defaultSettings,
    );
    expect(line(r, 'pension')).toBe(p('25.05'));
    expect(line(r, 'tax')).toBeUndefined();
    expect(line(r, 'community')).toBeUndefined();
    expect(line(r, 'medical')).toBeUndefined();
  });
});
