// El tope mensual de IA, atacando la base directo: aparta antes de gastar, avisa al 70 %, bloquea al llegar,
// y desde la app nadie puede apartar ni inflar. Base aislada, cuentas de mentira: ninguna prueba gasta.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { armarBase, como, CUENTAS } from "./base.mjs";

let db;
const apartar = async (max, operacion = "foto_en_mensaje", funcion = "leer-papel") => (await db.query("select reservar_ia_mes($1, $2, $3, 'claude-haiku-5-5', 'economico', $4, $5, 'msj-1') r", [funcion, "h" + Math.random(), CUENTAS.encargado, max, operacion])).rows[0].r;
before(async () => { db = await armarBase(); await db.query("update limites set ia_mes_tope_microusd = 10000, ia_mes_aviso_pct = 70, ia_llamadas_mes = 50 where id = 'unico'"); });

test("cada_llamada_queda_con_quien_la_pidio_el_modelo_y_la_operacion_que_la_origino", async () => {
  const r = await apartar(2000);
  assert.ok(r.id); assert.equal(r.aviso, false);
  await db.query("select cerrar_ia($1, 1500, 400, 350, '{\"ok\":true}'::jsonb, false)", [r.id]);
  const f = (await db.query("select cuenta, modelo, nivel, entrada, salida, microusd, operacion, origen, estado from uso_ia where id = $1", [r.id])).rows[0];
  assert.deepEqual(f, { cuenta: CUENTAS.encargado, modelo: "claude-haiku-5-5", nivel: "economico", entrada: 1500, salida: 400, microusd: 350, operacion: "foto_en_mensaje", origen: "msj-1", estado: "hecha" });
});

test("avisa_al_70_por_ciento_y_bloquea_al_llegar_al_tope_del_mes", async () => {
  // Van 350 gastados de 10,000. Apartar 6,700 deja el mes en 70.5 %: avisa, pero pasa.
  const a = await apartar(6700); assert.ok(a.id); assert.equal(a.aviso, true);
  await db.query("select cerrar_ia($1, 1, 1, 6700, '{}'::jsonb, false)", [a.id]);
  // Lo que ya no cabe no se aparta: no se llama a la IA.
  const b = await apartar(3000); assert.equal(b.id, null); assert.equal(b.motivo, "tope_del_mes");
  // Lo que sí cabe, sí.
  const c = await apartar(2000); assert.ok(c.id);
  // Una llamada que falló no cuesta: libera lo apartado.
  await db.query("select cerrar_ia($1, null, null, 0, null, true)", [c.id]);
  assert.ok((await apartar(2000)).id);
});

test("lo_gastado_el_mes_pasado_no_cuenta_para_este_mes", async () => {
  await db.query("insert into uso_ia (huella, funcion, de_cache, microusd, estado, cuando) values ('viejo', 'leer-papel', false, 9000000, 'hecha', now() - interval '40 days')");
  const e = (await como(db, "luis", "select estado_de_ia() e")).filas[0].e;
  assert.ok(e.gastado_microusd < 10000, JSON.stringify(e));
});

test("quien_administra_ve_el_gasto_del_mes_y_los_demas_no", async () => {
  const e = (await como(db, "luis", "select estado_de_ia() e")).filas[0].e;
  assert.equal(e.tope_microusd, 10000); assert.ok(["aviso", "bloqueado"].includes(e.estado)); assert.ok(e.por_operacion.some(x => x.operacion === "foto_en_mensaje" && x.modelo === "claude-haiku-5-5"));
  assert.equal((await como(db, "encargado", "select estado_de_ia() e")).filas[0].e, null);
  assert.equal((await como(db, "finanzas", "select estado_de_ia() e")).filas[0].e.tope_microusd, 10000);
});

test("desde_la_app_nadie_aparta_gasto_ni_sube_el_tope_salvo_el_superadministrador", async () => {
  assert.equal((await como(db, "encargado", "select reservar_ia_mes('leer-papel', 'x', null, 'm', 'economico', 10, 'x')")).ok, false);
  assert.equal((await como(db, "luis", "select reservar_ia_mes('leer-papel', 'x', null, 'm', 'economico', 10, 'x')")).ok, false, "ni el superadministrador: sólo el servidor");
  assert.equal((await como(db, "encargado", "update limites set ia_mes_tope_microusd = 99999999 where id = 'unico'")).afectadas, 0);
  assert.equal((await como(db, "luis", "update limites set ia_mes_tope_microusd = 20000 where id = 'unico'")).afectadas, 1);
});
