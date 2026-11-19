import Link from 'next/link';
import { setRole } from '@/app/actions';
import { ROLES, ROLE_LABELS, currentRole, type Role } from '@/lib/role';

const STAFF_NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/employees', label: 'Employees' },
  { href: '/departments', label: 'Departments' },
  { href: '/grades', label: 'Pay grades' },
  { href: '/payroll', label: 'Payroll' },
];

// Nav items by role. Employees only ever see their own data (portal).
const NAV: Record<Role, { href: string; label: string }[]> = {
  admin: STAFF_NAV,
  payroll_officer: STAFF_NAV,
  employee: [{ href: '/', label: 'My portal' }],
};

export async function Header() {
  const role = await currentRole();
  return (
    <header className="no-print bg-primary-800 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">Tristan da Cunha Payroll</Link>
        <nav className="flex flex-wrap gap-4 text-sm">
          {NAV[role].map((n) => (
            <Link key={n.href} href={n.href} className="text-primary-100 hover:text-white">{n.label}</Link>
          ))}
        </nav>
        <form action={setRole} className="ml-auto flex items-center gap-2 text-sm">
          <label htmlFor="role" className="text-primary-200">Viewing as</label>
          <select id="role" name="role" defaultValue={role} className="rounded bg-primary-700 px-2 py-1 text-white">
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button className="rounded bg-white/15 px-3 py-1 hover:bg-white/25">Switch</button>
        </form>
      </div>
    </header>
  );
}
