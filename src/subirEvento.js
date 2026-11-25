// ════════════════════════════════════════════════════════════════════════
//  SUBIR UN EVENTO como la base lo pide (hojas 35 y 37).
//
//  La base sólo deja que un evento NAZCA vigente. Cancelarlo o corregirlo es
//  CAMBIARLO después, y eso lo revisa otra regla (quién puede editar y qué
//  campos pueden cambiar). El problema: PostgreSQL revisa la regla de «nacer
//  vigente» también cuando se sube con upsert y el evento ya existía, así que
//  subir un evento cancelado o corregido con upsert SIEMPRE lo rechazaba
//  (24 nov, primera prueba en teléfonos de verdad: una marca corregida se
//  quedó «sin subir»). Por eso:
//    · vigente → se da de ALTA una vez: si ya estaba (un intento anterior sí
//      llegó y su respuesta no), no se toca y se trae el que está, con su sello;
//    · cancelado o corregido → se ACTUALIZA el que ya está en la base;
//    · y si todavía no estaba (se creó y se canceló sin señal), primero nace
//      vigente y luego se cambia: la base ve los dos pasos y guarda quién.
//  Puro: el cliente de la base se le pasa, para poder probarlo sin nube.
// ════════════════════════════════════════════════════════════════════════
import { CAMPOS_QUE_CAMBIAN } from "./eventos.js";

const VIGENTE = "vigente";

// Cómo nació el evento: el mismo, sin lo que se le agregó al cancelarlo o corregirlo.
export function versionAlNacer(evento) {
  const o = { ...evento, estado: VIGENTE };
  for (const k of CAMPOS_QUE_CAMBIAN) if (k !== "estado" && k !== "_actualizado") delete o[k];
  return o;
}

// cliente: { alta(fila) → renglón que quedó (o lanza), update(fila) → { data, error } }
// aFila: convierte el evento de la app en el renglón de la base.
export async function subirEvento(cliente, evento, aFila) {
  if ((evento?.estado || VIGENTE) === VIGENTE) return (await cliente.alta(aFila(evento))) || null;
  const fila = aFila(evento);
  let r = await cliente.update(fila);
  if (r.error) throw r.error;
  if (r.data && r.data.length) return r.data[0];
  // No cambió nada: o no estaba en la base, o esta cuenta no lo puede cambiar. Primero que exista (nace vigente;
  // si ya estaba, no se toca), y luego el cambio.
  await cliente.alta(aFila(versionAlNacer(evento)));
  r = await cliente.update(fila);
  if (r.error) throw r.error;
  if (r.data && r.data.length) return r.data[0];
  // Ya existe y la actualización no tocó nada: la regla de la base no deja que esta cuenta lo cambie. Es un rechazo,
  // no falta de señal.
  const e = new Error("La base no dejó cambiar este evento: esta cuenta no tiene permiso para cancelarlo o corregirlo.");
  e.code = "42501";
  throw e;
}
