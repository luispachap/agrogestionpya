// La base se arma desde cero con las hojas, y queda completa y con candado.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { armarBase, como, verdad, CUENTAS, ORDEN } from "./base.mjs";
import { readFileSync } from "node:fs";
// La lista de tablas que la app usa, leída de su propio código.
const fuente = readFileSync(new URL("../../src/dataApi.js", import.meta.url), "utf8");
const TABLAS = [...fuente.match(/export const TABLAS = \[([\s\S]*?)\];/)[1].matchAll(/"([a-z_]+)"/g)].map(m => m[1]);

let db;
before(async () => { db = await armarBase(); });
const negado = (r) => !r.ok || r.afectadas === 0;
const uno = async (sql) => (await verdad(db, sql))[0];

test("la_base_se_arma_desde_cero_y_trae_todas_las_tablas_que_la_app_usa", async () => {
  const hay = new Set((await verdad(db, "select tablename from pg_tables where schemaname = 'public'")).map(x => x.tablename));
  const faltan = TABLAS.filter(t => !hay.has(t));
  assert.deepEqual(faltan, [], "tablas que la app usa y la base no tiene");
  assert.ok(ORDEN.length >= 24);
});
test("armarla_dos_veces_no_truena_ni_duplica", async () => {
  const { leerHoja } = await import("./base.mjs");
  for (const h of ORDEN.slice(ORDEN.indexOf("24-permisos-por-rol"))) await db.exec(leerHoja(h));
  assert.equal(Number((await uno("select count(*) n from limites")).n), 1);
});
test("ninguna_tabla_queda_sin_candado_y_ya_no_hay_borrado_directo", async () => {
  const sin = await verdad(db, `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  assert.deepEqual(sin.map(x => x.relname), []);
  const borrados = await verdad(db, "select tablename from pg_policies where schemaname = 'public' and cmd = 'DELETE' and tablename <> 'perfiles'");
  assert.deepEqual(borrados, []);
});

// ── Borrar deja lápida ──────────────────────────────────────
test("lo_borrado_en_un_telefono_no_revive_cuando_otro_lo_vuelve_a_subir", async () => {
  await como(db, "encargado", `insert into tareas (id, datos) values ('z1', '{"titulo": "regar"}')`);
  const b = await como(db, "encargado", "select borrar_registro('tareas', 'z1') as ok");
  assert.equal(b.filas[0].ok, true);
  // Otro teléfono, con su copia vieja, la vuelve a subir tal cual (así sube la app):
  const sube = await como(db, "luis", `insert into tareas (id, datos, actualizado) values ('z1', '{"titulo": "regar"}', now())
    on conflict (id) do update set datos = excluded.datos, actualizado = excluded.actualizado`);
  assert.equal(sube.ok, true);
  const fila = await uno("select borrado, datos from tareas where id = 'z1'");
  assert.ok(fila.borrado, "sigue con su lápida");
  assert.equal(fila.datos.titulo, "regar", "y el contenido se conserva: nada se borró de verdad");
  // Tampoco se le quita la lápida escribiéndola directo:
  await como(db, "luis", "update tareas set borrado = null where id = 'z1'");
  assert.ok((await uno("select borrado from tareas where id = 'z1'")).borrado);
});
test("borrar_respeta_los_permisos_y_el_dinero_nunca", async () => {
  assert.equal((await como(db, "dueno", "select borrar_registro('tareas', 'ta1')")).ok, false);
  assert.equal((await como(db, "intruso", "select borrar_registro('tareas', 'ta1')")).ok, false);
  for (const q of ["luis", "finanzas"]) {
    const r = await como(db, q, "select borrar_registro('egresos', 'e1')");
    assert.equal(r.ok, false); assert.match(r.error, /se cancela/);
  }
  assert.equal((await como(db, "luis", "select borrar_registro('perfiles', 'x')")).ok, false);
  assert.equal((await uno("select borrado from egresos where id = 'e1'")).borrado, null);
});
test("solo_un_superadministrador_restaura_lo_borrado", async () => {
  assert.equal((await como(db, "encargado", "select restaurar_registro('tareas', 'z1')")).ok, false);
  assert.equal((await como(db, "migue", "select restaurar_registro('tareas', 'z1') as ok")).filas[0].ok, true);
  assert.equal((await uno("select borrado from tareas where id = 'z1'")).borrado, null);
});

// ── La gente de campo sube por la cuenta de su encargado ────
test("lo_que_captura_la_cuadrilla_sube_con_la_cuenta_del_encargado_y_conserva_quien_fue", async () => {
  const act = { trabajadorId: "t-campo", horas: 8, registradoPor: { rol: "cuadrilla", id: "cq1", nombre: "CUADRILLA DE PRUEBA" } };
  const r = await como(db, "encargado", "insert into actividades (id, datos, creado_por) values ('c1', $1, $2)", [JSON.stringify(act), CUENTAS.luis]);
  assert.equal(r.ok, true);
  const f = await uno("select datos, creado_por, subido_por from actividades where id = 'c1'");
  assert.equal(f.datos.registradoPor.nombre, "CUADRILLA DE PRUEBA"); // la persona
  assert.equal(f.creado_por, CUENTAS.encargado);                    // la cuenta: la pone la base, no el teléfono
  // Si después lo corrige un superadministrador, queda quién lo creó y quién lo tocó al final.
  await como(db, "migue", `update actividades set datos = datos || '{"horas": 6}' where id = 'c1'`);
  const g = await uno("select creado_por, subido_por from actividades where id = 'c1'");
  assert.equal(g.creado_por, CUENTAS.encargado); assert.equal(g.subido_por, CUENTAS.migue);
});
test("el_encargado_puede_subir_todo_lo_que_su_gente_captura", async () => {
  for (const t of ["actividades", "asistencia", "compras", "entradas_inv", "incidencias", "inventario", "solicitudes_compra", "tareas"]) {
    const r = await como(db, "encargado", `insert into ${t} (id, datos) values ('campo-${t}', '{}')`);
    assert.equal(r.ok, true, t + ": " + (r.error || ""));
  }
});

// ── Los archivos van al almacén privado ─────────────────────
const subir = (quien, nombre, bytes) => como(db, quien,
  "insert into storage.objects (bucket_id, name, owner, metadata) values ('comprobantes', $1, $2, $3)",
  [nombre, CUENTAS[quien] || null, JSON.stringify({ size: bytes, mimetype: "image/jpeg" })]);
test("el_almacen_es_privado_con_tope_por_archivo_y_solo_imagenes_y_pdf", async () => {
  const b = await uno("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'comprobantes'");
  assert.equal(b.public, false);
  assert.equal(Number(b.file_size_limit), 3 * 1024 * 1024);
  assert.deepEqual(b.allowed_mime_types, ["image/jpeg", "image/png", "image/webp", "application/pdf"]);
});
test("sin_sesion_o_sin_perfil_no_se_sube_ni_se_ve_un_comprobante", async () => {
  assert.equal((await subir("encargado", "aaa.jpg", 300000)).ok, true);
  assert.ok(negado(await subir(null, "bbb.jpg", 1000)));
  assert.ok(negado(await subir("intruso", "ccc.jpg", 1000)));
  assert.equal((await como(db, null, "select * from storage.objects")).filas.length, 0);
  assert.equal((await como(db, "intruso", "select * from storage.objects")).filas.length, 0);
  assert.equal((await como(db, "dueno", "select * from storage.objects")).filas.length, 1); // el dueño sí los ve
  assert.ok(negado(await subir("dueno", "ddd.jpg", 1000)));                                   // pero no sube
});
test("la_misma_foto_no_ocupa_dos_veces", async () => {
  const otra = await subir("finanzas", "aaa.jpg", 300000); // mismo nombre = misma huella
  assert.equal(otra.ok, false);
  assert.equal(Number((await uno("select count(*) n from storage.objects where name = 'aaa.jpg'")).n), 1);
});
test("un_comprobante_no_se_reemplaza_ni_se_borra_ni_siendo_superadministrador", async () => {
  for (const q of ["luis", "encargado"]) {
    assert.ok(negado(await como(db, q, "delete from storage.objects where name = 'aaa.jpg'")), q);
    assert.ok(negado(await como(db, q, `update storage.objects set metadata = '{"size": 1}' where name = 'aaa.jpg'`)), q);
    assert.ok(negado(await como(db, q, "delete from archivos")), q);
  }
});
test("cuando_el_almacen_llega_al_tope_ya_no_acepta_archivos_nuevos", async () => {
  const b = await armarBase();
  await verdad(b, "update limites set archivos_mb = 1"); // tope de prueba: 1 MB al 95 %
  const sube = (n, bytes) => como(b, "encargado", "insert into storage.objects (bucket_id, name, metadata) values ('comprobantes', $1, $2)", [n, JSON.stringify({ size: bytes })]);
  assert.equal((await sube("uno.jpg", 600000)).ok, true);
  assert.equal((await sube("dos.jpg", 500000)).ok, true);   // aún cabía al entrar
  assert.ok(negado(await sube("tres.jpg", 1000)), "ya pasó del 95 %: no entra");
});

// ── El medidor ──────────────────────────────────────────────
test("el_medidor_dice_cuanto_se_lleva_y_contra_que_tope", async () => {
  const c = (await como(db, "luis", "select consumo() as c")).filas[0].c;
  assert.ok(c.base_bytes > 0);
  assert.equal(Number(c.archivos_bytes), 300000);
  assert.equal(c.archivos_n, 1);
  assert.equal(c.limites.base_mb, 500); assert.equal(c.limites.archivos_mb, 1024);
  assert.equal(c.limites.ia_llamadas_mes, 150);
  assert.ok(c.tablas.length > 0, "el superadministrador ve el desglose por tabla");
  const e = (await como(db, "encargado", "select consumo() as c")).filas[0].c;
  assert.deepEqual(e.tablas, [], "los demás ven el total, no el desglose");
  assert.equal((await como(db, "intruso", "select consumo() as c")).filas[0].c, null);
});
test("solo_un_superadministrador_cambia_los_topes", async () => {
  assert.ok(negado(await como(db, "finanzas", "update limites set base_mb = 99999")));
  assert.equal((await como(db, "migue", "update limites set ia_llamadas_mes = 200")).afectadas, 1);
  await verdad(db, "update limites set ia_llamadas_mes = 150");
});

// ── El uso de la IA ─────────────────────────────────────────
test("nadie_puede_inflar_ni_borrar_el_consumo_de_IA_desde_la_app", async () => {
  await verdad(db, `insert into uso_ia (huella, funcion, cuenta, entrada, salida, centavos, resultado) values ('h1', 'leer-papel', '${CUENTAS.encargado}', 1000, 200, 12, '{"ok": true}')`);
  await verdad(db, `insert into uso_ia (huella, funcion, de_cache) values ('h1', 'leer-papel', true)`);
  for (const q of ["luis", "encargado"]) {
    assert.ok(negado(await como(db, q, "insert into uso_ia (huella, funcion) values ('x', 'leer-papel')")), q);
    assert.ok(negado(await como(db, q, "delete from uso_ia")), q);
    assert.ok(negado(await como(db, q, "update uso_ia set centavos = 0")), q);
  }
  assert.equal((await como(db, "encargado", "select * from uso_ia")).filas.length, 0);
  const c = (await como(db, "luis", "select consumo() as c")).filas[0].c;
  assert.deepEqual(c.ia_mes, { llamadas: 1, ahorradas: 1, centavos: 12 });
});

test("sin_sesion_no_se_puede_llamar_ninguna_funcion_y_las_internas_no_las_llama_nadie", async () => {
  for (const f of ["consumo()", "tiene_perfil()", "puede('egresos', 'leer')", "reclamar_acceso('x')", "borrar_registro('tareas', 'x')", "sellar_espacio('x')"]) {
    const r = await como(db, null, `select ${f}`);
    assert.equal(r.ok, false, f); assert.match(r.error, /permission denied/, f);
  }
  for (const q of ["luis", "encargado", null]) {
    const r = await como(db, q, "select preparar_arranque(repeat('a', 64), 5, 30)");
    assert.equal(r.ok, false, String(q)); assert.match(r.error, /permission denied/);
  }
  // y lo que la app sí usa, sigue funcionando con sesión
  assert.equal((await como(db, "encargado", "select tiene_perfil() as t")).filas[0].t, true);
  assert.equal((await como(db, "encargado", `insert into tareas (id, datos) values ('tras33', '{}')`)).ok, true, "los candados internos siguen disparándose solos");
});
