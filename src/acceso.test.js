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
  const r = planDeRecarga({ tokenNube: "b", tokenLocal: "a", pendientes: [], fallidas: [] });
  assert.equal(r.accion, "limpiar");
  assert.deepEqual(r.claves, ["agro_v7"]);
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
