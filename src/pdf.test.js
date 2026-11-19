// ============================================================
//  Pruebas de la lectura de PDF
//
//  Se prueba lo que NO necesita navegador: armar los renglones a partir de
//  las posiciones, distinguir un PDF con texto de un escaneo, y partir los
//  renglones en columnas sin inventar.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { armarRenglones, armarFilas, claseDePdf, partirEnColumnas, comoHoja, columnasPorPosicion } from "./pdf.js";

/* Los pedazos que devuelve el lector: texto suelto con su posición. */
const PEDAZOS = [
  { texto: "Fecha", x: 40, y: 700 },
  { texto: "Concepto", x: 120, y: 700 },
  { texto: "Cargo", x: 320, y: 700 },
  { texto: "Saldo", x: 420, y: 700 },
  { texto: "12/08/2026", x: 40, y: 680 },
  { texto: "PAGO EL SURCO", x: 120, y: 680 },
  { texto: "27,306.40", x: 320, y: 680 },
  { texto: "92,693.60", x: 420, y: 680 },
  { texto: "15/08/2026", x: 40, y: 660 },
  { texto: "DEPOSITO CLIENTE", x: 120, y: 660 },
  { texto: "", x: 320, y: 660 },
  { texto: "272,693.60", x: 420, y: 660 },
];

test("los_pedazos_a_la_misma_altura_son_el_mismo_renglon", () => {
  // Un estado de cuenta es una tabla: si todo el texto se junta en una línea,
  // se pierde qué número va con qué movimiento.
  const r = armarRenglones(PEDAZOS);
  assert.equal(r.length, 3);
  assert.equal(r[0], "Fecha Concepto Cargo Saldo");
  assert.equal(r[1], "12/08/2026 PAGO EL SURCO 27,306.40 92,693.60");
  assert.equal(r[2], "15/08/2026 DEPOSITO CLIENTE 272,693.60");
});

test("los_renglones_salen_de_arriba_hacia_abajo_y_de_izquierda_a_derecha", () => {
  // Aunque el lector los entregue desordenados.
  const revueltos = [...PEDAZOS].reverse();
  const r = armarRenglones(revueltos);
  assert.equal(r[0], "Fecha Concepto Cargo Saldo");
  assert.ok(r[1].startsWith("12/08/2026"));
});

test("una_diferencia_de_un_pixel_no_parte_un_renglon_en_dos", () => {
  const r = armarRenglones([
    { texto: "12/08/2026", x: 40, y: 680 },
    { texto: "PAGO", x: 120, y: 681.4 },   // el lector rara vez da el mismo y exacto
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0], "12/08/2026 PAGO");
});

/* ════════════ CON TEXTO O ESCANEADO ════════════ */

test("un_pdf_con_su_texto_adentro_se_lee_exacto_sin_IA", () => {
  const c = claseDePdf({ renglones: Array(40).fill("un renglón"), paginas: 2 });
  assert.equal(c.legible, true);
  assert.equal(c.clase, "con texto");
  assert.ok(c.dice.includes("sin IA y sin señal"));
});

test("un_pdf_escaneado_NO_se_devuelve_vacio_en_silencio", () => {
  // Un escaneo es una foto metida en un PDF. Se dice qué es y qué hacer con
  // él, en vez de entregar un archivo sin movimientos.
  const c = claseDePdf({ renglones: [], paginas: 3 });
  assert.equal(c.legible, false);
  assert.equal(c.clase, "escaneado");
  assert.ok(c.dice.includes("se puede leer como foto") || c.dice.includes("Se puede leer como foto"));
});

test("dos_palabras_sueltas_del_membrete_no_hacen_legible_un_escaneo", () => {
  const c = claseDePdf({ renglones: ["BBVA", "MEXICO"], paginas: 3 });
  assert.equal(c.legible, false);
  assert.ok(c.dice.includes("parece un escaneo"));
});

test("un_estado_de_un_mes_flojo_NO_se_confunde_con_un_escaneo", () => {
  // Cinco movimientos son pocos renglones y un archivo perfectamente bueno.
  // Rechazarlo por eso sería tirar un estado de cuenta legítimo.
  const c = claseDePdf({ renglones: Array(7).fill("un renglón"), paginas: 1 });
  assert.equal(c.legible, true);
});

/* ════════════ DE RENGLONES A COLUMNAS ════════════ */

test("las_columnas_salen_de_los_espacios_grandes", () => {
  const filas = partirEnColumnas(["12/08/2026   PAGO EL SURCO    27,306.40   92,693.60"]);
  assert.deepEqual(filas[0], ["12/08/2026", "PAGO EL SURCO", "27,306.40", "92,693.60"]);
});

test("un_renglon_que_no_se_puede_partir_se_deja_tal_cual", () => {
  // Es preferible que el archivo no cuadre y se rechace, a partirlo mal y
  // creerle.
  const filas = partirEnColumnas(["texto corrido sin columnas"]);
  assert.equal(filas[0].length, 1);
  assert.equal(filas[0][0], "texto corrido sin columnas");
});

test("un_pdf_de_banco_queda_con_la_misma_forma_que_un_excel", () => {
  // Así banco.js no nota la diferencia y aplica la MISMA validación
  // aritmética a los dos.
  const h = comoHoja([
    "BBVA MEXICO",
    "Cuenta 0123456789014417",
    "Fecha   Concepto   Cargo   Abono   Saldo",
    "12/08/2026   PAGO EL SURCO   27,306.40      92,693.60",
  ]);
  assert.equal(h.renglonEncabezado, 2);
  assert.deepEqual(h.encabezados, ["Fecha", "Concepto", "Cargo", "Abono", "Saldo"]);
  assert.equal(h.filas.length, 1);
  assert.equal(h.filas[0][0], "12/08/2026");
  assert.ok(h.porque.includes("Se saltaron 2"));
});

/* ════════════ LAS COLUMNAS SALEN DE LA GEOMETRÍA, NO DE LOS ESPACIOS ════════════ */

test("las_columnas_salen_de_donde_estaban_en_la_hoja", () => {
  // El PDF ya trae la posición X de cada celda: ésa es la información de
  // columnas de verdad. Contarle los espacios a un texto ya colapsado es
  // adivinar algo que el archivo decía exacto.
  const filas = armarFilas([
    { texto: "Fecha", x: 40, y: 700 }, { texto: "Concepto", x: 120, y: 700 },
    { texto: "Cargo", x: 320, y: 700 }, { texto: "Abono", x: 400, y: 700 }, { texto: "Saldo", x: 480, y: 700 },
    { texto: "12/08/2026", x: 40, y: 680 }, { texto: "PAGO EL SURCO", x: 120, y: 680 },
    { texto: "27,306.40", x: 322, y: 680 }, { texto: "92,693.60", x: 478, y: 680 },
    { texto: "15/08/2026", x: 40, y: 660 }, { texto: "DEPOSITO CLIENTE", x: 120, y: 660 },
    { texto: "180,000.00", x: 398, y: 660 }, { texto: "272,693.60", x: 476, y: 660 },
  ]);
  const h = comoHoja(filas);
  assert.deepEqual(h.encabezados, ["Fecha", "Concepto", "Cargo", "Abono", "Saldo"]);
  // El cargo cae en su columna y el abono en la suya, aunque el renglón traiga
  // huecos: un renglón de cargo NO tiene abono.
  assert.deepEqual(h.filas[0], ["12/08/2026", "PAGO EL SURCO", "27,306.40", "", "92,693.60"]);
  assert.deepEqual(h.filas[1], ["15/08/2026", "DEPOSITO CLIENTE", "", "180,000.00", "272,693.60"]);
});

test("los_importes_alineados_a_la_derecha_caen_en_su_columna", () => {
  // Cualquier banco alinea los importes a la derecha: el número empieza a la
  // izquierda del encabezado y aun así es de esa columna.
  const filas = armarFilas([
    { texto: "Fecha", x: 40, y: 700 }, { texto: "Cargo", x: 300, y: 700 }, { texto: "Saldo", x: 450, y: 700 },
    { texto: "12/08/2026", x: 40, y: 680 }, { texto: "27,306.40", x: 260, y: 680 }, { texto: "92,693.60", x: 405, y: 680 },
  ]);
  const h = comoHoja(filas);
  assert.deepEqual(h.filas[0], ["12/08/2026", "27,306.40", "92,693.60"]);
});

test("si_el_pdf_entrega_el_renglon_de_una_pieza_se_cae_al_plan_B", () => {
  // Algunos generadores mandan la línea completa como un solo pedazo. Ahí no
  // hay posiciones que usar y se parte por los espacios grandes.
  const filas = armarFilas([
    { texto: "Fecha        Concepto        Cargo        Saldo", x: 40, y: 700 },
    { texto: "12/08/2026   PAGO EL SURCO   27,306.40    92,693.60", x: 40, y: 680 },
  ]);
  const h = comoHoja(filas);
  assert.deepEqual(h.encabezados, ["Fecha", "Concepto", "Cargo", "Saldo"]);
  assert.deepEqual(h.filas[0], ["12/08/2026", "PAGO EL SURCO", "27,306.40", "92,693.60"]);
});
