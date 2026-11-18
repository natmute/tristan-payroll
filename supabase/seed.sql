-- Prototype seed data. FICTIONAL names only. Run after schema.sql. Safe to re-run.
-- Money is integer pence. Salaries below match the client's sample sheet figures.

insert into departments (name) values
  ('Administration'), ('Education'), ('Health'), ('Fisheries'), ('Public Works'), ('Agriculture')
on conflict (name) do nothing;

insert into pay_grades (code, name) values
  ('G1', 'Grade 1'), ('G2', 'Grade 2'), ('G3', 'Grade 3'), ('G4', 'Grade 4'), ('G5', 'Grade 5'), ('EX', 'Expat / Contractor')
on conflict (code) do nothing;

-- Settings = defaultSettings from packages/payroll-engine/src/settings.ts.
-- Keep in sync with that file (the Settings page edits this row).
insert into payroll_settings (id, settings) values (1, '{
  "categories": {
    "government": {
      "standardHoursPerPeriod": 160,
      "percent": [
        {"code":"tax","label":"Income tax","bps":1300,"enabled":true,"exemptable":true},
        {"code":"pension","label":"Employee pension","bps":750,"enabled":true,"exemptable":false,"employerBps":750},
        {"code":"community","label":"Community service","bps":300,"enabled":true,"exemptable":true},
        {"code":"medical","label":"Medical","bps":400,"enabled":true,"exemptable":true}
      ],
      "flat": [
        {"code":"disaster","label":"Disaster fund","amount":200,"enabled":true,"exemptable":true}
      ]
    },
    "expat_contractor": {
      "standardHoursPerPeriod": 173,
      "percent": [
        {"code":"pension","label":"Employee pension","bps":750,"enabled":false,"exemptable":false,"employerBps":750}
      ],
      "flat": [
        {"code":"cdf","label":"Community Development Fee","amount":1250,"enabled":true,"exemptable":false},
        {"code":"heating_gas","label":"Heating gas","amount":2000,"enabled":true,"exemptable":false}
      ]
    }
  },
  "overtime": {"weekdayAndSaturdayBps":15000,"sundayAndHolidayBps":20000},
  "proRataBasis": "calendar_days"
}'::jsonb)
on conflict (id) do nothing;

-- Employees: (no, first, last, category, dept, grade, title, leave tier, start, salary, allowance, exempt)
insert into employees
  (employee_no, first_name, last_name, email, category, department_id, pay_grade_id, job_title, leave_tier, start_date, salary, allowance, exempt_from_tax_community_medical)
select v.no, v.first, v.last, v.email, v.cat,
       (select id from departments where name = v.dept),
       (select id from pay_grades where code = v.grade),
       v.title, v.tier, v.start::date, v.salary, v.allowance, v.exempt
from (values
  ('G001','Alice','Harbour','alice.harbour@example.test','government','Administration','G3','Administrator','head_deputy_assistant','2012-03-01',  45402, 4974, false),
  ('G002','Brian','Settlement','brian.settlement@example.test','government','Public Works','G2','Plant Operator','standard','2018-06-04', 27186, 4974, false),
  ('G003','Carol','Edinburgh','carol.edinburgh@example.test','government','Health','G5','Head Nurse','head_deputy_assistant','2008-01-14', 84318, 4974, false),
  ('G004','David','Gough','david.gough@example.test','government','Education','G3','Teacher','standard','2015-09-01', 54758, 4974, false),
  ('G005','Elena','Nightingale','elena.nightingale@example.test','government','Fisheries','G1','Fisheries Assistant','standard','2021-02-15', 24978, 4974, false),
  ('G006','Frank','Inaccessible','frank.inaccessible@example.test','government','Agriculture','G2','Farm Hand','standard','2019-05-20', 33396, 0, true),
  ('G007','Grace','Starter','grace.starter@example.test','government','Administration','G1','Clerk (new starter)','standard','2026-11-09', 27186, 4974, false),
  ('X001','Henry','Contractor','henry.contractor@example.test','expat_contractor','Public Works','EX','Visiting Engineer','standard','2026-01-05', 350000, 0, false),
  ('X002','Irene','Expat','irene.expat@example.test','expat_contractor','Education','EX','Visiting Teacher','standard','2026-03-02', 280000, 0, false)
) as v(no, first, last, email, cat, dept, grade, title, tier, start, salary, allowance, exempt)
on conflict (employee_no) do nothing;

-- Custom per-employee deductions (pence per period).
insert into custom_deductions (employee_id, code, label, amount)
select e.id, v.code, v.label, v.amount
from (values
  ('G001','electricity','Electricity', 1500),
  ('G001','posb','POSB savings', 2000),
  ('G002','island_store','Island store', 3000),
  ('G003','internet','Internet', 2500),
  ('G004','agriculture','Agriculture', 800)
) as v(no, code, label, amount)
join employees e on e.employee_no = v.no
where not exists (
  select 1 from custom_deductions c where c.employee_id = e.id and c.code = v.code
);

-- Credit purchases: unsettled balance is deducted from the next salary.
insert into credit_purchases (employee_id, purchase_date, description, amount)
select e.id, v.d::date, v.descr, v.amount
from (values
  ('G002','2026-11-02','Island store credit', 4500),
  ('G005','2026-11-05','Freight charge', 1800)
) as v(no, d, descr, amount)
join employees e on e.employee_no = v.no
where not exists (
  select 1 from credit_purchases c where c.employee_id = e.id and c.description = v.descr
);
