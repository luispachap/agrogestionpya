// ============================================================
//  AgroGestión — El mapa del rancho (puro: sin pantalla, sin red)
//
//  Los límites de una parcela NO se inventan: los dibuja una persona sobre la
//  imagen, se caminan con el teléfono, o se importan de un archivo geográfico
//  (KML de Google Earth, GeoJSON). Cada límite es un evento (`limite_geo`):
//  corregirlo es otro evento y el anterior se conserva. La superficie se MIDE
//  del polígono; la que la parcela tiene capturada no se cambia sola.
//
//  Aquí vive también lo que el mapa enseña al tocar una parcela: nada nuevo,
//  sólo lo que el sistema ya sabe de ella (ciclo, actividades, riegos, gastos).
//
//  Coordenadas: siempre [latitud, longitud] en grados (WGS84), con 7 decimales.
// ============================================================
import { nuevoEvento, vigentes } from "./eventos.js";
import { vivos } from "./calculos.js";
import { siembrasEn, rangoDeSiembra } from "./ciclos.js";

export const T_LIMITE = "limite_geo";
export const FUENTES_DE_LIMITE = { dibujado: "Dibujado sobre la imagen", gps: "Caminado con el teléfono", archivo: "Importado de un archivo" };
const r7 = (n) => Math.round(Number(n) * 1e7) / 1e7;
const esNum = (n) => typeof n === "number" && Number.isFinite(n);
const texto = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const plano = (s) => texto(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/* ════════════ 1 · GEOMETRÍA ════════════ */
// Radios de la Tierra (WGS84) en una latitud: cuánto mide un grado hacia el norte y hacia el este ahí.
const A = 6378137, E2 = 0.00669437999014;
function metrosPorGrado(lat) {
  const f = (lat * Math.PI) / 180, s = Math.sin(f), w = Math.sqrt(1 - E2 * s * s);
  return { norte: ((A * (1 - E2)) / (w * w * w)) * (Math.PI / 180), este: ((A / w) * Math.cos(f)) * (Math.PI / 180) };
}
// El anillo sin el punto de cierre repetido y sin puntos seguidos iguales.
export function limpiarAnillo(anillo = []) {
  const p = (anillo || []).map(v => (Array.isArray(v) ? [r7(v[0]), r7(v[1])] : v && esNum(Number(v.lat)) ? [r7(v.lat), r7(v.lng)] : null)).filter(v => v && esNum(v[0]) && esNum(v[1]));
  const out = []; for (const v of p) { const u = out[out.length - 1]; if (!u || u[0] !== v[0] || u[1] !== v[1]) out.push(v); }
  if (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
  return out;
}
// A metros, en un plano pegado al centro del propio polígono. Exacto para una parcela o un rancho (kilómetros, no países).
function aMetros(anillo) {
  const lat0 = anillo.reduce((s, v) => s + v[0], 0) / anillo.length, lng0 = anillo.reduce((s, v) => s + v[1], 0) / anillo.length, m = metrosPorGrado(lat0);
  return anillo.map(v => [(v[1] - lng0) * m.este, (v[0] - lat0) * m.norte]);
}
export function areaDeAnillo(anillo) {
  const a = limpiarAnillo(anillo); if (a.length < 3) return 0;
  const p = aMetros(a); let s = 0;
  for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += p[i][0] * q[1] - q[0] * p[i][1]; }
  return Math.abs(s) / 2;
}
export function perimetroDe(anillo) {
  const a = limpiarAnillo(anillo); if (a.length < 2) return 0;
  const p = aMetros(a); let s = 0;
  for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s += Math.hypot(q[0] - p[i][0], q[1] - p[i][1]); }
  return s;
}
// Superficie de un límite: su contorno menos sus huecos. En m² y en hectáreas (4 decimales = 1 m²).
export function superficieDe({ anillo, huecos = [] } = {}) {
  const m2 = Math.max(0, areaDeAnillo(anillo) - (huecos || []).reduce((s, h) => s + areaDeAnillo(h), 0));
  return { m2: Math.round(m2), ha: Math.round(m2) / 10000 };
}
export function cajaDe(anillos = []) {
  const p = anillos.flatMap(a => limpiarAnillo(a)); if (!p.length) return null;
  return { sur: Math.min(...p.map(v => v[0])), norte: Math.max(...p.map(v => v[0])), oeste: Math.min(...p.map(v => v[1])), este: Math.max(...p.map(v => v[1])) };
}
export function centroDe(anillo) { const c = cajaDe([anillo]); return c ? [r7((c.sur + c.norte) / 2), r7((c.oeste + c.este) / 2)] : null; }
export function puntoDentro(lat, lng, anillo) {
  const a = limpiarAnillo(anillo); if (a.length < 3) return false; let d = false;
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) { const [yi, xi] = a[i], [yj, xj] = a[j]; if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) d = !d; }
  return d;
}
const cruza = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
// ¿Sirve como límite? Dice por qué no, en palabras. No arregla nada: un límite mal trazado se vuelve a trazar.
export function revisarAnillo(anillo) {
  const a = limpiarAnillo(anillo);
  if (a.length < 3) return { ok: false, dice: "Un límite necesita al menos tres esquinas." };
  if (a.some(v => Math.abs(v[0]) > 90 || Math.abs(v[1]) > 180)) return { ok: false, dice: "Hay coordenadas que no existen en el planeta." };
  const p = aMetros(a);
  for (let i = 0; i < p.length; i++) for (let j = i + 2; j < p.length; j++) { if (i === 0 && j === p.length - 1) continue; if (cruza(p[i], p[(i + 1) % p.length], p[j], p[(j + 1) % p.length])) return { ok: false, dice: "El contorno se cruza consigo mismo (forma de moño). Acomoda las esquinas en el orden en que se recorre la orilla." }; }
  const m2 = areaDeAnillo(a);
  if (m2 < 25) return { ok: false, dice: "El contorno es demasiado chico para ser una parcela (menos de 25 m²)." };
  return { ok: true, anillo: a, ...superficieDe({ anillo: a }) };
}

/* ════════════ 2 · LOS LÍMITES, COMO EVENTOS ════════════ */
const llaveDe = (de) => `${de.tipo}:${de.id}`;
// Guardar (o corregir) el límite de una parcela o de un rancho.
export function guardarLimite({ de, anillo, huecos = [], fuente, archivo = "", precisionM = null, nota = "", parcelas = [], ranchos = [], quien, cuando, fecha, azar }) {
  if (!de || !["parcela", "rancho"].includes(de.tipo) || !de.id) return { ok: false, dice: "Falta decir de qué parcela o rancho es este límite." };
  const lista = de.tipo === "parcela" ? parcelas : ranchos;
  if (lista.length && !lista.some(x => x.id === de.id)) return { ok: false, dice: de.tipo === "parcela" ? "Esa parcela no existe." : "Ese rancho no existe." };
  if (!FUENTES_DE_LIMITE[fuente]) return { ok: false, dice: "Falta decir de dónde salió el límite (dibujado, caminado o de un archivo)." };
  if (fuente === "archivo" && !texto(archivo)) return { ok: false, dice: "Falta el nombre del archivo del que se importó." };
  const r = revisarAnillo(anillo); if (!r.ok) return r;
  const h = (huecos || []).map(limpiarAnillo).filter(x => x.length >= 3), s = superficieDe({ anillo: r.anillo, huecos: h });
  return { ok: true, ...s, evento: nuevoEvento({ tipo: T_LIMITE, cuando, fecha, quien, azar, datos: { de: { tipo: de.tipo, id: de.id }, anillo: r.anillo, ...(h.length ? { huecos: h } : {}), fuente, ...(texto(archivo) ? { archivo: texto(archivo) } : {}), ...(esNum(precisionM) ? { precisionM: Math.round(precisionM) } : {}), m2: s.m2, ...(texto(nota) ? { nota: texto(nota) } : {}) } }) };
}
// Quitar un límite (estaba mal y todavía no se tiene el bueno). Pide por qué; el trazo anterior se conserva en el historial.
export function quitarLimite({ de, motivo, quien, cuando, fecha, azar }) {
  if (!de?.id) return { ok: false, dice: "Falta decir de qué es." };
  if (texto(motivo).length < 5) return { ok: false, dice: "Falta decir por qué se quita." };
  return { ok: true, evento: nuevoEvento({ tipo: T_LIMITE, cuando, fecha, quien, azar, datos: { de: { tipo: de.tipo, id: de.id }, anillo: null, motivo: texto(motivo) } }) };
}
// El límite vigente de cada cosa. Llave «parcela:<id>» o «rancho:<id>». Lo quitado no aparece, pero su historial sí se guarda.
export function limitesDe(eventos = []) {
  const m = new Map();
  for (const e of vigentes(eventos).filter(x => x.tipo === T_LIMITE).sort((a, b) => String(a.cuando).localeCompare(String(b.cuando)))) {
    const d = e.datos || {}, k = llaveDe(d.de || {}), previo = m.get(k);
    const anteriores = previo ? [...previo.anteriores, ...(previo.anillo ? [{ ha: previo.ha, fuente: previo.fuente, quien: previo.quien, fecha: previo.fecha }] : [])] : [];
    m.set(k, d.anillo ? { de: d.de, anillo: d.anillo, huecos: d.huecos || [], ...superficieDe(d), fuente: d.fuente, archivo: d.archivo || "", precisionM: d.precisionM ?? null, nota: d.nota || "", quien: e.quien?.nombre || "", fecha: e.fecha || "", evento: e.id, anteriores }
      : { de: d.de, anillo: null, quitado: true, motivo: d.motivo || "", quien: e.quien?.nombre || "", fecha: e.fecha || "", anteriores });
  }
  return m;
}
export const limiteDe = (limites, tipo, id) => { const l = limites?.get?.(`${tipo}:${id}`); return l && l.anillo ? l : null; };
// Las parcelas con su polígono como lo espera el módulo del dron ([{lat, lng}]). No se guarda: se calcula.
export const conPoligonos = (parcelas = [], limites = new Map()) => parcelas.map(p => { const l = limiteDe(limites, "parcela", p.id); return l ? { ...p, poligono: l.anillo.map(([lat, lng]) => ({ lat, lng })) } : p; });

// La superficie capturada en la parcela contra la medida en el mapa. No decide cuál vale: enseña las dos.
export function compararSuperficie(parcela, limite) {
  const capturada = Number(parcela?.hectareas) > 0 ? Number(parcela.hectareas) : null, medida = limite?.ha ?? null;
  if (medida == null) return { capturada, medida: null, estado: "sin_limite" };
  if (capturada == null) return { capturada: null, medida, estado: "sin_capturada" };
  const dif = Math.round((medida - capturada) * 10000) / 10000, pct = Math.round((dif / capturada) * 1000) / 10;
  return { capturada, medida, dif, pct, estado: Math.abs(pct) <= 2 ? "coincide" : "difiere" };
}

/* ════════════ 3 · IMPORTAR LÍMITES DE UN ARCHIVO ════════════ */
// Un punto de un archivo → [lat, lng]. GeoJSON y KML ponen primero la longitud.
function par(lng, lat) { const a = Number(lat), b = Number(lng); return esNum(a) && esNum(b) ? [a, b] : null; }
function anilloDe(coords, avisos) {
  let p = (coords || []).map(c => par(c[0], c[1])).filter(Boolean);
  // Coordenadas en metros (UTM u otra proyección): no se adivina la zona.
  if (p.some(v => Math.abs(v[0]) > 90 && Math.abs(v[1]) > 180)) return { error: "Las coordenadas no vienen en grados (parecen metros de otra proyección, como UTM). Expórtalo en latitud/longitud (WGS84)." };
  // Latitud y longitud al revés, cuando no hay duda (una «latitud» de más de 90 no existe).
  if (p.length && p.every(v => Math.abs(v[0]) > 90 && Math.abs(v[1]) <= 90)) { p = p.map(v => [v[1], v[0]]); avisos.add("El archivo traía latitud y longitud en el orden contrario al de su formato; se leyeron al derecho."); }
  if (p.some(v => Math.abs(v[0]) > 90 || Math.abs(v[1]) > 180)) return { error: "Hay coordenadas fuera de rango." };
  return { anillo: limpiarAnillo(p) };
}
function figura(nombre, anillos, avisos, salida, descartadas) {
  const [fuera, ...dentro] = anillos, a = anilloDe(fuera, avisos);
  if (a.error) { descartadas.push({ nombre, motivo: a.error }); return; }
  const r = revisarAnillo(a.anillo); if (!r.ok) { descartadas.push({ nombre, motivo: r.dice }); return; }
  const huecos = dentro.map(h => anilloDe(h, avisos).anillo || []).filter(h => h.length >= 3);
  salida.push({ nombre: texto(nombre), anillo: r.anillo, huecos, ...superficieDe({ anillo: r.anillo, huecos }) });
}
export function leerGeoJSON(textoDelArchivo) {
  let g; try { g = typeof textoDelArchivo === "string" ? JSON.parse(textoDelArchivo) : textoDelArchivo; } catch { return { ok: false, dice: "El archivo no es un GeoJSON que se pueda leer." }; }
  const crs = g?.crs?.properties?.name || "";
  if (crs && !/CRS84|4326/i.test(crs)) return { ok: false, dice: `El archivo viene en otra proyección (${crs}). Expórtalo en latitud/longitud (WGS84).` };
  const avisos = new Set(), figuras = [], descartadas = []; let otras = 0;
  const de = (geo, nombre) => { if (!geo) return; if (geo.type === "Polygon") figura(nombre, geo.coordinates || [], avisos, figuras, descartadas); else if (geo.type === "MultiPolygon") (geo.coordinates || []).forEach((c, i) => figura(`${nombre}${geo.coordinates.length > 1 ? ` (${i + 1})` : ""}`, c, avisos, figuras, descartadas)); else if (geo.type === "GeometryCollection") (geo.geometries || []).forEach(x => de(x, nombre)); else otras++; };
  const feats = g?.type === "FeatureCollection" ? g.features || [] : g?.type === "Feature" ? [g] : g?.type ? [{ geometry: g, properties: {} }] : [];
  feats.forEach((f, i) => { const p = f.properties || {}; de(f.geometry, p.nombre || p.name || p.Name || p.NOMBRE || p.parcela || p.title || `Figura ${i + 1}`); });
  if (!figuras.length && !descartadas.length) return { ok: false, dice: otras ? "El archivo trae puntos o líneas, pero ningún polígono." : "El archivo no trae ninguna figura." };
  return { ok: true, figuras, descartadas, avisos: [...avisos, ...(otras ? [`${otras} figura(s) del archivo son puntos o líneas: no son límites y no se leyeron.`] : [])] };
}
// KML (Google Earth): cada <Placemark> con <Polygon>. Se lee como texto, sin depender del navegador.
export function leerKML(xml) {
  const t = String(xml || ""); if (!/<kml[\s>]|<Placemark[\s>]/i.test(t)) return { ok: false, dice: "El archivo no es un KML que se pueda leer." };
  const avisos = new Set(), figuras = [], descartadas = []; let otras = 0;
  const coords = (s) => texto(s).split(" ").map(x => x.split(",").map(Number)).filter(x => x.length >= 2);
  const marcas = t.match(/<Placemark[\s\S]*?<\/Placemark>/gi) || [];
  marcas.forEach((m, i) => {
    const nombre = texto((/<name>([\s\S]*?)<\/name>/i.exec(m) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, "")) || `Figura ${i + 1}`;
    const pols = m.match(/<Polygon[\s\S]*?<\/Polygon>/gi) || []; if (!pols.length) { otras++; return; }
    pols.forEach((p, k) => {
      const fuera = (/<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/i.exec(p) || [])[1];
      const dentro = [...p.matchAll(/<innerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/gi)].map(x => coords(x[1]));
      if (!fuera) { descartadas.push({ nombre, motivo: "El polígono no trae su contorno." }); return; }
      figura(`${nombre}${pols.length > 1 ? ` (${k + 1})` : ""}`, [coords(fuera), ...dentro], avisos, figuras, descartadas);
    });
  });
  if (!figuras.length && !descartadas.length) return { ok: false, dice: otras ? "El archivo trae marcas de lugar o rutas, pero ningún polígono." : "El archivo no trae ninguna figura." };
  return { ok: true, figuras, descartadas, avisos: [...avisos, ...(otras ? [`${otras} marca(s) del archivo son puntos o rutas: no son límites y no se leyeron.`] : [])] };
}
export function leerArchivoGeografico(nombre, contenido) {
  const n = String(nombre || "").toLowerCase();
  if (n.endsWith(".kmz")) return { ok: false, dice: "Un KMZ es un KML comprimido. En Google Earth escoge «Guardar lugar como…» y el tipo KML, y sube ese." };
  if (n.endsWith(".shp") || n.endsWith(".zip") || n.endsWith(".dbf")) return { ok: false, dice: "Los archivos de figuras (shapefile) todavía no se leen. Expórtalo como KML o GeoJSON." };
  if (n.endsWith(".kml") || /^\s*<\?xml|^\s*<kml/i.test(contenido)) return leerKML(contenido);
  return leerGeoJSON(contenido);
}
// ¿A qué parcela se parece el nombre de la figura? Sólo si el nombre es EL MISMO. Es una sugerencia: la persona confirma.
export function sugerirParcela(nombreDeFigura, parcelas = []) {
  const k = plano(nombreDeFigura); if (!k) return null;
  const iguales = parcelas.filter(p => plano(p.nombre) === k);
  return iguales.length === 1 ? iguales[0].id : null;
}

/* ════════════ 4 · LO QUE SE VE AL TOCAR UNA PARCELA ════════════ */
// Nada nuevo: lo que el sistema ya sabe. `hoy` = el día del rancho. Lo que no hay se dice como «sin registros», no como cero inventado.
const esRiego = (a) => /rieg|regar/i.test(a.tipo || "");
const esFertilizacion = (a) => /fertili|abon/i.test(a.tipo || "");
const ultimo = (lista) => lista.map(x => x.fecha || "").filter(Boolean).sort().pop() || null;
export function fichaDeParcela(data, parcelaId, hoy, limites = new Map()) {
  const parcela = (data.parcelas || []).find(p => p.id === parcelaId); if (!parcela) return null;
  const rancho = (data.ranchos || []).find(r => r.id === parcela.ranchoId) || null;
  const ciclos = siembrasEn(data.siembras || [], parcelaId, hoy).map(s => ({ id: s.id, cultivo: s.cultivoNombre || "", variedad: s.variedadNombre || "", superficie: parseFloat(s.superficie) || null, ...rangoDeSiembra(s) }));
  // Desde cuándo se cuenta: el inicio del ciclo vigente más antiguo; sin ciclo, todo lo registrado.
  const desde = ciclos.length ? ciclos.map(c => c.ini).sort()[0] : null, enRango = (x) => !desde || (x.fecha || "") >= desde;
  const acts = (data.actividadesContables || data.actividades || []).filter(a => a.parcelaId === parcelaId && enRango(a));
  const apls = (data.aplicaciones || []).filter(a => a.parcelaId === parcelaId && enRango(a));
  const gastos = vivos(data.egresos || []).filter(e => e.parcelaId === parcelaId && enRango(e));
  const riegos = acts.filter(esRiego), fert = acts.filter(esFertilizacion);
  const suma = (l, k) => Math.round(l.reduce((s, x) => s + (Number(x[k]) || 0), 0) * 100) / 100;
  const limite = limiteDe(limites, "parcela", parcelaId);
  return { parcela, rancho, limite, superficie: compararSuperficie(parcela, limite),
    cultivo: ciclos.length ? { de: "ciclo", nombres: [...new Set(ciclos.map(c => c.cultivo).filter(Boolean))] } : parcela.cultivo ? { de: "anotado", nombres: [parcela.cultivo] } : { de: "nada", nombres: [] },
    ciclos, desde,
    actividades: { n: acts.length, ultima: ultimo(acts), costo: suma(acts, "costoTotal") },
    riegos: { n: riegos.length, ultimo: ultimo(riegos) }, fertilizaciones: { n: fert.length, ultima: ultimo(fert) },
    aplicaciones: { n: apls.length, ultima: ultimo(apls) }, gastos: { n: gastos.length, total: suma(gastos, "monto") },
    cosechas: (data.cosechas || []).filter(c => c.parcelaId === parcelaId).reduce((n, c) => n + (c.registros || []).filter(enRango).length, 0) };
}
// Qué hay y qué falta en el mapa: para decirlo arriba, sin adornos.
export function resumenDelMapa(parcelas = [], limites = new Map()) {
  const con = parcelas.filter(p => limiteDe(limites, "parcela", p.id)), sin = parcelas.filter(p => !limiteDe(limites, "parcela", p.id));
  return { total: parcelas.length, conLimite: con.length, sinLimite: sin, conPunto: sin.filter(p => esNum(Number(p.lat)) && p.lat !== "" && p.lat != null && esNum(Number(p.lng)) && p.lng !== "" && p.lng != null),
    haMedidas: Math.round(con.reduce((s, p) => s + limiteDe(limites, "parcela", p.id).ha, 0) * 10000) / 10000 };
}
// Un color por cultivo, siempre el mismo para el mismo nombre. Se escogen para verse sobre una imagen de satélite.
export const COLORES_DE_CULTIVO = ["#FFD23F", "#3DDC97", "#FF6B6B", "#4CC9F0", "#F78C1F", "#C77DFF", "#B8F35D", "#FF8FD0"];
export const SIN_CULTIVO = "#FFFFFF";
export function colorDeCultivo(nombre) { const k = plano(nombre); if (!k) return SIN_CULTIVO; let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORES_DE_CULTIVO[h % COLORES_DE_CULTIVO.length]; }
