// Database setup scripts. Run through npm (they are bundled with esbuild first):
//   npm run db:history   adds the two finalised demo runs from October (safe to re-run)
//   npm run db:reset     DESTROYS all data in the project's database, then reapplies schema, seed and history
//
// Reads DATABASE_URL from apps/web/.env.local. Fictional demo data only. Never point this at a real database.
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { buildRun, type Category, type PayrollSettings, type RunEmployee } from '../packages/payroll-engine/src';

const root = process.cwd();

function connection(): Client {
  const envFile = path.join(root, 'apps/web/.env.local');
  if (!fs.existsSync(envFile)) throw new Error('apps/web/.env.local not found. Run this from the repo root.');
  const line = fs.readFileSync(envFile, 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL is missing from apps/web/.env.local.');
  // Parsed by hand so passwords with special characters work.
  const m = line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '')
    .match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@/:]+):(\d+)\/(.+)$/);
  if (!m) throw new Error('DATABASE_URL does not look like postgresql://user:password@host:port/database.');
  let password = m[2];
  try { password = decodeURIComponent(password); } catch { /* use as typed */ }
  if (password.startsWith('[') && password.endsWith(']')) {
    console.warn('Note: the password in DATABASE_URL is wrapped in [square brackets]. Brackets are from the template and are not part of the password. Ignoring them.');
    password = password.slice(1, -1);
  }
  return new Client({ user: m[1], password, host: m[3], port: Number(m[4]), database: m[5], ssl: { rejectUnauthorized: false } });
}

// Demo history. Pay dates and periods follow the same defaults as the app's set-up screen.
// T007 is shown on a £30 lower salary in October (a demo pay rise), so the comparison has a real change to flag.
const HISTORY: { category: Category; payDate: string; start: string; end: string; salaryOverrides: Record<string, number> }[] = [
  { category: 'government', payDate: '2026-10-19', start: '2026-09-22', end: '2026-10-19', salaryOverrides: { T007: 21978 } },
  { category: 'expat_contractor', payDate: '2026-10-20', start: '2026-09-21', end: '2026-10-20', salaryOverrides: {} },
];

const OFFICER = { role: 'payroll_officer', name: 'Payroll officer (demo)' };
const ADMIN = { role: 'admin', name: 'Administrator (demo)' };

async function seedHistory(c: Client) {
  const settings = (await c.query('select settings from payroll_settings where id = 1')).rows[0]?.settings as PayrollSettings | undefined;
  if (!settings) throw new Error('payroll_settings is empty. Run the schema and seed first.');

  for (const h of HISTORY) {
    const exists = await c.query('select 1 from pay_runs where category = $1 and pay_date = $2 and department_id is null', [h.category, h.payDate]);
    if (exists.rowCount) { console.log(`${h.category} ${h.payDate}: already there, skipped`); continue; }

    // bigint columns come back from pg as strings, so convert them.
    const emps = (await c.query(
      `select id, employee_no, category, salary, allowance, exempt_from_tax_community_medical as exempt,
              start_date::text as start_date, end_date::text as end_date, active
         from employees where category = $1 and start_date <= $2`, [h.category, h.end])).rows;
    const deds = (await c.query(
      `select cd.employee_id, cd.type_code, cd.amount, dt.label, dt.sort_order
         from custom_deductions cd join deduction_types dt on dt.code = cd.type_code where cd.active`)).rows;

    const people: RunEmployee[] = emps
      .filter((e) => (e.active || e.end_date) && (!e.end_date || e.end_date >= h.start))
      .map((e) => ({
        id: e.id as string,
        category: e.category as Category,
        salary: h.salaryOverrides[e.employee_no] ?? Number(e.salary),
        allowance: Number(e.allowance),
        exemptFromTaxCommunityMedical: e.exempt as boolean,
        startDate: e.start_date as string,
        endDate: (e.end_date as string | null) ?? null,
        customDeductions: deds.filter((d) => d.employee_id === e.id).sort((a, b) => a.sort_order - b.sort_order)
          .map((d) => ({ code: d.type_code as string, label: d.label as string, amount: Number(d.amount) })),
        // Credit purchases in the demo data are dated November, so nothing was owed in October.
        creditBalance: 0,
      }));

    const lines = buildRun(people, { start: h.start, end: h.end }, settings);
    const at = (hhmm: string) => `${h.payDate}T${hhmm}:00Z`;

    await c.query('begin');
    try {
      const run = (await c.query(
        `insert into pay_runs (category, period_start, period_end, pay_date, status, settings_snapshot, created_at)
         values ($1, $2, $3, $4, 'draft', $5, $6) returning id`,
        [h.category, h.start, h.end, h.payDate, settings, at('09:00')])).rows[0].id as string;
      for (const l of lines) {
        await c.query(
          `insert into payslips (pay_run_id, employee_id, inputs, result, total_pay, total_deductions, net_pay, employer_pension, credit_carried_forward)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [run, l.employeeId, l.input, l.result, l.result.totalPay, l.result.totalDeductions, l.result.netPay, l.result.employerPension, l.result.creditCarriedForward]);
      }
      await c.query(
        `update pay_runs set status = 'approved', submitted_by = $2, submitted_at = $3, approved_by = $4, approved_at = $5, approval_note = $6 where id = $1`,
        [run, OFFICER.name, at('10:00'), ADMIN.name, at('11:00'), 'Demo history']);
      for (const [when, who, action] of [['09:00', OFFICER, 'run.create'], ['10:00', OFFICER, 'run.submit'], ['11:00', ADMIN, 'run.approve']] as const) {
        await c.query(
          `insert into audit_log (at, actor_role, actor_name, action, entity, entity_id, detail) values ($1, $2, $3, $4, 'pay_run', $5, $6)`,
          [at(when), who.role, who.name, action, run, { note: 'Demo history' }]);
      }
      await c.query('select finalise_pay_run($1, $2, $3, $4)', [run, ADMIN.role, ADMIN.name, at('12:00')]);
      await c.query('commit');
      const t = (await c.query('select total_gross, total_net from pay_runs where id = $1', [run])).rows[0];
      console.log(`${h.category} ${h.payDate}: ${lines.length} employees, gross ${t.total_gross}p, net ${t.total_net}p (finalised)`);
    } catch (e) {
      await c.query('rollback');
      throw e;
    }
  }
}

async function reset(c: Client) {
  console.log('Dropping all payroll tables...');
  await c.query(`drop table if exists payslips, pay_runs, credit_purchases, custom_deductions, employees, pay_grades,
    departments, payroll_settings, deduction_types, category_pay_cycles, audit_log cascade`);
  await c.query('drop function if exists finalise_pay_run(uuid, text, text, timestamptz)');
  await c.query('drop function if exists finalise_pay_run(uuid, text, text)');
  await c.query('drop function if exists lock_finalised_runs() cascade');
  for (const file of ['supabase/schema.sql', 'supabase/seed.sql']) {
    await c.query(fs.readFileSync(path.join(root, file), 'utf8'));
    console.log(`Applied ${file}`);
  }
  await seedHistory(c);
}

(async () => {
  const [command, flag] = process.argv.slice(2);
  if (command !== 'history' && command !== 'reset') {
    console.error('Usage: db.cjs history | reset --yes');
    process.exit(1);
  }
  if (command === 'reset' && flag !== '--yes') {
    console.error('reset DELETES ALL DATA in the database named in apps/web/.env.local. Re-run with --yes to confirm.');
    process.exit(1);
  }
  const c = connection();
  c.on('error', () => { /* a dropped idle connection must not hide the real error */ });
  await c.connect();
  try {
    if (command === 'reset') await reset(c);
    else await seedHistory(c);
    console.log('Done.');
  } finally {
    await c.end().catch(() => {});
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
