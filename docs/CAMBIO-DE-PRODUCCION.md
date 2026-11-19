# Cambio de producción — preparado, NO ejecutado

No se hace nada de esto sin autorización de Luis. La versión de hoy y la base
anterior se conservan intactas.

> **Corrección del 19 de noviembre.** La versión anterior de este documento
> decía que, al abrir la versión nueva, cada teléfono conservaba sus datos y lo
> pendiente intentaba subir al proyecto nuevo. **Eso ya no ocurre y está
> probado que no ocurre:** la versión nueva trabaja en un cajón propio y no lee
> ni sube nada de lo que el teléfono traía. Ver `ARRANQUE-LIMPIO.md`.

## Condiciones para pedir la autorización

- [ ] Las pruebas en teléfonos pasaron completas, **en el proyecto de pruebas**.
- [ ] El proyecto de producción existe, armado con las 25 hojas, **sellado con su espacio**, sin avisos críticos, y **sin un solo registro de operación**.
- [ ] Los ataques de `pruebas/base/` pasan contra el proyecto real.
- [ ] Luis y Migue entran con su cuenta y son superadministradores.
- [ ] El registro libre de cuentas está apagado.
- [ ] Los catálogos aprobados están cargados; nadie más.
- [ ] Se ensayó una vez: descargar respaldo → restaurarlo → contar registros.

## El cambio

| # | Paso | Quién | Se regresa con |
|---|---|---|---|
| 1 | En Vercel, **sólo en el ambiente de Producción**: poner `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del proyecto de producción. Borrar las dos variables de la cuenta técnica. Las vistas previas nunca llevan las llaves de producción | Luis (yo le paso los dos valores, que son públicos) | Volver a poner los anteriores |
| 2 | Publicar la rama `produccion/base-vigente` | Yo, con el sí de Luis | Vercel → Deployments → promover el de hoy (`203fc8d`) |
| 3 | Luis y Migue abren la app y entran con su cuenta. **Debe abrir vacía**: sin gastos, sin gente, sin parcelas más que las aprobadas | Luis y Migue | — |
| 4 | Comprobar en la base que no llegó nada que no sea de hoy | Yo | — |
| 5 | Encargados: cuenta nueva, teléfono ligado. Gente de campo: PIN nuevo | Luis / Migue | — |
| 6 | Conteo físico, saldos iniciales y **declarar la fecha de inicio** | Luis y Migue | — |

## Qué pasa en cada teléfono

- La versión nueva abre **vacía**, aunque el teléfono tenga pruebas guardadas.
- Lo de antes **se queda donde estaba**, sin tocarse. Se puede descargar desde
  Respaldo → "Datos de antes en este teléfono".
- Los PIN anteriores dejan de servir, todos.
- Si un teléfono se queda con la versión vieja abierta, sigue apuntando a la
  base anterior y no puede escribir en la nueva. Basta con cerrar y abrir.

## Si algo sale mal

Vercel → Deployments → el de hoy → *Promote to Production*, y regresar las dos
variables. Vuelve exactamente lo de hoy, con sus datos de antes intactos en cada
teléfono. El proyecto nuevo se queda como esté.

## Lo que NO se hace

No se borra el proyecto anterior, ni la rama `main`, ni los despliegues viejos,
ni nada en los teléfonos. No se importa ningún movimiento, nunca.
