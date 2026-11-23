// ═════════════════════════════════════════════════════════════════════════════
//  LA TABLA POR CORTES DEL DÍA (idea de Luis, 22 nov; diseño en docs/PROPUESTAS-ASISTENCIA.md §2)
//
//  Gente en renglones, los cortes del día en columnas. Se escoge un «pincel» (una actividad en una parcela) y se pinta
//  a quien la hizo en ese corte. NO es otra cuenta de dinero: cada celda pintada es una ASIGNACIÓN de siempre
//  (`asignar` de cuadrillas.js) con su hora de inicio y, cuando hace falta, su fin. El costo sale del motor que ya está
//  probado (`manoDeObra`): quien cobra por día cobra su día; los cortes sólo reparten ese día entre parcelas.
//
//  Reglas:
//   · Pintar no es pagar. Pintado y no checó: aviso. Checó y no se pintó: «por aclarar», como siempre; nunca se reparte solo.
//   · Repintar NO borra: la celda vale lo último que se pintó, y lo anterior queda en su historial con quién lo pintó.
//   · Una celda termina al acabar su corte si el corte siguiente no empieza ahí mismo, o si ese siguiente está vacío:
//     así el rato sin pintar no se le carga a la parcela de antes.
//   · Los cortes son una regla del rancho (`cortes_dia`), PROVISIONAL hasta validarlos con Miguel.
//   · Con la semana cerrada no se pinta (se reabre con motivo).
// ═════════════════════════════════════════════════════════════════════════════
import { vigentes } from "./eventos.js";
import { asignar, terminar, ajusteVigente, TIPO_ASIGNACION, TIPO_FIN } from "./cuadrillas.js";
import { jornadasDe } from "./checador.js";

export const JUEGOS_DE_CORTES = {
  tres: [{ id: "c1", desde: "07:00", hasta: "10:00" }, { id: "c2", desde: "10:00", hasta: "13:00" }, { id: "c3", desde: "14:00", hasta: "17:00" }],
  dos: [{ id: "c1", desde: "07:00", hasta: "12:00" }, { id: "c2", desde: "13:00", hasta: "17:00" }],
  cuatro: [{ id: "c1", desde: "07:00", hasta: "09:30" }, { id: "c2", desde: "09:30", hasta: "12:00" }, { id: "c3", desde: "13:00", hasta: "15:00" }, { id: "c4", desde: "15:00", hasta: "17:00" }],
};
const corta = (h) => h.replace(/^0/, "").replace(/:00$/, "");
export const nombreDeCorte = (c) => `${corta(c.desde)}–${corta(c.hasta)}`;
export function cortesVigentes(eventos) {
  const juego = ajusteVigente(eventos, "cortes_dia").valor || "tres";
  return (JUEGOS_DE_CORTES[juego] || JUEGOS_DE_CORTES.tres).map(c => ({ ...c, nombre: nombreDeCorte(c) }));
}
// La hora de un corte en un día, como marca de tiempo (Zacatecas: UTC−6 todo el año).
export const instanteDeCorte = (fecha, hhmm) => new Date(`${fecha}T${hhmm}:00-06:00`).toISOString();

const deLaTabla = (e, fecha) => e.fecha === fecha && e.datos?.corte && (e.tipo === TIPO_ASIGNACION || e.tipo === TIPO_FIN);
const ordenCaptura = (a, b) => String(a.capturado || "").localeCompare(String(b.capturado || "")) || a.id.localeCompare(b.id);

// Qué tiene cada celda: lo último que se pintó (o se borró) en ese corte para esa persona, y su historial.
export function celdasDelDia(eventos, { fecha }) {
  const celdas = new Map();
  for (const e of vigentes(eventos).filter(x => deLaTabla(x, fecha)).sort(ordenCaptura)) {
    const esInicio = e.tipo === TIPO_ASIGNACION || e.datos.borra;
    if (!esInicio) continue;                     // los fines al acabar un corte son parte de la celda, no la cambian
    for (const id of e.datos.trabajadorIds || []) {
      const k = `${id}|${e.datos.corte}`, ya = celdas.get(k);
      const valor = e.tipo === TIPO_ASIGNACION ? { parcelaId: e.datos.parcelaId || null, vehiculoId: e.datos.vehiculoId || null, actividad: e.datos.actividad } : null;
      celdas.set(k, { valor, ev: e.id, por: e.quien?.nombre || "", capturado: e.capturado, historial: [...(ya ? [{ valor: ya.valor, por: ya.por, capturado: ya.capturado }, ...ya.historial] : [])] });
    }
  }
  return celdas;
}
export const valorDe = (celdas, trabajadorId, corteId) => celdas.get(`${trabajadorId}|${corteId}`)?.valor || null;

// Pintar una celda (o varias personas en el mismo corte). Devuelve los eventos a guardar.
export function pintar({ eventos, trabajadorIds, fecha, corteId, cortes, parcelaId, vehiculoId = null, actividad, quien, capturado, azar, semanaCerrada = false }) {
  if (semanaCerrada) return { ok: false, dice: "Esa semana ya está cerrada. Para pintar hay que reabrirla (con motivo)." };
  const i = (cortes || []).findIndex(c => c.id === corteId);
  if (i < 0) return { ok: false, dice: "Ese corte no existe." };
  const c = cortes[i], sig = cortes[i + 1] || null;
  const r = asignar({ trabajadorIds, parcelaId, vehiculoId, actividad, desde: instanteDeCorte(fecha, c.desde), fecha, quien, capturado, azar });
  if (!r.ok) return r;
  const evs = [{ ...r.evento, datos: { ...r.evento.datos, corte: c.id } }];
  // El fin del corte: si el siguiente no empieza ahí mismo, siempre; si empieza ahí, sólo para quien lo tiene vacío.
  const celdas = celdasDelDia(eventos, { fecha });
  const terminan = sig && sig.desde === c.hasta ? r.evento.datos.trabajadorIds.filter(id => !valorDe(celdas, id, sig.id)) : r.evento.datos.trabajadorIds;
  if (terminan.length) {
    const f = terminar({ trabajadorIds: terminan, desde: instanteDeCorte(fecha, c.hasta), fecha, quien, capturado, azar });
    if (f.ok) evs.push({ ...f.evento, datos: { ...f.evento.datos, corte: c.id } });
  }
  return { ok: true, eventos: evs };
}

// Borrar una celda: la persona no estuvo asignada en ese corte. No se borra nada: queda un fin al empezar el corte
// (con `borra`), y lo que se había pintado se queda en el historial.
export function borrarCelda({ trabajadorIds, fecha, corteId, cortes, quien, capturado, azar, semanaCerrada = false }) {
  if (semanaCerrada) return { ok: false, dice: "Esa semana ya está cerrada. Para cambiarla hay que reabrirla (con motivo)." };
  const c = (cortes || []).find(x => x.id === corteId);
  if (!c) return { ok: false, dice: "Ese corte no existe." };
  const f = terminar({ trabajadorIds, desde: instanteDeCorte(fecha, c.desde), fecha, quien, capturado, azar });
  if (!f.ok) return f;
  return { ok: true, eventos: [{ ...f.evento, datos: { ...f.evento.datos, corte: c.id, borra: true } }] };
}

// La tabla: quién vino (checó o se le pasó lista) y quién ya está pintado; y los avisos.
export function tablaDelDia({ eventos, personas = [], asistencia = [], fecha, cortes, hoy, ahora }) {
  const celdas = celdasDelDia(eventos, { fecha });
  const checaron = new Set(jornadasDe(eventos, { fecha, hoy, ahora }).map(j => j.trabajadorId));
  const deLista = new Set((asistencia || []).filter(a => a && a.fecha === fecha && a.presente).map(a => a.trabajadorId));
  const pintados = new Set([...celdas.keys()].map(k => k.split("|")[0]));
  const ids = new Set([...checaron, ...deLista, ...pintados]);
  const filas = (personas || []).filter(p => ids.has(p.id)).map(p => {
    const fila = (cortes || []).map(c => ({ corte: c, celda: celdas.get(`${p.id}|${c.id}`) || null }));
    const algo = fila.some(x => x.celda?.valor);
    return { persona: p, checo: checaron.has(p.id), deLista: deLista.has(p.id), fila,
      pintadoSinChecar: algo && !checaron.has(p.id), sinPintar: checaron.has(p.id) && !algo };
  }).sort((a, b) => String(a.persona.nombre).localeCompare(String(b.persona.nombre)));
  return { filas, celdas,
    avisos: [
      ...filas.filter(f => f.pintadoSinChecar).map(f => ({ clase: "pintado_sin_checar", persona: f.persona, dice: `${f.persona.nombre}: está pintado y no checó. Su tiempo no se sabe (no se le carga a la parcela hasta que cheque o alguien lo aclare).` })),
      ...filas.filter(f => f.sinPintar).map(f => ({ clase: "sin_pintar", persona: f.persona, dice: `${f.persona.nombre}: checó y no está pintado. Su tiempo queda «por aclarar», no se reparte solo.` })),
    ] };
}

// Repetir: lo que tenía cada persona en un corte (o ayer), en otro corte de hoy. Sólo propone las celdas; pintar es aparte.
export function lomismoQue(celdas, { trabajadorIds, corteId }) {
  return (trabajadorIds || []).map(id => ({ trabajadorId: id, valor: valorDe(celdas, id, corteId) })).filter(x => x.valor);
}
