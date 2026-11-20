// ════════════════════════════════════════════════════════════════════════
//  BONOS E INCENTIVOS — dentro de Pagos al personal, no en una pantalla aparte
//
//  Un bono es algo que el rancho decide darle a una persona ADEMÁS de lo que
//  ganó por su trabajo. No es aguinaldo ni vacaciones ni prima: eso es de ley
//  y vive en Prestaciones. Aquí hay tres clases:
//    extraordinario   de una sola vez (una ayuda, un reconocimiento)
//    productividad    por un resultado medible de un periodo (cajas, hectáreas, calidad)
//    otro             cualquier otro, diciendo cuál
//
//  Son DOS hechos y cada uno es un evento:
//    bono_personal   se OTORGA: a quién, cuánto, por qué, de qué periodo, quién
//                    lo autoriza y cómo se trata su costo. AQUÍ nace el costo
//                    (el último día del periodo que premia), se pague o no.
//    pago_bono       se PAGA: baja lo pendiente. Pagar no es costo.
//  El estado (pendiente, pagado en parte, pagado) se CALCULA de los pagos.
//
//  Tratamiento de su costo, que se dice al otorgarlo y se queda guardado:
//    actividades   a las parcelas donde esa persona trabajó ese mes, en proporción
//    general       gasto general de personal: no sube ninguna parcela
//    pendiente     queda a la vista, sin distribuir
//
//  Y su efecto en el salario integrado: `integra` dice si cuenta. Por defecto
//  sí cuenta el de productividad (es parte de lo que gana por su trabajo) y el
//  extraordinario no (no es habitual); se puede cambiar al otorgarlo, y queda
//  dicho. La pantalla vieja de bonificaciones ya no captura: sus registros se
//  conservan y se enseñan aparte, tal cual, sin sumarse a nada.
// ════════════════════════════════════════════════════════════════════════
import { nuevoEvento, vigentes, negado } from "./eventos.js";
import { sumarDinero } from "./calculos.js";

export const T_BONO = "bono_personal", T_PAGO_BONO = "pago_bono";
export const CLASES_DE_BONO = { extraordinario: "Bono extraordinario (de una sola vez)", productividad: "Incentivo de productividad", otro: "Otro bono" };
export const TRATAMIENTOS_DE_BONO = { actividades: "A las parcelas donde trabajó ese mes, en proporción", general: "Gasto general de personal: no se carga a parcelas", pendiente: "Dejarlo pendiente de distribuir" };
export const integraPorDefecto = (clase) => clase === "productividad";
const limpio = (s) => String(s || "").trim();
const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f || "");
const centavos = (n) => Math.round(Number(n) * 100) / 100;
// Lo que es de ley no se disfraza de bono: tiene su propia cuenta, con sus reglas.
const DE_LEY = /aguinaldo|prima vacacional|vacacion|finiquito|liquidaci|indemniza|prima de antig/i;

export function otorgarBono({ permitido, eventos = [], persona, clase, motivo, monto, desde, hasta, autorizo, tratamiento, integra, evidencia = null, quien, cuando, fecha, azar }) {
  { const no = negado(quien, permitido, "Un bono lo otorga quien tiene permiso de autorizar pagos."); if (no) return { ok: false, dice: no }; }
  if (!persona?.id) return { ok: false, dice: "Falta a quién se le da." };
  if (!CLASES_DE_BONO[clase]) return { ok: false, dice: "Falta decir qué clase de bono es." };
  const m = centavos(monto);
  if (!(m > 0)) return { ok: false, dice: "Falta el importe." };
  if (limpio(motivo).length < 4) return { ok: false, dice: "Falta el motivo: por qué se le da." };
  if (DE_LEY.test(motivo)) return { ok: false, dice: "Eso no es un bono: el aguinaldo, las vacaciones, la prima y lo de una baja se llevan en Prestaciones, con su propia cuenta. Aquí van sólo los bonos e incentivos que el rancho decide dar." };
  if (!esFecha(desde) || !esFecha(hasta) || hasta < desde) return { ok: false, dice: "Falta el periodo que premia (desde y hasta). Si es de un solo día, pon la misma fecha en las dos." };
  if (hasta > (fecha || hasta)) return { ok: false, dice: "El periodo que premia todavía no termina. Se otorga cuando ya se sabe el resultado." };
  if (limpio(autorizo).length < 3) return { ok: false, dice: "Falta quién lo autoriza." };
  if (!TRATAMIENTOS_DE_BONO[tratamiento]) return { ok: false, dice: "Falta decir cómo se trata su costo." };
  const antes = bonosDe(eventos).filter(b => b.personaId === persona.id && b.clase === clase && b.desde === desde && b.hasta === hasta), avisos = [];
  if (antes.some(b => b.monto === m)) return { ok: false, dice: `${limpio(persona.nombre)} ya tiene ese mismo bono (${m}, del ${desde} al ${hasta}). Si de verdad son dos, cambia el motivo y el periodo de uno; si fue un error, no hace falta capturarlo otra vez.` };
  if (antes.length) avisos.push(`Ya tenía otro bono de esa clase en ese mismo periodo (${antes.map(b => b.monto).join(", ")}). Se guarda; revisa que no sea el mismo.`);
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T_BONO, cuando, fecha, quien, azar, datos: { personaId: persona.id, nombre: limpio(persona.nombre), clase, motivo: limpio(motivo), monto: m, desde, hasta, autorizo: limpio(autorizo), tratamiento,
    integra: integra == null ? integraPorDefecto(clase) : !!integra, ...(evidencia ? { evidencia } : {}) } }) };
}

export function pagarBono({ permitido, eventos = [], bono, monto, medio = "efectivo", recibe = "", nota = "", quien, cuando, fecha, azar }) {
  { const no = negado(quien, permitido, "El pago de un bono lo registra quien tiene permiso de autorizar pagos."); if (no) return { ok: false, dice: no }; }
  const b = bono?.id ? bonosDe(eventos).find(x => x.id === bono.id) : null;
  if (!b) return { ok: false, dice: "Ese bono no está vigente." };
  const m = centavos(monto);
  if (!(m > 0)) return { ok: false, dice: "Falta cuánto se entregó." };
  if (m > b.pendiente + 0.004) return { ok: false, dice: `De ese bono quedan ${b.pendiente} por pagar. No se registra un pago mayor.` };
  return { ok: true, evento: nuevoEvento({ tipo: T_PAGO_BONO, cuando, fecha, quien, azar, datos: { bonoId: b.id, personaId: b.personaId, nombre: b.nombre, monto: m, medio, recibe: limpio(recibe), nota: limpio(nota) } }) };
}

// Los bonos vigentes, cada uno con lo pagado y lo que falta.
export function bonosDe(eventos = []) {
  const v = vigentes(eventos), pagos = v.filter(e => e.tipo === T_PAGO_BONO);
  return v.filter(e => e.tipo === T_BONO).map(e => {
    const mios = pagos.filter(p => p.datos.bonoId === e.id), pagado = sumarDinero(mios.map(p => p.datos.monto)), pendiente = sumarDinero(e.datos.monto, -pagado);
    return { id: e.id, ...e.datos, fecha: e.fecha, otorgo: e.quien?.nombre || "", pagado, pendiente, estado: pendiente <= 0.004 ? "pagado" : pagado > 0 ? "parcial" : "pendiente", pagos: mios.map(p => ({ id: p.id, fecha: p.fecha, monto: p.datos.monto, medio: p.datos.medio, por: p.quien?.nombre || "" })) };
  }).sort((a, b) => b.hasta.localeCompare(a.hasta) || a.nombre.localeCompare(b.nombre));
}
export const NOMBRE_DE_ESTADO = { pendiente: "Por pagar", parcial: "Pagado en parte", pagado: "Pagado" };

// Para los costos: un renglón por bono, el último día del periodo que premia.
export const renglonesDeBonos = (eventos = []) => bonosDe(eventos).map(b => ({ personaId: b.personaId, nombre: b.nombre, fecha: b.hasta, monto: b.monto, concepto: b.clase, tratamiento: b.tratamiento, evs: [b.id],
  que: CLASES_DE_BONO[b.clase], detalle: `${b.motivo} · del ${b.desde} al ${b.hasta} · autorizó ${b.autorizo}` }));

// Para el salario integrado: lo que de sus bonos cuenta, dentro de una ventana de fechas.
export const bonosQueIntegran = (eventos = [], personaId, desde, hasta) => bonosDe(eventos).filter(b => b.personaId === personaId && b.integra && b.hasta >= desde && b.hasta <= hasta);
