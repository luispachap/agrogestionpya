// AUDITORÍA FUNCIONAL — lo que la nube de imitación de los recorridos NO puede probar: que la BASE niegue lo que la
// pantalla esconde. Un caso por módulo auditado, llamando directo a la base con la cuenta de cada perfil.
import { test } from "node:test";
import assert from "node:assert/strict";
import { armarBase, como } from "./base.mjs";

const db = await armarBase();
const E = (o) => JSON.stringify({ _espacio: "proyectonuevo", ...o });
await db.exec("reset role");
const { rows: [op] } = await db.query("select espacio from operacion");
const marca = op?.espacio || "proyectonuevo";
const D = (o) => JSON.stringify({ _espacio: marca, ...o });
await db.exec(`set session_replication_role = replica; insert into creditos (id, datos) values ('cr-aud', '${D({ monto: 1000, abonos: [] })}'); insert into proveedores (id, datos) values ('pv-aud', '${D({ nombre: "PROVEEDOR INVENTADO" })}'); set session_replication_role = origin;`);

test("proveedores_y_deudas_el_encargado_no_lee_ni_escribe_creditos_aunque_llame_directo", async () => {
  const lee = await como(db, "encargado", "select id from creditos");
  assert.ok(!lee.ok || lee.filas.length === 0, "no los lee");
  const mete = await como(db, "encargado", "insert into creditos (id, datos) values ('cr-enc', $1::jsonb)", [D({ monto: 5 })]);
  assert.ok(!mete.ok || mete.afectadas === 0, "no los crea");
  const cambia = await como(db, "encargado", "update creditos set datos = $1::jsonb where id = 'cr-aud'", [D({ monto: 1, abonos: [] })]);
  assert.ok(!cambia.ok || cambia.afectadas === 0, "no los cambia");
});

test("proveedores_y_deudas_direccion_lee_los_creditos_pero_no_registra_ni_abona", async () => {
  const lee = await como(db, "dueno", "select id from creditos");
  assert.ok(lee.ok && lee.filas.length === 1);
  const cambia = await como(db, "dueno", "update creditos set datos = $1::jsonb where id = 'cr-aud'", [D({ monto: 1000, abonos: [{ id: "x", monto: 999 }] })]);
  assert.ok(!cambia.ok || cambia.afectadas === 0);
});

test("proveedores_y_deudas_nadie_borra_un_credito_ni_el_superadministrador", async () => {
  for (const q of ["luis", "finanzas", "encargado", null]) {
    const r = await como(db, q, "delete from creditos where id = 'cr-aud'");
    assert.ok(!r.ok || r.afectadas === 0, String(q));
  }
  await db.exec("reset role");
  assert.equal((await db.query("select count(*)::int n from creditos where id = 'cr-aud'")).rows[0].n, 1);
});

test("proveedores_y_deudas_finanzas_si_puede_abonar_y_sin_sesion_no_se_lee_nada", async () => {
  const abona = await como(db, "finanzas", "update creditos set datos = $1::jsonb where id = 'cr-aud'", [D({ monto: 1000, abonos: [{ id: "a1", monto: 100, tipo: "dinero" }] })]);
  assert.ok(abona.ok && abona.afectadas === 1, abona.error);
  const nadie = await como(db, null, "select id from creditos");
  assert.ok(!nadie.ok || nadie.filas.length === 0);
  const nadieProv = await como(db, null, "select id from proveedores");
  assert.ok(!nadieProv.ok || nadieProv.filas.length === 0);
});
