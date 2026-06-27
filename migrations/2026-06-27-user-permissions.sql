-- Agrega columna permissions para gating fino mas alla del role.
-- Hoy se usa para { bodega: true } (acceso al modulo Recetas Bodega).
-- A futuro pueden agregarse otras claves (ej. { bodega: true, costeo: true }).
--
-- Correr UNA SOLA VEZ en el SQL Editor de Supabase.

alter table users
  add column if not exists permissions jsonb not null default '{}'::jsonb;

-- Indice para queries futuras del tipo permissions->>'bodega' = 'true'
create index if not exists users_permissions_idx on users using gin (permissions);
