Tristan da Cunha Government Payroll (prototype)

Client: Government of Tristan da Cunha (Paul). Built by Datagrove Tech. Phase: prototype for the demo on Fri 20 Nov 2026. Keep the code simple. A Government IT person should be able to maintain it later.

Stack
Next.js (App Router) + TypeScript + Tailwind, in apps/web
Supabase (Postgres, Storage). For the prototype there is no real auth; a role switcher (admin, payroll officer, employee) is used instead. Real auth and RLS come in the full build.
Payroll engine: packages/payroll-engine. Pure TypeScript with no database, UI or network code and zero runtime dependencies. Fully unit-tested with Vitest.
Payslip PDFs: @react-pdf/renderer.
npm workspaces. Run all tests with npm test.
Hard conventions
Money is integer pence (number holding whole pence). Never floats for money. Convert to pounds only for display.
Rates are basis points (13% = 1300, 7.5% = 750). No float rates.
Each percentage deduction is calculated separately on total pay and rounded to the nearest penny, half-up (money.ts).
Never invent a payroll rule. If something is unclear, make it a setting, choose a safe default, and leave // TODO(client): <question> in the code. Also add it to the list below.
All business rules are editable settings (PayrollSettings), never hard-coded in UI or DB code.
Every page shows the "Prototype, demo data" banner. Seed data uses fictional names only.
Small steps, one commit per step, clear messages.
UI: clean and professional, blue primary colour.
Confidentiality: the repo stays private. Never commit the client's real spreadsheets, payslips or employee data. Use only the anonymised sample figures below, with fictional names.
Business rules (from client)
Currency GBP. Tax year runs December to November. Records kept 7 years.
Two workforce categories only: Government, and Expats and Contractors. (Fish Factory was in the proposal but was removed on the client call. Ignore it.)
Government staff are paid every 4 weeks. Expats and Contractors are paid monthly, around the 20th.
Government (standard), on total pay (salary + allowance): income tax 13%, employee pension 7.5% (employer also 7.5%), community service 3%, medical 4%, plus a flat £2.00 disaster fund. Then custom per-employee deductions (electricity, medical, POSB, island store, stores, transfers, agriculture, freight, internet, etc).
Tax is flat and not cumulative. The client says tax is "calculated on each earning" at 13%: each pay period stands alone, with no bands, tax codes or personal allowances. The proposal's "PAYE Settings" screen must still let an admin edit the rate (see Admin settings below).
Expats and Contractors: no tax, no medical, £12.50 Community Development Fee, £20.00 heating gas. Pension is a setting, default off (unknown).
Overtime: 1.5x on weekdays and Saturdays, 2x on Sundays and public holidays.
Allowances are fixed per period (£49.74 per 4-week period in the sample data). Starters and leavers are paid by days worked.
Credit purchases: the outstanding balance is deducted from the next salary.
Pay grades exist. Annual leave is 15 days (21 after 5 years), or 25 for heads of department, deputies and assistants. Sick leave is 25 days.
Client context (from the questionnaire, calls and proposal DG-2026-TDC-001)
Scale: about 200 employees. About 6 staff run payroll day to day.
Only 2 departments/categories (above). Government departments (e.g. Telecommunications) sit inside the Government category. The full department list and department codes are still awaited from Paul. Use clearly fake placeholder codes and do not invent real ones.
Approver for each stage: the CFO. Post-handover technical administrator: the CFO and/or Finance manager.
Payslips are emailed as a PDF attachment (not a portal link, not password-protected). Email sending is stubbed in the prototype. Employee email is optional: admins must be able to download a payslip PDF and hand it out when an employee has no email.
Payslip logo and look: client will send separately. Use a neutral placeholder.
Data protection: UK GDPR and the Data Protection Act 2018 apply to employee records. Hosting is UK/EU region. Data is encrypted at rest and in transit.
Connectivity is Starlink. Keep pages light and tolerate slow or dropped connections.
Roles: administrator, payroll officer, employee. Employees only ever see their own data.
Audit log: all admin actions, including settings changes and payroll runs, are logged with timestamp and user. The prototype logs the role-switcher user.
An earlier clickable concept prototype exists at https://tdcpayroll.netlify.app (8 screens). Paul has seen it. Keep screen names and navigation consistent unless told otherwise.
Screens promised in the proposal
Admin dashboard: total employees, gross payroll, tax collected, pending actions, start a payroll run.
Department management: create departments, assign employees, set each category's pay cycle.
PAYE / tax settings: admin edits tax rate, pension, community service, medical, fixed fees and thresholds with no developer needed. Every change is logged with a timestamp.
Payslip view: full breakdown of earnings, deductions and net pay. Download PDF and resend to the employee's email.
Employee portal: payslip history, PDF download, leave balances, deduction history.
Scope: Standard tier
In: payroll engine, admin dashboard, pay, overtime, bonus, allowances, deductions, PDF payslips with auto-email, admin settings panel, cloud storage, role-based security, employee self-service portal (payslips, leave balances, deductions).
Out (Premium, not bought): automated leave workflow, loan tracking dashboard, custom reporting and analytics.
Out (explicit exclusions): third-party HR/accounting/ERP integrations, iOS/Android apps, hardware or on-site work, running payroll for the client, migrating historical payroll data from old records or spreadsheets, ongoing tax updates after the support period.
Anything not listed is out. If new requirements appear, flag them rather than quietly building them.
Timeline (agreed with Paul by email)
Prototype ready Fri 20 Nov 2026. Review call Sat 21 or Mon 23 Nov to agree final prototype scope.
Full build starts Tue 24 Nov 2026, up to 7 weeks (to Fri 8 Jan 2027). Week 8 is testing, admin training and handover. Final delivery Fri 15 Jan 2027.
Handover (plan for it from day one)
Client receives full source code, architecture and technical documentation, remote admin training, deployment and hosting setup guidance, and a User Manual (requested by Paul).
Hosting, domain and email accounts must be registered in the Government's name before go-live. Do not tie the code to Datagrove-owned accounts.
Admin-editable settings matter because the client must handle future rate changes without a developer.
Out of scope (prototype)

Integrations, mobile apps, loan tracking, automated leave workflow, analytics, real email sending (stubbed), real auth/RLS, accounting journal export (see Sample data notes).

Sample data: Telecommunications Department, pay date 16 Nov 2026 (anonymised)

Source: the client's salary sheet. 7 employees, all on the 4-weekly cycle. The sheet reconciles to the penny with the rules above, with no half-penny ties. Amounts below are in pounds for readability. The engine and tests use pence. Use these as Vitest fixtures with fictional names.

Percentage deductions are calculated on Total. Pension 7.5%, community service (C/Serv) 3%, income tax 13%, medical tax 4%, plus £2.00 disaster fund (D/Fund).

#	Salary	Allow	Total	Pension	D/Fund	C/Serv	Tax	Med tax	Custom deductions	Net
1	333.96	0.00	333.96	25.05	0.00	0.00	0.00	0.00	POSB 10.00; Transfers 20.00 + 0.60 commission	278.31
2	271.86	49.74	321.60	24.12	2.00	9.65	41.81	12.86	POSB 40.00; Freight 50.00	141.16
3	843.18	49.74	892.92	66.97	2.00	26.79	116.08	35.72	Electricity 68.16; Medical 5.00; Internet 18.00	554.20
4	454.02	49.74	503.76	37.78	2.00	15.11	65.49	20.15	Medical 20.00; POSB 153.78; PWD Stores 40.00; Transfers 10.00 + 0.30 commission; Internet 8.00	131.15
5	547.58	49.74	597.32	44.80	2.00	17.92	77.65	23.89	Medical 5.00; POSB 110.00; PWD Stores 30.00; Transfers 50.00 + 1.50 commission; Agriculture 30.00; Freight 100.00	104.56
6	454.02	49.74	503.76	37.78	2.00	15.11	65.49	20.15	Medical 5.00; POSB 50.00; Island Store 15.00; Internet 8.00	285.23
7	249.78	49.74	299.52	22.46	2.00	8.99	38.94	11.98	Electricity 14.24; Medical 5.00; POSB 50.00; Island Store 10.00	135.91
Total	3154.40	298.44	3452.84	258.96	12.00	93.57	405.46	124.75		1630.52

Employer pension is also 258.96 (7.5% of total pay).

Notes on the sample sheet
"Medical" in the sheet's custom-deduction column is a separate item from the 4% medical tax. The ledger calls it "Prescriptions". Do not merge them.
Employee 1 (333.96, no allowance) pays pension only, with no tax, community service, medical tax or disaster fund. This supports the default disasterFundAppliesToExempt = off.
Transfers include a 3% commission on the amount transferred (20.00 becomes 20.60, 10.00 becomes 10.30, 50.00 becomes 51.50). The sheet's ledger block shows Transfers 80.00 and Commission 2.40 separately.
Payslip line order in the client's current format: Salary, Allowance, Total, Pension, D/Fund, C/Service, Tax, Medical Tax, Elec, Medical, POSB, I/Store, PWD Stores, Transfers, Agric, Misc, Freight, Internet Rental, then the net as "Sub.Total". Follow this order on the payslip PDF.
Current paper process: each employee also gets a signed receipt slip ("No.1 Telcoms" etc.) showing the net amount. The PDF could carry an optional signature block. Ask the client.
Accounting journal ("Audit Trail Template"): the client posts each run to their accounting package as debit/credit journal lines (nominal code, department code, tax code T9, reference "Telecoms Salaries", project TDC-012, cost code LAB1). Telecommunications appears as department code 12 (for example 6003-12). This is an integration, so it is out of scope for the prototype. Do not hard-code ledger codes. Keep each deduction type as its own named item so a ledger code can be attached later.
Open questions for the client (each one is a setting or flag with a TODO in code)
Do expats/contractors pay pension? Setting expatPensionEnabled, default off.
Fixture employee on 333.96 pays pension only, with no tax, community or medical. What is the rule? For now this is the employee flag exemptFromTaxCommunityMedical. Does the £2 disaster fund apply to them? Setting disasterFundAppliesToExempt, default off. (The sample sheet shows £0 disaster fund for them, and the ledger total of £12 is 6 × £2.)
Overtime hourly rate: what basis (hours per week/period)? Setting standardHoursPerPeriod.
Starters/leavers pro-rata: calendar days or working days? Setting proRataBasis.
Rounding when exactly half a penny: half-up assumed (no fixture hits a tie, checked against the sample sheet).
Credit balance larger than net pay: cap and carry forward, or allow negative? Prototype caps at net pay and carries the rest forward.
Are 4-weekly and monthly rates identical? Assumed yes.
Expat flat fees (CDF, heating gas): full amount for part-period starters, or pro-rata? Assumed full.
Do tax, pension, community service and medical (4%) apply to overtime pay as well as salary + allowance? The questionnaire says 13% "on all earnings", but the sample sheet only shows salary + allowance. Setting deductionsApplyToOvertime, default on.
Transfers: is the 3% commission a fixed rule? Setting transferCommissionBps, default 300 (seen in the sample, to be confirmed).
The sheet has an "FTN" column that is zero for everyone. What is it? Not modelled until the client explains.
Ledger labels do not match between the salary sheet and the audit-trail template (for example Freight 150.00 appears as "Internet & TV Licences", Internet 34.00 as "Miscellaneous", and Transfers as "PWD Mechanical"). Only matters if a journal export is added later.
How does a pay period relate to the pay date? Assumed: the period ends on the pay date and starts the day after the previous pay date (28 days for four-weekly). Both dates are editable when setting up a run.
What net-pay change against the previous run should be flagged? Setting netChangeWarningBps, default 1000 (10%).
Working-days pro-rata: are public holidays excluded? Currently only weekends are (setting proRataBasis = working_days).
What counts as "needs attention" on the CFO's dashboard? The current list is a sensible default.
Data residency: where does the Government want data held, and where does the Starlink traffic exit? The Supabase project is in eu-west-1 (Ireland). The region cannot be changed later without a migration.
Day plan (tracked)
[x] Mon: scaffold, CLAUDE.md, engine with passing tests
[x] Tue: Supabase schema, seed, employees, departments, grades
[ ] Wed: payroll run, payslip PDF, credit purchases, expat rules
[ ] Thu: dashboard, settings page, portal, polish, deploy (Vercel)
[ ] Fri: buffer and rehearsal
Where we are: see docs/PROGRESS.md (status, what is built, what is next, how to run). Ideas outside scope go in docs/PARKED_IDEAS.md.