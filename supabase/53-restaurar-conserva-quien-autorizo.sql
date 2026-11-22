-- ============================================================
--  AgroGestión — Hoja 53: restaurar un respaldo conserva quién autorizó y cuándo
--
--  El sello de lo sensible (hoja 37) lo pone la base con la cuenta que SUBE el evento. Eso está bien al capturar,
--  pero al restaurar un respaldo quien sube es quien restaura: un pago que autorizó una persona en noviembre
--  quedaba «autorizado» por otra, con la fecha del día de la restauración; y si quien restauraba no tenía ese
--  permiso, la decisión quedaba RECHAZADA y dejaba de contar. Una restauración no puede reescribir la historia.
--
--  Lo que hace:
--    · Una restauración se ABRE a propósito (`abrir_restauracion`, sólo superadministrador, con motivo) y dura una
--      hora. Queda anotada en `restauraciones`, que nadie puede editar ni borrar.
--    · Mientras está abierta, un evento que NO existe en la base y llega con su sello original (`_selloOriginal`,
--      tomado del respaldo) lo recupera tal cual: quién autorizó, con qué perfil, cuándo, y cuándo lo recibió la base.
--    · Ese evento queda marcado para siempre como restaurado: `restaurado` y `restaurado_por` los pone la base con
--      la cuenta de quien restaura. Así nunca pasa por original: se ve quién autorizó Y quién lo restauró.
--    · Un evento que SÍ existe no se toca: conserva su sello y no se marca como restaurado.
--    · Fuera de una restauración abierta, o si quien sube no es superadministrador, `_selloOriginal` se ignora y el
--      sello se pone como siempre. Nadie se autoriza solo mandando un sello escrito.
--
--  Lo que NO hace: no da permisos, no cambia ningún sello existente, no permite editar ni borrar eventos.
--  Se puede correr las veces que haga falta. Requiere las hojas 36, 37 y 52.
-- ============================================================

alter table eventos add column if not exists restaurado     timestamptz;  -- cuándo se restauró (lo pone la base)
alter table eventos add column if not exists restaurado_por uuid;         -- la cuenta que lo restauró

create table if not exists restauraciones (
  id          uuid primary key default gen_random_uuid(),
  abierta_por uuid not null,
  motivo      text not null,
  desde       timestamptz not null default now(),
  hasta       timestamptz not null,
  eventos     integer not null default 0     -- cuántos eventos recuperaron su sello original
);
alter table restauraciones enable row level security;
drop policy if exists "ver restauraciones" on restauraciones;
create policy "ver restauraciones" on restauraciones for select using (es_admin());
-- Sin reglas de alta, cambio ni borrado: sólo se escribe por las funciones de abajo.
revoke insert, update, delete on restauraciones from anon, authenticated;

create or replace function abrir_restauracion(p_motivo text)
returns timestamptz language plpgsql security definer set search_path = public
as $$
declare fin timestamptz := now() + interval '60 minutes';
begin
  if auth.uid() is null or not es_superadmin() then raise exception 'Sólo un superadministrador puede restaurar un respaldo'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Hay que decir por qué se restaura'; end if;
  update restauraciones set hasta = now() where abierta_por = auth.uid() and hasta > now();
  insert into restauraciones (abierta_por, motivo, hasta) values (auth.uid(), trim(p_motivo), fin);
  return fin;
end $$;
revoke all on function abrir_restauracion(text) from public, anon;
grant execute on function abrir_restauracion(text) to authenticated;

-- La misma función de la hoja 52, con la restauración al principio.
create or replace function validar_evento()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  op    text;
  pide  boolean;
  ok    boolean;
  dice  text;
  monto numeric;
  sello jsonb;
  abierta uuid;
begin
  -- El sello original viaja dentro del evento sólo para restaurar: nunca se guarda como parte de lo que el evento dice.
  sello := new.datos->'_selloOriginal';
  new.datos := new.datos - '_selloOriginal';
  select operacion, pide_importe into op, pide from operaciones_sensibles where tipo = new.tipo;

  if tg_op = 'INSERT' then
    new.validacion := null; new.validacion_dice := null; new.validado_por := null;
    new.validado_rol := null; new.validado := null; new.cambio_rechazado := null;
    new.restaurado := null; new.restaurado_por := null;

    if sello is not null and jsonb_typeof(sello) = 'object' and auth.uid() is not null and es_superadmin() then
      select id into abierta from restauraciones where abierta_por = auth.uid() and now() between desde and hasta order by desde desc limit 1;
      if abierta is not null then
        begin
          if sello->>'recibido' is not null then new.recibido := (sello->>'recibido')::timestamptz; end if;
          if op is not null and sello->>'validacion' in ('autorizado', 'rechazado') then
            new.validacion      := sello->>'validacion';
            new.validacion_dice := sello->>'dice';
            new.validado_por    := (sello->>'por')::uuid;
            new.validado_rol    := sello->>'rol';
            new.validado        := (sello->>'cuando')::timestamptz;
          end if;
          new.restaurado := now(); new.restaurado_por := auth.uid();
          update restauraciones set eventos = eventos + 1 where id = abierta;
          -- Un evento sensible sin sello en el respaldo (estaba «por validar») se valida como cualquier otro.
          if op is null or new.validacion is not null then return new; end if;
        exception when others then
          -- Un sello mal escrito no restaura nada: se sigue por el camino de siempre.
          new.validacion := null; new.validacion_dice := null; new.validado_por := null; new.validado_rol := null; new.validado := null;
          new.restaurado := null; new.restaurado_por := null; new.recibido := now();
        end;
      end if;
    end if;

    if op is null then return new; end if;
    ok := puede_operar_evento(op);
    dice := case when ok then null else 'sin_permiso' end;
    if ok and pide then
      begin
        monto := (new.datos->'datos'->>'monto')::numeric;
      exception when others then
        monto := null;
      end;
      if monto is null or monto <= 0 then ok := false; dice := 'importe'; end if;
    end if;
    new.validacion      := case when ok then 'autorizado' else 'rechazado' end;
    new.validacion_dice := dice;
    new.validado_por    := auth.uid();
    new.validado_rol    := (select rol from perfiles where id = auth.uid());
    new.validado        := now();
    return new;
  end if;

  new.validacion := old.validacion; new.validacion_dice := old.validacion_dice; new.validado_por := old.validado_por;
  new.validado_rol := old.validado_rol; new.validado := old.validado; new.cambio_rechazado := old.cambio_rechazado;
  new.restaurado := old.restaurado; new.restaurado_por := old.restaurado_por;
  if op is not null and old.estado = 'vigente' and new.estado is distinct from old.estado and not puede_operar_evento(op) then
    new.estado := old.estado;
    new.datos  := old.datos;
    new.cambio_rechazado := now();
  end if;
  return new;
end $$;
