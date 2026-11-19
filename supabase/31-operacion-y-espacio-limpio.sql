-- ============================================================
--  AGROGESTIÓN — Arranque limpio: el espacio y la fecha de inicio
--  Agroselectos P&A
--
--  La operación empieza SIN registros de antes. Pero los teléfonos traen
--  guardadas pruebas viejas, y una base vacía no sirve si el primer teléfono
--  que entra la llena con datos inventados.
--
--  La app ya no lee ni sube lo de antes (src/espacio.js). Esta hoja es el
--  SEGUNDO candado, del lado de la base:
--
--   · La base tiene un nombre de espacio. Todo registro que llegue desde un
--     teléfono debe traer esa misma marca; si no la trae, se rechaza.
--     Así, aunque algún día un teléfono intentara subir algo guardado para
--     otro proyecto o de la época de pruebas, no entra.
--   · La fecha oficial de inicio de operaciones se declara UNA vez, por un
--     superadministrador, y ya no se cambia. Sirve para distinguir lo nuevo
--     de cualquier dato histórico.
--
--  Requiere las hojas 24 a 30. Cópialo COMPLETO: Supabase → SQL Editor → Run
--  y al terminar corre el PASO FINAL de abajo.
-- ============================================================

create table if not exists operacion (
  id                 text primary key default 'unico' check (id = 'unico'),
  espacio            text,          -- el nombre de este espacio (el identificador del proyecto)
  sellado_el         timestamptz,
  inicio_operaciones date,          -- la fecha oficial de arranque
  declarado_por      uuid,
  declarado_el       timestamptz,
  nota               text
);
insert into operacion (id) values ('unico') on conflict (id) do nothing;
comment on table operacion is 'Un solo renglón: a qué espacio pertenece esta base y desde qué fecha opera. Se escribe sólo con sellar_espacio() y declarar_inicio().';

alter table operacion enable row level security;
drop policy if exists "leer operacion" on operacion;
create policy "leer operacion" on operacion for select using (tiene_perfil());
-- (sin reglas de insert, update ni delete: sólo las dos funciones de abajo)

-- Ponerle nombre al espacio. Una sola vez, al montar la base.
create or replace function sellar_espacio(p_espacio text)
returns text language plpgsql security definer set search_path = public
as $$
declare actual text;
begin
  if auth.uid() is not null and not es_superadmin() then raise exception 'Sólo un superadministrador sella el espacio'; end if;
  if coalesce(trim(p_espacio), '') = '' then raise exception 'Falta el nombre del espacio'; end if;
  select espacio into actual from operacion;
  if actual is not null and actual <> p_espacio then raise exception 'Esta base ya es del espacio "%": no se cambia', actual; end if;
  update operacion set espacio = p_espacio, sellado_el = coalesce(sellado_el, now()) where id = 'unico';
  return p_espacio;
end $$;

-- Declarar la fecha oficial de inicio. Una sola vez.
create or replace function declarar_inicio(p_fecha date, p_nota text default null)
returns date language plpgsql security definer set search_path = public
as $$
declare ya date;
begin
  if not es_superadmin() then raise exception 'Sólo un superadministrador declara el inicio de operaciones'; end if;
  if p_fecha is null then raise exception 'Falta la fecha'; end if;
  select inicio_operaciones into ya from operacion;
  if ya is not null then raise exception 'El inicio de operaciones ya está declarado (%) y no se cambia', ya; end if;
  update operacion set inicio_operaciones = p_fecha, declarado_por = auth.uid(), declarado_el = now(), nota = p_nota where id = 'unico';
  return p_fecha;
end $$;

-- El candado: lo que llega de un teléfono sin la marca de este espacio, no entra.
-- (Lo que carga el dueño de la base desde el panel —los catálogos ya
-- validados— no pasa por aquí: no viene de un teléfono.)
create or replace function exigir_espacio()
returns trigger language plpgsql security definer set search_path = public
as $$
declare e text;
begin
  if auth.uid() is null then return new; end if;
  select espacio into e from operacion;
  if e is null then return new; end if;        -- base aún sin sellar (sólo durante el montaje)
  if (new.datos->>'_espacio') is distinct from e then
    raise exception 'Este registro no es de esta operación (espacio "%"). No se sube: puede ser un dato viejo o de prueba.', e
      using errcode = 'P0001';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname not in ('perfiles', 'permisos_rol', 'limites', 'uso_ia', 'operacion', 'invitaciones')
  loop
    execute format('drop trigger if exists %I on %I', t || '_espacio', t);
    execute format('create trigger %I before insert on %I for each row execute function exigir_espacio()', t || '_espacio', t);
  end loop;
end $$;

-- ============================================================
--  PASO FINAL (al montar): sellar la base con el identificador del proyecto
--  — el mismo que va en la dirección https://XXXXXXXX.supabase.co —
--
--  select sellar_espacio('XXXXXXXX');
--
--  CÓMO COMPROBAR
--  select espacio, sellado_el, inicio_operaciones from operacion;
--  Una base SIN sellar acepta registros sin marca: no se abre a nadie así.
-- ============================================================
