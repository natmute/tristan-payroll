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
