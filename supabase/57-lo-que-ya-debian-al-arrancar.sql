-- ============================================================
--  57 · LO QUE UN TRABAJADOR YA DEBÍA CUANDO ARRANCÓ LA APP
--
--  Los préstamos que se dieron antes de la app (la nómina en papel los
--  descontaba cada semana) se anotan como un saldo a una fecha de corte
--  (`prestamo_saldo_inicial`), con quién responde por esa cifra y su
--  evidencia. Crea una deuda que se abona, así que es SENSIBLE: lo valida la
--  base con la cuenta de la sesión y pide el permiso «autorizar_prestamos»
--  (el mismo de autorizar un préstamo) y un importe mayor a cero.
--
--  No crea ningún permiso nuevo ni se lo da a nadie. No borra ni cambia
--  ningún dato. Requiere las hojas 37, 39 y 52.
-- ============================================================
insert into operaciones_sensibles (tipo, operacion, pide_importe) values
  ('prestamo_saldo_inicial', 'autorizar_prestamos', true)
on conflict (tipo) do update set operacion = excluded.operacion, pide_importe = excluded.pide_importe;
