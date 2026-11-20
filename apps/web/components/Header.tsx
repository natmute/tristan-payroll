import Link from 'next/link';
import { unstable_cache } from 'next/cache';
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

// The demo employee list is cached for two minutes, so staff pages do not wait for an extra database call on every click.
const demoEmployees = unstable_cache(
  async () => (await db().from('employees').select('id, first_name, last_name').eq('active', true).order('employee_no')).data ?? [],
  ['demo-employees'],
  { revalidate: 120 },
);

export async function Header() {
  const role = await currentRole();
  // Demo only: staff pick which employee the Employee button shows. The list of names is for staff alone.
  // An Employee sees just their own name, never a list of colleagues. Real login replaces all of this.
  const employees = await demoEmployees();
  const employeeId = await currentEmployeeId();
  const me = employees.find((e) => e.id === employeeId);
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
        {/* One click per role, and the current role is highlighted, so it is always clear who you are viewing as.
            key: remount when the role or employee changes, so the controls never show stale values after a switch. */}
        <form key={`${role}-${employeeId ?? 'none'}`} action={setRole} className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          <span id="viewing-as" className="text-primary-200">Viewing as</span>
          <div role="group" aria-labelledby="viewing-as" className="flex overflow-hidden rounded border border-white/40">
            {ROLES.map((r) => (
              <button
                key={r} name="role" value={r} aria-pressed={r === role}
                className={`px-3 py-1 ${r === role ? 'bg-white font-semibold text-primary-900' : 'bg-primary-700 text-white hover:bg-primary-600'}`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          {role === 'employee' ? (
            me && <span className="text-primary-100">as <strong className="text-white">{me.first_name} {me.last_name}</strong></span>
          ) : (
            employees.length > 0 && (
              <>
                <label htmlFor="employee" className="text-primary-200">Employee view for</label>
                <select id="employee" name="employee" defaultValue={employeeId ?? ''} className="rounded bg-primary-700 px-2 py-1 text-white">
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </select>
              </>
            )
          )}
        </form>
      </div>
    </header>
  );
}
