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
export function espacioDe(url) {
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
    eventos: `agro_eventos_v8:${e}`, checador: `agro_checador_v8:${e}`,
  };
}
// Lo que se puede borrar al "reiniciar este teléfono": SÓLO lo de este espacio.
export const llavesQueSeReinician = (espacio) => { const l = llavesDe(espacio); return [l.datos, l.cola, l.fallidas, l.sesion, l.reset, l.checador]; };

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
export function sobreDeRespaldo(datos, espacio, cuando) {
  return { _respaldo: { espacio, cuando, version: 8 }, ...datos };
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
