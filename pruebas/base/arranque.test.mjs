// El arranque limpio, visto desde la base: nace vacía, y lo que no es de este
// espacio no entra aunque quien lo suba tenga permiso.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { armarBase, como, verdad, CUENTAS, ORDEN, leerHoja } from "./base.mjs";

let db;
before(async () => { db = await armarBase(); await verdad(db, "select sellar_espacio('proyectonuevo')"); });
const negado = (r) => !r.ok || r.afectadas === 0;
const con = (o) => JSON.stringify({ _espacio: "proyectonuevo", ...o });

test("las_hojas_no_siembran_ni_un_solo_registro_de_operacion", async () => {
  // Una base recién armada, sin las cuentas ni los datos de mentira del resto de las pruebas.
  const limpia = new PGlite();
  await limpia.exec(`create schema auth; create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb);
    alter table storage.objects enable row level security;`);
  for (const h of ORDEN) await limpia.exec(leerHoja(h));
  const tablas = (await limpia.query("select tablename from pg_tables where schemaname = 'public'")).rows.map(r => r.tablename);
  const conDatos = [];
  for (const t of tablas) {
    const n = Number((await limpia.query(`select count(*) n from ${t}`)).rows[0].n);
    if (n > 0) conDatos.push(`${t}=${n}`);
  }
  // Lo único que trae de nacimiento son REGLAS (permisos, topes, el renglón de operación), no datos.
  assert.deepEqual(conDatos.map(x => x.split("=")[0]).sort(), ["avisos_llaves", "limites", "operacion", "operaciones_sensibles", "permisos_rol"]);   // avisos_llaves: un renglón de configuración con un secreto al azar, sin llaves ni datos
  assert.equal(Number((await limpia.query("select count(*) n from perfiles")).rows[0].n), 0, "ni cuentas ni PIN de antes");
});

test("lo_que_no_trae_la_marca_de_este_espacio_no_entra_aunque_quien_sube_tenga_permiso", async () => {
  // Así llegaría un gasto de prueba guardado en un teléfono desde antes:
  for (const q of ["luis", "migue", "finanzas", "encargado"]) {
    const r = await como(db, q, `insert into egresos (id, datos) values ('viejo-${q}', '{"monto": 999999, "concepto": "prueba vieja"}')`);
    assert.equal(r.ok, false, q); assert.match(r.error, /no es de esta operación/);
    const otro = await como(db, q, `insert into egresos (id, datos) values ('otro-${q}', '{"_espacio": "pruebas", "monto": 5}')`);
    assert.equal(otro.ok, false, q);
  }
  assert.equal(Number((await verdad(db, "select count(*) n from egresos where id like 'viejo-%' or id like 'otro-%'"))[0].n), 0);
});

test("tampoco_entra_por_la_puerta_de_actualizar_que_es_como_sube_la_app", async () => {
  const r = await como(db, "encargado", `insert into actividades (id, datos, actualizado) values ('act-vieja', '{"horas": 8}', now())
    on conflict (id) do update set datos = excluded.datos`);
  assert.equal(r.ok, false);
  const fichas = await como(db, "encargado", `insert into trabajadores (id, datos) values ('t-viejo', '{"nombre": "x", "pin": "1234"}')`);
  assert.ok(negado(fichas));
});

test("lo_que_nace_en_la_operacion_nueva_si_entra", async () => {
  assert.equal((await como(db, "finanzas", "insert into egresos (id, datos) values ('nuevo1', $1)", [con({ monto: 100 })])).ok, true);
  assert.equal((await como(db, "encargado", "insert into actividades (id, datos) values ('act1', $1)", [con({ horas: 8 })])).ok, true);
  // y corregirlo después sigue funcionando
  assert.equal((await como(db, "finanzas", "insert into egresos (id, datos) values ('nuevo1', $1) on conflict (id) do update set datos = excluded.datos", [con({ monto: 120 })])).ok, true);
  assert.equal((await verdad(db, "select datos->>'monto' m from egresos where id = 'nuevo1'"))[0].m, "120");
});

test("el_espacio_se_sella_una_vez_y_no_se_cambia", async () => {
  assert.equal((await como(db, "luis", "select sellar_espacio('otrolado')")).ok, false);
  assert.equal((await como(db, "encargado", "select sellar_espacio('proyectonuevo')")).ok, false);
  assert.ok(negado(await como(db, "luis", "update operacion set espacio = 'otrolado'")), "ni escribiéndolo directo");
  assert.equal((await verdad(db, "select espacio from operacion"))[0].espacio, "proyectonuevo");
});

test("la_fecha_de_inicio_la_declara_un_superadministrador_una_sola_vez", async () => {
  assert.equal((await como(db, "finanzas", "select declarar_inicio('2026-12-01')")).ok, false);
  assert.equal((await como(db, "migue", "select declarar_inicio('2026-12-01', 'Arranque con conteo físico') as f")).ok, true);
  const otra = await como(db, "luis", "select declarar_inicio('2026-11-01')");
  assert.equal(otra.ok, false); assert.match(otra.error, /ya está declarado/);
  const o = (await verdad(db, "select inicio_operaciones::text f, declarado_por from operacion"))[0];
  assert.equal(o.f, "2026-12-01"); assert.equal(o.declarado_por, CUENTAS.migue);
  assert.equal((await como(db, "encargado", "select inicio_operaciones from operacion")).filas.length, 1, "todos pueden leerla");
});

test("los_catalogos_validados_los_carga_el_dueno_de_la_base_no_un_telefono", async () => {
  // Así entra lo que Luis y Migue aprobaron: desde el panel, con su constancia.
  await verdad(db, `insert into trabajadores (id, datos) values ('cat-1', '{"nombre": "PERSONA UNO", "origen": {"de": "catálogo validado"}, "_espacio": "proyectonuevo"}')`);
  assert.equal((await como(db, "luis", "select * from trabajadores where id = 'cat-1'")).filas.length, 1);
});

// ── La herramienta de catálogos, de punta a punta, con datos de mentira ─────
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

test("de_un_respaldo_viejo_a_la_base_nueva_solo_llegan_los_catalogos_aprobados", async () => {
  const XLSX = createRequire(import.meta.url)("xlsx");
  const dir = mkdtempSync(join(tmpdir(), "catalogos-"));
  const herramienta = new URL("../../herramientas/catalogos.mjs", import.meta.url).pathname;
  writeFileSync(join(dir, "telefono.json"), JSON.stringify({
    trabajadores: [{ id: "t1", nombre: "PERSONA UNO", pin: "1234", sueldo_dia: 350 }, { id: "t2", nombre: "prueba", pin: "0000", sueldo_dia: 0 }],
    proveedores: [{ id: "p1", nombre: "PROVEEDOR O'BRIEN SA" }],
    inventario: [{ id: "i1", nombre: "UREA", unidad: "bulto", existencia: 40, costo_unit: 868 }],
    egresos: [{ id: "e1", monto: 999999 }], config_seguridad: [{ id: "seg", pin_admin: "hash-viejo" }],
  }));
  execFileSync("node", [herramienta, "candidatos", dir]);
  // Lo que harían Luis y Migue: "sí" a lo bueno, nada a lo dudoso.
  const archivo = join(dir, "catalogos-por-revisar.xlsx");
  const libro = XLSX.readFile(archivo);
  for (const n of libro.SheetNames) {
    const a = XLSX.utils.sheet_to_json(libro.Sheets[n], { header: 1 });
    for (let i = 1; i < a.length; i++) a[i][0] = ["PERSONA UNO", "PROVEEDOR O'BRIEN SA", "UREA"].includes(String(a[i][2])) ? "sí" : "";
    libro.Sheets[n] = XLSX.utils.aoa_to_sheet(a);
  }
  XLSX.writeFile(libro, archivo);
  execFileSync("node", [herramienta, "aprobar", archivo, "--por", "Prueba", "--fecha", "2026-11-19", "--espacio", "proyectonuevo"]);
  const sql = readFileSync(join(dir, "catalogos-aprobados.sql"), "utf8");
  for (const prohibido of ["1234", "0000", "hash-viejo", "999999", "868"]) assert.equal(sql.includes(prohibido), false, prohibido);

  const b = await armarBase(); await verdad(b, "select sellar_espacio('proyectonuevo')");
  const antes = Number((await verdad(b, "select count(*) n from trabajadores"))[0].n);
  await b.exec(sql);                                          // lo carga el dueño de la base, desde el panel
  const gente = await verdad(b, "select id, nombre, pin, datos from trabajadores where datos->'origen'->>'de' = 'catálogo validado'");
  assert.equal(gente.length, 1); assert.equal(gente[0].nombre, "PERSONA UNO");
  assert.equal(gente[0].pin, null, "sin PIN: se le da uno nuevo");
  assert.notEqual(gente[0].id, "t1", "con id nuevo");
  assert.equal(gente[0].datos.origen.aprobadoPor, "Prueba");
  assert.equal(Number((await verdad(b, "select count(*) n from trabajadores"))[0].n), antes + 1, "el de prueba no entró");
  assert.equal((await verdad(b, "select nombre from proveedores"))[0].nombre, "PROVEEDOR O'BRIEN SA");
  const urea = (await verdad(b, "select datos from inventario where nombre = 'UREA'"))[0].datos;
  assert.equal(urea.existencia, 0, "cuánto hay lo dirá el conteo físico");
  assert.equal(Number((await verdad(b, "select count(*) n from egresos where datos->>'monto' = '999999'"))[0].n), 0);
  // y ya en la base, un superadministrador los ve y los puede corregir desde la app
  assert.equal((await como(b, "luis", "update trabajadores set datos = datos || '{\"categoria\": \"jornalero\"}' where nombre = 'PERSONA UNO'")).afectadas, 1);
});
