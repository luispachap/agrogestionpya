// ============================================================
//  AgroGestión — Reglas de acceso que se pueden probar
//
//  Sale de App.jsx por la misma razón que calculos.js: ahí dentro no
//  se podía probar. Aquí vive QUIÉN puede entrar y QUÉ sesión guardada
//  se puede creer. Todo es puro: recibe datos, devuelve una decisión.
//
//  OJO: esto endurece el teléfono, no sustituye al servidor. Mientras
//  los permisos no se apliquen en la base (ver docs/auditoria), quien
//  controle el navegador sigue pudiendo saltarse estas reglas.
// ============================================================

export const ROLES_DIRECCION = ["admin", "dueno", "finanzas"];

// Dónde vive cada rol de campo dentro de los datos locales.
const CATALOGO_POR_ROL = {
  trabajador: "trabajadores",
  encargado: "encargados",
  agronomo: "agronomos",
  cuadrilla: "cuadrillas",
  externo: "externos",
};

/**
 * ¿Entra este PIN como dirección?
 * Antes: si no había PIN propio configurado, valía un PIN "de fábrica" escrito
 * en el código público (el mismo para todo el mundo). Ya no existe ese camino:
 * sin PIN propio configurado NO se entra por PIN; se entra con cuenta (correo
 * y contraseña), y desde ahí se configura.
 * @returns {Promise<{ok:boolean, motivo?:"sin_configurar"|"sin_modo_seguro"|"incorrecto"}>}
 */
export async function verificarPinDireccion(cfgSeguridad, rol, pinEscrito, hashFn) {
  if (!ROLES_DIRECCION.includes(rol)) return { ok: false, motivo: "incorrecto" };
  const guardado = cfgSeguridad && cfgSeguridad["pin_" + rol];
  if (!guardado) return { ok: false, motivo: "sin_configurar" };
  const h = await hashFn(pinEscrito);
  if (h === null || h === undefined) return { ok: false, motivo: "sin_modo_seguro" };
  return h === guardado ? { ok: true } : { ok: false, motivo: "incorrecto" };
}

/**
 * ¿Se puede creer la sesión que estaba guardada en el teléfono?
 * - Dirección: NUNCA desde el almacenamiento (cualquiera puede escribir ahí
 *   {role:"admin", cuenta:true}). Si hay cuenta real, App.jsx la reconstruye
 *   preguntándole su perfil al servidor; si entró por PIN, lo vuelve a teclear.
 * - Campo: sólo si esa persona sigue existiendo en el catálogo con ese rol.
 *   Devuelve la sesión limpia (sin campos sueltos que alguien haya añadido).
 */
export function sesionRestaurable(guardada, data) {
  if (!guardada || typeof guardada !== "object" || !guardada.role || !guardada.id) return null;
  if (ROLES_DIRECCION.includes(guardada.role)) return null;
  const catalogo = CATALOGO_POR_ROL[guardada.role];
  if (!catalogo) return null;
  const lista = (data && Array.isArray(data[catalogo])) ? data[catalogo] : [];
  const persona = lista.find(p => p && p.id === guardada.id);
  if (!persona) return null;
  if (persona.activo === false) return null;
  const s = { role: guardada.role, id: persona.id, nombre: persona.nombre };
  if (guardada.role === "trabajador") { s.sueldo_dia = persona.sueldo_dia; s.categoria = persona.categoria; }
  if (guardada.role === "externo") s.sueldo_dia = persona.sueldo_dia;
  if (guardada.role === "cuadrilla") { s.miembros = persona.miembros; s.flete_dia = persona.flete_dia; }
  return s;
}

/**
 * Orden de "recarga desde la nube" enviada a todos los teléfonos.
 * Antes borraba también la cola de pendientes: lo capturado sin señal y aún
 * no subido se perdía. Ahora la copia local sólo se limpia si NO queda nada
 * por subir; si queda, se pospone y se avisa.
 */
export function planDeRecarga({ tokenNube, tokenLocal, pendientes, fallidas, llaveDatos }) {
  if (!tokenNube || tokenNube === tokenLocal) return { accion: "nada" };
  const sinSubir = (Array.isArray(pendientes) ? pendientes.length : 0) + (Array.isArray(fallidas) ? fallidas.length : 0);
  if (sinSubir > 0) return { accion: "posponer", sinSubir };
  // Sólo la copia de datos de ESTE espacio. Lo de antes no se toca nunca.
  return { accion: "limpiar", claves: llaveDatos ? [llaveDatos] : [] };
}

// ── La cuenta manda la pantalla ─────────────────────────────────────────────
// En la base, Luis y Migue son "superadmin": cada uno con su cuenta y con las
// mismas facultades. En las pantallas ese rol abre lo mismo que abría "admin".
// Un rol que la app no conoce NO entra como algo parecido: no entra.
const ROLES_DE_CUENTA = ["superadmin", "admin", "dueno", "finanzas", "encargado", "agronomo"];
export function sesionDeCuenta(perfil) {
  if (!perfil || !perfil.id || !ROLES_DE_CUENTA.includes(perfil.rol)) return null;
  const superadmin = perfil.rol === "superadmin";
  return {
    role: superadmin ? "admin" : perfil.rol,
    nombre: perfil.nombre || "",
    id: perfil.id,
    cuenta: true,
    superadmin,
  };
}

// ── Al regresar del correo de confirmación ──────────────────────────────────
// El enlace del correo trae a la persona de vuelta a la app con una "cola" en
// la dirección. Aquí se lee esa cola y se dice, en palabras, qué pasó.
// No abre ninguna puerta: entrar sigue siendo con correo y contraseña.
export function regresoDelCorreo(direccion) {
  const cola = String(direccion || "");
  const trozo = cola.includes("#") ? cola.slice(cola.indexOf("#") + 1) : (cola.includes("?") ? cola.slice(cola.indexOf("?") + 1) : "");
  const p = new URLSearchParams(trozo);
  if (p.get("error") || p.get("error_code")) {
    const caduco = /expired|invalid/i.test(`${p.get("error_code") || ""} ${p.get("error_description") || ""}`);
    return {
      viene: true, ok: false,
      dice: caduco
        ? "Ese enlace ya se usó o caducó. Si tu correo ya quedó confirmado, entra con tu correo y contraseña; si no, pide que te lo manden otra vez."
        : "No se pudo confirmar el correo con ese enlace. Pide que te lo manden otra vez.",
    };
  }
  if (p.get("type") === "signup" || (p.get("access_token") && p.get("type") !== "recovery")) {
    return { viene: true, ok: true, dice: "Correo confirmado. Ahora entra con tu correo y contraseña." };
  }
  return { viene: false, ok: false, dice: "" };
}
