// ============================================================
//  Pruebas de la captura por voz
//
//  El hilo: entiende y PROPONE, nunca guarda solo. Y lo que no entendió no
//  lo tira — lo guarda como nota, para que nadie pierda lo que dijo.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  numeroDicho, numerosDichos, aQuienesSeRefiere, deQueParcela,
  partirEnDichos, clasificarDicho, entenderLoDicho,
} from "./voz.js";

const GENTE = [
  { id: "t1", nombre: "Juan Pérez" },
  { id: "t2", nombre: "Pedro Ramírez" },
  { id: "t3", nombre: "Salvador Núñez", apodo: "El Chato" },
];
const PARCELAS = [
  { id: "p1", nombre: "San Felipe 1" },
  { id: "p2", nombre: "El 50" },
];

/* Como habla Gera de verdad: tres cosas distintas en un mismo audio. */
const LO_QUE_DIJO = "Hoy en San Felipe 1 anduvieron Juan, Pedro y el Chato regando ocho horas. " +
  "También se compraron doscientos litros de diésel en la gasolinera de la entrada, tres mil ochocientos pesos. " +
  "Y hace falta un filtro para el tractor 3, ya está sonando feo.";

/* ════════════ NÚMEROS DICHOS CON LA BOCA ════════════ */

test("tres_mil_ochocientos_son_3800", () => {
  // Un gasto que quedó en null porque decía "tres mil" es un gasto perdido.
  assert.equal(numeroDicho("tres mil ochocientos"), 3800);
  assert.equal(numeroDicho("doscientos"), 200);
  assert.equal(numeroDicho("mil quinientos cincuenta"), 1550);
  assert.equal(numeroDicho("veinticinco"), 25);
  assert.equal(numeroDicho("un millón doscientos mil"), 1200000);
});

test("una_cifra_normal_tambien_se_entiende", () => {
  assert.equal(numeroDicho("3800"), 3800);
  assert.equal(numeroDicho("doscientos 50"), 250);
});

test("lo_que_no_trae_ningun_numero_devuelve_null", () => {
  assert.equal(numeroDicho("hace falta un filtro"), 1);   // "un" sí es número
  assert.equal(numeroDicho("sonando feo"), null);
  assert.equal(numeroDicho(""), null);
});

test("cada_numero_se_queda_con_lo_que_dice_a_su_lado", () => {
  const ns = numerosDichos("se compraron doscientos litros de diésel, tres mil ochocientos pesos");
  const litros = ns.find(n => n.unidad === "litros");
  const pesos = ns.find(n => n.unidad === "pesos");
  assert.equal(litros.valor, 200);
  assert.equal(pesos.valor, 3800);
});

/* ════════════ A QUIÉN SE REFIERE ════════════ */

test("reconoce_a_la_gente_por_su_nombre_y_por_su_apodo", () => {
  const r = aQuienesSeRefiere("anduvieron Juan, Pedro y el Chato regando", GENTE);
  assert.equal(r.personas.length, 3);
  assert.ok(r.personas.some(p => p.id === "t3"));   // por el apodo
  assert.equal(r.ambiguos.length, 0);
});

test("si_hay_dos_con_el_mismo_nombre_NO_elige", () => {
  // Meterle un día de trabajo al que no fue es un problema de nómina y de
  // confianza.
  const dosJuanes = [...GENTE, { id: "t9", nombre: "Juan Hernández" }];
  const r = aQuienesSeRefiere("anduvo Juan regando", dosJuanes);
  assert.equal(r.ambiguos.length, 1);
  assert.equal(r.ambiguos[0].candidatos.length, 2);
  assert.ok(r.porque.includes("Elige tú"));
});

test("un_nombre_que_no_esta_en_la_lista_no_se_inventa", () => {
  const r = aQuienesSeRefiere("anduvo Ramiro regando", GENTE);
  assert.equal(r.personas.length, 0);
  assert.ok(r.porque.includes("No se reconoció"));
});

test("no_confunde_un_nombre_metido_dentro_de_otra_palabra", () => {
  const r = aQuienesSeRefiere("se juntaron en la juanera", GENTE);
  assert.equal(r.personas.length, 0);
});

/* ════════════ DE QUÉ PARCELA ════════════ */

test("reconoce_la_parcela_por_su_nombre", () => {
  const r = deQueParcela("hoy en San Felipe 1 anduvieron regando", PARCELAS);
  assert.equal(r.seguro, true);
  assert.equal(r.parcelas[0].id, "p1");
});

test("si_nombro_dos_parcelas_puede_que_hablara_de_las_dos", () => {
  const r = deQueParcela("anduvieron en San Felipe 1 y en El 50", PARCELAS);
  assert.equal(r.parcelas.length, 2);
  assert.equal(r.seguro, false);
  assert.ok(r.porque.includes("dilo tú"));
});

/* ════════════ QUÉ QUISO DECIR ════════════ */

test("un_audio_se_parte_en_las_cosas_distintas_que_dijo", () => {
  // Gera no habla de una cosa a la vez.
  const partes = partirEnDichos(LO_QUE_DIJO);
  assert.equal(partes.length, 3);
});

test("clasifica_cada_frase_por_su_cuenta", () => {
  assert.equal(clasificarDicho("se compraron doscientos litros de diésel, tres mil ochocientos pesos").tipo, "gasto");
  assert.equal(clasificarDicho("hace falta un filtro para el tractor 3, ya no hay").tipo, "necesidad");
  assert.equal(clasificarDicho("se descompuso el tractor 3, no prende").tipo, "incidencia");
  assert.equal(clasificarDicho("anduvieron Juan y Pedro regando desde las siete").tipo, "actividad");
});

test("lo_que_no_reconoce_se_guarda_como_nota_no_se_tira", () => {
  // Lo que no se entendió no se pierde: se guarda con el audio.
  const c = clasificarDicho("estuvo bonito el día");
  assert.equal(c.tipo, "nota");
  assert.equal(c.seguro, false);
  assert.ok(c.porque.includes("para que no se pierda"));
});

test("si_podria_ser_dos_cosas_NO_adivina", () => {
  // Una seña de cada lado: "se pagó" suena a gasto y "urge" a necesidad.
  // Ahí no se adivina — se guarda como nota y que lo diga la persona.
  const c = clasificarDicho("se pagó, urge");
  assert.equal(c.tipo, "nota");
  assert.deepEqual(c.empate?.sort(), ["gasto", "necesidad"]);
  assert.ok(c.porque.includes("Dilo tú"));
});

test("un_articulo_NO_es_un_monto", () => {
  // "Se compró UN filtro" no son $1. Un monto en blanco se pregunta; uno de
  // $1 se guarda y nadie lo vuelve a mirar.
  const c = clasificarDicho("se compró un filtro en la refaccionaria");
  assert.equal(c.tipo, "gasto");
});

/* ════════════ LA PROPUESTA COMPLETA ════════════ */

test("de_un_solo_audio_salen_los_tres_movimientos", () => {
  const r = entenderLoDicho({ texto: LO_QUE_DIJO, personas: GENTE, parcelas: PARCELAS, hoy: "2026-09-08" });
  assert.equal(r.frases, 3);
  const tipos = r.propuestas.map(p => p.tipo);
  assert.ok(tipos.includes("actividad"));
  assert.ok(tipos.includes("gasto"));
  assert.ok(tipos.includes("necesidad"));

  const act = r.propuestas.find(p => p.tipo === "actividad");
  assert.equal(act.personas.length, 3);
  assert.equal(act.parcelas[0].nombre, "San Felipe 1");
  assert.equal(act.horas, 8);

  const gasto = r.propuestas.find(p => p.tipo === "gasto");
  assert.equal(gasto.monto, 3800);
  assert.equal(gasto.cantidad.valor, 200);
  assert.equal(gasto.cantidad.unidad, "litros");

  const nec = r.propuestas.find(p => p.tipo === "necesidad");
  assert.equal(nec.paraQuien, "quien compra");
});

test("NADA_se_guarda_solo", () => {
  // Registrar la nómina de tres personas porque se creyó oír un nombre hace
  // más daño que no entender nada.
  const r = entenderLoDicho({ texto: LO_QUE_DIJO, personas: GENTE, parcelas: PARCELAS });
  assert.equal(r.guardaSolo, false);
});

test("lo_que_falta_se_dice_por_su_nombre", () => {
  const r = entenderLoDicho({ texto: "anduvieron trabajando todo el día", personas: GENTE, parcelas: PARCELAS });
  const act = r.propuestas[0];
  assert.ok(act.falta.includes("quién trabajó"));
  assert.ok(act.falta.includes("en qué parcela"));
  assert.ok(r.resumen.includes("necesita"));
});

test("un_gasto_sin_monto_lo_dice_en_vez_de_poner_cero", () => {
  const r = entenderLoDicho({ texto: "se compró un filtro en la refaccionaria", personas: GENTE, parcelas: PARCELAS });
  const g = r.propuestas[0];
  assert.equal(g.tipo, "gasto");
  assert.ok(g.falta.includes("cuánto costó"));
});

test("un_audio_que_no_se_entendio_igual_deja_algo", () => {
  const r = entenderLoDicho({ texto: "estuvo bonito el día por acá", personas: GENTE, parcelas: PARCELAS });
  assert.equal(r.propuestas.length, 1);
  assert.equal(r.propuestas[0].tipo, "nota");
  assert.ok(r.resumen.includes("nota") || r.resumen.includes("notas"));
});

/* ════════════ COMO SE NOMBRA UNA PARCELA DE VERDAD ════════════ */

const PARCELAS_RANCHO = [
  { id: "p1", nombre: "El 53" },
  { id: "p2", nombre: "El Naranjo" },
  { id: "p3", nombre: "San Felipe 1" },
];

test("LA_53_ES_EL_53_porque_nadie_dice_el_nombre_del_catalogo", () => {
  // La parcela se llama "El 53" en el catálogo y Gera dice "se van a LA 53".
  // Sin esto, la tarea sale sin parcela y hay que corregirla a mano cada día.
  const r = deQueParcela("hoy Juan y Pedro se van a la 53 a regar", PARCELAS_RANCHO);
  assert.equal(r.seguro, true);
  assert.equal(r.parcelas[0].id, "p1");
});

test("UN_NUMERO_SUELTO_NO_ES_UNA_PARCELA", () => {
  // "Se compraron 53 sacos" no habla de la parcela 53. Mandar el trabajo a la
  // parcela equivocada es peor que no reconocerla.
  const r = deQueParcela("se compraron 53 sacos de fosfonitrato", PARCELAS_RANCHO);
  assert.equal(r.parcelas.length, 0);
});

test("el_naranjo_se_reconoce_con_o_sin_el_articulo", () => {
  assert.equal(deQueParcela("anduvieron en el Naranjo", PARCELAS_RANCHO).parcelas[0]?.id, "p2");
  assert.equal(deQueParcela("anduvieron en Naranjo limpiando", PARCELAS_RANCHO).parcelas[0]?.id, "p2");
});

test("un_nombre_completo_sigue_ganando", () => {
  const r = deQueParcela("hoy en San Felipe 1 anduvieron regando", PARCELAS_RANCHO);
  assert.equal(r.seguro, true);
  assert.equal(r.parcelas[0].id, "p3");
});
