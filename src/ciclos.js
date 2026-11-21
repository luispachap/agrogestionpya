// ============================================================
//  AgroGestión — El cultivo de una parcela DEPENDE DE LA FECHA (puro)
//
//  Una parcela no «es de ajo»: tuvo ajo de octubre a mayo y maíz después.
//  Cada ciclo es una SIEMBRA (colección `siembras`: parcela, cultivo, fecha de
//  siembra y de cosecha). El cultivo al que se le carga un trabajo, un gasto o
//  un ingreso sale de la fecha en que pasó, no de la etiqueta de la parcela.
//
//  POR QUÉ: el Excel de rayas tenía «una ubicación = un cultivo» fijo en su
//  catálogo. Al cambiar el cultivo de una ubicación, todo lo anterior cambiaba
//  de cultivo con él. Aquí no puede pasar.
//
//  REGLAS
//  · Un ciclo TERMINADO sigue contando en sus fechas (sólo el cancelado no).
//  · Si en la fecha había DOS ciclos en la parcela (dos variedades), el costo se
//    reparte entre ellos —por superficie, o parejo si no la tienen— y la suma
//    es exacta: nunca se le carga entero a los dos.
//  · Si en la fecha NO había ningún ciclo, no se le carga a ningún cultivo:
//    queda «sin ciclo», a la vista, con su parcela y sus fechas.
//  · El trabajo de bodega de un cultivo es de ese cultivo pero no de una
//    parcela; el general de bodega y lo que no tiene parcela van aparte.
//    Nada de eso se reparte para que «cuadre».
// ============================================================
import { sumarDinero, repartirDinero } from "./calculos.js";

const LEJOS = "2999-12-31";
export function rangoDeSiembra(s) { return { ini: s.fechaSiembra || "0000-01-01", fin: s.fechaCosechaReal || s.fechaCosechaEstimada || LEJOS }; }
const cuenta = (s) => s.estado !== "cancelada";
export function siembrasEn(siembras = [], parcelaId, fecha) {
  if (!parcelaId || !fecha) return [];
  return siembras.filter(s => s.parcelaId === parcelaId && cuenta(s) && (() => { const { ini, fin } = rangoDeSiembra(s); return fecha >= ini && fecha <= fin; })());
}
// ¿Qué cultivo tenía esa parcela ese día?  estado: "uno" | "varios" | "sin_ciclo"
export function cultivoEn(siembras, parcelaId, fecha) {
  const en = siembrasEn(siembras, parcelaId, fecha), cultivos = [...new Set(en.map(s => s.cultivoNombre || "").filter(Boolean))];
  return { estado: en.length === 0 ? "sin_ciclo" : cultivos.length > 1 ? "varios" : "uno", cultivo: cultivos.length === 1 ? cultivos[0] : null, cultivos, siembras: en };
}
// A qué ciclos se les carga algo de una parcela en una fecha, y qué parte a cada uno. Las partes suman 1 (o no hay ninguna).
export function partesDe({ parcelaId, fecha, siembraId = null }, siembras = []) {
  if (siembraId && siembraId !== "__repartir__") { const s = siembras.find(x => x.id === siembraId); return s ? [{ siembra: s, parte: 1 }] : []; }
  const en = siembrasEn(siembras, parcelaId, fecha); if (en.length === 0) return [];
  const sup = en.map(s => parseFloat(s.superficie) || 0), total = sup.reduce((a, b) => a + b, 0);
  return en.map((s, i) => ({ siembra: s, parte: total > 0 && sup.every(x => x > 0) ? sup[i] / total : 1 / en.length }));
}
export function parteDe(registro, siembraId, siembras) { return partesDe(registro, siembras).find(p => p.siembra.id === siembraId)?.parte || 0; }

// El historial de una parcela: sus ciclos en orden, con los huecos (tiempo sin ciclo) y los traslapes entre ellos.
export function historialDeParcela(siembras = [], parcelaId) {
  const ciclos = siembras.filter(s => s.parcelaId === parcelaId && cuenta(s)).map(s => ({ id: s.id, cultivo: s.cultivoNombre || "", variedad: s.variedadNombre || "", ...rangoDeSiembra(s), abierto: !(s.fechaCosechaReal || s.fechaCosechaEstimada), estado: s.estado || "" }))
    .sort((a, b) => a.ini.localeCompare(b.ini));
  const traslapes = [], huecos = [];
  for (let i = 1; i < ciclos.length; i++) {
    const a = ciclos[i - 1], b = ciclos[i];
    if (b.ini <= a.fin) traslapes.push({ de: a.id, con: b.id, desde: b.ini, hasta: a.fin < b.fin ? a.fin : b.fin, otroCultivo: a.cultivo !== b.cultivo });
    else if (b.ini > a.fin && a.fin !== LEJOS) huecos.push({ desde: a.fin, hasta: b.ini });
  }
  return { ciclos, traslapes, huecos };
}

// El resultado por cultivo, por FECHA. `registros`: [{ tipo: "costo"|"ingreso", monto, fecha, parcelaId, siembraId?, bodegaDe?, general?, que? }]
// Devuelve cada cultivo con lo suyo, y aparte lo que no es de ningún cultivo. Todo suma exacto lo que entró.
export function resultadoPorCultivo(registros = [], siembras = []) {
  const por = new Map(), nuevo = (cultivo) => ({ cultivo, costo: 0, enParcelas: 0, enBodega: 0, ingresos: 0, parcelas: new Set(), ciclos: new Set(), n: 0 });
  const de = (c) => { if (!por.has(c)) por.set(c, nuevo(c)); return por.get(c); };
  const sinCiclo = { costo: 0, ingresos: 0, n: 0, parcelas: new Map() }, general = { costo: 0, n: 0 }, sinParcela = { costo: 0, ingresos: 0, n: 0 };
  let costo = 0, ingresos = 0;
  for (const r of registros) {
    const m = Number(r.monto) || 0; if (!m) continue;
    const esIngreso = r.tipo === "ingreso"; if (esIngreso) ingresos = sumarDinero([ingresos, m]); else costo = sumarDinero([costo, m]);
    const suma = (x, campo) => { x[campo] = sumarDinero([x[campo], m]); };
    if (r.general) { suma(general, "costo"); general.n++; continue; }
    if (r.bodegaDe) { const x = de(r.bodegaDe); suma(x, esIngreso ? "ingresos" : "costo"); if (!esIngreso) suma(x, "enBodega"); x.n++; continue; }
    if (!r.parcelaId) { suma(sinParcela, esIngreso ? "ingresos" : "costo"); sinParcela.n++; continue; }
    const partes = partesDe(r, siembras);
    if (partes.length === 0) {
      suma(sinCiclo, esIngreso ? "ingresos" : "costo"); sinCiclo.n++;
      const p = sinCiclo.parcelas.get(r.parcelaId) || { parcelaId: r.parcelaId, monto: 0, n: 0, desde: r.fecha || "", hasta: r.fecha || "" };
      p.monto = sumarDinero([p.monto, m]); p.n++; if (r.fecha && (!p.desde || r.fecha < p.desde)) p.desde = r.fecha; if (r.fecha && r.fecha > p.hasta) p.hasta = r.fecha; sinCiclo.parcelas.set(r.parcelaId, p);
      continue;
    }
    // Varias a la vez: se reparte en centavos enteros y el sobrante va a la última parte, para que la suma sea exacta.
    const montos = partes.length === 1 ? [m] : repartirDinero(m, partes.map(p => p.parte));
    partes.forEach((p, i) => { const x = de(p.siembra.cultivoNombre || "(sin nombre)"), v = montos[i];
      x[esIngreso ? "ingresos" : "costo"] = sumarDinero([x[esIngreso ? "ingresos" : "costo"], v]); if (!esIngreso) x.enParcelas = sumarDinero([x.enParcelas, v]);
      x.parcelas.add(r.parcelaId); x.ciclos.add(p.siembra.id); x.n++; });
  }
  const cultivos = [...por.values()].map(x => ({ ...x, parcelas: [...x.parcelas], ciclos: [...x.ciclos], utilidad: sumarDinero([x.ingresos, -x.costo]) })).sort((a, b) => b.costo - a.costo || a.cultivo.localeCompare(b.cultivo));
  const repartido = sumarDinero(cultivos.map(x => x.costo));
  return { cultivos, sinCiclo: { ...sinCiclo, parcelas: [...sinCiclo.parcelas.values()] }, general, sinParcela, costo, ingresos,
    cuadra: sumarDinero([repartido, sinCiclo.costo, general.costo, sinParcela.costo]) === costo };
}
