import { test } from "node:test";
import assert from "node:assert/strict";
import { otorgarBono, pagarBono, bonosDe, renglonesDeBonos, bonosQueIntegran, bonosPorRevisar, decidirIntegracion } from "./bonos.js";
import { integrar } from "./salarioIntegrado.js";
import { condicionesDe } from "./prestaciones.js";
import { fuenteBonos, baseDePersonas } from "./personal.js";
import { juntarFuentes } from "./indirectos.js";
import { cancelarEvento } from "./eventos.js";

const ADMIN = { id: "u1", nombre: "Luis", rol: "admin" }, ANA = { id: "t-ana", nombre: "Ana" };
let n = 0; const az = () => (++n) / 1e6; const c = (d) => `${d}T12:00:00-06:00`;
const B = (mas = {}) => ({ permitido: true, eventos: [], persona: ANA, clase: "productividad", motivo: "Meta de cajas de la semana", monto: 500, desde: "2026-11-09", hasta: "2026-11-15", autorizo: "Rodolfo", tratamiento: "actividades", quien: ADMIN, cuando: c("2026-11-16"), fecha: "2026-11-16", azar: az(), ...mas });

test("un_bono_necesita_importe_motivo_beneficiario_periodo_autorizacion_y_tratamiento_de_costo", () => {
  for (const [falta, re] of [[{ persona: null }, /a quién/], [{ monto: 0 }, /importe/], [{ motivo: "" }, /motivo/], [{ desde: "" }, /periodo/], [{ hasta: "2026-11-01" }, /periodo/], [{ autorizo: "" }, /autoriza/], [{ tratamiento: "" }, /costo/], [{ clase: "" }, /clase/]])
    assert.match(otorgarBono(B(falta)).dice, re);
  assert.equal(otorgarBono(B({ permitido: false })).ok, false, "sin permiso de pagos no se otorga");
  assert.match(otorgarBono(B({ hasta: "2026-11-30" })).dice, /todavía no termina/);
  const r = otorgarBono(B()); assert.ok(r.ok, r.dice); assert.equal(r.evento.datos.integra, "revisar", "que se llame de productividad no decide nada: si no se dijo, queda por revisar");
  assert.equal(otorgarBono(B({ clase: "extraordinario", motivo: "Ayuda por la boda" })).evento.datos.integra, "revisar", "ni que se llame extraordinario");
  assert.equal(otorgarBono(B({ integra: "si" })).evento.datos.integra, "si"); assert.equal(otorgarBono(B({ integra: false })).evento.datos.integra, "no", "lo guardado antes como sí o no se lee igual");
});

test("un_bono_no_es_aguinaldo_ni_una_prestacion_de_ley", () => {
  for (const motivo of ["Aguinaldo 2026", "prima vacacional", "pago de vacaciones", "su finiquito"]) assert.match(otorgarBono(B({ motivo })).dice, /Eso no es un bono/);
});

test("el_mismo_bono_no_entra_dos_veces_y_uno_parecido_se_avisa", () => {
  const a = otorgarBono(B()).evento;
  assert.match(otorgarBono(B({ eventos: [a] })).dice, /ya tiene ese mismo bono/);
  const otro = otorgarBono(B({ eventos: [a], monto: 300 })); assert.ok(otro.ok); assert.match(otro.avisos[0], /Ya tenía otro bono de esa clase/);
  assert.ok(otorgarBono(B({ eventos: [cancelarEvento(a, { motivo: "error", quien: ADMIN, cuando: c("2026-11-16") }).evento] })).ok, "si el primero se canceló, sí entra");
});

test("otorgar_es_el_costo_pagar_no_y_el_estado_de_pago_se_calcula", () => {
  const a = otorgarBono(B()).evento;
  assert.equal(bonosDe([a])[0].estado, "pendiente");
  const p1 = pagarBono({ permitido: true, eventos: [a], bono: a, monto: 200, quien: ADMIN, cuando: c("2026-11-21"), fecha: "2026-11-21", azar: az() });
  assert.ok(p1.ok, p1.dice);
  assert.deepEqual([bonosDe([a, p1.evento])[0].estado, bonosDe([a, p1.evento])[0].pendiente], ["parcial", 300]);
  assert.match(pagarBono({ permitido: true, eventos: [a, p1.evento], bono: a, monto: 301, quien: ADMIN, cuando: c("2026-11-22"), fecha: "2026-11-22" }).dice, /quedan 300/);
  const p2 = pagarBono({ permitido: true, eventos: [a, p1.evento], bono: a, monto: 300, quien: ADMIN, cuando: c("2026-12-01"), fecha: "2026-12-01", azar: az() }).evento;
  assert.equal(bonosDe([a, p1.evento, p2])[0].estado, "pagado");
  const r = renglonesDeBonos([a, p1.evento, p2]);
  assert.deepEqual(r.map(x => [x.fecha, x.monto]), [["2026-11-15", 500]], "un solo renglón de costo, el último día del periodo, se haya pagado cuando sea");
  assert.equal(pagarBono({ permitido: false, eventos: [a], bono: a, monto: 1, quien: ADMIN, cuando: c("2026-11-21"), fecha: "2026-11-21" }).ok, false);
});

test("cada_bono_lleva_su_costo_a_donde_se_dijo_al_otorgarlo", () => {
  const a = otorgarBono(B()).evento, g = otorgarBono(B({ clase: "extraordinario", motivo: "Ayuda por la boda", monto: 1000, tratamiento: "general" })).evento, p = otorgarBono(B({ clase: "otro", motivo: "Por definir", monto: 70, tratamiento: "pendiente" })).evento;
  const base = baseDePersonas({ partes: [{ trabajadorId: "t-ana", fecha: "2026-11-10", parcelaId: "p1", monto: 300 }, { trabajadorId: "t-ana", fecha: "2026-11-11", parcelaId: "p2", monto: 100 }] });
  const f = juntarFuentes([fuenteBonos({ renglones: renglonesDeBonos([a, g, p]), base })]);
  assert.deepEqual(f.partes.map(x => [x.parcelaId, x.monto]), [["p1", 375], ["p2", 125]], "el de productividad, a donde trabajó");
  assert.deepEqual(f.noProduccion[0].detalle.map(x => [x.general, x.categoria, x.monto]), [[true, "bonos", 1000]], "el extraordinario, gasto general");
  assert.deepEqual(f.pendientes.map(x => x.monto), [70]);
  assert.equal(f.repartido + f.pendiente + f.fuera, 1570, "cada bono cuenta una vez");
  const sinBase = juntarFuentes([fuenteBonos({ renglones: renglonesDeBonos([a]), base: baseDePersonas({ partes: [] }) })]);
  assert.equal(sinBase.pendiente, 500, "si ese mes no trabajó en parcelas, no se inventa a cuál: queda pendiente");
});

test("solo_los_bonos_que_integran_y_caen_en_la_ventana_cuentan_para_el_salario_integrado", () => {
  const a = otorgarBono(B({ integra: "si" })).evento, g = otorgarBono(B({ clase: "extraordinario", motivo: "Ayuda por la boda", monto: 1000, integra: "no" })).evento;
  assert.deepEqual(bonosQueIntegran([a, g], "t-ana", "2026-10-20", "2026-11-19").map(b => b.monto), [500]);
  assert.deepEqual(bonosQueIntegran([a, g], "t-ana", "2026-11-16", "2026-11-19"), []);
});

test("un_bono_sin_decidir_queda_por_revisar_y_deja_incompleto_el_salario_integrado_hasta_que_alguien_lo_decide", () => {
  const a = otorgarBono(B()).evento;
  assert.equal(bonosDe([a])[0].integra, "revisar"); assert.equal(bonosPorRevisar([a], "t-ana").length, 1);
  assert.deepEqual(bonosQueIntegran([a], "t-ana", "2026-10-20", "2026-11-19"), [], "lo dudoso no se integra");
  const cond = condicionesDe({ id: "t-ana", nombre: "Ana", sueldo_dia: 300, fechaIngreso: "2024-03-01" });
  const antes = integrar({ cond, diario: 300, n: 1, fecha: "2026-11-19", persona: { percepciones: { revisado: true, lista: [] } }, bonos: bonosDe([a]) });
  assert.equal(antes.completo, false); assert.match(antes.falta.join(" "), /nadie ha dicho si cuentan/); assert.ok(!antes.partes.some(p => p.clave === "variable:bonos"));
  // Decidirlo es otro evento, con fundamento; el bono original no se toca.
  assert.match(decidirIntegracion({ permitido: true, eventos: [a], bono: { id: a.id }, integra: "si", fundamento: "", quien: ADMIN, cuando: c("2026-11-17"), fecha: "2026-11-17", azar: az() }).dice, /fundamento/);
  assert.equal(decidirIntegracion({ permitido: false, eventos: [a], bono: { id: a.id }, integra: "si", fundamento: "Se paga cada semana por meta", quien: ADMIN, cuando: c("2026-11-17"), fecha: "2026-11-17", azar: az() }).ok, false);
  const d = decidirIntegracion({ permitido: true, eventos: [a], bono: { id: a.id }, integra: "si", fundamento: "Se paga cada semana por meta: es habitual", quien: ADMIN, cuando: c("2026-11-17"), fecha: "2026-11-17", azar: az() });
  assert.ok(d.ok, d.dice); assert.equal(d.evento.datos.antes, "revisar");
  const ya = bonosDe([a, d.evento])[0];
  assert.equal(ya.integra, "si"); assert.equal(ya.integraPor.quien, "Luis"); assert.equal(a.datos.integra, "revisar", "el original sigue como se capturó");
  const despues = integrar({ cond, diario: 300, n: 1, fecha: "2026-11-19", persona: { percepciones: { revisado: true, lista: [] } }, bonos: bonosDe([a, d.evento]) });
  assert.ok(despues.partes.some(p => p.clave === "variable:bonos")); assert.ok(!despues.falta.some(f => /nadie ha dicho/.test(f)));
});
