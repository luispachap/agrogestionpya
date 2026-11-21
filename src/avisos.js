// Avisos al teléfono, del lado del aparato: saber si este teléfono puede recibirlos, suscribirlo y abrir el lugar
// correcto cuando se toca un aviso. Qué se avisa y a quién lo decide el servidor (supabase/functions/avisar).

// Lo que cada quien puede apagar y lo que llega siempre. La misma lista que usa el servidor (`CLASES`).
export const CLASES_DE_AVISO = [
  { clave: "mensaje", nombre: "Mensajes nuevos", obligatorio: false },
  { clave: "mencion", nombre: "Cuando me mencionan (@nombre)", obligatorio: false },
  { clave: "conversacion", nombre: "Cuando me agregan a una conversación", obligatorio: false },
  { clave: "incidencia", nombre: "Incidencias de campo o maquinaria", obligatorio: false },
  { clave: "compra", nombre: "Solicitudes de compra por revisar", obligatorio: false },
  { clave: "asignacion", nombre: "Mis asignaciones y sus cambios", obligatorio: true },
  { clave: "autorizacion", nombre: "Lo que espera mi autorización", obligatorio: true },
];

// A dónde lleva un aviso. Sólo dice la pantalla y, si es un mensaje, la conversación: el contenido lo pide la app
// con la sesión de la persona, y si ya no tiene acceso no se le enseña.
const PAGINAS = ["chat", "home", "equipo", "solicitudes", "deudas", "eldia", "nomina"];
export function destinoDe(url) {
  try {
    const u = new URL(url, "https://x.invalid"), ir = u.searchParams.get("ir");
    if (!ir || !PAGINAS.includes(ir)) return null;
    return { pagina: ir, conversacion: u.searchParams.get("conv") || null, mensaje: u.searchParams.get("msj") || null };
  } catch { return null; }
}

// ¿Este aparato puede recibir avisos con la app cerrada? Lo dice en palabras, con lo que falta.
export function estadoDelAparato(g = globalThis) {
  const nav = g.navigator || {}, ua = String(nav.userAgent || "");
  const esIOS = /iPhone|iPad|iPod/.test(ua), instalada = !!(g.matchMedia && g.matchMedia("(display-mode: standalone)").matches) || nav.standalone === true;
  if (!("serviceWorker" in nav) || !g.PushManager || !g.Notification) {
    return { puede: false, instalada, dice: esIOS ? "En iPhone los avisos sólo funcionan con AgroGestión instalada en la pantalla de inicio (Compartir → Agregar a inicio) y iOS 16.4 o más nuevo." : "Este navegador no recibe avisos. En Android usa Chrome." };
  }
  if (esIOS && !instalada) return { puede: false, instalada, dice: "En iPhone primero hay que instalar AgroGestión en la pantalla de inicio (Compartir → Agregar a inicio)." };
  const permiso = g.Notification.permission;
  if (permiso === "denied") return { puede: false, bloqueado: true, instalada, dice: "Los avisos están bloqueados en este teléfono. Se desbloquean en los ajustes del navegador: Configuración del sitio → Notificaciones → Permitir." };
  return { puede: true, permiso, instalada, dice: instalada ? "" : "Funciona mejor con AgroGestión instalada: en Chrome, menú ⋮ → «Instalar app» o «Agregar a pantalla principal»." };
}

