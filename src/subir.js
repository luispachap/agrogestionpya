// ════════════════════════════════════════════════════════════════════════
//  SUBIR UN REGISTRO a la base, como la base lo acepta.
//
//  Salió de dataApi.js para poder probarlo contra una base de verdad
//  (pruebas/base/contrato.test.mjs) con el mismo código que usa la app:
//  la imitación de las pantallas no tiene las reglas de acceso de la base,
//  y por eso el 24 nov nadie había visto que el chat y lo cancelado no subían.
//
//  Tres maneras, según lo que la base deja hacer con cada cosa:
//    · un EVENTO nace una sola vez y después sólo se cancela o se corrige
//      (subirEvento.js);
//    · un renglón de la BITÁCORA DE AUDITORÍA sólo se da de alta: la base no
//      deja cambiarlo ni a un superadministrador;
//    · lo demás se sube encima de lo que haya (alta o corrección).
//
//  Y una regla para todas: subir dos veces lo mismo es subirlo una vez. Con
//  mala señal la base puede guardar y la respuesta no llegar; el teléfono lo
//  vuelve a intentar, y ese segundo intento no puede ser un rechazo («no se
//  pudo subir» para siempre de algo que sí subió).
//
//  `cliente` (lo pone dataApi con supabase-js, o la prueba con la base aislada):
//    upsert(tabla, fila, { soloFaltantes, regresar }) · update(tabla, fila, { regresar })
//    insert(tabla, fila, { regresar }) · leer(tabla, id)  → cada uno { data, error }
// ════════════════════════════════════════════════════════════════════════
import { objetoAFila, filaAObjeto, DEL_SERVIDOR } from "./filas.js";
import { UNIONES_DE_REGISTROS } from "./calculos.js";
import { subirEvento } from "./subirEvento.js";

// Lo que la base sólo deja dar de alta (no tiene regla para cambiarlo).
export const SOLO_ALTA = ["auditoria"];

// Lo mismo que cuida la base (hoja 56): si lo guardado lleva marca de nacimiento, lo que llega tiene que traer la misma.
export function mismoRegistro(guardado, local) {
  const vieja = guardado?._nace ?? guardado?.datos?._nace ?? null;
  if (!vieja) return true;
  return vieja === (local?._nace ?? null);
}
export function errorOcupado(tabla, id) {
  const e = new Error(`identificador_ocupado: ya existe otro registro con el identificador "${id}" en ${tabla}. No se sobrescribió.`);
  e.code = "23505";
  return e;
}

// ¿Lo que está en la base es exactamente lo que este teléfono quiere subir? (sin las marcas de hora y lo que pone la base)
function canonico(v) {
  if (Array.isArray(v)) return v.map(canonico);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => [k, canonico(v[k])]));
  return v;
}
function sinLoDeLaBase(obj) {
  const o = { ...obj };
  for (const k of ["_actualizado", "_borrado", ...DEL_SERVIDOR]) delete o[k];
  for (const k of Object.keys(o)) if (o[k] === null || o[k] === undefined) delete o[k];
  return o;
}
export function mismoContenido(tabla, guardado, obj) {
  const local = sinLoDeLaBase(filaAObjeto(JSON.parse(JSON.stringify(objetoAFila(tabla, obj)))));
  const nube = sinLoDeLaBase(filaAObjeto(guardado));
  return JSON.stringify(canonico(local)) === JSON.stringify(canonico(nube));
}
const esRechazoDePermiso = (e) => e?.code === "42501" || /row-level security/i.test(e?.message || "");

// Subir encima. Si la base lo rechaza por permiso pero lo que ya tiene es EXACTAMENTE esto, es el reintento de un alta
// que sí llegó (la respuesta se perdió) hecho por una cuenta que puede dar de alta y no corregir: no es un rechazo.
// Si lo de la base es distinto, es una corrección que esta cuenta no puede hacer, y se dice.
async function subirEncima(cliente, tabla, obj) {
  const fila = objetoAFila(tabla, obj);
  const { error } = await cliente.upsert(tabla, fila, {});
  if (!error) return null;
  if (!esRechazoDePermiso(error)) throw error;
  const ya = await cliente.leer(tabla, fila.id);
  if (ya.error || !ya.data) throw error;
  // Otro registro en ese identificador: se dice como ocupado, para que el teléfono reubique el suyo y no lo pierda.
  if (!mismoRegistro(filaAObjeto(ya.data), obj)) throw errorOcupado(tabla, fila.id);
  if (mismoContenido(tabla, ya.data, obj)) return null;
  throw error;
}

// Alta que, si ya estaba, no hace nada: es el mismo registro que subió en un intento anterior.
// Si en ese identificador hay OTRO registro, se dice como la base lo dice (para que el teléfono lo reubique).
export async function altaUnaVez(cliente, tabla, fila, obj) {
  const r = await cliente.upsert(tabla, fila, { soloFaltantes: true, regresar: true });
  if (r.error) throw r.error;
  if (r.data && r.data.length) return r.data[0];
  const ya = await cliente.leer(tabla, fila.id);
  if (ya.error) throw ya.error;
  if (!ya.data) {
    // No entró y no se puede leer: la base lo rechazó sin decirlo. No se da por subido.
    const e = new Error(`La base no guardó el registro ${fila.id} de ${tabla} y no deja verlo.`);
    e.code = "42501";
    throw e;
  }
  if (!mismoRegistro(filaAObjeto(ya.data), obj)) throw errorOcupado(tabla, fila.id);
  return ya.data;
}

// Devuelve el renglón que quedó en la base cuando la base lo regresa (los eventos, para traer su sello), o null.
export async function subirRegistro(cliente, tabla, obj) {
  if (tabla === "eventos") {
    const c = {
      alta: (f) => altaUnaVez(cliente, "eventos", f, obj),
      update: (f) => cliente.update("eventos", f, { regresar: true }),
      insert: (f) => cliente.insert("eventos", f, { regresar: true }),
    };
    return subirEvento(c, obj, (o) => objetoAFila("eventos", o));
  }
  const fila = objetoAFila(tabla, obj);
  if (SOLO_ALTA.includes(tabla)) return altaUnaVez(cliente, tabla, fila, obj);
  if (UNIONES_DE_REGISTROS[tabla]) {
    // Antes de subir un crédito se lee el de la nube y se UNEN sus abonos: si otro aparato registró un abono mientras
    // éste estaba sin señal, subir encima lo borraba (dinero pagado que desaparecía).
    const ya = await cliente.leer(tabla, fila.id);
    if (ya.error) throw ya.error;
    if (ya.data) {
      return subirEncima(cliente, tabla, UNIONES_DE_REGISTROS[tabla].unir(obj, filaAObjeto(ya.data)));
    }
  }
  return subirEncima(cliente, tabla, obj);
}
