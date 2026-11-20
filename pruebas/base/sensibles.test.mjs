// Lo sensible lo autoriza la base: se ataca directo, sin pasar por la app.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { armarBase, como, verdad, CUENTAS } from "./base.mjs";

let db;
// Así queda un evento en la columna `datos`: todo lo que no es columna, con el contenido propio adentro de `datos`.
const D = (datos = {}, mas = {}) => JSON.stringify({ cuando: "2026-11-19T12:00:00.000Z", quien: { id: "u-falso", nombre: "Dice que es Luis", rol: "admin" }, datos, _espacio: "prueba", ...mas });
const mete = (quien, id, tipo, datos = {}, extra = "") => como(db, quien, `insert into eventos (id, tipo, fecha, estado, datos${extra ? ", validacion, validado_rol" : ""}) values ($1, $2, '2026-11-19', 'vigente', $3::jsonb${extra})`, [id, tipo, D(datos)]);
const fila = async (id) => (await verdad(db, "select * from eventos where id = $1", [id]))[0];
const PAGO = { a: { tipo: "trabajador", id: "t1", nombre: "Ana" }, desde: "2026-11-16", hasta: "2026-11-22", monto: 500, medio: "efectivo" };
const CANCELA = (datos) => D(datos, { cancelado: { motivo: "porque sí", por: { id: "x", nombre: "x" }, cuando: "2026-11-19T13:00:00.000Z" } });
before(async () => {
  db = await armarBase();
  const esp = (await verdad(db, "select espacio from operacion"))[0]?.espacio;
  if (esp && esp !== "prueba") throw new Error("la base de pruebas trae otro espacio: " + esp);
  if (!esp) await verdad(db, "select sellar_espacio('prueba')");
});

test("un_pago_que_sube_un_encargado_queda_guardado_pero_rechazado_aunque_diga_que_es_administrador", async () => {
  const r = await mete("encargado", "s-pago-enc", "pago_personal", PAGO);
  assert.ok(r.ok, "no truena: la cola del teléfono no se atora — " + r.error);
  const f = await fila("s-pago-enc");
  assert.equal(f.validacion, "rechazado"); assert.equal(f.validacion_dice, "sin_permiso");
  assert.equal(f.validado_por, CUENTAS.encargado, "quién lo subió lo dice la sesión, no el evento");
  assert.equal(f.validado_rol, "encargado"); assert.equal(f.datos.quien.rol, "admin", "lo que el evento dice de sí mismo no cuenta");
});

test("ni_escribiendo_el_sello_a_mano_se_autoriza_solo", async () => {
  const r = await mete("encargado", "s-sello", "cierre_semana", { desde: "2026-11-16", hasta: "2026-11-22" }, ", 'autorizado', 'superadmin'");
  assert.ok(r.ok, r.error);
  const f = await fila("s-sello");
  assert.equal(f.validacion, "rechazado"); assert.equal(f.validado_rol, "encargado");
  await como(db, "encargado", "update eventos set validacion = 'autorizado', validado_rol = 'superadmin', validado_por = $1 where id = 's-sello'", [CUENTAS.luis]);
  const g = await fila("s-sello");
  assert.equal(g.validacion, "rechazado", "tampoco después, con un update"); assert.equal(g.validado_por, CUENTAS.encargado);
});

test("todos_los_tipos_sensibles_se_rechazan_sin_permiso_y_se_autorizan_al_superadministrador", async () => {
  const tipos = (await verdad(db, "select tipo from operaciones_sensibles order by tipo")).map(x => x.tipo);
  assert.equal(tipos.length, 23);
  for (const t of tipos) {
    const datos = { ...PAGO };
    assert.ok((await mete("encargado", `s-no-${t}`, t, datos)).ok); assert.equal((await fila(`s-no-${t}`)).validacion, "rechazado", t);
    assert.ok((await mete("agronomo", `s-ag-${t}`, t, datos)).ok); assert.equal((await fila(`s-ag-${t}`)).validacion, "rechazado", t);
    assert.ok((await mete("luis", `s-si-${t}`, t, datos)).ok); assert.equal((await fila(`s-si-${t}`)).validacion, "autorizado", t);
  }
  assert.equal((await mete("finanzas", "s-fin", "pago_personal", PAGO)).ok, false, "finanzas ni siquiera puede crear eventos");
  assert.equal((await mete("intruso", "s-intruso", "pago_personal", PAGO)).ok, false);
  assert.equal((await mete(null, "s-anon", "pago_personal", PAGO)).ok, false);
});

test("lo_que_no_es_sensible_sigue_igual_y_no_lleva_sello", async () => {
  assert.ok((await mete("encargado", "s-marca", "marca", { trabajadorId: "t1", sentido: "entrada" })).ok);
  const f = await fila("s-marca");
  assert.equal(f.validacion, null); assert.equal(f.validado_por, null);
});

test("el_permiso_se_da_por_cuenta_y_por_operacion_y_solo_lo_da_un_superadministrador", async () => {
  assert.equal((await como(db, "encargado", "select otorgar_permiso($1, 'cerrar_semana')", [CUENTAS.encargado])).ok, false, "nadie se lo da solo");
  assert.equal((await como(db, "finanzas", "select otorgar_permiso($1, 'cerrar_semana')", [CUENTAS.encargado])).ok, false);
  assert.equal((await como(db, "encargado", "insert into permisos_operacion (usuario, operacion, otorgado_por) values ($1, 'cerrar_semana', $1)", [CUENTAS.encargado])).ok, false, "ni escribiendo directo en la tabla");
  assert.equal((await como(db, "luis", "select otorgar_permiso($1, 'operacion_inventada')", [CUENTAS.encargado])).ok, false);
  assert.equal((await como(db, "luis", "select otorgar_permiso($1, 'cerrar_semana')", [CUENTAS.intruso])).ok, false, "a una cuenta sin perfil no");
  const ok = await como(db, "luis", "select otorgar_permiso($1, 'cerrar_semana')", [CUENTAS.encargado]);
  assert.ok(ok.ok, ok.error);
  assert.ok((await como(db, "luis", "select otorgar_permiso($1, 'cerrar_semana')", [CUENTAS.encargado])).ok, "darlo dos veces no lo duplica");
  assert.equal((await verdad(db, "select count(*)::int n from permisos_operacion where usuario = $1 and revocado is null", [CUENTAS.encargado]))[0].n, 1);
  // Con ESE permiso cierra la semana… y nada más.
  await mete("encargado", "s-cierre-ok", "cierre_semana", { desde: "2026-11-16", hasta: "2026-11-22" });
  await mete("encargado", "s-pago-aun-no", "pago_personal", PAGO);
  await mete("encargado", "s-det-aun-no", "prestacion_determinada", { personaId: "t1", monto: 5000 });
  assert.equal((await fila("s-cierre-ok")).validacion, "autorizado");
  assert.equal((await fila("s-pago-aun-no")).validacion, "rechazado", "poder cerrar la semana no es poder pagar");
  assert.equal((await fila("s-det-aun-no")).validacion, "rechazado");
  const mis = (await como(db, "encargado", "select mis_permisos() p")).filas[0].p;
  assert.deepEqual(mis, { rol: "encargado", operaciones: ["cerrar_semana"] });
  assert.equal((await como(db, "encargado", "select * from permisos_operacion")).filas.length, 1, "cada quien ve sólo los suyos");
  assert.equal((await como(db, "agronomo", "select * from permisos_operacion")).filas.length, 0);
});

test("quitar_el_permiso_deja_historial_y_lo_siguiente_que_suba_ya_no_se_autoriza", async () => {
  assert.equal((await como(db, "encargado", "select revocar_permiso($1, 'cerrar_semana')", [CUENTAS.encargado])).ok, false);
  assert.ok((await como(db, "migue", "select revocar_permiso($1, 'cerrar_semana')", [CUENTAS.encargado])).ok);
  const h = await verdad(db, "select otorgado_por, revocado, revocado_por from permisos_operacion where usuario = $1", [CUENTAS.encargado]);
  assert.equal(h.length, 1); assert.ok(h[0].revocado); assert.equal(h[0].otorgado_por, CUENTAS.luis); assert.equal(h[0].revocado_por, CUENTAS.migue);
  // Lo que capturó sin señal con el permiso y sube ya sin él: se valida al llegar, no al capturar.
  await mete("encargado", "s-cierre-tarde", "cierre_semana", { desde: "2026-11-09", hasta: "2026-11-15" });
  assert.equal((await fila("s-cierre-tarde")).validacion, "rechazado");
  assert.equal((await fila("s-cierre-ok")).validacion, "autorizado", "lo que ya se había autorizado no cambia");
});

test("un_pago_sin_importe_valido_no_se_autoriza_ni_al_superadministrador", async () => {
  for (const [id, monto] of [["s-m0", 0], ["s-mneg", -500], ["s-mtxt", "mucho"], ["s-mnada", undefined]]) {
    await mete("luis", id, "pago_personal", { ...PAGO, monto });
    const f = await fila(id); assert.equal(f.validacion, "rechazado", String(monto)); assert.equal(f.validacion_dice, "importe");
  }
  await mete("luis", "s-abono-0", "abono_prestamo", { prestamoId: "p1", monto: 0 });
  assert.equal((await fila("s-abono-0")).validacion, "rechazado");
});

test("sin_permiso_no_se_cancela_un_pago_ni_un_cierre_y_queda_anotado_el_intento", async () => {
  await mete("luis", "s-pago-luis", "pago_personal", PAGO);
  const r = await como(db, "encargado", "update eventos set estado = 'cancelado', datos = $1::jsonb where id = 's-pago-luis'", [CANCELA(PAGO)]);
  assert.ok(r.ok, "no truena — " + r.error);
  let f = await fila("s-pago-luis");
  assert.equal(f.estado, "vigente", "el pago sigue contando"); assert.equal(f.datos.cancelado, undefined); assert.ok(f.cambio_rechazado, "y queda anotado que alguien lo intentó");
  // Así sube la app (insert … on conflict do update): tampoco.
  await como(db, "encargado", `insert into eventos (id, tipo, fecha, estado, datos) values ('s-pago-luis', 'pago_personal', '2026-11-19', 'cancelado', $1::jsonb)
    on conflict (id) do update set estado = excluded.estado, datos = excluded.datos`, [CANCELA(PAGO)]);
  assert.equal((await fila("s-pago-luis")).estado, "vigente");
  // Quien sí tiene el permiso lo cancela, con su motivo.
  const ok = await como(db, "migue", "update eventos set estado = 'cancelado', datos = $1::jsonb where id = 's-pago-luis'", [CANCELA(PAGO)]);
  assert.ok(ok.ok, ok.error);
  f = await fila("s-pago-luis");
  assert.equal(f.estado, "cancelado"); assert.equal(f.validacion, "autorizado", "el sello de cuando nació no se mueve");
});

test("una_marca_la_sigue_cancelando_el_encargado_como_siempre", async () => {
  const r = await como(db, "encargado", "update eventos set estado = 'cancelado', datos = $1::jsonb where id = 's-marca'", [CANCELA({ trabajadorId: "t1", sentido: "entrada" })]);
  assert.ok(r.ok, r.error); assert.equal((await fila("s-marca")).estado, "cancelado");
});

test("no_se_convierte_una_marca_en_un_pago_cambiandole_el_tipo", async () => {
  await mete("encargado", "s-disfraz", "marca", PAGO);
  const r = await como(db, "encargado", "update eventos set tipo = 'pago_personal' where id = 's-disfraz'");
  assert.equal(r.ok, false); assert.equal((await fila("s-disfraz")).tipo, "marca");
});

test("la_lista_de_tipos_sensibles_no_la_cambia_nadie_desde_la_app", async () => {
  for (const q of ["encargado", "luis"]) {
    assert.equal((await como(db, q, "delete from operaciones_sensibles where tipo = 'pago_personal'")).afectadas, 0, q);
    assert.equal((await como(db, q, "insert into operaciones_sensibles values ('marca', 'cerrar_semana')")).ok, false, q);
  }
  assert.equal((await como(db, null, "select * from operaciones_sensibles")).filas.length, 0, "sin sesión no se lee");
  assert.equal((await como(db, null, "select puede_operar('autorizar_pagos') p")).ok, false);
});

test("un_encargado_solicita_un_prestamo_pero_no_lo_autoriza_ni_registra_la_entrega_ni_escribe_en_la_tabla_vieja", async () => {
  assert.ok((await mete("encargado", "s-sol", "prestamo_solicitud", { trabajadorId: "t1", monto: 1000, motivo: "medicinas" })).ok);
  assert.equal((await fila("s-sol")).validacion, null, "solicitar no es sensible: no es deuda");
  await mete("encargado", "s-aut-enc", "prestamo_autorizacion", { solicitudId: "s-sol", monto: 1000 });
  await mete("encargado", "s-ent-enc", "prestamo_entrega", { solicitudId: "s-sol", monto: 1000 });
  assert.equal((await fila("s-aut-enc")).validacion, "rechazado"); assert.equal((await fila("s-ent-enc")).validacion, "rechazado");
  await mete("luis", "s-aut", "prestamo_autorizacion", { solicitudId: "s-sol", monto: 1000 });
  await mete("luis", "s-ent-0", "prestamo_entrega", { solicitudId: "s-sol", monto: 0 });
  assert.equal((await fila("s-aut")).validacion, "autorizado"); assert.equal((await fila("s-ent-0")).validacion_dice, "importe");
  // El permiso de autorizar préstamos no es el de entregar dinero.
  assert.ok((await como(db, "luis", "select otorgar_permiso($1, 'autorizar_prestamos')", [CUENTAS.agronomo])).ok);
  await mete("agronomo", "s-aut-ag", "prestamo_autorizacion", { solicitudId: "s-sol", monto: 500 });
  await mete("agronomo", "s-ent-ag", "prestamo_entrega", { solicitudId: "s-sol", monto: 500 });
  assert.equal((await fila("s-aut-ag")).validacion, "autorizado"); assert.equal((await fila("s-ent-ag")).validacion, "rechazado", "autorizar no es poder entregar");
  for (const q of ["encargado", "finanzas"]) {
    const r = await como(db, q, "insert into prestamos (id, datos) values ($1, $2::jsonb)", [`pr-${q}`, JSON.stringify({ monto: 99999, _espacio: "prueba" })]);
    assert.equal(r.ok, false, `${q} ya no escribe préstamos directo en la tabla`);
  }
});

test("dar_de_baja_y_pagar_un_finiquito_piden_cada_uno_su_permiso", async () => {
  await mete("encargado", "s-baja-enc", "baja_personal", { personaId: "t1", total: 5000 });
  await mete("luis", "s-baja", "baja_personal", { personaId: "t1", total: 5000 });
  await mete("encargado", "s-pbaja-enc", "pago_baja", { bajaId: "s-baja", monto: 5000 });
  await mete("luis", "s-pbaja", "pago_baja", { bajaId: "s-baja", monto: 5000 });
  assert.deepEqual([(await fila("s-baja-enc")).validacion, (await fila("s-baja")).validacion, (await fila("s-pbaja-enc")).validacion, (await fila("s-pbaja")).validacion], ["rechazado", "autorizado", "rechazado", "autorizado"]);
});

test("el_catalogo_de_salarios_minimos_no_lo_cambia_un_encargado_ni_escribiendo_directo", async () => {
  await mete("encargado", "s-sm-enc", "salario_minimo", { desde: "2027-01-01", general: 1, frontera: 2, fuente: "inventada" });
  await mete("luis", "s-sm-luis", "salario_minimo", { desde: "2027-01-01", general: 350, frontera: 470, fuente: "Resolución de prueba, DOF" });
  const r = await verdad(db, "select id, validacion, validacion_dice from eventos where id in ('s-sm-enc', 's-sm-luis') order by id");
  assert.deepEqual(r.map(x => [x.id, x.validacion, x.validacion_dice]), [["s-sm-enc", "rechazado", "sin_permiso"], ["s-sm-luis", "autorizado", null]]);
});

test("un_encargado_no_otorga_ni_paga_bonos_y_un_bono_de_cero_no_pasa", async () => {
  await mete("encargado", "s-bono-enc", "bono_personal", { monto: 500, personaId: "t1" });
  await mete("encargado", "s-pbono-enc", "pago_bono", { monto: 500, bonoId: "s-bono-enc" });
  await mete("luis", "s-bono-luis", "bono_personal", { monto: 500, personaId: "t1" });
  await mete("luis", "s-bono-cero", "bono_personal", { monto: 0, personaId: "t1" });
  const r = await verdad(db, "select id, validacion, validacion_dice from eventos where id like 's-bono-%' or id like 's-pbono-%' order by id");
  assert.deepEqual(r.map(x => [x.id, x.validacion, x.validacion_dice]), [["s-bono-cero", "rechazado", "importe"], ["s-bono-enc", "rechazado", "sin_permiso"], ["s-bono-luis", "autorizado", null], ["s-pbono-enc", "rechazado", "sin_permiso"]]);
});
