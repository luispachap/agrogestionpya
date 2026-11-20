import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nuevoEvento, vigentes, exigirValidacion, validacionDe, sinValidar, juntarEventos, cancelarEvento, OPERACION_DE, OPERACIONES, negado, SIN_PERMISO } from "./eventos.js";
import { objetoAFila, filaAObjeto } from "./filas.js";
import { registrarPago, pagosA, saldoDe } from "./pagos.js";
import { cerrarSemana, estadoDeSemana } from "./cierres.js";
import { cambiarAjuste, ajusteVigente } from "./cuadrillas.js";

const ADMIN = { id: "u1", nombre: "Luis", rol: "admin" }; const c = "2026-11-19T12:00:00-06:00", HOY = "2026-11-19";
const A = { tipo: "trabajador", id: "t-ana", nombre: "Ana" };
const pago = (azar) => registrarPago({ a: A, desde: "2026-11-16", hasta: "2026-11-22", monto: 500, medio: "efectivo", comprobante: "x", quien: ADMIN, cuando: c, fecha: HOY, azar }).evento;
afterEach(() => exigirValidacion(false));

test("la_lista_de_operaciones_sensibles_de_la_app_es_la_misma_que_la_de_la_base", () => {
  const sql = readFileSync(new URL("../supabase/40-catalogo-de-salarios-minimos.sql", import.meta.url), "utf8");
  const lista = sql.slice(sql.indexOf("insert into operaciones_sensibles"), sql.indexOf("on conflict (tipo)"));
  const enBase = Object.fromEntries([...lista.matchAll(/\('([a-z_]+)',\s+'([a-z_]+)',\s+(true|false)\)/g)].map(m => [m[1], m[2]]));
  assert.deepEqual(enBase, OPERACION_DE);
  for (const op of new Set(Object.values(OPERACION_DE))) assert.ok(OPERACIONES[op], `falta el nombre en pantalla de ${op}`);
});

test("con_servidor_un_pago_capturado_no_cuenta_hasta_que_la_base_lo_autoriza", () => {
  const p = pago(0.1);
  assert.equal(pagosA([p], A).length, 1, "sin servidor (un aparato suelto, las pruebas) mandan las reglas de la app");
  exigirValidacion(true);
  assert.equal(validacionDe(p), "pendiente"); assert.equal(pagosA([p], A).length, 0, "capturado sin señal: por validar, todavía no cuenta");
  assert.equal(saldoDe({ corresponde: 800, pagos: pagosA([p], A) }).pendiente, 800);
  assert.deepEqual(sinValidar([p]).pendientes.map(e => e.id), [p.id]);
  const ok = { ...p, _validacion: "autorizado" }, no = { ...p, _validacion: "rechazado", _validacionDice: "sin_permiso" };
  assert.equal(pagosA([ok], A).length, 1);
  assert.equal(pagosA([no], A).length, 0, "lo que la base rechazó nunca cuenta"); assert.equal(sinValidar([no]).rechazados.length, 1);
});

test("lo_que_no_es_sensible_cuenta_igual_con_o_sin_servidor", () => {
  const marca = nuevoEvento({ tipo: "marca", cuando: c, fecha: HOY, quien: ADMIN, datos: { trabajadorId: "t1", sentido: "entrada" } });
  exigirValidacion(true);
  assert.equal(validacionDe(marca), "no_aplica"); assert.equal(vigentes([marca]).length, 1); assert.equal(sinValidar([marca]).pendientes.length, 0);
});

test("un_cierre_o_un_cambio_de_regla_sin_validar_tampoco_tiene_efecto", () => {
  const cierre = cerrarSemana({ eventos: [], desde: "2026-11-16", hasta: "2026-11-22", renglones: [], quien: ADMIN, cuando: c, fecha: HOY }).evento;
  const regla = cambiarAjuste({ clave: "prest_aguinaldo_dias", valor: 30, quien: ADMIN, cuando: c, fecha: HOY }).evento;
  exigirValidacion(true);
  assert.equal(estadoDeSemana([cierre], "2026-11-16", "2026-11-22").estado, "abierta");
  assert.equal(ajusteVigente([regla], "prest_aguinaldo_dias").valor, 15);
  assert.equal(estadoDeSemana([{ ...cierre, _validacion: "autorizado" }], "2026-11-16", "2026-11-22").estado, "cerrada");
  assert.equal(ajusteVigente([{ ...regla, _validacion: "autorizado" }], "prest_aguinaldo_dias").valor, 30);
});

test("el_sello_no_se_sube_y_al_bajar_solo_vale_el_de_la_columna_de_la_base", () => {
  const p = { ...pago(0.2), _validacion: "autorizado", _validadoRol: "superadmin" };
  const fila = objetoAFila("eventos", p);
  assert.equal(JSON.stringify(fila).includes("autorizado"), false, "lo que el teléfono diga de su propia validación no viaja");
  // Alguien mete el sello DENTRO del registro, saltándose la app: al leerlo no vale.
  const tramposa = { id: p.id, tipo: p.tipo, fecha: p.fecha, estado: "vigente", datos: { ...fila.datos, _validacion: "autorizado", _validadoRol: "superadmin" }, validacion: "rechazado", validacion_dice: "sin_permiso", validado_rol: "encargado", recibido: "2026-11-19T18:00:01Z" };
  const leido = filaAObjeto(tramposa);
  assert.equal(leido._validacion, "rechazado"); assert.equal(leido._validadoRol, "encargado"); assert.equal(leido._validacionDice, "sin_permiso");
  const sinColumna = filaAObjeto({ ...tramposa, validacion: null, validado_rol: null });
  assert.equal(sinColumna._validacion, undefined);
});

test("al_bajar_de_la_nube_el_evento_local_recibe_su_sello_y_un_cambio_rechazado_se_deshace", () => {
  exigirValidacion(true);
  const p = pago(0.3);
  let j = juntarEventos([p], [{ ...p, _validacion: "autorizado", _recibido: "2026-11-19T18:00:01Z" }]);
  assert.equal(j.cambiaron.length, 1); assert.equal(pagosA(j.eventos, A).length, 1);
  // En este aparato alguien sin permiso lo canceló; la base no lo aceptó.
  const cancelado = cancelarEvento(j.eventos[0], { motivo: "prueba", quien: ADMIN, cuando: c }).evento;
  assert.equal(pagosA([cancelado], A).length, 0);
  j = juntarEventos([cancelado], [{ ...p, _validacion: "autorizado", _cambioRechazado: "2026-11-19T19:00:00Z" }]);
  assert.equal(pagosA(j.eventos, A).length, 1, "el pago sigue contando: vale lo que dice la base");
  assert.equal(juntarEventos(j.eventos, [{ ...p, _validacion: "autorizado", _cambioRechazado: "2026-11-19T19:00:00Z" }]).cambiaron.length, 0, "y no se repite en cada bajada");
});

test("en_la_app_el_permiso_de_la_cuenta_manda_sobre_el_perfil_con_que_se_entro", () => {
  assert.equal(negado(ADMIN, undefined, "x"), null, "sin servidor: el perfil");
  assert.equal(negado({ rol: "encargado" }, undefined, "sólo un administrador"), "sólo un administrador");
  assert.equal(negado(ADMIN, false, "x"), SIN_PERMISO, "entró como administrador, pero la cuenta del aparato no tiene el permiso");
  assert.equal(negado({ rol: "encargado" }, true, "x"), null, "un encargado al que se le asignó ese permiso");
  assert.equal(registrarPago({ permitido: false, a: A, desde: "2026-11-16", hasta: "2026-11-22", monto: 1, medio: "efectivo", quien: ADMIN, cuando: c, fecha: HOY }).ok, false);
});
