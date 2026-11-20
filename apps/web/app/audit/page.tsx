import Link from 'next/link';
import { db } from '@/lib/supabase';
import { dateTimeGmt, gbp } from '@/lib/format';
import { StaffOnly } from '@/components/StaffOnly';
import { AdminOnly } from '@/components/AdminOnly';
import { Card, Chip, EmptyState, ErrorBox, PageTitle, Td, Th } from '@/components/ui';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 50;

type Row = { id: string; at: string; actor_role: string; actor_name: string; action: string; entity: string | null; entity_id: string | null; detail: Record<string, unknown> | null };

const ROLE_LABELS: Record<string, string> = { admin: 'Administrator', payroll_officer: 'Payroll officer', employee: 'Employee' };
const MONEY_KEYS = new Set(['salary', 'allowance', 'amount', 'paid']);
function show(key: string, v: unknown): string {
  if (typeof v === 'number' && MONEY_KEYS.has(key)) return gbp(v);
  if (v === null || v === undefined) return 'none';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Before and after values, settings changes, or the plain facts of the action. */
function Detail({ d }: { d: Row['detail'] }) {
  if (!d) return <span className="text-slate-400">-</span>;
  const lines: string[] = [];
  if (Array.isArray(d.changes)) lines.push(...(d.changes as string[]));
  const before = d.before as Record<string, unknown> | undefined;
  const after = d.after as Record<string, unknown> | undefined;
  if (before && after && !Array.isArray(d.changes)) {
    for (const k of Object.keys(after)) lines.push(`${k.replace(/_/g, ' ')}: ${show(k, before[k])} to ${show(k, after[k])}`);
  } else if (after && !before) {
    lines.push(`created: ${Object.entries(after).filter(([k]) => ['first_name', 'last_name', 'name', 'code', 'employee_no'].includes(k)).map(([k, v]) => show(k, v)).join(' ')}`);
  }
  for (const [k, v] of Object.entries(d)) {
    if (['changes', 'before', 'after'].includes(k)) continue;
    lines.push(`${k.replace(/_/g, ' ')}: ${show(k, v)}`);
  }
  return <ul className="space-y-0.5">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; role?: string; from?: string; to?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let q = db().from('audit_log').select('*', { count: 'exact' }).order('at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (sp.area && /^[a-z_]+$/.test(sp.area)) q = q.like('action', `${sp.area}.%`);
  if (sp.role && ['admin', 'payroll_officer', 'employee'].includes(sp.role)) q = q.eq('actor_role', sp.role);
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) q = q.gte('at', `${sp.from}T00:00:00Z`);
  if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) q = q.lte('at', `${sp.to}T23:59:59Z`);
  const { data, error, count } = await q.returns<Row[]>();

  const field = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';
  const qs = (n: number) => {
    const p = new URLSearchParams();
    for (const k of ['area', 'role', 'from', 'to'] as const) if (sp[k]) p.set(k, sp[k]!);
    p.set('page', String(n));
    return `/audit?${p.toString()}`;
  };
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <StaffOnly>
      <AdminOnly>
        <PageTitle title="Audit Log" subtitle="Every change, with who and when. Entries cannot be edited or deleted here." />
        <Card className="mb-4">
          <form className="flex flex-wrap items-end gap-3" role="search">
            <label className="text-sm"><span className="mb-1 block text-slate-600">Area</span>
              <select name="area" defaultValue={sp.area ?? ''} className={field}>
                <option value="">All</option>
                {[['run', 'Payroll runs'], ['settings', 'Settings'], ['employee', 'Employees'], ['deduction', 'Deductions'], ['credit', 'Credit purchases'],
                  ['department', 'Departments'], ['grade', 'Pay grades'], ['payslip', 'Payslips'], ['leave', 'Leave'], ['role', 'Role switches']]
                  .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="text-sm"><span className="mb-1 block text-slate-600">Who</span>
              <select name="role" defaultValue={sp.role ?? ''} className={field}>
                <option value="">Anyone</option>
                {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="text-sm"><span className="mb-1 block text-slate-600">From</span><input type="date" name="from" defaultValue={sp.from ?? ''} className={field} /></label>
            <label className="text-sm"><span className="mb-1 block text-slate-600">To</span><input type="date" name="to" defaultValue={sp.to ?? ''} className={field} /></label>
            <button className="rounded bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700">Filter</button>
            <Link href="/audit" className="px-2 py-1.5 text-sm text-primary-700 hover:underline">Clear</Link>
          </form>
        </Card>

        {error ? <ErrorBox message={error.message} /> : !data?.length ? (
          <EmptyState>No entries match these filters.</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead><tr><Th>When (GMT)</Th><Th>Who</Th><Th>Action</Th><Th>What changed</Th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((r) => (
                    <tr key={r.id} className="align-top">
                      <Td className="whitespace-nowrap">{dateTimeGmt(r.at)}</Td>
                      <Td>{r.actor_name}<span className="block text-xs text-slate-500">{ROLE_LABELS[r.actor_role] ?? r.actor_role}</span></Td>
                      <Td><Chip tone="blue">{r.action}</Chip></Td>
                      <Td><Detail d={r.detail} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
              <span>{count} entries. Page {page} of {pages}.</span>
              <span className="flex gap-4">
                {page > 1 && <Link href={qs(page - 1)} className="text-primary-700 hover:underline">Newer</Link>}
                {page < pages && <Link href={qs(page + 1)} className="text-primary-700 hover:underline">Older</Link>}
              </span>
            </div>
          </>
        )}
      </AdminOnly>
    </StaffOnly>
  );
}
