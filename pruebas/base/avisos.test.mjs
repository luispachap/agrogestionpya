// Los avisos al teléfono, en la base aislada: cada quien suscribe lo suyo, nadie lee las llaves y avisar no bloquea.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { armarBase, como, verdad, CUENTAS } from "./base.mjs";
let db; before(async () => { db = await armarBase(); });
const sus = (quien, endpoint = "https://push.invalid/abc") => como(db, quien, "select guardar_suscripcion($1, 'llave-publica-del-aparato', 'secreto-del-aparato', 'Teléfono de prueba')", [endpoint]);

test("cada_quien_suscribe_su_aparato_y_solo_ve_los_suyos", async () => {
  assert.ok((await sus("encargado")).ok); assert.ok((await sus("agronomo", "https://push.invalid/otro")).ok);
  assert.deepEqual((await como(db, "encargado", "select endpoint from avisos_suscripciones")).filas, [{ endpoint: "https://push.invalid/abc" }]);
  assert.equal((await sus("intruso", "https://push.invalid/x")).ok, false, "sin perfil no hay avisos"); assert.equal((await sus(null, "https://push.invalid/y")).ok, false);
  assert.equal((await como(db, "encargado", "insert into avisos_suscripciones (endpoint, usuario, p256dh, auth) values ('https://push.invalid/z', $1, 'a', 'b')", [CUENTAS.agronomo])).ok, false, "nadie suscribe a otro por su lado");
});

test("un_telefono_que_cambia_de_manos_deja_de_recibir_los_avisos_de_la_otra_persona", async () => {
  assert.ok((await sus("finanzas", "https://push.invalid/abc")).ok);
  const de = await verdad(db, "select usuario from avisos_suscripciones where endpoint = 'https://push.invalid/abc'");
  assert.deepEqual(de, [{ usuario: CUENTAS.finanzas }]);
  await como(db, "encargado", "select quitar_suscripcion('https://push.invalid/abc')");
  assert.equal((await verdad(db, "select count(*)::int n from avisos_suscripciones where endpoint = 'https://push.invalid/abc'"))[0].n, 1, "nadie quita el aparato de otro");
  assert.ok((await como(db, "finanzas", "select quitar_suscripcion('https://push.invalid/abc')")).ok);
  assert.equal((await verdad(db, "select count(*)::int n from avisos_suscripciones where endpoint = 'https://push.invalid/abc'"))[0].n, 0);
});

test("las_llaves_de_los_avisos_no_las_lee_ninguna_cuenta_ni_el_superadministrador", async () => {
  await db.query("update avisos_llaves set publica = 'PUBLICA', privada = 'PRIVADA' where id = 'unico'");
  for (const quien of ["luis", "encargado", "intruso", null]) assert.equal(((await como(db, quien, "select privada, secreto from avisos_llaves")).filas || []).length, 0, String(quien));
  assert.equal((await como(db, "encargado", "select llave_publica_de_avisos() k")).filas[0].k, "PUBLICA", "la pública sí: es para suscribirse");
  assert.equal(((await como(db, "luis", "select * from avisos_enviados")).filas || []).length, 0);
});

test("las_preferencias_son_de_cada_quien", async () => {
  assert.ok((await como(db, "agronomo", "select guardar_preferencias_de_avisos('{\"mensajes\":false}'::jsonb)")).ok);
  assert.deepEqual((await como(db, "agronomo", "select datos from avisos_preferencias")).filas, [{ datos: { mensajes: false } }]);
  assert.equal(((await como(db, "encargado", "select datos from avisos_preferencias")).filas || []).length, 0);
});

test("avisar_nunca_bloquea_el_registro_aunque_no_haya_con_que_avisar", async () => {
  await db.query("update avisos_llaves set url = 'https://funcion.invalid/avisar' where id = 'unico'");
  assert.ok((await como(db, "encargado", `insert into chat (id, datos) values ('m-aviso', '{"texto":"hola"}'::jsonb)`)).ok);
  assert.ok((await como(db, "encargado", `insert into incidencias (id, datos) values ('inc-aviso', '{"desc":"fuga"}'::jsonb)`)).ok);
});
