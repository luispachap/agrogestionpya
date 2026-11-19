# Cambio de producción — preparado, NO ejecutado

No se hace nada de esto sin autorización de Luis. La versión de hoy y la base
anterior se conservan intactas para poder regresar.

## Condiciones para pedir la autorización

- [ ] El proyecto nuevo existe, armado con las 24 hojas, sin avisos críticos.
- [ ] Los ataques de `pruebas/base/` pasan contra el proyecto real.
- [ ] Luis y Migue entran con su cuenta y son superadministradores.
- [ ] El registro libre de cuentas está apagado.
- [ ] La prueba en teléfonos (`PRUEBA-EN-TELEFONOS.md`) pasó completa.
- [ ] Se ensayó una vez: descargar respaldo → restaurarlo → contar registros.
- [ ] Todos los teléfonos mandaron su respaldo (`DATOS-DE-LA-BASE-ANTERIOR.md`).

## El cambio (unos 20 minutos, de preferencia en la noche)

| # | Paso | Quién | Se regresa con |
|---|---|---|---|
| 1 | Avisar por WhatsApp: "no capturen de 9 a 9:30" | Luis | — |
| 2 | En Vercel: cambiar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` a las del proyecto nuevo. Borrar `VITE_SUPABASE_APP_EMAIL` y `VITE_SUPABASE_APP_PASSWORD` | Luis (yo le paso los dos valores públicos) | Volver a poner los anteriores |
| 3 | Publicar la rama `produccion/base-vigente` | Yo, con el sí de Luis | Vercel → Deployments → promover el de hoy (`203fc8d`) |
| 4 | Abrir la app en el teléfono de Luis y en el de Migue; entrar con cuenta | Luis y Migue | — |
| 5 | Capturar un gasto de prueba, verlo en el otro teléfono, cancelarlo | Luis y Migue | — |
| 6 | Cada encargado entra con su cuenta y deja su teléfono ligado | Encargados | — |

## Qué pasa con lo que cada teléfono ya tenía guardado

Al abrir la versión nueva, el teléfono conserva sus datos. Cuando entre una
cuenta, lo que tenía pendiente intenta subir al proyecto nuevo. Por eso el
respaldo previo de cada teléfono es condición: si algo sale raro, hay copia.

Los PIN de dirección de fábrica dejan de servir: Admin, Dirección y Finanzas
entran con correo y contraseña.

## Si algo sale mal

Vercel → Deployments → el de hoy → *Promote to Production*, y regresar las dos
variables. Vuelve exactamente lo de hoy. El proyecto nuevo se queda como esté;
nada de la base anterior se tocó.

## Lo que NO se hace en el cambio

No se borra el proyecto anterior, ni la rama `main`, ni los despliegues viejos.
No se cargan todavía los datos históricos: eso va después, con su propio sí.
