import { test } from "node:test";
import assert from "node:assert/strict";
import { resultadoDelRancho, flujoDeEfectivo } from "./resultado.js";
import { nuevoEvento } from "./eventos.js";

const Q = { id: "u1", nombre: "Luis", rol: "admin" };
const ev = (tipo, fecha, datos, i) => nuevoEvento({ tipo, cuando: `${fecha}T12:00:00-06:00`, fecha, quien: Q, azar: (i + 1) / 1e6, datos });
const BASE = {
  ingresos: [{ id: "i1", fecha: "2026-11-20", monto: 100000 }, { id: "i2", fecha: "2026-11-21", monto: 5000, cancelado: { motivo: "duplicado" } }],
  egresos: [{ id: "e1", fecha: "2026-11-05", monto: 900, categoria: "servicios" }],
  compras: [{ id: "c1", fecha: "2026-11-06", monto: 300, estado: "aprobada" }, { id: "c2", fecha: "2026-11-06", monto: 999, estado: "pendiente" }],
  entradas_inv: [{ id: "x1", fecha: "2026-11-07", costo_total: 5000 }, { id: "x2", fecha: "2026-11-08", costo_total: -700 }],
  actividades: [{ fecha: "2026-11-10", parcelaId: "p1", costoMO: 2000, costoMaq: 400, costoInsumos: 700 }, { fecha: "2026-11-11", esBodega: true, costoMO: 500, costoMaq: 0 }],
  indirectos: { partes: [{ fuente: "personal", monto: 350 }, { fuente: "vehiculos", monto: 9999 }, { fuente: "prestaciones", monto: 60 }], pendientes: [{ fuente: "personal", monto: 600 }, { fuente: "prestaciones", monto: 15 }], noProduccion: [{ fuente: "bajas", monto: 44560 }] },
  partesMO: [{ trabajadorId: "t1", parcelaId: "p1", monto: 2000 }, { trabajadorId: "t2", vehiculoId: "v1", monto: 180 }],
};

test("la_utilidad_cuenta_todo_lo_que_cuesta_la_gente_y_no_solo_lo_trabajado_en_parcelas", () => {
  const r = resultadoDelRancho(BASE), de = (k) => r.lineas.find(l => l.clave === k).monto;
  assert.equal(r.ingresos, 100000, "lo cancelado no cuenta");
  assert.equal(de("mo"), 2500); assert.equal(de("personal"), 950, "permisos, esperas y días de encargados: repartidos o no, se pagaron");
  assert.equal(de("operador"), 180); assert.equal(de("prestaciones"), 75); assert.equal(de("bajas"), 44560);
  assert.equal(de("maq"), 400); assert.equal(de("almacen"), 5000, "la salida del almacén no es un egreso negativo"); assert.equal(de("compras"), 300); assert.equal(de("gastos"), 900);
  assert.equal(r.egresos, 2500 + 950 + 180 + 75 + 44560 + 400 + 5000 + 300 + 900);
  assert.equal(r.utilidad, 100000 - r.egresos);
  assert.ok(!r.lineas.some(l => l.monto === 9999), "lo de los vehículos no se suma otra vez: sus gastos y su diésel ya están en gastos y almacén");
});

test("el_insumo_usado_no_se_cuenta_dos_veces_se_conto_al_comprarlo", () => {
  const r = resultadoDelRancho(BASE);
  assert.ok(!r.lineas.some(l => l.monto === 700), "el costo de insumos de la actividad no entra al resultado: ya entró como compra del almacén");
});

test("en_el_flujo_la_mano_de_obra_sale_el_dia_que_se_paga_no_el_dia_que_se_trabaja", () => {
  const eventos = [ev("pago_personal", "2026-12-05", { monto: 2400 }, 1), ev("pago_prestacion", "2026-12-18", { monto: 5015 }, 2), ev("pago_baja", "2026-12-20", { monto: 20000 }, 3)];
  const f = flujoDeEfectivo({ ...BASE, eventos });
  const nov = f.meses.find(m => m.mes === "2026-11"), dic = f.meses.find(m => m.mes === "2026-12");
  assert.equal(nov.egresos, 900 + 300 + 5000, "en noviembre se trabajó pero no se pagó: no sale dinero por mano de obra"); assert.equal(nov.ingresos, 100000);
  assert.equal(dic.egresos, 2400 + 5015 + 20000); assert.deepEqual(dic.detalle, { pagos_personal: 2400, pagos_prestaciones: 5015, pagos_bajas: 20000 });
  assert.equal(f.neto, 100000 - 6200 - 27415); assert.equal(dic.acumulado, f.neto);
});

test("un_prestamo_entregado_es_dinero_que_salio_y_solo_el_abono_aparte_es_dinero_que_entra", () => {
  const eventos = [ev("prestamo_solicitud", "2026-11-01", { monto: 1000 }, 1), ev("prestamo_autorizacion", "2026-11-02", { monto: 800 }, 2), ev("prestamo_entrega", "2026-11-03", { monto: 500 }, 3),
    ev("abono_prestamo", "2026-11-14", { monto: 200, semana: { desde: "2026-11-09", hasta: "2026-11-15" } }, 4), ev("abono_prestamo", "2026-11-20", { monto: 100 }, 5)];
  const f = flujoDeEfectivo({ eventos, prestamos: [{ id: "viejo", fecha: "2026-11-04", monto: 300 }, { id: "nuevo", _deEventos: true, fecha: "2026-11-03", monto: 500 }] });
  const nov = f.meses[0];
  assert.equal(nov.detalle.prestamos_entregados, 800, "500 entregados + 300 del préstamo de la tabla de antes; lo solicitado y lo autorizado no son dinero");
  assert.equal(nov.detalle.abonos_prestamos, 100, "el abono descontado de su semana no es dinero que entra");
  const cancelado = { ...eventos[2], estado: "cancelado" };
  assert.equal(flujoDeEfectivo({ eventos: [cancelado] }).meses.length, 0, "una entrega cancelada no cuenta");
});
