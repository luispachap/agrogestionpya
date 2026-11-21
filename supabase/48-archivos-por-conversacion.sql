-- ============================================================
--  HOJA 48 — Los archivos de una conversación, con su candado.
--
--  Las fotos y documentos que se mandan en una conversación cerrada se guardan
--  en su propia carpeta del almacén: «c/<conversación>/<huella>.<ext>». La base
--  sólo deja verlos, bajarlos, listarlos o subir ahí a quien participa en esa
--  conversación (o la tiene abierta por consulta excepcional, sólo para ver).
--
--  Antes cualquier cuenta con lectura de archivos podía listar el almacén
--  completo. Con esto, lo que está en «c/…» no aparece ni se baja si no se
--  participa; el resto (comprobantes de siempre) sigue igual.
-- ============================================================
drop policy if exists "ver comprobantes"   on storage.objects;
drop policy if exists "subir comprobantes" on storage.objects;
create policy "ver comprobantes" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and (
    (name not like 'c/%' and public.puede('archivos', 'leer'))
    or (name like 'c/%' and public.puede('chat', 'leer') and split_part(name, '/', 2) <> '' and split_part(name, '/', 2) <> 'general'
        and public.ve_conversacion(split_part(name, '/', 2)))));
create policy "subir comprobantes" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and public.cabe_otro_archivo() and (
    (name not like 'c/%' and public.puede('archivos', 'crear'))
    or (name like 'c/%' and public.puede('chat', 'crear') and public.participa_en(split_part(name, '/', 2)))));
