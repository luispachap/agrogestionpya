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
//
//  Autorizar, rechazar, entregar y abonar son operaciones sensibles: las
//  valida la base con la cuenta que las sube (hoja 39).
// ════════════════════════════════════════════════════════════════════════
import { nuevoEvento, vigentes, negado } from "./eventos.js";
import { sumarDinero } from "./calculos.js";

export const T_SOLICITUD = "prestamo_solicitud", T_AUTORIZACION = "prestamo_autorizacion", T_RECHAZO = "prestamo_rechazo", T_ENTREGA = "prestamo_entrega";
export const ESTADOS_DE_PRESTAMO = { solicitado: "Solicitado: falta que lo autoricen", rechazado: "No se autorizó", autorizado: "Autorizado: falta entregar el dinero", activo: "Entregado: debe", pagado: "Pagado" };
const limpio = (s) => String(s || "").trim();
const peso = (n) => Math.round(Number(n) * 100) / 100;

export function solicitarPrestamo({ trabajador, monto, motivo, quien, cuando, fecha, azar }) {
  const m = peso(monto);
  if (!quien?.id) return { ok: false, dice: "Falta quién lo solicita." };
  if (!trabajador?.id) return { ok: false, dice: "Falta para quién es." };
  if (!(m > 0)) return { ok: false, dice: "Falta cuánto se pide." };
  if (!limpio(motivo)) return { ok: false, dice: "Falta para qué es." };
  return { ok: true, evento: nuevoEvento({ tipo: T_SOLICITUD, cuando, fecha, quien, azar, datos: { trabajadorId: trabajador.id, nombre: limpio(trabajador.nombre), monto: m, motivo: limpio(motivo) } }) };
}

// Los préstamos, armados de sus eventos. Tienen la forma de siempre (`monto`, `abonado`, `estado`)
// para que el resto de la app los lea igual; `monto` es lo ENTREGADO (lo que de verdad se debe).
export function prestamosDe(eventos) {
  const v = vigentes(eventos), de = (tipo) => v.filter(e => e.tipo === tipo).sort((a, b) => a.cuando.localeCompare(b.cuando));
  const aut = new Map(), rech = new Map(), ent = new Map();
  for (const e of de(T_AUTORIZACION)) aut.set(e.datos.solicitudId, e);          // si hubiera dos (dos aparatos), vale la última
  for (const e of de(T_RECHAZO)) rech.set(e.datos.solicitudId, e);
  for (const e of de(T_ENTREGA)) { if (!ent.has(e.datos.solicitudId)) ent.set(e.datos.solicitudId, []); ent.get(e.datos.solicitudId).push(e); }
  return de(T_SOLICITUD).map(s => {
    const a = aut.get(s.id) || null, r = rech.get(s.id) || null, entregas = a ? ent.get(s.id) || [] : [];
    const autorizado = a ? a.datos.monto : 0, entregado = sumarDinero(entregas.map(e => e.datos.monto));
    return { id: s.id, _deEventos: true, trabajadorId: s.datos.trabajadorId, fecha: s.fecha, motivo: s.datos.motivo, solicito: s.quien?.nombre || "",
      solicitado: s.datos.monto, autorizado, entregado, porEntregar: Math.max(0, sumarDinero(autorizado, -entregado)),
      monto: entregado, abonado: 0, estado: a ? (entregado > 0 ? "activo" : "autorizado") : r ? "rechazado" : "solicitado",
      autorizacion: a ? { ev: a.id, por: a.datos.autorizo, fecha: a.fecha, condiciones: a.datos.condiciones || "", abonoSemanal: a.datos.abonoSemanal ?? null } : null,
      rechazo: !a && r ? { ev: r.id, por: r.quien?.nombre || "", fecha: r.fecha, motivo: r.datos.motivo } : null,
      entregas: entregas.map(e => ({ ev: e.id, fecha: e.fecha, monto: e.datos.monto, medio: e.datos.medio, recibe: e.datos.recibe || "", comprobante: e.datos.comprobante || null, por: e.quien?.nombre || "" })) };
  });
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
export function entregarPrestamo({ permitido, eventos, solicitudId, monto, medio, recibe = "", comprobante = null, quien, cuando, fecha, azar }) {
  const m = peso(monto), p = elDe(eventos, solicitudId);
  { const no = negado(quien, permitido, "La entrega de un préstamo la registra un administrador."); if (no) return { ok: false, dice: no }; }
  if (!p || !p.autorizacion) return { ok: false, dice: "Ese préstamo no está autorizado: no se entrega dinero de algo que nadie autorizó." };
  if (!(m > 0)) return { ok: false, dice: "Falta cuánto se entregó." };
  if (m > p.porEntregar + 0.004) return { ok: false, dice: `Se autorizaron ${p.autorizado} y ya se entregaron ${p.entregado}: quedan ${p.porEntregar} por entregar. Para dar más hace falta otra autorización.` };
  if (!limpio(medio)) return { ok: false, dice: "Falta por qué medio se entregó." };
  const avisos = comprobante ? [] : ["Quedó sin comprobante de la entrega."];
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T_ENTREGA, cuando, fecha, quien, azar, origen: solicitudId, relacion: "entrega",
    datos: { solicitudId, trabajadorId: p.trabajadorId, monto: m, medio, recibe: limpio(recibe), ...(comprobante ? { comprobante } : {}) } }) };
}
