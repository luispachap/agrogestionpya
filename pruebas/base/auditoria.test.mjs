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

// ── Banco y Socios: no son del encargado (decisión de Luis, 22 nov; hoja 54) ──
await db.exec("reset role");
await db.exec(`set session_replication_role = replica;
  insert into estados_cuenta (id, datos) values ('ec-aud', '${D({ banco: "BANCO INVENTADO", saldoFinal: 123456 })}');
  insert into titulares (id, datos) values ('ti-aud', '${D({ nombre: "SOCIO INVENTADO" })}');
  insert into bolsas (id, datos) values ('bo-aud', '${D({ nombre: "CUENTA INVENTADA", titularId: "ti-aud" })}');
  insert into aportaciones (id, datos) values ('ap-aud', '${D({ monto: 5000, titularId: "ti-aud" })}');
  set session_replication_role = origin;`);
const BANCO_Y_SOCIOS = ["estados_cuenta", "titulares", "bolsas", "aportaciones"];

test("banco_y_socios_el_encargado_no_lee_nada_aunque_llame_directo_a_la_base", async () => {
  for (const t of BANCO_Y_SOCIOS) {
    const r = await como(db, "encargado", `select id from ${t}`);
    assert.ok(!r.ok || r.filas.length === 0, `${t}: el encargado lee ${r.filas.length}`);
  }
});

test("banco_y_socios_el_encargado_no_captura_ni_cambia_nada", async () => {
  for (const t of BANCO_Y_SOCIOS) {
    const mete = await como(db, "encargado", `insert into ${t} (id, datos) values ('x-enc-${t}', $1::jsonb)`, [D({ nombre: "intento" })]);
    assert.ok(!mete.ok || mete.afectadas === 0, `${t}: el encargado crea`);
    const cambia = await como(db, "encargado", `update ${t} set datos = $1::jsonb where id is not null`, [D({ nombre: "cambiado" })]);
    assert.ok(!cambia.ok || cambia.afectadas === 0, `${t}: el encargado cambia`);
    const borra = await como(db, "encargado", `delete from ${t} where id is not null`);
    assert.ok(!borra.ok || borra.afectadas === 0, `${t}: el encargado borra`);
  }
  await db.exec("reset role");
  for (const t of BANCO_Y_SOCIOS) assert.equal((await db.query(`select count(*)::int n from ${t}`)).rows[0].n, 1, t);
});

test("banco_y_socios_direccion_los_consulta_sin_poder_capturar_y_la_administracion_si_captura", async () => {
  for (const t of BANCO_Y_SOCIOS) {
    const lee = await como(db, "dueno", `select id from ${t}`);
    assert.ok(lee.ok && lee.filas.length === 1, `${t}: dirección no lo ve`);
    const mete = await como(db, "dueno", `insert into ${t} (id, datos) values ('x-dir-${t}', $1::jsonb)`, [D({ nombre: "intento" })]);
    assert.ok(!mete.ok || mete.afectadas === 0, `${t}: dirección captura`);
    const admin = await como(db, "luis", `select id from ${t}`);
    assert.ok(admin.ok && admin.filas.length === 1, t);
  }
  const alta = await como(db, "luis", "insert into bolsas (id, datos) values ('bo-adm', $1::jsonb)", [D({ nombre: "OTRA CUENTA" })]);
  assert.ok(alta.ok && alta.afectadas === 1, alta.error);
});

test("banco_y_socios_ni_el_agronomo_ni_quien_no_tiene_perfil_ni_sin_sesion", async () => {
  for (const q of ["agronomo", "intruso", null]) for (const t of BANCO_Y_SOCIOS) {
    const r = await como(db, q, `select id from ${t}`);
    assert.ok(!r.ok || r.filas.length === 0, `${q} lee ${t}`);
  }
});
