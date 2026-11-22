// ════════════════════════════════════════════════════════════════════════
//  ESPACIO — que los datos viejos del teléfono no entren a la operación nueva
//
//  AgroGestión arranca LIMPIO en un proyecto nuevo. Pero los teléfonos traen
//  guardados registros de pruebas viejas (gastos inventados, jornadas de
//  ensayo), y una cola de cosas "pendientes de subir". Una base vacía no sirve
//  de nada si el primer teléfono que entra la llena con eso.
//
//  La regla: cada proyecto de la nube es un ESPACIO, y cada espacio tiene su
//  propio cajón en el teléfono. La app de un espacio:
//    · NUNCA lee, escribe ni borra el cajón de otro espacio ni el de antes;
//    · le pone su marca a cada registro que nace en ella, y la base rechaza
//      lo que llegue sin esa marca (segundo candado, hoja SQL 31);
//    · no acepta respaldos de otro espacio.
//  Lo viejo no se toca: se queda en el teléfono, y se puede descargar.
// ════════════════════════════════════════════════════════════════════════

// Las llaves de ANTES. Sólo se nombran aquí para poder decir "éstas no se
// tocan" y para ofrecer descargarlas. Ninguna otra parte de la app las usa.
export const LLAVES_ANTERIORES = ["agro_v7", "agro_pending_v7", "agro_fallidas_v1", "agro_session_v1", "agro_reset_token"];

// De la dirección del proyecto sale el nombre del espacio:
//   https://abcdefgh.supabase.co → "abcdefgh".  Sin nube configurada → "local".
//   RECUPERACIÓN: si la base de producción se pierde y se restaura su respaldo en OTRO proyecto, esa base sigue
//   siendo del espacio de antes (lo lleva escrito, y cada registro y cada firma también). Para que la app trabaje
//   sobre la copia SIN reescribir nada, se le dice el nombre heredado (`VITE_ESPACIO_HEREDADO`, en Vercel): entonces
//   usa ése aunque la dirección sea otra, y los teléfonos conservan su cajón y lo que tenían pendiente de subir.
//   Sólo se pone en una recuperación de producción. Nunca en una vista previa ni en un proyecto de pruebas: sería
//   abrirle a datos de prueba la puerta de la operación.
export function espacioDe(url, heredado = "") {
  const h = String(heredado || "").trim().toLowerCase();
  if (/^[a-z0-9-]{3,}$/.test(h) && h !== "local" && h !== "sin-configurar") return h;
  const m = /^https?:\/\/([a-z0-9-]+)/i.exec(String(url || ""));
  const nombre = m ? m[1].toLowerCase() : "";
  return !nombre || nombre === "sin-configurar" ? "local" : nombre;
}

// El cajón de este espacio en el teléfono.
export function llavesDe(espacio) {
  const e = espacio || "local";
  return {
    datos: `agro_v8:${e}`, cola: `agro_cola_v8:${e}`, fallidas: `agro_fallidas_v8:${e}`,
    sesion: `agro_sesion_v8:${e}`, campo: `agro_campo_v8:${e}`, reset: `agro_reset_v8:${e}`,
    // Cómo acomodó cada persona su inicio y su barra. No son datos del rancho:
    // no suben, y no se borran al reiniciar el teléfono.
    menu: `agro_menu_v8:${e}`,
    // El almacén grande (IndexedDB) donde viven los eventos, y el candado del
    // checador cuando la tableta se deja cerrada en esa pantalla.
    eventos: `agro_eventos_v8:${e}`, checador: `agro_checador_v8:${e}`, reloj: `agro_reloj_v8:${e}`,
    // Lo que la base dijo que puede la cuenta de este aparato (para no ofrecer lo que va a rechazar). Decide la base, no esto.
    permisos: `agro_permisos_v8:${e}`,
    // Las propuestas de los documentos importados que todavía no confirma nadie (IndexedDB; no suben hasta confirmarse).
    importacion: `agro_importacion_v8:${e}`,
  };
}
// Lo que se puede borrar al "reiniciar este teléfono": SÓLO lo de este espacio.
export const llavesQueSeReinician = (espacio) => { const l = llavesDe(espacio); return [l.datos, l.cola, l.fallidas, l.sesion, l.reset, l.checador, l.permisos]; };

// La marca de nacimiento. Se pone una vez y no se cambia.
export const marcarEspacio = (registro, espacio) =>
  (registro && !registro._espacio ? { ...registro, _espacio: espacio } : registro);

// ¿Qué hay guardado de antes en este teléfono? Sólo cuenta; no lo abre ni lo mueve.
export function loDeAntes(leer) {
  const hallado = [];
  for (const k of LLAVES_ANTERIORES) {
    let v = null;
    try { v = leer(k); } catch { v = null; }
    if (v != null) hallado.push({ llave: k, caracteres: String(v).length });
  }
  return { hay: hallado.some(h => h.llave === "agro_v7" || h.llave === "agro_pending_v7" || h.llave === "agro_fallidas_v1"), hallado };
}

// El respaldo que se descarga dice de qué espacio es y de qué día.
// `cuentas` es el directorio de ese día (identificador de la cuenta → nombre y perfil). Los sellos de un pago o de un
// cierre guardan el identificador de la cuenta que autorizó; si algún día hubiera que rehacer las cuentas, sin este
// directorio ya no se sabría de quién era cada identificador. No lleva correos ni contraseñas.
export function sobreDeRespaldo(datos, espacio, cuando, cuentas = null) {
  const limpias = Array.isArray(cuentas) ? cuentas.filter(c => c && c.id).map(c => ({ id: c.id, nombre: c.nombre || "", rol: c.rol || "" })) : null;
  return { _respaldo: { espacio, cuando, version: 8, ...(limpias && limpias.length ? { cuentas: limpias } : {}) }, ...datos };
}

// Lo que va en un respaldo y lo que se restaura: SÓLO lo capturado (las colecciones tal como se guardan), nunca lo
// calculado. Antes el respaldo llevaba también las cuentas ya hechas —existencias, costos— y al restaurarlo lo calculado
// se volvía punto de partida: el almacén descontaba dos veces lo consumido. Lo calculado se vuelve a calcular solo.
export function soloLoCapturado(datos, colecciones) {
  const sale = {};
  for (const c of colecciones) if (Array.isArray(datos?.[c])) sale[c] = datos[c];
  return sale;
}
// Un respaldo sirve para otra base (una reconstruida) sólo si se le cambia la marca del espacio, a propósito y fuera
// de la app (herramientas/respaldo-a-otro-espacio.mjs). Aquí está la regla, para poder probarla.
export function respaldoParaOtroEspacio(obj, nuevoEspacio, cuando) {
  if (!obj || !obj._respaldo || !obj._respaldo.espacio) throw new Error("No es un respaldo de AgroGestión.");
  if (!nuevoEspacio) throw new Error("Falta decir a qué espacio va.");
  const marcar = (r) => (r && typeof r === "object" && !Array.isArray(r) ? { ...r, _espacio: nuevoEspacio } : r);
  const sale = { _respaldo: { ...obj._respaldo, espacio: nuevoEspacio, venia_de: obj._respaldo.espacio, trasladado: cuando || null } };
  for (const [k, v] of Object.entries(obj)) if (k !== "_respaldo") sale[k] = Array.isArray(v) ? v.map(marcar) : v;
  return sale;
}

// ¿Se puede restaurar este archivo aquí? Sólo si es de ESTE espacio.
// Un respaldo de antes (sin marca) o de otro espacio no entra: restaurarlo
// metería registros de prueba a la operación real.
export function revisarRespaldo(obj, espacio) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { entra: false, dice: "El archivo no parece un respaldo." };
  const r = obj._respaldo;
  if (!r || !r.espacio) {
    return { entra: false, deAntes: true, dice: "Este respaldo es de la versión anterior (de cuando la app estaba a prueba). No se carga a la operación: se conserva como archivo. Si trae catálogos que sí sirven —trabajadores, parcelas, proveedores—, entran por la revisión de catálogos, uno por uno." };
  }
  if (r.espacio !== espacio) {
    return { entra: false, dice: `Este respaldo es de otro espacio ("${r.espacio}") y aquí se trabaja en "${espacio}". No se mezclan: así los datos de prueba no llegan a la operación.` };
  }
  const { _respaldo, ...datos } = obj;
  return { entra: true, datos, dice: `Respaldo de este espacio, del ${String(r.cuando || "").slice(0, 10)}.` };
}
