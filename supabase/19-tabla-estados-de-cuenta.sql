-- ============================================================
--  AGROGESTIÓN — Agregar tabla "estados_cuenta"
--  Agroselectos P&A
--
--  Para qué es:
--
--  Hoy la app NO SABE cuánto hay en el banco: ni saldos, ni movimientos, ni
--  cortes. Todo se captura a mano, a criterio de quien se acuerde, y nadie ha
--  comparado nunca la app contra el banco. Aquí queda cada estado de cuenta
--  que se sube, con sus movimientos adentro.
--
--  Un estado de cuenta SE VALIDA SOLO antes de entrar:
--      saldo inicial + Σ abonos − Σ cargos = saldo final
--      saldo anterior + abono − cargo      = saldo del renglón
--  Si no cuadra al centavo, entra marcado NO CONFIABLE y no alimenta ningún
--  reporte. Es preferible pedir otro archivo que conciliar contra cifras
--  inventadas.
--
--  De la cuenta se guardan SÓLO los últimos cuatro dígitos (****4417).
--  Bastan para identificarla y no sirven para nada más.
--
--  NADIE guarda aquí claves de banca en línea. La app no se conecta al banco:
--  se sube un archivo que una persona descargó.
--
--  Cópialo COMPLETO y pégalo en: Supabase → SQL Editor → Run
-- ============================================================

create table if not exists estados_cuenta (
  id          text primary key,
  banco       text,
  cuenta      text,                    -- enmascarada: ****4417
  periodo     text,                    -- 2026-08
  confiable   boolean default false,   -- ¿cuadró al centavo?
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);

comment on table estados_cuenta is
  'Estados de cuenta del banco con sus movimientos. Sólo entran los que cuadran al centavo; los que no, quedan marcados NO CONFIABLES y no alimentan reportes.';
comment on column estados_cuenta.cuenta is
  'Enmascarada (****4417). El número completo NUNCA se guarda.';
comment on column estados_cuenta.confiable is
  'false = la aritmética no cuadró. Ese estado no debe usarse para nada hasta conseguir otro archivo del banco.';

-- Un mismo estado (banco + cuenta + periodo) no se puede cargar dos veces:
-- cargarlo doble duplicaría todos sus movimientos.
create unique index if not exists estados_cuenta_unico
  on estados_cuenta (banco, cuenta, periodo);

alter table estados_cuenta enable row level security;

drop policy if exists "leer estados_cuenta"   on estados_cuenta;
drop policy if exists "crear estados_cuenta"  on estados_cuenta;
drop policy if exists "editar estados_cuenta" on estados_cuenta;
drop policy if exists "borrar estados_cuenta" on estados_cuenta;

create policy "leer estados_cuenta" on estados_cuenta
  for select using (tiene_perfil());
create policy "crear estados_cuenta" on estados_cuenta
  for insert with check (tiene_perfil());
create policy "editar estados_cuenta" on estados_cuenta
  for update using (tiene_perfil()) with check (tiene_perfil());
create policy "borrar estados_cuenta" on estados_cuenta
  for delete using (tiene_perfil());

-- ============================================================
--  LISTO. Ahora son 42 tablas de la app (43 con 'perfiles').
--  Vuelve a correr el SQL 14 para confirmar.
--
--  Nota: los MOVIMIENTOS del banco no se editan ni se borran desde la app —
--  el banco es la verdad. Lo que sí se edita es la conciliación: a qué gasto
--  o ingreso corresponde cada movimiento, y eso vive aparte.
-- ============================================================
