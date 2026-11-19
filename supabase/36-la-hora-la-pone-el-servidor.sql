-- ============================================================
--  36 · LA HORA LA PONE EL SERVIDOR
--
--  Un evento trae la hora del teléfono que lo capturó, y un teléfono puede
--  traer la hora mal. Aquí la base anota, por su cuenta, cuándo RECIBIÓ cada
--  evento (`recibido`) y cuándo lo tocó por última vez (`actualizado`).
--  Ninguna de las dos la puede poner ni cambiar quien lo sube.
--
--  · `recibido` sirve para saber que algo NO pudo pasar después de esa hora.
--  · `actualizado` es la marca con que cada aparato pide "lo nuevo": si la
--    pusiera el teléfono, uno con la hora atrasada subiría eventos que los
--    demás nunca bajarían.
--  · `hora_del_servidor()` deja que cada teléfono mida cuánto difiere su reloj.
--
--  No borra ni cambia lo que dice ningún evento. Requiere la hoja 35.
-- ============================================================

alter table eventos add column if not exists recibido timestamptz;

-- Lo que ya estaba (antes de poner el candado, que no deja cambiarlo): se da por recibido cuando se subió (es lo más que se sabe).
update eventos set recibido = actualizado where recibido is null;

create or replace function sellar_recibido()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.recibido := now();
  else
    new.recibido := old.recibido;
  end if;
  new.actualizado := now();
  return new;
end $$;

drop trigger if exists eventos_a_recibido on eventos;
create trigger eventos_a_recibido before insert or update on eventos for each row execute function sellar_recibido();
revoke execute on function sellar_recibido() from public, anon, authenticated;

create or replace function hora_del_servidor()
returns timestamptz language sql stable set search_path = public as $$ select now() $$;
revoke execute on function hora_del_servidor() from public, anon;
grant execute on function hora_del_servidor() to authenticated;
