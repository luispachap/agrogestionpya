import { test } from "node:test";
import assert from "node:assert/strict";
import { resultadoDelRancho, flujoDeEfectivo, esCompraDeAlmacen, claseDeInsumo, insumosPorClasificar } from "./resultado.js";
import { nuevoEvento } from "./eventos.js";

const Q = { id: "u1", nombre: "Luis", rol: "admin" };
const ev = (tipo, fecha, datos, i) => nuevoEvento({ tipo, cuando: `${fecha}T12:00:00-06:00`, fecha, quien: Q, azar: (i + 1) / 1e6, datos });
const BASE = {
  ingresos: [{ id: "i1", fecha: "2026-11-20", monto: 100000 }, { id: "i2", fecha: "2026-11-21", monto: 5000, cancelado: { motivo: "duplicado" } }],
  egresos: [{ id: "e1", fecha: "2026-11-05", monto: 900, categoria: "servicios" }, { id: "e2", fecha: "2026-11-06", monto: 8000, categoria: "insumos", destinoInsumo: "inventario", concepto: "Compra de urea" },
    { id: "e3", fecha: "2026-11-07", monto: 1500, categoria: "mantenimiento", vehiculoId: "m1" }, { id: "e4", fecha: "2026-11-08", monto: 250, categoria: "insumos", parcelaId: "p1" }],
  entradas_inv: [{ id: "x1", fecha: "2026-11-07", costo_total: 5000 }, { id: "x2", fecha: "2026-11-08", costo_total: -700 }],
  actividades: [{ fecha: "2026-11-10", parcelaId: "p1", costoMO: 2000, costoMaq: 400, costoInsumos: 700 }, { fecha: "2026-11-11", esBodega: true, costoMO: 500, costoMaq: 0, costoInsumos: 0 }],
  indirectos: { partes: [{ fuente: "personal", monto: 350 }, { fuente: "vehiculos", monto: 2100 }, { fuente: "prestaciones", monto: 60 }, { fuente: "bonos", monto: 500 }], pendientes: [{ fuente: "personal", monto: 600 }, { fuente: "prestaciones", monto: 15 }, { fuente: "vehiculos", monto: -100 }], noProduccion: [{ fuente: "bajas", monto: 44560 }] },
  compras: { gasto: 100, inventario: 1400, porValuar: 600 },
  almacen: { consumoGeneral: 80, ajustesValuacion: 200, mermas: 45, valor: 12000, sinValor: [{ articulo: "Hilo", cantidad: 6 }] },
};

test("los_insumos_cuentan_al_consumirse_y_las_compras_para_el_almacen_no_son_gasto_son_inventario", () => {
  const r = resultadoDelRancho(BASE), de = (k) => r.lineas.find(l => l.clave === k).monto;
  assert.equal(de("insumos"), 700, "lo que se usó");
  assert.equal(de("gastos"), 900 + 250, "la luz y el insumo comprado directo para una parcela; NO la urea para el almacén ni el taller del vehículo");
  assert.ok(!r.lineas.some(l => [8000, 5000].includes(l.monto)), "las compras no aparecen como gasto");
  assert.equal(r.inventario.comprado, 8000 + 5000 + 1400, "están en el inventario: gasto capturado como insumos, entrada del almacén y lo valuado de las compras del personal");
  assert.equal(r.inventario.valor, 12000); assert.equal(r.inventario.porValuar, 600); assert.equal(r.inventario.sinValor.length, 1, "lo que no tiene precio se dice, no vale cero");
  assert.equal(de("compras"), 100, "de la compra del personal sólo es gasto lo que no es mercancía");
  assert.equal(de("consumo_general"), 80); assert.equal(de("mermas"), 45); assert.equal(de("ajustes_insumos"), 200);
  assert.equal(esCompraDeAlmacen({ categoria: "insumos", parcelaId: "p1" }), false);
});

test("la_maquinaria_cuenta_una_vez_cuota_aplicada_mas_lo_que_entra_por_fuera_nunca_el_taller_aparte", () => {
  const r = resultadoDelRancho(BASE), de = (k) => r.lineas.find(l => l.clave === k).monto;
  assert.equal(de("maq_cuota"), 400); assert.equal(de("vehiculos"), 2000, "2,100 repartidos − 100 de una cuota que aplicó de más");
  assert.ok(!r.lineas.some(l => l.monto === 1500), "el taller del vehículo no se suma como gasto: ya viene en el costo real del vehículo");
});

test("la_utilidad_cuenta_todo_lo_del_personal_cuando_se_causa_y_cada_cosa_una_vez", () => {
  const r = resultadoDelRancho(BASE), de = (k) => r.lineas.find(l => l.clave === k).monto;
  assert.equal(r.ingresos, 100000, "lo cancelado no cuenta");
  assert.equal(de("mo"), 2500); assert.equal(de("personal"), 950); assert.equal(de("prestaciones"), 75); assert.equal(de("bonos"), 500); assert.equal(de("bajas"), 44560);
  assert.equal(r.costos, 2500 + 700 + 200 + 400 + 2000 + 950 + 75 + 500 + 44560); assert.equal(r.gastos, 1150 + 100 + 80 + 45);
  assert.equal(r.egresos, r.costos + r.gastos); assert.equal(r.utilidad, 100000 - r.egresos);
});

test("en_el_flujo_las_compras_salen_el_dia_que_se_pagan_y_la_gente_el_dia_que_se_le_paga", () => {
  const eventos = [ev("pago_personal", "2026-12-05", { monto: 2400 }, 1), ev("pago_prestacion", "2026-12-18", { monto: 5015 }, 2), ev("pago_baja", "2026-12-20", { monto: 20000 }, 3), ev("bono_personal", "2026-11-16", { monto: 500 }, 4), ev("pago_bono", "2026-12-06", { monto: 500 }, 5)];
  const f = flujoDeEfectivo({ ...BASE, compras: [{ id: "c1", fecha: "2026-11-06", monto: 1500, estado: "aprobada" }, { id: "c2", fecha: "2026-11-06", monto: 999, estado: "pendiente" }], eventos });
  const nov = f.meses.find(m => m.mes === "2026-11"), dic = f.meses.find(m => m.mes === "2026-12");
  assert.deepEqual(nov.detalle, { ventas: 100000, gastos: 900 + 1500 + 250, almacen: 8000 + 5000, compras: 1500 }, "en noviembre salió el dinero de las compras aunque no sean gasto; el bono otorgado todavía no es dinero");
  assert.deepEqual(dic.detalle, { pagos_personal: 2400, pagos_bonos: 500, pagos_prestaciones: 5015, pagos_bajas: 20000 });
  assert.equal(dic.acumulado, f.neto);
});

test("un_prestamo_entregado_es_dinero_que_salio_y_solo_el_abono_aparte_es_dinero_que_entra", () => {
  const eventos = [ev("prestamo_solicitud", "2026-11-01", { monto: 1000 }, 1), ev("prestamo_autorizacion", "2026-11-02", { monto: 800 }, 2), ev("prestamo_entrega", "2026-11-03", { monto: 500 }, 3),
    ev("abono_prestamo", "2026-11-14", { monto: 200, semana: { desde: "2026-11-09", hasta: "2026-11-15" } }, 4), ev("abono_prestamo", "2026-11-20", { monto: 100 }, 5)];
  const f = flujoDeEfectivo({ eventos, prestamos: [{ id: "viejo", fecha: "2026-11-04", monto: 300 }, { id: "nuevo", _deEventos: true, fecha: "2026-11-03", monto: 500 }] });
  const nov = f.meses[0];
  assert.equal(nov.detalle.prestamos_entregados, 800); assert.equal(nov.detalle.abonos_prestamos, 100);
  assert.equal(flujoDeEfectivo({ eventos: [{ ...eventos[2], estado: "cancelado" }] }).meses.length, 0, "una entrega cancelada no cuenta");
});

test("un_gasto_de_insumos_puede_ser_cuatro_cosas_y_si_nadie_lo_dijo_no_es_ni_gasto_ni_inventario", () => {
  const eg = (id, mas) => ({ id, fecha: "2026-11-10", monto: 1000, categoria: "insumos", ...mas });
  assert.equal(claseDeInsumo(eg("a", {})), "por_clasificar"); assert.equal(claseDeInsumo(eg("a", { parcelaId: "p1" })), "produccion"); assert.equal(claseDeInsumo(eg("a", { vehiculoId: "m1" })), "vehiculo");
  assert.equal(claseDeInsumo(eg("a", { solicitudId: "s1" })), "inventario", "nació junto con su entrada al almacén"); assert.equal(claseDeInsumo({ categoria: "servicios" }), null);
  const egresos = [eg("a", {}), eg("b", { destinoInsumo: "inventario" }), eg("c", { destinoInsumo: "general" }), eg("d", { destinoInsumo: "produccion" }), eg("e", { destinoInsumo: "otro" })];
  const r = resultadoDelRancho({ egresos });
  const de = (k) => r.lineas.find(l => l.clave === k).monto;
  assert.equal(r.porClasificar.monto, 1000); assert.equal(r.inventario.comprado, 1000); assert.equal(de("insumos_directos"), 1000); assert.equal(de("gastos"), 2000);
  assert.equal(r.egresos, 3000, "lo por clasificar y lo del almacén no bajan la utilidad todavía");
  assert.equal(insumosPorClasificar(egresos).length, 1);
  const f = flujoDeEfectivo({ egresos }); assert.equal(f.meses[0].egresos, 5000, "en el flujo sí sale todo: el dinero se movió");
});
