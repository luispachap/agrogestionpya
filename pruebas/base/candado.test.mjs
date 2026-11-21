// El candado por conversación, atacando la base directo: participar es lo único que abre una conversación.
// Base aislada, cuentas de mentira. Luis y Migue son superadministradores aquí, como en la real.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { armarBase, como, verdad, CUENTAS } from "./base.mjs";

let db;
const ev = (id, tipo, datos) => [`insert into eventos (id, tipo, fecha, estado, datos) values ($1, $2, '2026-11-21', 'vigente', $3::jsonb)`, [id, tipo, JSON.stringify({ cuando: "2026-11-21T15:00:00.000Z", quien: { id: "x" }, datos })]];
const msj = (id, conversacion, extra = {}) => [`insert into chat (id, datos) values ($1, $2::jsonb)`, [id, JSON.stringify({ texto: `mensaje ${id}`, ...(conversacion ? { conversacion } : {}), ...extra })]];
const lee = async (quien) => ((await como(db, quien, "select id from chat order by id")).filas || []).map(f => f.id);
before(async () => {
  db = await armarBase();
  // Una directa entre el encargado y el agrónomo, y un grupo del encargado con todo el puesto de finanzas.
  assert.ok((await como(db, "encargado", ...ev("conv-d", "conversacion", { clase: "directa", miembros: [{ tipo: "persona", id: CUENTAS.encargado }, { tipo: "persona", id: CUENTAS.agronomo }] }))).ok);
  assert.ok((await como(db, "encargado", ...ev("conv-g", "conversacion", { clase: "grupo", nombre: "Compras", miembros: [{ tipo: "persona", id: CUENTAS.encargado }, { tipo: "rol", rol: "finanzas" }] }))).ok);
  assert.ok((await como(db, "encargado", ...msj("m-general", null))).ok);
  assert.ok((await como(db, "encargado", ...msj("m-directa", "conv-d"))).ok);
  assert.ok((await como(db, "agronomo", ...msj("m-directa-2", "conv-d", { esEvidencia: true }))).ok);
  assert.ok((await como(db, "encargado", ...msj("m-grupo", "conv-g", { esEvidencia: true, sensible: true }))).ok);
});

test("una_conversacion_solo_la_leen_sus_participantes_ni_el_superadministrador_la_lee_por_serlo", async () => {
  assert.deepEqual(await lee("encargado"), ["m-directa", "m-directa-2", "m-general", "m-grupo"]);
  assert.deepEqual(await lee("agronomo"), ["m-directa", "m-directa-2", "m-general"]);
  assert.deepEqual(await lee("finanzas"), ["m-general", "m-grupo"], "entra al grupo por su puesto");
  assert.deepEqual(await lee("luis"), ["m-general"], "ser superadministrador no abre conversaciones ajenas");
  assert.deepEqual(await lee("dueno"), ["m-general"]);
  assert.deepEqual(await lee("intruso"), []); assert.deepEqual(await lee(null), []);
});

test("quien_no_participa_no_escribe_ni_cambia_mensajes_de_esa_conversacion", async () => {
  assert.equal((await como(db, "finanzas", ...msj("m-colado", "conv-d"))).ok, false);
  assert.equal((await como(db, "luis", ...msj("m-colado-2", "conv-d"))).ok, false);
  await como(db, "luis", "update chat set datos = datos || '{\"texto\":\"cambiado\"}'::jsonb where id = 'm-directa'");
  await como(db, "finanzas", "update chat set datos = datos || '{\"conversacion\":\"conv-g\"}'::jsonb where id = 'm-directa'");
  assert.deepEqual((await verdad(db, "select datos->>'texto' t, datos->>'conversacion' c from chat where id = 'm-directa'"))[0], { t: "mensaje m-directa", c: "conv-d" });
  assert.ok((await como(db, "agronomo", "update chat set datos = datos || '{\"visto\":true}'::jsonb where id = 'm-directa'")).afectadas === 1, "un participante sí");
});

test("nadie_se_mete_solo_a_una_conversacion_ni_escribe_la_lista_de_participantes", async () => {
  await como(db, "luis", ...ev("cambio-1", "conversacion_cambio", { conversacion: "conv-d", agregar: [{ tipo: "persona", id: CUENTAS.luis }] }));
  await como(db, "luis", ...ev("conv-d", "conversacion", { clase: "directa", miembros: [{ tipo: "persona", id: CUENTAS.luis }] }));
  assert.equal((await como(db, "luis", "insert into conversacion_miembros (conversacion, miembro) values ('conv-d', $1)", [CUENTAS.luis])).ok, false);
  assert.deepEqual(await lee("luis"), ["m-general"]);
  // Un participante sí puede agregar a alguien al grupo.
  assert.ok((await como(db, "encargado", ...ev("cambio-2", "conversacion_cambio", { conversacion: "conv-g", agregar: [{ tipo: "persona", id: CUENTAS.agronomo }] }))).ok);
  assert.ok((await lee("agronomo")).includes("m-grupo"));
});

test("la_consulta_excepcional_pide_permiso_otorgado_y_motivo_dura_un_dia_y_queda_en_la_bitacora", async () => {
  const pedir = (quien, motivo = "Revisar una queja sobre una compra") => como(db, quien, "select consultar_conversacion('conv-d', $1) h", [motivo]);
  assert.equal((await pedir("luis")).ok, false, "ni el superadministrador, si no lo tiene otorgado");
  assert.ok((await como(db, "luis", "select otorgar_permiso($1, 'supervisar_conversaciones')", [CUENTAS.dueno])).ok);
  assert.equal((await pedir("dueno", "ver")).ok, false, "sin motivo de verdad no hay consulta");
  assert.ok((await pedir("dueno")).ok);
  assert.deepEqual(await lee("dueno"), ["m-directa", "m-directa-2", "m-general"], "sólo ESA conversación");
  assert.equal((await como(db, "dueno", ...msj("m-dueno", "conv-d"))).ok, false, "la consulta es de sólo lectura");
  const rastro = await verdad(db, "select accion, registroid, quien, datos->>'motivo' motivo from auditoria where accion = 'consulto_conversacion'");
  assert.deepEqual(rastro, [{ accion: "consulto_conversacion", registroid: "conv-d", quien: "Prueba dueno", motivo: "Revisar una queja sobre una compra" }]);
  assert.equal(((await como(db, "encargado", "select motivo from consultas_de_conversacion")).filas || []).length, 1, "los demás pueden ver quién consultó y por qué");
  await db.query("update consultas_de_conversacion set hasta = now() - interval '1 minute' where conversacion = 'conv-d'");
  assert.deepEqual(await lee("dueno"), ["m-general"], "al vencer se cierra sola");
  assert.equal((await como(db, "dueno", "update consultas_de_conversacion set hasta = now() + interval '9 days' where conversacion = 'conv-d'")).afectadas, 0, "nadie se la alarga");
});

test("la_evidencia_se_ve_con_su_permiso_solo_lo_marcado_y_lo_de_dinero_pide_ademas_leer_gastos", async () => {
  const ver = async (quien, ids) => { const r = await como(db, quien, "select id from ver_evidencia($1::text[], 'revisión del cierre')", [ids]); return r.ok ? r.filas.map(f => f.id).sort() : "negado"; };
  assert.equal(await ver("luis", ["m-directa-2"]), "negado", "tampoco por ser superadministrador");
  assert.ok((await como(db, "luis", "select otorgar_permiso($1, 'ver_evidencia')", [CUENTAS.agronomo])).ok);
  assert.ok((await como(db, "luis", "select otorgar_permiso($1, 'ver_evidencia')", [CUENTAS.finanzas])).ok);
  assert.deepEqual(await ver("finanzas", ["m-directa", "m-directa-2"]), ["m-directa-2"], "sólo el mensaje que es evidencia; el resto de la plática no");
  const puedeGastos = (await como(db, "agronomo", "select puede('egresos', 'leer') p")).filas[0].p;
  // Para probar lo sensible con alguien que NO participa en el grupo: se saca al agrónomo.
  await como(db, "encargado", ...ev("cambio-3", "conversacion_cambio", { conversacion: "conv-g", quitar: [{ tipo: "persona", id: CUENTAS.agronomo }] }));
  assert.deepEqual(await ver("agronomo", ["m-grupo"]), puedeGastos ? ["m-grupo"] : [], "la evidencia de dinero respeta el permiso de leer gastos");
  const rastro = await verdad(db, "select quien, datos->'mensajes' m from auditoria where accion = 'consulto_evidencia' order by actualizado");
  assert.deepEqual([rastro[0].quien, rastro[0].m], ["Prueba finanzas", ["m-directa-2"]], "cada consulta de evidencia deja rastro");
});

test("la_general_sigue_como_estaba_y_el_directorio_solo_da_nombre_y_puesto", async () => {
  assert.ok((await como(db, "agronomo", ...msj("m-general-2", null))).ok);
  const dir = (await como(db, "encargado", "select * from directorio_de_cuentas()")).filas;
  assert.deepEqual(Object.keys(dir[0]).sort(), ["id", "nombre", "rol"]); assert.ok(dir.some(d => d.rol === "admin") && !dir.some(d => d.rol === "superadmin"));
  assert.equal(((await como(db, "intruso", "select * from directorio_de_cuentas()")).filas || []).length, 0);
});
