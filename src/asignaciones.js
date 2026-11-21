// A QUÉ VA CADA QUIEN: el plan del día, visto por la persona al checar.
//
// El plan son las indicaciones de tipo «tarea» que alguien mandó para un día (la víspera o esa
// misma mañana). Esto NO es la asistencia ni el trabajo hecho:
//   · planear no crea marcas, actividades, rayas, pagos ni costos;
//   · checar no da por hecho lo planeado;
//   · lo que de verdad se trabajó se registra aparte (asignación en «Equipos de trabajo»,
//     actividad o avance) y nada de aquí lo sustituye.
// Cambiar el plan no borra lo anterior: lo deja marcado como «cambiada» o «cancelada», con
// quién y por qué, y lo nuevo es otro renglón.

export const YA_NO_VALE = ["cancelada", "cambiada"];
const esDelPlan = (i) => i && i.tipo === "tarea" && !i.cancelado && !YA_NO_VALE.includes(i.estado);
// El texto se escribió el día que se planeó («Mañana: regar…»). Leído el día que toca, ese «mañana» mentiría.
export const sinDiaRelativo = (t) => { const r = String(t || "").replace(/^\s*(pasado\s+ma[ñn]ana|ma[ñn]ana|hoy)\s*[:,]\s*/i, ""); return r ? r[0].toUpperCase() + r.slice(1) : ""; };
const nombreDe = (lista, id) => (lista || []).find(x => x.id === id)?.nombre || "";

export function vigentesDelPlan(indicaciones, fecha) {
  return (indicaciones || []).filter(i => esDelPlan(i) && i.fecha === fecha);
}

// El plan de un día, por persona. `personas` son todos los que pueden recibir una tarea.
export function planDelDia(indicaciones, fecha, { personas = [], parcelas = [] } = {}) {
  const vig = vigentesDelPlan(indicaciones, fecha), porPersona = new Map();
  for (const i of vig) {
    const k = i.asignadoA || "";
    if (!porPersona.has(k)) porPersona.set(k, { personaId: k, nombre: nombreDe(personas, k) || (k ? "Alguien que ya no está en el catálogo" : "Sin persona"), tareas: [] });
    porPersona.get(k).tareas.push({ id: i.id, tareaId: i.tareaId || i.id, dice: sinDiaRelativo(i.resumen), parcelaId: i.parcelaId || "", donde: nombreDe(parcelas, i.parcelaId), hora: i.hora || "", maquina: i.maquina || "", mando: i.deQuien || "", respuesta: i.respuesta || "", cambioDe: i.cambioDe || null });
  }
  const filas = [...porPersona.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const cambiadas = (indicaciones || []).filter(i => i && i.tipo === "tarea" && i.fecha === fecha && YA_NO_VALE.includes(i.estado)).length;
  return { fecha, hay: vig.length > 0, cuantas: vig.length, personas: filas.length, filas, cambiadas };
}

// Lo que se le dice a UNA persona cuando checa su entrada. Sólo informa.
export function loQueLeToca(indicaciones, trabajadorId, fecha, { personas = [], parcelas = [] } = {}) {
  const vig = vigentesDelPlan(indicaciones, fecha), suyas = vig.filter(i => i.asignadoA === trabajadorId);
  if (!suyas.length) {
    // Sin plan ese día no se dice nada: que nadie haya planeado en la app no es noticia para quien checa.
    return { hay: false, hayPlan: vig.length > 0, tareas: [], lineas: [],
      dice: vig.length ? "No tienes nada asignado en el plan de hoy. Pregúntale a tu encargado." : "" };
  }
  const tareas = suyas.map(i => {
    const con = vig.filter(x => x.id !== i.id && (x.tareaId || x.id) === (i.tareaId || i.id) && (x.parcelaId || "") === (i.parcelaId || "") && x.asignadoA && x.asignadoA !== trabajadorId).map(x => nombreDe(personas, x.asignadoA)).filter(Boolean);
    const donde = nombreDe(parcelas, i.parcelaId);
    return { id: i.id, dice: sinDiaRelativo(i.resumen), donde, hora: i.hora || "", maquina: i.maquina || "", mando: i.deQuien || "", con: [...new Set(con)] };
  }).sort((a, b) => String(a.hora || "99").localeCompare(String(b.hora || "99")));
  const lineas = tareas.map(t => [t.dice || (t.donde ? `Trabajo en ${t.donde}` : "Tarea sin descripción"), t.con.length ? `Con ${t.con.join(", ")}.` : "", t.mando && !t.dice.includes(`Dijo ${t.mando}`) ? `Lo indicó ${t.mando}.` : ""].filter(Boolean).join(" "));
  return { hay: true, hayPlan: true, tareas, lineas, dice: tareas.length === 1 ? "Hoy te toca:" : `Hoy te tocan ${tareas.length} cosas:` };
}

const firma = (quien, cuando, motivo) => ({ por: quien?.nombre || quien?.id || "", porId: quien?.id || null, cuando, motivo: String(motivo || "").trim() });

// Quitar a alguien del plan. Pide motivo: «ya no va» también es información.
export function quitarAsignacion(ind, { quien, motivo, cuando } = {}) {
  if (!esDelPlan(ind)) return { ok: false, dice: "Eso ya no está en el plan." };
  if (!String(motivo || "").trim()) return { ok: false, dice: "Di por qué se quita: después es lo único que explica el cambio." };
  if (!quien?.id) return { ok: false, dice: "Falta quién hace el cambio." };
  return { ok: true, anterior: { ...ind, estado: "cancelada", cambio: firma(quien, cuando, motivo) }, dice: "Se quitó del plan. Lo anterior queda guardado." };
}

// Cambiar una asignación (otra parcela, otra persona, otra hora u otra indicación).
// Devuelve DOS renglones: el anterior marcado «cambiada» y el nuevo, que apunta al anterior.
export function cambiarAsignacion(ind, cambios = {}, { quien, motivo, cuando, id, parcelas = [] } = {}) {
  if (!esDelPlan(ind)) return { ok: false, dice: "Eso ya no está en el plan." };
  if (!quien?.id) return { ok: false, dice: "Falta quién hace el cambio." };
  if (!id) return { ok: false, dice: "Falta el identificador del renglón nuevo." };
  const campos = ["parcelaId", "asignadoA", "hora", "resumen", "fecha"].filter(k => cambios[k] !== undefined && (cambios[k] ?? "") !== (ind[k] ?? ""));
  if (!campos.length) return { ok: false, dice: "No cambió nada." };
  if (campos.includes("asignadoA") && !cambios.asignadoA) return { ok: false, dice: "Una tarea sin persona no se manda a nadie: di de quién es, o quítala." };
  const nueva = { ...ind, ...Object.fromEntries(campos.map(k => [k, cambios[k]])), id, estado: "mandada", cambioDe: ind.id, cambio: firma(quien, cuando, motivo), registradoPor: { rol: quien.rol, id: quien.id, nombre: quien.nombre } };
  delete nueva.respuesta; delete nueva.respondidoEl; delete nueva._actualizado;
  // Si cambió el lugar y nadie reescribió la indicación, el texto viejo mentiría: se dice el cambio delante.
  if (campos.includes("parcelaId") && !campos.includes("resumen")) {
    const lugar = nombreDe(parcelas, cambios.parcelaId);
    nueva.resumen = `CAMBIO: ahora en ${lugar || "otro lugar"}. Antes se había dicho: ${ind.resumen || "(sin texto)"}`;
  }
  return { ok: true, anterior: { ...ind, estado: "cambiada", cambiadaPor: id, cambio: firma(quien, cuando, motivo) }, nueva, cambio: campos, dice: "Se cambió el plan. Lo anterior queda guardado." };
}
