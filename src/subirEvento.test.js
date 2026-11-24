import { test } from "node:test";
import assert from "node:assert/strict";
import { subirEvento, versionAlNacer } from "./subirEvento.js";

// Una base de imitación que hace lo que hace PostgreSQL con las reglas de la hoja 35: un evento sólo NACE vigente, y esa
// regla se revisa también cuando el upsert termina actualizando uno que ya estaba.
function base({ puedeEditar = true } = {}) {
  const t = new Map(); const pasos = [];
  const rls = () => ({ data: null, error: { code: "42501", message: "new row violates row-level security policy for table \"eventos\"" } });
  return {
    t, pasos,
    cliente: {
      upsert: async (f) => { pasos.push("upsert"); if (f.estado !== "vigente") return rls(); t.set(f.id, f); return { data: [f], error: null }; },
      insert: async (f) => { pasos.push("insert"); if (t.has(f.id)) return { data: null, error: { code: "23505", message: "duplicate key" } }; if (f.estado !== "vigente") return rls(); t.set(f.id, f); return { data: [f], error: null }; },
      update: async (f) => { pasos.push("update"); if (!t.has(f.id) || !puedeEditar) return { data: [], error: null }; t.set(f.id, f); return { data: [f], error: null }; },
    },
  };
}
const aFila = (o) => ({ id: o.id, tipo: o.tipo, estado: o.estado || "vigente", datos: { ...o, id: undefined, tipo: undefined, estado: undefined } });
const marca = { id: "ev-marca-1", tipo: "marca", estado: "vigente", datos: { sentido: "entrada" } };

test("un_evento_vigente_se_sube_como_siempre", async () => {
  const b = base(); await subirEvento(b.cliente, marca, aFila);
  assert.deepEqual(b.pasos, ["upsert"]); assert.equal(b.t.get("ev-marca-1").estado, "vigente");
});
test("una_marca_corregida_que_ya_estaba_en_la_base_se_actualiza_y_no_se_rechaza", async () => {
  const b = base(); await subirEvento(b.cliente, marca, aFila);
  const corregida = { ...marca, estado: "corregido", corregidoPor: "ev-marca-2" };
  await subirEvento(b.cliente, corregida, aFila);
  assert.deepEqual(b.pasos, ["upsert", "update"], "no se intenta con upsert: la base lo rechazaba siempre");
  assert.equal(b.t.get("ev-marca-1").estado, "corregido");
});
test("un_evento_creado_y_cancelado_sin_senal_primero_nace_vigente_y_luego_se_cancela", async () => {
  const b = base();
  const cancelado = { ...marca, estado: "cancelado", cancelado: { motivo: "PIN prestado", por: { id: "c1" }, cuando: "2026-11-24T17:00:00Z" } };
  const nacio = []; const cliente = { ...b.cliente, insert: async (f) => { nacio.push(f); return b.cliente.insert(f); } };
  await subirEvento(cliente, cancelado, aFila);
  assert.deepEqual(b.pasos, ["update", "insert", "update"]);
  assert.equal(nacio[0].estado, "vigente"); assert.equal(nacio[0].datos.cancelado, undefined, "nace sin la cancelación");
  assert.equal(b.t.get("ev-marca-1").estado, "cancelado"); assert.equal(b.t.get("ev-marca-1").datos.cancelado.motivo, "PIN prestado");
});
test("si_la_cuenta_no_puede_editar_el_evento_es_un_rechazo_y_no_falta_de_senal", async () => {
  const b = base({ puedeEditar: false }); await subirEvento(b.cliente, marca, aFila);
  await assert.rejects(() => subirEvento(b.cliente, { ...marca, estado: "cancelado", cancelado: { motivo: "x" } }, aFila), (e) => e.code === "42501");
  assert.equal(b.t.get("ev-marca-1").estado, "vigente", "lo de la base no cambió");
});
test("la_version_al_nacer_quita_solo_lo_que_trae_la_cancelacion_o_la_correccion", () => {
  const v = versionAlNacer({ id: "e", tipo: "marca", estado: "corregido", corregidoPor: "e2", cancelado: null, datos: { a: 1 }, _nace: "n1" });
  assert.deepEqual(v, { id: "e", tipo: "marca", estado: "vigente", datos: { a: 1 }, _nace: "n1" });
});
