-- ============================================================
--  38 · `rls_auto_enable` no se llama desde fuera
--
--  Es la función que Supabase instala para prenderle la seguridad por renglón
--  a toda tabla nueva (la dispara la base sola, al crear una tabla). Venía con
--  permiso de ejecución para cualquiera, también sin sesión. No se podía
--  aprovechar —una función de ese tipo sólo corre dentro de su disparador—,
--  pero una puerta que no hace falta se cierra. El disparador sigue igual.
-- ============================================================
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
