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
  formatearTelefonoMX, totalCosecha, calcularCostoManoObra, sellarSueldoDelDia, distKm,
  sueldoVigente, anotarCambioDeSueldo, remuneracionDevengada, distribuirCosto,
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

/* ════════════ EL COSTO PASADO NO SE MUEVE ════════════ */

test("subirle_el_sueldo_a_alguien_no_reescribe_lo_que_costaron_los_meses_pasados", () => {
  const catalogo = [{ id: "t1", nombre: "PRUEBA UNO", sueldo_dia: 400 }];
  const act = sellarSueldoDelDia({ id: "a1", fecha: "2026-03-10", parcelaId: "R01", horas: 8, trabajadorId: "t1" }, catalogo);
  assert.equal(calcularCostoManoObra([act], catalogo).costoPorParcela.R01, 400);
  // En agosto se le sube a $500. Marzo sigue costando $400.
  const despues = [{ id: "t1", nombre: "PRUEBA UNO", sueldo_dia: 500 }];
  assert.equal(calcularCostoManoObra([act], despues).costoPorParcela.R01, 400);
  // Y lo que se capture desde hoy sí va con el sueldo nuevo.
  const hoy = sellarSueldoDelDia({ id: "a2", fecha: "2026-08-10", parcelaId: "R01", horas: 8, trabajadorId: "t1" }, despues);
  assert.equal(calcularCostoManoObra([act, hoy], despues).costoPorParcela.R01, 900);
});

test("dar_de_baja_a_un_trabajador_no_borra_lo_que_ya_costo", () => {
  const catalogo = [{ id: "t1", nombre: "PRUEBA UNO", sueldo_dia: 400 }];
  const act = sellarSueldoDelDia({ id: "a1", fecha: "2026-03-10", parcelaId: "R01", horas: 8, trabajadorId: "t1" }, catalogo);
  const r = calcularCostoManoObra([act], []); // ya no está en el catálogo
  assert.equal(r.costoPorParcela.R01, 400);
  assert.equal(r.desglosePorParcela.R01[0].trabajadorNombre, "PRUEBA UNO");
  assert.deepEqual(r.sinSueldo, []);
});

test("un_dia_viejo_de_alguien_que_ya_no_esta_no_desaparece_callado_se_avisa", () => {
  // Registro anterior a la foto del sueldo, y la persona ya fue borrada.
  const viejo = { id: "a1", fecha: "2025-11-03", parcelaId: "R01", horas: 8, trabajadorId: "t9" };
  const r = calcularCostoManoObra([viejo], []);
  assert.deepEqual(r.costoPorParcela, {}); // no se inventa un costo...
  assert.deepEqual(r.sinSueldo, [{ trabajadorId: "t9", fecha: "2025-11-03", horas: 8, actividades: ["a1"] }]); // ...pero se dice
});

test("lo_que_captura_una_cuadrilla_no_sale_como_sueldo_faltante", () => {
  const act = { id: "a1", fecha: "2026-03-10", parcelaId: "R01", horas: 8, registradoPor: { id: "cq1", tipo: "cuadrilla" } };
  assert.deepEqual(calcularCostoManoObra([act], []).sinSueldo, []);
});

test("la_foto_del_sueldo_no_se_pisa_ni_se_inventa", () => {
  const cat = [{ id: "t1", nombre: "PRUEBA UNO", sueldo_dia: 400 }];
  assert.equal(sellarSueldoDelDia({ trabajadorId: "t1", sueldoDia: 350 }, cat).sueldoDia, 350);
  assert.equal(sellarSueldoDelDia({ trabajadorId: "nadie" }, cat).sueldoDia, undefined);
  assert.equal(sellarSueldoDelDia({ registradoPor: { id: "t1" } }, cat).sueldoDia, 400);
});

/* ════════════ EL SUELDO DE CADA FECHA, CON SU EVIDENCIA ════════════ */

test("un_sueldo_viejo_nunca_se_escribe_con_el_valor_de_hoy_como_si_fuera_un_hecho", () => {
  // Registro anterior a la foto, sin historial: se calcula con el de hoy, PERO marcado.
  const viejo = { id: "a1", fecha: "2025-11-03", parcelaId: "R01", horas: 8, trabajadorId: "t1" };
  const r = calcularCostoManoObra([viejo], [{ id: "t1", nombre: "PRUEBA UNO", sueldo_dia: 500 }]);
  assert.equal(r.costoPorParcela.R01, 500);
  assert.equal(r.desglosePorParcela.R01[0].origenSueldo, "catalogo_actual");
  assert.equal(r.desglosePorParcela.R01[0].estimado, true);
  assert.deepEqual(r.estimados, ["a1"]);
});

test("al_cambiar_un_sueldo_queda_anotado_desde_cuando_y_cuanto_ganaba_antes", () => {
  const antes = { id: "t1", nombre: "PRUEBA UNO", sueldo_dia: 400 };
  const despues = anotarCambioDeSueldo(antes, { ...antes, sueldo_dia: 500 }, "2026-08-01");
  assert.deepEqual(despues.historialSueldo, [{ desde: "2026-08-01", sueldo_dia: 500, anterior: 400 }]);
  // sin cambio de sueldo no se anota nada
  assert.equal(anotarCambioDeSueldo(antes, { ...antes, nombre: "OTRO" }, "2026-08-01").historialSueldo, undefined);
  // una corrección el mismo día no deja dos renglones, y conserva el "antes" verdadero
  const corr = anotarCambioDeSueldo(despues, { ...despues, sueldo_dia: 520 }, "2026-08-01");
  assert.deepEqual(corr.historialSueldo, [{ desde: "2026-08-01", sueldo_dia: 520, anterior: 400 }]);
});

test("cada_fecha_usa_el_sueldo_que_consta_para_esa_fecha", () => {
  const t = { id: "t1", sueldo_dia: 600, historialSueldo: [
    { desde: "2026-08-01", sueldo_dia: 500, anterior: 400 }, { desde: "2026-10-01", sueldo_dia: 600, anterior: 500 }] };
  assert.deepEqual(sueldoVigente(t, "2026-09-15"), { sueldo: 500, origen: "historial", estimado: false });
  assert.deepEqual(sueldoVigente(t, "2026-11-01"), { sueldo: 600, origen: "historial", estimado: false });
  // antes del primer cambio: consta que ganaba 400, no desde cuándo → estimado
  assert.deepEqual(sueldoVigente(t, "2026-03-10"), { sueldo: 400, origen: "anterior_conocido", estimado: true });
  // y el costo de marzo sale con 400, no con los 600 de hoy
  const marzo = { id: "a1", fecha: "2026-03-10", parcelaId: "R01", horas: 8, trabajadorId: "t1" };
  assert.equal(calcularCostoManoObra([marzo], [t]).costoPorParcela.R01, 400);
});

/* ════════════ DEVENGADO Y DISTRIBUCIÓN, POR SEPARADO ════════════ */

test("lo_que_se_reparte_a_las_parcelas_suma_exactamente_lo_devengado", () => {
  const trab = [{ id: "t1", nombre: "PRUEBA UNO", sueldo_dia: 400 }, { id: "t2", nombre: "PRUEBA DOS", sueldo_dia: 350 }];
  const acts = [
    { id: "a1", fecha: "2026-09-08", parcelaId: "R01", tipo: "riego", horas: 3, trabajadorId: "t1", sueldoDia: 400 },
    { id: "a2", fecha: "2026-09-08", parcelaId: "R02", tipo: "deshierbe", horas: 3, trabajadorId: "t1", sueldoDia: 400 },
    { id: "a3", fecha: "2026-09-08", parcelaId: "R03", tipo: "deshierbe", horas: 1, trabajadorId: "t1", sueldoDia: 400 },
    { id: "a4", fecha: "2026-09-08", parcelaId: "R01", tipo: "corte", modalidad: "destajo", tarifa: 12.5, unidades: 37, trabajadorId: "t2" },
  ];
  const dev = remuneracionDevengada(acts, trab);
  const d = distribuirCosto(dev);
  assert.equal(dev.find(x => x.trabajadorId === "t1").monto, 400);
  assert.equal(dev.find(x => x.trabajadorId === "t2").monto, 462.5);
  assert.equal(d.total, 862.5);
  assert.equal(sumarDinero(Object.values(d.porParcela)), d.total);
  assert.equal(sumarDinero(Object.values(d.porActividad)), d.total);
  assert.deepEqual(d.porModalidad, { dia: 400, destajo: 462.5 });
  assert.equal(d.estimado, 0);
});

test("por_dia_por_hora_y_a_destajo_son_tres_cuentas_distintas", () => {
  const act = { id: "a1", fecha: "2026-09-08", parcelaId: "R01", horas: 2, trabajadorId: "t1", sueldoDia: 400 };
  // por día (la de siempre): 2 horas devengan el día completo
  assert.equal(remuneracionDevengada([act], [{ id: "t1", sueldo_dia: 400 }])[0].monto, 400);
  // por hora: 2 de 8 horas
  const porHora = remuneracionDevengada([act], [{ id: "t1", sueldo_dia: 400, modalidadPago: "hora" }])[0];
  assert.equal(porHora.monto, 100); assert.equal(porHora.partes[0].modalidad, "hora");
  // a destajo: tarifa por unidades, sin importar las horas
  const dest = remuneracionDevengada([{ ...act, modalidad: "destajo", tarifa: 3, unidades: 50 }], [{ id: "t1", sueldo_dia: 400 }])[0];
  assert.equal(dest.monto, 150);
});

test("lo_estimado_se_ensena_aparte_del_total_y_lo_cancelado_no_cuenta", () => {
  const trab = [{ id: "t1", sueldo_dia: 500 }];
  const acts = [
    { id: "a1", fecha: "2026-09-08", parcelaId: "R01", horas: 8, trabajadorId: "t1", sueldoDia: 400 },  // con foto
    { id: "a2", fecha: "2025-09-08", parcelaId: "R01", horas: 8, trabajadorId: "t1" },                  // viejo, sin foto
    { id: "a3", fecha: "2026-09-09", parcelaId: "R01", horas: 8, trabajadorId: "t1", sueldoDia: 400, cancelado: { motivo: "duplicado" } },
  ];
  const d = distribuirCosto(remuneracionDevengada(acts, trab));
  assert.equal(d.total, 900); assert.equal(d.estimado, 500);
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

// ── El sueldo del alta vale desde el día del alta (cierre de la versión 1.0) ──
import { sueldoDeAlta as sueldoDeAlta_ } from "./calculos.js";
test("el_sueldo_con_que_se_da_de_alta_a_alguien_no_sale_como_estimado", () => {
  const nueva = sueldoDeAlta_({ id: "t9", nombre: "PERSONA INVENTADA", sueldo_dia: 350 }, "2026-11-23");
  assert.deepEqual(nueva.historialSueldo, [{ desde: "2026-11-23", sueldo_dia: 350, anterior: 350 }]);
  assert.deepEqual(sueldoVigente(nueva, "2026-11-23"), { sueldo: 350, origen: "historial", estimado: false });
  // lo anterior al alta sigue siendo una estimación: no se inventa desde cuándo ganaba eso
  assert.equal(sueldoVigente(nueva, "2026-11-01").estimado, true);
  // quien ya trae historial, o no trae sueldo, se queda como venía
  const con = { id: "t8", sueldo_dia: 400, historialSueldo: [{ desde: "2026-01-01", sueldo_dia: 400, anterior: 380 }] };
  assert.equal(sueldoDeAlta_(con, "2026-11-23"), con);
  assert.equal(sueldoDeAlta_({ id: "t7", sueldo_dia: 0 }, "2026-11-23").historialSueldo, undefined);
});

import { unico } from "./calculos.js";
test("dos_registros_capturados_en_la_misma_milesima_no_comparten_identificador", () => {
  const real = Date.now; Date.now = () => 1763500000000;
  try { const vistos = new Set(Array.from({ length: 5000 }, () => `eg${unico()}`)); assert.equal(vistos.size, 5000); assert.match([...vistos][0], /^eg1763500000000[a-z0-9]{7}$/); }
  finally { Date.now = real; }
});

import { conAutor } from "./calculos.js";
test("un_gasto_tecleado_en_finanzas_queda_con_quien_lo_capturo_y_no_se_le_cambia_el_autor_al_que_ya_lo_trae", () => {
  const sesion = { role: "admin", id: "u1", nombre: "Luis" };
  assert.deepEqual(conAutor("egresos", { id: "e1", monto: 700 }, sesion).registradoPor, { rol: "admin", id: "u1", nombre: "Luis" });
  assert.equal(conAutor("egresos", { id: "e1", registradoPor: { nombre: "Ana" } }, sesion).registradoPor.nombre, "Ana");
  assert.equal(conAutor("parcelas", { id: "p1" }, sesion).registradoPor, undefined, "un catálogo no lo necesita");
  assert.equal(conAutor("egresos", { id: "e1" }, null).registradoPor, undefined, "sin sesión no se inventa un autor");
});

import { unirEmbarque, leFaltanCobros } from "./calculos.js";
test("dos_telefonos_cobrando_parte_del_mismo_embarque_no_se_pisan", () => {
  const base = { id: "emb1", folio: "E-1", estadoCobro: "pendiente", liquidaciones: [], montoCobrado: 0 };
  const a = { ...base, liquidaciones: [{ id: "liqA", fecha: "2026-11-19", monto: 3000 }], montoCobrado: 3000 };
  const b = { ...base, liquidaciones: [{ id: "liqB", fecha: "2026-11-19", monto: 2000 }], montoCobrado: 2000 };
  const u = unirEmbarque(a, b);
  assert.deepEqual(u.liquidaciones.map(l => l.id), ["liqA", "liqB"]); assert.equal(u.montoCobrado, 5000); assert.equal(u.estadoCobro, "pendiente");
  assert.deepEqual(unirEmbarque(b, a).liquidaciones.map(l => l.id), ["liqA", "liqB"], "da igual cuál llegue primero");
  assert.equal(unirEmbarque(u, a).montoCobrado, 5000, "unir otra vez no duplica");
  assert.equal(leFaltanCobros(a, u), true); assert.equal(leFaltanCobros(u, a), false);
  assert.equal(unirEmbarque(a, { ...b, estadoCobro: "cobrado" }).estadoCobro, "cobrado", "si uno lo dio por cobrado, queda cobrado");
  assert.deepEqual(unirEmbarque(base, { ...base, placas: "X" }), base, "sin cobros no hay nada que unir: gana el más reciente, como siempre");
});

import { conNacimiento, conservarNacimiento, esIdentificadorOcupado } from "./calculos.js";
test("un_registro_capturado_nace_con_su_marca_y_no_la_pierde_al_corregirlo", () => {
  const g = conNacimiento({ id: "eg1763500000000ab12cd3", monto: 700 }, () => "m1");
  assert.equal(g._nace, "m1");
  assert.equal(conNacimiento(g, () => "m2")._nace, "m1", "la marca se pone una sola vez");
  assert.equal(conNacimiento({ id: "ev-pagoperson-mwo1jkid-gd9cpwo" }, () => "m3")._nace, "m3", "un evento capturado también");
  for (const id of ["eg-sol-s1-0", "alm_entrada-compra-co1-0", "unico", "eg-cc1", "p1"]) assert.equal(conNacimiento({ id }, () => "x")._nace, undefined, `${id}: nombre propio, sin marca`);
  assert.equal(conservarNacimiento({ id: "a", monto: 1 }, { id: "a", _nace: "m1" })._nace, "m1");
  assert.equal(conservarNacimiento({ id: "a", _nace: "m9" }, { id: "a", _nace: "m1" })._nace, "m9", "no inventa: si trae otra, la base decide");
  assert.equal(esIdentificadorOcupado({ message: 'identificador_ocupado: ya existe otro registro con el identificador "x" en egresos.' }), true);
  assert.equal(esIdentificadorOcupado({ message: "permission denied" }), false);
});

import { revisarCultivo } from "./calculos.js";
test("un_cultivo_se_da_de_alta_desde_la_app_con_nombre_y_duracion_y_no_se_repite", () => {
  assert.equal(revisarCultivo({ nombre: " ", duracionDias: 240 }).ok, false);
  assert.match(revisarCultivo({ nombre: "Ajo" }).dice, /cuántos días/);
  assert.equal(revisarCultivo({ nombre: "Ajo", duracionDias: 5 }).ok, false);
  const r = revisarCultivo({ nombre: "  Ajo  morado ", duracionDias: 240, unidadCosecha: "caja" });
  assert.equal(r.ok, true); assert.equal(r.cultivo.id, "cul_ajo_morado"); assert.equal(r.cultivo.nombre, "Ajo morado"); assert.equal(r.cultivo.unidadCosecha, "caja");
  assert.deepEqual(r.cultivo.fenologia, [], "sin etapas inventadas: se dejan vacías");
  assert.match(revisarCultivo({ nombre: "AJO MORADO", duracionDias: 240 }, [r.cultivo]).dice, /Ya está dado de alta/);
  assert.match(revisarCultivo({ nombre: "Maíz", duracionDias: 150 }, [{ nombre: "maiz" }]).dice, /Ya está/, "con o sin acento es el mismo");
  assert.equal(revisarCultivo({ nombre: "Maíz", duracionDias: 150 }).cultivo.id, "cul_maiz", "el mismo cultivo desde dos teléfonos lleva el mismo identificador");
});

import { revisarRancho, revisarParcela, usoDeParcela } from "./calculos.js";
test("una_parcela_no_nace_sin_rancho_sin_nombre_ni_repetida_y_dice_que_falta", () => {
  assert.match(revisarRancho({ nombre: "", hectareas: 10 }).dice, /nombre/);
  assert.match(revisarRancho({ nombre: "San Felipe", hectareas: 10 }, [{ id: "r1", nombre: "san felipe" }]).dice, /Ya hay/);
  assert.equal(revisarRancho({ id: "r1", nombre: "San Felipe", hectareas: 10 }, [{ id: "r1", nombre: "San Felipe" }]).ok, true, "editarse a sí mismo no es repetirse");
  const R = [{ id: "r1", nombre: "A" }, { id: "r2", nombre: "B" }];
  assert.match(revisarParcela({ nombre: "P1", cultivo: "Ajo", hectareas: 2 }, [], []).dice, /Primero da de alta un rancho/);
  assert.match(revisarParcela({ nombre: " ", cultivo: "Ajo", hectareas: 2 }, [], R).dice, /nombre/);
  assert.match(revisarParcela({ nombre: "P1", cultivo: "", hectareas: 2 }, [], R).dice, /cultivo/);
  assert.match(revisarParcela({ nombre: "P1", cultivo: "Ajo", hectareas: 0 }, [], R).dice, /hectáreas/);
  assert.equal(revisarParcela({ nombre: "P1", cultivo: "Ajo", hectareas: 2, ranchoId: "" }, [], R).ranchoId, "r1", "sin rancho escogido toma el que la pantalla enseña (el primero), nunca vacío");
  assert.match(revisarParcela({ nombre: "p1", cultivo: "Ajo", hectareas: 2, ranchoId: "r1" }, [{ id: "x", nombre: "P1", ranchoId: "r1" }], R).dice, /ya hay una parcela/);
  assert.equal(revisarParcela({ nombre: "P1", cultivo: "Ajo", hectareas: 2, ranchoId: "r2" }, [{ id: "x", nombre: "P1", ranchoId: "r1" }], R).ok, true, "el mismo nombre en otro rancho sí");
});
test("una_parcela_con_algo_registrado_no_se_elimina", () => {
  assert.equal(usoDeParcela({ parcelas: [{ id: "p1" }] }, "p1").usada, false);
  const u = usoDeParcela({ actividades: [{ parcelaId: "p1" }, { parcelaId: "p2" }], egresos: [{ parcelaId: "p1" }], eventos: [{ datos: { parcelaId: "p1" } }] }, "p1");
  assert.equal(u.usada, true); assert.match(u.dice, /1 actividades, 1 gastos, 1 registros de trabajo/);
});

test("un_hecho_de_nombre_propio_no_lleva_marca_aunque_traiga_dentro_el_identificador_de_otra_cosa", () => {
  const sol = "s1763500000000ab12cd3", mov = "c1763500000000zz99yy8412", compra = "co1763500000000qq11ww2";
  for (const id of [`eg-sol-${sol}-0`, `ei-sol-${sol}-0`, `inv-sol-${sol}-0`, `alm_entrada-solicitud-${sol}-0`, `eg-${mov}`, `alm_entrada-compra-${compra}-1`, "cul_ajo"])
    assert.equal(conNacimiento({ id }, () => "x")._nace, undefined, `${id}: es el mismo hecho en todos los teléfonos`);
  for (const id of [sol, mov, compra, "var_cul_ajo_1763500000000ab12cd3", "eg1763500000000ab12cd3", "cr1763500000000ab12cd3999"])
    assert.equal(conNacimiento({ id }, () => "x")._nace, "x", `${id}: hecho al momento, lleva marca`);
});

import { unirCosecha, leFaltaCosecha, idDeCosecha, UNIONES_DE_REGISTROS as UNIONES_C } from "./calculos.js";
test("lo_cosechado_que_anotan_dos_telefonos_en_la_misma_parcela_se_une_y_no_se_pisa", () => {
  const base = { id: idDeCosecha("p1"), parcelaId: "p1", unidad: "kg", registros: [{ id: "a", fecha: "2026-11-18", cantidad: 100 }], ajustes: [] };
  const uno = { ...base, registros: [...base.registros, { id: "b", fecha: "2026-11-19", cantidad: 250 }] };
  const otro = { ...base, registros: [...base.registros, { id: "c", fecha: "2026-11-19", cantidad: 400 }], ajustes: [{ id: "j", fecha: "2026-11-19", delta: -20, motivo: "merma" }] };
  const u = unirCosecha(uno, otro);
  assert.deepEqual(u.registros.map(r => r.id), ["a", "b", "c"]); assert.equal(u.registros.reduce((n, r) => n + r.cantidad, 0), 750);
  assert.deepEqual(u.ajustes.map(r => r.id), ["j"]);
  assert.deepEqual(unirCosecha(otro, uno).registros.map(r => r.id), ["a", "b", "c"], "da lo mismo quién gane");
  assert.equal(leFaltaCosecha(uno, u), true); assert.equal(leFaltaCosecha(u, uno), false);
  assert.equal(UNIONES_C.cosechas.unir, unirCosecha);
  assert.equal(idDeCosecha("p1763500000000ab12cd3"), "cos-p1763500000000ab12cd3");
  assert.equal(conNacimiento({ id: idDeCosecha("p1763500000000ab12cd3") }, () => "x")._nace, undefined, "es LA cosecha de esa parcela en todos los teléfonos");
});

import { registrosVivos, cancelarRegistroDeCosecha, totalCosecha as totalCos } from "./calculos.js";
test("un_registro_de_cosecha_se_cancela_con_motivo_deja_de_contar_y_no_revive_al_sincronizar", () => {
  const cos = { id: "cos-p1", parcelaId: "p1", registros: [{ id: "a", fecha: "2026-11-18", cantidad: 100 }, { id: "b", fecha: "2026-11-19", cantidad: 250 }], ajustes: [] };
  assert.equal(cancelarRegistroDeCosecha(cos, "b", { motivo: "  ", quien: "Luis", cuando: "x" }).ok, false, "sin motivo no");
  const r = cancelarRegistroDeCosecha(cos, "b", { motivo: "se anotó dos veces", quien: "Luis", cuando: "2026-11-19T20:00:00Z" });
  assert.equal(r.ok, true); assert.equal(r.cosecha.registros.length, 2, "el registro se queda");
  assert.equal(totalCos(r.cosecha), 100); assert.deepEqual(registrosVivos(r.cosecha).map(x => x.id), ["a"]);
  assert.equal(cancelarRegistroDeCosecha(r.cosecha, "b", { motivo: "otra vez", quien: "Luis", cuando: "x" }).ok, false);
  assert.equal(totalCos(unirCosecha(r.cosecha, cos)), 100, "el otro teléfono todavía lo tenía vivo: unir no lo revive");
  assert.equal(totalCos(unirCosecha(cos, r.cosecha)), 100, "gane quien gane");
});

test("del_rancho_quita_lo_cancelado_lo_personal_y_los_traspasos_y_vivos_solo_lo_cancelado", async () => {
  const { delRancho, vivos, esPersonal } = await import("./calculos.js");
  const l = [{ id: 1, monto: 10 }, { id: 2, monto: 20, destino: "personal" }, { id: 3, monto: 30, cancelado: true }, { id: 4, monto: 40, traspasoCon: "x" }, { id: 5, monto: 50, destino: "rancho" }];
  assert.deepEqual(delRancho(l).map(x => x.id), [1, 5]);
  assert.deepEqual(vivos(l).map(x => x.id), [1, 2, 4, 5]);
  assert.equal(esPersonal(l[1]), true); assert.equal(esPersonal(null), false);
});

test("las_etapas_de_un_cultivo_se_capturan_en_la_app_en_orden_sin_encimarse_y_sin_pasar_de_lo_que_dura", async () => {
  const { revisarEtapas } = await import("./calculos.js");
  const bien = revisarEtapas([{ etapa: " Siembra ", diaInicio: "0", diaFin: "20" }, { etapa: "Desarrollo", diaInicio: "20", diaFin: "200" }, { etapa: "Cosecha", diaInicio: "200", diaFin: "240" }], 240);
  assert.equal(bien.ok, true); assert.deepEqual(bien.etapas.map(e => [e.etapa, e.diaInicio, e.diaFin]), [["Siembra", 0, 20], ["Desarrollo", 20, 200], ["Cosecha", 200, 240]]);
  assert.match(revisarEtapas([], 240).dice, /al menos una/);
  assert.match(revisarEtapas([{ etapa: "", diaInicio: 0, diaFin: 10 }]).dice, /no tiene nombre/);
  assert.match(revisarEtapas([{ etapa: "Siembra", diaInicio: 20, diaFin: 10 }]).dice, /termina antes de empezar/);
  assert.match(revisarEtapas([{ etapa: "Siembra", diaInicio: 0, diaFin: 30 }, { etapa: "Desarrollo", diaInicio: 20, diaFin: 90 }]).dice, /se encim|antes de que termine/);
  assert.match(revisarEtapas([{ etapa: "Cosecha", diaInicio: 200, diaFin: 260 }], 240).dice, /dura 240 días/);
  assert.match(revisarEtapas([{ etapa: "Riego", diaInicio: 0, diaFin: 10 }, { etapa: "riego", diaInicio: 10, diaFin: 20 }]).dice, /se repite/);
  assert.match(revisarEtapas([{ etapa: "Siembra", diaInicio: "", diaFin: 10 }]).dice, /faltan sus días/);
});

import { conSueldoSemanal as conSueldoSemanal_s, sueldoVigente as sueldoVigente_s, sumarDinero as sumarDinero_s, sueldoDeAlta as sueldoDeAlta_s, anotarCambioDeSueldo as anotarCambioDeSueldo_s, sellarSueldoDelDia as sellarSueldoDelDia_s } from "./calculos.js";
// Luis, 22 nov: el sueldo por día es el de la semana entre 6. Con 583.33 × 6 la semana salía en 3,499.98.
test("el_sueldo_de_la_semana_entre_seis_suma_exacto_la_semana_y_no_deja_centavos_sueltos", () => {
  const ana = conSueldoSemanal_s({ id: "t1", nombre: "Ana", sueldo_semana: 3500 });
  assert.equal(ana.sueldo_dia, 583.33, "el promedio es su sueldo por día");
  const semana = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"];
  const partes = semana.map(f => sueldoVigente_s(ana, f).sueldo);
  assert.deepEqual(partes, [583.33, 583.33, 583.33, 583.33, 583.33, 583.35], "el centavo que sobra va al último día de su calendario");
  assert.equal(sumarDinero_s(partes), 3500);
  assert.equal(sueldoVigente_s(ana, "2026-11-22").sueldo, 583.33, "un domingo que sí vino vale el promedio");
  assert.equal(sueldoVigente_s(ana, "2026-11-21").promedio, 583.33);
  const cinco = conSueldoSemanal_s({ id: "t2", sueldo_semana: 3500, diasAsistencia: [1, 2, 3, 4, 5] });
  assert.equal(cinco.sueldo_dia, 700); assert.equal(sueldoVigente_s(cinco, "2026-11-21").sueldo, 700, "quien no viene los sábados: su semana entre 5");
  const raro = conSueldoSemanal_s({ id: "t3", sueldo_semana: 4231.6 });
  assert.equal(sumarDinero_s(semana.map(f => sueldoVigente_s(raro, f).sueldo)), 4231.6);
  assert.equal(conSueldoSemanal_s({ id: "t4", sueldo_dia: 350 }).sueldo_dia, 350, "quien cobra por día no cambia");
});

test("el_sueldo_de_la_semana_queda_en_su_historial_desde_el_alta_y_al_cambiarlo", () => {
  const alta = sueldoDeAlta_s(conSueldoSemanal_s({ id: "t1", sueldo_semana: 3500 }), "2026-11-16");
  assert.deepEqual(alta.historialSueldo, [{ desde: "2026-11-16", sueldo_dia: 583.33, anterior: 583.33, sueldo_semana: 3500 }]);
  const sube = anotarCambioDeSueldo_s(alta, conSueldoSemanal_s({ ...alta, sueldo_semana: 3600 }), "2026-12-07");
  assert.equal(sube.historialSueldo.length, 2); assert.equal(sube.historialSueldo[1].sueldo_semana, 3600); assert.equal(sube.historialSueldo[1].sueldo_dia, 600);
  assert.equal(sueldoVigente_s(sube, "2026-11-21").sueldo, 583.35, "noviembre se queda con el sueldo de noviembre");
  assert.equal(sueldoVigente_s(sube, "2026-12-12").sueldo, 600);
  const act = sellarSueldoDelDia_s({ id: "a1", fecha: "2026-11-21", registradoPor: { id: "t1" } }, [alta]);
  assert.equal(act.sueldoDia, 583.35, "la foto de una actividad es la parte de ESE día");
});

import { fichaDeProveedor as fichaDeProveedor_t, esDelProveedor as esDelProveedor_t, nombreDelProveedor as nombreDelProveedor_t } from "./calculos.js";
// Defecto 14: el mismo proveedor salía como dos (texto en Deudas, ficha en Proveedores) y su deuda no se juntaba.
test("un_proveedor_es_una_sola_ficha_en_deudas_y_en_proveedores", () => {
  const provs = [{ id: "pv1", nombre: "Agroquímicos del Norte" }, { id: "pv2", nombre: "Ferretería Inventada" }];
  assert.equal(fichaDeProveedor_t("  agroquimicos   del NORTE ", provs).id, "pv1", "sin acentos ni mayúsculas ni espacios de más");
  assert.equal(fichaDeProveedor_t("Otro", provs), null); assert.equal(fichaDeProveedor_t("", provs), null);
  assert.ok(esDelProveedor_t({ proveedorId: "pv1" }, provs[0]));
  assert.ok(!esDelProveedor_t({ proveedorId: "pv2", proveedor: "Agroquímicos del Norte" }, provs[0]), "si trae ficha, manda la ficha");
  assert.ok(esDelProveedor_t({ proveedor: "AGROQUIMICOS DEL NORTE" }, provs[0]), "una deuda de antes, sólo con el texto, es de la ficha que se llama igual");
  assert.ok(!esDelProveedor_t({ proveedor: "" }, provs[0]));
  assert.equal(nombreDelProveedor_t({ proveedorId: "pv2", proveedor: "viejo" }, provs), "Ferretería Inventada");
  assert.equal(nombreDelProveedor_t({ proveedor: "Sólo texto" }, provs), "Sólo texto");
});

import { revisarMaquina as revisarMaquina_t } from "./calculos.js";
test("una_maquina_no_se_da_de_alta_sin_nombre_ni_dos_veces", () => {
  const maq = [{ id: "m1", nombre: "Tractor Inventado" }];
  assert.equal(revisarMaquina_t({ nombre: "  " }, maq).ok, false);
  assert.equal(revisarMaquina_t({ nombre: "TRACTOR  inventado" }, maq).ok, false, "el mismo nombre con otras mayúsculas o espacios es la misma");
  assert.equal(revisarMaquina_t({ nombre: "Tractor Inventado" }, maq, { propioId: "m1" }).ok, true, "editar la misma no choca consigo");
  assert.equal(revisarMaquina_t({ nombre: "Camioneta", costo_hora: -5 }, maq).ok, false);
  assert.deepEqual(revisarMaquina_t({ nombre: " Camioneta  roja " }, maq), { ok: true, nombre: "Camioneta roja" });
});

import { idDeLote as idDeLote_t, existenciaDeLote as existenciaDeLote_t, unirLote as unirLote_t, juntarLotes as juntarLotes_t, cerrarTarima as cerrarTarima_t, idDeArticuloAparte as idDeArticuloAparte_t, UNIONES_DE_REGISTROS as UNIONES_T } from "./calculos.js";
test("el_ajo_terminado_de_dos_telefonos_sin_senal_no_se_pisa_y_sus_cajas_salen_de_sus_movimientos", () => {
  const clave = "Ajo__7";
  assert.equal(idDeLote_t(clave), "term-ajo__7", "el mismo calibre es el mismo lote en todos los teléfonos");
  const base = { id: idDeLote_t(clave), clave, movimientos: [{ id: "m1", tipo: "entrada", fecha: "2026-11-20", cajas: 30, kg: 300 }] };
  const uno = { ...base, movimientos: [...base.movimientos, { id: "m2", tipo: "salida", fecha: "2026-11-21", cajas: 10, kg: 100 }], cajas: 20 };
  const otro = { ...base, movimientos: [...base.movimientos, { id: "m3", tipo: "entrada", fecha: "2026-11-21", cajas: 5, kg: 50 }], cajas: 35 };
  const u = unirLote_t(uno, otro);
  assert.deepEqual([u.cajas, u.kg], [25, 250], "la salida de uno y la entrada del otro cuentan las dos");
  assert.equal(u.movimientos.length, 3);
  assert.ok(UNIONES_T.terminados.falta(uno, otro), "al bajar se sabe que a este teléfono le falta un movimiento y lo vuelve a subir");
  assert.deepEqual(existenciaDeLote_t({ movimientos: [{ id: "a", tipo: "entrada", cajas: 24 }, { id: "b", tipo: "salida", cajas: 30 }] }).cajas, -6, "salir de más deja el lote en negativo: no se recorta en cero");
  assert.deepEqual(existenciaDeLote_t({ movimientos: [{ id: "a", tipo: "entrada", cajas: 5 }, { id: "b", tipo: "ajuste", cajas: -1 }] }).cajas, 4, "un ajuste trae su diferencia con signo");
  assert.equal(existenciaDeLote_t({ cajas: 12, kg: 3 }).cajas, 12, "un lote sin movimientos se queda con lo que traía");
  const juntos = juntarLotes_t([{ id: "term17630000000000abcdef1", clave, movimientos: [{ id: "x", tipo: "entrada", cajas: 3 }] }, { id: idDeLote_t(clave), clave, movimientos: [{ id: "y", tipo: "entrada", cajas: 4 }] }]);
  assert.equal(juntos.length, 1, "dos lotes repetidos de antes se enseñan como uno");
  assert.deepEqual([juntos[0].id, juntos[0].cajas], [idDeLote_t(clave), 7]);
});
test("cerrar_una_tarima_que_todavia_trae_cajas_pide_el_porque_y_queda_quien", () => {
  const e = { id: "e1", codigo: "AS-L-001", estado: "activa", cajas: 50 };
  assert.equal(cerrarTarima_t(e, { saldo: 12, motivo: "  " }).ok, false, "con cajas y sin porqué no se cierra");
  const r = cerrarTarima_t(e, { saldo: 12, motivo: "SE MERMÓ", quien: { nombre: "ALGUIEN" }, cuando: "2026-11-23T10:00:00Z" });
  assert.equal(r.ok, true);
  assert.deepEqual([r.estiba.estado, r.estiba.saldoAlCerrar, r.estiba.cerradaManual, r.estiba.cerrada.motivo, r.estiba.cerrada.quien.nombre], ["consumida", 12, true, "SE MERMÓ", "ALGUIEN"]);
  assert.equal(cerrarTarima_t(e, { saldo: 0 }).ok, true, "vacía se cierra sin porqué");
  assert.equal(cerrarTarima_t({ ...e, estado: "consumida" }, { saldo: 0 }).ok, false);
});
test("las_categorias_aparte_son_un_articulo_por_categoria_igual_en_todos_los_telefonos", () => {
  assert.equal(idDeArticuloAparte_t("Corona"), "art-ajo-corona");
  assert.equal(idDeArticuloAparte_t("Pata de perro"), "art-ajo-pata-de-perro");
  assert.equal(idDeArticuloAparte_t("Deshecho/segunda"), "art-ajo-deshecho-segunda");
});

import { nivelDeExistencia as nivelDeExistencia_t } from "./calculos.js";
test("un_articulo_sin_minimo_en_cero_no_es_alarma_pero_uno_en_negativo_si", () => {
  assert.equal(nivelDeExistencia_t({ existencia: 0, minimo: 0 }), "ok", "sin mínimo capturado no hay «bajo»");
  assert.equal(nivelDeExistencia_t({ existencia: -2, minimo: 0 }), "negativo");
  assert.equal(nivelDeExistencia_t({ existencia: 5, minimo: 5 }), "critico");
  assert.equal(nivelDeExistencia_t({ existencia: 7, minimo: 5 }), "bajo");
  assert.equal(nivelDeExistencia_t({ existencia: 8, minimo: 5 }), "ok");
});

import { usoDeSiembra as usoDeSiembra_t } from "./calculos.js";
test("una_siembra_con_actividades_o_cosecha_no_se_elimina_y_una_vacia_si", () => {
  const data = { actividades: [{ id: "a1", siembraId: "s1" }], cosechas: [{ id: "c", registros: [{ id: "r1", siembraId: "s1" }, { id: "r2", siembraId: "s2", cancelado: true }] }], estibas: [{ id: "e1", siembraId: "s1" }], siembras: [] };
  const u = usoDeSiembra_t(data, "s1");
  assert.equal(u.usada, true);
  assert.match(u.dice, /1 actividades/); assert.match(u.dice, /1 registros de cosecha/); assert.match(u.dice, /1 estibas/);
  assert.equal(usoDeSiembra_t(data, "s2").usada, false, "un registro de cosecha cancelado no la ata");
});

import { revisarTemporada as revisarTemporada_t, cerrarTemporada as cerrarTemporada_t, reabrirTemporada as reabrirTemporada_t } from "./calculos.js";
test("reabrir_una_temporada_pide_el_porque_y_le_quita_la_fecha_de_fin_que_le_puso_el_cierre", () => {
  assert.equal(revisarTemporada_t({ nombre: "AJO 2027", fechaInicio: "2026-09-01", fechaFin: "2026-08-01" }).ok, false);
  const c = { id: "ci1", nombre: "AJO 2027", fechaInicio: "2026-09-01", fechaFin: "", estado: "activo" };
  const cerrada = cerrarTemporada_t(c, { hoy: "2026-11-19", quien: "ALGUIEN", cuando: "t1" }).ciclo;
  assert.deepEqual([cerrada.estado, cerrada.fechaFin], ["cerrado", "2026-11-19"]);
  assert.equal(reabrirTemporada_t(cerrada, { motivo: " " }).ok, false);
  const re = reabrirTemporada_t(cerrada, { motivo: "FALTABA UNA VENTA", quien: "OTRA", cuando: "t2" }).ciclo;
  assert.deepEqual([re.estado, re.fechaFin, re.historial.map(h => h.que)], ["activo", "", ["cerrada", "reabierta"]]);
  const conFin = cerrarTemporada_t({ ...c, fechaFin: "2026-10-31" }, { hoy: "2026-11-19", quien: "A", cuando: "t" }).ciclo;
  assert.equal(reabrirTemporada_t(conFin, { motivo: "X", quien: "B", cuando: "t" }).ciclo.fechaFin, "2026-10-31", "la fecha que ya tenía se respeta");
});

test("cada_muestra_de_calidad_sabe_de_que_parcelas_venia_lo_que_habia_en_la_mesa_y_la_tendencia_solo_informa", async () => {
  const { origenDeLaMesa, calidadPorOrigen, tendenciaDeCalidad } = await import("./calculos.js");
  const estibas = [
    { id: "b1", codigo: "AS-B-001", fase: "barbecho", parcelaId: "p1" }, { id: "b2", codigo: "AS-B-002", fase: "barbecho", parcelaId: "p2" },
    { id: "l1", codigo: "AS-L-001", fase: "limpia", padres: ["b1"] }, { id: "l2", codigo: "AS-L-002", fase: "limpia", padres: ["b1", "b2"] },
  ];
  const o1 = origenDeLaMesa({ estibas, enMesa: ["l1"] }), o2 = origenDeLaMesa({ estibas, enMesa: ["l1", "l2"], modo: "revoltura" });
  assert.deepEqual(o1.parcelas, ["p1"]); assert.deepEqual(o2.parcelas, ["p1", "p2"]); assert.deepEqual(o1.tarimas[0].padres, ["AS-B-001"]);
  const m = (pct, ritmo, origen, fecha = "2026-11-23", total = 100) => ({ totalCabezas: total, malos: total * (1 - pct), pctBueno: pct, ritmo, origen, fecha });
  const r = calidadPorOrigen([m(0.95, "medio", o1), m(0.97, "medio", o1, "2026-11-23", 300), m(0.88, "alto", o1), m(0.9, "medio", o2), { totalCabezas: 50, malos: 5, ritmo: "medio" }]);
  const medio1 = r.filas.find(f => f.parcelas.join() === "p1" && f.ritmo === "medio");
  assert.equal(medio1.muestras, 2); assert.equal(medio1.pct, 96.5, "por cabezas: (95 + 291) / 400");
  assert.equal(r.filas.find(f => f.ritmo === "alto").pct, 88); assert.equal(r.sinOrigen, 1, "la muestra de antes, sin origen, no se le pega a nadie");
  const t = tendenciaDeCalidad([m(0.88, "alto", o2), m(0.95, "medio", o1)], { nombreParcela: (id) => ({ p1: "UNO", p2: "DOS" })[id] });
  assert.equal(t.dir, "peor"); assert.equal(t.cambioOrigen, true);
  assert.match(t.dice, /Bajó de 95\.0% a 88\.0% de bueno\. Ahora vas a ritmo alto \(antes medio\)\. En la mesa: AS-L-001, AS-L-002 \(UNO, DOS\); antes: AS-L-001 \(UNO\)\./);
  assert.doesNotMatch(t.dice, /convenga|deber|baja el ritmo|sube el ritmo/i, "la app informa, Migue manda");
});
