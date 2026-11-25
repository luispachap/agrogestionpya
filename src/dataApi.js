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
import { subirRegistro } from "./subir.js";
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
  "indicaciones", "chat", "vuelos", "eventos",
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
    if (t === "eventos") continue;   // crecen sin tope: se bajan aparte y sólo lo nuevo (leerEventosDesde)
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
//  Los EVENTOS se bajan aparte: sólo los que cambiaron desde la última vez, y
//  por páginas, porque crecen sin tope (cada marca del checador es uno) y la
//  base entrega mil renglones por pedido. `desde` es la marca del último que
//  este aparato ya tiene; se devuelve la nueva para guardarla.
//  Si una página falla, se avisa (ok: false) y NO se adelanta la marca.
// ------------------------------------------------------------
export async function leerEventosDesde(desde) {
  if (!supabaseListo) return { ok: false, eventos: [], marca: desde || null };
  const PAGINA = 1000; const vistos = new Map(); let marca = desde || null;
  try {
    for (let vuelta = 0; vuelta < 200; vuelta++) {
      let q = supabase.from("eventos").select("*").order("actualizado", { ascending: true }).order("id", { ascending: true }).limit(PAGINA);
      if (marca) q = q.gte("actualizado", marca);
      const { data, error } = await q;
      if (error) throw error;
      const filas = data || []; const antes = vistos.size;
      for (const f of filas) vistos.set(f.id, filaAObjeto(f));
      if (filas.length > 0) marca = filas[filas.length - 1].actualizado;
      // Menos de una página, o una página que ya no trajo nada nuevo: se acabó.
      if (filas.length < PAGINA || vistos.size === antes) break;
    }
    return { ok: true, eventos: [...vistos.values()], marca };
  } catch (e) {
    return { ok: false, eventos: [], marca: desde || null, mensaje: e?.message || "error desconocido" };
  }
}

// ------------------------------------------------------------
//  SUBIR (insertar o actualizar) un registro
// ------------------------------------------------------------
// Cómo le habla `subir.js` a la base de verdad (supabase-js). La prueba de contrato le pone otro, sobre una base aislada.
export const clienteSupabase = {
  upsert: (tabla, fila, { soloFaltantes = false, regresar = false } = {}) => {
    const q = supabase.from(tabla).upsert(fila, { onConflict: "id", ignoreDuplicates: soloFaltantes });
    return regresar ? q.select() : q;
  },
  update: (tabla, fila, { regresar = false } = {}) => { const q = supabase.from(tabla).update(fila).eq("id", fila.id); return regresar ? q.select() : q; },
  insert: (tabla, fila, { regresar = false } = {}) => { const q = supabase.from(tabla).insert(fila); return regresar ? q.select() : q; },
  leer: (tabla, id) => supabase.from(tabla).select("*").eq("id", id).maybeSingle(),
};

export async function guardarRegistro(tabla, obj) {
  if (!supabaseListo) throw new Error("Supabase no está configurado");
  const devuelta = await subirRegistro(clienteSupabase, tabla, obj);
  // De un evento se trae de regreso lo que la base le selló (cuándo lo recibió y, si es sensible, si lo autorizó).
  if (tabla === "eventos" && devuelta) { try { alSellar?.(filaAObjeto(devuelta)); } catch { /* el sello llega igual en la siguiente bajada */ } }
  return true;
}
// La app deja aquí a quién avisarle cuando la base devuelve un evento ya sellado.
let alSellar = null;
export const cuandoSelle = (f) => { alSellar = f; };

// ── Permisos de operación (hoja 37): lo que puede ESTA cuenta, y quién puede qué ──
export async function misPermisos() {
  if (!supabaseListo) return { ok: false };
  try {
    const { data, error } = await supabase.rpc("mis_permisos");
    if (error) return { ok: false, mensaje: error.message };
    return { ok: true, rol: data?.rol || null, operaciones: Array.isArray(data?.operaciones) ? data.operaciones : [] };
  } catch (e) { return { ok: false, mensaje: e?.message }; }
}
export async function permisosDeTodos() {
  if (!supabaseListo) return { ok: false, permisos: [] };
  const { data, error } = await supabase.from("permisos_operacion").select("usuario, operacion, otorgado, otorgado_por, revocado, revocado_por").order("otorgado", { ascending: true });
  return error ? { ok: false, permisos: [], mensaje: error.message } : { ok: true, permisos: data || [] };
}
export async function cambiarPermiso(usuario, operacion, dar) {
  if (!supabaseListo) return { ok: false, mensaje: "Este teléfono no está conectado a la nube." };
  const { error } = await supabase.rpc(dar ? "otorgar_permiso" : "revocar_permiso", { p_usuario: usuario, p_operacion: operacion });
  return error ? { ok: false, mensaje: error.message } : { ok: true };
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
// `soloFaltantes` (para RESTAURAR un respaldo): lo que ya está en la base no se toca; sólo entra lo que falta. Sin esto,
// restaurar pisaba con la versión vieja del respaldo lo que alguien había corregido después, y la bitácora —que no se
// puede modificar— hacía fallar el lote entero.
export async function subirColeccion(tabla, registros, { soloFaltantes = false } = {}) {
  if (!supabaseListo) throw new Error("Supabase no está configurado");
  if (!registros || registros.length === 0) return 0;
  const filas = registros.map(r => objetoAFila(tabla, r));
  // Subir en lotes de 100 para no rebasar límites
  let total = 0; const rechazados = []; let motivo = "";
  for (let i = 0; i < filas.length; i += 100) {
    const lote = filas.slice(i, i + 100);
    const { error } = await supabase.from(tabla).upsert(lote, { onConflict: "id", ignoreDuplicates: soloFaltantes });
    if (error && soloFaltantes) {
      // Al restaurar, un renglón que la base no acepta no debe tirar a los otros noventa y nueve: se va uno por uno.
      let primero = error.message || "la base no lo aceptó";
      for (const fila of lote) {
        const r = await supabase.from(tabla).upsert([fila], { onConflict: "id", ignoreDuplicates: true });
        if (r.error) { rechazados.push(fila.id); primero = r.error.message || primero; } else total += 1;
      }
      motivo = primero;
      continue;
    }
    if (error) throw error;
    total += lote.length;
  }
  if (rechazados.length > 0) { const e = new Error(`${rechazados.length} de ${filas.length} no entraron (${motivo})`); e.subidos = total; e.rechazados = rechazados; throw e; }
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

// ------------------------------------------------------------
//  El acomodo de cada quien (inicio, barra, menú). Es de la persona, no del
//  rancho: un renglón por cuenta, que sólo esa cuenta lee y escribe (hoja 34).
//  Si no se pudo, devuelve { ok: false }: la app sigue con lo del teléfono.
// ------------------------------------------------------------
// La hora del servidor, para que el teléfono mida cuánto difiere la suya.
// Devuelve también a qué hora (del teléfono) salió la pregunta y llegó la respuesta.
export async function horaDelServidor() {
  if (!supabaseListo) return { ok: false };
  try {
    const salio = Date.now();
    const { data, error } = await supabase.rpc("hora_del_servidor");
    const llego = Date.now();
    return error || !data ? { ok: false } : { ok: true, servidor: data, salio, llego };
  } catch { return { ok: false }; }
}
export async function leerPreferencias(cuentaId) {
  if (!supabaseListo || !cuentaId) return { ok: false };
  try {
    const { data, error } = await supabase.from("preferencias").select("datos").eq("id", cuentaId).maybeSingle();
    return error ? { ok: false } : { ok: true, datos: data?.datos || null };
  } catch { return { ok: false }; }
}
export async function guardarPreferencias(cuentaId, datos) {
  if (!supabaseListo || !cuentaId) return false;
  try {
    const { error } = await supabase.from("preferencias").upsert({ id: cuentaId, datos, actualizado: new Date().toISOString() }, { onConflict: "id" });
    return !error;
  } catch { return false; }
}

// ¿Hay una cuenta con sesión en este teléfono? Sin ella la base rechaza todo.
export async function hayCuentaLigada() {
  if (!supabaseListo) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return !!data?.session;
  } catch { return false; }
}

// ── Mensajería institucional (hoja 46): lo que sólo la base puede conceder ──
export async function consultasDeConversacion() {
  if (!supabaseListo) return [];
  const { data, error } = await supabase.from("consultas_de_conversacion").select("usuario, conversacion, motivo, desde, hasta").order("desde", { ascending: false }).limit(200);
  return error ? [] : data || [];
}
export async function consultarConversacion(conversacion, motivo) {
  if (!supabaseListo) return { ok: false, mensaje: "Sin conexión a la base no se puede abrir una consulta: tiene que quedar anotada." };
  const { data, error } = await supabase.rpc("consultar_conversacion", { p_conversacion: conversacion, p_motivo: motivo });
  return error ? { ok: false, mensaje: error.message } : { ok: true, hasta: data };
}
export async function verEvidencia(mensajes, motivo) {
  if (!supabaseListo) return { ok: false, mensaje: "Sin conexión a la base no se puede consultar la evidencia: tiene que quedar anotado." };
  const { data, error } = await supabase.rpc("ver_evidencia", { p_mensajes: mensajes, p_motivo: motivo || null });
  return error ? { ok: false, mensaje: error.message } : { ok: true, mensajes: (data || []).map(filaAObjeto) };
}
// El gasto en IA del mes contra su límite (hoja 50). Sólo le contesta a quien administra; si no se pudo saber, null.
export async function estadoDeIA() {
  if (!supabaseListo) return null;
  const { data, error } = await supabase.rpc("estado_de_ia");
  return error ? null : data || null;
}

export async function directorioDeCuentas() {
  if (!supabaseListo) return [];
  const { data, error } = await supabase.rpc("directorio_de_cuentas");
  return error ? [] : data || [];
}

// ------------------------------------------------------------
//  RESTAURAR UN RESPALDO sin reescribir la historia (hoja 53)
//  Abrir una restauración es lo que deja que los eventos perdidos recuperen a quien los autorizó. Sólo un
//  superadministrador, con motivo; dura una hora y queda anotada. Si la base todavía no tiene la hoja, se dice.
// ------------------------------------------------------------
export async function abrirRestauracion(motivo) {
  if (!supabaseListo) return { ok: false, dice: "Sin conexión a la base." };
  const { data, error } = await supabase.rpc("abrir_restauracion", { p_motivo: motivo });
  if (error) return { ok: false, sinHoja: /does not exist|Could not find|schema cache|PGRST202/i.test(error.message || "") || error.code === "PGRST202" || error.code === "42883", dice: error.message || "No se pudo abrir la restauración." };
  return { ok: true, hasta: data };
}
export async function leerRestauraciones() {
  if (!supabaseListo) return [];
  const { data, error } = await supabase.from("restauraciones").select("abierta_por, motivo, desde, eventos").order("desde", { ascending: false }).limit(20);
  return error ? [] : (data || []);
}
