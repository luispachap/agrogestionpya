-- ============================================================
--  AGROGESTIÓN — Dar de alta cuentas sin entrar al panel
--  Agroselectos P&A
--
--  Hasta aquí, para que alguien tuviera perfil había que entrar al panel de
--  Supabase y escribir SQL. Eso convierte a Luis en operador de consola.
--
--  Ahora:
--   · Un superadministrador INVITA desde la app: correo, nombre y rol.
--   · La persona crea su cuenta con ESE correo y, al entrar por primera vez,
--     la base le da el perfil que le tocaba. Sólo si confirmó su correo:
--     nadie reclama una invitación con un correo ajeno.
--   · Los dos primeros superadministradores (Luis y Migue) no tienen quién
--     los invite. Entran con un CÓDIGO DE ARRANQUE de un solo uso cada uno,
--     que caduca. La base guarda sólo su huella, nunca el código.
--   · Nadie se da perfil por su cuenta: todo pasa por esta función.
--
--  Requiere las hojas 24 y 31. Cópialo COMPLETO: Supabase → SQL Editor → Run
-- ============================================================

create table if not exists invitaciones (
  correo       text primary key check (correo = lower(correo)),
  nombre       text not null,
  rol          text not null check (rol in ('superadmin', 'dueno', 'finanzas', 'encargado', 'agronomo')),
  invitado_por uuid,
  creada       timestamptz not null default now(),
  usada_el     timestamptz,
  usada_por    uuid,
  cancelada    boolean not null default false
);
comment on table invitaciones is 'Quién puede crear cuenta y con qué rol. Sólo las escriben los superadministradores.';

alter table invitaciones enable row level security;
drop policy if exists "leer invitaciones"   on invitaciones;
drop policy if exists "crear invitaciones"  on invitaciones;
drop policy if exists "editar invitaciones" on invitaciones;
create policy "leer invitaciones"   on invitaciones for select using (es_superadmin());
create policy "crear invitaciones"  on invitaciones for insert with check (es_superadmin() and invitado_por = auth.uid() and usada_el is null);
-- Editar sólo para cancelar una que no se ha usado.
create policy "editar invitaciones" on invitaciones for update using (es_superadmin() and usada_el is null) with check (es_superadmin() and usada_el is null and usada_por is null);

alter table operacion add column if not exists arranque_huella text;
alter table operacion add column if not exists arranque_usos   integer not null default 0;
alter table operacion add column if not exists arranque_vence  timestamptz;

-- Preparar el código de arranque. Sólo desde el panel (no desde un teléfono).
create or replace function preparar_arranque(p_huella text, p_usos integer, p_dias integer)
returns timestamptz language plpgsql security definer set search_path = public
as $$
declare v timestamptz := now() + make_interval(days => p_dias);
begin
  if auth.uid() is not null then raise exception 'Esto sólo se hace al montar la base'; end if;
  if coalesce(length(p_huella), 0) <> 64 then raise exception 'Huella inválida'; end if;
  update operacion set arranque_huella = p_huella, arranque_usos = p_usos, arranque_vence = v where id = 'unico';
  return v;
end $$;

-- Lo que llama la app cuando una cuenta entra y todavía no tiene perfil.
create or replace function reclamar_acceso(p_codigo text default null)
returns text language plpgsql security definer set search_path = public
as $$
declare
  yo uuid := auth.uid(); u record; inv invitaciones; o operacion; ya text;
begin
  if yo is null then raise exception 'Primero inicia sesión'; end if;
  select rol into ya from perfiles where id = yo;
  if ya is not null then return ya; end if;

  select lower(email) as correo, email_confirmed_at, coalesce(raw_user_meta_data->>'nombre', split_part(email, '@', 1)) as nombre
    into u from auth.users where id = yo;
  if u.correo is null then raise exception 'No se encontró tu cuenta'; end if;
  if u.email_confirmed_at is null then
    raise exception 'Falta confirmar tu correo: abre el mensaje que te llegó y toca el enlace.';
  end if;

  -- 1. ¿Hay una invitación para este correo?
  select * into inv from invitaciones where correo = u.correo and usada_el is null and not cancelada for update;
  if found then
    insert into perfiles (id, nombre, rol) values (yo, inv.nombre, inv.rol);
    update invitaciones set usada_el = now(), usada_por = yo where correo = inv.correo;
    return inv.rol;
  end if;

  -- 2. ¿Trae el código de arranque?
  if coalesce(trim(p_codigo), '') <> '' then
    select * into o from operacion for update;
    if o.arranque_huella is not null and o.arranque_usos > 0 and o.arranque_vence > now()
       and o.arranque_huella = encode(sha256(convert_to(trim(p_codigo), 'UTF8')), 'hex') then
      insert into perfiles (id, nombre, rol) values (yo, u.nombre, 'superadmin');
      update operacion set arranque_usos = arranque_usos - 1 where id = 'unico';
      return 'superadmin';
    end if;
    raise exception 'El código de arranque no es válido, ya se usó o caducó.';
  end if;

  raise exception 'Tu cuenta todavía no está invitada. Pídele a un administrador que te invite con este mismo correo.';
end $$;
