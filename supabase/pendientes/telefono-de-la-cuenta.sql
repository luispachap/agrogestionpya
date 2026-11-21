-- ============================================================
--  HOJA PENDIENTE — El teléfono de una cuenta.   *** NO INSTALADA ***
--
--  Para que Luis, Miguel o cualquiera con cuenta pueda escribir por WhatsApp
--  SIN darse de alta como trabajador ficticio: su teléfono se liga a SU CUENTA.
--  Se instala junto con la entrada de WhatsApp, cuando Luis lo autorice.
--
--  CÓMO SE VERIFICA (no se manda ningún mensaje, así que no cuesta):
--   1. La persona, con su sesión abierta en la app, pide un código
--      (`pedir_vinculo_telefono`). Vale 10 minutos y una sola vez.
--   2. Desde SU teléfono manda ese código al número de AgroGestión.
--   3. La entrada del servidor, que ya comprobó que el aviso viene de Meta,
--      llama a `confirmar_vinculo_telefono(teléfono, código)`.
--  Así se prueban las dos cosas a la vez: que tiene la cuenta (pidió el
--  código con sesión) y que tiene el teléfono (el mensaje salió de él).
--
--  REGLAS
--   · Una cuenta, un teléfono; un teléfono, una cuenta. No se le quita a otra.
--   · Del código sólo se guarda su huella. Cinco intentos por teléfono por hora.
--   · Nadie escribe la tabla: sólo estas funciones.
--   · El teléfono dice QUIÉN escribe. No autoriza lo sensible: eso lo sigue
--     validando la base con la sesión (hoja 37) y `requiereSesion` en la app.
-- ============================================================

create table if not exists telefonos_de_cuenta (
  usuario      uuid primary key references auth.users(id) on delete cascade,
  telefono     text unique,
  verificado   timestamptz,
  codigo_hash  text,
  codigo_vence timestamptz
);
create table if not exists intentos_de_vinculo (
  telefono text not null,
  cuando   timestamptz not null default now()
);
alter table telefonos_de_cuenta enable row level security;
alter table intentos_de_vinculo enable row level security;

drop policy if exists "ver mi telefono" on telefonos_de_cuenta;
create policy "ver mi telefono" on telefonos_de_cuenta for select using (usuario = auth.uid());
revoke all on telefonos_de_cuenta, intentos_de_vinculo from anon;
revoke insert, update, delete on telefonos_de_cuenta from authenticated;
revoke all on intentos_de_vinculo from authenticated;
grant select (usuario, telefono, verificado, codigo_vence) on telefonos_de_cuenta to authenticated;

create or replace function pedir_vinculo_telefono()
returns text language plpgsql security definer set search_path = public as $$
declare v_codigo text;
begin
  if auth.uid() is null or not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'Sólo una cuenta del rancho puede ligar su teléfono';
  end if;
  v_codigo := lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0');
  insert into telefonos_de_cuenta (usuario, codigo_hash, codigo_vence)
    values (auth.uid(), encode(sha256(convert_to(v_codigo, 'UTF8')), 'hex'), now() + interval '10 minutes')
  on conflict (usuario) do update set codigo_hash = excluded.codigo_hash, codigo_vence = excluded.codigo_vence;
  return v_codigo;
end $$;

create or replace function confirmar_vinculo_telefono(p_telefono text, p_codigo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tel text := right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 10); v_usuario uuid;
begin
  if length(v_tel) < 10 then return jsonb_build_object('ok', false, 'motivo', 'telefono_ilegible'); end if;
  if (select count(*) from intentos_de_vinculo where telefono = v_tel and cuando > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'motivo', 'demasiados_intentos');
  end if;
  insert into intentos_de_vinculo (telefono) values (v_tel);
  select usuario into v_usuario from telefonos_de_cuenta
   where codigo_hash = encode(sha256(convert_to(coalesce(p_codigo, ''), 'UTF8')), 'hex') and codigo_vence > now();
  if v_usuario is null then return jsonb_build_object('ok', false, 'motivo', 'codigo_invalido'); end if;
  if exists (select 1 from telefonos_de_cuenta where telefono = v_tel and usuario <> v_usuario) then
    return jsonb_build_object('ok', false, 'motivo', 'telefono_de_otra_cuenta');
  end if;
  update telefonos_de_cuenta set telefono = v_tel, verificado = now(), codigo_hash = null, codigo_vence = null where usuario = v_usuario;
  return jsonb_build_object('ok', true, 'usuario', v_usuario);
end $$;

create or replace function cuenta_de_telefono(p_telefono text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('usuario', t.usuario, 'nombre', p.nombre, 'rol', p.rol)
    from telefonos_de_cuenta t join perfiles p on p.id = t.usuario
   where t.telefono = right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 10) and t.verificado is not null;
$$;

create or replace function desvincular_mi_telefono()
returns void language sql security definer set search_path = public as $$
  update telefonos_de_cuenta set telefono = null, verificado = null, codigo_hash = null, codigo_vence = null where usuario = auth.uid();
$$;

revoke execute on function confirmar_vinculo_telefono(text, text), cuenta_de_telefono(text) from public, anon, authenticated;
grant execute on function confirmar_vinculo_telefono(text, text), cuenta_de_telefono(text) to service_role;
revoke execute on function pedir_vinculo_telefono(), desvincular_mi_telefono() from public, anon;
grant execute on function pedir_vinculo_telefono(), desvincular_mi_telefono() to authenticated;
