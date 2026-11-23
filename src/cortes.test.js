import { test } from "node:test";
import assert from "node:assert/strict";
import { marcar } from "./checador.js";
import { manoDeObra, cambiarAjuste, asignar } from "./cuadrillas.js";
import { sumarDinero } from "./calculos.js";
import { cortesVigentes, pintar, borrarCelda, tablaDelDia, celdasDelDia, valorDe, instanteDeCorte, seFueAntes, propuestaDelPlan, marcasPorLoPintado, actividadDeExterno, pintadosCon, llaveDePincel } from "./cortes.js";
import { experienciaObservada, catalogoEn } from "./actividades.js";

const ENC = { id: "enc1", nombre: "ENCARGADO", rol: "encargado" };
const D = "2026-11-19";
const hist = (s) => [{ desde: "2026-01-01", sueldo_dia: s, anterior: s }];
const ANA = { id: "t-ana", nombre: "ANA", sueldo_dia: 400, historialSueldo: hist(400) };
const BETO = { id: "t-beto", nombre: "BETO", sueldo_dia: 400, historialSueldo: hist(400) };
let n = 0, reloj = 0;
const cap = () => new Date(Date.parse(`${D}T18:00:00-06:00`) + (++reloj) * 1000).toISOString();
const checa = (evs, t, hhmm) => { const r = marcar({ eventos: evs, trabajador: t, via: "pin", ahora: `${D}T${hhmm}:00-06:00`, fecha: D, quien: ENC, azar: (++n) / 1e6 }); assert.ok(r.ok, r.dice); return [...evs, r.evento]; };
const pinta = (evs, ts, corteId, parcelaId, actividad) => { const r = pintar({ eventos: evs, trabajadorIds: ts.map(t => t.id), fecha: D, corteId, cortes: cortesVigentes(evs), parcelaId, actividad, quien: ENC, capturado: cap(), azar: (++n) / 1e6 }); assert.ok(r.ok, r.dice); return [...evs, ...r.eventos]; };
const mo = (evs) => manoDeObra(evs, [ANA, BETO], { desde: D, hasta: D, hoy: "2026-11-20", ahora: `${D}T23:00:00-06:00` });
const costoEn = (r, p) => sumarDinero(r.partes.filter(x => x.parcelaId === p).map(x => x.monto));

test("pintar_los_cortes_reparte_el_dia_entre_parcelas_y_lo_no_pintado_queda_por_aclarar", () => {
  let evs = checa([], ANA, "07:00"); evs = checa(evs, ANA, "17:00");
  evs = pinta(evs, [ANA], "c1", "p1", "Riego"); evs = pinta(evs, [ANA], "c2", "p2", "Deshierbe");
  const r = mo(evs);
  // 7–10 en la uno (180 min), 10–13 en la dos (180 min), 13–17 sin pintar (240 min): el día ($400) se reparte por tiempo
  assert.equal(costoEn(r, "p1"), 120); assert.equal(costoEn(r, "p2"), 120); assert.equal(r.totalSinAsignar, 160, "lo no pintado no se le carga a la parcela de antes");
  assert.equal(sumarDinero(r.devengado.map(d => d.monto)), 400, "pintar no es pagar: su día es su día");
});

test("pintar_en_cualquier_orden_y_repintar_da_lo_mismo_y_lo_anterior_queda_en_el_historial", () => {
  let base = checa([], ANA, "07:00"); base = checa(base, ANA, "17:00");
  let a = pinta(base, [ANA], "c1", "p1", "Riego"); a = pinta(a, [ANA], "c2", "p2", "Deshierbe");
  let b = pinta(base, [ANA], "c2", "p2", "Deshierbe"); b = pinta(b, [ANA], "c1", "p1", "Riego");
  assert.deepEqual([costoEn(mo(a), "p1"), costoEn(mo(a), "p2")], [costoEn(mo(b), "p1"), costoEn(mo(b), "p2")], "el orden en que se pinta no cambia la cuenta");
  b = pinta(b, [ANA], "c1", "p2", "Deshierbe");   // se repinta el primer corte
  const c = celdasDelDia(b, { fecha: D }).get("t-ana|c1");
  assert.deepEqual(c.valor, { parcelaId: "p2", vehiculoId: null, actividad: "Deshierbe" });
  assert.equal(c.historial.length, 1); assert.equal(c.historial[0].valor.parcelaId, "p1", "lo de antes no se borra");
  assert.equal(costoEn(mo(b), "p2"), 240);
});

test("borrar_una_celda_no_borra_nada_y_ese_rato_queda_por_aclarar", () => {
  let evs = checa([], ANA, "07:00"); evs = checa(evs, ANA, "13:00");
  evs = pinta(evs, [ANA], "c1", "p1", "Riego"); evs = pinta(evs, [ANA], "c2", "p1", "Riego");
  const r0 = mo(evs); assert.equal(costoEn(r0, "p1"), 400);
  const br = borrarCelda({ trabajadorIds: ["t-ana"], fecha: D, corteId: "c2", cortes: cortesVigentes(evs), quien: ENC, capturado: cap(), azar: 0.9 });
  evs = [...evs, ...br.eventos];
  assert.equal(valorDe(celdasDelDia(evs, { fecha: D }), "t-ana", "c2"), null);
  const r = mo(evs); assert.equal(costoEn(r, "p1"), 200); assert.equal(r.totalSinAsignar, 200);
});

test("la_tabla_dice_quien_esta_pintado_y_no_checo_y_quien_checo_y_no_esta_pintado", () => {
  let evs = checa([], ANA, "07:00");
  evs = pinta(evs, [BETO], "c1", "p1", "Riego");
  const t = tablaDelDia({ eventos: evs, personas: [ANA, BETO], fecha: D, cortes: cortesVigentes(evs), hoy: D, ahora: `${D}T08:00:00-06:00` });
  assert.deepEqual(t.filas.map(f => f.persona.id), ["t-ana", "t-beto"]);
  assert.deepEqual(t.avisos.map(a => [a.clase, a.persona.id]), [["pintado_sin_checar", "t-beto"], ["sin_pintar", "t-ana"]]);
});

test("los_cortes_son_una_regla_del_rancho_y_con_la_semana_cerrada_no_se_pinta", () => {
  assert.deepEqual(cortesVigentes([]).map(c => c.nombre), ["7–10", "10–13", "14–17"]);
  const r = cambiarAjuste({ permitido: true, clave: "cortes_dia", valor: "dos", quien: { id: "u1", nombre: "ADMIN", rol: "admin" }, cuando: `${D}T06:00:00-06:00`, fecha: D });
  assert.ok(r.ok, r.dice);
  assert.deepEqual(cortesVigentes([r.evento]).map(c => c.nombre), ["7–12", "13–17"]);
  assert.equal(pintar({ eventos: [], trabajadorIds: ["t-ana"], fecha: D, corteId: "c1", cortes: cortesVigentes([]), parcelaId: "p1", actividad: "Riego", quien: ENC, capturado: cap(), semanaCerrada: true }).ok, false);
  assert.equal(instanteDeCorte(D, "07:00"), "2026-11-19T13:00:00.000Z");
});

// ─── Lo que pasó de «Registro de varios» y del reparto a la tabla (23 nov) ───
const az = () => (++n) / 1e6;

test("pintar_como_el_plan_propone_los_cortes_que_ya_empezaron_y_siguen_vacios_y_no_escoge_entre_dos_tareas_sin_hora", () => {
  const F = "2026-11-23", cortes = cortesVigentes([]);
  const ind = [
    { id: "i1", tipo: "tarea", estado: "mandada", fecha: F, asignadoA: "t1", parcelaId: "p1", que: "deshierbe" },
    { id: "i2", tipo: "tarea", estado: "mandada", fecha: F, asignadoA: "t2", parcelaId: "p1", que: "riego", hora: "07:00" },
    { id: "i3", tipo: "tarea", estado: "mandada", fecha: F, asignadoA: "t2", parcelaId: "p2", que: "deshierbe", hora: "10:00" },
    { id: "i4", tipo: "tarea", estado: "mandada", fecha: F, asignadoA: "t3", parcelaId: "p1", que: "riego" },
    { id: "i5", tipo: "tarea", estado: "mandada", fecha: F, asignadoA: "t3", parcelaId: "p2", que: "corte" },
    { id: "i6", tipo: "tarea", estado: "cambiada", fecha: F, asignadoA: "t4", parcelaId: "p1", que: "riego" },
  ];
  const ahora = "2026-11-23T17:30:00.000Z";   // 11:30 en Zacatecas: ya empezaron el corte de 7 y el de 10
  const r = propuestaDelPlan({ indicaciones: ind, fecha: F, presentes: ["t1", "t2", "t3", "t4"], celdas: new Map(), cortes, ahora, normalizar: catalogoEn([], F).normalizar });
  const de = (id, c) => r.pintar.find(g => g.corteId === c && g.ids.includes(id))?.valor || null;
  assert.equal(de("t1", "c1").parcelaId, "p1"); assert.equal(de("t1", "c2").parcelaId, "p1"); assert.equal(de("t1", "c3"), null, "el de las 2 todavía no empieza");
  assert.equal(de("t2", "c1").actividad, "Riego"); assert.equal(de("t2", "c2").parcelaId, "p2", "su segunda tarea, desde su hora");
  assert.equal(de("t3", "c1"), null); assert.ok(r.dudas.some(d => d.trabajadorId === "t3"), "dos tareas sin hora: no se escoge");
  assert.equal(de("t4", "c1"), null, "una tarea cambiada ya no es el plan");
  // Lo ya pintado no se toca.
  const celdas = new Map([["t1|c1", { valor: { parcelaId: "p9", actividad: "Corte" } }]]);
  const r2 = propuestaDelPlan({ indicaciones: ind, fecha: F, presentes: ["t1"], celdas, cortes, ahora });
  assert.equal(r2.pintar.some(g => g.corteId === "c1"), false);
});

test("a_quien_se_pinto_y_no_checo_se_le_ponen_entrada_y_salida_por_lo_pintado_solo_con_motivo_y_por_un_encargado", () => {
  const F = "2026-11-20", cortes = cortesVigentes([]);
  const p1 = pintar({ eventos: [], trabajadorIds: ["t1"], fecha: F, corteId: "c1", cortes, parcelaId: "p1", actividad: "Riego", quien: ENC, capturado: "2026-11-21T15:00:00.000Z", azar: az() });
  const p3 = pintar({ eventos: p1.eventos, trabajadorIds: ["t1"], fecha: F, corteId: "c3", cortes, parcelaId: "p1", actividad: "Riego", quien: ENC, capturado: "2026-11-21T15:00:01.000Z", azar: az() });
  const evs = [...p1.eventos, ...p3.eventos];
  const cap = "2026-11-21T15:01:00.000Z";
  assert.equal(marcasPorLoPintado({ eventos: evs, trabajadorId: "t1", fecha: F, cortes, quien: ENC, capturado: cap, motivo: "", azar: az() }).ok, false, "sin motivo no");
  assert.equal(marcasPorLoPintado({ eventos: evs, trabajadorId: "t1", fecha: F, cortes, quien: { id: "t9", nombre: "T", rol: "trabajador" }, capturado: cap, motivo: "no hay checador", azar: az() }).ok, false, "un trabajador no pone marcas");
  const r = marcasPorLoPintado({ eventos: evs, trabajadorId: "t1", fecha: F, cortes, quien: ENC, capturado: cap, motivo: "no hay checador en ese rancho", azar: az() });
  assert.equal(r.ok, true, r.dice); assert.equal(r.eventos.length, 2);
  assert.equal(r.eventos[0].cuando, instanteDeCorte(F, "07:00")); assert.equal(r.eventos[1].cuando, instanteDeCorte(F, "17:00"));
  assert.equal(r.eventos[0].datos.via, "correccion"); assert.match(r.eventos[0].datos.motivo, /checador/);
  assert.equal(marcasPorLoPintado({ eventos: [...evs, ...r.eventos], trabajadorId: "t1", fecha: F, cortes, quien: ENC, capturado: cap, motivo: "otra vez", azar: az() }).ok, false, "dos veces no: ya tiene marcas");
  // Con esas marcas su día cuenta y se reparte en la parcela pintada (el rato de la comida queda sin asignar, a la vista).
  const T1 = { id: "t1", nombre: "UNO", sueldo_dia: 400, historialSueldo: hist(400) };
  const mo = manoDeObra([...evs, ...r.eventos], [T1], { desde: F, hasta: F, hoy: "2026-11-23", ahora: "2026-11-23T12:00:00.000Z" });
  const enP1 = sumarDinero(mo.partes.filter(p => p.parcelaId === "p1").map(p => p.monto));
  assert.ok(enP1 > 0, "ya tiene horas en la parcela");
});

test("el_destajo_de_un_externo_desde_la_tabla_es_el_mismo_renglon_que_guardaba_registro_de_varios", () => {
  const sin = actividadDeExterno({ id: "a1", externo: { id: "x1", nombre: "Don X" }, fecha: "2026-11-23", parcelaId: "p1", actividad: "Deshierbe", tarifa: 25, unidades: 0, quien: ENC });
  assert.equal(sin.ok, false);
  const r = actividadDeExterno({ id: "a1", externo: { id: "x1", nombre: "Don X" }, fecha: "2026-11-23", parcelaId: "p1", actividad: "Deshierbe", tarifa: 25.5, unidades: 12, hectareas: 0.5, quien: ENC });
  assert.equal(r.ok, true); const a = r.actividad;
  assert.equal(a.costoMO, 306); assert.equal(a.costoTotal, 306); assert.equal(a.modalidadPago, "destajo");
  assert.deepEqual(a.registradoPor, { tipo: "externo", id: "x1" }); assert.equal(a.registroMasivo, true); assert.equal(a.hectareas_trab, 0.5);
});

test("un_pincel_de_vehiculo_carga_el_rato_al_vehiculo_y_dice_para_que_parcela_fue", () => {
  const F = "2026-11-23", cortes = cortesVigentes([]);
  const r = pintar({ eventos: [], trabajadorIds: ["t1"], fecha: F, corteId: "c1", cortes, vehiculoId: "m1", vehiculo: "Tractor 3", beneficiaId: "p2", parcelaId: "p9", actividad: "Barbecho", quien: ENC, capturado: "2026-11-23T20:00:00.000Z", azar: az() });
  assert.equal(r.ok, true, r.dice); const d = r.eventos[0].datos;
  assert.equal(d.vehiculoId, "m1"); assert.equal(d.parcelaId, null, "a un vehículo O a una parcela, no a los dos"); assert.equal(d.beneficiaId, "p2");
  const celdas = celdasDelDia(r.eventos, { fecha: F }), v = celdas.get("t1|c1").valor;
  assert.equal(v.vehiculo, "Tractor 3"); assert.equal(llaveDePincel(v), "|m1|p2|Barbecho");
  assert.deepEqual(pintadosCon(celdas, v), ["t1"]);
});

test("la_experiencia_observada_cuenta_dias_de_lo_registrado_solo_informa_y_no_cuenta_lo_cancelado", () => {
  const acts = [
    { trabajadorId: "t1", fecha: "2026-11-02", tipo: "Deshierbe", horas: 8 },
    { trabajadorId: "t1", fecha: "2026-11-02", tipo: "deshierbe", horas: 1 },
    { registradoPor: { tipo: "planta", id: "t1" }, fecha: "2026-10-10", tipo: "Deshierbe", horas_trab: 6 },
    { trabajadorId: "t2", fecha: "2026-11-05", tipo: "Deshierbe", horas: 8, cancelado: { motivo: "mal" } },
    { trabajadorId: "t2", fecha: "2026-11-06", tipo: "Riego", horas: 8 },
    { trabajadorId: "t3", fecha: "2024-01-01", tipo: "Deshierbe", horas: 8 },
    { registradoPor: { tipo: "externo", id: "x1" }, fecha: "2026-11-02", tipo: "Deshierbe" },
  ];
  const r = experienciaObservada(acts, { actividad: "Deshierbe", hasta: "2026-11-23" });
  assert.deepEqual(r, [{ personaId: "t1", dias: 2, horas: 15, ultima: "2026-11-02" }], "t2 cancelado, t3 hace más de 12 meses, el externo no es personal");
  assert.deepEqual(experienciaObservada(acts, { actividad: "Deshierbe", hasta: "2026-11-23", personas: ["t2"] }), []);
});

test("lo_asignado_en_equipos_de_trabajo_se_ve_en_la_tabla_no_sale_como_sin_pintar_y_pintar_el_corte_de_antes_no_lo_termina", () => {
  const cortes = cortesVigentes([]);
  let evs = checa([], ANA, "07:05");
  const a = asignar({ trabajadorIds: ["t-ana"], parcelaId: "p2", actividad: "Deshierbe", desde: `${D}T07:35:00-06:00`, fecha: D, quien: ENC, capturado: `${D}T07:35:00-06:00`, azar: az() });
  evs = [...evs, a.evento];
  const t = tablaDelDia({ eventos: evs, personas: [ANA], fecha: D, cortes, hoy: D, ahora: `${D}T11:00:00-06:00` });
  const f = t.filas[0];
  assert.equal(f.fila[0].fuera.parcelaId, "p2"); assert.equal(f.fila[1].fuera.actividad, "Deshierbe"); assert.equal(f.fila[2].fuera, null, "el corte de la tarde todavía no empieza");
  assert.equal(f.sinPintar, false); assert.ok(!t.avisos.some(x => x.clase === "sin_pintar"), "no se le dice «no está pintado» a quien tiene asignación");
  // Pintar su 7–10 en la uno: vale de 7 a 7:35 (después, lo de Equipos de trabajo) y NO se termina lo de Equipos de trabajo a las 10.
  const r = pintar({ eventos: evs, trabajadorIds: ["t-ana"], fecha: D, corteId: "c1", cortes, parcelaId: "p1", actividad: "Riego", quien: ENC, capturado: `${D}T11:00:00-06:00`, azar: az() });
  assert.equal(r.eventos.filter(e => e.tipo === "fin_asignacion").length, 0);
  evs = checa([...evs, ...r.eventos], ANA, "17:00");
  const t2 = tablaDelDia({ eventos: evs, personas: [ANA], fecha: D, cortes, hoy: D, ahora: `${D}T18:00:00-06:00` });
  assert.equal(t2.filas[0].fila[0].despues.parcelaId, "p2", "la celda pintada avisa que a medio corte cambió por Equipos de trabajo");
  const m = mo(evs); const en = (p) => sumarDinero(m.partes.filter(x => x.trabajadorId === "t-ana" && x.parcelaId === p).map(x => x.monto));
  assert.ok(en("p2") > en("p1"), "de 7:35 a 17:00 es de la dos");
});

test("si_su_ultimo_corte_no_acababa_se_le_pone_la_entrada_y_la_salida_despues_con_el_mismo_boton", () => {
  const F = "2026-11-23", cortes = cortesVigentes([]);
  const p1 = pintar({ eventos: [], trabajadorIds: ["t1"], fecha: F, corteId: "c1", cortes, parcelaId: "p1", actividad: "Riego", quien: ENC, capturado: "2026-11-23T14:00:00.000Z", azar: (++n) / 1e6 });
  const r1 = marcasPorLoPintado({ eventos: p1.eventos, trabajadorId: "t1", fecha: F, cortes, quien: ENC, capturado: "2026-11-23T14:30:00.000Z", motivo: "no checó", azar: (++n) / 1e6 });
  assert.equal(r1.eventos.length, 1, "a las 8:30 sólo la entrada: su corte acaba a las 10"); assert.equal(r1.eventos[0].datos.sentido, "entrada");
  const evs = [...p1.eventos, ...r1.eventos];
  assert.equal(marcasPorLoPintado({ eventos: evs, trabajadorId: "t1", fecha: F, cortes, quien: ENC, capturado: "2026-11-23T15:00:00.000Z", motivo: "no checó", azar: (++n) / 1e6 }).ok, false, "todavía no acaba");
  const r2 = marcasPorLoPintado({ eventos: evs, trabajadorId: "t1", fecha: F, cortes, quien: ENC, capturado: "2026-11-23T17:00:00.000Z", motivo: "no checó", azar: (++n) / 1e6 });
  assert.equal(r2.ok, true, r2.dice); assert.equal(r2.eventos.length, 1); assert.equal(r2.eventos[0].datos.sentido, "salida"); assert.equal(r2.eventos[0].cuando, instanteDeCorte(F, "10:00"));
  assert.equal(marcasPorLoPintado({ eventos: [...evs, ...r2.eventos], trabajadorId: "t1", fecha: F, cortes, quien: ENC, capturado: "2026-11-23T17:01:00.000Z", motivo: "otra", azar: (++n) / 1e6 }).ok, false, "con entrada y salida ya no");
});

test("a_quien_ya_se_fue_no_se_le_pinta_en_grupo_el_corte_siguiente", () => {
  let evs = checa([], ANA, "07:00"); evs = checa(evs, ANA, "10:00");
  assert.equal(seFueAntes(evs, { trabajadorId: "t-ana", fecha: D, instante: instanteDeCorte(D, "09:00") }), false);
  assert.equal(seFueAntes(evs, { trabajadorId: "t-ana", fecha: D, instante: instanteDeCorte(D, "10:00") }), true);
  evs = checa(evs, ANA, "14:00");
  assert.equal(seFueAntes(evs, { trabajadorId: "t-ana", fecha: D, instante: instanteDeCorte(D, "14:00") }), false, "regresó: ya no se fue");
});
