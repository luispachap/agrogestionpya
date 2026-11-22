-- ¿LA COPIA RESTAURADA SIGUE CERRADA? Intentos no autorizados contra una base, sin dejar nada escrito.
-- Lo corre la restauración después de comparar las huellas: que las reglas sean las mismas no basta, hay que
-- empujar la puerta. Todo va dentro de una transacción que se deshace: no queda ni un renglón.
--   · sin sesión (sólo la llave pública) y con una cuenta que se registró sola, sin perfil;
--   · leer dinero y personal, meter un gasto, meter un pago, tocar y borrar la bitácora, darse un perfil,
--     y llamar funciones que deben estar cerradas (firmar sellos, apartar dinero de la IA).
-- Si algo pasa, truena con la lista. Si todo se rechaza, avisa cuántos intentos hizo.
begin;
do $$
declare
  pasaron text := '';
  hechos int := 0;
  n bigint;
  quien text;
  intento record;
begin
  foreach quien in array array['anon', 'authenticated'] loop
    perform set_config('request.jwt.claim.sub', case quien when 'anon' then '' else '99999999-9999-4999-8999-999999999999' end, true);
    perform set_config('request.jwt.claims', case quien when 'anon' then '' else '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}' end, true);
    execute 'set local role ' || quien;
    -- Leer: no debe salir ni un renglón (rechazado o vacío).
    for intento in select * from (values
      ('lee los gastos', 'select count(*) from public.egresos'),
      ('lee los ingresos', 'select count(*) from public.ingresos'),
      ('lee al personal', 'select count(*) from public.trabajadores'),
      ('lee los eventos', 'select count(*) from public.eventos'),
      ('lee la bitácora', 'select count(*) from public.auditoria'),
      ('lee los perfiles', 'select count(*) from public.perfiles'),
      ('lee los permisos otorgados', 'select count(*) from public.permisos_operacion')
    ) t(que, sql) loop
      hechos := hechos + 1;
      begin
        execute intento.sql into n;
        if n > 0 then pasaron := pasaron || format(' [%s %s: %s renglones]', quien, intento.que, n); end if;
      exception when others then null;
      end;
    end loop;
    -- Escribir: no debe cambiar ni un renglón.
    for intento in select * from (values
      ('mete un gasto', $q$insert into public.egresos (id, datos) values ('intento-no-autorizado', '{"monto": 1}')$q$),
      ('mete un pago al personal', $q$insert into public.eventos (id, tipo, fecha, estado, datos) values ('intento-no-autorizado', 'pago_personal', '2026-01-01', 'vigente', '{}')$q$),
      ('cambia la bitácora', $q$update public.auditoria set quien = 'otro' where id is not null$q$),
      ('borra la bitácora', $q$delete from public.auditoria where id is not null$q$),
      ('borra gastos', $q$delete from public.egresos where id is not null$q$),
      ('cambia eventos', $q$update public.eventos set estado = 'cancelado' where id is not null$q$),
      ('se da un perfil', $q$insert into public.perfiles (id, nombre, rol) values ('99999999-9999-4999-8999-999999999999', 'Intento', 'superadmin')$q$),
      ('se da un permiso', $q$insert into public.permisos_operacion (usuario, operacion, otorgado_por) values ('99999999-9999-4999-8999-999999999999', 'autorizar_pagos', '99999999-9999-4999-8999-999999999999')$q$)
    ) t(que, sql) loop
      hechos := hechos + 1;
      begin
        execute intento.sql;
        get diagnostics n = row_count;
        if n > 0 then pasaron := pasaron || format(' [%s %s: %s renglones]', quien, intento.que, n); end if;
      exception when others then null;
      end;
    end loop;
    -- Llamar funciones que deben estar cerradas: si la llamada ENTRA (aunque después se niegue sola), la puerta quedó abierta.
    for intento in select * from (values
      ('llama a la función que firma los sellos', 'public.firma_de_sello(text,text,text,jsonb,text,text,uuid,text,timestamptz,timestamptz)'),
      ('llama a la función que aparta dinero de la IA', 'public.reservar_ia_mes'),
      ('llama a la función que valida eventos', 'public.validar_evento()')
    ) t(que, sql) loop
      hechos := hechos + 1;
      begin
        if position('(' in intento.sql) > 0 then n := has_function_privilege(current_user, intento.sql, 'execute')::int;
        else select count(*) into n from pg_proc p where p.oid::regproc::text in (intento.sql, split_part(intento.sql, '.', 2)) and has_function_privilege(current_user, p.oid, 'execute'); end if;
        if n > 0 then pasaron := pasaron || format(' [%s %s]', quien, intento.que); end if;
      exception when others then null;
      end;
    end loop;
    reset role;
  end loop;
  if pasaron <> '' then raise exception 'LA COPIA DEJA PASAR:%', pasaron; end if;
  raise notice 'INTENTOS_RECHAZADOS %', hechos;
end $$;
rollback;
