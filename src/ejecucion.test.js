// Quién ordenó, quién capturó, quién ejecutó y quién confirmó — con gente INVENTADA. Lo que se cuida: que no se
// invente a nadie, que los registros de antes se lean como estaban, y que nada de esto toque pagos ni costos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { conQuienes, quienesDe, quienesDeEvento, textoDe } from "./ejecucion.js";
import { calcularCostoManoObra, remuneracionDevengada } from "./calculos.js";

const catalogos = { trabajadores: [{ id: "t1", nombre: "PERSONA UNO" }, { id: "t2", nombre: "PERSONA DOS" }], encargados: [{ id: "e1", nombre: "ENCARGADA INVENTADA" }], agronomos: [{ id: "g1", nombre: "AGRÓNOMO INVENTADO" }], cuadrillas: [{ id: "c1", nombre: "CUADRILLA INVENTADA" }] };
const sesion = { id: "e1", nombre: "ENCARGADA INVENTADA", role: "encargado" };

test("una_actividad_capturada_por_otra_persona_separa_quien_la_hizo_de_quien_la_tecleo_y_de_quien_la_ordeno", () => {
  const a = conQuienes("actividades", { id: "a1", tipo: "Riego", registradoPor: { tipo: "planta", id: "t1" }, ordenadoPor: { id: "g1", nombre: "AGRÓNOMO INVENTADO" } }, { sesion, catalogos });
  assert.deepEqual(a.quienes, { ordeno: { id: "g1", nombre: "AGRÓNOMO INVENTADO" }, capturo: { id: "e1", nombre: "ENCARGADA INVENTADA", rol: "encargado" }, ejecutaron: [{ id: "t1", nombre: "PERSONA UNO", tipo: "planta" }], confirmo: null });
  assert.ok(!("ordenadoPor" in a), "lo de quién va en un solo lugar"); assert.deepEqual(a.registradoPor, { tipo: "planta", id: "t1" }, "lo que leen los pagos no se toca");
  const q = quienesDe("actividades", a, catalogos);
  assert.deepEqual([q.origen, q.sabeQuienEjecuto, q.personas, q.faltan], ["capturado", true, ["t1"], ["quién lo confirmó"]]);
  assert.equal(conQuienes("actividades", a, { sesion: { id: "otro" }, catalogos }), a, "lo ya anotado no se vuelve a anotar");
});

test("si_no_se_dice_quien_ordeno_queda_vacio_y_el_trabajador_que_registra_lo_suyo_es_quien_lo_hizo", () => {
  const a = conQuienes("actividades", { id: "a2", tipo: "Siembra", registradoPor: { tipo: "planta", id: "t2" } }, { sesion: { id: "t2", nombre: "PERSONA DOS", role: "trabajador" }, catalogos });
  assert.equal(a.quienes.ordeno, null); assert.equal(a.quienes.confirmo, null);
  assert.deepEqual([a.quienes.capturo.id, a.quienes.ejecutaron[0].id], ["t2", "t2"]);
  assert.deepEqual(quienesDe("actividades", a).faltan, ["quién lo ordenó", "quién lo confirmó"]);
});

test("una_cuadrilla_se_anota_como_grupo_y_de_sus_integrantes_no_se_supone_nada", () => {
  const a = conQuienes("actividades", { id: "a3", tipo: "Cosecha", registradoPor: { tipo: "cuadrilla", id: "c1" }, cuadrilla_personas: 12 }, { sesion, catalogos });
  assert.deepEqual(a.quienes.ejecutaron, [{ id: "c1", nombre: "CUADRILLA INVENTADA", tipo: "cuadrilla", grupo: true, personas: 12 }]);
  assert.deepEqual(quienesDe("actividades", a).personas, [], "a ninguna persona se le atribuye el trabajo de la cuadrilla");
  assert.equal(textoDe(a.quienes.ejecutaron), "CUADRILLA INVENTADA (12 personas, como grupo)");
});

test("quien_registra_una_aplicacion_no_es_por_eso_quien_la_aplico_y_puede_haber_varios_aplicadores", () => {
  const sin = conQuienes("aplicaciones", { id: "ap1", registradoPor: "g1", ejecutores: [], ordenadoPor: null }, { sesion: { id: "g1", nombre: "AGRÓNOMO INVENTADO", role: "agronomo" }, catalogos });
  assert.deepEqual(sin.quienes.ejecutaron, []); assert.equal(sin.quienes.capturo.id, "g1");
  assert.deepEqual([quienesDe("aplicaciones", sin).sabeQuienEjecuto, quienesDe("aplicaciones", sin).faltan[0]], [false, "quién lo ejecutó"]);
  const con = conQuienes("aplicaciones", { id: "ap2", registradoPor: "g1", ejecutores: [{ id: "t1", nombre: "PERSONA UNO" }, { id: "t2", nombre: "PERSONA DOS" }], ordenadoPor: { id: "g1", nombre: "AGRÓNOMO INVENTADO" } }, { sesion: { id: "e1", nombre: "ENCARGADA INVENTADA", role: "encargado" }, catalogos });
  assert.deepEqual(con.quienes.ejecutaron.map(e => e.id), ["t1", "t2"]); assert.equal(con.quienes.ordeno.id, "g1"); assert.equal(con.quienes.capturo.id, "e1");
  assert.ok(!("ejecutores" in con)); assert.equal(textoDe(con.quienes.ejecutaron), "PERSONA UNO, PERSONA DOS");
});

test("los_registros_de_antes_se_leen_como_estaban_sin_inventar_responsables", () => {
  // Actividad vieja del administrador: se sabe a nombre de quién y quién la capturó. Nada más.
  const vieja = { id: "v1", tipo: "Riego", registradoPor: { tipo: "planta", id: "t1" }, registradoEnNombrePor: { rol: "admin", id: "adm", nombre: "ADMINISTRADORA INVENTADA" } };
  const q = quienesDe("actividades", vieja, catalogos);
  assert.deepEqual([q.origen, q.ejecutaron.map(e => e.nombre), q.capturo.nombre, q.ordeno, q.confirmo], ["registro_anterior", ["PERSONA UNO"], "ADMINISTRADORA INVENTADA", null, null]);
  // Actividad vieja que alguien registró por su cuenta: quién la capturó no quedó anotado, y no se supone.
  const q2 = quienesDe("actividades", { id: "v2", tipo: "Riego", registradoPor: { tipo: "planta", id: "t2" } }, catalogos);
  assert.equal(q2.capturo, null); assert.ok(q2.faltan.includes("quién lo capturó"));
  // Aplicación vieja: sólo se sabe quién la capturó. No se le pone aplicador.
  const q3 = quienesDe("aplicaciones", { id: "v3", registradoPor: "g1" }, catalogos);
  assert.deepEqual([q3.origen, q3.ejecutaron, q3.capturo.nombre, q3.sabeQuienEjecuto], ["registro_anterior", [], "AGRÓNOMO INVENTADO", false]);
  // Actividad sin nadie.
  assert.deepEqual(quienesDe("actividades", { id: "v4", tipo: "Riego" }).ejecutaron, []);
  assert.equal(JSON.stringify(vieja), JSON.stringify({ id: "v1", tipo: "Riego", registradoPor: { tipo: "planta", id: "t1" }, registradoEnNombrePor: { rol: "admin", id: "adm", nombre: "ADMINISTRADORA INVENTADA" } }), "leer no cambia el registro");
});

test("el_reparto_real_dice_quien_mando_y_a_quienes", () => {
  const e = { tipo: "asignacion", quien: { id: "e1", nombre: "ENCARGADA INVENTADA", rol: "encargado" }, datos: { trabajadorIds: ["t1", "t2"], actividad: "Riego" } };
  const q = quienesDeEvento(e, catalogos);
  assert.deepEqual([q.ordeno.id, q.capturo.id, q.ejecutaron.map(x => x.nombre), q.confirmo], ["e1", "e1", ["PERSONA UNO", "PERSONA DOS"], null]);
  assert.equal(quienesDeEvento({ tipo: "marca", datos: {} }), null);
});

test("anotar_quien_hizo_que_no_cambia_el_costo_ni_lo_lee_ningun_modulo_de_dinero", () => {
  const base = { id: "a9", tipo: "Riego", fecha: "2026-11-23", horas_trab: 8, registradoPor: { tipo: "planta", id: "t1" }, costoMO: 350 };
  const con = conQuienes("actividades", base, { sesion, catalogos });
  const gente = [{ id: "t1", nombre: "PERSONA UNO", sueldo_dia: 350, categoria: "jornalero" }];
  assert.deepEqual(calcularCostoManoObra([con], gente), calcularCostoManoObra([base], gente), "el costo de mano de obra sale igual");
  assert.deepEqual(remuneracionDevengada([con], gente), remuneracionDevengada([base], gente), "y lo que le corresponde a la persona, también");
  const dinero = ["pagos.js", "resultado.js", "cierreMes.js", "cierres.js", "indirectos.js", "personal.js", "prestaciones.js", "conciliacion.js", "bonos.js", "calculos.js", "cuadrillas.js", "prestamos.js", "bajas.js", "vehiculos.js"];
  for (const f of readdirSync(new URL(".", import.meta.url)).filter(x => dinero.includes(x))) assert.ok(!/ejecucion\.js|\.quienes\b/.test(readFileSync(new URL(f, import.meta.url), "utf8")), `${f} no debe leer quién ejecutó: no es dato de pago`);
});
