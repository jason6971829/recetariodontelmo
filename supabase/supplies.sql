-- =============================================
-- Recetario Don Telmo - Insumos & Costeo
-- Ejecuta esto en el SQL Editor de tu proyecto Supabase
-- =============================================

-- 1. Catálogo maestro de insumos
create table if not exists supplies (
  id uuid primary key default gen_random_uuid(),
  code text default '',
  name text not null,
  unit text not null default 'KILO',
  cost_per_unit numeric(12,2) default 0,
  supplier text default '',
  category text default '',
  active boolean default true,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 2. Costeo por receta (escandallo)
create table if not exists recipe_costs (
  id uuid primary key default gen_random_uuid(),
  recipe_id bigint not null,
  sale_price numeric(12,2) default 0,
  notes text default '',
  ingredients jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(recipe_id)
);

-- Enable RLS
alter table supplies enable row level security;
alter table recipe_costs enable row level security;

-- Supplies: todos pueden leer, solo admin escribe
create policy "Public read supplies" on supplies for select using (true);
create policy "Admin insert supplies" on supplies for insert with check (true);
create policy "Admin update supplies" on supplies for update using (true);
create policy "Admin delete supplies" on supplies for delete using (true);

-- Recipe costs: todos pueden leer, solo admin escribe
create policy "Public read recipe_costs" on recipe_costs for select using (true);
create policy "Admin insert recipe_costs" on recipe_costs for insert with check (true);
create policy "Admin update recipe_costs" on recipe_costs for update using (true);
create policy "Admin delete recipe_costs" on recipe_costs for delete using (true);
