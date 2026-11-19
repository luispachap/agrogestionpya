# AgroGestión — Agroselectos P&A

App de gestión agrícola para una empresa familiar de ajo en Zacatecas (bodega en
Aguascalientes). PWA móvil en React, desplegada en app.agroselectos.com.

## Con quién trabajas

**Luis** es contador, no programador. Escribe el qué, no el cómo. Traduce siempre:
di "la pantalla de la corrida", no "el componente `CorridaAjo`". Nada de jerga sin
explicarla. Va directo al grano: no le ofrezcas pausas ni le adviertas de límites,
entrega el trabajo hecho.

Usuarios reales de la app:
- **Rodolfo** (papá, dueño) — solo lectura, ve reportes y resúmenes.
- **Migue** (hermano, finanzas) — usuario principal del módulo de corrida de ajo.
  Todo el diseño de ese módulo sale de cómo trabaja él en la bodega.
- **Fito** (hermano, ingeniero agrónomo) — catálogo de agroquímicos y bitácora de
  aplicaciones.
- Trabajadores, encargados, cuadrillas y externos — captura de campo.

## Arquitectura

- **Un solo archivo**: `src/App.jsx` (~14,700 líneas, ~70 componentes). Es grande a
  propósito: nació en StackBlitz y así se ha mantenido. Si vas a partirlo, propónlo
  antes y hazlo por etapas verificando build en cada una — nunca de golpe.
- **Backend**: Supabase (PostgreSQL + auth). `src/supabase.js` (cliente),
  `src/dataApi.js` (lectura/escritura por tabla).
- **Excel**: `src/excelLoader.js` (plantillas, importación, pólizas CONTPAQi).
- **Estilos**: un único template string `const CSS` dentro de `App.jsx`. No hay
  Tailwind ni CSS externo.
- **Iconos**: fuente Material Symbols **auto-hospedada** en
  `public/fonts/ms-icons.woff2` (subset de 98 iconos, 11 KB). El mapa `MS_ICONS`
  traduce emoji → nombre, y `MS_CP` nombre → carácter. El componente `<Ic e="🏭"/>`
  hace el render. Es local a propósito: el rancho tiene internet intermitente y no
  se le puede pedir la fuente a Google. El service worker la precachea.
- **Despliegue**: StackBlitz → GitHub → Vercel. Luis pega los archivos en
  StackBlitz; considera esto al entregar cambios.

## Datos

- **Estado local**: `localStorage` (`agro_v7` datos, `agro_pending_v7` cola de
  subida, `agro_session_v1` sesión, `agro_corrida_cfg`, `agro_reset_token`).
- **Sincronización**: escribe local + encola a la nube. `TABLAS_NUBE` en `App.jsx`
  y `TABLAS` en `dataApi.js` **deben coincidir siempre**.
- **Columnas**: las tablas de Supabase tienen columnas fijas; todo campo extra
  viaja dentro de la columna JSON `datos`. Por eso se pueden agregar campos nuevos
  sin migración (ej. la ficha de agroquímicos de Fito).
- **40 tablas**. Si agregas una colección nueva: regístrala en `INITIAL`,
  `TABLAS_NUBE`, `dataApi.TABLAS` y `COLUMNAS_REALES`, **y escribe su SQL**
  en `supabase/` siguiendo el patrón de `17-tabla-config-contpaqi.sql`
  (id/datos/actualizado + RLS con `tiene_perfil()`). Avísale a Luis que debe
  correrlo; si no, el dato se queda solo en el teléfono.
- `supabase/14-verificar-tablas.sql` comprueba que las 40 existan. Actualízalo
  cuando agregues una.

## Trazabilidad (el corazón del sistema)

Cadena de estibas: **barbecho → limpia → relimpia → calibre**. Cada estiba tiene
código (`AS-B/L/R/C-###`), saldo, y apunta a sus padres vía `consumos`.
`rastrearOrigen()` sube recursivamente hasta la parcela.

- `crearEstiba(data, add, upd, {fase, cajas, cultivo, parcelaId, consumos, ...})`.
- **`noDescontar: true`** registra el vínculo de trazabilidad sin restar saldo del
  padre. Se usa entre limpio y calibre porque **son cajas de distinto tamaño**
  (plástico vs cartón) y la relación no es 1:1. El saldo de limpio solo se ajusta
  con **conteo físico**.
- `saldoDe(e)` = `e.saldo ?? e.cajas`. Estado "consumida" cuando llega a 0.

## Corrida de ajo — el módulo crítico

Un solo componente `CorridaAjo` con cuatro pestañas: corrida en vivo, calidad,
categorías aparte, administrar. **No lo vuelvas a separar** — se unificó a
petición expresa de Luis porque control y operación son la misma faena.

**Calibres**: `CALIBRES_CORRIDA` = 5–11 (cuentan para el rate).
`CATEGORIAS_APARTE` = Corona, Grano, Deshecho/segunda, Pata de perro (no cuentan;
van a inventario). El calibre 12 no existe, se eliminó.

**El bug del Excel de Migue (resuelto, no lo reintroduzcas)**: su hoja calculaba
el consumo restando inventarios, así que al agregar limpio a media corrida el rate
se desplomaba a 0. Aquí el rate se mide como **cartón producido acumulado ÷
tiempo**. Agregar limpio mueve el ETA, nunca el rate. Hay prueba: 150 cajas, 20 en
5 min = 4.0/min; agregas 20 más → sigue 4.0.

**Conteo físico (método real de Migue)**: cada cierto tiempo cuenta las cajas de
limpio que quedan. Ese conteo recalibra la proporción cartón/plástico con datos
medidos, no estimados. Tres formas: botón manual, recordatorio cada N cajas
(configurable), y deducción al vaciar una tarima (con confirmación). Mientras no
haya conteo, la proporción se marca "~ estimado" en ámbar; con conteo, "✓ real".

**Pool de tarimas**: varias tarimas "en la mesa". Modo **preciso** (eliges de cuál
corres, traza perfecta) o **revoltura** (corres de todas; al cerrar calibre reparte
proporcional según saldo — la traza sigue llegando a parcela, distribuida). Alta
rápida para tarimas limpiadas durante la corrida.

**Ciclo de 15 minutos**: recordatorio de corte → sugerencia de muestreo de calidad
→ Migue ajusta el ritmo de la corredora (bajo/medio/alto), que queda registrado
junto a la calidad.

**Regla de diseño innegociable**: la app **informa, Migue manda**. Muestra la
tendencia ("la calidad bajó de 95% a 88%, ibas a ritmo alto") pero **nunca ordena**
"sube el ritmo". Su criterio de experto ve cosas que la app no. Si la app manda y
se equivoca, pierde la confianza de todos.

## Cómo verificar tu trabajo

Después de **cada** cambio en `App.jsx`, en este orden:

1. `npm run build` — el build real de Vite es la prueba más fuerte. Debe decir
   "✓ built" y transformar 75 módulos.
2. Revisa que no haya declaraciones duplicadas a nivel superior ni fragmentos JSX
   desbalanceados.
3. Para lógica de cálculo (rates, reparto, conversiones), escribe una prueba
   aislada con `node -e` y verifica con números reales antes de dar por bueno.
4. Para cambios visuales, levanta el dev server y toma captura; no confíes en que
   "debería verse bien".

## Cosas que se han roto antes

- **PINs de dirección**: el login validaba contra config local, pero la nube solo
  se baja después de iniciar sesión — huevo y gallina. Ahora baja
  `config_seguridad` fresca antes de validar. Patrón reusable: cualquier dato que
  controle el acceso hay que traerlo antes de la puerta, no después.
- **Iconos**: un fallback mostraba emojis "hasta que cargue la fuente", pero el
  navegador solo descarga una fuente si algo la está usando → nunca cargaba. Por
  eso ahora la fuente es local y se fuerza con `document.fonts.load()`.
- **Modo revoltura**: el limpio se registraba solo al *seleccionar* tarima, y en
  revoltura no se selecciona ninguna → el panel en vivo nunca aparecía. Ahora el
  limpio entra cuando la tarima entra al pool.
- **Zona horaria**: Supabase guarda en UTC. Zacatecas es UTC−6. Un timestamp de
  "4:30" es 10:30 de la mañana local. Ha causado falsas alarmas.

## Documentos imprimibles

Remisión de venta (formato fiscal que ya usaba Migue en Excel), etiquetas de
estiba y calibre, nómina. Todos llevan el logo. `numeroALetras()` convierte el
importe a letra con la gramática correcta: "UN PESO" singular, "VEINTIÚN MIL"
apocopado, "UN MILLÓN DE PESOS" con la preposición. Si la tocas, prueba esos casos.

## Gráficas

Componentes SVG propios (`GraficaBarras`, `GraficaBarrasPar`, `GraficaLinea`), sin
librerías, funcionan sin conexión. Están en: finanzas (ingresos vs gastos, costo
por cultivo), corrida (cartón/min por corte), calidad (% de bueno, defectos) y
rendimiento por parcela (kg y kg/ha). Aparecen solas cuando hay 2+ datos y se
ocultan si no hay — nunca gráficas vacías.

## Pendiente

Rediseño visual pendiente basado en un PDF de referencia ("La mezcla"): el login
ya está hecho (aro degradado, chips de color por rol, botón dorado). Falta el
**home ejecutivo**: saludo con nombre, tarjeta grande de utilidad neta, banda de
alertas, accesos rápidos en cuadrícula, últimas actividades.

## Secretos

Nunca pongas credenciales en el código ni las pidas por chat. Solo existen dos
variables y ambas son públicas por diseño (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`); van en `.env.local` (ignorado por git) y en Vercel.
**Toda variable `VITE_*` acaba en el JavaScript público**: jamás una contraseña ahí.
La "cuenta técnica compartida" se desactivó por eso (ver `docs/auditoria/`).

## Estado real (auditoría de noviembre 2026)

Lee `docs/auditoria/00-DIAGNOSTICO.md` antes de cambiar nada. Lo esencial: la app
NO está lista para operar; la base de Supabase está pausada; lo publicado en
app.agroselectos.com sale de otro repositorio (`vitejs-vite-3ymxjehp`), no de éste.
