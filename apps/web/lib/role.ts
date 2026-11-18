import 'server-only';
import { cookies } from 'next/headers';

// Prototype only: a role switcher stands in for real login. Real auth comes in the full build.
export const ROLES = ['admin', 'payroll_officer', 'employee'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  payroll_officer: 'Payroll officer',
  employee: 'Employee',
};

export async function currentRole(): Promise<Role> {
  const v = (await cookies()).get('demo_role')?.value;
  return ROLES.includes(v as Role) ? (v as Role) : 'admin';
}
