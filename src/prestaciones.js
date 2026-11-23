// ════════════════════════════════════════════════════════════════════════
//  PRESTACIONES — aguinaldo, vacaciones y prima vacacional
//
//  Cinco cosas que no se revuelven:
//    lo que se va generando   (provisión) se CALCULA día con día desde la fecha
//                             de ingreso. Nadie lo captura y no se guarda.
//    lo determinado           cuando una persona dice "el aguinaldo de 2026 de
//                             Juan son $X" (`prestacion_determinada`).
//    lo pagado                cada entrega (`pago_prestacion`). Pagar NO es costo.
//    el ajuste                determinado − lo que ya se había generado. Es lo
//                             único que se agrega al costo al determinar.
//    lo que va a producción   lo generado + los ajustes, repartido como costo
//                             indirecto (fuente "Prestaciones").
//  Así una prestación entra al costo UNA vez: conforme se genera. Determinarla
//  o pagarla después no la vuelve a cargar.
//
//  SALDO INICIAL. Las personas ya traían prestaciones generadas antes de que
//  AgroGestión llevara la cuenta. Eso NO se inventa ni se carga a las parcelas
//  de hoy: se captura (`prestacion_saldo_inicial`) con importe, periodo, en qué
//  se funda, quién responde y evidencia. La fecha de corte dice desde qué día
//  el costo es de este sistema. Cada cuenta separa: saldo inicial, lo generado
//  después, ajustes, pagos y lo pendiente.
//
//  QUIEN COBRA POR DESTAJO también genera prestaciones: cómo se le paga no
//  decide si tiene derechos. Su base no es un sueldo por día inventado: es el
//  promedio de lo que ganó en sus últimos días efectivamente trabajados (30,
//  configurable). Si no hay con qué promediar, el cálculo queda PENDIENTE DE
//  REVISIÓN: no vale cero.
//
//  La ley es el piso, no la regla de todos: cada persona puede tener más días,
//  otra prima u otra base (su ficha), y el rancho puede subir el piso (AJUSTES).
//  Referencia: Ley Federal del Trabajo, arts. 76 (vacaciones), 80 (prima) y
//  87 (aguinaldo). Esto es control interno: no sustituye la revisión de quien
//  lleve lo laboral, ni calcula impuestos ni cuotas.
// ════════════════════════════════════════════════════════════════════════
import { nuevoEvento, vigentes, negado } from "./eventos.js";
import { sumarDinero, sueldoVigente, sumarDias } from "./calculos.js";

export const T_DETERMINADA = "prestacion_determinada", T_PAGO_PRESTACION = "pago_prestacion", T_SALDO_INICIAL = "prestacion_saldo_inicial";
export const CONCEPTOS_PRESTACION = { aguinaldo: "Aguinaldo", vacaciones: "Vacaciones", prima: "Prima vacacional" };
// En un saldo inicial cabe además cualquier otra obligación que ya se traía.
export const CONCEPTOS_DE_SALDO = { ...CONCEPTOS_PRESTACION, otra: "Otra obligación con esa persona" };
// La relación de trabajo es una cosa y la forma de pago otra. Ninguna de éstas quita prestaciones por sí sola.
export const RELACIONES = { planta: "De planta (por tiempo indeterminado)", temporada: "De temporada (regresa cada ciclo)", eventual: "Eventual (por obra o tiempo determinado)", por_definir: "Por definir" };
export const LEY = { aguinaldoDias: 15, primaPct: 25, diasPromedio: 30 };
const limpio = (s) => String(s || "").trim();
const centavos = (n) => Math.round(n * 100) / 100;
const dia = (f) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));
const diasDeAaB = (a, b) => Math.round((dia(b) - dia(a)) / 86400000) + 1;      // contando los dos extremos
const finDeMes = (f) => { const d = new Date(Date.UTC(+f.slice(0, 4), +f.slice(5, 7), 0)); return d.toISOString().slice(0, 10); };
const menor = (a, b) => (a < b ? a : b), mayor = (a, b) => (a > b ? a : b);
const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f || "");

// Días de vacaciones que marca la ley al CUMPLIR el año de servicio `n`:
// 12 el primero, 2 más cada año hasta 20, y de ahí 2 más por cada cinco años.
export function vacacionesDeLey(n) {
  if (!(n >= 1)) return 0;
  return n <= 5 ? 10 + 2 * n : 20 + 2 * Math.ceil((n - 5) / 5);
}
// El aniversario número `n` de alguien (n = 0 es su ingreso). 29 de febrero → 28.
export function aniversario(ingreso, n) {
  const a = +ingreso.slice(0, 4) + n, md = ingreso.slice(5);
  return md === "02-29" && new Date(Date.UTC(a, 1, 29)).getUTCMonth() !== 1 ? `${a}-02-28` : `${a}-${md}`;
}
export function aniosCumplidos(ingreso, fecha) {
  if (!ingreso || fecha < ingreso) return 0;
  let n = +fecha.slice(0, 4) - +ingreso.slice(0, 4);
  if (aniversario(ingreso, n) > fecha) n--;
  return Math.max(0, n);
}

// Lo que alguien ganó por día efectivamente trabajado, para promediar. Sale de lo ya registrado:
// `devengado` (checador y destajo, de `manoDeObra`) y las actividades tecleadas que sí cuentan.
export function remuneracionesDe({ devengado = [], actividades = [] }) {
  const m = new Map();
  const pon = (id, fecha, monto) => { if (!id || !fecha || !(monto > 0)) return; if (!m.has(id)) m.set(id, new Map()); m.get(id).set(fecha, sumarDinero(m.get(id).get(fecha) || 0, monto)); };
  for (const d of devengado) pon(d.trabajadorId, d.fecha, d.monto);
  for (const a of actividades) if (!a._deEventos && a.registradoPor?.id) pon(a.registradoPor.id, a.fecha, Number(a.costoMO) || 0);
  const sale = new Map();
  for (const [id, dias] of m) sale.set(id, [...dias].map(([fecha, monto]) => ({ fecha, monto })).sort((a, b) => a.fecha.localeCompare(b.fecha)));
  return sale;
}
// Promedio de los últimos `n` días efectivamente trabajados hasta una fecha.
export function promedioDiario(remuneraciones, fecha, n) {
  const dias = (remuneraciones || []).filter(r => r.fecha <= fecha).slice(-n);
  if (dias.length === 0) return { monto: null, dias: 0 };
  return { monto: centavos(sumarDinero(dias.map(d => d.monto)) / dias.length), dias: dias.length, desde: dias[0].fecha, hasta: dias[dias.length - 1].fecha };
}

// Las condiciones de UNA persona: las de su ficha si son mejores que el piso.
// `reglas`: { aguinaldoDias, primaPct, vacExtra, diasPromedio } del rancho (AJUSTES).
// `remuneraciones`: [{ fecha, monto }] de esa persona (para quien no tiene un sueldo fijo por día).
export function condicionesDe(persona, reglas = {}, remuneraciones = []) {
  const f = persona?.prestaciones || {};
  const pisoAg = Math.max(LEY.aguinaldoDias, Number(reglas.aguinaldoDias) || 0), pisoPr = Math.max(LEY.primaPct, Number(reglas.primaPct) || 0), extra = Math.max(0, Number(reglas.vacExtra) || 0);
  const nProm = Math.max(1, Number(reglas.diasPromedio) || LEY.diasPromedio);
  const fijo = persona?.modalidadPago !== "destajo" && sueldoVigente(persona, "9999-12-31").sueldo > 0;
  const falta = [];
  if (!esFecha(persona?.fechaIngreso)) falta.push("la fecha de ingreso");
  // La base de un día: la de su ficha; si no, su sueldo por día; si cobra por lo que hace, su promedio.
  // Devuelve `monto: null` cuando no hay con qué calcular: eso es "pendiente de revisión", no un cero.
  const baseDe = (concepto, fecha) => {
    const propia = Number(concepto === "aguinaldo" ? f.baseAguinaldo : f.baseVacaciones);
    if (propia > 0) return { monto: propia, origen: "la base de su ficha", estimado: false };
    // Quien cobra por semana: la base es el promedio de su semana, no la parte del día que cayó la fecha.
    if (fijo) { const v = sueldoVigente(persona, fecha); return { monto: v.promedio ?? v.sueldo, origen: `${v.semana ? `su sueldo de la semana (${v.semana}) entre sus días` : "su sueldo por día"}${v.origen === "historial" ? " de esa fecha" : " de hoy (no hay historial de esa fecha)"}`, estimado: v.estimado === true }; }
    const p = promedioDiario(remuneraciones, fecha, nProm);
    if (p.monto == null) return { monto: null, origen: "", estimado: true, revisar: `no hay días trabajados registrados hasta el ${fecha} con qué promediar lo que gana` };
    return { monto: p.monto, origen: `el promedio de sus últimos ${p.dias} días trabajados (${p.desde} a ${p.hasta})`, estimado: p.dias < nProm, revisar: p.dias < nProm ? `el promedio sale de sólo ${p.dias} día${p.dias === 1 ? "" : "s"} trabajado${p.dias === 1 ? "" : "s"}; se piden ${nProm}` : "" };
  };
  return {
    ingreso: persona?.fechaIngreso || null, sinPrestaciones: f.sin === true, sinPorque: limpio(f.sinPorque), falta, fijo,
    relacion: RELACIONES[persona?.relacionLaboral] ? persona.relacionLaboral : "por_definir",
    aguinaldoDias: Math.max(pisoAg, Number(f.aguinaldoDias) || 0), primaPct: Math.max(pisoPr, Number(f.primaPct) || 0),
    // Días del año de servicio `n`: la ley + lo que dé de más el rancho, o los fijos de su ficha si son más.
    vacDias: (n) => Math.max(vacacionesDeLey(n) + extra, Number(f.vacacionesDias) || 0),
    baseDe, deSuFicha: { aguinaldo: Number(f.aguinaldoDias) > pisoAg, prima: Number(f.primaPct) > pisoPr, vacaciones: Number(f.vacacionesDias) > 0, base: Number(f.baseAguinaldo) > 0 || Number(f.baseVacaciones) > 0 },
  };
}

// Los periodos de un concepto que tocan unas fechas. El aguinaldo va por año
// de calendario ("2026"); vacaciones y prima, por año de servicio ("s3").
export function periodosDe(ingreso, concepto, desde, hasta) {
  const l = [];
  if (!ingreso || hasta < ingreso) return l;
  if (concepto === "aguinaldo") {
    for (let a = +mayor(desde, ingreso).slice(0, 4); a <= +hasta.slice(0, 4); a++) l.push({ periodo: String(a), n: null, ini: mayor(`${a}-01-01`, ingreso), fin: `${a}-12-31` });
    return l;
  }
  for (let n = aniosCumplidos(ingreso, mayor(desde, ingreso)) + 1; aniversario(ingreso, n - 1) <= hasta && l.length < 80; n++) l.push({ periodo: `s${n}`, n, ini: aniversario(ingreso, n - 1), fin: sumarDias(aniversario(ingreso, n), -1) });
  return l;
}
export const nombreDePeriodo = (periodo) => (/^s\d+$/.test(String(periodo)) ? `año de servicio ${String(periodo).slice(1)}` : /^\d{4}$/.test(String(periodo)) ? `año ${periodo}` : String(periodo));

// Lo que se genera de un concepto en un tramo, mes por mes. Sin redondear.
function generar(cond, concepto, p, desde, hasta) {
  const filas = [];
  for (let a = desde; a <= hasta;) {
    const b = menor(finDeMes(a), hasta), dias = diasDeAaB(a, b), base = cond.baseDe(concepto === "aguinaldo" ? "aguinaldo" : "vacaciones", b);
    const porAnio = concepto === "aguinaldo" ? cond.aguinaldoDias : concepto === "vacaciones" ? cond.vacDias(p.n) : cond.vacDias(p.n) * cond.primaPct / 100;
    filas.push({ mes: a.slice(0, 7), fecha: b, dias, monto: base.monto == null ? null : base.monto * porAnio * dias / 365, estimado: base.estimado, revisar: base.revisar || "",
      explica: base.monto == null ? "" : `${dias} día${dias === 1 ? "" : "s"} de ${a.slice(0, 7)} × ${centavos(porAnio)} días al año × ${base.monto} (${base.origen}) ÷ 365` });
    a = sumarDias(b, 1);
  }
  return filas;
}

// ── Saldos iniciales, lo determinado y lo pagado ───────────────────────────
// De dos registros del mismo periodo (dos aparatos sin señal) vale el último; el otro se enseña como repetido.
const ultimos = (eventos, tipo, personaId) => {
  const m = new Map();
  for (const e of vigentes(eventos).filter(e => e.tipo === tipo && (!personaId || e.datos.personaId === personaId)).sort((a, b) => a.cuando.localeCompare(b.cuando))) m.set(`${e.datos.personaId}|${e.datos.concepto}|${e.datos.periodo}`, e);
  return [...m.values()];
};
export const determinadasDe = (eventos, personaId) => ultimos(eventos, T_DETERMINADA, personaId);
export const saldosInicialesDe = (eventos, personaId) => ultimos(eventos, T_SALDO_INICIAL, personaId);
export const determinadasRepetidas = (eventos) => { const buenas = new Set([...determinadasDe(eventos), ...saldosInicialesDe(eventos)].map(e => e.id)); return vigentes(eventos).filter(e => (e.tipo === T_DETERMINADA || e.tipo === T_SALDO_INICIAL) && !buenas.has(e.id)); };
export const pagosDePrestacion = (eventos, personaId) => vigentes(eventos).filter(e => e.tipo === T_PAGO_PRESTACION && (!personaId || e.datos.personaId === personaId));

// Lo que la persona ya traía al corte. No es costo de AgroGestión: es una obligación que se reconoce.
export function capturarSaldoInicial({ permitido, eventos, persona, concepto, periodo, monto, dias = null, corte, fundamento, responsable, evidencia = null, quien, cuando, fecha, azar }) {
  const m = monto === "" || monto == null ? null : Number(monto), d = dias === "" || dias == null ? null : Number(dias);
  { const no = negado(quien, permitido, "Un saldo inicial lo captura un administrador."); if (no) return { ok: false, dice: no }; }
  if (!persona?.id) return { ok: false, dice: "Falta decir de quién." };
  if (!CONCEPTOS_DE_SALDO[concepto]) return { ok: false, dice: "Falta decir de qué es el saldo." };
  if (!limpio(periodo)) return { ok: false, dice: "Falta decir de qué periodo." };
  if (!esFecha(corte)) return { ok: false, dice: "Falta la fecha de corte del saldo." };
  if ((m == null || !(m >= 0)) && !(concepto === "vacaciones" && d > 0)) return { ok: false, dice: concepto === "vacaciones" ? "Falta el importe, o los días pendientes." : "Falta el importe." };
  if (d != null && !(d >= 0)) return { ok: false, dice: "Los días no pueden ser negativos." };
  if (!limpio(fundamento)) return { ok: false, dice: "Falta decir en qué se funda el cálculo." };
  if (!limpio(responsable)) return { ok: false, dice: "Falta quién responde por ese saldo." };
  if (saldosInicialesDe(eventos, persona.id).some(x => x.datos.concepto === concepto && x.datos.periodo === limpio(periodo))) return { ok: false, dice: "Ese saldo inicial ya está capturado. Si cambió, se corrige ese registro (queda el historial); no se captura otro." };
  const avisos = evidencia ? [] : ["Quedó sin evidencia. Se puede capturar así, pero no hay con qué respaldarlo."];
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T_SALDO_INICIAL, cuando, fecha, quien, azar, datos: { personaId: persona.id, nombre: limpio(persona.nombre), concepto, periodo: limpio(periodo), monto: m == null ? null : centavos(m), dias: d, corte, fundamento: limpio(fundamento), responsable: limpio(responsable), ...(evidencia ? { evidencia } : {}) } }) };
}

// La provisión de una persona, mes por mes y concepto por concepto.
//   inicio   la fecha de corte: desde cuándo el costo es de este sistema. Lo
//            generado ANTES sale marcado `previo`: es sólo una referencia de
//            cálculo (lo que vale es el saldo inicial capturado) y no va al costo.
//   hoy      hasta dónde se genera.
// Devuelve renglones { personaId, concepto, periodo, mes, fecha, monto, previo, ajuste, explica }
// y `porRevisar`: lo que NO se pudo calcular (sin importe, con su porqué).
export function provisionDe(persona, eventos, { inicio, hoy, reglas, remuneraciones = [], baja = null } = {}) {
  const cond = condicionesDe(persona, reglas, remuneraciones);
  if (cond.sinPrestaciones) return { renglones: [], porRevisar: [], cond, porque: `En su ficha dice que no genera prestaciones aquí${cond.sinPorque ? `: ${cond.sinPorque}` : " (y no dice por qué: hay que revisarlo)"}.` };
  if (cond.falta.length) return { renglones: [], porRevisar: [], cond, porque: `Pendiente de revisión: falta ${cond.falta.join(" y ")}. Mientras tanto no se calcula nada; eso no quiere decir que sea cero.` };
  // Con una baja registrada, deja de generar el último día de trabajo.
  const ultimo = baja?.datos?.fecha || persona.fechaBaja;
  const hasta = ultimo && ultimo < hoy ? ultimo : hoy;
  const dets = determinadasDe(eventos, persona.id), iniciales = saldosInicialesDe(eventos, persona.id);
  const renglones = [], porRevisar = [];
  for (const concepto of Object.keys(CONCEPTOS_PRESTACION)) {
    // Del aguinaldo, sólo los años que el sistema lleva. De vacaciones y prima, desde el año de servicio que corría al corte.
    for (const p of periodosDe(cond.ingreso, concepto, mayor(inicio || hoy, cond.ingreso), hasta)) {
      const det = dets.find(d => d.datos.concepto === concepto && d.datos.periodo === p.periodo);
      const ini = iniciales.find(d => d.datos.concepto === concepto && d.datos.periodo === p.periodo && d.datos.monto != null);
      const tope = menor(det ? menor(det.datos.corte, p.fin) : p.fin, hasta);
      // El mes del corte se parte en dos: lo de antes no va al costo.
      const parte = inicio && inicio > p.ini && inicio <= tope;
      const filas = tope < p.ini ? [] : parte ? generar(cond, concepto, p, p.ini, sumarDias(inicio, -1)).concat(generar(cond, concepto, p, inicio, tope)) : generar(cond, concepto, p, p.ini, tope);
      const base = { personaId: persona.id, nombre: persona.nombre, concepto, periodo: p.periodo };
      for (const f of filas.filter(f => f.monto == null)) porRevisar.push({ ...base, mes: f.mes, fecha: f.fecha, previo: !!inicio && f.fecha < inicio, porque: f.revisar });
      // Se redondea por mes; el centavo que sobre lo absorbe el ajuste al determinar.
      const mios = filas.filter(f => f.monto != null).map(f => ({ ...base, mes: f.mes, fecha: f.fecha, monto: centavos(f.monto), dias: f.dias, estimado: f.estimado, revisar: f.revisar, explica: f.explica, previo: !!inicio && f.fecha < inicio, ajuste: false }));
      renglones.push(...mios);
      if (det && det.fecha <= hoy) {
        // Lo de antes del corte: vale el saldo inicial capturado; si no hay, lo que calcula la app (sólo para no cargarlo al costo de hoy).
        const despues = sumarDinero(mios.filter(r => !r.previo).map(r => r.monto)), antesCalc = sumarDinero(mios.filter(r => r.previo).map(r => r.monto));
        const antes = ini ? ini.datos.monto : antesCalc, dif = centavos(det.datos.monto - antes - despues);
        if (dif !== 0) renglones.push({ ...base, mes: det.fecha.slice(0, 7), fecha: det.fecha, monto: dif, dias: 0, estimado: false, previo: false, ajuste: true, ev: det.id,
          explica: `Se determinó en ${det.datos.monto}; ya había ${antes} de antes del corte (${ini ? "saldo inicial capturado" : "calculado por la app: no hay saldo inicial capturado"}) y ${despues} generados después: la diferencia es el ajuste` });
      }
    }
  }
  return { renglones, porRevisar, cond, porque: "" };
}

// Cuánto saldría con las condiciones de la persona a una fecha de corte. Es una
// PROPUESTA con su cuenta a la vista: la cifra la confirma una persona.
export function proponer(persona, concepto, periodo, corte, reglas, remuneraciones = []) {
  const cond = condicionesDe(persona, reglas, remuneraciones);
  if (cond.falta.length) return { ok: false, dice: `Falta ${cond.falta.join(" y ")}.` };
  if (!/^(s\d+|\d{4})$/.test(String(periodo))) return { ok: false, dice: "Para ese periodo la app no tiene cómo proponer una cifra." };
  const p = periodosDe(cond.ingreso, concepto, concepto === "aguinaldo" ? `${periodo}-01-01` : aniversario(cond.ingreso, +String(periodo).slice(1) - 1), corte).find(x => x.periodo === String(periodo));
  if (!p || corte < p.ini) return { ok: false, dice: "Esa persona no trabajó en ese periodo." };
  const hasta = menor(corte, p.fin), dias = diasDeAaB(p.ini, hasta), enElAnio = concepto === "aguinaldo" ? diasDeAaB(`${periodo}-01-01`, `${periodo}-12-31`) : diasDeAaB(p.ini, p.fin);
  const base = cond.baseDe(concepto === "aguinaldo" ? "aguinaldo" : "vacaciones", hasta);
  if (base.monto == null) return { ok: false, dice: `Pendiente de revisión: ${base.revisar}. La app no propone una cifra; eso no quiere decir que sea cero.` };
  const porAnio = concepto === "aguinaldo" ? cond.aguinaldoDias : concepto === "vacaciones" ? cond.vacDias(p.n) : cond.vacDias(p.n) * cond.primaPct / 100;
  const monto = centavos(base.monto * porAnio * dias / enElAnio);
  return { ok: true, monto, dias: centavos(porAnio * dias / enElAnio), base: base.monto, estimado: base.estimado, revisar: base.revisar || "",
    explica: `${centavos(porAnio)} días por año completo × ${dias} de ${enElAnio} días del periodo × ${base.monto} (${base.origen})` };
}

export function determinar({ permitido, eventos, persona, concepto, periodo, corte, monto, dias = null, base = null, calculo = "", autorizo, quien, cuando, fecha, azar }) {
  const m = Number(monto);
  { const no = negado(quien, permitido, "Una prestación la determina un administrador."); if (no) return { ok: false, dice: no }; }
  if (!persona?.id) return { ok: false, dice: "Falta decir de quién." };
  if (!CONCEPTOS_PRESTACION[concepto]) return { ok: false, dice: "Falta decir qué prestación es." };
  if (!limpio(periodo)) return { ok: false, dice: "Falta decir de qué periodo." };
  if (!esFecha(corte)) return { ok: false, dice: "Falta la fecha de corte." };
  if (!(m >= 0) || monto === "" || monto == null) return { ok: false, dice: "Falta el importe." };
  if (!limpio(autorizo)) return { ok: false, dice: "Falta quién lo autoriza." };
  if (determinadasDe(eventos, persona.id).some(d => d.datos.concepto === concepto && d.datos.periodo === String(periodo))) return { ok: false, dice: `${CONCEPTOS_PRESTACION[concepto]} del ${nombreDePeriodo(periodo)} ya está determinado. Si cambió, se corrige ese registro (queda el historial); no se determina otra vez.` };
  return { ok: true, evento: nuevoEvento({ tipo: T_DETERMINADA, cuando, fecha, quien, azar, datos: { personaId: persona.id, nombre: limpio(persona.nombre), concepto, periodo: String(periodo), corte, monto: centavos(m), dias, base, calculo: limpio(calculo), autorizo: limpio(autorizo) } }) };
}

// Se paga contra algo que ya se dijo cuánto es: una prestación determinada o un saldo inicial.
export function pagarPrestacion({ permitido, eventos, persona, concepto, periodo, monto, medio, comprobante = null, nota = "", quien, cuando, fecha, azar }) {
  const m = Number(monto);
  { const no = negado(quien, permitido, "Un pago lo registra un administrador."); if (no) return { ok: false, dice: no }; }
  const de = (l) => l.find(d => d.datos.concepto === concepto && d.datos.periodo === String(periodo));
  const det = de(determinadasDe(eventos, persona?.id)), ini = de(saldosInicialesDe(eventos, persona?.id).filter(x => x.datos.monto != null));
  if (!det && !ini) return { ok: false, dice: "Primero se dice cuánto es (se determina, o se captura como saldo inicial); después se paga." };
  if (!(m > 0)) return { ok: false, dice: "Falta cuánto se entregó." };
  if (!limpio(medio)) return { ok: false, dice: "Falta por qué medio se pagó." };
  const debe = det ? det.datos.monto : ini.datos.monto;
  const ya = sumarDinero(pagosDePrestacion(eventos, persona.id).filter(p => p.datos.concepto === concepto && p.datos.periodo === String(periodo)).map(p => p.datos.monto));
  const avisos = [];
  if (sumarDinero(ya, m) > debe + 0.004) avisos.push(`Con este pago van ${sumarDinero(ya, m)} entregados y lo que se debía son ${debe}. Se registra igual; revisa que no sea un pago doble.`);
  if (!comprobante) avisos.push("Quedó sin comprobante.");
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T_PAGO_PRESTACION, cuando, fecha, quien, azar, origen: (det || ini).id, relacion: "paga", datos: { personaId: persona.id, nombre: limpio(persona.nombre), concepto, periodo: String(periodo), monto: centavos(m), medio, ...(comprobante ? { comprobante } : {}), nota: limpio(nota) } }) };
}

// ── La cuenta de una persona ───────────────────────────────────────────────
// Por concepto, cinco cosas que no se revuelven:
//   saldoInicial   lo que traía al corte (capturado; no es costo de este sistema)
//   generado       lo generado DESPUÉS del corte (esto sí va al costo)
//   ajustes        las diferencias al determinar (también van al costo)
//   pagado         lo entregado
//   pendiente      lo que se le debe hoy = por periodo, lo determinado (o saldo inicial + generado) menos lo pagado
// `vacacionesTomadas`: [{ fecha, monto }] — los días de vacaciones ya disfrutados.
// `baja` (evento `baja_personal`) y `pagosBaja`: si la relación ya terminó. Entonces lo pendiente de aguinaldo,
// vacaciones y prima pasa a la baja: al costo sólo va la diferencia contra lo ya generado (nunca dos veces).
export function cuentaDe(persona, eventos, { inicio, hoy, reglas, vacacionesTomadas = [], remuneraciones = [], baja = null, pagosBaja = [] } = {}) {
  const { renglones, porRevisar, cond, porque } = provisionDe(persona, eventos, { inicio, hoy, reglas, remuneraciones, baja });
  const dets = determinadasDe(eventos, persona.id), pagos = pagosDePrestacion(eventos, persona.id), iniciales = saldosInicialesDe(eventos, persona.id);
  const conceptos = {};
  for (const c of Object.keys(CONCEPTOS_DE_SALDO)) {
    const mios = renglones.filter(r => r.concepto === c), det = dets.filter(d => d.datos.concepto === c), pag = pagos.filter(p => p.datos.concepto === c), ini = iniciales.filter(d => d.datos.concepto === c);
    const tomado = c === "vacaciones" ? sumarDinero(vacacionesTomadas.map(v => v.monto)) : 0;
    const periodos = new Set([...mios, ...det.map(d => d.datos), ...pag.map(d => d.datos), ...ini.map(d => d.datos)].map(x => x.periodo));
    let debe = 0;
    for (const per of periodos) {
      const d = det.find(x => x.datos.periodo === per), s = ini.find(x => x.datos.periodo === per);
      const obligacion = d ? d.datos.monto : sumarDinero(s?.datos.monto || 0, mios.filter(r => r.periodo === per && !r.previo && !r.ajuste).map(r => r.monto).reduce((a, b) => sumarDinero(a, b), 0));
      debe = sumarDinero(debe, obligacion, -sumarDinero(pag.filter(x => x.datos.periodo === per).map(x => x.datos.monto)));
    }
    conceptos[c] = {
      saldoInicial: sumarDinero(ini.map(d => d.datos.monto || 0)), iniciales: ini,
      generado: sumarDinero(mios.filter(r => !r.ajuste && !r.previo).map(r => r.monto)),
      // Lo que la app calcula que se habría generado antes del corte. Es REFERENCIA para comparar contra el saldo inicial; no es saldo ni costo.
      referenciaAntes: sumarDinero(mios.filter(r => r.previo).map(r => r.monto)),
      ajustes: sumarDinero(mios.filter(r => r.ajuste).map(r => r.monto)),
      determinado: sumarDinero(det.map(d => d.datos.monto)), pagado: sumarDinero(pag.map(p => p.datos.monto)), disfrutado: tomado,
      pendiente: centavos(debe - tomado),
      alCosto: sumarDinero(mios.filter(r => !r.previo).map(r => r.monto)),
      determinadas: det, pagos: pag, estimado: mios.some(r => r.estimado && !r.previo), porRevisar: porRevisar.filter(r => r.concepto === c && !r.previo),
    };
  }
  let liquidacion = null;
  if (baja) {
    const filas = baja.datos.conceptos.map(k => {
      const propio = !!CONCEPTOS_PRESTACION[k.clave], yaGenerado = propio ? conceptos[k.clave].pendiente : 0;
      return { ...k, propio, yaGenerado, ajuste: propio ? centavos(k.monto - yaGenerado) : k.monto };
    });
    for (const f of filas.filter(f => f.propio)) {
      const x = conceptos[f.clave];
      if (f.ajuste !== 0) renglones.push({ personaId: persona.id, nombre: persona.nombre, concepto: f.clave, periodo: "baja", mes: baja.datos.fecha.slice(0, 7), fecha: baja.datos.fecha, monto: f.ajuste, dias: 0, estimado: false, previo: false, ajuste: true, ev: baja.id,
        explica: `Al terminar la relación se determinó en ${f.monto} y ya había ${f.yaGenerado} generados: la diferencia es el ajuste` });
      x.ajustes = sumarDinero(x.ajustes, f.ajuste); x.alCosto = sumarDinero(x.alCosto, f.ajuste); x.enBaja = f.monto; x.pendiente = 0;   // lo que se le debe ya está en la baja
    }
    const pagado = sumarDinero(pagosBaja.map(p => p.datos.monto));
    liquidacion = { evento: baja, filas, total: baja.datos.total, pagado, pendiente: centavos(baja.datos.total - pagado), pagos: pagosBaja };
  }
  // Días de vacaciones: lo que traía (saldo inicial; o el dato viejo de su ficha) + lo ganado al cumplir años desde el corte − lo tomado.
  let dias = null;
  if (cond.ingreso && !cond.falta.length && !cond.sinPrestaciones) {
    const ganados = periodosDe(cond.ingreso, "vacaciones", mayor(inicio || hoy, cond.ingreso), hoy).filter(p => p.fin < hoy).reduce((s, p) => s + cond.vacDias(p.n), 0);
    const deSaldo = conceptos.vacaciones.iniciales.filter(x => x.datos.dias != null), ficha = persona.prestaciones?.vacacionesPendientes;
    const traia = deSaldo.length ? deSaldo.reduce((s, x) => s + x.datos.dias, 0) : ficha === "" || ficha == null ? null : Number(ficha);
    const n = aniosCumplidos(cond.ingreso, hoy) + 1;
    dias = { ganados, tomados: vacacionesTomadas.length, traia, pendientes: traia == null ? null : traia + ganados - vacacionesTomadas.length, pendientesDesdeElSistema: ganados - vacacionesTomadas.length,
      anioEnCurso: n, delAnioEnCurso: cond.vacDias(n), cumple: aniversario(cond.ingreso, n) };
  }
  return { personaId: persona.id, nombre: persona.nombre, cond, porque, conceptos, dias, renglones, porRevisar, liquidacion,
    antiguedad: cond.ingreso ? aniosCumplidos(cond.ingreso, hoy) : null };
}

// Para el costo: los renglones de todos, sin lo anterior al corte (el saldo inicial nunca entra aquí).
export function renglonesAlCosto(cuentas) {
  return (cuentas || []).flatMap(c => c.renglones.filter(r => !r.previo && r.monto !== 0).map(r => ({ personaId: r.personaId, nombre: r.nombre, fecha: r.fecha, monto: r.monto, concepto: r.concepto, estimado: r.estimado, evs: r.ev ? [r.ev] : [],
    que: r.periodo === "baja" ? `${CONCEPTOS_PRESTACION[r.concepto]} (ajuste al terminar la relación de trabajo)` : `${CONCEPTOS_PRESTACION[r.concepto]}${r.ajuste ? " (ajuste al determinar)" : " que se generó"} · ${nombreDePeriodo(r.periodo)}`, detalle: r.explica })));
}
