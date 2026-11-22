-- QUIÉN PUEDE LLAMAR CADA FUNCIÓN Y TOCAR CADA TABLA, escrito como órdenes que se pueden volver a aplicar.
-- Hace falta porque una copia normal de la base NO trae los permisos que se QUITARON: un proyecto nuevo de Supabase
-- le da de entrada a toda cuenta permiso de llamar cualquier función y tocar cualquier tabla, y la copia sólo dice
-- «además dale permiso a…». Sin esto, al restaurar quedarían abiertas funciones que deben estar cerradas (la que firma
-- los sellos, las de la IA, las de arranque). Lo encontró el ensayo local del 22 nov.
-- Sólo lee. Devuelve un renglón por orden. Se guarda en el respaldo y la restauración lo aplica al final.
select format('revoke all on function %I.%I(%s) from public, anon, authenticated, service_role;', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
       || coalesce((select string_agg(format(' grant execute on function %I.%I(%s) to %I;', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), r), '' order by r)
                    from unnest(array['anon', 'authenticated', 'service_role']) r where has_function_privilege(r, p.oid, 'execute')), '')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prokind in ('f', 'p')
union all
select format('revoke all on table %I.%I from public, anon, authenticated, service_role;', n.nspname, c.relname)
       || coalesce((select string_agg(format(' grant %s on table %I.%I to %I;', priv, n.nspname, c.relname, r), '' order by r, priv)
                    from unnest(array['anon', 'authenticated', 'service_role']) r, unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) priv
                   where has_table_privilege(r, c.oid, priv)), '')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
 order by 1;
