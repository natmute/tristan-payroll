import 'server-only';
import { cookies } from 'next/headers';
import { FormError } from './form';

// Prototype only: a role switcher stands in for real login. Real auth comes in the full build.
export const ROLES = ['admin', 'payroll_officer', 'employee'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  payroll_officer: 'Payroll officer',
  employee: 'Employee',
};

/** Throws a message the user can read if the current role is not allowed. Used by server actions. */
export async function requireRole(allowed: Role[]): Promise<void> {
  if (!allowed.includes(await currentRole())) {
    throw new FormError('Your role is not allowed to do this. Switch role and try again.');
  }
}

export async function isAdmin(): Promise<boolean> {
  return (await currentRole()) === 'admin';
}

/** Administrators and payroll officers see staff screens. Employees only get their own portal. */
export async function isStaff(): Promise<boolean> {
  return (await currentRole()) !== 'employee';
}

export async function currentRole(): Promise<Role> {
  const v = (await cookies()).get('demo_role')?.value;
  return ROLES.includes(v as Role) ? (v as Role) : 'admin';
}
