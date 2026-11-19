// ════════════════════════════════════════════════════════════════════════
//  EL RELOJ DEL TELÉFONO — no se le cree a ciegas
//
//  Cada teléfono le pregunta la hora al servidor cuando tiene señal y guarda
//  cuánto difiere la suya (`desfase` = hora del servidor − hora del teléfono).
//  Ese número viaja en cada evento que captura, también sin señal, y con él se
//  acomoda el orden de los movimientos. Si el teléfono nunca ha podido
//  preguntar, el evento lo dice: "hora sin comprobar".
// ════════════════════════════════════════════════════════════════════════
export const RELOJ_BIEN_MS = 2 * 60000;      // menos de esto no se corrige nada
export const RELOJ_MAL_MS = 5 * 60000;       // de aquí en adelante se le avisa a la persona
export const MEDIDA_VIEJA_MS = 7 * 86400000; // una medida de hace más de una semana ya no se da por buena

// `salio` y `llego`: la hora del teléfono al preguntar y al recibir la respuesta.
export function desfaseDe({ servidor, salio, llego }) {
  const s = Date.parse(servidor);
  if (!Number.isFinite(s) || !Number.isFinite(salio) || !Number.isFinite(llego) || llego < salio) return null;
  if (llego - salio > 30000) return null;      // tardó demasiado: la medida no sirve
  return Math.round(s - (salio + llego) / 2);
}
// Lo que se le estampa a cada evento al nacer.
export function selloDeReloj(medida, ahoraMs) {
  if (!medida || typeof medida.desfase !== "number") return { desfase: null };
  if (ahoraMs - medida.cuando > MEDIDA_VIEJA_MS) return { desfase: null, vieja: true };
  return { desfase: medida.desfase };
}
export function estadoDelReloj(medida, ahoraMs) {
  if (!medida || typeof medida.desfase !== "number") return { clase: "sin_medir", dice: "" };
  const d = medida.desfase, min = Math.round(Math.abs(d) / 60000);
  if (Math.abs(d) < RELOJ_MAL_MS) return { clase: "bien", dice: "" };
  const cuanto = min >= 120 ? `${Math.round(min / 60)} horas` : `${min} minutos`;
  return { clase: "mal", minutos: min, dice: `La hora de este teléfono está ${d > 0 ? "atrasada" : "adelantada"} ${cuanto}. Lo que captures se acomoda con la hora del servidor, pero conviene corregirla en los ajustes del teléfono (hora automática).` };
}
