import { test } from "node:test";
import assert from "node:assert/strict";
import { CLASES_DE_SALIDA, ORDEN_DE_CLASES, claseDeSalida, revisarSalida, egresoDeCaja, estadoDeSalida, salidasDeCajaAlFlujo, pendientesDeCaja, eventosParaLigar, revisarLiga, saldoDeCaja } from "./caja.js";
import { resultadoDelRancho, flujoDeEfectivo } from "./resultado.js";
import { marcarCancelado } from "./calculos.js";

const sal = (id, monto, extra = {}) => ({ id, tipo: "salida", concepto: "algo " + id, monto, fecha: "2026-11-10", ...extra });
const ent = (id, monto) => ({ id, tipo: "entrada", concepto: "Fondo", monto, fecha: "2026-11-01" });
const ev = (id, tipo, monto, extra = {}) => ({ id, tipo, fecha: "2026-11-10", estado: "vigente", datos: { monto, ...extra } });
const cancelado = (r) => marcarCancelado(r, "prueba", { nombre: "Prueba" }, "2026-11-11T00:00:00Z");
// Lo que haría la pantalla al guardar: la salida y, si le toca, su gasto ligado.
const guardar = (movs) => ({ cajachica: movs, egresos: movs.map(m => egresoDeCaja(m)).filter(Boolean) });
const cuentas = ({ cajachica, egresos, eventos = [] }) => ({
  r: resultadoDelRancho({ egresos }),
  f: flujoDeEfectivo({ egresos, eventos, cajachica }),
});
const linea = (r, clave) => r.lineas.find(l => l.clave === clave).monto;

test("las_siete_clases_que_pidio_luis_existen_y_cada_una_dice_que_pasa", () => {
  assert.deepEqual(ORDEN_DE_CLASES, ["gasto_parcela", "gasto_general", "inventario", "prestamo", "pago_personal", "traspaso", "otro"]);
  for (const c of ORDEN_DE_CLASES) assert.ok(CLASES_DE_SALIDA[c].nombre && CLASES_DE_SALIDA[c].ayuda, c);
});

test("un_gasto_general_de_caja_sale_en_resultados_sin_inventarle_parcela", () => {
  const d = guardar([ent("f", 5000), sal("a", 300, { clase: "gasto_general" })]);
  const { r, f } = cuentas(d);
  assert.equal(linea(r, "gastos"), 300);
  assert.equal(linea(r, "gastos_parcela"), 0);
  assert.equal(d.egresos[0].parcelaId, undefined);
  assert.equal(f.egresos, 300);
});

test("un_gasto_de_parcela_de_caja_va_al_costo_de_esa_parcela_y_no_a_los_generales", () => {
  const d = guardar([sal("a", 450, { clase: "gasto_parcela", parcelaId: "p1" })]);
  const { r, f } = cuentas(d);
  assert.equal(linea(r, "gastos_parcela"), 450);
  assert.equal(linea(r, "gastos"), 0);
  assert.equal(f.egresos, 450);
});

test("el_fondo_que_entra_a_la_caja_no_es_gasto_ni_ingreso_y_al_usarse_se_cuenta_una_sola_vez", () => {
  // Entran 5,000 de fondo, se gastan 300 y luego se reponen 300.
  const d = guardar([ent("f", 5000), sal("a", 300, { clase: "gasto_general" }), ent("r", 300)]);
  const { r, f } = cuentas(d);
  assert.equal(r.egresos, 300, "sólo lo gastado es gasto; ni el fondo ni la reposición");
  assert.equal(f.egresos, 300);
  assert.equal(f.ingresos, 0, "recibir el fondo no es un ingreso del rancho");
  assert.equal(saldoDeCaja(d.cajachica), 5000);
});

test("una_compra_para_el_almacen_pagada_de_caja_es_inventario_y_no_gasto_pero_si_sale_en_el_flujo", () => {
  const d = guardar([sal("a", 800, { clase: "inventario" })]);
  const { r, f } = cuentas(d);
  assert.equal(r.egresos, 0);
  assert.equal(r.inventario.comprado, 800);
  assert.equal(f.egresos, 800);
  assert.equal(f.meses[0].detalle.almacen, 800);
});

test("un_prestamo_que_salio_de_caja_no_es_gasto_y_ligado_a_su_entrega_no_se_cuenta_dos_veces", () => {
  const eventos = [ev("pe1", "prestamo_entrega", 1000, { trabajadorId: "t1" })];
  const sinLigar = cuentas({ ...guardar([sal("a", 1000, { clase: "prestamo" })]), eventos: [] });
  assert.equal(sinLigar.r.egresos, 0, "un préstamo nunca es gasto");
  assert.equal(sinLigar.f.egresos, 1000, "sin ligar, el dinero que salió de la caja sigue en el flujo");
  assert.equal(sinLigar.f.meses[0].detalle.caja_por_ligar, 1000);
  const ligado = cuentas({ ...guardar([sal("a", 1000, { clase: "prestamo", eventoId: "pe1" })]), eventos });
  assert.equal(ligado.f.egresos, 1000, "ligado: se cuenta una vez, por la entrega del préstamo");
  assert.equal(ligado.f.meses[0].detalle.prestamos_entregados, 1000);
  assert.equal(ligado.f.meses[0].detalle.caja_por_ligar, undefined);
});

test("un_anticipo_a_un_trabajador_no_es_costo_nuevo_y_ligado_a_su_pago_se_cuenta_una_vez", () => {
  const eventos = [ev("pp1", "pago_personal", 600, { a: { tipo: "trabajador", id: "t1", nombre: "PRUEBA UNO" } })];
  const d = guardar([sal("a", 600, { clase: "pago_personal", eventoId: "pp1" })]);
  const { r, f } = cuentas({ ...d, eventos });
  assert.equal(d.egresos.length, 0, "la caja no crea un gasto por pagarle a alguien");
  assert.equal(r.egresos, 0);
  assert.equal(f.egresos, 600);
  assert.equal(f.meses[0].detalle.pagos_personal, 600);
});

test("un_traspaso_de_fondos_no_es_gasto_ni_salida_del_rancho_pero_si_baja_la_caja", () => {
  const d = guardar([ent("f", 2000), sal("a", 500, { clase: "traspaso" })]);
  const { r, f } = cuentas(d);
  assert.equal(r.egresos, 0); assert.equal(f.egresos, 0);
  assert.equal(saldoDeCaja(d.cajachica), 1500);
  assert.deepEqual(pendientesDeCaja(d.cajachica, d).porClasificar, []);
});

test("lo_que_nadie_ha_dicho_que_fue_sale_en_el_flujo_y_no_en_resultados", () => {
  const d = guardar([sal("a", 250, { clase: "otro" })]);
  const { r, f } = cuentas(d);
  assert.equal(r.egresos, 0);
  assert.equal(f.egresos, 250);
  assert.equal(f.meses[0].detalle.caja_por_clasificar, 250);
  const p = pendientesDeCaja(d.cajachica, d);
  assert.deepEqual([p.porClasificar.length, p.montoPorClasificar], [1, 250]);
});

test("una_salida_de_antes_sin_parcela_ya_no_desaparece_queda_por_clasificar_y_en_el_flujo", () => {
  const vieja = sal("v", 120);                       // como se guardaba antes: sin clase y sin parcela
  assert.equal(claseDeSalida(vieja), "otro");
  const { f } = cuentas({ cajachica: [vieja], egresos: [] });
  assert.equal(f.egresos, 120);
  // Y la de antes CON parcela ya tenía su gasto: no se cuenta otra vez.
  const conParcela = sal("w", 90, { parcelaId: "p1" });
  const suGasto = { id: "eg1", fecha: "2026-11-10", monto: 90, categoria: "caja_chica", parcelaId: "p1", cajachicaId: "w" };
  assert.equal(claseDeSalida(conParcela), "gasto_parcela");
  assert.equal(cuentas({ cajachica: [conParcela], egresos: [suGasto] }).f.egresos, 90);
});

test("clasificar_dos_veces_la_misma_salida_no_crea_dos_gastos", () => {
  const m = sal("a", 300, { clase: "gasto_general" });
  assert.equal(egresoDeCaja(m).id, egresoDeCaja({ ...m }).id);
  assert.equal(egresoDeCaja(m).id, "eg-a");
  assert.equal(egresoDeCaja(m).cajachicaId, "a");
});

test("un_gasto_de_parcela_sin_parcela_no_se_guarda_y_dice_que_es_gasto_general", () => {
  assert.match(revisarSalida({ clase: "gasto_parcela", concepto: "x", monto: 5 }), /gasto general/);
  assert.equal(revisarSalida({ clase: "gasto_general", concepto: "x", monto: 5 }), "");
  assert.match(revisarSalida({ clase: "", concepto: "x", monto: 5 }), /qué fue/);
  assert.match(revisarSalida({ clase: "otro", concepto: "", monto: 5 }), /concepto/);
  assert.match(revisarSalida({ clase: "otro", concepto: "x", monto: 0 }), /monto/);
});

test("una_salida_cancelada_no_cuenta_en_nada_y_si_se_cancela_solo_su_gasto_vuelve_a_quedar_por_clasificar", () => {
  const m = sal("a", 300, { clase: "gasto_general" });
  assert.equal(cuentas({ cajachica: [cancelado(m)], egresos: [cancelado(egresoDeCaja(m))] }).f.egresos, 0);
  const solo = { cajachica: [m], egresos: [cancelado(egresoDeCaja(m))] };
  assert.equal(estadoDeSalida(m, solo).pendiente, "por_clasificar");
  assert.equal(cuentas(solo).f.egresos, 300, "el dinero salió de la caja: no desaparece porque se canceló el gasto");
  assert.equal(cuentas(solo).r.egresos, 0);
});

test("un_pago_no_sale_de_la_caja_dos_veces_y_no_se_liga_lo_que_no_cuadra", () => {
  const eventos = [ev("pp1", "pago_personal", 600), ev("pp2", "pago_personal", 700), ev("pe1", "prestamo_entrega", 600), { ...ev("pp3", "pago_personal", 600), estado: "cancelado" }];
  const a = sal("a", 600, { clase: "pago_personal", eventoId: "pp1" }), b = sal("b", 600, { clase: "pago_personal" });
  const ctx = { eventos, cajachica: [a, b] };
  assert.deepEqual(eventosParaLigar("pago_personal", { ...ctx, propio: "b" }).map(e => e.id), ["pp2"], "ni el ya ligado, ni el cancelado, ni un préstamo");
  assert.match(revisarLiga(b, "pp1", ctx), /ya está ligado/);
  assert.match(revisarLiga(b, "pp2", ctx), /no coinciden/);
  assert.match(revisarLiga(b, "pe1", ctx), /no se puede ligar/);
  assert.equal(revisarLiga(a, "pp1", ctx), "", "la que ya lo tiene puede conservarlo");
  assert.deepEqual(eventosParaLigar("gasto_general", ctx), []);
});

test("un_mes_de_caja_completo_cuadra_al_centavo_entre_caja_resultados_y_flujo", () => {
  const eventos = [ev("pe1", "prestamo_entrega", 1000), ev("pp1", "pago_personal", 600)];
  const d = guardar([ent("f", 6000),
    sal("a", 300.10, { clase: "gasto_general" }), sal("b", 450.20, { clase: "gasto_parcela", parcelaId: "p1" }), sal("c", 800, { clase: "inventario" }),
    sal("d", 1000, { clase: "prestamo", eventoId: "pe1" }), sal("e", 600, { clase: "pago_personal", eventoId: "pp1" }),
    sal("g", 500, { clase: "traspaso" }), sal("h", 250.05, { clase: "otro" })]);
  const { r, f } = cuentas({ ...d, eventos });
  assert.equal(r.egresos, 750.30, "gasto: sólo el general y el de la parcela");
  assert.equal(r.inventario.comprado, 800);
  // Flujo: todo lo que salió de la caja menos el traspaso (que no salió del rancho).
  assert.equal(f.egresos, 3400.35);
  assert.equal(saldoDeCaja(d.cajachica), 2099.65);
  // Lo que salió de la caja = lo que el flujo contó + el traspaso.
  assert.equal(Math.round((6000 - saldoDeCaja(d.cajachica)) * 100), Math.round((f.egresos + 500) * 100));
});
