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
//  Referencia: Ley Federal del Trabajo, arts. 48, 49, 50, 52, 54, 76, 80, 84, 87, 89, 162, 485 y 486.
//
//  SIN DUPLICAR: aguinaldo, vacaciones y prima ya se venían generando. Al dar
//  de baja, de esos tres sólo va al costo la DIFERENCIA contra lo generado. Lo
//  demás (prima de antigüedad, indemnizaciones) es costo nuevo de ese día: por
//  decisión de Luis es un GASTO LABORAL GENERAL, que no se reparte a parcelas
//  (`ind_bajas`, por defecto `general`).
//
//  CON QUÉ SALARIO SE CALCULA CADA COSA (no es el mismo):
//   · Aguinaldo, vacaciones y prima vacacional: lo que ya trae su cuenta.
//   · Prima de antigüedad (art. 162): su salario por día, que no puede ser
//     menor que el salario mínimo (art. 485) ni mayor que el doble (art. 486).
//     El salario mínimo es el VIGENTE EL DÍA DE LA BAJA (`salariosMinimos.js`).
//   · Indemnizaciones (arts. 48, 50, 52 y 54): el SALARIO INTEGRADO del día en
//     que nace el derecho (arts. 84 y 89): la cuota diaria más la parte
//     proporcional de sus prestaciones. La app integra las que conoce
//     (aguinaldo y prima vacacional) y avisa que si recibe otras percepciones
//     fijas hay que sumarlas: por eso siempre quedan «por revisar».
//   · Los VEINTE DÍAS POR AÑO no van en todo despido: proceden cuando el
//     trabajador rescinde por causa del patrón (art. 52) o cuando el patrón no
//     reinstala en los casos del art. 49. En un despido la app NO los incluye
//     de entrada: los deja a la vista para que una persona los agregue si proceden.
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

// El salario integrado de un día: la cuota diaria más la parte proporcional de las prestaciones que la app conoce.
// `n`: el año de servicio que corría (de ahí salen sus días de vacaciones).
export function salarioIntegrado(cond, diario, n) {
  if (diario == null) return { monto: null, factor: null, explica: "" };
  const vac = cond.vacDias(Math.max(1, n)), factor = 1 + (cond.aguinaldoDias + vac * cond.primaPct / 100) / 365;
  return { monto: centavos(diario * factor), factor: Math.round(factor * 10000) / 10000,
    explica: `salario integrado de ${centavos(diario * factor)} por día: ${diario} más la parte de su aguinaldo (${cond.aguinaldoDias} días) y de su prima vacacional (${cond.primaPct} % de ${vac} días), entre 365. Si además recibe otras percepciones fijas (bonos, despensa, habitación, comisiones), hay que sumarlas: la app no las conoce` };
}

// La propuesta. `cuenta`: la de prestaciones de esa persona calculada HASTA el día de la baja.
// `minimo`: lo que devuelve `salarioMinimoEn(fecha, zona, eventos)` — el salario mínimo vigente ESE día. Sin él no se propone la prima de antigüedad.
// Cada concepto: aplica "si" | "revisar" | "no", sugerido (si entra de entrada en la baja), monto (o null si no se puede calcular), explica, fundamento.
export function proponerBaja({ persona, causa, fecha, cuenta, reglas = {}, remuneraciones = [], minimo = null }) {
  const def = CAUSAS_DE_BAJA[causa];
  if (!def) return { ok: false, dice: "Falta la causa de la terminación." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || "")) return { ok: false, dice: "Falta el último día de trabajo." };
  const cond = condicionesDe(persona, reglas, remuneraciones);
  if (cond.falta.length) return { ok: false, dice: `Pendiente de revisión: falta ${cond.falta.join(" y ")}. Sin eso la app no propone nada; no quiere decir que no se le deba.` };
  if (fecha < cond.ingreso) return { ok: false, dice: "El último día no puede ser antes de su ingreso." };
  const base = cond.baseDe("aguinaldo", fecha), anios = dias(cond.ingreso, fecha) / 365, completos = Math.floor(anios);
  const sinBase = base.monto == null ? `no hay con qué calcular su salario por día (${base.revisar})` : "";
  const sdi = salarioIntegrado(cond, base.monto, completos + 1);
  const conceptos = [];
  // 1. Lo que ya ganó: siempre.
  for (const c of Object.keys(CONCEPTOS_PRESTACION)) {
    const x = cuenta?.conceptos?.[c], rev = (x?.porRevisar || []).length > 0 || x?.estimado;
    conceptos.push({ clave: c, nombre: CONCEPTOS_DE_BAJA[c] + (c === "aguinaldo" ? " proporcional" : c === "vacaciones" ? " no disfrutadas" : ""), aplica: rev ? "revisar" : "si", sugerido: true, monto: x ? Math.max(0, x.pendiente) : null, yaGenerado: x ? x.pendiente : 0,
      fundamento: c === "aguinaldo" ? "art. 87" : c === "vacaciones" ? "arts. 76 y 79" : "art. 80",
      explica: x ? `Lo que tiene pendiente en su cuenta al ${fecha} (saldo inicial + generado − pagado${c === "vacaciones" ? " − disfrutado" : ""}).${rev ? " Parte de su cuenta está por revisar." : ""}` : "No hay cuenta de prestaciones calculada." });
  }
  // 2. Prima de antigüedad: 12 días por año. Su salario por día, nunca menos que el mínimo ni más que el doble (el mínimo de ESE día).
  const sm = Number(minimo?.monto) > 0 ? Number(minimo.monto) : null;
  const paBase = sm != null && base.monto != null ? Math.min(Math.max(base.monto, sm), 2 * sm) : null;
  const procedePA = ["despido_justificado", "despido_injustificado", "rescision_trabajador", "incapacidad", "muerte"].includes(causa) ? "si" : causa === "renuncia" ? (completos >= 15 ? "si" : "no") : "revisar";
  const dondeSm = sm != null ? `el salario mínimo ${minimo.zona === "frontera" ? "de la frontera norte" : "general"} vigente el ${fecha} es ${sm}${minimo.fuente ? ` (${minimo.fuente})` : ""}` : "";
  conceptos.push({ clave: "prima_antiguedad", nombre: CONCEPTOS_DE_BAJA.prima_antiguedad, fundamento: "arts. 162, 485 y 486", yaGenerado: 0, sugerido: procedePA !== "no",
    aplica: procedePA === "no" ? "no" : paBase == null ? "revisar" : procedePA,
    monto: procedePA === "no" || paBase == null ? null : centavos(12 * anios * paBase),
    explica: procedePA === "no" ? `En una renuncia se paga con 15 años o más de servicio; lleva ${completos}.`
      : paBase == null ? (sinBase || `${minimo?.dice || "Falta el salario mínimo vigente ese día."} La ley topa esta prima al doble del salario mínimo, y sin ese dato no se propone una cifra.`)
      : `12 días × ${centavos(anios)} años × ${paBase} (${paBase < base.monto ? "el tope de dos salarios mínimos" : paBase > base.monto ? "el salario mínimo, porque su salario por día es menor" : base.origen}; ${dondeSm}).${procedePA === "revisar" ? " En esta causa hay que revisar si procede." : ""}` });
  // 3. Indemnizaciones: sólo cuando la terminación es responsabilidad del patrón, con salario integrado, y siempre por revisar.
  const esLiq = def.da === "liquidacion", determinado = cond.relacion === "temporada" || cond.relacion === "eventual";
  conceptos.push({ clave: "indemnizacion_3m", nombre: CONCEPTOS_DE_BAJA.indemnizacion_3m, fundamento: "arts. 48, 50 y 89", yaGenerado: 0, aplica: esLiq ? "revisar" : "no", sugerido: esLiq, monto: esLiq && sdi.monto != null ? centavos(90 * sdi.monto) : null,
    explica: !esLiq ? "Sólo cuando la terminación es responsabilidad del patrón." : sinBase || `90 días × ${sdi.monto}. Se usa el ${sdi.explica}. Procede si no hay reinstalación.` });
  const porque20 = causa === "rescision_trabajador" ? "Cuando es el trabajador quien da por terminada la relación por causa del patrón, la ley sí los prevé (art. 52)."
    : "NO procede en todo despido: la ley los prevé cuando el patrón no reinstala en los casos del art. 49 (menos de un año de antigüedad, trabajo de confianza, contacto directo y permanente con el patrón, trabajo eventual). Por eso la app no los incluye de entrada: si en este caso proceden, márcalos.";
  conceptos.push({ clave: "veinte_dias", nombre: CONCEPTOS_DE_BAJA.veinte_dias, fundamento: "arts. 49, 50, 52 y 89", yaGenerado: 0, aplica: esLiq ? "revisar" : "no", sugerido: causa === "rescision_trabajador",
    monto: esLiq && sdi.monto != null && !determinado ? centavos(20 * anios * sdi.monto) : null,
    explica: !esLiq ? "Sólo cuando la terminación es responsabilidad del patrón." : sinBase
      || (determinado ? `${porque20} Además su relación de trabajo está registrada como de ${cond.relacion === "temporada" ? "temporada" : "obra o tiempo determinado"}: ahí la cuenta no son veinte días por año sino la del art. 50 fracción I, y la app no la propone.`
        : `20 días × ${centavos(anios)} años × ${sdi.monto} (salario integrado). ${porque20}`) });
  if (causa === "incapacidad") conceptos.push({ clave: "un_mes", nombre: CONCEPTOS_DE_BAJA.un_mes, fundamento: "arts. 54 y 89", yaGenerado: 0, aplica: "revisar", sugerido: true, monto: sdi.monto != null ? centavos(30 * sdi.monto) : null,
    explica: sinBase || `30 días × ${sdi.monto}. Se usa el ${sdi.explica}. Es para la incapacidad que NO viene de un riesgo de trabajo; si viene de uno, lo que corresponde es otra cosa y la app no lo calcula.` });
  const avisos = ["Lo que se le deba de sus semanas trabajadas se paga en Pagos al personal: aquí no se repite.", "Esto es una propuesta para revisar, no una determinación: los importes valen cuando una persona los confirma y dice quién autoriza."];
  if (causa === "muerte") avisos.push("Se paga a sus beneficiarios. Si fue por un riesgo de trabajo corresponden otras indemnizaciones que la app no calcula.");
  if (esLiq) avisos.push("Si el caso llega a juicio pueden correr salarios vencidos; la app no los calcula.");
  if (causa === "otra") avisos.push("Con «otra causa» la app sólo propone lo que ya ganó. Lo demás hay que revisarlo.");
  return { ok: true, tipo: def.da, anios: centavos(anios), base: base.monto, integrado: sdi.monto, factor: sdi.factor, minimo: sm, conceptos, avisos };
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
  const datos = { personaId: persona.id, nombre: limpio(persona.nombre), causa, da: CAUSAS_DE_BAJA[causa].da, fecha: ultimoDia, ...(propuesta?.ok ? { bases: { salarioDia: propuesta.base, salarioIntegrado: propuesta.integrado, factor: propuesta.factor, salarioMinimo: propuesta.minimo, anios: propuesta.anios } } : {}), detalle: limpio(detalle), conceptos: lista, total: sumarDinero(lista.map(k => k.monto)), autorizo: limpio(autorizo), ...(evidencias.length ? { evidencias } : {}) };
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
  return [...bajasDe(eventos).values()].flatMap(b => b.datos.conceptos.filter(k => !ES_PRESTACION(k.clave) && k.monto !== 0).map(k => ({ personaId: b.datos.personaId, nombre: b.datos.nombre, fecha: b.datos.fecha, monto: k.monto, concepto: k.clave, evs: [b.id], causa: b.datos.causa, da: b.datos.da, documentos: (b.datos.evidencias || []).length,
    que: `${NOMBRE_DE[b.datos.da].split(" (")[0]} por ${CAUSAS_DE_BAJA[b.datos.causa].nombre.toLowerCase()} · ${k.nombre}${k.nota ? ` (${k.nota})` : ""}`, detalle: k.explica || "importe confirmado por quien autorizó" })));
}
