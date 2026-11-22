import { test } from "node:test";
import assert from "node:assert/strict";
import { cancelarEvento } from "./eventos.js";
import { entrada, entregar, cerrar, seQueda, consumirDirecto, transferir, merma, contar, resolver, movimientoDeSiempre, estadoDelAlmacen, existenciasDe, loQueTrae, porCerrar, avisosPara, porRevisar,
  costoDeConsumos, actividadesDeAlmacen, resumenDeAjustes, salidasParaPrediccion, conExistenciaReal, paraGuardarArticulo, textoDeArticulo, leerArticulo, instanteDe, NAVE } from "./movimientos.js";

const ENC = { id: "enc1", nombre: "Encargado", rol: "encargado" }, ADMIN = { id: "u1", nombre: "Luis", rol: "admin" };
const D = "2026-11-19", c = (h = "08:00", dia = D) => `${dia}T${h}:00-06:00`;
const UREA = { id: "i-urea", nombre: "Urea", unidad: "bulto", existencia: 50, costo_unit: 868 };
const PALA = { id: "i-pala", nombre: "Pala", unidad: "pieza", existencia: 6, costo_unit: 320, esHerramienta: true };
const DIESEL = { id: "i-diesel", nombre: "Diésel", unidad: "L", existencia: 400, costo_unit: 24.5 };
const SINCOSTO = { id: "i-x", nombre: "Hilo", unidad: "rollo", existencia: 10 };
const INV = [UREA, PALA, DIESEL, SINCOSTO];
const ANA = { tipo: "trabajador", id: "t-ana", nombre: "Ana" }, BETO = { tipo: "trabajador", id: "t-beto", nombre: "Beto" };
const QANA = { id: "t-ana", nombre: "Ana", rol: "trabajador" };
const P7 = { tipo: "parcela", id: "p7", nombre: "Parcela 7", actividad: "Fertilización" };
let n = 0; const az = () => (++n) / 1e6;
const est = (evs, inv = INV) => estadoDelAlmacen(evs, inv);
const nave = (evs, art = UREA, inv = INV) => existenciasDe(art, est(evs, inv)).lugares[NAVE];
const da = (articulo, cantidad, mas = {}) => { const r = entregar({ articulo, cantidad, recibe: ANA, destino: P7, quien: ENC, cuando: c(), fecha: D, azar: az(), ...mas }); assert.ok(r.ok, r.dice); return r.evento; };
const lote = (evs, id) => est(evs).lotes.find(l => l.id === id);
const cierra = (evs, id, articulo, que, mas = {}) => { const r = cerrar({ lote: lote(evs, id), articulo, quien: ENC, cuando: c("18:00"), fecha: D, azar: az(), ...que, ...mas }); assert.ok(r.ok, r.dice); return [...evs, ...r.eventos]; };
const usoEnActividad = (cantidad, hora = "12:00", mas = {}) => movimientoDeSiempre({ articulo: UREA, delta: -cantidad, movimiento: { parcelaId: "p7", concepto: "Fertilización" }, quien: QANA, cuando: c(hora), fecha: D, azar: az(), ...mas });
const revuelve = (evs) => [...evs].reverse();

// ── Entregar no es gastar ─────────────────────────────────────────────────
test("sacar_del_almacen_baja_la_existencia_pero_no_genera_ningun_costo", () => {
  const e = da(UREA, 10); const s = est([e]); const x = existenciasDe(UREA, s);
  assert.equal(x.lugares[NAVE], 40); assert.equal(x.conAlguien, 10); assert.equal(x.quienes[0].recibe.nombre, "Ana");
  assert.equal(costoDeConsumos(s).total, 0, "entregar no es gastar"); assert.deepEqual(actividadesDeAlmacen(s.consumos), []);
});

test("al_cerrar_se_dice_cuanto_se_uso_cuanto_regreso_y_cuanto_se_quedo_con_alguien", () => {
  const e = da(UREA, 10);
  const evs = cierra([e], e.id, UREA, { usado: 6, devuelto: 3, pasa: { cantidad: 1, recibe: BETO } });
  const s = est(evs); const x = existenciasDe(UREA, s);
  assert.equal(x.lugares[NAVE], 43, "50 − 10 + 3 que regresaron");
  assert.equal(x.conAlguien, 1); assert.equal(x.quienes[0].recibe.nombre, "Beto");
  assert.equal(costoDeConsumos(s).aParcelas, 5208, "6 × $868, una sola vez");
  const [fila] = actividadesDeAlmacen(s.consumos);
  assert.equal(fila.parcelaId, "p7"); assert.equal(fila.tipo, "Fertilización"); assert.deepEqual(fila._deEventos, [e.id, evs[1].id]);
});

test("no_se_puede_cerrar_mas_de_lo_que_le_quedaba", () => {
  const e = da(UREA, 10);
  const r = cerrar({ lote: lote([e], e.id), articulo: UREA, usado: 8, devuelto: 5, quien: ENC, cuando: c("18:00"), fecha: D });
  assert.equal(r.ok, false); assert.match(r.dice, /Le quedaban 10/);
});

test("el_diesel_al_tanque_es_consumo_directo_y_se_le_carga_al_vehiculo_no_a_una_parcela", () => {
  const r = consumirDirecto({ articulo: DIESEL, cantidad: 60, destino: { tipo: "vehiculo", id: "m-camion", nombre: "Camión amarillo" }, quien: ENC, cuando: c(), fecha: D });
  const s = est([r.evento]); const costo = costoDeConsumos(s);
  assert.equal(existenciasDe(DIESEL, s).lugares[NAVE], 340); assert.equal(costo.aVehiculos, 1470); assert.equal(costo.aParcelas, 0);
  assert.deepEqual(actividadesDeAlmacen(s.consumos), []);
  assert.equal(consumirDirecto({ articulo: DIESEL, cantidad: 60, quien: ENC, cuando: c(), fecha: D }).ok, false);
});

test("un_articulo_sin_costo_se_consume_pero_no_le_carga_nada_a_nadie_y_se_dice", () => {
  const e = da(SINCOSTO, 4);
  const r = cerrar({ lote: lote([e], e.id), articulo: SINCOSTO, usado: 4, quien: ENC, cuando: c("18:00"), fecha: D });
  assert.match(r.avisos[0], /no tiene costo/);
  const costo = costoDeConsumos(est([e, ...r.eventos])); assert.equal(costo.total, 0); assert.equal(costo.sinCosto.length, 1);
});

// ── La existencia se calcula: dos aparatos sin señal no se pisan ──────────
test("dos_aparatos_sin_senal_sobre_el_mismo_articulo_dan_lo_mismo_suban_en_el_orden_que_suban", () => {
  // Aparato A (bodega): entra una compra de 40 y se entregan 10. Aparato B (campo): se usan 5 directo y se mueven 20 a otra bodega.
  const a1 = entrada({ articulo: UREA, cantidad: 40, costoUnit: 940, quien: ADMIN, cuando: c("09:00"), fecha: D, azar: az() }).evento;
  const a2 = da(UREA, 10, { cuando: c("09:30") });
  const b1 = consumirDirecto({ articulo: UREA, cantidad: 5, destino: P7, quien: ENC, cuando: c("09:10"), fecha: D, azar: az() }).evento;
  const b2 = transferir({ articulo: UREA, cantidad: 20, de: NAVE, a: "Rancho 2", quien: ENC, cuando: c("09:40"), fecha: D, azar: az() }).evento;
  const ordenes = [[a1, a2, b1, b2], [b1, b2, a1, a2], [b2, a2, b1, a1], [a2, b2, a1, b1]];
  for (const o of ordenes) {
    const x = existenciasDe(UREA, est(o));
    assert.deepEqual(x.lugares, { [NAVE]: 55, "Rancho 2": 20 }, "50 + 40 − 10 − 5 − 20"); assert.equal(x.conAlguien, 10);
  }
});

test("un_movimiento_que_sube_dos_veces_cuenta_una", () => {
  const e = entrada({ articulo: UREA, cantidad: 40, quien: ADMIN, cuando: c(), fecha: D, azar: az() }).evento;
  const r = da(UREA, 10);
  assert.equal(nave([e, r, { ...e }, { ...r }, { ...e }]), 80);
});

test("el_catalogo_no_es_por_donde_se_mueve_el_inventario_guardar_un_articulo_no_cambia_su_existencia", () => {
  const e = da(UREA, 10); const s = est([e]);
  const [visto] = conExistenciaReal([UREA], s);
  assert.equal(visto.existencia, 40); assert.equal(visto._conAlguien, 10);
  const guardado = paraGuardarArticulo({ ...visto, existencia: 999, minimo: 5 }, UREA);
  assert.equal(guardado.existencia, 50, "queda lo que ya estaba guardado: el punto de partida"); assert.equal(guardado.minimo, 5); assert.equal(guardado._movido, undefined);
  assert.equal(conExistenciaReal([PALA], s)[0], PALA, "lo que no se ha movido queda igual");
});

test("lo_que_las_pantallas_de_siempre_sumaban_o_restaban_ahora_es_un_movimiento", () => {
  const mas = movimientoDeSiempre({ articulo: UREA, delta: 12, movimiento: { concepto: "Compra" }, quien: ADMIN, cuando: c(), fecha: D, azar: az() });
  const menos = movimientoDeSiempre({ articulo: UREA, delta: -3, movimiento: { parcelaId: "p7" }, quien: QANA, cuando: c("10:00"), fecha: D, azar: az() });
  assert.equal(mas.tipo, "alm_entrada"); assert.equal(menos.tipo, "alm_consumo"); assert.equal(menos.datos.via, "actividad"); assert.equal(menos.datos.costoUnit, undefined, "su costo ya va en la actividad");
  assert.equal(nave([mas, menos]), 59);
  assert.equal(movimientoDeSiempre({ articulo: UREA, delta: 0, quien: ADMIN, cuando: c(), fecha: D }), null);
  assert.equal(instanteDe("2026-11-17", D, c("09:00")), "2026-11-17T18:00:00.000Z", "lo de un día anterior pasó ese día, no hoy");
});

// ── El conteo dice "había tanto", no "súmale" ─────────────────────────────
test("dos_personas_que_cuentan_lo_mismo_sin_señal_no_ajustan_dos_veces", () => {
  const k = (quien, hora) => contar({ articulo: UREA, contado: 47, existencia: 50, causa: "no_se_sabe", quien, cuando: c(hora), fecha: D, azar: az() }).evento;
  const uno = k(ENC, "10:00"), dos = k(ADMIN, "10:05");
  assert.equal(nave([uno, dos]), 47, "47, no 44"); assert.equal(nave([dos, uno]), 47);
  const s = est([uno, dos]);
  assert.equal(s.ajustes.length, 1, "la diferencia se registra una vez: el segundo conteo ya cuadra"); assert.equal(s.ajustes[0].diferencia, -3);
});

test("un_conteo_que_no_cuadra_lleva_causa_y_no_se_sabe_es_una_causa_valida", () => {
  assert.equal(contar({ articulo: UREA, contado: 47, existencia: 50, quien: ADMIN, cuando: c(), fecha: D }).ok, false);
  assert.equal(contar({ articulo: UREA, contado: 47, existencia: 50, causa: "no_se_sabe", quien: QANA, cuando: c(), fecha: D }).ok, false);
  const cuadra = contar({ articulo: UREA, contado: 50, existencia: 50, quien: ENC, cuando: c(), fecha: D });
  assert.ok(cuadra.ok, "un conteo que cuadra también se registra: es la prueba de que se contó"); assert.equal(est([cuadra.evento]).ajustes.length, 0); assert.equal(est([cuadra.evento]).conteos.length, 1);
});

test("un_movimiento_de_otro_aparato_que_llega_despues_recalcula_la_diferencia_del_conteo_y_se_avisa", () => {
  // A las 10 se cuentan 37 y la pantalla decía 50 (faltaban 13). Pero a las 9 otro aparato, sin señal, había entregado 10.
  const k = contar({ articulo: UREA, contado: 37, existencia: 50, causa: "robo", quien: ADMIN, cuando: c("10:00"), fecha: D, azar: az() }).evento;
  assert.equal(est([k]).ajustes[0].diferencia, -13);
  const e = da(UREA, 10, { cuando: c("09:00") });
  const s = est([k, e]);
  assert.equal(nave([k, e]), 37, "lo contado sigue siendo lo que hay"); assert.equal(s.ajustes[0].diferencia, -3, "faltaban 3, no 13: los otros 10 los trae Ana");
  assert.equal(porRevisar(s).pendientes.filter(p => p.clase === "conteo_cambio").length, 1);
});

test("dos_conteos_distintos_el_mismo_dia_se_señalan_y_vale_el_ultimo", () => {
  const a = contar({ articulo: UREA, contado: 47, existencia: 50, causa: "no_se_sabe", quien: ENC, cuando: c("10:00"), fecha: D, azar: az() }).evento;
  const b = contar({ articulo: UREA, contado: 49, existencia: 50, causa: "conteo", quien: ADMIN, cuando: c("11:00"), fecha: D, azar: az() }).evento;
  assert.equal(nave([b, a]), 49); assert.equal(porRevisar(est([a, b])).pendientes.filter(p => p.clase === "conteos_distintos").length, 1);
});

test("el_conteo_es_por_bodega", () => {
  const t = transferir({ articulo: UREA, cantidad: 20, de: NAVE, a: "Rancho 2", quien: ENC, cuando: c("09:00"), fecha: D, azar: az() }).evento;
  const k = contar({ articulo: UREA, lugar: "Rancho 2", contado: 18, existencia: 20, causa: "merma", quien: ENC, cuando: c("10:00"), fecha: D, azar: az() }).evento;
  assert.deepEqual(existenciasDe(UREA, est([t, k])).lugares, { [NAVE]: 30, "Rancho 2": 18 });
  assert.equal(est([t, k]).ajustes[0].lugar, "Rancho 2");
});

test("una_merma_lleva_causa_y_se_valua_aparte_la_que_nadie_sabe", () => {
  assert.equal(merma({ articulo: UREA, cantidad: 2, quien: ENC, cuando: c(), fecha: D }).ok, false);
  const m = merma({ articulo: UREA, cantidad: 2, causa: "merma", quien: ENC, cuando: c(), fecha: D, azar: az() }).evento;
  const k = contar({ articulo: UREA, contado: 45, existencia: 48, causa: "no_se_sabe", quien: ADMIN, cuando: c("10:00"), fecha: D, azar: az() }).evento;
  const r = resumenDeAjustes(est([m, k]), INV);
  assert.equal(r.porCausa.merma, 1736); assert.equal(r.sinSaber, 2604); assert.equal(r.faltante, 4340);
});

// ── Una sola fuente para cada cantidad consumida ──────────────────────────
test("lo_que_el_trabajador_reporta_en_su_actividad_sale_de_lo_que_el_trae_no_otra_vez_del_almacen", () => {
  const e = da(UREA, 10); const u = usoEnActividad(6);
  const s = est([e, u]);
  assert.equal(existenciasDe(UREA, s).lugares[NAVE], 40, "el almacén no baja otra vez"); assert.equal(lote([e, u], e.id).saldo, 4);
  assert.equal(costoDeConsumos(s).total, 0, "el costo de esos 6 va en la actividad, no aquí"); assert.deepEqual(actividadesDeAlmacen(s.consumos), []);
});

test("si_el_encargado_cierra_sin_haber_visto_el_reporte_del_trabajador_lo_mismo_cuenta_una_vez", () => {
  // Sin señal: Ana reporta en su teléfono que usó 6. El encargado, en el suyo, ve 10 pendientes y cierra "usó 6, regresó 4".
  const e = da(UREA, 10); const u = usoEnActividad(6);
  const cierre = cerrar({ lote: lote([e], e.id), articulo: UREA, usado: 6, devuelto: 4, quien: ENC, cuando: c("18:00"), fecha: D, azar: az() }).eventos;
  for (const orden of [[e, u, ...cierre], [...cierre, u, e], [u, ...revuelve(cierre), e]]) {
    const s = est(orden);
    assert.equal(existenciasDe(UREA, s).lugares[NAVE], 44, "50 − 10 + 4"); assert.equal(s.lotes.find(l => l.id === e.id).saldo, 0);
    assert.equal(costoDeConsumos(s).total, 0, "los 6 cuentan una vez: en la actividad");
    assert.equal(s.empalmes.length, 1); assert.equal(s.empalmes[0].cantidad, 6); assert.equal(s.huerfanos.length, 0);
  }
});

test("si_el_encargado_si_vio_el_reporte_lo_que_cierra_es_aparte", () => {
  const e = da(UREA, 10); const u = usoEnActividad(6);
  const visto = lote([e, u], e.id); assert.equal(visto.usadoAct, 6);
  const cierre = cerrar({ lote: visto, articulo: UREA, usado: 2, devuelto: 2, quien: ENC, cuando: c("18:00"), fecha: D, azar: az() }).eventos;
  const s = est([e, u, ...cierre]);
  assert.equal(costoDeConsumos(s).total, 1736, "2 bultos más, a $868"); assert.equal(s.empalmes.length, 0); assert.equal(s.lotes.find(l => l.id === e.id).saldo, 0);
});

test("si_el_reporte_del_trabajador_llega_despues_de_que_ya_se_cerro_tambien_cuenta_una_vez", () => {
  const e = da(UREA, 10);
  const cierre = cerrar({ lote: lote([e], e.id), articulo: UREA, usado: 6, devuelto: 4, quien: ENC, cuando: c("18:00"), fecha: D, azar: az() }).eventos;
  const tarde = usoEnActividad(6, "19:00");
  const s = est([tarde, e, ...cierre]);
  assert.equal(existenciasDe(UREA, s).lugares[NAVE], 44, "no salen otros 6 del almacén"); assert.equal(costoDeConsumos(s).total, 0, "y el costo no va dos veces: queda en la actividad");
  assert.equal(s.empalmes.length, 1);
});

test("quien_no_trae_nada_del_almacen_y_reporta_un_insumo_lo_saca_directo", () => {
  const u = usoEnActividad(3); const s = est([u]);
  assert.equal(existenciasDe(UREA, s).lugares[NAVE], 47); assert.equal(s.consumos[0].enActividad, true);
});

test("dos_aparatos_sin_senal_que_cierran_lo_mismo_no_consumen_mas_de_lo_entregado", () => {
  const e = da(UREA, 10);
  const uno = cerrar({ lote: lote([e], e.id), articulo: UREA, usado: 10, quien: ENC, cuando: c("18:00"), fecha: D, azar: az() }).eventos;
  const dos = cerrar({ lote: lote([e], e.id), articulo: UREA, usado: 10, quien: ADMIN, cuando: c("18:05"), fecha: D, azar: az() }).eventos;
  const s = est([...dos, e, ...uno]);
  assert.equal(costoDeConsumos(s).total, 8680, "10 bultos, no 20");
  const p = porRevisar(s); assert.equal(p.pendientes.length, 1); assert.match(p.pendientes[0].dice, /dos personas cerraron la misma entrega/);
});

// ── Existencias que no alcanzan ───────────────────────────────────────────
test("entregar_mas_de_lo_que_hay_se_registra_y_deja_una_discrepancia_pendiente", () => {
  const r = entregar({ articulo: UREA, cantidad: 60, recibe: ANA, destino: P7, existencia: 50, quien: ENC, cuando: c(), fecha: D, azar: az() });
  assert.ok(r.ok); assert.match(r.avisos[0], /discrepancia pendiente/);
  const s = est([r.evento]);
  assert.equal(existenciasDe(UREA, s).lugares[NAVE], -10, "no se disfraza de cero");
  const p = porRevisar(s); assert.equal(p.pendientes.length, 1); assert.equal(p.pendientes[0].faltaban, 10); assert.equal(p.negativos.length, 1);
  assert.equal(resolver({ evId: r.evento.id, texto: "", quien: ADMIN, cuando: c("12:00"), fecha: D }).ok, false);
  assert.equal(resolver({ evId: r.evento.id, texto: "x", quien: ENC, cuando: c("12:00"), fecha: D }).ok, false, "la revisa un administrador");
  const res = resolver({ evId: r.evento.id, texto: "Llegó un pedido el lunes que no se capturó; se va a capturar con su factura.", quien: ADMIN, cuando: c("12:00"), fecha: D, azar: az() }).evento;
  const s2 = est([r.evento, res]); const p2 = porRevisar(s2);
  assert.equal(p2.pendientes.length, 0); assert.equal(p2.resueltas.length, 1); assert.equal(p2.resueltas[0].resuelta.por, "Luis");
  assert.equal(existenciasDe(UREA, s2).lugares[NAVE], -10, "explicarlo no inventa mercancía: el número sigue igual");
});

test("si_despues_llega_la_compra_que_faltaba_capturar_la_discrepancia_se_va_sola", () => {
  const r = entregar({ articulo: UREA, cantidad: 60, recibe: ANA, destino: P7, quien: ENC, cuando: c("10:00"), fecha: D, azar: az() }).evento;
  const compra = entrada({ articulo: UREA, cantidad: 40, quien: ADMIN, cuando: instanteDe("2026-11-17", D, c("15:00")), fecha: "2026-11-17", capturado: c("15:00"), azar: az() }).evento;
  const s = est([r, compra]);
  assert.equal(porRevisar(s).pendientes.length, 0); assert.equal(existenciasDe(UREA, s).lugares[NAVE], 30);
});

// ── Plazos de lo entregado ────────────────────────────────────────────────
test("material_de_consumo_avisa_a_las_24_horas_y_escala_a_las_72", () => {
  const e = da(UREA, 10);
  const ver = (dia, hora) => porCerrar(est([e]), { hoy: dia, ahora: c(hora, dia) }).abiertos[0].nivel;
  assert.equal(ver(D, "18:00"), "hoy"); assert.equal(ver("2026-11-20", "07:00"), "hoy", "todavía no son 24 horas");
  assert.equal(ver("2026-11-20", "09:00"), "aviso"); assert.equal(ver("2026-11-22", "09:00"), "escalado");
  assert.equal(porCerrar(est([e]), { hoy: "2026-11-20", ahora: c("09:00", "2026-11-20"), plazos: { aviso_h: 48 } }).abiertos[0].nivel, "hoy", "los plazos se cambian");
});

test("una_herramienta_tiene_plazos_largos", () => {
  const e = da(PALA, 1, { destino: null });
  const ver = (dia) => porCerrar(est([e]), { hoy: dia, ahora: c("09:00", dia) }).abiertos[0].nivel;
  assert.equal(ver("2026-11-22"), "hoy"); assert.equal(ver("2026-11-27"), "aviso"); assert.equal(ver("2026-12-05"), "escalado");
});

test("sigue_con_el_hasta_tal_fecha_no_es_consumo_ni_devolucion_y_deja_de_avisar_hasta_ese_dia", () => {
  const e = da(UREA, 10);
  assert.equal(seQueda({ lote: lote([e], e.id), proxima: "2026-11-18", quien: ENC, cuando: c("18:00"), fecha: D }).ok, false);
  const rev = seQueda({ lote: lote([e], e.id), proxima: "2026-11-25", quien: ENC, cuando: c("18:00"), fecha: D, azar: az() }).evento;
  const s = est([e, rev]);
  assert.equal(lote([e, rev], e.id).saldo, 10); assert.equal(costoDeConsumos(s).total, 0); assert.equal(existenciasDe(UREA, s).lugares[NAVE], 40);
  const el23 = porCerrar(s, { hoy: "2026-11-23", ahora: c("09:00", "2026-11-23") });
  assert.equal(el23.abiertos[0].nivel, "en_uso"); assert.equal(el23.pendientes.length, 0);
  const el25 = porCerrar(s, { hoy: "2026-11-25", ahora: c("09:00", "2026-11-25") });
  assert.equal(el25.pendientes.length, 1, "llegó la fecha: se vuelve a preguntar");
  const alEntregar = da(UREA, 5, { revisarEl: "2026-11-30" });
  assert.equal(porCerrar(est([alEntregar]), { hoy: "2026-11-24", ahora: c("09:00", "2026-11-24") }).abiertos[0].nivel, "en_uso", "también se puede decir desde la entrega");
});

test("el_aviso_le_llega_al_que_lo_trae_y_al_encargado_y_al_administrador_cuando_escala", () => {
  const e = da(UREA, 10);
  const a24 = porCerrar(est([e]), { hoy: "2026-11-20", ahora: c("09:00", "2026-11-20") });
  assert.equal(avisosPara(a24, QANA).lista.length, 1); assert.equal(avisosPara(a24, ENC).lista.length, 1); assert.equal(avisosPara(a24, ADMIN).lista.length, 0);
  assert.equal(avisosPara(a24, { id: "t-beto", rol: "trabajador" }).lista.length, 0, "a Beto no: no es suyo");
  const a72 = porCerrar(est([e]), { hoy: "2026-11-22", ahora: c("09:00", "2026-11-22") });
  assert.equal(avisosPara(a72, ADMIN).lista.length, 1);
});

// ── Herramientas ──────────────────────────────────────────────────────────
test("una_herramienta_rota_o_perdida_es_una_baja_con_responsable_causa_y_valor_y_no_es_un_descuento", () => {
  const e = da(PALA, 2, { destino: null });
  const L = () => lote([e], e.id);
  assert.equal(cerrar({ lote: L(), articulo: PALA, usado: 1, quien: ENC, cuando: c("18:00"), fecha: D }).ok, false, "una herramienta no se consume");
  assert.equal(cerrar({ lote: L(), articulo: PALA, baja: { cantidad: 1 }, quien: ENC, cuando: c("18:00"), fecha: D }).ok, false, "sin causa no");
  assert.equal(cerrar({ lote: L(), articulo: PALA, baja: { cantidad: 1, causa: "otro" }, quien: ENC, cuando: c("18:00"), fecha: D }).ok, false, "otro caso pide decir cuál");
  const evs = cierra([e], e.id, PALA, { devuelto: 1, baja: { cantidad: 1, causa: "accidente", nota: "se quebró el mango", evidencia: "archivo:abc.jpg" } });
  const s = est(evs); const [b] = s.bajas;
  assert.equal(existenciasDe(PALA, s).lugares[NAVE], 5); assert.equal(loQueTrae(s).length, 0);
  assert.equal(b.responsable, "Ana"); assert.equal(b.causa, "accidente"); assert.equal(b.valor, 320); assert.equal(b.evidencia, "archivo:abc.jpg"); assert.equal(b.fecha, D);
  assert.equal(b.resuelta, null, "lo que pase con el trabajador es otra operación, y todavía nadie la ha decidido");
  assert.ok(!evs.some(x => /descuento|egreso|pago/.test(x.tipo)), "la baja no genera ningún cargo");
  const res = resolver({ evId: b.ev, texto: "Accidente de trabajo. Sin responsabilidad para la trabajadora.", quien: ADMIN, cuando: c("19:00"), fecha: D, azar: az() }).evento;
  assert.equal(est([...evs, res]).bajas[0].resuelta.por, "Luis");
});

// ── Lo demás ──────────────────────────────────────────────────────────────
test("cancelar_una_entrega_equivocada_regresa_la_existencia_y_deja_sus_cierres_señalados", () => {
  const e = da(UREA, 10); const evs = cierra([e], e.id, UREA, { usado: 4 });
  const can = cancelarEvento(e, { motivo: "era otro artículo", quien: ENC, cuando: c("19:00") }).evento;
  const s = est([can, ...evs.slice(1)]);
  assert.equal(existenciasDe(UREA, s).lugares[NAVE], 50); assert.equal(costoDeConsumos(s).total, 0); assert.equal(s.huerfanos.length, 1);
});

test("el_aviso_de_cuando_se_acaba_ve_las_salidas_nuevas", () => {
  const e = da(UREA, 10); const evs = cierra([e], e.id, UREA, { usado: 6, devuelto: 4 });
  const d = consumirDirecto({ articulo: DIESEL, cantidad: 60, destino: P7, quien: ENC, cuando: c(), fecha: D, azar: az() }).evento;
  const pala = da(PALA, 1, { destino: null });
  const s = salidasParaPrediccion(est([...evs, d, pala]));
  assert.deepEqual(s.map(m => [m.insumoId, m.cantidad]).sort(), [["i-diesel", -60], ["i-urea", -6]], "lo que regresó no es salida, y una herramienta prestada tampoco");
});

test("el_qr_de_un_articulo_solo_trae_su_identificador", () => {
  assert.equal(textoDeArticulo(UREA), "AGRO1:A:i-urea");
  assert.equal(leerArticulo("AGRO1:A:i-urea", [UREA]).articulo.nombre, "Urea");
  assert.equal(leerArticulo("AGRO1:T:t-ana:ABC", [UREA]).ok, false);
});

// ── A · El costo promedio no depende de qué teléfono subió al último ──────
import { ajustesDeValuacion, fijarCosto, momentoDe } from "./movimientos.js";
const SIN = { id: "i-n", nombre: "Sulfato", unidad: "bulto", existencia: 0 };
const compra = (q, cu, hora, mas = {}) => entrada({ articulo: SIN, cantidad: q, costoUnit: cu, quien: ADMIN, cuando: c(hora), fecha: D, azar: az(), ...mas }).evento;
const costoHoy = (evs) => conExistenciaReal([SIN], estadoDelAlmacen(evs, [SIN]))[0].costo_unit;

test("dos_compras_del_mismo_articulo_en_dos_telefonos_dan_el_mismo_promedio_suban_como_suban", () => {
  const marzo = compra(10, 580, "09:00"), agosto = compra(40, 940, "10:00");
  for (const orden of [[marzo, agosto], [agosto, marzo], [agosto, marzo, { ...agosto }]]) assert.equal(costoHoy(orden), 868, "10 a $580 y 40 a $940 son 50 a $868");
  assert.equal(estadoDelAlmacen([marzo, agosto], [SIN]).compras.length, 2, "cada compra conserva su cantidad, su precio y su fecha");
  const cat = paraGuardarArticulo({ ...conExistenciaReal([SIN], estadoDelAlmacen([marzo, agosto], [SIN]))[0], minimo: 3 }, SIN);
  assert.equal(cat.costo_unit, 0, "y el catálogo guardado no se toca: el promedio se calcula"); assert.equal(cat.minimo, 3);
});

test("una_compra_posterior_que_llega_tarde_no_toca_lo_que_ya_se_consumio", () => {
  const marzo = compra(10, 580, "09:00");
  const uso = consumirDirecto({ articulo: { ...SIN, costo_unit: 580 }, cantidad: 4, destino: P7, quien: ENC, cuando: c("10:00"), fecha: D, azar: az() }).evento;
  const despues = compra(40, 940, "15:00");
  const s = estadoDelAlmacen([despues, uso, marzo], [SIN]);
  assert.equal(costoDeConsumos(s).total, 2320, "4 × $580: lo que costaba cuando se usó"); assert.equal(ajustesDeValuacion(s).lista.length, 0, "la compra fue después del consumo: no hay nada que ajustar");
  assert.equal(conExistenciaReal([SIN], s)[0].costo_unit, (6 * 580 + 40 * 940) / 46, "y el promedio de ahora sale de lo que quedaba");
});

test("una_compra_anterior_capturada_tarde_no_altera_el_costo_original_y_deja_el_ajuste_a_la_vista", () => {
  // En el almacén hay 10 a $580. A las 10 se usan 4 (se capturan a $580). Pero a las 9 había entrado una compra de 40 a $940
  // en otro teléfono sin señal, que se capturó en la tarde.
  const marzo = compra(10, 580, "08:00");
  const uso = consumirDirecto({ articulo: { ...SIN, costo_unit: 580 }, cantidad: 4, destino: P7, quien: ENC, cuando: c("10:00"), fecha: D, azar: az() }).evento;
  const tardia = compra(40, 940, "09:00", { capturado: c("17:00") });
  for (const orden of [[marzo, uso, tardia], [tardia, uso, marzo]]) {
    const s = estadoDelAlmacen(orden, [SIN]);
    assert.equal(costoDeConsumos(s).total, 2320, "el costo original NO se altera: sigue en 4 × $580");
    const a = ajustesDeValuacion(s);
    assert.equal(a.lista.length, 1); assert.equal(a.lista[0].original, 2320); assert.equal(a.lista[0].recalculado, 3472, "con la compra de las 9, ese día costaba $868"); assert.equal(a.total, 1152);
    assert.deepEqual(a.lista[0].compras, [tardia.id], "y dice qué compra lo causó"); assert.match(a.lista[0].porque, /compra del 2026-11-19, anterior a este consumo/);
  }
});

test("lo_que_se_consumio_sin_costo_y_despues_se_supo_queda_como_ajuste_no_se_rellena_solo", () => {
  const uso = consumirDirecto({ articulo: SIN, cantidad: 4, destino: P7, quien: ENC, cuando: c("10:00"), fecha: D, azar: az() }).evento;
  const tardia = compra(40, 940, "09:00", { capturado: c("17:00") });
  const s = estadoDelAlmacen([uso, tardia], [SIN]);
  assert.equal(costoDeConsumos(s).total, 0); assert.equal(costoDeConsumos(s).sinCosto.length, 1, "sigue diciendo que se capturó sin costo");
  const [a] = ajustesDeValuacion(s).lista; assert.equal(a.original, null); assert.equal(a.recalculado, 3760); assert.match(a.porque, /no tenía costo/);
});

test("corregir_el_costo_a_mano_vale_de_ahi_en_adelante", () => {
  const marzo = compra(10, 580, "08:00");
  const uso = consumirDirecto({ articulo: { ...SIN, costo_unit: 580 }, cantidad: 4, destino: P7, quien: ENC, cuando: c("10:00"), fecha: D, azar: az() }).evento;
  const fijo = fijarCosto({ articulo: SIN, costoUnit: 600, motivo: "venía mal la factura", quien: ADMIN, cuando: c("12:00"), fecha: D, azar: az() }).evento;
  const s = estadoDelAlmacen([marzo, uso, fijo], [SIN]);
  assert.equal(costoHoy([marzo, uso, fijo]), 600); assert.equal(costoDeConsumos(s).total, 2320); assert.equal(ajustesDeValuacion(s).lista.length, 0);
});

// ── B · Un reloj mal puesto no mueve la existencia a escondidas ───────────
test("un_telefono_con_la_hora_atrasada_no_hace_que_su_conteo_pase_antes_de_lo_que_ya_habia_pasado", () => {
  // 9:00 (hora buena): se mueven 20 a otra bodega. 10:00 de verdad: se cuentan 28 en el almacén —pero ese teléfono trae 3 horas de atraso y dice 7:00.
  const t = transferir({ articulo: UREA, cantidad: 20, de: NAVE, a: "Rancho 2", quien: ENC, cuando: c("09:00"), fecha: D, azar: az() }).evento;
  const k = contar({ articulo: UREA, contado: 28, existencia: 30, causa: "merma", quien: ADMIN, cuando: c("07:00"), fecha: D, azar: az() }).evento;
  assert.equal(nave([t, k]), 8, "sin saber del reloj, el conteo 'pasó' antes y le restan los 20: mal");
  const conDesfase = { ...k, reloj: { desfase: 3 * 3600000 } };
  assert.equal(nave([t, conDesfase]), 28, "con el desfase que el teléfono midió contra el servidor, el conteo queda donde fue");
  assert.equal(momentoDe(conDesfase).nota, "atrasado");
  const s = est([t, conDesfase]); assert.equal(porRevisar(s).relojes.length, 1, "y la corrección no es callada"); assert.equal(porRevisar(s).relojes[0].minutos, 180);
});

test("nada_pudo_pasar_despues_de_que_el_servidor_lo_recibio", () => {
  // El teléfono trae el reloj un día adelantado y nunca cotejó la hora: dice que entregó "mañana".
  const e = da(UREA, 10, { cuando: c("09:00", "2026-11-20"), fecha: D });
  const recibido = { ...e, _recibido: new Date(c("09:05")).toISOString() };
  const k = contar({ articulo: UREA, contado: 40, existencia: 40, quien: ADMIN, cuando: c("12:00"), fecha: D, azar: az(), }).evento;
  assert.equal(nave([e, k]), 30, "sin la hora del servidor, la entrega 'pasa' después del conteo y se resta otra vez");
  assert.equal(nave([recibido, k]), 40, "con la hora en que el servidor la recibió, queda antes del conteo");
  assert.equal(momentoDe(recibido).nota, "adelantado");
});

test("lo_capturado_de_un_dia_anterior_no_se_corrige_con_el_desfase_y_un_conteo_sin_hora_comprobada_se_señala", () => {
  const vieja = entrada({ articulo: UREA, cantidad: 5, quien: ADMIN, cuando: instanteDe("2026-11-17", D, c("15:00")), fecha: "2026-11-17", capturado: c("15:00"), azar: az() }).evento;
  assert.equal(momentoDe({ ...vieja, reloj: { desfase: 3 * 3600000 } }).movido, 0);
  const k = contar({ articulo: UREA, contado: 55, existencia: 55, quien: ADMIN, cuando: c("12:00"), fecha: D, azar: az() }).evento;
  assert.equal(est([k]).conteosSinHora.length, 1); assert.equal(est([{ ...k, reloj: { desfase: 1200 } }]).conteosSinHora.length, 0);
});

// ── Compras del personal: se recibe sin precio, se valúa después ───────────
import { recibirCompra, valuar, idDeRecepcion, valorDelInventario, costoDeConsumos as costoDeConsumos2, ajustesDeValuacion as ajustesDeValuacion2 } from "./movimientos.js";
const COMPRA = { id: "co1", estado: "aprobada", descripcion: "Hilo y urea", proveedor: "La Central", monto: 1500, fecha: D };
const HILO = { id: "i-x", nombre: "Hilo", unidad: "rollo", existencia: 0 };
const recibe = (mas = {}) => recibirCompra({ compra: COMPRA, i: 0, articulo: HILO, cantidad: 10, quien: ENC, cuando: c("09:00"), fecha: D, ...mas });

test("lo_que_compra_un_trabajador_sin_saber_el_precio_entra_pendiente_de_valoracion_no_en_cero", () => {
  const r = recibe(); assert.ok(r.ok, r.dice);
  const e = est([r.evento], [HILO]);
  assert.equal(nave([r.evento], HILO, [HILO]), 10, "la mercancía sí entra: ya está en el estante");
  assert.deepEqual(e.porValuar.map(p => [p.articulo, p.cantidad, p.ref.id]), [["Hilo", 10, "co1"]]);
  assert.equal(e.promedios.get("i-x"), undefined, "no tiene costo: ni cero ni inventado");
  const v = valorDelInventario(e, [HILO]);
  assert.equal(v.valor, 0); assert.deepEqual(v.sinValor.map(x => [x.articulo, x.cantidad, x.porValuar]), [["Hilo", 10, true]], "y el inventario dice que hay algo sin valor, no que vale cero");
  assert.equal(recibirCompra({ compra: { ...COMPRA, estado: "pendiente" }, i: 0, articulo: HILO, cantidad: 10, quien: ENC, cuando: c(), fecha: D }).ok, false, "sin aprobar no se recibe");
  assert.equal(recibe({ cantidad: 0 }).ok, false); assert.match(recibe({ costoUnit: 0 }).dice, /déjalo vacío/);
});

test("recibir_dos_veces_la_misma_partida_de_la_misma_compra_no_la_mete_doble", () => {
  const a = recibe().evento, b = recibe({ quien: ADMIN, cuando: c("09:05") }).evento;
  assert.equal(a.id, idDeRecepcion("co1", 0)); assert.equal(a.id, b.id, "es el mismo evento aunque lo capturen dos personas");
  assert.equal(nave([a, b], HILO, [HILO]), 10);
});

test("al_valuar_el_precio_vale_desde_que_entro_y_lo_ya_consumido_sale_como_ajuste_aparte", () => {
  const ent = recibe().evento;
  const uso = consumirDirecto({ articulo: HILO, cantidad: 4, destino: P7, quien: ENC, cuando: c("11:00"), fecha: D, azar: az() });
  assert.ok(uso.ok, uso.dice);
  const antes = est([ent, uso.evento], [HILO]);
  assert.equal(costoDeConsumos2(antes).total, 0); assert.equal(costoDeConsumos2(antes).pendientesDeValuacion.length, 1, "ese consumo no costó cero: está pendiente de valoración");
  const v = valuar({ entrada: antes.porValuar[0], costoUnit: 50, quien: ADMIN, cuando: c("10:00", "2026-11-21"), fecha: "2026-11-21", azar: az() });
  assert.ok(v.ok, v.dice);
  const despues = est([ent, uso.evento, v.evento], [HILO]);
  assert.equal(despues.porValuar.length, 0); assert.equal(despues.promedios.get("i-x"), 50);
  assert.equal(valorDelInventario(despues, [HILO]).valor, 300, "quedan 6 rollos a $50");
  const aj = ajustesDeValuacion2(despues);
  assert.equal(aj.total, 200, "los 4 rollos ya usados: $200 que la parcela no traía"); assert.equal(aj.lista[0].original, null); assert.equal(aj.lista[0].destino.id, "p7"); assert.match(aj.lista[0].porque, /no tenía costo/);
  assert.equal(despues.consumos[0].costo, null, "el consumo original no se toca");
  assert.deepEqual(despues.recibidas.map(x => [x.compraId, x.valor]), [["co1", 500]]);
});

test("corregir_una_valoracion_deja_la_anterior_como_historial", () => {
  const ent = recibe().evento, p = est([ent], [HILO]).porValuar[0];
  const v1 = valuar({ entrada: p, costoUnit: 50, quien: ENC, cuando: c("10:00"), fecha: D, azar: az() }).evento;
  const v2 = valuar({ entrada: p, costoUnit: 55, nota: "venía en la factura", quien: ADMIN, cuando: c("12:00"), fecha: D, azar: az() }).evento;
  const e = est([ent, v1, v2], [HILO]);
  assert.equal(e.promedios.get("i-x"), 55); assert.deepEqual(e.recibidas[0].valuacion.anteriores, [{ costoUnit: 50, por: "Encargado", fecha: D }]);
  assert.equal(valuar({ entrada: p, costoUnit: 0, quien: ADMIN, cuando: c(), fecha: D }).ok, false);
});

test("si_al_recibir_ya_se_sabe_el_precio_entra_valuada_de_una_vez", () => {
  const r = recibe({ costoUnit: 48 });
  const e = est([r.evento], [HILO]);
  assert.equal(e.porValuar.length, 0); assert.equal(e.promedios.get("i-x"), 48); assert.equal(e.recibidas[0].valor, 480);
});

// ── Auditoría del almacén (22 nov): lo que una compra posterior no debe cambiar ──
test("una_merma_vale_lo_que_costaba_el_dia_que_paso_aunque_despues_se_compre_mas_caro", () => {
  const BULTO = { id: "i-b", nombre: "Bulto", unidad: "bulto", existencia: 0, costo_unit: 0 };
  const e1 = entrada({ articulo: BULTO, cantidad: 10, costoUnit: 500, quien: ADMIN, cuando: c("08:00"), fecha: D, azar: az() }).evento;
  const m = merma({ articulo: BULTO, cantidad: 1, causa: "merma", quien: ENC, cuando: c("09:00"), fecha: D, azar: az() }).evento;
  const k = contar({ articulo: BULTO, contado: 8, existencia: 9, causa: "robo", quien: ADMIN, cuando: c("10:00"), fecha: D, azar: az() }).evento;
  const antes = resumenDeAjustes(est([e1, m, k], [BULTO]), conExistenciaReal([BULTO], est([e1, m, k], [BULTO])));
  assert.equal(antes.faltante, 1000, "una merma y un faltante de un bulto de $500");
  const e2 = entrada({ articulo: BULTO, cantidad: 8, costoUnit: 900, quien: ADMIN, cuando: c("12:00"), fecha: D, azar: az() }).evento;
  const s = est([e1, m, k, e2], [BULTO]); const inv = conExistenciaReal([BULTO], s);
  assert.equal(inv[0].costo_unit, 700, "el promedio de hoy ya es $700");
  assert.equal(resumenDeAjustes(s, inv).faltante, 1000, "y lo que se perdió en la mañana sigue valiendo $1,000, no $1,400");
});
test("el_inventario_vale_lo_comprado_menos_lo_usado_sin_centavos_de_mas_ni_de_menos", () => {
  const BULTO = { id: "i-b", nombre: "Bulto", unidad: "bulto", existencia: 0, costo_unit: 0 };
  const evs = [entrada({ articulo: BULTO, cantidad: 5, costoUnit: 500, quien: ADMIN, cuando: c("08:00"), fecha: D, azar: az() }).evento,
    entrada({ articulo: BULTO, cantidad: 4, costoUnit: 600, quien: ADMIN, cuando: c("09:00"), fecha: D, azar: az() }).evento];
  assert.equal(valorDelInventario(est(evs, [BULTO]), [BULTO]).valor, 4900, "9 bultos a $544.444…: $4,900, no $4,899.96");
});
test("lo_recibido_sin_precio_no_se_valua_al_promedio_de_lo_demas_hasta_que_alguien_le_pone_precio", () => {
  const BULTO = { id: "i-b", nombre: "Bulto", unidad: "bulto", existencia: 0, costo_unit: 0 };
  const e1 = entrada({ articulo: BULTO, cantidad: 9, costoUnit: 500, quien: ADMIN, cuando: c("08:00"), fecha: D, azar: az() }).evento;
  const compra = { id: "co1", estado: "aprobada", descripcion: "Dos bultos", monto: 1300, items: [{ nombre: "Bulto", insumoId: "i-b", cantidad: 2 }] };
  const r = recibirCompra({ compra, i: 0, articulo: BULTO, cantidad: 2, quien: ENC, cuando: c("10:00"), fecha: D }); assert.ok(r.ok, r.dice);
  const s = est([e1, r.evento], [BULTO]);
  assert.equal(existenciasDe(BULTO, s).lugares[NAVE], 11, "ya están en el estante");
  assert.equal(valorDelInventario(s, [BULTO]).valor, 4500, "valen los 9 que tienen precio; los 2 nuevos están por valuar");
  assert.equal(valorDelInventario(s, [BULTO]).porValuar.length, 1);
  const v = valuar({ entrada: s.porValuar[0], costoUnit: 600, quien: ADMIN, cuando: c("11:00"), fecha: D }); assert.ok(v.ok, v.dice);
  assert.equal(valorDelInventario(est([e1, r.evento, v.evento], [BULTO]), [BULTO]).valor, 5700, "con precio: $4,500 + $1,200");
});

// ── INTEGRIDAD HISTÓRICA DE LOS COSTOS (Luis, 22 nov) ──
// Lo que ya pasó se queda con el costo que tenía: ninguna compra posterior, ninguna que llega tarde y ningún precio
// puesto después le cambia el importe a un consumo, a una merma o a un faltante ya registrados.
test("ninguna_compra_posterior_ni_tardia_ni_valuacion_cambia_el_costo_de_lo_que_ya_paso", () => {
  const B = { id: "i-b", nombre: "Bulto", unidad: "bulto", existencia: 0, costo_unit: 0 };
  const P = { tipo: "parcela", id: "p7", nombre: "Parcela 7", actividad: "Fertilización" };
  const visto = (evs) => conExistenciaReal([B], est(evs, [B]))[0];           // el artículo como lo enseña la pantalla en ese momento
  const evs = [entrada({ articulo: B, cantidad: 10, costoUnit: 500, quien: ADMIN, cuando: c("08:00"), fecha: D, azar: az() }).evento];
  const sinPrecio = recibirCompra({ compra: { id: "co9", estado: "aprobada", descripcion: "x", monto: 1300, items: [{ nombre: "Bulto", insumoId: "i-b", cantidad: 2 }] }, i: 0, articulo: B, cantidad: 2, quien: ENC, cuando: c("08:30"), fecha: D });
  evs.push(sinPrecio.evento);
  const uso = consumirDirecto({ articulo: visto(evs), cantidad: 3, destino: P, quien: ENC, cuando: c("09:00"), fecha: D, azar: az() }); assert.ok(uso.ok, uso.dice); evs.push(uso.evento);
  const m = merma({ articulo: visto(evs), cantidad: 1, causa: "merma", quien: ENC, cuando: c("10:00"), fecha: D, azar: az() }); assert.ok(m.ok, m.dice); evs.push(m.evento);
  const k = contar({ articulo: visto(evs), contado: 7, existencia: 8, causa: "robo", quien: ADMIN, cuando: c("11:00"), fecha: D, azar: az() }); assert.ok(k.ok, k.dice); evs.push(k.evento);
  assert.equal(m.evento.datos.costoUnit, 500, "la merma guarda lo que costaba al capturarla"); assert.equal(k.evento.datos.costoUnit, 500);
  // El conteo es absoluto («a esa hora había 7»): si después aparece mercancía anterior, cambia CUÁNTO faltaba, que es
  // lo correcto; lo que no puede cambiar es A CUÁNTO se valúa cada unidad. Por eso del faltante se compara el precio.
  const foto = (lista) => { const s = est(lista, [B]); const aj = resumenDeAjustes(s, conExistenciaReal([B], s)).lista;
    const de = (clase) => aj.find(a => a.clase === clase);
    return { consumo: costoDeConsumos(s).aParcelas, merma: de("merma").valor, cadaFaltante: de("conteo").valor / Math.abs(de("conteo").diferencia) }; };
  const antes = foto(evs);
  assert.deepEqual(antes, { consumo: 1500, merma: 500, cadaFaltante: 500 });
  // 1) una compra POSTERIOR, mucho más cara
  const cara = entrada({ articulo: B, cantidad: 20, costoUnit: 1200, quien: ADMIN, cuando: c("15:00"), fecha: D, azar: az() }).evento;
  assert.deepEqual(foto([...evs, cara]), antes, "una compra posterior no toca lo anterior");
  // 2) una compra ANTERIOR que sube tarde (otro teléfono sin señal), más barata
  const tardia = entrada({ articulo: B, cantidad: 10, costoUnit: 100, quien: ADMIN, cuando: c("07:00"), fecha: D, azar: az() }).evento;
  const conTardia = foto([...evs, cara, tardia]);
  assert.deepEqual(conTardia, antes, "una compra que llega tarde tampoco: la diferencia va aparte");
  assert.ok(ajustesDeValuacion(est([...evs, cara, tardia], [B])).lista.length >= 1, "y esa diferencia queda a la vista, con su causa");
  // 3) ponerle precio después a lo que entró sin precio antes del consumo
  const v = valuar({ entrada: est(evs, [B]).porValuar[0], costoUnit: 2000, quien: ADMIN, cuando: c("16:00"), fecha: D }); assert.ok(v.ok, v.dice);
  assert.deepEqual(foto([...evs, cara, tardia, v.evento]), antes, "valuar después no reescribe el consumo, la merma ni el faltante");
  // 4) y en cualquier orden de llegada sale lo mismo
  assert.deepEqual(foto(revuelve([...evs, cara, tardia, v.evento])), antes);
});
