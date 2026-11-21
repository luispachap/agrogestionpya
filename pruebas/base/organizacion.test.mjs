// La organización y el catálogo de actividades los captura sólo quien tiene el permiso OTORGADO (hoja 52).
// Se ataca la base directo, sin pasar por la app: esconder un botón no es una puerta.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { armarBase, como, verdad, CUENTAS } from "./base.mjs";

let db;
const D = (datos = {}, mas = {}) => JSON.stringify({ cuando: "2026-11-23T15:00:00.000Z", quien: { id: "u-falso", nombre: "Dice que es administrador", rol: "admin" }, datos, _espacio: "prueba", ...mas });
const mete = (quien, id, tipo, datos = {}) => como(db, quien, "insert into eventos (id, tipo, fecha, estado, datos) values ($1, $2, '2026-11-23', 'vigente', $3::jsonb)", [id, tipo, D(datos)]);
const fila = async (id) => (await verdad(db, "select * from eventos where id = $1", [id]))[0];
const UNIDAD = { unidadId: "u1", nombre: "Equipo inventado", clase: "equipo", dependeDe: null, desde: "2026-11-23" };
const TIPOS = ["org_unidad", "org_unidad_cambio", "org_unidad_cierre", "org_cargo", "org_cargo_fin", "org_adscripcion", "org_adscripcion_fin", "org_apoyo", "act_actividad", "act_equivalencia", "act_requisito"];
before(async () => {
  db = await armarBase();
  const esp = (await verdad(db, "select espacio from operacion"))[0]?.espacio;
  if (esp && esp !== "prueba") throw new Error("la base de pruebas trae otro espacio: " + esp);
  if (!esp) await verdad(db, "select sellar_espacio('prueba')");
});

test("la_hoja_no_le_dio_el_permiso_a_nadie", async () => {
  assert.equal((await verdad(db, "select count(*)::int n from permisos_operacion where operacion = 'configurar_organizacion'"))[0].n, 0);
  assert.deepEqual((await verdad(db, "select tipo from operaciones_sensibles where operacion = 'configurar_organizacion' order by tipo")).map(x => x.tipo), [...TIPOS].sort());
});

test("sin_el_permiso_otorgado_nadie_captura_la_organizacion_ni_el_superadministrador", async () => {
  for (const t of TIPOS) for (const q of ["encargado", "agronomo", "luis", "migue"]) {
    const r = await mete(q, `o-no-${q}-${t}`, t, UNIDAD);
    assert.ok(r.ok, `${q}/${t}: se guarda (la cola del teléfono no se atora) — ${r.error}`);
    const f = await fila(`o-no-${q}-${t}`);
    assert.equal(f.validacion, "rechazado", `${q}/${t}`); assert.equal(f.validacion_dice, "sin_permiso"); assert.equal(f.validado_por, CUENTAS[q], "quién lo subió lo dice la sesión");
  }
  assert.equal((await mete("finanzas", "o-fin", "org_unidad", UNIDAD)).ok, false, "quien no puede guardar eventos, ni eso");
  assert.equal((await mete("dueno", "o-due", "org_unidad", UNIDAD)).ok, false);
  assert.equal((await mete("intruso", "o-int", "org_unidad", UNIDAD)).ok, false);
  assert.equal((await mete(null, "o-anon", "org_unidad", UNIDAD)).ok, false);
});

test("ni_escribiendo_el_sello_a_mano_ni_con_un_update_se_autoriza", async () => {
  const r = await como(db, "encargado", "insert into eventos (id, tipo, fecha, estado, datos, validacion, validado_rol) values ('o-sello', 'org_cargo', '2026-11-23', 'vigente', $1::jsonb, 'autorizado', 'superadmin')", [D({ unidadId: "u1", persona: { id: "p1", nombre: "x" }, desde: "2026-11-23" })]);
  assert.ok(r.ok, r.error); assert.equal((await fila("o-sello")).validacion, "rechazado");
  await como(db, "encargado", "update eventos set validacion = 'autorizado' where id = 'o-sello'");
  assert.equal((await fila("o-sello")).validacion, "rechazado");
});

test("el_permiso_lo_otorga_un_superadministrador_cuenta_por_cuenta_y_queda_quien_lo_dio", async () => {
  assert.equal((await como(db, "encargado", "select otorgar_permiso($1, 'configurar_organizacion')", [CUENTAS.encargado])).ok, false, "nadie se lo da solo");
  assert.equal((await como(db, "agronomo", "select otorgar_permiso($1, 'configurar_organizacion')", [CUENTAS.agronomo])).ok, false);
  const r = await como(db, "luis", "select otorgar_permiso($1, 'configurar_organizacion')", [CUENTAS.migue]); assert.ok(r.ok, r.error);
  const p = (await verdad(db, "select usuario, otorgado_por from permisos_operacion where operacion = 'configurar_organizacion' and revocado is null"));
  assert.deepEqual(p.map(x => [x.usuario, x.otorgado_por]), [[CUENTAS.migue, CUENTAS.luis]]);
  for (const t of TIPOS) { assert.ok((await mete("migue", `o-si-${t}`, t, UNIDAD)).ok); assert.equal((await fila(`o-si-${t}`)).validacion, "autorizado", t); }
  assert.ok((await mete("luis", "o-luis-otra", "org_unidad", UNIDAD)).ok); assert.equal((await fila("o-luis-otra")).validacion, "rechazado", "el otro superadministrador sigue sin él: es por cuenta");
});

test("ese_permiso_no_da_ningun_otro_ni_dinero_ni_mando_ni_conversaciones", async () => {
  for (const [t, datos] of [["pago_personal", { monto: 500 }], ["cierre_semana", {}], ["prestamo_autorizacion", { monto: 100 }], ["ajuste", {}]]) {
    await como(db, "luis", "select otorgar_permiso($1, 'configurar_organizacion')", [CUENTAS.encargado]);
    assert.ok((await mete("encargado", `o-otro-${t}`, t, datos)).ok); assert.equal((await fila(`o-otro-${t}`)).validacion, "rechazado", `${t}: configurar la organización no autoriza esto`);
  }
  assert.deepEqual((await verdad(db, "select distinct operacion from permisos_operacion where usuario = $1 and revocado is null", [CUENTAS.encargado])).map(x => x.operacion), ["configurar_organizacion"]);
  assert.equal((await como(db, "encargado", "select ver_evidencia('ev-x', 'motivo de prueba largo')")).ok, false);
});

test("quitarlo_surte_efecto_y_no_deshace_lo_que_ya_se_habia_capturado", async () => {
  assert.ok((await mete("encargado", "o-antes", "org_unidad", UNIDAD)).ok); assert.equal((await fila("o-antes")).validacion, "autorizado");
  assert.ok((await como(db, "luis", "select revocar_permiso($1, 'configurar_organizacion')", [CUENTAS.encargado])).ok);
  assert.ok((await mete("encargado", "o-despues", "org_unidad", UNIDAD)).ok); assert.equal((await fila("o-despues")).validacion, "rechazado");
  assert.equal((await fila("o-antes")).validacion, "autorizado", "lo hecho con permiso se queda");
  const h = (await verdad(db, "select revocado_por from permisos_operacion where usuario = $1 and operacion = 'configurar_organizacion'", [CUENTAS.encargado]))[0];
  assert.equal(h.revocado_por, CUENTAS.luis, "queda quién lo quitó");
});

test("cancelar_un_hecho_de_la_organizacion_sin_el_permiso_no_surte_efecto", async () => {
  const cancelado = D(UNIDAD, { cancelado: { motivo: "porque sí", por: { id: "x", nombre: "x" }, cuando: "2026-11-23T16:00:00.000Z" } });
  await como(db, "encargado", "update eventos set estado = 'cancelado', datos = $1::jsonb where id = 'o-si-org_unidad'", [cancelado]);
  const f = await fila("o-si-org_unidad");
  assert.equal(f.estado, "vigente", "el renglón se queda como estaba"); assert.ok(f.cambio_rechazado, "y queda anotado el intento");
  await como(db, "migue", "update eventos set estado = 'cancelado', datos = $1::jsonb where id = 'o-si-org_unidad'", [cancelado]);
  assert.equal((await fila("o-si-org_unidad")).estado, "cancelado", "quien tiene el permiso sí lo cancela");
  assert.equal((await como(db, "migue", "delete from eventos where id = 'o-si-org_unidad'")).afectadas || 0, 0, "y nadie lo borra");
});

test("lo_sensible_de_antes_sigue_validandose_igual", async () => {
  assert.ok((await mete("luis", "o-pago-luis", "pago_personal", { monto: 500 })).ok); assert.equal((await fila("o-pago-luis")).validacion, "autorizado", "el superadministrador sigue autorizando pagos por serlo");
  assert.ok((await mete("agronomo", "o-pago-ag", "pago_personal", { monto: 500 })).ok); assert.equal((await fila("o-pago-ag")).validacion, "rechazado");
  assert.ok((await mete("encargado", "o-marca", "marca", { trabajadorId: "t1", sentido: "entrada" })).ok); assert.equal((await fila("o-marca")).validacion, null, "lo que no es sensible no lleva sello");
});
