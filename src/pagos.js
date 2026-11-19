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
import { nuevoEvento, vigentes, corregirEvento, rastroDe } from "./eventos.js";
import { sumarDinero, sueldoVigente, sumarDias } from "./calculos.js";

export const T_AUSENCIA = "ausencia", T_PAGO = "pago_personal", T_RECIBO = "recibo_personal", T_HORAS = "horas_reconocidas";
const PUEDE = ["admin", "encargado"];
const limpio = (s) => String(s || "").trim();
export const CLASES_AUSENCIA = {
  permiso: { nombre: "Permiso autorizado", paga: true, pideAutoriza: true },
  descanso: { nombre: "Descanso autorizado", paga: true, pideAutoriza: true },
  justificada: { nombre: "Ausencia justificada", paga: null, pideAutoriza: true },   // si se paga, lo dice quien la justifica
  falta: { nombre: "Falta sin justificar", paga: false, pideAutoriza: false },
};
export const SITUACIONES_SALIDA = { terminada: "Terminó su jornada", autorizada: "Salida autorizada", justificada: "Causa justificada", abandono: "Abandonó el trabajo", otra: "Otra situación" };
export const MEDIOS_DE_PAGO = { efectivo: "Efectivo", transferencia: "Transferencia", cheque: "Cheque", otro: "Otro" };
export const CLASES_DE_PERSONAL = { planta: "Trabajador de planta", cuadrilla: "Cuadrilla (entrega al responsable)", independiente: "Trabajador temporal independiente" };

// ── El calendario de cada quien ────────────────────────────────────────────
// 1 = lunes … 7 = domingo. Si no se ha dicho nada: de lunes a sábado.
export const DIAS_DE_SIEMPRE = [1, 2, 3, 4, 5, 6];
export const diaDeLaSemana = (fecha) => { const d = new Date(fecha + "T12:00:00Z").getUTCDay(); return d === 0 ? 7 : d; };
export const leToca = (trabajador, fecha) => (Array.isArray(trabajador?.diasAsistencia) && trabajador.diasAsistencia.length ? trabajador.diasAsistencia : DIAS_DE_SIEMPRE).includes(diaDeLaSemana(fecha));
export const diasEntre = (desde, hasta) => { const l = []; for (let f = desde; f <= hasta && l.length < 400; f = sumarDias(f, 1)) l.push(f); return l; };

// ── Ausencias ──────────────────────────────────────────────────────────────
export function registrarAusencia({ trabajadorId, desde, hasta, clase, paga, causa = "", autorizo = "", quien, cuando, capturado, azar }) {
  const c = CLASES_AUSENCIA[clase];
  if (!PUEDE.includes(quien?.rol)) return { ok: false, dice: "Una ausencia la registra un encargado o un administrador." };
  if (!trabajadorId) return { ok: false, dice: "Falta decir de quién." };
  if (!c) return { ok: false, dice: "Falta decir qué fue: permiso, descanso, ausencia justificada o falta." };
  if (!desde || (hasta && hasta < desde)) return { ok: false, dice: "Faltan las fechas." };
  if (c.pideAutoriza && !limpio(autorizo)) return { ok: false, dice: "Falta decir quién lo autorizó." };
  if (clase !== "falta" && !limpio(causa)) return { ok: false, dice: "Falta la causa." };
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
export function semanaDe({ trabajador, desde, hasta, hoy, devengado = [], actividades = [], ausencias = [] }) {
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
    // No vino y nadie ha dicho qué pasó. NO es una falta todavía: es una pregunta.
    return { ...base, estado: base.leToca ? "sin_registro" : "no_le_toca", monto: 0 };
  });
  return { trabajadorId: trabajador.id, dias, corresponde: sumarDinero(dias.map(d => d.monto)), trabajados: dias.filter(d => d.estado === "trabajo").length,
    pagadosSinTrabajar: dias.filter(d => d.estado === "ausencia_pagada").length, sinPago: dias.filter(d => d.estado === "ausencia_sin_pago").length,
    sinRegistro: dias.filter(d => d.estado === "sin_registro").map(d => d.fecha), provisional: dias.some(d => d.provisional) };
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
export function registrarPago({ a, desde, hasta, monto, medio, recibe = "", comprobante = null, nota = "", corresponde = null, quien, cuando, fecha, azar }) {
  const m = Number(monto);
  if (quien?.rol !== "admin") return { ok: false, dice: "Un pago lo registra un administrador." };
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

// ── Recibos internos ───────────────────────────────────────────────────────
// Un recibo emitido no se modifica. Si algo cambia, se emite OTRO, con el
// número de versión siguiente y diciendo a cuál sustituye; el anterior se queda.
export const LEYENDA_RECIBO = "Recibo interno de control. No es un CFDI de nómina ni sustituye ningún comprobante o documento que la ley exija.";
export const LEYENDA_CUADRILLA = "Constancia de entrega al responsable de la cuadrilla. No acredita el pago individual a cada integrante ni sustituye las obligaciones laborales o fiscales que correspondan.";
export const recibosDe = (eventos, a, { desde, hasta } = {}) => vigentes(eventos).filter(e => e.tipo === T_RECIBO && e.datos.a.id === a.id && e.datos.a.tipo === a.tipo && (!desde || e.datos.desde === desde) && (!hasta || e.datos.hasta === hasta)).sort((x, y) => x.datos.version - y.datos.version);
export function emitirRecibo({ eventos, a, clase, desde, hasta, conceptos, saldo, pagos = [], autorizaciones = [], responsable = "", motivo = "", quien, cuando, fecha, azar }) {
  if (quien?.rol !== "admin") return { ok: false, dice: "Un recibo lo emite un administrador." };
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
      leyenda: clase === "cuadrilla" ? LEYENDA_CUADRILLA : LEYENDA_RECIBO } }) };
}
// ¿Lo que dice el último recibo sigue siendo lo que hoy se calcula? Si no, se avisa: el recibo NO se cambia solo.
export function reciboAlDia(recibo, saldoHoy) {
  if (!recibo) return { hay: false };
  const s = recibo.datos.saldo;
  const cambio = Math.abs((s.corresponde || 0) - saldoHoy.corresponde) > 0.004 || Math.abs((s.entregado || 0) - saldoHoy.entregado) > 0.004;
  return { hay: true, alDia: !cambio, dice: cambio ? `El recibo versión ${recibo.datos.version} decía ${s.corresponde} ganado y ${s.entregado} entregado; hoy son ${saldoHoy.corresponde} y ${saldoHoy.entregado}. El recibo no se cambia: si hace falta, se emite otro.` : "" };
}

// ── Horas adicionales: registradas no es reconocidas, y reconocidas no es pagadas ──
export function reconocerHoras({ trabajadorId, desde, hasta, horas, tratamiento, autorizo, quien, cuando, fecha, azar }) {
  const h = Number(horas);
  if (quien?.rol !== "admin") return { ok: false, dice: "Reconocer horas lo hace un administrador." };
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
