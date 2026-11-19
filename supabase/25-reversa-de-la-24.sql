-- ============================================================
--  AGROGESTIÓN — Reversa de la hoja 24 (permisos por rol)
--
--  Sólo si la 24 dejó a alguien sin poder trabajar y hay que volver a como
--  estaba mientras se corrige. Devuelve la regla anterior ("quien tiene perfil
--  puede todo") PERO conserva lo que ya era correcto: el dinero sigue sin
--  poder borrarse, la bitácora sigue intocable y nadie se da de alta solo.
--  No borra ningún dato ni la tabla permisos_rol.
-- ============================================================
do $$
declare
  t text; p record;
  dinero text[] := array['ingresos','egresos','prestamos','cajachica','creditos','estados_cuenta'];
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname not in ('perfiles','permisos_rol','auditoria','limites','uso_ia','operacion','invitaciones')
  loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on %I', p.policyname, t);
    end loop;
    execute format('create policy %I on %I for select using (tiene_perfil())', 'leer ' || t, t);
    execute format('create policy %I on %I for insert with check (tiene_perfil())', 'crear ' || t, t);
    execute format('create policy %I on %I for update using (tiene_perfil()) with check (tiene_perfil())', 'editar ' || t, t);
    -- Si ya está la hoja 30 (borrar deja lápida), el borrado directo NO vuelve.
    if not (t = any(dinero)) and to_regprocedure('public.borrar_registro(text,text)') is null then
      execute format('create policy %I on %I for delete using (tiene_perfil())', 'borrar ' || t, t);
    end if;
  end loop;
end $$;
