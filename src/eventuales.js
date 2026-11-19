// ════════════════════════════════════════════════════════════════════════
//  CUADRILLAS — los grupos eventuales que llegan juntos
//
//  No son los trabajadores de planta. Una cuadrilla llega con su responsable,
//  trabaja un día en una parcela haciendo algo, y cobra por persona y día o por
//  destajo. No checan con credencial: el encargado registra quiénes vinieron.
//
//    cuadrilla_dia       quiénes vinieron, a qué parcela, a hacer qué, y cómo cobran
//    traslado_cuadrilla  cómo llegaron: camión propio, flete externo, o no se registró
//
//  Reglas que no se rompen:
//  · En destajo, a cada persona le toca lo que ELLA hizo. Parejo sólo cuando
//    nada más se sabe el total del grupo, y alguien lo autoriza con su nombre.
//  · El camión propio NO lleva importe: su costo real (combustible,
//    mantenimiento, operador) vive en los gastos del vehículo. Ponerle aquí un
//    "flete" lo duplicaría, o lo inventaría.
//  · El flete externo se reparte con un criterio que se puede cambiar y que
//    queda escrito en cada importe. Si ese día no hay trabajo registrado de esa
//    cuadrilla, el flete NO se reparte: queda pendiente, con su nombre.
// ════════════════════════════════════════════════════════════════════════
import { nuevoEvento, vigentes, reglasDe } from "./eventos.js";
import { repartirDinero, multiplicarDinero, sumarDinero } from "./calculos.js";

export const TIPO_CUADRILLA_DIA = "cuadrilla_dia";
export const TIPO_TRASLADO = "traslado_cuadrilla";
const PUEDE = ["admin", "encargado"];
const limpio = (t) => String(t || "").trim().replace(/\s+/g, " ");
const mismo = (a, b) => limpio(a).toLowerCase() === limpio(b).toLowerCase();

export const CRITERIOS_FLETE = {
  personas: "Entre las personas transportadas",
  pagado: "En proporción a lo que cobró cada grupo",
  parejo: "Parejo entre las parcelas donde trabajaron",
};

// Registrar el día de una cuadrilla en UNA parcela y UNA actividad.
export function registrarCuadrilla({ cuadrillaId, cuadrilla, responsable = "", parcelaId, actividad, modalidad, integrantes, destajo, fecha, cuando, quien, capturado, azar }) {
  if (!PUEDE.includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador registra una cuadrilla." };
  if (!limpio(cuadrilla)) return { ok: false, dice: "Falta decir qué cuadrilla es." };
  if (!parcelaId) return { ok: false, dice: "Falta la parcela." };
  if (!limpio(actividad)) return { ok: false, dice: "Falta qué hicieron." };
  const base = { cuadrillaId: cuadrillaId || `sin-catalogo:${limpio(cuadrilla).toLowerCase()}`, cuadrilla: limpio(cuadrilla), responsable: limpio(responsable), parcelaId, actividad: limpio(actividad) };
  const sinRepetidos = (nombres) => new Set(nombres.map(n => n.toLowerCase())).size === nombres.length;
  if (modalidad === "dia") {
    const gente = (integrantes || []).map(i => ({ nombre: limpio(i.nombre), pagoDia: Number(i.pagoDia) })).filter(i => i.nombre);
    if (gente.length === 0) return { ok: false, dice: "Falta decir quiénes vinieron." };
    if (!sinRepetidos(gente.map(g => g.nombre))) return { ok: false, dice: "Una persona aparece dos veces." };
    const sinPago = gente.filter(g => !(g.pagoDia > 0));
    if (sinPago.length) return { ok: false, dice: `Falta cuánto cobra por día: ${sinPago.map(g => g.nombre).join(", ")}.` };
    return { ok: true, evento: nuevoEvento({ tipo: TIPO_CUADRILLA_DIA, cuando, fecha, capturado, quien, azar, datos: { ...base, modalidad: "dia", integrantes: gente } }) };
  }
  if (modalidad === "destajo") {
    const d = destajo || {}; const tarifa = Number(d.tarifa);
    if (!(tarifa > 0)) return { ok: false, dice: "Falta a cómo se paga cada unidad." };
    const comun = { unidad: limpio(d.unidad) || "unidad", tarifa };
    const porPersona = (d.produccion || []).map(r => ({ nombre: limpio(r.nombre), cantidad: Number(r.cantidad) })).filter(r => r.nombre);
    if (porPersona.some(r => r.cantidad > 0)) {
      if (!sinRepetidos(porPersona.map(r => r.nombre))) return { ok: false, dice: "Una persona aparece dos veces." };
      const sinCantidad = porPersona.filter(r => !(r.cantidad > 0));
      if (sinCantidad.length) return { ok: false, dice: `Falta cuánto hizo: ${sinCantidad.map(r => r.nombre).join(", ")}. Si vino y no hizo nada a destajo, quítalo de la lista.` };
      return { ok: true, evento: nuevoEvento({ tipo: TIPO_CUADRILLA_DIA, cuando, fecha, capturado, quien, azar, datos: { ...base, modalidad: "destajo", destajo: { ...comun, produccion: porPersona } } }) };
    }
    const nombres = porPersona.map(r => r.nombre); const total = Number(d.total);
    if (nombres.length === 0) return { ok: false, dice: "Falta decir quiénes vinieron." };
    if (!sinRepetidos(nombres)) return { ok: false, dice: "Una persona aparece dos veces." };
    if (!(total > 0)) return { ok: false, dice: "Falta cuánto hizo cada quien, o el total del grupo." };
    if (nombres.length > 1 && !limpio(d.autorizoParejo)) return { ok: false, dice: "Sólo se tiene el total del grupo. Repartirlo parejo necesita que alguien lo autorice." };
    return { ok: true, evento: nuevoEvento({ tipo: TIPO_CUADRILLA_DIA, cuando, fecha, capturado, quien, azar,
      datos: { ...base, modalidad: "destajo", destajo: { ...comun, total, nombres, parejo: nombres.length > 1, autorizoParejo: nombres.length > 1 ? limpio(d.autorizoParejo) : "" } } }) };
  }
  return { ok: false, dice: "Falta decir si cobran por día o por destajo." };
}

// Cómo llegaron. Una vez por cuadrilla y viaje.
export function registrarTraslado({ cuadrillaId, cuadrilla, tipo, vehiculoId = null, vehiculo = "", monto, personas, fecha, cuando, quien, capturado, azar }) {
  if (!PUEDE.includes(quien?.rol)) return { ok: false, dice: "Sólo un encargado o un administrador registra el transporte." };
  if (!["propio", "flete", "ninguno"].includes(tipo)) return { ok: false, dice: "Falta decir cómo llegaron." };
  const base = { cuadrillaId: cuadrillaId || `sin-catalogo:${limpio(cuadrilla).toLowerCase()}`, cuadrilla: limpio(cuadrilla), tipo, personas: Number(personas) > 0 ? Number(personas) : null };
  if (tipo === "propio") {
    if (!vehiculoId) return { ok: false, dice: "Falta decir en qué vehículo se trajeron." };
    return { ok: true, evento: nuevoEvento({ tipo: TIPO_TRASLADO, cuando, fecha, capturado, quien, azar, datos: { ...base, vehiculoId, vehiculo: limpio(vehiculo) } }) };
  }
  if (tipo === "flete") {
    if (!(Number(monto) > 0)) return { ok: false, dice: "Falta cuánto se pagó de flete." };
    return { ok: true, evento: nuevoEvento({ tipo: TIPO_TRASLADO, cuando, fecha, capturado, quien, azar, datos: { ...base, monto: Number(monto) } }) };
  }
  return { ok: true, evento: nuevoEvento({ tipo: TIPO_TRASLADO, cuando, fecha, capturado, quien, azar, datos: base }) };
}

// Lo que le toca a cada integrante de un registro: [{ persona, monto, unidades, parejo }].
export function pagosDe(e) {
  const d = e.datos;
  if (d.modalidad === "dia") return d.integrantes.map(i => ({ persona: i.nombre, monto: i.pagoDia, unidades: null, parejo: false }));
  const t = d.destajo;
  if (Array.isArray(t.produccion)) return t.produccion.map(r => ({ persona: r.nombre, monto: multiplicarDinero(t.tarifa, r.cantidad), unidades: r.cantidad, parejo: false }));
  const montos = repartirDinero(multiplicarDinero(t.tarifa, t.total), t.nombres.map(() => 1));
  return t.nombres.map((n, i) => ({ persona: n, monto: montos[i], unidades: t.total / t.nombres.length, parejo: t.nombres.length > 1 }));
}
export const personasDe = (e) => (e.datos.modalidad === "dia" ? e.datos.integrantes.length : (e.datos.destajo.produccion || e.datos.destajo.nombres).length);

// El costo de las cuadrillas en un periodo: lo que cobró cada persona (directo,
// a su parcela y actividad) y el flete externo repartido (indirecto, con su criterio).
export function costoDeCuadrillas(eventos, { desde, hasta, criterioFlete = "personas" } = {}) {
  const enRango = (e) => (!desde || e.fecha >= desde) && (!hasta || e.fecha <= hasta);
  const dias = vigentes(eventos).filter(e => e.tipo === TIPO_CUADRILLA_DIA && enRango(e));
  const traslados = vigentes(eventos).filter(e => e.tipo === TIPO_TRASLADO && enRango(e));
  const partes = []; const pendientes = []; const propios = [];
  for (const e of dias) {
    for (const p of pagosDe(e)) partes.push({ clase: "pago", cuadrillaId: e.datos.cuadrillaId, cuadrilla: e.datos.cuadrilla, persona: p.persona, fecha: e.fecha,
      parcelaId: e.datos.parcelaId, actividad: e.datos.actividad, modalidad: e.datos.modalidad, unidades: p.unidades, unidad: e.datos.destajo?.unidad || null,
      monto: p.monto, parejo: p.parejo, evs: [e.id] });
  }
  for (const t of traslados) {
    if (t.datos.tipo === "ninguno") continue;
    const suyos = dias.filter(d => d.datos.cuadrillaId === t.datos.cuadrillaId && d.fecha === t.fecha);
    if (t.datos.tipo === "propio") { propios.push({ fecha: t.fecha, cuadrilla: t.datos.cuadrilla, vehiculoId: t.datos.vehiculoId, vehiculo: t.datos.vehiculo, personas: t.datos.personas, evs: [t.id] }); continue; }
    if (suyos.length === 0) { pendientes.push({ fecha: t.fecha, cuadrilla: t.datos.cuadrilla, monto: t.datos.monto, ev: t.id, dice: "Hay un flete pagado y ese día no hay trabajo registrado de esa cuadrilla: no se reparte hasta saber a qué se le carga." }); continue; }
    const pesos = suyos.map(d => (criterioFlete === "pagado" ? sumarDinero(pagosDe(d).map(p => p.monto)) : criterioFlete === "parejo" ? 1 : personasDe(d)));
    const montos = repartirDinero(t.datos.monto, pesos);
    suyos.forEach((d, i) => partes.push({ clase: "flete", cuadrillaId: t.datos.cuadrillaId, cuadrilla: t.datos.cuadrilla, persona: null, fecha: t.fecha,
      parcelaId: d.datos.parcelaId, actividad: d.datos.actividad, modalidad: "flete", unidades: null, monto: montos[i], criterio: criterioFlete, evs: [t.id, d.id] }));
  }
  const pagos = partes.filter(p => p.clase === "pago"), fletes = partes.filter(p => p.clase === "flete");
  return {
    partes, pendientes, propios,
    totalPagos: sumarDinero(pagos.map(p => p.monto)), totalFlete: sumarDinero(fletes.map(p => p.monto)),
    fletePendiente: sumarDinero(pendientes.map(p => p.monto)),
    total: sumarDinero(partes.map(p => p.monto)),
  };
}

// Para los reportes de costo que ya existían: un renglón por registro de cuadrilla.
export function actividadesDeCuadrillas(partes) {
  const porEvento = new Map();
  for (const p of partes) {
    const ev = p.clase === "pago" ? p.evs[0] : p.evs[1];
    if (!porEvento.has(ev)) porEvento.set(ev, { id: `cq:${ev}`, _deEventos: [], fecha: p.fecha, parcelaId: p.parcelaId, tipo: p.actividad, registradoPor: { tipo: "cuadrilla", id: p.cuadrillaId, nombre: p.cuadrilla },
      insumos: [], costoInsumos: 0, costoMaq: 0, costoMO: 0, flete: 0, costoTotal: 0, cuadrilla_personas: 0, modalidadPago: null });
    const r = porEvento.get(ev);
    for (const id of p.evs) if (!r._deEventos.includes(id)) r._deEventos.push(id);
    if (p.clase === "pago") { r.costoMO = sumarDinero(r.costoMO, p.monto); r.cuadrilla_personas += 1; r.modalidadPago = p.modalidad === "dia" ? "jornal" : "destajo"; }
    else r.flete = sumarDinero(r.flete, p.monto);
    r.costoTotal = sumarDinero(r.costoMO, r.flete);
  }
  return [...porEvento.values()];
}

// Los que vinieron la última vez con esa cuadrilla, y cuánto cobraron: para no teclearlos otra vez.
export function integrantesConocidos(eventos, cuadrillaId) {
  const ultimo = vigentes(eventos).filter(e => e.tipo === TIPO_CUADRILLA_DIA && e.datos.cuadrillaId === cuadrillaId).sort((a, b) => a.cuando.localeCompare(b.cuando));
  const pago = new Map();
  for (const e of ultimo) for (const i of e.datos.integrantes || []) pago.set(i.nombre, i.pagoDia);
  const ult = ultimo[ultimo.length - 1];
  if (!ult) return [];
  const nombres = ult.datos.modalidad === "dia" ? ult.datos.integrantes.map(i => i.nombre) : (ult.datos.destajo.produccion?.map(r => r.nombre) || ult.datos.destajo.nombres);
  return nombres.map(n => ({ nombre: n, pagoDia: pago.get(n) ?? null }));
}
export const yaTieneTraslado = (eventos, cuadrillaId, fecha) => vigentes(eventos).some(e => e.tipo === TIPO_TRASLADO && e.datos.cuadrillaId === cuadrillaId && e.fecha === fecha);
export { mismo as mismoNombre };

reglasDe(TIPO_CUADRILLA_DIA, (e) => pagosDe(e).map(p => ({ clase: "pago_cuadrilla", persona: p.persona, parcelaId: e.datos.parcelaId, actividad: e.datos.actividad, monto: p.monto })));
reglasDe(TIPO_TRASLADO, (e) => (e.datos.tipo === "flete" ? [{ clase: "flete_por_repartir", cuadrillaId: e.datos.cuadrillaId, monto: e.datos.monto }] : e.datos.tipo === "propio" ? [{ clase: "uso_de_vehiculo", vehiculoId: e.datos.vehiculoId, cuadrillaId: e.datos.cuadrillaId }] : []));
