-- ============================================================
--  AGROGESTIÓN — Permisos por rol, aplicados EN LA BASE
--  Agroselectos P&A
--
--  QUÉ ARREGLA
--
--  Hasta la hoja 23, la regla de casi todas las tablas era una sola:
--  "quien tenga perfil puede leer, crear, editar y borrar". Los permisos por
--  rol vivían sólo en las pantallas. Y peor: la política "crear mi perfil"
--  dejaba que CUALQUIER cuenta recién registrada se pusiera a sí misma el rol
--  que quisiera — "admin" incluido. Con eso, quien se registrara con la llave
--  pública (que viene en la app) podía leer y borrar todo el rancho.
--
--  CÓMO QUEDA
--
--  1. SUPERADMINISTRADORES. Luis y Migue, cada uno con su cuenta, con las
--     mismas facultades. Pueden todo... menos lo que NADIE puede:
--       · editar o borrar la bitácora (auditoria),
--       · borrar renglones de dinero (se cancelan, no se borran),
--       · quedarse sin ningún superadministrador.
--  2. LOS DEMÁS ROLES pueden sólo lo que diga la tabla "permisos_rol",
--     tabla por tabla: leer / crear / editar / borrar. Esa tabla la editan
--     únicamente los superadministradores, desde la app o desde aquí.
--  3. NADIE se da de alta ni se cambia el rol a sí mismo.
--  4. La bitácora anota sola QUIÉN escribió cada renglón (la cuenta real,
--     no el nombre que mande el teléfono).
--  5. Quien no tiene perfil, o no tiene sesión, no ve nada.
--
--  ANTES DE CORRERLO EN LA BASE REAL
--
--  · Está probado sólo en una base aislada (pruebas/base/). NO se ha corrido
--    contra datos reales.
--  · Los permisos iniciales salieron de qué tablas usa cada rol en las
--    pantallas de hoy. Hay que validarlos pantalla por pantalla.
--  · El rol viejo "admin" queda SIN permisos hasta que se reasigne: es a
--    propósito (falla cerrado). Al terminar, corre el PASO FINAL de abajo
--    con los dos correos reales.
--  · Se puede deshacer: la hoja 25 (reversa) restaura las reglas anteriores.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

-- ── 1 · El rol nuevo ────────────────────────────────────────
alter table perfiles drop constraint if exists perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('superadmin','admin','dueno','finanzas','encargado','agronomo'));

create or replace function mi_rol()
returns text language sql stable security definer set search_path = public
as $$ select rol from perfiles where id = auth.uid(); $$;

create or replace function es_superadmin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select rol = 'superadmin' from perfiles where id = auth.uid()), false); $$;

-- "es_admin" lo usan hojas anteriores: ahora quiere decir superadministrador.
create or replace function es_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select es_superadmin(); $$;

-- ── 2 · La tabla de permisos ────────────────────────────────
create table if not exists permisos_rol (
  rol     text not null,
  tabla   text not null,
  leer    boolean not null default false,
  crear   boolean not null default false,
  editar  boolean not null default false,
  borrar  boolean not null default false,
  actualizado timestamptz not null default now(),
  primary key (rol, tabla),
  check (rol in ('dueno','finanzas','encargado','agronomo'))  -- los superadmin no se limitan aquí
);
comment on table permisos_rol is 'Qué puede hacer cada rol en cada tabla. Sólo la editan los superadministradores. Lo que no está aquí, está negado.';

alter table permisos_rol enable row level security;
drop policy if exists "leer permisos"   on permisos_rol;
drop policy if exists "editar permisos" on permisos_rol;
create policy "leer permisos" on permisos_rol for select using (tiene_perfil());
create policy "editar permisos" on permisos_rol for all using (es_superadmin()) with check (es_superadmin());

-- ¿Puede la persona que llama hacer esto en esta tabla?
create or replace function puede(p_tabla text, p_accion text)
returns boolean language sql stable security definer set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when (select rol from perfiles where id = auth.uid()) = 'superadmin' then true
    else coalesce((
      select case p_accion
               when 'leer'   then pr.leer
               when 'crear'  then pr.crear
               when 'editar' then pr.editar
               when 'borrar' then pr.borrar
               else false end
      from permisos_rol pr
      join perfiles pf on pf.rol = pr.rol
      where pf.id = auth.uid() and pr.tabla = p_tabla
    ), false)
  end;
$$;

-- ── 3 · Perfiles: nadie se da de alta ni se asciende solo ───
drop policy if exists "ver mi perfil" on perfiles;
drop policy if exists "admin ve todos los perfiles" on perfiles;
drop policy if exists "crear mi perfil" on perfiles;
drop policy if exists "admin edita perfiles" on perfiles;
drop policy if exists "superadmin crea perfiles" on perfiles;
drop policy if exists "superadmin edita perfiles" on perfiles;
drop policy if exists "superadmin borra perfiles" on perfiles;

create policy "ver mi perfil" on perfiles for select using (id = auth.uid());
create policy "admin ve todos los perfiles" on perfiles for select using (es_superadmin());
create policy "superadmin crea perfiles" on perfiles for insert with check (es_superadmin());
create policy "superadmin edita perfiles" on perfiles for update using (es_superadmin()) with check (es_superadmin());
create policy "superadmin borra perfiles" on perfiles for delete using (es_superadmin());

-- Nunca puede quedar el rancho sin superadministrador.
create or replace function cuidar_ultimo_superadmin()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.rol = 'superadmin'
     and (tg_op = 'DELETE' or new.rol is distinct from 'superadmin')
     and not exists (select 1 from perfiles where rol = 'superadmin' and id <> old.id) then
    raise exception 'No se puede quitar al último superadministrador';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists perfiles_ultimo_superadmin on perfiles;
create trigger perfiles_ultimo_superadmin before update or delete on perfiles
  for each row execute function cuidar_ultimo_superadmin();

-- ── 4 · Todas las tablas de datos pasan a "puede(tabla, acción)" ──
do $$
declare
  t text; p record;
  dinero text[] := array['ingresos','egresos','prestamos','cajachica','creditos','estados_cuenta'];
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname not in ('perfiles','permisos_rol','auditoria','limites','uso_ia','operacion','invitaciones','preferencias')
  loop
    execute format('alter table %I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on %I', p.policyname, t);
    end loop;
    execute format('create policy %I on %I for select using (puede(%L, ''leer''))',  'leer ' || t,  t, t);
    execute format('create policy %I on %I for insert with check (puede(%L, ''crear''))', 'crear ' || t, t, t);
    execute format('create policy %I on %I for update using (puede(%L, ''editar'')) with check (puede(%L, ''editar''))', 'editar ' || t, t, t, t);
    -- El dinero no se borra: ni los superadministradores. Se cancela.
    if not (t = any(dinero)) then
      execute format('create policy %I on %I for delete using (puede(%L, ''borrar''))', 'borrar ' || t, t, t);
    end if;
  end loop;
end $$;

-- ── 5 · La bitácora anota sola quién escribió ───────────────
drop policy if exists "leer auditoria"  on auditoria;
drop policy if exists "crear auditoria" on auditoria;
create policy "leer auditoria"  on auditoria for select using (tiene_perfil());
create policy "crear auditoria" on auditoria for insert with check (tiene_perfil());
-- (sigue SIN política de update ni delete: nadie la modifica ni la borra)

create or replace function sellar_auditoria()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- La cuenta y el rol los pone la base, no el teléfono: no se pueden falsear.
  new.datos := coalesce(new.datos, '{}'::jsonb)
    || jsonb_build_object('cuenta', auth.uid(), 'rolCuenta', (select rol from perfiles where id = auth.uid()));
  new.actualizado := now();
  return new;
end $$;
drop trigger if exists auditoria_sello on auditoria;
create trigger auditoria_sello before insert on auditoria
  for each row execute function sellar_auditoria();

-- ── 6 · Permisos iniciales de los roles limitados ───────────
--  Salen de qué tablas usa cada rol en las pantallas de hoy. Corregibles
--  después desde la tabla, sin tocar esta hoja.
insert into permisos_rol (rol, tabla, leer, crear, editar, borrar) values
  ('encargado','ranchos',true,true,true,false),
  ('encargado','parcelas',true,true,true,false),
  ('encargado','cultivos',true,false,false,false),
  ('encargado','siembras',true,false,false,false),
  ('encargado','trabajadores',true,false,false,false),
  ('encargado','encargados',true,false,false,false),
  ('encargado','agronomos',true,false,false,false),
  ('encargado','cuadrillas',true,true,true,true),
  ('encargado','externos',true,false,false,false),
  ('encargado','maquinaria',true,true,true,false),
  ('encargado','inventario',true,true,true,false),
  ('encargado','actividades',true,true,true,false),
  ('encargado','cosechas',true,true,true,false),
  ('encargado','aplicaciones',true,false,false,false),
  ('encargado','ingresos',true,false,false,false),
  ('encargado','egresos',true,true,true,false),
  ('encargado','compras',true,false,false,false),
  ('encargado','entradas_inv',true,true,true,false),
  ('encargado','tareas',true,true,true,true),
  ('encargado','bonificaciones',true,false,false,false),
  ('encargado','incidencias',true,true,true,false),
  ('encargado','prestamos',true,true,true,false),
  ('encargado','cajachica',true,true,true,false),
  ('encargado','proveedores',true,false,false,false),
  ('encargado','ciclos',true,false,false,false),
  ('encargado','asistencia',true,true,true,false),
  ('encargado','envios_bodega',true,true,true,false),
  ('encargado','solicitudes_compra',true,true,true,true),
  ('encargado','bitacora',true,true,true,false),
  ('encargado','avances_fase',true,false,false,false),
  ('encargado','embarques',true,false,false,false),
  ('encargado','terminados',true,true,true,false),
  ('encargado','corridas',true,true,true,false),
  ('encargado','estibas',true,true,true,false),
  ('encargado','config_emisor',true,false,false,false),
  ('encargado','control_corrida',true,true,true,false),
  ('encargado','lecturas',true,true,true,false),
  ('encargado','patrones_lectura',true,true,true,false),
  ('encargado','estados_cuenta',true,true,true,false),
  ('encargado','titulares',true,true,true,false),
  ('encargado','bolsas',true,true,true,false),
  ('encargado','aportaciones',true,false,false,false),
  ('encargado','animales',true,true,true,false),
  ('encargado','pesajes',true,true,true,false),
  ('encargado','tratamientos',true,true,true,false),
  ('encargado','potreros',true,true,true,false),
  ('encargado','indicaciones',true,true,true,false),
  ('encargado','chat',true,true,true,false),
  ('encargado','vuelos',true,true,true,false),
  ('agronomo','ranchos',true,false,false,false),
  ('agronomo','parcelas',true,false,false,false),
  ('agronomo','cultivos',true,true,true,false),
  ('agronomo','siembras',true,false,false,false),
  ('agronomo','trabajadores',true,false,false,false),
  ('agronomo','encargados',true,false,false,false),
  ('agronomo','agronomos',true,false,false,false),
  ('agronomo','cuadrillas',true,false,false,false),
  ('agronomo','externos',true,false,false,false),
  ('agronomo','maquinaria',true,false,false,false),
  ('agronomo','inventario',true,true,true,false),
  ('agronomo','actividades',true,false,false,false),
  ('agronomo','cosechas',true,false,false,false),
  ('agronomo','aplicaciones',true,true,true,true),
  ('agronomo','egresos',true,true,true,false),
  ('agronomo','compras',true,false,false,false),
  ('agronomo','entradas_inv',true,true,true,false),
  ('agronomo','tareas',true,true,true,true),
  ('agronomo','bonificaciones',true,false,false,false),
  ('agronomo','incidencias',true,true,true,false),
  ('agronomo','proveedores',true,false,false,false),
  ('agronomo','ciclos',true,false,false,false),
  ('agronomo','asistencia',true,false,false,false),
  ('agronomo','envios_bodega',true,false,false,false),
  ('agronomo','solicitudes_compra',true,true,true,true),
  ('agronomo','bitacora',true,true,true,true),
  ('agronomo','avances_fase',true,true,true,false),
  ('agronomo','embarques',true,false,false,false),
  ('agronomo','terminados',true,false,false,false),
  ('agronomo','corridas',true,false,false,false),
  ('agronomo','estibas',true,false,false,false),
  ('agronomo','control_corrida',true,false,false,false),
  ('agronomo','lecturas',true,false,false,false),
  ('agronomo','patrones_lectura',true,false,false,false),
  ('agronomo','animales',true,false,false,false),
  ('agronomo','pesajes',true,false,false,false),
  ('agronomo','tratamientos',true,false,false,false),
  ('agronomo','potreros',true,false,false,false),
  ('agronomo','indicaciones',true,false,false,false),
  ('agronomo','chat',true,false,false,false),
  ('agronomo','vuelos',true,false,false,false),
  ('finanzas','ranchos',true,false,false,false),
  ('finanzas','parcelas',true,false,false,false),
  ('finanzas','cultivos',true,false,false,false),
  ('finanzas','siembras',true,false,false,false),
  ('finanzas','trabajadores',true,false,false,false),
  ('finanzas','encargados',true,false,false,false),
  ('finanzas','agronomos',true,false,false,false),
  ('finanzas','cuadrillas',true,false,false,false),
  ('finanzas','externos',true,false,false,false),
  ('finanzas','maquinaria',true,false,false,false),
  ('finanzas','inventario',true,true,true,false),
  ('finanzas','actividades',true,true,true,false),
  ('finanzas','cosechas',true,true,true,false),
  ('finanzas','aplicaciones',true,false,false,false),
  ('finanzas','ingresos',true,true,true,false),
  ('finanzas','egresos',true,true,true,false),
  ('finanzas','compras',true,true,true,false),
  ('finanzas','entradas_inv',true,true,true,false),
  ('finanzas','tareas',true,false,false,false),
  ('finanzas','bonificaciones',true,false,false,false),
  ('finanzas','incidencias',true,false,false,false),
  ('finanzas','prestamos',true,true,true,false),
  ('finanzas','cajachica',true,false,false,false),
  ('finanzas','creditos',true,true,true,false),
  ('finanzas','proveedores',true,false,false,false),
  ('finanzas','ciclos',true,false,false,false),
  ('finanzas','asistencia',true,true,true,false),
  ('finanzas','envios_bodega',true,false,false,false),
  ('finanzas','solicitudes_compra',true,true,true,true),
  ('finanzas','bitacora',true,false,false,false),
  ('finanzas','avances_fase',true,false,false,false),
  ('finanzas','embarques',true,true,true,false),
  ('finanzas','terminados',true,true,true,false),
  ('finanzas','corridas',true,true,true,false),
  ('finanzas','estibas',true,true,true,false),
  ('finanzas','config_emisor',true,false,false,false),
  ('finanzas','control_corrida',true,true,true,false),
  ('finanzas','config_contpaqi',true,true,true,false),
  ('finanzas','lecturas',true,false,false,false),
  ('finanzas','patrones_lectura',true,false,false,false),
  ('finanzas','estados_cuenta',true,false,false,false),
  ('finanzas','titulares',true,false,false,false),
  ('finanzas','bolsas',true,false,false,false),
  ('finanzas','aportaciones',true,false,false,false),
  ('finanzas','animales',true,false,false,false),
  ('finanzas','pesajes',true,false,false,false),
  ('finanzas','tratamientos',true,false,false,false),
  ('finanzas','potreros',true,false,false,false),
  ('finanzas','indicaciones',true,false,false,false),
  ('finanzas','chat',true,false,false,false),
  ('finanzas','vuelos',true,false,false,false),
  ('dueno','ranchos',true,false,false,false),
  ('dueno','parcelas',true,false,false,false),
  ('dueno','cultivos',true,false,false,false),
  ('dueno','siembras',true,false,false,false),
  ('dueno','trabajadores',true,false,false,false),
  ('dueno','encargados',true,false,false,false),
  ('dueno','agronomos',true,false,false,false),
  ('dueno','cuadrillas',true,false,false,false),
  ('dueno','externos',true,false,false,false),
  ('dueno','maquinaria',true,false,false,false),
  ('dueno','inventario',true,false,false,false),
  ('dueno','actividades',true,false,false,false),
  ('dueno','cosechas',true,false,false,false),
  ('dueno','aplicaciones',true,false,false,false),
  ('dueno','ingresos',true,false,false,false),
  ('dueno','egresos',true,false,false,false),
  ('dueno','compras',true,false,false,false),
  ('dueno','entradas_inv',true,false,false,false),
  ('dueno','tareas',true,false,false,false),
  ('dueno','bonificaciones',true,false,false,false),
  ('dueno','incidencias',true,false,false,false),
  ('dueno','prestamos',true,false,false,false),
  ('dueno','cajachica',true,false,false,false),
  ('dueno','creditos',true,false,false,false),
  ('dueno','proveedores',true,false,false,false),
  ('dueno','ciclos',true,false,false,false),
  ('dueno','asistencia',true,false,false,false),
  ('dueno','envios_bodega',true,false,false,false),
  ('dueno','solicitudes_compra',true,false,false,false),
  ('dueno','bitacora',true,true,true,true),
  ('dueno','avances_fase',true,true,true,false),
  ('dueno','embarques',true,false,false,false),
  ('dueno','terminados',true,false,false,false),
  ('dueno','corridas',true,false,false,false),
  ('dueno','estibas',true,false,false,false),
  ('dueno','config_emisor',true,false,false,false),
  ('dueno','control_corrida',true,false,false,false),
  ('dueno','config_contpaqi',true,false,false,false),
  ('dueno','lecturas',true,false,false,false),
  ('dueno','patrones_lectura',true,false,false,false),
  ('dueno','estados_cuenta',true,false,false,false),
  ('dueno','titulares',true,false,false,false),
  ('dueno','bolsas',true,false,false,false),
  ('dueno','aportaciones',true,false,false,false),
  ('dueno','animales',true,false,false,false),
  ('dueno','pesajes',true,false,false,false),
  ('dueno','tratamientos',true,false,false,false),
  ('dueno','potreros',true,false,false,false),
  ('dueno','indicaciones',true,false,false,false),
  ('dueno','chat',true,false,false,false),
  ('dueno','vuelos',true,false,false,false) 
on conflict (rol, tabla) do nothing;

-- ============================================================
--  PASO FINAL — nombrar a los dos superadministradores
--
--  Cambia los dos correos por los reales y corre SÓLO este bloque. Se corre
--  aquí, en el panel, porque desde la app nadie puede ascenderse.
--
--  update perfiles set rol = 'superadmin'
--   where id in (select id from auth.users where email in ('CORREO-DE-LUIS', 'CORREO-DE-MIGUE'));
--
--  Y ADEMÁS, en el panel: Authentication → Sign In / Providers →
--  desactiva "Allow new users to sign up". Las cuentas las crean ustedes.
--
--  CÓMO COMPROBAR QUE QUEDÓ
--  select tablename, count(*) as politicas from pg_policies
--   where schemaname = 'public' group by 1 order by 1;
-- ============================================================
