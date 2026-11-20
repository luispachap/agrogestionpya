-- ============================================================
--  43 · LOS ORIGINALES DE LA IMPORTACIÓN DE DOCUMENTOS
--
--  El almacén privado «comprobantes» aceptaba sólo fotos y PDF. La importación
--  de documentos guarda el ORIGINAL de cada papel que se sube (el XML de una
--  factura, un Excel, un CSV, un Word) para poder volver a verlo y para que
--  quede el rastro de dónde salió cada cifra.
--
--  No cambia el tope por archivo (3 MB) ni quién puede leer o subir: sólo
--  agrega tipos de archivo. No borra ni toca ningún archivo. Requiere la 26.
-- ============================================================
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf',
       'application/xml', 'text/xml', 'text/csv', 'text/plain',
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
 where id = 'comprobantes';
