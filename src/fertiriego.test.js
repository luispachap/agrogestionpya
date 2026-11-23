// ============================================================
//  Pruebas de las hojas de fertirriego de Fito
//
//  Los datos de aquí son los de sus hojas de verdad, las que mandó al grupo:
//  Parcela 53 (CHILE MIRASOL, 11 ha) y Parcela GABINO (CHILE MIRASOL, 10 ha).
//
//  El hilo de todas: la tabla se valida sola. Un dígito mal leído rompe la
//  multiplicación, y ahí la hoja se detiene en vez de mandar a fertilizar con
//  una cifra inventada.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FERTILIZANTES, canonico, leerFertiriego, validarFertiriego,
  alcanzaParaLaAplicacion, indicacionDesdeHoja,
} from "./fertiriego.js";

/* La hoja de la parcela 53, tal como viene: 11 hectáreas. */
const HOJA_53 = [
  ["Fertiriego en el cultivo de:", "CHILE MIRASOL", "Superficie en Ha:", "11"],
  ["Parcela:", "53", "Fecha:", "17/07/2026"],
  ["Fertilizantes", "Dosis kg/ha", "Fertilizante total", "Productos Extras", "Dosis/ha:Lt o Kg", "Producto total"],
  ["Fosfonitrato", "20", "220", "infinito", "1", "0"],
  ["S.Amonio", "", "0", "serenade", "3", "0"],
  ["MAP", "", "0", "barrier", "5", "0"],
  ["S.Potasio", "", "0"],
  ["S. Magnesio", "20", "220"],
  ["N. Calcio", "25", "275"],
  ["Cl. Potasio", "", "0"],
  ["NKS", "", "0"],
  ["UREA", "", "0"],
  ["MKP", "40", "440"],
  ["MicroMix", "", "0"],
];

/* La de GABINO: 10 hectáreas, y ahí los extras SÍ traen total. */
const HOJA_GABINO = [
  ["Fertiriego en el cultivo de:", "CHILE MIRASOL", "Superficie en Ha:", "10"],
  ["Parcela:", "GABINO", "Fecha:", "17/07/2026"],
  ["Fertilizantes", "Dosis kg/ha", "Fertilizante total", "Productos Extras", "Dosis/ha:Lt o Kg", "Producto total"],
  ["Fosfonitrato", "20", "200", "infinito", "1", "10"],
  ["S.Amonio", "", "0", "serenade", "3", "30"],
  ["MAP", "", "0", "barrier", "5", "50"],
  ["S.Potasio", "", "0"],
  ["S. Magnesio", "20", "200"],
  ["N. Calcio", "40", "400"],
  ["Cl. Potasio", "", "0"],
  ["NKS", "", "0"],
  ["UREA", "", "0"],
  ["MKP", "30", "300"],
  ["MicroMix", "", "0"],
];

const copiar = (filas) => filas.map(f => [...f]);

/* ════════════ RECONOCER LOS FERTILIZANTES ════════════ */

test("los_once_de_fito_estan_completos", () => {
  assert.equal(FERTILIZANTES.length, 11);
  assert.equal(FERTILIZANTES[0], "Fosfonitrato");
  assert.equal(FERTILIZANTES[10], "MicroMix");
});

test("reconoce_el_fertilizante_aunque_lo_escriban_distinto", () => {
  // De una foto sale con puntos, sin puntos, o con el nombre completo.
  assert.equal(canonico("S.Magnesio"), "S. Magnesio");
  assert.equal(canonico("S. MAGNESIO"), "S. Magnesio");
  assert.equal(canonico("sulfato de magnesio"), "S. Magnesio");
  assert.equal(canonico("N.Calcio"), "N. Calcio");
  assert.equal(canonico("cl. potasio"), "Cl. Potasio");
});

test("lo_que_no_es_de_la_lista_no_se_fuerza", () => {
  // "serenade" es un producto extra, no un fertilizante. Meterlo a la fuerza
  // en la lista de los once lo haría entrar por la columna equivocada.
  assert.equal(canonico("serenade"), null);
  assert.equal(canonico("infinito"), null);
  assert.equal(canonico(""), null);
});

/* ════════════ LEER LA HOJA ════════════ */

test("lee_la_cabecera_de_la_hoja_de_fito", () => {
  const h = leerFertiriego(HOJA_53);
  assert.equal(h.ok, true);
  assert.equal(h.cultivo, "CHILE MIRASOL");
  assert.equal(h.superficie, 11);
  assert.equal(h.parcela, "53");
  assert.equal(h.fecha, "2026-07-17");   // 17/07, no 07/17: aquí el día va primero
  assert.equal(h.completa, true);
});

test("lee_los_once_renglones_con_sus_dos_numeros", () => {
  const h = leerFertiriego(HOJA_53);
  assert.equal(h.reconocidos, 11);
  assert.equal(h.noSalieron.length, 0);

  const mkp = h.fertilizantes.find(f => f.nombre === "MKP");
  assert.equal(mkp.dosis, 40);
  assert.equal(mkp.total, 440);
  assert.equal(mkp.seAplica, true);
});

test("un_renglon_en_blanco_es_un_cero_de_verdad_no_un_dato_faltante", () => {
  // S.Amonio sin dosis y con total 0 quiere decir que no se aplica. Eso no se
  // pregunta: se sabe.
  const h = leerFertiriego(HOJA_53);
  const amonio = h.fertilizantes.find(f => f.nombre === "S.Amonio");
  assert.equal(amonio.seAplica, false);
  assert.equal(amonio.total, 0);
});

test("lee_los_productos_extras_de_las_columnas_de_la_derecha", () => {
  const h = leerFertiriego(HOJA_53);
  assert.equal(h.extras.length, 3);
  assert.deepEqual(h.extras.map(e => e.nombre), ["infinito", "serenade", "barrier"]);
  assert.equal(h.extras[1].dosis, 3);
});

test("el_encabezado_de_la_tabla_no_se_confunde_con_un_producto", () => {
  const h = leerFertiriego(HOJA_53);
  assert.ok(!h.extras.some(e => /PRODUCTOS/i.test(e.nombre)));
});

test("lee_igual_cuando_la_hoja_viene_como_renglones_de_texto", () => {
  // Así sale de un PDF o de una foto transcrita: sin celdas, con espacios.
  const h = leerFertiriego([
    "Fertiriego en el cultivo de:  CHILE MIRASOL   Superficie en Ha:  11",
    "Parcela:  53    Fecha:  17/07/2026",
    "Fosfonitrato   20   220",
    "S. Magnesio   20   220",
    "N. Calcio   25   275",
    "MKP   40   440",
  ]);
  assert.equal(h.ok, true);
  assert.equal(h.superficie, 11);
  assert.equal(h.parcela, "53");
  assert.equal(h.fertilizantes.length, 4);
});

test("lo_que_no_es_una_hoja_de_fertirriego_se_rechaza_de_entrada", () => {
  const h = leerFertiriego([["Factura", "A-123"], ["Total", "5000"]]);
  assert.equal(h.ok, false);
  assert.ok(h.porque.includes("no parece"));
});

/* ════════════ LA VALIDACIÓN QUE DECIDE ════════════ */

test("la_hoja_de_fito_cuadra_al_kilo", () => {
  // 20×11=220, 25×11=275, 40×11=440. Es la tabla real.
  const v = validarFertiriego(leerFertiriego(HOJA_53));
  assert.equal(v.confiable, true);
  assert.equal(v.renglonMalo, null);
  // Sólo los cuatro que traen dosis: los otros siete están en blanco y no hay
  // nada que multiplicar en ellos.
  assert.equal(v.revisados, 4);
});

test("la_de_gabino_tambien_cuadra_con_sus_diez_hectareas", () => {
  const v = validarFertiriego(leerFertiriego(HOJA_GABINO));
  assert.equal(v.confiable, true);
  // Y sus extras traen total: 1×10=10, 3×10=30, 5×10=50.
  assert.equal(v.avisos.length, 0);
});

test("UN_DIGITO_MAL_LEIDO_ROMPE_LA_MULTIPLICACION_Y_SE_VE", () => {
  // Ésta es la razón de ser del archivo. La foto se leyó y N. Calcio salió
  // 175 en vez de 275. Si nadie multiplica, se van a aplicar 100 kg de menos
  // en 11 hectáreas y nadie se entera hasta que la planta lo diga.
  const chueca = copiar(HOJA_53);
  chueca[8] = ["N. Calcio", "25", "175"];

  const v = validarFertiriego(leerFertiriego(chueca));
  assert.equal(v.confiable, false);
  assert.equal(v.renglonMalo.nombre, "N. Calcio");
  assert.equal(v.renglonMalo.totalQueDice, 175);
  assert.equal(v.renglonMalo.totalQueDeberia, 275);
  assert.ok(v.porque.includes("NO entra"));
});

test("tambien_atrapa_el_error_en_la_dosis_no_solo_en_el_total", () => {
  const chueca = copiar(HOJA_53);
  chueca[12] = ["MKP", "10", "440"];   // 10×11=110, no 440
  const v = validarFertiriego(leerFertiriego(chueca));
  assert.equal(v.confiable, false);
  assert.equal(v.renglonMalo.nombre, "MKP");
});

test("sin_superficie_NO_se_da_por_buena_la_hoja", () => {
  // Sin las hectáreas no hay con qué multiplicar, y sin comprobar no entra.
  // Es lo mismo que el estado de cuenta sin saldo inicial.
  const sinHa = copiar(HOJA_53);
  sinHa[0] = ["Fertiriego en el cultivo de:", "CHILE MIRASOL"];
  const v = validarFertiriego(leerFertiriego(sinHa));
  assert.equal(v.confiable, false);
  assert.ok(v.porque.includes("superficie"));
});

test("una_hoja_cortada_lo_dice_en_vez_de_completar_con_ceros", () => {
  // La foto salió a media tabla. Los que no salieron NO se dan por no
  // aplicados: se dice que no salieron.
  const cortada = HOJA_53.slice(0, 8);
  const h = leerFertiriego(cortada);
  const v = validarFertiriego(h);
  assert.equal(v.confiable, true);              // lo que sí se leyó, cuadra
  assert.ok(h.noSalieron.includes("MKP"));
  assert.ok(v.avisos.some(a => a.includes("NO se dan por no aplicados")));
  assert.equal(h.completa, false);
});

test("un_extra_con_dosis_y_total_en_cero_se_avisa_no_se_rechaza", () => {
  // En la hoja de la parcela 53, Fito dejó los totales de los extras en cero.
  // Eso es una celda sin llenar, no un error de lectura.
  const v = validarFertiriego(leerFertiriego(HOJA_53));
  assert.equal(v.confiable, true);
  assert.ok(v.avisos.some(a => a.includes("Pregúntale")));
});

test("una_hoja_ilegible_no_se_valida_a_ciegas", () => {
  const v = validarFertiriego({ ok: false, porque: "No se pudo leer." });
  assert.equal(v.confiable, false);
  assert.equal(v.revisados, 0);
});

/* ════════════ ¿HAY CON QUÉ APLICARLO? ════════════ */

const BODEGA = [
  { id: "i1", nombre: "Fosfonitrato", unidad: "kg", existencia: 500, costo_unit: 14 },
  { id: "i2", nombre: "S. Magnesio", unidad: "kg", existencia: 100, costo_unit: 22 },
  { id: "i3", nombre: "N. Calcio", unidad: "kg", existencia: 0, costo_unit: 19 },
  { id: "i4", nombre: "MKP", unidad: "kg", existencia: 1000, costo_unit: 0 },
];

test("dice_lo_que_falta_y_cuanto_costaria_reponerlo", () => {
  const r = alcanzaParaLaAplicacion({ hoja: leerFertiriego(HOJA_53), inventario: BODEGA });

  const mag = r.filas.find(f => f.nombre === "S. Magnesio");
  assert.equal(mag.alcanza, false);
  assert.equal(mag.falta, 120);                    // se piden 220, hay 100
  assert.equal(mag.costoDeReponer, 2640);          // 120 × 22

  const cal = r.filas.find(f => f.nombre === "N. Calcio");
  assert.equal(cal.falta, 275);
  assert.equal(r.costoTotal, 2640 + 275 * 19);
});

test("no_saber_si_hay_NO_es_lo_mismo_que_no_haber", () => {
  // "serenade" no está en el catálogo. Decir "no alcanza" sería afirmar algo
  // que nadie miró.
  const r = alcanzaParaLaAplicacion({ hoja: leerFertiriego(HOJA_GABINO), inventario: BODEGA });
  const ser = r.filas.find(f => f.nombre === "serenade");
  assert.equal(ser.alcanza, null);
  assert.ok(ser.dice.includes("no se sabe si hay"));
  assert.ok(ser.dice.includes("No quiere decir que no haya"));
});

test("sin_costo_no_se_inventa_cuanto_cuesta_reponerlo", () => {
  const bodegaCorta = [{ id: "i4", nombre: "MKP", unidad: "kg", existencia: 10, costo_unit: 0 }];
  const r = alcanzaParaLaAplicacion({ hoja: leerFertiriego(HOJA_53), inventario: bodegaCorta });
  const mkp = r.filas.find(f => f.nombre === "MKP");
  assert.equal(mkp.falta, 430);
  assert.equal(mkp.costoDeReponer, null);
  assert.ok(mkp.dice.includes("No se sabe el costo"));
});

test("faltar_insumo_NUNCA_impide_mandar_la_indicacion", () => {
  // Que falte un saco lo resuelve quien compra. Bloquear la indicación sólo
  // lograría que la aplicación se planee fuera del sistema.
  const r = alcanzaParaLaAplicacion({ hoja: leerFertiriego(HOJA_53), inventario: BODEGA });
  assert.equal(r.bloquea, false);
  assert.ok(r.dice.includes("se puede mandar igual"));
});

test("cuando_hay_de_todo_lo_dice_sin_rodeos", () => {
  const bodegaLlena = FERTILIZANTES.map((n, i) => ({ id: `x${i}`, nombre: n, existencia: 99999, costo_unit: 10 }));
  const soloFert = copiar(HOJA_53).map(f => f.slice(0, 3));
  const r = alcanzaParaLaAplicacion({ hoja: leerFertiriego(soloFert), inventario: bodegaLlena });
  assert.equal(r.faltantes.length, 0);
  assert.equal(r.sinSaber.length, 0);
  assert.equal(r.dice, "Hay de todo lo que pide la hoja.");
});

/* ════════════ LA INDICACIÓN ════════════ */

const PARCELAS = [
  { id: "p1", nombre: "53" },
  { id: "p2", nombre: "Gabino" },
  { id: "p3", nombre: "Naranjo 1 Bodega" },
];

test("arma_la_indicacion_con_la_parcela_del_catalogo", () => {
  const ind = indicacionDesdeHoja({ hoja: leerFertiriego(HOJA_53), parcelas: PARCELAS });
  assert.equal(ind.parcelaId, "p1");
  assert.equal(ind.parcelaReconocida, true);
  assert.equal(ind.fecha, "2026-07-17");
  assert.equal(ind.deQuien, "Fito");
  // Sólo lo que de verdad se aplica: los ceros no van en la indicación.
  assert.deepEqual(ind.productos.map(p => p.nombre),
    ["Fosfonitrato", "S. Magnesio", "N. Calcio", "MKP", "infinito", "serenade", "barrier"]);
});

test("reconoce_la_parcela_aunque_este_escrita_distinto", () => {
  const ind = indicacionDesdeHoja({ hoja: leerFertiriego(HOJA_GABINO), parcelas: PARCELAS });
  assert.equal(ind.parcelaId, "p2");   // "GABINO" contra "Gabino"
});

test("una_parcela_que_no_esta_en_el_catalogo_se_dice_no_se_inventa", () => {
  // Mandar una indicación a una parcela que no existe es mandarla a nadie.
  const otra = copiar(HOJA_53);
  otra[1] = ["Parcela:", "R7", "Fecha:", "17/07/2026"];
  const ind = indicacionDesdeHoja({ hoja: leerFertiriego(otra), parcelas: PARCELAS });
  assert.equal(ind.parcelaReconocida, false);
  assert.equal(ind.parcelaId, null);
  assert.equal(ind.parcelaNombre, "R7");
});

test("el_resumen_se_lee_de_un_vistazo_en_el_telefono", () => {
  const ind = indicacionDesdeHoja({ hoja: leerFertiriego(HOJA_GABINO), parcelas: PARCELAS });
  assert.ok(ind.resumen.includes("Gabino"));
  assert.ok(ind.resumen.includes("CHILE MIRASOL"));
  assert.ok(ind.resumen.includes("10 ha"));
  assert.ok(ind.resumen.includes("Fosfonitrato 200"));
});

test("la_urea_del_catalogo_se_encuentra_aunque_se_llame_urea_46_00_00_y_si_hay_dos_no_se_escoge_ninguna", () => {
  const hoja = { ok: true, fertilizantes: [{ nombre: "UREA", dosis: 20, total: 40 }, { nombre: "MAP", dosis: 10, total: 20 }], extras: [] };
  const r = alcanzaParaLaAplicacion({ hoja, inventario: [{ id: "u", nombre: "Urea 46-00-00", existencia: 8 }, { id: "m1", nombre: "MAP 11-52-00", existencia: 30 }, { id: "m2", nombre: "MAP soluble", existencia: 5 }] });
  const de = (n) => r.filas.find(f => f.nombre === n);
  assert.equal(de("UREA").insumoId, "u"); assert.equal(de("UREA").falta, 32);
  assert.equal(de("MAP").insumoId, null, "dos MAP en el catálogo: no se adivina cuál");
  assert.match(de("MAP").dice, /podría ser «MAP 11-52-00» o «MAP soluble»/);
});
