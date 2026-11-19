# Ruta — AgroGestión en su infraestructura propia

Actualizado: 19 nov 2026. El detalle por asunto está en `TABLERO.md`.

## Dónde está hoy

| | |
|---|---|
| **Sitio** | https://agrogestion-operacion.vercel.app — publicado, conectado |
| **Base** | Supabase, organización "AgroGestion", proyecto `cidgbfddrzoilvkqhszg`. 29 hojas, 62 tablas con candado, sellada, **vacía** |
| **Cómo entrar** | `PRIMEROS-PASOS.md` |
| **Validado por Luis y Migue** | **Todavía no** — es el siguiente paso |
| app.agroselectos.com | Sin tocar: sigue con la versión vieja |
| Base anterior y ATALAYA | Sin tocar. Mi conexión ya ni siquiera las ve |

**Instalado no es validado.** Lo que sigue lo comprobé yo; falta que funcione
en sus manos y en sus teléfonos.

## Lo comprobado en el proyecto real

| Qué | Resultado |
|---|---|
| Cada hoja instalada coincide con la probada (por huella) | Sí |
| Ataques desde internet, sin sesión | 6 de 6 negados |
| Ataques con sesión (ascensos, borrar dinero o bitácora, datos viejos, otro espacio) | 34 de 34 como se esperaba, sin dejar rastro |
| Alta de cuentas: código viejo rechazado; nuevo sirve una vez; invitación sí; extraño no | Sí, sin dejar rastro |
| Un teléfono con pruebas viejas abre el sitio real | No las muestra, no las sube, no las toca |
| El enlace del correo de confirmación | Lleva al sitio (antes llevaba a una página rota) |
| La rama `main` no puede publicar encima | Probado: Vercel la omite |
| Revisor de seguridad de Supabase | Sin errores |
| Lectura con IA | Instalada y cerrada a extraños. **Leer de verdad: sin probar, falta llave** |

Además, con datos de mentira y sin tocar el proyecto real: 664 pruebas de
reglas, 49 contra una base armada desde cero y 83 pasos en navegador real
(`sh pruebas/todo.sh`).

## Cómo se publica (para que sea predecible)

- El sitio sólo se publica cuando yo mando a producción la rama
  `produccion/base-vigente`. Cualquier otra cosa —un empujón a `main`, una
  vista previa— Vercel la **omite**.
- `main` sigue intacta (versión de mayo), como archivo.
- Para regresar a una publicación anterior: Vercel → Deployments → Promote.
- Las llaves del proyecto de producción sólo existen en el ambiente de
  producción de Vercel.

## Decisiones tomadas en la instalación

- **Sitio nuevo en vez de cambiar app.agroselectos.com.** Ya existía un proyecto
  de Vercel "agrogestion" con los dominios agroselectos.com; no lo toqué.
- **Un solo proyecto de Supabase, que es producción.** El plan gratuito no da
  otro. Mis pruebas contra él van dentro de transacciones que se deshacen.
- **Cuentas por código de arranque (una vez) e invitación por correo**, sin que
  nadie me pase contraseñas.
- **Las hojas se instalan bajándolas del repositorio con su huella**, no
  copiándolas a mano.

## Lo que falta para operar

1. Luis y Migue entran (`PRIMEROS-PASOS.md`) y hacen las cuatro pruebas de ahí.
2. Catálogos: darlos de alta o aprobar la hoja (`ARRANQUE-LIMPIO.md`, sección 3).
3. Pantalla Arranque: conteo físico, saldos iniciales, fecha de inicio.
4. Encargados con cuenta y teléfono ligado; PIN nuevos para la gente de campo.
5. Ensayar una vez respaldo y restauración.
6. Cuando quieran: cambiar app.agroselectos.com (`CAMBIO-DE-PRODUCCION.md`).

## Abierto

- Los permisos por rol salieron de leer el código; se afinan con el uso.
- Leer tickets por foto necesita llave de IA (gasto: requiere autorización).
- Las funciones de audio y de revisión de parcela no están instaladas.
- Costo por día o por hora (D-4): las cuentas están separadas; falta decidir.
- Quedó instalada en la base la herramienta que usé para bajar las hojas; sólo
  la usa el dueño de la base. Se quita en Database → Extensions.
- El registro de cuentas está abierto, y tiene que estarlo para que cada quien
  cree la suya; una cuenta sin invitación no ve ni toca nada (probado).
- El plan gratuito pausa un proyecto tras una semana sin uso. Con operación
  diaria no pasa; si se deja de usar, hay que entrar al panel a reactivarlo.

## Después

La especificación ampliada de la reunión de administración (asistencia, QR,
inventarios, herramientas, combustible, insumos, mano de obra, seguimiento
agronómico, finanzas, tierras y agua). No se ha implementado nada de eso.
