// Los eventos en la base: no se editan, lo cancelado no revive, no se borran.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { armarBase, como, verdad } from "./base.mjs";

let db;
const E = (id, mas = {}) => JSON.stringify({ trabajadorId: "t1", sentido: "entrada", cuando: "2026-11-19T12:00:00.000Z", _espacio: "prueba", ...mas, _id: id });
const mete = (quien, id, datos = E(id)) => como(db, quien, "insert into eventos (id, tipo, fecha, estado, datos) values ($1, 'marca', '2026-11-19', 'vigente', $2::jsonb)", [id, datos]);
const fila = async (id) => (await verdad(db, "select estado, datos, borrado from eventos where id = $1", [id]))[0];
before(async () => {
  db = await armarBase();
  const esp = (await verdad(db, "select espacio from operacion"))[0]?.espacio;
  if (esp && esp !== "prueba") throw new Error("la base de pruebas trae otro espacio: " + esp);
  if (!esp) await verdad(db, "select sellar_espacio('prueba')");
});

test("el_encargado_registra_marcas_y_quien_no_tiene_perfil_no", async () => {
  assert.ok((await mete("encargado", "e1")).ok);
  assert.equal((await mete("intruso", "e-intruso")).ok, false);
  assert.equal((await mete(null, "e-anon")).ok, false);
  assert.equal((await mete("finanzas", "e-fin")).ok, false, "finanzas sólo lee");
  assert.equal((await como(db, "finanzas", "select id from eventos")).filas.length, 1);
});

test("un_evento_no_nace_ya_cancelado", async () => {
  const r = await como(db, "encargado", "insert into eventos (id, tipo, fecha, estado, datos) values ('e-nace-mal', 'marca', '2026-11-19', 'cancelado', $1::jsonb)", [E("x")]);
  assert.equal(r.ok, false);
});

test("nadie_le_cambia_la_hora_ni_la_persona_a_un_evento_ni_un_superadministrador", async () => {
  for (const quien of ["encargado", "luis"]) {
    const r = await como(db, quien, "update eventos set datos = $1::jsonb where id = 'e1'", [E("e1", { cuando: "2026-11-19T10:00:00.000Z" })]);
    assert.equal(r.ok, false); assert.match(r.error, /no se edita/);
    assert.equal((await como(db, quien, "update eventos set fecha = '2026-11-18' where id = 'e1'")).ok, false);
    assert.equal((await como(db, quien, "update eventos set datos = $1::jsonb where id = 'e1'", [E("e1", { trabajadorId: "otro" })])).ok, false);
  }
  assert.equal((await fila("e1")).datos.cuando, "2026-11-19T12:00:00.000Z");
});

test("cancelar_exige_motivo_y_lo_que_decia_se_conserva", async () => {
  assert.equal((await como(db, "encargado", "update eventos set estado = 'cancelado' where id = 'e1'")).ok, false);
  const ok = await como(db, "encargado", "update eventos set estado = 'cancelado', datos = $1::jsonb where id = 'e1'",
    [E("e1", { cancelado: { motivo: "pasó la credencial sin querer", por: { id: "x", nombre: "Encargado" }, cuando: "2026-11-19T13:00:00.000Z" } })]);
  assert.ok(ok.ok, ok.error);
  const f = await fila("e1");
  assert.equal(f.estado, "cancelado"); assert.equal(f.datos.trabajadorId, "t1"); assert.equal(f.datos.cancelado.motivo, "pasó la credencial sin querer");
});

test("la_copia_vieja_de_un_telefono_sin_senal_no_revive_lo_cancelado", async () => {
  // Así sube la app: insert … on conflict do update, con lo que ese teléfono tenía guardado.
  const r = await como(db, "encargado", `insert into eventos (id, tipo, fecha, estado, datos) values ('e1', 'marca', '2026-11-19', 'vigente', $1::jsonb)
    on conflict (id) do update set estado = excluded.estado, datos = excluded.datos, actualizado = now()`, [E("e1")]);
  assert.ok(r.ok, "y no truena: se ignora en silencio — " + r.error);
  assert.equal((await fila("e1")).estado, "cancelado");
  assert.ok((await fila("e1")).datos.cancelado, "ni pierde su motivo");
});

test("subir_dos_veces_el_mismo_evento_es_un_solo_renglon", async () => {
  const sube = () => como(db, "encargado", `insert into eventos (id, tipo, fecha, estado, datos) values ('e2', 'marca', '2026-11-19', 'vigente', $1::jsonb)
    on conflict (id) do update set estado = excluded.estado, datos = excluded.datos, actualizado = now()`, [E("e2")]);
  assert.ok((await sube()).ok); assert.ok((await sube()).ok); assert.ok((await sube()).ok);
  assert.equal(Number((await verdad(db, "select count(*) n from eventos where id = 'e2'"))[0].n), 1);
});

test("un_evento_no_se_borra_ni_con_lapida_ni_directo", async () => {
  assert.equal((await como(db, "luis", "select borrar_registro('eventos', 'e2')")).ok, false);
  assert.equal((await como(db, "luis", "update eventos set borrado = now() where id = 'e2'")).ok, false);
  await como(db, "luis", "delete from eventos where id = 'e2'");
  assert.equal(Number((await verdad(db, "select count(*) n from eventos"))[0].n), 2);
});

test("corregir_marca_el_anterior_y_exige_decir_cual_lo_corrige", async () => {
  assert.equal((await como(db, "encargado", "update eventos set estado = 'corregido' where id = 'e2'")).ok, false);
  assert.ok((await mete("encargado", "e3", E("e3", { cuando: "2026-11-19T13:00:00.000Z", origen: "e2", relacion: "corrige" }))).ok);
  assert.ok((await como(db, "encargado", "update eventos set estado = 'corregido', datos = $1::jsonb where id = 'e2'", [E("e2", { corregidoPor: "e3" })])).ok);
  assert.equal((await fila("e2")).estado, "corregido");
});

test("un_evento_sin_la_marca_de_esta_operacion_no_entra", async () => {
  const r = await mete("encargado", "e-viejo", JSON.stringify({ trabajadorId: "t1", _espacio: "otro-proyecto" }));
  assert.equal(r.ok, false); assert.match(r.error, /no es de esta operación/);
});

// ── La hora la pone el servidor (hoja 36) ──
test("quien_sube_un_evento_no_puede_decir_cuando_lo_recibio_el_servidor", async () => {
  const r = await como(db, "encargado", "insert into eventos (id, tipo, fecha, estado, datos, recibido, actualizado) values ('e-hora', 'marca', '2026-11-19', 'vigente', $1::jsonb, '2020-01-01', '2020-01-01')", [E("e-hora")]);
  assert.ok(r.ok, r.error);
  const [f] = await verdad(db, "select recibido, actualizado, now() as ahora from eventos where id = 'e-hora'");
  assert.ok(new Date(f.recibido).getFullYear() >= 2024, "la base puso su propia hora, no la de 2020 que mandó el teléfono");
  assert.ok(new Date(f.actualizado).getFullYear() >= 2024, "y la marca con que los demás aparatos piden lo nuevo tampoco la pone el teléfono");
});

test("cancelar_un_evento_no_le_cambia_la_hora_en_que_se_recibio", async () => {
  const antes = (await verdad(db, "select recibido from eventos where id = 'e-hora'"))[0].recibido;
  const r = await como(db, "encargado", "update eventos set estado = 'cancelado', recibido = '2030-01-01', datos = datos || $1::jsonb where id = 'e-hora'", [JSON.stringify({ cancelado: { motivo: "prueba", por: { id: "x" }, cuando: "2026-11-19T13:00:00.000Z" } })]);
  assert.ok(r.ok, r.error);
  const [f] = await verdad(db, "select recibido, estado from eventos where id = 'e-hora'");
  assert.equal(f.estado, "cancelado"); assert.equal(String(f.recibido), String(antes));
});

test("cualquier_cuenta_con_perfil_puede_preguntar_la_hora_del_servidor_y_un_anonimo_no", async () => {
  assert.ok((await como(db, "encargado", "select hora_del_servidor() as h")).ok);
  assert.equal((await como(db, null, "select hora_del_servidor() as h")).ok, false);
});
