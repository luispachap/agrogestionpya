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

test("los_archivos_de_una_conversacion_solo_los_ve_baja_o_sube_quien_participa_en_ella", async () => {
  const sube = (quien, name) => como(db, quien, "insert into storage.objects (bucket_id, name, metadata) values ('comprobantes', $1, '{\"size\": 1000}'::jsonb)", [name]);
  const ve = async (quien) => ((await como(db, quien, "select name from storage.objects order by name")).filas || []).map(f => f.name);
  assert.ok((await sube("encargado", "c/conv-d/aaa.jpg")).ok); assert.ok((await sube("agronomo", "c/conv-d/bbb.pdf")).ok);
  assert.ok((await sube("encargado", "ticket-de-siempre.jpg")).ok);
  assert.equal((await sube("finanzas", "c/conv-d/colado.jpg")).ok, false, "quien no participa no sube a esa carpeta");
  assert.equal((await sube("luis", "c/conv-d/colado2.jpg")).ok, false, "tampoco el superadministrador");
  assert.equal((await sube("encargado", "c/no-existe/x.jpg")).ok, false);
  assert.deepEqual(await ve("agronomo"), ["c/conv-d/aaa.jpg", "c/conv-d/bbb.pdf", "ticket-de-siempre.jpg"]);
  assert.deepEqual(await ve("finanzas"), ["ticket-de-siempre.jpg"], "ni los ve en la lista ni los puede bajar");
  assert.deepEqual(await ve("luis"), ["ticket-de-siempre.jpg"]);
  assert.deepEqual(await ve("intruso"), []); assert.deepEqual(await ve(null), []);
  // Con una consulta excepcional vigente se ven (sólo lectura); al vencer, ya no.
  await db.query("insert into consultas_de_conversacion (usuario, conversacion, motivo, hasta) values ($1, 'conv-d', 'revisión de prueba', now() + interval '1 hour')", [CUENTAS.finanzas]);
  assert.ok((await ve("finanzas")).includes("c/conv-d/aaa.jpg")); assert.equal((await sube("finanzas", "c/conv-d/colado3.jpg")).ok, false);
  await db.query("update consultas_de_conversacion set hasta = now() - interval '1 minute' where usuario = $1", [CUENTAS.finanzas]);
  assert.deepEqual(await ve("finanzas"), ["ticket-de-siempre.jpg"]);
});

test("la_conversacion_con_el_asistente_es_de_una_sola_cuenta_no_admite_mas_gente_ni_se_abre_por_consulta", async () => {
  // El agrónomo abre la suya; en el evento alguien "coló" al encargado y a todo el puesto de finanzas: no cuenta.
  assert.ok((await como(db, "agronomo", ...ev("conv-a", "conversacion", { clase: "asistente", nombre: "AgroGestión", miembros: [{ tipo: "persona", id: CUENTAS.agronomo }, { tipo: "persona", id: CUENTAS.encargado }, { tipo: "rol", rol: "finanzas" }] }))).ok);
  assert.ok((await como(db, "agronomo", ...msj("m-asistente", "conv-a"))).ok);
  assert.deepEqual((await db.query("select miembro, rol from conversacion_miembros where conversacion = 'conv-a'")).rows, [{ miembro: CUENTAS.agronomo, rol: null }], "su único participante es quien la abrió");
  assert.ok((await lee("agronomo")).includes("m-asistente"));
  for (const quien of ["encargado", "finanzas", "luis", "dueno"]) assert.ok(!(await lee(quien)).includes("m-asistente"), `${quien} no la lee`);
  assert.equal((await como(db, "encargado", ...msj("m-colado", "conv-a"))).ok, false, "nadie más escribe en ella");
  // Ni su dueño le agrega gente.
  await como(db, "agronomo", ...ev("conv-a-cambio", "conversacion_cambio", { conversacion: "conv-a", agregar: [{ tipo: "persona", id: CUENTAS.encargado }] }));
  assert.equal((await db.query("select count(*)::int n from conversacion_miembros where conversacion = 'conv-a'")).rows[0].n, 1);
  // Ni con el permiso de supervisión otorgado se abre por consulta.
  // Ni con el permiso de supervisión otorgado (dirección lo tiene desde la prueba de arriba) se abre por consulta.
  const r = await como(db, "dueno", "select consultar_conversacion('conv-a', 'Revisar una queja sobre una compra') h");
  assert.equal(r.ok, false); assert.match(JSON.stringify(r), /privada/);
  assert.ok(!(await lee("dueno")).includes("m-asistente"));
  // Y la consulta de una conversación entre personas sigue funcionando igual.
  assert.equal((await como(db, "dueno", "select consultar_conversacion('conv-g', 'Revisar una queja sobre una compra') h")).ok, true);
});
