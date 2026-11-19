import type { LeaveSettings } from './settings';

export type LeaveTier = 'standard' | 'head_deputy_assistant';

/** Whole years between two "YYYY-MM-DD" dates (an anniversary counts on the day). */
export function fullYears(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  let years = ty - fy;
  if (tm < fm || (tm === fm && td < fd)) years--;
  return Math.max(0, years);
}

/**
 * Annual and sick leave entitlement in days as at `asOfIso`.
 * 15 days (21 after 5 years), or 25 for heads of department, deputies and assistants; 25 sick days.
 * The numbers come from settings, not from this code.
 */
export function leaveEntitlement(
  leave: LeaveSettings,
  employee: { tier: LeaveTier; startDate: string },
  asOfIso: string,
): { annual: number; sick: number } {
  const annual =
    employee.tier === 'head_deputy_assistant'
      ? leave.annualDaysSenior
      : fullYears(employee.startDate, asOfIso) >= leave.longServiceYears
        ? leave.annualDaysLongService
        : leave.annualDays;
  return { annual, sick: leave.sickDays };
}
