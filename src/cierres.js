// ════════════════════════════════════════════════════════════════════════
//  CIERRE DE LA SEMANA — y, aparte, la confirmación de los pagos
//
//  Son DOS cosas:
//    cerrar el cálculo     "esto es lo que le corresponde a cada quien esta
//                          semana". Queda una foto (`cierre_semana`).
//    confirmar los pagos   "esto es lo que de verdad se entregó"
//                          (`confirmacion_pagos`). Se hace después y aparte.
//  Cerrar no borra ni congela los hechos: lo que se registre después (una
//  falta que se justifica, una marca que llegó tarde de un teléfono sin señal)
//  sigue entrando, y se enseña como DIFERENCIA contra la foto del cierre.
//  Para volver a trabajar la semana se reabre (`reapertura_semana`) con motivo;
//  al cerrar otra vez nace una versión nueva y la anterior se queda.
//  Sólo cierra quien tiene ESE permiso (lo asigna un administrador a una cuenta, y lo comprueba la base).
// ════════════════════════════════════════════════════════════════════════
import { nuevoEvento, vigentes, negado } from "./eventos.js";
import { sumarDinero, fmt } from "./calculos.js";
import { momentoDe } from "./movimientos.js";
// El orden entre un cierre y su reapertura sale de la hora CORREGIDA de cada teléfono (`momentoDe`: con su desfase contra
// el servidor), no del reloj de cada uno: con dos teléfonos con la hora distinta, una reapertura hecha DESPUÉS de un
// cierre podía quedar «antes» y no contar (se veía cerrada aunque alguien la reabrió).
const t_ = (e) => momentoDe(e).t, enOrden = (a, b) => (t_(a) - t_(b)) || String(a.id).localeCompare(String(b.id));


export const T_CIERRE = "cierre_semana", T_REAPERTURA = "reapertura_semana", T_CONFIRMACION = "confirmacion_pagos";
const limpio = (s) => String(s || "").trim();
// `permitido`: lo que la base dijo de la cuenta de este aparato para «cerrar_semana». No basta el perfil:
// es un permiso que un administrador le asigna a una cuenta. Sin servidor, manda el perfil con que se entró.
export const puedeCerrar = (quien, permitido) => !negado(quien, permitido, "no");
const deLaSemana = (eventos, tipo, desde, hasta) => vigentes(eventos).filter(e => e.tipo === tipo && e.datos.desde === desde && e.datos.hasta === hasta).sort(enOrden);
export const cierresDe = (eventos, desde, hasta) => deLaSemana(eventos, T_CIERRE, desde, hasta).map((e, i) => ({ ...e, version: i + 1 }));
export const reaperturasDe = (eventos, desde, hasta) => deLaSemana(eventos, T_REAPERTURA, desde, hasta);
export const confirmacionesDe = (eventos, desde, hasta) => deLaSemana(eventos, T_CONFIRMACION, desde, hasta).map((e, i) => ({ ...e, version: i + 1 }));

// En qué está la semana. La versión se cuenta al leer (no depende de qué aparato cerró primero).
export function estadoDeSemana(eventos, desde, hasta) {
  const cierres = cierresDe(eventos, desde, hasta), reap = reaperturasDe(eventos, desde, hasta), conf = confirmacionesDe(eventos, desde, hasta);
  const ultimo = cierres[cierres.length - 1] || null, ultimaReap = reap[reap.length - 1] || null;
  const reabierta = !!ultimo && !!ultimaReap && enOrden(ultimaReap, ultimo) > 0;
  return { estado: !ultimo ? "abierta" : reabierta ? "reabierta" : "cerrada", cierre: ultimo, cierres, reaperturas: reap,
    confirmacion: conf.filter(c => ultimo && c.datos.cierre === ultimo.id).pop() || null, confirmaciones: conf };
}

// `renglones`: [{ a: {tipo,id,nombre}, corresponde, descuentos, neto }] — lo calculado en ese momento.
export function cerrarSemana({ eventos, desde, hasta, renglones, motivo = "", quien, permitido, cuando, fecha, azar }) {
  { const no = negado(quien, permitido, "La semana la cierra un administrador o alguien autorizado para eso."); if (no) return { ok: false, dice: no }; }
  if (!desde || !hasta) return { ok: false, dice: "Falta la semana." };
  const s = estadoDeSemana(eventos, desde, hasta);
  if (s.estado === "cerrada") return { ok: false, dice: "Esa semana ya está cerrada. Para cambiarla hay que reabrirla y decir por qué." };
  if (s.estado === "reabierta" && !limpio(motivo)) return { ok: false, dice: "Es un cierre nuevo de una semana reabierta: hay que decir qué cambió." };
  const foto = (renglones || []).map(r => ({ a: { tipo: r.a.tipo, id: r.a.id, nombre: r.a.nombre }, corresponde: r.corresponde, descuentos: r.descuentos || 0, neto: r.neto }));
  return { ok: true, evento: nuevoEvento({ tipo: T_CIERRE, cuando, fecha, quien, azar, origen: s.cierre?.id || null, relacion: s.cierre ? "sustituye" : null,
    datos: { desde, hasta, motivo: limpio(motivo), renglones: foto, total: sumarDinero(foto.map(r => r.corresponde)), totalNeto: sumarDinero(foto.map(r => r.neto)) } }) };
}
export function reabrirSemana({ eventos, desde, hasta, motivo, quien, permitido, cuando, fecha, azar }) {
  { const no = negado(quien, permitido, "La semana la reabre un administrador o alguien autorizado para eso."); if (no) return { ok: false, dice: no }; }
  const s = estadoDeSemana(eventos, desde, hasta);
  if (s.estado !== "cerrada") return { ok: false, dice: "Esa semana no está cerrada." };
  if (!limpio(motivo)) return { ok: false, dice: "Para reabrir hay que decir por qué." };
  return { ok: true, evento: nuevoEvento({ tipo: T_REAPERTURA, cuando, fecha, quien, azar, origen: s.cierre.id, relacion: "reabre", datos: { desde, hasta, motivo: limpio(motivo) } }) };
}

// Lo que cambió desde la foto del cierre. No corrige nada: lo enseña.
export function diferenciasDelCierre(cierre, renglonesHoy) {
  if (!cierre) return { hay: false, lista: [], total: 0 };
  const antes = new Map(cierre.datos.renglones.map(r => [`${r.a.tipo}|${r.a.id}`, r])), hoy = new Map((renglonesHoy || []).map(r => [`${r.a.tipo}|${r.a.id}`, r]));
  const lista = [];
  for (const k of new Set([...antes.keys(), ...hoy.keys()])) {
    const a = antes.get(k), h = hoy.get(k), era = a?.corresponde || 0, es = h?.corresponde || 0;
    if (Math.abs(es - era) > 0.004) lista.push({ a: (h || a).a, era, es, diferencia: sumarDinero(es, -era) });
  }
  return { hay: lista.length > 0, lista, total: sumarDinero(lista.map(l => l.diferencia)) };
}

// Confirmar los pagos de una semana YA cerrada: una foto de lo entregado contra lo cerrado.
// `renglones`: [{ a, neto, entregado, pendiente }]. Confirmar con pendientes se puede: queda dicho cuánto falta.
export function confirmarPagos({ eventos, desde, hasta, renglones, nota = "", quien, permitido, cuando, fecha, azar }) {
  { const no = negado(quien, permitido, "Los pagos los confirma un administrador o alguien autorizado para eso."); if (no) return { ok: false, dice: no }; }
  const s = estadoDeSemana(eventos, desde, hasta);
  if (s.estado !== "cerrada") return { ok: false, dice: "Primero se cierra el cálculo de la semana; los pagos se confirman después, aparte." };
  const foto = (renglones || []).map(r => ({ a: { tipo: r.a.tipo, id: r.a.id, nombre: r.a.nombre }, neto: r.neto, entregado: r.entregado, pendiente: r.pendiente }));
  const pendiente = sumarDinero(foto.filter(r => r.pendiente > 0).map(r => r.pendiente));
  if (pendiente > 0.004 && !limpio(nota)) return { ok: false, dice: `Todavía faltan ${fmt(pendiente)} por entregar. Se puede confirmar así, pero hay que anotar por qué.` };
  return { ok: true, evento: nuevoEvento({ tipo: T_CONFIRMACION, cuando, fecha, quien, azar, origen: s.cierre.id, relacion: "confirma",
    datos: { desde, hasta, cierre: s.cierre.id, nota: limpio(nota), renglones: foto, entregado: sumarDinero(foto.map(r => r.entregado)), pendiente } }) };
}
