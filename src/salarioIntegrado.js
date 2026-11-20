// ════════════════════════════════════════════════════════════════════════
//  SALARIO INTEGRADO — con qué se calculan las indemnizaciones
//
//  La ley (arts. 84 y 89 de la Ley Federal del Trabajo) dice que el salario se
//  integra con la cuota diaria MÁS gratificaciones, percepciones, habitación,
//  primas, comisiones, prestaciones en especie y cualquier otra cantidad que
//  se le entregue al trabajador por su trabajo; y que las indemnizaciones se
//  calculan con el salario del día en que nace el derecho. Si la percepción
//  es por semana se divide entre 7; por mes, entre 30. Si es variable, se
//  toma el promedio de los últimos treinta días efectivamente trabajados.
//
//  Aquí se arma por PARTES, cada una con su periodo y su base, para que se
//  pueda explicar:
//    1. la cuota diaria (su salario por día de esa fecha);
//    2. la parte proporcional de aguinaldo y de prima vacacional;
//    3. las percepciones FIJAS de su ficha vigentes ese día (bono, despensa,
//       habitación, ayuda de transporte…), llevadas a un día;
//    4. lo VARIABLE: lo que la app ya tiene registrado que ganó por encima de
//       su sueldo por día (destajo, pagos por tarea) en sus últimos días
//       trabajados, y las percepciones variables de su ficha (comisiones,
//       premios), con el total de sus últimos treinta días trabajados.
//
//  Lo que la app NO sabe no lo inventa: lo dice en `falta` y el salario
//  integrado queda `completo: false` — un piso, no la cifra final. Falta
//  información cuando nadie ha revisado qué percepciones recibe la persona,
//  cuando una percepción no tiene valor, cuando el dato de lo variable está
//  viejo o sale de pocos días, o cuando tiene bonificaciones anotadas en la
//  pantalla vieja (ésas no dicen de qué fecha son).
//
//  Las percepciones viven en la ficha: `persona.percepciones = { revisado,
//  por, lista: [{ id, nombre, clase, tipo, monto, periodo, desde, hasta, al }] }`.
//  Una percepción que se deja de dar NO se borra: se le pone `hasta`, para
//  que un cálculo con fecha anterior siga saliendo igual.
// ════════════════════════════════════════════════════════════════════════
import { sumarDinero } from "./calculos.js";

export const PERIODOS = { dia: { nombre: "por día", dias: 1 }, semana: { nombre: "por semana", dias: 7 }, mes: { nombre: "por mes", dias: 30 }, anio: { nombre: "por año", dias: 365 } };
export const CLASES_PERCEPCION = { bono: "Bono o gratificación", despensa: "Despensa o ayuda para alimentos", habitacion: "Habitación o ayuda de renta", transporte: "Ayuda de transporte", comision: "Comisión", premio: "Premio de asistencia o puntualidad", especie: "Prestación en especie", otra: "Otra percepción" };
export const DIAS_VARIABLE = 30;            // la ley: treinta días efectivamente trabajados
const VIEJO = 60;                           // un total de lo variable con más días que esto ya no describe "los últimos treinta"
const limpio = (s) => String(s || "").trim();
const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f || "");
const centavos = (n) => Math.round(n * 100) / 100;
const diasEntre = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);

export const percepcionesDe = (persona) => { const p = persona?.percepciones || {}; return { revisado: esFecha(p.revisado) ? p.revisado : null, por: limpio(p.por), lista: Array.isArray(p.lista) ? p.lista : [] }; };

// Lo que se puede guardar en la ficha. Devuelve { ok, dice } o { ok, percepcion } ya limpia.
export function validarPercepcion(p, hoy) {
  const nombre = limpio(p?.nombre), tipo = p?.tipo === "variable" ? "variable" : "fija";
  if (!CLASES_PERCEPCION[p?.clase]) return { ok: false, dice: "Falta decir qué clase de percepción es." };
  if (p.clase === "otra" && !nombre) return { ok: false, dice: "Con «otra percepción» hay que escribir cuál." };
  if (p.monto !== "" && p.monto != null && !(Number(p.monto) >= 0)) return { ok: false, dice: "El importe no puede ser negativo." };
  const monto = p.monto === "" || p.monto == null ? null : centavos(Number(p.monto));
  if (tipo === "fija") {
    if (!PERIODOS[p.periodo]) return { ok: false, dice: "Falta decir cada cuánto se le da (por día, semana, mes o año)." };
    if (!esFecha(p.desde)) return { ok: false, dice: "Falta desde cuándo la recibe." };
    if (p.hasta && (!esFecha(p.hasta) || p.hasta < p.desde)) return { ok: false, dice: "La fecha en que dejó de recibirla no puede ser antes de la fecha en que empezó." };
    return { ok: true, percepcion: { id: p.id, nombre: nombre || CLASES_PERCEPCION[p.clase], clase: p.clase, tipo, monto, periodo: p.periodo, desde: p.desde, ...(p.hasta ? { hasta: p.hasta } : {}) } };
  }
  if (monto != null && !esFecha(p.al)) return { ok: false, dice: "Falta hasta qué día está sumado ese total de sus últimos treinta días trabajados." };
  if (p.al && hoy && p.al > hoy) return { ok: false, dice: "Esa fecha todavía no llega." };
  return { ok: true, percepcion: { id: p.id, nombre: nombre || CLASES_PERCEPCION[p.clase], clase: p.clase, tipo, monto, ...(p.al ? { al: p.al } : {}), ...(p.hasta ? { hasta: p.hasta } : {}) } };
}

// El salario integrado de UN día.
//   cond            las condiciones de la persona (`condicionesDe`): días de aguinaldo, de vacaciones, prima, si tiene sueldo fijo
//   diario          su cuota diaria de esa fecha (null = no se sabe)
//   n               el año de servicio que corría (de ahí salen sus días de vacaciones)
//   remuneraciones  [{ fecha, monto }] lo que la app tiene registrado que ganó cada día trabajado
//   bonificaciones  las de la pantalla vieja de esa persona (sólo para avisar: no traen fecha)
export function integrar({ cond, diario, n, fecha, persona = null, remuneraciones = [], bonificaciones = [] }) {
  if (diario == null) return { monto: null, factor: null, cuota: null, partes: [], completo: false, falta: ["no hay con qué calcular su salario por día"], explica: "" };
  const partes = [], falta = [];
  const pon = (clave, nombre, porDia, base) => { if (porDia > 0) partes.push({ clave, nombre, porDia: centavos(porDia), base }); };
  pon("cuota", "Cuota diaria", diario, "su salario por día de esa fecha");
  const vac = cond.vacDias(Math.max(1, n));
  pon("aguinaldo", "Parte de su aguinaldo", diario * cond.aguinaldoDias / 365, `${cond.aguinaldoDias} días al año, entre 365`);
  pon("prima", "Parte de su prima vacacional", diario * vac * cond.primaPct / 100 / 365, `${cond.primaPct} % de ${vac} días de vacaciones, entre 365`);
  const per = percepcionesDe(persona);
  for (const p of per.lista) {
    const acabo = p.hasta && p.hasta < fecha;
    if (p.tipo !== "variable") {
      if (acabo || (p.desde && p.desde > fecha)) continue;
      if (p.monto == null) { falta.push(`falta el valor de «${p.nombre}»`); continue; }
      pon(`fija:${p.id}`, p.nombre, p.monto / PERIODOS[p.periodo].dias, `${p.monto} ${PERIODOS[p.periodo].nombre}, entre ${PERIODOS[p.periodo].dias}; la recibe desde el ${p.desde}`);
    } else {
      if (acabo) continue;
      if (p.monto == null || !p.al) { falta.push(`falta el total de «${p.nombre}» en sus últimos ${DIAS_VARIABLE} días trabajados`); continue; }
      if (p.al > fecha) { falta.push(`el total de «${p.nombre}» está sumado al ${p.al}, después del ${fecha}`); continue; }
      if (diasEntre(p.al, fecha) > VIEJO) falta.push(`el total de «${p.nombre}» está sumado al ${p.al}: ya no son sus últimos ${DIAS_VARIABLE} días trabajados`);
      pon(`variable:${p.id}`, p.nombre, p.monto / DIAS_VARIABLE, `${p.monto} en sus últimos ${DIAS_VARIABLE} días trabajados al ${p.al}, entre ${DIAS_VARIABLE}`);
    }
  }
  // Lo variable que la app ya tiene: lo que ganó por encima de su sueldo por día en sus últimos días trabajados.
  // (Quien cobra sólo por lo que hace ya trae ese promedio como cuota diaria: no se le suma otra vez.)
  if (cond.fijo) {
    const dias = (remuneraciones || []).filter(r => r.fecha <= fecha).slice(-DIAS_VARIABLE);
    if (dias.length) {
      const prom = sumarDinero(dias.map(d => d.monto)) / dias.length, extra = prom - diario;
      if (extra > 0.005) {
        pon("variable:registrado", "Lo que ganó por encima de su sueldo por día", extra, `promedio de ${centavos(prom)} en sus últimos ${dias.length} días trabajados (${dias[0].fecha} a ${dias[dias.length - 1].fecha}), menos su sueldo por día`);
        if (dias.length < DIAS_VARIABLE) falta.push(`lo variable sale de sólo ${dias.length} día${dias.length === 1 ? "" : "s"} trabajado${dias.length === 1 ? "" : "s"}; la ley pide ${DIAS_VARIABLE}`);
      }
    }
  }
  if (!per.revisado) falta.push("nadie ha revisado en su ficha si recibe otras percepciones fijas o variables (bonos, despensa, habitación, comisiones, premios)");
  const anio = Number(fecha.slice(0, 4)), viejas = (bonificaciones || []).filter(b => Number(b.anio) >= anio - 1 && Number(b.monto) > 0);
  if (viejas.length) falta.push(`tiene ${viejas.length} bonificación(es) anotada(s) en la pantalla de bonificaciones (${viejas.map(b => `${limpio(b.concepto) || "sin concepto"} ${b.anio}`).join("; ")}): no dicen de qué fecha son, así que no se integraron; revisa si alguna debe contarse`);
  const monto = sumarDinero(partes.map(p => p.porDia));
  const otras = partes.filter(p => !["cuota", "aguinaldo", "prima"].includes(p.clave));
  return { monto, factor: Math.round((monto / diario) * 10000) / 10000, cuota: diario, partes, completo: falta.length === 0, falta,
    explica: `salario integrado de ${monto} por día: ${partes.map(p => `${p.nombre.toLowerCase()} ${p.porDia} (${p.base})`).join(" + ")}.${otras.length ? "" : " No tiene otras percepciones anotadas."}${falta.length ? ` Es un piso, no la cifra final — por revisar: ${falta.join("; ")}.` : " Su ficha se revisó el " + per.revisado + (per.por ? ` (${per.por})` : "") + "."}` };
}
