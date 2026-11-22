// ============================================================
//  Pruebas del almacén
//
//  Dos hilos: el vale NUNCA bloquea una salida que ya ocurrió, y nada se
//  ajusta solo — ni el costo, ni el saldo, ni la merma.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  costoDeSalida, valeDeSalida, clasificarAjuste, resumenMermas,
  compararConteo, loQueFaltaContar, CAUSAS_MERMA,
  costoAFinanzas, loQueEntroCuesta,
} from "./almacen.js";

// Urea a $868: el promedio de los 10 bultos de marzo a $580 y los 40 de
// agosto a $940. Ése es el costo que debe cargar una salida.
const UREA = { id: "i1", nombre: "Urea 46-00-00", unidad: "bulto", existencia: 50, costo_unit: 868 };
const SIN_COSTO = { id: "i2", nombre: "Manguera", unidad: "pieza", existencia: 3, costo_unit: 0 };

/* ════════════ LO QUE CUESTA LO QUE SALE ════════════ */

test("la_salida_carga_el_promedio_no_el_ultimo_precio", () => {
  // "Salen 40 bultos a la parcela 7 — ¿cargó $23,200 o $37,600?" Ninguno de
  // los dos: el promedio de lo que de verdad hay en la bodega.
  const c = costoDeSalida({ insumo: UREA, cantidad: 40 });
  assert.equal(c.costoUnit, 868);
  assert.equal(c.costoTotal, 34720);
  assert.equal(c.completo, true);
  assert.ok(c.porque.includes("costo promedio"));
});

test("sin_costo_registrado_NO_se_inventa_uno_para_cargarle_a_la_parcela", () => {
  // Un costo inventado se arrastra a todas las parcelas del año.
  const c = costoDeSalida({ insumo: SIN_COSTO, cantidad: 2 });
  assert.equal(c.costoUnit, null);
  assert.equal(c.costoTotal, null);
  assert.equal(c.completo, false);
  assert.ok(c.porque.includes("no hay costo registrado"));
});

/* ════════════ EL VALE NUNCA BLOQUEA ════════════ */

test("el_vale_NO_bloquea_una_salida_que_ya_ocurrio", () => {
  // Almacén a las seis de la mañana, la camioneta esperando. El producto ya
  // salió: negarlo en la app no lo devuelve al estante, sólo logra que nadie
  // capture y que el sistema se vuelva mentira.
  const v = valeDeSalida({ insumo: UREA, cantidad: 80, destino: "parcela", destinoId: "R07", quien: "Fito" });
  assert.equal(v.sirve, true);
  assert.equal(v.bloquea, false);          // NUNCA
  assert.equal(v.vale.cantidad, 80);
  assert.equal(v.vale.dejaNegativo, true);
  // Pero avisa, y explica por qué el negativo es información.
  assert.ok(v.avisos.some(a => a.includes("hay 50") && a.includes("sacando 80")));
  assert.ok(v.avisos.some(a => a.includes("Ese negativo es información")));
});

test("un_vale_sin_destino_se_guarda_pero_lo_dice", () => {
  const v = valeDeSalida({ insumo: UREA, cantidad: 10, quien: "Fito" });
  assert.equal(v.sirve, true);
  assert.ok(v.avisos.some(a => a.includes("No se dijo a dónde va")));
  assert.equal(v.vale.destino, null);
});

test("un_vale_sin_cantidad_no_es_un_vale", () => {
  const v = valeDeSalida({ insumo: UREA, cantidad: null, destino: "parcela" });
  assert.equal(v.sirve, false);
  assert.equal(v.bloquea, false);
  assert.equal(v.vale, null);
});

test("el_vale_normal_carga_su_costo_y_no_avisa_de_mas", () => {
  const v = valeDeSalida({ insumo: UREA, cantidad: 10, destino: "parcela", destinoId: "R07", quien: "Fito" });
  assert.deepEqual(v.avisos, []);
  assert.equal(v.vale.costoTotal, 8680);
  assert.equal(v.vale.dejaNegativo, false);
});

/* ════════════ MERMAS CON NOMBRE ════════════ */

test("un_ajuste_sin_causa_no_se_registra", () => {
  // "Ajuste −30 bultos" sin decir por qué es dinero que se fue sin que nadie
  // explicara nada, y en dos meses es costumbre.
  const a = clasificarAjuste({ delta: -30 });
  assert.equal(a.sirve, false);
  assert.ok(a.porque.includes("Falta la causa"));
  assert.ok(a.porque.includes("en dos meses es costumbre"));
});

test("no_se_sabe_es_una_causa_valida_y_honesta", () => {
  // Dejarlo en blanco no lo es. Pero "no se sabe" se marca aparte, porque es
  // justo lo que hay que bajar.
  const a = clasificarAjuste({ delta: -30, causa: "no se sabe" });
  assert.equal(a.sirve, true);
  assert.equal(a.sinExplicar, true);
  assert.ok(CAUSAS_MERMA.includes("no se sabe"));
});

test("una_merma_con_causa_de_verdad_no_cuenta_como_sin_explicar", () => {
  const a = clasificarAjuste({ delta: -30, causa: "caducó", nota: "Lote de 2024" });
  assert.equal(a.sirve, true);
  assert.equal(a.sinExplicar, false);
  assert.ok(a.porque.includes("Faltaron 30"));
});

test("el_resumen_separa_lo_que_no_se_explico", () => {
  const r = resumenMermas({
    insumos: [UREA],
    movimientos: [
      { esAjuste: true, insumoId: "i1", cantidad: -10, causa: "caducó" },
      { esAjuste: true, insumoId: "i1", cantidad: -30, causa: "no se sabe" },
      { esAjuste: false, insumoId: "i1", cantidad: -5 },   // una salida normal, no cuenta
    ],
  });
  assert.equal(r.cuantos, 2);
  assert.equal(r.porCausa["caducó"], 8680);
  assert.equal(r.sinSaber, 26040);
  assert.ok(r.dice.includes("ése es el que hay que bajar"));
});

/* ════════════ EL CONTEO A CIEGAS ════════════ */

test("el_conteo_se_compara_DESPUES_y_el_saldo_no_se_ajusta_solo", () => {
  // El conteo en que el capturista ve el saldo del sistema no es un conteo,
  // es una copia.
  const c = compararConteo({ contado: 45, insumo: UREA });
  assert.equal(c.contado, 45);
  assert.equal(c.sistema, 50);
  assert.equal(c.diferencia, -5);
  assert.equal(c.ajustaSolo, false);
  assert.ok(c.porque.includes("el ajuste lleva causa"));
});

test("un_conteo_que_cuadra_lo_dice_sin_alarmar", () => {
  const c = compararConteo({ contado: 50, insumo: UREA });
  assert.equal(c.cuadra, true);
  assert.ok(c.porque.includes("Cuadra"));
});

test("sin_capturar_lo_contado_no_hay_comparacion", () => {
  assert.equal(compararConteo({ contado: null, insumo: UREA }).hay, false);
});

test("un_insumo_que_nunca_se_ha_contado_tiene_un_saldo_que_es_suposicion", () => {
  const r = loQueFaltaContar({
    insumos: [UREA, SIN_COSTO],
    conteos: [{ insumoId: "i1", fecha: "2026-09-01" }],
    hoy: "2026-09-08",
  });
  assert.equal(r.nunca.length, 1);
  assert.equal(r.nunca[0].insumo.id, "i2");
  assert.ok(r.dice.includes("es una suposición, no un dato"));
  // El que sí se contó hace una semana no toca todavía.
  assert.equal(r.tocan.length, 1);
});

test("un_conteo_viejo_vuelve_a_tocar", () => {
  const r = loQueFaltaContar({
    insumos: [UREA],
    conteos: [{ insumoId: "i1", fecha: "2026-01-01" }],
    hoy: "2026-09-08", cadaDias: 90,
  });
  assert.equal(r.tocan.length, 1);
  assert.equal(r.nunca.length, 0);
  assert.equal(r.filas[0].dias, 250);
});

/* ════════════ QUÉ DE UNA ENTRADA ES DINERO ════════════ */
/* Tres bugs de dinero, callados los tres, y las pruebas que los fijan. */

test("UNA_COMPRA_NO_SE_CUENTA_DOS_VECES", () => {
  // Las pantallas de compra escriben un egreso Y una entrada de inventario con
  // el mismo importe. Si los totales suman las dos, cada saco cuesta el doble
  // en el reporte y la utilidad sale menor de lo que es.
  const yaContada = { cantidad: 40, costo_total: 34720, yaEsEgreso: true };
  assert.equal(costoAFinanzas(yaContada), 0);
  assert.equal(loQueEntroCuesta([yaContada]).total, 0);
});

test("UNA_SALIDA_NO_ES_UN_EGRESO_NEGATIVO", () => {
  // El movimiento de un vale se guarda con cantidad negativa y por lo tanto
  // con costo negativo. Sumarlo BAJABA los egresos: sacar producto de la
  // bodega hacía ver el año más rentable de lo que fue. Y no es un gasto
  // nuevo — el dinero se fue cuando se compró.
  assert.equal(costoAFinanzas({ cantidad: -40, costo_total: -34720 }), 0);
  const r = loQueEntroCuesta([
    { cantidad: 40, costo_total: 34720 },
    { cantidad: -40, costo_total: -34720 },
  ]);
  assert.equal(r.total, 34720);   // no 0, y tampoco 69440
});

test("UN_CONTEO_A_CIEGAS_NO_VUELVE_NaN_LA_UTILIDAD", () => {
  // Los renglones de conteo no traen costo_total, y `suma + undefined` es NaN.
  // Un solo conteo en la bodega y la pantalla de finanzas dejaba de enseñar
  // números — sin error, sin aviso, sólo NaN.
  const conConteo = [
    { cantidad: 40, costo_total: 34720 },
    { esConteo: true, esAjuste: true, cantidad: -3, causa: "merma" },
    { esConteo: true, esAjuste: false, cantidad: 0 },
  ];
  const t = loQueEntroCuesta(conConteo).total;
  assert.ok(Number.isFinite(t), `salió ${t}`);
  assert.equal(t, 34720);
  // Y el reduce ingenuo que había antes, para que se vea la diferencia:
  assert.ok(Number.isNaN(conConteo.reduce((s, e) => s + e.costo_total, 0)));
});

test("una_entrada_sin_costo_no_desaparece_del_aviso", () => {
  // Para la SUMA vale cero, pero quien mira el total tiene que enterarse de
  // que va corto. Un total incompleto que no lo dice es como se aprueba un
  // presupuesto que no alcanza.
  const r = loQueEntroCuesta([{ cantidad: 40, costo_total: 34720 }, { cantidad: 10 }]);
  assert.equal(r.completo, false);
  assert.equal(r.sinCosto.length, 1);
  assert.ok(r.dice.includes("No es que hayan costado cero"));
});

test("cuando_todo_trae_costo_no_inventa_un_aviso", () => {
  const r = loQueEntroCuesta([{ cantidad: 40, costo_total: 34720 }]);
  assert.equal(r.completo, true);
  assert.equal(r.dice, null);
  assert.equal(r.total, 34720);
});

test("sin_entradas_da_cero_sin_truenar", () => {
  assert.equal(loQueEntroCuesta([]).total, 0);
  assert.equal(loQueEntroCuesta(null).total, 0);
  assert.equal(costoAFinanzas(null), 0);
});

import { revisarArticulo } from "./almacen.js";
test("un_articulo_sin_nombre_o_repetido_no_se_da_de_alta", () => {
  assert.equal(revisarArticulo({ nombre: "  ", unidad: "kg" }, []).ok, false);
  assert.equal(revisarArticulo({ nombre: "Urea", unidad: "" }, []).ok, false);
  const r = revisarArticulo({ nombre: " Urea ", unidad: " bulto " }, []);
  assert.deepEqual([r.ok, r.nombre, r.unidad], [true, "Urea", "bulto"]);
  const rep = revisarArticulo({ nombre: "UREÁ  46", unidad: "kg" }, [{ id: "i1", nombre: "urea 46" }]);
  assert.equal(rep.ok, false); assert.match(rep.dice, /urea 46/);
  assert.equal(revisarArticulo({ id: "i1", nombre: "Urea 46", unidad: "kg" }, [{ id: "i1", nombre: "urea 46" }]).ok, true, "editar el mismo artículo no choca consigo");
});
