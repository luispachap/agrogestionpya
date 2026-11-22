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
