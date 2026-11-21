// ============================================================
//  AgroGestión — Satélite para ANÁLISIS (Sentinel-2), puro: sin pantalla y sin red
//
//  Dos imágenes distintas, que no se confunden:
//   · el FONDO del mapa es un mosaico sin fecha, para ubicar y trazar;
//   · esto es Sentinel-2: una pasada con día y hora, en cuadros de 10 m, de la
//     que se calculan índices DENTRO del límite de una parcela.
//
//  Aquí está la cuenta: qué pasadas hay, cuáles cuadros caen dentro de la
//  parcela, cuáles tapó una nube, el índice y su resumen, y cómo se pinta.
//  Quién baja los datos vive en `lectorSatelite.js`.
//
//  REGLAS
//  · Sin límite trazado no hay análisis: no se supone un cuadro.
//  · Un cuadro con nube, sombra o sin dato NO cuenta y no se rellena.
//  · Los cuadros de la orilla mezclan parcela y camino: quedan fuera.
//  · Un índice es un INDICIO. Aquí nunca se escribe una causa.
// ============================================================
import { nuevoEvento, vigentes } from "./eventos.js";
import { limpiarAnillo, cajaDe, puntoDentro, metrosPorGrado } from "./mapa.js";

export const FUENTE = { id: "planetary-computer", nombre: "Microsoft Planetary Computer", catalogo: "https://planetarycomputer.microsoft.com/api/stac/v1/search", recorte: "https://planetarycomputer.microsoft.com/api/data/v1/item/crop.tif", coleccion: "sentinel-2-l2a" };
export const CREDITO = (anio) => `Contiene datos Copernicus Sentinel modificados (${anio}), leídos de ${FUENTE.nombre}.`;
export const RESOLUCION_M = 10;
export const T_LECTURA = "lectura_satelital";

// Qué se puede ver. `bandas`: lo que se pide. Las de 20 m (B8A, B11) llegan repetidas a la cuadrícula de 10.
export const INDICES = {
  ndvi: { nombre: "Vigor", sigla: "NDVI", que: "Cuánta hoja verde y activa hay. De 0 (suelo) a cerca de 1 (cultivo cerrado y verde).", resolucion: 10, a: "B08", b: "B04", rango: [0, 0.9],
    rampa: [[0, "#8C510A"], [0.15, "#BF812D"], [0.25, "#DFC27D"], [0.35, "#F6E8A0"], [0.45, "#C7E59A"], [0.6, "#66BD63"], [0.75, "#1A9641"], [0.9, "#0B5D1E"]] },
  ndmi: { nombre: "Humedad de la planta", sigla: "NDMI", que: "Agua en el follaje (no en el suelo). Más alto, más agua en la planta. Con poca hoja dice poco.", resolucion: 20, a: "B8A", b: "B11", rango: [-0.3, 0.5],
    rampa: [[-0.3, "#B35806"], [-0.1, "#F1A340"], [0, "#FEE0B6"], [0.1, "#F7F7F7"], [0.2, "#D1E5F0"], [0.35, "#67A9CF"], [0.5, "#2166AC"]] },
};
export const BANDAS_DE_ANALISIS = ["B04", "B08", "B8A", "B11", "SCL"];
// Lo que el propio satélite dice de cada cuadro (capa SCL). Estos no cuentan.
const SCL_NUBE = new Set([3, 8, 9, 10]), SCL_MALO = new Set([0, 1, 3, 8, 9, 10, 11]);
export const ADVERTENCIAS = [
  "Es un indicio, no un diagnóstico. Un valor bajo puede ser suelo recién sembrado, cultivo madurando o ya cosechado, falta de agua, plaga, maleza seca o una nube delgada que el satélite no marcó. Para saber qué es, hay que ir a ver la parcela.",
  "Cada cuadro mide 10 metros. Se ve la parcela completa y manchones grandes; no se ven surcos, plantas ni una fuga de cintilla.",
  "Comparar dos parcelas sólo dice algo si tienen el mismo cultivo y se sembraron en fechas parecidas.",
];
const r3 = (n) => Math.round(n * 1000) / 1000;

/* ════════════ 1 · QUÉ PASADAS HAY ════════════ */
// La caja de la parcela con un margen (para ver el contexto alrededor), como polígono [lng, lat] cerrado.
export function cajaConMargen(anillo, metros = 40) {
  const c = cajaDe([anillo]); if (!c) return null;
  const m = metrosPorGrado((c.sur + c.norte) / 2), dy = metros / m.norte, dx = metros / m.este;
  const s = c.sur - dy, n = c.norte + dy, o = c.oeste - dx, e = c.este + dx;
  return { sur: s, norte: n, oeste: o, este: e, poligono: [[o, s], [e, s], [e, n], [o, n], [o, s]] };
}
export function pedidoDeEscenas({ anillo, desde, hasta }) {
  const a = limpiarAnillo(anillo); if (a.length < 3) return null;
  return { url: FUENTE.catalogo, cuerpo: { collections: [FUENTE.coleccion], intersects: { type: "Polygon", coordinates: [[...a, a[0]].map(([lat, lng]) => [lng, lat])] }, datetime: `${desde}T00:00:00Z/${hasta}T23:59:59Z`, limit: 200,
    fields: { include: ["id", "geometry", "properties.datetime", "properties.eo:cloud_cover", "properties.platform", "properties.s2:processing_baseline", "properties.s2:nodata_pixel_percentage"], exclude: ["links", "assets", "bbox"] } } };
}
// El día del rancho en que pasó el satélite (pasa cerca de mediodía; se guarda en UTC y aquí son 6 horas menos).
const diaLocal = (iso, desfaseH = -6) => { const d = new Date(new Date(iso).getTime() + desfaseH * 3600e3); return { fecha: d.toISOString().slice(0, 10), hora: d.toISOString().slice(11, 16) }; };
const cubre = (geometria, anillo) => { const g = geometria?.type === "Polygon" ? geometria.coordinates?.[0] : null; if (!g) return null; const ring = g.map(([lng, lat]) => [lat, lng]); return anillo.every(([lat, lng]) => puntoDentro(lat, lng, ring)); };
// De la respuesta del catálogo a la lista de pasadas, una por día: la que cubre la parcela completa y trae menos faltante.
export function leerEscenas(respuesta, anillo) {
  const a = limpiarAnillo(anillo), porDia = new Map();
  for (const f of respuesta?.features || []) {
    const p = f.properties || {}; if (!p.datetime || !f.id) continue;
    const { fecha, hora } = diaLocal(p.datetime), base = String(p["s2:processing_baseline"] || "");
    const e = { id: f.id, fecha, hora, utc: p.datetime, nubesEscena: typeof p["eo:cloud_cover"] === "number" ? Math.round(p["eo:cloud_cover"] * 10) / 10 : null, plataforma: String(p.platform || "Sentinel-2").replace(/^sentinel-/i, "Sentinel-").replace(/(\d)([a-z])$/i, (_, n, l) => n + l.toUpperCase()),
      base, conDesfase: base ? parseFloat(base) >= 4 : true, cubreTodo: cubre(f.geometry, a), faltante: Number(p["s2:nodata_pixel_percentage"]) || 0 };
    const ya = porDia.get(fecha);
    if (!ya || (e.cubreTodo && !ya.cubreTodo) || (e.cubreTodo === ya.cubreTodo && (e.faltante < ya.faltante || (e.faltante === ya.faltante && e.id > ya.id)))) porDia.set(fecha, e);
  }
  return [...porDia.values()].sort((x, y) => x.fecha.localeCompare(y.fecha));
}
export function urlDeRecorte(escena, bandas = BANDAS_DE_ANALISIS) {
  const q = bandas[0] === "visual" ? "assets=visual&asset_bidx=visual%7C1,2,3" : bandas.map(b => `assets=${b}`).join("&") + "&resampling=nearest";
  return `${FUENTE.recorte}?collection=${FUENTE.coleccion}&item=${encodeURIComponent(escena.id)}&${q}`;
}

/* ════════════ 2 · LA CUENTA DENTRO DE LA PARCELA ════════════ */
// Distancia (m) de un punto a la orilla del polígono.
function aLaOrilla(lat, lng, anillo, m) {
  let d = Infinity; const px = lng * m.este, py = lat * m.norte;
  for (let i = 0; i < anillo.length; i++) { const a = anillo[i], b = anillo[(i + 1) % anillo.length], ax = a[1] * m.este, ay = a[0] * m.norte, bx = b[1] * m.este, by = b[0] * m.norte;
    const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1))); d = Math.min(d, Math.hypot(px - (ax + t * vx), py - (ay + t * vy))); }
  return d;
}
// Qué cuadros de la cuadrícula caen DENTRO de la parcela (su centro, y a más de medio cuadro de la orilla).
// `geo`: { oeste, norte, dx, dy } = esquina de arriba a la izquierda y tamaño de cada cuadro en grados.
export function cuadrosDentro({ ancho, alto, geo }, anillo, huecos = [], margenM = RESOLUCION_M / 2) {
  const a = limpiarAnillo(anillo), dentro = new Uint8Array(ancho * alto), m = metrosPorGrado(geo.norte);
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    const lat = geo.norte - (y + 0.5) * geo.dy, lng = geo.oeste + (x + 0.5) * geo.dx;
    if (puntoDentro(lat, lng, a) && !huecos.some(h => puntoDentro(lat, lng, h)) && aLaOrilla(lat, lng, a, m) >= margenM - 0.05) dentro[y * ancho + x] = 1;
  }
  return dentro;
}
// De número crudo a reflectancia (0–1). Desde 2022 el dato trae un desfase de 1000 que hay que quitar.
export const reflectancia = (dn, conDesfase) => Math.max(0, (dn - (conDesfase ? 1000 : 0)) / 10000);
const cuantil = (orden, q) => { if (!orden.length) return null; const i = (orden.length - 1) * q, a = Math.floor(i), b = Math.ceil(i); return orden[a] + (orden[b] - orden[a]) * (i - a); };

// El índice cuadro por cuadro y su resumen. `r`: { ancho, alto, geo, bandas: { B04, B08, B8A, B11, SCL }, mascara }.
// Devuelve `valores` (NaN donde no cuenta) y `resumen`. Nunca rellena: lo tapado se cuenta como tapado.
export function calcularIndice(r, anillo, escena, clave, huecos = []) {
  const ind = INDICES[clave]; if (!ind) throw new Error("Ese índice no existe");
  const n = r.ancho * r.alto, A = r.bandas[ind.a], B = r.bandas[ind.b], scl = r.bandas.SCL, dentro = r.dentro || cuadrosDentro(r, anillo, huecos);
  const valores = new Float32Array(n).fill(NaN), buenos = []; let total = 0, nube = 0, sinDato = 0;
  for (let i = 0; i < n; i++) {
    const tapado = scl ? SCL_MALO.has(scl[i]) : false, vacio = (r.mascara && !r.mascara[i]) || !A[i] || !B[i];
    if (dentro[i]) { total++; if (vacio) sinDato++; else if (tapado) { if (SCL_NUBE.has(scl[i])) nube++; else sinDato++; } }
    if (vacio || tapado) continue;
    const a = reflectancia(A[i], escena.conDesfase), b = reflectancia(B[i], escena.conDesfase); if (a + b <= 0) continue;
    valores[i] = (a - b) / (a + b); if (dentro[i]) buenos.push(valores[i]);
  }
  buenos.sort((x, y) => x - y);
  const validos = buenos.length, pct = total ? Math.round((validos / total) * 100) : 0;
  const estado = total === 0 ? "sin_cuadros" : validos === 0 ? "sin_dato" : total < 9 ? "pocos" : pct < 60 ? "parcial" : "bien";
  return { valores, dentro, resumen: { cuadros: total, validos, pctValido: pct, conNube: nube, sinDato, estado,
    ...(validos ? { media: r3(buenos.reduce((s, v) => s + v, 0) / validos), mediana: r3(cuantil(buenos, 0.5)), min: r3(buenos[0]), max: r3(buenos[validos - 1]), p10: r3(cuantil(buenos, 0.1)), p90: r3(cuantil(buenos, 0.9)) } : {}) } };
}
export const ESTADOS = {
  bien: "Lectura completa", parcial: "Lectura parcial: una parte de la parcela quedó tapada", pocos: "La parcela es muy chica para cuadros de 10 m: el número es poco confiable",
  sin_dato: "Sin imagen útil ese día (nube, sombra o sin dato sobre la parcela)", sin_cuadros: "Ningún cuadro de 10 m cabe completo dentro de la parcela",
};
// ¿Sirve este resumen para la línea del tiempo? Sólo lecturas completas.
export const sirveParaSerie = (res) => !!res && res.estado === "bien";

/* ════════════ 3 · CÓMO SE PINTA ════════════ */
const aRGB = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
export function colorDe(clave, v) {
  const rampa = INDICES[clave].rampa; if (!(v === v)) return null;
  if (v <= rampa[0][0]) return aRGB(rampa[0][1]); if (v >= rampa[rampa.length - 1][0]) return aRGB(rampa[rampa.length - 1][1]);
  for (let i = 1; i < rampa.length; i++) if (v <= rampa[i][0]) { const [v0, c0] = rampa[i - 1], [v1, c1] = rampa[i], t = (v - v0) / (v1 - v0), a = aRGB(c0), b = aRGB(c1); return a.map((x, k) => Math.round(x + (b[k] - x) * t)); }
  return null;
}
// La imagen del índice: sólo los cuadros de la parcela; lo tapado, transparente con trama gris.
export function pintarIndice({ valores, dentro }, ancho, alto, clave) {
  const px = new Uint8ClampedArray(ancho * alto * 4);
  for (let i = 0; i < ancho * alto; i++) { if (!dentro[i]) continue; const c = colorDe(clave, valores[i]);
    if (c) { px[i * 4] = c[0]; px[i * 4 + 1] = c[1]; px[i * 4 + 2] = c[2]; px[i * 4 + 3] = 235; } else { px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = 150; px[i * 4 + 3] = 150; } }
  return px;
}
// La foto en color real de esa pasada (toda la caja, para ver el contexto).
export function pintarColor({ r, g, b, mascara }, ancho, alto) {
  const px = new Uint8ClampedArray(ancho * alto * 4);
  for (let i = 0; i < ancho * alto; i++) { px[i * 4] = r[i]; px[i * 4 + 1] = g[i]; px[i * 4 + 2] = b[i]; px[i * 4 + 3] = mascara && !mascara[i] ? 0 : 255; }
  return px;
}

/* ════════════ 4 · LO LEÍDO SE GUARDA COMO EVENTO (sólo el resumen) ════════════ */
const idDe = (parcelaId, escenaId, limiteEv) => `ev-lectsat-${parcelaId}-${escenaId}-${String(limiteEv || "").slice(-12)}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 150);
// Una lectura = una pasada sobre una parcela con UN límite. Si el límite se corrige, la lectura vieja ya no vale para el nuevo.
export function guardarLectura({ parcelaId, limite, escena, resumenes, quien, cuando, fecha }) {
  if (!parcelaId || !limite?.evento || !escena?.id) return { ok: false, dice: "Falta la parcela, su límite o la pasada." };
  const indices = Object.fromEntries(Object.entries(resumenes || {}).filter(([k, v]) => INDICES[k] && v));
  if (!Object.keys(indices).length) return { ok: false, dice: "No hay nada que guardar." };
  return { ok: true, evento: nuevoEvento({ id: idDe(parcelaId, escena.id, limite.evento), tipo: T_LECTURA, cuando, fecha, quien,
    datos: { parcelaId, limite: limite.evento, haDelLimite: limite.ha, escena: escena.id, dia: escena.fecha, hora: escena.hora, plataforma: escena.plataforma, nubesEscena: escena.nubesEscena, fuente: FUENTE.id, resolucionM: RESOLUCION_M, indices } }) };
}
// Las lecturas guardadas de una parcela PARA SU LÍMITE VIGENTE, una por día, en orden.
export function lecturasDe(eventos = [], parcelaId, limiteEv) {
  const m = new Map();
  for (const e of vigentes(eventos)) { if (e.tipo !== T_LECTURA) continue; const d = e.datos || {}; if (d.parcelaId !== parcelaId || d.limite !== limiteEv) continue; m.set(d.dia, { ...d, evento: e.id }); }
  return [...m.values()].sort((a, b) => a.dia.localeCompare(b.dia));
}

/* ════════════ 5 · LEERLO SIN INVENTAR ════════════ */
// La línea del tiempo de un índice: sólo los días con lectura completa. Los demás se listan aparte, no se unen con una línea.
export function serieDe(lecturas = [], clave, desde = null) {
  const de = lecturas.filter(l => !desde || l.dia >= desde), puntos = de.filter(l => sirveParaSerie(l.indices?.[clave])).map(l => ({ dia: l.dia, valor: l.indices[clave].media, p10: l.indices[clave].p10, p90: l.indices[clave].p90 }));
  // Un punto que se sale de sus dos vecinos mientras ellos coinciden entre sí: lo más común es una nube delgada o bruma
  // que el satélite no marcó. No se quita ni se corrige: se señala como dudoso, para que alguien mire la foto de ese día.
  puntos.forEach((p, i) => { const a = puntos[i - 1], b = puntos[i + 1]; if (a && b && Math.abs(a.valor - b.valor) < SALTO_VECINOS && Math.abs(p.valor - a.valor) > SALTO_DUDOSO && Math.abs(p.valor - b.valor) > SALTO_DUDOSO) p.duda = true; });
  return { puntos, dudosas: puntos.filter(p => p.duda).map(p => p.dia), sinUsar: de.filter(l => !sirveParaSerie(l.indices?.[clave])).map(l => ({ dia: l.dia, estado: l.indices?.[clave]?.estado || "sin_dato" })) };
}
export const SALTO_DUDOSO = 0.15, SALTO_VECINOS = 0.08;
// Dos fechas de la misma parcela. Dice cuánto cambió; nunca por qué.
export const CAMBIO_MINIMO = 0.05;
export function compararFechas(a, b, clave) {
  const x = a?.indices?.[clave], y = b?.indices?.[clave];
  if (!sirveParaSerie(x) || !sirveParaSerie(y)) return { se: false, dice: "Una de las dos fechas no tiene lectura completa: no se comparan." };
  const [antes, despues] = a.dia <= b.dia ? [a, b] : [b, a], v0 = antes.indices[clave].media, v1 = despues.indices[clave].media, dif = r3(v1 - v0);
  const sentido = Math.abs(dif) < CAMBIO_MINIMO ? "igual" : dif > 0 ? "subio" : "bajo";
  return { se: true, desde: antes.dia, hasta: despues.dia, antes: v0, despues: v1, dif, sentido,
    dice: sentido === "igual" ? `Prácticamente igual (${v0} y ${v1}): un cambio menor a ${CAMBIO_MINIMO} cabe en lo que varía de una pasada a otra.` : `${sentido === "subio" ? "Subió" : "Bajó"} de ${v0} a ${v1} (${dif > 0 ? "+" : ""}${dif}). El satélite dice que cambió, no por qué.` };
}
// Qué fechas pedir: el ciclo vigente; sin ciclo, los últimos 90 días. Sentinel-2 L2A existe desde 2017 en esta fuente.
export function periodoDeAnalisis({ desdeDelCiclo = null, hoy, diasSinCiclo = 90 }) {
  const atras = (f, n) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const tope = atras(hoy, 365), desde = desdeDelCiclo && desdeDelCiclo > "2017-01-01" ? (desdeDelCiclo < tope ? tope : desdeDelCiclo) : atras(hoy, diasSinCiclo);
  return { desde, hasta: hoy, deCiclo: !!desdeDelCiclo && desdeDelCiclo > "2017-01-01", recortado: !!desdeDelCiclo && desdeDelCiclo < tope };
}
