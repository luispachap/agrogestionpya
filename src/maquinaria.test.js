// ============================================================
//  Pruebas del horómetro, el diésel y las horas de máquina
//
//  El hilo de todas: la app informa, la persona manda. Ninguna de estas
//  funciones acusa, bloquea, ni cuadra sola un faltante.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  revisarHorometro, consumoPorHora, promedioConsumo, compararConsumo,
  cuadrarTanque, serviciosPendientes, costoPorHora,
} from "./maquinaria.js";

/* ════════════ EL HORÓMETRO NO VA PARA ATRÁS ════════════ */

test("el_horometro_no_va_para_atras", () => {
  const r = revisarHorometro({ lectura: 1180, lecturaAnterior: 1240, fecha: "2026-09-08", fechaAnterior: "2026-09-05" });
  assert.equal(r.estado, "va para atras");
  assert.equal(r.marcada, true);
  assert.ok(r.dice.includes("MENOR"));
});

test("una_lectura_mala_se_marca_pero_NO_se_corrige_ni_se_borra", () => {
  // El patrón de quién captura mal también es información.
  const r = revisarHorometro({ lectura: 1180, lecturaAnterior: 1240 });
  assert.equal(r.marcada, true);
  assert.equal(r.lectura, undefined);      // no devuelve una lectura "arreglada"
  assert.equal(r.horasDelPeriodo, null);   // ni inventa horas
});

test("no_caben_mas_de_24_horas_de_maquina_en_un_dia", () => {
  const r = revisarHorometro({ lectura: 1400, lecturaAnterior: 1240, fecha: "2026-09-06", fechaAnterior: "2026-09-05" });
  assert.equal(r.estado, "imposible");
  assert.equal(r.marcada, true);
  assert.ok(r.dice.includes("calendario"));
});

test("el_horometro_se_compara_contra_las_horas_que_se_capturaron_en_la_labor", () => {
  // El aparato dice 8 horas y en la labor capturaron 3: sobran 5.
  const r = revisarHorometro({ lectura: 1248, lecturaAnterior: 1240, fecha: "2026-09-06", fechaAnterior: "2026-09-05", horasTrabajadas: 3 });
  assert.equal(r.estado, "no cuadra con la actividad");
  assert.ok(r.dice.includes("sobran 5.0 hr"));
});

test("cuando_todo_cuadra_lo_dice_sin_alarmar", () => {
  const r = revisarHorometro({ lectura: 1246, lecturaAnterior: 1240, fecha: "2026-09-06", fechaAnterior: "2026-09-05", horasTrabajadas: 6 });
  assert.equal(r.estado, "bien");
  assert.equal(r.marcada, false);
  assert.equal(r.horasDelPeriodo, 6);
});

test("la_primera_lectura_no_se_puede_comparar_con_nada_y_lo_dice", () => {
  const r = revisarHorometro({ lectura: 1240, lecturaAnterior: null });
  assert.equal(r.estado, "primera lectura");
  assert.equal(r.horasDelPeriodo, null);
  assert.equal(r.marcada, false);
});

test("sin_lectura_no_se_supone_una", () => {
  assert.equal(revisarHorometro({ lectura: null }).estado, "sin lectura");
  assert.equal(revisarHorometro({ lectura: "no la vi" }).horasDelPeriodo, null);
});

/* ════════════ DIÉSEL CONTRA HORAS ════════════ */

test("doscientos_litros_para_seis_horas_de_rastreo_se_ven_en_los_numeros", () => {
  // El caso del catálogo: se cargan 200 L y el tractor reporta 6 horas.
  assert.equal(consumoPorHora({ litros: 200, horas: 6 }), 33.33);
  assert.equal(consumoPorHora({ litros: 66, horas: 6 }), 11);
  assert.equal(consumoPorHora({ litros: 200, horas: 0 }), null); // sin horas, no hay cuenta
  assert.equal(consumoPorHora({ litros: null, horas: 6 }), null);
});

test("con_menos_de_tres_labores_no_hay_promedio_que_valga", () => {
  // Un promedio sacado de una sola vez no es un promedio, es esa vez.
  const p = promedioConsumo([{ litros: 100, horas: 10 }, { litros: 120, horas: 10 }]);
  assert.equal(p.promedio, null);
  assert.equal(p.suficiente, false);
  assert.equal(p.sobre, 2);
});

test("el_promedio_sale_de_las_labores_con_datos_completos", () => {
  const p = promedioConsumo([
    { litros: 100, horas: 10 },   // 10
    { litros: 110, horas: 10 },   // 11
    { litros: 120, horas: 10 },   // 12
    { litros: 90, horas: 0 },     // sin horas: no cuenta
  ]);
  assert.equal(p.promedio, 11);
  assert.equal(p.sobre, 3);
});

test("la_comparacion_NO_usa_la_palabra_robo_ni_ordena_nada", () => {
  const r = compararConsumo({
    maquina: "El tractor 3", labor: "barbecho", litros: 142, horas: 10,
    historial: [{ litros: 108, horas: 10 }, { litros: 110, horas: 10 }, { litros: 106, horas: 10 }],
  });
  assert.equal(r.actual, 14.2);
  assert.equal(r.promedio, 10.8);
  assert.ok(r.dice.includes("14.2 L/h"));
  assert.ok(r.dice.includes("10.8"));
  // Ni acusa ni manda:
  for (const palabra of ["robo", "roban", "robando", "sospech", "debes", "revisa al", "castiga"]) {
    assert.equal(r.dice.toLowerCase().includes(palabra), false, `la frase no debe decir "${palabra}"`);
  }
  assert.equal(r.llamaLaAtencion, true);
});

test("sin_historial_suficiente_dice_que_todavia_no_puede_comparar", () => {
  const r = compararConsumo({ maquina: "El tractor 3", labor: "barbecho", litros: 142, horas: 10, historial: [] });
  assert.equal(r.actual, 14.2);
  assert.equal(r.promedio, null);
  assert.ok(r.dice.includes("Todavía no hay con qué compararlo"));
});

test("sin_horas_o_sin_litros_dice_que_falta_el_dato", () => {
  const r = compararConsumo({ maquina: "El tractor 3", litros: 200, horas: null, historial: [] });
  assert.equal(r.hay, false);
  assert.ok(r.dice.includes("falta"));
});

/* ════════════ EL TANQUE DEL RANCHO ════════════ */

test("el_faltante_del_tanque_NO_se_reparte_entre_las_maquinas", () => {
  // Cuadrar repartiendo es exactamente la forma en que se esconde un faltante.
  const r = cuadrarTanque({
    saldoInicial: 500,
    cargas: [{ litros: 1000 }],
    salidas: [{ litros: 620 }, { litros: 300 }],
    medicionFisica: 480,
  });
  assert.equal(r.teorico, 580);
  assert.equal(r.medido, 480);
  assert.equal(r.diferencia, -100);
  assert.equal(r.ajustaSolo, false);
  assert.ok(r.dice.includes("faltan 100 L"));
  assert.ok(r.dice.includes("sin repartirse"));
});

test("si_nadie_ha_medido_el_tanque_no_se_dice_que_cuadra", () => {
  const r = cuadrarTanque({ saldoInicial: 500, cargas: [{ litros: 1000 }], salidas: [{ litros: 620 }], medicionFisica: null });
  assert.equal(r.medido, null);
  assert.equal(r.diferencia, null);
  assert.ok(r.dice.includes("no se sabe si es cierto"));
});

/* ════════════ SERVICIO POR HORAS ════════════ */

test("si_la_lectura_del_horometro_es_vieja_NO_estima_las_horas", () => {
  // "Del tractor 3 no sé sus horas" vale más que un número inventado.
  const r = serviciosPendientes({
    horometroActual: 1240, fechaLectura: "2026-06-01", hoy: "2026-09-08",
    servicios: [{ nombre: "Aceite", cadaHoras: 250, ultimoAHoras: 1000 }],
  });
  assert.equal(r.sabe, false);
  assert.deepEqual(r.pendientes, []);
  assert.ok(r.dice.includes("99 días"));
});

test("el_aceite_a_las_250_horas_avisa_cuando_toca", () => {
  const r = serviciosPendientes({
    horometroActual: 1260, fechaLectura: "2026-09-05", hoy: "2026-09-08",
    servicios: [
      { nombre: "Aceite", cadaHoras: 250, ultimoAHoras: 1000 },   // toca a las 1250 → vencido
      { nombre: "Filtros", cadaHoras: 500, ultimoAHoras: 1000 },  // toca a las 1500
    ],
  });
  assert.equal(r.sabe, true);
  const aceite = r.pendientes.find(p => p.nombre === "Aceite");
  assert.equal(aceite.vencido, true);
  assert.equal(aceite.faltanHoras, -10);
  const filtros = r.pendientes.find(p => p.nombre === "Filtros");
  assert.equal(filtros.vencido, false);
  assert.equal(filtros.faltanHoras, 240);
});

test("sin_horometro_no_se_dice_que_servicio_toca", () => {
  const r = serviciosPendientes({ horometroActual: null, servicios: [{ nombre: "Aceite", cadaHoras: 250 }] });
  assert.equal(r.sabe, false);
  assert.ok(r.dice.includes("no se ha capturado"));
});

/* ════════════ COSTO POR HORA ════════════ */

test("el_costo_por_hora_dice_sobre_que_esta_calculado", () => {
  const r = costoPorHora({ horas: 100, litros: 1100, precioLitro: 24.5, gastosMantenimiento: 8000 });
  assert.equal(r.completo, true);
  assert.equal(r.combustible, 26950);
  assert.equal(r.total, 34950);
  assert.equal(r.porHora, 349.5);
});

test("un_costo_al_que_le_falta_el_diesel_no_se_disfraza_de_completo", () => {
  const r = costoPorHora({ horas: 100, litros: null, precioLitro: 24.5, gastosMantenimiento: 8000 });
  assert.equal(r.completo, false);
  assert.deepEqual(r.falta, ["litros de diésel"]);
  assert.ok(r.dice.includes("SIN"));
  assert.ok(r.dice.includes("más alto"));
});

test("sin_horas_no_hay_costo_por_hora", () => {
  const r = costoPorHora({ horas: 0, litros: 100, precioLitro: 24, gastosMantenimiento: 0 });
  assert.equal(r.porHora, null);
});
