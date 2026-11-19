-- ============================================================
--  AGROGESTIÓN — Eventos: una operación, múltiples consecuencias
--  Agroselectos P&A
--
--  Lo que pasa en el rancho se captura UNA vez, como un evento: una marca de
--  entrada, un retiro del almacén, una aplicación. De ese evento salen todas
--  sus consecuencias (asistencia, existencias, costos), que la app CALCULA y
--  no guarda aparte: así no hay forma de que se dupliquen o se contradigan.
--
--  Por eso esta tabla tiene tres candados que las demás no:
--
--  1 · UN EVENTO NO CAMBIA LO QUE DICE. Una vez guardado, sólo puede pasar de
--      vigente a cancelado o a corregido (con su motivo). Ni un
--      superadministrador le cambia la hora, la persona o la cantidad: para
--      eso se corrige con un evento nuevo que apunta al anterior.
--  2 · LO QUE YA NO ESTÁ VIGENTE NO REVIVE. Si un teléfono que estuvo sin
--      señal sube su copia vieja, la base la ignora en silencio.
--  3 · NO SE BORRA, ni con lápida. Se cancela.
--
--  Requiere las hojas 24, 29, 30 y 31. Cópialo COMPLETO: SQL Editor → Run
-- ============================================================

create table if not exists eventos (
  id          text primary key,
  tipo        text not null,          -- marca | retiro | devolucion | aplicacion | …
  fecha       text not null,          -- el día del rancho en que pasó (AAAA-MM-DD)
  estado      text not null default 'vigente' check (estado in ('vigente', 'cancelado', 'corregido')),
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now(),
  creado_por  uuid,
  subido_por  uuid,
  borrado     timestamptz
);
create index if not exists eventos_por_dia on eventos (fecha, tipo);

create or replace function cuidar_evento()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  cambian text[] := array['cancelado', 'corregidoPor', '_actualizado'];
begin
  -- 2 · Lo cancelado o corregido ya no se mueve: la copia vieja de otro aparato se ignora.
  if old.estado <> 'vigente' then return old; end if;
  -- 3 · No se borra.
  if new.borrado is not null then
    raise exception 'Un evento no se borra: se cancela, con su motivo.' using errcode = 'P0001';
  end if;
  -- 1 · Lo que dice no cambia.
  if new.tipo is distinct from old.tipo or new.fecha is distinct from old.fecha
     or (new.datos - cambian) is distinct from (old.datos - cambian) then
    raise exception 'Un evento no se edita. Para cambiarlo se corrige con un evento nuevo, o se cancela.' using errcode = 'P0001';
  end if;
  -- Cancelar o corregir exige decir quién y por qué.
  if new.estado = 'cancelado' and coalesce(trim(new.datos->'cancelado'->>'motivo'), '') = '' then
    raise exception 'Para cancelar hay que decir por qué.' using errcode = 'P0001';
  end if;
  if new.estado = 'corregido' and coalesce(new.datos->>'corregidoPor', '') = '' then
    raise exception 'Un evento corregido tiene que decir cuál lo corrige.' using errcode = 'P0001';
  end if;
  return new;
end $$;

alter table eventos enable row level security;
drop policy if exists "leer eventos"   on eventos;
drop policy if exists "crear eventos"  on eventos;
drop policy if exists "editar eventos" on eventos;
create policy "leer eventos"   on eventos for select using (puede('eventos', 'leer'));
create policy "crear eventos"  on eventos for insert with check (puede('eventos', 'crear') and estado = 'vigente');
create policy "editar eventos" on eventos for update using (puede('eventos', 'editar')) with check (puede('eventos', 'editar'));
-- Sin política de borrado: no hay forma.

-- Los mismos sellos que llevan las demás tablas de datos (hojas 29 y 31).
drop trigger if exists eventos_sello_cuenta on eventos;
create trigger eventos_sello_cuenta before insert or update on eventos for each row execute function sellar_cuenta();
drop trigger if exists eventos_espacio on eventos;
create trigger eventos_espacio before insert on eventos for each row execute function exigir_espacio();
-- Y el suyo, que corre al último (los triggers van por orden alfabético: "eventos_z…").
drop trigger if exists eventos_z_cuidar on eventos;
create trigger eventos_z_cuidar before update on eventos for each row execute function cuidar_evento();

revoke all on eventos from anon;
revoke execute on function cuidar_evento() from public, anon, authenticated;

-- Quién puede qué. Los superadministradores no se limitan aquí (hoja 24), pero
-- los tres candados de arriba también les aplican.
insert into permisos_rol (rol, tabla, leer, crear, editar, borrar) values
  ('encargado', 'eventos', true, true,  true,  false),   -- el checador y el almacén corren con su cuenta
  ('agronomo',  'eventos', true, true,  false, false),
  ('finanzas',  'eventos', true, false, false, false),
  ('dueno',     'eventos', true, false, false, false)
on conflict (rol, tabla) do update set leer = excluded.leer, crear = excluded.crear, editar = excluded.editar, borrar = excluded.borrar;
