-- ============================================================
--  AGROGESTIÓN — Las funciones internas no se llaman desde afuera
--  Agroselectos P&A
--
--  El revisor de seguridad de Supabase avisó (con razón) que las funciones de
--  la base se podían invocar directo por internet, incluso sin sesión. Todas
--  comprueban permisos por dentro, pero una puerta que no hace falta, sobra.
--
--   · Sin sesión: no se puede llamar NINGUNA.
--   · Con sesión: sólo las que la app usa de verdad.
--   · Las que son de uso interno (candados y sellos que la base dispara sola,
--     y las del montaje) no las llama nadie desde afuera.
--
--  Requiere las hojas 24 a 32. Cópialo COMPLETO: Supabase → SQL Editor → Run
-- ============================================================

alter function cuidar_lapida() set search_path = public;

do $$
declare f record;
  -- lo que la app llama, o lo que las reglas de acceso necesitan evaluar
  con_sesion text[] := array['puede', 'tiene_perfil', 'es_superadmin', 'es_admin', 'mi_rol', 'es_usuario_valido',
    'cabe_otro_archivo', 'consumo', 'borrar_registro', 'restaurar_registro', 'declarar_inicio', 'reclamar_acceso', 'sellar_espacio'];
begin
  for f in
    select p.oid::regprocedure as firma, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname in ('puede', 'tiene_perfil', 'es_superadmin', 'es_admin', 'mi_rol', 'es_usuario_valido',
        'cabe_otro_archivo', 'consumo', 'borrar_registro', 'restaurar_registro', 'declarar_inicio', 'reclamar_acceso',
        'sellar_espacio', 'preparar_arranque', 'cuidar_ultimo_superadmin', 'sellar_auditoria', 'sellar_cuenta', 'exigir_espacio')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.firma);
    if f.proname = any(con_sesion) then
      execute format('grant execute on function %s to authenticated', f.firma);
    end if;
  end loop;
end $$;
