// El teléfono ligado a una cuenta (hoja PENDIENTE, no instalada): se prueba en la base aislada con cuentas de mentira.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { armarBase, como, verdad, CUENTAS } from "./base.mjs";

let db;
before(async () => { db = await armarBase(); await db.exec(readFileSync(new URL("../../supabase/pendientes/telefono-de-la-cuenta.sql", import.meta.url), "utf8")); });
const pedir = async (quien) => (await como(db, quien, "select pedir_vinculo_telefono() c")).filas?.[0]?.c;
const confirmar = async (tel, codigo) => (await verdad(db, "select confirmar_vinculo_telefono($1, $2) r", [tel, codigo]))[0].r;

test("con_su_sesion_pide_un_codigo_y_desde_su_telefono_queda_ligado_a_su_cuenta", async () => {
  const codigo = await pedir("luis");
  assert.match(codigo, /^\d{6}$/);
  const guardado = await verdad(db, "select codigo_hash, telefono from telefonos_de_cuenta where usuario = $1", [CUENTAS.luis]);
  assert.notEqual(guardado[0].codigo_hash, codigo, "del código sólo se guarda su huella"); assert.equal(guardado[0].telefono, null);
  assert.deepEqual(await confirmar("5214495550001", codigo), { ok: true, usuario: CUENTAS.luis });
  const quien = (await verdad(db, "select cuenta_de_telefono($1) r", ["+52 449 555 0001"]))[0].r;
  assert.deepEqual([quien.usuario, quien.rol], [CUENTAS.luis, "superadmin"], "el teléfono lleva a la cuenta y a su perfil, sin trabajador ficticio");
  assert.equal((await confirmar("5214495550002", codigo)).ok, false, "el código sirve una sola vez");
});

test("un_codigo_malo_o_vencido_no_liga_nada_y_los_intentos_se_acaban", async () => {
  const codigo = await pedir("migue");
  await db.query("update telefonos_de_cuenta set codigo_vence = now() - interval '1 minute' where usuario = $1", [CUENTAS.migue]);
  assert.equal((await confirmar("5214495550003", codigo)).motivo, "codigo_invalido", "vencido");
  for (let i = 0; i < 4; i++) assert.equal((await confirmar("5214495550003", "000000")).motivo, "codigo_invalido");
  assert.equal((await confirmar("5214495550003", "000000")).motivo, "demasiados_intentos");
  assert.equal((await verdad(db, "select telefono from telefonos_de_cuenta where usuario = $1", [CUENTAS.migue]))[0].telefono, null);
});

test("un_telefono_no_se_le_quita_a_otra_cuenta_y_nadie_se_liga_sin_sesion_ni_por_su_lado", async () => {
  const codigo = await pedir("encargado");
  assert.equal((await confirmar("5214495550001", codigo)).motivo, "telefono_de_otra_cuenta");
  assert.equal(await pedir("intruso"), undefined, "una cuenta sin perfil no pide código");
  assert.equal(await pedir(null), undefined);
  assert.equal((await como(db, "encargado", "select confirmar_vinculo_telefono('5214495550009', $1)", [codigo])).ok, false, "confirmar sólo lo hace el servidor");
  assert.equal((await como(db, "encargado", "update telefonos_de_cuenta set telefono = '4495550009', verificado = now() where usuario = $1", [CUENTAS.encargado])).ok, false, "nadie escribe la tabla a mano");
  assert.equal(((await como(db, "encargado", "select usuario from telefonos_de_cuenta")).filas || []).length, 1, "cada quien ve sólo el suyo");
});

test("desligar_mi_telefono_es_cosa_mia", async () => {
  assert.ok((await como(db, "luis", "select desvincular_mi_telefono()")).ok);
  assert.equal((await verdad(db, "select cuenta_de_telefono('5214495550001') r"))[0].r, null);
});
