// Una raya con claves, de punta a punta: de la hoja (o de lo que leyó la IA) a la propuesta histórica.
import { test } from "node:test";
import assert from "node:assert/strict";
import { proponer, confirmarIncorporacion, historicoDe, entenderHoja, eventoDeAprendizaje } from "./importacion.js";
import { hojasDeLectura, resultadoConIA } from "./interpretacion.js";
import { catalogoDeClaves, aprenderClave, relacionDeRenglon, clavesPorPreguntar } from "./claves.js";

const quien = { rol: "admin", id: "a1", nombre: "Luis" };
const sello = (s = "00") => ({ quien, cuando: `2026-11-20T10:00:${s}.000Z`, fecha: "2026-11-20" });
// Lo que devuelve la IA al leer una libreta (personas inventadas).
const LECTURA = { clase: "raya", confianza: "media", emisor: "", fecha: "2024-10-06", folio: "", subtotal: "", total: "", moneda: "", no_se_leyo: [], avisos: ["La última columna no se distingue si es dinero."],
  renglones: [
    { nombre: "Chon", claves: "A27 | Sf4", importe: "", observacion: "" }, { nombre: "Lupe", claves: "Ao7 | Bod", importe: "", observacion: "" },
    { nombre: "Rigo", claves: "A16 | RASI | mB", importe: "", observacion: "" }, { nombre: "Gus", claves: "", importe: "", observacion: "falta" },
    { nombre: "Felipe", claves: "A07 | Bod", importe: "420", observacion: "" }, { nombre: "", claves: "", importe: "", observacion: "" },
  ] };
const doc = (hojas, mas = {}) => ({ id: "doc-1", nombre: "raya.jpg", huella: "h".repeat(64), formato: "excel", hojas, ...mas });

test("una_raya_leida_se_reconoce_como_raya_y_no_como_nomina", () => {
  const hojas = hojasDeLectura(LECTURA); assert.equal(hojas.length, 1);
  assert.equal(entenderHoja(hojas[0].filas).clase, "raya");
});

test("de_una_raya_sale_quien_que_y_donde_como_historico_con_el_codigo_original", () => {
  const r = proponer(doc(hojasDeLectura(LECTURA)), { inicio: "2026-11-20" });
  assert.equal(r.clase, "raya"); assert.equal(r.estado, "propuesto");
  assert.equal(r.propuestas.length, 5, "el renglón vacío no se propone"); assert.ok(r.propuestas.every(p => p.destino === "historico"));
  const lupe = r.propuestas.find(p => p.datos.contraparte === "Lupe").datos;
  assert.deepEqual(lupe.claves, ["Ao7", "Bod"], "como venía en el papel"); assert.equal(lupe.actividad, "A07"); assert.equal(lupe.ubicacion, "BOD"); assert.equal(lupe.fecha, "2024-10-06");
  const rigo = r.propuestas.find(p => p.datos.contraparte === "Rigo").datos;
  assert.equal(rigo.actividad, "A16"); assert.equal(rigo.ubicacion, null, "RASI no se toma por lugar sólo por venir en esa columna");
  assert.equal(r.propuestas.find(p => p.datos.contraparte === "Gus").datos.observacion, "falta");
  assert.equal(r.propuestas.find(p => p.datos.contraparte === "Felipe").datos.monto, 420);
  assert.match(r.excepciones.join(" "), /NO se crean pagos ni actividades/);
  assert.match(r.excepciones.join(" "), /A07, A16, A27, MB, RASI|clave\(s\) que todavía no se sabe/);
});

test("una_raya_posterior_al_arranque_tampoco_crea_pagos_ni_actividades", () => {
  const hoy = { ...LECTURA, fecha: "2026-12-01" };
  const r = proponer(doc(hojasDeLectura(hoy)), { inicio: "2026-11-20" });
  assert.ok(r.propuestas.every(p => p.destino === "historico" && p.datos.referencia === true));
  const c = confirmarIncorporacion({ doc: { id: "doc-1", nombre: "raya.jpg", estado: "propuesto" }, resultado: r, ...sello(), azar: 0.1 });
  assert.equal(c.ok, true); assert.equal(c.registros.length, 0, "ningún registro del rancho: sólo el lote histórico");
  assert.deepEqual([...new Set(c.eventos.map(e => e.tipo))].sort(), ["doc_incorporado", "historico_lote"]);
});

test("la_misma_raya_en_otra_foto_no_se_duplica", () => {
  const r1 = proponer(doc(hojasDeLectura(LECTURA)), {});
  const c = confirmarIncorporacion({ doc: { id: "doc-1", nombre: "raya.jpg", estado: "propuesto" }, resultado: r1, ...sello(), azar: 0.2 });
  const historico = historicoDe(c.eventos);
  assert.deepEqual(historico.find(h => h.contraparte === "Lupe").claves, ["Ao7", "Bod"]);
  // Otra foto del mismo día (otra huella), con la clave escrita distinto: es el mismo renglón.
  const otra = { ...LECTURA, renglones: LECTURA.renglones.map(x => ({ ...x, claves: x.claves.replace("Ao7", "A07").replace("Sf4", "SF 4") })) };
  const r2 = proponer({ ...doc(hojasDeLectura(otra)), id: "doc-2", huella: "g".repeat(64) }, { historico });
  assert.equal(r2.propuestas.filter(p => p.accion !== "duplicado").length, 0); assert.equal(r2.estado, "duplicado");
});

test("lo_que_se_aprende_en_un_documento_sirve_en_el_siguiente_y_en_lo_ya_importado", () => {
  const ev = [], r0 = proponer(doc(hojasDeLectura(LECTURA)), {});
  const renglones = r0.propuestas.map(p => ({ nombre: p.datos.contraparte, fecha: p.datos.fecha, claves: p.datos.claves }));
  assert.deepEqual(clavesPorPreguntar(renglones, catalogoDeClaves(ev)).map(x => x.clave), ["A07", "A16", "A27", "MB", "RASI"]);
  ev.push(aprenderClave({ catalogo: catalogoDeClaves(ev), clave: "A07", clase: "actividad", significado: "Limpia de ajo", ...sello("01") }).evento);
  // Lo ya propuesto (o ya incorporado) guarda la clave: con el catálogo de ahora ya dice qué es.
  const lupe = relacionDeRenglon(renglones.find(x => x.nombre === "Lupe"), catalogoDeClaves(ev));
  assert.equal(lupe.completa, true); assert.equal(lupe.actividad.significado, "Limpia de ajo"); assert.equal(lupe.ubicacion.significado, "Bodega");
  // Y otro documento, otro día, ya no la pregunta.
  const otro = { ...LECTURA, fecha: "2024-10-07" }, r = proponer({ ...doc(hojasDeLectura(otro)), id: "doc-3", huella: "k".repeat(64) }, { claves: catalogoDeClaves(ev) });
  assert.ok(!/A07/.test(r.excepciones.find(e => /todavía no se sabe/.test(e))));
});

test("una_raya_sin_dia_entra_sin_fecha_y_no_se_le_supone", () => {
  const r = proponer(doc(hojasDeLectura({ ...LECTURA, fecha: "" })), {});
  assert.ok(r.propuestas.every(p => p.datos.fecha === null)); assert.match(r.excepciones.join(" "), /sin día/);
  assert.equal(new Set(r.propuestas.map(p => p.llave)).size, r.propuestas.length, "sin fecha, cada renglón sigue siendo distinto");
});

test("lo_que_lee_la_ia_de_una_raya_llega_como_propuesta_por_revisar_no_como_hecho", () => {
  const r = resultadoConIA({ id: "doc-1", nombre: "raya.jpg", huella: "h".repeat(64), formato: "imagen" }, { ok: true, modo: "documento", lectura: LECTURA, cortada: false, uso: { modelo: "claude-haiku-5-5", nivel: "economico", microusd: 900 } }, {});
  assert.equal(r.resultado.clase, "raya"); assert.equal(r.ia.confiable, false, "la IA dijo que hubo dudas");
  assert.match(r.resultado.excepciones.join(" "), /no se distingue si es dinero/);
  assert.ok(r.resultado.propuestas.every(p => p.viaIA && p.destino === "historico"));
});

test("una_hoja_de_excel_con_columna_de_claves_se_puede_ensenar_como_raya", () => {
  const filas = [["dia", "quien", "cod", "lugar", "obs"], ["06/10/2024", "Chon", "A27", "SF4", ""], ["06/10/2024", "Lupe", "A07", "Bod", ""], ["06/10/2024", "Gus", "", "", "falta"]];
  assert.equal(entenderHoja(filas).clase, "desconocido");
  const a = eventoDeAprendizaje({ aprendidos: [], encabezados: filas[0], clase: "raya", mapa: { fecha: 0, nombre: 1, claves: 2, concepto: 4 }, ...sello("02"), azar: 0.3 });
  assert.equal(a.ok, true);
  const r = proponer(doc([{ nombre: "Hoja1", filas }]), { aprendidos: [a.patron] });
  assert.equal(r.propuestas.length, 3);
  const chon = r.propuestas.find(p => p.datos.contraparte === "Chon").datos;
  assert.deepEqual(chon.claves, ["A27", "SF4"], "la columna de lugar no se dijo, pero su celda tiene forma de clave y se recoge"); assert.equal(chon.ubicacion, "SF4");
});
