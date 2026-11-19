// Supabase le carga a las cuentas de la app una regla (safeupdate) que rechaza
// todo UPDATE o DELETE sin WHERE — también dentro de una función. La base de
// pruebas no trae esa regla, así que una hoja puede pasar todas las pruebas y
// tronar en la base real. Ya pasó: al primer superadministrador no lo dejó
// entrar con su código de arranque ("UPDATE requires a WHERE clause").
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const raiz = new URL("../supabase/", import.meta.url);
const { hojas } = JSON.parse(readFileSync(new URL("orden.json", raiz), "utf8"));

export const sinCondicion = (sql) => {
  const limpio = sql.replace(/--.*$/gm, "");
  const malas = [];
  for (const pedazo of limpio.split(";")) {
    // "on conflict … do update set" y "for update using" no son sentencias UPDATE.
    const m = pedazo.match(/(?<!do\s)\b(update\s+[\w."%]+\s+set|delete\s+from\s+[\w."%]+)\b[\s\S]*$/i);
    if (m && !/\bwhere\b/i.test(m[0])) malas.push(m[0].replace(/\s+/g, " ").trim().slice(0, 120));
  }
  return malas;
};

test("el_detector_si_ve_un_update_sin_where", () => {
  assert.equal(sinCondicion("begin update operacion set usos = usos - 1; end").length, 1);
  assert.equal(sinCondicion("delete from cosas;").length, 1);
  assert.equal(sinCondicion("update operacion set usos = usos - 1 where id = 'unico';").length, 0);
  assert.equal(sinCondicion("insert into t values (1) on conflict (id) do update set a = 1;").length, 0);
  assert.equal(sinCondicion("create policy p on t for update using (true);").length, 0);
});

test("ninguna_hoja_actualiza_ni_borra_sin_decir_cual_renglon", () => {
  const malas = hojas.flatMap(h => sinCondicion(readFileSync(new URL(`${h}.sql`, raiz), "utf8")).map(s => `${h}: ${s}`));
  assert.deepEqual(malas, []);
});
