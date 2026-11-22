# Respaldo automático de AgroGestión

**Estado (21 nov 2026): PREPARADO, SIN ESTRENAR.** Las herramientas están escritas y probadas contra bases y
almacenes de imitación. **Todavía no se ha sacado un respaldo real ni se ha restaurado ninguno.** Mientras eso no
pase, el riesgo de perder información por una falla de la base **sigue abierto**.

## Qué resuelve

El plan gratuito de Supabase no guarda copias de la base. Si el proyecto se daña o se pierde, hoy lo único que
queda es el archivo que alguien haya bajado a mano desde la app y lo que guarde cada teléfono.

Con esto, cada noche (3:17 de la mañana) GitHub saca solo una copia completa y la guarda **cifrada** en un
repositorio privado. No cuesta: GitHub da 2,000 minutos al mes a los repositorios privados y esto usa unos 3 por noche.

| Qué se respalda | Cómo |
|---|---|
| Todos los datos, de todas las tablas | Copia completa de la base |
| Las cuentas (correo y contraseña cifrada), perfiles y permisos otorgados | Van en la misma copia |
| Reglas de acceso, candados, funciones, operaciones sensibles | Van en la misma copia |
| Sellos de autorización (quién autorizó, cuándo) y su firma | Van en la misma copia, tal cual |
| Fotos, comprobantes y archivos de las conversaciones | Cada noche sólo lo nuevo; lo borrado en producción **se conserva** |

Lo que **no** va en el respaldo y habría que volver a poner a mano en un proyecto nuevo: la llave de IA y los demás
secretos de las funciones del servidor, la configuración del correo de invitaciones, y las funciones del servidor
(éstas están en el repositorio de la app y se vuelven a desplegar).

Se conservan los últimos 30 días y el respaldo del día primero de cada mes.

## Por qué en un repositorio aparte

El repositorio de la app es **público** y su rama principal no se toca. Un respaldo —aunque vaya cifrado— no debe
vivir en un lugar público, y GitHub sólo corre tareas programadas desde la rama principal. Por eso los respaldos
van en un repositorio **privado** que sólo tiene dos archivos de configuración; las herramientas las toma de aquí
(`herramientas/respaldo/`), así se corrigen en un solo lugar.

## Lo que tiene que hacer Luis (una vez, unos 15 minutos)

Nada de esto se manda por chat ni se escribe en ningún archivo: se pega directo en GitHub.

1. **Crear el repositorio privado.** En github.com → «New repository» → nombre `agrogestion-respaldos` →
   **Private** → marcar «Add a README» → Create.
2. **Inventar la clave del respaldo.** Una frase larga (cinco o seis palabras sueltas). Apuntarla en papel y
   guardarla donde se guardan las escrituras. **Sin esa frase el respaldo no se puede abrir, y nadie la puede
   recuperar.** Que la conozca también otra persona de confianza.
3. **Poner cuatro secretos** en ese repositorio (Settings → Secrets and variables → Actions → «New repository secret»):

   | Nombre | De dónde sale |
   |---|---|
   | `CLAVE_RESPALDO` | La frase del paso 2 |
   | `BASE_URL` | Panel de Supabase → botón **Connect** → «Session pooler» → copiar la dirección y cambiar `[YOUR-PASSWORD]` por la contraseña de la base. Si no se recuerda: Database → Settings → «Reset database password» |
   | `PROYECTO_URL` | `https://cidgbfddrzoilvkqhszg.supabase.co` |
   | `LLAVE_SERVICIO` | Panel de Supabase → Settings → API Keys → la llave **secreta** (empieza con `sb_secret_`) |

4. **Avisarme.** Yo subo los dos archivos de configuración a ese repositorio y corro el primer respaldo.

## El ensayo (sin esto no se declara resuelto)

Un respaldo que nunca se ha restaurado es una suposición. El ensayo:

1. Luis crea un **segundo proyecto** en Supabase (gratuito; la organización permite dos), vacío, con cualquier nombre
   que diga ENSAYO, y pone otros tres secretos en el repositorio de respaldos: `DESTINO_BASE_URL`,
   `DESTINO_PROYECTO_URL` y `DESTINO_LLAVE_SERVICIO` (mismos pasos, del proyecto nuevo).
2. Se corre «Restaurar un respaldo en otro proyecto». Se niega a correr contra producción y contra un proyecto que
   ya tenga tablas.
3. La restauración sola comprueba, y deja un informe:
   - **Datos:** cada tabla tiene los mismos renglones, con el mismo contenido (huella de cada tabla).
   - **Permisos e integridad:** las mismas reglas de acceso, funciones, permisos por perfil, operaciones sensibles,
     puertas y candados (las siete huellas con que ya se compara producción contra la base de pruebas).
   - **Cuentas:** las mismas, con sus perfiles y sus permisos otorgados.
   - **Archivos:** cada foto y documento se vuelve a bajar de la copia y se compara contra el original.
   - **Operaciones sensibles:** 30 intentos no autorizados contra la copia (sin sesión y con una cuenta sin perfil:
     leer dinero, meter un gasto, meter un pago, tocar la bitácora, darse permisos). Tienen que rechazarse todos.
4. Falta una cosa más que el informe no cubre y hay que ensayar a mano: **operar sobre la copia**. La base lleva
   escrito de qué proyecto es (el candado del arranque limpio), así que para que la app trabaje contra el proyecto
   nuevo hay que decirle a la base su nombre nuevo. Ese paso se ensaya en el mismo proyecto de ENSAYO, con una
   copia de la app apuntada ahí, y se documenta aquí cuando esté hecho.
5. Al terminar, el proyecto de ENSAYO se pausa o se borra (lo decide Luis).

## Qué hacer si se pierde producción

1. Crear un proyecto nuevo en Supabase y poner sus tres secretos `DESTINO_…`.
2. Correr «Restaurar un respaldo en otro proyecto» con el día que se quiera.
3. Hacer el paso 4 del ensayo, volver a desplegar las funciones del servidor y poner sus secretos.
4. Apuntar la app al proyecto nuevo (dos variables en Vercel) y publicar.
5. Lo capturado después del último respaldo sigue en los teléfonos que lo capturaron: al entrar, lo que tenían
   pendiente sube; lo demás se recupera con «Elegir archivo de respaldo» desde el aparato que lo tenga.

Se pierde, como máximo, lo de un día que ningún teléfono conserve.

## Cómo sabré que dejó de funcionar

- GitHub le manda un correo al dueño del repositorio cuando la tarea de la noche falla.
- El archivo `ULTIMO.md` del repositorio de respaldos dice el día del último respaldo, cuántas tablas, renglones,
  cuentas y archivos llevó. Si esa fecha no es la de hoy o la de ayer, algo pasó.
- Un respaldo incompleto **no se guarda**: si falta la tabla de cuentas, la de perfiles o las huellas, la tarea
  falla en vez de guardar medio respaldo.

## Seguridad

- Las llaves viven sólo en los secretos de GitHub. Las herramientas no las imprimen; si algo falla, el mensaje
  sale sin direcciones ni claves (hay prueba).
- El respaldo sólo **lee** de producción.
- Lo guardado va cifrado (AES-256). En el repositorio no se ve el contenido de la base ni el de las fotos, ni
  siquiera el nombre de cada archivo.
- La copia lleva dentro las llaves internas de la base (la que firma los sellos y la de los avisos): por eso va
  cifrada y por eso el repositorio es privado.

## Límites conocidos

- GitHub guarda la historia: un respaldo «quitado» por viejo sigue ocupando espacio dentro del repositorio. Con el
  tamaño actual de la base no importa; se revisa cuando pase de 500 MB.
- Si las fotos crecen mucho (más de 1 GB), habrá que mover los archivos a otro lugar. Hoy no hay ninguna.
- Si la solución gratuita no pasa el ensayo, la alternativa es el plan de pago de Supabase (US$25 al mes), que
  trae copia diaria con 7 días. No se propone mientras ésta no falle.
