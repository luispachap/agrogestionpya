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
