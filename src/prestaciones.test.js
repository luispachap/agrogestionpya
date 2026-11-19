import { test } from "node:test";
import assert from "node:assert/strict";
import { vacacionesDeLey, aniosCumplidos, aniversario, condicionesDe, periodosDe, provisionDe, proponer, determinar, determinadasDe, pagarPrestacion, cuentaDe, renglonesAlCosto, LEY, capturarSaldoInicial, saldosInicialesDe, remuneracionesDe, promedioDiario } from "./prestaciones.js";
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

test("sin_fecha_de_ingreso_no_se_calcula_nada_queda_pendiente_de_revision_y_no_vale_cero", () => {
  const r = provisionDe({ id: "x", nombre: "Sin fecha", sueldo_dia: 300 }, [], { inicio: INICIO, hoy: HOY });
  assert.equal(r.renglones.length, 0); assert.match(r.porque, /Pendiente de revisión: falta la fecha de ingreso/); assert.match(r.porque, /no quiere decir que sea cero/);
});

// ── Quien cobra por destajo ──
const DESTAJO = { id: "t-d", nombre: "Dora", modalidadPago: "destajo", sueldo_dia: 0, fechaIngreso: "2025-01-01" };
const ganado = (n, monto, hasta = "2026-11-19") => Array.from({ length: n }, (_, i) => ({ fecha: new Date(Date.parse(hasta + "T12:00:00Z") - (n - 1 - i) * 86400000).toISOString().slice(0, 10), monto }));
test("a_quien_cobra_por_destajo_no_se_le_inventa_un_sueldo_su_base_es_el_promedio_de_lo_que_gano", () => {
  const rem = [...ganado(30, 300, "2026-10-15"), ...ganado(30, 500)];
  assert.deepEqual(promedioDiario(rem, HOY, 30), { monto: 500, dias: 30, desde: "2026-10-21", hasta: "2026-11-19" });
  const c = condicionesDe(DESTAJO, {}, rem);
  assert.equal(c.falta.length, 0, "cobrar por destajo no le quita prestaciones"); assert.equal(c.fijo, false);
  const b = c.baseDe("aguinaldo", HOY);
  assert.equal(b.monto, 500); assert.equal(b.estimado, false); assert.match(b.origen, /promedio de sus últimos 30 días trabajados/);
  assert.equal(c.baseDe("aguinaldo", "2026-10-15").monto, 300, "el promedio es el de ESA fecha, no el de hoy");
  const p = proponer(DESTAJO, "aguinaldo", "2026", "2026-12-31", {}, rem);
  assert.ok(p.ok); assert.equal(p.monto, 15 * 500);
});

test("con_pocos_dias_registrados_el_calculo_sale_marcado_para_revision", () => {
  const { renglones, cond } = provisionDe(DESTAJO, [], { inicio: "2026-11-01", hoy: HOY, remuneraciones: ganado(4, 400) });
  const nov = renglones.find(r => r.concepto === "aguinaldo" && !r.previo);
  assert.equal(nov.estimado, true); assert.match(nov.revisar, /sólo 4 días trabajados; se piden 30/);
  assert.equal(cond.baseDe("aguinaldo", HOY).monto, 400);
  assert.equal(condicionesDe(DESTAJO, { diasPromedio: 4 }, ganado(4, 400)).baseDe("aguinaldo", HOY).estimado, false, "cuántos días se promedian es una regla del rancho");
});

test("sin_remuneraciones_registradas_la_prestacion_queda_pendiente_de_revision_y_nunca_en_cero", () => {
  const r = provisionDe(DESTAJO, [], { inicio: "2026-11-01", hoy: HOY, remuneraciones: [] });
  assert.equal(r.renglones.length, 0, "no hay ningún renglón en cero");
  assert.ok(r.porRevisar.length > 0); assert.match(r.porRevisar[0].porque, /no hay días trabajados registrados/);
  const cta = cuentaDe(DESTAJO, [], { inicio: "2026-11-01", hoy: HOY });
  assert.equal(cta.conceptos.aguinaldo.porRevisar.length, 1, "noviembre, desde el corte"); assert.equal(cta.conceptos.aguinaldo.generado, 0);
  const p = proponer(DESTAJO, "aguinaldo", "2026", HOY, {}, []);
  assert.equal(p.ok, false); assert.match(p.dice, /Pendiente de revisión/); assert.match(p.dice, /no quiere decir que sea cero/);
});

test("lo_ganado_por_dia_sale_de_lo_ya_registrado_y_un_dia_cuenta_una_vez", () => {
  const m = remuneracionesDe({ devengado: [{ trabajadorId: "t-d", fecha: "2026-11-18", monto: 300 }, { trabajadorId: "t-d", fecha: "2026-11-19", monto: 250 }],
    actividades: [{ registradoPor: { id: "t-d" }, fecha: "2026-11-19", costoMO: 100 }, { registradoPor: { id: "t-d" }, fecha: "2026-11-17", costoMO: 0 }, { _deEventos: ["x"], registradoPor: { id: "t-d" }, fecha: "2026-11-18", costoMO: 300 }] });
  assert.deepEqual(m.get("t-d"), [{ fecha: "2026-11-18", monto: 300 }, { fecha: "2026-11-19", monto: 350 }], "lo que ya salió de los eventos no se suma otra vez, y un día sin paga no cuenta como trabajado");
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

test("pagar_una_prestacion_no_es_costo_y_no_se_paga_lo_que_nadie_ha_dicho_cuanto_es", () => {
  assert.equal(pagarPrestacion({ eventos: [], persona: ANA, concepto: "aguinaldo", periodo: "2026", monto: 100, medio: "efectivo", quien: ADMIN, cuando: c(HOY), fecha: HOY }).ok, false);
  const d = determinar({ eventos: [], persona: ANA, concepto: "aguinaldo", periodo: "2026", corte: HOY, monto: 5000, autorizo: "Rodolfo", quien: ADMIN, cuando: c(HOY), fecha: HOY, azar: az() }).evento;
  const antes = cuentaDe(ANA, [d], { inicio: INICIO, hoy: HOY }).conceptos.aguinaldo;
  const p = pagarPrestacion({ eventos: [d], persona: ANA, concepto: "aguinaldo", periodo: "2026", monto: 3000, medio: "efectivo", quien: ADMIN, cuando: c(HOY), fecha: HOY, azar: az() });
  assert.ok(p.ok); assert.equal(p.evento.origen, d.id);
  const cta = cuentaDe(ANA, [d, p.evento], { inicio: INICIO, hoy: HOY }).conceptos.aguinaldo;
  assert.equal(cta.alCosto, antes.alCosto, "el pago no movió el costo");
  assert.equal(cta.determinado, 5000); assert.equal(cta.pagado, 3000); assert.equal(cta.pendiente, 2000);
  const doble = pagarPrestacion({ eventos: [d, p.evento], persona: ANA, concepto: "aguinaldo", periodo: "2026", monto: 3000, medio: "efectivo", quien: ADMIN, cuando: c(HOY), fecha: HOY });
  assert.ok(doble.ok && doble.avisos.some(a => /pago doble/.test(a)), "pagar de más avisa, no bloquea");
});

test("la_cuenta_separa_saldo_inicial_generado_despues_ajustes_pagos_y_pendiente", () => {
  const cta = cuentaDe(ANA, [], { inicio: INICIO, hoy: HOY, vacacionesTomadas: [{ fecha: "2026-11-10", monto: 365 }, { fecha: "2026-11-11", monto: 365 }] });
  assert.equal(cta.antiguedad, 2);
  const ag = cta.conceptos.aguinaldo;
  assert.equal(ag.saldoInicial, 0, "sin saldo inicial capturado, no se inventa"); assert.equal(ag.generado, 2130); assert.equal(ag.referenciaAntes, 2715); assert.equal(ag.alCosto, 2130);
  assert.equal(ag.pendiente, 2130, "lo de antes del corte no es saldo mientras nadie lo capture");
  assert.equal(cta.conceptos.vacaciones.pendiente, cta.conceptos.vacaciones.generado - 730, "las vacaciones disfrutadas bajan lo pendiente; no son costo nuevo");
  assert.equal(cta.dias.tomados, 2); assert.equal(cta.dias.pendientes, null, "no se sabe cuántos días traía de antes: no se inventa");
  assert.equal(cta.dias.delAnioEnCurso, 16); assert.equal(cta.dias.cumple, "2027-03-01");
});

// ── Saldos iniciales ──
const SALDO = { persona: ANA, concepto: "aguinaldo", periodo: "2026", monto: 2700, corte: "2026-06-30", fundamento: "15 días × $365 × 180/365, según el cálculo del despacho", responsable: "Luis", evidencia: "archivo:abc.pdf", quien: ADMIN, cuando: c(HOY), fecha: HOY };
test("el_saldo_inicial_pide_importe_periodo_fundamento_responsable_y_lo_captura_quien_tiene_el_permiso", () => {
  assert.equal(capturarSaldoInicial({ ...SALDO, eventos: [], quien: ENC }).ok, false);
  assert.equal(capturarSaldoInicial({ ...SALDO, eventos: [], permitido: false }).ok, false, "aunque en el aparato haya entrado como administrador");
  for (const falta of ["periodo", "fundamento", "responsable", "corte", "monto"]) assert.equal(capturarSaldoInicial({ ...SALDO, eventos: [], [falta]: "" }).ok, false, falta);
  const r = capturarSaldoInicial({ ...SALDO, eventos: [], azar: az() });
  assert.ok(r.ok, r.dice); assert.equal(r.avisos.length, 0); assert.equal(r.evento.datos.fundamento, SALDO.fundamento); assert.equal(r.evento.datos.evidencia, "archivo:abc.pdf");
  assert.match(capturarSaldoInicial({ ...SALDO, eventos: [], evidencia: null }).avisos[0], /sin evidencia/);
  assert.equal(capturarSaldoInicial({ ...SALDO, eventos: [r.evento] }).ok, false, "el mismo saldo no se captura dos veces");
  assert.equal(saldosInicialesDe([r.evento], ANA.id).length, 1);
});

test("el_saldo_inicial_no_va_al_costo_ni_a_ninguna_parcela_y_se_ve_aparte_de_lo_generado_despues", () => {
  const s = capturarSaldoInicial({ ...SALDO, eventos: [], azar: az() }).evento;
  const cta = cuentaDe(ANA, [s], { inicio: INICIO, hoy: HOY }), ag = cta.conceptos.aguinaldo;
  assert.equal(ag.saldoInicial, 2700); assert.equal(ag.generado, 2130); assert.equal(ag.alCosto, 2130, "al costo sólo lo generado desde el corte");
  assert.equal(ag.pendiente, 4830, "se le debe el saldo inicial más lo generado después");
  assert.equal(sumarDinero(renglonesAlCosto([cta]).filter(r => r.concepto === "aguinaldo").map(r => r.monto)), 2130);
});

test("al_determinar_se_descuenta_el_saldo_inicial_capturado_y_no_se_vuelve_a_reconocer_como_costo", () => {
  const s = capturarSaldoInicial({ ...SALDO, eventos: [], azar: az() }).evento;
  const d = determinar({ eventos: [s], persona: ANA, concepto: "aguinaldo", periodo: "2026", corte: HOY, monto: 5000, autorizo: "Rodolfo", quien: ADMIN, cuando: c(HOY), fecha: HOY, azar: az() }).evento;
  const ag = cuentaDe(ANA, [s, d], { inicio: INICIO, hoy: HOY }).conceptos.aguinaldo;
  assert.equal(ag.ajustes, 5000 - 2700 - 2130, "determinado − saldo inicial − generado después");
  assert.equal(ag.alCosto, 2300, "en este sistema el aguinaldo costó lo determinado menos lo que ya venía de antes");
  assert.equal(ag.pendiente, 5000, "y se debe lo determinado, no determinado + saldo inicial");
  // Sin saldo inicial capturado, lo de antes del corte tampoco se carga hoy: se usa la referencia que calcula la app, y lo dice.
  const sin = provisionDe(ANA, [d], { inicio: INICIO, hoy: HOY }).renglones.find(r => r.ajuste);
  assert.equal(sin.monto, 155); assert.match(sin.explica, /no hay saldo inicial capturado/);
});

test("un_saldo_de_un_periodo_ya_cerrado_se_paga_contra_el_saldo_y_baja_lo_pendiente", () => {
  const s = capturarSaldoInicial({ ...SALDO, eventos: [], concepto: "prima", periodo: "s2", monto: 1277.5, azar: az() }).evento;
  const p = pagarPrestacion({ eventos: [s], persona: ANA, concepto: "prima", periodo: "s2", monto: 1000, medio: "efectivo", comprobante: "x", quien: ADMIN, cuando: c(HOY), fecha: HOY, azar: az() });
  assert.ok(p.ok, p.dice); assert.equal(p.evento.origen, s.id);
  const pr = cuentaDe(ANA, [s, p.evento], { inicio: INICIO, hoy: HOY }).conceptos.prima;
  assert.equal(pr.saldoInicial, 1277.5); assert.equal(pr.pagado, 1000); assert.equal(pr.pendiente, sumarDinero(277.5, pr.generado));
  const otra = capturarSaldoInicial({ ...SALDO, eventos: [], concepto: "otra", periodo: "prima de antigüedad pendiente", monto: 900, azar: az() }).evento;
  assert.equal(cuentaDe(ANA, [otra], { inicio: INICIO, hoy: HOY }).conceptos.otra.pendiente, 900, "caben otras obligaciones que ya se traían");
});

test("los_dias_de_vacaciones_que_traia_se_capturan_como_saldo_inicial", () => {
  const s = capturarSaldoInicial({ ...SALDO, eventos: [], concepto: "vacaciones", periodo: "s2", monto: "", dias: 6, azar: az() });
  assert.ok(s.ok, s.dice);
  const cta = cuentaDe(ANA, [s.evento], { inicio: INICIO, hoy: HOY, vacacionesTomadas: [{ fecha: "2026-11-10", monto: 365 }] });
  assert.equal(cta.dias.traia, 6); assert.equal(cta.dias.pendientes, 5); assert.equal(cta.conceptos.vacaciones.saldoInicial, 0, "días sin importe: no se le inventa valor");
});

test("al_costo_solo_va_lo_generado_desde_que_se_lleva_el_sistema_y_cada_renglon_se_explica", () => {
  const rs = renglonesAlCosto([cuentaDe(ANA, [], { inicio: INICIO, hoy: HOY })]);
  assert.ok(rs.every(r => r.fecha >= INICIO));
  assert.equal(sumarDinero(rs.filter(r => r.concepto === "aguinaldo").map(r => r.monto)), 2130);
  assert.match(rs[0].que, /Aguinaldo que se generó · año 2026/); assert.match(rs[0].detalle, /÷ 365/);
});
