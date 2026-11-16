import { describe, it, expect } from 'vitest';
import { calculatePayslip, defaultSettings, formatPounds, parsePounds, percentOf, type EmployeeInput, type PayrollSettings } from '../src';

const gov: EmployeeInput = {
  category: 'government', salary: 27186, allowance: 4974,
  exemptFromTaxCommunityMedical: false, customDeductions: [], creditBalance: 0,
};
const expat: EmployeeInput = { ...gov, category: 'expat_contractor', salary: 200000, allowance: 0 };
const amt = (r: ReturnType<typeof calculatePayslip>, code: string) => r.deductions.find((d) => d.code === code)?.amount;

describe('money helpers', () => {
  it('rounds half-up on exact half pennies', () => {
    expect(percentOf(10, 500)).toBe(1); // 0.5p -> 1p
    expect(percentOf(9, 500)).toBe(0); // 0.45p -> 0p
  });
  it('formats and parses pounds without floats', () => {
    expect(formatPounds(32160)).toBe('321.60');
    expect(formatPounds(5)).toBe('0.05');
    expect(parsePounds('49.74')).toBe(4974);
    expect(parsePounds('2')).toBe(200);
    expect(() => parsePounds('abc')).toThrow();
  });
});

describe('government full line-up', () => {
  it('totals, net and employer pension for 271.86 + 49.74', () => {
    const r = calculatePayslip(gov, defaultSettings);
    // 24.12 + 9.65 + 41.81 + 12.86 + 2.00
    expect(r.totalDeductions).toBe(2412 + 965 + 4181 + 1286 + 200);
    expect(r.netPay).toBe(32160 - r.totalDeductions);
    expect(r.employerPension).toBe(2412);
  });
  it('subtracts custom deductions', () => {
    const r = calculatePayslip({ ...gov, customDeductions: [{ code: 'electricity', label: 'Electricity', amount: 1500 }] }, defaultSettings);
    expect(amt(r, 'electricity')).toBe(1500);
    expect(r.netPay).toBe(32160 - (2412 + 965 + 4181 + 1286 + 200) - 1500);
  });
});

describe('expats and contractors', () => {
  it('pay no tax, medical or community; only CDF 12.50 and heating gas 20.00', () => {
    const r = calculatePayslip(expat, defaultSettings);
    expect(r.deductions.map((d) => d.code)).toEqual(['cdf', 'heating_gas']);
    expect(r.totalDeductions).toBe(1250 + 2000);
    expect(r.employerPension).toBe(0);
  });
  it('pension is a setting, default off, and can be switched on', () => {
    const on: PayrollSettings = structuredClone(defaultSettings);
    on.categories.expat_contractor.percent[0].enabled = true;
    const r = calculatePayslip(expat, on);
    expect(amt(r, 'pension')).toBe(15000);
    expect(r.employerPension).toBe(15000);
  });
});

describe('overtime', () => {
  // salary 1600.00 / 160 h = 10.00 per hour
  const base: EmployeeInput = { ...gov, salary: 160000, allowance: 0 };
  it('weekday and Saturday are 1.5x', () => {
    const r = calculatePayslip({ ...base, overtime: [{ kind: 'weekday', hours: 2 }, { kind: 'saturday', hours: 2 }] }, defaultSettings);
    expect(r.overtimePay).toBe(3000 + 3000);
  });
  it('Sunday and public holiday are 2x', () => {
    const r = calculatePayslip({ ...base, overtime: [{ kind: 'sunday', hours: 3 }, { kind: 'public_holiday', hours: 1 }] }, defaultSettings);
    expect(r.overtimePay).toBe(6000 + 2000);
  });
  it('overtime counts towards total pay and percentage deductions', () => {
    const r = calculatePayslip({ ...base, overtime: [{ kind: 'sunday', hours: 5 }] }, defaultSettings);
    expect(r.totalPay).toBe(160000 + 10000);
    expect(amt(r, 'tax')).toBe(percentOf(170000, 1300));
  });
});

describe('starters and leavers', () => {
  it('pays by days worked (14 of 28 days = half)', () => {
    const r = calculatePayslip({ ...gov, salary: 100000, allowance: 5000, proRata: { daysWorked: 14, daysInPeriod: 28 } }, defaultSettings);
    expect(r.salary).toBe(50000);
    expect(r.allowance).toBe(2500);
    expect(r.totalPay).toBe(52500);
  });
});

describe('credit purchases', () => {
  it('deducts the balance as its own line', () => {
    const r = calculatePayslip({ ...gov, creditBalance: 2500 }, defaultSettings);
    expect(amt(r, 'credit')).toBe(2500);
    expect(r.creditCarriedForward).toBe(0);
  });
  it('never takes net pay below zero; the rest carries forward', () => {
    const r = calculatePayslip({ ...gov, creditBalance: 999999 }, defaultSettings);
    expect(r.netPay).toBe(0);
    expect(r.creditCarriedForward).toBe(999999 - amt(r, 'credit')!);
  });
});
