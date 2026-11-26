-- Fecha real de actualizacion de recetas (gabycontrol la lee como updated_at en GET /api/recipes)
alter table public.recipes add column if not exists updated_at timestamptz;

create or replace function public.recipes_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists recipes_updated_at on public.recipes;
create trigger recipes_updated_at
  before insert or update on public.recipes
  for each row execute function public.recipes_set_updated_at();

-- Las 3 recetas corregidas (SANDWICH ITALIANO, DEDITOS MOZZARELLA, CALENTADO PASTA)
update public.recipes set updated_at = now() where id in (172, 314, 284);

select id, name, created_at, updated_at from public.recipes where id in (172, 314, 284);
