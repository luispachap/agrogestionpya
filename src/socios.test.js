// ============================================================
//  Pruebas de "varios RFC, una sola empresa"
//
//  El hilo de todas: el sistema NO decide quién puso qué ni qué es personal.
//  Propone, dice en qué se basa, y espera que una persona confirme. Y cuando
//  algo no está decidido, el total lo dice en vez de pintarse de tranquilo.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  destinoDe, esTraspaso, retirosSinRecibir, libroDelRancho,
  cuentaCorriente, proponerDestino, comprobantesPorTitular,
} from "./socios.js";

const TITULARES = [
  { id: "t1", nombre: "Rodolfo", rfc: "ROD850101AA1" },
  { id: "t2", nombre: "Migue", rfc: "MIG900202BB2" },
  { id: "t3", nombre: "Fito", rfc: "FIT920303CC3" },
];
const BOLSAS = [
  { id: "b1", nombre: "Bajío de Rodolfo", tipo: "banco", titularId: "t1" },
  { id: "b2", nombre: "Tarjeta de Migue", tipo: "tarjeta", titularId: "t2" },
  { id: "b3", nombre: "Caja de Zacatecas", tipo: "efectivo", titularId: "t3" },
];

/* ════════════ UN SOLO LIBRO DEL RANCHO ════════════ */

test("la_utilidad_del_rancho_es_una_sola_sin_importar_de_que_bolsa_salio", () => {
  // Migue paga agroquímicos con su tarjeta y un cliente deposita en la cuenta
  // de Rodolfo: los dos son del rancho.
  const r = libroDelRancho({
    ingresos: [{ id: "i1", monto: 180000, destino: "rancho", bolsaId: "b1" }],
    egresos: [
      { id: "e1", monto: 27306.40, destino: "rancho", bolsaId: "b2" },
      { id: "e2", monto: 15000, destino: "rancho", bolsaId: "b3" },
    ],
  });
  assert.equal(r.ingresos, 180000);
  assert.equal(r.egresos, 42306.40);
  assert.equal(r.utilidad, 137693.60);
  assert.equal(r.completo, true);
});

test("lo_personal_NO_se_borra_se_marca_y_se_excluye", () => {
  // Se excluye del total, pero sigue existiendo para que el estado de cuenta
  // siga cuadrando contra el banco.
  const egresos = [
    { id: "e1", monto: 27306.40, destino: "rancho" },
    { id: "e2", monto: 3200, destino: "personal", concepto: "Despensa de la casa" },
  ];
  const r = libroDelRancho({ ingresos: [], egresos });
  assert.equal(r.egresos, 27306.40);
  assert.equal(r.excluidoPersonal, 3200);
  assert.equal(egresos.length, 2);          // el registro sigue ahí
  assert.ok(r.sobreQue.includes("3,200"));  // y el total dice, con formato, que quedó fuera
});

test("un_total_con_movimientos_sin_marcar_lo_dice_en_vez_de_pintarse_tranquilo", () => {
  const r = libroDelRancho({
    ingresos: [],
    egresos: [
      { id: "e1", monto: 27306.40, destino: "rancho" },
      { id: "e2", monto: 230000 },   // nadie lo ha marcado
    ],
  });
  assert.equal(r.completo, false);
  assert.equal(r.montoSinDecidir, 230000);
  assert.ok(r.sobreQue.includes("OJO"));
  assert.ok(r.sobreQue.includes("puede cambiar"));
  // Y no lo cuenta en la utilidad: no se supone que sea del rancho.
  assert.equal(r.egresos, 27306.40);
});

test("un_traspaso_entre_bolsas_no_infla_el_ano_por_los_dos_lados", () => {
  // La venta entra al Bajío y de ahí se pasa a Banorte: eso no es un ingreso
  // nuevo ni un gasto.
  const r = libroDelRancho({
    ingresos: [{ id: "i1", monto: 50000, destino: "rancho", traspasoCon: "e9" }],
    egresos: [{ id: "e9", monto: 50000, destino: "rancho", traspasoCon: "i1" }],
  });
  assert.equal(r.ingresos, 0);
  assert.equal(r.egresos, 0);
  assert.equal(r.utilidad, 0);
  assert.equal(r.excluidoTraspasos, 100000);
  assert.equal(esTraspaso({ traspasoCon: "x" }), true);
});

/* ════════════ LA CUENTA CORRIENTE ENTRE SOCIOS ════════════ */

test("si_migue_paga_con_su_tarjeta_el_rancho_le_queda_debiendo", () => {
  // Ésta es la función que evita pleitos entre hermanos.
  const cc = cuentaCorriente({
    titulares: TITULARES, bolsas: BOLSAS,
    egresos: [{ id: "e1", monto: 27306.40, destino: "rancho", bolsaId: "b2" }],
    ingresos: [],
  });
  const migue = cc.filas.find(f => f.nombre === "Migue");
  assert.equal(migue.pusoDeSuBolsa, 27306.40);
  assert.equal(migue.neto, 27306.40);
  assert.ok(migue.dice.includes("El rancho le debe"));
});

test("si_el_cliente_deposita_con_rodolfo_el_tiene_dinero_del_rancho", () => {
  const cc = cuentaCorriente({
    titulares: TITULARES, bolsas: BOLSAS,
    ingresos: [{ id: "i1", monto: 180000, destino: "rancho", bolsaId: "b1" }],
    egresos: [],
  });
  const rod = cc.filas.find(f => f.nombre === "Rodolfo");
  assert.equal(rod.recibioEnSuBolsa, 180000);
  assert.equal(rod.neto, -180000);
  assert.ok(rod.dice.includes("del rancho en sus bolsas"));
  assert.ok(rod.dice.includes("180,000"));   // con formato, como lo ve la persona
});

test("lo_personal_no_entra_en_la_cuenta_entre_socios", () => {
  // La despensa de la casa de Migue no es algo que el rancho le deba.
  const cc = cuentaCorriente({
    titulares: TITULARES, bolsas: BOLSAS,
    egresos: [{ id: "e1", monto: 3200, destino: "personal", bolsaId: "b2" }],
    ingresos: [],
  });
  assert.equal(cc.filas.find(f => f.nombre === "Migue").neto, 0);
});

test("el_dinero_sin_bolsa_NO_se_reparte_entre_los_socios_se_dice", () => {
  // Repartir lo que no se sabe es exactamente cómo se ensucia la cuenta entre
  // hermanos.
  const cc = cuentaCorriente({
    titulares: TITULARES, bolsas: BOLSAS,
    egresos: [{ id: "e1", monto: 50000, destino: "rancho" }],   // sin bolsaId
    ingresos: [],
  });
  assert.equal(cc.completa, false);
  assert.equal(cc.sinAsignar, 50000);
  assert.ok(cc.sobreQue.includes("NO está repartida"));
  for (const f of cc.filas) assert.equal(f.neto, 0);
});

test("las_aportaciones_y_retiros_a_proposito_cuentan_en_el_saldo", () => {
  const cc = cuentaCorriente({
    titulares: TITULARES, bolsas: BOLSAS, egresos: [], ingresos: [],
    aportaciones: [
      { titularId: "t2", tipo: "aportacion", monto: 100000 },
      { titularId: "t2", tipo: "retiro", monto: 30000 },
    ],
  });
  const migue = cc.filas.find(f => f.nombre === "Migue");
  assert.equal(migue.aporto, 100000);
  assert.equal(migue.retiro, 30000);
  assert.equal(migue.neto, 70000);
});

/* ════════════ EL RETIRO QUE NINGUNA CAJA RECIBIÓ ════════════ */

test("un_retiro_que_ninguna_caja_recibio_es_lo_primero_que_ve_el_dueno", () => {
  const r = retirosSinRecibir({
    movimientosBanco: [{ fecha: "2026-08-18", concepto: "RETIRO VENTANILLA", cargo: 50000 }],
    entradasCaja: [],
  });
  assert.equal(r.sinRecibir.length, 1);
  assert.equal(r.monto, 50000);
});

test("el_retiro_se_PROPONE_contra_la_caja_no_se_une_solo", () => {
  const r = retirosSinRecibir({
    movimientosBanco: [{ fecha: "2026-08-18", concepto: "RETIRO VENTANILLA", cargo: 50000 }],
    entradasCaja: [{ id: "c1", fecha: "2026-08-18", monto: 50000 }],
  });
  assert.equal(r.sinRecibir.length, 0);
  assert.equal(r.todos[0].estado, "hay una que cuadra");
  assert.equal(r.todos[0].propuesta.id, "c1");
  // Es una propuesta: el registro de caja no quedó marcado como emparejado.
  assert.equal(r.todos[0].propuesta.traspasoCon, undefined);
});

test("dos_retiros_iguales_el_mismo_dia_no_se_emparejan_solos", () => {
  const r = retirosSinRecibir({
    movimientosBanco: [{ fecha: "2026-08-18", concepto: "RETIRO VENTANILLA", cargo: 50000 }],
    entradasCaja: [
      { id: "c1", fecha: "2026-08-18", monto: 50000 },
      { id: "c2", fecha: "2026-08-18", monto: 50000 },
    ],
  });
  assert.equal(r.todos[0].estado, "hay varias que cuadran");
  assert.equal(r.todos[0].candidatas.length, 2);
});

/* ════════════ PROPONER, NO DECIDIR ════════════ */

test("el_criterio_se_aprende_de_lo_que_ya_se_marco_y_dice_en_que_se_basa", () => {
  // Un sistema que dice el resultado sin explicar sólo se puede obedecer o
  // ignorar.
  const historial = Array(340).fill({ proveedor: "AGROVETERINARIA EL SURCO", destino: "rancho" });
  const p = proponerDestino({ movimiento: { proveedor: "Agroveterinaria El Surco", concepto: "COMPRA" }, historial });
  assert.equal(p.propone, "rancho");
  assert.equal(p.seguro, true);
  assert.ok(p.porque.includes("340"));
  assert.ok(p.porque.includes("Confírmalo o cámbialo"));
});

test("la_primera_vez_no_propone_nada_y_lo_dice", () => {
  const p = proponerDestino({ movimiento: { proveedor: "Ferretería nueva" }, historial: [] });
  assert.equal(p.propone, null);
  assert.ok(p.porque.includes("primera vez"));
});

test("si_al_mismo_proveedor_se_le_ha_marcado_de_las_dos_formas_NO_propone", () => {
  // Depende del caso, y ahí es justo donde el sistema se equivocaría.
  const historial = [
    { proveedor: "SUPER", destino: "rancho" }, { proveedor: "SUPER", destino: "rancho" },
    { proveedor: "SUPER", destino: "personal" }, { proveedor: "SUPER", destino: "personal" },
  ];
  const p = proponerDestino({ movimiento: { proveedor: "Super" }, historial });
  assert.equal(p.propone, null);
  assert.ok(p.porque.includes("Depende del caso"));
});

test("lo_que_nadie_ha_marcado_no_cuenta_como_criterio", () => {
  const historial = [{ proveedor: "SUPER" }, { proveedor: "SUPER" }];  // sin destino
  const p = proponerDestino({ movimiento: { proveedor: "Super" }, historial });
  assert.equal(p.propone, null);
  assert.equal(destinoDe(historial[0]), "sin decidir");
});

/* ════════════ A NOMBRE DE QUIÉN QUEDÓ CADA COMPROBANTE ════════════ */

test("se_deja_dicho_a_nombre_de_quien_quedo_la_factura_sin_calcular_impuestos", () => {
  const r = comprobantesPorTitular({
    titulares: TITULARES,
    egresos: [
      { id: "e1", monto: 27306.40, destino: "rancho", uuid: "A1", rfcReceptor: "MIG900202BB2" },
      { id: "e2", monto: 15000, destino: "rancho", uuid: "A2", rfcReceptor: "ROD850101AA1" },
    ],
  });
  assert.equal(r.filas.find(f => f.nombre === "Migue").monto, 27306.40);
  assert.equal(r.filas.find(f => f.nombre === "Rodolfo").monto, 15000);
  // No hay ningún cálculo de ISR ni de IVA acreditable por ningún lado.
  assert.equal(r.isr, undefined);
  assert.equal(r.ivaAcreditable, undefined);
});

test("el_gasto_sin_factura_se_registra_como_tal_y_se_dice_cuanto_es", () => {
  // No es un problema a esconder: saber que se van $200,000 al año en gastos
  // sin comprobante es información que cambia decisiones.
  const r = comprobantesPorTitular({
    titulares: TITULARES,
    egresos: [{ id: "e1", monto: 200000, destino: "rancho" }],
  });
  assert.equal(r.sinComprobante.length, 1);
  assert.equal(r.montoSinComprobante, 200000);
  assert.ok(r.dice.includes("no son deducibles") || r.dice.includes("No son deducibles"));
  assert.ok(r.dice.includes("cambia decisiones"));
});
