// ════════════════════════════════════════════════════════════════════════
//  SINCRONIZA — mezclar lo del teléfono con lo de la nube
//
//  Salió de App.jsx para poder probarlo. Reglas:
//   · Sólo en la nube → se agrega.
//   · Sólo en el teléfono (aún sin subir) → se conserva.
//   · En los dos → gana el más reciente; en empate, lo local.
//   · Con LÁPIDA en la nube (alguien lo borró) → se quita del teléfono.
//     Antes no había lápidas: un teléfono con la copia vieja la volvía a
//     subir y lo borrado revivía.
//   · Si la nube trae una tabla VACÍA, lo local no se toca (precaución).
// ════════════════════════════════════════════════════════════════════════
import { ganaAlSincronizar } from "./calculos.js";

export function mezclarConNube(local, nube) {
  const next = { ...(local || {}) };
  let quitados = 0;
  for (const [tabla, filasNube] of Object.entries(nube || {})) {
    if (!Array.isArray(filasNube)) continue;          // _fallas, _topes
    if (filasNube.length === 0) continue;             // nube vacía: no tocar lo local
    const porId = {};
    for (const r of Array.isArray(next[tabla]) ? next[tabla] : []) if (r && r.id != null) porId[r.id] = r;
    for (const rn of filasNube) {
      if (!rn || rn.id == null) continue;
      if (rn._borrado) {                              // la lápida manda
        if (porId[rn.id]) { delete porId[rn.id]; quitados++; }
        continue;
      }
      const rl = porId[rn.id];
      porId[rn.id] = rl ? ganaAlSincronizar(rl, rn) : rn;
    }
    next[tabla] = Object.values(porId);
  }
  return { datos: next, quitados };
}

// ¿Toca volver a bajar los catálogos y registros de la nube? Antes sólo se bajaban al ENTRAR: lo que otro aparato
// capturaba después (el plan del día, una persona recién dada de alta, una aplicación) no llegaba hasta salir y volver
// a entrar. Ahora se vuelve a bajar cada cierto rato mientras la app está a la vista y con señal, y al regresar a ella.
export const CADA_CUANTO_BAJAR_MS = 5 * 60 * 1000;
export function tocaBajar({ ahora, ultima, visible = true, enLinea = true, cada = CADA_CUANTO_BAJAR_MS }) {
  if (!enLinea || !visible) return false;      // sin señal no hay de dónde; escondida, no gasta datos
  if (!ultima) return true;
  return ahora - ultima >= cada;
}

// ¿Falló por la RED (no hubo respuesta) o porque la base lo RECHAZÓ? Sin respuesta no es culpa del registro: con mala
// señal cinco intentos se queman en un minuto y el registro se apartaba hasta que alguien picara «reintentar». Una
// falla de red no gasta intentos: se vuelve a intentar sola. Un rechazo de la base (trae código) sí cuenta.
export function esFallaDeRed(e) {
  if (!e) return false;
  if (e.code || e.status || e.statusCode) return false;                       // la base contestó: es un rechazo
  const m = String(e.message || e || "").toLowerCase();
  return e.name === "TypeError" || e.name === "AbortError" || /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|timed out|err_|conexi/.test(m);
}
export const CADA_CUANTO_REINTENTAR_MS = 30 * 1000;

// ¿Se intenta subir ahora? Subir sin cuenta ligada sólo sirve para que la
// base lo rechace y la app lo cuente como "falló": cinco rechazos y el
// registro se apartaba. Ahora, sin cuenta, la cola ESPERA sin gastar intentos.
export function planDeSubida({ nubeConfigurada, enLinea, hayCuenta, pendientes }) {
  const n = pendientes || 0;
  if (!nubeConfigurada) return { subir: false, motivo: "sin_nube", dice: "" };
  if (n === 0) return { subir: false, motivo: "nada", dice: "" };
  if (!enLinea) return { subir: false, motivo: "sin_senal", dice: `${n} captura(s) esperando señal para subir.` };
  if (!hayCuenta) {
    return {
      subir: false, motivo: "sin_cuenta",
      dice: `${n} captura(s) guardada(s) en este teléfono SIN subir: ninguna cuenta está ligada aquí. Suben solas cuando un encargado entre con su cuenta.`,
    };
  }
  return { subir: true, motivo: "", dice: "" };
}

/* ──── El teléfono de campo ──── */
// Un encargado deja su cuenta ligada al teléfono para que su gente capture con
// PIN y lo capturado suba. Sólo encargados: dejar ligada una cuenta de
// superadministrador en un teléfono que pasa de mano en mano sería dejar la
// llave de todo el rancho en el campo.
export function puedeLigarTelefono(sesion) {
  return !!(sesion && sesion.cuenta && sesion.role === "encargado" && sesion.id);
}
export function vinculoDe(sesion, ahora = new Date().toISOString()) {
  return puedeLigarTelefono(sesion) ? { cuentaId: sesion.id, nombre: sesion.nombre || "", desde: ahora } : null;
}
// Con el teléfono ligado, la cuenta sirve para SUBIR, no para abrir pantallas:
// quien tome el teléfono no entra como el encargado sin su contraseña.
export function abrePantallasSola(vinculo) {
  return !vinculo;
}
