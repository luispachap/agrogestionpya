# Tablero de avance — AgroGestión P&A

Actualizado: 18 nov 2026 · Rama de trabajo: `produccion/base-vigente` · Rama de emergencia: `emergencia/p0-contencion`

**Cómo leer las columnas.** Son cuatro escalones distintos y ninguno implica el siguiente:
*En rama* = el código está escrito y subido. *Probado* = hay una prueba automática que lo comprueba (con datos de mentira).
*Desplegado* = está en app.agroselectos.com. *Validado* = se comprobó con la operación real del rancho.

**Hoy: nada de esta etapa está desplegado ni validado.** Lo publicado sigue siendo la versión vulnerable.

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
| Quien entra por PIN no tiene cuenta en la base (no sincroniza) | No — decisión de diseño | — | — | — |
| PIN de trabajadores legibles en pantalla y en la base | No | — | — | — |

## Operación

| Asunto | En rama | Probado | Desplegado | Validado |
|---|---|---|---|---|
| Los 8 roles abren sus 131 pantallas sin tronar | — | **Sí (nuevo)** | — | No |
| Un aumento de sueldo ya no reescribe el costo pasado | **Sí (nuevo)** | Sí | No | No |
| Dar de baja a alguien ya no borra lo que costó | **Sí (nuevo, de hoy en adelante)** | Sí | No | No |
| Aviso de ticket duplicado en el buzón | **Sí (nuevo)** | Sí | No | No |
| Regla de costo por hora vs. por día (dos reglas conviven) | No — decide Luis y Migue (D-4) | — | — | — |
| Lo borrado en un teléfono revive en otro | No — necesita la base encendida | — | — | — |
| Fotos de tickets llenan la memoria del teléfono | No | — | — | — |

## Pruebas ejecutadas (todas con datos de mentira, ninguna contra la base real)

| Batería | Resultado |
|---|---|
| Unitarias (`npm test`) | 584 de 584 |
| Ataques directos a la base (`npm run test:base`) | 16 de 16 |
| Navegador, versión compilada (`pruebas/humo_navegador.py`) | 9 de 9 (lo publicado hoy: 4 de 9) |
| Navegador, recorrido por rol (`pruebas/recorrido_navegador.py`) | 17 de 17 |
| Compilación | correcta, 100 módulos, lector de PDF aparte |

## Auditoría

| Documento | Tema | Estado |
|---|---|---|
| `auditoria/00` a `03` | Diagnóstico, diseño de incorporación, contención, versiones | Hecho |
| `auditoria/04` | Permisos en la base | Hecho |
| `auditoria/05` | Buzón de papeles | Hecho |
| `auditoria/06` | Mano de obra | Hecho |
| `PUBLICACION-EMERGENCIA-P0.md` (rama de emergencia) | Qué se publica, orden y reversa | Listo, esperando autorización |
| `RECUPERACION-SUPABASE.md` | Reactivar, respaldar y probar antes de datos reales | Escrito, sin ejecutar |
| Pantallas nuevas (17) | Todas abren sin error. Revisadas a fondo: sólo el buzón | **Faltan 16 por revisar a fondo** |

## Decisiones pendientes de Luis

| # | Decisión | Urgencia |
|---|---|---|
| D-1 | Reactivar la base de Supabase y sacar respaldo (`RECUPERACION-SUPABASE.md`, sección 1) | **La más urgente: tiene plazo** |
| D-3 | Autorizar la publicación de emergencia — **después** de D-1 | Alta |
| D-6 | Hacer privados los dos repositorios; borrar las dos variables en Vercel y cambiar esa contraseña | Alta |
| D-7 | Cómo sube sus datos la gente de campo que entra por PIN (`auditoria/04`, punto 1) | Antes del piloto |
| D-4 | Costo por hora o por día completo (`auditoria/06`) | Antes del piloto |
| D-8 | Congelar el sueldo en los registros viejos (modifica datos reales) | Media |
| D-2 | Separar el sistema del despacho del repositorio publicado | Media |
| D-5 | Repositorio definitivo: propongo `agrogestionpya`, con Vercel apuntando aquí | Media |
| D-9 | Proveedor y presupuesto para la lectura con IA | Cuando toque la prueba del ticket |

## Decisiones ya tomadas por Luis

- `produccion/base-vigente` es la base de desarrollo.
- Luis y Migue: superadministradores con el mismo nivel, cada uno con su cuenta. Sin aprobación de un tercero ni topes de monto.
- Ni los superadministradores borran historial en silencio.
- No se despliega ni se conectan datos reales sin autorización.

## Versiones (nada se ha eliminado)

`main` intacta (versión de mayo). `produccion/fase-1-auditoria` conservada como registro. El sistema del despacho **no** está en este repositorio; sigue donde estaba, sin tocar.
