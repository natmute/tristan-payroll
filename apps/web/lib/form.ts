import { parsePounds } from '@tristan/payroll-engine';

// Helpers for server actions. A FormError is shown to the user; anything else is a real fault.
export class FormError extends Error {}
export type ActionResult = { error?: string } | void;

export const text = (fd: FormData, key: string) => String(fd.get(key) ?? '').trim();
export const optText = (fd: FormData, key: string) => text(fd, key) || null;
export const checked = (fd: FormData, key: string) => fd.get(key) === 'on';

export function required(fd: FormData, key: string, label: string): string {
  const v = text(fd, key);
  if (!v) throw new FormError(`${label} is required.`);
  return v;
}

/** "1,234.50" or "£12" -> pence. Never goes through a float. */
export function pence(raw: string, label: string, opts: { allowZero?: boolean } = {}): number {
  const cleaned = raw.replace(/[£,\s]/g, '');
  let value: number;
  try {
    value = parsePounds(cleaned);
  } catch {
    throw new FormError(`${label} must be an amount like 123.45.`);
  }
  if (value < 0 || (value === 0 && !opts.allowZero)) {
    throw new FormError(`${label} must be ${opts.allowZero ? 'zero or more' : 'more than zero'}.`);
  }
  return value;
}

/** "2026-11-18" only. Rejects impossible dates such as 2026-02-31. */
export function isoDate(raw: string, label: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  if (!m || !d || d.getUTCMonth() !== +m[2] - 1) throw new FormError(`${label} must be a valid date.`);
  return raw;
}

/** Runs an action body, turning FormError into a message and letting everything else (including redirects) through. */
export async function run(body: () => Promise<void>): Promise<ActionResult> {
  try {
    await body();
  } catch (e) {
    if (e instanceof FormError) return { error: e.message };
    throw e;
  }
}

/** Friendly message for a Postgres error, or throws it on. */
export function dbError(error: { code?: string; message: string }, uniqueMessage: string): never {
  if (error.code === '23505') throw new FormError(uniqueMessage);
  throw new FormError(`Could not save: ${error.message}`);
}

/** Only the fields that changed, for the audit log. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const k of Object.keys(after)) {
    if (before[k] !== after[k]) {
      b[k] = before[k];
      a[k] = after[k];
    }
  }
  return { before: b, after: a, changed: Object.keys(a).length > 0 };
}
