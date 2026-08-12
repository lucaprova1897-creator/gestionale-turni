-- ============================================================
-- GESTIONALE TURNI - Schema multi-tenant per Supabase (Postgres)
-- ============================================================
-- Pensato per servire più strutture (hotel/ristoranti) indipendenti
-- sullo stesso database, con isolamento dati via Row Level Security.

-- ------------------------------------------------------------
-- 1. ORGANIZATIONS (tenant)
-- ------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,          -- usato per URL/login (es. hotel-bellevue)
  type text,                          -- 'hotel', 'ristorante', 'altro' (libero, non enum)
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2. DEPARTMENTS (reparti configurabili per organizzazione)
-- ------------------------------------------------------------
create table departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,                 -- es. "Sala", "Cucina", "Reception", "Spa"
  color text default '#888888',       -- per distinguere visivamente in calendario
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 3. SHIFT_TEMPLATES (fasce orarie tipo, configurabili per organizzazione)
-- ------------------------------------------------------------
create table shift_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,                 -- es. "Mattina", "Pranzo", "Sera", "Spezzato"
  start_time time not null,
  end_time time not null,
  color text default '#4A90D9',
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 4. EMPLOYEES (anagrafica dipendenti)
-- ------------------------------------------------------------
create table employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  full_name text not null,
  role text,                          -- descrittivo libero: "cameriere", "chef de partie", ecc.
  phone text,
  email text,
  active boolean default true,
  contracted_hours numeric,           -- ore contrattuali settimanali (opzionale, per monte ore)
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 5. USERS / PROFILES (collegati a Supabase Auth)
-- ------------------------------------------------------------
-- auth.users è gestita da Supabase Auth; qui estendiamo con ruolo e org
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null, -- collega il login al proprio record dipendente
  role text not null default 'employee' check (role in ('owner', 'admin', 'employee')),
  full_name text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 6. SHIFTS (turni assegnati)
-- ------------------------------------------------------------
create table shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  department_id uuid references departments(id) on delete set null,
  shift_template_id uuid references shift_templates(id) on delete set null, -- null se orario custom
  date date not null,
  start_time time not null,
  end_time time,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'ferie', 'permesso', 'malattia', 'cancelled')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_shifts_org_date on shifts(organization_id, date);
create index idx_shifts_employee_date on shifts(employee_id, date);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table organizations enable row level security;
alter table departments enable row level security;
alter table shift_templates enable row level security;
alter table employees enable row level security;
alter table profiles enable row level security;
alter table shifts enable row level security;

-- Helper: funzione per leggere org e ruolo dell'utente corrente
create or replace function current_user_org() returns uuid as $$
  select organization_id from profiles where id = auth.uid();
$$ language sql stable security definer;

create or replace function current_user_role() returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer;

-- Profiles: ognuno vede/modifica solo il proprio profilo; admin/owner vedono tutti nella org
create policy "profiles_select_own_org" on profiles
  for select using (organization_id = current_user_org());
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

-- Organizations: visibile solo ai membri
create policy "organizations_select_own" on organizations
  for select using (id = current_user_org());

-- Departments / shift_templates / employees: lettura per tutti i membri della org,
-- scrittura solo admin/owner
create policy "departments_select" on departments
  for select using (organization_id = current_user_org());
create policy "departments_write" on departments
  for all using (organization_id = current_user_org() and current_user_role() in ('owner','admin'));

create policy "shift_templates_select" on shift_templates
  for select using (organization_id = current_user_org());
create policy "shift_templates_write" on shift_templates
  for all using (organization_id = current_user_org() and current_user_role() in ('owner','admin'));

create policy "employees_select" on employees
  for select using (organization_id = current_user_org());
create policy "employees_write" on employees
  for all using (organization_id = current_user_org() and current_user_role() in ('owner','admin'));

-- Shifts: tutti i membri vedono i turni della propria org;
-- i dipendenti "employee" vedono anche solo i propri se si vuole restringere ulteriormente
-- (qui lasciamo visibilità a tutta la org, comune nei gestionali turni: si vede il turno di tutti)
create policy "shifts_select" on shifts
  for select using (organization_id = current_user_org());
create policy "shifts_write" on shifts
  for all using (organization_id = current_user_org() and current_user_role() in ('owner','admin'));

-- ------------------------------------------------------------
-- NOTE
-- ------------------------------------------------------------
-- 1. Alla creazione di una nuova organizzazione, il primo utente registrato
--    va impostato manualmente (o via funzione dedicata) come 'owner'.
-- 2. Il collegamento profiles.employee_id permette al dipendente loggato
--    di vedere "il mio turno" filtrando shifts by employee_id.
-- 3. Schema pensato per essere riusabile: employees/departments hanno
--    struttura generica, facilmente mappabile in futuro su altri gestionali
--    (es. gestionale hotel) senza duplicare l'anagrafica.
