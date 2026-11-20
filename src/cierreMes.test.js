import { test } from "node:test";
import assert from "node:assert/strict";
import { costoDelMes, cerrarMes, reabrirMes, estadoDeMes, ajustesPosteriores, mesesCerrados } from "./cierreMes.js";

const ADMIN = { id: "u1", nombre: "Luis", rol: "admin" }, ENC = { id: "e1", nombre: "Enc", rol: "encargado" };
const c = (h) => `2026-12-02T${h}:00-06:00`, HOY = "2026-12-02";
const PARCELAS = [{ id: "p1", nombre: "La Loma" }, { id: "p2", nombre: "El Bajío" }];
const ACTS = [{ parcelaId: "p1", fecha: "2026-11-05", costoTotal: 1000 }, { parcelaId: "p1", fecha: "2026-11-30", costoTotal: 500 }, { parcelaId: "p2", fecha: "2026-11-10", costoTotal: 300 }, { parcelaId: "p1", fecha: "2026-12-01", costoTotal: 9999 }, { parcelaId: "p1", fecha: "2026-10-31", costoTotal: 7777 }];
const IND = { partes: [{ parcelaId: "p1", fecha: "2026-11-30", monto: 200, fuente: "vehiculos" }, { parcelaId: "p2", fecha: "2026-11-18", monto: 50, fuente: "personal" }, { parcelaId: "p2", fecha: "2026-12-01", monto: 999, fuente: "personal" }],
  pendientes: [{ fecha: "2026-11-18", monto: 600, fuente: "personal" }, { fecha: "2026-10-18", monto: 111, fuente: "personal" }], noProduccion: [{ fuente: "personal", monto: 30, detalle: [{ fecha: "2026-11-02", monto: 30 }] }] };
const costo = (mas = {}) => costoDelMes({ mes: "2026-11", parcelas: PARCELAS, actividades: ACTS, egresos: [{ parcelaId: "p2", fecha: "2026-11-12", monto: 100 }], compras: [{ parcelaId: "p1", fecha: "2026-11-03", monto: 40, estado: "aprobada" }, { parcelaId: "p1", fecha: "2026-11-03", monto: 4000, estado: "pendiente" }], indirectos: IND, ...mas });
const cerrar = (eventos, mas = {}) => cerrarMes({ eventos, costo: costo(), hoy: HOY, quien: ADMIN, cuando: c("09:00"), fecha: HOY, ...mas });

test("el_costo_del_mes_separa_directo_indirecto_y_completo_por_parcela_y_solo_cuenta_lo_de_ese_mes", () => {
  const k = costo();
  assert.deepEqual(k.renglones.map(r => [r.nombre, r.directo, r.indirecto, r.completo]), [["El Bajío", 400, 50, 450], ["La Loma", 1540, 200, 1740]]);
  assert.equal(k.directo, 1940); assert.equal(k.indirecto, 250); assert.equal(k.completo, 2190);
  assert.equal(k.pendiente, 600, "lo pendiente de distribuir se dice aparte; no se reparte para que cuadre"); assert.equal(k.noProduccion, 30);
});

test("un_mes_no_se_cierra_antes_de_que_termine_ni_dos_veces_y_lo_cierra_quien_tiene_el_permiso", () => {
  assert.equal(cerrar([], { hoy: "2026-11-30" }).ok, false);
  assert.equal(cerrar([], { quien: ENC }).ok, false);
  assert.equal(cerrar([], { permitido: false }).ok, false, "entrar como administrador en un aparato sin el permiso no basta");
  assert.equal(cerrar([], { quien: ENC, permitido: true }).ok, true);
  const r = cerrar([]);
  assert.ok(r.ok); assert.equal(r.evento.datos.completo, 2190); assert.equal(r.evento.datos.pendiente, 600); assert.match(r.avisos[0], /pendientes de distribuir/);
  assert.equal(estadoDeMes([r.evento], "2026-11").estado, "cerrado"); assert.equal(estadoDeMes([r.evento], "2026-10").estado, "abierto");
  assert.equal(cerrar([r.evento]).ok, false); assert.deepEqual(mesesCerrados([r.evento]), ["2026-11"]);
});

test("una_compra_capturada_tarde_no_cambia_la_foto_del_cierre_sale_como_ajuste_posterior", () => {
  const c1 = cerrar([]).evento;
  const hoy = costo({ actividades: [...ACTS, { parcelaId: "p1", fecha: "2026-11-20", costoTotal: 250 }], indirectos: { ...IND, partes: [...IND.partes, { parcelaId: "p2", fecha: "2026-11-18", monto: 600, fuente: "personal" }], pendientes: IND.pendientes.slice(1) } });
  const a = ajustesPosteriores(c1, hoy);
  assert.equal(a.hay, true);
  assert.deepEqual(a.lista.map(x => [x.nombre, x.directo, x.indirecto, x.era, x.es]), [["El Bajío", 0, 600, 450, 1050], ["La Loma", 250, 0, 1740, 1990]]);
  assert.equal(a.total, 850); assert.equal(a.pendiente, -600, "lo que estaba pendiente ya se distribuyó");
  assert.equal(c1.datos.completo, 2190, "las cifras originales siguen ahí"); assert.equal(ajustesPosteriores(c1, costo()).hay, false);
});

test("reabrir_pide_motivo_y_el_cierre_nuevo_es_otra_version_la_anterior_se_conserva", () => {
  const c1 = cerrar([]).evento;
  assert.equal(reabrirMes({ eventos: [c1], mes: "2026-11", motivo: "", quien: ADMIN, cuando: c("10:00"), fecha: HOY }).ok, false);
  assert.equal(reabrirMes({ eventos: [], mes: "2026-11", motivo: "x", quien: ADMIN, cuando: c("10:00"), fecha: HOY }).ok, false);
  const re = reabrirMes({ eventos: [c1], mes: "2026-11", motivo: "llegó la factura del diésel", quien: ADMIN, cuando: c("10:00"), fecha: HOY }).evento;
  assert.equal(estadoDeMes([c1, re], "2026-11").estado, "reabierto");
  assert.equal(cerrar([c1, re], { cuando: c("11:00") }).ok, false, "el cierre nuevo dice qué cambió");
  const c2 = cerrar([c1, re], { cuando: c("11:00"), motivo: "con el diésel" }).evento;
  const s = estadoDeMes([c1, re, c2], "2026-11");
  assert.equal(s.estado, "cerrado"); assert.equal(s.cierre.version, 2); assert.equal(s.cierres.length, 2); assert.equal(c2.origen, c1.id);
});
