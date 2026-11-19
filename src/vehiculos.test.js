import { test } from "node:test";
import assert from "node:assert/strict";
import { costoDeVehiculos } from "./vehiculos.js";

const D = "2026-11-19";
const CAMION = { id: "m-camion", nombre: "Camión amarillo" };
const operador = { trabajadorId: "t-ana", fecha: D, vehiculoId: "m-camion", vehiculo: "Camión amarillo", actividad: "Traslado de personal", minutos: 120, monto: 100, evs: ["e1"] };
const diesel = { fecha: D, destino: { tipo: "vehiculo", id: "m-camion", nombre: "Camión amarillo" }, articulo: "Diésel", unidad: "L", cantidad: 60, costo: 1470, evs: ["e2"] };
const taller = { id: "eg1", fecha: D, vehiculoId: "m-camion", concepto: "Balatas", monto: 2200 };
const viaje = { fecha: D, cuadrilla: "Los de Villa", vehiculoId: "m-camion", vehiculo: "Camión amarillo", personas: 12 };

test("el_costo_del_camion_junta_operador_combustible_y_taller_cada_uno_una_sola_vez", () => {
  const [v] = costoDeVehiculos({ vehiculos: [CAMION], partes: [operador, { ...operador, vehiculoId: null, parcelaId: "p7", monto: 300 }], consumos: [diesel, { ...diesel, destino: { tipo: "parcela", id: "p7" } }], egresos: [taller, { id: "eg2", fecha: D, concepto: "Urea", monto: 9000 }], viajes: [viaje] });
  assert.equal(v.operador, 100); assert.equal(v.almacen, 1470); assert.equal(v.gastos, 2200); assert.equal(v.total, 3770);
  assert.equal(v.viajes.length, 1); assert.equal(v.viajesSinOperador, 0);
  assert.equal(v.renglones.length, 3, "y cada peso dice de dónde salió");
});

test("un_gasto_cancelado_no_cuenta_y_un_viaje_sin_operador_asignado_se_señala", () => {
  const [v] = costoDeVehiculos({ vehiculos: [CAMION], egresos: [{ ...taller, cancelado: { motivo: "duplicado", por: "Luis", cuando: D } }], viajes: [viaje] });
  assert.equal(v.total, 0); assert.equal(v.viajesSinOperador, 1, "se trajo gente y nadie quedó asignado al camión: ese tiempo no está en la cuenta");
});

test("diesel_sin_costo_capturado_no_se_inventa_se_cuenta_aparte", () => {
  const [v] = costoDeVehiculos({ vehiculos: [CAMION], consumos: [{ ...diesel, costo: null }] });
  assert.equal(v.almacen, 0); assert.equal(v.sinCosto, 1);
});

test("fuera_de_las_fechas_no_entra", () => {
  assert.deepEqual(costoDeVehiculos({ vehiculos: [CAMION], partes: [operador], desde: "2026-11-20", hasta: "2026-11-21" }), []);
});
