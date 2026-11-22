-- ¿LA COPIA RESTAURADA SIGUE CERRADA? Intentos no autorizados contra una base, sin dejar nada escrito.
-- Lo corre la restauración después de comparar las huellas: que las reglas sean las mismas no basta, hay que
-- empujar la puerta. Todo va dentro de una transacción que se deshace: no queda ni un renglón.
--   · sin sesión (sólo la llave pública) y con una cuenta que se registró sola, sin perfil;
--   · leer dinero y personal, meter un gasto, meter un pago, tocar y borrar la bitácora, darse un perfil.
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
    reset role;
  end loop;
  if pasaron <> '' then raise exception 'LA COPIA DEJA PASAR:%', pasaron; end if;
  raise notice 'INTENTOS_RECHAZADOS %', hechos;
end $$;
rollback;
