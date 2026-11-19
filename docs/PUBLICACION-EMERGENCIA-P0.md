# Publicación de emergencia P0 — sólo seguridad

**Rama:** `emergencia/p0-contencion` · **Estado: corregido en rama y probado. NO desplegado.**
No se publica hasta que Luis lo autorice.

Esta rama es **exactamente lo que hoy está publicado** en app.agroselectos.com
(commit `203fc8d`) **más las correcciones de seguridad**. No trae nada de la
modernización: ni permisos nuevos en la base, ni superadministradores, ni
pantallas nuevas. Si algo falla, se regresa a lo de hoy sin perder nada.

## Qué cambia para quien usa la app

| Antes | Después |
|---|---|
| Admin, Dirección y Finanzas entraban con un PIN de fábrica que estaba escrito en el código público | Ese PIN ya no existe. Se entra con el PIN propio (si ya se configuró) o con correo y contraseña |
| Cualquiera podía escribir una sesión falsa en el teléfono y entrar como admin | La sesión guardada de dirección ya no se cree; la de campo sólo si la persona existe y está activa |
| La app traía una cuenta técnica con contraseña dentro del código | Eliminada |
| Si el teléfono se llenaba, dejaba de guardar sin avisar | Sale una banda roja: "Este teléfono NO está guardando" |
| El bote de basura de un trabajador lo borraba al primer toque | Pregunta antes y lo anota en la bitácora |
| "Recargar desde la nube" borraba lo que estaba pendiente de subir | Si hay pendientes, espera; nunca borra la cola |
| Una instalación nueva traía nombres de trabajadores reales | Ya no trae ninguno |

## Archivos que cambian (los que hay que pegar en StackBlitz)

- `src/App.jsx` (cambia)
- `src/acceso.js` (nuevo)
- `src/supabase.js` (cambia)
- `src/plan.js` (cambia — sólo nombres de ejemplo)
- Pruebas (no afectan a la app): `src/acceso.test.js`, `src/secretos.test.js`,
  `src/plan.test.js`, `pruebas/humo_navegador.py`, `pruebas/recorrido_navegador.py`
- `.env.example` (ya sólo pide las dos variables públicas)

## Qué se probó y cómo

| Prueba | Resultado | Qué demuestra |
|---|---|---|
| `npm test` | 572 de 572 | cálculos, acceso, y que no hay secretos ni PIN de fábrica en el código |
| `npm run build` | compila, 100 módulos, el lector de PDF sale aparte | — |
| `pruebas/humo_navegador.py` (navegador real, versión compilada) | 9 de 9 — **la versión publicada hoy saca 4 de 9** | PIN de fábrica no entra; sesiones falsas rechazadas; sin trabajadores precargados |
| `pruebas/recorrido_navegador.py` (navegador real) | 17 de 17 | aviso de guardado; confirmación al borrar; **los 8 roles abren sus 131 pantallas sin tronar** |

El recorrido se comprobó rompiendo una pantalla a propósito: la detectó.

**Lo que estas pruebas NO demuestran:** que funcione contra la base real (está
pausada), ni en un teléfono real, ni que cada pantalla calcule bien — sólo que
abre. Eso es "probado", no "validado en producción".

## ANTES de publicar — en este orden

1. **La base de Supabase está pausada.** Con esta versión, quien no tenga PIN
   propio ya guardado en su teléfono **sólo puede entrar con correo y
   contraseña, y eso necesita la base encendida**. Si se publica con la base
   pausada, dirección puede quedarse afuera. Primero se reactiva la base
   (ver `docs/RECUPERACION-SUPABASE.md` en la rama de trabajo).
2. En Vercel, borrar `VITE_SUPABASE_APP_EMAIL` y `VITE_SUPABASE_APP_PASSWORD`,
   y **cambiar la contraseña de esa cuenta** en Supabase (ocultarla no la
   invalida).
3. Confirmar que Luis y Migue pueden entrar con su correo y contraseña.
4. Dar por quemados los PIN anteriores: cada quien pone uno nuevo en Seguridad.
5. Hacer privado el repositorio.

## Cómo regresar si algo sale mal

En Vercel → Deployments → el despliegue de hoy (`203fc8d`) → "Promote to
Production". No hay cambios en la base, así que no hay nada que deshacer ahí.

## Qué NO arregla esta publicación (sigue abierto)

- Los permisos por rol siguen siendo sólo de pantalla: en la base, cualquier
  cuenta con perfil puede todo, y una cuenta nueva puede darse perfil sola.
  Está resuelto y probado en la rama de trabajo (hoja SQL 24), sin desplegar.
- Los PIN de trabajadores se guardan legibles y se validan en el teléfono.
- Registros borrados que reaparecen al sincronizar (zombis).
