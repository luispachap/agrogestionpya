import { test } from "node:test";
import assert from "node:assert/strict";
import { subirRegistro, mismoRegistro } from "./subir.js";
import { versionAlNacer } from "./subirEvento.js";

// Una base de imitación con las reglas que importan aquí (hojas 22, 35 y 56), hechas como las hace PostgreSQL:
//  · un evento sólo NACE vigente, y esa regla se revisa también cuando un upsert acaba actualizando;
//  · la bitácora de auditoría no tiene regla para cambiar: un upsert de algo que ya estaba se rechaza;
//  · quien no puede editar, al actualizar no toca nada (cero renglones, sin error);
//  · un identificador ocupado por otro registro (otra marca de nacimiento) no se pisa.
function base({ puedeEditar = true } = {}) {
  const t = {}; const pasos = [];
  const tabla = (n) => (t[n] ||= new Map());
  const rls = (n) => ({ data: null, error: { code: "42501", message: `new row violates row-level security policy for table "${n}"` } });
  const ocupado = (n, id) => ({ data: null, error: { code: "23505", message: `identificador_ocupado: ya existe otro registro con el identificador "${id}" en ${n}.` } });
  const nace = (f) => f?.datos?._nace ?? null;
  return {
    t, pasos, fila: (n, id) => tabla(n).get(id),
    cliente: {
      upsert: async (n, f, { soloFaltantes = false } = {}) => {
        pasos.push(`upsert${soloFaltantes ? "-alta" : ""} ${n}`);
        if (n === "eventos" && f.estado !== "vigente") return rls(n);          // la regla de nacer, siempre
        const ya = tabla(n).get(f.id);
        if (ya && soloFaltantes) return { data: [], error: null };              // ya estaba: no se toca
        if (ya && (n === "auditoria" || !puedeEditar)) return rls(n);            // camino de actualizar sin permiso
        if (ya && nace(ya) && nace(ya) !== nace(f)) return ocupado(n, f.id);
        tabla(n).set(f.id, f); return { data: [f], error: null };
      },
      insert: async (n, f) => { pasos.push(`insert ${n}`); if (tabla(n).has(f.id)) return { data: null, error: { code: "23505", message: "duplicate key" } }; if (n === "eventos" && f.estado !== "vigente") return rls(n); tabla(n).set(f.id, f); return { data: [f], error: null }; },
      update: async (n, f) => {
        pasos.push(`update ${n}`);
        const ya = tabla(n).get(f.id);
        if (!ya || !puedeEditar || n === "auditoria") return { data: [], error: null };
        if (n === "eventos" && ya.estado !== "vigente") return { data: [ya], error: null };   // lo ya cancelado no se mueve
        tabla(n).set(f.id, f); return { data: [f], error: null };
      },
      leer: async (n, id) => { pasos.push(`leer ${n}`); return { data: tabla(n).get(id) || null, error: null }; },
    },
  };
}
const marca = { id: "ev-marca-mi3k2q1-abc1234", tipo: "marca", fecha: "2026-11-24", estado: "vigente", sentido: "entrada", _nace: "n-1" };
const renglon = { id: "a1795222807822b1rzyng3", fecha: "2026-11-24", tabla: "egresos", registroId: "e1", accion: "cancelo", quien: "Admin", _nace: "n-a" };

test("un_evento_vigente_se_da_de_alta_una_sola_vez", async () => {
  const b = base(); await subirRegistro(b.cliente, "eventos", marca);
  assert.deepEqual(b.pasos, ["upsert-alta eventos"]); assert.equal(b.fila("eventos", marca.id).estado, "vigente");
});
test("una_marca_corregida_que_ya_estaba_en_la_base_se_actualiza_y_no_se_rechaza", async () => {
  const b = base(); await subirRegistro(b.cliente, "eventos", marca);
  await subirRegistro(b.cliente, "eventos", { ...marca, estado: "corregido", corregidoPor: "ev-marca-2" });
  assert.deepEqual(b.pasos, ["upsert-alta eventos", "update eventos"], "no se intenta con upsert: la base lo rechazaba siempre");
  assert.equal(b.fila("eventos", marca.id).estado, "corregido");
});
test("un_evento_creado_y_cancelado_sin_senal_primero_nace_vigente_y_luego_se_cancela", async () => {
  const b = base();
  await subirRegistro(b.cliente, "eventos", { ...marca, estado: "cancelado", cancelado: { motivo: "PIN prestado", por: { id: "c1" }, cuando: "2026-11-24T17:00:00Z" } });
  assert.deepEqual(b.pasos, ["update eventos", "upsert-alta eventos", "update eventos"]);
  const f = b.fila("eventos", marca.id);
  assert.equal(f.estado, "cancelado"); assert.equal(f.datos.cancelado.motivo, "PIN prestado");
});
test("si_la_cuenta_no_puede_editar_el_evento_es_un_rechazo_y_no_falta_de_senal", async () => {
  const b = base({ puedeEditar: false }); await subirRegistro(b.cliente, "eventos", marca);
  await assert.rejects(() => subirRegistro(b.cliente, "eventos", { ...marca, estado: "cancelado", cancelado: { motivo: "x" } }), (e) => e.code === "42501");
  assert.equal(b.fila("eventos", marca.id).estado, "vigente", "lo de la base no cambió");
});
test("la_version_al_nacer_quita_solo_lo_que_trae_la_cancelacion_o_la_correccion", () => {
  const v = versionAlNacer({ id: "e", tipo: "marca", estado: "corregido", corregidoPor: "e2", cancelado: null, datos: { a: 1 }, _nace: "n1" });
  assert.deepEqual(v, { id: "e", tipo: "marca", estado: "vigente", datos: { a: 1 }, _nace: "n1" });
});

/* ── Con mala señal la base guarda y la respuesta no llega: el teléfono vuelve a subir lo mismo ── */
test("un_evento_que_ya_subio_y_se_vuelve_a_subir_no_se_rechaza_aunque_la_cuenta_no_pueda_editar", async () => {
  const b = base({ puedeEditar: false });                     // como el agrónomo: crea eventos, no los edita
  await subirRegistro(b.cliente, "eventos", marca);
  const otra = await subirRegistro(b.cliente, "eventos", marca);
  assert.equal(otra.id, marca.id, "regresa el que ya estaba, con su sello");
  assert.deepEqual(b.pasos, ["upsert-alta eventos", "upsert-alta eventos", "leer eventos"]);
});
test("un_renglon_de_la_bitacora_que_ya_subio_no_se_rechaza_al_reintentar", async () => {
  const b = base();
  await subirRegistro(b.cliente, "auditoria", renglon);
  await subirRegistro(b.cliente, "auditoria", renglon);       // antes: upsert → camino de actualizar → la base lo rechazaba
  assert.equal(b.t.auditoria.size, 1);
});
test("una_cancelacion_que_ya_subio_y_se_vuelve_a_subir_no_se_rechaza", async () => {
  const b = base(); await subirRegistro(b.cliente, "eventos", marca);
  const cancelado = { ...marca, estado: "cancelado", cancelado: { motivo: "PIN prestado" } };
  await subirRegistro(b.cliente, "eventos", cancelado);
  await subirRegistro(b.cliente, "eventos", cancelado);
  assert.equal(b.fila("eventos", marca.id).estado, "cancelado");
});
test("otro_registro_en_el_mismo_identificador_se_dice_como_ocupado_y_no_se_da_por_subido", async () => {
  for (const [tabla, r] of [["eventos", marca], ["auditoria", renglon]]) {
    const b = base(); await subirRegistro(b.cliente, tabla, r);
    await assert.rejects(() => subirRegistro(b.cliente, tabla, { ...r, _nace: "otra-marca" }), (e) => /identificador_ocupado/.test(e.message), tabla);
  }
  assert.equal(mismoRegistro({ id: "x" }, { id: "x", _nace: "n" }), true, "sin marca guardada no hay nada que cuidar (igual que la base)");
});
test("un_registro_comun_se_sube_encima_alta_o_correccion", async () => {
  const b = base(); const g = { id: "e1795222807822b1rzyng3", fecha: "2026-11-24", monto: 300, _nace: "n-e" };
  await subirRegistro(b.cliente, "egresos", g); await subirRegistro(b.cliente, "egresos", { ...g, monto: 350 });
  assert.equal(b.fila("egresos", g.id).datos.monto, 350); assert.deepEqual(b.pasos, ["upsert egresos", "upsert egresos"]);
});

/* ── Quien puede dar de alta y no corregir (el agrónomo con las actividades, el encargado con los externos) ── */
const actividad = { id: "act1795222807822b1rzyng3", parcelaId: "pa1", fecha: "2026-11-24", tipo: "Riego", horas: 6, trabajadorId: "t1", _nace: "n-act" };
test("una_actividad_que_ya_subio_y_se_reintenta_no_se_rechaza_aunque_la_cuenta_solo_pueda_dar_de_alta", async () => {
  const b = base({ puedeEditar: false });
  await subirRegistro(b.cliente, "actividades", actividad);
  assert.equal(await subirRegistro(b.cliente, "actividades", { ...actividad, _actualizado: "2026-11-24T20:00:00Z" }), null);
  assert.deepEqual(b.pasos, ["upsert actividades", "upsert actividades", "leer actividades"]);
});
test("una_correccion_de_quien_solo_puede_dar_de_alta_se_dice_como_rechazo_y_no_como_subida", async () => {
  const b = base({ puedeEditar: false });
  await subirRegistro(b.cliente, "actividades", actividad);
  await assert.rejects(() => subirRegistro(b.cliente, "actividades", { ...actividad, horas: 8 }), (e) => e.code === "42501");
  assert.equal(b.fila("actividades", actividad.id).datos.horas, 6, "lo de la base no cambió");
});
test("otro_registro_en_el_identificador_de_quien_solo_puede_dar_de_alta_se_dice_como_ocupado", async () => {
  const b = base({ puedeEditar: false });
  await subirRegistro(b.cliente, "actividades", actividad);
  await assert.rejects(() => subirRegistro(b.cliente, "actividades", { ...actividad, _nace: "n-otro" }), (e) => e.code === "23505");
});
