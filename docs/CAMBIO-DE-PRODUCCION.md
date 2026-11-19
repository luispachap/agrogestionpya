# Cambiar app.agroselectos.com a la versión nueva — preparado, NO ejecutado

La versión nueva ya funciona en https://agrogestion-operacion.vercel.app. Este
documento es sólo para el día en que quieran que **la dirección de siempre**
abra la versión nueva. Se hace con autorización de Luis.

## Antes

- [ ] Luis y Migue ya usan la versión nueva y confían en ella.
- [ ] Se ensayó una vez respaldo y restauración.

## El cambio

| # | Paso | Se regresa con |
|---|---|---|
| 1 | En Vercel, mover el dominio `app.agroselectos.com` del proyecto viejo al proyecto `agrogestion-operacion` | Regresarlo al proyecto viejo |
| 2 | En Supabase → Authentication → URL Configuration: poner `https://app.agroselectos.com` como Site URL y dejar la dirección actual en la lista de permitidas | Regresar el valor anterior |
| 3 | Abrir app.agroselectos.com en dos teléfonos y entrar | — |

Lo hago yo; el paso 2 necesita que Luis tenga abierta su sesión de Supabase en
Chrome, como la vez pasada.

## Qué pasa en cada teléfono

- En la dirección nueva del dominio viejo, cada teléfono **vuelve a entrar** con
  su cuenta (la sesión es por dirección). Lo capturado está en la nube y baja solo.
- **Ojo:** lo que un teléfono tenga capturado sin subir en
  `agrogestion-operacion.vercel.app` no se pasa solo a la otra dirección. Antes
  del cambio, abrir la app con señal y esperar a que no quede nada pendiente.
- Lo que el teléfono guardaba de la versión de pruebas sigue ahí, sin tocarse;
  la versión nueva no lo lee ni lo sube. Se puede descargar desde Respaldo.
- Los PIN anteriores dejan de servir.

## Lo que NO se hace

No se borra el proyecto viejo de Vercel, ni la base anterior, ni `main`, ni nada
en los teléfonos. No se importa ningún movimiento.
