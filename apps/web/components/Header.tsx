import Link from 'next/link';
import { setRole } from '@/app/actions';
import { db } from '@/lib/supabase';
import { ROLES, ROLE_LABELS, currentEmployeeId, currentRole, type Role } from '@/lib/role';

const STAFF_NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/employees', label: 'Employees' },
  { href: '/departments', label: 'Departments' },
  { href: '/grades', label: 'Pay grades' },
  { href: '/payroll', label: 'Payroll' },
  { href: '/leave', label: 'Leave' },
  { href: '/settings', label: 'Settings' },
];

// Nav items by role. Employees only ever see their own data (portal).
const NAV: Record<Role, { href: string; label: string }[]> = {
  admin: [...STAFF_NAV, { href: '/audit', label: 'Audit Log' }],
  payroll_officer: STAFF_NAV,
  employee: [{ href: '/', label: 'My portal' }],
};

export async function Header() {
  const role = await currentRole();
  // The Employee role needs to know which employee it is (demo only).
  const employees = role === 'employee'
    ? (await db().from('employees').select('id, employee_no, first_name, last_name').eq('active', true).order('employee_no')).data ?? []
    : [];
  const employeeId = role === 'employee' ? await currentEmployeeId() : null;
  return (
    <header className="no-print bg-primary-800 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          {/* White badge so the coat of arms reads clearly on the navy header. Decorative: the name follows. */}
          <span className="flex h-9 w-9 items-center justify-center rounded bg-white"><img src="/logo.png" alt="" width={26} height={28} className="h-7 w-auto" /></span>
          Tristan da Cunha Payroll
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm">
          {NAV[role].map((n) => (
            <Link key={n.href} href={n.href} className="text-primary-100 hover:text-white">{n.label}</Link>
          ))}
        </nav>
        {/* key: remount when the role or employee changes, so the dropdowns never show stale values after a switch */}
        <form key={`${role}-${employeeId ?? 'none'}`} action={setRole} className="ml-auto flex items-center gap-2 text-sm">
          <label htmlFor="role" className="text-primary-200">Viewing as</label>
          <select id="role" name="role" defaultValue={role} className="rounded bg-primary-700 px-2 py-1 text-white">
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          {role === 'employee' && employees.length > 0 && (
            <>
              <label htmlFor="employee" className="text-primary-200">as</label>
              <select id="employee" name="employee" defaultValue={employeeId ?? ''} className="rounded bg-primary-700 px-2 py-1 text-white">
                {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </select>
            </>
          )}
          <button className="rounded bg-white/15 px-3 py-1 hover:bg-white/25">Switch</button>
        </form>
      </div>
    </header>
  );
}
