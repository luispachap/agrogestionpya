// La parte de los avisos que toca red y navegador: suscribir este aparato, probar y guardar preferencias.
import { supabase, supabaseListo } from "./supabase.js";
import { CLASES_DE_AVISO, estadoDelAparato } from "./avisos.js";

const aBytes = (b64) => { const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
const aTexto = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// `navigator.serviceWorker.ready` NUNCA contesta si el aparato no tiene el trabajador de servicio listo (primer arranque,
// modo privado, navegador viejo). Esperarlo sin límite dejaba colgado hasta el botón de «Salir». Aquí se espera un rato y ya.
export const conLimite = (promesa, ms, siNo = null) => Promise.race([promesa, new Promise((ok) => setTimeout(() => ok(siNo), ms))]);
const registro = (ms = 1500) => { try { return conLimite(navigator.serviceWorker.ready, ms, null); } catch { return Promise.resolve(null); } };

export async function suscripcionDeEsteAparato() {
  try { const reg = await registro(); return reg ? await reg.pushManager.getSubscription() : null; } catch { return null; }
}

// Activar los avisos en ESTE aparato para la cuenta que tiene la sesión abierta.
export async function activarAvisos() {
  if (!supabaseListo) return { ok: false, dice: "Los avisos necesitan que la app esté conectada a la base." };
  const e = estadoDelAparato(); if (!e.puede) return { ok: false, dice: e.dice };
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return { ok: false, dice: "No diste permiso para los avisos. Sin ese permiso el teléfono no los enseña." };
  let { data: llave } = await supabase.rpc("llave_publica_de_avisos");
  if (!llave) { await supabase.functions.invoke("avisar", { body: { prueba: true } }).catch(() => {}); ({ data: llave } = await supabase.rpc("llave_publica_de_avisos")); }
  if (!llave) return { ok: false, dice: "El servidor todavía no tiene listas las llaves de los avisos. Intenta en un minuto." };
  try {
    const reg = await registro(8000);
    if (!reg) return { ok: false, dice: "Este navegador todavía no termina de instalar AgroGestión. Cierra la app, vuelve a abrirla e inténtalo otra vez." };
    let sus = await reg.pushManager.getSubscription();
    // Si el aparato estaba suscrito con otra llave (otra instalación), se vuelve a suscribir.
    if (sus && aTexto(sus.options.applicationServerKey || new ArrayBuffer(0)) !== llave) { await sus.unsubscribe(); sus = null; }
    if (!sus) sus = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(llave) });
    const j = sus.toJSON();
    const { error } = await supabase.rpc("guardar_suscripcion", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_aparato: String(navigator.userAgent || "").slice(0, 120) });
    if (error) return { ok: false, dice: `No se pudo guardar la suscripción (${error.message}).` };
    return { ok: true, dice: "Listo: este teléfono ya recibe avisos de AgroGestión." };
  } catch (err) { return { ok: false, dice: `El teléfono no pudo suscribirse a los avisos (${err?.message || "sin detalle"}). Suele pasar sin servicios de Google o en modo incógnito.` }; }
}

// Al cerrar sesión o al apagarlos: este aparato deja de recibir los avisos de esta cuenta.
export async function desactivarAvisos() {
  try {
    const sus = await suscripcionDeEsteAparato(); if (!sus) return { ok: true };
    if (supabaseListo) await supabase.rpc("quitar_suscripcion", { p_endpoint: sus.endpoint });
    await sus.unsubscribe(); return { ok: true, dice: "Este teléfono ya no recibe avisos." };
  } catch (err) { return { ok: false, dice: err?.message || "No se pudo desactivar." }; }
}

export async function avisoDePrueba() {
  if (!supabaseListo) return { ok: false, dice: "Sin conexión a la base." };
  const { data, error } = await supabase.functions.invoke("avisar", { body: { prueba: true } });
  if (error) return { ok: false, dice: `El servidor no pudo mandar la prueba (${error.message}).` };
  return data?.enviados > 0 ? { ok: true, dice: "Se mandó. Cierra AgroGestión y bloquea el teléfono: debe llegar en unos segundos." } : { ok: false, dice: "No hay ningún aparato suscrito a tu cuenta. Activa primero los avisos en este teléfono." };
}

export async function misPreferenciasDeAvisos() {
  if (!supabaseListo) return {};
  const { data } = await supabase.from("avisos_preferencias").select("datos").limit(1);
  return data?.[0]?.datos || {};
}
export async function guardarPreferenciasDeAvisos(datos) {
  if (!supabaseListo) return { ok: false };
  const limpio = Object.fromEntries(CLASES_DE_AVISO.filter(c => !c.obligatorio).map(c => [c.clave, datos[c.clave] !== false]));
  const { error } = await supabase.rpc("guardar_preferencias_de_avisos", { p_datos: limpio });
  return { ok: !error };
}

// Al leer una conversación se quitan del teléfono los avisos de esa conversación: lo leído no sigue como pendiente.
export async function quitarAvisosDe(tag) {
  try { const reg = await registro(); if (reg) (await reg.getNotifications({ tag })).forEach(n => n.close()); } catch { /* sin avisos que quitar */ }
}
