// ════════════════════════════════════════════════════════════════════════
//  PAGOS AL PERSONAL — lo que corresponde, lo entregado y lo pendiente
//
//  Tres cosas que no se confunden:
//    lo que corresponde   sale de lo que YA se registró (checador, cuadrillas,
//                         ausencias con pago). Aquí no se captura otra vez.
//    lo entregado         cada pago es un evento (`pago_personal`): a quién, de
//                         qué semana, cuánto, por qué medio, con qué comprobante.
//    lo pendiente         la resta. No se guarda: se calcula.
//  Un pago NO genera costo: el costo ya nació cuando se trabajó.
//
//  Reglas del rancho (19 nov), y las que dependen de una persona:
//  · Permiso o descanso AUTORIZADO: se paga el día. Lleva causa y quién autorizó.
//  · Falta sin autorizar ni justificar: no se paga. Se puede justificar después,
//    y eso CORRIGE con historial (el registro anterior no se borra).
//  · Salir antes del horario NO descuenta nada solo. Queda "por revisar" y una
//    persona decide, con nombre y motivo (`decision_jornada`, en cuadrillas.js).
//  · El calendario de asistencia es de cada quien (hay quien no viene los
//    sábados porque estudia) y es distinto del periodo de pago, que es semanal.
//  · A una cuadrilla se le entrega al RESPONSABLE. Eso no marca pagado a cada
//    integrante: lo que el responsable reparte adentro no lo sabe la app.
//  · Las horas adicionales se registran. Reconocerlas es otra decisión; dejarlas
//    registradas no las da por saldadas.
//  · Un recibo interno NO sustituye un CFDI de nómina ni ningún documento que
//    la ley pida. Lo dice el propio recibo.
// ════════════════════════════════════════════════════════════════════════
import { nuevoEvento, vigentes, corregirEvento, rastroDe, negado } from "./eventos.js";
import { sumarDinero, sueldoVigente, sumarDias } from "./calculos.js";

export const T_AUSENCIA = "ausencia", T_PAGO = "pago_personal", T_RECIBO = "recibo_personal", T_HORAS = "horas_reconocidas";
const PUEDE = ["admin", "encargado"];
const limpio = (s) => String(s || "").trim();
export const CLASES_AUSENCIA = {
  permiso: { nombre: "Permiso autorizado", paga: true, pideAutoriza: true },
  descanso: { nombre: "Descanso autorizado", paga: true, pideAutoriza: true },
  justificada: { nombre: "Ausencia justificada", paga: null, pideAutoriza: true },   // si se paga, lo dice quien la justifica
  falta: { nombre: "Falta sin justificar", paga: false, pideAutoriza: false },
  // Se pagan en su semana, pero su costo NO nace ese día: se fue generando como prestación.
  vacaciones: { nombre: "Vacaciones", paga: true, pideAutoriza: true, sinCausa: true },
};
export const SITUACIONES_SALIDA = { terminada: "Terminó su jornada", autorizada: "Salida autorizada", justificada: "Causa justificada", abandono: "Abandonó el trabajo", otra: "Otra situación" };
export const MEDIOS_DE_PAGO = { efectivo: "Efectivo", transferencia: "Transferencia", cheque: "Cheque", otro: "Otro" };
export const CLASES_DE_PERSONAL = { planta: "Trabajador de planta", cuadrilla: "Cuadrilla (entrega al responsable)", independiente: "Trabajador temporal independiente" };

// ── El calendario de cada quien ────────────────────────────────────────────
// 1 = lunes … 7 = domingo. Si no se ha dicho nada: de lunes a sábado.
export const DIAS_DE_SIEMPRE = [1, 2, 3, 4, 5, 6];
export const diaDeLaSemana = (fecha) => { const d = new Date(fecha + "T12:00:00Z").getUTCDay(); return d === 0 ? 7 : d; };
export const leToca = (trabajador, fecha) => (Array.isArray(trabajador?.diasAsistencia) && trabajador.diasAsistencia.length ? trabajador.diasAsistencia : DIAS_DE_SIEMPRE).includes(diaDeLaSemana(fecha));
// Asistencia por calendario (encargados): periodos { desde, hasta } en que su día se paga por estar en su calendario.
// Apagarla cierra el periodo; lo anterior sigue valiendo como estaba.
export const porCalendario = (persona, fecha) => (persona?.calendario || []).some(p => p?.desde && fecha >= p.desde && (!p.hasta || fecha <= p.hasta));
export const calendarioActivo = (persona, hoy) => (persona?.calendario || []).find(p => p?.desde && !p.hasta || (p?.hasta && p.hasta >= hoy)) || null;
// Se activa persona por persona, con fecha de inicio, y queda quién lo activó. Nunca para todos a la vez.
export function activarCalendario(persona, { desde, hoy, quien }) {
  if (quien?.rol !== "admin") return { ok: false, dice: "El pago por calendario lo activa un administrador." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde || "")) return { ok: false, dice: "Falta desde qué día." };
  if (calendarioActivo(persona, hoy > desde ? hoy : desde)) return { ok: false, dice: "Ya lo tiene activo." };
  if (porCalendario(persona, desde)) return { ok: false, dice: "Ese día ya está dentro de un periodo anterior." };
  return { ok: true, persona: { ...persona, calendario: [...(persona.calendario || []), { desde, activo: { por: quien.nombre || quien.id, el: hoy } }] } };
}
export function cerrarCalendario(persona, { hasta, hoy, quien }) {
  const act = calendarioActivo(persona, hoy);
  if (quien?.rol !== "admin") return { ok: false, dice: "El pago por calendario lo quita un administrador." };
  if (!act) return { ok: false, dice: "No lo tiene activo." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta || "") || hasta < act.desde) return { ok: false, dice: "El último día no puede ser antes de que empezó." };
  return { ok: true, persona: { ...persona, calendario: persona.calendario.map(p => (p === act ? { ...p, hasta, cerro: { por: quien.nombre || quien.id, el: hoy } } : p)) } };
}
export const diasEntre = (desde, hasta) => { const l = []; for (let f = desde; f <= hasta && l.length < 400; f = sumarDias(f, 1)) l.push(f); return l; };

// ── Ausencias ──────────────────────────────────────────────────────────────
export function registrarAusencia({ trabajadorId, desde, hasta, clase, paga, causa = "", autorizo = "", quien, cuando, capturado, azar }) {
  const c = CLASES_AUSENCIA[clase];
  if (!PUEDE.includes(quien?.rol)) return { ok: false, dice: "Una ausencia la registra un encargado o un administrador." };
  if (!trabajadorId) return { ok: false, dice: "Falta decir de quién." };
  if (!c) return { ok: false, dice: "Falta decir qué fue: permiso, descanso, ausencia justificada o falta." };
  if (!desde || (hasta && hasta < desde)) return { ok: false, dice: "Faltan las fechas." };
  if (c.pideAutoriza && !limpio(autorizo)) return { ok: false, dice: "Falta decir quién lo autorizó." };
  if (clase !== "falta" && !c.sinCausa && !limpio(causa)) return { ok: false, dice: "Falta la causa." };
  if (clase === "justificada" && typeof paga !== "boolean") return { ok: false, dice: "Falta decidir si esos días se pagan." };
  const sePaga = c.paga == null ? paga : c.paga; let k = 0;
  return { ok: true, eventos: diasEntre(desde, hasta || desde).map(fecha => nuevoEvento({ tipo: T_AUSENCIA, cuando: `${fecha}T12:00:00-06:00`, fecha, capturado: capturado || cuando, quien, azar: azar != null ? azar + (k++) / 1e9 : undefined,
    datos: { trabajadorId, clase, paga: sePaga, causa: limpio(causa), autorizo: limpio(autorizo) } })) };
}
// Una falta que después se justifica: nace un registro nuevo que apunta al
// anterior. El anterior queda "corregido", con lo que decía.
export function justificarFalta(evento, { causa, paga, autorizo, quien, cuando, azar }) {
  if (evento?.tipo !== T_AUSENCIA) return { ok: false, dice: "Eso no es una ausencia." };
  if (!PUEDE.includes(quien?.rol)) return { ok: false, dice: "Esto lo hace un encargado o un administrador." };
  if (!limpio(causa)) return { ok: false, dice: "Falta la justificación." };
  if (!limpio(autorizo)) return { ok: false, dice: "Falta decir quién la aceptó." };
  if (typeof paga !== "boolean") return { ok: false, dice: "Falta decidir si ese día se paga." };
  return corregirEvento(evento, { datos: { clase: "justificada", paga, causa: limpio(causa), autorizo: limpio(autorizo) } }, { motivo: `Se justificó después: ${limpio(causa)}`, quien, cuando, azar });
}
export const ausenciasDe = (eventos, { desde, hasta } = {}) => vigentes(eventos).filter(e => e.tipo === T_AUSENCIA && (!desde || e.fecha >= desde) && (!hasta || e.fecha <= hasta));

// ── La semana de una persona de planta, día por día ────────────────────────
// `devengado`: lo que salió del checador (manoDeObra). `actividades`: las
// tecleadas a mano de antes (su mano de obra ya viene en cero si ese día checó).
// `modo`: "checador" (planta: si le tocaba y no hay nada, es una pregunta) ·
//         "calendario" (encargado con asistencia administrativa: el día de su
//         calendario se paga salvo ausencia sin pago; si checó, manda el checador) ·
//         "actividades" (lo de antes: sólo cuenta lo que registró; no se pregunta).
// `asistencia`: el pase de lista a mano. NO da pago por sí solo (no dice en qué trabajó), pero quien fue marcado presente
// no puede salir como «no vino»: sale como presente sin detalle (`presentesSinDetalle`).
export function semanaDe({ trabajador, desde, hasta, hoy, devengado = [], actividades = [], ausencias = [], asistencia = [], modo = "checador" }) {
  const dias = diasEntre(desde, hasta).map(fecha => {
    const dev = devengado.filter(d => d.trabajadorId === trabajador.id && d.fecha === fecha);
    const acts = actividades.filter(a => !a._deEventos && a.registradoPor?.id === trabajador.id && a.fecha === fecha && (Number(a.costoMO) || 0) > 0);
    const aus = ausencias.find(e => e.datos.trabajadorId === trabajador.id && e.fecha === fecha);
    const base = { fecha, leToca: leToca(trabajador, fecha) };
    if (dev.length > 0) return { ...base, estado: "trabajo", origen: "checador", monto: sumarDinero(dev.map(d => d.monto)), minutos: dev.reduce((s, d) => s + (d.minutos || 0), 0), provisional: dev.some(d => d.provisional), evs: dev.flatMap(d => d.partes.flatMap(p => p.evs)) };
    if (acts.length > 0) return { ...base, estado: "trabajo", origen: "actividad", monto: sumarDinero(acts.map(a => a.costoMO)), minutos: null, evs: [] };
    if (aus) {
      const v = sueldoVigente(trabajador, fecha);
      return { ...base, estado: aus.datos.paga ? "ausencia_pagada" : "ausencia_sin_pago", clase: aus.datos.clase, causa: aus.datos.causa, autorizo: aus.datos.autorizo, monto: aus.datos.paga ? v.sueldo : 0, estimado: aus.datos.paga && v.estimado, ev: aus.id, evs: [aus.id] };
    }
    if (fecha > hoy) return { ...base, estado: "futuro", monto: 0 };
    if (modo === "calendario" && base.leToca && porCalendario(trabajador, fecha)) {
      const v = sueldoVigente(trabajador, fecha);
      return { ...base, estado: "calendario", monto: v.sueldo, estimado: v.estimado };
    }
    if (modo !== "checador") return { ...base, estado: "no_le_toca", monto: 0 };
    // No vino y nadie ha dicho qué pasó. NO es una falta todavía: es una pregunta.
    const lista = asistencia.find(a => a.trabajadorId === trabajador.id && a.fecha === fecha && a.presente === true);
    if (lista) return { ...base, estado: "sin_registro", paseLista: true, monto: 0 };
    return { ...base, estado: base.leToca ? "sin_registro" : "no_le_toca", monto: 0 };
  });
  return { trabajadorId: trabajador.id, dias, corresponde: sumarDinero(dias.map(d => d.monto)), trabajados: dias.filter(d => d.estado === "trabajo").length,
    pagadosSinTrabajar: dias.filter(d => d.estado === "ausencia_pagada").length, porCalendario: dias.filter(d => d.estado === "calendario").length, sinPago: dias.filter(d => d.estado === "ausencia_sin_pago").length,
    sinRegistro: dias.filter(d => d.estado === "sin_registro").map(d => d.fecha), presentesSinDetalle: dias.filter(d => d.paseLista).map(d => d.fecha), provisional: dias.some(d => d.provisional) };
}

// ── Cuadrillas y temporales: a quién se le entrega ─────────────────────────
// Una cuadrilla = una cuenta, la de su responsable. Un temporal independiente =
// su propia cuenta. `partes`: los pagos que salen de `costoDeCuadrillas`.
const llaveDe = (s) => limpio(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");
export function cuentasDeCuadrillas(partes, { desde, hasta } = {}) {
  const m = new Map();
  for (const p of partes || []) {
    if (p.clase !== "pago" || (desde && p.fecha < desde) || (hasta && p.fecha > hasta)) continue;
    const ind = !!p.independiente;
    const id = ind ? `ind:${llaveDe(p.persona)}` : `cq:${p.cuadrillaId || llaveDe(p.cuadrilla)}`;
    if (!m.has(id)) m.set(id, { a: { tipo: ind ? "independiente" : "cuadrilla", id, nombre: ind ? p.persona : p.cuadrilla }, responsable: ind ? "" : p.responsable, renglones: [], integrantes: new Set(), corresponde: 0 });
    const c = m.get(id); c.renglones.push(p); c.corresponde = sumarDinero(c.corresponde, p.monto);
    if (!p.grupo) c.integrantes.add(p.persona);
    if (!ind && p.responsable) c.responsable = p.responsable;
  }
  return [...m.values()].map(c => ({ ...c, integrantes: [...c.integrantes] })).sort((x, y) => x.a.nombre.localeCompare(y.a.nombre));
}

// ── Los pagos ──────────────────────────────────────────────────────────────
export function registrarPago({ permitido, a, desde, hasta, monto, medio, recibe = "", comprobante = null, nota = "", corresponde = null, quien, cuando, fecha, azar }) {
  const m = Number(monto);
  { const no = negado(quien, permitido, "Un pago lo registra un administrador."); if (no) return { ok: false, dice: no }; }
  if (!a?.id || !a?.tipo) return { ok: false, dice: "Falta decir a quién se le pagó." };
  if (!desde || !hasta) return { ok: false, dice: "Falta la semana que se está pagando." };
  if (!(m > 0)) return { ok: false, dice: "Falta cuánto se entregó." };
  if (!MEDIOS_DE_PAGO[medio]) return { ok: false, dice: "Falta por qué medio se pagó." };
  if (a.tipo === "cuadrilla" && !limpio(recibe)) return { ok: false, dice: "Falta el nombre del responsable que recibió el dinero." };
  const avisos = [];
  if (corresponde != null && m > corresponde + 0.004) avisos.push(`Se están entregando ${m} y de esa semana quedaban ${corresponde} pendientes. Se registra igual; revisa que no sea un pago doble.`);
  if (!comprobante) avisos.push("Quedó sin comprobante. Se puede pagar así, pero no hay con qué probar la entrega.");
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T_PAGO, cuando, fecha, quien, azar, datos: { a: { tipo: a.tipo, id: a.id, nombre: limpio(a.nombre) }, desde, hasta, monto: Math.round(m * 100) / 100, medio, recibe: limpio(recibe), ...(comprobante ? { comprobante } : {}), nota: limpio(nota) } }) };
}
export const pagosA = (eventos, a, { desde, hasta } = {}) => vigentes(eventos).filter(e => e.tipo === T_PAGO && e.datos.a.id === a.id && e.datos.a.tipo === a.tipo && (!desde || e.datos.desde === desde) && (!hasta || e.datos.hasta === hasta));
// Lo que corresponde, lo entregado y lo que falta. `descuentos`: lo que no se le entrega aunque lo ganó (retención, abono a su préstamo).
export function saldoDe({ corresponde, descuentos = 0, pagos = [] }) {
  const neto = sumarDinero(corresponde, -descuentos), entregado = sumarDinero(pagos.map(p => p.datos.monto));
  const pendiente = Math.round((neto - entregado) * 100) / 100;
  return { corresponde, descuentos, neto, entregado, pendiente, estado: entregado === 0 ? (neto > 0 ? "sin_pagar" : "nada") : pendiente > 0.004 ? "parcial" : pendiente < -0.004 ? "de_mas" : "pagado" };
}

// ── Abonos a un préstamo: cada uno es un movimiento ────────────────────────
// El saldo de un préstamo NO se escribe: se calcula de sus abonos. Cada abono es
// un evento (`abono_prestamo`) con su propio identificador, así que dos aparatos
// sin señal que abonan al mismo préstamo dejan DOS abonos (los dos cuentan, y
// ninguno pisa al otro), y el mismo abono subido dos veces es uno solo. Un abono
// mal capturado se cancela o se corrige como cualquier evento: queda su historial.
// `abonado` en el préstamo guardado es sólo el punto de partida (lo que ya traía).
export const T_ABONO = "abono_prestamo";
export const abonosDe = (eventos, prestamoId) => vigentes(eventos).filter(e => e.tipo === T_ABONO && (!prestamoId || e.datos.prestamoId === prestamoId));
// Los préstamos con su saldo calculado. `eventos`: basta pasar los de tipo abono.
export function saldosDePrestamos(prestamos, eventos) {
  const por = new Map();
  for (const e of abonosDe(eventos)) { if (!por.has(e.datos.prestamoId)) por.set(e.datos.prestamoId, []); por.get(e.datos.prestamoId).push(e); }
  return (prestamos || []).map(p => {
    const evs = (por.get(p.id) || []).sort((a, b) => a.cuando.localeCompare(b.cuando));
    if (evs.length === 0) return p;
    const abonado = sumarDinero(p.abonado || 0, evs.map(e => e.datos.monto)), saldo = sumarDinero(p.monto || 0, -abonado);
    return { ...p, abonado, estado: saldo <= 0 || p.estado === "pagado" ? "pagado" : p.estado, _abonadoBase: p.abonado || 0, _estadoBase: p.estado, _abonos: evs.map(e => ({ ev: e.id, fecha: e.fecha, monto: e.datos.monto, semana: e.datos.semana || null, nota: e.datos.nota || "", por: e.quien?.nombre || "" })),
      // Se abonó más de lo que debía (dos aparatos a la vez, por ejemplo): no se recorta ni se esconde.
      ...(saldo < -0.004 ? { _deMas: -saldo } : {}) };
  });
}
// Al guardar el préstamo (cancelarlo, editar su nota) no se guarda lo calculado: su `abonado` y su `estado` de base se quedan como estaban.
export function paraGuardarPrestamo(p) {
  if (!p || p._abonos === undefined) return p;
  const { _abonadoBase, _estadoBase, _abonos, _deMas, ...resto } = p;
  return { ...resto, abonado: _abonadoBase, estado: _estadoBase };
}
// Abonar a los préstamos de una persona, el más viejo primero. `prestamos`: los suyos, activos, YA con saldo calculado.
// `semana` { desde, hasta }: si el abono sale de lo que ganó esa semana (así lo encuentra el cálculo de la semana, sin importar el orden).
export function abonar({ permitido, prestamos, monto, semana = null, nota = "", quien, cuando, fecha, azar }) {
  let resto = Math.round(Number(monto) * 100) / 100; const eventos = []; let k = 0;
  { const no = negado(quien, permitido, "Un abono a un préstamo lo registra un administrador."); if (no) return { ok: false, dice: no }; }
  if (!(resto > 0)) return { ok: false, dice: "Falta cuánto se abona." };
  for (const pr of [...(prestamos || [])].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""))) {
    const saldo = Math.max(0, sumarDinero(pr.monto || 0, -(pr.abonado || 0))), abono = Math.min(saldo, resto);
    if (!(abono > 0)) continue;
    eventos.push(nuevoEvento({ tipo: T_ABONO, cuando, fecha, quien, azar: azar != null ? azar + (k++) / 1e9 : undefined, datos: { prestamoId: pr.id, trabajadorId: pr.trabajadorId, monto: abono, ...(semana ? { semana: { desde: semana.desde, hasta: semana.hasta } } : {}), nota: limpio(nota) } }));
    resto = sumarDinero(resto, -abono);
  }
  if (eventos.length === 0) return { ok: false, dice: "Esa persona no tiene saldo de préstamo al que abonarle." };
  return { ok: true, eventos, abonado: sumarDinero(eventos.map(e => e.datos.monto)), sobrante: resto, avisos: resto > 0 ? [`Sobraron ${resto}: no se abona más de lo que debe.`] : [] };
}
// Lo abonado por una persona con cargo a UNA semana. (Lee también los abonos que antes se anotaban dentro del préstamo.)
export const abonosDeSemana = (eventos, prestamos, trabajadorId, desde, hasta) => abonosDe(eventos).filter(e => e.datos.trabajadorId === trabajadorId && e.datos.semana?.desde === desde && e.datos.semana?.hasta === hasta).map(e => ({ id: e.id, fecha: e.fecha, monto: e.datos.monto, prestamoId: e.datos.prestamoId }))
  .concat((prestamos || []).filter(p => p.trabajadorId === trabajadorId && !p.cancelado).flatMap(p => (p.abonos || []).filter(a => a.semana?.desde === desde && a.semana?.hasta === hasta).map(a => ({ ...a, prestamoId: p.id }))));

// ── Recibos internos ───────────────────────────────────────────────────────
// Un recibo emitido no se modifica. Si algo cambia, se emite OTRO, con el
// número de versión siguiente y diciendo a cuál sustituye; el anterior se queda.
export const LEYENDA_RECIBO = "Recibo interno de control. No es un CFDI de nómina ni sustituye ningún comprobante o documento que la ley exija.";
export const LEYENDA_CUADRILLA = "Constancia de entrega al responsable de la cuadrilla. No acredita el pago individual a cada integrante ni sustituye las obligaciones laborales o fiscales que correspondan.";
export const recibosDe = (eventos, a, { desde, hasta } = {}) => vigentes(eventos).filter(e => e.tipo === T_RECIBO && e.datos.a.id === a.id && e.datos.a.tipo === a.tipo && (!desde || e.datos.desde === desde) && (!hasta || e.datos.hasta === hasta)).sort((x, y) => x.datos.version - y.datos.version);
export function emitirRecibo({ permitido, eventos, a, clase, desde, hasta, conceptos, saldo, pagos = [], autorizaciones = [], responsable = "", motivo = "", pdf = null, quien, cuando, fecha, azar }) {
  { const no = negado(quien, permitido, "Un recibo lo emite un administrador."); if (no) return { ok: false, dice: no }; }
  if (!a?.id || !CLASES_DE_PERSONAL[clase]) return { ok: false, dice: "Falta decir de quién es el recibo." };
  if (!Array.isArray(conceptos) || conceptos.length === 0) return { ok: false, dice: "No hay nada que recibir en esa semana." };
  const previos = recibosDe(eventos, a, { desde, hasta }); const ultimo = previos[previos.length - 1];
  if (ultimo && !limpio(motivo)) return { ok: false, dice: "Ya hay un recibo de esa semana. Para emitir otro hay que decir qué cambió." };
  const version = (ultimo?.datos.version || 0) + 1;
  return { ok: true, evento: nuevoEvento({ tipo: T_RECIBO, cuando, fecha, quien, azar, origen: ultimo?.id || null, relacion: ultimo ? "sustituye" : null,
    datos: { a: { tipo: a.tipo, id: a.id, nombre: limpio(a.nombre) }, clase, desde, hasta, version, sustituye: ultimo ? ultimo.datos.version : null, motivo: limpio(motivo), responsable: limpio(responsable),
      // La foto del momento: lo que decía cuando se emitió. Lo que cambie después NO lo cambia.
      conceptos: conceptos.map(c => ({ fecha: c.fecha, que: c.que, monto: c.monto, como: c.como || "" })), saldo: { ...saldo },
      pagos: pagos.map(p => ({ ev: p.id, fecha: p.fecha, monto: p.datos.monto, medio: p.datos.medio, recibe: p.datos.recibe || "", comprobante: p.datos.comprobante || null })), autorizaciones,
      leyenda: clase === "cuadrilla" ? LEYENDA_CUADRILLA : LEYENDA_RECIBO,
      // El archivo PDF de ESTA versión (lo arma quien llama, con `pdf(datos)`): se guarda junto con la foto de los datos.
      ...(typeof pdf === "function" ? { pdf: pdf({ version, sustituye: ultimo ? ultimo.datos.version : null, motivo: limpio(motivo) }) } : {}) } }) };
}
// ¿Lo que dice el último recibo sigue siendo lo que hoy se calcula? Si no, se avisa: el recibo NO se cambia solo.
export function reciboAlDia(recibo, saldoHoy) {
  if (!recibo) return { hay: false };
  const s = recibo.datos.saldo;
  const cambio = Math.abs((s.corresponde || 0) - saldoHoy.corresponde) > 0.004 || Math.abs((s.entregado || 0) - saldoHoy.entregado) > 0.004;
  return { hay: true, alDia: !cambio, dice: cambio ? `El recibo versión ${recibo.datos.version} decía ${s.corresponde} ganado y ${s.entregado} entregado; hoy son ${saldoHoy.corresponde} y ${saldoHoy.entregado}. El recibo no se cambia: si hace falta, se emite otro.` : "" };
}

// ── Horas adicionales: registradas no es reconocidas, y reconocidas no es pagadas ──
export function reconocerHoras({ permitido, trabajadorId, desde, hasta, horas, tratamiento, autorizo, quien, cuando, fecha, azar }) {
  const h = Number(horas);
  { const no = negado(quien, permitido, "Reconocer horas lo hace un administrador."); if (no) return { ok: false, dice: no }; }
  if (!trabajadorId || !desde || !hasta) return { ok: false, dice: "Falta de quién y de qué fechas." };
  if (!(h > 0)) return { ok: false, dice: "Falta cuántas horas se reconocen." };
  if (!limpio(tratamiento)) return { ok: false, dice: "Falta decir qué se va a hacer con ellas." };
  if (!limpio(autorizo)) return { ok: false, dice: "Falta quién lo autoriza." };
  return { ok: true, evento: nuevoEvento({ tipo: T_HORAS, cuando, fecha, quien, azar, datos: { trabajadorId, desde, hasta, horas: h, tratamiento: limpio(tratamiento), autorizo: limpio(autorizo) } }) };
}
// Por trabajador: lo registrado (sale solo de las marcas), lo reconocido, y lo que sigue sin tratar.
export function cuentaDeHoras(adicionales, eventos, { trabajadorId, desde, hasta } = {}) {
  const mias = (adicionales || []).filter(h => (!trabajadorId || h.trabajadorId === trabajadorId) && (!desde || h.fecha >= desde) && (!hasta || h.fecha <= hasta));
  const rec = vigentes(eventos).filter(e => e.tipo === T_HORAS && (!trabajadorId || e.datos.trabajadorId === trabajadorId) && (!desde || e.datos.hasta >= desde) && (!hasta || e.datos.desde <= hasta));
  const registradas = mias.reduce((s, h) => s + h.minutos, 0), reconocidas = Math.round(rec.reduce((s, e) => s + e.datos.horas, 0) * 60);
  return { dias: mias, registradas, reconocidas, sinTratar: Math.max(0, registradas - reconocidas), reconocimientos: rec.map(e => ({ ev: e.id, ...e.datos, por: e.quien?.nombre || "" })) };
}
export { rastroDe };
