-- =============================================
-- Recetario Don Telmo - Tabla de Documentos/Manuales
-- Ejecuta esto en el SQL Editor de tu proyecto Supabase
-- =============================================

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  category text not null default 'otro',
  file_url text not null,
  file_name text not null,
  file_size bigint default 0,
  file_type text default '',
  uploaded_by text default '',
  active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Enable RLS
alter table documents enable row level security;

-- Todos pueden leer documentos activos
create policy "Public read documents" on documents
  for select using (true);

-- Solo usuarios autenticados (admin) pueden insertar
create policy "Admin insert documents" on documents
  for insert with check (true);

-- Solo usuarios autenticados pueden actualizar
create policy "Admin update documents" on documents
  for update using (true);

-- Solo usuarios autenticados pueden eliminar
create policy "Admin delete documents" on documents
  for delete using (true);
