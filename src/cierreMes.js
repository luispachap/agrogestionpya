// ════════════════════════════════════════════════════════════════════════
//  CIERRE DE MES — la foto de los costos
//
//  Los costos se CALCULAN de lo registrado, así que una compra capturada
//  tarde, una asistencia que se aclara o una regla que cambia mueven las
//  cifras de un mes que ya se había revisado. Cerrar el mes guarda cómo
//  quedaron ESE día (parcela por parcela: directo, indirecto y completo, más
//  lo pendiente de distribuir). Lo que cambie después NO toca la foto: se
//  enseña como ajuste posterior, y las cifras originales se pueden consultar
//  siempre. Reabrir pide motivo; cerrar otra vez es una versión nueva.
//  Cierra quien tiene ese permiso (lo comprueba la base, como todo lo sensible).
// ════════════════════════════════════════════════════════════════════════
import { nuevoEvento, vigentes, negado } from "./eventos.js";
import { sumarDinero } from "./calculos.js";
import { indirectoDe } from "./indirectos.js";
import { estadoDeCompra } from "./compras.js";
import { claseDeInsumo } from "./resultado.js";

export const T_CIERRE_MES = "cierre_mes", T_REAPERTURA_MES = "reapertura_mes";
const limpio = (s) => String(s || "").trim();
const esMes = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m || "");
const finDe = (mes) => `${mes}-${String(new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).getUTCDate()).padStart(2, "0")}`;

// Lo que costó un mes, parcela por parcela, tal como sale HOY de lo registrado.
//   actividades   las que ya cuentan (`actividadesContables`), con `costoTotal`
//   egresos       los vivos (sin cancelados);  compras: las aprobadas
//   indirectos    lo que devuelve `juntarFuentes`
//   recibidas          `estadoDelAlmacen(...).recibidas`: lo que de cada compra del personal ya entró al almacén y con qué precio
//   consumosGenerales  consumos del almacén de «uso general del rancho», ya con su costo: { fecha, costo }
//   ajustesValuacion   la lista de `ajustesDeValuacion`: consumos cuyo costo se supo o cambió después
//   mermas             mermas y faltantes del almacén ya valuados: { fecha, valor }
//   maquinaria         lo de `conciliarMaquinaria(repartos, mes)`: se guarda para enseñar aplicado, real y diferencia
export function costoDelMes({ mes, parcelas = [], actividades = [], egresos = [], compras = [], indirectos = null, recibidas = [], consumosGenerales = [], ajustesValuacion = [], mermas = [], maquinaria = null }) {
  const desde = `${mes}-01`, hasta = finDe(mes), enMes = (f) => !!f && f >= desde && f <= hasta;
  const dir = new Map();
  const pon = (id, monto) => { if (id && monto) dir.set(id, sumarDinero(dir.get(id) || 0, monto)); };
  for (const a of actividades) if (enMes(a.fecha)) pon(a.parcelaId, Number(a.costoTotal) || 0);
  for (const e of egresos) if (enMes(e.fecha)) pon(e.parcelaId, Number(e.monto) || 0);
  for (const c of compras) if (c.estado === "aprobada" && enMes(c.fecha)) pon(c.parcelaId, Number(c.monto) || 0);
  // AJUSTES DE VALUACIÓN: un consumo cuyo costo se supo o cambió después (una compra recibida sin precio, una compra capturada
  // tarde). Van al mes del consumo y a su parcela, como renglón aparte: el consumo original no se toca.
  const ajPorParcela = new Map(); let ajOtros = 0;
  for (const a of ajustesValuacion) {
    if (!enMes(a.fecha) || !a.diferencia) continue;
    if (a.destino?.tipo === "parcela" && a.destino.id) { pon(a.destino.id, a.diferencia); ajPorParcela.set(a.destino.id, sumarDinero(ajPorParcela.get(a.destino.id) || 0, a.diferencia)); }
    else if (a.destino?.tipo !== "vehiculo") ajOtros = sumarDinero(ajOtros, a.diferencia);   // lo de un vehículo ya va en la cuenta de ese vehículo (y de ahí, a su reparto)
  }
  const ids = new Set([...dir.keys(), ...(indirectos?.partes || []).filter(p => enMes(p.fecha)).map(p => p.parcelaId)]);
  const nombre = new Map(parcelas.map(p => [p.id, p.nombre]));
  const renglones = [...ids].map(id => {
    const directo = dir.get(id) || 0, indirecto = indirectoDe(indirectos, { parcelaIds: [id], desde, hasta }).total;
    return { parcelaId: id, nombre: nombre.get(id) || "Parcela que ya no está en el catálogo", directo, indirecto, completo: sumarDinero(directo, indirecto), ...(ajPorParcela.get(id) ? { ajusteValuacion: ajPorParcela.get(id) } : {}) };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  // GASTOS GENERALES: lo que el rancho gastó y no es de ninguna parcela ni de un vehículo (lo del vehículo ya
  // viene en los indirectos). No se reparten a parcelas: se enseñan aparte. Las compras de insumos para el
  // almacén NO son gasto todavía —se vuelven costo cuando se usan—, así que van aparte y fuera del total.
  const sueltos = egresos.filter(e => enMes(e.fecha) && !e.parcelaId && !e.vehiculoId);
  const porCat = new Map();
  // Un gasto de «insumos» sin parcela puede ser inventario, producción directa, uso general u otra cosa; y si nadie lo ha dicho, está por clasificar.
  const claseDe = (e) => claseDeInsumo(e);
  const insumosDirectos = sueltos.filter(e => claseDe(e) === "produccion"), insumosSinClase = sueltos.filter(e => claseDe(e) === "por_clasificar");
  for (const e of sueltos.filter(e => !["inventario", "produccion", "por_clasificar"].includes(claseDe(e))).map(e => (claseDe(e) === "general" ? { ...e, categoria: "insumos_general" } : claseDe(e) === "otro" ? { ...e, categoria: "otro" } : e))) { const k = e.categoria || "otro"; const x = porCat.get(k) || { categoria: k, monto: 0, n: 0 }; x.monto = sumarDinero(x.monto, Number(e.monto) || 0); x.n++; porCat.set(k, x); }
  // ACTIVIDADES SIN PARCELA. Antes no entraban al cierre (sólo se sumaba lo que traía parcela) y el total del rancho
  // salía corto. El trabajo de BODEGA de un cultivo es costo directo de producción de ese cultivo (no de una parcela);
  // el trabajo GENERAL de bodega es gasto general; y lo demás sin parcela queda a la vista, sin repartir.
  const porCultivo = new Map(); let sueltas = 0, nSueltas = 0;
  for (const a of actividades) {
    if (!enMes(a.fecha) || a.parcelaId) continue;
    const m = Number(a.costoTotal) || 0; if (!m) continue;
    if (a.esBodega && a.cultivoBodega === "__general__") { const x = porCat.get("bodega_general") || { categoria: "bodega_general", monto: 0, n: 0 }; x.monto = sumarDinero(x.monto, m); x.n++; porCat.set("bodega_general", x); }
    else if (a.esBodega && a.cultivoBodega) { const x = porCultivo.get(a.cultivoBodega) || { cultivo: a.cultivoBodega, monto: 0, n: 0 }; x.monto = sumarDinero(x.monto, m); x.n++; porCultivo.set(a.cultivoBodega, x); }
    else { sueltas = sumarDinero(sueltas, m); nSueltas++; }
  }
  // COMPRAS DEL PERSONAL ya aprobadas y sin parcela. Lo que es mercancía del almacén NO es gasto del mes (se vuelve costo
  // al usarse); lo que no lo es (un flete, una refacción puesta directo) es gasto general; y mientras la mercancía no esté
  // recibida y valuada no se sabe cuánto es de cada cosa: queda «por valuar», ni gasto ni cero.
  let comprasAlmacen = 0, comprasPorValuar = 0;
  const gen = (k, m) => { if (!m) return; const x = porCat.get(k) || { categoria: k, monto: 0, n: 0 }; x.monto = sumarDinero(x.monto, m); x.n++; porCat.set(k, x); };
  for (const c of compras) {
    if (c.estado !== "aprobada" || !enMes(c.fecha) || c.parcelaId) continue;
    const e = estadoDeCompra(c, recibidas);
    gen("compras_personal", e.gasto || 0); comprasAlmacen = sumarDinero(comprasAlmacen, e.inventario); comprasPorValuar = sumarDinero(comprasPorValuar, e.porValuar);
  }
  // Del almacén, lo que no fue a una parcela ni a un vehículo: uso general, mermas y faltantes, y ajustes de valuación sin parcela.
  gen("almacen_uso_general", sumarDinero(consumosGenerales.filter(c => enMes(c.fecha)).map(c => Number(c.costo) || 0)));
  gen("almacen_mermas", sumarDinero(mermas.filter(m => enMes(m.fecha)).map(m => Number(m.valor) || 0)));
  gen("almacen_ajustes", ajOtros);
  const bodega = { porCultivo: [...porCultivo.values()].sort((a, b) => a.cultivo.localeCompare(b.cultivo)), total: sumarDinero([...porCultivo.values()].map(x => x.monto)) };
  const mDirectos = sumarDinero(insumosDirectos.map(e => Number(e.monto) || 0));
  const sinParcela = { total: sumarDinero(sueltas, mDirectos), n: nSueltas + insumosDirectos.length, insumosDirectos: mDirectos };
  const porClasificar = { monto: sumarDinero(insumosSinClase.map(e => Number(e.monto) || 0)), n: insumosSinClase.length };
  // También es gasto general lo que una fuente de indirectos clasificó así (hoy: prima de antigüedad e indemnizaciones de una baja).
  const todoFuera = (indirectos?.noProduccion || []).flatMap(x => x.detalle || []).filter(p => enMes(p.fecha));
  for (const p of todoFuera.filter(p => p.general)) { const k = p.categoria || "laboral"; const x = porCat.get(k) || { categoria: k, monto: 0, n: 0 }; x.monto = sumarDinero(x.monto, p.monto); x.n++; porCat.set(k, x); }
  const generales = { porCategoria: [...porCat.values()].sort((a, b) => b.monto - a.monto), total: sumarDinero([...porCat.values()].map(x => x.monto)) };
  const paraAlmacen = sumarDinero(comprasAlmacen, sueltos.filter(e => claseDe(e) === "inventario").map(e => Number(e.monto) || 0).reduce((a, b) => sumarDinero(a, b), 0));
  const pend = (indirectos?.pendientes || []).filter(p => enMes(p.fecha));
  const fuera = todoFuera.filter(p => !p.general);
  const k = { mes, renglones, directo: sumarDinero(renglones.map(r => r.directo)), indirecto: sumarDinero(renglones.map(r => r.indirecto)), completo: sumarDinero(renglones.map(r => r.completo)),
    pendiente: sumarDinero(pend.map(p => p.monto)), pendientes: pend.length, noProduccion: sumarDinero(fuera.map(p => p.monto)), generales, paraAlmacen, porValuar: comprasPorValuar, ajustesValuacion: sumarDinero([...ajPorParcela.values()]), maquinaria, bodega, sinParcela, porClasificar };
  // Lo que costó mantener funcionando TODO el rancho ese mes. Cada peso está en un solo renglón.
  return { ...k, rancho: sumarDinero(k.completo, bodega.total, sinParcela.total, k.pendiente, k.noProduccion, generales.total) };
}

const deEseMes = (eventos, tipo, mes) => vigentes(eventos).filter(e => e.tipo === tipo && e.datos.mes === mes).sort((a, b) => a.cuando.localeCompare(b.cuando));
export function estadoDeMes(eventos, mes) {
  const cierres = deEseMes(eventos, T_CIERRE_MES, mes).map((e, i) => ({ ...e, version: i + 1 })), reaperturas = deEseMes(eventos, T_REAPERTURA_MES, mes);
  const ultimo = cierres[cierres.length - 1] || null, reap = reaperturas[reaperturas.length - 1] || null;
  return { estado: !ultimo ? "abierto" : reap && reap.cuando > ultimo.cuando ? "reabierto" : "cerrado", cierre: ultimo, cierres, reaperturas };
}
export const mesesCerrados = (eventos) => [...new Set(vigentes(eventos).filter(e => e.tipo === T_CIERRE_MES).map(e => e.datos.mes))].sort();

// `costo`: lo que devuelve `costoDelMes` en ese momento. `hoy`: no se cierra un mes que todavía no termina.
// `conciliacion`: el resumen de `conciliarMes` (obligaciones con el personal). Se guarda en la foto; si no cuadra, se avisa (no bloquea: se cierra sabiendo).
export function cerrarMes({ permitido, eventos, costo, hoy, motivo = "", conciliacion = null, quien, cuando, fecha, azar }) {
  { const no = negado(quien, permitido, "El mes lo cierra un administrador."); if (no) return { ok: false, dice: no }; }
  if (!esMes(costo?.mes)) return { ok: false, dice: "Falta el mes." };
  if (hoy <= finDe(costo.mes)) return { ok: false, dice: "Ese mes todavía no termina." };
  const s = estadoDeMes(eventos, costo.mes);
  if (s.estado === "cerrado") return { ok: false, dice: "Ese mes ya está cerrado. Para cambiarlo hay que reabrirlo y decir por qué." };
  if (s.estado === "reabierto" && !limpio(motivo)) return { ok: false, dice: "Es un cierre nuevo de un mes reabierto: hay que decir qué cambió." };
  const avisos = costo.pendiente !== 0 ? [`Se cerró con ${costo.pendientes} importe(s) pendientes de distribuir. Quedan anotados; cuando se distribuyan saldrán como ajuste posterior.`] : [];
  if (conciliacion && conciliacion.cuadra === false) avisos.push("Se cerró con una diferencia entre la conciliación del personal y los costos del mes. Quedó anotada en el cierre: hay que revisarla.");
  if (conciliacion?.problemas?.length) avisos.push(`La conciliación del personal dejó ${conciliacion.problemas.length} punto(s) por revisar. Están en la tarjeta de conciliación.`);
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T_CIERRE_MES, cuando, fecha, quien, azar, origen: s.cierre?.id || null, relacion: s.cierre ? "sustituye" : null,
    datos: { mes: costo.mes, motivo: limpio(motivo), renglones: costo.renglones.map(r => ({ parcelaId: r.parcelaId, nombre: r.nombre, directo: r.directo, indirecto: r.indirecto, completo: r.completo })),
      directo: costo.directo, indirecto: costo.indirecto, completo: costo.completo, pendiente: costo.pendiente, noProduccion: costo.noProduccion,
      generales: costo.generales, paraAlmacen: costo.paraAlmacen, porValuar: costo.porValuar || 0, porClasificar: costo.porClasificar?.monto || 0, ajustesValuacion: costo.ajustesValuacion || 0,
      ...(costo.maquinaria ? { maquinaria: { aplicado: costo.maquinaria.aplicado, real: costo.maquinaria.real, diferencia: costo.maquinaria.diferencia, sinConciliar: costo.maquinaria.sinConciliar, filas: costo.maquinaria.filas.map(f => ({ vehiculoId: f.vehiculoId, nombre: f.nombre, aplicado: f.aplicado, real: f.real, diferencia: f.diferencia, tratamiento: f.tratamiento, sinReal: f.sinReal })) } } : {}),
      bodega: costo.bodega, sinParcela: costo.sinParcela, rancho: costo.rancho,
      ...(conciliacion ? { personal: { alCosto: conciliacion.alCosto, generado: conciliacion.generado, ajustes: conciliacion.ajustes, nuevo: conciliacion.nuevo, pagado: conciliacion.pagado, porPagar: conciliacion.porPagar, cuadra: conciliacion.cuadra, porRevisar: (conciliacion.problemas || []).map(p => p.dice) } } : {}) } }) };
}
export function reabrirMes({ permitido, eventos, mes, motivo, quien, cuando, fecha, azar }) {
  { const no = negado(quien, permitido, "El mes lo reabre un administrador."); if (no) return { ok: false, dice: no }; }
  const s = estadoDeMes(eventos, mes);
  if (s.estado !== "cerrado") return { ok: false, dice: "Ese mes no está cerrado." };
  if (!limpio(motivo)) return { ok: false, dice: "Para reabrir hay que decir por qué." };
  return { ok: true, evento: nuevoEvento({ tipo: T_REAPERTURA_MES, cuando, fecha, quien, azar, origen: s.cierre.id, relacion: "reabre", datos: { mes, motivo: limpio(motivo) } }) };
}

// Los ajustes posteriores: lo que cambió desde la foto. La foto no se toca.
export function ajustesPosteriores(cierre, costoHoy) {
  if (!cierre) return { hay: false, lista: [], total: 0, pendiente: 0, generales: 0, bodega: 0, rancho: 0 };
  const antes = new Map(cierre.datos.renglones.map(r => [r.parcelaId, r])), hoy = new Map((costoHoy?.renglones || []).map(r => [r.parcelaId, r])), lista = [];
  for (const id of new Set([...antes.keys(), ...hoy.keys()])) {
    const a = antes.get(id), h = hoy.get(id);
    const d = { parcelaId: id, nombre: (h || a).nombre, directo: sumarDinero(h?.directo || 0, -(a?.directo || 0)), indirecto: sumarDinero(h?.indirecto || 0, -(a?.indirecto || 0)), era: a?.completo || 0, es: h?.completo || 0 };
    if (Math.abs(d.directo) > 0.004 || Math.abs(d.indirecto) > 0.004) lista.push({ ...d, diferencia: sumarDinero(d.es, -d.era) });
  }
  const bodega = sumarDinero(costoHoy?.bodega?.total || 0, costoHoy?.sinParcela?.total || 0, -(cierre.datos.bodega?.total || 0), -(cierre.datos.sinParcela?.total || 0));
  const pendiente = sumarDinero(costoHoy?.pendiente || 0, -(cierre.datos.pendiente || 0)), generales = sumarDinero(costoHoy?.generales?.total || 0, -(cierre.datos.generales?.total || 0));
  return { hay: lista.length > 0 || Math.abs(pendiente) > 0.004 || Math.abs(generales) > 0.004 || Math.abs(bodega) > 0.004, lista, total: sumarDinero(lista.map(l => l.diferencia)), pendiente, generales, bodega,
    rancho: sumarDinero(costoHoy?.rancho || 0, -(cierre.datos.rancho ?? cierre.datos.completo ?? 0)) };
}
