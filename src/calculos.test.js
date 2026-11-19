// ============================================================
//  Pruebas de los cálculos del rancho
//
//  Se corren con "npm test". Usan el corredor que ya viene dentro
//  de node (node --test): no hay nada que instalar, Vercel sigue
//  corriendo sólo "npm run build" y StackBlitz no baja nada nuevo.
//
//  Cada prueba lleva el nombre de lo que cuida, no un número.
//  Cuando algo se rompa dentro de seis meses, ese nombre es lo
//  único que va a explicar por qué la prueba existía.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  aCentavos, aPesos, sumarDinero, multiplicarDinero, repartirDinero, fmt,
  numeroALetras,
  fechaLocal, mesLocal, sumarDias, mesAnterior, diasEntre,
  saldoCredito, diasParaVencer, cubetaVencimiento,
  estaCancelado, vivos, marcarCancelado, ganaAlSincronizar,
  formatearTelefonoMX, totalCosecha, calcularCostoManoObra, distKm,
} from "./calculos.js";

/* ════════════ LA REMISIÓN QUE SE LE ENTREGA AL CLIENTE ════════════ */

test("la_remision_nunca_imprime_100_centavos", () => {
  // Antes: se cortaba el entero primero y luego se redondeaban los centavos
  // aparte, así que 1.999 salía "UN PESO 100/100 M.N." en el papel.
  assert.equal(numeroALetras(1.999), "DOS PESOS 00/100 M.N.");
  assert.equal(numeroALetras(0.999), "UN PESO 00/100 M.N.");
  assert.equal(numeroALetras(99.999), "CIEN PESOS 00/100 M.N.");
  // Y en ningún monto los centavos pueden pasar de 99.
  for (let i = 0; i < 400; i++) {
    const monto = i * 0.997;
    const centavos = numeroALetras(monto).match(/(\d{2})\/100/)[1];
    assert.ok(Number(centavos) <= 99, `${monto} imprimió ${centavos}/100`);
  }
});

test("la_remision_dice_un_peso_en_singular", () => {
  assert.equal(numeroALetras(1), "UN PESO 00/100 M.N.");
  assert.equal(numeroALetras(2), "DOS PESOS 00/100 M.N.");
  assert.equal(numeroALetras(0), "CERO PESOS 00/100 M.N.");
});

test("la_remision_apocopa_veintiun_antes_del_sustantivo", () => {
  // "veintiún mil pesos" y "veintiún pesos": apocopado, porque va delante
  // de un sustantivo masculino. "Veintiuno pesos" estaría mal escrito.
  assert.equal(numeroALetras(21000), "VEINTIÚN MIL PESOS 00/100 M.N.");
  assert.equal(numeroALetras(21), "VEINTIÚN PESOS 00/100 M.N.");
  assert.equal(numeroALetras(31), "TREINTA Y UN PESOS 00/100 M.N.");
});

test("la_remision_dice_un_millon_de_pesos_con_la_preposicion", () => {
  assert.equal(numeroALetras(1000000), "UN MILLÓN DE PESOS 00/100 M.N.");
  // Con resto NO lleva "DE": "UN MILLÓN QUINIENTOS PESOS".
  assert.equal(numeroALetras(1000500), "UN MILLÓN QUINIENTOS PESOS 00/100 M.N.");
});

test("la_remision_escribe_los_centavos_que_de_verdad_tiene", () => {
  assert.equal(numeroALetras(12450.75), "DOCE MIL CUATROCIENTOS CINCUENTA PESOS 75/100 M.N.");
  assert.equal(numeroALetras(100.5), "CIEN PESOS 50/100 M.N.");
});

/* ════════════ EL DINERO NO PIERDE CENTAVOS ════════════ */

test("sumar_dinero_no_arrastra_el_error_del_punto_flotante", () => {
  // 0.1 + 0.2 en punto flotante da 0.30000000000000004.
  assert.equal(sumarDinero(0.1, 0.2), 0.3);
  assert.notEqual(0.1 + 0.2, 0.3); // así se comporta sin el helper
  // Cien pagos de $19.99 tienen que dar exactamente $1,999.00
  assert.equal(sumarDinero(Array(100).fill(19.99)), 1999);
});

test("precio_por_cajas_cuadra_al_centavo", () => {
  // Precio de $118.35 por caja × 1,250 cajas de la corrida.
  assert.equal(multiplicarDinero(118.35, 1250), 147937.5);
  // Destajo: $0.85 el kilo × 3,347 kilos.
  assert.equal(multiplicarDinero(0.85, 3347), 2844.95);
});

test("un_reparto_suma_exactamente_el_total_repartido", () => {
  // El caso que no cuadra si cada parte se redondea por su cuenta:
  // $100 entre tres partes iguales da 33.33 + 33.33 + 33.33 = 99.99.
  const tres = repartirDinero(100, [1, 1, 1]);
  assert.equal(sumarDinero(tres), 100);
  assert.deepEqual(tres, [33.33, 33.33, 33.34]); // el resto va a la última

  // Y con pesos desiguales, como el costo entre cultivos.
  const desigual = repartirDinero(1000, [7, 11, 13]);
  assert.equal(sumarDinero(desigual), 1000);
});

test("un_reparto_sin_pesos_no_desaparece_el_dinero", () => {
  // Si nadie tiene peso (todas las horas en cero), el dinero no se evapora.
  const r = repartirDinero(500, [0, 0]);
  assert.equal(sumarDinero(r), 500);
  assert.deepEqual(repartirDinero(500, []), []);
});

test("los_centavos_se_ven_en_pantalla_cuando_los_hay", () => {
  // Un descuadre de centavos tiene que verse. Un monto redondo no
  // ensucia la pantalla con ".00".
  assert.equal(fmt(12400).replace(/ /g, " "), "$12,400");
  assert.equal(fmt(12400.03).replace(/ /g, " "), "$12,400.03");
});

test("a_centavos_aguanta_lo_que_venga_de_un_formulario", () => {
  assert.equal(aCentavos("1250.55"), 125055);
  assert.equal(aCentavos(""), 0);
  assert.equal(aCentavos(null), 0);
  assert.equal(aCentavos("no es un número"), 0);
  assert.equal(aPesos(125055), 1250.55);
});

/* ════════════ EL RELOJ CON HUSO ════════════ */

test("el_panel_del_dueno_no_cambia_de_mes_a_las_seis_de_la_tarde", () => {
  // 30 de septiembre, 7 de la noche en el rancho. toISOString() ya dice
  // octubre porque Zacatecas va seis horas atrás de UTC, y el panel
  // empezaba a sumar los gastos de un mes que apenas iba a empezar.
  const treintaDeSeptiemreEnLaNoche = new Date(2026, 8, 30, 19, 0);
  assert.equal(mesLocal(treintaDeSeptiemreEnLaNoche), "2026-09");
  assert.equal(fechaLocal(treintaDeSeptiemreEnLaNoche), "2026-09-30");
  // Y el último minuto del año sigue siendo diciembre.
  assert.equal(mesLocal(new Date(2026, 11, 31, 23, 59)), "2026-12");
});

test("la_semana_del_resumen_siempre_dura_siete_dias", () => {
  // A partir de las 7 de la noche la semana encogía a 6 días.
  assert.equal(sumarDias("2026-09-08", -7), "2026-09-01");
  assert.equal(diasEntre("2026-09-01", "2026-09-08"), 7);
});

test("sumar_dias_respeta_fin_de_mes_y_ano_bisiesto", () => {
  assert.equal(sumarDias("2026-01-31", 1), "2026-02-01");
  assert.equal(sumarDias("2024-02-28", 1), "2024-02-29"); // 2024 fue bisiesto
  assert.equal(sumarDias("2026-02-28", 1), "2026-03-01"); // 2026 no lo es
  assert.equal(sumarDias("2026-03-01", 120), "2026-06-29"); // cosecha estimada
  assert.equal(sumarDias("2026-01-01", -1), "2025-12-31");
});

test("el_mes_anterior_a_enero_es_diciembre_del_ano_pasado", () => {
  assert.equal(mesAnterior("2026-01"), "2025-12");
  assert.equal(mesAnterior("2026-09"), "2026-08");
});

/* ════════════ LOS CRÉDITOS SABEN CUÁNDO VENCEN ════════════ */

test("un_credito_sin_fecha_de_vencimiento_no_se_disfraza_de_vigente", () => {
  // Un saldo sin fecha no es una deuda, es un número. No puede caer en
  // "por vencer", porque eso lo pintaría de tranquilo sin haberlo mirado.
  assert.equal(cubetaVencimiento({ monto: 50000 }, "2026-09-08"), "sin fecha");
  assert.equal(diasParaVencer({ monto: 50000 }, "2026-09-08"), null);
});

test("el_fertilizante_a_noventa_dias_cae_en_su_cubeta", () => {
  const hoy = "2026-09-08";
  assert.equal(cubetaVencimiento({ vencimiento: "2026-09-20" }, hoy), "por vencer");
  assert.equal(cubetaVencimiento({ vencimiento: "2026-09-08" }, hoy), "por vencer"); // vence hoy
  assert.equal(cubetaVencimiento({ vencimiento: "2026-09-07" }, hoy), "1-30");
  assert.equal(cubetaVencimiento({ vencimiento: "2026-08-09" }, hoy), "1-30");
  assert.equal(cubetaVencimiento({ vencimiento: "2026-08-08" }, hoy), "31-60");
  assert.equal(cubetaVencimiento({ vencimiento: "2026-07-09" }, hoy), "61-90");
  assert.equal(cubetaVencimiento({ vencimiento: "2026-06-09" }, hoy), "+90");
});

test("el_saldo_del_credito_cuadra_con_sus_abonos", () => {
  const cr = { monto: 85000, abonos: [{ monto: 30000 }, { monto: 12500.55 }] };
  const { abonado, saldo } = saldoCredito(cr);
  assert.equal(abonado, 42500.55);
  assert.equal(saldo, 42499.45);
  assert.equal(sumarDinero(abonado, saldo), 85000);
  // Sin abonos, el saldo es el monto completo.
  assert.equal(saldoCredito({ monto: 1000 }).saldo, 1000);
});

/* ════════════ LO CAPTURADO SIN SEÑAL NO SE BORRA DE LA PANTALLA ════════════ */

test("la_correccion_hecha_sin_senal_no_la_pisa_la_nube", () => {
  // Migue corrige una estiba de 50 a 48 cajas sin señal. Al volver el
  // internet, lo suyo es más reciente y tiene que quedarse en la pantalla.
  const local = { id: "e1", cajas: 48, _actualizado: "2026-09-08T18:00:00.000Z" };
  const nube = { id: "e1", cajas: 50, _actualizado: "2026-09-08T14:00:00.000Z" };
  assert.equal(ganaAlSincronizar(local, nube).cajas, 48);
});

test("en_un_empate_gana_lo_que_la_persona_acaba_de_tocar", () => {
  const mismaHora = "2026-09-08T18:00:00.000Z";
  const local = { id: "e1", cajas: 48, _actualizado: mismaHora };
  const nube = { id: "e1", cajas: 50, _actualizado: mismaHora };
  assert.equal(ganaAlSincronizar(local, nube).cajas, 48);
});

test("si_la_nube_trae_algo_mas_nuevo_esa_gana", () => {
  // Lo corrigió alguien más desde otro teléfono, después.
  const local = { id: "e1", cajas: 48, _actualizado: "2026-09-08T14:00:00.000Z" };
  const nube = { id: "e1", cajas: 45, _actualizado: "2026-09-08T18:00:00.000Z" };
  assert.equal(ganaAlSincronizar(local, nube).cajas, 45);
});

test("un_registro_que_solo_existe_de_un_lado_se_conserva", () => {
  const soloLocal = { id: "e9", cajas: 12 };
  const soloNube = { id: "e8", cajas: 30 };
  assert.equal(ganaAlSincronizar(soloLocal, null), soloLocal);
  assert.equal(ganaAlSincronizar(null, soloNube), soloNube);
});

/* ════════════ NADA DE DINERO SE BORRA ════════════ */

test("cancelar_deja_el_registro_con_motivo_y_con_quien", () => {
  const egreso = { id: "e1", monto: 30000, concepto: "Abono a proveedor" };
  const cancelado = marcarCancelado(egreso, {
    motivo: "Se capturó dos veces", quien: "Migue", cuando: "2026-09-08T16:00:00.000Z",
  });
  // El registro sigue ahí, con todo lo que decía.
  assert.equal(cancelado.id, "e1");
  assert.equal(cancelado.monto, 30000);
  assert.equal(cancelado.concepto, "Abono a proveedor");
  // Y ahora dice quién, cuándo y por qué.
  assert.equal(cancelado.cancelado, true);
  assert.equal(cancelado.motivoCancelacion, "Se capturó dos veces");
  assert.equal(cancelado.canceladoPor, "Migue");
  assert.equal(cancelado.canceladoEn, "2026-09-08T16:00:00.000Z");
  // Y no le pega al original.
  assert.equal(egreso.cancelado, undefined);
});

test("lo_cancelado_no_entra_en_los_totales", () => {
  const egresos = [
    { id: "e1", monto: 1000 },
    { id: "e2", monto: 30000, cancelado: true },
    { id: "e3", monto: 500 },
  ];
  assert.equal(vivos(egresos).length, 2);
  assert.equal(sumarDinero(vivos(egresos).map(e => e.monto)), 1500);
  // Pero el registro cancelado sigue existiendo para poder verlo.
  assert.equal(egresos.length, 3);
  assert.equal(estaCancelado(egresos[1]), true);
  assert.equal(estaCancelado(egresos[0]), false);
});

/* ════════════ EL SUELDO DEL DÍA CUADRA ════════════ */

test("el_sueldo_del_dia_se_reparte_completo_entre_las_parcelas", () => {
  // El caso del comentario: 4h en R01 y 4h en R02, sueldo de $400.
  const acts = [
    { id: "a1", fecha: "2026-09-08", parcelaId: "R01", horas: 4, trabajadorId: "t1" },
    { id: "a2", fecha: "2026-09-08", parcelaId: "R02", horas: 4, trabajadorId: "t1" },
  ];
  const trab = [{ id: "t1", nombre: "Juan", sueldo_dia: 400 }];
  const { costoPorParcela } = calcularCostoManoObra(acts, trab);
  assert.equal(costoPorParcela.R01, 200);
  assert.equal(costoPorParcela.R02, 200);
});

test("un_sueldo_que_no_se_divide_exacto_no_pierde_centavos", () => {
  // $400 entre tres bloques de 1 hora: 133.33 + 133.33 + 133.34 = 400.00
  const acts = ["R01", "R02", "R03"].map((p, i) => (
    { id: `a${i}`, fecha: "2026-09-08", parcelaId: p, horas: 1, trabajadorId: "t1" }
  ));
  const trab = [{ id: "t1", nombre: "Juan", sueldo_dia: 400 }];
  const { costoPorParcela } = calcularCostoManoObra(acts, trab);
  assert.equal(sumarDinero(Object.values(costoPorParcela)), 400);
});

test("un_solo_bloque_del_dia_carga_el_sueldo_completo", () => {
  // Trabajó 4h nada más ese día: la parcela recibe los $400 enteros.
  const acts = [{ id: "a1", fecha: "2026-09-08", parcelaId: "R01", horas: 4, trabajadorId: "t1" }];
  const trab = [{ id: "t1", nombre: "Juan", sueldo_dia: 400 }];
  assert.equal(calcularCostoManoObra(acts, trab).costoPorParcela.R01, 400);
});

test("lo_que_captura_el_admin_no_le_carga_sueldo_a_la_parcela", () => {
  const acts = [
    { id: "a1", fecha: "2026-09-08", parcelaId: "R01", horas: 8, registradoPor: { id: "t1", rol: "admin" } },
    { id: "a2", fecha: "2026-09-08", parcelaId: "R01", horas: 8, registradoPor: { id: "t1", rol: "dueno" } },
  ];
  const trab = [{ id: "t1", nombre: "Juan", sueldo_dia: 400 }];
  assert.deepEqual(calcularCostoManoObra(acts, trab).costoPorParcela, {});
});

test("las_horas_de_bodega_se_cargan_al_cultivo_no_a_una_parcela", () => {
  const acts = [{ id: "a1", fecha: "2026-09-08", esBodega: true, cultivoBodega: "Ajo", horas: 8, trabajadorId: "t1" }];
  const trab = [{ id: "t1", nombre: "Juan", sueldo_dia: 400 }];
  assert.equal(calcularCostoManoObra(acts, trab).costoPorParcela["bodega:Ajo"], 400);
});

/* ════════════ COSECHA, TELÉFONO Y DISTANCIA ════════════ */

test("el_total_de_cosecha_incluye_los_ajustes", () => {
  const cos = { registros: [{ cantidad: 100 }, { cantidad: "250" }], ajustes: [{ delta: -30 }] };
  assert.equal(totalCosecha(cos), 320);
  assert.equal(totalCosecha(null), 0);
  assert.equal(totalCosecha({}), 0);
});

test("el_telefono_del_rancho_sale_con_lada_de_mexico", () => {
  assert.equal(formatearTelefonoMX("492 123 4567"), "524921234567");
  assert.equal(formatearTelefonoMX("(492) 123-45-67"), "524921234567");
  assert.equal(formatearTelefonoMX("524921234567"), "524921234567");
  assert.equal(formatearTelefonoMX(""), "");
  assert.equal(formatearTelefonoMX(null), "");
});

test("la_distancia_entre_zacatecas_y_aguascalientes_es_la_de_la_carretera_en_linea_recta", () => {
  // Zacatecas (22.77, -102.58) → Aguascalientes (21.88, -102.29): ~102 km en línea recta.
  const d = distKm(22.7709, -102.5832, 21.8853, -102.2916);
  assert.ok(d > 95 && d < 110, `dio ${d} km`);
  assert.equal(distKm(22.77, -102.58, 22.77, -102.58), 0);
});
