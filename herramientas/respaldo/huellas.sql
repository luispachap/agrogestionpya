-- LAS HUELLAS DE UNA BASE: con qué se comprueba que una copia restaurada es igual a la original.
-- Sólo lee. Se genera con las mismas consultas de pruebas/base/paridad.mjs (hay prueba de que no se separen).
--   estructura: reglas de acceso, funciones, tablas, permisos por perfil, operaciones sensibles, puertas y candados.
--   datos:      cada tabla, con cuántos renglones tiene y la huella de todos ellos (sin importar el orden).
--   archivos:   qué fotos y documentos hay en el almacén (su contenido se comprueba aparte, archivo por archivo).
-- Las horas se comparan en UTC para que dos bases en distinta zona den lo mismo.
set timezone = 'UTC';
select clase, nombre, n, huella from (
select 'estructura' clase, 'reglas' nombre, count(*)::text n, coalesce(md5(string_agg(md5(x::text), '' order by md5(x::text) collate "C")), '') huella from (select tablename||'|'||policyname||'|'||cmd||'|'||array_to_string(roles, ',')||'|'||md5(regexp_replace(coalesce(qual,'')||'/'||coalesce(with_check,''), '[\s()]+|::[a-z ]+|public\.', '', 'g')) x from pg_policies where schemaname='public') t
union all
select 'estructura' clase, 'funciones' nombre, count(*)::text n, coalesce(md5(string_agg(md5(x::text), '' order by md5(x::text) collate "C")), '') huella from (select p.proname||'|'||md5(regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '\s+', '', 'g'))||'|'||p.prosecdef x from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname <> 'rls_auto_enable') t
union all
select 'estructura' clase, 'tablas' nombre, count(*)::text n, coalesce(md5(string_agg(md5(x::text), '' order by md5(x::text) collate "C")), '') huella from (select c.relname||'|'||c.relrowsecurity x from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r') t
union all
select 'estructura' clase, 'permisos' nombre, count(*)::text n, coalesce(md5(string_agg(md5(x::text), '' order by md5(x::text) collate "C")), '') huella from (select to_jsonb(p) - 'actualizado' x from (select rol, tabla, leer, crear, editar, borrar from permisos_rol) p) t
union all
select 'estructura' clase, 'sensibles' nombre, count(*)::text n, coalesce(md5(string_agg(md5(x::text), '' order by md5(x::text) collate "C")), '') huella from (select to_jsonb(o) x from (select * from operaciones_sensibles) o) t
union all
select 'estructura' clase, 'puertas' nombre, count(*)::text n, coalesce(md5(string_agg(md5(x::text), '' order by md5(x::text) collate "C")), '') huella from (select p.proname||'|'||has_function_privilege('anon', p.oid, 'execute')||'|'||has_function_privilege('authenticated', p.oid, 'execute') x from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname <> 'rls_auto_enable') t
union all
select 'estructura' clase, 'candados' nombre, count(*)::text n, coalesce(md5(string_agg(md5(x::text), '' order by md5(x::text) collate "C")), '') huella from (select c.relname||'|'||tg.tgname||'|'||tg.tgenabled::text x from pg_trigger tg join pg_class c on c.oid=tg.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not tg.tgisinternal) t
union all
select 'datos' clase, n.nspname||'.'||c.relname nombre,
  split_part(r.v, ':', 1) n, split_part(r.v, ':', 2) huella
from pg_class c join pg_namespace n on n.oid = c.relnamespace
cross join lateral (select (xpath('/row/v/text()', query_to_xml(format(
  'select count(*)::text || '':'' || coalesce(md5(string_agg(h, '''' order by h collate "C")), '''') as v from (select md5(t::text) h from %I.%I t) s',
  n.nspname, c.relname), false, true, '')))[1]::text v) r
where c.relkind = 'r' and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname in ('users', 'identities')) or (n.nspname = 'storage' and c.relname = 'buckets'))
union all
select 'archivos' clase, 'storage.objects' nombre, count(*)::text n, coalesce(md5(string_agg(md5(bucket_id||'/'||name), '' order by md5(bucket_id||'/'||name) collate "C")), '') huella from storage.objects
) todo order by clase, nombre;
