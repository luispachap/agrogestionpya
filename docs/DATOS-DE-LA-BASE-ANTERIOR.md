# Los datos de la base anterior no están perdidos

La base anterior ("AgroGestion", en la organización "P&A") está **pausada, no
borrada**. Nadie la ha tocado y nada de lo que sigue la modifica. El proyecto
nuevo es otro, vacío: **no la sobrescribe**.

## Dónde hay copias de los datos

| Fuente | Qué trae | Cuándo se puede | Quién |
|---|---|---|---|
| **Cada teléfono que usó la app** | Todo lo que ese teléfono tenía, incluso lo que nunca subió | **Hoy mismo** | Cada persona |
| Base pausada — reactivarla | Todo lo que sí subió | Desde el 19 de diciembre (cuando Supabase levante la restricción) | Luis |
| Base pausada — descargar respaldo | Lo mismo, como archivo | Supabase lo ofrece en el panel del proyecto pausado; **no sé si la restricción también lo bloquea** — hay que mirar | Luis |
| Respaldos descargados antes | Lo que hubiera ese día | Si alguien guardó uno | Luis / Migue |

## Lo urgente, y es gratis: respaldar los teléfonos HOY

Los datos de un teléfono viven en el navegador. Se pierden si alguien borra los
datos del navegador, desinstala la app o cambia de teléfono. Por eso, **antes de
cualquier otra cosa**, en cada teléfono y computadora donde se usó la app:

1. Abrir app.agroselectos.com como siempre (la versión de hoy sirve).
2. Entrar como administrador → **Respaldo** → **Descargar respaldo**.
3. Mandarle el archivo `respaldo-agroselectos-FECHA.json` a Luis, diciendo de
   quién es el teléfono.

Teléfonos que importan: el de Migue (corrida de ajo), el de Fito
(agroquímicos), los de los encargados, y el de Luis.

**No** usar "Recargar desde la nube" ni "Reiniciar datos" en ninguno.

## La fecha que hay que revisar

Supabase deja reactivar un proyecto pausado **durante 90 días desde que se
pausó**. Pasado ese plazo ya no se reactiva con un botón, pero **sigue
ofreciendo descargar el respaldo y los archivos** desde el panel, y ese respaldo
se puede cargar en un proyecto nuevo. Es decir: aun en el peor caso los datos
se recuperan, con más pasos.

No sé qué día se pausó. **Luis:** en el panel, el proyecto pausado enseña
cuántos días quedan. Si quedan menos de los que faltan para el 19 de diciembre,
no pasa nada grave, pero conviene saberlo y probar hoy el botón de descargar
respaldo.

## Cómo entran esos datos al proyecto nuevo (cuando toque, con autorización)

1. Los respaldos de teléfonos y el de la base se juntan **en una copia de
   trabajo**, nunca directo en producción.
2. Se mezclan por registro con la misma regla de la app: mismo id → gana el más
   reciente. Lo que sólo está en un teléfono se conserva.
3. Antes de cargar se enseña el resumen: cuántos registros por tabla, de qué
   fuente salió cada uno y cuáles chocan. **Luis o Migue dan el sí.**
4. Las fotos que venían dentro de los registros se pasan al almacén privado al
   cargar (la app ya lo hace sola al guardar).
5. **No se copian:** las cuentas ni contraseñas anteriores, la cuenta técnica,
   los PIN de dirección (se dan por quemados), ni datos de ejemplo.

## Qué queda pendiente hasta el 19 de diciembre

- Lo que subió a la nube desde teléfonos que **ya no existen** o cuyos datos se
  borraron: sólo está en la base pausada.
- Comprobar que lo recuperado de los teléfonos coincide con lo que tiene la base.

Mientras tanto se puede operar en el proyecto nuevo: los registros llevan id
propio, así que lo viejo se suma después sin pisar lo nuevo.
