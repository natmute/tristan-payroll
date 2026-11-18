import { describe, it, expect } from 'vitest';
import { calculatePayslip, defaultSettings, parsePounds, type EmployeeInput, type PayrollSettings } from '../src';

// Anonymised Telecommunications sample sheet (pay date 16 Nov 2026), from CLAUDE.md.
// Amounts in pounds for readability; converted to pence. Transfer commission (3%) is added by the engine.
const p = parsePounds;
type Row = { salary: string; allow: string; exempt?: boolean; custom: [string, string, string][]; net: string };

const rows: Row[] = [
  { salary: '333.96', allow: '0.00', exempt: true, net: '278.31',
    custom: [['posb', 'POSB', '10.00'], ['transfers', 'Transfers', '20.00']] },
  { salary: '271.86', allow: '49.74', net: '141.16',
    custom: [['posb', 'POSB', '40.00'], ['freight', 'Freight', '50.00']] },
  { salary: '843.18', allow: '49.74', net: '554.20',
    custom: [['electricity', 'Electricity', '68.16'], ['prescriptions', 'Medical (prescriptions)', '5.00'], ['internet', 'Internet rental', '18.00']] },
  { salary: '454.02', allow: '49.74', net: '131.15',
    custom: [['prescriptions', 'Medical (prescriptions)', '20.00'], ['posb', 'POSB', '153.78'], ['pwd_stores', 'PWD Stores', '40.00'],
      ['transfers', 'Transfers', '10.00'], ['internet', 'Internet rental', '8.00']] },
  { salary: '547.58', allow: '49.74', net: '104.56',
    custom: [['prescriptions', 'Medical (prescriptions)', '5.00'], ['posb', 'POSB', '110.00'], ['pwd_stores', 'PWD Stores', '30.00'],
      ['transfers', 'Transfers', '50.00'], ['agriculture', 'Agriculture', '30.00'], ['freight', 'Freight', '100.00']] },
  { salary: '454.02', allow: '49.74', net: '285.23',
    custom: [['prescriptions', 'Medical (prescriptions)', '5.00'], ['posb', 'POSB', '50.00'], ['island_store', 'Island Store', '15.00'], ['internet', 'Internet rental', '8.00']] },
  { salary: '249.78', allow: '49.74', net: '135.91',
    custom: [['electricity', 'Electricity', '14.24'], ['prescriptions', 'Medical (prescriptions)', '5.00'], ['posb', 'POSB', '50.00'], ['island_store', 'Island Store', '10.00']] },
];

const toInput = (r: Row): EmployeeInput => ({
  category: 'government',
  salary: p(r.salary),
  allowance: p(r.allow),
  exemptFromTaxCommunityMedical: !!r.exempt,
  customDeductions: r.custom.map(([code, label, amt]) => ({ code, label, amount: p(amt) })),
  creditBalance: 0,
});

describe('sample sheet: net pay to the penny', () => {
  rows.forEach((r, i) => {
    it(`employee ${i + 1}: net ${r.net}`, () => {
      expect(calculatePayslip(toInput(r), defaultSettings).netPay).toBe(p(r.net));
    });
  });

  it('totals match the sheet: net 1630.52, employer pension 258.96', () => {
    const results = rows.map((r) => calculatePayslip(toInput(r), defaultSettings));
    expect(results.reduce((s, x) => s + x.netPay, 0)).toBe(p('1630.52'));
    expect(results.reduce((s, x) => s + x.employerPension, 0)).toBe(p('258.96'));
    expect(results.reduce((s, x) => s + x.totalPay, 0)).toBe(p('3452.84'));
  });

  it('disaster fund is £12 in total: six employees pay £2, the exempt one pays none', () => {
    const results = rows.map((r) => calculatePayslip(toInput(r), defaultSettings));
    const fund = results.map((x) => x.deductions.find((d) => d.code === 'disaster')?.amount ?? 0);
    expect(fund.reduce((s, a) => s + a, 0)).toBe(1200);
    expect(fund[0]).toBe(0);
  });
});

describe('transferCommissionBps setting', () => {
  const emp = toInput(rows[0]);
  const commission = (s: PayrollSettings) =>
    calculatePayslip(emp, s).deductions.find((d) => d.code === 'transfer_commission')?.amount;

  it('adds 3% as its own line by default (20.00 -> 0.60)', () => {
    expect(commission(defaultSettings)).toBe(60);
  });
  it('adds no line when set to 0', () => {
    expect(commission({ ...defaultSettings, transferCommissionBps: 0 })).toBeUndefined();
  });
});

describe('deductionsApplyToOvertime setting', () => {
  const withOvertime: EmployeeInput = {
    ...toInput(rows[1]),
    customDeductions: [],
    overtime: [{ kind: 'sunday', hours: 8 }],
  };
  const tax = (s: PayrollSettings) => calculatePayslip(withOvertime, s).deductions.find((d) => d.code === 'tax')!.amount;

  it('on (default): tax is 13% of salary + allowance + overtime', () => {
    const r = calculatePayslip(withOvertime, defaultSettings);
    expect(r.overtimePay).toBeGreaterThan(0);
    expect(tax(defaultSettings)).toBe(Math.floor((r.totalPay * 1300 * 2 + 10000) / 20000));
  });
  it('off: tax ignores overtime (13% of 321.60 = 41.81)', () => {
    expect(tax({ ...defaultSettings, deductionsApplyToOvertime: false })).toBe(p('41.81'));
  });
});
