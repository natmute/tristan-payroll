// Pay-date helpers. Dates are plain "YYYY-MM-DD" strings, calculated in UTC (Tristan da Cunha is on GMT).

export interface PayCycle {
  cycle: 'four_weekly' | 'monthly';
  /** A known pay date. Four-weekly dates repeat every 28 days from it. */
  anchorPayDate: string | null;
  /** Monthly cycles: the day of the month. Clamped to the month's last day (31 in February -> 28 or 29). */
  payDayOfMonth: number | null;
}

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

function toUtc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function toIso(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Monthly pay date for a year and zero-based month, clamped to the month's last day. */
function monthlyDate(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return toIso(Date.UTC(year, month, Math.min(day, lastDay)));
}

/**
 * Pay dates around today, oldest first: `before` dates before the next pay date, the next one,
 * then `after` dates after it. Used to pick the date for a new run.
 */
export function payDatesAround(c: PayCycle, todayIso: string, before = 2, after = 1): string[] {
  const next = nextPayDate(c, todayIso);
  if (!next) return [];
  const dates: string[] = [];
  if (c.cycle === 'four_weekly') {
    for (let i = -before; i <= after; i++) dates.push(toIso(toUtc(next) + i * 28 * DAY_MS));
  } else {
    const n = new Date(toUtc(next));
    for (let i = -before; i <= after; i++) dates.push(monthlyDate(n.getUTCFullYear(), n.getUTCMonth() + i, c.payDayOfMonth!));
  }
  return dates;
}

/** The first pay date on or after `todayIso`, or null when the cycle is not configured. */
export function nextPayDate(c: PayCycle, todayIso: string): string | null {
  const today = toUtc(todayIso);

  if (c.cycle === 'four_weekly') {
    if (!c.anchorPayDate) return null;
    const anchor = toUtc(c.anchorPayDate);
    if (today <= anchor) return c.anchorPayDate;
    const step = 28 * DAY_MS;
    return toIso(anchor + Math.ceil((today - anchor) / step) * step);
  }

  if (!c.payDayOfMonth) return null;
  const start = new Date(today);
  for (let i = 0; i < 2; i++) {
    const year = start.getUTCFullYear();
    const month = start.getUTCMonth() + i;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const candidate = Date.UTC(year, month, Math.min(c.payDayOfMonth, lastDay));
    if (candidate >= today) return toIso(candidate);
  }
  return null;
}
