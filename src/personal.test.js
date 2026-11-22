import { test } from "node:test";
import assert from "node:assert/strict";
import { baseDePersonas, pagadoSinActividad, repartirPorActividades, fuentePersonal, fuentePrestaciones } from "./personal.js";
import { juntarFuentes } from "./indirectos.js";
import { sumarDinero } from "./calculos.js";

const H = [{ desde: "2026-01-01", sueldo_dia: 400, anterior: 400 }];
const ANA = { id: "t-ana", nombre: "Ana", sueldo_dia: 400, historialSueldo: H };
const ENC = { id: "en1", nombre: "Chuy", sueldo_dia: 600, historialSueldo: [{ desde: "2026-01-01", sueldo_dia: 600, anterior: 600 }], _tipo: "encargado", calendario: [{ desde: "2026-11-16" }] };
const parte = (mas) => ({ trabajadorId: "t-ana", fecha: "2026-11-16", parcelaId: "p1", monto: 400, minutos: 480, evs: ["m1"], ...mas });
const aus = (fecha, clase, paga = true, id = "t-ana") => ({ id: `a-${fecha}-${id}`, fecha, datos: { trabajadorId: id, clase, paga, causa: "cita", autorizo: "Rodolfo" } });
const POL = { permiso: "actividades", descanso: "actividades", espera: "actividades", inactividad: "pendiente", otra: "fuera", encargado: "actividades", justificada: "actividades" };
const politica = (c) => POL[c];

test("un_permiso_pagado_es_costo_indirecto_de_personal_y_no_una_actividad_en_la_parcela", () => {
  const partes = [parte({ parcelaId: "p1", monto: 300 }), parte({ fecha: "2026-11-17", parcelaId: "p2", monto: 100 })];
  const { items } = pagadoSinActividad({ personas: [ANA], partes, ausencias: [aus("2026-11-18", "permiso")], hoy: "2026-11-21" });
  assert.equal(items.length, 1); assert.equal(items[0].concepto, "permiso"); assert.equal(items[0].monto, 400); assert.equal(items[0].causa, "cita");
  const f = fuentePersonal({ items, base: baseDePersonas({ partes }), politica });
  assert.deepEqual(f.partes.map(p => [p.parcelaId, p.monto]), [["p1", 300], ["p2", 100]], "en proporción a lo que costaron SUS actividades ese mes");
  assert.match(f.partes[0].explica, /Ana · Permiso pagado del 2026-11-18 \(cita\)/); assert.match(f.partes[0].base, /300 de 400/);
  assert.equal(juntarFuentes([f]).repartido, 400, "lo repartido suma exacto el día pagado");
});

test("si_esa_persona_no_tiene_actividades_ese_mes_el_importe_queda_pendiente_no_se_fuerza", () => {
  const { items } = pagadoSinActividad({ personas: [ANA], partes: [], ausencias: [aus("2026-11-18", "descanso")], hoy: "2026-11-21" });
  const f = fuentePersonal({ items, base: baseDePersonas({ partes: [] }), politica });
  assert.equal(f.partes.length, 0); assert.equal(f.pendientes[0].monto, 400); assert.match(f.pendientes[0].porque, /no tiene actividades en parcelas en 2026-11/);
});

test("una_falta_no_cuesta_las_vacaciones_no_entran_aqui_y_el_dia_que_si_trabajo_no_se_cuenta_dos_veces", () => {
  const partes = [parte({ fecha: "2026-11-19" })];
  const { items } = pagadoSinActividad({ personas: [ANA], partes, ausencias: [aus("2026-11-17", "falta", false), aus("2026-11-18", "vacaciones"), aus("2026-11-19", "permiso")], hoy: "2026-11-21" });
  assert.equal(items.length, 0, "falta: sin pago · vacaciones: ya se provisionaron · permiso de un día que sí checó: manda el checador");
});

test("cada_causa_lleva_su_trato_y_lo_por_aclarar_nunca_se_reparte_solo", () => {
  const partes = [parte({ monto: 200 }), parte({ parcelaId: null, causa: "espera", monto: 80 }), parte({ parcelaId: null, causa: "inactividad", monto: 50 }), parte({ parcelaId: null, causa: "otra", monto: 30 }), parte({ parcelaId: null, causa: null, monto: 40 }), parte({ parcelaId: null, vehiculoId: "v1", monto: 99 })];
  const { items } = pagadoSinActividad({ personas: [ANA], partes, ausencias: [], hoy: "2026-11-21" });
  assert.deepEqual(items.map(i => i.concepto), ["espera", "inactividad", "otra", "por_aclarar"], "lo del vehículo ya tiene su destino: no entra");
  const f = fuentePersonal({ items, base: baseDePersonas({ partes }), politica: (c) => (c === "por_aclarar" ? "actividades" : politica(c)) });
  assert.equal(sumarDinero(f.partes.map(p => p.monto)), 80, "la espera se reparte");
  assert.deepEqual(f.pendientes.map(p => [p.concepto, p.monto]), [["inactividad", 50], ["por_aclarar", 40]], "aunque la regla dijera repartir, lo por aclarar se queda pendiente");
  assert.match(f.pendientes[1].porque, /Falta aclarar/);
  assert.equal(f.noProduccion, 30); assert.equal(f.detalleNoProduccion[0].concepto, "otra");
  assert.equal(sumarDinero(f.partes.map(p => p.monto), f.pendientes.map(p => p.monto).reduce((a, b) => a + b, 0), f.noProduccion), 200, "repartido + pendiente + fuera = todo lo pagado sin actividad");
});

test("el_dia_de_un_encargado_por_calendario_se_paga_sin_inventarle_horario_ni_parcela", () => {
  const acts = [{ id: "a1", fecha: "2026-11-16", parcelaId: "p1", costoMO: 600, registradoPor: { id: "en1" } }];
  const { items } = pagadoSinActividad({ personas: [ENC], partes: [], actividades: acts, ausencias: [aus("2026-11-18", "falta", false, "en1"), aus("2026-11-19", "permiso", true, "en1")], hoy: "2026-11-22" });
  // lun 16 registró actividad (costo directo) · mar 17 calendario · mié 18 falta · jue 19 permiso · vie 20, sáb 21 calendario · dom 22 no le toca
  assert.deepEqual(items.map(i => [i.fecha, i.concepto]), [["2026-11-19", "permiso"], ["2026-11-17", "encargado"], ["2026-11-20", "encargado"], ["2026-11-21", "encargado"]]);
  const f = fuentePersonal({ items, base: baseDePersonas({ actividades: acts }), politica });
  assert.ok(f.partes.every(p => p.parcelaId === "p1"), "se reparte según las actividades que SÍ registró"); assert.equal(sumarDinero(f.partes.map(p => p.monto)), 2400);
  const sinCal = pagadoSinActividad({ personas: [{ ...ENC, calendario: [] }], partes: [], ausencias: [], hoy: "2026-11-22" });
  assert.equal(sinCal.items.length, 0, "sin la modalidad de calendario no se le inventan días");
  const cortado = pagadoSinActividad({ personas: [{ ...ENC, calendario: [{ desde: "2026-11-16", hasta: "2026-11-17" }] }], partes: [], ausencias: [], hoy: "2026-11-22" });
  assert.deepEqual(cortado.items.map(i => i.fecha), ["2026-11-16", "2026-11-17"], "al apagar la modalidad, lo anterior se queda como estaba");
});

test("sin_sueldo_capturado_el_dia_no_se_vuelve_un_cero_se_dice_que_falta", () => {
  const r = pagadoSinActividad({ personas: [{ id: "t-x", nombre: "Equis" }], partes: [], ausencias: [aus("2026-11-18", "permiso", true, "t-x")], hoy: "2026-11-21" });
  assert.equal(r.items.length, 0); assert.equal(r.sinSueldo[0].nombre, "Equis");
});

test("las_prestaciones_se_reparten_con_su_propia_regla_y_un_ajuste_negativo_resta", () => {
  const base = baseDePersonas({ partes: [parte({ monto: 300 }), parte({ parcelaId: "p2", monto: 100 })] });
  const renglones = [{ personaId: "t-ana", nombre: "Ana", fecha: "2026-11-30", monto: 450, concepto: "aguinaldo", que: "Aguinaldo que se generó · año 2026", detalle: "30 días…" },
    { personaId: "t-ana", nombre: "Ana", fecha: "2026-11-30", monto: -40, concepto: "aguinaldo", que: "Aguinaldo (ajuste al determinar) · año 2026", detalle: "…" },
    { personaId: "t-ana", nombre: "Ana", fecha: "2026-12-31", monto: 465, concepto: "aguinaldo", que: "Aguinaldo que se generó · año 2026", detalle: "…" }];
  const f = fuentePrestaciones({ renglones, base, politica: "actividades" });
  assert.equal(sumarDinero(f.partes.map(p => p.monto)), 410); assert.ok(f.partes.some(p => p.monto < 0));
  assert.equal(f.pendientes[0].monto, 465, "diciembre no tiene actividades todavía: pendiente");
  assert.equal(fuentePrestaciones({ renglones, base, politica: "fuera" }).noProduccion, 875);
  assert.equal(fuentePrestaciones({ renglones, base, politica: "pendiente" }).pendientes.length, 3);
});

test("repartir_no_pierde_centavos", () => {
  const base = baseDePersonas({ partes: [parte({ monto: 100 }), parte({ parcelaId: "p2", monto: 100 }), parte({ parcelaId: "p3", monto: 100 })] });
  const r = repartirPorActividades({ personaId: "t-ana", nombre: "Ana", fecha: "2026-11-18", monto: 100, concepto: "permiso" }, base);
  assert.equal(sumarDinero(r.partes.map(p => p.monto)), 100);
});

import { pagadoSinActividad as psa } from "./personal.js";
test("quien_checo_sin_que_lo_asignaran_y_ademas_tiene_su_actividad_tecleada_cuesta_un_dia_no_dos", () => {
  const personas = [{ id: "t1", nombre: "Beto", sueldo_dia: 400, historialSueldo: [{ desde: "2026-01-01", sueldo_dia: 400 }] }];
  const sinAsignar = [{ trabajadorId: "t1", fecha: "2026-11-19", parcelaId: null, monto: 400, modalidad: "dia" }];
  const tecleada = [{ id: "a1", fecha: "2026-11-19", registradoPor: { id: "t1" }, costoMO: 400, parcelaId: "p2" }];
  assert.equal(psa({ personas, partes: sinAsignar, actividades: [], hoy: "2026-11-19" }).items.length, 1, "sin actividad tecleada, su día sin asignar sí es costo sin parcela (por aclarar)");
  assert.deepEqual(psa({ personas, partes: sinAsignar, actividades: tecleada, hoy: "2026-11-19" }).items, [], "con su actividad tecleada ese día, no se cuenta otra vez");
  assert.equal(psa({ personas, partes: sinAsignar, actividades: [{ ...tecleada[0], fecha: "2026-11-18" }], hoy: "2026-11-19" }).items.length, 1, "la actividad de OTRO día no lo tapa");
});
