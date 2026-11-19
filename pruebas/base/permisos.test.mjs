// Que nadie pueda brincarse los permisos llamando directo a la base.
// Cada prueba hace lo que haría un atacante: no usa la app, usa la base.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { armarBase, como, verdad, CUENTAS } from "./base.mjs";

let vieja, db;
before(async () => { vieja = await armarBase({ con24: false }); db = await armarBase(); });

const cuenta = async (base, sql) => Number((await verdad(base, sql))[0].n);
// No pasó: o la base lo rechazó, o no tocó ningún renglón.
const negado = (r) => !r.ok || r.afectadas === 0;

// ── ANTES: el hoyo que existe hoy (hojas 1 a 23) ────────────────────────────
test("ANTES_un_recien_registrado_se_nombraba_admin_el_solo_y_leia_y_borraba_todo", async () => {
  const alta = await como(vieja, "intruso", "insert into perfiles (id, nombre, rol) values ($1, 'x', 'admin')", [CUENTAS.intruso]);
  assert.equal(alta.ok, true, "con las hojas 1–23 el intruso SÍ se da de alta como admin");
  assert.equal((await como(vieja, "intruso", "select * from egresos")).filas.length, 1);
  assert.equal((await como(vieja, "intruso", "select * from config_seguridad")).filas.length, 1);
  assert.equal((await como(vieja, "intruso", "delete from trabajadores")).afectadas, 1);
});
test("ANTES_el_agronomo_podia_leer_los_ingresos_y_cambiar_un_gasto", async () => {
  assert.equal((await como(vieja, "agronomo", "select * from ingresos")).filas.length, 1);
  assert.equal((await como(vieja, "agronomo", `update egresos set datos = '{"monto": 1}' where id = 'e1'`)).afectadas, 1);
});

// ── DESPUÉS: con la hoja 24 ─────────────────────────────────────────────────
test("sin_sesion_no_se_ve_ni_se_escribe_nada", async () => {
  for (const t of ["egresos", "ingresos", "trabajadores", "perfiles", "config_seguridad", "auditoria", "permisos_rol"])
    assert.equal((await como(db, null, `select * from ${t}`)).filas.length, 0, t);
  assert.ok(negado(await como(db, null, `insert into egresos (id, datos) values ('x', '{}')`)));
  assert.ok(negado(await como(db, null, "delete from trabajadores")));
});
test("el_que_se_registra_solo_no_puede_darse_perfil_ni_ver_nada", async () => {
  for (const rol of ["superadmin", "admin", "encargado", "dueno"])
    assert.ok(negado(await como(db, "intruso", "insert into perfiles (id, nombre, rol) values ($1, 'x', $2)", [CUENTAS.intruso, rol])), rol);
  assert.equal(await cuenta(db, `select count(*) n from perfiles where id = '${CUENTAS.intruso}'`), 0);
  for (const t of ["egresos", "trabajadores", "config_seguridad", "auditoria"])
    assert.equal((await como(db, "intruso", `select * from ${t}`)).filas.length, 0, t);
  assert.ok(negado(await como(db, "intruso", `insert into egresos (id, datos) values ('x', '{}')`)));
});
test("nadie_se_asciende_solo_a_superadministrador", async () => {
  for (const q of ["encargado", "agronomo", "finanzas", "dueno"]) {
    assert.ok(negado(await como(db, q, "update perfiles set rol = 'superadmin' where id = $1", [CUENTAS[q]])), q);
    assert.ok(negado(await como(db, q, "update permisos_rol set borrar = true, leer = true, crear = true, editar = true")), q);
    assert.ok(negado(await como(db, q, `insert into permisos_rol values ($1, 'ingresos', true, true, true, true)`, [q])), q);
  }
  assert.equal(await cuenta(db, "select count(*) n from perfiles where rol = 'superadmin'"), 2);
});
test("el_agronomo_no_ve_el_dinero_ni_toca_gastos_ajenos_a_su_permiso", async () => {
  for (const t of ["ingresos", "creditos", "prestamos", "cajachica", "estados_cuenta", "bolsas", "config_seguridad"])
    assert.equal((await como(db, "agronomo", `select * from ${t}`)).filas.length, 0, t);
  assert.ok(negado(await como(db, "agronomo", `insert into ingresos (id, datos) values ('x', '{}')`)));
  assert.ok(negado(await como(db, "agronomo", "delete from trabajadores")));
  // y lo suyo sí lo puede hacer
  assert.equal((await como(db, "agronomo", `insert into aplicaciones (id, datos) values ('ap1', '{}')`)).ok, true);
});
test("el_dueno_lee_pero_no_escribe_dinero_ni_borra", async () => {
  assert.equal((await como(db, "dueno", "select * from egresos")).filas.length, 1);
  assert.ok(negado(await como(db, "dueno", `update egresos set datos = '{"monto": 1}'`)));
  assert.ok(negado(await como(db, "dueno", `insert into ingresos (id, datos) values ('x', '{}')`)));
  assert.ok(negado(await como(db, "dueno", "delete from trabajadores")));
});
test("el_encargado_trabaja_lo_suyo_pero_no_borra_trabajadores_ni_ve_los_PIN_de_direccion", async () => {
  assert.equal((await como(db, "encargado", `insert into actividades (id, datos) values ('ac1', '{}')`)).ok, true);
  assert.equal((await como(db, "encargado", "delete from tareas where id = 'ta1'")).afectadas, 1);
  assert.ok(negado(await como(db, "encargado", "delete from trabajadores")));
  assert.ok(negado(await como(db, "encargado", `update trabajadores set datos = '{"sueldo": 9999}'`)));
  assert.equal((await como(db, "encargado", "select * from config_seguridad")).filas.length, 0);
  assert.equal(await cuenta(db, "select count(*) n from trabajadores"), 1);
});
test("el_dinero_no_se_borra_ni_siendo_superadministrador", async () => {
  for (const q of ["luis", "migue", "finanzas", "encargado"])
    for (const t of ["ingresos", "egresos"])
      assert.ok(negado(await como(db, q, `delete from ${t}`)), q + " " + t);
  assert.equal(await cuenta(db, "select count(*) n from egresos"), 1);
  assert.equal(await cuenta(db, "select count(*) n from ingresos"), 1);
});
test("la_bitacora_no_se_edita_ni_se_borra_ni_siendo_superadministrador", async () => {
  for (const q of ["luis", "migue", "finanzas"]) {
    assert.ok(negado(await como(db, q, "update auditoria set quien = 'otro'")), q);
    assert.ok(negado(await como(db, q, "delete from auditoria")), q);
  }
  assert.equal((await verdad(db, "select quien from auditoria where id = 'a1'"))[0].quien, "Prueba");
});
test("la_bitacora_anota_la_cuenta_real_aunque_el_telefono_mande_otro_nombre", async () => {
  const r = await como(db, "encargado",
    `insert into auditoria (id, accion, quien, datos) values ('a2', 'cancelo', 'Luis', $1)`,
    [JSON.stringify({ cuenta: CUENTAS.luis, rolCuenta: "superadmin" })]);
  assert.equal(r.ok, true);
  const d = (await verdad(db, "select datos from auditoria where id = 'a2'"))[0].datos;
  assert.equal(d.cuenta, CUENTAS.encargado);
  assert.equal(d.rolCuenta, "encargado");
});
test("luis_y_migue_pueden_exactamente_lo_mismo", async () => {
  for (const q of ["luis", "migue"]) {
    assert.equal((await como(db, q, "select * from config_seguridad")).filas.length, 1, q);
    assert.equal((await como(db, q, `insert into egresos (id, datos) values ('e-${q}', '{}')`)).ok, true, q);
    assert.equal((await como(db, q, `update trabajadores set datos = datos || '{"visto": true}'`)).afectadas, 1, q);
    assert.equal((await como(db, q, "select * from perfiles")).filas.length, 6, q);
    assert.equal((await como(db, q, "update permisos_rol set leer = leer where rol = 'dueno' and tabla = 'egresos'")).afectadas, 1, q);
  }
  // y cada uno puede dar de alta y cambiar a otros
  assert.equal((await como(db, "migue", "update perfiles set rol = 'finanzas' where id = $1", [CUENTAS.dueno])).afectadas, 1);
  assert.equal((await como(db, "luis", "update perfiles set rol = 'dueno' where id = $1", [CUENTAS.dueno])).afectadas, 1);
});
test("el_rancho_nunca_se_queda_sin_superadministrador", async () => {
  const sola = await armarBase();
  assert.equal((await como(sola, "luis", "update perfiles set rol = 'finanzas' where id = $1", [CUENTAS.migue])).afectadas, 1);
  const r = await como(sola, "luis", "update perfiles set rol = 'finanzas' where id = $1", [CUENTAS.luis]);
  assert.equal(r.ok, false); assert.match(r.error, /último superadministrador/);
  assert.equal((await como(sola, "luis", "delete from perfiles where id = $1", [CUENTAS.luis])).ok, false);
  assert.equal(await cuenta(sola, "select count(*) n from perfiles where rol = 'superadmin'"), 1);
});
test("el_rol_viejo_admin_queda_sin_nada_hasta_que_se_reasigne", async () => {
  const b = await armarBase();
  await verdad(b, "insert into auth.users values ('00000000-0000-0000-0000-000000000050', 'viejo@prueba.invalid')");
  await verdad(b, "insert into perfiles (id, nombre, rol) values ('00000000-0000-0000-0000-000000000050', 'Cuenta vieja', 'admin')");
  CUENTAS.viejo = "00000000-0000-0000-0000-000000000050";
  assert.equal((await como(b, "viejo", "select * from egresos")).filas.length, 0);
  assert.ok(negado(await como(b, "viejo", "delete from trabajadores")));
  delete CUENTAS.viejo;
});
test("ninguna_tabla_queda_sin_candado", async () => {
  const sin = await verdad(db, `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  assert.deepEqual(sin.map((x) => x.relname), []);
  const viejas = await verdad(db, `select tablename, policyname from pg_policies where schemaname = 'public'
    and (qual like '%tiene_perfil%' or with_check like '%tiene_perfil%') and tablename not in ('auditoria', 'permisos_rol')`);
  assert.deepEqual(viejas, [], "no debe quedar ninguna regla vieja de 'quien tenga perfil puede todo'");
});
test("la_reversa_devuelve_el_trabajo_pero_no_reabre_el_hoyo", async () => {
  const b = await armarBase();
  const { leerHoja } = await import("./base.mjs");
  await b.exec(leerHoja("25-reversa-de-la-24"));
  assert.equal((await como(b, "agronomo", "select * from ingresos")).filas.length, 1, "vuelve la regla anterior");
  assert.ok(negado(await como(b, "intruso", "insert into perfiles (id, nombre, rol) values ($1, 'x', 'admin')", [CUENTAS.intruso])));
  assert.ok(negado(await como(b, "luis", "delete from egresos")));
  assert.ok(negado(await como(b, "luis", "delete from auditoria")));
});
