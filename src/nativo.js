// PROTOTIPO (rama experimento/android): lo que sólo existe cuando AgroGestión corre como app Android (Capacitor).
// En el navegador `window.Capacitor` no existe y nada de esto hace algo: la web queda igual, byte por byte.
// No se importa ninguna librería: el puente nativo deja sus funciones en `window.Capacitor.Plugins`.
const puente = () => (typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins : null);
export const esNativo = () => !!puente();

// Un CANAL de Android = una clase de aviso con su tono propio. La persona puede cambiarlo o callarlo desde los
// ajustes del teléfono, canal por canal. Un canal ya creado no cambia de tono: por eso el id lleva versión.
export const CANALES = [
  { id: "mensajes_v1", clases: ["mensaje", "mencion", "conversacion"], name: "Mensajes", description: "Mensajes y menciones", sound: "tono_mensaje.wav", importance: 4 },
  { id: "asignaciones_v1", clases: ["asignacion"], name: "Asignaciones", description: "A qué vas hoy y sus cambios", sound: "tono_asignacion.wav", importance: 5 },
  { id: "alertas_v1", clases: ["incidencia", "autorizacion", "compra", "prueba"], name: "Alertas", description: "Incidencias y lo que espera autorización", sound: "tono_alerta.wav", importance: 5 },
];
export const canalDe = (clase) => (CANALES.find(c => c.clases.includes(clase)) || CANALES[0]).id;

export async function prepararNativo() {
  const p = puente(); if (!p?.LocalNotifications) return { ok: false };
  for (const c of CANALES) await p.LocalNotifications.createChannel({ id: c.id, name: c.name, description: c.description, sound: c.sound, importance: c.importance, visibility: 0, vibration: true, lights: true });
  const permiso = await p.LocalNotifications.requestPermissions();
  return { ok: permiso?.display === "granted" };
}

let consecutivo = Math.floor(Date.now() / 1000) % 100000;
export async function avisarNativo({ clase = "mensaje", titulo, cuerpo = "", url = "/" }) {
  const p = puente(); if (!p?.LocalNotifications) return false;
  await p.LocalNotifications.schedule({ notifications: [{ id: ++consecutivo, title: titulo, body: cuerpo, channelId: canalDe(clase), extra: { url } }] });
  return true;
}

// Al tocar el aviso, la app se entera de a dónde iba.
export function alTocarAviso(hacer) {
  const p = puente(); if (!p?.LocalNotifications) return () => {};
  const oido = p.LocalNotifications.addListener("localNotificationActionPerformed", (e) => hacer(e?.notification?.extra?.url || "/"));
  return () => { Promise.resolve(oido).then(o => o?.remove?.()); };
}

// SÓLO PARA EL PROTOTIPO: mientras la app está viva pregunta cada 15 s por mensajes nuevos (con la sesión de la
// persona: la base sólo le da los de sus conversaciones). Con la app CERRADA esto no corre: para eso hace falta el
// servicio de avisos de Google (Firebase), que no se ha activado.
export function vigilarMensajes({ leer, yo, cada = 15000 }) {
  if (!esNativo()) return () => {};
  let desde = new Date().toISOString(), vivo = true;
  const mirar = async () => {
    try {
      const nuevos = await leer(desde);
      for (const m of nuevos || []) {
        if (m.actualizado > desde) desde = m.actualizado;
        const d = m.datos || {};
        if (m.borrado || d.delAsistente || d.de?.id === yo) continue;
        const conv = d.conversacion || "general";
        await avisarNativo({ clase: "mensaje", titulo: `${d.de?.nombre || "Alguien"} mandó un mensaje`, cuerpo: conv === "general" ? "En la conversación general" : "En una de tus conversaciones", url: `/?ir=chat&conv=${encodeURIComponent(conv)}&msj=${encodeURIComponent(m.id)}` });
      }
    } catch { /* sin señal: se vuelve a intentar */ }
  };
  const reloj = setInterval(() => { if (vivo) mirar(); }, cada);
  return () => { vivo = false; clearInterval(reloj); };
}
