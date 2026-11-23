import { test } from "node:test";
import assert from "node:assert/strict";
import { verificarPinDireccion, sesionRestaurable, planDeRecarga } from "./acceso.js";

const hash = async (p) => "h:" + p;

// ── C-1: PIN de fábrica ─────────────────────────────────────
test("C-1 · sin PIN propio configurado, NINGÚN PIN entra como dirección (antes: 1234 / 0000 / 4444)", async () => {
  for (const [rol, fabrica] of [["admin", "1234"], ["dueno", "0000"], ["finanzas", "4444"]]) {
    for (const cfg of [{}, null, undefined]) {
      const r = await verificarPinDireccion(cfg, rol, fabrica, hash);
      assert.equal(r.ok, false);
      assert.equal(r.motivo, "sin_configurar");
    }
  }
});
test("C-1 · con PIN propio, sólo entra ese", async () => {
  const cfg = { pin_admin: "h:7391" };
  assert.equal((await verificarPinDireccion(cfg, "admin", "7391", hash)).ok, true);
  assert.equal((await verificarPinDireccion(cfg, "admin", "1234", hash)).ok, false);
  assert.equal((await verificarPinDireccion(cfg, "finanzas", "7391", hash)).motivo, "sin_configurar");
});
test("C-1 · navegador sin modo seguro no entra, y un rol de campo no pasa por aquí", async () => {
  assert.equal((await verificarPinDireccion({ pin_admin: "x" }, "admin", "1", async () => null)).motivo, "sin_modo_seguro");
  assert.equal((await verificarPinDireccion({ pin_trabajador: "h:1" }, "trabajador", "1", hash)).ok, false);
});

// ── C-3: sesión falsificable ────────────────────────────────
const data = {
  trabajadores: [{ id: "t1", nombre: "Trabajador Uno", sueldo_dia: 300, categoria: "jornalero" }, { id: "t2", nombre: "Baja", activo: false }],
  encargados: [{ id: "e1", nombre: "Encargado Uno" }],
};
test("C-3 · escribir {role:'admin', cuenta:true} en el teléfono ya no da acceso", () => {
  for (const role of ["admin", "dueno", "finanzas"]) {
    assert.equal(sesionRestaurable({ role, id: role, nombre: "X", cuenta: true }, data), null);
  }
});
test("C-3 · un rol de campo inventado (id que no existe) no entra", () => {
  assert.equal(sesionRestaurable({ role: "encargado", id: "x", nombre: "Falso" }, data), null);
  assert.equal(sesionRestaurable({ role: "agronomo", id: "e1" }, data), null); // existe, pero no con ese rol
  assert.equal(sesionRestaurable({ role: "superjefe", id: "t1" }, data), null);
  assert.equal(sesionRestaurable(null, data), null);
  assert.equal(sesionRestaurable({ role: "trabajador" }, data), null);
});
test("C-3 · un trabajador real se restaura con SUS datos del catálogo, no con los guardados", () => {
  const s = sesionRestaurable({ role: "trabajador", id: "t1", nombre: "Otro Nombre", sueldo_dia: 99999, cuenta: true }, data);
  assert.deepEqual(s, { role: "trabajador", id: "t1", nombre: "Trabajador Uno", sueldo_dia: 300, categoria: "jornalero" });
});
test("C-3 · alguien dado de baja ya no se restaura", () => {
  assert.equal(sesionRestaurable({ role: "trabajador", id: "t2" }, data), null);
});

// ── C-6c: la orden de recarga borraba lo no subido ──────────
test("C-6 · con registros sin subir, la recarga se pospone y no borra nada", () => {
  const r = planDeRecarga({ tokenNube: "b", tokenLocal: "a", pendientes: [{ id: 1 }], fallidas: [{ id: 2 }] });
  assert.deepEqual(r, { accion: "posponer", sinSubir: 2 });
});
test("C-6 · sin pendientes, limpia sólo la copia de datos — nunca las colas", () => {
  const r = planDeRecarga({ tokenNube: "b", tokenLocal: "a", pendientes: [], fallidas: [], llaveDatos: "agro_v8:abc" });
  assert.equal(r.accion, "limpiar");
  assert.deepEqual(r.claves, ["agro_v8:abc"]);
  // y sin saber cuál es la llave de este espacio, no borra nada (nunca "lo de antes")
  assert.deepEqual(planDeRecarga({ tokenNube: "b", tokenLocal: "a", pendientes: [], fallidas: [] }).claves, []);
});
test("C-6 · misma orden ya aplicada, o sin orden: no hace nada", () => {
  assert.equal(planDeRecarga({ tokenNube: "a", tokenLocal: "a", pendientes: [] }).accion, "nada");
  assert.equal(planDeRecarga({ tokenNube: undefined, tokenLocal: "a" }).accion, "nada");
});

// ── Superadministradores: cada quien su cuenta, mismas facultades ───────────
import { sesionDeCuenta } from "./acceso.js";
test("el_superadministrador_abre_las_pantallas_de_administrador_con_su_propio_nombre", () => {
  const a = sesionDeCuenta({ id: "u1", nombre: "Prueba Uno", rol: "superadmin" });
  const b = sesionDeCuenta({ id: "u2", nombre: "Prueba Dos", rol: "superadmin" });
  assert.equal(a.role, "admin"); assert.equal(b.role, "admin");
  assert.equal(a.superadmin, true); assert.equal(b.superadmin, true);
  assert.notEqual(a.id, b.id); // dos identidades, no una contraseña compartida
});
test("un_rol_que_la_app_no_conoce_no_entra_como_nada", () => {
  assert.equal(sesionDeCuenta({ id: "u1", nombre: "x", rol: "jefe" }), null);
  assert.equal(sesionDeCuenta({ id: "u1", nombre: "x" }), null);
  assert.equal(sesionDeCuenta(null), null);
});
test("los_demas_roles_entran_como_lo_que_son_y_no_como_superadministrador", () => {
  for (const rol of ["dueno", "finanzas", "encargado", "agronomo"]) {
    const s = sesionDeCuenta({ id: "u", nombre: "x", rol });
    assert.equal(s.role, rol); assert.equal(s.superadmin, false);
  }
});

// ── El regreso desde el correo de confirmación ──────────────────────────────
import { regresoDelCorreo } from "./acceso.js";
test("al_volver_del_correo_confirmado_la_app_lo_dice_y_pide_entrar", () => {
  const r = regresoDelCorreo("https://sitio.example/#access_token=abc&expires_in=3600&refresh_token=x&token_type=bearer&type=signup");
  assert.equal(r.viene, true); assert.equal(r.ok, true); assert.match(r.dice, /Correo confirmado/);
});
test("un_enlace_caducado_se_explica_en_vez_de_dejar_una_pagina_rota", () => {
  const r = regresoDelCorreo("https://sitio.example/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  assert.equal(r.ok, false); assert.match(r.dice, /ya se usó o caducó/);
  assert.equal(regresoDelCorreo("https://sitio.example/?error=server_error&error_description=x").viene, true);
});
test("abrir_la_app_normal_no_es_volver_del_correo", () => {
  assert.equal(regresoDelCorreo("https://sitio.example/").viene, false);
  assert.equal(regresoDelCorreo("").viene, false);
  // un enlace de recuperar contraseña no se anuncia como "correo confirmado"
  assert.equal(regresoDelCorreo("https://sitio.example/#access_token=abc&type=recovery").viene, false);
});

// ── Una sola entrada ────────────────────────────────────────────────────────
import { caminoDeEntrada, quienEntraConPin, entrarConCredencial, puertaDeAsistencia } from "./acceso.js";
const GENTE = {
  trabajadores: [{ id: "t1", nombre: "Ana", pin: "4821", sueldo_dia: 400, categoria: "jornalero", credencial: { codigo: "ABCDEFGHJK" } }, { id: "t2", nombre: "Beto", pin: 5503 }, { id: "t3", nombre: "Carla", credencial: { codigo: "ZZZZZZZZZZ" } }, { id: "t4", nombre: "Dado de baja", pin: "9999", activo: false }],
  encargados: [{ id: "e1", nombre: "Migue encargado", pin: "5501", credencial: { codigo: "ENC1234567" } }, { id: "e2", nombre: "Otro", pin: "5503" }],
  agronomos: [{ id: "a1", nombre: "Fito", pin: "7007" }], cuadrillas: [{ id: "c1", nombre: "Cuadrilla de Juan", pin: "6006", miembros: 8, flete_dia: 300 }],
  externos: [{ id: "x1", nombre: "EXTERNO", pin: "4821" }],
};

test("lo_que_la_persona_escribe_decide_el_camino_no_una_tarjeta_de_perfil", () => {
  assert.equal(caminoDeEntrada("luis@rancho.mx"), "cuenta"); assert.equal(caminoDeEntrada(" 4821 "), "pin"); assert.equal(caminoDeEntrada("12"), "pin_corto");
  assert.equal(caminoDeEntrada("AGRO1:T:t1:ABCDEFGHJK"), "credencial"); assert.equal(caminoDeEntrada("Juan Pérez"), "otro"); assert.equal(caminoDeEntrada(""), "vacio");
});

test("con_el_pin_la_app_sabe_quien_es_y_que_perfil_le_toca_sin_preguntarselo", () => {
  const ana = quienEntraConPin("4821", GENTE);
  assert.ok(ana.ok); assert.deepEqual(ana.sesion, { role: "trabajador", id: "t1", nombre: "Ana", sueldo_dia: 400, categoria: "jornalero" }, "el PIN de un externo no cuenta: los externos no entran con PIN");
  assert.equal(quienEntraConPin("5501", GENTE).sesion.role, "encargado"); assert.equal(quienEntraConPin("7007", GENTE).sesion.role, "agronomo");
  assert.deepEqual(quienEntraConPin("6006", GENTE).sesion, { role: "cuadrilla", id: "c1", nombre: "Cuadrilla de Juan", miembros: 8, flete_dia: 300 });
  assert.equal(quienEntraConPin("0000", GENTE).motivo, "nadie"); assert.equal(quienEntraConPin("12", GENTE).motivo, "corto");
  assert.equal(quienEntraConPin("9999", GENTE).motivo, "nadie", "alguien dado de baja ya no entra");
  assert.equal(quienEntraConPin("4821", GENTE).sesion.pin, undefined, "el PIN no viaja en la sesión");
});

test("un_pin_que_tienen_dos_personas_no_escoge_a_ninguna", () => {
  const r = quienEntraConPin("5503", GENTE);
  assert.equal(r.ok, false); assert.equal(r.motivo, "repetido"); assert.match(r.dice, /credencial y tu PIN/);
  // …y con la credencial sí se sabe cuál de las dos es.
  const beto = { ...GENTE, trabajadores: GENTE.trabajadores.map(t => (t.id === "t2" ? { ...t, credencial: { codigo: "BETO123456" } } : t)) };
  assert.equal(entrarConCredencial("AGRO1:T:t2:BETO123456", "5503", beto).sesion.id, "t2");
});

test("la_credencial_sola_no_abre_sesion_dice_quien_es_y_pide_el_pin", () => {
  const sola = entrarConCredencial("AGRO1:T:t1:ABCDEFGHJK", "", GENTE);
  assert.equal(sola.ok, false); assert.equal(sola.falta, "pin"); assert.deepEqual(sola.persona, { id: "t1", nombre: "Ana", rol: "trabajador" });
  assert.equal(entrarConCredencial("AGRO1:T:t1:ABCDEFGHJK", "0000", GENTE).motivo, "incorrecto");
  const bien = entrarConCredencial("AGRO1:T:t1:ABCDEFGHJK", "4821", GENTE);
  assert.ok(bien.ok); assert.equal(bien.sesion.role, "trabajador"); assert.equal(bien.via, "credencial");
  assert.equal(entrarConCredencial("AGRO1:T:e1:ENC1234567", "5501", GENTE).sesion.role, "encargado", "el perfil sale del catálogo donde está la persona");
  assert.equal(entrarConCredencial("AGRO1:T:t1:OTROCODIGO", "4821", GENTE).motivo, "vencida", "una credencial repuesta deja sin efecto la anterior");
  assert.equal(entrarConCredencial("AGRO1:T:t3:ZZZZZZZZZZ", "", GENTE).motivo, "sin_pin", "quien no tiene PIN puede checar, pero no entrar");
  assert.equal(entrarConCredencial("AGRO1:T:t4:X", "9999", GENTE).motivo, "desconocida"); assert.equal(entrarConCredencial("hola", "1", GENTE).motivo, "no_es");
});

test("registrar_asistencia_desde_la_entrada_solo_en_un_aparato_que_dejo_un_encargado", () => {
  assert.equal(puertaDeAsistencia(null).ok, false); assert.match(puertaDeAsistencia(null).dice, /checador de la nave/);
  assert.deepEqual(puertaDeAsistencia({ cuentaId: "u-enc", nombre: "Migue", desde: "2026-11-20" }), { ok: true, quien: { id: "u-enc", nombre: "Migue", rol: "encargado" }, soloDe: null });
  // El teléfono propio de una persona (src/gps.js): la puerta dice de quién es.
  assert.deepEqual(puertaDeAsistencia({ cuentaId: "u-enc", nombre: "Migue", soloDe: { id: "t-ana", nombre: "ANA" } }).soloDe, { id: "t-ana", nombre: "ANA" });
});

// ── El alta de personal: lo que se revisa antes de guardar (cierre de la versión 1.0) ──
import { revisarAlta } from "./acceso.js";
const ranchoDeAlta = { trabajadores: [{ id: "t1", nombre: "ANA INVENTADA", pin: "4101" }], encargados: [{ id: "e1", nombre: "ENCARGADO INVENTADO", pin: "5501" }], cuadrillas: [], agronomos: [] };
test("un_pin_que_ya_tiene_otra_persona_no_se_guarda_porque_dejaria_sin_entrar_a_las_dos", () => {
  const r = revisarAlta({ nombre: "BETO INVENTADO", pin: "4101", sueldo_dia: 350 }, ranchoDeAlta);
  assert.equal(r.ok, false); assert.equal(r.falta, "pin"); assert.match(r.dice, /ANA INVENTADA/);
  // también contra los encargados: el PIN se busca en todos los catálogos a la vez
  assert.equal(revisarAlta({ nombre: "BETO INVENTADO", pin: "5501", sueldo_dia: 350 }, ranchoDeAlta).ok, false);
  // y es justo el caso que dejaba fuera a los dos
  const conLosDos = { ...ranchoDeAlta, trabajadores: [...ranchoDeAlta.trabajadores, { id: "t2", nombre: "BETO INVENTADO", pin: "4101" }] };
  assert.equal(quienEntraConPin("4101", conLosDos).motivo, "repetido");
});
test("sin_nombre_no_se_da_de_alta_y_el_pin_es_de_cuatro_a_ocho_numeros", () => {
  assert.equal(revisarAlta({ nombre: "  ", pin: "4102", sueldo_dia: 350 }, ranchoDeAlta).falta, "nombre");
  assert.equal(revisarAlta({ nombre: "BETO INVENTADO", pin: "12", sueldo_dia: 350 }, ranchoDeAlta).falta, "pin");
  assert.equal(revisarAlta({ nombre: "BETO INVENTADO", pin: "41a2", sueldo_dia: 350 }, ranchoDeAlta).falta, "pin");
  assert.equal(revisarAlta({ nombre: "BETO INVENTADO", pin: "4102", sueldo_dia: 0 }, ranchoDeAlta).falta, "sueldo");
  assert.equal(revisarAlta({ nombre: "BETO INVENTADO", pin: "4102", sueldo_dia: 350 }, ranchoDeAlta).ok, true);
});
test("la_misma_persona_no_se_da_de_alta_dos_veces_con_el_mismo_nombre", () => {
  const r = revisarAlta({ nombre: " ana inventada ", pin: "4109", sueldo_dia: 350 }, ranchoDeAlta);
  assert.equal(r.ok, false); assert.equal(r.falta, "nombre");
});
test("sin_pin_se_puede_dar_de_alta_pero_se_avisa_que_no_podra_entrar", () => {
  const r = revisarAlta({ nombre: "BETO INVENTADO", pin: "", sueldo_dia: 350 }, ranchoDeAlta);
  assert.equal(r.ok, true); assert.match(r.aviso, /sin PIN/);
});
test("al_editar_su_propia_ficha_su_pin_y_su_nombre_no_chocan_consigo_misma", () => {
  assert.equal(revisarAlta({ id: "t1", nombre: "ANA INVENTADA", pin: "4101" }, ranchoDeAlta, { propioId: "t1", pideSueldo: false }).ok, true);
  assert.equal(revisarAlta({ id: "t1", nombre: "ANA INVENTADA", pin: "5501" }, ranchoDeAlta, { propioId: "t1", pideSueldo: false }).ok, false);
});

// ── Teléfono compartido: la sesión de captura personal no se queda abierta para el siguiente ──
import { debeCerrarse, MINUTOS_SIN_USO } from "./acceso.js";
test("en_un_telefono_compartido_la_sesion_de_quien_entro_con_pin_se_cierra_sola_y_la_del_encargado_no", () => {
  const t0 = 10_000_000, pasado = t0 + MINUTOS_SIN_USO * 60 * 1000;
  assert.equal(debeCerrarse({ role: "trabajador", id: "t1" }, pasado, t0), true);
  assert.equal(debeCerrarse({ role: "cuadrilla", id: "c1" }, pasado, t0), true);
  assert.equal(debeCerrarse({ role: "trabajador", id: "t1" }, pasado - 1000, t0), false, "mientras se usa, no");
  assert.equal(debeCerrarse({ role: "encargado", id: "e1" }, pasado * 2, t0), false, "su aparato puede estar de checador todo el día");
  assert.equal(debeCerrarse({ role: "admin", id: "a1", cuenta: true }, pasado * 2, t0), false, "quien entró con cuenta, tampoco");
  assert.equal(debeCerrarse(null, pasado, t0), false);
});
