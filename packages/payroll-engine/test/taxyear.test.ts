import { describe, expect, it } from 'vitest';
import { defaultSettings, sumYearToDate, taxYearOf } from '../src';

describe('tax year (December to November)', () => {
  it('defaults to starting in December', () => expect(defaultSettings.taxYearStartMonth).toBe(12));
  it('a November pay date is the end of the tax year that began the December before', () => {
    expect(taxYearOf('2026-11-16', 12)).toEqual({ start: '2025-12-01', end: '2026-11-30', label: 'Dec 2025 to Nov 2026' });
  });
  it('the 1st of December starts a new tax year', () => {
    expect(taxYearOf('2026-12-01', 12).start).toBe('2026-12-01');
    expect(taxYearOf('2026-11-30', 12).end).toBe('2026-11-30');
    expect(taxYearOf('2026-12-14', 12)).toMatchObject({ start: '2026-12-01', end: '2027-11-30' });
  });
  it('January start gives calendar years, and a leap February is handled', () => {
    expect(taxYearOf('2026-06-15', 1)).toEqual({ start: '2026-01-01', end: '2026-12-31', label: '2026' });
    expect(taxYearOf('2027-06-15', 3)).toMatchObject({ start: '2027-03-01', end: '2028-02-29' });
  });
  it('rejects a bad month', () => expect(() => taxYearOf('2026-01-01', 13)).toThrow());
  it('adds up payslips in pence', () => {
    const t = sumYearToDate([
      { gross: 50376, tax: 6549, pension: 3778, deductions: 37261, net: 13115 },
      { gross: 50376, tax: 6549, pension: 3778, deductions: 37261, net: 13115 },
    ]);
    expect(t).toEqual({ gross: 100752, tax: 13098, pension: 7556, deductions: 74522, net: 26230, payslips: 2 });
  });
});
