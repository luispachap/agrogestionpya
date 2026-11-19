-- ============================================================
--  AGROGESTIÓN — El ganado
--  Agroselectos P&A
--
--  Aquí no había NADA: ni "arete", ni "potrero", ni "vaca" aparecían en el
--  código. Lo que sí aparecía como "ganado" eran los "bonos ganados" de la
--  nómina.
--
--  · "animales"    — el padrón: cada animal con su arete, su origen y, cuando
--                    sale, su BAJA CON MOTIVO. Un animal no puede simplemente
--                    dejar de aparecer.
--  · "pesajes"     — la báscula: lo que sube cada día.
--  · "tratamientos"— la jeringa, y sobre todo el TIEMPO DE RETIRO: hasta
--                    cuándo NO se vende. Vender antes le llega al consumidor.
--  · "potreros"    — dónde están y cuántos aguanta cada pedazo.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

create table if not exists animales (
  id          text primary key,
  arete       text,
  sexo        text,
  potreroId   text,
  datos       jsonb not null default '{}',   -- origen, raza, madre, baja {motivo, fecha, causa}
  actualizado timestamptz not null default now()
);
comment on table animales is
  'El padrón. Cada baja lleva su motivo (vendido, muerto, robado, regalado, perdido): un animal no desaparece sin explicación.';

create table if not exists pesajes (
  id          text primary key,
  animalId    text,
  fecha       text,
  datos       jsonb not null default '{}',   -- kg, quién pesó
  actualizado timestamptz not null default now()
);

create table if not exists tratamientos (
  id          text primary key,
  animalId    text,
  fecha       text,
  producto    text,
  datos       jsonb not null default '{}',   -- dosis, vía, retiroDias, quién aplicó
  actualizado timestamptz not null default now()
);
comment on column tratamientos.datos is
  'Incluye retiroDias: los días que deben pasar antes de vender. Si NO se capturó, la app NO dice "ya se puede vender": dice que no se sabe.';

create table if not exists potreros (
  id          text primary key,
  nombre      text,
  datos       jsonb not null default '{}',   -- hectareas, cargaMaxima, agua
  actualizado timestamptz not null default now()
);

create index if not exists animales_potrero_idx on animales (potreroId);
create index if not exists pesajes_animal_idx on pesajes (animalId);
create index if not exists tratamientos_animal_idx on tratamientos (animalId);

alter table animales     enable row level security;
alter table pesajes      enable row level security;
alter table tratamientos enable row level security;
alter table potreros     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['animales','pesajes','tratamientos','potreros'] loop
    execute format('drop policy if exists "leer %1$s"   on %1$s', t);
    execute format('drop policy if exists "crear %1$s"  on %1$s', t);
    execute format('drop policy if exists "editar %1$s" on %1$s', t);
    execute format('drop policy if exists "borrar %1$s" on %1$s', t);
    execute format('create policy "leer %1$s"   on %1$s for select using (tiene_perfil())', t);
    execute format('create policy "crear %1$s"  on %1$s for insert with check (tiene_perfil())', t);
    execute format('create policy "editar %1$s" on %1$s for update using (tiene_perfil()) with check (tiene_perfil())', t);
    execute format('create policy "borrar %1$s" on %1$s for delete using (tiene_perfil())', t);
  end loop;
end $$;

-- ============================================================
--  LISTO. Ahora son 49 tablas de la app (50 con 'perfiles').
--  Vuelve a correr el SQL 14 para confirmar.
-- ============================================================
