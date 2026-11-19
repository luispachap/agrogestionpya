// Dar de alta cuentas sin consola: invitaciones y código de arranque.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { armarBase, como, verdad, CUENTAS } from "./base.mjs";

let db;
const CODIGO = "codigo-de-prueba-largo-123";
const huella = (c) => createHash("sha256").update(c).digest("hex");
const nueva = async (alias, correo, { confirmado = true, nombre = null } = {}) => {
  const id = `00000000-0000-0000-0000-0000000001${String(Object.keys(CUENTAS).length).padStart(2, "0")}`;
  CUENTAS[alias] = id;
  await verdad(db, "insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, $2, $3, $4)",
    [id, correo, confirmado ? new Date().toISOString() : null, nombre ? JSON.stringify({ nombre }) : null]);
  return id;
};
before(async () => {
  db = await armarBase();
  await db.exec("alter table perfiles disable trigger perfiles_ultimo_superadmin; delete from perfiles; alter table perfiles enable trigger perfiles_ultimo_superadmin;");   // como recién montada: sin nadie
  await verdad(db, "select preparar_arranque($1, 2, 7)", [huella(CODIGO)]);
});
const rolDe = async (alias) => (await verdad(db, "select rol from perfiles where id = $1", [CUENTAS[alias]]))[0]?.rol ?? null;

test("sin_invitacion_y_sin_codigo_una_cuenta_nueva_no_obtiene_nada", async () => {
  await nueva("curioso", "curioso@prueba.invalid");
  const r = await como(db, "curioso", "select reclamar_acceso()");
  assert.equal(r.ok, false); assert.match(r.error, /no está invitada/);
  assert.equal((await como(db, "curioso", "select reclamar_acceso('adivinando')")).ok, false);
  assert.equal(await rolDe("curioso"), null);
  assert.equal((await verdad(db, "select arranque_usos u from operacion"))[0].u, 2, "un código equivocado no gasta usos");
});

test("el_codigo_de_arranque_no_sirve_con_un_correo_sin_confirmar", async () => {
  await nueva("sinconfirmar", "alguien@prueba.invalid", { confirmado: false });
  const r = await como(db, "sinconfirmar", "select reclamar_acceso($1)", [CODIGO]);
  assert.equal(r.ok, false); assert.match(r.error, /confirmar tu correo/);
});

test("el_codigo_de_arranque_nombra_a_los_dos_primeros_superadministradores_y_se_acaba", async () => {
  await nueva("primero", "uno@prueba.invalid", { nombre: "Persona Uno" });
  await nueva("segundo", "dos@prueba.invalid");
  await nueva("tercero", "tres@prueba.invalid");
  assert.equal((await como(db, "primero", "select reclamar_acceso($1) as r", [CODIGO])).filas[0].r, "superadmin");
  assert.equal((await como(db, "segundo", "select reclamar_acceso($1) as r", [" " + CODIGO + " "])).filas[0].r, "superadmin");
  const r = await como(db, "tercero", "select reclamar_acceso($1)", [CODIGO]);
  assert.equal(r.ok, false); assert.match(r.error, /ya se usó o caducó/);
  assert.equal(await rolDe("tercero"), null);
  assert.equal((await verdad(db, "select nombre from perfiles where id = $1", [CUENTAS.primero]))[0].nombre, "Persona Uno");
  // volver a llamarla no gasta nada ni cambia el rol
  assert.equal((await como(db, "primero", "select reclamar_acceso() as r")).filas[0].r, "superadmin");
});

test("un_codigo_caducado_no_sirve", async () => {
  const b = await armarBase(); await b.exec("alter table perfiles disable trigger perfiles_ultimo_superadmin; delete from perfiles; alter table perfiles enable trigger perfiles_ultimo_superadmin;");
  await verdad(b, "select preparar_arranque($1, 2, 7)", [huella(CODIGO)]);
  await verdad(b, "update operacion set arranque_vence = now() - interval '1 minute'");
  assert.equal((await como(b, "intruso", "select reclamar_acceso($1)", [CODIGO])).ok, false);
});

test("nadie_prepara_un_codigo_de_arranque_desde_un_telefono_ni_lee_su_huella_para_adivinarlo", async () => {
  for (const q of ["primero", "curioso"]) assert.equal((await como(db, q, "select preparar_arranque($1, 5, 30)", [huella("otro")])).ok, false, q);
  assert.equal((await como(db, "curioso", "select * from operacion")).filas.length, 0, "sin perfil no se lee");
});

test("un_superadministrador_invita_y_la_persona_recibe_justo_ese_rol", async () => {
  const inv = await como(db, "primero", "insert into invitaciones (correo, nombre, rol, invitado_por) values ('encargado.nuevo@prueba.invalid', 'ENCARGADO NUEVO', 'encargado', $1)", [CUENTAS.primero]);
  assert.equal(inv.ok, true, inv.error);
  await nueva("encnuevo", "Encargado.Nuevo@prueba.invalid");      // con otras mayúsculas: es el mismo correo
  assert.equal((await como(db, "encnuevo", "select reclamar_acceso() as r")).filas[0].r, "encargado");
  assert.equal((await verdad(db, "select nombre from perfiles where id = $1", [CUENTAS.encnuevo]))[0].nombre, "ENCARGADO NUEVO");
  // la invitación quedó usada: otra cuenta con ese correo ya no la puede reclamar
  const u = (await verdad(db, "select usada_por from invitaciones where correo = 'encargado.nuevo@prueba.invalid'"))[0];
  assert.equal(u.usada_por, CUENTAS.encnuevo);
  // y entra con sus permisos de encargado, no más
  assert.equal((await como(db, "encnuevo", "select * from ingresos")).ok, true);
  assert.equal((await como(db, "encnuevo", "select * from config_seguridad")).filas.length, 0);
});

test("solo_los_superadministradores_invitan_y_nadie_se_invita_a_si_mismo", async () => {
  assert.equal((await como(db, "encnuevo", "insert into invitaciones (correo, nombre, rol, invitado_por) values ('amigo@prueba.invalid', 'x', 'superadmin', $1)", [CUENTAS.encnuevo])).ok, false);
  assert.equal((await como(db, "curioso", "insert into invitaciones (correo, nombre, rol, invitado_por) values ('curioso@prueba.invalid', 'x', 'superadmin', $1)", [CUENTAS.curioso])).ok, false);
  assert.equal((await como(db, "encnuevo", "select * from invitaciones")).filas.length, 0);
  assert.equal(await rolDe("curioso"), null);
});

test("una_invitacion_cancelada_ya_no_sirve", async () => {
  await como(db, "segundo", "insert into invitaciones (correo, nombre, rol, invitado_por) values ('arrepentido@prueba.invalid', 'X', 'finanzas', $1)", [CUENTAS.segundo]);
  assert.equal((await como(db, "primero", "update invitaciones set cancelada = true where correo = 'arrepentido@prueba.invalid'")).afectadas, 1);
  await nueva("arrepentido", "arrepentido@prueba.invalid");
  assert.equal((await como(db, "arrepentido", "select reclamar_acceso()")).ok, false);
});
