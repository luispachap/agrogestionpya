# 05 · Auditoría del buzón de papeles (lo que ya existe)

Se revisó `src/lectura.js`, `src/lectorPapeles.js`, la pantalla Buzón de
papeles y la función del servidor `leer-papel`, contra el diseño `01`.
**Conclusión: la base está bien hecha y se aprovecha tal cual; no hace falta un
sistema paralelo.** Faltaban tres cosas; dos quedaron corregidas en rama.

| Punto | Qué hay | Veredicto |
|---|---|---|
| Extracción | Cascada QR → XML → patrón aprendido → IA → "por identificar". 46 pruebas. Nunca OCR al total | Bien. Sólo probado con textos de prueba, **no con tickets reales** |
| No inventar | Lo ilegible queda en blanco y se nombra qué faltó | Bien |
| Confirmación humana | Nada se aplica solo: propone, enseña y espera el sí; al almacén renglón por renglón | Bien |
| Aplicar una sola vez | La marca vive en el propio papel | Bien |
| **Duplicados** | **No había.** El mismo ticket fotografiado dos veces eran dos papeles y los dos se podían aplicar: gasto doble | **Corregido en rama, 4 pruebas.** Avisa con el criterio en palabras ("mismo proveedor + importe exacto + mismo día" o "LA MISMA FACTURA" si coincide el folio fiscal) y espera el sí. No bloquea: dos compras iguales existen |
| Evidencia | La foto se guarda siempre, y va pegada al egreso | **Problema abierto:** la foto se guarda *dentro* del registro, en la memoria del teléfono (tope ~5 MB) y por duplicado (papel y egreso). Unas 15–20 fotos llenan el teléfono. Ya sale el aviso rojo, pero la solución es guardar las fotos en el almacén de archivos de Supabase y dejar en el registro sólo la referencia |
| **Permisos del servidor** | **La función aceptaba a cualquiera con la llave pública** (que viene en la app): un extraño podía gastar la lectura con IA | **Corregido en rama, SIN probar** (la función no está instalada y la base está pausada). Ahora exige sesión con perfil. Las otras dos funciones (`oir-audio`, `revisar-parcela`) tienen el mismo hueco y siguen abiertas |
| Persistencia | Papeles y patrones van a la nube como lo demás (hoja SQL 18, pendiente de correr) | Hereda los problemas generales de sincronización |
| Proveedor de IA | Uno solo, escrito fijo en la función; la llave vive sólo en el servidor | La llave está bien. Falta hacerlo intercambiable y decidir el costo — **no se contrata nada sin autorización** |
| Datos sensibles | El buzón acepta cualquier foto | Falta el candado: identificaciones y documentos laborales **no** deben poder mandarse a la IA |

## Siguiente paso propuesto (prueba vertical del ticket)

Con 10–20 tickets y facturas reales de los proveedores de siempre: medir cuántos
campos sobreviven sin corregir. Necesita la base encendida, la función instalada
y una llave de IA — tres cosas que requieren autorización.
