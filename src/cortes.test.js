import { test } from "node:test";
import assert from "node:assert/strict";
import { marcar } from "./checador.js";
import { manoDeObra, cambiarAjuste } from "./cuadrillas.js";
import { sumarDinero } from "./calculos.js";
import { cortesVigentes, pintar, borrarCelda, tablaDelDia, celdasDelDia, valorDe, instanteDeCorte } from "./cortes.js";

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
