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
import { jornadasDe, marcasDe, marcaQueFalto } from "./checador.js";
import { vigentesDelPlan } from "./asignaciones.js";

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
      const valor = e.tipo === TIPO_ASIGNACION ? { parcelaId: e.datos.parcelaId || null, vehiculoId: e.datos.vehiculoId || null, ...(e.datos.vehiculoId ? { vehiculo: e.datos.vehiculo || "", beneficiaId: e.datos.beneficiaId || null } : {}), actividad: e.datos.actividad } : null;
      celdas.set(k, { valor, ev: e.id, por: e.quien?.nombre || "", capturado: e.capturado, historial: [...(ya ? [{ valor: ya.valor, por: ya.por, capturado: ya.capturado }, ...ya.historial] : [])] });
    }
  }
  return celdas;
}
export const valorDe = (celdas, trabajadorId, corteId) => celdas.get(`${trabajadorId}|${corteId}`)?.valor || null;
// LO ASIGNADO FUERA DE LA TABLA (Equipos de trabajo): la tabla lo enseña y no lo pisa. Es el último cambio de esa persona
// ese día hasta un instante, de cualquier pantalla, si fue una asignación hecha fuera de la tabla.
const cambiosDelDia = (eventos, fecha) => vigentes(eventos).filter(e => (e.tipo === TIPO_ASIGNACION || e.tipo === TIPO_FIN) && e.fecha === fecha)
  .sort((a, b) => a.cuando.localeCompare(b.cuando) || String(a.capturado || "").localeCompare(String(b.capturado || "")) || a.id.localeCompare(b.id));
const valorDeAsignacion = (e) => ({ parcelaId: e.datos.parcelaId || null, vehiculoId: e.datos.vehiculoId || null, ...(e.datos.vehiculoId ? { vehiculo: e.datos.vehiculo || "", beneficiaId: e.datos.beneficiaId || null } : {}), actividad: e.datos.actividad, desde: e.cuando, ev: e.id });
export function asignadoFuera(eventos, { fecha, trabajadorId, instante, cambios = null }) {
  const l = (cambios || cambiosDelDia(eventos, fecha)).filter(e => e.cuando <= instante && (e.datos.trabajadorIds || []).includes(trabajadorId));
  const u = l[l.length - 1];
  return u && u.tipo === TIPO_ASIGNACION && !u.datos.corte ? valorDeAsignacion(u) : null;
}
// Un cambio hecho fuera de la tabla A MEDIO corte (por ejemplo, en Equipos de trabajo a las 7:35): desde ahí vale ése.
function cambioFueraDentro(cambios, { trabajadorId, desde, hasta }) {
  const l = cambios.filter(e => e.cuando > desde && e.cuando < hasta && !e.datos.corte && (e.datos.trabajadorIds || []).includes(trabajadorId));
  const u = l[l.length - 1]; if (!u) return null;
  return u.tipo === TIPO_ASIGNACION ? valorDeAsignacion(u) : { terminado: true, desde: u.cuando, ev: u.id };
}

// Un pincel: una actividad en una parcela, o manejando un vehículo (y, si se dice, para qué parcela fue).
export const llaveDePincel = (v) => [v?.parcelaId || "", v?.vehiculoId || "", v?.beneficiaId || "", v?.actividad || ""].join("|");
export const mismoPincel = (a, b) => !!a && !!b && llaveDePincel(a) === llaveDePincel(b);

// Pintar una celda (o varias personas en el mismo corte). Devuelve los eventos a guardar.
export function pintar({ eventos, trabajadorIds, fecha, corteId, cortes, parcelaId, vehiculoId = null, vehiculo = "", beneficiaId = null, actividad, quien, capturado, azar, semanaCerrada = false }) {
  if (semanaCerrada) return { ok: false, dice: "Esa semana ya está cerrada. Para pintar hay que reabrirla (con motivo)." };
  const i = (cortes || []).findIndex(c => c.id === corteId);
  if (i < 0) return { ok: false, dice: "Ese corte no existe." };
  const c = cortes[i], sig = cortes[i + 1] || null;
  const r = asignar({ trabajadorIds, parcelaId: vehiculoId ? null : parcelaId, vehiculoId, vehiculo, beneficiaId: vehiculoId ? beneficiaId : null, actividad, desde: instanteDeCorte(fecha, c.desde), fecha, quien, capturado, azar });
  if (!r.ok) return r;
  const evs = [{ ...r.evento, datos: { ...r.evento.datos, corte: c.id } }];
  // El fin del corte: si el siguiente no empieza ahí mismo, siempre; si empieza ahí, sólo para quien lo tiene vacío.
  const celdas = celdasDelDia(eventos, { fecha }), cambios = cambiosDelDia(eventos, fecha);
  // No se termina lo que otra pantalla le asignó y sigue: lo de Equipos de trabajo no se pisa al pintar el corte de antes.
  const siguePorFuera = (id) => !!asignadoFuera(eventos, { fecha, trabajadorId: id, instante: instanteDeCorte(fecha, c.hasta), cambios });
  const terminan = (sig && sig.desde === c.hasta ? r.evento.datos.trabajadorIds.filter(id => !valorDe(celdas, id, sig.id)) : r.evento.datos.trabajadorIds).filter(id => !siguePorFuera(id));
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
// `incluir`: gente que alguien agregó a mano a ese día (un día de antes, o un rancho sin checador), para poder pintarla.
export function tablaDelDia({ eventos, personas = [], asistencia = [], fecha, cortes, hoy, ahora, incluir = [] }) {
  const celdas = celdasDelDia(eventos, { fecha });
  const checaron = new Set(jornadasDe(eventos, { fecha, hoy, ahora }).map(j => j.trabajadorId));
  const deLista = new Set((asistencia || []).filter(a => a && a.fecha === fecha && a.presente).map(a => a.trabajadorId));
  const pintados = new Set([...celdas.keys()].map(k => k.split("|")[0]));
  const ids = new Set([...checaron, ...deLista, ...pintados, ...(incluir || [])]);
  const cambios = cambiosDelDia(eventos, fecha), ya = ahora ? new Date(ahora).toISOString() : null;
  const filas = (personas || []).filter(p => ids.has(p.id)).map(p => {
    const fila = (cortes || []).map(c => {
      const ini = instanteDeCorte(fecha, c.desde), fin = instanteDeCorte(fecha, c.hasta), celda = celdas.get(`${p.id}|${c.id}`) || null;
      // Lo de Equipos de trabajo: si la celda no se pintó, lo que tenía asignado ahí; si sí, un cambio a medio corte.
      const fuera = celda?.valor ? null : (ya && ini > ya ? null : asignadoFuera(eventos, { fecha, trabajadorId: p.id, instante: ya && fin > ya ? ya : fin, cambios }));
      const despues = celda?.valor ? cambioFueraDentro(cambios, { trabajadorId: p.id, desde: ini, hasta: fin }) : null;
      return { corte: c, celda, fuera, despues };
    });
    const algo = fila.some(x => x.celda?.valor), porFuera = fila.some(x => x.fuera);
    return { persona: p, checo: checaron.has(p.id), deLista: deLista.has(p.id), fila,
      pintadoSinChecar: algo && !checaron.has(p.id), sinPintar: checaron.has(p.id) && !algo && !porFuera, porFuera };
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

// ─── Lo que hacía «Registro de varios» y el reparto, aquí (Luis, 23 nov: «pásale sus funciones, que no se pierda nada») ───

// PINTAR COMO EL PLAN. Lo que el plan (las `indicaciones` de tipo tarea) dice para cada quien, en los cortes que ya
// empezaron y siguen vacíos. Sólo propone: pintar es aparte y lo hace una persona. Una tarea sin parcela o sin qué
// hacer no se pinta (se dice). Con varias tareas: cada una desde el corte de su hora; sin horas, no se escoge.
export function propuestaDelPlan({ indicaciones = [], fecha, presentes = [], celdas, cortes = [], ahora, normalizar = null }) {
  const empezaron = cortes.filter(c => instanteDeCorte(fecha, c.desde) <= ahora);
  const delPlan = vigentesDelPlan(indicaciones, fecha).filter(i => i.asignadoA);
  const nombreDe = (q) => { const t = String(q || "").trim(); if (!t) return ""; const n = normalizar ? normalizar(t) : null; return n?.nombre || (t[0].toUpperCase() + t.slice(1)); };
  const grupos = new Map(), dudas = [];
  const poner = (corteId, valor, id) => { const k = `${corteId}|${llaveDePincel(valor)}`; if (!grupos.has(k)) grupos.set(k, { corteId, valor, ids: [] }); grupos.get(k).ids.push(id); };
  for (const id of presentes) {
    const suyas = delPlan.filter(i => i.asignadoA === id);
    if (!suyas.length) continue;
    const listas = suyas.filter(i => i.parcelaId && nombreDe(i.que));
    if (listas.length < suyas.length) dudas.push({ trabajadorId: id, dice: "Una tarea de su plan no dice parcela o qué hacer: píntala a mano." });
    if (!listas.length) continue;
    if (listas.length > 1 && listas.some(i => !/^\d{1,2}:\d{2}/.test(i.hora || ""))) { dudas.push({ trabajadorId: id, dice: `Tiene ${listas.length} tareas en el plan y no todas dicen a qué hora: píntalo a mano.` }); continue; }
    const orden = [...listas].sort((a, b) => String(a.hora || "").padStart(5, "0").localeCompare(String(b.hora || "").padStart(5, "0")));
    for (const c of empezaron) {
      if (valorDe(celdas, id, c.id)) continue;
      // La tarea que le toca en ese corte: la última que ya empezó a la hora del corte (o la primera, si ninguna).
      const t = orden.length === 1 ? orden[0] : [...orden].reverse().find(i => String(i.hora).padStart(5, "0") <= c.desde) || orden[0];
      poner(c.id, { parcelaId: t.parcelaId, actividad: nombreDe(t.que) }, id);
    }
  }
  return { pintar: [...grupos.values()], dudas };
}

// SU ENTRADA Y SALIDA POR LO PINTADO. Quien se pintó y no checó (un día de antes, o un rancho sin checador) no tiene
// horas: su día no se sabe. Un encargado o un administrador puede ponerle entrada y salida desde lo pintado, con su
// motivo (es la marca a mano de siempre). No se hace solo, ni a quien ya tiene alguna marca ese día.
export function marcasPorLoPintado({ eventos, trabajadorId, fecha, cortes = [], quien, capturado, motivo, azar }) {
  const ya = marcasDe(eventos, { trabajadorId, fecha });
  // Si sólo tiene la entrada que se le puso a mano (porque su último corte no acababa), ahora se le pone la salida.
  const soloSalida = ya.length === 1 && ya[0].datos.sentido === "entrada" && ya[0].datos.via === "correccion";
  if (ya.length && !soloSalida) return { ok: false, dice: "Ya tiene marcas ese día: lo que falte se pone en Jornadas." };
  const celdas = celdasDelDia(eventos, { fecha });
  const pintados = cortes.filter(c => valorDe(celdas, trabajadorId, c.id));
  if (!pintados.length) return { ok: false, dice: "No tiene nada pintado ese día." };
  const entra = instanteDeCorte(fecha, pintados[0].desde), sale = instanteDeCorte(fecha, pintados[pintados.length - 1].hasta);
  if (soloSalida) {
    if (sale > capturado) return { ok: false, dice: `Ya tiene su entrada. La salida se pone cuando acabe su último corte (${pintados[pintados.length - 1].hasta}).` };
    const s = marcaQueFalto({ trabajadorId, sentido: "salida", cuando: sale, fecha, motivo, quien, capturado, azar });
    return s.ok ? { ok: true, eventos: [s.evento], dice: `Salida ${pintados[pintados.length - 1].hasta}, por lo pintado (la entrada ya estaba).` } : s;
  }
  const e = marcaQueFalto({ trabajadorId, sentido: "entrada", cuando: entra, fecha, motivo, quien, capturado, azar });
  if (!e.ok) return e;
  if (sale > capturado) return { ok: true, eventos: [e.evento], dice: `Se le puso la entrada (${pintados[0].desde}). La salida se pone cuando acabe su último corte.` };
  const s = marcaQueFalto({ trabajadorId, sentido: "salida", cuando: sale, fecha, motivo, quien, capturado, azar: azar ? azar + 1e-7 : azar });
  if (!s.ok) return s;
  return { ok: true, eventos: [e.evento, s.evento], dice: `Entrada ${pintados[0].desde} y salida ${pintados[pintados.length - 1].hasta}, por lo pintado.` };
}

// EL DESTAJO DE UN EXTERNO (prestador independiente: tarifa × unidades, su pago incluye todo). Es el mismo renglón que
// guardaba «Registro de varios», para que Aprobar externos, Pagos y los reportes lo lean igual.
export function actividadDeExterno({ id, externo, fecha, parcelaId, actividad, siembraId = null, tarifa, unidades, hectareas = 0, nota = "", quien }) {
  const t = Number(tarifa) || 0, u = Number(unidades) || 0;
  if (!externo?.id) return { ok: false, dice: "Falta quién es el externo." };
  if (!parcelaId) return { ok: false, dice: "El destajo de un externo va a una parcela." };
  if (!(t > 0) || !(u > 0)) return { ok: false, dice: `A ${externo.nombre || "ese externo"} le falta a cómo y cuántas unidades.` };
  const costoMO = Math.round(t * u * 100) / 100;
  return { ok: true, actividad: { id, fecha, parcelaId, tipo: String(actividad || "").trim(), siembraId, registradoPor: { tipo: "externo", id: externo.id },
    horas_trab: 0, maquinariaId: null, horas_maq: 0, costoMaq: 0, insumos: [], costoMO, costoInsumos: 0, costoTotal: costoMO,
    observaciones: String(nota || "").trim(), flete: 0, modalidadPago: "destajo", externo_tarifa: t, externo_unidades: u,
    hectareas_trab: Number(hectareas) || 0, registradoEnNombrePor: { rol: quien?.rol, id: quien?.id, nombre: quien?.nombre }, registroMasivo: true, deLaTabla: true, cosecha: null } };
}

// ¿Ya se fue? Su última marca hasta ese instante es una salida. A quien ya se fue no se le pinta en grupo (repetir el
// corte, pintar a todos, copiar ayer, el plan): sería pintarle un rato en que no estaba. Tocar su celda sí se puede.
export function seFueAntes(eventos, { trabajadorId, fecha, instante }) {
  const m = marcasDe(eventos, { trabajadorId, fecha }).filter(x => x.cuando <= instante);
  return m.length > 0 && m[m.length - 1].datos.sentido === "salida";
}

// A quiénes se pintó con un pincel ese día (en cualquier corte): para anotar su destajo o su avance.
export function pintadosCon(celdas, pincel) {
  const ids = new Set();
  for (const [k, c] of celdas) if (mismoPincel(c.valor, pincel)) ids.add(k.split("|")[0]);
  return [...ids];
}
