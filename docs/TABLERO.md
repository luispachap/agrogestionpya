# Tablero de avance — AgroGestión P&A

Actualizado: 18 nov 2026 · Rama de trabajo: `produccion/base-vigente`

## Riesgos críticos abiertos

| Riesgo | Estado |
|---|---|
| Repositorios públicos con datos personales | **Abierto — requiere a Luis** (`02`, paso 1) |
| Lo publicado deja entrar como administrador con PIN de fábrica | Corregido en rama; **publicado sigue vulnerable** hasta autorizar despliegue |
| Permisos sólo en pantalla, no en la base | Abierto — etapa de identidad |
| Base de datos central pausada, sin respaldos | Abierto — decisión D-1 |
| Lo borrado en un teléfono revive en otro | Abierto — requiere base activa |

## Terminado (con evidencia)

- Diagnóstico inicial y 14 evidencias (`auditoria/00`, rama anterior).
- Diseño de Incorporación Inteligente (`auditoria/01`).
- Comparación de las 4 versiones y cambio de base a la publicada (`auditoria/03`).
- Escaneo de secretos en el historial del repo publicado: sin secretos reales (`auditoria/02`).
- Correcciones P0 en rama: PIN de fábrica, sesión falsificable, datos personales en el código, cuenta técnica, recarga que borraba pendientes, aviso de guardado fallido, confirmación al borrar trabajador, arranque sin configuración.

## Pruebas ejecutadas

| Batería | Resultado |
|---|---|
| Unitarias (`npm test`) | 571 / 571 (555 heredadas + 16 nuevas) |
| Navegador real (`pruebas/humo_navegador.py`) sobre lo publicado | 4 / 9 |
| Navegador real sobre esta rama | 9 / 9 |
| Compilación | correcta, 100 módulos |

Ninguna prueba corrió contra la base real (está pausada) ni con datos reales.

## En curso / siguiente

1. Auditar las 17 pantallas nuevas y terminar las pendientes, ahora sobre la base correcta.
2. Auditar el buzón de papeles existente contra el diseño `01`.
3. Volver a correr las evidencias de costos (E3–E5) sobre `calculos.js`.
4. Diseño detallado de identidad por persona y permisos en la base (modelo: Luis y Migue superadministradores con cuenta propia; nadie borra historial en silencio).
5. Guardado local robusto y sincronización con confirmación del servidor.

## Dependencias externas

- Base de Supabase pausada: bloquea verificar reglas reales, respaldos y toda prueba de sincronización real.
- Acceso de escritura a la configuración de GitHub y Vercel: sólo Luis.
- Disposiciones de la STPS sobre registro de jornada: sin publicar al 10 nov.

## Decisiones pendientes de Luis

| # | Decisión |
|---|---|
| D-1 | Reactivar la base de Supabase. Los proyectos gratuitos pausados sólo se pueden restaurar durante un plazo limitado; no sé cuándo se pausó éste. Conviene revisarlo en el panel cuanto antes. Luego: pasar o no a plan de pago |
| D-2 | Separar el sistema del despacho del repositorio de AgroGestión |
| D-3 | Autorizar el despliegue de las correcciones P0 |
| D-4 | Reglas de pago y costo por trabajador (día, hora, destajo) — no las cambio sin autorización |
| D-5 | Repositorio definitivo: propongo `agrogestionpya`, con Vercel apuntando aquí |

## Decisiones ya tomadas por Luis

- Luis y Migue: superadministradores con el mismo nivel, cada uno con su cuenta. Sin aprobación de un tercero ni topes de monto.
- Aun así: bitácora, respaldos, confirmación en operaciones destructivas, historial que no se borra en silencio.
- Jornada: modelo híbrido (individual + supervisado por encargado).
- Incorporación Inteligente aprobada; IA externa sólo para tickets y facturas por ahora; proveedor intercambiable; primero la prueba del ticket.
