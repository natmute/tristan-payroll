# Progress and handover notes

Last updated: Thu 19 Nov 2026 (end of Thursday's session). Demo: Fri 20 Nov 2026.
The rules, conventions and open questions live in `CLAUDE.md`. This file records **where the build stands**.

## How to run it

1. `npm install` at the repo root.
2. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in the Supabase values (Project Settings > API).
   Never commit `.env.local`. `DATABASE_URL` is only used by one-off setup scripts, not by the app.
   The password in `DATABASE_URL` must **not** be wrapped in the template's square brackets.
3. In the Supabase SQL Editor, run `supabase/schema.sql`, then `supabase/seed.sql`. Both are safe to re-run.
4. `npm run dev`, then open http://localhost:3000.
5. `npm test` runs the engine tests (75 at the time of writing).
6. `npm run db:history` adds the two finalised October demo runs (safe to re-run, adds only).
   `npm run db:reset` wipes the database and re-seeds everything, including that history. It deletes all data in the
   project named in `.env.local`, so use it on the demo database only. **It has not been run yet**: the automated
   permission check blocked it as destructive. Run it once yourself before relying on it.

Supabase project region is eu-west-1 (Ireland). Hosting must be UK/EU. See the data-residency question below.

## What is built

**Payroll engine** (`packages/payroll-engine`, no dependencies, all in pence and basis points)
- **Overtime entry** (Payroll > a draft run > Enter overtime): hours per employee for weekday, Saturday, Sunday and public holiday. Saving recalculates each payslip with the run's own settings. Hours survive Recalculate. Read-only once the run is submitted.
- **Year to date** on every payslip, screen and PDF: total pay, income tax, employee pension and net pay for the tax year (setting `taxYearStartMonth`, default December), from the employee's finalised payslips up to and including this one. On a draft it adds this payslip to the finalised ones.
- Payslip calculation, overtime, part-period pay, credit cap and carry-forward, expat rule set.
- `buildRun` (who is in a period, starters and leavers by days worked), `checkRun` (blocking errors and warnings),
  `compareRuns` (totals and flagged net changes with reasons), `nextPayDate` and `payDatesAround`.
- The 7-employee Telecommunications sample sheet reproduces to the penny, including net pay and totals.

**Database** (`supabase/`)
- Tables for departments, pay grades, employees, deduction types, custom deductions, credit purchases,
  settings (one JSON row), pay cycles, pay runs, payslips and the audit log. RLS is on with no policies, so the public
  key reads nothing. Only the server (service role) touches data.
- A finalised run and its payslips are locked by database triggers. `finalise_pay_run()` finalises in one transaction.
- Seed: fictional names only. T001-T007 are the sample sheet, T008 a starter, X001-X002 placeholder expats.

**App** (`apps/web`, Next.js + Tailwind, blue theme; the "Prototype, demo data" banner was removed on 20 Nov 2026)
- Role switcher in the header: three buttons (Administrator, Payroll officer, Employee), one click each, the current role highlighted. Staff also get a
  "Employee view for" picker. An Employee sees no picker and no list of colleagues, only their own name. A browser with no choice made starts as Administrator.
  Employees see no staff screens.
- Dashboard (a different page for each role): the Administrator (approver) sees what is waiting for approval or finalising first, then the finance
  figures (including deductions and tax collected), settings in force or scheduled, recent activity and data to fix. The Payroll officer sees the next
  pay dates with a Start a run button, their own runs in progress and what to fix before the next run, with headcount and pay figures only.
  The Employee sees their own portal. (Earlier line follows.) Dashboard: KPIs (projected until a run is finalised), pending actions, by-category table, recent runs, departments.
- Employees: list with filters, detail page with a calculation preview, add and edit, recurring deductions, credit purchases.
- Departments and Pay grades: list, add and edit (administrators only).
- Payroll: list, set up, review (checks, comparison, lines, settings applied), approve, finalise, per-employee breakdown.
- Payslip: on-screen payslip and a PDF (`@react-pdf/renderer`) built from one shared data shape (`apps/web/lib/payslip.ts`).
  Client line order, statutory lines always shown, transfers as one line with the commission shown on screen, employer pension
  as a separate contribution line, a DRAFT notice until the run is finalised. Download PDF, Print, and a stubbed
  "Resend email" (audit entry, nothing sent). Employees with no email get a "download and hand out" message.
  Payslips list every deduction line even at 0.00, like the client's paper payslip (setting `payslipShowAllLines`, on by default; turn it off in Settings to show only lines that apply).
  The Tristan da Cunha coat of arms is on the payslip, the PDF, the header and the tab icon (`apps/web/public/logo.png`; the PDF uses a copy embedded in `apps/web/lib/logo.ts`, so replace both if the logo changes).
- Payment summary and receipt slips (`/payroll/<run>/payments`): a printable list of net pay per employee, or one receipt slip each in the paper format
  (Name, Date, "No.1 Telecommunications", Signature line, Total). Signature on or off. Linked from the run page.
- Demo history: two finalised runs (Government 19 Oct, Expats 20 Oct) generated with the engine. The 16 Nov Government run
  compares against the October one (flags one salary change and one new starter).
- Tax & Deduction Settings (`/settings`): every change is a new version with an effective date and a reason. A run uses the version in force
  on its pay date and keeps a copy. Admins edit, payroll officers view. Settings that still depend on a client answer carry a
  "needs client confirmation" tag. Leave entitlements are settings too.
- Audit Log (`/audit`, admin only): filter by area, who and date; shows before/after and settings changes in plain English. Role switches are logged.
- Employee portal, laid out as tiles like other payroll self-service homes (title bar, summary, link to the detail): My Latest Payslip (with next pay date),
  My Time Off (annual and sick, with meters), My Pension (what you pay and what the employer pays), My Pay History (with tax withheld), My Deductions. Employees see only their own
  finalised data (other people's payslips are 404/403). The header gains an employee picker when the Employee role is chosen.
- Leave (`/leave`): entitlements from settings and start dates; taken is entered by hand (admin). No requests or approvals.
- Demo access gate: set `DEMO_ACCESS_CODE` and every page asks for it first (the prototype has no login). See `docs/DEPLOY.md`.
- Every database call has a timeout; reads retry; slow calls are logged (Starlink can stall).

## Status against the day plan

| Day | Item | State |
|---|---|---|
| Mon | Scaffold, CLAUDE.md, engine | Done |
| Tue | Schema, seed, employees, departments, grades | Done |
| Wed | Payroll run | Done (set up, review, approve, finalise, lock) |
| Wed | Credit purchases | Done (record, deduct on finalise, part payments) |
| Wed | Expat rules | Done (engine, seeded 20 Oct run, expat payslip checked in the browser) |
| Wed | Payslip PDF | Done (screen, PDF, print, stubbed resend) |
| Thu | Settings page with versioning | Done |
| Thu | Audit log screen | Done |
| Thu | Employee portal and leave display | Done |
| Thu | Dashboard (actual figures, working New run button) | Done |
| Thu | Vercel deploy | **Prepared, not deployed.** Needs a decision on which account and the access code. See `docs/DEPLOY.md` |
| Fri | Buffer and rehearsal | |

## Not built yet, in the order I would do it

1. **Deploy to Vercel** (guide in `docs/DEPLOY.md`).
3. **Correction runs.** Today a second run for the same category and pay date is refused, so a finalised mistake cannot yet be corrected.
5. Sidebar layout (the kickoff prompt asked for one; we kept the top header on request).
6. Move the test scripts into the repo (see below), and run `npm run db:reset` once to confirm it works.

## Test tooling is not in the repo

The browser and database tests used during the build live in a temporary folder outside the repo, and may be cleared.
They covered: editing flows (23 checks), the payroll run flow (34 checks), the payslip and PDF flow (31 checks, including
reading the text back out of the generated PDF), settings, audit, portal, leave and dashboard (63 checks, including a scan
of every staff page for duplicate ids), and the database lock and finalise function (12 checks).
They need `playwright-core` driving Chrome, and `pg`. Worth moving into a `scripts/` or `tests/e2e/` folder before the full build.
Those scripts create their own test rows and remove them afterwards. To remove the lock triggers for cleanup they run
`alter table ... disable trigger` and always re-enable it.

## New open questions for the client (also added to CLAUDE.md)

- How does a pay period relate to the pay date? Assumed: it ends on the pay date and starts the day after the previous one (28 days for four-weekly).
- What net-pay change should be flagged against the previous run? Setting `netChangeWarningBps`, default 1000 (10%).
- Working-days pro-rata: are public holidays excluded? Currently only weekends.
- What counts as "needs attention" on the CFO's dashboard? Current list is a sensible default.
- Data residency: where does the Government want the data held, and where does the Starlink traffic exit? Region cannot be changed later without a migration.

## Known rough edges

- **Stray audit rows.** Test rows from 19 and 20 Nov remain in the audit log (4 role switches, plus the create and delete of a rehearsal draft run).
  The database refused to let me delete audit rows, which is correct. Remove them in the Supabase SQL editor if you want a clean demo log:
  `delete from audit_log where at >= '2026-11-19' and action in ('role.switch','run.create','run.delete','run.overtime','payslip.download');`
  These show up under "Recent activity" on the Administrator dashboard, so clear them before a demo.
- The Employee role currently has no way to open staff payslip pages (by design). Real login replaces the demo employee picker in the full build.
- `npm audit` reports issues in build-time tooling (Vitest/Vite/esbuild, PostCSS inside Next). None handle user input. Revisit at deploy.
- First page load after a rebuild can take a few seconds (Supabase round trips are 300-900 ms from the dev machine).
- Dashboard figures are projections until a run is finalised, and say so.
- Email is stubbed. Real auth and RLS policies come in the full build (24 Nov).

## Commit history (newest first)

e274122 payroll run flow · 1da1438 run lifecycle in the database · 5a3c880 engine run logic · 35fab68 dashboard ·
dde335f pay dates and anchor · 2a5e5e0 editing and audit log · 83cb841 tick Tuesday · e7f8956 employees, departments, grades pages ·
1587c7f root scripts · dfb2f07 app scaffold · fec1f25 engine settings and sample-sheet tests · c89d3f9 CLAUDE.md update ·
ce682bd schema aligned to client context · 3f5ead5 RLS lockdown · cc6ad5c schema and seed · 991d108 engine · ffd8334 scaffold
