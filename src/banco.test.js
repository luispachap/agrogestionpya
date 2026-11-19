// ============================================================
//  Pruebas del estado de cuenta del banco
//
//  El hilo de todas: un estado de cuenta que no cuadra NO ENTRA. Es
//  preferible pedir otro archivo que conciliar contra cifras inventadas.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  enmascararCuenta, claveEstado, detectarColumnas, leerMovimientos,
  validarEstado, proponerConciliacion, aDondeSeFue,
} from "./banco.js";
import { aFecha } from "./lectura.js";

/* Un mes de verdad: sale y entra dinero, y el saldo va corriendo. */
const ENCABEZADOS = ["Fecha", "Concepto", "Referencia", "Cargo", "Abono", "Saldo"];
const FILAS = [
  ["12/08/2026", "PAGO AGROVETERINARIA EL SURCO", "44821", "27306.40", "", "92693.60"],
  ["15/08/2026", "DEPOSITO CLIENTE BODEGA CENTRAL", "9911", "", "180000.00", "272693.60"],
  ["18/08/2026", "RETIRO VENTANILLA", "0021", "50000.00", "", "222693.60"],
];
const SALDO_INICIAL = 120000;
const SALDO_FINAL = 222693.60;

const leerDe = (filas = FILAS) => {
  const { mapa } = detectarColumnas(ENCABEZADOS);
  return leerMovimientos(filas, mapa);
};
const movsDe = (filas = FILAS) => leerDe(filas).movimientos;

/* ════════════ NO SE GUARDA EL NÚMERO DE CUENTA ════════════ */

test("de_la_cuenta_solo_se_guardan_los_ultimos_cuatro_digitos", () => {
  // Bastan para identificarla y no sirven para nada más.
  assert.equal(enmascararCuenta("0123456789014417"), "****4417");
  assert.equal(enmascararCuenta("**** **** **** 4417"), "****4417");
  assert.equal(enmascararCuenta(""), "");
  // Y el número completo no queda en la clave del estado.
  const clave = claveEstado({ banco: "BBVA", cuenta: "0123456789014417", periodo: "2026-08" });
  assert.equal(clave.includes("0123456789"), false);
  assert.ok(clave.includes("****4417"));
});

test("el_mismo_estado_no_se_carga_dos_veces", () => {
  // Cargarlo doble duplicaría todos sus movimientos.
  const a = claveEstado({ banco: "BBVA", cuenta: "0123456789014417", periodo: "2026-08" });
  const b = claveEstado({ banco: "bbva", cuenta: "4417", periodo: "2026-08" });
  assert.equal(a, b);
  const otro = claveEstado({ banco: "BBVA", cuenta: "0123456789014417", periodo: "2026-09" });
  assert.notEqual(a, otro);
});

/* ════════════ LAS COLUMNAS, POR LO QUE DICEN ════════════ */

test("las_columnas_se_buscan_por_su_nombre_no_por_su_posicion", () => {
  // La columna 3 de BBVA no es la columna 3 de Banorte.
  const r = detectarColumnas(["Fecha de operación", "Descripción", "Retiros", "Depósitos", "Saldo"]);
  assert.equal(r.sirve, true);
  assert.equal(r.mapa.fecha, 0);
  assert.equal(r.mapa.concepto, 1);
  assert.equal(r.mapa.cargo, 2);
  assert.equal(r.mapa.abono, 3);
  assert.equal(r.mapa.saldo, 4);
});

test("un_archivo_sin_saldo_corrido_no_se_puede_validar_y_se_dice", () => {
  const r = detectarColumnas(["Fecha", "Concepto", "Importe"]);
  assert.equal(r.sirve, false);
  assert.ok(r.faltan.includes("saldo"));
  assert.ok(r.porque.includes("Pídele al banco"));
});

/* ════════════ LA VALIDACIÓN QUE DECIDE ════════════ */

test("un_estado_que_cuadra_al_centavo_es_confiable", () => {
  const v = validarEstado({ saldoInicial: SALDO_INICIAL, saldoFinal: SALDO_FINAL, movimientos: movsDe() });
  assert.equal(v.confiable, true);
  assert.equal(v.renglonMalo, null);
  assert.equal(v.cuadraGlobal, true);
  assert.equal(v.totalAbonos, 180000);
  assert.equal(v.totalCargos, 77306.40);
  assert.ok(v.porque.includes("Cuadra al centavo"));
});

test("la_cadena_dice_CUAL_renglon_esta_mal_no_solo_que_algo_lo_esta", () => {
  // Es la validación valiosa: un error de lectura rompe la cadena
  // exactamente donde ocurrió.
  const rotas = FILAS.map(f => [...f]);
  rotas[1][5] = "272693.50";           // 10 centavos de menos en el saldo
  const v = validarEstado({ saldoInicial: SALDO_INICIAL, saldoFinal: SALDO_FINAL, movimientos: movsDe(rotas) });
  assert.equal(v.confiable, false);
  assert.equal(v.renglonMalo.i, 1);
  assert.equal(v.renglonMalo.concepto, "DEPOSITO CLIENTE BODEGA CENTRAL");
  assert.equal(v.renglonMalo.saldoQueDeberia, 272693.60);
  assert.equal(v.renglonMalo.saldoQueDice, 272693.50);
  assert.ok(v.porque.includes("renglón 2"));
  assert.ok(v.porque.includes("NO entra"));
});

test("un_estado_que_no_cuadra_NO_ENTRA_y_no_se_corrige_solo", () => {
  const rotas = FILAS.map(f => [...f]);
  rotas[0][3] = "27306.00";   // el cargo cambió, pero el saldo no
  const v = validarEstado({ saldoInicial: SALDO_INICIAL, saldoFinal: SALDO_FINAL, movimientos: movsDe(rotas) });
  assert.equal(v.confiable, false);
  // No devuelve un estado "arreglado": no hay campo con los saldos corregidos.
  assert.equal(v.movimientosCorregidos, undefined);
  assert.equal(v.saldoFinalCorregido, undefined);
});

test("sin_saldo_inicial_no_se_da_por_bueno_nada", () => {
  // Sin comprobar, el archivo no entra. Es preferible pedir otro que
  // conciliar contra cifras inventadas.
  const v = validarEstado({ saldoInicial: null, saldoFinal: SALDO_FINAL, movimientos: movsDe() });
  assert.equal(v.confiable, false);
  assert.ok(v.porque.includes("NO entra"));
});

test("el_total_que_no_cuadra_se_detecta_aunque_los_renglones_encadenen", () => {
  const v = validarEstado({ saldoInicial: SALDO_INICIAL, saldoFinal: 999999, movimientos: movsDe() });
  assert.equal(v.confiable, false);
  assert.equal(v.renglonMalo, null);      // los renglones sí encadenan
  assert.equal(v.cuadraGlobal, false);    // pero el total no
  assert.ok(v.porque.includes("el total no cuadra"));
});

test("un_archivo_sin_movimientos_no_es_un_estado_valido", () => {
  const v = validarEstado({ saldoInicial: 100, saldoFinal: 100, movimientos: [] });
  assert.equal(v.confiable, false);
  assert.ok(v.porque.includes("ningún movimiento"));
});

test("las_lineas_de_encabezado_repetido_no_cuentan_como_movimientos_en_cero", () => {
  const conBasura = [["", "", "", "", "", ""], ...FILAS, ["Totales", "", "", "77306.40", "180000.00", ""]];
  const movs = movsDe(conBasura);
  assert.equal(movs.length, 3);
});

/* ════════════ CONCILIAR: LOS CRITERIOS, NO UN PORCENTAJE ════════════ */

const EGRESOS = [
  { id: "eg1", fecha: "2026-08-12", monto: 27306.40, proveedor: "Agroveterinaria El Surco" },
  { id: "eg2", fecha: "2026-08-12", monto: 27306.40, proveedor: "Ferretería La Unión" },
  { id: "eg3", fecha: "2026-08-18", monto: 50000, proveedor: "Retiro" },
];

test("la_conciliacion_dice_por_que_cuadra_en_palabras", () => {
  const movs = movsDe();
  const r = proponerConciliacion({ movimiento: movs[2], candidatos: [EGRESOS[2]] });
  assert.equal(r.hay, true);
  assert.equal(r.varias, false);
  assert.ok(r.porque.includes("importe exacto"));
  assert.ok(r.porque.includes("el mismo día"));
});

test("dos_pagos_del_mismo_importe_NO_se_concilian_solos", () => {
  // Dos pagos iguales al mismo proveedor el mismo día también cuadran
  // perfecto. Que decida la persona.
  const movs = movsDe();
  const r = proponerConciliacion({ movimiento: movs[0], candidatos: EGRESOS });
  assert.equal(r.varias, true);
  assert.equal(r.propuestas.length, 2);
  assert.ok(r.porque.includes("Elige tú"));
});

test("un_gasto_ya_conciliado_no_se_vuelve_a_ofrecer", () => {
  // Si no, el mismo depósito "pagaría" dos cosas y el ingreso se duplica.
  const movs = movsDe();
  const r = proponerConciliacion({ movimiento: movs[0], candidatos: EGRESOS, yaConciliados: ["eg2"] });
  assert.equal(r.varias, false);
  assert.equal(r.propuesta.candidato.id, "eg1");
});

test("si_nada_cuadra_lo_dice_en_vez_de_forzar_algo", () => {
  const movs = movsDe();
  const r = proponerConciliacion({ movimiento: movs[1], candidatos: EGRESOS });
  assert.equal(r.hay, false);
  assert.ok(r.porque.includes("Puede que falte capturarlo"));
});

/* ════════════ A DÓNDE SE FUE CADA PESO ════════════ */

test("cada_peso_queda_explicado_o_se_dice_que_no_lo_esta", () => {
  // Al cierre, el 100 % de los movimientos debe estar explicado, aunque la
  // explicación sea "retiro sin comprobante".
  const r = aDondeSeFue([
    { fecha: "2026-08-12", concepto: "PAGO PROVEEDOR", cargo: 27306.40, abono: 0, conciliadoCon: "eg1", tieneComprobante: true },
    { fecha: "2026-08-18", concepto: "RETIRO VENTANILLA", cargo: 50000, abono: 0, explicacion: "Raya de la semana, sin comprobante" },
    { fecha: "2026-08-20", concepto: "TRANSFERENCIA A PERSONA", cargo: 180000, abono: 0 },
  ]);
  assert.equal(r.porEstado["explicado"], 27306.40);
  assert.equal(r.porEstado["explicado sin comprobante"], 50000);
  assert.equal(r.porEstado["SIN EXPLICACIÓN"], 180000);
  assert.equal(r.sinExplicar.length, 1);
});

test("sin_explicacion_NO_quiere_decir_que_falte_dinero_y_se_dice_asi", () => {
  // No acusa. Falta información, no falta dinero — y la pantalla lo dice con
  // esas palabras.
  const r = aDondeSeFue([{ fecha: "2026-08-20", concepto: "RETIRO", cargo: 5000, abono: 0 }]);
  assert.ok(r.dice.includes("NO quiere decir que falte el dinero"));
  // Y cuenta movimientos, no un porcentaje.
  assert.ok(r.dice.includes("1 movimiento"));
  assert.equal(r.dice.includes("%"), false);
});

test("cuando_todo_esta_explicado_lo_dice_sin_alarmar", () => {
  const r = aDondeSeFue([{ fecha: "2026-08-12", concepto: "PAGO", cargo: 100, abono: 0, conciliadoCon: "eg1", tieneComprobante: true }]);
  assert.equal(r.sinExplicar.length, 0);
  assert.ok(r.dice.includes("Todos los movimientos están explicados"));
});

/* ════════════ DOS TRAMPAS DE LOS ARCHIVOS DE BANCO ════════════ */

test("una_fecha_de_excel_se_lee_por_su_numero_no_a_la_americana", () => {
  // Trampa real: la librería de Excel convierte "12/08/2026" en 8 de
  // DICIEMBRE, no en 12 de agosto, y sin avisar. Un estado de agosto
  // acabaría fechado en diciembre. En un .xlsx la fecha es un serial y no
  // tiene ambigüedad; el CSV se lee como texto, donde el día va primero.
  const serial = 46364;                       // 8 de diciembre de 2026
  assert.equal(aFecha(serial), "2026-12-08");
  assert.equal(aFecha("12/08/2026"), "2026-08-12");   // texto: día primero
  // Un número que no puede ser un serial se deja en paz.
  assert.equal(aFecha(5), null);
});

test("ningun_renglon_del_banco_se_cae_en_silencio", () => {
  // Un renglón perdido es dinero que desaparece del estado sin que nadie se
  // entere, y lo que queda puede cuadrar solo y aun así faltar dinero.
  const conFechaIlegible = FILAS.map(f => [...f]);
  conFechaIlegible[0][0] = "###";
  const { movimientos, descartadas } = leerDe(conFechaIlegible);
  assert.equal(movimientos.length, 2);
  assert.equal(descartadas.length, 1);
  assert.equal(descartadas[0].renglon, 1);
  assert.ok(descartadas[0].porque.includes("No se entendió la fecha"));
});

test("un_archivo_con_renglones_perdidos_NO_es_confiable_aunque_lo_demas_cuadre", () => {
  // Ésta es la que de verdad protege: si el saldo inicial se toma del primer
  // renglón que sobrevivió, lo que queda encadena perfecto y el archivo
  // parecería bueno. No lo es.
  const conFechaIlegible = FILAS.map(f => [...f]);
  conFechaIlegible[0][0] = "###";
  const { movimientos, descartadas } = leerDe(conFechaIlegible);
  const v = validarEstado({ saldoInicial: 92693.60, saldoFinal: SALDO_FINAL, movimientos, descartadas });
  assert.equal(v.confiable, false);
  assert.equal(v.descartadas.length, 1);
  assert.ok(v.porque.includes("no se pudieron leer"));
  assert.ok(v.porque.includes("puede cuadrar solo y aun así faltar dinero"));
});
