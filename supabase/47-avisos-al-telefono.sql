-- ============================================================
--  HOJA 47 — Avisos al teléfono (con AgroGestión cerrada).
--
--  Cómo llegan: es el mecanismo estándar de los navegadores («web push»).
--  El teléfono se suscribe y el aviso viaja por el servicio de avisos del
--  propio navegador (en Android con Chrome, el de Google). No se contrata
--  nada ni hay cuenta que abrir: es gratis y va con el navegador.
--
--  · Cada quien suscribe SUS aparatos y sólo ve los suyos.
--  · Las llaves con que se firman los avisos viven aquí, en una tabla que
--    ninguna cuenta puede leer: no están en el código ni en ningún chat.
--  · Cuando entra un mensaje, una asignación, una incidencia o algo por
--    autorizar, la base le avisa a la función del servidor (`avisar`), que
--    decide a quién le toca y manda el aviso. El aviso NO lleva el texto del
--    mensaje ni importes: dice de quién es y dónde, y al tocarlo abre la app,
--    que vuelve a comprobar los permisos.
--  · El mismo aviso no se manda dos veces a la misma persona.
--  · Si el aviso no se puede mandar, el registro se guarda igual: avisar
--    nunca bloquea el trabajo.
-- ============================================================
create extension if not exists pg_net;

create table if not exists avisos_suscripciones (
  endpoint text primary key,
  usuario  uuid not null,
  p256dh   text not null,
  auth     text not null,
  aparato  text,
  creado   timestamptz not null default now()
);
create index if not exists avisos_suscripciones_usuario on avisos_suscripciones (usuario);
create table if not exists avisos_preferencias (
  usuario     uuid primary key,
  datos       jsonb not null default '{}',
  actualizado timestamptz not null default now()
);
create table if not exists avisos_llaves (
  id      text primary key default 'unico' check (id = 'unico'),
  publica text, privada text, secreto text, url text
);
create table if not exists avisos_enviados (
  llave   text primary key,
  usuario uuid not null,
  cuando  timestamptz not null default now()
);
insert into avisos_llaves (id, secreto) values ('unico', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')) on conflict (id) do nothing;

alter table avisos_suscripciones enable row level security;
alter table avisos_preferencias  enable row level security;
alter table avisos_llaves        enable row level security;
alter table avisos_enviados      enable row level security;
drop policy if exists "ver mis aparatos" on avisos_suscripciones;
create policy "ver mis aparatos" on avisos_suscripciones for select using (usuario = auth.uid());
drop policy if exists "ver mis preferencias de avisos" on avisos_preferencias;
create policy "ver mis preferencias de avisos" on avisos_preferencias for select using (usuario = auth.uid());
revoke all on avisos_suscripciones, avisos_preferencias, avisos_llaves, avisos_enviados from anon;
revoke insert, update, delete on avisos_suscripciones, avisos_preferencias from authenticated;
revoke all on avisos_llaves, avisos_enviados from authenticated;

-- Suscribir este aparato a MI cuenta. Si el aparato estaba suscrito a otra cuenta (un teléfono que cambió de
-- manos), pasa a la mía: los avisos de la otra persona dejan de llegar aquí.
create or replace function guardar_suscripcion(p_endpoint text, p_p256dh text, p_auth text, p_aparato text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'Sólo una cuenta del rancho recibe avisos.' using errcode = '42501';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'La suscripción del aparato viene incompleta.' using errcode = 'P0001';
  end if;
  insert into avisos_suscripciones (endpoint, usuario, p256dh, auth, aparato) values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(p_aparato, 120))
  on conflict (endpoint) do update set usuario = excluded.usuario, p256dh = excluded.p256dh, auth = excluded.auth, aparato = excluded.aparato, creado = now();
end $$;

create or replace function quitar_suscripcion(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from avisos_suscripciones where endpoint = p_endpoint and usuario = auth.uid();
$$;

create or replace function guardar_preferencias_de_avisos(p_datos jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión.' using errcode = '42501'; end if;
  insert into avisos_preferencias (usuario, datos) values (auth.uid(), coalesce(p_datos, '{}'::jsonb))
  on conflict (usuario) do update set datos = excluded.datos, actualizado = now();
end $$;

create or replace function llave_publica_de_avisos()
returns text language sql stable security definer set search_path = public as $$
  select publica from avisos_llaves where id = 'unico' and auth.uid() is not null;
$$;

-- La base le avisa a la función del servidor. Nunca bloquea: si no hay con qué avisar, el registro entra igual.
create or replace function avisar_cambio()
returns trigger language plpgsql security definer set search_path = public as $$
declare v record;
begin
  begin
    if to_regproc('net.http_post') is null then return new; end if;
    select url, secreto into v from avisos_llaves where id = 'unico';
    if v.url is null or v.secreto is null then return new; end if;
    execute 'select net.http_post(url := $1, body := $2, headers := $3)'
      using v.url, jsonb_build_object('tabla', tg_table_name, 'id', new.id),
            jsonb_build_object('Content-Type', 'application/json', 'x-aviso-secreto', v.secreto);
  exception when others then null;
  end;
  return new;
end $$;

drop trigger if exists chat_avisa on chat;
create trigger chat_avisa after insert on chat for each row execute function avisar_cambio();
drop trigger if exists indicaciones_avisa on indicaciones;
create trigger indicaciones_avisa after insert on indicaciones for each row execute function avisar_cambio();
drop trigger if exists incidencias_avisa on incidencias;
create trigger incidencias_avisa after insert on incidencias for each row execute function avisar_cambio();
drop trigger if exists solicitudes_compra_avisa on solicitudes_compra;
create trigger solicitudes_compra_avisa after insert on solicitudes_compra for each row execute function avisar_cambio();
drop trigger if exists eventos_avisa on eventos;
create trigger eventos_avisa after insert on eventos for each row execute function avisar_cambio();

revoke execute on function avisar_cambio() from public, anon, authenticated;
revoke execute on function guardar_suscripcion(text, text, text, text), quitar_suscripcion(text), guardar_preferencias_de_avisos(jsonb), llave_publica_de_avisos() from public, anon;
grant execute on function guardar_suscripcion(text, text, text, text), quitar_suscripcion(text), guardar_preferencias_de_avisos(jsonb), llave_publica_de_avisos() to authenticated;
