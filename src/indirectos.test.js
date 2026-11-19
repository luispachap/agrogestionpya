import { test } from "node:test";
import assert from "node:assert/strict";
import { juntarFuentes, indirectoDe, costoCompleto, capturadoDespues } from "./indirectos.js";
import { vehiculosPorMes, fuenteVehiculos } from "./vehiculos.js";
import { sumarDinero } from "./calculos.js";

const CAMION = { id: "m-camion", nombre: "Camión amarillo" };
const op = (fecha, mas = {}) => ({ trabajadorId: "t-ana", fecha, vehiculoId: "m-camion", vehiculo: "Camión amarillo", actividad: "Traslado de personal", minutos: 120, monto: 100, evs: ["e"], ...mas });
const viaje = (fecha) => ({ fecha, cuadrillaId: "cq1", cuadrilla: "Los de Villa", vehiculoId: "m-camion", vehiculo: "Camión amarillo", personas: 12 });
const diesel = (fecha, costo = 1470) => ({ fecha, destino: { tipo: "vehiculo", id: "m-camion" }, articulo: "Diésel", unidad: "L", cantidad: 60, costo, evs: ["d"] });
const trabajo = (fecha) => [{ fecha, cuadrillaId: "cq1", parcelaId: "p7", personas: 9 }, { fecha, cuadrillaId: "cq1", parcelaId: "p8", personas: 3 }];
const base = { vehiculos: [CAMION], hoy: "2026-11-19",
  partes: [op("2026-10-12"), op("2026-11-18")], viajes: [viaje("2026-10-12"), viaje("2026-11-18")],
  consumos: [diesel("2026-10-12", 1000), diesel("2026-11-18", 1470)], egresos: [{ id: "g1", fecha: "2026-10-20", vehiculoId: "m-camion", concepto: "Balatas", monto: 2200 }],
  trabajo: [...trabajo("2026-10-12"), ...trabajo("2026-11-18")] };
const todo = (mas = {}) => juntarFuentes([fuenteVehiculos(vehiculosPorMes({ ...base, ...mas }))]);

test("lo_de_cada_mes_se_reparte_entre_los_usos_de_ese_mes_y_todo_suma_el_costo_original", () => {
  const t = todo();
  const oct = t.partes.filter(p => p.mes === "2026-10"), nov = t.partes.filter(p => p.mes === "2026-11");
  assert.equal(sumarDinero(oct.map(p => p.monto)), 3300, "octubre: operador 100 + diésel 1,000 + balatas 2,200");
  assert.equal(sumarDinero(nov.map(p => p.monto)), 1570, "las balatas de octubre no se le cargan a noviembre");
  assert.equal(t.repartido + t.pendiente + t.fuera, 4870, "ni un peso más que lo que costó el camión");
  assert.ok(t.partes.every(p => p.fuente === "vehiculos" && p.fecha && p.explica && p.vehiculo === "Camión amarillo"), "cada parte dice de dónde salió y cómo se calculó");
});

test("el_reporte_de_una_parcela_trae_las_dos_cifras_y_el_directo_no_cambia", () => {
  const ind = indirectoDe(todo(), { parcelaIds: ["p7"], desde: "2026-11-01", hasta: "2026-11-30" });
  assert.equal(ind.total, 1177.5, "9 de 12 personas de $1,570");
  const c = costoCompleto({ directo: 8000, indirecto: ind });
  assert.equal(c.directo, 8000); assert.equal(c.indirecto, 1177.5); assert.equal(c.completo, 9177.5);
  assert.deepEqual(c.porFuente, { "Vehículos y maquinaria": 1177.5 });
  assert.equal(costoCompleto({ directo: 8000 }).hayMas, false, "sin indirectos, las dos cifras son la misma y no se inventa nada");
});

test("una_siembra_toma_solo_su_parte_cuando_la_parcela_tuvo_dos", () => {
  const ind = indirectoDe(todo(), { parcelaIds: ["p7"], fraccion: () => 0.5 });
  assert.equal(ind.total, sumarDinero(ind.renglones.map(r => r.monto))); assert.match(ind.renglones[0].base, /50% a esta siembra/);
});

test("un_ajuste_posterior_de_valuacion_va_aparte_y_se_ve_el_directo_original", () => {
  const c = costoCompleto({ directo: 2320, ajustes: [{ diferencia: 1152, porque: "compra capturada después" }] });
  assert.equal(c.directo, 2320, "el original se conserva"); assert.equal(c.ajustes, 1152); assert.equal(c.directoAjustado, 3472); assert.equal(c.completo, 3472);
});

test("lo_que_no_se_puede_repartir_queda_pendiente_con_su_causa_y_lo_que_no_es_de_produccion_no_se_fuerza", () => {
  const sinTrabajo = todo({ trabajo: [] });
  assert.equal(sinTrabajo.repartido, 0); assert.equal(sinTrabajo.pendiente, 4870); assert.ok(sinTrabajo.pendientes.every(p => p.porque && p.mes && p.vehiculo));
  const taller = todo({ partes: [...base.partes, op("2026-11-18", { actividad: "Mantenimiento del vehículo" })] });
  assert.ok(taller.fuera > 0); assert.equal(taller.noProduccion[0].nombreFuente, "Vehículos y maquinaria");
  assert.equal(taller.repartido + taller.pendiente + taller.fuera, 4970);
});

test("la_depreciacion_corre_cada_mes_aunque_no_haya_papeles_y_si_no_hubo_uso_queda_pendiente", () => {
  const t = todo({ vehiculos: [{ ...CAMION, depreciacion_mes: 3040 }], partes: [op("2026-09-10")], viajes: [viaje("2026-09-10")], consumos: [], egresos: [], trabajo: trabajo("2026-09-10") });
  assert.ok(t.pendientes.some(p => p.mes === "2026-10" && /ningún uso registrado/.test(p.porque)), "octubre no tuvo uso: su depreciación no se le carga a nadie");
  assert.ok(t.partes.some(p => p.mes === "2026-09"));
});

test("en_un_mes_ya_cerrado_se_sabe_que_se_capturo_despues_y_cuanto_decia_antes", () => {
  const r = capturadoDespues([{ monto: 5000, fecha: "2026-10-12", capturado: "2026-10-12T15:00:00.000Z" }, { monto: 2200, fecha: "2026-10-20", capturado: "2026-11-05T10:00:00.000Z" }], "2026-10-31");
  assert.equal(r.original, 5000, "cuando cerró octubre el reporte decía $5,000"); assert.equal(r.total, 2200); assert.equal(r.posteriores.length, 1);
});
