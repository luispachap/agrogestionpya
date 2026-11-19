import { test } from "node:test";
import assert from "node:assert/strict";
import { cancelarEvento } from "./eventos.js";
import { registrarCuadrilla, registrarTraslado, costoDeCuadrillas, actividadesDeCuadrillas, integrantesConocidos, yaTieneTraslado, pagosDe } from "./eventuales.js";
import { sumarDinero } from "./calculos.js";

const ENC = { id: "enc1", nombre: "Encargado", rol: "encargado" };
const D = "2026-11-19", c = `${D}T12:00:00Z`;
let n = 0;
const base = { cuadrillaId: "cq1", cuadrilla: "Los de Villa", responsable: "Don Chuy", parcelaId: "p7", actividad: "Corte", fecha: D, cuando: c, quien: ENC };
const dia = (integrantes, mas = {}) => { const r = registrarCuadrilla({ ...base, modalidad: "dia", integrantes, azar: (++n) / 1e6, ...mas }); assert.ok(r.ok, r.dice); return r.evento; };
const destajo = (d, mas = {}) => registrarCuadrilla({ ...base, modalidad: "destajo", destajo: d, azar: (++n) / 1e6, ...mas });
const flete = (monto, mas = {}) => registrarTraslado({ cuadrillaId: "cq1", cuadrilla: "Los de Villa", tipo: "flete", monto, personas: 5, fecha: D, cuando: c, quien: ENC, azar: (++n) / 1e6, ...mas }).evento;
const costo = (evs, mas = {}) => costoDeCuadrillas(evs, { desde: D, hasta: D, ...mas });
const en = (r, parcelaId, clase) => sumarDinero(r.partes.filter(p => p.parcelaId === parcelaId && (!clase || p.clase === clase)).map(p => p.monto));

test("por_dia_cada_persona_cobra_lo_suyo_aunque_no_todos_cobren_igual", () => {
  const e = dia([{ nombre: "Juan", pagoDia: 350 }, { nombre: "  Pedro  ", pagoDia: 350 }, { nombre: "Don Chuy", pagoDia: 450 }]);
  const r = costo([e]);
  assert.equal(r.totalPagos, 1150); assert.equal(en(r, "p7"), 1150);
  assert.deepEqual(r.partes.map(p => [p.persona, p.monto]), [["Juan", 350], ["Pedro", 350], ["Don Chuy", 450]]);
  assert.equal(registrarCuadrilla({ ...base, modalidad: "dia", integrantes: [{ nombre: "Juan", pagoDia: 0 }] }).ok, false, "sin cuánto cobra no se registra");
  assert.equal(registrarCuadrilla({ ...base, modalidad: "dia", integrantes: [{ nombre: "Juan", pagoDia: 350 }, { nombre: "juan", pagoDia: 350 }] }).ok, false);
  assert.equal(registrarCuadrilla({ ...base, modalidad: "dia", integrantes: [{ nombre: "Juan", pagoDia: 350 }], quien: { id: "x", rol: "trabajador" } }).ok, false);
});

test("en_destajo_cada_quien_cobra_segun_lo_que_hizo", () => {
  const r = destajo({ unidad: "caja", tarifa: 12, produccion: [{ nombre: "Juan", cantidad: 80 }, { nombre: "Pedro", cantidad: 45 }] });
  assert.ok(r.ok);
  assert.deepEqual(pagosDe(r.evento).map(p => [p.persona, p.monto, p.parejo]), [["Juan", 960, false], ["Pedro", 540, false]]);
  assert.equal(destajo({ unidad: "caja", tarifa: 12, produccion: [{ nombre: "Juan", cantidad: 80 }, { nombre: "Pedro", cantidad: "" }] }).ok, false, "si hay relación individual, no se le inventa cantidad al que falta");
});

test("el_reparto_parejo_solo_con_el_total_del_grupo_y_con_quien_lo_autoriza", () => {
  const nombres = [{ nombre: "Juan" }, { nombre: "Pedro" }, { nombre: "Luz" }];
  const sin = destajo({ unidad: "caja", tarifa: 10, total: 100, produccion: nombres });
  assert.equal(sin.ok, false); assert.match(sin.dice, /autorice/);
  const con = destajo({ unidad: "caja", tarifa: 10, total: 100, produccion: nombres, autorizoParejo: "Migue" });
  assert.ok(con.ok); assert.equal(con.evento.datos.destajo.autorizoParejo, "Migue");
  const pagos = pagosDe(con.evento);
  assert.ok(pagos.every(p => p.parejo)); assert.equal(sumarDinero(pagos.map(p => p.monto)), 1000, "sin perder centavos");
});

test("el_flete_externo_se_reparte_entre_las_personas_transportadas_y_dice_con_que_criterio", () => {
  const a = dia([{ nombre: "Juan", pagoDia: 300 }, { nombre: "Pedro", pagoDia: 300 }, { nombre: "Luz", pagoDia: 300 }]);                       // 3 en p7
  const b = dia([{ nombre: "Ana", pagoDia: 500 }], { parcelaId: "p9", actividad: "Riego" });                                                    // 1 en p9
  const r = costo([a, b, flete(800)]);
  assert.equal(en(r, "p7", "flete"), 600); assert.equal(en(r, "p9", "flete"), 200); assert.equal(r.totalFlete, 800);
  assert.ok(r.partes.filter(p => p.clase === "flete").every(p => p.criterio === "personas" && p.evs.length === 2));
  const porPagado = costo([a, b, flete(800)], { criterioFlete: "pagado" });
  assert.equal(en(porPagado, "p7", "flete"), 514.29); assert.equal(en(porPagado, "p9", "flete"), 285.71);
  assert.equal(en(costo([a, b, flete(800)], { criterioFlete: "parejo" }), "p9", "flete"), 400);
  assert.equal(r.total, 2200, "pagos más flete, una sola vez");
});

test("un_flete_sin_trabajo_registrado_ese_dia_no_se_reparte_queda_pendiente", () => {
  const r = costo([flete(800)]);
  assert.equal(r.total, 0); assert.equal(r.fletePendiente, 800); assert.match(r.pendientes[0].dice, /no se reparte/);
});

test("el_camion_propio_no_lleva_importe_ni_inventado_ni_duplicado", () => {
  const a = dia([{ nombre: "Juan", pagoDia: 300 }]);
  const t = registrarTraslado({ cuadrillaId: "cq1", cuadrilla: "Los de Villa", tipo: "propio", vehiculoId: "m-camion", vehiculo: "Camión amarillo", personas: 12, fecha: D, cuando: c, quien: ENC });
  assert.ok(t.ok); assert.ok(!("monto" in t.evento.datos));
  const r = costo([a, t.evento]);
  assert.equal(r.totalFlete, 0); assert.equal(r.total, 300);
  assert.deepEqual(r.propios.map(p => [p.vehiculoId, p.personas]), [["m-camion", 12]], "queda dicho qué vehículo los trajo, para ligarlo a sus gastos");
  assert.equal(registrarTraslado({ cuadrillaId: "cq1", cuadrilla: "x", tipo: "propio", fecha: D, cuando: c, quien: ENC }).ok, false);
  assert.equal(registrarTraslado({ cuadrillaId: "cq1", cuadrilla: "x", tipo: "flete", monto: 0, fecha: D, cuando: c, quien: ENC }).ok, false);
  const nada = registrarTraslado({ cuadrillaId: "cq1", cuadrilla: "x", tipo: "ninguno", fecha: D, cuando: c, quien: ENC });
  assert.ok(nada.ok); assert.equal(costo([a, nada.evento]).total, 300);
  assert.ok(yaTieneTraslado([t.evento], "cq1", D) && !yaTieneTraslado([t.evento], "cq2", D));
});

test("cancelar_un_registro_de_cuadrilla_quita_su_costo_y_deja_el_flete_pendiente", () => {
  const a = dia([{ nombre: "Juan", pagoDia: 300 }]); const f = flete(500);
  const can = cancelarEvento(a, { motivo: "no vinieron", quien: ENC, cuando: c }).evento;
  const r = costo([can, f]);
  assert.equal(r.total, 0); assert.equal(r.fletePendiente, 500);
});

test("subir_dos_veces_el_mismo_registro_no_duplica_el_costo_de_la_cuadrilla", () => {
  const a = dia([{ nombre: "Juan", pagoDia: 300 }]); const f = flete(500);
  assert.equal(costo([a, f, { ...a }, { ...f }, a]).total, 800);
});

test("los_reportes_de_siempre_reciben_un_renglon_por_registro_con_pago_y_flete_separados", () => {
  const a = dia([{ nombre: "Juan", pagoDia: 300 }, { nombre: "Pedro", pagoDia: 300 }]);
  const [fila] = actividadesDeCuadrillas(costo([a, flete(500)]).partes);
  assert.equal(fila.costoMO, 600); assert.equal(fila.flete, 500); assert.equal(fila.costoTotal, 1100);
  assert.equal(fila.parcelaId, "p7"); assert.equal(fila.cuadrilla_personas, 2); assert.equal(fila._deEventos.length, 2);
});

test("la_siguiente_vez_la_app_se_acuerda_de_quienes_vinieron_y_cuanto_cobraban", () => {
  const a = dia([{ nombre: "Juan", pagoDia: 300 }, { nombre: "Pedro", pagoDia: 320 }]);
  assert.deepEqual(integrantesConocidos([a], "cq1"), [{ nombre: "Juan", pagoDia: 300 }, { nombre: "Pedro", pagoDia: 320 }]);
  assert.deepEqual(integrantesConocidos([a], "otra"), []);
});

// ── Una sola fuente: el flujo anterior y el nuevo no generan dos costos ──
import { unaSolaFuente, yaEstaEnCuadrillas, capturasAnterioresDe } from "./eventuales.js";
const vieja = (mas = {}) => ({ id: "a1", fecha: D, parcelaId: "p7", tipo: "Corte", registradoPor: { tipo: "cuadrilla", id: "cq1" }, costoMO: 1500, flete: 300, costoInsumos: 868, costoTotal: 2368, modalidadPago: "jornal", cuadrilla_personas: 4, hectareas_trab: 2, ...mas });

test("la_misma_cuadrilla_el_mismo_dia_en_las_dos_capturas_cuesta_una_sola_vez", () => {
  const ev = dia([{ nombre: "Ana", pagoDia: 350 }, { nombre: "Beto", pagoDia: 350 }]);
  const r = unaSolaFuente([vieja()], [ev]);
  const [a] = r.actividades;
  assert.equal(a.costoMO, 0); assert.equal(a.flete, 0);
  assert.equal(a.costoTotal, 868, "sus insumos siguen contando: eso no está en el registro nuevo");
  assert.equal(a.hectareas_trab, 2, "y lo demás que decía se conserva");
  assert.deepEqual(a._noCuenta.evs, [ev.id], "y dice qué registro manda");
  assert.equal(r.total, 1500);
  const todo = [...r.actividades, ...actividadesDeCuadrillas(costo([ev]).partes)];
  assert.equal(sumarDinero(todo.map(x => x.costoMO)), 700, "700 del registro nuevo, no 2,200");
});

test("si_el_registro_nuevo_se_cancela_la_captura_anterior_vuelve_a_contar", () => {
  const ev = dia([{ nombre: "Ana", pagoDia: 350 }]);
  const can = cancelarEvento(ev, { motivo: "no era esa cuadrilla", quien: ENC, cuando: c }).evento;
  const r = unaSolaFuente([vieja()], [can]);
  assert.equal(r.actividades[0].costoMO, 1500); assert.equal(r.sustituidas.length, 0);
});

test("otra_cuadrilla_otro_dia_o_un_trabajador_de_planta_no_se_tocan", () => {
  const ev = dia([{ nombre: "Ana", pagoDia: 350 }]);
  const otras = [vieja({ id: "a2", registradoPor: { tipo: "cuadrilla", id: "cq2" } }), vieja({ id: "a3", fecha: "2026-11-18" }), vieja({ id: "a4", registradoPor: { tipo: "planta", id: "cq1" } })];
  const r = unaSolaFuente(otras, [ev]);
  assert.deepEqual(r.actividades.map(a => a.costoMO), [1500, 1500, 1500]);
  assert.ok(yaEstaEnCuadrillas([ev], "cq1", D)); assert.equal(yaEstaEnCuadrillas([ev], "cq2", D), false);
  assert.equal(capturasAnterioresDe([vieja()], "cq1", D).length, 1);
});

test("un_precio_por_el_trabajo_es_un_pago_al_grupo_y_no_se_le_inventa_a_cada_quien", () => {
  const r = registrarCuadrilla({ ...base, modalidad: "precio", precio: { monto: 4000, personas: 6 }, hectareas: 3, nota: "terminaron el lote", azar: 0.5 });
  assert.ok(r.ok, r.dice);
  const k = costo([r.evento]);
  assert.equal(k.totalPagos, 4000); assert.equal(k.partes.length, 1); assert.match(k.partes[0].persona, /Don Chuy \(por el grupo\)/);
  const [fila] = actividadesDeCuadrillas(k.partes);
  assert.equal(fila.costoMO, 4000); assert.equal(fila.cuadrilla_personas, 6); assert.equal(fila.hectareas_trab, 3); assert.equal(fila.modalidadPago, "tarea");
  assert.equal(registrarCuadrilla({ ...base, modalidad: "precio", precio: { monto: 4000 } }).ok, false, "por lo menos cuántos vinieron");
  assert.equal(registrarCuadrilla({ ...base, modalidad: "precio", precio: { personas: 6 } }).ok, false);
  const f = flete(600); const conFlete = costo([r.evento, f]);
  assert.equal(conFlete.totalFlete, 600, "y el flete se le reparte por sus 6 personas");
});
