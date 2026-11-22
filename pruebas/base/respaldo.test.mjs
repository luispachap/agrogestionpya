// EL RESPALDO AUTOMÁTICO: lo que se puede probar sin tocar ninguna base de verdad.
// Las huellas tienen que delatar cualquier diferencia entre el original y la copia; los intentos no autorizados
// tienen que tronar si la copia quedó abierta; y un archivo tiene que volver del respaldo idéntico, byte por byte.
// Lo que esto NO prueba: una restauración real en un proyecto de Supabase. Ésa es el ensayo, y se hace aparte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { armarBase } from "./base.mjs";
import { bajar, subir, comprobar, leerIndice } from "../../herramientas/respaldo/archivos.mjs";

const AQUI = new URL("../../herramientas/respaldo/", import.meta.url);
const HUELLAS = readFileSync(new URL("huellas.sql", AQUI), "utf8");
const ATAQUES = readFileSync(new URL("ataques.sql", AQUI), "utf8");
const huellas = async (db) => { await db.exec("reset role"); const r = await db.exec(HUELLAS); return Object.fromEntries(r.at(-1).rows.map((x) => [x.clase + "|" + x.nombre, x.n + "|" + x.huella])); };
const distintas = (a, b) => Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]);

test("la_misma_base_da_siempre_las_mismas_huellas", async () => {
  const db = await armarBase();
  const [a, b] = [await huellas(db), await huellas(db)];
  assert.deepEqual(distintas(a, b), []);
  for (const k of ["reglas", "funciones", "tablas", "permisos", "sensibles", "puertas", "candados"]) assert.ok(a["estructura|" + k], "falta la huella de " + k);
  assert.ok(a["datos|auth.users"] && a["datos|public.eventos"] && a["archivos|storage.objects"]);
});

test("un_importe_cambiado_en_la_copia_se_nota_y_dice_en_que_tabla", async () => {
  const c = await armarBase(); const o = await huellas(c);
  await c.exec(`set session_replication_role = replica; update egresos set datos = '{"monto": 1001}' where id = 'e1'; set session_replication_role = origin;`);
  assert.deepEqual(distintas(o, await huellas(c)), ["datos|public.egresos"]);
});

test("un_renglon_que_falta_o_que_sobra_en_la_copia_se_nota", async () => {
  const c = await armarBase(); const o = await huellas(c);
  await c.exec(`insert into ingresos (id, datos) values ('de-mas', '{}')`);
  assert.deepEqual(distintas(o, await huellas(c)), ["datos|public.ingresos"]);
});

test("una_regla_de_acceso_que_no_se_restauro_se_nota", async () => {
  const c = await armarBase(); const o = await huellas(c);
  const { rows } = await c.query("select policyname, tablename from pg_policies where schemaname = 'public' and tablename = 'egresos' limit 1");
  await c.exec(`drop policy "${rows[0].policyname}" on egresos`);
  assert.ok(distintas(o, await huellas(c)).includes("estructura|reglas"));
});

test("un_permiso_otorgado_que_no_volvio_se_nota", async () => {
  const c = await armarBase();
  await c.exec(`set session_replication_role = replica; insert into permisos_operacion (usuario, operacion, otorgado_por) values ('00000000-0000-0000-0000-000000000002', 'cerrar_mes', '00000000-0000-0000-0000-000000000001'); set session_replication_role = origin;`);
  const o = await huellas(c);
  await c.exec(`set session_replication_role = replica; delete from permisos_operacion where operacion = 'cerrar_mes'; set session_replication_role = origin;`);
  assert.deepEqual(distintas(o, await huellas(c)), ["datos|public.permisos_operacion"]);
});

test("los_intentos_no_autorizados_se_rechazan_todos_y_no_dejan_nada_escrito", async () => {
  const db = await armarBase();
  const antes = await huellas(db);
  await db.exec("reset role");
  await db.exec(ATAQUES);          // si algo pasara, tronaría
  await db.exec("reset role");
  assert.deepEqual(distintas(antes, await huellas(db)), []);
});

test("una_copia_que_quedo_abierta_truena_y_dice_que_se_pudo_hacer", async () => {
  const db = await armarBase();
  await db.exec("alter table egresos disable row level security");
  await db.exec("reset role");
  await assert.rejects(db.exec(ATAQUES), /LA COPIA DEJA PASAR.*lee los gastos/);
  await db.exec("rollback").catch(() => {});
  await db.exec("reset role");
  const { rows } = await db.query("select count(*)::int n from egresos where id = 'intento-no-autorizado'");
  assert.equal(rows[0].n, 0);
});

// Un almacén de mentira: guarda lo que le suben y devuelve lo que tiene.
const almacen = (inicial = {}) => {
  const tiene = new Map(Object.entries(inicial));
  const pedir = async (url, o = {}) => {
    const k = decodeURIComponent(new URL(url).pathname.replace("/storage/v1/object/", ""));
    if (o.headers.Authorization !== "Bearer llave-de-mentira") return { ok: false, status: 401 };
    if (o.method === "POST") { tiene.set(k, Buffer.from(o.body)); return { ok: true, status: 200 }; }
    return tiene.has(k) ? { ok: true, status: 200, arrayBuffer: async () => tiene.get(k) } : { ok: false, status: 404, arrayBuffer: async () => Buffer.alloc(0) };
  };
  return { tiene, pedir };
};
const CLAVE = "una-frase-de-mentira-para-probar";
const con = (a) => ({ url: "https://mentira.invalid", llave: "llave-de-mentira", clave: CLAVE, pedir: a.pedir });

test("una_foto_vuelve_del_respaldo_identica_y_en_el_respaldo_no_se_puede_leer", async () => {
  const foto = Buffer.from("FOTO-DE-UN-TICKET-" + "x".repeat(500));
  const origen = almacen({ "comprobantes/archivo:abc.jpg": foto, "comprobantes/c/conv 1/nota de voz.webm": Buffer.from("audio") });
  const carpeta = mkdtempSync(join(tmpdir(), "resp-"));
  const lista = "comprobantes|archivo:abc.jpg|2026-11-21/518|image/jpeg\ncomprobantes|c/conv 1/nota de voz.webm|2026-11-21/5|audio/webm\n";
  const r = await bajar(lista, carpeta, con(origen));
  assert.deepEqual([r.nuevos, r.iguales, r.fallaron.length, r.total], [2, 0, 0, 2]);
  // En el respaldo no aparece ni el contenido ni el nombre del archivo.
  const guardados = readdirSync(carpeta, { recursive: true }).filter((f) => String(f).endsWith(".gpg"));
  assert.equal(guardados.length, 2);
  for (const f of guardados) { assert.ok(!readFileSync(join(carpeta, String(f))).includes("FOTO-DE-UN-TICKET")); assert.ok(!String(f).includes("abc")); }
  const destino = almacen();
  const s = await subir(carpeta, con(destino));
  assert.deepEqual([s.subidos, s.fallaron.length], [2, 0]);
  assert.ok(destino.tiene.get("comprobantes/archivo:abc.jpg").equals(foto));
  const c = await comprobar(carpeta, con(destino));
  assert.deepEqual([c.iguales, c.distintos.length], [2, 0]);
});

test("la_segunda_noche_solo_baja_lo_nuevo_y_no_borra_lo_que_ya_no_esta", async () => {
  const origen = almacen({ "comprobantes/a.jpg": Buffer.from("a"), "comprobantes/b.jpg": Buffer.from("b") });
  const carpeta = mkdtempSync(join(tmpdir(), "resp-"));
  await bajar("comprobantes|a.jpg|m1|image/jpeg\ncomprobantes|b.jpg|m1|image/jpeg\n", carpeta, con(origen));
  origen.tiene.delete("comprobantes/a.jpg"); origen.tiene.set("comprobantes/c.jpg", Buffer.from("c"));
  const r = await bajar("comprobantes|b.jpg|m1|image/jpeg\ncomprobantes|c.jpg|m1|image/jpeg\n", carpeta, con(origen));
  assert.deepEqual([r.nuevos, r.iguales, r.total], [1, 1, 3]);
  assert.ok(leerIndice(carpeta)["comprobantes/a.jpg"], "lo borrado en producción se conserva en el respaldo");
});

test("un_archivo_que_no_se_pudo_bajar_se_dice_y_no_se_da_por_respaldado", async () => {
  const carpeta = mkdtempSync(join(tmpdir(), "resp-"));
  const r = await bajar("comprobantes|no-existe.jpg|m1|image/jpeg\n", carpeta, con(almacen()));
  assert.equal(r.fallaron.length, 1);
  assert.equal(leerIndice(carpeta)["comprobantes/no-existe.jpg"], undefined);
});

test("con_otra_clave_el_respaldo_no_se_abre_y_un_archivo_distinto_en_la_copia_se_nota", async () => {
  const origen = almacen({ "comprobantes/a.jpg": Buffer.from("original") });
  const carpeta = mkdtempSync(join(tmpdir(), "resp-"));
  await bajar("comprobantes|a.jpg|m1|image/jpeg\n", carpeta, con(origen));
  await assert.rejects(subir(carpeta, { ...con(almacen()), clave: "otra-clave-que-no-es-la-buena" }), /clave/);
  const c = await comprobar(carpeta, con(almacen({ "comprobantes/a.jpg": Buffer.from("cambiado") })));
  assert.equal(c.distintos.length, 1);
});

test("los_guiones_nunca_restauran_sobre_produccion_ni_imprimen_las_llaves", () => {
  const restaurar = readFileSync(new URL("restaurar.sh", AQUI), "utf8");
  const respaldar = readFileSync(new URL("respaldar.sh", AQUI), "utf8");
  assert.match(restaurar, /El destino es PRODUCCIÓN/);
  assert.match(restaurar, /Sólo se restaura en un proyecto recién creado y vacío/);
  for (const g of [restaurar, respaldar]) {
    assert.ok(!/echo[^\n]*\$(BASE_URL|DESTINO_BASE_URL|LLAVE_SERVICIO|DESTINO_LLAVE_SERVICIO|CLAVE_RESPALDO)\b/.test(g), "un guion imprime una llave");
    assert.ok(!/set -[a-z]*x/.test(g), "un guion enseña cada orden que corre");
  }
  for (const f of ["respaldo.yml", "restaurar.yml"]) {
    const y = readFileSync(new URL("flujos/" + f, AQUI), "utf8");
    assert.ok(!/run:[^\n]*\$\{\{/.test(y), f + " mete un valor directo en una orden");
  }
});
