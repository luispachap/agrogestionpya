import { test } from "node:test";
import assert from "node:assert/strict";
import { proponerBaja, registrarBaja, pagarBaja, bajasDe, pagosDeBaja, renglonesDeBajas, CAUSAS_DE_BAJA } from "./bajas.js";
import { salarioMinimoEn } from "./salariosMinimos.js";
import { costoDelMes } from "./cierreMes.js";
import { juntarFuentes } from "./indirectos.js";
import { cuentaDe, renglonesAlCosto } from "./prestaciones.js";
import { fuenteBajas, baseDePersonas } from "./personal.js";
import { sumarDinero } from "./calculos.js";
import { corregirEvento } from "./eventos.js";

const ADMIN = { id: "u1", nombre: "Luis", rol: "admin" }, ENC = { id: "e1", nombre: "Enc", rol: "encargado" };
const ANA = { id: "t-ana", nombre: "Ana", sueldo_dia: 365, historialSueldo: [{ desde: "2020-01-01", sueldo_dia: 365, anterior: 365 }], fechaIngreso: "2024-03-01" };
const INICIO = "2026-07-01", DIA = "2026-11-19", c = `${DIA}T12:00:00-06:00`; let n = 0; const az = () => (++n) / 1e6;
const cuenta = (persona = ANA, evs = [], mas = {}) => cuentaDe(persona, evs, { inicio: INICIO, hoy: DIA, ...mas });
const SM = (monto) => ({ monto, zona: "general", fuente: "de prueba" });
const propone = (causa, mas = {}) => proponerBaja({ persona: ANA, causa, fecha: DIA, cuenta: cuenta(), minimo: SM(300), ...mas });
const de = (p, clave) => p.conceptos.find(k => k.clave === clave);
const TRES = (p) => p.conceptos.filter(k => ["aguinaldo", "vacaciones", "prima"].includes(k.clave)).map(k => ({ clave: k.clave, monto: k.monto }));
const baja = (mas = {}) => { const p = propone(mas.causa || "renuncia"); return registrarBaja({ eventos: [], persona: ANA, causa: "renuncia", ultimoDia: DIA, fecha: DIA, conceptos: TRES(p), propuesta: p, autorizo: "Rodolfo", quien: ADMIN, cuando: c, azar: az(), ...mas }); };

test("en_una_renuncia_se_propone_el_finiquito_lo_que_ya_gano_y_nada_de_indemnizaciones", () => {
  const p = propone("renuncia");
  assert.equal(p.tipo, "finiquito");
  assert.equal(de(p, "aguinaldo").monto, 2130, "lo generado desde el corte (sin saldo inicial capturado)"); assert.equal(de(p, "aguinaldo").aplica, "si");
  assert.equal(de(p, "prima_antiguedad").aplica, "no"); assert.match(de(p, "prima_antiguedad").explica, /15 años o más de servicio; lleva 2/);
  assert.equal(de(p, "indemnizacion_3m").aplica, "no"); assert.equal(de(p, "indemnizacion_3m").monto, null); assert.equal(de(p, "veinte_dias").aplica, "no");
  assert.ok(p.avisos.some(a => /Pagos al personal/.test(a)), "lo de sus semanas no se repite aquí");
});

test("en_un_despido_sin_causa_se_propone_liquidacion_pero_las_indemnizaciones_quedan_por_revisar", () => {
  const p = propone("despido_injustificado");
  assert.equal(p.tipo, "liquidacion");
  // salario integrado: $365 + (15 días de aguinaldo + 25 % de 16 días de vacaciones) ÷ 365 = $384 por día
  assert.equal(p.integrado, 384); assert.equal(de(p, "indemnizacion_3m").monto, 90 * 384); assert.equal(de(p, "indemnizacion_3m").aplica, "revisar"); assert.match(de(p, "indemnizacion_3m").explica, /salario integrado de 384 por día/); assert.match(de(p, "indemnizacion_3m").explica, /otras percepciones fijas/);
  assert.equal(de(p, "veinte_dias").aplica, "revisar"); assert.match(de(p, "veinte_dias").explica, /NO procede en todo despido/);
  assert.equal(de(p, "veinte_dias").sugerido, false, "en un despido los veinte días NO entran de entrada"); assert.equal(de(p, "indemnizacion_3m").sugerido, true);
  assert.equal(de(p, "veinte_dias").monto, Math.round(20 * (994 / 365) * 384 * 100) / 100, "pero la cifra queda a la vista por si proceden");
  // 2 años 264 días = 2.72 años × 12 días × $365 (no llega al tope de 2 × $300)
  assert.equal(de(p, "prima_antiguedad").aplica, "si"); assert.equal(de(p, "prima_antiguedad").monto, Math.round(12 * (994 / 365) * 365 * 100) / 100);
  assert.equal(de(propone("despido_justificado"), "indemnizacion_3m").aplica, "no", "con causa justificada no hay indemnización");
  assert.equal(de(propone("despido_justificado"), "prima_antiguedad").aplica, "si", "pero la prima de antigüedad sí");
});

test("la_prima_de_antiguedad_lleva_tope_de_dos_salarios_minimos_y_sin_ese_dato_no_se_inventa", () => {
  assert.equal(de(propone("despido_injustificado", { minimo: SM(100) }), "prima_antiguedad").monto, Math.round(12 * (994 / 365) * 200 * 100) / 100);
  assert.equal(de(propone("despido_injustificado", { minimo: SM(400) }), "prima_antiguedad").monto, Math.round(12 * (994 / 365) * 400 * 100) / 100, "si gana menos que el mínimo, se calcula con el mínimo");
  const sin = de(propone("despido_injustificado", { minimo: null }), "prima_antiguedad");
  assert.equal(sin.monto, null); assert.equal(sin.aplica, "revisar"); assert.match(sin.explica, /salario mínimo/);
  const viejo = proponerBaja({ persona: { ...ANA, fechaIngreso: "2010-01-01" }, causa: "renuncia", fecha: DIA, cuenta: cuenta({ ...ANA, fechaIngreso: "2010-01-01" }), minimo: SM(300) });
  assert.equal(de(viejo, "prima_antiguedad").aplica, "si", "con 15 años o más, también en renuncia");
});

test("cada_causa_tiene_lo_suyo_y_lo_que_la_app_no_sabe_calcular_lo_dice", () => {
  const inc = propone("incapacidad");
  assert.equal(de(inc, "un_mes").monto, 30 * 384); assert.equal(de(inc, "un_mes").aplica, "revisar"); assert.match(de(inc, "un_mes").explica, /riesgo de trabajo/);
  assert.ok(propone("muerte").avisos.some(a => /beneficiarios/.test(a)));
  assert.equal(de(propone("mutuo_acuerdo"), "prima_antiguedad").aplica, "revisar");
  assert.equal(proponerBaja({ persona: { id: "x", nombre: "X", sueldo_dia: 300 }, causa: "renuncia", fecha: DIA, cuenta: null }).ok, false, "sin fecha de ingreso no propone nada");
  assert.deepEqual([...new Set(Object.values(CAUSAS_DE_BAJA).map(x => x.da))].sort(), ["finiquito", "liquidacion"]);
});

test("la_baja_la_registra_quien_tiene_el_permiso_con_causa_autorizacion_y_los_tres_conceptos_ya_ganados", () => {
  assert.equal(baja({ quien: ENC }).ok, false); assert.equal(baja({ permitido: false }).ok, false); assert.equal(baja({ autorizo: "" }).ok, false);
  assert.equal(baja({ causa: "otra" }).ok, false, "«otra causa» pide decir cuál");
  assert.match(baja({ conceptos: [{ clave: "aguinaldo", monto: 2130 }] }).dice, /van siempre en una baja/);
  assert.equal(baja({ conceptos: [...TRES(propone("renuncia")), { clave: "otro", monto: 500 }] }).ok, false, "el «otro concepto» dice qué es");
  const r = baja({ evidencias: ["archivo:renuncia.pdf"], pdf: (d) => `PDF ${d.total}` });
  assert.ok(r.ok, r.dice); assert.equal(r.evento.datos.da, "finiquito"); assert.equal(r.evento.datos.total, sumarDinero(TRES(propone("renuncia")).map(k => k.monto)));
  assert.equal(r.evento.datos.conceptos[0].propuesto, 2130, "se guarda lo que propuso la app junto a lo que se confirmó"); assert.match(r.evento.datos.pdf, /^PDF /); assert.deepEqual(r.evento.datos.evidencias, ["archivo:renuncia.pdf"]);
  assert.equal(registrarBaja({ eventos: [r.evento], persona: ANA, causa: "renuncia", ultimoDia: DIA, fecha: DIA, conceptos: TRES(propone("renuncia")), autorizo: "x", quien: ADMIN, cuando: c }).ok, false, "no se da de baja dos veces");
  assert.match(baja().avisos[0], /sin documentos/);
});

test("al_dar_de_baja_lo_ya_generado_no_se_carga_otra_vez_solo_va_al_costo_la_diferencia", () => {
  const antes = cuenta(), p = propone("renuncia");
  const igual = baja().evento;
  const c1 = cuenta(ANA, [igual], { baja: igual });
  assert.equal(c1.conceptos.aguinaldo.alCosto, antes.conceptos.aguinaldo.alCosto, "se pagó exactamente lo generado: ni un peso más de costo");
  assert.equal(c1.conceptos.aguinaldo.pendiente, 0, "lo que se le debe ya está en la baja"); assert.equal(c1.liquidacion.total, igual.datos.total); assert.equal(c1.liquidacion.pendiente, igual.datos.total);
  // Se confirma un aguinaldo mayor: sólo la diferencia es costo nuevo.
  const mas = baja({ conceptos: TRES(p).map(k => (k.clave === "aguinaldo" ? { ...k, monto: 2500 } : k)) }).evento;
  const c2 = cuenta(ANA, [mas], { baja: mas });
  assert.equal(c2.conceptos.aguinaldo.ajustes, 370); assert.equal(c2.conceptos.aguinaldo.alCosto, 2500);
  assert.match(renglonesAlCosto([c2]).find(r => r.monto === 370).que, /ajuste al terminar la relación de trabajo/);
  // Y después de la baja ya no sigue generando.
  const despues = cuentaDe(ANA, [mas], { inicio: INICIO, hoy: "2027-02-01", baja: mas });
  assert.equal(despues.conceptos.aguinaldo.alCosto, 2500);
});

test("la_prima_de_antiguedad_y_las_indemnizaciones_son_costo_nuevo_y_no_se_reparten_sin_regla", () => {
  const p = propone("despido_injustificado");
  const b = registrarBaja({ eventos: [], persona: ANA, causa: "despido_injustificado", ultimoDia: DIA, fecha: DIA, conceptos: [...TRES(p), { clave: "prima_antiguedad", monto: de(p, "prima_antiguedad").monto }, { clave: "indemnizacion_3m", monto: 32850 }], propuesta: p, autorizo: "Rodolfo", quien: ADMIN, cuando: c, azar: az() });
  assert.ok(b.ok); assert.equal(b.evento.datos.da, "liquidacion"); assert.ok(b.avisos.some(a => /por revisar/.test(a)));
  const rs = renglonesDeBajas([b.evento]);
  assert.deepEqual(rs.map(r => r.concepto), ["prima_antiguedad", "indemnizacion_3m"], "los tres ya generados no están aquí: van por su ajuste");
  assert.match(rs[1].que, /Liquidación por despido sin causa justificada · Indemnización de tres meses/);
  const base = baseDePersonas({ partes: [{ trabajadorId: "t-ana", fecha: "2026-11-10", parcelaId: "p1", monto: 365 }] });
  const pend = fuenteBajas({ renglones: rs, base, politica: "pendiente" });
  assert.equal(pend.partes.length, 0); assert.equal(sumarDinero(pend.pendientes.map(x => x.monto)), sumarDinero(rs.map(r => r.monto)));
  assert.equal(fuenteBajas({ renglones: rs, base, politica: "fuera" }).noProduccion, sumarDinero(rs.map(r => r.monto)));
});

test("la_prima_de_antiguedad_usa_el_salario_minimo_oficial_del_dia_de_la_baja_y_si_falta_ese_anio_no_inventa", () => {
  // Ana gana $1,000 por día: tope de dos salarios mínimos. En 2026 el general es $315.04 → $630.08; en 2025 era $278.80 → $557.60.
  const RICA = { ...ANA, sueldo_dia: 1000, historialSueldo: [{ desde: "2020-01-01", sueldo_dia: 1000, anterior: 1000 }] };
  const en = (fecha) => de(proponerBaja({ persona: RICA, causa: "despido_justificado", fecha, cuenta: cuenta(RICA), minimo: salarioMinimoEn(fecha, "general", []) }), "prima_antiguedad");
  assert.match(en("2026-11-19").explica, /× 630\.08 \(el tope de dos salarios mínimos; el salario mínimo general vigente el 2026-11-19 es 315\.04 \(.*CONASAMI.*\)\)/);
  assert.match(en("2025-11-19").explica, /× 557\.6 \(el tope/, "una baja con fecha de 2025 usa el mínimo de 2025, no el de hoy");
  const falta = en("2027-01-15");
  assert.equal(falta.monto, null); assert.equal(falta.aplica, "revisar"); assert.match(falta.explica, /Falta capturar el salario mínimo oficial de 2027/);
});

test("los_veinte_dias_si_se_proponen_cuando_el_trabajador_rescinde_y_no_se_calculan_si_la_relacion_es_por_tiempo_determinado", () => {
  const r = de(propone("rescision_trabajador"), "veinte_dias");
  assert.equal(r.sugerido, true); assert.equal(r.aplica, "revisar"); assert.match(r.explica, /art\. 52/);
  const TEMP = { ...ANA, relacionLaboral: "temporada" };
  const t = de(proponerBaja({ persona: TEMP, causa: "despido_injustificado", fecha: DIA, cuenta: cuenta(TEMP), minimo: SM(300) }), "veinte_dias");
  assert.equal(t.monto, null); assert.match(t.explica, /art\. 50 fracción I/);
  const inc = propone("incapacidad");
  assert.equal(de(inc, "un_mes").monto, 30 * 384, "el mes por incapacidad también va con salario integrado");
});

test("la_prima_de_antiguedad_y_las_indemnizaciones_son_gasto_laboral_general_no_costo_de_una_parcela", () => {
  const p = propone("despido_injustificado");
  const b = registrarBaja({ eventos: [], persona: ANA, causa: "despido_injustificado", ultimoDia: DIA, fecha: DIA, conceptos: [...TRES(p), { clave: "prima_antiguedad", monto: 10000 }, { clave: "indemnizacion_3m", monto: 34560 }], propuesta: p, autorizo: "Rodolfo", evidencias: ["archivo:a.jpg"], quien: ADMIN, cuando: c, azar: az() });
  const bs = b.evento.datos.bases;
  assert.deepEqual([bs.salarioDia, bs.salarioIntegrado, bs.factor, bs.salarioMinimo, bs.anios, bs.integradoCompleto], [365, 384, 1.0521, 300, 2.72, false], "queda con qué bases se calculó");
  assert.deepEqual(bs.partes.map(x => [x.clave, x.porDia]), [["cuota", 365], ["aguinaldo", 15], ["prima", 4]]); assert.match(bs.falta[0], /nadie ha revisado/);
  const base = baseDePersonas({ partes: [{ trabajadorId: "t-ana", fecha: "2026-11-10", parcelaId: "p1", monto: 365 }] });
  const f = fuenteBajas({ renglones: renglonesDeBajas([b.evento]), base, politica: "general" });
  assert.equal(f.partes.length, 0, "nada a parcelas"); assert.equal(f.pendientes.length, 0, "ni pendiente de distribuir");
  assert.deepEqual(f.detalleNoProduccion.map(d => [d.general, d.categoria, d.personaId, d.causa, d.concepto, d.evs[0] === b.evento.id]), [[true, "laboral_bajas", "t-ana", "despido_injustificado", "prima_antiguedad", true], [true, "laboral_bajas", "t-ana", "despido_injustificado", "indemnizacion_3m", true]], "conserva de quién, por qué causa y de qué baja");
  const k = costoDelMes({ mes: "2026-11", parcelas: [{ id: "p1", nombre: "Uno" }], actividades: [{ fecha: "2026-11-10", parcelaId: "p1", costoTotal: 365 }], egresos: [{ fecha: "2026-11-05", monto: 900, categoria: "servicios" }], indirectos: juntarFuentes([f]) });
  assert.equal(k.completo, 365, "la parcela no sube por una baja"); assert.equal(k.pendiente, 0); assert.equal(k.noProduccion, 0);
  assert.deepEqual(k.generales.porCategoria, [{ categoria: "laboral_bajas", monto: 44560, n: 2 }, { categoria: "servicios", monto: 900, n: 1 }]);
  assert.equal(k.rancho, 365 + 44560 + 900, "y el total del rancho lo cuenta una sola vez");
});

test("los_pagos_de_la_baja_bajan_lo_pendiente_no_son_costo_y_corregir_la_baja_deja_historial", () => {
  const b = baja().evento;
  assert.equal(pagarBaja({ eventos: [b], baja: b, monto: 1000, medio: "efectivo", quien: ENC, cuando: c, fecha: DIA }).ok, false);
  const p1 = pagarBaja({ eventos: [b], baja: b, monto: 1000, medio: "efectivo", recibe: "Ana", comprobante: "archivo:x.jpg", quien: ADMIN, cuando: c, fecha: DIA, azar: az() });
  assert.ok(p1.ok); assert.equal(p1.evento.origen, b.id);
  const cta = cuenta(ANA, [b, p1.evento], { baja: b, pagosBaja: pagosDeBaja([b, p1.evento], b.id) });
  assert.equal(cta.liquidacion.pagado, 1000); assert.equal(cta.liquidacion.pendiente, b.datos.total - 1000);
  assert.equal(cta.conceptos.aguinaldo.alCosto, cuenta().conceptos.aguinaldo.alCosto, "pagar no movió el costo");
  assert.ok(pagarBaja({ eventos: [b, p1.evento], baja: b, monto: 999999, medio: "efectivo", quien: ADMIN, cuando: c, fecha: DIA }).avisos.some(a => /pago doble/.test(a)));
  const cor = corregirEvento(b, { datos: { ...b.datos, causa: "mutuo_acuerdo" } }, { motivo: "se firmó convenio", quien: ADMIN, cuando: c, azar: az() });
  assert.equal(bajasDe([cor.anterior, cor.nuevo]).get("t-ana").datos.causa, "mutuo_acuerdo"); assert.equal(bajasDe([cor.anterior, cor.nuevo]).size, 1);
  assert.equal(pagarBaja({ eventos: [cor.anterior, cor.nuevo], baja: b, monto: 10, medio: "efectivo", quien: ADMIN, cuando: c, fecha: DIA }).ok, false, "no se paga contra una baja que ya se corrigió");
});

test("las_indemnizaciones_usan_las_percepciones_de_su_ficha_y_avisan_si_el_salario_integrado_esta_incompleto", () => {
  const CON = { ...ANA, percepciones: { revisado: "2026-11-01", por: "Luis", lista: [{ id: "a", nombre: "Despensa", clase: "despensa", tipo: "fija", monto: 700, periodo: "semana", desde: "2025-01-01" }] } };
  const p = proponerBaja({ persona: CON, causa: "despido_injustificado", fecha: DIA, cuenta: cuenta(CON), minimo: SM(300) });
  assert.equal(p.integrado, 484); assert.equal(p.integradoCompleto, true); assert.equal(de(p, "indemnizacion_3m").monto, 90 * 484);
  assert.match(de(p, "indemnizacion_3m").explica, /despensa 100 \(700 por semana, entre 7/); assert.equal(de(p, "indemnizacion_3m").aplica, "revisar", "completo o no, la indemnización se revisa y se autoriza");
  assert.ok(!p.avisos.some(a => /es un piso/.test(a)));
  assert.ok(propone("despido_injustificado").avisos.some(a => /El salario integrado es un piso: nadie ha revisado/.test(a)));
  assert.ok(!propone("renuncia").avisos.some(a => /es un piso/.test(a)), "en un finiquito no hay indemnización: no estorba");
  assert.equal(de(p, "prima_antiguedad").monto, de(propone("despido_injustificado"), "prima_antiguedad").monto, "la prima de antigüedad NO va con salario integrado");
});
