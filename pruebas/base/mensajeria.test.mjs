// Quién puede escribir en la mensajería, atacando la base directo (base aislada, cuentas de mentira).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { armarBase, como, verdad } from "./base.mjs";

let db;
before(async () => { db = await armarBase(); });
const mensaje = (id) => [`insert into chat (id, datos) values ($1, $2)`, [id, JSON.stringify({ texto: "mensaje de prueba", _espacio: "prueba" })]];

test("el_agronomo_y_finanzas_ya_pueden_escribir_mensajes_y_direccion_sigue_leyendo", async () => {
  const permisos = await verdad(db, "select rol, leer, crear, editar, borrar from permisos_rol where tabla = 'chat' order by rol");
  const de = Object.fromEntries(permisos.map(p => [p.rol, [p.leer, p.crear, p.editar, p.borrar]]));
  assert.deepEqual(de.agronomo, [true, true, true, false]); assert.deepEqual(de.finanzas, [true, true, true, false]);
  assert.deepEqual(de.dueno, [true, false, false, false], "dirección lee y no escribe");
  assert.equal((await como(db, "dueno", ...mensaje("m-dueno"))).ok, false);
});

test("sin_perfil_o_sin_sesion_no_se_lee_ni_se_escribe_un_mensaje", async () => {
  assert.equal((await como(db, "intruso", ...mensaje("m-intruso"))).ok, false);
  assert.equal((await como(db, null, ...mensaje("m-nadie"))).ok, false);
  assert.equal(((await como(db, "intruso", "select id from chat")).filas || []).length, 0);
});

test("la_hoja_esta_en_el_orden_con_que_se_arma_la_base", async () => {
  const fs = await import("node:fs");
  const { hojas } = JSON.parse(fs.readFileSync(new URL("../../supabase/orden.json", import.meta.url), "utf8"));
  assert.ok(hojas.includes("45-mensajeria-institucional"));
});
