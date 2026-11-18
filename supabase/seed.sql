-- Prototype seed data. FICTIONAL names only. Run after schema.sql. Safe to re-run.
-- Money is integer pence. T001-T007 use the anonymised Telecommunications sample sheet
-- (pay date 16 Nov 2026) from CLAUDE.md. Do not add real client data here.

-- TODO(client): real department list and codes are awaited. Codes below are fake placeholders.
insert into departments (code, name, category) values
  ('DEPT-01',  'Telecommunications',              'government'),
  ('DEPT-02',  'Placeholder Government Dept B',   'government'),
  ('DEPT-X1',  'Placeholder Expat Dept',          'expat_contractor')
on conflict (code) do nothing;

-- Client rules: government paid every 4 weeks, expats and contractors monthly around the 20th.
insert into category_pay_cycles (category, cycle, pay_day_of_month) values
  ('government', 'four_weekly', null),
  ('expat_contractor', 'monthly', 20)
on conflict (category) do nothing;

-- TODO(client): grade names and scales unknown. Placeholders only.
insert into pay_grades (code, name) values
  ('G1', 'Grade 1'), ('G2', 'Grade 2'), ('G3', 'Grade 3'), ('G4', 'Grade 4'), ('G5', 'Grade 5'), ('EX', 'Expat / Contractor')
on conflict (code) do nothing;

-- Deduction types, in the client's payslip line order.
-- "Prescriptions" is the sheet's "Medical" custom column. It is NOT the 4% medical tax.
insert into deduction_types (code, label, sort_order) values
  ('electricity',         'Electricity',                10),
  ('prescriptions',       'Medical (prescriptions)',    20),
  ('posb',                'POSB',                       30),
  ('island_store',        'Island Store',               40),
  ('pwd_stores',          'PWD Stores',                 50),
  -- TODO(client): is the 3% transfer commission a fixed rule? The engine adds it (setting transferCommissionBps).
  ('transfers',           'Transfers',                  60),
  ('transfer_commission', 'Transfer commission',        65),
  ('agriculture',         'Agriculture',                70),
  ('misc',                'Miscellaneous',              80),
  ('freight',             'Freight',                    90),
  ('internet',            'Internet rental',           100)
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
  "proRataBasis": "calendar_days",
  "deductionsApplyToOvertime": true,
  "transferCommissionBps": 300
}'::jsonb)
on conflict (id) do nothing;

-- Employees. T001-T007 = sample sheet rows 1-7 (fictional names). T008 = starter for the pro-rata
-- demo. X001-X002 = expat/contractor demo rows; their salaries are PLACEHOLDERS, not client figures.
-- Everyone is on the standard leave tier: the doc does not say who counts as head/deputy/assistant.
insert into employees
  (employee_no, first_name, last_name, email, category, department_id, pay_grade_id, job_title, start_date, salary, allowance, exempt_from_tax_community_medical)
select v.no, v.first, v.last, v.email, v.cat,
       (select id from departments where code = v.dept),
       (select id from pay_grades where code = v.grade),
       v.title, v.start::date, v.salary, v.allowance, v.exempt
from (values
  ('T001','Alice','Marlow',   'alice.marlow@example.test',   'government','DEPT-01','G1','Telecoms Assistant',  '2016-04-04',  33396,    0, true),
  ('T002','Ben','Whitcombe',  'ben.whitcombe@example.test',  'government','DEPT-01','G1','Telecoms Assistant',  '2021-02-15',  27186, 4974, false),
  ('T003','Carol','Thorne',   'carol.thorne@example.test',   'government','DEPT-01','G5','Telecoms Supervisor', '2009-01-12',  84318, 4974, false),
  ('T004','David','Ashby',    'david.ashby@example.test',    'government','DEPT-01','G3','Telecoms Technician', '2014-09-01',  45402, 4974, false),
  ('T005','Elena','Fairfax',  'elena.fairfax@example.test',  'government','DEPT-01','G4','Telecoms Technician', '2012-06-18',  54758, 4974, false),
  ('T006','Frank','Hollis',   'frank.hollis@example.test',   'government','DEPT-01','G3','Telecoms Technician', '2018-11-05',  45402, 4974, false),
  ('T007','Grace','Penhallow','grace.penhallow@example.test','government','DEPT-01','G1','Telecoms Assistant',  '2022-07-11',  24978, 4974, false),
  ('T008','Harriet','Starling','harriet.starling@example.test','government','DEPT-02','G1','Clerk (new starter)', '2026-11-09',  27186, 4974, false),
  ('X001','Isaac','Brandt',   'isaac.brandt@example.test',   'expat_contractor','DEPT-X1','EX','Visiting Engineer', '2026-01-05', 350000,    0, false),
  ('X002','Joanna','Kessler', 'joanna.kessler@example.test', 'expat_contractor','DEPT-X1','EX','Visiting Teacher',  '2026-03-02', 280000,    0, false)
) as v(no, first, last, email, cat, dept, grade, title, start, salary, allowance, exempt)
on conflict (employee_no) do nothing;

-- Custom deductions from the sample sheet, in pence. Transfer commission is added by the engine, not stored.
insert into custom_deductions (employee_id, type_code, amount)
select e.id, v.type_code, v.amount
from (values
  ('T001','posb',        1000),
  ('T001','transfers',   2000),

  ('T002','posb',        4000),
  ('T002','freight',     5000),

  ('T003','electricity', 6816),
  ('T003','prescriptions', 500),
  ('T003','internet',    1800),

  ('T004','prescriptions',2000),
  ('T004','posb',       15378),
  ('T004','pwd_stores',  4000),
  ('T004','transfers',   1000),
  ('T004','internet',     800),

  ('T005','prescriptions', 500),
  ('T005','posb',       11000),
  ('T005','pwd_stores',  3000),
  ('T005','transfers',   5000),
  ('T005','agriculture', 3000),
  ('T005','freight',    10000),

  ('T006','prescriptions', 500),
  ('T006','posb',        5000),
  ('T006','island_store',1500),
  ('T006','internet',     800),

  ('T007','electricity', 1424),
  ('T007','prescriptions', 500),
  ('T007','posb',        5000),
  ('T007','island_store',1000)
) as v(no, type_code, amount)
join employees e on e.employee_no = v.no
where not exists (
  select 1 from custom_deductions c where c.employee_id = e.id and c.type_code = v.type_code
);

-- Credit purchases are on non-sample employees so the sample sheet nets still reconcile.
insert into credit_purchases (employee_id, purchase_date, description, amount)
select e.id, v.d::date, v.descr, v.amount
from (values
  ('T008','2026-11-12','Island store credit', 1800),
  ('X001','2026-11-05','Freight charge',      4500)
) as v(no, d, descr, amount)
join employees e on e.employee_no = v.no
where not exists (
  select 1 from credit_purchases c where c.employee_id = e.id and c.description = v.descr
);
