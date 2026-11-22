-- Un rancho inventado, capturado POR LAS PUERTAS DE VERDAD: cada cuenta con su sesión, para que la base selle,
-- firme y anote como en producción. Ningún dato real.
\set ON_ERROR_STOP on
\set luis '00000000-0000-0000-0000-000000000001'
\set migue '00000000-0000-0000-0000-000000000002'
\set encargado '00000000-0000-0000-0000-000000000003'
\set finanzas '00000000-0000-0000-0000-000000000005'

-- El administrador: catálogos, dinero, un permiso otorgado, un pago (operación sensible) y una cancelación.
select set_config('request.jwt.claim.sub', :'luis', false); set role authenticated;
insert into ranchos (id, nombre, datos) values ('r1', 'RANCHO INVENTADO', '{}');
insert into parcelas (id, nombre, rancho_id, datos) values ('p1', 'PARCELA UNO', 'r1', '{"hectareas": 2, "cultivo": "Ajo"}');
insert into trabajadores (id, datos) values ('t1', '{"nombre": "JUAN INVENTADO", "sueldo": 350}'), ('t2', '{"nombre": "PEDRO INVENTADO", "sueldo": 350}');
insert into proveedores (id, datos) values ('pv1', '{"nombre": "AGROQUIMICOS INVENTADOS"}');
insert into egresos (id, datos) values ('e-luz', '{"monto": 1500.5, "concepto": "LUZ DEL POZO", "fecha": "2026-11-18"}'), ('e-ref', '{"monto": 800, "concepto": "REFACCION", "parcelaId": "p1", "fecha": "2026-11-18"}');
insert into ingresos (id, datos) values ('i-venta', '{"monto": 10000, "concepto": "VENTA DE AJO", "fecha": "2026-11-19"}');
insert into cajachica (id, datos) values ('cc1', '{"tipo": "entrada", "monto": 2000, "concepto": "FONDO", "fecha": "2026-11-18"}'), ('cc2', '{"tipo": "salida", "clase": "gasto_general", "monto": 300, "concepto": "DIESEL", "fecha": "2026-11-19"}');
insert into creditos (id, datos) values ('cr1', '{"monto": 10000, "proveedorId": "pv1", "abonos": [{"id": "ab1", "monto": 3000, "tipo": "dinero", "fecha": "2026-11-19"}, {"id": "ab2", "monto": 2000, "tipo": "dinero", "fecha": "2026-11-19", "cancelado": true, "motivoCancelacion": "se capturó dos veces", "canceladoPor": "Prueba luis"}]}');
insert into estados_cuenta (id, datos) values ('ec1', '{"banco": "BANCO INVENTADO", "saldoFinal": 54321.12}');
insert into titulares (id, datos) values ('ti1', '{"nombre": "SOCIO INVENTADO"}');
insert into bolsas (id, datos) values ('bo1', '{"nombre": "CUENTA INVENTADA", "titularId": "ti1"}');
select otorgar_permiso(:'migue'::uuid, 'cerrar_mes');
insert into eventos (id, tipo, fecha, estado, datos) values
  ('ev-pago-1', 'pago_personal', '2026-11-20', 'vigente', '{"cuando": "2026-11-20T18:00:00.000Z", "quien": {"id": "luis"}, "datos": {"a": {"tipo": "trabajador", "id": "t1"}, "monto": 2100, "medio": "efectivo"}}'),
  ('ev-pago-2', 'pago_personal', '2026-11-20', 'vigente', '{"cuando": "2026-11-20T18:05:00.000Z", "quien": {"id": "luis"}, "datos": {"a": {"tipo": "trabajador", "id": "t2"}, "monto": 2100, "medio": "efectivo"}}');
update eventos set estado = 'cancelado', datos = datos || '{"cancelado": {"motivo": "se pagó dos veces", "por": "luis"}}' where id = 'ev-pago-2';
insert into auditoria (id, accion, quien, datos) values ('au1', 'cancelo', 'Prueba luis', '{"motivo": "se pagó dos veces", "tabla": "eventos"}');
reset role;

-- El encargado: lo de campo (y un pago que NO le toca: la base lo guarda RECHAZADO, y así tiene que volver).
select set_config('request.jwt.claim.sub', :'encargado', false); set role authenticated;
insert into eventos (id, tipo, fecha, estado, datos) values
  ('ev-marca-1', 'marca', '2026-11-20', 'vigente', '{"cuando": "2026-11-20T13:00:00.000Z", "quien": {"id": "encargado"}, "datos": {"trabajadorId": "t1", "clase": "entrada"}}'),
  ('ev-pago-sin-permiso', 'pago_personal', '2026-11-20', 'vigente', '{"cuando": "2026-11-20T19:00:00.000Z", "quien": {"id": "encargado"}, "datos": {"a": {"tipo": "trabajador", "id": "t1"}, "monto": 999, "medio": "efectivo"}}');
insert into actividades (id, datos) values ('a1', '{"trabajadorId": "t1", "parcelaId": "p1", "actividad": "Riego", "fecha": "2026-11-20"}');
insert into cajachica (id, datos) values ('cc3', '{"tipo": "salida", "clase": "otro", "monto": 50, "concepto": "NO SE QUE FUE", "fecha": "2026-11-20"}');
reset role;

-- Los archivos: lo que el almacén dice tener (sus bytes viven en el almacén, no en la base).
select set_config('request.jwt.claim.sub', '', false);
insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', false) on conflict (id) do nothing;
insert into storage.objects (bucket_id, name, owner, metadata) values
  ('comprobantes', 'archivo:aaa111.jpg', :'luis', '{"size": 20, "mimetype": "image/jpeg"}'),
  ('comprobantes', 'archivo:bbb222.pdf', :'encargado', '{"size": 24, "mimetype": "application/pdf"}'),
  ('comprobantes', 'c/conv-1/nota de voz.webm', :'encargado', '{"size": 17, "mimetype": "audio/webm"}');
