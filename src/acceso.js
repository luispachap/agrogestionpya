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

import { leerCredencial } from "./checador.js";

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

// ════════════════════════════════════════════════════════════════════════
//  UNA SOLA ENTRADA — nadie escoge su perfil
//
//  Antes la pantalla preguntaba «¿quién eres?» con ocho tarjetas. Ahora la
//  persona escribe SU PIN, o su correo, o enseña su credencial, y la app sabe
//  quién es y qué le toca ver. Tres cosas quedan separadas a propósito:
//
//   · REGISTRAR ASISTENCIA no es abrir sesión. Checar entrada o salida se hace
//     con la credencial (o el PIN) en un aparato que un encargado dejó para
//     eso, y no abre ninguna pantalla de nadie.
//   · ABRIR SESIÓN pide algo que sólo la persona sabe: su PIN, o su contraseña.
//     LA CREDENCIAL SOLA NO ABRE NADA: dice quién eres, y enseguida pide el PIN.
//   · LO SENSIBLE (pagos, cierres, reglas) no depende de cómo se entró: lo
//     autoriza la base con la cuenta de la sesión. Un PIN no da esos permisos.
// ════════════════════════════════════════════════════════════════════════

// Qué quiso hacer la persona con lo que escribió. No decide quién es: decide por dónde se le busca.
export function caminoDeEntrada(texto) {
  const t = String(texto || "").trim();
  if (!t) return "vacio";
  if (t.includes("@")) return "cuenta";
  if (/^AGRO1:/.test(t)) return "credencial";
  if (/^\d{4,8}$/.test(t)) return "pin";
  if (/^\d+$/.test(t)) return "pin_corto";
  return "otro";
}
const sesionDeCampo = (rol, p) => {
  const s = { role: rol, id: p.id, nombre: p.nombre };
  if (rol === "trabajador") { s.sueldo_dia = p.sueldo_dia; s.categoria = p.categoria; }
  if (rol === "cuadrilla") { s.miembros = p.miembros; s.flete_dia = p.flete_dia; }
  return s;
};
const activos = (lista) => (Array.isArray(lista) ? lista : []).filter(p => p && p.activo !== false && !p._porBaja);
// Todas las personas que entran con PIN, cada una con su rol. El rol sale de en qué catálogo está, no de lo que diga nadie.
const conPin = (data) => Object.entries(CATALOGO_POR_ROL).filter(([rol]) => rol !== "externo").flatMap(([rol, cat]) => activos(data?.[cat]).map(p => ({ rol, p })));

/**
 * Antes de dar de alta (o de cambiarle el PIN) a alguien: que tenga nombre y que su PIN sirva.
 * Un PIN repetido deja SIN ENTRAR a los dos que lo comparten, así que no se guarda; sin PIN sí se puede dar de alta
 * (checa con credencial o lo registra su encargado), pero se avisa. `propioId` es la persona que se está editando.
 * @returns {{ok:boolean, falta?:string, dice:string, aviso?:string}}
 */
export function revisarAlta({ nombre, pin, sueldo_dia } = {}, data, { propioId = null, pideSueldo = true } = {}) {
  const n = String(nombre || "").trim();
  if (n.length < 3) return { ok: false, falta: "nombre", dice: "Escribe el nombre completo de la persona." };
  const mismo = conPin(data).find(x => x.p.id !== propioId && String(x.p.nombre || "").trim().toLowerCase() === n.toLowerCase());
  if (mismo) return { ok: false, falta: "nombre", dice: `Ya hay alguien dado de alta como ${mismo.p.nombre}. Si es otra persona con el mismo nombre, agrégale algo que la distinga (segundo apellido o apodo).` };
  if (pideSueldo && !(Number(sueldo_dia) > 0)) return { ok: false, falta: "sueldo", dice: "Falta lo que gana por día. Si cobra sólo por destajo, pon lo que se le paga un día normal: se puede cambiar después." };
  const p = String(pin ?? "").trim();
  if (p === "") return { ok: true, dice: "", aviso: `${n} queda sin PIN: no podrá entrar a la app ni checar con PIN hasta que se le ponga uno.` };
  if (!/^\d{4,8}$/.test(p)) return { ok: false, falta: "pin", dice: "El PIN es de 4 a 8 números, sin letras ni espacios." };
  const otro = conPin(data).find(x => x.p.id !== propioId && x.p.pin != null && String(x.p.pin).trim() === p);
  if (otro) return { ok: false, falta: "pin", dice: `Ese PIN ya lo tiene ${otro.p.nombre}. Dos personas con el mismo PIN no pueden entrar ninguna de las dos: escoge otro.` };
  return { ok: true, dice: "" };
}

/**
 * ¿De quién es este PIN? Se busca en todos los catálogos a la vez.
 * Si lo tienen dos personas NO se escoge una: se dice, y se le pide entrar con su credencial (que sí dice quién es).
 */
export function quienEntraConPin(pin, data) {
  const p = String(pin || "").trim();
  if (!/^\d{4,8}$/.test(p)) return { ok: false, motivo: "corto", dice: "El PIN es de 4 a 8 números." };
  const hallados = conPin(data).filter(x => x.p.pin != null && String(x.p.pin).trim() === p);
  if (hallados.length === 0) return { ok: false, motivo: "nadie", dice: "Ese PIN no es de nadie." };
  if (hallados.length > 1) return { ok: false, motivo: "repetido", dice: "Ese PIN lo tienen dos personas. Entra con tu credencial y tu PIN, o pide a tu encargado que te lo cambie." };
  return { ok: true, sesion: sesionDeCampo(hallados[0].rol, hallados[0].p), via: "pin" };
}

/**
 * La credencial dice QUIÉN es; el PIN demuestra que es esa persona. Sin PIN no hay sesión.
 * Devuelve { ok:false, falta:"pin", persona } cuando la credencial es buena y falta el PIN: la pantalla lo pide.
 */
export function entrarConCredencial(textoQR, pin, data) {
  const c = leerCredencial(textoQR);
  if (!c) return { ok: false, motivo: "no_es", dice: "Ese código no es una credencial del rancho." };
  const x = conPin(data).find(y => y.p.id === c.id);
  if (!x) return { ok: false, motivo: "desconocida", dice: "Esa credencial no está en este aparato, o esa persona ya no está activa. Si es nueva, falta que el aparato baje los datos." };
  if (!x.p.credencial?.codigo || x.p.credencial.codigo !== c.codigo) return { ok: false, motivo: "vencida", dice: `Esa credencial de ${x.p.nombre} ya no sirve: se emitió otra después.` };
  const persona = { id: x.p.id, nombre: x.p.nombre, rol: x.rol };
  if (x.p.pin == null || String(x.p.pin).trim() === "") return { ok: false, motivo: "sin_pin", persona, dice: `${x.p.nombre} todavía no tiene PIN. Con la credencial sola se puede checar entrada y salida, pero no entrar a la app: pide a tu encargado que te ponga un PIN.` };
  if (pin == null || String(pin).trim() === "") return { ok: false, falta: "pin", persona, dice: "" };
  if (String(x.p.pin).trim() !== String(pin).trim()) return { ok: false, motivo: "incorrecto", persona, dice: "Ese no es tu PIN." };
  return { ok: true, sesion: sesionDeCampo(x.rol, x.p), via: "credencial" };
}

// ¿En este aparato se puede registrar asistencia desde la entrada, sin abrir sesión?
// Sólo si un encargado lo dejó ligado para su gente: una marca hecha desde el teléfono de cada quien no vale.
export function puertaDeAsistencia(vinculo) {
  if (!vinculo || !vinculo.cuentaId) return { ok: false, dice: "La entrada y la salida se registran en el checador de la nave, o en el aparato que tu encargado dejó para eso." };
  return { ok: true, quien: { id: vinculo.cuentaId, nombre: vinculo.nombre || "Encargado", rol: "encargado" } };
}
