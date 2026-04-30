-- =============================================
-- Recetario Don Telmo — Inventario y Compras
-- Ejecutar en el SQL Editor de Supabase
-- =============================================

-- 1. PROVEEDORES
create table if not exists proveedores (
  id          uuid primary key default gen_random_uuid(),
  codigo      text default '',
  nombre      text not null,
  nit         text default '',
  contacto    text default '',
  telefono    text default '',
  email       text default '',
  ciudad      text default '',
  categorias  text[] default '{}',
  condiciones text default '',   -- condiciones de pago: contado, 30 días, etc.
  activo      boolean default true,
  notas       text default '',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2. Enlazar supplies con proveedores (columna nueva, sin romper lo existente)
alter table supplies add column if not exists proveedor_id uuid references proveedores(id);

-- 3. COMPRAS — cabecera de la orden de compra
create table if not exists compras (
  id              uuid primary key default gen_random_uuid(),
  numero          text default '',
  proveedor_id    uuid references proveedores(id),
  fecha_pedido    date not null default current_date,
  fecha_recepcion date,
  estado          text default 'pendiente',  -- pendiente | recibido | parcial | cancelado
  total           numeric(12,2) default 0,
  notas           text default '',
  creado_por      text default '',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- 4. COMPRAS_ITEMS — ítems de cada orden de compra
create table if not exists compras_items (
  id                 uuid primary key default gen_random_uuid(),
  compra_id          uuid not null references compras(id) on delete cascade,
  supply_id          uuid not null references supplies(id),
  cantidad_pedida    numeric(12,3) default 0,
  cantidad_recibida  numeric(12,3) default 0,
  cost_per_unit      numeric(12,2) default 0,
  subtotal           numeric(12,2) default 0,
  estado             text default 'pendiente',  -- pendiente | recibido | parcial
  notas              text default '',
  created_at         timestamptz default now()
);

-- 5. INVENTARIO — stock actual por insumo
create table if not exists inventario (
  id           uuid primary key default gen_random_uuid(),
  supply_id    uuid not null unique references supplies(id),
  stock_actual numeric(12,3) default 0,
  stock_minimo numeric(12,3) default 0,
  stock_maximo numeric(12,3),
  ubicacion    text default '',
  updated_at   timestamptz default now()
);

-- 6. KARDEX — historial completo de movimientos de inventario
create table if not exists kardex (
  id              uuid primary key default gen_random_uuid(),
  supply_id       uuid not null references supplies(id),
  fecha           timestamptz default now(),
  tipo            text not null,  -- compra | baja | ajuste | produccion | conteo
  referencia_id   uuid,           -- id de la compra, baja, etc.
  referencia_tipo text default '',
  cantidad        numeric(12,3) not null,  -- positivo = entrada, negativo = salida
  stock_anterior  numeric(12,3) default 0,
  stock_nuevo     numeric(12,3) default 0,
  costo_unitario  numeric(12,2) default 0,
  costo_total     numeric(12,2) default 0,
  notas           text default '',
  usuario         text default '',
  created_at      timestamptz default now()
);

-- 7. BAJAS — mermas, vencimientos, daños
create table if not exists bajas (
  id            uuid primary key default gen_random_uuid(),
  fecha         date not null default current_date,
  supply_id     uuid not null references supplies(id),
  cantidad      numeric(12,3) not null,
  motivo        text default 'otro',  -- vencimiento | daño | merma | robo | otro
  costo_unitario numeric(12,2) default 0,
  costo_total   numeric(12,2) default 0,
  aprobado_por  text default '',
  notas         text default '',
  created_at    timestamptz default now()
);

-- 8. CONTEOS FÍSICOS — inventario físico periódico
create table if not exists conteos_fisicos (
  id            uuid primary key default gen_random_uuid(),
  fecha         date not null default current_date,
  estado        text default 'borrador',  -- borrador | en_progreso | finalizado
  realizado_por text default '',
  notas         text default '',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists conteos_items (
  id           uuid primary key default gen_random_uuid(),
  conteo_id    uuid not null references conteos_fisicos(id) on delete cascade,
  supply_id    uuid not null references supplies(id),
  stock_sistema numeric(12,3) default 0,
  stock_fisico  numeric(12,3),
  notas         text default '',
  created_at    timestamptz default now()
);

-- 9. REQUISICIONES — pedidos internos de cocina a bodega
create table if not exists requisiciones (
  id             uuid primary key default gen_random_uuid(),
  numero         text default '',
  fecha          date default current_date,
  sede           text default '',
  estado         text default 'pendiente',  -- pendiente | aprobada | entregada | cancelada
  solicitado_por text default '',
  notas          text default '',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists requisiciones_items (
  id              uuid primary key default gen_random_uuid(),
  requisicion_id  uuid not null references requisiciones(id) on delete cascade,
  supply_id       uuid not null references supplies(id),
  cantidad        numeric(12,3) default 0,
  entregado       numeric(12,3) default 0,
  notas           text default ''
);

-- ── RLS: todas las tablas públicas de lectura, escritura admin ──────────────

alter table proveedores      enable row level security;
alter table compras           enable row level security;
alter table compras_items     enable row level security;
alter table inventario        enable row level security;
alter table kardex            enable row level security;
alter table bajas             enable row level security;
alter table conteos_fisicos   enable row level security;
alter table conteos_items     enable row level security;
alter table requisiciones     enable row level security;
alter table requisiciones_items enable row level security;

-- Proveedores
create policy "read proveedores"   on proveedores for select using (true);
create policy "write proveedores"  on proveedores for insert with check (true);
create policy "update proveedores" on proveedores for update using (true);
create policy "delete proveedores" on proveedores for delete using (true);

-- Compras
create policy "read compras"   on compras for select using (true);
create policy "write compras"  on compras for insert with check (true);
create policy "update compras" on compras for update using (true);
create policy "delete compras" on compras for delete using (true);

-- Compras items
create policy "read compras_items"   on compras_items for select using (true);
create policy "write compras_items"  on compras_items for insert with check (true);
create policy "update compras_items" on compras_items for update using (true);
create policy "delete compras_items" on compras_items for delete using (true);

-- Inventario
create policy "read inventario"   on inventario for select using (true);
create policy "write inventario"  on inventario for insert with check (true);
create policy "update inventario" on inventario for update using (true);
create policy "delete inventario" on inventario for delete using (true);

-- Kardex
create policy "read kardex"  on kardex for select using (true);
create policy "write kardex" on kardex for insert with check (true);

-- Bajas
create policy "read bajas"   on bajas for select using (true);
create policy "write bajas"  on bajas for insert with check (true);
create policy "update bajas" on bajas for update using (true);
create policy "delete bajas" on bajas for delete using (true);

-- Conteos
create policy "read conteos_fisicos"   on conteos_fisicos for select using (true);
create policy "write conteos_fisicos"  on conteos_fisicos for insert with check (true);
create policy "update conteos_fisicos" on conteos_fisicos for update using (true);
create policy "delete conteos_fisicos" on conteos_fisicos for delete using (true);
create policy "read conteos_items"   on conteos_items for select using (true);
create policy "write conteos_items"  on conteos_items for insert with check (true);
create policy "update conteos_items" on conteos_items for update using (true);
create policy "delete conteos_items" on conteos_items for delete using (true);

-- Requisiciones
create policy "read requisiciones"   on requisiciones for select using (true);
create policy "write requisiciones"  on requisiciones for insert with check (true);
create policy "update requisiciones" on requisiciones for update using (true);
create policy "delete requisiciones" on requisiciones for delete using (true);
create policy "read requisiciones_items"   on requisiciones_items for select using (true);
create policy "write requisiciones_items"  on requisiciones_items for insert with check (true);
create policy "update requisiciones_items" on requisiciones_items for update using (true);
create policy "delete requisiciones_items" on requisiciones_items for delete using (true);
