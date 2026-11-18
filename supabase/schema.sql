-- Tristan da Cunha payroll: prototype schema.
-- Run once in the Supabase SQL Editor. Safe to re-run (uses IF NOT EXISTS).
-- Conventions: money = integer pence (bigint). Rates live in payroll_settings (basis points).
-- Prototype: no auth and no RLS. Only ever use the service role key in server-side code.

create extension if not exists "pgcrypto";

create table if not exists departments (
  id       uuid primary key default gen_random_uuid(),
  -- TODO(client): full department list and real department codes are awaited from Paul.
  -- Codes here are fake placeholders. Do not put real ledger codes in this column.
  code     text not null unique,
  name     text not null unique,
  category text not null check (category in ('government', 'expat_contractor'))
);

-- Pay cycle per category (editable on the Department management screen).
create table if not exists category_pay_cycles (
  category         text primary key check (category in ('government', 'expat_contractor')),
  cycle            text not null check (cycle in ('four_weekly', 'monthly')),
  pay_day_of_month int check (pay_day_of_month between 1 and 31), -- monthly cycles only
  anchor_pay_date  date  -- a known pay date; four-weekly pay dates repeat every 28 days from it
);
alter table category_pay_cycles add column if not exists anchor_pay_date date;

-- Each deduction type is its own named item so a ledger code can be attached later.
-- sort_order follows the client's current payslip line order.
create table if not exists deduction_types (
  code        text primary key,
  label       text not null,
  sort_order  int not null,
  ledger_code text  -- TODO(client): accounting journal export is out of scope. Leave empty.
);

-- Admin actions (settings changes, payroll runs). The prototype logs the role-switcher user.
create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  at         timestamptz not null default now(),
  actor_role text not null,
  actor_name text not null,
  action     text not null,
  entity     text,
  entity_id  text,
  detail     jsonb
);

create table if not exists pay_grades (
  id   uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
  -- TODO(client): do pay grades carry fixed salary scales? Add columns once known.
);

create table if not exists employees (
  id              uuid primary key default gen_random_uuid(),
  employee_no     text not null unique,
  first_name      text not null,
  last_name       text not null,
  email           text,
  category        text not null check (category in ('government', 'expat_contractor')),
  department_id   uuid references departments(id),
  pay_grade_id    uuid references pay_grades(id),
  job_title       text,
  -- Annual leave tier: 25 days for heads of department, deputies and assistants.
  -- 15 days (21 after 5 years) is worked out from start_date by the app.
  leave_tier      text not null default 'standard' check (leave_tier in ('standard', 'head_deputy_assistant')),
  start_date      date not null,
  end_date        date,                              -- leavers
  salary          bigint not null check (salary >= 0),    -- pence, per pay period
  allowance       bigint not null default 0 check (allowance >= 0), -- pence, per pay period
  -- TODO(client): rule unknown for staff who pay pension only. Flag for now.
  exempt_from_tax_community_medical boolean not null default false,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Per-employee deductions: electricity, POSB, island store, freight, internet, etc.
create table if not exists custom_deductions (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  type_code   text not null references deduction_types(code),
  amount      bigint not null check (amount >= 0),   -- pence per period
  active      boolean not null default true
);

-- Credit purchases: unsettled balance is deducted from the next salary.
create table if not exists credit_purchases (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id) on delete cascade,
  purchase_date date not null default current_date,
  description   text,
  amount        bigint not null check (amount > 0), -- pence
  settled       boolean not null default false
);

-- One row only. `settings` holds the PayrollSettings JSON from packages/payroll-engine.
create table if not exists payroll_settings (
  id         int primary key default 1 check (id = 1),
  settings   jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists pay_runs (
  id           uuid primary key default gen_random_uuid(),
  category     text not null check (category in ('government', 'expat_contractor')),
  period_start date not null,
  period_end   date not null,
  pay_date     date not null,
  status       text not null default 'draft' check (status in ('draft', 'approved')),
  created_at   timestamptz not null default now()
);

create table if not exists payslips (
  id               uuid primary key default gen_random_uuid(),
  pay_run_id       uuid not null references pay_runs(id) on delete cascade,
  employee_id      uuid not null references employees(id),
  result           jsonb not null,                   -- full PayslipResult from the engine
  total_pay        bigint not null,
  total_deductions bigint not null,
  net_pay          bigint not null,
  pdf_path         text,                             -- path in the 'payslips' storage bucket
  unique (pay_run_id, employee_id)
);

create index if not exists employees_category_idx on employees(category);
create index if not exists payslips_employee_idx on payslips(employee_id);

-- Lock down: RLS on with no policies, so the public anon key can read nothing.
-- The server uses the service role key, which bypasses RLS.
-- TODO(full build): add real policies per role when auth is added.
alter table departments       enable row level security;
alter table category_pay_cycles enable row level security;
alter table deduction_types   enable row level security;
alter table audit_log         enable row level security;
alter table pay_grades        enable row level security;
alter table employees         enable row level security;
alter table custom_deductions enable row level security;
alter table credit_purchases  enable row level security;
alter table payroll_settings  enable row level security;
alter table pay_runs          enable row level security;
alter table payslips          enable row level security;

-- Needed if "grant API access to new tables automatically" is switched off.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;

-- Private bucket for payslip PDFs (records kept 7 years).
insert into storage.buckets (id, name, public)
values ('payslips', 'payslips', false)
on conflict (id) do nothing;
