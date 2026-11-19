# P0 — Contención de seguridad

Fecha: 18 nov 2026 · Rama: `produccion/base-vigente`. Este documento no reproduce
ningún dato personal ni secreto; sólo dice dónde están.

## 1. Exposiciones encontradas

| # | Qué está expuesto | Dónde | Estado |
|---|---|---|---|
| X-1 | Nombre completo, sueldo y PIN de 11 trabajadores | Código fuente (`INITIAL`) en **dos repositorios públicos** (`agrogestionpya` desde may; `vitejs-vite-3ymxjehp` en sus 21 commits) **y en el archivo que sirve app.agroselectos.com** | Quitado del código en esta rama (prueba M-7). Sigue en el historial de Git y en lo publicado hasta que Luis actúe (pasos 1 y 5) |
| X-2 | PIN de fábrica de administrador, dirección y finanzas | Mismos tres lugares | Quitado en esta rama (prueba C-1). **Sigue funcionando en lo publicado** |
| X-3 | Código completo del sistema del despacho (`pa_despacho`: backend, reglas fiscales, agente CONTPAQ) | Mezclado dentro del repositorio público `vitejs-vite-3ymxjehp` desde el 19 jul | No lo copié a este repositorio. Hay que sacarlo de ahí (paso 1) |
| X-4 | Variables `VITE_SUPABASE_APP_EMAIL` / `VITE_SUPABASE_APP_PASSWORD` configuradas en Vercel | Proyecto de Vercel de producción | Revisé el archivo publicado: **hoy no contiene esa contraseña**. El código que la leía fue eliminado en esta rama (prueba C-2). La contraseña debe rotarse igual (paso 3) |
| X-5 | Este diagnóstico y la lista de fallas | Repositorio público | Se resuelve con el paso 1 |

Escaneé todo el historial de `vitejs-vite-3ymxjehp` (21 commits) buscando llaves,
contraseñas, direcciones de base con clave y llaves privadas: **no encontré
secretos reales**. Los dos avisos del escáner son textos de ejemplo. La llave
`anon` de Supabase aparece en lo publicado, pero es pública por diseño. No pude
escanear el historial completo de `agrogestionpya` más allá de sus commits
actuales (tiene uno en `main`), ni verificar la base (está pausada).

## 2. Lo que ya quedó hecho en la rama (con prueba)

| Corrección | Prueba que antes fallaba y ahora pasa |
|---|---|
| Sin PIN de fábrica: dirección entra sólo con cuenta o con PIN propio configurado | `acceso.test.js` C-1 · navegador: publicado «ENTRÓ COMO ADMIN», rama «ya no entra» |
| La sesión guardada en el teléfono ya no se cree a ciegas | `acceso.test.js` C-3 · navegador: sesión falsa de encargado, antes entraba |
| Sin trabajadores reales en el código | `secretos.test.js` M-7 · navegador: 11 → 0 precargados |
| Cuenta técnica eliminada; guardia contra cualquier `VITE_*` con contraseña | `secretos.test.js` C-2 |
| La orden de recarga ya no borra lo que no ha subido | `acceso.test.js` C-6 |
| Si el teléfono no puede guardar, lo dice en pantalla | cambio en `lsSet` + aviso; sin prueba automática todavía |
| Borrar un trabajador pide confirmación y avisa del efecto en costos | cambio de pantalla; sin prueba automática todavía |
| La app abre aunque falte la configuración (antes: pantalla en blanco) | navegador: «la app abre» |

Resultado de la prueba en navegador real (`pruebas/humo_navegador.py`):
**código publicado 4 de 9 · esta rama 9 de 9**. Pruebas unitarias: 571 de 571.

## 3. Lo que sólo Luis puede hacer (no tengo permiso técnico)

Intenté cambiar la visibilidad del repositorio: el acceso que tengo no permite
tocar configuración.

1. **Hacer privados los dos repositorios** — en cada uno: GitHub → Settings →
   General → hasta abajo, «Danger Zone» → *Change repository visibility* →
   *Make private*. Repos: `luispachap/agrogestionpya` y
   `luispachap/vitejs-vite-3ymxjehp`. Vercel sigue funcionando con repos privados.
2. **Borrar en Vercel** (proyecto `vitejs-vite-3ymxjehp` → Settings → Environment
   Variables): `VITE_SUPABASE_APP_EMAIL` y `VITE_SUPABASE_APP_PASSWORD`.
3. **Rotar esa contraseña** cuando la base se reactive: Supabase → Authentication
   → Users → esa cuenta → *Send password recovery* o borrarla. Ya no se usa.
4. **Dar por quemados todos los PIN actuales** (trabajadores, encargados,
   dirección). No reutilizarlos: en el piloto se asignan nuevos, guardados sólo
   en el servidor.
5. **Autorizar la publicación de esta rama** cuando la revises. Mientras lo
   publicado siga como está, cualquiera entra como administrador en su propio
   navegador. Con la base pausada no alcanza datos centrales, pero sí ve los 11
   trabajadores precargados.
6. Sacar el sistema del despacho del repositorio de AgroGestión (decisión
   pendiente D-2 del tablero).

## 4. Riesgos que quedan aunque se haga todo lo anterior

- **Los permisos siguen sin aplicarse en la base.** Estas correcciones endurecen
  el teléfono; quien tenga una cuenta válida todavía puede leer y escribir todas
  las tablas directo. Se cierra en la etapa de identidad (cuentas por persona y
  reglas por rol en el servidor). Es el riesgo residual más importante.
- **Los PIN de trabajadores siguen comparándose en el teléfono** y viajan en claro
  entre dispositivos. Misma etapa.
- **El PIN de dirección** (cuando se configura) usa un resumen que se revierte en
  milisegundos (evidencia E6). Hasta la etapa de identidad, dirección debe entrar
  con correo y contraseña.
- **El historial de Git conserva los datos personales.** Hacer privado el repo lo
  contiene; borrarlo del historial exige reescribirlo, que es irreversible y
  requiere autorización.
- **Lo ya copiado por terceros** mientras fue público no se puede recuperar. Por
  eso el paso 4.
- Reglas reales de la base y cuentas con contraseña de ejemplo: **sin verificar**
  mientras el proyecto esté pausado.
