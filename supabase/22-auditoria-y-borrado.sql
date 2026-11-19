-- ============================================================
--  AGROGESTIÓN — Auditoría de sólo inserción, y cerrar el borrado del dinero
--  Agroselectos P&A
--
--  DOS COSAS, Y LAS DOS SON LA MISMA IDEA
--
--  1. UNA BITÁCORA QUE NO SE PUEDE TOCAR
--     Hasta ahora no había ninguna tabla de auditoría. Una auditoría que se
--     puede editar o borrar no es una auditoría: es una sugerencia. Ésta es
--     de SÓLO INSERCIÓN — se puede escribir y leer, y no hay política de
--     update ni de delete, así que Postgres las niega. Ni el admin puede.
--
--  2. EL DINERO YA NO SE BORRA DESDE LA BASE
--     Las 11 hojas anteriores dan `for delete using (tiene_perfil())`:
--     cualquiera con perfil puede borrar cualquier renglón de cualquier
--     tabla. La app ya no ofrece borrar dinero —lo cancela— pero eso sólo
--     tapa la puerta de la app, no la de la base.
--
--     Aquí se quita el permiso de borrado en las tablas de DINERO. Un abono
--     de $30,000 borrado "porque estaba mal capturado" y el proveedor que
--     cobra otra vez: sin el registro no hay forma de probar el primer pago.
--
--     Se tocan SÓLO las de dinero. Las demás (catálogos, tareas, notas) se
--     dejan como estaban a propósito: ahí borrar un renglón mal capturado es
--     normal y no esconde nada.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

-- ── 1 · La bitácora inmutable ───────────────────────────────
create table if not exists auditoria (
  id          text primary key,
  fecha       text,          -- el día, para buscar
  tabla       text,          -- sobre qué se actuó
  registroId  text,          -- cuál renglón
  accion      text,          -- cancelo | reactivo | borro | cambio
  quien       text,
  datos       jsonb not null default '{}',   -- motivo, antes, después
  actualizado timestamptz not null default now()
);

comment on table auditoria is
  'Bitácora de SÓLO INSERCIÓN: quién hizo qué y cuándo. No tiene política de update ni de delete, así que nadie —tampoco el admin— puede modificarla ni borrarla. Una auditoría que se puede editar no es una auditoría.';

create index if not exists auditoria_fecha_idx on auditoria (fecha);
create index if not exists auditoria_registro_idx on auditoria (tabla, registroId);

alter table auditoria enable row level security;

drop policy if exists "leer auditoria"   on auditoria;
drop policy if exists "crear auditoria"  on auditoria;
drop policy if exists "editar auditoria" on auditoria;
drop policy if exists "borrar auditoria" on auditoria;

-- Sólo estas dos. NO se crean las de update ni delete: sin política, Postgres
-- las niega. Eso es lo que la vuelve inmutable, y es a propósito.
create policy "leer auditoria" on auditoria
  for select using (tiene_perfil());
create policy "crear auditoria" on auditoria
  for insert with check (tiene_perfil());

-- ── 2 · Quitar el borrado en las tablas de dinero ───────────
--
--  Nada de dinero se borra: se CANCELA, con motivo y con quién, y el registro
--  se queda tachado y visible. La app ya lo hace así; esto cierra la puerta
--  que quedaba abierta por debajo.
do $$
declare t text;
begin
  foreach t in array array['ingresos','egresos','prestamos','cajachica','creditos','estados_cuenta'] loop
    -- Si la tabla no existe todavía (por ejemplo estados_cuenta antes del
    -- SQL 19), se salta sin romper nada.
    if to_regclass(t) is not null then
      execute format('drop policy if exists "borrar %1$s" on %1$s', t);
      raise notice 'Quitado el permiso de borrar en %', t;
    end if;
  end loop;
end $$;

-- ============================================================
--  CÓMO COMPROBAR QUE QUEDÓ
--
--  Corre esto: la columna "puede_borrarse" debe decir NO en las de dinero
--  y en auditoria.
-- ============================================================
select
  c.relname as tabla,
  case when exists (
    select 1 from pg_policy p
    where p.polrelid = c.oid and p.polcmd = 'd'
  ) then 'sí' else 'NO' end as puede_borrarse,
  case when exists (
    select 1 from pg_policy p
    where p.polrelid = c.oid and p.polcmd = 'w'
  ) then 'sí' else 'NO' end as puede_editarse
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('ingresos','egresos','prestamos','cajachica','creditos','estados_cuenta','auditoria')
order by c.relname;

-- ============================================================
--  LISTO. Ahora son 50 tablas de la app (51 con 'perfiles').
--
--  Nota: si algún día hace falta borrar de verdad un renglón de dinero
--  —porque nunca existió, no porque esté mal— se hace desde el panel de
--  Supabase con la llave de servicio, que salta las políticas. Que cueste
--  trabajo es justo el punto.
-- ============================================================
