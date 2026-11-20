import { formatPounds } from '@tristan/payroll-engine';
import type { Category } from '@tristan/payroll-engine';

// Display helpers only. Money stays integer pence everywhere else.

/** 12345678 -> "£123,456.78" */
export function gbp(pence: number): string {
  const s = formatPounds(pence);
  const neg = s.startsWith('-');
  const [whole, frac] = s.replace('-', '').split('.');
  return `${neg ? '-' : ''}£${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-18" -> "18 Nov 2026" */
export function ukDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** +£12.30 or -£4.00. */
export function signedGbp(pence: number): string {
  return pence > 0 ? `+${gbp(pence)}` : gbp(pence);
}

/** Basis points as a signed percentage with up to two decimals: 1234 -> "+12.34%". Integer maths. */
export function signedPct(bps: number): string {
  const abs = Math.abs(bps);
  const frac = String(abs % 100).padStart(2, '0').replace(/0$/, '');
  return `${bps > 0 ? '+' : bps < 0 ? '-' : ''}${Math.floor(abs / 100)}${frac ? '.' + frac : ''}%`;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-11-16" -> "November 2026" */
export function monthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** "2026-11-16" plus 1 day -> "2026-11-17". Calendar maths in UTC. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export const CATEGORY_LABELS: Record<Category, string> = {
  government: 'Government',
  expat_contractor: 'Expats and Contractors',
};

export const CYCLE_LABELS: Record<string, string> = {
  four_weekly: 'Every 4 weeks',
  monthly: 'Monthly',
};

export function fullName(e: { first_name: string; last_name: string }): string {
  return `${e.first_name} ${e.last_name}`;
}
