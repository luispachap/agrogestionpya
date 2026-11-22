// UN IDENTIFICADOR OCUPADO NO SE PISA (hoja 56). La protección está en la BASE: aunque dos teléfonos hicieran el mismo
// identificador, o alguien llamara directo, el segundo registro no puede quedar encima del primero.
import { test } from "node:test";
import assert from "node:assert/strict";
import { armarBase, como } from "./base.mjs";

const db = await armarBase();
await db.exec("reset role");
const { rows: [op] } = await db.query("select espacio from operacion");
const marca = op?.espacio || "proyectonuevo";
const D = (o) => JSON.stringify({ _espacio: marca, ...o });
const SUBE = (tabla) => `insert into ${tabla} (id, datos) values ($1, $2::jsonb) on conflict (id) do update set datos = excluded.datos`;   // lo mismo que hace la app
const guardado = async (tabla, id) => { await db.exec("reset role"); return (await db.query(`select datos from ${tabla} where id = $1`, [id])).rows[0]?.datos; };

test("dos_registros_distintos_con_el_mismo_identificador_el_segundo_se_rechaza_y_el_primero_queda_intacto", async () => {
  const a = await como(db, "luis", SUBE("egresos"), ["eg-choque", D({ monto: 700, concepto: "Diésel de Ana", _nace: "aaa" })]);
  assert.ok(a.ok, a.error);
  const b = await como(db, "finanzas", SUBE("egresos"), ["eg-choque", D({ monto: 95000, concepto: "Otro gasto, de otro teléfono", _nace: "bbb" })]);
  assert.equal(b.ok, false, "la base lo rechaza"); assert.match(b.error, /identificador_ocupado/);
  const g = await guardado("egresos", "eg-choque");
  assert.equal(g.monto, 700); assert.equal(g.concepto, "Diésel de Ana"); assert.equal(g._nace, "aaa");
});
test("ni_el_superadministrador_ni_un_registro_sin_marca_pisan_uno_que_ya_nacio", async () => {
  const sinMarca = await como(db, "luis", SUBE("egresos"), ["eg-choque", D({ monto: 1, concepto: "sin marca" })]);
  assert.equal(sinMarca.ok, false); assert.match(sinMarca.error, /identificador_ocupado/);
  const directo = await como(db, "luis", "update egresos set datos = $1::jsonb where id = 'eg-choque'", [D({ monto: 2, _nace: "zzz" })]);
  assert.equal(directo.ok, false);
  assert.equal((await guardado("egresos", "eg-choque")).monto, 700);
});
test("el_mismo_registro_si_se_puede_volver_a_subir_y_corregir", async () => {
  const otraVez = await como(db, "luis", SUBE("egresos"), ["eg-choque", D({ monto: 700, concepto: "Diésel de Ana", _nace: "aaa" })]);
  assert.ok(otraVez.ok, otraVez.error);
  const corregido = await como(db, "luis", SUBE("egresos"), ["eg-choque", D({ monto: 700, concepto: "Diésel de Ana (tractor 2)", _nace: "aaa" })]);
  assert.ok(corregido.ok, corregido.error);
  assert.equal((await guardado("egresos", "eg-choque")).concepto, "Diésel de Ana (tractor 2)");
});
test("lo_que_tiene_identificador_de_nombre_propio_sigue_siendo_el_mismo_hecho_una_vez", async () => {
  const a = await como(db, "luis", SUBE("egresos"), ["eg-sol-s1-0", D({ monto: 2400, solicitudId: "s1" })]);
  const b = await como(db, "luis", SUBE("egresos"), ["eg-sol-s1-0", D({ monto: 2400, solicitudId: "s1" })]);
  assert.ok(a.ok && b.ok, a.error || b.error);
  await db.exec("reset role");
  assert.equal((await db.query("select count(*)::int n from egresos where id = 'eg-sol-s1-0'")).rows[0].n, 1);
});
test("a_un_registro_de_antes_sin_marca_se_le_puede_poner_una_vez_y_despues_ya_no_cambia", async () => {
  await db.exec(`reset role; set session_replication_role = replica; insert into egresos (id, datos) values ('eg-viejo', '${D({ monto: 50 })}'); set session_replication_role = origin;`);
  assert.ok((await como(db, "luis", SUBE("egresos"), ["eg-viejo", D({ monto: 50, _nace: "v1" })])).ok);
  assert.equal((await como(db, "luis", SUBE("egresos"), ["eg-viejo", D({ monto: 51, _nace: "v2" })])).ok, false);
  assert.equal((await guardado("egresos", "eg-viejo")).monto, 50);
});
test("vale_para_todas_las_tablas_que_guardan_registros_tambien_los_eventos", async () => {
  await db.exec("reset role");
  const { rows } = await db.query(`select c.table_name t, exists (select 1 from pg_trigger g join pg_class k on k.oid = g.tgrelid where k.relname = c.table_name and g.tgname = 'a_cuidar_identidad') tiene
    from information_schema.columns c join information_schema.tables b on b.table_schema = c.table_schema and b.table_name = c.table_name and b.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'datos' and c.data_type = 'jsonb'
      and exists (select 1 from information_schema.columns i where i.table_schema = 'public' and i.table_name = c.table_name and i.column_name = 'id')`);
  assert.ok(rows.length >= 50, `tablas con registros: ${rows.length}`);
  assert.deepEqual(rows.filter(r => !r.tiene).map(r => r.t), []);
  for (const t of ["eventos", "ingresos", "embarques", "cajachica", "creditos", "aplicaciones", "entradas_inv", "compras"]) assert.ok(rows.some(r => r.t === t), t);
});
test("dos_eventos_distintos_con_el_mismo_identificador_el_segundo_no_desaparece_en_silencio_se_rechaza", async () => {
  const ev = (nace, cuanto) => JSON.stringify({ _espacio: marca, cuando: "2026-11-19T15:00:00.000Z", quien: { id: "x" }, datos: { cuanto }, _nace: nace });
  const mete = (q, nace, cuanto) => como(db, q, "insert into eventos (id, tipo, fecha, estado, datos) values ('ev-choque', 'marca', '2026-11-19', 'vigente', $1::jsonb) on conflict (id) do update set datos = excluded.datos", [ev(nace, cuanto)]);
  const a = await mete("encargado", "e1", 1); assert.ok(a.ok, a.error);
  const b = await mete("luis", "e2", 2);
  assert.equal(b.ok, false, "antes la base se quedaba con el primero y no decía nada"); assert.match(b.error, /identificador_ocupado/);
  const mismo = await mete("encargado", "e1", 1); assert.ok(mismo.ok, mismo.error);
  assert.equal((await guardado("eventos", "ev-choque")).datos.cuanto, 1);
});
