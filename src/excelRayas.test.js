// El Excel antiguo de rayas: sus catálogos entran como referencia histórica y sus hojas semanales como rayas.
// (Datos inventados con la FORMA del archivo real; ningún nombre ni sueldo verdadero.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { fechasDeSemana, separarCodigo, leerCatalogos, leerRayaSemanal, periodoDelLibro } from "./excelRayas.js";
import { proponer, confirmarIncorporacion, historicoDe, resumenDelHistorico } from "./importacion.js";
import { catalogoDeClaves, referenciasDeClaves, sugerenciasDe, parecidasDe, aprenderClave, clavesPorPreguntar, relacionDeRenglon, compararConReferencias } from "./claves.js";

const quien = { rol: "admin", id: "a1", nombre: "Luis" }, sello = (s = "00") => ({ quien, cuando: `2026-11-21T10:00:${s}.000Z`, fecha: "2026-11-21" });
const BASE = [
  ["PRODUCTOS", "", "", "UBICACIONES", "", "", "", "", "ACTIVIDADES", "", "", "TRABAJADORES", "", "", "", "", "", "", "", "", "", "TABULADOR DE SUELDOS"],
  [],
  ["CÓDIGO", "NOMBRE", "", "CODIGO", "NOMBRE", "COD CULTIVO", "CULTIVO", "", "CODIGO", "NOMBRE", "", "NOMBRE", "CODIGO", "TABULADOR DE SUELDO", "PERCEPCIONES EN NOMINA", "SALARIO EN EFECTIVO", "", "", "", "", "", "CÓDIGO", "SUMA SEMANAL"],
  ["AJO", "AJO MORADO", "AJO", "RA1", "RANCHO 1 RA1", "AJO", "AJO MORADO", "", "A01", "Arrastre (Rastrear) A01", "FITO", "PERSONA INVENTADA UNO", "E01", "SS", 3000, 1000, "", "", "", "", "", "SS", 4000],
  ["FRI", "FRIJOL", "FRI", "R51", "EL 51 R51", "MAB", "MAIZ BLANCO", "", "A07", "Desgranar A07", "MAMA", "PERSONA INVENTADA DOS", "E02", "C2", "", 3000, "", "", "", "", "", "C2", 3000],
  ["MAB", "MAIZ BLANCO", "MAB", "SF4", "SAN FELIPE 4 SF4", "AJO", "AJO MORADO", "", "A17", "Sembrar A17", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["PAJ", "AJO POSTCOSECHA", "PAJ", "GEN", "GENERAL", "GEN", "GENERAL", "", "G02", "Quitar Hilo G02", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["GEN", "GENERAL", "GEN", "BOD", "BODEGA AJOS", "PAJ", "AJO POSTCOSECHA", "", "FAJ", "Falta Justificada FAJ", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["", "", "", "", "BODEGA PRE AJOS", "AJO", "AJO MORADO", "", "SUP", "Supervisar SUP", "", "", "", "", "", "", "", "", "", "", "", "", ""],
];
const semana = (titulo, renglones) => [
  ["", "", "", "Lista de Rayas"], ["", "", "", titulo],
  ["CODIGO SUELDO", "CODIGO TRABAJADOR", "NOMBRE TRABAJADOR", "LUNES", "", "", "MARTES", "", "", "MIÉRCOLES", "", "", "JUEVES", "", "", "VIERNES", "", "", "SÁBADO", "", "", "TOTAL"],
  ["", "", "", ...Array(6).fill(["ACTIVIDAD", "UBICACIÓN", "CULTIVO"]).flat()],
  ...renglones,
  ["TOTALES"], ["Lista de Rayas Ajenos"], ["Cuadrilla", "", "Cuadrilla inventada", 300, "Deshierbe A08", "RANCHO 1 RA1"],
];
const dias = (...d) => d.flat();
const S1 = semana("Semana del 30 de Septiembre al 06 de Octubre del 2024", [
  ["C2", "E01", "Persona Uno", ...dias(["Desgranar A07", "BODEGA AJOS", "PAJ"], ["Desgranar A07", "BODEGA AJOS", "PAJ"], ["Sembrar A17", "SAN FELIPE 4 SF4", "AJO"], ["Sembrar A17", "SAN FELIPE 4", "#N/A"], ["Supervisar SUP", "GENERAL", "GEN"], ["", "", ""])],
  ["C2", "E02", "Persona Dos", ...dias(["Falta Justificada FAJ", "", "#N/A"], ["Quitar Hilo G02", "EL 51", "#N/A"], ["Quitar Hilo G02", "EL 51 R51", "MAB"], ["", "RANCHO 1 RA1", "AJO"], ["", "", ""], ["", "", ""])],
  ["", "", "", ...Array(18).fill("")],
]);
const libro = (mas = {}) => ({ id: "x1", nombre: "Lista de Rayas 2024.xlsx", huella: "e".repeat(64), formato: "excel", hojas: [{ nombre: "Base de datos", filas: BASE }, { nombre: "30S-06O", filas: S1 }], ...mas });

test("la_semana_se_lee_de_su_titulo_y_si_no_se_entiende_no_se_supone", () => {
  assert.deepEqual(fechasDeSemana("Semana del 30 de Septiembre al 06 de Octubre del 2024"), { desde: "2024-09-30", hasta: "2024-10-06" });
  assert.deepEqual(fechasDeSemana("Semana del 21 al 27 de Octubre del 2024"), { desde: "2024-10-21", hasta: "2024-10-27" });
  assert.deepEqual(fechasDeSemana("Semana del 30 de Diciembre al 05 de Enero del 2025"), { desde: "2024-12-30", hasta: "2025-01-05" });
  assert.equal(fechasDeSemana("Lista de Rayas Agroselectos"), null); assert.equal(fechasDeSemana(""), null);
});

test("el_codigo_va_al_final_del_nombre_y_un_nombre_sin_codigo_se_queda_entero", () => {
  assert.deepEqual(separarCodigo("Desgranar A07"), { codigo: "A07", nombre: "Desgranar" });
  assert.deepEqual(separarCodigo("SAN FELIPE 4 SF4"), { codigo: "SF4", nombre: "SAN FELIPE 4" });
  assert.deepEqual(separarCodigo("CANAL CAN"), { codigo: "CAN", nombre: "CANAL" });
  assert.equal(separarCodigo("BODEGA AJOS").codigo, ""); assert.equal(separarCodigo("CARRETERA 2").codigo, ""); assert.equal(separarCodigo("GENERAL").codigo, "");
});

test("de_la_hoja_de_catalogos_salen_actividades_ubicaciones_y_cultivos_y_nada_de_personas_ni_sueldos", () => {
  const c = leerCatalogos(BASE);
  assert.deepEqual(c.secciones.map(s => [s.clase, s.renglones]), [["cultivo", 5], ["ubicacion", 6], ["actividad", 6]]);
  const a07 = c.referencias.find(r => r.clave === "A07"); assert.deepEqual([a07.clase, a07.significado, a07.escrita], ["actividad", "Desgranar", "Desgranar A07"]);
  const r51 = c.referencias.find(r => r.clave === "R51"); assert.deepEqual([r51.significado, r51.cultivoAsociado], ["EL 51", "MAB"]);
  assert.equal(c.referencias.find(r => r.clave === "BODEGAPREAJOS").sinCodigo, true, "una bodega sin código se guarda por su nombre");
  assert.equal(c.referencias.find(r => r.clave === "SANFELIPE4").aliasDe, "SF4", "el nombre solo también lleva a su código");
  const todo = JSON.stringify(c);
  assert.ok(!/PERSONA INVENTADA|3000|4000|E01|TABULADOR/.test(todo), "ni trabajadores ni sueldos");
});

test("la_hoja_semanal_da_un_renglon_por_persona_y_dia_con_su_fecha_y_lo_que_decia_el_excel", () => {
  const s = leerRayaSemanal(S1);
  assert.deepEqual(s.semana, { desde: "2024-09-30", hasta: "2024-10-06" }); assert.equal(s.registros.length, 8);
  const [l, , mi, ju, vi] = s.registros.filter(r => r.nombre === "Persona Uno");
  assert.deepEqual([l.fecha, l.claves, l.cultivo], ["2024-09-30", ["A07", "BODEGA AJOS"], "PAJ"]);
  assert.deepEqual([mi.fecha, mi.claves, mi.cultivo], ["2024-10-02", ["A17", "SF4"], "AJO"]);
  assert.deepEqual([ju.claves, ju.cultivo], [["A17", "SAN FELIPE 4"], ""], "el cultivo con #N/A queda vacío, no inventado; la actividad y el lugar se conservan");
  assert.equal(vi.cultivo, "", "«GEN» como cultivo quiere decir que no es de ningún cultivo");
  assert.deepEqual(l.escrito, { actividad: "Desgranar A07", ubicacion: "BODEGA AJOS" });
  assert.equal(s.cultivoConError, 3); assert.equal(s.descartadas.length, 1, "ubicación sin actividad no se adivina"); assert.match(s.descartadas[0].motivo, /jueves/);
  assert.ok(!s.registros.some(r => /Cuadrilla/.test(r.nombre)), "las cuadrillas de abajo tienen otra forma: no se leen como trabajadores");
  assert.equal(leerRayaSemanal(BASE), null); assert.equal(leerRayaSemanal([["Fecha", "Nombre", "Importe"], ["01/10/2024", "X", 5]]), null);
});

test("del_libro_entran_referencias_y_rayas_siempre_al_historico_sin_pagos_sueldos_ni_importes", () => {
  const r = proponer(libro(), { inicio: "2026-11-20" });
  assert.ok(r.propuestas.every(p => p.destino === "historico")); assert.equal(r.total, 0);
  const refs = r.propuestas.filter(p => p.datos.clase === "referencia_clave"), rayas = r.propuestas.filter(p => p.datos.clase === "raya");
  assert.equal(rayas.length, 8); assert.ok(refs.length >= 17);
  assert.ok(refs.every(p => p.datos.vigencia === "por confirmar" && p.datos.documento === "Lista de Rayas 2024.xlsx" && p.datos.desde === "2024-09-30" && p.datos.hasta === "2024-10-06"), "cada referencia dice de qué archivo y de qué fechas");
  assert.match(r.excepciones.join(" "), /REFERENCIA histórica/); assert.match(r.excepciones.join(" "), /Los trabajadores y los sueldos de esa hoja NO se leen/);
  assert.ok(!/PERSONA INVENTADA|"sueldo|3000/.test(JSON.stringify(r.propuestas)));
  const c = confirmarIncorporacion({ doc: { id: "x1", nombre: "Lista de Rayas 2024.xlsx", estado: "propuesto" }, resultado: r, ...sello(), azar: 0.1 });
  assert.equal(c.registros.length, 0, "ningún registro del rancho"); assert.deepEqual([...new Set(c.eventos.map(e => e.tipo))].sort(), ["doc_incorporado", "historico_lote"]);
  assert.ok(resumenDelHistorico(historicoDe(c.eventos)).every(x => x.monto === 0));
});

test("una_referencia_no_define_nada_se_sugiere_y_la_persona_confirma", () => {
  const r = proponer(libro(), {}), c = confirmarIncorporacion({ doc: { id: "x1", nombre: "Lista de Rayas 2024.xlsx", estado: "propuesto" }, resultado: r, ...sello(), azar: 0.2 });
  const historico = historicoDe(c.eventos), refs = referenciasDeClaves(historico), ev = [...c.eventos];
  assert.equal(catalogoDeClaves(ev).get("A07"), undefined, "importar el Excel no le da significado a A07");
  const s = sugerenciasDe("Ao7", refs, catalogoDeClaves(ev));
  assert.equal(s.length, 1); assert.deepEqual([s[0].significado, s[0].estado, s[0].vigencia], ["Desgranar", "nueva", "por confirmar"]); assert.equal(s[0].fuentes[0].documento, "Lista de Rayas 2024.xlsx");
  // La persona la confirma: ahí sí queda en el catálogo, y anotado de dónde salió.
  const a = aprenderClave({ catalogo: catalogoDeClaves(ev), clave: "A07", clase: "actividad", significado: "Desgranar", deReferencia: { documento: s[0].fuentes[0].documento }, ...sello("03") });
  assert.equal(a.ok, true); assert.equal(a.evento.datos.deReferencia.documento, "Lista de Rayas 2024.xlsx"); ev.push(a.evento);
  assert.equal(sugerenciasDe("A07", refs, catalogoDeClaves(ev))[0].estado, "coincide");
  // Y lo ya importado de ese Excel se lee con el significado confirmado.
  const dia = historico.find(h => h.clase === "raya" && h.fecha === "2024-09-30");
  assert.equal(relacionDeRenglon({ nombre: dia.contraparte, fecha: dia.fecha, claves: dia.claves, cultivo: dia.cultivoEscrito }, catalogoDeClaves(ev)).actividad.significado, "Desgranar");
});

test("lo_que_el_excel_dice_distinto_de_lo_ya_confirmado_se_ensena_no_lo_cambia", () => {
  const refs = referenciasDeClaves(proponer(libro(), {}).propuestas.map(p => p.datos)), cat = catalogoDeClaves([]);
  const bod = sugerenciasDe("Bod", refs, cat)[0];
  assert.equal(bod.estado, "difiere"); assert.equal(bod.actual.significado, "Bodega"); assert.equal(bod.significado, "BODEGA AJOS"); assert.equal(bod.cultivoAsociado, "PAJ");
  assert.equal(cat.get("BOD").significado, "Bodega", "el catálogo confirmado no se toca");
  assert.equal(sugerenciasDe("SF4", refs, cat)[0].estado, "coincide");
  // «GEN» en el Excel es a la vez un «cultivo» y una ubicación; hoy es trabajo general. Se enseñan las dos, no se escoge.
  assert.deepEqual(sugerenciasDe("Gen", refs, cat).map(x => [x.clase, x.estado]).sort(), [["cultivo", "otra_clase"], ["ubicacion", "difiere"]]);
  assert.equal(sugerenciasDe("A07", refs, cat)[0].variasInterpretaciones, false);
});

test("una_misma_clave_puede_tener_varias_interpretaciones_de_archivos_distintos_y_se_conservan_todas", () => {
  const otro = BASE.map(f => [...f]); otro[4][9] = "Limpia de ajo A07";
  const a = proponer(libro(), {}).propuestas, b = proponer(libro({ id: "x2", nombre: "Lista de Rayas 2023.xlsx", huella: "f".repeat(64), hojas: [{ nombre: "Base de datos", filas: otro }] }), {}).propuestas;
  const refs = referenciasDeClaves([...a, ...b].map(p => p.datos)), a07 = sugerenciasDe("A07", refs, catalogoDeClaves([]));
  assert.deepEqual(a07.map(x => x.significado).sort(), ["Desgranar", "Limpia de ajo"]); assert.ok(a07.every(x => x.variasInterpretaciones));
  assert.deepEqual(a07.map(x => x.fuentes[0].documento).sort(), ["Lista de Rayas 2023.xlsx", "Lista de Rayas 2024.xlsx"]);
  // La misma interpretación en los dos archivos es UNA, con dos fuentes.
  assert.equal(sugerenciasDe("A17", refs, catalogoDeClaves([]))[0].fuentes.length, 2);
  // Y volver a subir el mismo archivo no duplica referencias (misma huella → mismas llaves).
  assert.deepEqual(a.map(p => p.llave), proponer(libro(), {}).propuestas.map(p => p.llave));
});

test("la_libreta_contra_el_excel_lo_parecido_se_sugiere_y_no_se_toma", () => {
  const refs = referenciasDeClaves(proponer(libro(), {}).propuestas.map(p => p.datos)), cat = catalogoDeClaves([]);
  assert.equal(sugerenciasDe("RA51", refs, cat).length, 0, "RA51 no está en ese Excel");
  // «RA51» se parece a DOS claves del Excel: «R51» (El 51) y «RA1» (Rancho 1). Por eso parecerse no basta: decide una persona.
  const p = parecidasDe("RA51", refs); assert.deepEqual(p.map(x => [x.claveDeLaReferencia, x.significado, x.estado]).sort(), [["R51", "EL 51", "parecida"], ["RA1", "RANCHO 1", "parecida"]]);
  assert.deepEqual(parecidasDe("mB", refs).map(x => [x.claveDeLaReferencia, x.significado]), [["MAB", "MAIZ BLANCO"]]);
  assert.deepEqual(parecidasDe("A07", refs), [], "si la clave tiene su propia referencia no se buscan parecidas");
  const comp = compararConReferencias(["A07", "A17", "Bod", "SF4"], refs, cat);
  assert.deepEqual(comp.map(x => [x.clave, x.sugerencias[0]?.estado]), [["A07", "nueva"], ["A17", "nueva"], ["BOD", "difiere"], ["SF4", "coincide"]]);
});

test("el_periodo_del_libro_sale_de_sus_semanas", () => {
  assert.deepEqual(periodoDelLibro(libro().hojas), { desde: "2024-09-30", hasta: "2024-10-06" }); assert.equal(periodoDelLibro([{ filas: BASE }]), null);
});
