import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { espacioDe, llavesDe, llavesQueSeReinician, marcarEspacio, loDeAntes, sobreDeRespaldo, revisarRespaldo, LLAVES_ANTERIORES } from "./espacio.js";

test("cada_proyecto_de_la_nube_es_un_espacio_con_su_propio_cajon", () => {
  assert.equal(espacioDe("https://abcdefgh.supabase.co"), "abcdefgh");
  assert.equal(espacioDe(""), "local"); assert.equal(espacioDe("http://sin-configurar.invalid"), "local");
  const a = llavesDe("abcdefgh"), b = llavesDe("zzzz");
  for (const k of Object.keys(a)) assert.notEqual(a[k], b[k], k);
});

test("ninguna_llave_nueva_coincide_con_las_de_antes", () => {
  for (const e of ["local", "abcdefgh"]) for (const k of Object.values(llavesDe(e))) assert.ok(!LLAVES_ANTERIORES.includes(k), k);
});

test("reiniciar_el_telefono_solo_borra_lo_de_este_espacio_nunca_lo_de_antes", () => {
  const borra = llavesQueSeReinician("abcdefgh");
  for (const k of LLAVES_ANTERIORES) assert.ok(!borra.includes(k), k);
  assert.ok(!borra.includes(llavesDe("abcdefgh").campo), "ni desliga el teléfono de campo");
});

test("la_app_no_nombra_las_llaves_viejas_en_ningun_otro_lado", () => {
  // Si alguien vuelve a escribir "agro_v7" en la app, los datos de prueba vuelven a entrar.
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8") + readFileSync(new URL("./acceso.js", import.meta.url), "utf8");
  for (const k of LLAVES_ANTERIORES) assert.equal(app.includes(`"${k}"`), false, `App.jsx o acceso.js nombran ${k}`);
  assert.equal(/localStorage\.clear\(\)/.test(app), false, "nadie borra TODO el teléfono: ahí vive lo de antes");
});

test("la_marca_del_espacio_se_pone_una_vez_y_no_se_cambia", () => {
  assert.equal(marcarEspacio({ id: 1 }, "abc")._espacio, "abc");
  assert.equal(marcarEspacio({ id: 1, _espacio: "otro" }, "abc")._espacio, "otro");
});

test("lo_de_antes_se_cuenta_sin_abrirlo", () => {
  const tel = { agro_v7: '{"egresos":[1,2,3]}', agro_pending_v7: "[]", "agro_v8:abc": "{}" };
  const r = loDeAntes(k => (k in tel ? tel[k] : null));
  assert.equal(r.hay, true); assert.deepEqual(r.hallado.map(h => h.llave), ["agro_v7", "agro_pending_v7"]);
  assert.equal(loDeAntes(() => null).hay, false);
});

test("un_respaldo_de_antes_no_se_puede_restaurar_en_la_operacion_nueva", () => {
  const viejo = { parcelas: [{ id: "p1" }], egresos: [{ id: "e1", monto: 999999 }] };
  const r = revisarRespaldo(viejo, "abcdefgh");
  assert.equal(r.entra, false); assert.equal(r.deAntes, true);
  assert.match(r.dice, /revisión de catálogos/);
});

test("un_respaldo_de_otro_espacio_tampoco_y_el_de_este_si", () => {
  const datos = { parcelas: [], egresos: [{ id: "e1" }] };
  const deOtro = sobreDeRespaldo(datos, "pruebas", "2026-11-19T10:00:00Z");
  assert.equal(revisarRespaldo(deOtro, "abcdefgh").entra, false);
  const propio = revisarRespaldo(sobreDeRespaldo(datos, "abcdefgh", "2026-11-19T10:00:00Z"), "abcdefgh");
  assert.equal(propio.entra, true); assert.deepEqual(propio.datos, datos);
  assert.equal(revisarRespaldo([1, 2], "abcdefgh").entra, false);
});

// ── Respaldo fiel y recuperación (cierre de la versión 1.0) ──
import { soloLoCapturado, respaldoParaOtroEspacio } from "./espacio.js";
test("el_respaldo_lleva_lo_capturado_y_no_las_cuentas_ya_hechas", () => {
  const enPantalla = { inventario: [{ id: "i1", existencia: 20 }], eventos: [{ id: "e1" }], actividadesContables: [{ id: "x" }], almacen: { consumos: [] }, indirectos: {}, _seed_encargado: true, egresos: "no es lista" };
  const r = soloLoCapturado(enPantalla, ["inventario", "eventos", "egresos", "trabajadores"]);
  assert.deepEqual(Object.keys(r).sort(), ["eventos", "inventario"]);
  assert.equal(r.inventario[0].existencia, 20, "el punto de partida, tal como se guardó");
});
test("un_respaldo_solo_pasa_a_otra_base_si_se_le_cambia_el_espacio_a_proposito", () => {
  const original = sobreDeRespaldo({ trabajadores: [{ id: "t1", nombre: "PERSONA INVENTADA", _espacio: "viejo" }], eventos: [{ id: "e1", tipo: "marca", _espacio: "viejo", datos: { x: 1 } }] }, "viejo", "2026-11-23T00:00:00Z");
  assert.equal(revisarRespaldo(original, "nuevo").entra, false, "tal cual, no entra a otra base");
  const movido = respaldoParaOtroEspacio(original, "nuevo", "2026-11-24T00:00:00Z");
  assert.equal(revisarRespaldo(movido, "nuevo").entra, true);
  assert.equal(movido.trabajadores[0]._espacio, "nuevo"); assert.equal(movido.eventos[0]._espacio, "nuevo"); assert.deepEqual(movido.eventos[0].datos, { x: 1 });
  assert.equal(movido._respaldo.venia_de, "viejo", "y queda dicho de dónde venía");
  assert.equal(original.trabajadores[0]._espacio, "viejo", "el archivo original no se toca");
  assert.throws(() => respaldoParaOtroEspacio({ trabajadores: [] }, "nuevo"));
});
