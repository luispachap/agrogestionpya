import { test } from "node:test";
import assert from "node:assert/strict";
import { marcar } from "./checador.js";
import { manoDeObra, asignar, terminar, aclararTiempo } from "./cuadrillas.js";
import { tiempoEsperando } from "./espera.js";
import { cortesVigentes, pintar, instanteDeCorte } from "./cortes.js";

const ENC = { id: "enc1", nombre: "ENCARGADO", rol: "encargado" };
const D = "2026-11-19"; let n = 0; const az = () => (++n) / 1e6;
const hist = (s) => [{ desde: "2026-01-01", sueldo_dia: s, anterior: s }];
const ANA = { id: "t-ana", nombre: "ANA", sueldo_dia: 600, historialSueldo: hist(600) };
const BETO = { id: "t-beto", nombre: "BETO", sueldo_dia: 600, historialSueldo: hist(600) };
const h = (hhmm) => `${D}T${hhmm}:00-06:00`;
const checa = (evs, t, hhmm) => { const r = marcar({ eventos: evs, trabajador: t, via: "pin", ahora: h(hhmm), fecha: D, quien: ENC, azar: az() }); assert.ok(r.ok, r.dice); return [...evs, r.evento]; };
const manda = (evs, ts, hhmm, parcelaId, actividad) => { const r = asignar({ trabajadorIds: ts.map(t => t.id), parcelaId, actividad, desde: h(hhmm), fecha: D, quien: ENC, capturado: h("23:00"), azar: az() }); assert.ok(r.ok, r.dice); return [...evs, r.evento]; };
const acaba = (evs, ts, hhmm) => { const r = terminar({ trabajadorIds: ts.map(t => t.id), desde: h(hhmm), fecha: D, quien: ENC, capturado: h("23:00"), azar: az() }); assert.ok(r.ok); return [...evs, r.evento]; };
const mo = (evs) => manoDeObra(evs, [ANA, BETO], { desde: D, hasta: D, hoy: "2026-11-20", ahora: h("23:00") });

test("el_tiempo_esperando_tarea_es_el_rato_de_la_entrada_a_su_primera_tarea_y_entre_una_tarea_y_otra", () => {
  // Ana entra 7:00, la mandan 7:30; acaba 11:00 y la vuelven a mandar 11:45; sale 16:00 (9 h; $600 el día).
  let evs = checa([], ANA, "07:00"); evs = manda(evs, [ANA], "07:30", "p1", "Riego"); evs = acaba(evs, [ANA], "11:00"); evs = manda(evs, [ANA], "11:45", "p2", "Deshierbe"); evs = checa(evs, ANA, "16:00");
  const r = tiempoEsperando(mo(evs));
  assert.equal(r.porMomento.al_llegar.minutos, 30); assert.equal(r.porMomento.entre_tareas.minutos, 45);
  assert.equal(r.esperando.minutos, 75); assert.equal(r.esperando.veces, 2);
  // En pesos: su día ($600) entre sus 540 minutos, por los 75 que esperó.
  assert.ok(Math.abs(r.esperando.monto - 600 * 75 / 540) < 0.05, r.esperando.monto);
  assert.equal(r.esperando.sinAclarar.minutos, 75, "nadie lo ha aclarado: es posible espera");
  assert.equal(r.porPersona[0].trabajadorId, "t-ana");
});

test("lo_aclarado_como_espera_se_confirma_y_un_descanso_o_traslado_no_cuenta_como_esperar_tarea", () => {
  let evs = checa([], ANA, "07:00"); evs = manda(evs, [ANA], "07:30", "p1", "Riego"); evs = acaba(evs, [ANA], "11:00"); evs = manda(evs, [ANA], "11:45", "p2", "Deshierbe"); evs = checa(evs, ANA, "16:00");
  const e1 = aclararTiempo({ trabajadorId: "t-ana", fecha: D, desde: new Date(h("07:00")).toISOString(), hasta: new Date(h("07:30")).toISOString(), causa: "espera", quien: ENC, cuando: h("23:00"), azar: az() });
  const e2 = aclararTiempo({ trabajadorId: "t-ana", fecha: D, desde: new Date(h("11:00")).toISOString(), hasta: new Date(h("11:45")).toISOString(), causa: "traslado", quien: ENC, cuando: h("23:00"), azar: az() });
  const r = tiempoEsperando(mo([...evs, e1.evento, e2.evento]));
  assert.equal(r.esperando.confirmado.minutos, 30); assert.equal(r.esperando.sinAclarar.minutos, 0);
  assert.equal(r.esperando.minutos, 30, "el traslado no es esperar tarea"); assert.equal(r.conOtraCausa.minutos, 45);
});

test("la_comida_entre_cortes_y_lo_de_despues_de_su_ultima_tarea_no_son_esperar_tarea", () => {
  const cortes = cortesVigentes([]);
  let evs = checa([], BETO, "07:00"); evs = checa(evs, BETO, "17:30");
  ["c1", "c2", "c3"].forEach((c, i) => { const r = pintar({ eventos: evs, trabajadorIds: ["t-beto"], fecha: D, corteId: c, cortes, parcelaId: "p1", actividad: "Riego", quien: ENC, capturado: h(`23:0${i}`), azar: az() }); evs = [...evs, ...r.eventos]; });
  const huecos = (f) => [{ desde: instanteDeCorte(f, "13:00"), hasta: instanteDeCorte(f, "14:00") }];
  const r = tiempoEsperando(mo(evs), { huecos });
  assert.equal(r.porMomento.comida.minutos, 60); assert.equal(r.porMomento.al_final.minutos, 30, "de 17:00 a 17:30");
  assert.equal(r.esperando.minutos, 0, "nada de eso es esperar tarea");
  // Sin decirle cuáles son los cortes, la comida saldría como «entre tareas»: por eso la pantalla se los pasa.
  assert.equal(tiempoEsperando(mo(evs)).porMomento.entre_tareas.minutos, 60);
});

test("a_quien_no_se_le_asigno_nada_en_todo_el_dia_no_se_le_cuenta_como_espera_sino_por_aclarar", () => {
  let evs = checa([], ANA, "07:00"); evs = checa(evs, ANA, "15:00");
  const m = mo(evs), r = tiempoEsperando(m);
  assert.equal(r.esperando.minutos, 0); assert.equal(r.renglones.length, 0);
  assert.equal(m.porAclarar.minutos, 480, "sigue saliendo donde siempre, por aclarar");
});
