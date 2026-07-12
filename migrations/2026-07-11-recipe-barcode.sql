-- Contrato v5: el barcode de Aldelo es la identidad real del producto
-- (el mismo en todas las sedes, a diferencia del nombre). Cada receta guarda
-- el barcode del producto al que corresponde, y gabycontrol vincula por el.
--
-- Correr UNA SOLA VEZ en el SQL Editor de Supabase.

alter table recipes
  add column if not exists barcode text;

-- Indice para buscar/deduplicar recetas por barcode
create index if not exists recipes_barcode_idx on recipes (barcode);
