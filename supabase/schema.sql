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

-- ---------------------------------------------------------------------------
-- Payroll run lifecycle: draft -> in_review -> approved -> finalised.
-- A finalised run is locked for good. A mistake is fixed with a correction run.
-- ---------------------------------------------------------------------------
alter table pay_runs drop constraint if exists pay_runs_status_check;
alter table pay_runs add constraint pay_runs_status_check
  check (status in ('draft', 'in_review', 'approved', 'finalised'));

alter table pay_runs add column if not exists department_id     uuid references departments(id);
alter table pay_runs add column if not exists settings_snapshot jsonb;  -- the exact settings used, kept with the run
alter table pay_runs add column if not exists submitted_by      text;
alter table pay_runs add column if not exists submitted_at      timestamptz;
alter table pay_runs add column if not exists approved_by       text;
alter table pay_runs add column if not exists approved_at       timestamptz;
alter table pay_runs add column if not exists approval_note     text;
alter table pay_runs add column if not exists finalised_by      text;
alter table pay_runs add column if not exists finalised_at      timestamptz;
alter table pay_runs add column if not exists total_gross       bigint;
alter table pay_runs add column if not exists total_deductions  bigint;
alter table pay_runs add column if not exists total_net         bigint;
alter table pay_runs add column if not exists employer_pension  bigint;

-- payslips.result is the engine's full PayslipResult; inputs is everything the calculation used.
alter table payslips add column if not exists inputs jsonb;
alter table payslips add column if not exists employer_pension bigint not null default 0;
alter table payslips add column if not exists credit_carried_forward bigint not null default 0;

-- Credit purchases can be part-paid: `paid` is how much has been deducted so far.
alter table credit_purchases add column if not exists paid bigint not null default 0;
alter table credit_purchases add column if not exists settled_run_id uuid references pay_runs(id);

-- Nothing about a finalised run may change, and none of its payslips either.
create or replace function lock_finalised_runs() returns trigger
language plpgsql as $$
declare run_status text;
begin
  if tg_table_name = 'pay_runs' then
    if old.status = 'finalised' then
      raise exception 'A finalised payroll run cannot be changed. Create a correction run instead.';
    end if;
  else
    select status into run_status from pay_runs where id = coalesce(new.pay_run_id, old.pay_run_id);
    if run_status = 'finalised' then
      raise exception 'Payslips in a finalised payroll run cannot be changed. Create a correction run instead.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists pay_runs_lock on pay_runs;
create trigger pay_runs_lock before update or delete on pay_runs
  for each row execute function lock_finalised_runs();
drop trigger if exists payslips_lock on payslips;
create trigger payslips_lock before insert or update or delete on payslips
  for each row execute function lock_finalised_runs();

-- Finalise in one transaction: settle credit purchases (oldest first), store totals, lock the run,
-- write the audit entry. If any step fails, nothing changes.
create or replace function finalise_pay_run(p_run uuid, p_actor_role text, p_actor_name text) returns void
language plpgsql as $$
declare
  r pay_runs;
  ps record;
  cp record;
  remaining bigint;
  taking bigint;
begin
  select * into r from pay_runs where id = p_run for update;
  if not found then raise exception 'Payroll run not found.'; end if;
  if r.status <> 'approved' then raise exception 'Only an approved run can be finalised.'; end if;

  for ps in
    select employee_id,
           coalesce((select sum((d->>'amount')::bigint)
                       from jsonb_array_elements(result->'deductions') d
                      where d->>'code' = 'credit'), 0) as credit_taken
      from payslips where pay_run_id = p_run
  loop
    remaining := ps.credit_taken;
    for cp in
      select id, amount, paid from credit_purchases
       where employee_id = ps.employee_id and settled = false
       order by purchase_date, id for update
    loop
      exit when remaining <= 0;
      taking := least(remaining, cp.amount - cp.paid);
      update credit_purchases
         set paid = cp.paid + taking,
             settled = (cp.paid + taking >= cp.amount),
             settled_run_id = case when cp.paid + taking >= cp.amount then p_run else null end
       where id = cp.id;
      remaining := remaining - taking;
    end loop;
  end loop;

  update pay_runs set
    status = 'finalised', finalised_at = now(), finalised_by = p_actor_name,
    total_gross      = (select coalesce(sum(total_pay), 0)        from payslips where pay_run_id = p_run),
    total_deductions = (select coalesce(sum(total_deductions), 0) from payslips where pay_run_id = p_run),
    total_net        = (select coalesce(sum(net_pay), 0)          from payslips where pay_run_id = p_run),
    employer_pension = (select coalesce(sum(employer_pension), 0) from payslips where pay_run_id = p_run)
  where id = p_run;

  insert into audit_log (actor_role, actor_name, action, entity, entity_id, detail)
  values (p_actor_role, p_actor_name, 'run.finalise', 'pay_run', p_run::text,
          jsonb_build_object('pay_date', r.pay_date, 'category', r.category));
end $$;

-- Only the server (service role) may call this. It must not be reachable from the public API.
revoke execute on function finalise_pay_run(uuid, text, text) from public, anon, authenticated;
grant execute on function finalise_pay_run(uuid, text, text) to service_role;

-- Private bucket for payslip PDFs (records kept 7 years).
insert into storage.buckets (id, name, public)
values ('payslips', 'payslips', false)
on conflict (id) do nothing;
