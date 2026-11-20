// ════════════════════════════════════════════════════════════════════════
//  UN MES COMPLETO, DE PUNTA A PUNTA
//  Una compra, un consumo, una actividad con máquina, un bono y sus pagos:
//  cada hecho se captura UNA vez y tiene que caer exactamente en los
//  apartados que le tocan — flujo, inventario, resultados, parcela y cierre —
//  y en ninguno dos veces.
// ════════════════════════════════════════════════════════════════════════
import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoDelAlmacen, recibirCompra, valuar, consumirDirecto, actividadesDeAlmacen, costoDeConsumos, ajustesDeValuacion, valorDelInventario } from "./movimientos.js";
import { repartoDeCompras, estadoDeCompra } from "./compras.js";
import { vehiculosPorMes, fuenteVehiculos, conciliarMaquinaria } from "./vehiculos.js";
import { otorgarBono, pagarBono, renglonesDeBonos, bonosDe } from "./bonos.js";
import { fuenteBonos, baseDePersonas } from "./personal.js";
import { juntarFuentes } from "./indirectos.js";
import { costoDelMes } from "./cierreMes.js";
import { resultadoDelRancho, flujoDeEfectivo } from "./resultado.js";
import { nuevoEvento } from "./eventos.js";

const ADMIN = { id: "u1", nombre: "Luis", rol: "admin" }, ENC = { id: "enc1", nombre: "Encargado", rol: "encargado" };
let n = 0; const az = () => (++n) / 1e6; const c = (d, h = "12:00") => `${d}T${h}:00-06:00`;
const HILO = { id: "i-hilo", nombre: "Hilo", unidad: "rollo", existencia: 0 }, DIESEL = { id: "i-diesel", nombre: "Diésel", unidad: "L", existencia: 400, costo_unit: 25 }, INV = [HILO, DIESEL];
const TRACTOR = { id: "m-tractor", nombre: "Tractor 3" }, ANA = { id: "t-ana", nombre: "Ana" };
const P1 = { tipo: "parcela", id: "p1", nombre: "Parcela 1", actividad: "Amarre" };
const COMPRA = { id: "co1", fecha: "2026-11-06", estado: "aprobada", monto: 1500, descripcion: "Hilo y flete", proveedor: "La Central", afectaInventario: true, items: [{ nombre: "Hilo", cantidad: 10, insumoId: "i-hilo" }, { nombre: "Flete", cantidad: 1, insumoId: null }] };
const ingresos = [{ id: "i1", fecha: "2026-11-20", monto: 10000 }];
const egresos = [{ id: "g1", fecha: "2026-11-05", monto: 900, categoria: "servicios", concepto: "Luz" }, { id: "g2", fecha: "2026-11-12", monto: 200, categoria: "mantenimiento", concepto: "Taller", vehiculoId: "m-tractor" }];
const ACT = { id: "a1", fecha: "2026-11-10", parcelaId: "p1", tipo: "Barbecho", registradoPor: { tipo: "trabajador", id: "t-ana" }, maquinariaId: "m-tractor", costoMO: 400, costoMaq: 300, costoInsumos: 0, costoTotal: 700 };

// Los hechos, en el orden en que pasaron.
const recepcion = recibirCompra({ compra: COMPRA, i: 0, articulo: HILO, cantidad: 10, quien: ENC, cuando: c("2026-11-07"), fecha: "2026-11-07" }).evento;
const usoHilo = consumirDirecto({ articulo: HILO, cantidad: 4, destino: P1, quien: ENC, cuando: c("2026-11-10"), fecha: "2026-11-10", azar: az() }).evento;
const usoDiesel = consumirDirecto({ articulo: DIESEL, cantidad: 20, destino: { tipo: "vehiculo", id: "m-tractor", nombre: "Tractor 3" }, quien: ENC, cuando: c("2026-11-10", "13:00"), fecha: "2026-11-10", azar: az() }).evento;
const bono = otorgarBono({ permitido: true, eventos: [], persona: ANA, clase: "productividad", motivo: "Meta de la semana", monto: 500, desde: "2026-11-09", hasta: "2026-11-15", autorizo: "Rodolfo", tratamiento: "actividades", quien: ADMIN, cuando: c("2026-11-16"), fecha: "2026-11-16", azar: az() }).evento;
const pagoSemana = nuevoEvento({ tipo: "pago_personal", cuando: c("2026-12-05"), fecha: "2026-12-05", quien: ADMIN, azar: az(), datos: { a: { tipo: "trabajador", id: "t-ana", nombre: "Ana" }, desde: "2026-11-09", hasta: "2026-11-15", monto: 400, medio: "efectivo" } });
const pagoBono = pagarBono({ permitido: true, eventos: [bono], bono, monto: 500, quien: ADMIN, cuando: c("2026-12-05", "13:00"), fecha: "2026-12-05", azar: az() }).evento;
const porValuar = estadoDelAlmacen([recepcion], INV).porValuar[0];
const valuacion = valuar({ entrada: porValuar, costoUnit: 140, nota: "venía en la factura", quien: ADMIN, cuando: c("2026-11-21"), fecha: "2026-11-21", azar: az() }).evento;

// Lo mismo que arma la app con esos hechos.
function mundo(eventos, { tratamientoDiferencia = "pendiente" } = {}) {
  const alm = estadoDelAlmacen(eventos, INV);
  const actividades = [ACT].concat(actividadesDeAlmacen(alm.consumos));
  const repartos = vehiculosPorMes({ vehiculos: [TRACTOR], partes: [], consumos: alm.consumos.filter(x => !x.enActividad), egresos, cuotas: [ACT], hoy: "2026-12-10", tratamientoDiferencia });
  const base = baseDePersonas({ partes: [], actividades: [ACT] });
  const indirectos = juntarFuentes([fuenteVehiculos(repartos), fuenteBonos({ renglones: renglonesDeBonos(eventos), base })]);
  const ajustes = ajustesDeValuacion(alm), consumos = costoDeConsumos(alm), compras = repartoDeCompras([COMPRA], alm.recibidas), inv = valorDelInventario(alm, INV);
  const almacen = { consumoGeneral: consumos.general, ajustesValuacion: ajustes.total, mermas: 0, valor: inv.valor, sinValor: inv.sinValor };
  const cierre = (mes) => costoDelMes({ mes, parcelas: [{ id: "p1", nombre: "Parcela 1" }], actividades, egresos, compras: [COMPRA], indirectos, recibidas: alm.recibidas, ajustesValuacion: ajustes.lista, maquinaria: conciliarMaquinaria(repartos, mes) });
  return { alm, consumos, compras, inv, ajustes, indirectos, repartos, cierre, resultado: resultadoDelRancho({ ingresos, egresos, actividades, indirectos, compras, almacen }), flujo: flujoDeEfectivo({ ingresos, egresos, compras: [COMPRA], eventos }) };
}
const de = (r, k) => r.lineas.find(l => l.clave === k).monto;
const TODO = [recepcion, usoHilo, usoDiesel, bono, pagoSemana, pagoBono, valuacion];

test("antes_de_valuar_la_compra_el_dinero_ya_salio_la_mercancia_ya_esta_y_nada_cuesta_cero", () => {
  const m = mundo([recepcion, usoHilo, usoDiesel]);
  assert.equal(m.flujo.meses[0].detalle.compras, 1500, "el dinero salió el día de la compra, completo");
  assert.equal(m.compras.porValuar, 1500); assert.equal(m.compras.gasto, 0); assert.equal(de(m.resultado, "compras"), 0, "todavía no es gasto: no se sabe cuánto es mercancía");
  assert.deepEqual(m.inv.sinValor.map(x => [x.articulo, x.cantidad, x.porValuar]), [["Hilo", 6, true]], "en el inventario hay 6 rollos sin valor, dicho así");
  assert.equal(m.consumos.pendientesDeValuacion.length, 1, "y el consumo en la parcela está pendiente de valoración, no en cero");
  assert.equal(m.cierre("2026-11").porValuar, 1500);
  assert.equal(m.cierre("2026-11").renglones[0].directo, 700, "la parcela todavía no carga el hilo");
});

test("la_compra_cuenta_una_vez_flujo_al_pagarse_inventario_al_valuarse_y_costo_al_consumirse", () => {
  const m = mundo(TODO);
  // FLUJO: 1,500 el día de la compra. La recepción y la valuación no mueven dinero.
  const nov = m.flujo.meses.find(x => x.mes === "2026-11");
  assert.deepEqual(nov.detalle, { ventas: 10000, gastos: 900 + 200, compras: 1500 });
  // La compra se partió: 1,400 de mercancía (10 × 140) y 100 que no lo eran (el flete).
  assert.equal(m.compras.inventario, 1400); assert.equal(m.compras.gasto, 100); assert.equal(m.compras.porValuar, 0);
  assert.equal(estadoDeCompra(COMPRA, m.alm.recibidas).estado, "completa");
  // INVENTARIO: quedan 6 rollos a 140 y 380 litros a 25.
  assert.equal(m.inv.valor, 6 * 140 + 380 * 25); assert.deepEqual(m.inv.sinValor, []);
  // COSTO: los 4 rollos usados son costo de la parcela, como ajuste aparte; el consumo original sigue sin tocarse.
  assert.equal(m.ajustes.total, 560); assert.equal(m.alm.consumos.find(x => x.articuloId === "i-hilo").costo, null);
  assert.equal(de(m.resultado, "ajustes_insumos"), 560); assert.equal(de(m.resultado, "compras"), 100);
  assert.ok(!m.resultado.lineas.some(l => l.monto === 1500 || l.monto === 1400), "ni la compra ni la mercancía aparecen como gasto");
});

test("la_maquina_cuesta_una_sola_vez_lo_aplicado_por_cuota_mas_la_diferencia_contra_lo_real", () => {
  const m = mundo(TODO), k = m.cierre("2026-11").maquinaria;
  // aplicado por cuota 300 · real: diésel 20 L × 25 = 500 + taller 200 = 700 · diferencia 400
  assert.deepEqual([k.aplicado, k.real, k.diferencia, k.enCostos], [300, 700, 400, 700]);
  assert.equal(de(m.resultado, "maq_cuota"), 300); assert.equal(de(m.resultado, "vehiculos"), 400);
  assert.ok(!m.resultado.lineas.some(l => l.clave === "gastos" && l.monto !== 900), "el taller no se suma además como gasto");
  assert.equal(de(m.resultado, "insumos"), 0, "y el diésel no se suma además como insumo: va en el costo real de la máquina");
  // con la regla «a las mismas parcelas», la diferencia sube a la parcela y ya no queda pendiente; el total no cambia
  const r = mundo(TODO, { tratamientoDiferencia: "aplicado" });
  assert.equal(r.cierre("2026-11").pendiente, 0); assert.equal(r.cierre("2026-11").renglones[0].indirecto, 500 + 400);
  assert.equal(r.cierre("2026-11").rancho, m.cierre("2026-11").rancho, "cambiar el tratamiento mueve la diferencia de lugar, no cambia lo que costó");
});

test("el_bono_es_costo_al_otorgarse_y_dinero_al_pagarse", () => {
  const m = mundo(TODO);
  assert.equal(de(m.resultado, "bonos"), 500);
  assert.equal(m.indirectos.partes.find(p => p.fuente === "bonos").parcelaId, "p1", "a la parcela donde Ana trabajó ese mes");
  assert.equal(m.flujo.meses.find(x => x.mes === "2026-11").detalle.pagos_bonos, undefined, "en noviembre todavía no era dinero");
  assert.deepEqual(m.flujo.meses.find(x => x.mes === "2026-12").detalle, { pagos_personal: 400, pagos_bonos: 500 });
  assert.equal(bonosDe(TODO)[0].estado, "pagado");
  assert.equal(m.cierre("2026-12").rancho, 0, "en diciembre se pagó, pero no hubo ningún costo nuevo");
});

test("resultados_parcela_y_cierre_de_mes_dicen_lo_mismo_y_cada_peso_esta_en_un_solo_lugar", () => {
  const m = mundo(TODO), k = m.cierre("2026-11"), r = m.resultado;
  // La parcela: la actividad (400 de trabajo + 300 de cuota) + 560 del hilo; encima, 500 del bono.
  assert.deepEqual([k.renglones[0].directo, k.renglones[0].ajusteValuacion, k.renglones[0].indirecto, k.renglones[0].completo], [1260, 560, 500, 1760]);
  assert.equal(k.pendiente, 400, "la diferencia de la máquina, mientras no se decida");
  assert.deepEqual(k.generales.porCategoria, [{ categoria: "servicios", monto: 900, n: 1 }, { categoria: "compras_personal", monto: 100, n: 1 }]);
  assert.equal(k.rancho, 1760 + 400 + 1000);
  assert.equal(r.egresos, k.rancho, "lo que Resultados llama costos y gastos es lo que el cierre del mes suma: 3,160");
  assert.equal(r.utilidad, 10000 - 3160);
  // Y las tres cifras son distintas porque miden cosas distintas:
  const flujoNov = m.flujo.meses.find(x => x.mes === "2026-11").neto;
  assert.equal(flujoNov, 10000 - 2600, "flujo de noviembre: salió la compra completa y no se le ha pagado a nadie");
  assert.equal(r.inventario.valor, 10340, "inventario: lo comprado que todavía no se usa");
  assert.notEqual(flujoNov, r.utilidad);
});
