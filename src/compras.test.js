import { test } from "node:test";
import assert from "node:assert/strict";
import { seguimientoDeCompras, estadoDeCompra, repartoDeCompras, posibleDuplicado, esParaAlmacen } from "./compras.js";

const C = { id: "co1", fecha: "2026-11-06", estado: "aprobada", monto: 1500, descripcion: "Urea e hilo, más el flete", afectaInventario: true, items: [{ nombre: "Urea", cantidad: 1, insumoId: "i-urea" }, { nombre: "Hilo", cantidad: 10, insumoId: "i-x" }, { nombre: "Flete", cantidad: 1, insumoId: null }] };
const R = (i, cantidad, costoUnit) => ({ compraId: "co1", i, cantidad, costoUnit, valor: costoUnit == null ? null : cantidad * costoUnit, ev: `e${i}`, recibio: "Encargado", fecha: "2026-11-07" });

test("una_compra_para_el_almacen_pasa_por_recibir_y_valuar_y_mientras_tanto_no_es_gasto_ni_cuesta_cero", () => {
  const a = estadoDeCompra(C, []);
  assert.equal(a.estado, "por_recibir"); assert.equal(a.sinRecibir, 2, "el flete no es mercancía: no se recibe"); assert.equal(a.gasto, null); assert.equal(a.porValuar, 1500);
  const b = estadoDeCompra(C, [R(0, 1, 900), R(1, 10, null)]);
  assert.equal(b.estado, "por_valuar"); assert.equal(b.inventario, 900); assert.equal(b.porValuar, 600); assert.equal(b.gasto, null, "todavía no se sabe cuánto fue el flete");
  const c = estadoDeCompra(C, [R(0, 1, 900), R(1, 10, 50)]);
  assert.equal(c.estado, "completa"); assert.equal(c.inventario, 1400); assert.equal(c.gasto, 100, "lo que no es mercancía (el flete) sí es gasto"); assert.equal(c.porValuar, 0);
});

test("avisa_si_llego_otra_cantidad_o_si_lo_valuado_rebasa_el_comprobante", () => {
  const r = estadoDeCompra(C, [R(0, 1, 1200), R(1, 8, 50)]);
  assert.equal(r.inventario, 1600); assert.equal(r.gasto, 0);
  assert.ok(r.avisos.some(a => /es más que el total del comprobante/.test(a))); assert.ok(r.avisos.some(a => /De Hilo se anotaron 10 y llegaron 8/.test(a)));
});

test("una_compra_que_no_es_para_el_almacen_es_gasto_completa_y_una_sin_aprobar_no_es_nada_todavia", () => {
  const ref = { id: "co2", fecha: "2026-11-06", estado: "aprobada", monto: 300, descripcion: "Refacción", items: [] };
  assert.equal(esParaAlmacen(ref), false); assert.equal(estadoDeCompra(ref).gasto, 300);
  assert.equal(estadoDeCompra({ ...C, estado: "pendiente" }).gasto, null);
  const t = repartoDeCompras([C, ref, { ...ref, id: "co3", estado: "rechazada" }], [R(0, 1, 900), R(1, 10, 50)]);
  assert.equal(t.pagado, 1800, "al flujo va el dinero completo, una vez"); assert.equal(t.gasto, 400); assert.equal(t.inventario, 1400); assert.equal(t.porValuar, 0);
  assert.equal(t.gasto + t.inventario + t.porValuar, t.pagado, "cada peso de la compra está en un solo lugar");
});

test("avisa_cuando_lo_mismo_parece_estar_capturado_por_otro_lado", () => {
  const donde = { compras: [C], egresos: [{ id: "g1", fecha: "2026-11-08", monto: 1500, concepto: "Urea" }, { id: "g2", fecha: "2026-11-08", monto: 1500, cancelado: { motivo: "x" } }, { id: "g3", fecha: "2026-11-20", monto: 1500 }], entradas_inv: [{ id: "x1", fecha: "2026-11-05", costo_total: 1500, concepto: "Compra" }] };
  const d = posibleDuplicado({ fecha: "2026-11-07", monto: 1500 }, donde);
  assert.deepEqual(d.map(x => x.donde), ["compra del personal", "gasto capturado", "entrada del almacén"], "lo cancelado y lo lejano en fecha no cuentan");
  assert.deepEqual(posibleDuplicado({ fecha: "2026-11-07", monto: 1499 }, donde), []);
  assert.equal(posibleDuplicado({ id: "co1", fecha: "2026-11-06", monto: 1500 }, donde).length, 2, "no se compara contra sí misma");
});

test("una_compra_que_nadie_ha_recibido_avisa_a_los_tres_dias_y_escala_a_los_siete_con_quien_la_compro", () => {
  const nombres = new Map([["t-ana", "Ana"]]), c = { ...C, trabajadorId: "t-ana" };
  const hoyMismo = seguimientoDeCompras([c], [], { hoy: "2026-11-07", nombres });
  assert.equal(hoyMismo.noRecibidas.length, 2); assert.equal(hoyMismo.porAvisar.length, 0, "un día no es para avisar");
  const tres = seguimientoDeCompras([c], [], { hoy: "2026-11-09", nombres });
  assert.equal(tres.porAvisar.length, 2); assert.equal(tres.escaladas.length, 0); assert.match(tres.lista[0].responsable, /la compró Ana/);
  const siete = seguimientoDeCompras([c], [], { hoy: "2026-11-13", nombres });
  assert.equal(siete.escaladas.length, 2); assert.equal(siete.masVieja, 7);
});

test("lo_recibido_sin_precio_y_lo_que_llego_distinto_salen_cada_uno_con_su_nombre", () => {
  const s = seguimientoDeCompras([C], [R(0, 1, null), R(1, 8, 20)], { hoy: "2026-11-12" });
  assert.equal(s.noRecibidas.length, 0);
  assert.equal(s.sinPrecio.length, 1); assert.equal(s.sinPrecio[0].articulo, "Urea"); assert.equal(s.sinPrecio[0].dias, 5, "cuenta desde que se recibió"); assert.match(s.sinPrecio[0].responsable, /la recibió Encargado/);
  assert.equal(s.diferencias.length, 1); assert.match(s.diferencias[0].toca, /Se anotaron 10 y llegaron 8/);
  const limpio = seguimientoDeCompras([C], [R(0, 1, 500), R(1, 10, 20)], { hoy: "2026-11-30" });
  assert.equal(limpio.lista.length, 0, "recibida y valuada completa: ya no hay nada que seguir");
});
