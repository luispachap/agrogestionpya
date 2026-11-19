// ============================================================
//  AgroGestión — Adaptador de datos para Supabase
//
//  Funciones para leer y escribir las colecciones de la app
//  en la base de datos. Sigue el patrón de columnas reales +
//  columna "datos" tipo JSON que definimos en el esquema SQL.
//
//  IMPORTANTE: este módulo no decide CUÁNDO se llama. Solo
//  sabe leer y escribir cuando alguien se lo pide. La lógica
//  de cuándo usarlo vive en App.jsx.
// ============================================================

import { objetoAFila, filaAObjeto } from "./filas.js";
import { supabase, supabaseListo } from "./supabase";

// ------------------------------------------------------------
//  Mapeo: nombre de colección → nombre de tabla en Supabase
//  (todas iguales, pero por si en el futuro cambian, está aquí)
// ------------------------------------------------------------
export const TABLAS = [
  "ranchos", "parcelas", "cultivos", "siembras", "trabajadores",
  "encargados", "agronomos", "cuadrillas", "externos", "maquinaria",
  "inventario", "actividades", "cosechas", "aplicaciones", "ingresos",
  "egresos", "compras", "entradas_inv", "tareas", "bonificaciones",
  "incidencias", "prestamos", "cajachica", "creditos", "proveedores",
  "ciclos", "asistencia", "envios_bodega", "solicitudes_compra", "bitacora", "avances_fase",
  "embarques", "terminados", "corridas", "estibas", "config_seguridad", "config_emisor", "control_corrida", "config_contpaqi",
  "lecturas", "patrones_lectura", "estados_cuenta",
  "titulares", "bolsas", "aportaciones",
  "animales", "pesajes", "tratamientos", "potreros",
  "indicaciones", "chat", "vuelos",
  "auditoria",
  "archivos",
];

// Catálogos que sí subimos a la nube en la primera carga.
// Lo demás son movimientos y no se siembra desde el navegador.
export const CATALOGOS = [
  "ranchos", "parcelas", "cultivos", "trabajadores",
  "encargados", "agronomos", "cuadrillas", "proveedores",
];

// Cómo se convierte un registro en renglón y de regreso: ver filas.js.

// ------------------------------------------------------------
//  LEER toda una colección
//
//  Las tablas de MOVIMIENTOS crecen sin fin (actividades, cosechas,
//  ingresos...). Para no descargar años de historial en cada arranque
//  (lento y caro en datos móviles), se traen solo los registros más
//  recientes, ordenados por su marca de tiempo. Los CATÁLOGOS (cultivos,
//  parcelas, trabajadores) son chicos y se traen completos.
// ------------------------------------------------------------
const TOPE_LECTURA = {
  actividades: 3000, cosechas: 1500, ingresos: 2500, egresos: 2500,
  asistencia: 4000, bitacora: 1500, aplicaciones: 2000, bonificaciones: 1500,
  incidencias: 1500, embarques: 1500, entradas_inv: 2000, envios_bodega: 1500, corridas: 1500,
};

export async function leerColeccion(tabla) {
  if (!supabaseListo) throw new Error("Supabase no está configurado");
  let consulta = supabase.from(tabla).select("*");
  const tope = TOPE_LECTURA[tabla];
  if (tope) {
    // Solo los más recientes (la tabla tiene columna "actualizado")
    consulta = consulta.order("actualizado", { ascending: false }).limit(tope);
  }
  const { data, error } = await consulta;
  if (error) throw error;
  return (data || []).map(filaAObjeto);
}

// ------------------------------------------------------------
//  LEER TODO: trae todas las colecciones a la vez
//  Devuelve un objeto { ranchos: [...], parcelas: [...], ... }
// ------------------------------------------------------------
//  Si una tabla falla al bajar, NO se convierte en lista vacía y ya. Una
//  lista vacía y "no pude leerla" son cosas distintas: si se cae la lectura
//  de egresos, la utilidad se calcularía sin un solo gasto y se pintaría
//  igual de verde. Un dato que falta no es un cero.
//
//  Devuelve las colecciones más dos metadatos que NO son arreglos (así el
//  merge de App.jsx los ignora solo):
//    _fallas — [{ tabla, mensaje }] de lo que no se pudo leer
//    _topes  — [{ tabla, tope }] de lo que se bajó recortado por el tope
export async function leerTodo() {
  if (!supabaseListo) throw new Error("Supabase no está configurado");
  const resultado = {};
  const fallas = [];
  const topes = [];
  for (const t of TABLAS) {
    try {
      const filas = await leerColeccion(t);
      resultado[t] = filas;
      // Si vinieron exactamente las del tope, es que hay más historial allá
      // que no se bajó. Los reportes de esa tabla están viendo una parte.
      const tope = TOPE_LECTURA[t];
      if (tope && filas.length >= tope) topes.push({ tabla: t, tope });
    } catch (e) {
      console.warn(`No se pudo leer ${t}:`, e.message);
      resultado[t] = [];
      fallas.push({ tabla: t, mensaje: e?.message || "error desconocido" });
    }
  }
  resultado._fallas = fallas;
  resultado._topes = topes;
  return resultado;
}

// ------------------------------------------------------------
//  SUBIR (insertar o actualizar) un registro
// ------------------------------------------------------------
export async function guardarRegistro(tabla, obj) {
  if (!supabaseListo) throw new Error("Supabase no está configurado");
  const fila = objetoAFila(tabla, obj);
  const { error } = await supabase.from(tabla).upsert(fila, { onConflict: "id" });
  if (error) throw error;
  return true;
}

// ------------------------------------------------------------
//  BORRAR un registro
// ------------------------------------------------------------
export async function borrarRegistro(tabla, id) {
  if (!supabaseListo) throw new Error("Supabase no está configurado");
  // Borrar ya no quita el renglón: le pone una lápida (hoja SQL 30). Así los
  // demás teléfonos se enteran y lo borrado no revive; y el contenido se
  // conserva por si hay que restaurarlo.
  const { error } = await supabase.rpc("borrar_registro", { p_tabla: tabla, p_id: String(id) });
  if (error) throw error;
  return true;
}

// ------------------------------------------------------------
//  VACIAR UNA TABLA COMPLETA en Supabase (borra todas sus filas).
//  Usado por el reinicio de datos. Úsese con cuidado: es irreversible.
// ------------------------------------------------------------
export async function vaciarTabla(tabla) {
  if (!supabaseListo) throw new Error("Supabase no está configurado");
  // Borra todas las filas. El filtro "id no es nulo" es un truco para
  // que Supabase permita un delete masivo (requiere un filtro).
  const { error } = await supabase.from(tabla).delete().not("id", "is", null);
  if (error) throw error;
  return true;
}

// ------------------------------------------------------------
//  SUBIR EN BLOQUE: una colección completa de la app a Supabase.
//  Usado en la migración inicial.
// ------------------------------------------------------------
export async function subirColeccion(tabla, registros) {
  if (!supabaseListo) throw new Error("Supabase no está configurado");
  if (!registros || registros.length === 0) return 0;
  const filas = registros.map(r => objetoAFila(tabla, r));
  // Subir en lotes de 100 para no rebasar límites
  let total = 0;
  for (let i = 0; i < filas.length; i += 100) {
    const lote = filas.slice(i, i + 100);
    const { error } = await supabase.from(tabla).upsert(lote, { onConflict: "id" });
    if (error) throw error;
    total += lote.length;
  }
  return total;
}

// ------------------------------------------------------------
//  MIGRAR CATÁLOGOS: sube solo lo que es catálogo real del rancho.
//  Lo demás (movimientos, demos) queda en cero en la nube.
// ------------------------------------------------------------
export async function migrarCatalogos(datosLocales) {
  const resumen = {};
  for (const c of CATALOGOS) {
    const registros = datosLocales[c] || [];
    try {
      const subidos = await subirColeccion(c, registros);
      resumen[c] = { ok: true, cantidad: subidos };
    } catch (e) {
      resumen[c] = { ok: false, error: e.message };
    }
  }
  return resumen;
}

// ------------------------------------------------------------
//  EL MEDIDOR: cuánto se lleva usado del plan (hoja SQL 27).
//  Devuelve null si no se pudo medir — y eso NO quiere decir "todo bien".
// ------------------------------------------------------------
export async function leerConsumo() {
  if (!supabaseListo) return null;
  try {
    const { data, error } = await supabase.rpc("consumo");
    return error ? null : data;
  } catch { return null; }
}

// ¿Hay una cuenta con sesión en este teléfono? Sin ella la base rechaza todo.
export async function hayCuentaLigada() {
  if (!supabaseListo) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return !!data?.session;
  } catch { return false; }
}
