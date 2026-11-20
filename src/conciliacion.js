// ════════════════════════════════════════════════════════════════════════
//  CONCILIACIÓN MENSUAL de las obligaciones con el personal
//
//  Una prestación pasa por cuatro momentos, y sólo dos son costo:
//    SE GENERA      mes a mes mientras la persona trabaja   → COSTO de ese mes
//    SE DETERMINA   cuando alguien dice cuánto es en firme  → al costo sólo la DIFERENCIA (ajuste)
//    SE PAGA        cuando se entrega el dinero             → NO es costo: baja lo que se debe
//    SALDO INICIAL  lo que ya se debía al arrancar          → NUNCA es costo de la operación nueva
//  Lo mismo una baja: lo ya generado no se vuelve a cargar; la prima de
//  antigüedad y las indemnizaciones son costo del día de la baja; pagarla no.
//
//  Esta conciliación responde, para un mes: ¿por qué este importe está en
//  este mes?, ¿con qué pago se relaciona?, y ¿el costo que salió de aquí es
//  EXACTAMENTE el que entró a los costos del rancho (ni un peso dos veces)?
//  No guarda nada: se calcula de las cuentas (`cuentaDe`) y de los indirectos.
// ════════════════════════════════════════════════════════════════════════
import { sumarDinero } from "./calculos.js";
import { CONCEPTOS_PRESTACION, nombreDePeriodo } from "./prestaciones.js";
import { ES_PRESTACION, CAUSAS_DE_BAJA } from "./bajas.js";

const finDe = (mes) => `${mes}-${String(new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).getUTCDate()).padStart(2, "0")}`;
const S = (l) => sumarDinero(l);
const cuando = (fechas) => { const m = [...new Set(fechas.map(f => f.slice(0, 7)))].sort(); return m.length === 0 ? "" : m.length === 1 ? m[0] : `${m[0]} a ${m[m.length - 1]}`; };

// Todos los movimientos de una cuenta, con su clase y si son costo.
function movimientosDe(c) {
  const l = [];
  for (const r of c.renglones) {
    if (r.previo) continue;       // lo anterior al corte es referencia, no costo ni saldo
    l.push({ fecha: r.fecha, concepto: r.concepto, periodo: r.periodo, clase: r.ajuste ? "ajuste" : "generado", costo: r.monto, pago: 0, ev: r.ev || null, explica: r.explica || "" });
  }
  for (const [concepto, x] of Object.entries(c.conceptos)) {
    for (const d of x.iniciales || []) if (d.datos.monto != null) l.push({ fecha: d.datos.corte || d.fecha, concepto, periodo: d.datos.periodo, clase: "saldo_inicial", costo: 0, pago: 0, inicial: d.datos.monto, ev: d.id, explica: `Saldo inicial al ${d.datos.corte}: ya se debía antes de empezar. No es costo de ningún mes de la operación nueva.` });
    for (const p of x.pagos || []) l.push({ fecha: p.fecha, concepto, periodo: p.datos.periodo, clase: "pago", costo: 0, pago: p.datos.monto, ev: p.id, explica: `Pago por ${p.datos.medio || "medio sin anotar"}. No es costo: baja lo que se debe.` });
  }
  if (c.liquidacion) {
    const b = c.liquidacion.evento.datos;
    for (const k of b.conceptos.filter(k => !ES_PRESTACION(k.clave) && k.monto !== 0)) l.push({ fecha: b.fecha, concepto: k.clave, nombreConcepto: k.nombre, periodo: "baja", clase: "baja", costo: k.monto, pago: 0, ev: c.liquidacion.evento.id, explica: `${k.nombre} por ${CAUSAS_DE_BAJA[b.causa]?.nombre.toLowerCase() || b.causa}: nace el último día de trabajo (${b.fecha}).` });
    for (const p of c.liquidacion.pagos || []) l.push({ fecha: p.fecha, concepto: "baja", periodo: "baja", clase: "pago_baja", costo: 0, pago: p.datos.monto, ev: p.id, explica: "Pago de la baja. No es costo: baja lo que se le debe." });
  }
  return l.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// La conciliación de UN mes.
//   cuentas      las de `cuentaDe` (data.prestaciones.cuentas)
//   indirectos   lo que devolvió `juntarFuentes` — para comprobar que el costo entró una sola vez
export function conciliarMes({ mes, cuentas = [], indirectos = null }) {
  const desde = `${mes}-01`, hasta = finDe(mes), en = (f) => f >= desde && f <= hasta;
  const filas = [], problemas = [];
  for (const c of cuentas) {
    const movs = movimientosDe(c);
    // Renglones de costo repetidos: la misma persona, concepto, periodo, día y clase dos veces.
    const vistos = new Map();
    for (const m of movs.filter(m => m.costo !== 0)) { const k = [m.concepto, m.periodo, m.fecha, m.clase, m.ev || ""].join("|"); vistos.set(k, (vistos.get(k) || 0) + 1); }
    for (const [k, n] of vistos) if (n > 1) problemas.push({ clase: "repetido", personaId: c.personaId, dice: `${c.nombre}: el mismo costo aparece ${n} veces (${k.split("|").slice(0, 3).join(" · ")}).` });
    // Después de una baja ya no se genera nada.
    if (c.liquidacion) { const f = c.liquidacion.evento.datos.fecha; const tarde = movs.filter(m => m.clase === "generado" && m.fecha > finDe(f.slice(0, 7))); if (tarde.length) problemas.push({ clase: "genera_tras_baja", personaId: c.personaId, dice: `${c.nombre}: siguió generando prestaciones después de su baja (${f}).` }); }
    // Lo que va con la liquidación ya no es deuda de la prestación: se debe dentro de la baja (una sola vez).
    const enBaja = c.liquidacion ? c.liquidacion.evento.datos.fecha : null;
    const grupos = new Map();
    for (const m of movs) { const g = m.clase === "baja" || m.clase === "pago_baja" ? "baja" : m.concepto; if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(m); }
    for (const [g, ms] of grupos) {
      const delMes = ms.filter(m => en(m.fecha));
      if (!delMes.some(m => m.costo !== 0 || m.pago !== 0)) continue;
      const hastaFin = ms.filter(m => m.fecha <= hasta);
      const generado = S(delMes.filter(m => m.clase === "generado").map(m => m.costo)), ajuste = S(delMes.filter(m => m.clase === "ajuste").map(m => m.costo)), nuevo = S(delMes.filter(m => m.clase === "baja").map(m => m.costo));
      const pagado = S(delMes.map(m => m.pago)), pagadoAcum = S(hastaFin.map(m => m.pago)), inicial = S(hastaFin.map(m => m.inicial || 0));
      // De una baja, lo que se debe incluye también las prestaciones que se determinaron en ella.
      const total = g === "baja" ? c.liquidacion.total : null;
      const pasoABaja = g !== "baja" && enBaja && enBaja <= hasta;
      // Lo que se debe al cierre del mes, periodo por periodo, igual que en su cuenta: si ya se determinó, lo determinado
      // (que incluye lo de antes del corte); si no, el saldo inicial más lo generado. Menos lo pagado.
      let debe = 0;
      if (g !== "baja" && !pasoABaja) {
        const dets = (c.conceptos[g]?.determinadas || []).filter(d => d.fecha <= hasta);
        for (const per of new Set(hastaFin.map(m => m.periodo))) {
          const d = dets.find(x => x.datos.periodo === per), deEse = hastaFin.filter(m => m.periodo === per);
          debe = sumarDinero(debe, d ? d.datos.monto : sumarDinero(S(deEse.map(m => m.inicial || 0)), S(deEse.filter(m => m.clase === "generado").map(m => m.costo))), -S(deEse.map(m => m.pago)));
        }
        if (g === "vacaciones") debe = sumarDinero(debe, -(c.conceptos.vacaciones.disfrutado || 0));
      }
      const porPagar = g === "baja" ? sumarDinero(total, -pagadoAcum) : pasoABaja ? 0 : debe;
      const pagosDespues = ms.filter(m => m.pago !== 0 && m.fecha > hasta), costoAntes = ms.filter(m => m.costo !== 0 && m.fecha < desde);
      const nombre = g === "baja" ? "Baja (prima de antigüedad e indemnizaciones)" : CONCEPTOS_PRESTACION[g] || g;
      const porque = [];
      if (generado !== 0) porque.push(`Se generaron ${generado} en ${mes} porque trabajó ese mes: la prestación se va ganando día con día, aunque se pague después.`);
      if (ajuste !== 0) porque.push(`Hay un ajuste de ${ajuste}: en ${mes} se determinó en firme y sólo va al costo la diferencia contra lo ya generado${inicial ? " y el saldo inicial" : ""}.`);
      if (nuevo !== 0) porque.push(`Hay ${nuevo} de costo nuevo por la baja: nace el último día de trabajo. Es gasto laboral general, no de una parcela.`);
      if (pagado !== 0) porque.push(`Se pagaron ${pagado} en ${mes}. El pago NO es costo de ${mes}: ${g === "baja" ? "es la baja ya registrada" : costoAntes.length || inicial ? `corresponde a lo que ya estaba en el costo de ${cuando(costoAntes.map(m => m.fecha)) || "meses anteriores"}${inicial ? " y al saldo inicial" : ""}${generado || ajuste ? ` y a lo de ${mes}` : ""}` : `corresponde a lo generado en ${mes}`}.`);
      if (pagado === 0 && (generado !== 0 || ajuste !== 0 || nuevo !== 0)) porque.push(pagosDespues.length ? `Su pago vino después: ${pagosDespues.map(m => `${m.pago} el ${m.fecha}`).join(", ")}.` : `Todavía no se paga: queda como obligación por ${porPagar}.`);
      if (pasoABaja && g !== "baja") porque.push(`Con la baja del ${enBaja}, lo que se le debía de esto pasó a su liquidación: se paga ahí y no dos veces.`);
      if (porPagar < -0.004) problemas.push({ clase: "pagado_de_mas", personaId: c.personaId, dice: `${c.nombre} · ${nombre}: lo pagado rebasa lo que se debía por ${-porPagar}. Revisa que no haya un pago doble.` });
      filas.push({ personaId: c.personaId, nombre: c.nombre, concepto: g, nombreConcepto: nombre, generado, ajuste, nuevo, alCosto: sumarDinero(generado, ajuste, nuevo), pagado, porPagar, estimado: g !== "baja" && !!c.conceptos[g]?.estimado,
        periodos: [...new Set(delMes.filter(m => m.periodo !== "baja").map(m => nombreDePeriodo(m.periodo)))], porque,
        movimientos: delMes.map(m => ({ fecha: m.fecha, clase: m.clase, costo: m.costo, pago: m.pago, ev: m.ev, explica: m.explica })) });
    }
  }
  filas.sort((a, b) => a.nombre.localeCompare(b.nombre) || a.nombreConcepto.localeCompare(b.nombreConcepto));
  const alCosto = S(filas.map(f => f.alCosto)), pagado = S(filas.map(f => f.pagado));
  // LA COMPROBACIÓN: lo que esta conciliación dice que es costo del mes contra lo que de verdad entró a los costos
  // (repartido a parcelas + pendiente + lo que no es de producción) por las fuentes de prestaciones y de bajas.
  let enCostos = null;
  if (indirectos) {
    const mias = (x) => x.fuente === "prestaciones" || x.fuente === "bajas";
    enCostos = sumarDinero(S((indirectos.partes || []).filter(p => mias(p) && en(p.fecha)).map(p => p.monto)), S((indirectos.pendientes || []).filter(p => mias(p) && en(p.fecha)).map(p => p.monto)),
      S((indirectos.noProduccion || []).filter(mias).flatMap(x => x.detalle || []).filter(p => en(p.fecha)).map(p => p.monto)));
    if (Math.abs(enCostos - alCosto) > 0.004) problemas.push({ clase: "no_cuadra", dice: `La conciliación dice que el costo del mes por prestaciones y bajas es ${alCosto}, pero a los costos del rancho entraron ${enCostos}. Hay ${sumarDinero(enCostos, -alCosto)} de diferencia: algo se contó de más o de menos.` });
  }
  return { mes, filas, alCosto, generado: S(filas.map(f => f.generado)), ajustes: S(filas.map(f => f.ajuste)), nuevo: S(filas.map(f => f.nuevo)), pagado, porPagar: S(filas.map(f => f.porPagar)), enCostos, cuadra: enCostos == null ? null : !problemas.some(p => p.clase === "no_cuadra"), problemas };
}
