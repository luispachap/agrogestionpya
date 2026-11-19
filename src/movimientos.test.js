import { test } from "node:test";
import assert from "node:assert/strict";
import { cancelarEvento } from "./eventos.js";
import { entregar, cerrar, seQueda, consumirDirecto, transferir, ajustar, estadoDelAlmacen, existenciasDe, loQueTrae, porCerrar, costoDeConsumos, actividadesDeAlmacen, textoDeArticulo, leerArticulo, NAVE } from "./movimientos.js";

const ENC = { id: "enc1", nombre: "Encargado", rol: "encargado" }, ADMIN = { id: "u1", nombre: "Luis", rol: "admin" };
const D = "2026-11-19", c = (h = "08:00", dia = D) => `${dia}T${h}:00-06:00`;
const UREA = { id: "i-urea", nombre: "Urea", unidad: "bulto", existencia: 50, costo_unit: 868 };
const PALA = { id: "i-pala", nombre: "Pala", unidad: "pieza", existencia: 6, esHerramienta: true };
const DIESEL = { id: "i-diesel", nombre: "Diésel", unidad: "L", existencia: 400, costo_unit: 24.5 };
const SINCOSTO = { id: "i-x", nombre: "Hilo", unidad: "rollo", existencia: 10 };
const ANA = { tipo: "trabajador", id: "t-ana", nombre: "Ana" }, BETO = { tipo: "trabajador", id: "t-beto", nombre: "Beto" };
const P7 = { tipo: "parcela", id: "p7", nombre: "Parcela 7", actividad: "Fertilización" };
let n = 0; const az = () => (++n) / 1e6;
const da = (articulo, cantidad, mas = {}) => { const r = entregar({ articulo, cantidad, recibe: ANA, destino: P7, quien: ENC, cuando: c(), fecha: D, azar: az(), ...mas }); assert.ok(r.ok, r.dice); return r.evento; };
const lote = (evs, id) => estadoDelAlmacen(evs).lotes.find(l => l.id === id);
const cierra = (evs, id, articulo, que, mas = {}) => { const r = cerrar({ lote: lote(evs, id), articulo, quien: ENC, cuando: c("18:00"), fecha: D, azar: az(), ...que, ...mas }); assert.ok(r.ok, r.dice); return [...evs, ...r.eventos]; };

test("sacar_del_almacen_baja_la_existencia_pero_no_genera_ningun_costo", () => {
  const e = da(UREA, 10);
  const est = estadoDelAlmacen([e]);
  const x = existenciasDe(UREA, est);
  assert.equal(x.lugares[NAVE], 40); assert.equal(x.conAlguien, 10); assert.equal(x.quienes[0].recibe.nombre, "Ana");
  assert.equal(costoDeConsumos(est).total, 0, "entregar no es gastar");
  assert.deepEqual(actividadesDeAlmacen(est.consumos), []);
});

test("al_cerrar_se_dice_cuanto_se_uso_cuanto_regreso_y_cuanto_se_quedo_con_alguien", () => {
  const e = da(UREA, 10);
  let evs = cierra([e], e.id, UREA, { usado: 6, devuelto: 3, pasa: { cantidad: 1, recibe: BETO } });
  const est = estadoDelAlmacen(evs);
  const x = existenciasDe(UREA, est);
  assert.equal(x.lugares[NAVE], 43, "50 − 10 + 3 que regresaron");
  assert.equal(x.conAlguien, 1); assert.equal(x.quienes[0].recibe.nombre, "Beto", "el bulto que se quedó ya es responsabilidad de Beto");
  const costo = costoDeConsumos(est);
  assert.equal(costo.total, 5208); assert.equal(costo.aParcelas, 5208, "6 × $868, una sola vez");
  assert.equal(lote(evs, e.id).saldo, 0);
});

test("el_costo_llega_a_la_parcela_y_a_la_actividad_una_sola_vez_y_dice_de_donde_salio", () => {
  const e = da(UREA, 10); const evs = cierra([e], e.id, UREA, { usado: 6 });
  const [fila] = actividadesDeAlmacen(estadoDelAlmacen(evs).consumos);
  assert.equal(fila.parcelaId, "p7"); assert.equal(fila.tipo, "Fertilización"); assert.equal(fila.costoInsumos, 5208); assert.equal(fila.costoTotal, 5208);
  assert.deepEqual(fila._deEventos, [e.id, evs[1].id], "la entrega y el consumo");
  assert.equal(costoDeConsumos(estadoDelAlmacen([...evs, ...evs.map(x => ({ ...x }))])).total, 5208, "subido dos veces sigue siendo una vez");
});

test("lo_que_no_se_cierra_sigue_con_quien_lo_trae_no_se_da_por_gastado", () => {
  const e = da(UREA, 10, { fecha: "2026-11-17", cuando: c("08:00", "2026-11-17") });
  const p = porCerrar(estadoDelAlmacen([e]), { hoy: D });
  assert.equal(p.pendientes.length, 1); assert.equal(p.pendientes[0].dias, 2); assert.equal(p.deOtrosDias, 1);
  assert.equal(costoDeConsumos(estadoDelAlmacen([e])).total, 0);
  const rev = seQueda({ lote: p.pendientes[0], quien: ENC, cuando: c("18:00"), fecha: D }).evento;
  const p2 = porCerrar(estadoDelAlmacen([e, rev]), { hoy: D });
  assert.equal(p2.pendientes.length, 0); assert.equal(p2.yaRevisados.length, 1, "revisado hoy: sigue con ella, ya no es pendiente del día");
  assert.equal(porCerrar(estadoDelAlmacen([e, rev]), { hoy: "2026-11-20" }).pendientes.length, 1, "mañana vuelve a salir");
});

test("no_se_puede_cerrar_mas_de_lo_que_le_quedaba", () => {
  const e = da(UREA, 10);
  const r = cerrar({ lote: lote([e], e.id), articulo: UREA, usado: 8, devuelto: 5, quien: ENC, cuando: c("18:00"), fecha: D });
  assert.equal(r.ok, false); assert.match(r.dice, /Le quedaban 10/);
  assert.equal(cerrar({ lote: lote([e], e.id), articulo: UREA, quien: ENC, cuando: c("18:00"), fecha: D }).ok, false);
});

test("dos_aparatos_sin_senal_que_cierran_lo_mismo_no_consumen_mas_de_lo_entregado", () => {
  const e = da(UREA, 10);
  const uno = cerrar({ lote: lote([e], e.id), articulo: UREA, usado: 10, quien: ENC, cuando: c("18:00"), fecha: D, azar: az() }).eventos;
  const dos = cerrar({ lote: lote([e], e.id), articulo: UREA, usado: 10, quien: ADMIN, cuando: c("18:05"), fecha: D, azar: az() }).eventos;
  const est = estadoDelAlmacen([e, ...uno, ...dos]);
  assert.equal(costoDeConsumos(est).total, 8680, "10 bultos, no 20");
  assert.equal(est.huerfanos.length, 1, "y el segundo cierre queda señalado para revisar");
});

test("entregar_mas_de_lo_que_hay_no_se_bloquea_se_avisa_y_queda_en_negativo", () => {
  const r = entregar({ articulo: UREA, cantidad: 60, recibe: ANA, destino: P7, existencia: 50, quien: ENC, cuando: c(), fecha: D });
  assert.ok(r.ok); assert.match(r.avisos[0], /queda en -10/);
  assert.equal(existenciasDe(UREA, estadoDelAlmacen([r.evento])).lugares[NAVE], -10);
  assert.equal(entregar({ articulo: UREA, cantidad: 5, destino: P7, quien: ENC, cuando: c(), fecha: D }).ok, false, "sin responsable no se entrega");
  assert.equal(entregar({ articulo: UREA, cantidad: 5, recibe: ANA, destino: P7, quien: { id: "t", rol: "trabajador" }, cuando: c(), fecha: D }).ok, false);
});

test("una_herramienta_se_presta_y_se_devuelve_no_se_consume_y_si_se_pierde_es_baja_con_causa", () => {
  const e = da(PALA, 2, { destino: null });
  assert.ok(lote([e], e.id).herramienta);
  assert.equal(cerrar({ lote: lote([e], e.id), articulo: PALA, usado: 1, quien: ENC, cuando: c("18:00"), fecha: D }).ok, false);
  assert.equal(cerrar({ lote: lote([e], e.id), articulo: PALA, baja: { cantidad: 1 }, quien: ENC, cuando: c("18:00"), fecha: D }).ok, false, "baja sin causa no");
  const evs = cierra([e], e.id, PALA, { devuelto: 1, baja: { cantidad: 1, causa: "rota" } });
  const est = estadoDelAlmacen(evs);
  assert.equal(existenciasDe(PALA, est).lugares[NAVE], 5, "regresó una; la rota ya no está");
  assert.equal(lote(evs, e.id).baja, 1); assert.equal(loQueTrae(est).length, 0);
  assert.equal(porCerrar(estadoDelAlmacen([e]), { hoy: D }).herramientas[0].recibe.nombre, "Ana", "mientras no se cierre, se sabe quién la trae");
});

test("el_diesel_al_tanque_es_consumo_directo_y_se_le_carga_al_vehiculo_no_a_una_parcela", () => {
  const r = consumirDirecto({ articulo: DIESEL, cantidad: 60, destino: { tipo: "vehiculo", id: "m-camion", nombre: "Camión amarillo" }, quien: ENC, cuando: c(), fecha: D });
  assert.ok(r.ok);
  const est = estadoDelAlmacen([r.evento]); const costo = costoDeConsumos(est);
  assert.equal(existenciasDe(DIESEL, est).lugares[NAVE], 340); assert.equal(costo.aVehiculos, 1470); assert.equal(costo.aParcelas, 0);
  assert.deepEqual(actividadesDeAlmacen(est.consumos), [], "no se le cuelga a ninguna parcela");
  assert.equal(consumirDirecto({ articulo: DIESEL, cantidad: 60, quien: ENC, cuando: c(), fecha: D }).ok, false, "sin destino no hay a qué cargarlo");
  assert.equal(consumirDirecto({ articulo: PALA, cantidad: 1, destino: P7, quien: ENC, cuando: c(), fecha: D }).ok, false);
});

test("un_articulo_sin_costo_se_consume_pero_no_le_carga_nada_a_nadie_y_se_dice", () => {
  const e = da(SINCOSTO, 4);
  const r = cerrar({ lote: lote([e], e.id), articulo: SINCOSTO, usado: 4, quien: ENC, cuando: c("18:00"), fecha: D });
  assert.ok(r.ok); assert.match(r.avisos[0], /no tiene costo/);
  const costo = costoDeConsumos(estadoDelAlmacen([e, ...r.eventos]));
  assert.equal(costo.total, 0); assert.equal(costo.sinCosto.length, 1);
});

test("mover_entre_almacenes_no_cambia_el_total_ni_genera_costo", () => {
  const t = transferir({ articulo: UREA, cantidad: 20, de: NAVE, a: "Rancho 2", quien: ENC, cuando: c(), fecha: D }).evento;
  const x = existenciasDe(UREA, estadoDelAlmacen([t]));
  assert.deepEqual(x.lugares, { [NAVE]: 30, "Rancho 2": 20 }); assert.equal(x.enAlmacenes, 50);
  assert.equal(transferir({ articulo: UREA, cantidad: 20, de: NAVE, a: NAVE, quien: ENC, cuando: c(), fecha: D }).ok, false);
});

test("un_ajuste_lleva_causa_y_no_se_sabe_es_una_causa_valida", () => {
  assert.equal(ajustar({ articulo: UREA, contado: 47, existencia: 50, quien: ADMIN, cuando: c(), fecha: D }).ok, false);
  assert.equal(ajustar({ articulo: UREA, contado: 47, existencia: 50, causa: "no_se_sabe", quien: ENC, cuando: c(), fecha: D }).ok, false, "sólo un administrador ajusta");
  assert.equal(ajustar({ articulo: UREA, contado: 50, existencia: 50, causa: "conteo", quien: ADMIN, cuando: c(), fecha: D }).ok, false);
  const a = ajustar({ articulo: UREA, contado: 47, existencia: 50, causa: "no_se_sabe", quien: ADMIN, cuando: c(), fecha: D });
  assert.ok(a.ok); assert.equal(a.evento.datos.delta, -3); assert.equal(a.evento.datos.habia, 50);
  assert.equal(existenciasDe(UREA, estadoDelAlmacen([a.evento])).lugares[NAVE], 47);
});

test("cancelar_una_entrega_equivocada_regresa_la_existencia_y_deja_sus_cierres_señalados", () => {
  const e = da(UREA, 10); const evs = cierra([e], e.id, UREA, { usado: 4 });
  const can = cancelarEvento(e, { motivo: "era otro artículo", quien: ENC, cuando: c("19:00") }).evento;
  const est = estadoDelAlmacen([can, ...evs.slice(1)]);
  assert.equal(existenciasDe(UREA, est).lugares[NAVE], 50); assert.equal(costoDeConsumos(est).total, 0);
  assert.equal(est.huerfanos.length, 1, "el consumo de esa entrega ya no cuenta, y se avisa");
});

test("el_qr_de_un_articulo_solo_trae_su_identificador", () => {
  assert.equal(textoDeArticulo(UREA), "AGRO1:A:i-urea");
  assert.equal(leerArticulo("AGRO1:A:i-urea", [UREA]).articulo.nombre, "Urea");
  assert.equal(leerArticulo("AGRO1:T:t-ana:ABC", [UREA]).ok, false, "la credencial de una persona no es un artículo");
  assert.equal(leerArticulo("AGRO1:A:otro", [UREA]).ok, false);
});

import { conExistenciaReal, paraGuardarArticulo } from "./movimientos.js";
test("las_pantallas_de_siempre_ven_la_existencia_real_y_al_guardar_no_se_cuenta_dos_veces", () => {
  const e = da(UREA, 10); const est = estadoDelAlmacen([e]);
  const [visto] = conExistenciaReal([UREA], est);
  assert.equal(visto.existencia, 40); assert.equal(visto._conAlguien, 10);
  // Una compra de antes le suma 20 a lo que ve en pantalla y guarda:
  const guardado = paraGuardarArticulo({ ...visto, existencia: visto.existencia + 20 });
  assert.equal(guardado.existencia, 70, "50 + 20 en el catálogo"); assert.equal(guardado._movido, undefined);
  assert.equal(conExistenciaReal([guardado], est)[0].existencia, 60, "y en pantalla 60: los 10 entregados se restan una vez");
  // Un conteo fija lo contado:
  assert.equal(conExistenciaReal([paraGuardarArticulo({ ...visto, existencia: 38 })], est)[0].existencia, 38);
  assert.equal(conExistenciaReal([PALA], est)[0], PALA, "lo que no se ha movido queda igual");
});
