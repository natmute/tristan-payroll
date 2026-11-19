import { describe, it, expect } from 'vitest';
import { defaultSettings, fullYears, leaveEntitlement, withDefaults } from '../src';

const leave = defaultSettings.leave;

describe('fullYears', () => {
  it('counts the anniversary on the day', () => {
    expect(fullYears('2021-11-19', '2026-11-19')).toBe(5);
    expect(fullYears('2021-11-20', '2026-11-19')).toBe(4);
  });
  it('is never negative', () => {
    expect(fullYears('2027-01-01', '2026-11-19')).toBe(0);
  });
});

describe('leaveEntitlement', () => {
  it('15 days annual and 25 sick for a standard employee under 5 years', () => {
    expect(leaveEntitlement(leave, { tier: 'standard', startDate: '2022-01-10' }, '2026-11-19')).toEqual({ annual: 15, sick: 25 });
  });
  it('21 days after 5 full years', () => {
    expect(leaveEntitlement(leave, { tier: 'standard', startDate: '2021-11-19' }, '2026-11-19').annual).toBe(21);
    expect(leaveEntitlement(leave, { tier: 'standard', startDate: '2021-11-20' }, '2026-11-19').annual).toBe(15);
  });
  it('25 days for heads of department, deputies and assistants, regardless of service', () => {
    expect(leaveEntitlement(leave, { tier: 'head_deputy_assistant', startDate: '2026-11-01' }, '2026-11-19').annual).toBe(25);
  });
  it('uses the settings, not fixed numbers', () => {
    const changed = { ...leave, annualDays: 20, sickDays: 30 };
    expect(leaveEntitlement(changed, { tier: 'standard', startDate: '2026-01-01' }, '2026-11-19')).toEqual({ annual: 20, sick: 30 });
  });
});

describe('withDefaults', () => {
  it('fills in settings that older saved versions lack', () => {
    const { leave: _omit, ...old } = defaultSettings;
    expect(withDefaults(old).leave).toEqual(defaultSettings.leave);
  });
  it('keeps saved values', () => {
    expect(withDefaults({ ...defaultSettings, transferCommissionBps: 500 }).transferCommissionBps).toBe(500);
  });
});
