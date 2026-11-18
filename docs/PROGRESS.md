# Progress and handover notes

Last updated: Wed 18 Nov 2026 (end of Wednesday's session). Demo: Fri 20 Nov 2026.
The rules, conventions and open questions live in `CLAUDE.md`. This file records **where the build stands**.

## How to run it

1. `npm install` at the repo root.
2. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in the Supabase values (Project Settings > API).
   Never commit `.env.local`. `DATABASE_URL` is only used by one-off setup scripts, not by the app.
   The password in `DATABASE_URL` must **not** be wrapped in the template's square brackets.
3. In the Supabase SQL Editor, run `supabase/schema.sql`, then `supabase/seed.sql`. Both are safe to re-run.
4. `npm run dev`, then open http://localhost:3000.
5. `npm test` runs the engine tests (67 at the time of writing).

Supabase project region is eu-west-1 (Ireland). Hosting must be UK/EU. See the data-residency question below.

## What is built

**Payroll engine** (`packages/payroll-engine`, no dependencies, all in pence and basis points)
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

**App** (`apps/web`, Next.js + Tailwind, blue theme, "Prototype, demo data" banner on every page)
- Role switcher (Administrator, Payroll officer, Employee) in the header. Employees see no staff screens.
- Dashboard: KPIs (projected until a run is finalised), pending actions, by-category table, recent runs, departments.
- Employees: list with filters, detail page with a calculation preview, add and edit, recurring deductions, credit purchases.
- Departments and Pay grades: list, add and edit (administrators only).
- Payroll: list, set up, review (checks, comparison, lines, settings applied), approve, finalise, per-employee breakdown.
- Audit log rows are written for every change. There is no screen to view them yet.
- Every database call has a timeout; reads retry; slow calls are logged (Starlink can stall).

## Status against the day plan

| Day | Item | State |
|---|---|---|
| Mon | Scaffold, CLAUDE.md, engine | Done |
| Tue | Schema, seed, employees, departments, grades | Done |
| Wed | Payroll run | Done (set up, review, approve, finalise, lock) |
| Wed | Credit purchases | Done (record, deduct on finalise, part payments) |
| Wed | Expat rules | Engine done and tested. Not yet run through the browser |
| Wed | Payslip PDF | **Not started** |
| Thu | Settings page with versioning, audit log screen, employee portal, leave, polish, Vercel deploy | Not started |
| Fri | Buffer and rehearsal | |

## Not built yet, in the order I would do it

1. **Historical runs in the seed.** The comparison screen says "no earlier run" until one is finalised, and the demo script
   expects previous runs. Plan: a repeatable script that builds a 19 Oct Government run and a 20 Oct Expats run with
   the engine's `buildRun`, then finalises them. Needs a bundled TS script (esbuild is already installed) and `pg`.
2. **Payslip view and PDF** (`@react-pdf/renderer`), stubbed email, "Download PDF" and "Resend email" with audit entries.
   The line page at `/payroll/[id]/[lineId]` already has the breakdown in the client's order.
3. **Overtime entry** on the review step. The engine supports it. There is no screen to enter hours.
4. **Payment summary**, printable, with an optional signature column.
5. **Correction runs.** Today a second run for the same category and pay date is refused, so a finalised mistake cannot yet be corrected.
6. **Tax & Deduction Settings** page with effective dates, reasons and versions, and an **Audit Log** screen.
7. **Employee portal** and **Leave** display.
8. **Reset script**: one command to wipe and re-seed (`npm run db:reset`).
9. Sidebar layout (the kickoff prompt asked for one; we kept the top header on request).

## Test tooling is not in the repo

The browser and database tests used during the build live in a temporary folder outside the repo, and may be cleared.
They covered: editing flows (23 checks), the payroll run flow (34 checks), and the database lock and finalise function (12 checks).
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

- `npm audit` reports issues in build-time tooling (Vitest/Vite/esbuild, PostCSS inside Next). None handle user input. Revisit at deploy.
- First page load after a rebuild can take a few seconds (Supabase round trips are 300-900 ms from the dev machine).
- Dashboard figures are projections until a run is finalised, and say so.
- Email is stubbed. Real auth and RLS policies come in the full build (24 Nov).

## Commit history (newest first)

e274122 payroll run flow · 1da1438 run lifecycle in the database · 5a3c880 engine run logic · 35fab68 dashboard ·
dde335f pay dates and anchor · 2a5e5e0 editing and audit log · 83cb841 tick Tuesday · e7f8956 employees, departments, grades pages ·
1587c7f root scripts · dfb2f07 app scaffold · fec1f25 engine settings and sample-sheet tests · c89d3f9 CLAUDE.md update ·
ce682bd schema aligned to client context · 3f5ead5 RLS lockdown · cc6ad5c schema and seed · 991d108 engine · ffd8334 scaffold
