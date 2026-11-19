// ════════════════════════════════════════════════════════════════════════
//  COSTO DIRECTO y COSTO COMPLETO — dos cifras, siempre las dos
//
//    costo directo     lo que se le cargó derecho a la parcela (lo de siempre)
//    costo completo    el directo + lo indirecto que le tocó
//
//  Lo indirecto llega de FUENTES (hoy los vehículos; mañana la energía del
//  pozo, la administración, lo que sea). Cada fuente entrega tres cosas:
//    partes        lo que sí se pudo repartir, con su porqué y de dónde salió
//    pendientes    lo que NO se pudo repartir, con su causa — no se fuerza
//    noProduccion  lo que no corresponde a producción — no se reparte
//  Repartir no crea un gasto: la parte repartida ES el mismo peso del gasto
//  original. Por eso el indirecto se enseña encima del directo y NUNCA se suma
//  a los gastos ni al costo directo.
// ════════════════════════════════════════════════════════════════════════
import { sumarDinero } from "./calculos.js";

// Junta todas las fuentes en una sola lista. Cada parte queda con su fuente.
export function juntarFuentes(fuentes) {
  const partes = [], pendientes = [], noProduccion = [];
  for (const f of fuentes || []) {
    for (const p of f.partes || []) partes.push({ ...p, fuente: f.fuente, nombreFuente: f.nombre });
    for (const p of f.pendientes || []) pendientes.push({ ...p, fuente: f.fuente, nombreFuente: f.nombre });
    if (f.noProduccion > 0) noProduccion.push({ fuente: f.fuente, nombreFuente: f.nombre, monto: f.noProduccion, detalle: f.detalleNoProduccion || [] });
  }
  return { partes, pendientes, noProduccion, repartido: sumarDinero(partes.map(p => p.monto)), pendiente: sumarDinero(pendientes.map(p => p.monto)), fuera: sumarDinero(noProduccion.map(p => p.monto)) };
}

// Lo indirecto de una parcela (o de varias), en unas fechas. `fraccion` permite
// que una siembra tome sólo su parte cuando la parcela tuvo varias a la vez.
export function indirectoDe(todo, { parcelaIds, desde, hasta, fraccion } = {}) {
  const ids = new Set(parcelaIds || []);
  const renglones = [];
  for (const p of todo?.partes || []) {
    if (!ids.has(p.parcelaId) || (desde && p.fecha < desde) || (hasta && p.fecha > hasta)) continue;
    const f = fraccion ? fraccion(p) : 1;
    if (!(f > 0)) continue;
    renglones.push(f === 1 ? p : { ...p, monto: Math.round(p.monto * f * 100) / 100, base: `${p.base} · ${Math.round(f * 100)}% a esta siembra`, deUnTotalDe: p.monto });
  }
  return { renglones, total: sumarDinero(renglones.map(r => r.monto)) };
}

// Las dos cifras, con todo lo que hace falta para explicarlas.
//   directo           lo que ya mostraban los reportes (no se toca)
//   ajustes           diferencias de valuación que aparecieron DESPUÉS (una compra capturada tarde)
//   indirecto         lo repartido de las fuentes
//   completo          directo + ajustes + indirecto
export function costoCompleto({ directo = 0, ajustes = [], indirecto = { renglones: [], total: 0 } }) {
  const aj = sumarDinero(ajustes.map(a => a.diferencia));
  const porFuente = {};
  for (const r of indirecto.renglones) porFuente[r.nombreFuente || r.fuente] = sumarDinero(porFuente[r.nombreFuente || r.fuente] || 0, r.monto);
  return { directo, ajustes: aj, ajustesLista: ajustes, directoAjustado: sumarDinero(directo, aj), indirecto: indirecto.total, renglones: indirecto.renglones, porFuente,
    completo: sumarDinero(directo, aj, indirecto.total), hayMas: indirecto.total !== 0 || aj !== 0 };
}

// En un reporte de un periodo ya pasado: qué se capturó DESPUÉS de que el
// periodo terminó. Con eso se puede decir "cuando cerró el mes, este reporte
// decía tanto; después se le agregó tanto". `renglones`: { monto, fecha, capturado }.
export function capturadoDespues(renglones, hasta) {
  if (!hasta) return { posteriores: [], total: 0, original: sumarDinero((renglones || []).map(r => r.monto)) };
  const limite = `${hasta}T23:59:59`;
  const posteriores = (renglones || []).filter(r => r.capturado && String(r.capturado).slice(0, 19) > limite && r.fecha <= hasta);
  const total = sumarDinero(posteriores.map(r => r.monto));
  return { posteriores, total, original: sumarDinero((renglones || []).map(r => r.monto)) - total };
}
