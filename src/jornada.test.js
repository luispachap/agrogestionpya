// La jornada, con gente, parcelas y marcas INVENTADAS. Lo que se cuida: que planear, asistir y trabajar se comparen
// sin darse por hechos entre sí, que nada se rellene, y que el cierre sea una foto que no cambia.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { jornadaDe, cerrarJornada, reabrirJornada, cierreDe, diferenciasDelCierre, tareasParaManana, MOTIVOS, T_CIERRE } from "./jornada.js";
import { marcar } from "./checador.js";
import { asignar } from "./cuadrillas.js";
import { registrarAvance } from "./avances.js";

const DIA = "2026-11-23", parcelas = [{ id: "sf4", nombre: "San Felipe 4" }, { id: "p53", nombre: "La 53" }];
const gente = [{ id: "t1", nombre: "JUAN INVENTADO" }, { id: "t2", nombre: "PEDRO INVENTADO" }, { id: "t3", nombre: "LUPE INVENTADA" }, { id: "t4", nombre: "CHUY INVENTADO" }, { id: "c1", nombre: "CUADRILLA INVENTADA" }];
const checan = gente.slice(0, 4), capataz = { id: "e1", nombre: "CAPATAZ INVENTADO", rol: "encargado" };
const tarea = (id, quien, parcelaId, resumen, extra = {}) => ({ id, tipo: "tarea", fecha: DIA, asignadoA: quien, parcelaId, resumen, estado: "mandada", ...extra });
const marca = (eventos, id, hora) => { const r = marcar({ eventos, trabajador: gente.find(g => g.id === id), via: "pin", ahora: `${DIA}T${hora}:00-06:00`, fecha: DIA, quien: capataz }); assert.ok(r.ok !== false, JSON.stringify(r)); return r.evento || r.marca || r; };
function unDia() {
  const ev = [];
  const mete = (e) => { ev.push(e.evento || e); };
  mete(marca(ev, "t1", "07:00")); mete(marca(ev, "t2", "07:05")); mete(marca(ev, "t3", "07:10"));
  const a1 = asignar({ trabajadorIds: ["t1"], parcelaId: "sf4", actividad: "riego", desde: `${DIA}T13:10:00.000Z`, fecha: DIA, quien: capataz, capturado: `${DIA}T13:10:00.000Z` });
  const a2 = asignar({ trabajadorIds: ["t2"], parcelaId: "p53", actividad: "deshierbe", desde: `${DIA}T13:15:00.000Z`, fecha: DIA, quien: capataz, capturado: `${DIA}T13:15:00.000Z` });
  for (const a of [a1, a2]) { assert.ok(a.ok !== false, JSON.stringify(a)); for (const e of a.eventos || [a.evento]) ev.push(e); }
  mete(marca(ev, "t1", "15:00")); mete(marca(ev, "t2", "15:00")); mete(marca(ev, "t3", "15:00"));
  const av = registrarAvance({ id: "av1", parcelaId: "sf4", parcelas, actividad: "riego", cantidad: 2, unidad: "regulador", personas: 1, quien: capataz, cuando: `${DIA}T21:00:00.000Z`, fecha: DIA });
  assert.ok(av.ok !== false, JSON.stringify(av)); ev.push(av.evento);
  const indicaciones = [
    tarea("i1", "t1", "sf4", "Mañana: regar San Felipe 4", { respuesta: "hecha" }),
    tarea("i2", "t2", "sf4", "Deshierbar San Felipe 4"),                // trabajó, pero en La 53
    tarea("i3", "t3", "p53", "Fumigar La 53"),                           // vino, sin trabajo registrado
    tarea("i4", "t4", "p53", "Cortar en La 53"),                         // no checó
    tarea("i5", "c1", "p53", "Deshierbe con la cuadrilla"),              // no checa: no hay con qué saberlo
    tarea("i6", "t1", "p53", "Algo que se quitó", { estado: "cancelada" }),
  ];
  const incidencias = [{ id: "inc1", fecha: DIA, desc: "La bomba tira aceite", tipo: "maquinaria", prioridad: "alta" }, { id: "inc0", fecha: "2026-11-20", desc: "de otro día" }];
  return { ev, indicaciones, incidencias };
}
const jornada = (d, extra = {}) => jornadaDe({ fecha: DIA, indicaciones: d.indicaciones, eventos: d.ev, incidencias: d.incidencias, personas: gente, parcelas, quienesChecan: checan, hoy: "2026-11-24", ahora: "2026-11-24T14:00:00.000Z", ...extra });

test("cada_tarea_del_plan_dice_que_se_sabe_de_ella_y_con_que_se_sabe", () => {
  const j = jornada(unDia()), e = Object.fromEntries(j.tareas.map(t => [t.id, t]));
  assert.deepEqual(j.tareas.map(t => t.id), ["i1", "i2", "i3", "i4", "i5"], "lo quitado del plan no cuenta");
  assert.equal(e.i1.estado, "hecha"); assert.equal(e.i1.dice, "Regar San Felipe 4", "el «mañana» del día que se planeó ya no se enseña");
  assert.equal(e.i2.estado, "en_otro_lado"); assert.match(e.i2.porque, /La 53/);
  assert.equal(e.i3.estado, "sin_asignar"); assert.equal(e.i3.vino, true);
  assert.equal(e.i4.estado, "no_vino"); assert.equal(e.i4.vino, false);
  assert.equal(e.i5.estado, "sin_dato"); assert.equal(e.i5.vino, null, "de quien no checa no se dice ni que vino ni que no vino");
  assert.deepEqual([e.i1.pideMotivo, e.i2.pideMotivo, e.i3.pideMotivo, e.i4.pideMotivo, e.i5.pideMotivo], [false, true, true, true, true]);
});

test("haber_trabajado_en_la_parcela_no_da_la_tarea_por_hecha", () => {
  const d = unDia(); d.indicaciones[0] = tarea("i1", "t1", "sf4", "Regar San Felipe 4");
  const t = jornada(d).tareas.find(x => x.id === "i1");
  assert.equal(t.estado, "se_trabajo"); assert.match(t.porque, /Nadie la ha marcado como terminada/); assert.match(t.porque, /7 h 50 min/);
});

test("lo_que_se_trabajo_sin_estar_en_el_plan_sale_aparte_y_la_cuenta_cuadra", () => {
  const j = jornada(unDia());
  assert.deepEqual(j.fueraDelPlan.map(f => [f.personaId, f.parcelaId]), [["t2", "p53"]], "Pedro trabajó donde el plan no decía");
  assert.deepEqual(j.porAclarar.map(p => p.personaId).sort(), ["t1", "t2", "t3"], "el rato sin asignar sólo se cuenta: se aclara en Equipos de trabajo");
  assert.deepEqual(j.incidencias.map(i => i.id), ["inc1"]); assert.equal(j.avances.length, 1);
  assert.deepEqual(j.cuenta, { planeadas: 5, hechas: 1, enCurso: 0, seTrabajo: 0, sinHacer: 4, noVinieron: 1, fueraDelPlan: 1, porAclarar: 3, avances: 1, incidencias: 1, incidenciasAbiertas: 1 });
});

test("la_jornada_no_se_cierra_sin_decir_por_que_no_se_hizo_cada_cosa", () => {
  const d = unDia(), j = jornada(d);
  const r = cerrarJornada({ jornada: j, eventos: d.ev, motivos: { i2: { motivo: "cambio_de_plan" } }, quien: capataz, cuando: `${DIA}T22:00:00.000Z` });
  assert.equal(r.ok, false); assert.deepEqual(r.faltan, ["i3", "i4", "i5"]);
  assert.equal(cerrarJornada({ jornada: j, eventos: d.ev, motivos: { i2: { motivo: "otro" }, i3: { motivo: "clima" }, i4: { motivo: "no_vino" }, i5: { motivo: "no_alcanzo" } }, quien: capataz, cuando: "x" }).ok, false, "«otro» pide que se escriba");
  assert.equal(cerrarJornada({ jornada: j, eventos: d.ev, motivos: {}, quien: { id: "t1", nombre: "x", rol: "trabajador" }, cuando: "x" }).ok, false, "no la cierra un trabajador");
  assert.ok(Object.keys(MOTIVOS).length >= 6);
});

test("el_cierre_es_una_foto_con_version_reabrir_pide_motivo_y_lo_que_llega_despues_se_ve_aparte", () => {
  const d = unDia(), j = jornada(d), motivos = { i2: { motivo: "cambio_de_plan" }, i3: { motivo: "falta_insumo", nota: "no llegó el producto" }, i4: { motivo: "no_vino" }, i5: { motivo: "no_alcanzo" } };
  const c = cerrarJornada({ jornada: j, eventos: d.ev, motivos, pasan: ["i3", "i5", "no-existe"], nota: "Día corto", quien: capataz, cuando: `${DIA}T22:00:00.000Z` });
  assert.ok(c.ok); assert.equal(c.evento.tipo, T_CIERRE); assert.deepEqual(c.evento.datos.pasan, ["i3", "i5"]); assert.equal(c.evento.datos.version, 1);
  assert.equal(c.evento.datos.tareas.find(t => t.id === "i3").nota, "no llegó el producto");
  assert.ok(!("monto" in c.evento.datos) && !JSON.stringify(c.evento.datos).includes("sueldo"), "el cierre no lleva dinero");
  const ev2 = [...d.ev, c.evento], estado = cierreDe(ev2, DIA);
  assert.equal(estado.cerrada, true); assert.equal(estado.vigente.quien, "CAPATAZ INVENTADO");
  assert.equal(cerrarJornada({ jornada: j, eventos: ev2, motivos, quien: capataz, cuando: "x" }).ok, false, "no se cierra dos veces");
  // Llega tarde un avance de otro teléfono: la foto no cambia, la diferencia se dice.
  const tarde = registrarAvance({ id: "av2", parcelaId: "p53", parcelas, actividad: "deshierbe", cantidad: 1, unidad: "regulador", quien: capataz, cuando: `${DIA}T20:00:00.000Z`, fecha: DIA }).evento;
  const dif = diferenciasDelCierre(estado.vigente, jornada({ ...d, ev: [...ev2, tarde] }));
  assert.deepEqual(dif, ["Avances: 1 al cerrar, 2 ahora."]);
  assert.deepEqual(diferenciasDelCierre(estado.vigente, jornada({ ...d, ev: ev2 })), []);
  // Reabrir: con motivo, y la foto anterior se queda.
  assert.equal(reabrirJornada({ fecha: DIA, eventos: ev2, motivo: "", quien: capataz, cuando: "x" }).ok, false);
  const r = reabrirJornada({ fecha: DIA, eventos: ev2, motivo: "Faltó anotar el avance de La 53", quien: capataz, cuando: `${DIA}T23:00:00.000Z` });
  const ev3 = [...ev2, tarde, r.evento], abierto = cierreDe(ev3, DIA);
  assert.deepEqual([abierto.cerrada, abierto.versiones, abierto.reabierta.motivo], [false, 1, "Faltó anotar el avance de La 53"]);
  const c2 = cerrarJornada({ jornada: jornada({ ...d, ev: ev3 }), eventos: ev3, motivos, quien: capataz, cuando: `${DIA}T23:30:00.000Z` });
  assert.equal(c2.evento.datos.version, 2);
  assert.deepEqual(cierreDe([...ev3, c2.evento], DIA).anteriores.map(a => a.version), [1]);
});

test("lo_que_pasa_a_manana_se_propone_como_tarea_nueva_una_sola_vez_y_no_se_manda_solo", () => {
  const d = unDia(), cierre = { pasan: ["i3", "i5"], tareas: [{ id: "i3", motivo: "falta_insumo" }, { id: "i5", motivo: "no_alcanzo" }] };
  const nuevas = tareasParaManana({ cierre, indicaciones: d.indicaciones, manana: "2026-11-24", quien: capataz, cuando: "2026-11-23T22:05:00.000Z", idNuevo: k => `n${k}` });
  assert.deepEqual(nuevas.map(x => [x.id, x.fecha, x.asignadoA, x.parcelaId, x.vieneDe, x.respuesta]), [["n0", "2026-11-24", "t3", "p53", "i3", undefined], ["n1", "2026-11-24", "c1", "p53", "i5", undefined]]);
  assert.match(nuevas[0].resumen, /Fumigar La 53 \(quedó de ayer: faltó insumo/);
  assert.deepEqual(tareasParaManana({ cierre, indicaciones: [...d.indicaciones, ...nuevas], manana: "2026-11-24", quien: capataz, cuando: "x", idNuevo: k => `z${k}` }), [], "no se duplican si ya se pasaron");
});

test("ningun_modulo_de_dinero_lee_la_jornada_ni_su_cierre", () => {
  const dinero = ["pagos.js", "resultado.js", "cierreMes.js", "cierres.js", "indirectos.js", "personal.js", "prestaciones.js", "conciliacion.js", "bonos.js", "calculos.js", "cuadrillas.js"];
  for (const f of readdirSync(new URL(".", import.meta.url)).filter(x => dinero.includes(x))) {
    const s = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.ok(!/jornada\.js|cierre_jornada|reapertura_jornada/.test(s), `${f} no debe leer la jornada`);
  }
});
