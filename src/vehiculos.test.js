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

// ── Repartir: dos vistas del mismo dinero ─────────────────────────────────
import { repartirVehiculos, indirectoPorParcela } from "./vehiculos.js";
const DESDE = "2026-11-01", HASTA = "2026-11-30";
const trabajo = [{ fecha: D, cuadrillaId: "cq1", parcelaId: "p7", personas: 9 }, { fecha: D, cuadrillaId: "cq1", parcelaId: "p8", personas: 3 }];
const viajeCq = { ...viaje, cuadrillaId: "cq1" };
const base = (mas = {}) => costoDeVehiculos({ vehiculos: [CAMION], partes: [operador], consumos: [diesel], egresos: [taller], viajes: [viajeCq], ...mas });
const rep = (mas = {}, costos = base()) => repartirVehiculos({ vehiculos: [CAMION], costos, trabajo, desde: DESDE, hasta: HASTA, ...mas })[0];

test("el_traslado_se_reparte_por_las_personas_que_llevo_a_cada_parcela_y_suma_exacto_el_costo", () => {
  const r = rep();
  const a = indirectoPorParcela([r]); const p7 = a.find(x => x.parcelaId === "p7"), p8 = a.find(x => x.parcelaId === "p8");
  assert.equal(r.repartido, 3770); assert.equal(r.costoReal, 3770); assert.ok(r.cuadra, "lo repartido es el mismo dinero del historial, ni un peso más");
  assert.equal(p7.monto, 2827.5); assert.equal(p8.monto, 942.5, "9 y 3 de 12 personas");
  assert.ok(p7.renglones.every(x => x.origen && x.base && x.vehiculo === "Camión amarillo"), "cada importe dice de dónde salió");
  assert.equal(r.pendientes.length, 0);
});

test("otros_criterios_reparten_distinto_pero_siempre_el_mismo_total", () => {
  const parejo = rep({ criterioTraslado: "parejo" });
  assert.equal(parejo.partes.filter(p => p.origen === "operador").map(p => p.monto).join(), "50,50"); assert.ok(parejo.cuadra);
  const porViaje = rep({ criterioVehiculo: "viajes" }); assert.ok(porViaje.cuadra); assert.equal(porViaje.repartido, 3770);
});

test("no_todo_gasto_del_vehiculo_es_llevar_gente_el_uso_sin_parcela_se_lleva_su_parte_y_no_va_a_produccion", () => {
  // Además del traslado (2 h), el camión estuvo 2 h en "Mantenimiento del vehículo", sin parcela.
  const taller2h = { ...operador, actividad: "Mantenimiento del vehículo", monto: 100, minutos: 120, evs: ["e9"] };
  const r = rep({}, base({ partes: [operador, taller2h] }));
  assert.equal(r.costoReal, 3870);
  assert.equal(r.noProduccion, 1935, "su operador ($100) y la mitad de lo compartido ($1,835): por horas, 2 de 4");
  assert.equal(r.repartido, 1935); assert.ok(r.cuadra);
});

test("un_acarreo_para_una_parcela_se_le_carga_a_esa_parcela", () => {
  const acarreo = { ...operador, actividad: "Acarreo de cosecha", beneficiaId: "p9", monto: 150, minutos: 180, evs: ["e8"] };
  const r = rep({}, costoDeVehiculos({ vehiculos: [CAMION], partes: [acarreo], consumos: [diesel] }));
  assert.deepEqual(indirectoPorParcela([r]).map(x => [x.parcelaId, x.monto]), [["p9", 1620]]); assert.ok(r.cuadra);
});

test("lo_que_no_se_sabe_a_que_beneficio_queda_pendiente_no_se_inventa", () => {
  const sinTrabajo = repartirVehiculos({ vehiculos: [CAMION], costos: base(), trabajo: [], desde: DESDE, hasta: HASTA })[0];
  assert.equal(sinTrabajo.repartido, 0); assert.equal(sinTrabajo.pendiente, 3770); assert.ok(sinTrabajo.cuadra); assert.match(sinTrabajo.pendientes[0].porque, /no se sabe a qué parcela/);
  const sinUso = rep({}, costoDeVehiculos({ vehiculos: [CAMION], egresos: [taller] }));
  assert.equal(sinUso.pendiente, 2200); assert.match(sinUso.pendientes[0].porque, /ningún uso registrado/);
  const porKm = rep({ criterioVehiculo: "km" });
  assert.match(porKm.pendientes[0].porque, /kilometraje/); assert.equal(porKm.repartido, 100, "el operador sí se reparte; lo compartido espera el dato"); assert.ok(porKm.cuadra);
  assert.equal(rep({ criterioVehiculo: "km" }, base({ viajes: [{ ...viajeCq, km: 40 }] })).pendientes.length, 0);
});

test("una_maquina_que_ya_carga_cuota_por_hora_no_se_reparte_encima", () => {
  const r = rep({ cuotas: [{ maquinariaId: "m-camion", fecha: D, costoMaq: 1600 }] });
  assert.equal(r.modo, "cuota"); assert.equal(r.repartido, 0); assert.equal(r.cuota, 1600); assert.equal(r.costoReal, 3770, "se enseña la cuota contra el costo real");
  assert.deepEqual(indirectoPorParcela([r]), []);
});

test("la_depreciacion_se_reparte_por_el_periodo_y_no_es_un_gasto_pagado", () => {
  const r = repartirVehiculos({ vehiculos: [{ ...CAMION, depreciacion_mes: 3040 }], costos: base(), trabajo, desde: DESDE, hasta: HASTA })[0];
  assert.equal(r.depreciacion, 3000, "30 días de un mes de 30.4"); assert.equal(r.costoReal, 6770); assert.ok(r.cuadra);
});

// ── Cuota por hora (aplicado) contra costo real ────────────────────────────
import { vehiculosPorMes, fuenteVehiculos, conciliarMaquinaria } from "./vehiculos.js";
import { juntarFuentes } from "./indirectos.js";
const TRACTOR = { id: "m-tractor", nombre: "Tractor 3", depreciacion_mes: 3040 };
const cuotasT = [{ maquinariaId: "m-tractor", fecha: "2026-11-10", parcelaId: "p7", costoMaq: 3000 }, { maquinariaId: "m-tractor", fecha: "2026-11-12", parcelaId: "p8", costoMaq: 1000 }];
const realT = { partes: [{ trabajadorId: "t-ana", fecha: "2026-11-10", vehiculoId: "m-tractor", actividad: "Barbecho", minutos: 300, monto: 500, evs: ["o1"] }],
  consumos: [{ fecha: "2026-11-10", destino: { tipo: "vehiculo", id: "m-tractor" }, articulo: "Diésel", unidad: "L", cantidad: 80, costo: 2000, evs: ["d1"] }],
  egresos: [{ id: "eg9", fecha: "2026-11-15", vehiculoId: "m-tractor", concepto: "Servicio", monto: 1500 }] };
const mesT = (mas = {}) => vehiculosPorMes({ vehiculos: [TRACTOR], ...realT, cuotas: cuotasT, hoy: "2026-11-30", ...mas });

test("la_cuota_por_hora_y_el_costo_real_no_se_suman_solo_entra_la_diferencia", () => {
  const [r] = mesT();
  // real: operador 500 + diésel 2,000 + servicio 1,500 + depreciación 3,000 = 7,000; aplicado por cuota: 4,000
  assert.equal(r.modo, "cuota"); assert.equal(r.aplicado, 4000); assert.equal(r.costoReal, 7000); assert.equal(r.diferencia, 3000);
  assert.deepEqual(r.componentes, { operador: 500, combustible: 2000, mantenimiento: 1500, depreciacion: 3000 });
  const f = juntarFuentes([fuenteVehiculos([r])]);
  assert.equal(f.repartido + f.pendiente + f.fuera, 3000, "a los costos, por fuera de la cuota, sólo entra la diferencia"); assert.equal(f.pendiente, 3000, "y mientras no se decida, queda pendiente de distribuir");
  const k = conciliarMaquinaria([r], "2026-11");
  assert.equal(k.aplicado, 4000); assert.equal(k.real, 7000); assert.equal(k.diferencia, 3000); assert.equal(k.enCostos, 7000, "aplicado + diferencia = costo real: la máquina cuesta una sola vez");
});

test("la_diferencia_se_puede_repartir_con_la_misma_base_de_la_cuota_o_mandarse_a_gasto_general", () => {
  const [a] = mesT({ tratamientoDiferencia: "aplicado" });
  assert.deepEqual(a.partes.map(p => [p.parcelaId, p.monto]), [["p7", 2250], ["p8", 750]], "3/4 y 1/4, como se aplicó la cuota");
  assert.match(a.partes[0].explica, /en la proporción en que se les aplicó la cuota/); assert.ok(a.cuadra);
  const [g] = mesT({ tratamientoDiferencia: "general" });
  const f = fuenteVehiculos([g]);
  assert.equal(f.noProduccion, 3000); assert.equal(f.detalleNoProduccion[0].general, true); assert.equal(f.detalleNoProduccion[0].categoria, "maquinaria_diferencia"); assert.equal(f.partes.length, 0);
});

test("si_la_cuota_aplico_de_mas_la_diferencia_es_negativa_y_tambien_cuenta", () => {
  const [r] = mesT({ vehiculos: [{ id: "m-tractor", nombre: "Tractor 3" }], egresos: [], tratamientoDiferencia: "aplicado" });
  assert.equal(r.costoReal, 2500); assert.equal(r.diferencia, -1500);
  assert.deepEqual(r.partes.map(p => [p.parcelaId, p.monto]), [["p7", -1125], ["p8", -375]]);
  assert.equal(conciliarMaquinaria([r], "2026-11").enCostos, 2500);
});

test("una_maquina_con_cuota_y_sin_ningun_costo_real_capturado_no_se_concilia_no_se_supone_que_costo_cero", () => {
  const [r] = vehiculosPorMes({ vehiculos: [{ id: "m-tractor", nombre: "Tractor 3" }], cuotas: cuotasT, hoy: "2026-11-30" });
  assert.equal(r.sinReal, true); assert.equal(r.diferencia, 0); assert.equal(r.pendientes.length, 0); assert.match(r.dice, /no quiere decir que costó cero/);
  const k = conciliarMaquinaria([r], "2026-11");
  assert.equal(k.sinConciliar, 1); assert.equal(k.enCostos, 4000, "se queda con lo aplicado");
});

test("la_cuota_aplicada_en_una_actividad_sin_parcela_deja_esa_parte_de_la_diferencia_pendiente", () => {
  const [r] = mesT({ cuotas: [...cuotasT, { maquinariaId: "m-tractor", fecha: "2026-11-20", parcelaId: "", costoMaq: 1000 }], tratamientoDiferencia: "aplicado" });
  assert.equal(r.diferencia, 2000); assert.equal(r.repartido, 1600); assert.equal(r.pendiente, 400); assert.ok(r.cuadra);
});
