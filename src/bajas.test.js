import { test } from "node:test";
import assert from "node:assert/strict";
import { proponerBaja, registrarBaja, pagarBaja, bajasDe, pagosDeBaja, renglonesDeBajas, CAUSAS_DE_BAJA } from "./bajas.js";
import { cuentaDe, renglonesAlCosto } from "./prestaciones.js";
import { fuenteBajas, baseDePersonas } from "./personal.js";
import { sumarDinero } from "./calculos.js";
import { corregirEvento } from "./eventos.js";

const ADMIN = { id: "u1", nombre: "Luis", rol: "admin" }, ENC = { id: "e1", nombre: "Enc", rol: "encargado" };
const ANA = { id: "t-ana", nombre: "Ana", sueldo_dia: 365, historialSueldo: [{ desde: "2020-01-01", sueldo_dia: 365, anterior: 365 }], fechaIngreso: "2024-03-01" };
const INICIO = "2026-07-01", DIA = "2026-11-19", c = `${DIA}T12:00:00-06:00`; let n = 0; const az = () => (++n) / 1e6;
const cuenta = (persona = ANA, evs = [], mas = {}) => cuentaDe(persona, evs, { inicio: INICIO, hoy: DIA, ...mas });
const propone = (causa, mas = {}) => proponerBaja({ persona: ANA, causa, fecha: DIA, cuenta: cuenta(), reglas: { salarioMinimo: 300 }, ...mas });
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
  assert.equal(de(p, "indemnizacion_3m").monto, 90 * 365); assert.equal(de(p, "indemnizacion_3m").aplica, "revisar"); assert.match(de(p, "indemnizacion_3m").explica, /salario integrado/);
  assert.equal(de(p, "veinte_dias").aplica, "revisar"); assert.match(de(p, "veinte_dias").explica, /NO procede en todo despido/);
  // 2 años 264 días = 2.72 años × 12 días × $365 (no llega al tope de 2 × $300)
  assert.equal(de(p, "prima_antiguedad").aplica, "si"); assert.equal(de(p, "prima_antiguedad").monto, Math.round(12 * (994 / 365) * 365 * 100) / 100);
  assert.equal(de(propone("despido_justificado"), "indemnizacion_3m").aplica, "no", "con causa justificada no hay indemnización");
  assert.equal(de(propone("despido_justificado"), "prima_antiguedad").aplica, "si", "pero la prima de antigüedad sí");
});

test("la_prima_de_antiguedad_lleva_tope_de_dos_salarios_minimos_y_sin_ese_dato_no_se_inventa", () => {
  assert.equal(de(propone("despido_injustificado", { reglas: { salarioMinimo: 100 } }), "prima_antiguedad").monto, Math.round(12 * (994 / 365) * 200 * 100) / 100);
  const sin = de(propone("despido_injustificado", { reglas: {} }), "prima_antiguedad");
  assert.equal(sin.monto, null); assert.equal(sin.aplica, "revisar"); assert.match(sin.explica, /salario mínimo/);
  const viejo = proponerBaja({ persona: { ...ANA, fechaIngreso: "2010-01-01" }, causa: "renuncia", fecha: DIA, cuenta: cuenta({ ...ANA, fechaIngreso: "2010-01-01" }), reglas: { salarioMinimo: 300 } });
  assert.equal(de(viejo, "prima_antiguedad").aplica, "si", "con 15 años o más, también en renuncia");
});

test("cada_causa_tiene_lo_suyo_y_lo_que_la_app_no_sabe_calcular_lo_dice", () => {
  const inc = propone("incapacidad");
  assert.equal(de(inc, "un_mes").monto, 30 * 365); assert.equal(de(inc, "un_mes").aplica, "revisar"); assert.match(de(inc, "un_mes").explica, /riesgo de trabajo/);
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
