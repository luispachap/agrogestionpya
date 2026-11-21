// La jornada, con gente, parcelas y marcas INVENTADAS. Lo que se cuida: que planear, asistir y trabajar se comparen
// sin darse por hechos entre sí, que nada se rellene, y que el cierre sea una foto que no cambia.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { jornadaDe, cerrarJornada, reabrirJornada, cierreDe, diferenciasDelCierre, tareasParaManana, MOTIVOS, T_CIERRE } from "./jornada.js";
import { marcar } from "./checador.js";
import { asignar, tramosDeTrabajo } from "./cuadrillas.js";
import { cambiarAsignacion, planDelDia, loQueLeToca } from "./asignaciones.js";
import { jornadasDe } from "./checador.js";
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
  assert.deepEqual(j.cuenta, { planeadas: 5, hechas: 1, enCurso: 0, seTrabajo: 0, sinHacer: 4, noVinieron: 1, cambios: 1, fueraDelPlan: 1, porAclarar: 3, avances: 1, incidencias: 1, incidenciasAbiertas: 1 });
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

/* ── EL RECORRIDO: siete a una parcela, se descompone la máquina, cuatro se van a otra ── */
// Todo inventado. Lo que se cuida: que el plan original se conserve, que el cambio diga quién, cuándo y por qué,
// que lo trabajado sea lo que de verdad pasó, y que NADA salga dos veces: ni gente, ni horas, ni tareas, ni pendientes.
const siete = [1, 2, 3, 4, 5, 6, 7].map(n => ({ id: `w${n}`, nombre: `TRABAJADOR ${n} INVENTADO` })), seVan = ["w4", "w5", "w6", "w7"];
const HOY = { hoy: "2026-11-24", ahora: "2026-11-24T14:00:00.000Z" };
function diaDeLaDescompostura() {
  const ev = [], mete = (r) => { assert.ok(r.ok !== false, JSON.stringify(r)); ev.push(r.evento || r.marca || r); };
  const checa = (id, hora) => mete(marcar({ eventos: ev, trabajador: siete.find(g => g.id === id), via: "pin", ahora: `${DIA}T${hora}:00-06:00`, fecha: DIA, quien: capataz }));
  // 1. La víspera: el plan manda a los siete a sembrar en San Felipe 4.
  let indicaciones = siete.map((g, k) => tarea(`s${k + 1}`, g.id, "sf4", "Mañana: sembrar ajo en San Felipe 4", { tareaId: "siembra-sf4", hora: "07:00", deQuien: "CAPATAZ INVENTADO" }));
  const planOriginal = planDelDia(indicaciones, DIA, { personas: siete, parcelas });
  // 2. Llegan los siete y el encargado los reparte de verdad a San Felipe 4 (7:10).
  for (const g of siete) checa(g.id, "07:00");
  mete(asignar({ trabajadorIds: siete.map(g => g.id), parcelaId: "sf4", actividad: "siembra", desde: `${DIA}T13:10:00.000Z`, fecha: DIA, quien: capataz, capturado: `${DIA}T13:10:00.000Z` }));
  // 3. 10:00 — se descompone la sembradora. Se reporta.
  const incidencias = [{ id: "inc-sembradora", fecha: DIA, desc: "Se descompuso la sembradora", tipo: "maquinaria", prioridad: "alta" }];
  // 4. 10:15 — el encargado cambia el PLAN de cuatro: ahora van a deshierbar La 53. Con motivo.
  const cuandoCambio = `${DIA}T16:15:00.000Z`;
  for (const id of seVan) {
    const vieja = indicaciones.find(i => i.asignadoA === id && i.estado === "mandada");
    const r = cambiarAsignacion(vieja, { parcelaId: "p53", resumen: "Deshierbar La 53" }, { quien: capataz, motivo: "Se descompuso la sembradora", cuando: cuandoCambio, id: `n-${id}`, parcelas });
    assert.ok(r.ok, r.dice);
    indicaciones = [...indicaciones.map(i => (i.id === vieja.id ? r.anterior : i)), r.nueva];
  }
  // 5. 10:20 — y los reparte de verdad a La 53.
  mete(asignar({ trabajadorIds: seVan, parcelaId: "p53", actividad: "deshierbe", desde: `${DIA}T16:20:00.000Z`, fecha: DIA, quien: capataz, capturado: `${DIA}T16:20:00.000Z` }));
  // 6. Dos de La 53 terminan lo suyo y el encargado lo confirma. Salen todos a las 3.
  indicaciones = indicaciones.map(i => (["n-w4", "n-w5"].includes(i.id) ? { ...i, respuesta: "hecha" } : i));
  for (const g of siete) checa(g.id, "15:00");
  return { ev, indicaciones, incidencias, planOriginal, cuandoCambio };
}
const jornadaDeLos7 = (d) => jornadaDe({ fecha: DIA, indicaciones: d.indicaciones, eventos: d.ev, incidencias: d.incidencias, personas: siete, parcelas, quienesChecan: siete, ...HOY });

test("recorrido_el_plan_original_se_conserva_y_el_cambio_dice_quien_cuando_y_por_que", () => {
  const d = diaDeLaDescompostura(), j = jornadaDeLos7(d);
  assert.equal(d.planOriginal.cuantas, 7, "al mandarse, el plan era de siete a San Felipe 4");
  assert.equal(d.indicaciones.length, 11, "siete renglones originales + cuatro nuevos: ninguno se borró ni se reescribió");
  for (const id of ["s4", "s5", "s6", "s7"]) { const o = d.indicaciones.find(i => i.id === id); assert.deepEqual([o.estado, o.parcelaId, o.resumen], ["cambiada", "sf4", "Mañana: sembrar ajo en San Felipe 4"], "el renglón original dice lo que decía"); }
  assert.equal(j.cambios.length, 4);
  for (const c of j.cambios) {
    assert.deepEqual([c.clase, c.donde, c.dice, c.por, c.porId, c.cuando, c.motivo], ["cambiada", "San Felipe 4", "Sembrar ajo en San Felipe 4", "CAPATAZ INVENTADO", "e1", d.cuandoCambio, "Se descompuso la sembradora"]);
    assert.equal(c.nuevaId, `n-${c.personaId}`); assert.equal(c.ahora, "Ahora va a La 53.");
    assert.equal(c.trabajoAhi.minutos, 190, "de 7:10 a 10:20 sí trabajó donde decía el plan original");
  }
  assert.equal(d.indicaciones.find(i => i.id === "n-w4").cambioDe, "s4", "el renglón nuevo apunta al anterior");
  // Lo que ve cada quien al checar después del cambio: sólo lo vigente.
  assert.deepEqual(loQueLeToca(d.indicaciones, "w4", DIA, { personas: siete, parcelas }).tareas.map(t => t.id), ["n-w4"]);
  assert.deepEqual(loQueLeToca(d.indicaciones, "w1", DIA, { personas: siete, parcelas }).tareas[0].con.length, 2, "en San Felipe 4 quedaron tres: él y dos más");
});

test("recorrido_no_se_duplican_trabajadores_ni_tareas", () => {
  const d = diaDeLaDescompostura(), j = jornadaDeLos7(d);
  assert.equal(j.tareas.length, 7, "siete tareas vigentes: tres originales y cuatro nuevas");
  assert.deepEqual(j.tareas.map(t => t.personaId).sort(), siete.map(g => g.id), "cada trabajador sale UNA vez en lo planeado");
  assert.deepEqual(j.tareas.map(t => t.id).sort(), ["n-w4", "n-w5", "n-w6", "n-w7", "s1", "s2", "s3"]);
  assert.equal(new Set([...j.tareas.map(t => t.id), ...j.cambios.map(c => c.id)]).size, 11, "ningún renglón sale a la vez como vigente y como cambiado");
  const e = Object.fromEntries(j.tareas.map(t => [t.id, t.estado]));
  assert.deepEqual(e, { s1: "se_trabajo", s2: "se_trabajo", s3: "se_trabajo", "n-w4": "hecha", "n-w5": "hecha", "n-w6": "se_trabajo", "n-w7": "se_trabajo" });
  assert.deepEqual(j.fueraDelPlan, [], "el rato en San Felipe 4 de los que se fueron era el plan de esa hora: no es «fuera del plan»");
  assert.equal(j.cuenta.planeadas, 7); assert.equal(j.cuenta.cambios, 4); assert.equal(j.cuenta.sinHacer, 0); assert.equal(j.cuenta.incidencias, 1);
});

test("recorrido_no_se_duplican_horas_cada_minuto_en_el_rancho_cae_en_un_solo_lugar", () => {
  const d = diaDeLaDescompostura(), j = jornadaDeLos7(d);
  const { tramos } = tramosDeTrabajo(d.ev, { desde: DIA, hasta: DIA, ...HOY });
  for (const g of siete) {
    const suyos = tramos.filter(t => t.trabajadorId === g.id).sort((a, b) => a.desde.localeCompare(b.desde));
    assert.equal(suyos.reduce((n, t) => n + t.minutos, 0), 480, `${g.id}: sus tramos suman sus 8 horas en el rancho, ni más ni menos`);
    for (let k = 1; k < suyos.length; k++) assert.equal(suyos[k].desde, suyos[k - 1].hasta, `${g.id}: un tramo empieza donde acaba el anterior, sin encimarse`);
    const enLaJornada = j.tareas.find(t => t.personaId === g.id).trabajo.reduce((n, t) => n + t.minutos, 0) + (j.porAclarar.find(p => p.personaId === g.id)?.minutos || 0);
    assert.equal(enLaJornada, 480, `${g.id}: lo que enseña la jornada es lo mismo, una sola vez`);
  }
  const en = (p) => tramos.filter(t => t.parcelaId === p).reduce((n, t) => n + t.minutos, 0);
  assert.equal(en("sf4"), 3 * 470 + 4 * 190, "San Felipe 4: tres todo el día y cuatro hasta las 10:20");
  assert.equal(en("p53"), 4 * 280, "La 53: cuatro desde las 10:20");
  assert.equal(en("sf4") + en("p53") + 7 * 10, 7 * 480, "todo lo trabajado + los 10 minutos sin asignar de cada quien = lo que estuvieron");
  assert.equal(jornadasDe(d.ev, { fecha: DIA, ...HOY }).length, 7, "siete asistencias, una por persona");
});

test("recorrido_a_manana_solo_pasa_lo_pendiente_que_corresponde_y_una_sola_vez", () => {
  const d = diaDeLaDescompostura(), j = jornadaDeLos7(d);
  // Quien cierra pide pasar: la siembra de los tres (no se terminó), el deshierbe de dos; y por error marca también
  // una tarea ya hecha y dos renglones originales ya cambiados.
  const c = cerrarJornada({ jornada: j, eventos: d.ev, pasan: ["s1", "s2", "s3", "n-w6", "n-w7", "n-w4", "s4", "s5"], nota: "Se descompuso la sembradora a las 10", quien: capataz, cuando: `${DIA}T22:00:00.000Z` });
  assert.ok(c.ok, c.dice);
  assert.deepEqual(c.evento.datos.pasan, ["s1", "s2", "s3", "n-w6", "n-w7"], "lo hecho no pasa; el renglón original ya cambiado tampoco");
  assert.equal(c.evento.datos.cambios.length, 4, "la foto del cierre guarda los cambios de plan con su motivo");
  assert.equal(c.evento.datos.cambios[0].motivo, "Se descompuso la sembradora");
  const cierre = cierreDe([...d.ev, c.evento], DIA).vigente, manana = "2026-11-24";
  const nuevas = tareasParaManana({ cierre, indicaciones: d.indicaciones, manana, quien: capataz, cuando: `${DIA}T22:05:00.000Z`, idNuevo: k => `m${k}` });
  assert.deepEqual(nuevas.map(x => [x.asignadoA, x.parcelaId, x.vieneDe]), [["w1", "sf4", "s1"], ["w2", "sf4", "s2"], ["w3", "sf4", "s3"], ["w6", "p53", "n-w6"], ["w7", "p53", "n-w7"]]);
  assert.equal(new Set(nuevas.map(x => x.asignadoA)).size, 5, "nadie recibe dos pendientes del mismo día");
  assert.ok(nuevas.every(x => x.estado === "mandada" && !x.respuesta && !x.cambioDe && !x.cambio), "mañana empiezan limpias: el cambio de hoy es historia de hoy");
  const conLasNuevas = [...d.indicaciones, ...nuevas];
  assert.deepEqual(tareasParaManana({ cierre, indicaciones: conLasNuevas, manana, quien: capataz, cuando: "x", idNuevo: k => `z${k}` }), [], "pedirlo otra vez no las duplica");
  assert.equal(planDelDia(conLasNuevas, manana, { personas: siete, parcelas }).cuantas, 5);
  // Y el día de hoy sigue igual que antes de pasar los pendientes.
  assert.deepEqual(diferenciasDelCierre(cierre, jornadaDe({ fecha: DIA, indicaciones: conLasNuevas, eventos: [...d.ev, c.evento], incidencias: d.incidencias, personas: siete, parcelas, quienesChecan: siete, ...HOY })), []);
});

test("quitar_a_alguien_del_plan_tambien_queda_a_la_vista_con_su_motivo", async () => {
  const { quitarAsignacion } = await import("./asignaciones.js");
  const d = diaDeLaDescompostura(), vieja = d.indicaciones.find(i => i.id === "s3");
  const r = quitarAsignacion(vieja, { quien: capataz, motivo: "Se fue a su casa, se sintió mal", cuando: `${DIA}T17:00:00.000Z` });
  const j = jornadaDeLos7({ ...d, indicaciones: d.indicaciones.map(i => (i.id === "s3" ? r.anterior : i)) });
  const q = j.cambios.find(c => c.id === "s3");
  assert.deepEqual([q.clase, q.motivo, q.nuevaId, q.ahora], ["quitada", "Se fue a su casa, se sintió mal", null, ""]);
  assert.equal(j.tareas.length, 6); assert.deepEqual(j.fueraDelPlan, [], "lo que trabajó donde decía el plan que se le quitó no es «fuera del plan»");
});
