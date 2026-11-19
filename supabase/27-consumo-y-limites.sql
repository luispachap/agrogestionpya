-- ============================================================
--  AGROGESTIÓN — Medir cuánto se lleva gastado del plan gratuito
--  Agroselectos P&A
--
--  El plan gratuito de Supabase da 500 MB de base y 1 GB de archivos. Lo que
--  no se mide, se llena sin avisar. Aquí viven los topes y una función que
--  la app consulta para enseñar el medidor y avisar con tiempo.
--
--  Los topes se cambian aquí (sólo superadministradores). Subirlos NO
--  contrata nada: si un día se pasa a un plan de paga, se ajustan los números.
--
--  Requiere la hoja 24. Cópialo COMPLETO: Supabase → SQL Editor → Run
-- ============================================================

create table if not exists limites (
  id           text primary key default 'unico' check (id = 'unico'),  -- un solo renglón
  base_mb      integer not null default 500,
  archivos_mb  integer not null default 1024,
  aviso_pct    integer not null default 70,   -- ámbar: empieza a avisar
  alto_pct     integer not null default 85,   -- rojo: hay que hacer algo
  tope_pct     integer not null default 95,   -- ya no se aceptan archivos nuevos
  -- La IA lleva su propio presupuesto, aparte del almacenamiento.
  ia_llamadas_mes integer not null default 150,
  ia_centavos_mes integer,                    -- en blanco = sólo se limita por número de llamadas
  actualizado  timestamptz not null default now()
);
insert into limites (id) values ('unico') on conflict (id) do nothing;

alter table limites enable row level security;
drop policy if exists "leer limites"   on limites;
drop policy if exists "editar limites" on limites;
create policy "leer limites"   on limites for select using (tiene_perfil());
create policy "editar limites" on limites for update using (es_superadmin()) with check (es_superadmin());

-- El medidor. Lo puede consultar cualquiera con perfil (la app lo necesita
-- para avisar); el desglose por tabla sólo lo ven los superadministradores.
create or replace function consumo()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare l limites; r jsonb; tablas jsonb := '[]'::jsonb; ia jsonb := null;
begin
  if not tiene_perfil() then return null; end if;
  select * into l from limites limit 1;
  if es_superadmin() then
    select coalesce(jsonb_agg(x), '[]'::jsonb) into tablas from (
      select c.relname as tabla, pg_total_relation_size(c.oid) as bytes
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by 2 desc limit 8) x;
  end if;
  if to_regclass('public.uso_ia') is not null then
    execute $q$ select jsonb_build_object(
        'llamadas', count(*) filter (where not de_cache),
        'ahorradas', count(*) filter (where de_cache),
        'centavos', coalesce(sum(centavos) filter (where not de_cache), 0))
      from uso_ia
      where cuando >= (date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City') $q$ into ia;
  end if;
  r := jsonb_build_object(
    'cuando', now(),
    'base_bytes', pg_database_size(current_database()),
    'archivos_bytes', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects where bucket_id = 'comprobantes'),
    'archivos_n', (select count(*) from storage.objects where bucket_id = 'comprobantes'),
    'limites', to_jsonb(l) - 'id' - 'actualizado',
    'ia_mes', ia,
    'tablas', tablas);
  return r;
end $$;
