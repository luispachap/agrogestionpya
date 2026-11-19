import { test } from "node:test";
import assert from "node:assert/strict";
import { vacacionesDeLey, aniosCumplidos, aniversario, condicionesDe, periodosDe, provisionDe, proponer, determinar, determinadasDe, pagarPrestacion, cuentaDe, renglonesAlCosto, LEY } from "./prestaciones.js";
import { corregirEvento } from "./eventos.js";
import { sumarDinero } from "./calculos.js";

const ADMIN = { id: "u1", nombre: "Luis", rol: "admin" }, ENC = { id: "e1", nombre: "Enc", rol: "encargado" };
const HIST = [{ desde: "2020-01-01", sueldo_dia: 365, anterior: 365 }];
const ANA = { id: "t-ana", nombre: "Ana", sueldo_dia: 365, historialSueldo: HIST, fechaIngreso: "2024-03-01" };
let n = 0; const az = () => (++n) / 1e6; const c = (f) => `${f}T12:00:00-06:00`;
const INICIO = "2026-07-01", HOY = "2026-11-19";
const suma = (rs, f) => sumarDinero(rs.filter(f).map(r => r.monto));

test("las_vacaciones_de_ley_son_12_el_primer_año_suben_2_hasta_20_y_luego_2_cada_cinco_años", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 21, 26, 31].map(vacacionesDeLey), [12, 14, 16, 18, 20, 22, 22, 24, 24, 26, 28, 30, 32]);
  assert.equal(vacacionesDeLey(0), 0);
  assert.equal(LEY.aguinaldoDias, 15); assert.equal(LEY.primaPct, 25);
});

test("la_antiguedad_se_cuenta_por_aniversario_no_por_año_de_calendario", () => {
  assert.equal(aniosCumplidos("2024-03-01", "2026-02-28"), 1);
  assert.equal(aniosCumplidos("2024-03-01", "2026-03-01"), 2);
  assert.equal(aniversario("2024-02-29", 1), "2025-02-28", "quien entró un 29 de febrero cumple el 28");
  assert.deepEqual(periodosDe("2024-03-01", "vacaciones", "2026-07-01", "2026-11-19").map(p => [p.periodo, p.ini, p.fin]), [["s3", "2026-03-01", "2027-02-28"]]);
});

test("sin_fecha_de_ingreso_no_se_provisiona_nada_y_se_dice_que_falta", () => {
  const r = provisionDe({ id: "x", nombre: "Sin fecha", sueldo_dia: 300 }, [], { inicio: INICIO, hoy: HOY });
  assert.equal(r.renglones.length, 0); assert.match(r.porque, /fecha de ingreso/);
  const d = provisionDe({ id: "y", nombre: "Destajo", fechaIngreso: "2025-01-01", sueldo_dia: 0 }, [], { inicio: INICIO, hoy: HOY });
  assert.match(d.porque, /salario por día/, "quien cobra por destajo necesita una base: no se inventa");
});

test("el_aguinaldo_se_va_generando_dia_con_dia_15_dias_de_sueldo_por_año", () => {
  const { renglones } = provisionDe(ANA, [], { inicio: INICIO, hoy: HOY });
  const ag = renglones.filter(r => r.concepto === "aguinaldo");
  assert.equal(ag[0].mes, "2026-01", "el año se cuenta completo");
  // 1 ene → 19 nov = 323 días × 15/365 × $365 = $4,845
  assert.equal(suma(ag, () => true), 4845);
  assert.equal(suma(ag, r => r.previo), 181 * 15, "lo de enero a junio es anterior al sistema: no va al costo");
  assert.equal(suma(ag, r => !r.previo), 142 * 15);
  assert.match(ag[0].explica, /31 días de 2026-01 × 15 días al año × 365/);
});

test("si_el_sistema_empezo_a_medio_mes_solo_va_al_costo_lo_generado_desde_ese_dia", () => {
  const { renglones } = provisionDe(ANA, [], { inicio: "2026-11-18", hoy: HOY });
  const ag = renglones.filter(r => r.concepto === "aguinaldo");
  assert.equal(suma(ag, r => !r.previo), 2 * 15, "18 y 19 de noviembre");
  assert.equal(suma(ag, () => true), 4845, "partir el mes no cambia el total generado");
});

test("quien_entro_a_medio_año_genera_aguinaldo_solo_desde_su_ingreso", () => {
  const nuevo = { ...ANA, id: "t-n", fechaIngreso: "2026-10-01" };
  const { renglones } = provisionDe(nuevo, [], { inicio: INICIO, hoy: HOY });
  assert.equal(suma(renglones, r => r.concepto === "aguinaldo"), 50 * 15, "1 oct → 19 nov son 50 días");
  assert.equal(renglones.some(r => r.previo), false);
});

test("vacaciones_y_prima_se_generan_con_los_dias_del_año_de_servicio_que_corre", () => {
  const { renglones } = provisionDe(ANA, [], { inicio: INICIO, hoy: HOY });
  const vac = renglones.filter(r => r.concepto === "vacaciones"), pr = renglones.filter(r => r.concepto === "prima");
  assert.ok(vac.every(r => r.periodo === "s3"), "corre su tercer año: al cumplirlo son 16 días");
  // 1 mar → 19 nov = 264 días × 16/365 × 365 = 4,224 ; prima 25 % = 1,056
  assert.equal(suma(vac, () => true), 4224); assert.equal(suma(pr, () => true), 1056);
});

test("las_condiciones_de_cada_quien_pueden_ser_mejores_que_la_ley_y_nunca_menores", () => {
  const mejor = { ...ANA, prestaciones: { aguinaldoDias: 30, primaPct: 50, vacacionesDias: 20, baseAguinaldo: 500 } };
  const cm = condicionesDe(mejor, {});
  assert.equal(cm.aguinaldoDias, 30); assert.equal(cm.primaPct, 50); assert.equal(cm.vacDias(3), 20); assert.equal(cm.baseDe("aguinaldo", HOY).monto, 500);
  assert.equal(cm.baseDe("vacaciones", HOY).monto, 365, "la base no es la misma para todas las prestaciones");
  const peor = condicionesDe({ ...ANA, prestaciones: { aguinaldoDias: 5, primaPct: 10, vacacionesDias: 3 } }, {});
  assert.equal(peor.aguinaldoDias, 15); assert.equal(peor.primaPct, 25); assert.equal(peor.vacDias(1), 12);
  assert.equal(condicionesDe(ANA, { aguinaldoDias: 20, vacExtra: 2 }).aguinaldoDias, 20, "el rancho puede subir el piso de todos");
  assert.equal(condicionesDe(ANA, { vacExtra: 2 }).vacDias(1), 14);
});

test("determinar_el_aguinaldo_no_lo_carga_otra_vez_solo_agrega_la_diferencia", () => {
  const p = proponer(ANA, "aguinaldo", "2026", "2026-12-31", {});
  assert.equal(p.monto, 5475, "15 días × $365 por el año completo");
  const corto = determinar({ eventos: [], persona: ANA, concepto: "aguinaldo", periodo: "2026", corte: "2026-11-19", monto: 5000, quien: ADMIN, cuando: c(HOY), fecha: HOY });
  assert.equal(corto.ok, false, "sin quién autoriza no");
  assert.equal(determinar({ eventos: [], persona: ANA, concepto: "aguinaldo", periodo: "2026", corte: HOY, monto: 5000, autorizo: "Rodolfo", quien: ENC, cuando: c(HOY), fecha: HOY }).ok, false, "un encargado no determina");
  const d = determinar({ eventos: [], persona: ANA, concepto: "aguinaldo", periodo: "2026", corte: HOY, monto: 5000, autorizo: "Rodolfo", quien: ADMIN, cuando: c(HOY), fecha: HOY, azar: az() });
  assert.ok(d.ok, d.dice);
  const { renglones } = provisionDe(ANA, [d.evento], { inicio: INICIO, hoy: "2026-12-31" });
  const ag = renglones.filter(r => r.concepto === "aguinaldo");
  assert.equal(suma(ag, r => r.ajuste), 155, "se habían generado 4,845 y se determinó en 5,000");
  assert.equal(suma(ag, () => true), 5000, "generado + ajuste = lo determinado, ni un peso más");
  assert.ok(ag.every(r => r.fecha <= HOY), "después del corte ese año ya no sigue generando");
  assert.equal(determinar({ eventos: [d.evento], persona: ANA, concepto: "aguinaldo", periodo: "2026", corte: HOY, monto: 5100, autorizo: "Rodolfo", quien: ADMIN, cuando: c(HOY), fecha: HOY }).ok, false, "no se determina dos veces el mismo periodo");
});

test("corregir_lo_determinado_deja_historial_y_cambia_el_ajuste_no_lo_duplica", () => {
  const d = determinar({ eventos: [], persona: ANA, concepto: "aguinaldo", periodo: "2026", corte: HOY, monto: 5000, autorizo: "Rodolfo", quien: ADMIN, cuando: c(HOY), fecha: HOY, azar: az() }).evento;
  const r = corregirEvento(d, { datos: { monto: 4845 } }, { motivo: "se calculó con otro sueldo", quien: ADMIN, cuando: c(HOY), azar: az() });
  const evs = [r.anterior, r.nuevo];
  assert.equal(determinadasDe(evs, ANA.id).length, 1);
  const ag = provisionDe(ANA, evs, { inicio: INICIO, hoy: HOY }).renglones.filter(x => x.concepto === "aguinaldo");
  assert.equal(ag.some(x => x.ajuste), false, "quedó igual a lo generado: no hay ajuste");
  assert.equal(suma(ag, () => true), 4845);
});

test("pagar_una_prestacion_no_es_costo_y_no_se_paga_lo_que_nadie_ha_determinado", () => {
  assert.equal(pagarPrestacion({ eventos: [], persona: ANA, concepto: "aguinaldo", periodo: "2026", monto: 100, medio: "efectivo", quien: ADMIN, cuando: c(HOY), fecha: HOY }).ok, false);
  const d = determinar({ eventos: [], persona: ANA, concepto: "aguinaldo", periodo: "2026", corte: HOY, monto: 5000, autorizo: "Rodolfo", quien: ADMIN, cuando: c(HOY), fecha: HOY, azar: az() }).evento;
  const antes = cuentaDe(ANA, [d], { inicio: INICIO, hoy: HOY }).conceptos.aguinaldo;
  const p = pagarPrestacion({ eventos: [d], persona: ANA, concepto: "aguinaldo", periodo: "2026", monto: 3000, medio: "efectivo", quien: ADMIN, cuando: c(HOY), fecha: HOY, azar: az() });
  assert.ok(p.ok); assert.equal(p.evento.origen, d.id);
  const cta = cuentaDe(ANA, [d, p.evento], { inicio: INICIO, hoy: HOY }).conceptos.aguinaldo;
  assert.equal(cta.alCosto, antes.alCosto, "el pago no movió el costo");
  assert.equal(cta.determinado, 5000); assert.equal(cta.pagado, 3000); assert.equal(cta.porPagar, 2000); assert.equal(cta.provision, 0, "lo determinado ya no está provisionado");
  const doble = pagarPrestacion({ eventos: [d, p.evento], persona: ANA, concepto: "aguinaldo", periodo: "2026", monto: 3000, medio: "efectivo", quien: ADMIN, cuando: c(HOY), fecha: HOY });
  assert.ok(doble.ok && doble.avisos.some(a => /pago doble/.test(a)), "pagar de más avisa, no bloquea");
});

test("la_cuenta_separa_provision_determinado_pagado_ajustes_y_lo_que_fue_al_costo", () => {
  const cta = cuentaDe(ANA, [], { inicio: INICIO, hoy: HOY, vacacionesTomadas: [{ fecha: "2026-11-10", monto: 365 }, { fecha: "2026-11-11", monto: 365 }] });
  assert.equal(cta.antiguedad, 2);
  assert.equal(cta.conceptos.aguinaldo.generado, 4845); assert.equal(cta.conceptos.aguinaldo.antesDelSistema, 2715); assert.equal(cta.conceptos.aguinaldo.alCosto, 2130);
  assert.equal(cta.conceptos.vacaciones.provision, 4224 - 730, "las vacaciones disfrutadas bajan la provisión; no son costo nuevo");
  assert.equal(cta.dias.tomados, 2); assert.equal(cta.dias.pendientes, null, "no se sabe cuántos días traía de antes: no se inventa");
  assert.equal(cta.dias.delAnioEnCurso, 16); assert.equal(cta.dias.cumple, "2027-03-01");
  const con = cuentaDe({ ...ANA, prestaciones: { vacacionesPendientes: 6 } }, [], { inicio: INICIO, hoy: HOY, vacacionesTomadas: [{ fecha: "2026-11-10", monto: 365 }] });
  assert.equal(con.dias.pendientes, 5);
});

test("al_costo_solo_va_lo_generado_desde_que_se_lleva_el_sistema_y_cada_renglon_se_explica", () => {
  const rs = renglonesAlCosto([cuentaDe(ANA, [], { inicio: INICIO, hoy: HOY })]);
  assert.ok(rs.every(r => r.fecha >= INICIO));
  assert.equal(sumarDinero(rs.filter(r => r.concepto === "aguinaldo").map(r => r.monto)), 2130);
  assert.match(rs[0].que, /Aguinaldo que se generó · año 2026/); assert.match(rs[0].detalle, /÷ 365/);
});
