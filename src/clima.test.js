// ============================================================
//  Pruebas del clima como copiloto de la planeación del día
//
//  El hilo de todas: la app INFORMA y la persona decide, y cuando no sabe lo
//  dice con todas sus letras. Aquí "no sé" y "no se puede" son respuestas
//  distintas y se prueban por separado — porque en el rancho también lo son:
//  con la primera Fito sale a ver el viento, con la segunda se para la faena.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  interpretarPronostico, sePuedeAplicar, ventanasParaAplicar,
  alertasDelClima, riegoNecesario, planDelDia,
  urlDePronostico, describirEdad, rangoEnPalabras, diaEnPalabras, horaEnPalabras,
  UMBRALES, TIPOS_APLICACION,
} from "./clima.js";

/* ════════════ FIXTURES: pronósticos como los devuelve Open-Meteo ════════════ */

// Un día tranquilo de septiembre en Zacatecas: 20°, viento de 6 km/h, sin agua.
const TRANQUILO = () => ({ temp: 20, hum: 55, mm: 0, prob: 5, cod: 0, viento: 6, rafaga: 12 });

// Arma las 24 horas de un día. `cambios` deja retocar horas sueltas.
function dia(fecha, base = TRANQUILO, cambios = {}) {
  return Array.from({ length: 24 }, (_, h) => ({
    t: `${fecha}T${String(h).padStart(2, "0")}:00`,
    ...base(h),
    ...(cambios[h] || {}),
  }));
}

// Le da forma de respuesta de Open-Meteo, con las horas YA en hora de México
// (que es como llegan cuando se piden bien).
function armar(horas, { zona = "America/Mexico_City", offset = -21600 } = {}) {
  return {
    latitude: 22.77, longitude: -102.58, timezone: zona, utc_offset_seconds: offset,
    hourly: {
      time: horas.map((x) => x.t),
      temperature_2m: horas.map((x) => (x.temp === undefined ? null : x.temp)),
      relative_humidity_2m: horas.map((x) => (x.hum === undefined ? null : x.hum)),
      precipitation: horas.map((x) => (x.mm === undefined ? null : x.mm)),
      precipitation_probability: horas.map((x) => (x.prob === undefined ? null : x.prob)),
      weather_code: horas.map((x) => (x.cod === undefined ? null : x.cod)),
      wind_speed_10m: horas.map((x) => (x.viento === undefined ? null : x.viento)),
      wind_gusts_10m: horas.map((x) => (x.rafaga === undefined ? null : x.rafaga)),
    },
  };
}

const D1 = "2026-09-08", D2 = "2026-09-09", D3 = "2026-09-10";
const TRES_DIAS_BUENOS = armar([...dia(D1), ...dia(D2), ...dia(D3)]);

/* ════════════ LEER EL PRONÓSTICO SIN CORRER LAS HORAS ════════════ */

test("las_horas_de_open_meteo_no_se_convierten_dos_veces", () => {
  // Open-Meteo ya devuelve la hora de aquí cuando se le pide la zona. Volver a
  // convertirla corre la ventana seis horas: "de 6 a 10 de la mañana" se
  // volvería "de 12 a 4 de la tarde", con el sol pegando.
  const p = interpretarPronostico(TRES_DIAS_BUENOS);
  const seis = p.horas.find((h) => h.hora === `${D1}T06:00`);
  assert.equal(seis.h, 6);
  assert.equal(seis.dia, D1);
  assert.equal(p.horaLocal, true);
});

test("un_pronostico_en_hora_de_greenwich_no_se_usa_para_decir_a_que_hora", () => {
  // Si vino en GMT las horas están corridas seis. No se adivina el
  // corrimiento: se dice y se para.
  const enGmt = armar([...dia(D1), ...dia(D2)], { zona: "GMT", offset: 0 });
  const r = sePuedeAplicar({ pronostico: enGmt, cuando: `${D1}T07:00` });
  assert.equal(r.puede, null);
  assert.match(r.porque, /Greenwich/);
  assert.equal(ventanasParaAplicar(enGmt, 2).ok, false);
});

test("un_dato_que_falta_llega_como_null_no_como_cero", () => {
  // Number(null) vale 0, y ese cero ya causó un error real en este proyecto:
  // "no se midió la lluvia" se convertía solo en "no llovió".
  const sinLluvia = armar(dia(D1, () => ({ ...TRANQUILO(), mm: null, prob: null })));
  const p = interpretarPronostico(sinLluvia);
  assert.equal(p.horas[0].lluviaMm, null);
  assert.equal(p.dias[0].lluviaMm, null, "un día sin dato de lluvia NO es un día seco");
  assert.notEqual(p.dias[0].lluviaMm, 0);

  // Y la pregunta que de verdad importa, con ese mismo pronóstico: no basta con
  // que el CAMPO quede en null si la frase que se lee en el teléfono sigue
  // diciendo que se puede. Esta prueba se quedaba un paso antes del error.
  const r = sePuedeAplicar({ pronostico: sinLluvia, cuando: `${D1}T07:00` });
  assert.notEqual(r.puede, true, "con la lluvia en blanco no se contesta que sí");
  assert.ok(!/sin lluvia a la vista/.test(r.porque), r.porque);
});

test("interpretar_lo_ya_interpretado_no_lo_vuelve_a_masticar", () => {
  const p = interpretarPronostico(TRES_DIAS_BUENOS);
  assert.equal(interpretarPronostico(p), p);
});

/* ════════════ ¿SE PUEDE APLICAR? ════════════ */

test("sin_pronostico_NO_se_dice_que_se_puede_ni_que_no_se_puede", () => {
  const r = sePuedeAplicar({ pronostico: null, cuando: `${D1}T07:00` });
  assert.equal(r.puede, null);
  assert.notEqual(r.puede, false, "no saber no es lo mismo que no poder");
  assert.notEqual(r.puede, true);
  assert.match(r.porque, /no se sabe/i);
});

test("no_saber_el_viento_no_es_viento_en_calma", () => {
  const p = armar([...dia(D1, TRANQUILO, { 7: { viento: null } }), ...dia(D2)]);
  const r = sePuedeAplicar({ pronostico: p, cuando: `${D1}T07:00` });
  assert.equal(r.puede, null);
  assert.match(r.faltantes.join(" "), /no se sabe cuánto viento/);
});

test("el_viento_arriba_de_quince_arrastra_el_producto_a_la_parcela_de_al_lado", () => {
  const p = armar([...dia(D1, TRANQUILO, { 7: { viento: 22 } }), ...dia(D2)]);
  const r = sePuedeAplicar({ pronostico: p, cuando: `${D1}T07:00` });
  assert.equal(r.puede, false);
  assert.match(r.porque, /22 km\/h/);
  assert.match(r.porque, /parcela de al lado/);
});

test("la_lluvia_de_dentro_de_tres_horas_lava_el_producto", () => {
  const p = armar([...dia(D1, TRANQUILO, { 10: { mm: 2, prob: 80, cod: 63 } }), ...dia(D2)]);
  const r = sePuedeAplicar({ pronostico: p, cuando: `${D1}T07:00` });
  assert.equal(r.puede, false);
  assert.match(r.porque, /va a llover/);
  assert.match(r.porque, /el gasto se pierde/);
});

test("la_lluvia_de_pasado_mañana_no_estorba_la_fumigada_de_hoy", () => {
  const p = armar([...dia(D1), ...dia(D2), ...dia(D3, TRANQUILO, { 10: { mm: 6, prob: 90, cod: 63 } })]);
  const r = sePuedeAplicar({ pronostico: p, cuando: `${D1}T07:00` });
  assert.equal(r.puede, true);
});

test("el_calor_arriba_de_treinta_lo_evapora_antes_de_que_entre", () => {
  const p = armar([...dia(D1, TRANQUILO, { 14: { temp: 34 } }), ...dia(D2)]);
  const r = sePuedeAplicar({ pronostico: p, cuando: `${D1}T14:00` });
  assert.equal(r.puede, false);
  assert.match(r.porque, /34°/);
});

test("si_el_pronostico_se_acaba_NO_se_afirma_que_no_va_a_llover", () => {
  // Diez horas de pronóstico y una mirada de seis horas hacia adelante: a las
  // 7 de la mañana no se alcanza a ver si va a llover. Eso es "no sé", no
  // "está despejado".
  const cortito = armar(dia(D1).slice(0, 10));
  const r = sePuedeAplicar({ pronostico: cortito, cuando: `${D1}T07:00` });
  assert.equal(r.puede, null);
  assert.match(r.faltantes.join(" "), /el pronóstico se acaba/);
});

test("una_hora_buena_se_dice_que_es_buena_y_con_que_numeros", () => {
  const r = sePuedeAplicar({ pronostico: TRES_DIAS_BUENOS, cuando: `${D1}T07:00` });
  assert.equal(r.puede, true);
  assert.equal(r.horasBuenas, 1);
  assert.match(r.porque, /Sí se puede/);
});

test("preguntar_por_un_dia_contesta_a_que_horas_si_y_a_que_horas_no", () => {
  const p = armar([
    ...dia(D1, TRANQUILO, Object.fromEntries(Array.from({ length: 13 }, (_, k) => [k + 11, { viento: 22 }]))),
    ...dia(D2),
  ]);
  const r = sePuedeAplicar({ pronostico: p, cuando: D1 });
  assert.equal(r.puede, true);
  assert.equal(r.ventanasBuenas.length, 1);
  assert.equal(r.ventanasBuenas[0].desdeH, 6);
  assert.equal(r.ventanasBuenas[0].hastaH, 11);
  assert.match(r.porque, /de 6 a 11 de la mañana/);
});

test("un_dia_al_que_el_pronostico_no_llega_es_un_no_se_sabe", () => {
  const r = sePuedeAplicar({ pronostico: TRES_DIAS_BUENOS, cuando: "2026-09-25" });
  assert.equal(r.puede, null);
  assert.match(r.porque, /no llega/);
});

test("una_faena_que_no_se_conoce_no_se_mide_con_los_umbrales_de_otra", () => {
  // Medir un herbicida con los límites de una fumigada le quema la parcela al
  // vecino. Si no se sabe qué reglas usar, no se contesta.
  const r = sePuedeAplicar({ pronostico: TRES_DIAS_BUENOS, cuando: `${D1}T07:00`, tipo: "vacunar" });
  assert.equal(r.puede, null);
  assert.match(r.porque, /fumigar, herbicida, fertirriego/);
});

test("el_herbicida_aguanta_menos_viento_que_una_fumigada", () => {
  const p = armar([...dia(D1, TRANQUILO, { 7: { viento: 12, rafaga: 14 } }), ...dia(D2)]);
  assert.equal(sePuedeAplicar({ pronostico: p, cuando: `${D1}T07:00`, tipo: "fumigar" }).puede, true);
  assert.equal(sePuedeAplicar({ pronostico: p, cuando: `${D1}T07:00`, tipo: "herbicida" }).puede, false);
});

test("al_fertirriego_no_se_le_inventa_un_limite_de_viento", () => {
  // Va por la manguera y por el suelo, no por el aire. Ponerle un límite de
  // viento sería inventar una restricción, y las restricciones inventadas
  // enseñan a ignorar las de verdad.
  const p = armar([...dia(D1, TRANQUILO, { 7: { viento: 30, rafaga: 45 } }), ...dia(D2)]);
  assert.equal(sePuedeAplicar({ pronostico: p, cuando: `${D1}T07:00`, tipo: "fumigar" }).puede, false);
  assert.equal(sePuedeAplicar({ pronostico: p, cuando: `${D1}T07:00`, tipo: "fertirriego" }).puede, true);
  assert.equal(TIPOS_APLICACION.fertirriego.vientoMax, null);
});

test("nada_de_esto_bloquea_aunque_conteste_que_no", () => {
  const p = armar([...dia(D1, TRANQUILO, { 7: { viento: 40 } }), ...dia(D2)]);
  const r = sePuedeAplicar({ pronostico: p, cuando: `${D1}T07:00` });
  assert.equal(r.puede, false);
  assert.equal(r.bloquea, false, "la app avisa; la persona decide");
});

/* ════════════ LAS VENTANAS BUENAS ════════════ */

test("las_ventanas_salen_en_palabras_del_rancho_y_con_hoy_y_mañana", () => {
  const v = ventanasParaAplicar(TRES_DIAS_BUENOS, 2, { hoy: D1 });
  assert.equal(v.ok, true);
  assert.ok(v.ventanas.length >= 2);
  assert.ok(v.ventanas[0].dice.startsWith("hoy "), v.ventanas[0].dice);
  assert.ok(v.ventanas[1].dice.startsWith("mañana "), v.ventanas[1].dice);
  assert.match(v.ventanas[0].dice, /de 6 /);
});

test("no_se_ofrecen_ventanas_buenisimas_a_las_tres_de_la_madrugada", () => {
  const v = ventanasParaAplicar(TRES_DIAS_BUENOS, 2, { hoy: D1 });
  for (const ventana of v.ventanas) {
    assert.ok(ventana.desdeH >= UMBRALES.horaInicio, `arrancó a las ${ventana.desdeH}`);
    assert.ok(ventana.hastaH <= UMBRALES.horaFin + 1);
  }
});

test("sin_pronostico_no_se_inventan_ventanas", () => {
  const v = ventanasParaAplicar(null, 3);
  assert.equal(v.ok, false);
  assert.deepEqual(v.ventanas, []);
  assert.match(v.dice, /no se inventan/);
});

test("no_hay_ventana_y_no_se_alcanza_a_ver_se_dicen_distinto", () => {
  const ventoso = armar([...dia(D1, () => ({ ...TRANQUILO(), viento: 30 })), ...dia(D2, () => ({ ...TRANQUILO(), viento: 30 }))]);
  const v = ventanasParaAplicar(ventoso, 1, { hoy: D1 });
  assert.equal(v.ventanas.length, 0);
  assert.equal(v.sinSaber, 0);
  assert.match(v.dice, /no hay ninguna hora buena/);
});

test("de_6_a_10_se_dice_de_6_a_10_de_la_mañana", () => {
  assert.equal(rangoEnPalabras(6, 10), "de 6 a 10 de la mañana");
  assert.equal(rangoEnPalabras(10, 14), "de 10 de la mañana a 2 de la tarde");
});

/* ════════════ LAS ALERTAS ════════════ */

test("una_helada_se_avisa_con_las_horas_que_faltan", () => {
  // Las horas se cuentan desde AHORA. A las 6 de la tarde del día 8, una
  // helada del día 9 a las 6 de la mañana está a 12 horas — no a 30, que es lo
  // que sale si se cuenta desde la medianoche en que arranca el pronóstico.
  const p = armar([...dia(D1), ...dia(D2, () => ({ ...TRANQUILO(), temp: 15 }), { 6: { temp: -2 } })]);
  const a = alertasDelClima(p, { ahora: `${D1}T18:00` });
  const helada = a.alertas.find((x) => x.que === "helada");
  assert.ok(helada, "no salió la alerta de helada");
  assert.equal(helada.gravedad, "roja");
  assert.equal(helada.cuando, `${D2}T06:00`);
  assert.equal(helada.horasDeAviso, 12);
  assert.match(helada.dice, /faltan 12 hora/);
  assert.match(helada.dice, /chile/);
});

test("tres_grados_todavia_no_es_helada_pero_ya_es_aviso", () => {
  // A dos metros marca 3°, pero a ras de suelo siempre hace más frío.
  const p = armar([...dia(D1), ...dia(D2, () => ({ ...TRANQUILO(), temp: 15 }), { 6: { temp: 2 } })]);
  const helada = alertasDelClima(p, { ahora: `${D1}T18:00` }).alertas.find((x) => x.que === "helada");
  assert.equal(helada.gravedad, "ambar");
  assert.match(helada.dice, /Riesgo de helada/);
});

test("un_dia_sin_temperatura_NO_es_un_dia_sin_helada", () => {
  // El pecado sería que un día sin dato saliera igual de verde que un día
  // templado. Va aparte, en azul: falta el dato, no está a salvo.
  const p = armar([...dia(D1), ...dia(D2, () => ({ ...TRANQUILO(), temp: null }))]);
  const a = alertasDelClima(p, { ahora: `${D1}T18:00` });
  assert.ok(a.alertas.every((x) => x.que !== "helada"));
  const falta = a.sinDato.find((x) => x.que === "helada" && x.dia === D2);
  assert.ok(falta, "el día sin temperatura no quedó marcado");
  assert.match(falta.dice, /NO se puede decir que no vaya a helar/);
  assert.equal(falta.gravedad, "azul");
});

test("el_granizo_se_llama_granizo_y_la_tormenta_se_llama_tormenta", () => {
  // Decirle granizo a una tormenta es la clase de alarma falsa que enseña a
  // ignorar las alarmas.
  const conGranizo = armar([...dia(D1), ...dia(D2, TRANQUILO, { 16: { cod: 96 } })]);
  const g = alertasDelClima(conGranizo, { ahora: `${D1}T18:00` }).alertas.find((x) => x.que === "granizo");
  assert.ok(g);
  assert.equal(g.gravedad, "roja");
  assert.equal(g.horasDeAviso, 22);

  const conTormenta = armar([...dia(D1), ...dia(D2, TRANQUILO, { 16: { cod: 95 } })]);
  const t = alertasDelClima(conTormenta, { ahora: `${D1}T18:00` });
  assert.ok(t.alertas.every((x) => x.que !== "granizo"));
  assert.ok(t.alertas.find((x) => x.que === "tormenta"));
});

test("la_lluvia_fuerte_avisa_que_la_parcela_no_se_va_a_poder_andar", () => {
  const aguacero = Object.fromEntries(Array.from({ length: 12 }, (_, k) => [k + 8, { mm: 2, prob: 95, cod: 65 }]));
  const p = armar([...dia(D1), ...dia(D2, TRANQUILO, aguacero)]);
  const ll = alertasDelClima(p, { ahora: `${D1}T18:00` }).alertas.find((x) => x.que === "lluvia fuerte");
  assert.ok(ll);
  assert.equal(ll.valor, 24);
  assert.match(ll.dice, /intransitable/);
});

test("no_hay_alertas_es_distinto_de_no_hay_pronostico", () => {
  const sin = alertasDelClima(null);
  assert.equal(sin.ok, false);
  assert.deepEqual(sin.alertas, []);
  assert.match(sin.dice, /no hay pronóstico/);

  const con = alertasDelClima(TRES_DIAS_BUENOS, { ahora: `${D1}T06:00` });
  assert.equal(con.ok, true);
  assert.equal(con.alertas.length, 0);
  assert.match(con.dice, /Ninguna alerta/);
});

/* ════════════ ¿HACE FALTA REGAR? ════════════ */

test("si_va_a_llover_bastante_regar_hoy_es_tirar_agua_y_diesel", () => {
  const lluvia = Object.fromEntries(Array.from({ length: 10 }, (_, k) => [k + 8, { mm: 2, prob: 90, cod: 63 }]));
  const p = armar([...dia(D1), ...dia(D2), ...dia(D3, TRANQUILO, lluvia)]);
  const r = riegoNecesario({ pronostico: p, ultimoRiego: "2026-09-01", hoy: D1, cadaDias: 7 });
  assert.equal(r.necesario, false);
  assert.equal(r.lluviaEsperadaMm, 20);
  assert.match(r.porque, /tirar agua y diésel/);
  assert.match(r.porque, /Tú ves el suelo/);
});

test("sin_saber_cuando_se_rego_NO_se_dice_que_ya_toca", () => {
  const r = riegoNecesario({ pronostico: TRES_DIAS_BUENOS, ultimoRiego: null, hoy: D1, cadaDias: 7 });
  assert.equal(r.necesario, null);
  assert.equal(r.diasSinRiego, null);
  assert.match(r.porque, /No se sabe cuándo se regó/);
});

test("sin_saber_cada_cuanto_se_riega_no_se_inventa_un_calendario", () => {
  const r = riegoNecesario({ pronostico: TRES_DIAS_BUENOS, ultimoRiego: "2026-08-30", hoy: D1 });
  assert.equal(r.necesario, null);
  assert.equal(r.diasSinRiego, 9);
  assert.match(r.porque, /cada cuántos días/);
});

test("con_los_dos_datos_y_sin_agua_a_la_vista_si_se_dice_que_ya_toca", () => {
  const r = riegoNecesario({ pronostico: TRES_DIAS_BUENOS, ultimoRiego: "2026-08-30", hoy: D1, cadaDias: 7 });
  assert.equal(r.necesario, true);
  assert.match(r.porque, /Por calendario ya toca/);
});

test("dos_milimetros_no_sustituyen_un_riego", () => {
  // Tres milímetros nomás asientan el polvo. Contarlos como riego seca la
  // parcela con la app diciendo que todo bien.
  const p = armar([...dia(D1), ...dia(D2, TRANQUILO, { 10: { mm: 2, prob: 60, cod: 61 } }), ...dia(D3)]);
  const r = riegoNecesario({ pronostico: p, ultimoRiego: "2026-08-30", hoy: D1, cadaDias: 7 });
  assert.equal(r.lluviaEsperadaMm, 2);
  assert.equal(r.necesario, true);
  assert.equal(r.bloquea, false);
});

test("sin_pronostico_el_riego_se_contesta_con_lo_que_si_se_sabe", () => {
  const r = riegoNecesario({ pronostico: null, ultimoRiego: "2026-08-30", hoy: D1, cadaDias: 7 });
  assert.equal(r.necesario, null);
  assert.equal(r.diasSinRiego, 9);
  assert.match(r.porque, /la última vez que se regó fue hace 9 día/);
});

/* ════════════ EL COPILOTO, TODO JUNTO ════════════ */

test("el_plan_del_dia_pone_primero_lo_que_arriesga_la_cosecha", () => {
  const p = armar([...dia(D1), ...dia(D2, () => ({ ...TRANQUILO(), temp: 15 }), { 6: { temp: -1 } })]);
  const plan = planDelDia({ pronostico: p, hoy: D1, ahora: `${D1}T06:00` });
  assert.equal(plan.ok, true);
  assert.ok(plan.dice.indexOf("HELADA") < plan.dice.indexOf("horas buenas"), plan.dice);
  assert.ok(plan.ventanas.length > 0);
  assert.equal(plan.bloquea, false);
});

test("sin_pronostico_el_dia_se_planea_igual_nomas_sin_copiloto", () => {
  const plan = planDelDia({ pronostico: null, hoy: D1 });
  assert.equal(plan.ok, false);
  assert.match(plan.dice, /El día se planea igual/);
});

/* ════════════ LA PARTE QUE TOCA LA RED: LO QUE SÍ SE PUDO DEJAR PURO ════════════ */

test("la_url_pide_la_hora_de_mexico_y_kilometros_por_hora", () => {
  // Las unidades van escritas aunque sean las de fábrica: si cambiaran, el
  // umbral de 15 km/h se estaría comparando contra millas por hora y la app
  // diría que se puede fumigar con el doble de viento.
  const url = urlDePronostico({ lat: 22.77, lon: -102.58 });
  assert.match(url, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
  assert.match(url, /timezone=America%2FMexico_City/);
  assert.match(url, /wind_speed_unit=kmh/);
  assert.match(url, /temperature_unit=celsius/);
  assert.match(url, /precipitation_unit=mm/);
});

test("sin_coordenadas_no_se_pide_el_clima_a_ciegas", () => {
  assert.equal(urlDePronostico({}), null);
  assert.equal(urlDePronostico({ lat: 22.77 }), null);
});

test("un_pronostico_de_hace_dos_dias_no_se_disfraza_de_fresco", () => {
  const e = describirEdad({ guardadoEn: "2026-09-06T10:00:00.000Z", ahora: "2026-09-08T12:00:00.000Z" });
  assert.equal(e.dias, 2);
  assert.equal(e.fresco, false);
  assert.equal(e.sirve, false);
  assert.match(e.dice, /hace 2 día/);
});

test("sin_saber_de_cuando_es_el_pronostico_se_trata_como_si_no_hubiera", () => {
  const e = describirEdad({});
  assert.equal(e.fresco, null);
  assert.equal(e.horas, null);
  assert.match(e.dice, /No se sabe de cuándo/);
});

test("un_pronostico_fechado_en_el_futuro_no_es_de_fiar", () => {
  const e = describirEdad({ guardadoEn: "2026-09-10T00:00:00.000Z", ahora: "2026-09-08T00:00:00.000Z" });
  assert.equal(e.sirve, false);
  assert.match(e.dice, /futuro/);
});

test("el_dia_se_dice_como_lo_diria_una_persona", () => {
  assert.match(diaEnPalabras(D1, D1), /^hoy /);
  assert.match(diaEnPalabras(D2, D1), /^mañana /);
  assert.match(diaEnPalabras(D3, D1), /^el /);
  assert.match(diaEnPalabras(D1), /de septiembre$/);
});

/* ════════════════════════════════════════════════════════════
   LAS QUE SE ESCAPARON

   Cada una de aquí abajo falla con el código de antes y pasa con el de ahora.
   Todas prueban LO QUE LE LLEGA A LA PERSONA —la frase, el número, el orden en
   que se lee— y no el campo interno: un campo correcto con una frase mentirosa
   sigue mandando a Fito a cargar la aspersora.
   ════════════════════════════════════════════════════════════ */

test("seis_horas_con_la_lluvia_en_blanco_no_son_seis_horas_sin_lluvia", () => {
  // Contar RENGLONES en lugar de DATOS hacía que seis horas con la lluvia en
  // blanco se dieran por miradas, y la respuesta salía impresa con la frase
  // "sin lluvia a la vista". Fito cargaba la aspersora con un dato que nadie
  // midió — el pecado que el encabezado del archivo dice no cometer.
  const enBlanco = Object.fromEntries([8, 9, 10, 11, 12, 13].map((h) => [h, { mm: null, prob: null }]));
  const p = armar([...dia(D1, TRANQUILO, enBlanco), ...dia(D2)]);

  const r = sePuedeAplicar({ pronostico: p, cuando: `${D1}T07:00` });
  assert.equal(r.puede, null, "no se sabe si se lava: eso no es un sí");
  assert.ok(!/sin lluvia a la vista/.test(r.porque), r.porque);
  assert.match(r.faltantes.join(" "), /sin dato de lluvia/);
  assert.equal(r.bloquea, false, "sigue sin bloquear: se avisa y la persona decide");
});

test("lo_que_ya_paso_no_se_anuncia_como_lo_que_falta", () => {
  // Las horas de anticipación se contaban desde el arranque del pronóstico —la
  // medianoche del día en que se bajó—, así que a las seis de la tarde un
  // granizo de las ocho de la mañana decía "faltan 8 hora(s)". Había caído
  // hacía diez.
  const conGranizo = armar([...dia(D1, TRANQUILO, { 8: { cod: 96 } }), ...dia(D2)]);

  const enLaTarde = alertasDelClima(conGranizo, { ahora: `${D1}T18:00`, hoy: D1 });
  const g = enLaTarde.alertas.find((x) => x.que === "granizo");
  assert.ok(g);
  assert.equal(g.yaPaso, true);
  assert.equal(g.horasDeAviso, -10);
  assert.match(g.dice, /ya pasó hace 10 hora/);
  assert.ok(!/faltan 8 hora/.test(g.dice), g.dice);
  assert.equal(enLaTarde.pasadas.length, 1);
  assert.equal(enLaTarde.rojas.length, 0, "un granizo de esta mañana ya no encabeza la pantalla en rojo");

  const enLaMadrugada = alertasDelClima(conGranizo, { ahora: `${D1}T05:00`, hoy: D1 });
  const g2 = enLaMadrugada.alertas.find((x) => x.que === "granizo");
  assert.equal(g2.horasDeAviso, 3);
  assert.match(g2.dice, /faltan 3 hora/);
  assert.equal(enLaMadrugada.rojas.length, 1);
});

test("sin_saber_que_hora_es_la_anticipacion_se_da_en_dias_no_en_horas_inventadas", () => {
  // Si sólo se dijo qué día es hoy, de ahí no sale una hora. Se contesta en
  // días, que es menos preciso pero no es falso.
  const p = armar([...dia(D1), ...dia(D2, () => ({ ...TRANQUILO(), temp: 15 }), { 6: { temp: -2 } })]);
  const helada = alertasDelClima(p, { hoy: D1 }).alertas.find((x) => x.que === "helada");
  assert.equal(helada.horasDeAviso, null);
  assert.equal(helada.diasDeAviso, 1);
  assert.match(helada.dice, /faltan 1 día/);
});

test("un_pronostico_en_greenwich_no_pone_una_hora_falsa_al_frente_del_plan", () => {
  // Las otras dos funciones sí se detenían con GMT; las alertas no miraban la
  // zona, y como el plan del día las pone al frente, lo primero y más grande
  // que se leía era una hora corrida seis. Pero una helada NO se calla por un
  // problema de zona horaria: se calla LA HORA, que es lo que no consta.
  const enGmt = armar(
    [...dia(D1), ...dia(D2, () => ({ ...TRANQUILO(), temp: 15 }), { 6: { temp: -2 } })],
    { zona: "GMT", offset: 0 },
  );

  const a = alertasDelClima(enGmt, { hoy: D1 });
  assert.equal(a.horaConfiable, false);
  const helada = a.alertas.find((x) => x.que === "helada");
  assert.ok(helada, "la helada es seguridad del cultivo: no se calla");
  assert.equal(helada.cuando, D2, "sin zona de fiar la alerta se ancla al día, no a una hora inventada");
  assert.match(helada.dice, /sin saber a qué hora/);
  assert.ok(!/6 de la mañana/.test(helada.dice), helada.dice);

  const plan = planDelDia({ pronostico: enGmt, hoy: D1 });
  assert.match(plan.dice.slice(0, 140), /Greenwich/, "el aviso de la hora va primero, no al final");
  assert.ok(!/6 de la mañana/.test(plan.dice), plan.dice);
});

test("un_pronostico_sin_zona_horaria_no_se_da_por_bueno_en_silencio", () => {
  // El corrimiento DESCONOCIDO es peor que el de Greenwich: del de Greenwich
  // por lo menos se sabe que está mal. Pasa con una respuesta cortada o con un
  // guardado por una versión anterior.
  const sinZona = armar([...dia(D1), ...dia(D2)]);
  delete sinZona.utc_offset_seconds;

  const p = interpretarPronostico(sinZona);
  assert.equal(p.horaLocal, null);
  assert.match(p.avisos[0] || "", /no dice en qué zona/);

  const r = sePuedeAplicar({ pronostico: sinZona, cuando: `${D1}T07:00` });
  assert.equal(r.puede, null);
  assert.match(r.porque, /zona horaria/);
  assert.equal(ventanasParaAplicar(sinZona, 2, { hoy: D1 }).ok, false);
});

test("el_pronostico_guardado_no_ofrece_las_horas_buenas_de_hace_doce_dias", () => {
  // Sin señal —lo normal en el rancho— la app enseña el pronóstico guardado.
  // Cuando ninguno de sus días alcanza a hoy, esto se caía al primer día del
  // pronóstico y ofrecía "el martes 8, de 6 de la mañana a 8 de la noche", que
  // además se lee como el martes que viene.
  const v = ventanasParaAplicar(TRES_DIAS_BUENOS, 3, { hoy: "2026-09-20" });
  assert.equal(v.ok, false);
  assert.deepEqual(v.ventanas, []);
  assert.equal(v.vencido, true);
  assert.match(v.dice, /venció/);
  assert.ok(!/martes 8/.test(v.dice), v.dice);

  const plan = planDelDia({ pronostico: TRES_DIAS_BUENOS, hoy: "2026-09-20" });
  assert.match(plan.dice, /venció/);
  assert.ok(!/martes 8/.test(plan.dice), plan.dice);

  // Y sin saber qué día es hoy tampoco se dice "los próximos 3 días": se dicen
  // los días con su nombre.
  const sinHoy = ventanasParaAplicar(TRES_DIAS_BUENOS, 3);
  assert.equal(sinHoy.ok, true);
  assert.ok(!/próximos/.test(sinHoy.dice), sinHoy.dice);
});

test("de_las_once_en_adelante_no_se_sabe_no_es_de_las_once_en_adelante_no", () => {
  // Los `faltantes` nunca entraban en la frase, y quien lee la pantalla lee la
  // frase: "se puede de 6 a 11" a secas se entiende como "de las 11 en
  // adelante el clima no da". Si de las 11 en adelante NO SE SABE, eso se
  // resuelve saliendo a ver el viento, no parando la faena.
  const sinViento = Object.fromEntries(Array.from({ length: 9 }, (_, k) => [k + 11, { viento: null }]));
  const p = armar([...dia(D1, TRANQUILO, sinViento), ...dia(D2)]);

  const r = sePuedeAplicar({ pronostico: p, cuando: D1 });
  assert.equal(r.puede, true);
  assert.match(r.porque, /de 6 a 11 de la mañana/);
  assert.match(r.porque, /NO SE SABE/);
  assert.match(r.porque, /no se sabe cuánto viento/);
  assert.ok(!/El resto del día no/.test(r.porque), r.porque);
});

test("no_se_contesta_por_un_dia_que_el_pronostico_no_alcanzo_a_mirar", () => {
  // Se preguntaba por cuatro días, el pronóstico traía tres, y la frase
  // anunciaba los cuatro con `diasSinDato: 0` y sin un solo aviso. Con la
  // lluvia justo en el borde de los 15 mm, ese día decide si se prende la bomba.
  const r = riegoNecesario({ pronostico: TRES_DIAS_BUENOS, ultimoRiego: "2026-09-01", hoy: D1, cadaDias: 7 });
  assert.equal(r.diasFueraDelPronostico, 1);
  assert.match(r.porque, /Del 2026-09-08 al 2026-09-10 se esperan/);
  assert.ok(!/al 2026-09-11 se esperan/.test(r.porque), r.porque);
  assert.match(r.avisos.join(" "), /2026-09-11/);
  assert.match(r.avisos.join(" "), /nadie miró nada/);
});

test("un_dia_medido_a_medias_no_se_cuenta_como_dia_completo", () => {
  // El total del día se sacaba descartando los nulos y sumando lo que quedaba:
  // un día con 20 de 24 horas sin medir salía con "0 mm", idéntico a un día
  // completo y seco. Es el descarte callado que en el banco vuelve un archivo
  // NO CONFIABLE; aquí el descarte se devuelve.
  const aMedias = Object.fromEntries(Array.from({ length: 20 }, (_, k) => [k + 4, { mm: null }]));
  const p = armar([...dia(D1), ...dia(D2, TRANQUILO, aMedias), ...dia(D3)]);

  const i = interpretarPronostico(p);
  const d2 = i.dias.find((d) => d.dia === D2);
  assert.equal(d2.horasConLluvia, 4);
  assert.equal(d2.lluviaCompleta, false);
  assert.equal(i.dias.find((d) => d.dia === D1).lluviaCompleta, true);

  const r = riegoNecesario({ pronostico: p, ultimoRiego: "2026-09-01", hoy: D1, cadaDias: 7, dias: 2 });
  assert.equal(r.diasIncompletos, 1);
  assert.equal(r.diasFueraDelPronostico, 0, "esta prueba es del día a medias, no de la ventana recortada");
  assert.match(r.avisos.join(" "), /4 de 24/);
  assert.match(r.porque, /piso/);
});

test("la_medianoche_no_se_dice_doce_de_la_mañana", () => {
  // "12 de la mañana" en el rancho se lee como las doce del día. Quien cubra el
  // chile a mediodía por leer eso lo pierde en la madrugada — y las 00:00 son
  // la hora más común de una helada.
  assert.equal(horaEnPalabras(0), "12 de la noche");
  assert.equal(horaEnPalabras(3), "3 de la madrugada");
  assert.equal(horaEnPalabras(12), "12 del día");
  assert.equal(horaEnPalabras(20), "8 de la noche");

  const p = armar([...dia(D1), ...dia(D2, () => ({ ...TRANQUILO(), temp: 12 }), { 0: { temp: -3 } })]);
  const helada = alertasDelClima(p, { ahora: `${D1}T18:00` }).alertas.find((x) => x.que === "helada");
  assert.match(helada.dice, /12 de la noche/);
  assert.ok(!/12 de la mañana/.test(helada.dice), helada.dice);
});

test("un_viento_sostenido_no_se_anuncia_como_si_fuera_la_rafaga", () => {
  // El viento sostenido máximo y la ráfaga máxima son dos mediciones distintas
  // y la ráfaga siempre es más alta. Se tomaba `rafagaMax ?? vientoMax` y el
  // número salía siempre como "ráfagas de X": quien decide si amarra la lona o
  // baja al de la escalera oía un promedio con nombre de ráfaga.
  const sinRafagas = armar([
    ...dia(D1, () => ({ ...TRANQUILO(), rafaga: null }), { 12: { viento: 45 } }),
    ...dia(D2),
  ]);
  const a = alertasDelClima(sinRafagas, { ahora: `${D1}T06:00` }).alertas.find((x) => x.que === "viento fuerte");
  assert.ok(a, "45 km/h de sostenido sí es viento fuerte y sí se avisa");
  assert.equal(a.medida, "viento sostenido");
  assert.match(a.dice, /viento sostenido de 45 km\/h/);
  assert.match(a.dice, /De la ráfaga no hay dato/);
  assert.ok(!/ráfagas de 45/.test(a.dice), a.dice);

  const conRafagas = armar([...dia(D1, TRANQUILO, { 12: { viento: 30, rafaga: 45 } }), ...dia(D2)]);
  const b = alertasDelClima(conRafagas, { ahora: `${D1}T06:00` }).alertas.find((x) => x.que === "viento fuerte");
  assert.equal(b.medida, "ráfaga");
  assert.match(b.dice, /ráfagas de 45 km\/h/);
});
