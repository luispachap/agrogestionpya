// El plan del día y lo que se le dice a cada quien al checar. Datos inventados.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { sinDiaRelativo, planDelDia, loQueLeToca, quitarAsignacion, cambiarAsignacion, vigentesDelPlan } from "./asignaciones.js";

const personas = [{ id: "t1", nombre: "Ana de Prueba" }, { id: "t2", nombre: "Beto de Prueba" }, { id: "t3", nombre: "Caro de Prueba" }];
const parcelas = [{ id: "p1", nombre: "Parcela Inventada 1" }, { id: "p2", nombre: "Parcela Inventada 2" }];
const jefe = { id: "enc1", nombre: "Encargado de prueba", rol: "encargado" };
const tarea = (id, asignadoA, extra = {}) => ({ id, tipo: "tarea", estado: "mandada", fecha: "2026-11-23", asignadoA, parcelaId: "p1", resumen: "Ana, te vas a la Parcela Inventada 1 a deshierbar.", deQuien: "Encargado de prueba", tareaId: "ta1", ...extra });

test("al_checar_se_le_dice_a_que_va_donde_con_quien_y_quien_lo_indico", () => {
  const plan = [tarea("i1", "t1"), tarea("i2", "t2", { resumen: "Beto, te vas a la Parcela Inventada 1 a deshierbar." }), tarea("i3", "t3", { tareaId: "ta2", parcelaId: "p2", resumen: "Caro, a regar." })];
  const r = loQueLeToca(plan, "t1", "2026-11-23", { personas, parcelas });
  assert.equal(r.hay, true); assert.equal(r.dice, "Hoy te toca:");
  assert.deepEqual([r.tareas[0].donde, r.tareas[0].con, r.tareas[0].mando], ["Parcela Inventada 1", ["Beto de Prueba"], "Encargado de prueba"]);
  assert.match(r.lineas[0], /deshierbar\. Con Beto de Prueba\. Lo indicó Encargado de prueba\./);
});

test("el_plan_de_la_vispera_no_sale_hoy_y_el_de_hoy_no_sale_manana", () => {
  const plan = [tarea("i1", "t1")];
  assert.equal(loQueLeToca(plan, "t1", "2026-11-22", { personas, parcelas }).hay, false, "se planeó para el 23: el 22 no le toca todavía");
  assert.equal(loQueLeToca(plan, "t1", "2026-11-23", { personas, parcelas }).hay, true);
  assert.equal(loQueLeToca(plan, "t1", "2026-11-24", { personas, parcelas }).hay, false);
});

test("sin_plan_no_se_dice_nada_y_con_plan_pero_sin_tarea_se_le_manda_a_preguntar", () => {
  const nada = loQueLeToca([], "t1", "2026-11-23", { personas, parcelas });
  assert.deepEqual([nada.hay, nada.hayPlan, nada.dice], [false, false, ""], "que nadie haya planeado no es una falta de quien checa");
  const otro = loQueLeToca([tarea("i2", "t2")], "t1", "2026-11-23", { personas, parcelas });
  assert.deepEqual([otro.hay, otro.hayPlan], [false, true]); assert.match(otro.dice, /Pregúntale a tu encargado/);
});

test("cambiar_el_plan_no_borra_lo_anterior_y_al_checar_sale_lo_nuevo", () => {
  const original = tarea("i1", "t1");
  const c = cambiarAsignacion(original, { parcelaId: "p2" }, { quien: jefe, motivo: "se regó de más la 1", cuando: "2026-11-23T12:30:00.000Z", id: "i1b", parcelas });
  assert.equal(c.ok, true);
  assert.deepEqual([c.anterior.id, c.anterior.estado, c.anterior.cambiadaPor, c.anterior.parcelaId], ["i1", "cambiada", "i1b", "p1"], "lo anterior se queda como estaba, marcado");
  assert.deepEqual([c.nueva.id, c.nueva.estado, c.nueva.cambioDe, c.nueva.parcelaId, c.nueva.cambio.por, c.nueva.cambio.motivo], ["i1b", "mandada", "i1", "p2", "Encargado de prueba", "se regó de más la 1"]);
  assert.match(c.nueva.resumen, /^CAMBIO: ahora en Parcela Inventada 2\. Antes se había dicho:/, "el texto viejo no se deja diciendo otro lugar");
  const despues = [c.anterior, c.nueva];
  const r = loQueLeToca(despues, "t1", "2026-11-23", { personas, parcelas });
  assert.equal(r.tareas.length, 1); assert.equal(r.tareas[0].donde, "Parcela Inventada 2");
  const conBeto = [c.anterior, c.nueva, tarea("i2", "t2")];
  assert.deepEqual(loQueLeToca(conBeto, "t2", "2026-11-23", { personas, parcelas }).tareas[0].con, [], "a quien cambiaron de parcela ya no es compañero de los que se quedaron");
  assert.equal(planDelDia(despues, "2026-11-23", { personas, parcelas }).cambiadas, 1);
  assert.equal(cambiarAsignacion(original, { parcelaId: "p1" }, { quien: jefe, id: "x" }).ok, false, "si no cambió nada, no hay cambio");
  assert.equal(cambiarAsignacion(original, { asignadoA: "" }, { quien: jefe, id: "x" }).ok, false, "sin persona no se manda a nadie");
});

test("quitar_del_plan_pide_motivo_y_deja_rastro", () => {
  const original = tarea("i1", "t1");
  assert.equal(quitarAsignacion(original, { quien: jefe, motivo: "  " }).ok, false);
  const q = quitarAsignacion(original, { quien: jefe, motivo: "no vino el tractor", cuando: "2026-11-23T12:00:00.000Z" });
  assert.deepEqual([q.ok, q.anterior.estado, q.anterior.cambio.motivo], [true, "cancelada", "no vino el tractor"]);
  assert.equal(vigentesDelPlan([q.anterior], "2026-11-23").length, 0);
  assert.equal(quitarAsignacion(q.anterior, { quien: jefe, motivo: "otra vez" }).ok, false);
});

test("planear_no_es_trabajar_el_plan_no_crea_marcas_actividades_pagos_ni_costos", () => {
  // 1) Lo único que devuelven estas funciones son renglones del plan.
  const c = cambiarAsignacion(tarea("i1", "t1"), { hora: "07:00" }, { quien: jefe, id: "i1b" });
  for (const r of [c.anterior, c.nueva]) { assert.equal(r.tipo, "tarea"); for (const k of ["monto", "horas", "sueldo", "importe", "costo"]) assert.equal(r[k], undefined); }
  // 2) El módulo no conoce ni el checador ni el dinero.
  const fuente = readFileSync(new URL("./asignaciones.js", import.meta.url), "utf8");
  assert.equal(/^import /m.test(fuente), false, "no importa nada: ni marcas, ni mano de obra, ni pagos");
  // 3) Y ningún módulo de dinero o de asistencia lee el plan.
  const DINERO = ["cuadrillas.js", "pagos.js", "checador.js", "eventuales.js", "personal.js", "prestaciones.js", "cierres.js", "cierreMes.js", "resultado.js", "indirectos.js", "bonos.js", "conciliacion.js"];
  const aqui = readdirSync(new URL(".", import.meta.url));
  for (const f of DINERO) { assert.ok(aqui.includes(f), `${f} existe`); const t = readFileSync(new URL(`./${f}`, import.meta.url), "utf8"); assert.equal(/asignaciones\.js|\bindicaciones\b/.test(t), false, `${f} no lee el plan`); }
});

test("lo_planeado_la_vispera_no_le_dice_manana_a_quien_checa_el_dia_que_le_toca", () => {
  const plan = [tarea("i1", "t1", { resumen: "Mañana: regar la parcela Parcela Inventada 1. Dijo Encargado de prueba a las 18:40." })];
  const r = loQueLeToca(plan, "t1", "2026-11-23", { personas, parcelas });
  assert.equal(r.lineas[0], "Regar la parcela Parcela Inventada 1. Dijo Encargado de prueba a las 18:40.", "sin «mañana» y sin repetir quién lo indicó");
  assert.equal(sinDiaRelativo("Pasado mañana, cortar"), "Cortar"); assert.equal(sinDiaRelativo("Hoy: riego"), "Riego"); assert.equal(sinDiaRelativo("Mañanita fresca"), "Mañanita fresca");
});
