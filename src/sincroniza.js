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
