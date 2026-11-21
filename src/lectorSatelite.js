// ============================================================
//  AgroGestión — Bajar Sentinel-2 (la parte que toca la red)
//
//  Dos pedidos, los dos a un servicio público sin cuenta y sin llave:
//   1. al catálogo: «¿qué pasadas hay sobre esta parcela en estas fechas?»;
//   2. al recorte: «de esta pasada, mándame SÓLO la caja de la parcela».
//  El recorte de una parcela pesa unos pocos kilobytes (la imagen completa
//  pesa cientos de megas y nunca se baja). La cuenta la hace `satelite.js`.
//
//  El lector de imágenes (geotiff) se carga hasta que alguien abre el análisis.
//  Si el servicio no contesta, se dice; no se enseña una lectura vieja como nueva.
// ============================================================
import { pedidoDeEscenas, leerEscenas, urlDeRecorte, cajaConMargen, BANDAS_DE_ANALISIS, FUENTE } from "./satelite.js";

const esperar = (ms) => new Promise(r => setTimeout(r, ms));
async function pedir(url, opciones, intentos = 3) {
  let ultimo = null;
  for (let i = 0; i < intentos; i++) {
    try { const r = await fetch(url, opciones); if (r.ok) return r; ultimo = new Error(r.status === 429 ? "El servicio de imágenes pide esperar un momento (demasiadas consultas seguidas)." : `El servicio de imágenes contestó ${r.status}.`); ultimo.estado = r.status; if (r.status < 500 && r.status !== 429) break; }
    catch { ultimo = new Error("No se pudo llegar al servicio de imágenes de satélite. Revisa la señal."); }
    await esperar(700 * (i + 1));
  }
  throw ultimo;
}
export async function buscarEscenas({ anillo, desde, hasta }) {
  const p = pedidoDeEscenas({ anillo, desde, hasta }); if (!p) throw new Error("La parcela no tiene un límite trazado.");
  const r = await pedir(p.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p.cuerpo) });
  return leerEscenas(await r.json(), anillo);
}
let geotiff = null;
// Un recorte: la caja de la parcela (con margen) de UNA pasada. Devuelve la cuadrícula y sus bandas.
export async function leerRecorte({ escena, anillo, bandas = BANDAS_DE_ANALISIS, margenM = 40 }) {
  const caja = cajaConMargen(anillo, margenM);
  const r = await pedir(urlDeRecorte(escena, bandas), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [caja.poligono] } }) });
  const buf = await r.arrayBuffer();
  geotiff = geotiff || await import("geotiff");
  const img = await (await geotiff.fromArrayBuffer(buf)).getImage(), d = await img.readRasters(), [oeste, norte] = img.getOrigin(), [dx, dy] = img.getResolution();
  const ancho = img.getWidth(), alto = img.getHeight(), geo = { oeste, norte, dx: Math.abs(dx), dy: Math.abs(dy) };
  const limites = { sur: norte - alto * geo.dy, norte, oeste, este: oeste + ancho * geo.dx }, mascara = d.length > bandas.length || bandas[0] === "visual" ? d[d.length - 1] : null;
  if (bandas[0] === "visual") return { ancho, alto, geo, limites, mascara: d.length > 3 ? d[3] : null, r: d[0], g: d[1], b: d[2], bytes: buf.byteLength };
  return { ancho, alto, geo, limites, mascara, bandas: Object.fromEntries(bandas.map((b, i) => [b, d[i]])), bytes: buf.byteLength };
}
export const fuenteDeImagenes = FUENTE;
