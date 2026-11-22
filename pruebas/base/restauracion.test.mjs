// Restaurar un respaldo no reescribe la historia: se ataca directo, sin pasar por la app.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { armarBase, como, verdad, CUENTAS } from "./base.mjs";

let db;
const D = (datos, mas = {}) => JSON.stringify({ cuando: "2026-11-19T12:00:00.000Z", quien: { id: CUENTAS.migue, nombre: "QUIEN LO CAPTURÓ", rol: "admin" }, datos, _espacio: "prueba", ...mas });
const PAGO = { a: { tipo: "trabajador", id: "t1", nombre: "Ana" }, desde: "2026-11-16", hasta: "2026-11-22", monto: 500, medio: "efectivo" };
// Así sube la app: alta o, si ya existe, el mismo renglón.
const SUBE = `insert into eventos (id, tipo, fecha, estado, datos) values ($1, $2, '2026-11-19', 'vigente', $3::jsonb)
  on conflict (id) do update set tipo = excluded.tipo, fecha = excluded.fecha, estado = excluded.estado, datos = excluded.datos`;
const fila = async (id) => (await verdad(db, "select * from eventos where id = $1", [id]))[0];
// El sello como lo trae el respaldo: lo que la base devolvió, con su firma. Las fechas viajan como texto, tal cual.
const sello = async (id) => (await verdad(db, "select validacion, validacion_dice dice, validado_por por, validado_rol rol, validado::text cuando, recibido::text recibido, sello_firma firma from eventos where id = $1", [id]))[0];
const pierde = (id) => verdad(db, "delete from eventos where id = $1", [id]);   // sólo el dueño de la base puede: es la falla que se simula
const VIEJO = "2026-11-19 12:00:05+00";
// Para la prueba: como si el evento se hubiera recibido y sellado hace días (la base lo firmó ENTONCES con esas fechas).
const envejece = async (id) => { await verdad(db, "alter table eventos disable trigger user");
  await verdad(db, "update eventos set validado = case when validado is null then null else $2::timestamptz end, recibido = $2::timestamptz where id = $1", [id, VIEJO]);
  await verdad(db, "update eventos set sello_firma = firma_de_sello(id, tipo, estado, datos, validacion, validacion_dice, validado_por, validado_rol, validado, recibido) where id = $1", [id]);
  await verdad(db, "alter table eventos enable trigger user"); };

before(async () => {
  db = await armarBase();
  if (!(await verdad(db, "select espacio from operacion"))[0]?.espacio) await verdad(db, "select sellar_espacio('prueba')");
  // Un pago que autorizó Migue hace días, y un hecho de organización con un permiso que sólo Migue tiene.
  await verdad(db, "insert into permisos_operacion (usuario, operacion, otorgado_por) values ($1, 'configurar_organizacion', $2)", [CUENTAS.migue, CUENTAS.luis]);
  for (const [id, tipo, datos] of [["r-pago", "pago_personal", PAGO], ["r-org", "org_unidad", { id: "u1", nombre: "AREA INVENTADA" }], ["r-marca", "marca", { trabajadorId: "t1", clase: "entrada" }]]) {
    const r = await como(db, "migue", SUBE, [id, tipo, D(datos)]); assert.ok(r.ok, r.error);
    await envejece(id);
  }
});

test("sin_abrir_una_restauracion_el_sello_escrito_en_el_evento_no_vale_nada", async () => {
  const original = await sello("r-pago"); await pierde("r-pago");
  const r = await como(db, "luis", SUBE, ["r-pago", "pago_personal", D(PAGO, { _selloOriginal: original })]); assert.ok(r.ok, r.error);
  const f = await fila("r-pago");
  assert.equal(f.validado_por, CUENTAS.luis, "se selló como siempre: con quien lo subió");
  assert.equal(f.restaurado, null); assert.equal(f.datos._selloOriginal, undefined, "y el sello escrito no se guardó dentro del evento");
  // se deja como estaba para las pruebas siguientes
  await pierde("r-pago"); await como(db, "migue", SUBE, ["r-pago", "pago_personal", D(PAGO)]);
  await envejece("r-pago");
});

test("un_encargado_no_puede_abrir_una_restauracion_ni_restaurar_con_un_sello_inventado", async () => {
  const r = await como(db, "encargado", "select abrir_restauracion('quiero restaurar')");
  assert.equal(r.ok, false); assert.match(r.error, /superadministrador/);
  const falso = { validacion: "autorizado", por: CUENTAS.luis, rol: "superadmin", cuando: "2026-11-01T00:00:00Z", recibido: "2026-11-01T00:00:00Z", firma: "inventada" };
  await como(db, "encargado", SUBE, ["r-falso", "pago_personal", D(PAGO, { _selloOriginal: falso })]);
  const f = await fila("r-falso");
  assert.equal(f.validacion, "rechazado"); assert.equal(f.validado_por, CUENTAS.encargado); assert.equal(f.restaurado, null);
});

test("abrir_una_restauracion_pide_motivo_y_queda_anotada_sin_que_nadie_la_pueda_tocar", async () => {
  assert.equal((await como(db, "luis", "select abrir_restauracion('  ')")).ok, false);
  const r = await como(db, "luis", "select abrir_restauracion('Se perdieron los eventos del 19 de noviembre')"); assert.ok(r.ok, r.error);
  const a = await verdad(db, "select * from restauraciones");
  assert.equal(a.length, 1); assert.equal(a[0].abierta_por, CUENTAS.luis); assert.match(a[0].motivo, /Se perdieron/);
  assert.equal((await como(db, "luis", "update restauraciones set motivo = 'otro' where id = $1", [a[0].id])).afectadas || 0, 0);
  assert.equal((await como(db, "luis", "delete from restauraciones where id = $1", [a[0].id])).afectadas || 0, 0);
  assert.equal((await verdad(db, "select motivo from restauraciones"))[0].motivo, a[0].motivo);
});

test("con_la_restauracion_abierta_un_pago_perdido_recupera_a_quien_lo_autorizo_y_su_fecha_y_queda_marcado_como_restaurado", async () => {
  const original = await sello("r-pago"); await pierde("r-pago");
  const r = await como(db, "luis", SUBE, ["r-pago", "pago_personal", D(PAGO, { _selloOriginal: original })]); assert.ok(r.ok, r.error);
  const f = await fila("r-pago");
  assert.equal(f.validacion, "autorizado");
  assert.equal(f.validado_por, CUENTAS.migue, "lo autorizó quien lo autorizó, no quien restaura");
  assert.equal(f.validado.toISOString(), new Date(VIEJO).toISOString(), "con su fecha original");
  assert.equal(f.recibido.toISOString(), new Date(VIEJO).toISOString());
  assert.equal(f.restaurado_por, CUENTAS.luis, "y queda dicho quién lo restauró"); assert.ok(f.restaurado);
  assert.equal(f.datos.quien.nombre, "QUIEN LO CAPTURÓ"); assert.equal(f.datos._selloOriginal, undefined);
  assert.equal((await verdad(db, "select eventos from restauraciones order by desde desc limit 1"))[0].eventos, 1);
});

test("una_decision_que_quien_restaura_no_podria_tomar_no_se_vuelve_rechazada_al_restaurarla", async () => {
  const original = await sello("r-org"); assert.equal(original.validacion, "autorizado"); await pierde("r-org");
  await como(db, "luis", SUBE, ["r-org", "org_unidad", D({ id: "u1", nombre: "AREA INVENTADA" }, { _selloOriginal: original })]);
  const f = await fila("r-org");
  assert.equal(f.validacion, "autorizado"); assert.equal(f.validado_por, CUENTAS.migue); assert.equal(f.restaurado_por, CUENTAS.luis);
});

test("un_evento_que_no_es_sensible_conserva_la_hora_en_que_la_base_lo_recibio", async () => {
  const sm = await sello("r-marca"); await pierde("r-marca");
  await como(db, "luis", SUBE, ["r-marca", "marca", D({ trabajadorId: "t1", clase: "entrada" }, { _selloOriginal: sm })]);
  const f = await fila("r-marca");
  assert.equal(f.recibido.toISOString(), new Date(VIEJO).toISOString()); assert.equal(f.validacion, null); assert.equal(f.restaurado_por, CUENTAS.luis);
});

test("lo_que_no_se_perdio_no_se_toca_ni_se_marca_como_restaurado", async () => {
  const antes = await fila("r-pago");
  const r = await como(db, "luis", SUBE, ["r-pago", "pago_personal", D(PAGO, { _selloOriginal: { validacion: "rechazado", por: CUENTAS.luis, rol: "superadmin", cuando: "2026-01-01T00:00:00Z" } })]); assert.ok(r.ok, r.error);
  const f = await fila("r-pago");
  assert.equal(f.validacion, antes.validacion); assert.equal(f.validado_por, antes.validado_por); assert.equal(f.validado.toISOString(), antes.validado.toISOString());
  assert.equal(f.restaurado.toISOString(), antes.restaurado.toISOString(), "sigue con la marca de su única restauración");
});

test("un_sello_mal_escrito_no_restaura_nada_y_se_valida_como_siempre", async () => {
  await como(db, "luis", SUBE, ["r-roto", "pago_personal", D(PAGO, { _selloOriginal: { validacion: "autorizado", por: "esto-no-es-una-cuenta", cuando: "ayer" } })]);
  const f = await fila("r-roto");
  assert.equal(f.validado_por, CUENTAS.luis); assert.equal(f.restaurado, null);
});

test("pasada_la_hora_la_restauracion_ya_no_sirve", async () => {
  await verdad(db, "update restauraciones set hasta = now() - interval '1 minute'");
  const original = await sello("r-org"); await pierde("r-org");
  await como(db, "luis", SUBE, ["r-org", "org_unidad", D({ id: "u1", nombre: "AREA INVENTADA" }, { _selloOriginal: original })]);
  const f = await fila("r-org");
  assert.equal(f.validado_por, CUENTAS.luis); assert.equal(f.validacion, "rechazado", "sin restauración abierta se valida con quien sube, y él no tiene ese permiso");
});

test("restaurar_la_bitacora_no_truena_ni_la_modifica_lo_que_ya_esta_se_queda_y_lo_que_falta_entra", async () => {
  const d = (accion) => JSON.stringify({ accion, _espacio: "prueba" });
  // Así sube la app al restaurar: «si ya está, nada».
  const RESTAURA = "insert into auditoria (id, datos) values ($1, $2::jsonb), ($3, $4::jsonb) on conflict (id) do nothing";
  await como(db, "migue", "insert into auditoria (id, datos) values ('b-uno', $1::jsonb)", [d("lo original")]);
  const r = await como(db, "luis", RESTAURA, ["b-uno", d("lo del respaldo, distinto"), "b-dos", d("se había perdido")]); assert.ok(r.ok, r.error);
  const filas = await verdad(db, "select id, datos->>'accion' accion from auditoria where id in ('b-uno', 'b-dos') order by id");
  assert.deepEqual(filas.map(f => [f.id, f.accion]), [["b-dos", "se había perdido"], ["b-uno", "lo original"]]);
  // y con la forma vieja (pisar lo que ya está) la base lo rechaza: la bitácora no se modifica ni restaurando
  const pisa = await como(db, "luis", "insert into auditoria (id, datos) values ('b-uno', $1::jsonb) on conflict (id) do update set datos = excluded.datos", [d("pisado")]);
  assert.equal(pisa.ok, false);
});

test("restaurar_no_pisa_lo_que_alguien_corrigio_despues_del_respaldo", async () => {
  await como(db, "migue", "insert into trabajadores (id, nombre, datos) values ('r-t1', 'PERSONA INVENTADA', $1::jsonb)", [JSON.stringify({ sueldo_dia: 400, _espacio: "prueba" })]);
  const r = await como(db, "luis", "insert into trabajadores (id, nombre, datos) values ('r-t1', 'PERSONA INVENTADA', $1::jsonb) on conflict (id) do nothing", [JSON.stringify({ sueldo_dia: 350, _espacio: "prueba" })]); assert.ok(r.ok, r.error);
  assert.equal((await verdad(db, "select datos->>'sueldo_dia' s from trabajadores where id = 'r-t1'"))[0].s, "400");
});

// ── Nadie puede usar una restauración para inventar autorizaciones ──
test("ni_un_superadministrador_con_la_restauracion_abierta_puede_inventar_que_otro_autorizo", async () => {
  await como(db, "luis", "select abrir_restauracion('intento de inventar')");
  const inventado = { validacion: "autorizado", dice: null, por: CUENTAS.migue, rol: "superadmin", cuando: "2026-11-10 10:00:00+00", recibido: "2026-11-10 10:00:00+00", firma: "a".repeat(64) };
  await como(db, "luis", SUBE, ["r-inventado", "pago_personal", D(PAGO, { _selloOriginal: inventado })]);
  const f = await fila("r-inventado");
  assert.equal(f.validado_por, CUENTAS.luis, "queda a nombre de quien lo subió, hoy"); assert.equal(f.restaurado, null);
  assert.notEqual(f.recibido.toISOString(), new Date("2026-11-10 10:00:00+00").toISOString(), "y tampoco se le pudo poner una fecha vieja");
});

test("el_sello_verdadero_de_un_pago_no_sirve_para_otro_pago_ni_para_el_mismo_con_otro_importe", async () => {
  const bueno = await sello("r-pago");
  // el mismo sello pegado a otro evento
  await como(db, "luis", SUBE, ["r-otro", "pago_personal", D(PAGO, { _selloOriginal: bueno })]);
  assert.equal((await fila("r-otro")).validado_por, CUENTAS.luis); assert.equal((await fila("r-otro")).restaurado, null);
  // el mismo evento, perdido, restaurado con el importe cambiado
  await pierde("r-pago");
  await como(db, "luis", SUBE, ["r-pago", "pago_personal", D({ ...PAGO, monto: 50000 }, { _selloOriginal: bueno })]);
  const f = await fila("r-pago");
  assert.equal(f.validado_por, CUENTAS.luis, "con otro importe ya no es el pago que se autorizó: lo firma quien lo sube"); assert.equal(f.restaurado, null);
  // y tal como era, sí
  await pierde("r-pago");
  await como(db, "luis", SUBE, ["r-pago", "pago_personal", D(PAGO, { _selloOriginal: bueno })]);
  const g = await fila("r-pago");
  assert.equal(g.validado_por, CUENTAS.migue); assert.equal(g.restaurado_por, CUENTAS.luis); assert.equal(g.sello_firma, bueno.firma);
});

test("cancelar_un_pago_no_rompe_su_firma_y_se_puede_restaurar_ya_cancelado", async () => {
  await como(db, "migue", SUBE, ["r-cancelable", "pago_personal", D(PAGO)]);
  const cancelado = D(PAGO, { cancelado: { motivo: "se pagó dos veces", por: { id: "x", nombre: "x" }, cuando: "2026-11-20T10:00:00.000Z" } });
  const r = await como(db, "migue", "update eventos set estado = 'cancelado', datos = $1::jsonb where id = 'r-cancelable'", [cancelado]); assert.ok(r.ok, r.error);
  const s = await sello("r-cancelable"); await pierde("r-cancelable");
  const rr = await como(db, "luis", "insert into eventos (id, tipo, fecha, estado, datos) values ('r-cancelable', 'pago_personal', '2026-11-19', 'cancelado', $1::jsonb) on conflict (id) do nothing", [D(PAGO, { cancelado: { motivo: "se pagó dos veces", por: { id: "x", nombre: "x" }, cuando: "2026-11-20T10:00:00.000Z" }, _selloOriginal: s })]); assert.ok(rr.ok, rr.error);
  const f = await fila("r-cancelable");
  assert.equal(f.estado, "cancelado"); assert.equal(f.validado_por, CUENTAS.migue); assert.equal(f.restaurado_por, CUENTAS.luis);
  assert.equal(f.datos.cancelado.motivo, "se pagó dos veces");
});

test("restaurando_no_se_puede_revivir_un_pago_cancelado_ni_cancelar_uno_vigente_con_un_motivo_inventado", async () => {
  // revivir: el pago cancelado de arriba, perdido, se intenta restaurar como si siguiera vigente
  const s = await sello("r-cancelable"); await pierde("r-cancelable");
  await como(db, "luis", SUBE, ["r-cancelable", "pago_personal", D(PAGO, { _selloOriginal: s })]);
  const f = await fila("r-cancelable");
  assert.equal(f.validado_por, CUENTAS.luis, "no es el pago que autorizó Migue: es uno nuevo, a nombre de quien lo sube y con fecha de hoy"); assert.equal(f.restaurado, null);
  // cancelar con motivo inventado: un pago vigente, perdido, se intenta restaurar ya cancelado
  await como(db, "migue", SUBE, ["r-vivo", "pago_personal", D(PAGO)]);
  const v = await sello("r-vivo"); await pierde("r-vivo");
  const r = await como(db, "luis", "insert into eventos (id, tipo, fecha, estado, datos) values ('r-vivo', 'pago_personal', '2026-11-19', 'cancelado', $1::jsonb) on conflict (id) do nothing", [D(PAGO, { cancelado: { motivo: "inventado", por: { id: "x", nombre: "x" }, cuando: "2026-11-21T10:00:00.000Z" }, _selloOriginal: v })]);
  assert.equal(r.ok, false, "la base no lo deja entrar"); assert.equal(await fila("r-vivo"), undefined);
});

test("la_llave_con_que_firma_la_base_no_la_puede_leer_ninguna_cuenta_ni_llamar_a_la_firma", async () => {
  for (const q of ["luis", "encargado", null]) {
    const r = await como(db, q, "select llave from sellos_llave"); assert.ok(!r.ok || r.filas.length === 0, "la llave no se ve");
    const f = await como(db, q, "select firma_de_sello('x', 'pago_personal', 'vigente', '{}'::jsonb, 'autorizado', null, null, 'superadmin', now(), now())"); assert.equal(f.ok, false, "y la firma no se puede pedir");
  }
  // Tampoco con la llave de servicio (la que usan las funciones del servidor y el respaldo de archivos).
  await db.exec("reset role"); await db.exec("set role service_role");
  await assert.rejects(db.query("select llave from sellos_llave"), /permission denied/);
  await db.exec("reset role");
});
