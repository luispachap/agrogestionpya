// El acomodo del menú es de cada quien: nadie ve ni toca el de otro.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { armarBase, como, verdad, CUENTAS } from "./base.mjs";

let db; let dos;
before(async () => {
  db = await armarBase();
  dos = ["luis", "migue"];
});

test("cada_quien_guarda_y_lee_su_acomodo_y_solo_el_suyo", async () => {
  const [a, b] = dos;
  assert.ok((await como(db, a, `insert into preferencias (id, datos) values ($1, '{"inicio":["banco"]}')`, [CUENTAS[a]])).ok);
  assert.ok((await como(db, b, `insert into preferencias (id, datos) values ($1, '{"inicio":["corrida"]}')`, [CUENTAS[b]])).ok);
  const veA = await como(db, a, "select id, datos from preferencias");
  assert.equal(veA.filas.length, 1); assert.deepEqual(veA.filas[0].datos, { inicio: ["banco"] });
});

test("nadie_cambia_ni_se_apropia_el_acomodo_de_otro_ni_siendo_superadministrador", async () => {
  const [a, b] = dos;
  await como(db, a, "update preferencias set datos = '{\"inicio\":[]}' where id = $1", [CUENTAS[b]]);
  assert.deepEqual((await verdad(db, "select datos from preferencias where id = $1", [CUENTAS[b]]))[0].datos, { inicio: ["corrida"] });
  assert.equal((await como(db, a, "update preferencias set id = $1 where id = $2", [CUENTAS[b], CUENTAS[a]])).ok, false);
  await como(db, a, "delete from preferencias where id = $1", [CUENTAS[b]]);
  assert.equal(Number((await verdad(db, "select count(*) n from preferencias"))[0].n), 2, "y no hay borrado");
});

test("sin_sesion_no_se_lee_ni_se_guarda_nada", async () => {
  const lee = await como(db, null, "select * from preferencias");
  assert.ok(!lee.ok || lee.filas.length === 0);
  assert.equal((await como(db, null, "insert into preferencias (id, datos) values ($1, '{}')", [CUENTAS[dos[0]]])).ok, false);
  assert.equal((await como(db, "intruso", "insert into preferencias (id, datos) values ($1, '{}')", [CUENTAS.intruso])).ok, false, "una cuenta sin perfil tampoco");
});

test("no_se_puede_usar_de_cajon_para_guardar_otra_cosa", async () => {
  const grande = JSON.stringify({ x: Array.from({ length: 4000 }, (_, i) => `relleno-${i}-${Math.random()}`) });
  assert.equal((await como(db, dos[0], "update preferencias set datos = $1::jsonb where id = $2", [grande, CUENTAS[dos[0]]])).ok, false);
});
