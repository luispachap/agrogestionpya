// El cultivo de una parcela depende de la fecha: lo que el Excel de rayas no podía hacer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cultivoEn, partesDe, parteDe, historialDeParcela, resultadoPorCultivo, siembrasEn } from "./ciclos.js";

const S = [
  { id: "s1", parcelaId: "p1", cultivoNombre: "Ajo", fechaSiembra: "2024-10-01", fechaCosechaReal: "2025-05-20", estado: "finalizada" },
  { id: "s2", parcelaId: "p1", cultivoNombre: "Maíz", fechaSiembra: "2025-06-10", fechaCosechaEstimada: "2025-11-30", estado: "activa" },
  { id: "s3", parcelaId: "p2", cultivoNombre: "Chile", variedadNombre: "Mirasol", fechaSiembra: "2025-03-01", fechaCosechaEstimada: "2025-10-30", superficie: 3, estado: "activa" },
  { id: "s4", parcelaId: "p2", cultivoNombre: "Chile", variedadNombre: "Árbol", fechaSiembra: "2025-03-15", fechaCosechaEstimada: "2025-10-30", superficie: 1, estado: "activa" },
  { id: "s5", parcelaId: "p3", cultivoNombre: "Frijol", fechaSiembra: "2025-07-01", fechaCosechaEstimada: "2025-10-15", estado: "cancelada" },
];
const costo = (monto, parcelaId, fecha, mas = {}) => ({ tipo: "costo", monto, parcelaId, fecha, ...mas });

test("el_cultivo_de_una_parcela_es_el_del_ciclo_de_esa_fecha_no_una_etiqueta_fija", () => {
  assert.equal(cultivoEn(S, "p1", "2024-12-01").cultivo, "Ajo"); assert.equal(cultivoEn(S, "p1", "2025-08-01").cultivo, "Maíz");
  assert.equal(cultivoEn(S, "p1", "2025-05-30").estado, "sin_ciclo", "entre un ciclo y otro no hay cultivo: no se supone el anterior ni el siguiente");
  assert.equal(cultivoEn(S, "p9", "2025-01-01").estado, "sin_ciclo");
});

test("un_ciclo_terminado_sigue_contando_en_sus_fechas_y_uno_cancelado_no", () => {
  assert.deepEqual(siembrasEn(S, "p1", "2025-01-15").map(s => s.id), ["s1"], "el ajo ya se cosechó, pero enero fue de ajo");
  assert.equal(cultivoEn(S, "p3", "2025-08-01").estado, "sin_ciclo");
});

test("una_parcela_que_cambio_de_cultivo_no_le_carga_lo_viejo_al_nuevo", () => {
  const r = resultadoPorCultivo([costo(1000, "p1", "2024-11-05"), costo(400, "p1", "2025-07-01"), costo(250, "p1", "2025-06-01")], S);
  const de = (c) => r.cultivos.find(x => x.cultivo === c);
  assert.equal(de("Ajo").costo, 1000); assert.equal(de("Maíz").costo, 400);
  assert.equal(r.sinCiclo.costo, 250, "lo del 1 de junio no es de ningún ciclo: queda aparte"); assert.deepEqual(r.sinCiclo.parcelas, [{ parcelaId: "p1", monto: 250, n: 1, desde: "2025-06-01", hasta: "2025-06-01" }]);
  assert.equal(r.cuadra, true); assert.equal(r.costo, 1650);
});

test("dos_ciclos_a_la_vez_reparten_el_costo_y_no_lo_duplican", () => {
  assert.deepEqual(partesDe({ parcelaId: "p2", fecha: "2025-04-01" }, S).map(p => [p.siembra.id, p.parte]), [["s3", 0.75], ["s4", 0.25]]);
  assert.equal(parteDe({ parcelaId: "p2", fecha: "2025-03-05" }, "s3", S), 1, "antes de que empezara el otro, todo es del primero");
  assert.equal(parteDe({ parcelaId: "p2", fecha: "2025-04-01", siembraId: "s4" }, "s4", S), 1, "si la persona dijo de cuál ciclo es, se respeta");
  const r = resultadoPorCultivo([costo(100.01, "p2", "2025-04-01")], S);
  assert.equal(r.cultivos.find(x => x.cultivo === "Chile").costo, 100.01, "los dos ciclos son de chile: suma exacta, ni un centavo de más");
  // Con cultivos distintos a la vez, cada uno su parte, y la suma sigue exacta.
  const mixto = [{ id: "a", parcelaId: "p5", cultivoNombre: "Ajo", fechaSiembra: "2025-01-01", fechaCosechaEstimada: "2025-12-31" }, { id: "b", parcelaId: "p5", cultivoNombre: "Avena", fechaSiembra: "2025-01-01", fechaCosechaEstimada: "2025-12-31" }, { id: "c", parcelaId: "p5", cultivoNombre: "Frijol", fechaSiembra: "2025-01-01", fechaCosechaEstimada: "2025-12-31" }];
  const m = resultadoPorCultivo([costo(100, "p5", "2025-02-01")], mixto);
  assert.deepEqual(m.cultivos.map(x => x.costo).sort(), [33.33, 33.33, 33.34]); assert.equal(m.cuadra, true);
});

test("bodega_general_y_sin_parcela_van_aparte_y_nada_se_reparte_para_que_cuadre", () => {
  const r = resultadoPorCultivo([costo(500, null, "2025-02-01", { bodegaDe: "Ajo" }), costo(300, null, "2025-02-01", { general: true }), costo(120, null, "2025-02-01"), costo(1000, "p1", "2024-12-01"), { tipo: "ingreso", monto: 9000, parcelaId: "p1", fecha: "2025-05-10" }], S);
  const ajo = r.cultivos.find(x => x.cultivo === "Ajo");
  assert.deepEqual([ajo.costo, ajo.enParcelas, ajo.enBodega, ajo.ingresos, ajo.utilidad], [1500, 1000, 500, 9000, 7500]);
  assert.equal(r.general.costo, 300); assert.equal(r.sinParcela.costo, 120); assert.equal(r.cultivos.length, 1, "lo general no sube el costo de ningún cultivo");
  assert.equal(r.cuadra, true); assert.equal(r.costo, 1920);
});

test("el_historial_de_una_parcela_ensena_sus_ciclos_sus_huecos_y_sus_traslapes", () => {
  const h = historialDeParcela(S, "p1");
  assert.deepEqual(h.ciclos.map(c => [c.cultivo, c.ini, c.fin]), [["Ajo", "2024-10-01", "2025-05-20"], ["Maíz", "2025-06-10", "2025-11-30"]]);
  assert.deepEqual(h.huecos, [{ desde: "2025-05-20", hasta: "2025-06-10" }]); assert.deepEqual(h.traslapes, []);
  const t = historialDeParcela(S, "p2"); assert.equal(t.traslapes.length, 1); assert.equal(t.traslapes[0].otroCultivo, false);
  assert.deepEqual(historialDeParcela(S, "p3").ciclos, [], "el ciclo cancelado no es historial");
});
