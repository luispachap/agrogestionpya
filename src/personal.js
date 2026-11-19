// ════════════════════════════════════════════════════════════════════════
//  PERSONAL: LO QUE SE PAGA Y NO ES UNA ACTIVIDAD EN UNA PARCELA
//
//  Un permiso pagado, un descanso, una espera por instrucciones, el día de un
//  encargado que no registró actividad: se pagan, así que son costo, pero NO
//  son trabajo hecho en una parcela. Aquí nacen como costo INDIRECTO de
//  personal, cada uno con su causa, y de aquí salen también las prestaciones.
//
//  Qué se hace con cada concepto es una política del rancho (AJUSTES `ind_*`):
//    actividades   se reparte en proporción al costo de las actividades de ESA
//                  persona en ESE mes. Sin actividades con qué medir → pendiente.
//    pendiente     se queda por distribuir hasta que alguien decida.
//    fuera         no corresponde a producción: se dice cuánto es y no se reparte.
//  No todos los conceptos llevan el mismo trato, y ninguno se fuerza.
//  El tiempo «por aclarar» nunca se reparte solo: sigue siendo una pregunta.
// ════════════════════════════════════════════════════════════════════════
import { sumarDinero, repartirDinero, sueldoVigente, sumarDias } from "./calculos.js";
import { leToca, porCalendario } from "./pagos.js";

export const CONCEPTOS_PERSONAL = {
  permiso: "Permiso pagado", descanso: "Descanso pagado", justificada: "Ausencia justificada que se paga",
  espera: "Espera por instrucciones", traslado: "Traslado", mantenimiento: "Mantenimiento o limpieza general",
  inactividad: "Inactividad confirmada", otra: "Otra causa", encargado: "Día de un encargado sin actividad registrada",
  por_aclarar: "Tiempo por aclarar",
};
export const POLITICAS = {
  actividades: "Repartir según el costo de las actividades de esa persona en el mes",
  pendiente: "Dejarlo pendiente de distribuir",
  fuera: "No es de producción: no se reparte",
};
// De la causa que se dio al aclarar el tiempo, al concepto.
const DE_CAUSA = { espera: "espera", traslado: "traslado", mantenimiento: "mantenimiento", descanso_autorizado: "descanso", inactividad: "inactividad", otra: "otra" };

// Con qué se mide: lo que costó cada persona en cada parcela, mes por mes.
//   partes        la mano de obra del checador (las que tienen parcela)
//   actividades   lo tecleado a mano que sí cuenta su mano de obra
export function baseDePersonas({ partes = [], actividades = [] }) {
  const m = new Map();
  const pon = (id, fecha, parcelaId, monto) => {
    if (!id || !parcelaId || !(monto > 0)) return;
    const k = `${id}|${fecha.slice(0, 7)}`; if (!m.has(k)) m.set(k, new Map());
    m.get(k).set(parcelaId, sumarDinero(m.get(k).get(parcelaId) || 0, monto));
  };
  for (const p of partes) pon(p.trabajadorId, p.fecha, p.parcelaId, p.monto);
  for (const a of actividades) if (!a._deEventos && a.registradoPor?.id && a.fecha) pon(a.registradoPor.id, a.fecha, a.parcelaId, Number(a.costoMO) || 0);
  return m;
}

// Los días (o ratos) pagados que no están en ninguna parcela.
//   personas     trabajadores y encargados (éstos con `_tipo: "encargado"`)
//   partes       mano de obra del checador, completa (con y sin parcela)
//   ausencias    eventos `ausencia` vigentes
export function pagadoSinActividad({ personas = [], partes = [], actividades = [], ausencias = [], hoy }) {
  const items = [], sinSueldo = [];
  const porId = new Map(personas.map(p => [p.id, p]));
  const conTrabajo = new Set(partes.map(p => `${p.trabajadorId}|${p.fecha}`));
  for (const a of actividades) if (!a._deEventos && a.registradoPor?.id && (Number(a.costoMO) || 0) > 0) conTrabajo.add(`${a.registradoPor.id}|${a.fecha}`);
  const conAusencia = new Set();
  for (const e of ausencias) {
    const k = `${e.datos.trabajadorId}|${e.fecha}`; conAusencia.add(k);
    // Vacaciones: se pagan en su semana, pero su costo ya se fue generando como prestación. Aquí no entran.
    if (!e.datos.paga || e.datos.clase === "vacaciones" || conTrabajo.has(k)) continue;
    const p = porId.get(e.datos.trabajadorId); if (!p) continue;
    const v = sueldoVigente(p, e.fecha);
    if (!(v.sueldo > 0)) { sinSueldo.push({ personaId: p.id, nombre: p.nombre, fecha: e.fecha }); continue; }
    items.push({ personaId: p.id, nombre: p.nombre, fecha: e.fecha, concepto: e.datos.clase, causa: e.datos.causa || "", monto: v.sueldo, estimado: v.estimado === true, evs: [e.id] });
  }
  for (const x of partes) {
    if (x.parcelaId || x.vehiculoId || !(x.monto > 0)) continue;
    const p = porId.get(x.trabajadorId);
    items.push({ personaId: x.trabajadorId, nombre: p?.nombre || "", fecha: x.fecha, concepto: x.causa ? DE_CAUSA[x.causa] || "otra" : "por_aclarar", causa: x.nota || (x.sinHoras ? "checó entrada y no se sabe cuánto tiempo estuvo" : ""), monto: x.monto, estimado: !!x.estimado, evs: x.evs || [], minutos: x.minutos ?? null });
  }
  // Encargados con asistencia por calendario: su día se paga aunque no haya actividad registrada.
  for (const e of personas) {
    if (e._tipo !== "encargado" || !(e.calendario || []).length) continue;
    const primero = e.calendario.map(p => p.desde).filter(Boolean).sort()[0];
    for (let f = primero, n = 0; f && f <= hoy && n < 1500; f = sumarDias(f, 1), n++) {
      const k = `${e.id}|${f}`;
      if (!porCalendario(e, f) || !leToca(e, f) || conTrabajo.has(k) || conAusencia.has(k)) continue;
      const v = sueldoVigente(e, f);
      if (!(v.sueldo > 0)) { sinSueldo.push({ personaId: e.id, nombre: e.nombre, fecha: f }); continue; }
      items.push({ personaId: e.id, nombre: e.nombre, fecha: f, concepto: "encargado", causa: "", monto: v.sueldo, estimado: v.estimado === true, evs: [] });
    }
  }
  return { items, sinSueldo };
}

// Reparte UN importe entre las parcelas donde esa persona trabajó ese mes.
// Si no hay con qué medir, no reparte: dice por qué.
export function repartirPorActividades(item, base) {
  const b = base.get(`${item.personaId}|${item.fecha.slice(0, 7)}`);
  const total = b ? sumarDinero([...b.values()]) : 0;
  if (!(total > 0)) return { partes: [], porque: `${item.nombre || "Esa persona"} no tiene actividades en parcelas en ${item.fecha.slice(0, 7)} con qué medir el reparto.` };
  const ids = [...b.keys()], signo = item.monto < 0 ? -1 : 1;
  const montos = repartirDinero(Math.abs(item.monto), ids.map(id => b.get(id)));
  return { porque: "", partes: ids.map((parcelaId, i) => ({ parcelaId, fecha: item.fecha, monto: signo * montos[i], personaId: item.personaId, concepto: item.concepto, evs: item.evs || [], estimado: !!item.estimado,
    base: `en proporción al costo de sus actividades de ${item.fecha.slice(0, 7)}: ${b.get(parcelaId)} de ${total}`, explica: item.explica })).filter(p => p.monto !== 0) };
}

// Arma una fuente de indirectos con la política de cada concepto.
//   politica(concepto) → "actividades" | "pendiente" | "fuera"
function armar({ fuente, nombre, items, base, politica, texto }) {
  const partes = [], pendientes = [], detalle = []; let fuera = 0;
  for (const it of items) {
    const item = { ...it, explica: texto(it) };
    const pol = it.concepto === "por_aclarar" ? "pendiente" : politica(it.concepto);
    if (pol === "fuera") { fuera = sumarDinero(fuera, it.monto); detalle.push({ mes: it.fecha.slice(0, 7), fecha: it.fecha, persona: it.nombre, concepto: it.concepto, monto: it.monto, que: item.explica }); continue; }
    const r = pol === "actividades" ? repartirPorActividades(item, base) : { partes: [], porque: it.concepto === "por_aclarar" ? "Falta aclarar qué hizo en ese tiempo. Mientras no se aclare, no se reparte." : "La regla del rancho para este concepto es dejarlo pendiente." };
    if (r.partes.length) partes.push(...r.partes);
    else pendientes.push({ fecha: it.fecha, mes: it.fecha.slice(0, 7), monto: it.monto, personaId: it.personaId, persona: it.nombre, concepto: it.concepto, porque: r.porque, que: item.explica, evs: it.evs || [] });
  }
  return { fuente, nombre, partes, pendientes, noProduccion: fuera, detalleNoProduccion: detalle };
}
export const fuentePersonal = ({ items, base, politica }) => armar({ fuente: "personal", nombre: "Personal: pagado sin actividad en parcela", items, base, politica,
  texto: (it) => `${it.nombre || "Alguien"} · ${CONCEPTOS_PERSONAL[it.concepto] || it.concepto} del ${it.fecha}${it.causa ? ` (${it.causa})` : ""}` });
// `renglones`: los de `renglonesAlCosto` de prestaciones.js. Todos llevan la misma política (`ind_prestaciones`).
export const fuentePrestaciones = ({ renglones, base, politica }) => armar({ fuente: "prestaciones", nombre: "Prestaciones (aguinaldo, vacaciones y prima)", items: renglones, base, politica: () => politica,
  texto: (it) => `${it.nombre || "Alguien"} · ${it.que} · ${it.detalle}` });
