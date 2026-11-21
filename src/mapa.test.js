// El mapa: la superficie se mide, los límites no se inventan y lo que se enseña es lo que el sistema ya sabe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { areaDeAnillo, superficieDe, perimetroDe, revisarAnillo, limpiarAnillo, puntoDentro, guardarLimite, quitarLimite, limitesDe, limiteDe, conPoligonos, compararSuperficie, leerGeoJSON, leerKML, leerArchivoGeografico, sugerirParcela, fichaDeParcela, resumenDelMapa, colorDeCultivo, T_LIMITE } from "./mapa.js";
import { ubicarLaFoto } from "./dron.js";

const quien = { rol: "admin", id: "a1", nombre: "Luis" }; let n = 0;
const sello = () => ({ quien, cuando: `2026-11-21T12:00:${String(n++).padStart(2, "0")}.000Z`, fecha: "2026-11-21", azar: n / 1000 });
// Un cuadro de una milésima de grado por lado, a 23° norte (lugar inventado). Un grado ahí mide 110,744.9 m al norte y 102,522.5 m al este.
const CUADRO = [[23, -102.5], [23, -102.499], [23.001, -102.499], [23.001, -102.5]];
const parcelas = [{ id: "p1", nombre: "La Presa", ranchoId: "r1", hectareas: 1.1, cultivo: "Ajo" }, { id: "p2", nombre: "El Llano", ranchoId: "r1", hectareas: 5 }];

test("la_superficie_se_mide_del_poligono_con_la_forma_real_de_la_tierra", () => {
  const esperado = 110.7449 * 102.5225;   // m², con las medidas oficiales de un grado a esa latitud
  assert.ok(Math.abs(areaDeAnillo(CUADRO) - esperado) / esperado < 0.001, `midió ${areaDeAnillo(CUADRO)} y eran ${esperado}`);
  assert.equal(superficieDe({ anillo: CUADRO }).ha, 1.1354);
  assert.ok(Math.abs(perimetroDe(CUADRO) - 2 * (110.7449 + 102.5225)) < 0.5);
  assert.equal(areaDeAnillo([...CUADRO].reverse()), areaDeAnillo(CUADRO), "da igual hacia qué lado se recorra");
  assert.equal(areaDeAnillo([...CUADRO, CUADRO[0]]), areaDeAnillo(CUADRO), "el punto de cierre repetido no cuenta dos veces");
  const hueco = [[23.0004, -102.4996], [23.0004, -102.4994], [23.0006, -102.4994], [23.0006, -102.4996]];
  assert.ok(superficieDe({ anillo: CUADRO, huecos: [hueco] }).m2 < superficieDe({ anillo: CUADRO }).m2, "un hueco se resta");
  assert.equal(puntoDentro(23.0005, -102.4995, CUADRO), true); assert.equal(puntoDentro(23.002, -102.4995, CUADRO), false);
});

test("un_contorno_mal_trazado_no_se_guarda_y_se_dice_por_que", () => {
  assert.match(revisarAnillo([[23, -102.5], [23.001, -102.5]]).dice, /al menos tres esquinas/);
  const mono = [CUADRO[0], CUADRO[2], CUADRO[1], CUADRO[3]];
  assert.match(revisarAnillo(mono).dice, /se cruza consigo mismo/);
  assert.match(revisarAnillo([[23, -102.5], [23, -102.49999], [23.00001, -102.5]]).dice, /demasiado chico/);
  assert.equal(revisarAnillo(CUADRO).ok, true);
  assert.equal(limpiarAnillo([{ lat: 23, lng: -102.5 }, { lat: 23, lng: -102.5 }, { lat: 23.001, lng: -102.5 }]).length, 2);
});

test("un_limite_es_un_evento_corregirlo_conserva_el_anterior_y_quitarlo_pide_motivo", () => {
  const ev = [];
  assert.equal(guardarLimite({ de: { tipo: "parcela", id: "p9" }, anillo: CUADRO, fuente: "dibujado", parcelas, ...sello() }).ok, false, "una parcela que no existe");
  assert.match(guardarLimite({ de: { tipo: "parcela", id: "p1" }, anillo: CUADRO, fuente: "supuesto", parcelas, ...sello() }).dice, /de dónde salió/);
  assert.match(guardarLimite({ de: { tipo: "parcela", id: "p1" }, anillo: CUADRO, fuente: "archivo", parcelas, ...sello() }).dice, /nombre del archivo/);
  const a = guardarLimite({ de: { tipo: "parcela", id: "p1" }, anillo: CUADRO, fuente: "dibujado", parcelas, ...sello() });
  assert.equal(a.ok, true); assert.equal(a.evento.tipo, T_LIMITE); assert.equal(a.ha, 1.1354); ev.push(a.evento);
  const mas = [[23, -102.5], [23, -102.498], [23.001, -102.498], [23.001, -102.5]];
  ev.push(guardarLimite({ de: { tipo: "parcela", id: "p1" }, anillo: mas, fuente: "archivo", archivo: "parcelas.kml", parcelas, ...sello() }).evento);
  const l = limiteDe(limitesDe(ev), "parcela", "p1");
  assert.equal(l.ha, 2.2707); assert.equal(l.fuente, "archivo"); assert.equal(l.archivo, "parcelas.kml"); assert.deepEqual(l.anteriores.map(x => [x.ha, x.fuente]), [[1.1354, "dibujado"]]);
  assert.match(quitarLimite({ de: { tipo: "parcela", id: "p1" }, motivo: "", ...sello() }).dice, /por qué/);
  ev.push(quitarLimite({ de: { tipo: "parcela", id: "p1" }, motivo: "se trazó en la parcela de junto", ...sello() }).evento);
  assert.equal(limiteDe(limitesDe(ev), "parcela", "p1"), null); assert.equal(limitesDe(ev).get("parcela:p1").anteriores.length, 2, "lo quitado no borra su historia");
});

test("la_superficie_capturada_y_la_medida_se_ensenan_las_dos_y_ninguna_cambia_sola", () => {
  const ev = [guardarLimite({ de: { tipo: "parcela", id: "p1" }, anillo: CUADRO, fuente: "dibujado", parcelas, ...sello() }).evento], lim = limitesDe(ev);
  assert.deepEqual(compararSuperficie(parcelas[0], limiteDe(lim, "parcela", "p1")), { capturada: 1.1, medida: 1.1354, dif: 0.0354, pct: 3.2, estado: "difiere" });
  assert.equal(compararSuperficie({ hectareas: 1.13 }, limiteDe(lim, "parcela", "p1")).estado, "coincide");
  assert.equal(compararSuperficie(parcelas[1], limiteDe(lim, "parcela", "p2")).estado, "sin_limite", "sin límite no hay superficie medida: no se supone");
  assert.equal(parcelas[0].hectareas, 1.1);
  const r = resumenDelMapa(parcelas, lim); assert.deepEqual([r.total, r.conLimite, r.sinLimite.map(p => p.id), r.haMedidas], [2, 1, ["p2"], 1.1354]);
});

test("el_limite_dibujado_le_sirve_al_dron_para_saber_de_que_parcela_es_una_foto", () => {
  const ev = [guardarLimite({ de: { tipo: "parcela", id: "p1" }, anillo: CUADRO, fuente: "dibujado", parcelas, ...sello() }).evento];
  const geo = conPoligonos(parcelas, limitesDe(ev));
  assert.equal(geo[0].poligono.length, 4); assert.equal(geo[1].poligono, undefined); assert.equal(parcelas[0].poligono, undefined, "no se guarda en la parcela: se calcula");
  const u = ubicarLaFoto({ foto: { lat: 23.0005, lng: -102.4995 }, parcelas: geo });
  assert.equal(u.parcelaId, "p1");
});

test("un_kml_de_google_earth_y_un_geojson_dan_las_mismas_figuras", () => {
  const kml = `<?xml version="1.0"?><kml><Document><Placemark><name>La Presa</name><Polygon><outerBoundaryIs><LinearRing><coordinates>
    -102.5,23,0 -102.499,23,0 -102.499,23.001,0 -102.5,23.001,0 -102.5,23,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
    <Placemark><name>Pozo</name><Point><coordinates>-102.5,23,0</coordinates></Point></Placemark></Document></kml>`;
  const k = leerArchivoGeografico("ranchos.kml", kml);
  assert.equal(k.ok, true); assert.deepEqual(k.figuras.map(f => [f.nombre, f.ha, f.anillo.length]), [["La Presa", 1.1354, 4]]); assert.match(k.avisos[0], /1 marca\(s\) del archivo son puntos o rutas/);
  const gj = { type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "La Presa" }, geometry: { type: "Polygon", coordinates: [[[-102.5, 23], [-102.499, 23], [-102.499, 23.001], [-102.5, 23.001], [-102.5, 23]]] } }] };
  const g = leerArchivoGeografico("ranchos.geojson", JSON.stringify(gj));
  assert.deepEqual(g.figuras[0].anillo, k.figuras[0].anillo);
  assert.equal(sugerirParcela("la presa", parcelas), "p1"); assert.equal(sugerirParcela("Presa", parcelas), null, "parecerse no basta");
  assert.equal(sugerirParcela("El Llano", [...parcelas, { id: "p3", nombre: "EL LLANO" }]), null, "dos con el mismo nombre: no se escoge");
});

test("un_archivo_en_otra_proyeccion_o_sin_poligonos_se_rechaza_con_su_motivo", () => {
  const utm = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[756000, 2545000], [756100, 2545000], [756100, 2545100], [756000, 2545100]]] } };
  const r = leerGeoJSON(utm); assert.equal(r.figuras.length, 0); assert.match(r.descartadas[0].motivo, /no vienen en grados/);
  assert.match(leerGeoJSON({ type: "FeatureCollection", crs: { properties: { name: "EPSG:32613" } }, features: [] }).dice, /otra proyección \(EPSG:32613\)/);
  assert.match(leerGeoJSON({ type: "Feature", geometry: { type: "LineString", coordinates: [[-102.5, 23], [-102.4, 23]] } }).dice, /ningún polígono/);
  assert.match(leerArchivoGeografico("x.kmz", "PK").dice, /KMZ es un KML comprimido/); assert.match(leerArchivoGeografico("x.shp", "").dice, /shapefile/);
  assert.match(leerGeoJSON("no es json").dice, /no es un GeoJSON/);
  // Latitud y longitud al revés: se lee al derecho sólo cuando no hay duda, y se avisa.
  const alReves = leerGeoJSON({ type: "Polygon", coordinates: [[[23, -102.5], [23, -102.499], [23.001, -102.499], [23.001, -102.5]]] });
  assert.equal(alReves.figuras[0].ha, 1.1354); assert.match(alReves.avisos[0], /orden contrario/);
});

test("al_tocar_una_parcela_se_ve_lo_que_el_sistema_ya_sabe_de_su_ciclo_vigente", () => {
  const data = { parcelas, ranchos: [{ id: "r1", nombre: "Rancho inventado" }],
    siembras: [{ id: "s1", parcelaId: "p1", cultivoNombre: "Ajo", variedadNombre: "Morado", fechaSiembra: "2026-10-01", superficie: 1 }, { id: "s0", parcelaId: "p1", cultivoNombre: "Maíz", fechaSiembra: "2026-03-01", fechaCosechaReal: "2026-08-30" }],
    actividades: [{ parcelaId: "p1", fecha: "2026-10-05", tipo: "Riego", costoTotal: 300 }, { parcelaId: "p1", fecha: "2026-11-02", tipo: "Riego", costoTotal: 320 }, { parcelaId: "p1", fecha: "2026-10-20", tipo: "Fertilización", costoTotal: 900.5 },
      { parcelaId: "p1", fecha: "2026-05-01", tipo: "Riego", costoTotal: 999 }, { parcelaId: "p2", fecha: "2026-11-01", tipo: "Riego", costoTotal: 50 }],
    aplicaciones: [{ parcelaId: "p1", fecha: "2026-11-10" }], egresos: [{ parcelaId: "p1", fecha: "2026-10-15", monto: 1200 }, { parcelaId: "p1", fecha: "2026-10-16", monto: 500, cancelado: { motivo: "x" } }],
    cosechas: [{ parcelaId: "p1", registros: [{ fecha: "2026-08-20" }] }] };
  const f = fichaDeParcela(data, "p1", "2026-11-21");
  assert.deepEqual(f.cultivo, { de: "ciclo", nombres: ["Ajo"] }); assert.equal(f.desde, "2026-10-01"); assert.equal(f.rancho.nombre, "Rancho inventado");
  assert.deepEqual([f.actividades.n, f.actividades.ultima, f.actividades.costo], [3, "2026-11-02", 1520.5], "lo del ciclo anterior no se mezcla");
  assert.deepEqual([f.riegos.n, f.riegos.ultimo, f.fertilizaciones.n, f.aplicaciones.n, f.gastos.total, f.cosechas], [2, "2026-11-02", 1, 1, 1200, 0], "el gasto cancelado no cuenta");
  assert.equal(f.superficie.estado, "sin_limite");
  const g = fichaDeParcela(data, "p2", "2026-11-21");
  assert.deepEqual(g.cultivo, { de: "nada", nombres: [] }); assert.equal(g.desde, null); assert.equal(g.riegos.n, 1);
  assert.equal(fichaDeParcela(data, "p1", "2026-09-15").cultivo.de, "anotado", "entre dos ciclos se dice que es el cultivo anotado, no el del ciclo");
  assert.equal(fichaDeParcela(data, "nada", "2026-11-21"), null);
  assert.equal(colorDeCultivo("Ajo"), colorDeCultivo("ajo ")); assert.equal(colorDeCultivo(""), "#FFFFFF");
});
