// ════════════════════════════════════════════════════════════════════════
//  PRÉSTAMOS AL PERSONAL — cinco cosas que no son lo mismo
//
//    solicitud      alguien pide un préstamo para un trabajador. La registra
//                   cualquiera que capture (un encargado). No es deuda.
//    autorización   una cuenta con el permiso «autorizar préstamos» dice que
//                   sí, por cuánto y en qué condiciones. Todavía no hay dinero.
//    entrega        el dinero sale de verdad (puede ser en partes). Hasta aquí
//                   nace lo que el trabajador DEBE. Autorizado no es entregado.
//    abonos         cada uno es su propio movimiento (`abono_prestamo`).
//    saldo          entregado − abonado. Se calcula; nadie lo escribe.
//    lo de antes    lo que un trabajador ya debía cuando arrancó la app
//                   (`prestamo_saldo_inicial`): a una fecha de corte, con quién
//                   responde y su evidencia. Se abona igual; no es dinero que
//                   salió en el flujo, porque salió antes.
//
//  Autorizar, rechazar, entregar y abonar son operaciones sensibles: las
//  valida la base con la cuenta que las sube (hoja 39).
// ════════════════════════════════════════════════════════════════════════
import { nuevoEvento, vigentes, negado, corregirEvento } from "./eventos.js";
import { sumarDinero } from "./calculos.js";

export const T_SOLICITUD = "prestamo_solicitud", T_AUTORIZACION = "prestamo_autorizacion", T_RECHAZO = "prestamo_rechazo", T_ENTREGA = "prestamo_entrega", T_SALDO_INICIAL = "prestamo_saldo_inicial";
export const ESTADOS_DE_PRESTAMO = { solicitado: "Solicitado: falta que lo autoricen", rechazado: "No se autorizó", autorizado: "Autorizado: falta entregar el dinero", activo: "Entregado: debe", pagado: "Pagado" };
const limpio = (s) => String(s || "").trim();
const peso = (n) => Math.round(Number(n) * 100) / 100;

// `id`: cuando la solicitud es UN hecho con nombre propio (la de un mensaje dicho), para que confirmarla dos veces no haga dos.
export function solicitarPrestamo({ id, trabajador, monto, motivo, quien, cuando, fecha, azar }) {
  const m = peso(monto);
  if (!quien?.id) return { ok: false, dice: "Falta quién lo solicita." };
  if (!trabajador?.id) return { ok: false, dice: "Falta para quién es." };
  if (!(m > 0)) return { ok: false, dice: "Falta cuánto se pide." };
  if (!limpio(motivo)) return { ok: false, dice: "Falta para qué es." };
  return { ok: true, evento: nuevoEvento({ id, tipo: T_SOLICITUD, cuando, fecha, quien, azar, datos: { trabajadorId: trabajador.id, nombre: limpio(trabajador.nombre), monto: m, motivo: limpio(motivo) } }) };
}

// Los préstamos, armados de sus eventos. Tienen la forma de siempre (`monto`, `abonado`, `estado`)
// para que el resto de la app los lea igual; `monto` es lo ENTREGADO (lo que de verdad se debe).
export function prestamosDe(eventos) {
  const v = vigentes(eventos), de = (tipo) => v.filter(e => e.tipo === tipo).sort((a, b) => a.cuando.localeCompare(b.cuando));
  const aut = new Map(), rech = new Map(), ent = new Map();
  for (const e of de(T_AUTORIZACION)) aut.set(e.datos.solicitudId, e);          // si hubiera dos (dos aparatos), vale la última
  for (const e of de(T_RECHAZO)) rech.set(e.datos.solicitudId, e);
  for (const e of de(T_ENTREGA)) { if (!ent.has(e.datos.solicitudId)) ent.set(e.datos.solicitudId, []); ent.get(e.datos.solicitudId).push(e); }
  // Lo que ya se debía al arrancar: un préstamo que «debe» desde su fecha de corte, sin solicitud ni entrega inventadas.
  // Una cifra corregida es un evento nuevo que apunta al anterior: el préstamo conserva el identificador del PRIMERO,
  // para que los abonos que ya se le hicieron sigan siendo suyos.
  const porId = new Map((eventos || []).filter(e => e?.tipo === T_SALDO_INICIAL).map(e => [e.id, e]));
  const raiz = (e) => { let x = e, n = 0; while (x?.relacion === "corrige" && x.origen && n++ < 50) { const ant = porId.get(x.origen); if (!ant) return x.origen; x = ant; } return x.id; };
  const iniciales = de(T_SALDO_INICIAL).map(s => ({ id: raiz(s), ev: s.id, _deEventos: true, deAntes: true, trabajadorId: s.datos.trabajadorId, fecha: s.datos.fechaCorte, motivo: "Lo que debía al arrancar la app", solicito: s.quien?.nombre || "",
    solicitado: s.datos.monto, autorizado: s.datos.monto, entregado: s.datos.monto, porEntregar: 0, monto: s.datos.monto, abonado: 0, estado: "activo",
    autorizacion: { ev: s.id, por: s.datos.responsable, fecha: s.datos.fechaCorte, condiciones: s.datos.nota || "", abonoSemanal: s.datos.abonoSemanal ?? null },
    rechazo: null, entregas: [], saldoInicial: { ev: s.id, fechaCorte: s.datos.fechaCorte, responsable: s.datos.responsable, evidencia: s.datos.evidencia || null, anoto: s.quien?.nombre || "" } }));
  return iniciales.concat(de(T_SOLICITUD).map(s => {
    const a = aut.get(s.id) || null, r = rech.get(s.id) || null, entregas = a ? ent.get(s.id) || [] : [];
    const autorizado = a ? a.datos.monto : 0, entregado = sumarDinero(entregas.map(e => e.datos.monto));
    return { id: s.id, _deEventos: true, trabajadorId: s.datos.trabajadorId, fecha: s.fecha, motivo: s.datos.motivo, solicito: s.quien?.nombre || "",
      solicitado: s.datos.monto, autorizado, entregado, porEntregar: Math.max(0, sumarDinero(autorizado, -entregado)),
      monto: entregado, abonado: 0, estado: a ? (entregado > 0 ? "activo" : "autorizado") : r ? "rechazado" : "solicitado",
      autorizacion: a ? { ev: a.id, por: a.datos.autorizo, fecha: a.fecha, condiciones: a.datos.condiciones || "", abonoSemanal: a.datos.abonoSemanal ?? null } : null,
      rechazo: !a && r ? { ev: r.id, por: r.quien?.nombre || "", fecha: r.fecha, motivo: r.datos.motivo } : null,
      entregas: entregas.map(e => ({ ev: e.id, fecha: e.fecha, monto: e.datos.monto, medio: e.datos.medio, recibe: e.datos.recibe || "", comprobante: e.datos.comprobante || null, por: e.quien?.nombre || "" })) };
  }));
}
const elDe = (eventos, solicitudId) => prestamosDe(eventos).find(p => p.id === solicitudId);

export function autorizarPrestamo({ permitido, eventos, solicitudId, monto, condiciones = "", abonoSemanal = null, autorizo, quien, cuando, fecha, azar }) {
  const m = peso(monto), p = elDe(eventos, solicitudId);
  { const no = negado(quien, permitido, "Un préstamo lo autoriza un administrador."); if (no) return { ok: false, dice: no }; }
  if (!p) return { ok: false, dice: "Esa solicitud ya no existe." };
  if (p.estado !== "solicitado") return { ok: false, dice: p.estado === "rechazado" ? "Esa solicitud ya se rechazó. Si cambió la decisión, se pide otra vez." : "Esa solicitud ya está autorizada." };
  if (!(m > 0)) return { ok: false, dice: "Falta por cuánto se autoriza." };
  if (!limpio(autorizo)) return { ok: false, dice: "Falta quién lo autoriza." };
  const avisos = m > p.solicitado ? [`Se autorizó más de lo que se pidió (${p.solicitado}).`] : [];
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T_AUTORIZACION, cuando, fecha, quien, azar, origen: solicitudId, relacion: "autoriza",
    datos: { solicitudId, trabajadorId: p.trabajadorId, monto: m, condiciones: limpio(condiciones), abonoSemanal: abonoSemanal === "" || abonoSemanal == null ? null : peso(abonoSemanal), autorizo: limpio(autorizo) } }) };
}
export function rechazarPrestamo({ permitido, eventos, solicitudId, motivo, quien, cuando, fecha, azar }) {
  const p = elDe(eventos, solicitudId);
  { const no = negado(quien, permitido, "Una solicitud de préstamo la resuelve un administrador."); if (no) return { ok: false, dice: no }; }
  if (!p || p.estado !== "solicitado") return { ok: false, dice: "Esa solicitud ya está resuelta." };
  if (!limpio(motivo)) return { ok: false, dice: "Falta por qué no se autoriza." };
  return { ok: true, evento: nuevoEvento({ tipo: T_RECHAZO, cuando, fecha, quien, azar, origen: solicitudId, relacion: "rechaza", datos: { solicitudId, trabajadorId: p.trabajadorId, motivo: limpio(motivo) } }) };
}
// La entrega del dinero. Sólo de algo ya autorizado, y nunca más de lo autorizado.
export function entregarPrestamo({ eventos, solicitudId, ...resto }) { return entregaDe(elDe(eventos, solicitudId), resto); }
// La entrega de un préstamo ya armado (`p`). Prestar en un paso la usa con el préstamo que acaba de autorizar: con
// servidor, esa autorización todavía no trae el sello de la base y `prestamosDe` aún no la contaría.
function entregaDe(p, { permitido, monto, medio, recibe = "", comprobante = null, quien, cuando, fecha, azar }) {
  const m = peso(monto);
  { const no = negado(quien, permitido, "La entrega de un préstamo la registra un administrador."); if (no) return { ok: false, dice: no }; }
  if (!p || !p.autorizacion) return { ok: false, dice: "Ese préstamo no está autorizado: no se entrega dinero de algo que nadie autorizó." };
  if (!(m > 0)) return { ok: false, dice: "Falta cuánto se entregó." };
  if (m > p.porEntregar + 0.004) return { ok: false, dice: `Se autorizaron ${p.autorizado} y ya se entregaron ${p.entregado}: quedan ${p.porEntregar} por entregar. Para dar más hace falta otra autorización.` };
  if (!limpio(medio)) return { ok: false, dice: "Falta por qué medio se entregó." };
  const avisos = comprobante ? [] : ["Quedó sin comprobante de la entrega."];
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T_ENTREGA, cuando, fecha, quien, azar, origen: p.id, relacion: "entrega",
    datos: { solicitudId: p.id, trabajadorId: p.trabajadorId, monto: m, medio, recibe: limpio(recibe), ...(comprobante ? { comprobante } : {}) } }) };
}

// ── LO QUE YA SE DEBÍA AL ARRANCAR ──────────────────────────────────────────
// Un préstamo que se dio antes de la app (la nómina en papel lo descontaba cada semana) no se inventa con una solicitud,
// una autorización y una entrega que nadie hizo aquí: se anota lo que debía a una FECHA DE CORTE, quién responde por
// esa cifra y con qué evidencia (la hoja firmada). Nace «debe», se abona igual que cualquiera y NO es dinero que salió
// en el flujo: salió antes de la app. Uno por persona; una cifra mal anotada se corrige (con motivo), no se encima.
export function saldoInicialDePrestamo({ permitido, eventos = [], trabajador, monto, fechaCorte, responsable, evidencia = null, abonoSemanal = null, nota = "", quien, cuando, fecha, azar }) {
  const m = peso(monto);
  { const no = negado(quien, permitido, "Lo que un trabajador ya debía lo anota quien autoriza préstamos."); if (no) return { ok: false, dice: no }; }
  if (!trabajador?.id) return { ok: false, dice: "Falta de quién es la deuda." };
  if (!(m > 0)) return { ok: false, dice: "Falta cuánto debía al corte." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaCorte || ""))) return { ok: false, dice: "Falta la fecha de corte: a qué día corresponde ese saldo." };
  if (fecha && fechaCorte > fecha) return { ok: false, dice: "La fecha de corte no puede ser después de hoy." };
  if (!limpio(responsable)) return { ok: false, dice: "Falta quién responde por esa cifra." };
  const ab = abonoSemanal === "" || abonoSemanal == null ? null : peso(abonoSemanal);
  if (ab != null && !(ab > 0)) return { ok: false, dice: "El abono por semana, si se dice, es mayor a cero." };
  const ya = vigentes(eventos).find(e => e.tipo === T_SALDO_INICIAL && e.datos.trabajadorId === trabajador.id);
  if (ya) return { ok: false, dice: `${limpio(trabajador.nombre)} ya tiene anotado lo que debía al ${ya.datos.fechaCorte} (${ya.datos.monto}). Si esa cifra está mal, se corrige ésa, con su motivo.` };
  const avisos = evidencia ? [] : ["Quedó sin evidencia: conviene agregar la foto de la hoja firmada."];
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T_SALDO_INICIAL, cuando, fecha, quien, azar,
    datos: { trabajadorId: trabajador.id, nombre: limpio(trabajador.nombre), monto: m, fechaCorte, responsable: limpio(responsable), ...(evidencia ? { evidencia } : {}), abonoSemanal: ab, nota: limpio(nota) } }) };
}

// Una cifra mal anotada se corrige: nace otro evento con la cifra buena y su motivo, y el anterior queda como corregido
// (no se borra). Los abonos ya hechos siguen contando contra el préstamo.
export function corregirSaldoInicial({ permitido, evento, monto, motivo, quien, cuando, azar }) {
  { const no = negado(quien, permitido, "Lo que un trabajador ya debía lo corrige quien autoriza préstamos."); if (no) return { ok: false, dice: no }; }
  if (!evento || evento.tipo !== T_SALDO_INICIAL) return { ok: false, dice: "Eso no es un saldo de antes de la app." };
  const m = peso(monto); if (!(m > 0)) return { ok: false, dice: "Falta la cifra correcta." };
  if (m === evento.datos.monto) return { ok: false, dice: "Es la misma cifra que ya estaba." };
  return corregirEvento(evento, { datos: { monto: m } }, { motivo, quien, cuando, azar });
}

// ── PRESTAR EN UN SOLO PASO ─────────────────────────────────────────────────
// En papel, un préstamo es un renglón. Quien tiene los dos permisos (autorizar y entregar) lo hace en un paso, y la app
// guarda igual los TRES hechos de siempre —solicitud, autorización y entrega—, los tres a su nombre y a la misma hora:
// se lee, se valida en la base y se audita igual que uno hecho en tres pantallas. «En cuántas semanas» queda como el
// abono acordado por semana: una SUGERENCIA al pagar, nunca un descuento que se aplique solo.
export function prestarDeUnaVez({ permitidoAutorizar, permitidoEntregar, trabajador, monto, motivo, semanas = null, medio, recibe = "", comprobante = null, quien, cuando, fecha, azar }) {
  { const no = negado(quien, permitidoAutorizar, "Prestar en un paso lo hace quien autoriza préstamos. Sin ese permiso, el préstamo se pide y otro lo autoriza."); if (no) return { ok: false, dice: no }; }
  { const no = negado(quien, permitidoEntregar, "Prestar en un paso lo hace quien también registra la entrega del dinero."); if (no) return { ok: false, dice: no }; }
  const n = semanas === "" || semanas == null ? null : Number(semanas);
  if (n != null && !(Number.isInteger(n) && n >= 1 && n <= 104)) return { ok: false, dice: "En cuántas semanas lo paga: un número entero de semanas." };
  const s = solicitarPrestamo({ trabajador, monto, motivo, quien, cuando, fecha, azar }); if (!s.ok) return s;
  const m = s.evento.datos.monto, abonoSemanal = n ? Math.ceil(m / n * 100) / 100 : null;
  const a = autorizarPrestamo({ permitido: permitidoAutorizar, eventos: [s.evento], solicitudId: s.evento.id, monto: m, condiciones: n ? `Se paga en ${n} semana${n === 1 ? "" : "s"}` : "", abonoSemanal, autorizo: quien?.nombre || "", quien, cuando, fecha, azar }); if (!a.ok) return a;
  // La entrega se arma sobre lo que se acaba de autorizar (no se vuelve a leer de los eventos: con servidor, la
  // autorización recién hecha todavía no trae el sello de la base).
  const p = { id: s.evento.id, trabajadorId: trabajador.id, autorizacion: { ev: a.evento.id }, autorizado: m, entregado: 0, porEntregar: m };
  const e = entregaDe(p, { permitido: permitidoEntregar, monto: m, medio, recibe, comprobante, quien, cuando, fecha, azar }); if (!e.ok) return e;
  return { ok: true, eventos: [s.evento, a.evento, e.evento], avisos: e.avisos || [], abonoSemanal };
}

// El abono que se acordó por semana, para SUGERIRLO al pagar (nunca se aplica solo): de cada préstamo que todavía debe,
// su abono acordado sin pasar de lo que falta.
export function abonoAcordado(prestamos = []) {
  return sumarDinero((prestamos || []).filter(p => p.estado === "activo").map(p => {
    const falta = Math.max(0, sumarDinero(p.monto || 0, -(p.abonado || 0))), ab = Number(p.autorizacion?.abonoSemanal) || 0;
    return Math.min(falta, ab);
  }));
}
