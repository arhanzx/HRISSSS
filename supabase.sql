-- Nadi HRIS - Supabase schema
-- This version keeps the current vanilla JS app compatible with the database.
-- IMPORTANT: These policies allow anonymous browser access and are ONLY suitable for a prototype.
-- For production HRIS, replace them with Supabase Auth + role-based RLS.

create table if not exists public.employees (
  id text primary key,
  name text not null,
  initials text,
  position text,
  dept text,
  phone text,
  email text,
  join_date date,
  base numeric not null default 0,
  allowance numeric not null default 0,
  deduction numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id text primary key,
  emp_id text not null references public.employees(id) on delete cascade,
  date date not null,
  check_in text,
  check_out text,
  photo_in text,
  photo_out text,
  loc_in text,
  loc_out text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists attendance_emp_date_idx on public.attendance(emp_id, date);

create table if not exists public.leaves (
  id text primary key,
  emp_id text not null references public.employees(id) on delete cascade,
  type text not null,
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'Menunggu',
  applied text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.salary_publications (
  emp_id text not null references public.employees(id) on delete cascade,
  month text not null,
  published boolean not null default false,
  published_at timestamptz,
  admin_override boolean not null default false,
  primary key (emp_id, month)
);

create table if not exists public.salary_edits (
  emp_id text not null references public.employees(id) on delete cascade,
  month text not null,
  components jsonb not null default '{}'::jsonb,
  net_salary numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (emp_id, month)
);

alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.leaves enable row level security;
alter table public.salary_publications enable row level security;
alter table public.salary_edits enable row level security;

-- Prototype policies: allow the browser's anon key to read/write.
-- DELETE these policies when moving to production and replace with authenticated policies.
drop policy if exists "prototype employees all" on public.employees;
create policy "prototype employees all" on public.employees for all to anon, authenticated using (true) with check (true);
drop policy if exists "prototype attendance all" on public.attendance;
create policy "prototype attendance all" on public.attendance for all to anon, authenticated using (true) with check (true);
drop policy if exists "prototype leaves all" on public.leaves;
create policy "prototype leaves all" on public.leaves for all to anon, authenticated using (true) with check (true);
drop policy if exists "prototype salary publications all" on public.salary_publications;
create policy "prototype salary publications all" on public.salary_publications for all to anon, authenticated using (true) with check (true);
drop policy if exists "prototype salary edits all" on public.salary_edits;
create policy "prototype salary edits all" on public.salary_edits for all to anon, authenticated using (true) with check (true);

-- Seed the four demo employees only when the table is empty.
insert into public.employees (id,name,initials,position,dept,phone,email,join_date,base,allowance,deduction)
select * from (values
 ('E01','Aditya Pratama','AP','Frontend Developer','Teknologi','0812-3456-7801','aditya@nadi.co.id','2022-01-12'::date,8500000,1200000,250000),
 ('E02','Sri Wulandari','SW','HR Generalist','Human Resources','0812-3456-7802','sri.w@nadi.co.id','2021-03-03'::date,7800000,1000000,200000),
 ('E03','Budi Santoso','BS','Sales Executive','Marketing','0812-3456-7803','budi.s@nadi.co.id','2023-07-20'::date,6500000,1500000,180000),
 ('E04','Rina Amelia','RA','Finance Staff','Keuangan','0812-3456-7804','rina.a@nadi.co.id','2020-09-08'::date,7200000,900000,220000)
) as seed(id,name,initials,position,dept,phone,email,join_date,base,allowance,deduction)
where not exists (select 1 from public.employees);

insert into public.leaves (id,emp_id,type,start_date,end_date,reason,status,applied)
select 'L01','E03','Cuti Tahunan','2026-09-10','2026-09-12','Acara keluarga di luar kota','Menunggu','28 Agu 2026'
where not exists (select 1 from public.leaves where id='L01');
insert into public.leaves (id,emp_id,type,start_date,end_date,reason,status,applied)
select 'L02','E02','Sakit','2026-08-25','2026-08-26','Demam, surat dokter terlampir','Disetujui','24 Agu 2026'
where not exists (select 1 from public.leaves where id='L02');
