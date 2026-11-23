import { test } from "node:test";
import assert from "node:assert/strict";
import { guardarCorridaViva, leerCorridaViva, borrarCorridaViva, tieneAlgo } from "./corridaViva.js";

const almacen = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), m }; };
const viva = { corridaId: "cor1", folioCorrida: "COR-000001", contador: { 7: 30, 8: 24 }, poolIds: ["e1"], estibaOrigenId: "e1", estibasCerradas: [{ id: "c1", cajas: 30 }], conteos: [{ limpioQueda: 10 }], responsable: "PRUEBA" };

test("salir_de_la_corrida_y_volver_el_mismo_dia_la_retoma_con_sus_cajas_contadas", () => {
  const a = almacen();
  assert.equal(guardarCorridaViva(a, "k", viva, "2026-11-22"), true);
  const r = leerCorridaViva(a, "k", "2026-11-22");
  assert.deepEqual(r.contador, { 7: 30, 8: 24 });
  assert.equal(r.corridaId, "cor1"); assert.equal(r.estibasCerradas.length, 1); assert.equal(r.conteos[0].limpioQueda, 10);
});

test("la_corrida_de_ayer_no_se_revive_sola", () => {
  const a = almacen(); guardarCorridaViva(a, "k", viva, "2026-11-21");
  assert.equal(leerCorridaViva(a, "k", "2026-11-22"), null);
});

test("una_corrida_sin_nada_contado_no_deja_foto_y_al_terminar_se_borra", () => {
  const a = almacen();
  assert.equal(tieneAlgo({ corridaId: "x", contador: { 7: 0 }, poolIds: [] }), false);
  assert.equal(guardarCorridaViva(a, "k", { corridaId: "x", contador: { 7: 0 }, poolIds: [] }, "2026-11-22"), false);
  assert.equal(leerCorridaViva(a, "k", "2026-11-22"), null);
  guardarCorridaViva(a, "k", viva, "2026-11-22"); borrarCorridaViva(a, "k");
  assert.equal(leerCorridaViva(a, "k", "2026-11-22"), null);
});

test("una_foto_dañada_o_un_telefono_lleno_no_truenan_la_corrida", () => {
  const a = almacen(); a.setItem("k", "{esto no es json");
  assert.equal(leerCorridaViva(a, "k", "2026-11-22"), null);
  const lleno = { getItem: () => null, setItem: () => { throw new Error("lleno"); }, removeItem: () => {} };
  assert.equal(guardarCorridaViva(lleno, "k", viva, "2026-11-22"), false);
});

import { quitarDeLaCorrida as quitar_t } from "./corridaViva.js";
// Defecto 16: los cortes, conteos y entradas de limpio se podían borrar sin motivo ni rastro.
test("quitar_un_corte_de_la_corrida_pide_el_porque_y_deja_rastro", () => {
  const lista = [{ id: "c1", hora: "08:15", total: 40 }, { id: "c2", hora: "08:30", total: 82 }];
  assert.equal(quitar_t(lista, "c1", { tipo: "corte", motivo: " ", hora: "08:40" }).ok, false, "sin motivo no se quita");
  assert.equal(quitar_t(lista, "nada", { tipo: "corte", motivo: "x", hora: "08:40" }).ok, false);
  const r = quitar_t(lista, "c1", { tipo: "corte", motivo: "Se contó dos veces", hora: "08:40", quien: "Miguel" });
  assert.ok(r.ok); assert.deepEqual(r.lista.map(x => x.id), ["c2"], "sale de las cuentas");
  assert.deepEqual(r.quitado, { tipo: "corte", registro: lista[0], motivo: "Se contó dos veces", hora: "08:40", quien: "Miguel" }, "y queda con qué era, por qué, a qué hora y quién");
});
