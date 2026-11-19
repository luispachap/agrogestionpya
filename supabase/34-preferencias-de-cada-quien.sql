-- ============================================================
--  AGROGESTIÓN — Las preferencias de cada quien
--  Agroselectos P&A
--
--  Cómo acomodó cada persona su inicio, su barra de abajo y su menú. Antes
--  vivía sólo en el teléfono: al entrar en otro aparato se empezaba de cero.
--
--  No es un dato del rancho: es de la persona. Por eso NO pasa por los
--  permisos por perfil (hoja 24), ni lleva lápida (30), ni marca de espacio
--  (31): cada quien lee y escribe SU renglón y de nadie más — tampoco un
--  superadministrador ve ni toca el acomodo de otro.
--
--  Requiere la hoja 2. Cópialo COMPLETO: Supabase → SQL Editor → Run
-- ============================================================

create table if not exists preferencias (
  id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  datos        jsonb not null default '{}'::jsonb,
  actualizado  timestamptz not null default now(),
  -- Es un acomodo, no un cajón: que nadie guarde aquí otra cosa.
  constraint preferencias_chicas check (pg_column_size(datos) < 16000)
);

alter table preferencias enable row level security;
drop policy if exists "leer mis preferencias"    on preferencias;
drop policy if exists "crear mis preferencias"   on preferencias;
drop policy if exists "cambiar mis preferencias" on preferencias;
create policy "leer mis preferencias"    on preferencias for select using (id = auth.uid());
create policy "crear mis preferencias"   on preferencias for insert with check (id = auth.uid() and tiene_perfil());
create policy "cambiar mis preferencias" on preferencias for update using (id = auth.uid()) with check (id = auth.uid());
-- Sin política de borrado: no hace falta, y lo que no está, está negado.

revoke all on preferencias from anon;
grant select, insert, update on preferencias to authenticated;
