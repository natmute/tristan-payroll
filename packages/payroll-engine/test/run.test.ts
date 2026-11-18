import { describe, it, expect } from 'vitest';
import {
  buildRun, checkRun, compareRuns, countDays, defaultSettings, totalsOf, parsePounds,
  type RunEmployee,
} from '../src';

const p = parsePounds;
// Government 4-weekly period ending on the sample pay date (16 Nov 2026): 20 Oct to 16 Nov = 28 days.
const period = { start: '2026-10-20', end: '2026-11-16' };

const emp = (over: Partial<RunEmployee> = {}): RunEmployee => ({
  id: 'e1', category: 'government', salary: p('271.86'), allowance: p('49.74'),
  exemptFromTaxCommunityMedical: false, startDate: '2020-01-06', endDate: null,
  customDeductions: [{ code: 'posb', label: 'POSB', amount: p('40.00') }], creditBalance: 0, ...over,
});

describe('countDays', () => {
  it('counts calendar days inclusively', () => {
    expect(countDays('2026-10-20', '2026-11-16', 'calendar_days')).toBe(28);
    expect(countDays('2026-11-09', '2026-11-16', 'calendar_days')).toBe(8);
  });
  it('counts Monday to Friday only for working days', () => {
    expect(countDays('2026-10-20', '2026-11-16', 'working_days')).toBe(20);
    expect(countDays('2026-11-14', '2026-11-15', 'working_days')).toBe(0); // a Saturday and Sunday
  });
});

describe('buildRun', () => {
  it('a full-period employee matches the plain calculation (no part period)', () => {
    const [l] = buildRun([emp()], period, defaultSettings);
    expect(l.input.proRata).toBeUndefined();
    expect(l.result.totalPay).toBe(p('321.60'));
    expect(l.result.netPay).toBe(p('191.16')); // 321.60 less 24.12, 2.00, 9.65, 41.81, 12.86 and POSB 40.00
  });

  it('a starter on 9 Nov is paid 8 of 28 days (calendar), rounded half-up', () => {
    const [l] = buildRun([emp({ startDate: '2026-11-09', customDeductions: [] })], period, defaultSettings);
    expect(l.input.proRata).toEqual({ daysWorked: 8, daysInPeriod: 28 });
    expect(l.result.salary).toBe(7767); // 27186 x 8 / 28 = 7767.43
    expect(l.result.allowance).toBe(1421); // 4974 x 8 / 28 = 1421.14
    expect(l.result.totalPay).toBe(9188);
  });

  it('a leaver on 5 Nov is paid 17 of 28 days', () => {
    const [l] = buildRun([emp({ endDate: '2026-11-05' })], period, defaultSettings);
    expect(l.input.proRata).toEqual({ daysWorked: 17, daysInPeriod: 28 });
  });

  it('working-days basis uses weekdays for the ratio', () => {
    const settings = { ...defaultSettings, proRataBasis: 'working_days' as const };
    const [l] = buildRun([emp({ startDate: '2026-11-09' })], period, settings);
    expect(l.input.proRata).toEqual({ daysWorked: 6, daysInPeriod: 20 }); // 9-13 Nov and 16 Nov
  });

  it('leaves out someone who starts after the period or left before it', () => {
    const lines = buildRun(
      [emp({ id: 'a', startDate: '2026-11-17' }), emp({ id: 'b', endDate: '2026-10-19' }), emp({ id: 'c' })],
      period, defaultSettings,
    );
    expect(lines.map((l) => l.employeeId)).toEqual(['c']);
  });

  it('includes someone who leaves on the first day and someone who starts on the last day', () => {
    const lines = buildRun([emp({ id: 'a', endDate: '2026-10-20' }), emp({ id: 'b', startDate: '2026-11-16' })], period, defaultSettings);
    expect(lines.map((l) => [l.employeeId, l.input.proRata?.daysWorked])).toEqual([['a', 1], ['b', 1]]);
  });

  it('a credit balance bigger than net pay is capped and the rest carries forward', () => {
    const [l] = buildRun([emp({ customDeductions: [], creditBalance: p('1000.00') })], period, defaultSettings);
    expect(l.result.netPay).toBe(0);
    expect(l.result.creditCarriedForward).toBeGreaterThan(0);
  });

  it('expat rule case: £2,400.00 gives net £2,367.50 (CDF 12.50 + heating gas 20.00, no tax or medical)', () => {
    const [l] = buildRun(
      [emp({ category: 'expat_contractor', salary: p('2400.00'), allowance: 0, customDeductions: [] })],
      { start: '2026-10-21', end: '2026-11-20' }, defaultSettings,
    );
    expect(l.result.netPay).toBe(p('2367.50'));
    expect(l.result.deductions.map((d) => d.code)).toEqual(['cdf', 'heating_gas']);
  });

  it('rejects a backwards period', () => {
    expect(() => buildRun([emp()], { start: '2026-11-16', end: '2026-10-20' }, defaultSettings)).toThrow();
  });
});

describe('checkRun', () => {
  it('blocks a missing salary and negative net pay', () => {
    const lines = buildRun(
      [emp({ id: 'a', salary: 0, allowance: 0 }), emp({ id: 'b', customDeductions: [{ code: 'x', label: 'X', amount: p('900.00') }] })],
      period, defaultSettings,
    );
    const { blocking } = checkRun(lines);
    expect(blocking.map((i) => [i.employeeId, i.code])).toEqual(expect.arrayContaining([['a', 'no_salary'], ['b', 'negative_net']]));
  });

  it('warns about a starter, no deductions and a credit carried forward, but does not block', () => {
    const lines = buildRun(
      [emp({ id: 'a', startDate: '2026-11-09' }), emp({ id: 'b', customDeductions: [], creditBalance: p('1000.00') })],
      period, defaultSettings,
    );
    const r = checkRun(lines);
    expect(r.blocking).toEqual([]);
    expect(r.warnings.map((i) => i.code)).toEqual(expect.arrayContaining(['part_period', 'no_deductions', 'credit_carried_forward']));
  });

  it('a clean run has no issues', () => {
    expect(checkRun(buildRun([emp()], period, defaultSettings))).toEqual({ blocking: [], warnings: [] });
  });
});

describe('compareRuns', () => {
  const prev = buildRun([emp({ id: 'a' }), emp({ id: 'b' }), emp({ id: 'gone' })], period, defaultSettings);

  it('totals and who was added or removed', () => {
    const cur = buildRun([emp({ id: 'a' }), emp({ id: 'b' }), emp({ id: 'new' })], period, defaultSettings);
    const c = compareRuns(cur, prev, 1000);
    expect(c.added).toEqual(['new']);
    expect(c.removed).toEqual(['gone']);
    expect(c.changes).toEqual([]);
    expect(c.current).toEqual(totalsOf(cur));
  });

  it('flags a salary rise above the threshold with the reason', () => {
    const cur = buildRun([emp({ id: 'a', salary: p('400.00') })], period, defaultSettings);
    const [ch] = compareRuns(cur, prev, 1000).changes;
    expect(ch.flagged).toBe(true);
    expect(ch.reasons).toEqual(['salary changed']);
    expect(ch.bps).toBeGreaterThan(1000);
  });

  it('does not flag a small change, and explains a changed deduction', () => {
    const cur = buildRun([emp({ id: 'a', customDeductions: [{ code: 'posb', label: 'POSB', amount: p('41.00') }] })], period, defaultSettings);
    const [ch] = compareRuns(cur, prev, 1000).changes;
    expect(ch.flagged).toBe(false);
    expect(ch.reasons).toEqual(['deductions changed']);
  });

  it('a starter becoming a full-period employee is reported', () => {
    const before = buildRun([emp({ id: 'a', startDate: '2026-11-09' })], period, defaultSettings);
    const now = buildRun([emp({ id: 'a' })], period, defaultSettings);
    expect(compareRuns(now, before, 1000).changes[0].reasons).toContain('back to a full period');
  });

  it('a rate change alone is reported as settings changed', () => {
    const changed = {
      ...defaultSettings,
      categories: {
        ...defaultSettings.categories,
        government: {
          ...defaultSettings.categories.government,
          percent: defaultSettings.categories.government.percent.map((r) => (r.code === 'tax' ? { ...r, bps: 1400 } : r)),
        },
      },
    };
    const cur = buildRun([emp({ id: 'a' })], period, changed);
    expect(compareRuns(cur, prev, 1000).changes[0].reasons).toEqual(['rates or settings changed']);
  });

  it('check run warns about flagged net changes', () => {
    const cur = buildRun([emp({ id: 'a', salary: p('400.00') })], period, defaultSettings);
    const cmp = compareRuns(cur, prev, 1000);
    expect(checkRun(cur, cmp.changes).warnings.some((w) => w.code === 'net_change')).toBe(true);
  });
});
