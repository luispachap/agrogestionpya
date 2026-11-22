import { test } from "node:test";
import assert from "node:assert/strict";
import { mezclarConNube, planDeSubida, puedeLigarTelefono, vinculoDe, abrePantallasSola } from "./sincroniza.js";

test("lo_borrado_en_otro_telefono_se_quita_de_este_y_no_revive", () => {
  const local = { tareas: [{ id: "t1", titulo: "regar", _actualizado: "2026-11-01T10:00:00Z" }, { id: "t2", titulo: "podar" }] };
  const nube = { tareas: [{ id: "t1", titulo: "regar", _actualizado: "2026-11-02T10:00:00Z", _borrado: "2026-11-02T10:00:00Z" }, { id: "t2", titulo: "podar" }] };
  const r = mezclarConNube(local, nube);
  assert.deepEqual(r.datos.tareas.map(t => t.id), ["t2"]);
  assert.equal(r.quitados, 1);
});

test("una_lapida_de_algo_que_este_telefono_nunca_tuvo_no_agrega_nada", () => {
  const r = mezclarConNube({ tareas: [] }, { tareas: [{ id: "x", _borrado: "2026-11-02T10:00:00Z" }, { id: "y" }] });
  assert.deepEqual(r.datos.tareas.map(t => t.id), ["y"]);
});

test("lo_capturado_sin_senal_no_se_pierde_al_bajar_la_nube", () => {
  const local = { actividades: [{ id: "nuevo", horas: 8, _actualizado: "2026-11-03T08:00:00Z" }] };
  const nube = { actividades: [{ id: "viejo", horas: 4, _actualizado: "2026-11-01T08:00:00Z" }], _fallas: [], _topes: [] };
  assert.deepEqual(mezclarConNube(local, nube).datos.actividades.map(a => a.id).sort(), ["nuevo", "viejo"]);
});

test("en_los_dos_lados_gana_el_mas_reciente_y_el_empate_es_de_lo_local", () => {
  const local = { egresos: [{ id: "e1", monto: 200, _actualizado: "2026-11-03T08:00:00Z" }, { id: "e2", monto: 5, _actualizado: "2026-11-01T08:00:00Z" }] };
  const nube = { egresos: [{ id: "e1", monto: 100, _actualizado: "2026-11-02T08:00:00Z" }, { id: "e2", monto: 9, _actualizado: "2026-11-02T08:00:00Z" }] };
  const m = Object.fromEntries(mezclarConNube(local, nube).datos.egresos.map(e => [e.id, e.monto]));
  assert.deepEqual(m, { e1: 200, e2: 9 });
});

test("si_la_nube_trae_una_tabla_vacia_lo_local_no_se_toca", () => {
  const local = { trabajadores: [{ id: "t1" }] };
  assert.deepEqual(mezclarConNube(local, { trabajadores: [] }).datos.trabajadores, [{ id: "t1" }]);
});

test("sin_cuenta_ligada_la_cola_espera_y_lo_dice_en_vez_de_gastar_intentos", () => {
  const p = planDeSubida({ nubeConfigurada: true, enLinea: true, hayCuenta: false, pendientes: 7 });
  assert.equal(p.subir, false); assert.equal(p.motivo, "sin_cuenta");
  assert.match(p.dice, /7 captura\(s\).*SIN subir/);
  assert.equal(planDeSubida({ nubeConfigurada: true, enLinea: false, hayCuenta: true, pendientes: 2 }).motivo, "sin_senal");
  assert.equal(planDeSubida({ nubeConfigurada: true, enLinea: true, hayCuenta: true, pendientes: 2 }).subir, true);
  assert.equal(planDeSubida({ nubeConfigurada: true, enLinea: true, hayCuenta: false, pendientes: 0 }).dice, "");
});

test("solo_la_cuenta_de_un_encargado_se_queda_ligada_al_telefono_de_campo", () => {
  const enc = { cuenta: true, role: "encargado", id: "u-enc", nombre: "ENCARGADO DE PRUEBA" };
  assert.equal(puedeLigarTelefono(enc), true);
  assert.deepEqual(vinculoDe(enc, "2026-11-19T00:00:00Z"), { cuentaId: "u-enc", nombre: "ENCARGADO DE PRUEBA", desde: "2026-11-19T00:00:00Z" });
  // un superadministrador NO: sería dejar la llave de todo en el campo
  assert.equal(puedeLigarTelefono({ cuenta: true, role: "admin", superadmin: true, id: "u1" }), false);
  // alguien que entró con PIN no tiene cuenta que ligar
  assert.equal(puedeLigarTelefono({ role: "encargado", id: "enc-pin" }), false);
  assert.equal(vinculoDe({ role: "trabajador", id: "t1" }), null);
});

test("con_el_telefono_ligado_la_cuenta_sube_pero_no_abre_pantallas_sola", () => {
  assert.equal(abrePantallasSola({ cuentaId: "u-enc" }), false);
  assert.equal(abrePantallasSola(null), true);
});

// ── Lo de otros aparatos llega sin tener que salir y volver a entrar (cierre de la versión 1.0) ──
import { tocaBajar, CADA_CUANTO_BAJAR_MS } from "./sincroniza.js";
test("lo_que_capturo_otro_aparato_se_vuelve_a_bajar_cada_rato_y_no_solo_al_entrar", () => {
  const t0 = 1_000_000;
  assert.equal(tocaBajar({ ahora: t0, ultima: 0 }), true, "la primera vez, siempre");
  assert.equal(tocaBajar({ ahora: t0 + 60_000, ultima: t0 }), false, "recién bajado no se repite");
  assert.equal(tocaBajar({ ahora: t0 + CADA_CUANTO_BAJAR_MS, ultima: t0 }), true, "pasado el rato, sí");
  assert.equal(tocaBajar({ ahora: t0 + CADA_CUANTO_BAJAR_MS * 3, ultima: t0, enLinea: false }), false, "sin señal no hay de dónde");
  assert.equal(tocaBajar({ ahora: t0 + CADA_CUANTO_BAJAR_MS * 3, ultima: t0, visible: false }), false, "con la app escondida no gasta datos");
});

import { esFallaDeRed } from "./sincroniza.js";
test("con_mala_senal_una_subida_sin_respuesta_no_gasta_intentos_pero_un_rechazo_de_la_base_si", () => {
  assert.equal(esFallaDeRed(new TypeError("Failed to fetch")), true);
  assert.equal(esFallaDeRed({ message: "NetworkError when attempting to fetch resource." }), true);
  assert.equal(esFallaDeRed({ message: "Load failed" }), true);                       // así lo dice Safari
  assert.equal(esFallaDeRed({ code: "42501", message: "new row violates row-level security policy" }), false);
  assert.equal(esFallaDeRed({ code: "23505", message: "duplicate key" }), false);
  assert.equal(esFallaDeRed({ status: 401, message: "JWT expired" }), false);
  assert.equal(esFallaDeRed(null), false);
});

test("dos_registros_distintos_con_el_mismo_identificador_no_se_pierde_ninguno_el_de_este_telefono_se_reubica", () => {
  const mio = { id: "eg1", monto: 99999, concepto: "el mío", _nace: "bbb", _actualizado: "2026-11-19T10:00:05Z" };
  const deLaNube = { id: "eg1", monto: 111, concepto: "el del otro teléfono", _nace: "aaa", _actualizado: "2026-11-19T10:00:00Z" };
  const m = mezclarConNube({ egresos: [mio] }, { egresos: [deLaNube] }, { nuevoId: (id) => id + "-otro" });
  assert.deepEqual(m.datos.egresos.map(e => [e.id, e.monto]).sort(), [["eg1", 111], ["eg1-otro", 99999]]);
  assert.deepEqual(m.reubicados, [{ tabla: "egresos", de: "eg1", a: "eg1-otro" }]);
  const subir = m.porSubir.find(x => x.registro.id === "eg1-otro");
  assert.equal(subir.registro._nace, "bbb"); assert.equal(subir.registro._reubicadoDe, "eg1");
  const otraVez = mezclarConNube(m.datos, { egresos: [deLaNube, subir.registro] }, { nuevoId: (id) => id + "-otro" });
  assert.equal(otraVez.datos.egresos.length, 2, "ya resuelto, no se vuelve a mover"); assert.deepEqual(otraVez.reubicados, []);
});
test("el_mismo_registro_o_uno_de_antes_sin_marca_se_mezcla_como_siempre", () => {
  const a = { id: "eg1", monto: 1, _nace: "aaa", _actualizado: "2026-11-19T10:00:00Z" }, b = { ...a, monto: 2, _actualizado: "2026-11-19T11:00:00Z" };
  assert.deepEqual(mezclarConNube({ egresos: [a] }, { egresos: [b] }).datos.egresos.map(e => e.monto), [2]);
  assert.equal(mezclarConNube({ egresos: [{ id: "x", monto: 1 }] }, { egresos: [{ id: "x", monto: 2, _nace: "n", _actualizado: "2026-11-19T11:00:00Z" }] }).reubicados.length, 0);
});
