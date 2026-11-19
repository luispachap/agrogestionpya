import { test } from "node:test";
import assert from "node:assert/strict";
import { cerrarSemana, reabrirSemana, estadoDeSemana, diferenciasDelCierre, confirmarPagos, puedeCerrar, cierresDe } from "./cierres.js";

const ADMIN = { id: "u1", nombre: "Luis", rol: "admin" }, ENC = { id: "en1", nombre: "Chuy", rol: "encargado" };
const L = "2026-11-16", D = "2026-11-22"; const c = (h) => `2026-11-23T${h}:00-06:00`;
const R = (corresponde, id = "t-ana") => ({ a: { tipo: "trabajador", id, nombre: id }, corresponde, descuentos: 0, neto: corresponde });
const cerrar = (eventos, mas = {}) => cerrarSemana({ eventos, desde: L, hasta: D, renglones: [R(2400)], quien: ADMIN, cuando: c("09:00"), fecha: "2026-11-23", ...mas });

test("la_semana_la_cierra_un_administrador_o_alguien_autorizado_expresamente", () => {
  assert.equal(cerrar([], { quien: ENC }).ok, false);
  assert.equal(cerrar([], { quien: ENC, permitido: true }).ok, true, "con el permiso que le asignaron a su cuenta");
  assert.equal(cerrar([], { quien: ADMIN, permitido: false }).ok, false, "entrar como administrador en un aparato cuya cuenta no tiene el permiso no basta");
  assert.match(cerrar([], { quien: ADMIN, permitido: false }).dice, /no tiene ese permiso/);
  assert.equal(puedeCerrar({ id: "t1", rol: "trabajador" }), false);
});

test("cerrar_guarda_la_foto_del_calculo_y_no_se_cierra_dos_veces", () => {
  const r = cerrar([]); assert.ok(r.ok);
  assert.equal(r.evento.datos.total, 2400); assert.equal(r.evento.datos.renglones[0].a.id, "t-ana");
  assert.equal(estadoDeSemana([r.evento], L, D).estado, "cerrada");
  assert.equal(cerrar([r.evento]).ok, false);
  assert.equal(estadoDeSemana([r.evento], "2026-11-09", "2026-11-15").estado, "abierta", "cada semana es aparte");
});

test("reabrir_pide_motivo_y_el_cierre_nuevo_es_otra_version_el_anterior_se_queda", () => {
  const c1 = cerrar([]).evento;
  assert.equal(reabrirSemana({ eventos: [c1], desde: L, hasta: D, motivo: " ", quien: ADMIN, cuando: c("10:00"), fecha: "2026-11-23" }).ok, false);
  assert.equal(reabrirSemana({ eventos: [], desde: L, hasta: D, motivo: "x", quien: ADMIN, cuando: c("10:00"), fecha: "2026-11-23" }).ok, false, "no se reabre lo que no está cerrado");
  const re = reabrirSemana({ eventos: [c1], desde: L, hasta: D, motivo: "se justificó la falta de Ana", quien: ADMIN, cuando: c("10:00"), fecha: "2026-11-23" }).evento;
  assert.equal(estadoDeSemana([c1, re], L, D).estado, "reabierta");
  assert.equal(cerrar([c1, re], { renglones: [R(2800)], cuando: c("11:00") }).ok, false, "el segundo cierre dice qué cambió");
  const c2 = cerrar([c1, re], { renglones: [R(2800)], cuando: c("11:00"), motivo: "con la falta justificada" }).evento;
  const s = estadoDeSemana([c1, re, c2], L, D);
  assert.equal(s.estado, "cerrada"); assert.equal(s.cierre.version, 2); assert.equal(c2.origen, c1.id);
  assert.deepEqual(cierresDe([c1, re, c2], L, D).map(x => x.datos.total), [2400, 2800], "las dos versiones siguen ahí");
});

test("lo_que_cambia_despues_del_cierre_se_enseña_como_diferencia_no_cambia_la_foto", () => {
  const c1 = cerrar([], { renglones: [R(2400), R(1200, "t-beto")] }).evento;
  const d = diferenciasDelCierre(c1, [R(2800), R(1200, "t-beto"), R(400, "t-caro")]);
  assert.equal(d.hay, true); assert.deepEqual(d.lista.map(x => [x.a.id, x.era, x.es]), [["t-ana", 2400, 2800], ["t-caro", 0, 400]]); assert.equal(d.total, 800);
  assert.equal(c1.datos.total, 3600); assert.equal(diferenciasDelCierre(c1, [R(2400), R(1200, "t-beto")]).hay, false);
});

test("confirmar_los_pagos_es_otro_paso_va_despues_del_cierre_y_dice_lo_que_falta", () => {
  const P = (neto, entregado) => ({ a: { tipo: "trabajador", id: "t-ana", nombre: "Ana" }, neto, entregado, pendiente: neto - entregado });
  assert.equal(confirmarPagos({ eventos: [], desde: L, hasta: D, renglones: [P(2400, 2400)], quien: ADMIN, cuando: c("12:00"), fecha: "2026-11-23" }).ok, false, "sin cierre no hay contra qué confirmar");
  const c1 = cerrar([]).evento;
  assert.equal(estadoDeSemana([c1], L, D).confirmacion, null, "cerrar no confirma los pagos");
  assert.equal(confirmarPagos({ eventos: [c1], desde: L, hasta: D, renglones: [P(2400, 2000)], quien: ADMIN, cuando: c("12:00"), fecha: "2026-11-23" }).ok, false, "con pendiente pide una nota");
  const k = confirmarPagos({ eventos: [c1], desde: L, hasta: D, renglones: [P(2400, 2000)], nota: "el resto el lunes", quien: ADMIN, cuando: c("12:00"), fecha: "2026-11-23" });
  assert.ok(k.ok); assert.equal(k.evento.datos.pendiente, 400); assert.equal(k.evento.datos.cierre, c1.id);
  assert.equal(estadoDeSemana([c1, k.evento], L, D).confirmacion.id, k.evento.id);
  const re = reabrirSemana({ eventos: [c1, k.evento], desde: L, hasta: D, motivo: "corrección", quien: ADMIN, cuando: c("13:00"), fecha: "2026-11-23" }).evento;
  const c2 = cerrar([c1, k.evento, re], { cuando: c("14:00"), motivo: "corregido" }).evento;
  assert.equal(estadoDeSemana([c1, k.evento, re, c2], L, D).confirmacion, null, "la confirmación era del cierre anterior: el nuevo necesita la suya");
});
