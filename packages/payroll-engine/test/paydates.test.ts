import { describe, it, expect } from 'vitest';
import { nextPayDate, type PayCycle } from '../src';

const gov: PayCycle = { cycle: 'four_weekly', anchorPayDate: '2026-11-16', payDayOfMonth: null };
const monthly = (day: number): PayCycle => ({ cycle: 'monthly', anchorPayDate: null, payDayOfMonth: day });

describe('four-weekly pay dates (anchor 16 Nov 2026)', () => {
  it('on the pay date itself, returns that date', () => {
    expect(nextPayDate(gov, '2026-11-16')).toBe('2026-11-16');
  });
  it('two days later, the next date is 28 days on', () => {
    expect(nextPayDate(gov, '2026-11-18')).toBe('2026-12-14');
  });
  it('on the following pay date, returns it', () => {
    expect(nextPayDate(gov, '2026-12-14')).toBe('2026-12-14');
  });
  it('the day after, rolls to the next one, across the year end', () => {
    expect(nextPayDate(gov, '2026-12-15')).toBe('2027-01-11');
  });
  it('before the anchor, returns the anchor', () => {
    expect(nextPayDate(gov, '2026-11-01')).toBe('2026-11-16');
  });
  it('without an anchor, returns null', () => {
    expect(nextPayDate({ ...gov, anchorPayDate: null }, '2026-11-18')).toBeNull();
  });
});

describe('monthly pay dates', () => {
  it('this month if the day has not passed', () => {
    expect(nextPayDate(monthly(20), '2026-11-18')).toBe('2026-11-20');
  });
  it('on the pay day itself, returns today', () => {
    expect(nextPayDate(monthly(20), '2026-11-20')).toBe('2026-11-20');
  });
  it('next month once it has passed', () => {
    expect(nextPayDate(monthly(20), '2026-11-21')).toBe('2026-12-20');
  });
  it('rolls over the year end', () => {
    expect(nextPayDate(monthly(20), '2026-12-21')).toBe('2027-01-20');
  });
  it('clamps day 31 to the last day of a short month', () => {
    expect(nextPayDate(monthly(31), '2027-02-10')).toBe('2027-02-28');
  });
  it('without a pay day, returns null', () => {
    expect(nextPayDate({ cycle: 'monthly', anchorPayDate: null, payDayOfMonth: null }, '2026-11-18')).toBeNull();
  });
});
