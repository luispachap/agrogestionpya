// PROTOTIPO (rama experimento/android): la seguridad que sólo existe cuando AgroGestión corre como app Android.
// En el navegador nada de esto actúa y ninguna de estas piezas se descarga (se cargan sólo dentro de la app).
//
// Lo que hace, y lo que NO:
//  · La sesión de la cuenta se guarda en el almacén protegido de Android (cifrado con una llave del Keystore),
//    no en el almacenamiento web. Aquí nunca se guarda una contraseña.
//  · La huella, el rostro o el bloqueo del teléfono ABREN LA APP EN ESTE APARATO. No son la identidad ante el
//    servidor: la sesión la sigue validando la base, y una sesión revocada o vencida no revive con la huella.
//  · No se guarda ni se ve ninguna huella ni imagen: Android contesta sí o no.
//  · La pantalla privada evita que el contenido salga en las aplicaciones recientes y en capturas.
const nativo = () => typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
let _bio, _seg, _priv;
const bio = async () => (_bio ||= (await import("@aparajita/capacitor-biometric-auth")).BiometricAuth);
const seg = async () => (_seg ||= (await import("@aparajita/capacitor-secure-storage")).SecureStorage);
const priv = async () => (_priv ||= (await import("@capacitor-community/privacy-screen")).PrivacyScreen);

// Donde el cliente de la base guarda la sesión. En la web: lo de siempre (undefined = el navegador).
export const almacenDeSesion = nativo() ? {
  getItem: async (k) => { try { const v = await (await seg()).get(k); return v == null ? null : typeof v === "string" ? v : JSON.stringify(v); } catch { return null; } },
  setItem: async (k, v) => { try { await (await seg()).set(k, String(v)); } catch { /* sin almacén seguro la sesión no se recuerda: se pedirá entrar otra vez */ } },
  removeItem: async (k) => { try { await (await seg()).remove(k); } catch { /* nada que quitar */ } },
} : undefined;

// Con qué se puede desbloquear ESTE teléfono, dicho en claro.
export async function comoSeDesbloquea() {
  if (!nativo()) return { nativo: false, seguro: false, dice: "" };
  try {
    const r = await (await bio()).checkBiometry();
    const seguro = !!(r.isAvailable || r.deviceIsSecure);
    const dice = r.strongBiometryIsAvailable ? "Se desbloquea con tu huella o tu rostro; también vale el PIN, patrón o contraseña del teléfono."
      : r.isAvailable ? "Este teléfono trae biometría que Android no considera fuerte. Se usa, y también vale el PIN, patrón o contraseña del teléfono."
      : r.deviceIsSecure ? "Este teléfono no tiene huella ni rostro configurados: AgroGestión se desbloquea con su PIN, patrón o contraseña."
      : "Este teléfono NO tiene bloqueo de pantalla. AgroGestión no puede protegerse aquí: al salir de la app se cierra la sesión y hay que entrar otra vez con correo y contraseña. Ponle un bloqueo al teléfono para evitarlo.";
    return { nativo: true, seguro, biometria: !!r.isAvailable, fuerte: !!r.strongBiometryIsAvailable, dice };
  } catch (e) { return { nativo: true, seguro: false, dice: `No se pudo revisar el bloqueo del teléfono (${e?.message || e}).` }; }
}

export async function desbloquear() {
  try {
    await (await bio()).authenticate({ reason: "Desbloquea AgroGestión", cancelTitle: "Cancelar", allowDeviceCredential: true, androidTitle: "AgroGestión", androidSubtitle: "Confirma que eres tú", androidConfirmationRequired: false });
    return { ok: true };
  } catch (e) { return { ok: false, dice: e?.message || "No se desbloqueó." }; }
}

export async function pantallaPrivada(si = true) { if (!nativo()) return; try { const p = await priv(); if (si) await p.enable(); else await p.disable(); } catch { /* sin esa pieza no hay pantalla privada */ } }

// Cuánto puede estar la app en el fondo antes de volver a pedir el desbloqueo. Es una preferencia del aparato, no un secreto.
export const PLAZOS = [{ v: 0, n: "Inmediato" }, { v: 60, n: "1 minuto" }, { v: 300, n: "5 minutos" }];
const LLAVE = "agro_bloqueo_nativo_seg";
export const plazoDeBloqueo = () => { try { const n = Number(localStorage.getItem(LLAVE)); return PLAZOS.some(p => p.v === n) && localStorage.getItem(LLAVE) !== null ? n : 60; } catch { return 60; } };
export const guardarPlazo = (v) => { try { localStorage.setItem(LLAVE, String(v)); } catch { /* se queda el de fábrica */ } };
// ¿Toca bloquear? Puro, para poder probarlo: cuánto estuvo fuera contra el plazo escogido.
export const tocaBloquear = ({ salio, volvio, plazo }) => salio != null && (volvio - salio) / 1000 >= plazo;
