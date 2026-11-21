-- ============================================================
--  HOJA 45 — Entrada de WhatsApp.   *** PENDIENTE: NO INSTALADA ***
--
--  No está en `orden.json` ni en la base. Se instala el día que Luis autorice
--  la cuenta de WhatsApp Business, el número y los costos; ese día se mueve a
--  `supabase/`, se agrega a `orden.json` y se instala con `apply_migration`.
--
--  Qué es: el buzón donde la función `whatsapp-entrada` deja cada mensaje TAL
--  CUAL llegó. No es un registro del rancho: de aquí la app lo lee, lo propone
--  por el camino común y una persona con permiso lo confirma.
--
--  · Sólo inserción, y sólo la función del servidor (llave de servicio).
--  · Nadie lo cambia ni lo borra: sin política de update ni delete.
--  · Lo leen quienes ya pueden leer el chat.
--  · El id es el de WhatsApp: el mismo mensaje entregado dos veces es uno.
-- ============================================================

create table if not exists whatsapp_entrada (
  id        text primary key,
  de        text not null,
  cuando    timestamptz not null,
  clase     text not null,
  datos     jsonb not null,
  recibido  timestamptz not null default now(),
  _espacio  text not null
);

alter table whatsapp_entrada enable row level security;

drop policy if exists "leer la entrada de whatsapp" on whatsapp_entrada;
create policy "leer la entrada de whatsapp" on whatsapp_entrada
  for select using (puede('chat', 'leer'));

revoke all on whatsapp_entrada from anon;
revoke insert, update, delete on whatsapp_entrada from authenticated;
grant select on whatsapp_entrada to authenticated;

create index if not exists whatsapp_entrada_recibido on whatsapp_entrada (recibido);
