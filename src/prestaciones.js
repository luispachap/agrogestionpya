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
//  La ley es el piso, no la regla de todos: cada persona puede tener más días,
//  otra prima u otra base (su ficha), y el rancho puede subir el piso (AJUSTES).
//  Referencia: Ley Federal del Trabajo, arts. 76 (vacaciones), 80 (prima) y
//  87 (aguinaldo). Esto es control interno: no sustituye la revisión de quien
//  lleve lo laboral, ni calcula impuestos ni cuotas.
// ════════════════════════════════════════════════════════════════════════
import { nuevoEvento, vigentes } from "./eventos.js";
import { sumarDinero, sueldoVigente, sumarDias } from "./calculos.js";

export const T_DETERMINADA = "prestacion_determinada", T_PAGO_PRESTACION = "pago_prestacion";
export const CONCEPTOS_PRESTACION = { aguinaldo: "Aguinaldo", vacaciones: "Vacaciones", prima: "Prima vacacional" };
export const LEY = { aguinaldoDias: 15, primaPct: 25 };
const limpio = (s) => String(s || "").trim();
const centavos = (n) => Math.round(n * 100) / 100;
const dia = (f) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));
const diasDeAaB = (a, b) => Math.round((dia(b) - dia(a)) / 86400000) + 1;      // contando los dos extremos
const finDeMes = (f) => { const d = new Date(Date.UTC(+f.slice(0, 4), +f.slice(5, 7), 0)); return d.toISOString().slice(0, 10); };
const menor = (a, b) => (a < b ? a : b), mayor = (a, b) => (a > b ? a : b);

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

// Las condiciones de UNA persona: las de su ficha si son mejores que el piso.
// `reglas`: { aguinaldoDias, primaPct, vacExtra } del rancho (AJUSTES).
export function condicionesDe(persona, reglas = {}) {
  const f = persona?.prestaciones || {};
  const pisoAg = Math.max(LEY.aguinaldoDias, Number(reglas.aguinaldoDias) || 0), pisoPr = Math.max(LEY.primaPct, Number(reglas.primaPct) || 0), extra = Math.max(0, Number(reglas.vacExtra) || 0);
  const falta = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(persona?.fechaIngreso || "")) falta.push("la fecha de ingreso");
  const baseDe = (concepto, fecha) => {
    const propia = Number(concepto === "aguinaldo" ? f.baseAguinaldo : f.baseVacaciones);
    if (propia > 0) return { monto: propia, origen: "la base de su ficha", estimado: false };
    const v = sueldoVigente(persona, fecha);
    return { monto: v.sueldo, origen: v.origen === "historial" ? "su sueldo por día de esa fecha" : "su sueldo por día de hoy (no hay historial de esa fecha)", estimado: v.estimado === true };
  };
  if (persona && !(baseDe("aguinaldo", "9999-12-31").monto > 0)) falta.push("su salario por día (o una base para prestaciones en su ficha)");
  return {
    ingreso: persona?.fechaIngreso || null, sinPrestaciones: f.sin === true, falta,
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
export const nombreDePeriodo = (periodo) => (String(periodo).startsWith("s") ? `año de servicio ${String(periodo).slice(1)}` : `año ${periodo}`);

// Lo que se genera de un concepto en un tramo, mes por mes. Sin redondear.
function generar(cond, concepto, p, desde, hasta) {
  const filas = [];
  for (let a = desde; a <= hasta;) {
    const b = menor(finDeMes(a), hasta), dias = diasDeAaB(a, b), base = cond.baseDe(concepto === "aguinaldo" ? "aguinaldo" : "vacaciones", b);
    const porAnio = concepto === "aguinaldo" ? cond.aguinaldoDias : concepto === "vacaciones" ? cond.vacDias(p.n) : cond.vacDias(p.n) * cond.primaPct / 100;
    filas.push({ mes: a.slice(0, 7), fecha: b, dias, monto: base.monto * porAnio * dias / 365, estimado: base.estimado,
      explica: `${dias} día${dias === 1 ? "" : "s"} de ${a.slice(0, 7)} × ${centavos(porAnio)} días al año × ${base.monto} (${base.origen}) ÷ 365` });
    a = sumarDias(b, 1);
  }
  return filas;
}

// La provisión de una persona, mes por mes y concepto por concepto.
//   inicio   desde cuándo se lleva la cuenta en el sistema. Lo generado ANTES
//            sale marcado `previo`: es obligación, pero no se carga al costo de
//            un periodo que el sistema no llevó.
//   hoy      hasta dónde se genera.
// Devuelve renglones { personaId, concepto, periodo, mes, fecha, monto, previo, ajuste, explica }.
export function provisionDe(persona, eventos, { inicio, hoy, reglas } = {}) {
  const cond = condicionesDe(persona, reglas);
  if (cond.sinPrestaciones) return { renglones: [], cond, porque: "En su ficha dice que no genera prestaciones aquí." };
  if (cond.falta.length) return { renglones: [], cond, porque: `No se puede calcular: falta ${cond.falta.join(" y ")}.` };
  const hasta = persona.fechaBaja && persona.fechaBaja < hoy ? persona.fechaBaja : hoy;
  const dets = determinadasDe(eventos, persona.id);
  const renglones = [];
  for (const concepto of Object.keys(CONCEPTOS_PRESTACION)) {
    // Del aguinaldo, sólo los años que el sistema lleva. De vacaciones y prima, desde el año de servicio que corría al empezar.
    for (const p of periodosDe(cond.ingreso, concepto, mayor(inicio || hoy, cond.ingreso), hasta)) {
      const det = dets.find(d => d.datos.concepto === concepto && d.datos.periodo === p.periodo);
      const tope = menor(det ? menor(det.datos.corte, p.fin) : p.fin, hasta);
      // El mes en que el sistema empezó a llevar la cuenta se parte en dos: lo de antes no va al costo.
      const parte = inicio && inicio > p.ini && inicio <= tope;
      const filas = tope < p.ini ? [] : parte ? generar(cond, concepto, p, p.ini, sumarDias(inicio, -1)).concat(generar(cond, concepto, p, inicio, tope)) : generar(cond, concepto, p, p.ini, tope);
      // Se redondea por mes; el centavo que sobre lo absorbe el ajuste al determinar.
      const mios = filas.map(f => ({ personaId: persona.id, nombre: persona.nombre, concepto, periodo: p.periodo, mes: f.mes, fecha: f.fecha, monto: centavos(f.monto), dias: f.dias, estimado: f.estimado, explica: f.explica, previo: !!inicio && f.fecha < inicio, ajuste: false }));
      renglones.push(...mios);
      if (det && det.fecha <= hoy) {
        const generado = sumarDinero(mios.map(r => r.monto)), dif = centavos(det.datos.monto - generado);
        if (dif !== 0) renglones.push({ personaId: persona.id, nombre: persona.nombre, concepto, periodo: p.periodo, mes: det.fecha.slice(0, 7), fecha: det.fecha, monto: dif, dias: 0, estimado: false, previo: false, ajuste: true, ev: det.id,
          explica: `Se determinó en ${det.datos.monto} y se habían generado ${generado}: la diferencia es el ajuste` });
      }
    }
  }
  return { renglones, cond, porque: "" };
}

// ── Lo determinado y lo pagado ─────────────────────────────────────────────
// Si por dos aparatos sin señal hay dos del mismo periodo, vale la última y la otra se enseña.
export function determinadasDe(eventos, personaId) {
  const m = new Map();
  for (const e of vigentes(eventos).filter(e => e.tipo === T_DETERMINADA && (!personaId || e.datos.personaId === personaId)).sort((a, b) => a.cuando.localeCompare(b.cuando))) m.set(`${e.datos.personaId}|${e.datos.concepto}|${e.datos.periodo}`, e);
  return [...m.values()];
}
export const determinadasRepetidas = (eventos) => { const buenas = new Set(determinadasDe(eventos).map(e => e.id)); return vigentes(eventos).filter(e => e.tipo === T_DETERMINADA && !buenas.has(e.id)); };

// Cuánto saldría con las condiciones de la persona a una fecha de corte. Es una
// PROPUESTA con su cuenta a la vista: la cifra la confirma una persona.
export function proponer(persona, concepto, periodo, corte, reglas) {
  const cond = condicionesDe(persona, reglas);
  if (cond.falta.length) return { ok: false, dice: `Falta ${cond.falta.join(" y ")}.` };
  const p = periodosDe(cond.ingreso, concepto, concepto === "aguinaldo" ? `${periodo}-01-01` : aniversario(cond.ingreso, +String(periodo).slice(1) - 1), corte).find(x => x.periodo === String(periodo));
  if (!p || corte < p.ini) return { ok: false, dice: "Esa persona no trabajó en ese periodo." };
  const hasta = menor(corte, p.fin), dias = diasDeAaB(p.ini, hasta), enElAnio = concepto === "aguinaldo" ? diasDeAaB(`${periodo}-01-01`, `${periodo}-12-31`) : diasDeAaB(p.ini, p.fin);
  const base = cond.baseDe(concepto === "aguinaldo" ? "aguinaldo" : "vacaciones", hasta);
  const porAnio = concepto === "aguinaldo" ? cond.aguinaldoDias : concepto === "vacaciones" ? cond.vacDias(p.n) : cond.vacDias(p.n) * cond.primaPct / 100;
  const monto = centavos(base.monto * porAnio * dias / enElAnio);
  return { ok: true, monto, dias: centavos(porAnio * dias / enElAnio), base: base.monto, estimado: base.estimado,
    explica: `${centavos(porAnio)} días por año completo × ${dias} de ${enElAnio} días del periodo × ${base.monto} (${base.origen})` };
}

export function determinar({ eventos, persona, concepto, periodo, corte, monto, dias = null, base = null, calculo = "", autorizo, quien, cuando, fecha, azar }) {
  const m = Number(monto);
  if (quien?.rol !== "admin") return { ok: false, dice: "Una prestación la determina un administrador." };
  if (!persona?.id) return { ok: false, dice: "Falta decir de quién." };
  if (!CONCEPTOS_PRESTACION[concepto]) return { ok: false, dice: "Falta decir qué prestación es." };
  if (!limpio(periodo)) return { ok: false, dice: "Falta decir de qué periodo." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(corte || "")) return { ok: false, dice: "Falta la fecha de corte." };
  if (!(m >= 0) || monto === "" || monto == null) return { ok: false, dice: "Falta el importe." };
  if (!limpio(autorizo)) return { ok: false, dice: "Falta quién lo autoriza." };
  if (determinadasDe(eventos, persona.id).some(d => d.datos.concepto === concepto && d.datos.periodo === String(periodo))) return { ok: false, dice: `${CONCEPTOS_PRESTACION[concepto]} del ${nombreDePeriodo(periodo)} ya está determinado. Si cambió, se corrige ese registro (queda el historial); no se determina otra vez.` };
  return { ok: true, evento: nuevoEvento({ tipo: T_DETERMINADA, cuando, fecha, quien, azar, datos: { personaId: persona.id, nombre: limpio(persona.nombre), concepto, periodo: String(periodo), corte, monto: centavos(m), dias, base, calculo: limpio(calculo), autorizo: limpio(autorizo) } }) };
}

export const pagosDePrestacion = (eventos, personaId) => vigentes(eventos).filter(e => e.tipo === T_PAGO_PRESTACION && (!personaId || e.datos.personaId === personaId));
export function pagarPrestacion({ eventos, persona, concepto, periodo, monto, medio, comprobante = null, nota = "", quien, cuando, fecha, azar }) {
  const m = Number(monto);
  if (quien?.rol !== "admin") return { ok: false, dice: "Un pago lo registra un administrador." };
  const det = determinadasDe(eventos, persona?.id).find(d => d.datos.concepto === concepto && d.datos.periodo === String(periodo));
  if (!det) return { ok: false, dice: "Primero se determina cuánto es; después se paga." };
  if (!(m > 0)) return { ok: false, dice: "Falta cuánto se entregó." };
  if (!limpio(medio)) return { ok: false, dice: "Falta por qué medio se pagó." };
  const ya = sumarDinero(pagosDePrestacion(eventos, persona.id).filter(p => p.datos.concepto === concepto && p.datos.periodo === String(periodo)).map(p => p.datos.monto));
  const avisos = [];
  if (sumarDinero(ya, m) > det.datos.monto + 0.004) avisos.push(`Con este pago van ${sumarDinero(ya, m)} entregados y lo determinado son ${det.datos.monto}. Se registra igual; revisa que no sea un pago doble.`);
  if (!comprobante) avisos.push("Quedó sin comprobante.");
  return { ok: true, avisos, evento: nuevoEvento({ tipo: T_PAGO_PRESTACION, cuando, fecha, quien, azar, origen: det.id, relacion: "paga", datos: { personaId: persona.id, nombre: limpio(persona.nombre), concepto, periodo: String(periodo), monto: centavos(m), medio, ...(comprobante ? { comprobante } : {}), nota: limpio(nota) } }) };
}

// ── La cuenta de una persona ───────────────────────────────────────────────
// `vacacionesTomadas`: [{ fecha, monto }] — los días de vacaciones que ya
// disfrutó (salen de las ausencias de clase "vacaciones"; se pagan en su semana).
export function cuentaDe(persona, eventos, { inicio, hoy, reglas, vacacionesTomadas = [] } = {}) {
  const { renglones, cond, porque } = provisionDe(persona, eventos, { inicio, hoy, reglas });
  const dets = determinadasDe(eventos, persona.id), pagos = pagosDePrestacion(eventos, persona.id);
  const conceptos = {};
  for (const c of Object.keys(CONCEPTOS_PRESTACION)) {
    const mios = renglones.filter(r => r.concepto === c), det = dets.filter(d => d.datos.concepto === c), pag = pagos.filter(p => p.datos.concepto === c);
    const yaDet = new Set(det.map(d => d.datos.periodo));
    const tomado = c === "vacaciones" ? sumarDinero(vacacionesTomadas.map(v => v.monto)) : 0;
    conceptos[c] = {
      generado: sumarDinero(mios.filter(r => !r.ajuste).map(r => r.monto)),                        // provisión acumulada (toda)
      antesDelSistema: sumarDinero(mios.filter(r => r.previo).map(r => r.monto)),
      // Lo que sigue provisionado: lo generado de periodos que nadie ha determinado, menos las vacaciones ya disfrutadas.
      provision: sumarDinero(sumarDinero(mios.filter(r => !r.ajuste && !yaDet.has(r.periodo)).map(r => r.monto)), -tomado),
      determinado: sumarDinero(det.map(d => d.datos.monto)), pagado: sumarDinero(pag.map(p => p.datos.monto)),
      ajustes: sumarDinero(mios.filter(r => r.ajuste).map(r => r.monto)),
      alCosto: sumarDinero(mios.filter(r => !r.previo).map(r => r.monto)),                          // lo que ya se cargó (o está por repartirse) como costo
      porPagar: centavos(sumarDinero(det.map(d => d.datos.monto)) - sumarDinero(pag.map(p => p.datos.monto))),
      determinadas: det, pagos: pag, estimado: mios.some(r => r.estimado),
    };
  }
  // Días de vacaciones: lo ganado al cumplir cada año DESDE que se lleva la cuenta,
  // más lo que traía pendiente (si alguien lo capturó). Sin ese dato no se inventa.
  let dias = null;
  if (cond.ingreso && !cond.falta.length && !cond.sinPrestaciones) {
    const ganados = periodosDe(cond.ingreso, "vacaciones", mayor(inicio || hoy, cond.ingreso), hoy).filter(p => p.fin < hoy).reduce((s, p) => s + cond.vacDias(p.n), 0);
    const traia = persona.prestaciones?.vacacionesPendientes;
    const n = aniosCumplidos(cond.ingreso, hoy) + 1;
    dias = { ganados, tomados: vacacionesTomadas.length, traia: traia === "" || traia == null ? null : Number(traia),
      pendientes: traia === "" || traia == null ? null : Number(traia) + ganados - vacacionesTomadas.length, pendientesDesdeElSistema: ganados - vacacionesTomadas.length,
      anioEnCurso: n, delAnioEnCurso: cond.vacDias(n), cumple: aniversario(cond.ingreso, n) };
  }
  return { personaId: persona.id, nombre: persona.nombre, cond, porque, conceptos, dias, renglones,
    antiguedad: cond.ingreso ? aniosCumplidos(cond.ingreso, hoy) : null };
}

// Para el costo: los renglones de todos, sin lo anterior al sistema.
export function renglonesAlCosto(cuentas) {
  return (cuentas || []).flatMap(c => c.renglones.filter(r => !r.previo && r.monto !== 0).map(r => ({ personaId: r.personaId, nombre: r.nombre, fecha: r.fecha, monto: r.monto, concepto: r.concepto, estimado: r.estimado, evs: r.ev ? [r.ev] : [],
    que: `${CONCEPTOS_PRESTACION[r.concepto]}${r.ajuste ? " (ajuste al determinar)" : " que se generó"} · ${nombreDePeriodo(r.periodo)}`, detalle: r.explica })));
}
