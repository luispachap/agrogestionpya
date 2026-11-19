// ============================================================
//  Pruebas de la siembra
//
//  El hilo: medir cuando la máquina YA se está deteniendo, y no estimar nada
//  que no se haya medido.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  avanceDeSiembra, revisarRecarga, rendimiento, compararRendimientos, alcanzaLaSemilla,
} from "./siembra.js";

/* Una mañana de siembra de ajo: la máquina se para tres veces a recargar. */
const RECARGAS = [
  { cuando: "2026-09-08T07:00:00", kg: 400, hectareasAcumuladas: 0 },
  { cuando: "2026-09-08T09:00:00", kg: 400, hectareasAcumuladas: 1.6 },
  { cuando: "2026-09-08T11:00:00", kg: 400, hectareasAcumuladas: 3.2 },
];

/* ════════════ EL AVANCE ════════════ */

test("de_las_paradas_a_recargar_sale_todo_lo_demas", () => {
  // Ese alto ya existe y ya cuesta tiempo. Anotar dos números ahí sale gratis.
  const a = avanceDeSiembra({ recargas: RECARGAS, hectareasTotales: 8, kgPorHaPlaneado: 350 });
  assert.equal(a.hay, true);
  assert.equal(a.recargas, 3);
  assert.equal(a.kgUsados, 1200);
  assert.equal(a.hectareasHechas, 3.2);
  assert.equal(a.porcentaje, 40);
  assert.equal(a.kgPorHa, 375);              // 1200 kg entre 3.2 ha
  assert.equal(a.desviacion, 7);             // 7% arriba del plan de 350
  assert.equal(a.faltaHa, 4.8);
  assert.equal(a.semillaQueFalta, 1800);     // 4.8 ha × 375 kg/ha
});

test("el_ritmo_sale_de_dos_recargas_no_de_una", () => {
  const a = avanceDeSiembra({ recargas: RECARGAS, hectareasTotales: 8 });
  assert.equal(a.ritmo.hay, true);
  assert.equal(a.ritmo.haPorHora, 0.8);      // 3.2 ha en 4 horas
  assert.equal(a.horasParaTerminar, 6);      // 4.8 ha a 0.8 ha/hora

  const una = avanceDeSiembra({ recargas: [RECARGAS[0]], hectareasTotales: 8 });
  assert.equal(una.ritmo.hay, false);
  assert.equal(una.horasParaTerminar, null);
  assert.ok(una.ritmo.porque.includes("hace falta otra"));
});

test("sin_hectareas_de_la_parcela_NO_se_inventa_cuanto_falta", () => {
  const a = avanceDeSiembra({ recargas: RECARGAS });
  assert.equal(a.faltaHa, null);
  assert.equal(a.semillaQueFalta, null);
  assert.equal(a.porcentaje, null);
  assert.ok(a.dice.includes("no se sabe cuánto falta"));
  // Pero lo que sí se midió, sí se dice.
  assert.equal(a.kgPorHa, 375);
});

test("sin_avance_anotado_no_hay_kilos_por_hectarea", () => {
  // Cargar semilla sin decir por dónde va no da densidad. No se saca del plan.
  const a = avanceDeSiembra({
    recargas: [{ cuando: "2026-09-08T07:00:00", kg: 400 }],
    hectareasTotales: 8, kgPorHaPlaneado: 350,
  });
  assert.equal(a.kgPorHa, null);
  assert.equal(a.kgUsados, 400);
  assert.ok(a.dice.includes("sólo se sabe cuánta semilla"));
});

test("sin_plan_capturado_no_hay_desviacion_que_presumir", () => {
  const a = avanceDeSiembra({ recargas: RECARGAS, hectareasTotales: 8 });
  assert.equal(a.desviacion, null);
  assert.ok(a.dice.includes("no hay con qué compararlo"));
});

test("nunca_se_registro_una_recarga_y_lo_dice", () => {
  const a = avanceDeSiembra({ recargas: [], hectareasTotales: 8 });
  assert.equal(a.hay, false);
  assert.ok(a.dice.includes("Todavía no se ha registrado"));
});

/* ════════════ UNA RECARGA QUE SE VE RARA ════════════ */

test("la_maquina_no_va_para_atras", () => {
  const r = revisarRecarga({
    recarga: { kg: 400, hectareasAcumuladas: 1.0 },
    anterior: { kg: 400, hectareasAcumuladas: 1.6 },
  });
  assert.equal(r.marcada, true);
  assert.ok(r.avisos.some(a => a.includes("no va para atrás")));
  // Se guarda igual: lo que ya pasó, pasó.
  assert.equal(r.seGuarda, true);
});

test("una_densidad_muy_fuera_de_lo_normal_se_marca_sin_corregirse", () => {
  const r = revisarRecarga({
    recarga: { kg: 400, hectareasAcumuladas: 1.9 },   // 400 kg en 0.3 ha = 1333 kg/ha
    anterior: { kg: 400, hectareasAcumuladas: 1.6 },
    kgPorHaEsperado: 350,
  });
  assert.equal(r.marcada, true);
  assert.equal(r.seGuarda, true);
  // No acusa: da las tres explicaciones posibles.
  assert.ok(r.avisos.some(a => a.includes("el terreno") && a.includes("calibración")));
});

test("una_recarga_sin_avance_se_guarda_pero_lo_dice", () => {
  const r = revisarRecarga({ recarga: { kg: 400 } });
  assert.equal(r.seGuarda, true);
  assert.ok(r.avisos.some(a => a.includes("por dónde va la máquina")));
});

/* ════════════ EL RENDIMIENTO ════════════ */

test("cajas_por_hectarea_y_cajas_por_kilo_de_semilla", () => {
  // La pregunta que de verdad importa cuando se cierra el ciclo.
  const r = rendimiento({ cajas: 2400, hectareas: 8, kgSemilla: 3000, kgPorCaja: 10 });
  assert.equal(r.completo, true);
  assert.equal(r.cajasPorHa, 300);
  assert.equal(r.cajasPorKgSemilla, 0.8);
  assert.equal(r.kilosTotales, 24000);
  assert.equal(r.kilosPorHa, 3000);
});

test("sin_hectareas_no_hay_rendimiento_que_valga", () => {
  const r = rendimiento({ cajas: 2400, hectareas: null });
  assert.equal(r.completo, false);
  assert.deepEqual(r.falta, ["las hectáreas de la parcela"]);
  assert.equal(r.cajasPorHa, null);
});

test("sin_semilla_capturada_se_dice_en_vez_de_omitirlo", () => {
  const r = rendimiento({ cajas: 2400, hectareas: 8 });
  assert.equal(r.completo, true);
  assert.equal(r.cajasPorKgSemilla, null);
  assert.ok(r.dice.includes("no se sabe cuántas cajas dio cada kilo"));
});

test("la_comparacion_pone_los_numeros_juntos_sin_recomendar", () => {
  // La parcela que rindió menos puede ser la que se heló, y eso la app no lo
  // sabe. Los números lado a lado, y quien conoce el terreno concluye.
  const c = compararRendimientos([
    { nombre: "San Felipe 1", cajas: 2400, hectareas: 8, kgSemilla: 3000 },
    { nombre: "El 50", cajas: 1500, hectareas: 6, kgSemilla: 2200 },
    { nombre: "Gon", cajas: 900 },   // sin hectáreas: no entra
  ]);
  assert.equal(c.hay, true);
  assert.equal(c.filas.length, 2);
  assert.equal(c.filas[0].nombre, "San Felipe 1");
  assert.equal(c.incompletas, 1);
  assert.ok(c.dice.includes("no es que hayan rendido cero"));
  for (const p of ["siembra", "no siembres", "mejor", "peor", "recomend"]) {
    assert.equal(c.dice.toLowerCase().includes(p), false, `no debe recomendar ("${p}")`);
  }
});

/* ════════════ ¿ALCANZA LA SEMILLA? ════════════ */

test("avisa_que_no_alcanza_ANTES_de_que_se_pare_la_maquina", () => {
  const a = alcanzaLaSemilla({ existenciaKg: 1000, kgPorHa: 375, hectareasQueFaltan: 4.8, costoPorKg: 45 });
  assert.equal(a.sabe, true);
  assert.equal(a.alcanza, false);
  assert.equal(a.faltanKg, 800);
  assert.equal(a.costoDeReponer, 36000);
  assert.ok(a.dice.includes("NO alcanza"));
  assert.ok(a.dice.includes("$36,000"));
});

test("cuando_alcanza_lo_dice_sin_alarmar", () => {
  const a = alcanzaLaSemilla({ existenciaKg: 2000, kgPorHa: 375, hectareasQueFaltan: 4.8 });
  assert.equal(a.alcanza, true);
  assert.ok(a.dice.includes("Alcanza"));
});

test("sin_saber_la_densidad_real_no_se_contesta_si_alcanza", () => {
  // Con una sola recarga todavía no se sabe cuánto se está usando por hectárea.
  const a = alcanzaLaSemilla({ existenciaKg: 1000, kgPorHa: null, hectareasQueFaltan: 4.8 });
  assert.equal(a.sabe, false);
  assert.ok(a.dice.includes("Registra un par de recargas"));
});

test("sin_saber_lo_que_hay_en_bodega_tampoco", () => {
  const a = alcanzaLaSemilla({ existenciaKg: null, kgPorHa: 375 });
  assert.equal(a.sabe, false);
  assert.ok(a.dice.includes("No se sabe cuánta semilla hay"));
});

test("sin_costo_por_kilo_no_se_inventa_cuanto_costaria_reponer", () => {
  const a = alcanzaLaSemilla({ existenciaKg: 1000, kgPorHa: 375, hectareasQueFaltan: 4.8 });
  assert.equal(a.costoDeReponer, null);
  assert.ok(a.dice.includes("no se sabe cuánto costaría"));
});
