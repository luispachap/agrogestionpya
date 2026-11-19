# Tablero de avance — AgroGestión P&A

Actualizado: 19 nov 2026 · Rama de trabajo: `produccion/base-vigente` · Rama de emergencia: `emergencia/p0-contencion`

**El plan y el estado de la infraestructura nueva están en `docs/RUTA.md`.** Este tablero lleva el detalle por asunto.

**Cómo leer las columnas.** *En rama* = el código está escrito y subido. *Probado* = hay una prueba automática (con datos de mentira).
*Desplegado* = está en app.agroselectos.com. *Validado* = se comprobó con la operación real del rancho.

**Hoy: nada de esta etapa está desplegado ni validado.** Lo publicado sigue siendo la versión vulnerable, y el proyecto nuevo de Supabase aún no existe (falta que Luis cree la organización).

## Infraestructura propia (nuevo)

| Asunto | En rama | Probado | Desplegado | Validado |
|---|---|---|---|---|
| Base reconstruible desde cero (24 hojas, 54 tablas) | Sí | Sí | No | No |
| Fotos y PDF fuera de los registros, almacén privado, sin duplicados | Sí | Sí (navegador real + base) | No | No |
| Lo borrado deja lápida y no revive | Sí | Sí | No | No |
| Captura de campo por la cuenta del encargado | Sí | Sí (navegador real, nube de mentira) | No | No |
| La cola espera cuenta en vez de quemar intentos | Sí | Sí | No | No |
| Medidor de base, fotos e IA con avisos y freno | Sí | Sí | No | No |
| IA una vez por documento, con tope mensual | Sí | En el teléfono y la tabla, sí; **la función del servidor, no** | No | No |
| Cambios de sueldo anotados; costo "estimado" aparte | Sí | Sí | No | No |
| Devengado y distribución separados | Sí (aún no alimenta reportes) | Sí | No | No |

## Seguridad

| Asunto | En rama | Probado | Desplegado | Validado |
|---|---|---|---|---|
| PIN de fábrica de dirección eliminado | Sí | Sí (navegador real) | No | No |
| Sesión falsificable en el teléfono | Sí | Sí (navegador real) | No | No |
| Cuenta técnica y su contraseña fuera del código | Sí | Sí | No | **Falta rotar la contraseña (Luis)** |
| Datos personales fuera del código | Sí | Sí | No | Repos siguen públicos (Luis) |
| Aviso cuando el teléfono no guarda | Sí | **Sí (nuevo)** | No | No |
| Confirmación al borrar trabajador + bitácora | Sí | **Sí (nuevo)** | No | No |
| Recargar ya no borra lo pendiente | Sí | Sí | No | No |
| Permisos por rol en la base (hoja 24) | **Sí (nuevo)** | **Sí, 16 ataques en base aislada** | No | No — falta correrla en copia de la base real |
| Luis y Migue superadministradores con cuenta propia | **Sí (nuevo)** | Sí | No | No |
| Función de lectura con IA cerrada a extraños | **Sí (nuevo)** | **No** | No | No |
| Funciones `oir-audio` y `revisar-parcela` abiertas a extraños | No | — | — | — |
| Quien entra por PIN no tiene cuenta en la base | Sí: sube por la cuenta del encargado | Sí | No | No |
| PIN de trabajadores legibles en pantalla y en la base | No | — | — | — |

## Operación

| Asunto | En rama | Probado | Desplegado | Validado |
|---|---|---|---|---|
| Los 8 roles abren sus 131 pantallas sin tronar | — | **Sí (nuevo)** | — | No |
| Un aumento de sueldo ya no reescribe el costo pasado | **Sí (nuevo)** | Sí | No | No |
| Dar de baja a alguien ya no borra lo que costó | **Sí (nuevo, de hoy en adelante)** | Sí | No | No |
| Aviso de ticket duplicado en el buzón | **Sí (nuevo)** | Sí | No | No |
| Regla de costo por hora vs. por día (dos reglas conviven) | No — decide Luis y Migue (D-4) | — | — | — |
| Lo borrado en un teléfono revive en otro | Sí (lápidas) | Sí | No | No |
| Fotos de tickets llenan la memoria del teléfono | Sí (salen del registro) | Sí | No | No |
| Subir un estado de cuenta como foto truena (ya estaba en lo publicado) | Sí | Sí | No | No |

## Pruebas ejecutadas (todas con datos de mentira, ninguna contra la base real)

| Batería | Resultado |
|---|---|
| Reglas, cálculos y nombres sin definir (`npm test`) | 639 de 639 |
| La base armada desde cero y atacada directo (`npm run test:base`) | 32 de 32 |
| Navegador, versión compilada (`humo`) | 9 de 9 (lo publicado hoy: 4 de 9) |
| Navegador, recorrido por rol (`recorrido`) | 17 de 17 |
| Navegador, fotos fuera de los registros (`archivos`) | 9 de 9 |
| Navegador, captura de campo (`campo`) | 13 de 13 |
| Compilación | correcta, 103 módulos, lector de PDF aparte |

Todo junto: `sh pruebas/todo.sh`.

## Auditoría

| Documento | Tema | Estado |
|---|---|---|
| `auditoria/00` a `03` | Diagnóstico, diseño de incorporación, contención, versiones | Hecho |
| `auditoria/04` | Permisos en la base | Hecho |
| `auditoria/05` | Buzón de papeles | Hecho |
| `auditoria/06` | Mano de obra | Hecho |
| `PUBLICACION-EMERGENCIA-P0.md` (rama de emergencia) | Qué se publica, orden y reversa | Listo, esperando autorización |
| `RUTA.md` | Plan con infraestructura propia y estado de las diez instrucciones | Vigente |
| `DATOS-DE-LA-BASE-ANTERIOR.md` | Qué se recupera, de dónde y cuándo | Vigente |
| `PRUEBA-EN-TELEFONOS.md` | Lo que prueban Luis y Migue | Listo |
| `CAMBIO-DE-PRODUCCION.md` | El cambio y la reversa | Preparado, sin ejecutar |
| Pantallas nuevas (17) | Todas abren sin error. Revisadas a fondo: sólo el buzón | **Faltan 16 por revisar a fondo** |

## Pendiente de Luis

| # | Qué | Urgencia |
|---|---|---|
| L-1 | Crear la organización nueva "AgroGestion" (plan gratuito) en Supabase | **Es lo único que me detiene** |
| L-2 | Que cada teléfono descargue y mande su respaldo (`DATOS-DE-LA-BASE-ANTERIOR.md`) | **Hoy** |
| L-3 | Ver en el panel cuántos días quedan para reactivar la base pausada, y probar "descargar respaldo" | Esta semana |
| L-4 | Hacer privados los dos repositorios; borrar las dos variables viejas en Vercel | Alta |
| D-4 | Con Migue: quién va por día, por hora o a destajo | Antes del piloto |
| D-9 | Llave y presupuesto de IA (sin esto el buzón lee XML y proveedores conocidos, no fotos nuevas) | Cuando toque |
| D-2 | Separar el sistema del despacho del repositorio publicado | Media |

## Decisiones ya tomadas por Luis

- `produccion/base-vigente` es la base de desarrollo.
- Luis y Migue: superadministradores con el mismo nivel, cada uno con su cuenta. Sin aprobación de un tercero ni topes de monto.
- Ni los superadministradores borran historial en silencio.
- No se despliega ni se conectan datos reales sin autorización.
- AgroGestión tendrá infraestructura propia en Supabase gratuito, sin depender de ATALAYA. Nada se contrata sin autorización.
- La gente de campo captura desde el teléfono de un encargado con cuenta; sin cuenta técnica compartida.
- No se congelan sueldos históricos con valores de hoy.

## Versiones (nada se ha eliminado)

`main` intacta (versión de mayo). `produccion/fase-1-auditoria` conservada como registro. El sistema del despacho **no** está en este repositorio; sigue donde estaba, sin tocar.
