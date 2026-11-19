-- ============================================================
--  AGROGESTIÓN — Esquema de base de datos para Supabase
--  Agroselectos P&A
--
--  Este script crea todas las tablas que necesita la aplicación.
--  Se ejecuta UNA SOLA VEZ, completo, en el SQL Editor de Supabase.
--
--  Diseño: cada tabla tiene columnas reales para los datos
--  importantes (los que se filtran o protegen) y una columna
--  "datos" tipo JSON para el resto de los detalles. Así la app
--  puede crecer sin tener que cambiar la base de datos cada vez.
-- ============================================================

-- ------------------------------------------------------------
--  EXTENSIONES
-- ------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
--  TABLA DE PERFILES (quién es quién)
--  Se conecta con el sistema de cuentas de Supabase (auth.users).
--  Aquí se guarda el rol de cada persona que administra con
--  correo y contraseña.
-- ------------------------------------------------------------
create table if not exists perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  rol         text not null default 'encargado'
              check (rol in ('admin','encargado','agronomo','dueno','finanzas')),
  creado_en   timestamptz not null default now()
);

comment on table perfiles is 'Personas con cuenta (correo y contraseña): admin, dirección, finanzas, encargado, agrónomo. Los trabajadores, cuadrillas y externos entran por PIN dentro de la app.';

-- ------------------------------------------------------------
--  FUNCIONES AUXILIARES (se usan en las políticas de seguridad)
-- ------------------------------------------------------------

-- ¿El usuario actual es administrador?
create or replace function es_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

-- ¿El usuario actual tiene una cuenta válida con perfil?
create or replace function tiene_perfil()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from perfiles where id = auth.uid());
$$;

-- ¿El usuario actual es alguien con cuenta válida?
-- (auth.uid() solo no basta — debe haber registro en perfiles).
create or replace function es_usuario_valido()
returns boolean
language sql
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (select 1 from perfiles where id = auth.uid());
$$;

-- ------------------------------------------------------------
--  TABLAS DE DATOS DE LA APLICACIÓN
--  Una por cada colección de la app (28 colecciones).
-- ------------------------------------------------------------

-- Ranchos
create table if not exists ranchos (
  id          text primary key,
  nombre      text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Parcelas
create table if not exists parcelas (
  id          text primary key,
  rancho_id   text,
  nombre      text,
  cultivo     text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Cultivos (catálogo)
create table if not exists cultivos (
  id          text primary key,
  nombre      text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Siembras (ciclo cultivo-en-parcela)
create table if not exists siembras (
  id          text primary key,
  parcela_id  text,
  cultivo_id  text,
  estado      text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Trabajadores de planta
create table if not exists trabajadores (
  id          text primary key,
  nombre      text,
  pin         text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Encargados
create table if not exists encargados (
  id          text primary key,
  nombre      text,
  pin         text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Agrónomos
create table if not exists agronomos (
  id          text primary key,
  nombre      text,
  pin         text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Cuadrillas (grupos eventuales que llegan al rancho)
create table if not exists cuadrillas (
  id          text primary key,
  nombre      text,
  pin         text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Externos (individuos eventuales, sus registros requieren aprobación)
create table if not exists externos (
  id          text primary key,
  nombre      text,
  estado      text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Maquinaria
create table if not exists maquinaria (
  id          text primary key,
  nombre      text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Inventario (insumos: fertilizantes, agroquímicos, semillas, etc.)
create table if not exists inventario (
  id          text primary key,
  nombre      text,
  categoria   text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Actividades de campo (registro diario del trabajo)
create table if not exists actividades (
  id          text primary key,
  parcela_id  text,
  fecha       text,
  tipo        text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Cosechas
create table if not exists cosechas (
  id          text primary key,
  parcela_id  text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Aplicaciones (fertirriego / tratamientos del agrónomo)
create table if not exists aplicaciones (
  id          text primary key,
  parcela_id  text,
  fecha       text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Ingresos (ventas y otros ingresos)
create table if not exists ingresos (
  id          text primary key,
  fecha       text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Egresos (gastos del rancho)
create table if not exists egresos (
  id          text primary key,
  fecha       text,
  parcela_id  text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Compras y órdenes de compra
create table if not exists compras (
  id          text primary key,
  estado      text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Entradas de inventario (cuándo entró cada lote)
create table if not exists entradas_inv (
  id          text primary key,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Tareas e indicaciones al personal
create table if not exists tareas (
  id          text primary key,
  asignado_a  text,
  estado      text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Bonificaciones a trabajadores
create table if not exists bonificaciones (
  id          text primary key,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Incidencias (reportes de problemas en campo)
create table if not exists incidencias (
  id          text primary key,
  estado      text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Préstamos a trabajadores
create table if not exists prestamos (
  id          text primary key,
  estado      text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Caja chica
create table if not exists cajachica (
  id          text primary key,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Créditos con proveedores
create table if not exists creditos (
  id          text primary key,
  estado      text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Proveedores
create table if not exists proveedores (
  id          text primary key,
  nombre      text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Temporadas (también llamadas ciclos)
create table if not exists ciclos (
  id          text primary key,
  estado      text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Asistencia (pase de lista diario)
create table if not exists asistencia (
  id          text primary key,
  fecha       text,
  trabajador_id text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- Envíos del rancho a la bodega de Aguascalientes
create table if not exists envios_bodega (
  id          text primary key,
  parcela_id  text,
  fecha       text,
  cultivo     text,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

-- ============================================================
--  FIN DEL ESQUEMA
--
--  Resumen: 28 tablas de datos + 1 tabla de perfiles = 29 tablas.
--  Roles disponibles para administración: admin, dueno, finanzas,
--  encargado, agronomo. Los trabajadores entran por PIN.
--
--  Siguiente paso: ejecutar el archivo "2-seguridad.sql"
-- ============================================================
