// LA JORNADA: un día de trabajo de punta a punta, en una sola vista.
//
// No guarda nada nuevo de lo que pasó: JUNTA lo que ya se registra en cada lugar —
//   · lo PLANEADO      (las tareas mandadas: `indicaciones`),
//   · quién VINO       (las marcas del checador),
//   · dónde se TRABAJÓ (las asignaciones reales de «Equipos de trabajo», cruzadas con las marcas),
//   · lo que se AVANZÓ (los avances registrados),
//   · lo que FALLÓ     (las incidencias del día),
// y dice, tarea por tarea, qué se sabe de ella y con qué se sabe.
//
// Reglas que no se rompen:
//   · Planear ≠ asistir ≠ trabajar. Aquí se COMPARAN; ninguno se da por hecho a partir de otro.
//   · «Hecha» sólo es lo que una persona marcó como hecha. Que haya horas en la parcela dice que se trabajó ahí,
//     no que la tarea se terminó.
//   · Lo que no se sabe se dice («no hay con qué saberlo»), no se rellena.
//   · Cerrar la jornada es una FOTO con su versión: quién la cerró, qué quedó sin hacer y por qué (el porqué lo
//     dice una persona, no la app), y qué pasa a mañana. Reabrir pide motivo y deja la foto anterior.
//   · Nada de aquí crea rayas, pagos ni costos: ningún módulo de dinero lee la jornada ni su cierre.
import { nuevoEvento, vigentes } from "./eventos.js";
import { jornadasDe } from "./checador.js";
import { tramosDeTrabajo } from "./cuadrillas.js";
import { avancesDe } from "./avances.js";
import { vigentesDelPlan, sinDiaRelativo } from "./asignaciones.js";

export const T_CIERRE = "cierre_jornada", T_REAPERTURA = "reapertura_jornada";
export const ROLES_QUE_CIERRAN = ["admin", "encargado"];
// Por qué no se hizo algo planeado. Lo escoge quien cierra; «otro» pide que lo escriba.
export const MOTIVOS = {
  no_vino: "La persona no vino", clima: "El clima no dejó", falta_insumo: "Faltó insumo, herramienta o agua", maquina: "Falló la máquina o el equipo",
  cambio_de_plan: "Se cambió el plan en el día", no_alcanzo: "No alcanzó el tiempo", ya_estaba: "Ya estaba hecho", otro: "Otro (se anota)",
};
export const ESTADOS = {
  hecha: { nombre: "Hecha", pide: false }, en_curso: { nombre: "En curso", pide: false }, se_trabajo: { nombre: "Se trabajó ahí", pide: false },
  en_otro_lado: { nombre: "Trabajó en otro lado", pide: true }, sin_asignar: { nombre: "Vino, sin trabajo registrado", pide: true },
  no_vino: { nombre: "No checó entrada", pide: true }, no_pudo: { nombre: "Dijo que no puede", pide: true }, sin_dato: { nombre: "No hay con qué saberlo", pide: true },
};
const nombreDe = (lista, id) => (lista || []).find(x => x.id === id)?.nombre || "";
const horas = (min) => (min == null ? "tiempo sin saber" : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`);

/* ── La jornada de un día ── */
export function jornadaDe({ fecha, indicaciones = [], eventos = [], incidencias = [], personas = [], parcelas = [], quienesChecan = [], hoy, ahora } = {}) {
  const checan = new Set((quienesChecan || []).map(p => p.id));
  const asistencia = new Map(jornadasDe(eventos, { fecha, hoy, ahora }).map(j => [j.trabajadorId, j]));
  const { tramos } = tramosDeTrabajo(eventos, { desde: fecha, hasta: fecha, hoy, ahora });
  const avances = avancesDe(eventos).filter(a => a.dia === fecha);
  const trabajoDe = (id) => {
    const m = new Map();
    for (const t of tramos) { if (t.trabajadorId !== id || !(t.parcelaId || t.vehiculoId)) continue; const k = `${t.parcelaId || ""}|${t.vehiculoId || ""}|${t.actividad || ""}`, x = m.get(k) || { parcelaId: t.parcelaId || null, vehiculoId: t.vehiculoId || null, donde: t.parcelaId ? nombreDe(parcelas, t.parcelaId) : t.vehiculo || "un vehículo", actividad: t.actividad || "", minutos: 0, sinSaber: false, corriendo: false };
      if (t.minutos == null) x.sinSaber = true; else x.minutos += t.minutos; if (t.corriendo) x.corriendo = true; m.set(k, x); }
    return [...m.values()];
  };
  const tareas = vigentesDelPlan(indicaciones, fecha).map(i => {
    const id = i.asignadoA || "", j = asistencia.get(id) || null, trabajo = id ? trabajoDe(id) : [];
    const ahi = i.parcelaId ? trabajo.filter(t => t.parcelaId === i.parcelaId) : [], deAhi = i.parcelaId ? avances.filter(a => a.parcelaId === i.parcelaId) : [];
    let estado, porque;
    if (i.respuesta === "hecha") { estado = "hecha"; porque = "Se marcó como hecha."; }
    else if (ahi.some(t => t.corriendo)) { estado = "en_curso"; porque = `Está trabajando ahí desde que se le asignó${ahi[0].actividad ? ` (${ahi[0].actividad})` : ""}.`; }
    else if (ahi.length) { estado = "se_trabajo"; porque = `Tiene ${horas(ahi.some(t => t.sinSaber) ? null : ahi.reduce((s, t) => s + t.minutos, 0))} registradas en ${nombreDe(parcelas, i.parcelaId) || "esa parcela"}. Nadie la ha marcado como terminada.`; }
    else if (i.respuesta === "no puede") { estado = "no_pudo"; porque = "La persona contestó que no puede."; }
    else if (trabajo.length) { estado = "en_otro_lado"; porque = `Su trabajo registrado está en ${[...new Set(trabajo.map(t => t.donde))].join(" y ")}${i.parcelaId ? ", no donde decía el plan" : ""}.`; }
    else if (j) { estado = "sin_asignar"; porque = "Checó entrada, pero no tiene trabajo registrado en ninguna parcela."; }
    else if (id && checan.has(id)) { estado = "no_vino"; porque = "No tiene entrada en el checador ese día."; }
    else { estado = "sin_dato"; porque = id ? "Esta persona no checa: no hay registro de si vino ni de dónde trabajó." : "La tarea no tiene persona."; }
    return { id: i.id, personaId: id, nombre: nombreDe(personas, id) || (id ? "Alguien que ya no está en el catálogo" : "Sin persona"), dice: sinDiaRelativo(i.resumen), parcelaId: i.parcelaId || "", donde: nombreDe(parcelas, i.parcelaId), hora: i.hora || "",
      vino: j ? true : id && checan.has(id) ? false : null, respuesta: i.respuesta || "", trabajo, avances: deAhi.map(a => a.evento), estado, porque, pideMotivo: ESTADOS[estado].pide };
  });
  // Lo que se trabajó sin estar en el plan: gente sin tarea, o en una parcela que el plan no decía.
  const planDe = new Map();
  for (const t of tareas) { if (!planDe.has(t.personaId)) planDe.set(t.personaId, new Set()); planDe.get(t.personaId).add(t.parcelaId); }
  const fueraDelPlan = [];
  for (const id of new Set(tramos.map(t => t.trabajadorId))) for (const w of trabajoDe(id)) {
    const suyas = planDe.get(id);
    if (!suyas || (w.parcelaId && !suyas.has(w.parcelaId) && !suyas.has(""))) fueraDelPlan.push({ personaId: id, nombre: nombreDe(personas, id) || "Alguien que ya no está en el catálogo", ...w, dice: `${w.actividad || "Trabajo"} en ${w.donde}: ${w.sinSaber ? "tiempo sin saber" : horas(w.minutos)}${w.corriendo ? " (sigue)" : ""}`, sinTarea: !suyas });
  }
  // Tiempo en el rancho sin asignar a nada: está «por aclarar» en Equipos de trabajo. Aquí sólo se cuenta.
  const porAclarar = new Map();
  for (const t of tramos) { if (t.parcelaId || t.vehiculoId || t.causa) continue; porAclarar.set(t.trabajadorId, (porAclarar.get(t.trabajadorId) || 0) + (t.minutos || 0)); }
  const delDia = (incidencias || []).filter(x => x && !x.cancelado && x.fecha === fecha);
  const n = (e) => tareas.filter(t => t.estado === e).length;
  return {
    fecha, tareas, fueraDelPlan,
    porAclarar: [...porAclarar.entries()].map(([id, min]) => ({ personaId: id, nombre: nombreDe(personas, id) || "Alguien", minutos: min, dice: `${horas(min)} en el rancho sin asignar` })),
    avances: avances.map(a => ({ evento: a.evento, parcelaId: a.parcelaId, donde: nombreDe(parcelas, a.parcelaId), actividad: a.actividad, cantidad: a.cantidad, unidad: a.unidad, unidadDicha: a.unidadDicha || "", personas: a.personas ?? null, pendiente: a.pendiente || null, quien: a.quien })),
    incidencias: delDia.map(x => ({ id: x.id, dice: x.desc || x.descripcion || "(sin descripción)", tipo: x.tipo || "", prioridad: x.prioridad || "", resuelta: !!(x.resuelta || x.estado === "resuelta") })),
    cuenta: { planeadas: tareas.length, hechas: n("hecha"), enCurso: n("en_curso"), seTrabajo: n("se_trabajo"), sinHacer: tareas.filter(t => t.pideMotivo).length, noVinieron: n("no_vino"), fueraDelPlan: fueraDelPlan.length, porAclarar: porAclarar.size, avances: avances.length, incidencias: delDia.length, incidenciasAbiertas: delDia.filter(x => !(x.resuelta || x.estado === "resuelta")).length },
  };
}

/* ── Cerrar la jornada ── */
// La foto vigente de un día (la última que no se reabrió) y cuántas versiones lleva.
export function cierreDe(eventos, fecha) {
  const vivos = vigentes(eventos || []).filter(e => e.fecha === fecha && (e.tipo === T_CIERRE || e.tipo === T_REAPERTURA)).sort((a, b) => String(a.cuando).localeCompare(String(b.cuando)));
  const cierres = vivos.filter(e => e.tipo === T_CIERRE), ultimo = vivos[vivos.length - 1] || null;
  const foto = (e) => ({ evento: e.id, version: e.datos.version, cuando: e.cuando, quien: e.quien?.nombre || "", ...e.datos });
  return { cerrada: !!ultimo && ultimo.tipo === T_CIERRE, vigente: ultimo && ultimo.tipo === T_CIERRE ? foto(ultimo) : null, versiones: cierres.length, anteriores: cierres.slice(0, ultimo?.tipo === T_CIERRE ? -1 : undefined).map(foto),
    reabierta: ultimo && ultimo.tipo === T_REAPERTURA ? { cuando: ultimo.cuando, quien: ultimo.quien?.nombre || "", motivo: ultimo.datos.motivo } : null };
}

// `motivos`: { [tareaId]: { motivo, nota } } — por qué no se hizo cada tarea que lo pide. `pasan`: tareas que siguen mañana.
export function cerrarJornada({ jornada, eventos = [], motivos = {}, pasan = [], nota = "", quien, cuando } = {}) {
  if (!quien?.id) return { ok: false, dice: "Falta quién cierra la jornada." };
  if (!ROLES_QUE_CIERRAN.includes(quien.rol)) return { ok: false, dice: "La jornada la cierra un administrador o un encargado." };
  if (!jornada?.fecha) return { ok: false, dice: "Falta de qué día es." };
  const previo = cierreDe(eventos, jornada.fecha);
  if (previo.cerrada) return { ok: false, dice: "Esa jornada ya está cerrada. Para cambiarla hay que reabrirla, con su motivo." };
  const faltan = jornada.tareas.filter(t => t.pideMotivo && !(MOTIVOS[motivos[t.id]?.motivo] && (motivos[t.id].motivo !== "otro" || String(motivos[t.id].nota || "").trim())));
  if (faltan.length) return { ok: false, faltan: faltan.map(t => t.id), dice: `Falta decir por qué no se hizo: ${faltan.map(t => `${t.nombre} — ${t.dice || "tarea"}`).join("; ")}.` };
  const ids = new Set(jornada.tareas.map(t => t.id));
  const tareas = jornada.tareas.map(t => ({ id: t.id, personaId: t.personaId, nombre: t.nombre, parcelaId: t.parcelaId, dice: t.dice, estado: t.estado, porque: t.porque, ...(t.pideMotivo ? { motivo: motivos[t.id].motivo, nota: String(motivos[t.id].nota || "").trim() } : {}) }));
  return { ok: true, evento: nuevoEvento({ tipo: T_CIERRE, cuando, fecha: jornada.fecha, quien, datos: { version: previo.versiones + 1, cuenta: jornada.cuenta, tareas, fueraDelPlan: jornada.fueraDelPlan.map(f => ({ personaId: f.personaId, nombre: f.nombre, dice: f.dice })), incidencias: jornada.incidencias, avances: jornada.avances.map(a => a.evento), pasan: [...new Set(pasan)].filter(id => ids.has(id)), nota: String(nota || "").trim() } }), dice: "La jornada quedó cerrada. Es una foto: lo que llegue después se verá aparte." };
}

export function reabrirJornada({ fecha, eventos = [], motivo, quien, cuando } = {}) {
  if (!ROLES_QUE_CIERRAN.includes(quien?.rol)) return { ok: false, dice: "La jornada la reabre un administrador o un encargado." };
  if (!cierreDe(eventos, fecha).cerrada) return { ok: false, dice: "Esa jornada no está cerrada." };
  if (String(motivo || "").trim().length < 5) return { ok: false, dice: "Di por qué se reabre: la foto anterior se queda, con este motivo." };
  return { ok: true, evento: nuevoEvento({ tipo: T_REAPERTURA, cuando, fecha, quien, datos: { motivo: String(motivo).trim() } }) };
}

// Lo que cambió desde que se cerró: registros que llegaron tarde (otro teléfono sin señal, una corrección).
export function diferenciasDelCierre(cierre, jornada) {
  if (!cierre || !jornada) return [];
  const dif = [], antes = new Map((cierre.tareas || []).map(t => [t.id, t]));
  for (const t of jornada.tareas) { const a = antes.get(t.id); if (!a) dif.push(`Tarea que no estaba al cerrar: ${t.nombre} — ${t.dice}`); else if (a.estado !== t.estado) dif.push(`${t.nombre} — ${t.dice}: al cerrar estaba «${ESTADOS[a.estado]?.nombre || a.estado}» y ahora «${ESTADOS[t.estado].nombre}».`); }
  for (const a of antes.values()) if (!jornada.tareas.some(t => t.id === a.id)) dif.push(`Tarea que ya no está en el plan: ${a.nombre} — ${a.dice}`);
  const c = cierre.cuenta || {}, j = jornada.cuenta;
  if ((c.avances || 0) !== j.avances) dif.push(`Avances: ${c.avances || 0} al cerrar, ${j.avances} ahora.`);
  if ((c.incidencias || 0) !== j.incidencias) dif.push(`Incidencias: ${c.incidencias || 0} al cerrar, ${j.incidencias} ahora.`);
  if ((c.fueraDelPlan || 0) !== j.fueraDelPlan) dif.push(`Trabajo fuera del plan: ${c.fueraDelPlan || 0} al cerrar, ${j.fueraDelPlan} ahora.`);
  return dif;
}

// Lo que pasa a mañana: se PROPONE como tareas nuevas del plan de mañana, apuntando a la de hoy. No se mandan solas.
export function tareasParaManana({ cierre, indicaciones = [], manana, quien, cuando, idNuevo } = {}) {
  if (!cierre?.pasan?.length) return [];
  const yaPasadas = new Set((indicaciones || []).filter(i => i && i.tipo === "tarea" && i.fecha === manana && i.vieneDe).map(i => i.vieneDe));
  return cierre.pasan.filter(id => !yaPasadas.has(id)).map((id, k) => {
    const o = (indicaciones || []).find(i => i.id === id); if (!o) return null;
    const t = (cierre.tareas || []).find(x => x.id === id), motivo = t?.motivo ? MOTIVOS[t.motivo] : "";
    const nueva = { ...o, id: idNuevo(k), fecha: manana, estado: "mandada", vieneDe: id, resumen: `${sinDiaRelativo(o.resumen)}${motivo ? ` (quedó de ayer: ${motivo.toLowerCase()})` : " (quedó de ayer)"}`, registradoPor: { rol: quien.rol, id: quien.id, nombre: quien.nombre }, mandadaEl: cuando };
    delete nueva.respuesta; delete nueva.respondidoEl; delete nueva._actualizado; delete nueva.cambioDe; delete nueva.cambio; delete nueva.cambiadaPor;
    return nueva;
  }).filter(Boolean);
}
