import { test } from "node:test";
import assert from "node:assert/strict";
import { conciliarMes } from "./conciliacion.js";
import { cuentaDe, determinar, pagarPrestacion, capturarSaldoInicial, renglonesAlCosto } from "./prestaciones.js";
import { proponerBaja, registrarBaja, pagarBaja, renglonesDeBajas, pagosDeBaja } from "./bajas.js";
import { fuentePrestaciones, fuenteBajas, baseDePersonas } from "./personal.js";
import { juntarFuentes } from "./indirectos.js";
import { sumarDinero } from "./calculos.js";

const ADMIN = { id: "u1", nombre: "Luis", rol: "admin" };
const ANA = { id: "t-ana", nombre: "Ana", sueldo_dia: 365, historialSueldo: [{ desde: "2020-01-01", sueldo_dia: 365, anterior: 365 }], fechaIngreso: "2024-03-01" };
const INICIO = "2026-07-01"; let n = 0; const az = () => (++n) / 1e6; const c = (d) => `${d}T12:00:00-06:00`;
// Arma lo que arma la app: la cuenta, y con ella los indirectos, con la regla que se pida.
function mundo(evs, hoy, { baja = null, politica = "pendiente", polBajas = "general" } = {}) {
  const cuenta = cuentaDe(ANA, evs, { inicio: INICIO, hoy, baja, pagosBaja: baja ? pagosDeBaja(evs, baja.id) : [] });
  const base = baseDePersonas({ partes: [] });
  const indirectos = juntarFuentes([fuentePrestaciones({ renglones: renglonesAlCosto([cuenta]), base, politica }), fuenteBajas({ renglones: renglonesDeBajas(baja ? [baja] : []), base, politica: polBajas })]);
  return { cuenta, indirectos, mes: (mes) => conciliarMes({ mes, cuentas: [cuenta], indirectos }) };
}
const fila = (r, concepto) => r.filas.find(f => f.concepto === concepto);

test("lo_que_se_genera_cada_mes_es_costo_de_ese_mes_y_explica_que_se_paga_despues", () => {
  const m = mundo([], "2026-11-19").mes("2026-10");
  const ag = fila(m, "aguinaldo");
  assert.equal(ag.generado, 465, "31 días de octubre × 15 días al año × $365 ÷ 365"); assert.equal(ag.pagado, 0); assert.equal(ag.alCosto, 465);
  assert.match(ag.porque[0], /porque trabajó ese mes/); assert.match(ag.porque[1], /Todavía no se paga: queda como obligación por 1845/);
  assert.equal(m.cuadra, true, "lo que la conciliación llama costo es lo que entró a los costos"); assert.equal(m.enCostos, m.alCosto); assert.deepEqual(m.problemas, []);
});

test("pagar_no_es_costo_el_mes_del_pago_dice_a_que_costo_anterior_corresponde", () => {
  // Aguinaldo 2026 al 30 de noviembre: 334 días × 15 ÷ 365 × $365 = $5,010. De eso, $2,715 son de antes del corte (enero a junio: referencia, no costo)
  // y $2,295 de julio a noviembre (ya en el costo, mes por mes). Se determina en $5,015: al costo sólo van los $5 de diferencia.
  const d = determinar({ eventos: [], persona: ANA, concepto: "aguinaldo", periodo: "2026", corte: "2026-11-30", monto: 5015, autorizo: "Rodolfo", quien: ADMIN, cuando: c("2026-11-30"), fecha: "2026-11-30", azar: az() }).evento;
  const p = pagarPrestacion({ eventos: [d], persona: ANA, concepto: "aguinaldo", periodo: "2026", monto: 5015, medio: "efectivo", quien: ADMIN, cuando: c("2026-12-18"), fecha: "2026-12-18", azar: az() }).evento;
  const w = mundo([d, p], "2026-12-20");
  const nov = fila(w.mes("2026-11"), "aguinaldo"), dic = fila(w.mes("2026-12"), "aguinaldo");
  assert.equal(nov.generado, 450); assert.equal(nov.ajuste, 5, "sólo la diferencia contra lo ya generado"); assert.equal(nov.porPagar, 5015, "se le debe lo determinado completo, también lo de antes del corte");
  assert.match(nov.porque.join(" "), /se determinó en firme y sólo va al costo la diferencia/); assert.match(nov.porque.join(" "), /Su pago vino después: 5015 el 2026-12-18/);
  assert.equal(dic.alCosto, 0, "en diciembre ya no genera (está determinado) y el pago no es costo"); assert.equal(dic.pagado, 5015); assert.equal(dic.porPagar, 0);
  assert.match(dic.porque[0], /El pago NO es costo de 2026-12: corresponde a lo que ya estaba en el costo de 2026-07 a 2026-11/);
  // el costo de la operación nueva es lo generado desde el corte más el ajuste, ni un peso más por haberla pagado
  const todo = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"].map(m => w.mes(m));
  assert.equal(sumarDinero(todo.map(m => fila(m, "aguinaldo")?.alCosto || 0)), 2300, "5,015 determinados − 2,715 de antes del corte");
  assert.ok(todo.every(m => m.cuadra && m.problemas.length === 0));
});

test("el_saldo_inicial_no_es_costo_y_el_ajuste_lo_descuenta", () => {
  const s = capturarSaldoInicial({ eventos: [], persona: ANA, concepto: "aguinaldo", periodo: "2026", monto: 2700, corte: "2026-06-30", fundamento: "cálculo anterior", responsable: "Luis", quien: ADMIN, cuando: c("2026-07-01"), fecha: "2026-07-01", azar: az() }).evento;
  const d = determinar({ eventos: [s], persona: ANA, concepto: "aguinaldo", periodo: "2026", corte: "2026-11-30", monto: 5000, autorizo: "Rodolfo", quien: ADMIN, cuando: c("2026-11-30"), fecha: "2026-11-30", azar: az() }).evento;
  const w = mundo([s, d], "2026-12-01");
  const meses = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11"].map(m => w.mes(m));
  assert.equal(sumarDinero(meses.map(m => fila(m, "aguinaldo").alCosto)), 5000 - 2700, "al costo de la operación nueva sólo va lo determinado menos lo que ya se debía");
  assert.equal(fila(meses[4], "aguinaldo").porPagar, 5000, "pero se le deben los 5,000 completos");
  assert.ok(meses.every(m => m.cuadra));
});

test("una_baja_no_carga_dos_veces_lo_ya_generado_y_su_pago_tampoco_es_costo", () => {
  const DIA = "2026-11-19", antes = cuentaDe(ANA, [], { inicio: INICIO, hoy: DIA });
  const prop = proponerBaja({ persona: ANA, causa: "despido_injustificado", fecha: DIA, cuenta: antes, minimo: { monto: 300, zona: "general" } });
  const tres = prop.conceptos.filter(k => ["aguinaldo", "vacaciones", "prima"].includes(k.clave)).map(k => ({ clave: k.clave, monto: k.clave === "aguinaldo" ? 2500 : k.monto }));
  const b = registrarBaja({ eventos: [], persona: ANA, causa: "despido_injustificado", ultimoDia: DIA, fecha: DIA, conceptos: [...tres, { clave: "prima_antiguedad", monto: 10000 }, { clave: "indemnizacion_3m", monto: 34560 }], propuesta: prop, autorizo: "Rodolfo", quien: ADMIN, cuando: c(DIA), azar: az() }).evento;
  const pg = pagarBaja({ eventos: [b], baja: b, monto: 20000, medio: "transferencia", quien: ADMIN, cuando: c("2026-12-05"), fecha: "2026-12-05", azar: az() }).evento;
  const w = mundo([b, pg], "2026-12-10", { baja: b });
  const nov = w.mes("2026-11"), dic = w.mes("2026-12");
  assert.equal(fila(nov, "aguinaldo").ajuste, 2500 - 2130, "del aguinaldo sólo la diferencia contra lo ya generado"); assert.equal(fila(nov, "aguinaldo").porPagar, 0, "lo que se le debía pasó a la liquidación: no se debe dos veces");
  assert.match(fila(nov, "aguinaldo").porque.join(" "), /pasó a su liquidación: se paga ahí y no dos veces/);
  assert.equal(fila(nov, "baja").nuevo, 44560); assert.equal(fila(nov, "baja").porPagar, b.datos.total);
  assert.equal(nov.cuadra, true); assert.deepEqual(nov.problemas, []);
  assert.equal(dic.alCosto, 0, "en diciembre ya no genera nada y el pago no es costo"); assert.equal(fila(dic, "baja").pagado, 20000); assert.equal(fila(dic, "baja").porPagar, b.datos.total - 20000);
  assert.equal(dic.cuadra, true);
  const total = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"].map(m => w.mes(m).alCosto);
  const delasTres = tres.reduce((s, k) => sumarDinero(s, k.monto), 0);
  assert.equal(sumarDinero(total), sumarDinero(delasTres, 44560), "todo lo que costó Ana desde el corte = lo que se le determinó en la baja (no había saldo inicial)");
});

test("si_los_costos_del_rancho_traen_otra_cifra_la_conciliacion_lo_dice_y_un_pago_de_mas_tambien", () => {
  const w = mundo([], "2026-11-19");
  const trampa = { ...w.indirectos, pendientes: [...w.indirectos.pendientes, { ...w.indirectos.pendientes[0] }] };   // el mismo renglón dos veces
  const r = conciliarMes({ mes: w.indirectos.pendientes[0].fecha.slice(0, 7), cuentas: [w.cuenta], indirectos: trampa });
  assert.equal(r.cuadra, false); assert.match(r.problemas.find(p => p.clase === "no_cuadra").dice, /algo se contó de más o de menos/);
  const d = determinar({ eventos: [], persona: ANA, concepto: "aguinaldo", periodo: "2026", corte: "2026-11-30", monto: 5015, autorizo: "Rodolfo", quien: ADMIN, cuando: c("2026-11-30"), fecha: "2026-11-30", azar: az() }).evento;
  const p1 = pagarPrestacion({ eventos: [d], persona: ANA, concepto: "aguinaldo", periodo: "2026", monto: 5015, medio: "efectivo", quien: ADMIN, cuando: c("2026-12-18"), fecha: "2026-12-18", azar: az() }).evento;
  const p2 = { ...p1, id: "otro-pago", datos: { ...p1.datos, monto: 500 } };
  const dic = mundo([d, p1, p2], "2026-12-20").mes("2026-12");
  assert.match(dic.problemas.find(p => p.clase === "pagado_de_mas").dice, /rebasa lo que se debía por 500/);
});

test("un_ajuste_negativo_clasificado_fuera_de_produccion_no_desaparece_de_los_costos", () => {
  // Se determinó en MENOS de lo generado: el ajuste es negativo. Si la regla es «no es de producción», ese negativo tiene que seguir contando.
  const d = determinar({ eventos: [], persona: ANA, concepto: "aguinaldo", periodo: "2026", corte: "2026-11-30", monto: 4660, autorizo: "Rodolfo", quien: ADMIN, cuando: c("2026-11-30"), fecha: "2026-11-30", azar: az() }).evento;
  const SOLO = cuentaDe(ANA, [d], { inicio: "2026-11-01", hoy: "2026-12-01" });
  const soloAg = renglonesAlCosto([SOLO]).filter(r => r.concepto === "aguinaldo");
  assert.equal(sumarDinero(soloAg.map(r => r.monto)), 100);
  const f = fuentePrestaciones({ renglones: soloAg.filter(r => r.monto < 0), base: baseDePersonas({ partes: [] }), politica: "fuera" });
  const j = juntarFuentes([f]);
  assert.equal(j.fuera, -350, "el ajuste negativo no se pierde por ser negativo"); assert.equal(j.noProduccion.length, 1);
});
