// Satélite para análisis: lo tapado no cuenta, la orilla no cuenta, y un índice nunca dice una causa.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pedidoDeEscenas, leerEscenas, urlDeRecorte, cajaConMargen, cuadrosDentro, reflectancia, calcularIndice, sirveParaSerie, colorDe, pintarIndice, guardarLectura, lecturasDe, serieDe, compararFechas, periodoDeAnalisis, INDICES, ADVERTENCIAS, ESTADOS, T_LECTURA } from "./satelite.js";
import { metrosPorGrado } from "./mapa.js";

// Parcela inventada de unos 100 × 100 m y una cuadrícula de 14 × 14 cuadros de 10 m que la cubre con margen.
const m = metrosPorGrado(23), dy = 10 / m.norte, dx = 10 / m.este, S = 23, O = -102.5;
const ANILLO = [[S, O], [S, O + 10 * dx], [S + 10 * dy, O + 10 * dx], [S + 10 * dy, O]];
const GEO = { oeste: O - 2 * dx, norte: S + 12 * dy, dx, dy }, W = 14, H = 14;
const lleno = (v, T = Uint16Array) => new T(W * H).fill(v);
// reflectancia 0.05 en rojo y 0.45 en infrarrojo → NDVI 0.8 (con el desfase de 1000 de los datos desde 2022)
const raster = (extra = {}) => ({ ancho: W, alto: H, geo: GEO, mascara: lleno(255), bandas: { B04: lleno(1500), B08: lleno(5500), B8A: lleno(5500), B11: lleno(3000), SCL: lleno(4), ...extra } });
const ESC = { id: "S2A_inventada_20261114", fecha: "2026-11-14", hora: "11:27", conDesfase: true, plataforma: "Sentinel-2A", nubesEscena: 3 };
const quien = { rol: "admin", id: "a1", nombre: "Luis" }, sello = (n = 0) => ({ quien, cuando: `2026-11-21T12:00:0${n}.000Z`, fecha: "2026-11-21" });

test("se_piden_las_pasadas_del_periodo_sobre_la_parcela_y_queda_una_por_dia", () => {
  const p = pedidoDeEscenas({ anillo: ANILLO, desde: "2026-10-01", hasta: "2026-11-21" });
  assert.equal(p.cuerpo.collections[0], "sentinel-2-l2a"); assert.equal(p.cuerpo.intersects.coordinates[0].length, 5); assert.deepEqual(p.cuerpo.intersects.coordinates[0][0], [O, S], "el catálogo quiere longitud primero");
  assert.equal(pedidoDeEscenas({ anillo: [[1, 1]], desde: "a", hasta: "b" }), null, "sin límite no hay qué pedir");
  const cubre = { type: "Polygon", coordinates: [[[O - 1, S - 1], [O + 1, S - 1], [O + 1, S + 1], [O - 1, S + 1], [O - 1, S - 1]]] }, aMedias = { type: "Polygon", coordinates: [[[O - 1, S - 1], [O + 0.00001, S - 1], [O + 0.00001, S + 1], [O - 1, S + 1], [O - 1, S - 1]]] };
  const F = (id, datetime, nubes, geometry, extra = {}) => ({ id, geometry, properties: { datetime, "eo:cloud_cover": nubes, platform: "Sentinel-2A", "s2:processing_baseline": "05.13", ...extra } });
  const e = leerEscenas({ features: [F("B_orilla", "2026-11-14T17:27:11Z", 2.04, aMedias), F("A_completa", "2026-11-14T17:27:11Z", 5.5, cubre), F("C", "2026-11-12T17:30:00Z", 100, cubre), F("D_vieja", "2021-11-12T03:30:00Z", 10, cubre, { "s2:processing_baseline": "03.00" })] }, ANILLO);
  assert.deepEqual(e.map(x => [x.fecha, x.id, x.nubesEscena]), [["2021-11-11", "D_vieja", 10], ["2026-11-12", "C", 100], ["2026-11-14", "A_completa", 5.5]], "del mismo día se queda la que cubre la parcela completa; y el día es el del rancho, no el de Greenwich");
  assert.deepEqual([e[2].hora, e[2].plataforma, e[2].conDesfase, e[0].conDesfase], ["11:27", "Sentinel-2A", true, false]);
  assert.match(urlDeRecorte(e[2]), /crop\.tif\?collection=sentinel-2-l2a&item=A_completa&assets=B04&assets=B08&assets=B8A&assets=B11&assets=SCL&resampling=nearest$/);
  assert.match(urlDeRecorte(e[2], ["visual"]), /assets=visual&asset_bidx=visual%7C1,2,3$/);
  const c = cajaConMargen(ANILLO, 40); assert.ok(Math.abs((S - c.sur) * m.norte - 40) < 0.01); assert.equal(c.poligono.length, 5);
});

test("solo_cuentan_los_cuadros_que_caen_dentro_y_lejos_de_la_orilla", () => {
  const d = cuadrosDentro({ ancho: W, alto: H, geo: GEO }, ANILLO);
  assert.equal(d.reduce((s, v) => s + v, 0), 100, "los 10 × 10 cuadros que caben completos");
  assert.equal(d[0], 0); assert.equal(d[2 * W + 2], 1);
  // Con la parcela corrida medio cuadro, los cuadros de la orilla ya mezclan parcela y camino: se quedan fuera.
  const corrida = ANILLO.map(([la, lo]) => [la + dy / 2, lo + dx / 2]);
  assert.equal(cuadrosDentro({ ancho: W, alto: H, geo: GEO }, corrida).reduce((s, v) => s + v, 0), 81);
  const hueco = [[S + 4 * dy, O + 4 * dx], [S + 4 * dy, O + 6 * dx], [S + 6 * dy, O + 6 * dx], [S + 6 * dy, O + 4 * dx]];
  assert.equal(cuadrosDentro({ ancho: W, alto: H, geo: GEO }, ANILLO, [hueco]).reduce((s, v) => s + v, 0), 96, "un hueco de la parcela tampoco cuenta");
});

test("el_ndvi_sale_de_la_reflectancia_y_su_resumen_dice_cuantos_cuadros_se_usaron", () => {
  assert.equal(reflectancia(1500, true), 0.05); assert.equal(reflectancia(1500, false), 0.15); assert.equal(reflectancia(900, true), 0);
  const c = calcularIndice(raster(), ANILLO, ESC, "ndvi");
  assert.deepEqual(c.resumen, { cuadros: 100, validos: 100, pctValido: 100, conNube: 0, sinDato: 0, estado: "bien", media: 0.8, mediana: 0.8, min: 0.8, max: 0.8, p10: 0.8, p90: 0.8 });
  assert.equal(calcularIndice(raster(), ANILLO, { ...ESC, conDesfase: false }, "ndvi").resumen.media, 0.571, "los datos de antes de 2022 no llevan desfase: sale otro número y es el correcto");
  const h = calcularIndice(raster(), ANILLO, ESC, "ndmi"); assert.equal(h.resumen.media, r((0.45 - 0.2) / (0.45 + 0.2)));
  assert.throws(() => calcularIndice(raster(), ANILLO, ESC, "salud"));
});
const r = (n) => Math.round(n * 1000) / 1000;

test("lo_que_tapo_una_nube_no_cuenta_y_no_se_rellena", () => {
  const scl = lleno(4, Uint8Array); for (let y = 2; y < 12; y++) for (let x = 2; x < 7; x++) scl[y * W + x] = 9;   // media parcela con nube
  const c = calcularIndice(raster({ SCL: scl }), ANILLO, ESC, "ndvi");
  assert.deepEqual([c.resumen.cuadros, c.resumen.validos, c.resumen.conNube, c.resumen.pctValido, c.resumen.estado], [100, 50, 50, 50, "parcial"]);
  assert.equal(Number.isNaN(c.valores[2 * W + 2]), true, "el cuadro tapado queda sin valor"); assert.equal(sirveParaSerie(c.resumen), false, "una lectura parcial no entra a la línea del tiempo");
  const todo = calcularIndice(raster({ SCL: lleno(8, Uint8Array) }), ANILLO, ESC, "ndvi");
  assert.deepEqual([todo.resumen.estado, todo.resumen.validos, todo.resumen.media], ["sin_dato", 0, undefined], "sin dato no hay promedio: ni cero ni el de la vez pasada");
  assert.equal(calcularIndice(raster({ B08: lleno(0) }), ANILLO, ESC, "ndvi").resumen.estado, "sin_dato");
  const sombra = lleno(4, Uint8Array); sombra[2 * W + 2] = 3; assert.equal(calcularIndice(raster({ SCL: sombra }), ANILLO, ESC, "ndvi").resumen.conNube, 1, "la sombra de nube también");
});

test("una_parcela_muy_chica_para_cuadros_de_diez_metros_se_dice", () => {
  const chica = [[S, O], [S, O + 2.4 * dx], [S + 2.4 * dy, O + 2.4 * dx], [S + 2.4 * dy, O]];
  const c = calcularIndice(raster(), chica, ESC, "ndvi");
  assert.equal(c.resumen.estado, "pocos"); assert.ok(c.resumen.cuadros < 9); assert.match(ESTADOS.pocos, /muy chica/);
  const minima = [[S, O], [S, O + 0.9 * dx], [S + 0.9 * dy, O + 0.9 * dx], [S + 0.9 * dy, O]];
  assert.equal(calcularIndice(raster(), minima, ESC, "ndvi").resumen.estado, "sin_cuadros");
});

test("el_color_sale_de_una_escala_fija_y_lo_tapado_se_pinta_gris_no_de_un_color_inventado", () => {
  assert.deepEqual(colorDe("ndvi", -1), [0x8C, 0x51, 0x0A]); assert.deepEqual(colorDe("ndvi", 2), [0x0B, 0x5D, 0x1E]); assert.equal(colorDe("ndvi", NaN), null);
  const scl = lleno(4, Uint8Array); scl[2 * W + 2] = 9;
  const c = calcularIndice(raster({ SCL: scl }), ANILLO, ESC, "ndvi"), px = pintarIndice(c, W, H, "ndvi");
  assert.equal(px[3], 0, "fuera de la parcela no se pinta nada"); const i = (2 * W + 2) * 4, j = (2 * W + 3) * 4;
  assert.deepEqual([px[i], px[i + 1], px[i + 2]], [150, 150, 150]); assert.ok(px[j + 1] > px[j] && px[j + 3] > 200, "un cuadro con vigor alto sale verde");
});

test("lo_leido_se_guarda_una_vez_por_pasada_y_un_limite_corregido_no_hereda_lecturas", () => {
  const lim = { evento: "ev-limitegeo-abc-0000001", ha: 1 }, res = calcularIndice(raster(), ANILLO, ESC, "ndvi").resumen;
  const a = guardarLectura({ parcelaId: "p1", limite: lim, escena: ESC, resumenes: { ndvi: res, salud: { x: 1 } }, ...sello() });
  assert.equal(a.ok, true); assert.equal(a.evento.tipo, T_LECTURA); assert.deepEqual(Object.keys(a.evento.datos.indices), ["ndvi"]); assert.equal(a.evento.datos.fuente, "planetary-computer"); assert.equal(a.evento.datos.valores, undefined, "se guarda el resumen, no la imagen");
  const b = guardarLectura({ parcelaId: "p1", limite: lim, escena: ESC, resumenes: { ndvi: res }, ...sello(1) });
  assert.equal(a.evento.id, b.evento.id, "leer dos veces la misma pasada es el mismo registro");
  assert.equal(guardarLectura({ parcelaId: "p1", limite: {}, escena: ESC, resumenes: { ndvi: res }, ...sello() }).ok, false, "sin límite no hay lectura");
  assert.equal(lecturasDe([a.evento], "p1", lim.evento).length, 1); assert.equal(lecturasDe([a.evento], "p1", "ev-limitegeo-otro").length, 0); assert.equal(lecturasDe([a.evento], "p2", lim.evento).length, 0);
});

test("la_linea_del_tiempo_solo_usa_lecturas_completas_y_comparar_dice_cuanto_no_por_que", () => {
  const L = (dia, media, estado = "bien") => ({ dia, indices: { ndvi: estado === "sin_dato" ? { estado } : { estado, media, p10: media - 0.1, p90: media + 0.1 } } });
  const lecturas = [L("2026-10-05", 0.21), L("2026-10-15", 0.3, "parcial"), L("2026-10-25", null, "sin_dato"), L("2026-11-04", 0.52), L("2026-11-14", 0.5)];
  const s = serieDe(lecturas, "ndvi");
  assert.deepEqual(s.puntos.map(p => [p.dia, p.valor]), [["2026-10-05", 0.21], ["2026-11-04", 0.52], ["2026-11-14", 0.5]]); assert.deepEqual(s.sinUsar.map(x => x.estado), ["parcial", "sin_dato"]);
  assert.equal(serieDe(lecturas, "ndvi", "2026-11-01").puntos.length, 2);
  const sube = compararFechas(lecturas[3], lecturas[0], "ndvi");
  assert.deepEqual([sube.desde, sube.hasta, sube.dif, sube.sentido], ["2026-10-05", "2026-11-04", 0.31, "subio"], "el orden en que se escogen no importa");
  assert.match(sube.dice, /Subió de 0\.21 a 0\.52 \(\+0\.31\)\. El satélite dice que cambió, no por qué\./);
  assert.equal(compararFechas(lecturas[3], lecturas[4], "ndvi").sentido, "igual"); assert.match(compararFechas(lecturas[3], lecturas[4], "ndvi").dice, /cabe en lo que varía de una pasada a otra/);
  assert.equal(compararFechas(lecturas[0], lecturas[1], "ndvi").se, false);
  const baja = compararFechas(L("2026-11-04", 0.6), L("2026-11-14", 0.4), "ndvi").dice;
  for (const palabra of ["enferm", "plaga", "riego", "sequ", "estrés", "problema", "daño"]) assert.equal(baja.toLowerCase().includes(palabra), false, `una baja no se explica sola («${palabra}»)`);
  assert.match(ADVERTENCIAS[0], /indicio, no un diagnóstico/); assert.match(ADVERTENCIAS[1], /10 metros/); assert.ok(INDICES.ndvi.rampa.length > 4);
});

test("una_fecha_que_se_sale_de_sus_vecinas_se_senala_como_dudosa_no_se_borra_ni_se_corrige", () => {
  const L = (dia, media) => ({ dia, indices: { ndvi: { estado: "bien", media, p10: media, p90: media } } });
  // Pasó de verdad en la prueba con el servicio real: 0.43, 0.18, 0.42 en diez días, con 41 % de nubes en la pasada de en medio.
  const s = serieDe([L("2026-10-23", 0.43), L("2026-10-25", 0.18), L("2026-11-02", 0.42), L("2026-11-07", 0.41)], "ndvi");
  assert.deepEqual(s.dudosas, ["2026-10-25"]); assert.equal(s.puntos.length, 4, "sigue en la lista"); assert.equal(s.puntos[1].valor, 0.18, "con su valor tal cual");
  // Una baja que se sostiene NO es dudosa: eso sí puede ser el cultivo.
  assert.deepEqual(serieDe([L("2026-10-23", 0.6), L("2026-10-28", 0.4), L("2026-11-02", 0.38)], "ndvi").dudosas, []);
  assert.deepEqual(serieDe([L("2026-10-23", 0.6), L("2026-10-28", 0.3)], "ndvi").dudosas, [], "la última fecha no tiene con qué compararse hacia adelante");
});

test("se_analiza_el_ciclo_vigente_y_sin_ciclo_los_ultimos_noventa_dias", () => {
  assert.deepEqual(periodoDeAnalisis({ desdeDelCiclo: "2026-10-01", hoy: "2026-11-21" }), { desde: "2026-10-01", hasta: "2026-11-21", deCiclo: true, recortado: false });
  assert.deepEqual(periodoDeAnalisis({ hoy: "2026-11-21" }), { desde: "2026-08-23", hasta: "2026-11-21", deCiclo: false, recortado: false });
  assert.deepEqual(periodoDeAnalisis({ desdeDelCiclo: "0000-01-01", hoy: "2026-11-21" }).deCiclo, false, "un ciclo sin fecha de siembra no manda");
  const largo = periodoDeAnalisis({ desdeDelCiclo: "2024-01-01", hoy: "2026-11-21" }); assert.deepEqual([largo.desde, largo.recortado], ["2025-11-21", true]);
});
