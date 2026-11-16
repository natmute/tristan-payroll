# Tristan da Cunha Government Payroll (prototype)

Client: Government of Tristan da Cunha (Paul). Built by Datagrove Tech.
Phase: **prototype** for the demo on Fri 20 Nov 2026. Keep the code simple. A Government IT person should be able to maintain it later.

## Stack
- Next.js (App Router) + TypeScript + Tailwind, in `apps/web`
- Supabase (Postgres, Storage). For the prototype there is **no real auth**; a role switcher (admin, payroll officer, employee) is used instead. Real auth and RLS come in the full build.
- Payroll engine: `packages/payroll-engine`. Pure TypeScript with **no database, UI or network code** and zero runtime dependencies. Fully unit-tested with Vitest.
- Payslip PDFs: `@react-pdf/renderer`.
- npm workspaces. Run all tests with `npm test`.

## Hard conventions
- **Money is integer pence** (`number` holding whole pence). Never floats for money. Convert to pounds only for display.
- **Rates are basis points** (13% = 1300, 7.5% = 750). No float rates.
- Each percentage deduction is calculated **separately on total pay** and rounded to the nearest penny, half-up (`money.ts`).
- **Never invent a payroll rule.** If something is unclear, make it a setting, choose a safe default, and leave `// TODO(client): <question>` in the code. Also add it to the list below.
- All business rules are **editable settings** (`PayrollSettings`), never hard-coded in UI or DB code.
- Every page shows the "Prototype, demo data" banner. Seed data uses fictional names only.
- Small steps, one commit per step, clear messages.
- UI: clean and professional, blue primary colour.

## Business rules (from client)
- Currency GBP. Tax year runs December to November. Records kept 7 years.
- Two workforce categories only: **Government**, and **Expats and Contractors**.
- Government staff are paid every 4 weeks. Expats and Contractors are paid monthly, around the 20th.
- **Government (standard)**, on total pay (salary + allowance): income tax 13%, employee pension 7.5% (employer also 7.5%), community service 3%, medical 4%, plus a flat £2.00 disaster fund. Then custom per-employee deductions (electricity, medical, POSB, island store, stores, transfers, agriculture, freight, internet, etc).
- **Expats and Contractors**: no tax, no medical, £12.50 Community Development Fee, £20.00 heating gas. Pension is a setting, default **off** (unknown).
- Overtime: 1.5x on weekdays and Saturdays, 2x on Sundays and public holidays.
- Allowances are fixed per period. Starters and leavers are paid by days worked.
- Credit purchases: the outstanding balance is deducted from the next salary.
- Pay grades exist. Annual leave is 15 days (21 after 5 years), or 25 for heads of department, deputies and assistants. Sick leave is 25 days.

## Out of scope (prototype)
Integrations, mobile apps, loan tracking, automated leave workflow, analytics, real email sending (stubbed), real auth/RLS.

## Open questions for the client (each one is a setting or flag with a TODO in code)
1. Do expats/contractors pay pension? Setting `expatPensionEnabled`, default off.
2. Fixture employee on 333.96 pays pension only, with no tax, community or medical. What is the rule? For now this is the employee flag `exemptFromTaxCommunityMedical`. Does the £2 disaster fund apply to them? Setting `disasterFundAppliesToExempt`, default off.
3. Overtime hourly rate: what basis (hours per week/period)? Setting `standardHoursPerPeriod`.
4. Starters/leavers pro-rata: calendar days or working days? Setting `proRataBasis`.
5. Rounding when exactly half a penny: half-up assumed (no fixture hits a tie).
6. Credit balance larger than net pay: cap and carry forward, or allow negative? Prototype caps at net pay and carries the rest forward.
7. Are 4-weekly and monthly rates identical? Assumed yes.
8. Expat flat fees (CDF, heating gas): full amount for part-period starters, or pro-rata? Assumed full.

## Day plan (tracked)
- [x] Mon: scaffold, CLAUDE.md, engine with passing tests
- [ ] Tue: Supabase schema, seed, employees, departments, grades
- [ ] Wed: payroll run, payslip PDF, credit purchases, expat rules
- [ ] Thu: dashboard, settings page, portal, polish, deploy (Vercel)
- [ ] Fri: buffer and rehearsal
