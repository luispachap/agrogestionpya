// ════════════════════════════════════════════════════════════════════════
//  BAJAS — cuando termina la relación de trabajo
//
//  No todas las terminaciones dan lo mismo:
//    FINIQUITO     lo que ya se ganó y no se ha pagado: aguinaldo proporcional,
//                  vacaciones no disfrutadas y su prima. Se paga SIEMPRE, sea
//                  cual sea la causa (renuncia, término del contrato, despido).
//    LIQUIDACIÓN   el finiquito MÁS las indemnizaciones, cuando la terminación
//                  es responsabilidad del patrón (despido injustificado, o el
//                  trabajador rescinde por causa del patrón).
//    Aparte, la PRIMA DE ANTIGÜEDAD, que depende de la causa y de los años.
//
//  La app PROPONE cada concepto con su cuenta y el artículo en que se apoya, y
//  marca cuáles hay que revisar. NO decide: qué procede en un caso concreto es
//  un juicio de quien lleva las obligaciones con el personal, y los importes
//  los confirma una persona con el permiso (`baja_personal`, sensible).
//  Referencia: Ley Federal del Trabajo, arts. 48, 50, 54, 76, 80, 87, 89 y 162.
//
//  SIN DUPLICAR: aguinaldo, vacaciones y prima ya se venían generando. Al dar
//  de baja, de esos tres sólo va al costo la DIFERENCIA contra lo generado. Lo
//  demás (prima de antigüedad, indemnizaciones) es costo nuevo de ese día, y
//  no se reparte a parcelas sin una regla (`ind_bajas`).
//  Lo que se le deba de sus semanas se paga en Pagos al personal: aquí no se repite.
// ════════════════════════════════════════════════════════════════════════
import { nuevoEvento, vigentes, negado } from "./eventos.js";
import { sumarDinero } from "./calculos.js";
import { CONCEPTOS_PRESTACION, condicionesDe } from "./prestaciones.js";

export const T_BAJA = "baja_personal", T_PAGO_BAJA = "pago_baja";
export const CAUSAS_DE_BAJA = {
  renuncia: { nombre: "Renuncia voluntaria", da: "finiquito" },
  mutuo_acuerdo: { nombre: "Mutuo acuerdo", da: "finiquito" },
  termino_contrato: { nombre: "Terminó la obra, el plazo o la temporada", da: "finiquito" },
  despido_justificado: { nombre: "Despido con causa justificada", da: "finiquito" },
  despido_injustificado: { nombre: "Despido sin causa justificada", da: "liquidacion" },
  rescision_trabajador: { nombre: "El trabajador da por terminada la relación por causa del patrón", da: "liquidacion" },
  incapacidad: { nombre: "Incapacidad que le impide seguir trabajando", da: "finiquito" },
  muerte: { nombre: "Fallecimiento del trabajador", da: "finiquito" },
  otra: { nombre: "Otra causa", da: "finiquito" },
};
export const NOMBRE_DE = { finiquito: "Finiquito", liquidacion: "Liquidación (finiquito más indemnizaciones)" };
export const CONCEPTOS_DE_BAJA = { ...CONCEPTOS_PRESTACION, prima_antiguedad: "Prima de antigüedad", indemnizacion_3m: "Indemnización de tres meses", veinte_dias: "Veinte días por año", un_mes: "Un mes de salario por incapacidad", otro: "Otro concepto" };
export const ES_PRESTACION = (clave) => !!CONCEPTOS_PRESTACION[clave];
const limpio = (s) => String(s || "").trim();
const centavos = (n) => Math.round(n * 100) / 100;
const dias = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000) + 1;

// La propuesta. `cuenta`: la de prestaciones de esa persona calculada HASTA el día de la baja.
// `reglas.salarioMinimo`: el salario mínimo por día vigente (para el tope de la prima de antigüedad); sin él no se propone esa cifra.
// Cada concepto: aplica "si" | "revisar" | "no", monto (o null si no se puede calcular), explica, fundamento.
export function proponerBaja({ persona, causa, fecha, cuenta, reglas = {}, remuneraciones = [] }) {
  const def = CAUSAS_DE_BAJA[causa];
  if (!def) return { ok: false, dice: "Falta la causa de la terminación." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || "")) return { ok: false, dice: "Falta el último día de trabajo." };
  const cond = condicionesDe(persona, reglas, remuneraciones);
  if (cond.falta.length) return { ok: false, dice: `Pendiente de revisión: falta ${cond.falta.join(" y ")}. Sin eso la app no propone nada; no quiere decir que no se le deba.` };
  if (fecha < cond.ingreso) return { ok: false, dice: "El último día no puede ser antes de su ingreso." };
  const base = cond.baseDe("aguinaldo", fecha), anios = dias(cond.ingreso, fecha) / 365, completos = Math.floor(anios);
  const sinBase = base.monto == null ? `no hay con qué calcular su salario por día (${base.revisar})` : "";
  const integrado = "La ley pide calcular las indemnizaciones con el salario integrado (art. 89), que incluye prestaciones; aquí se usó su salario por día. Hay que revisarlo.";
  const conceptos = [];
  // 1. Lo que ya ganó: siempre.
  for (const c of Object.keys(CONCEPTOS_PRESTACION)) {
    const x = cuenta?.conceptos?.[c], rev = (x?.porRevisar || []).length > 0 || x?.estimado;
    conceptos.push({ clave: c, nombre: CONCEPTOS_DE_BAJA[c] + (c === "aguinaldo" ? " proporcional" : c === "vacaciones" ? " no disfrutadas" : ""), aplica: rev ? "revisar" : "si", monto: x ? Math.max(0, x.pendiente) : null, yaGenerado: x ? x.pendiente : 0,
      fundamento: c === "aguinaldo" ? "art. 87" : c === "vacaciones" ? "arts. 76 y 79" : "art. 80",
      explica: x ? `Lo que tiene pendiente en su cuenta al ${fecha} (saldo inicial + generado − pagado${c === "vacaciones" ? " − disfrutado" : ""}).${rev ? " Parte de su cuenta está por revisar." : ""}` : "No hay cuenta de prestaciones calculada." });
  }
  // 2. Prima de antigüedad: 12 días por año, con tope de dos salarios mínimos.
  const sm = Number(reglas.salarioMinimo) || 0, tope = sm > 0 && base.monto != null ? Math.min(base.monto, 2 * sm) : null;
  const procedePA = ["despido_justificado", "despido_injustificado", "rescision_trabajador", "incapacidad", "muerte"].includes(causa) ? "si" : causa === "renuncia" ? (completos >= 15 ? "si" : "no") : "revisar";
  conceptos.push({ clave: "prima_antiguedad", nombre: CONCEPTOS_DE_BAJA.prima_antiguedad, fundamento: "art. 162", yaGenerado: 0,
    aplica: procedePA === "no" ? "no" : tope == null ? "revisar" : procedePA,
    monto: procedePA === "no" || tope == null ? null : centavos(12 * anios * tope),
    explica: procedePA === "no" ? `En una renuncia se paga con 15 años o más de servicio; lleva ${completos}.`
      : tope == null ? (sinBase || "Falta capturar el salario mínimo por día vigente (en las reglas): la ley topa esta prima al doble del mínimo, y sin ese dato no se propone una cifra.")
      : `12 días × ${centavos(anios)} años × ${tope} (${tope < base.monto ? "el tope de dos salarios mínimos" : base.origen}).${procedePA === "revisar" ? " En esta causa hay que revisar si procede." : ""}` });
  // 3. Indemnizaciones: sólo cuando la terminación es responsabilidad del patrón, y siempre por revisar.
  const esLiq = def.da === "liquidacion";
  conceptos.push({ clave: "indemnizacion_3m", nombre: CONCEPTOS_DE_BAJA.indemnizacion_3m, fundamento: "arts. 48 y 50", yaGenerado: 0, aplica: esLiq ? "revisar" : "no", monto: esLiq && base.monto != null ? centavos(90 * base.monto) : null,
    explica: !esLiq ? "Sólo cuando la terminación es responsabilidad del patrón." : sinBase || `90 días × ${base.monto} (${base.origen}). Procede si no hay reinstalación. ${integrado}` });
  conceptos.push({ clave: "veinte_dias", nombre: CONCEPTOS_DE_BAJA.veinte_dias, fundamento: "arts. 49, 50 y 52", yaGenerado: 0, aplica: esLiq ? "revisar" : "no", monto: esLiq && base.monto != null ? centavos(20 * anios * base.monto) : null,
    explica: !esLiq ? "Sólo cuando la terminación es responsabilidad del patrón." : sinBase || `20 días × ${centavos(anios)} años × ${base.monto}. NO procede en todo despido: depende del caso (por ejemplo, si el patrón no reinstala o si el trabajador es quien rescinde). ${integrado}` });
  if (causa === "incapacidad") conceptos.push({ clave: "un_mes", nombre: CONCEPTOS_DE_BAJA.un_mes, fundamento: "art. 54", yaGenerado: 0, aplica: "revisar", monto: base.monto != null ? centavos(30 * base.monto) : null,
    explica: sinBase || `30 días × ${base.monto}. Es para la incapacidad que NO viene de un riesgo de trabajo; si viene de uno, lo que corresponde es otra cosa y la app no lo calcula.` });
  const avisos = ["Lo que se le deba de sus semanas trabajadas se paga en Pagos al personal: aquí no se repite."];
  if (causa === "muerte") avisos.push("Se paga a sus beneficiarios. Si fue por un riesgo de trabajo corresponden otras indemnizaciones que la app no calcula.");
  if (esLiq) avisos.push("Si el caso llega a juicio pueden correr salarios vencidos; la app no los calcula.");
  if (causa === "otra") avisos.push("Con «otra causa» la app sólo propone lo que ya ganó. Lo demás hay que revisarlo.");
  return { ok: true, tipo: def.da, anios: centavos(anios), base: base.monto, conceptos, avisos };
}

export const bajasDe = (eventos) => { const m = new Map(); for (const e of vigentes(eventos).filter(e => e.tipo === T_BAJA).sort((a, b) => a.cuando.localeCompare(b.cuando))) m.set(e.datos.personaId, e); return m; };
export const pagosDeBaja = (eventos, bajaId) => vigentes(eventos).filter(e => e.tipo === T_PAGO_BAJA && (!bajaId || e.datos.bajaId === bajaId));

// Registrar la baja con los importes que una persona confirmó.
//   ultimoDia   el último día de trabajo (`fecha` es el día en que se captura)
//   conceptos   [{ clave, monto, nota }] — los tres de prestaciones van SIEMPRE (aunque sea en cero, a propósito)
//   propuesta   lo que propuso la app (se guarda completo: es el cálculo)
export function registrarBaja({ permitido, eventos, persona, causa, ultimoDia, detalle = "", conceptos = [], propuesta = null, autorizo, evidencias = [], pdf = null, quien, cuando, fecha, azar }) {
  { const no = negado(quien, permitido, "Una baja la determina un administrador."); if (no) return { ok: false, dice: no }; }
  if (!persona?.id) return { ok: false, dice: "Falta decir de quién." };
  if (!CAUSAS_DE_BAJA[causa]) return { ok: false, dice: "Falta la causa de la terminación." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ultimoDia || "")) return { ok: false, dice: "Falta el último día de trabajo." };
  if (causa === "otra" && !limpio(detalle)) return { ok: false, dice: "Con «otra causa» hay que escribir cuál." };
  if (!limpio(autorizo)) return { ok: false, dice: "Falta quién lo autoriza." };
  if (bajasDe(eventos).has(persona.id)) return { ok: false, dice: "Esa persona ya tiene una baja registrada. Si cambió, se corrige ese registro (queda el historial)." };
  const lista = [];
  for (const k of conceptos) {
    if (!CONCEPTOS_DE_BAJA[k.clave]) return { ok: false, dice: "Hay un concepto que la app no conoce." };
    if (k.monto === "" || k.monto == null || !(Number(k.monto) >= 0)) return { ok: false, dice: `Falta el importe de «${CONCEPTOS_DE_BAJA[k.clave]}». Si no procede, se quita o se pone en cero a propósito.` };
    if (k.clave === "otro" && !limpio(k.nota)) return { ok: false, dice: "El «otro concepto» necesita decir qué es." };
    const p = (propuesta?.conceptos || []).find(x => x.clave === k.clave);
    lista.push({ clave: k.clave, nombre: p?.nombre || CONCEPTOS_DE_BAJA[k.clave], monto: centavos(Number(k.monto)), nota: limpio(k.nota), propuesto: p ? p.monto : null, aplica: p?.aplica || null, explica: p?.explica || "", fundamento: p?.fundamento || "" });
  }
  const faltan = Object.keys(CONCEPTOS_PRESTACION).filter(c => !lista.some(k => k.clave === c));
  if (faltan.length) return { ok: false, dice: `Aguinaldo, vacaciones y prima vacacional van siempre en una baja (falta ${faltan.map(c => CONCEPTOS_DE_BAJA[c].toLowerCase()).join(" y ")}): es lo que ya ganó.` };
  const avisos = [];
  if (!evidencias.length) avisos.push("Quedó sin documentos (renuncia, aviso, recibo firmado). Se pueden agregar corrigiendo el registro.");
  if (lista.some(k => k.aplica === "revisar")) avisos.push("Hay conceptos que la app marcó «por revisar». Quedaron con el importe que confirmaste.");
  const datos = { personaId: persona.id, nombre: limpio(persona.nombre), causa, da: CAUSAS_DE_BAJA[causa].da, fecha: ultimoDia, detalle: limpio(detalle), conceptos: lista, total: sumarDinero(lista.map(k => k.monto)), autorizo: limpio(autorizo), ...(evidencias.length ? { evidencias } : {}) };
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T_BAJA, cuando, fecha, quien, azar, datos: { ...datos, ...(typeof pdf === "function" ? { pdf: pdf(datos) } : {}) } }) };
}

export function pagarBaja({ permitido, eventos, baja, monto, medio, recibe = "", comprobante = null, nota = "", quien, cuando, fecha, azar }) {
  const m = centavos(Number(monto));
  { const no = negado(quien, permitido, "Un pago lo registra un administrador."); if (no) return { ok: false, dice: no }; }
  if (!baja?.id || !bajasDe(eventos).get(baja.datos.personaId) || bajasDe(eventos).get(baja.datos.personaId).id !== baja.id) return { ok: false, dice: "Esa baja ya no está vigente." };
  if (!(m > 0)) return { ok: false, dice: "Falta cuánto se entregó." };
  if (!limpio(medio)) return { ok: false, dice: "Falta por qué medio se pagó." };
  const ya = sumarDinero(pagosDeBaja(eventos, baja.id).map(p => p.datos.monto)), avisos = [];
  if (sumarDinero(ya, m) > baja.datos.total + 0.004) avisos.push(`Con este pago van ${sumarDinero(ya, m)} entregados y el total son ${baja.datos.total}. Se registra igual; revisa que no sea un pago doble.`);
  if (!comprobante) avisos.push("Quedó sin comprobante.");
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T_PAGO_BAJA, cuando, fecha, quien, azar, origen: baja.id, relacion: "paga", datos: { bajaId: baja.id, personaId: baja.datos.personaId, nombre: baja.datos.nombre, monto: m, medio, recibe: limpio(recibe), ...(comprobante ? { comprobante } : {}), nota: limpio(nota) } }) };
}

// Lo que NO es prestación ya generada (prima de antigüedad, indemnizaciones, otros) es costo nuevo del día de la baja.
export function renglonesDeBajas(eventos) {
  return [...bajasDe(eventos).values()].flatMap(b => b.datos.conceptos.filter(k => !ES_PRESTACION(k.clave) && k.monto !== 0).map(k => ({ personaId: b.datos.personaId, nombre: b.datos.nombre, fecha: b.datos.fecha, monto: k.monto, concepto: k.clave, evs: [b.id],
    que: `${NOMBRE_DE[b.datos.da].split(" (")[0]} por ${CAUSAS_DE_BAJA[b.datos.causa].nombre.toLowerCase()} · ${k.nombre}${k.nota ? ` (${k.nota})` : ""}`, detalle: k.explica || "importe confirmado por quien autorizó" })));
}
