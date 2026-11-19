-- ============================================================
--  AGROGESTIÓN — Agregar tablas "titulares", "bolsas" y "aportaciones"
--  Agroselectos P&A
--
--  EL EJE DEL SISTEMA. Luis, textual:
--
--    «el sistema de agrogestion es un tanto diferente en el sentido de que
--     estaría trabajando con varios RFC pero en una sola empresa sabes? osea
--     toda la familia estamos metidos en el rancho y todos movemos dinero del
--     rancho entonces ocupo que todo eso se refleje»
--
--  Fiscalmente son personas distintas. Económicamente es UN SOLO NEGOCIO.
--  Hasta ahora la app no distinguía de qué bolsa salió cada peso, así que la
--  utilidad que enseñaba era la de un negocio imaginario donde todo el dinero
--  es del mismo dueño.
--
--  · "titulares"    — cada persona o RFC: Rodolfo, Migue, Fito, Luis, o la
--                     razón social.
--  · "bolsas"       — de dónde sale y entra el dinero: una cuenta de banco,
--                     una tarjeta, un efectivo. Cada bolsa tiene UN dueño.
--  · "aportaciones" — cuando alguien mete o saca dinero del rancho a
--                     propósito, aparte de pagar gastos.
--
--  Con esto sale la CUENTA CORRIENTE ENTRE SOCIOS: quién ha puesto, quién ha
--  sacado, cuánto le debe el rancho a cada quien y al revés. Es la función
--  que evita pleitos entre hermanos.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

create table if not exists titulares (
  id          text primary key,
  nombre      text,
  rfc         text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);
comment on table titulares is
  'Cada persona o RFC de la familia que mueve dinero del rancho. NO se calculan impuestos: sólo se deja dicho a nombre de quién quedó cada comprobante.';

create table if not exists bolsas (
  id          text primary key,
  nombre      text,
  tipo        text,        -- banco | tarjeta | efectivo
  titularId   text,        -- de quién es
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);
comment on table bolsas is
  'De dónde sale y entra el dinero. Cada bolsa tiene un dueño: así se sabe que si Migue pagó con su tarjeta, el rancho le queda debiendo.';

create table if not exists aportaciones (
  id          text primary key,
  titularId   text,
  tipo        text,        -- aportacion | retiro
  fecha       text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);
comment on table aportaciones is
  'Cuando un socio mete o saca dinero del rancho a propósito, aparte de pagar gastos con su bolsa.';

create index if not exists bolsas_titular_idx on bolsas (titularId);
create index if not exists aportaciones_titular_idx on aportaciones (titularId);

alter table titulares    enable row level security;
alter table bolsas       enable row level security;
alter table aportaciones enable row level security;

do $$
declare t text;
begin
  foreach t in array array['titulares','bolsas','aportaciones'] loop
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
--  LISTO. Ahora son 45 tablas de la app (46 con 'perfiles').
--  Vuelve a correr el SQL 14 para confirmar.
--
--  Nota: los movimientos (ingresos y egresos) guardan de qué bolsa salieron y
--  si son del rancho o personales dentro de su columna JSON "datos". No hizo
--  falta migrar nada: ése es justo el patrón de columnas fijas + JSON que
--  usa toda la app.
-- ============================================================
