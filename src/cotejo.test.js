// Dos fuentes del mismo día: se cotejan, no se suman, y nadie corrige a nadie.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { cotejar, fuentesPorDia, unaFuentePorDia } from "./cotejo.js";
import { catalogoDeClaves, aprenderClave, leerClaves, relacionDeRenglon, canonica, compatibles, ligarParcela, ligasDeParcelas, ubicacionesPorLigar } from "./claves.js";
import { proponer, confirmarIncorporacion, historicoDe, fecharRaya } from "./importacion.js";
import { hojasDeLectura } from "./interpretacion.js";

const quien = { rol: "admin", id: "a1", nombre: "Luis" }; let n = 0;
const sello = () => ({ quien, cuando: `2026-11-21T12:00:${String(n++).padStart(2, "0")}.000Z`, fecha: "2026-11-21", azar: n / 1000 });
const LIBRETA = { nombre: "libreta.jpg", renglones: [
  { nombre: "Chon", fecha: "2024-10-06", claves: ["A27", "Sf4"], cultivo: "Ajo" }, { nombre: "Lupe", fecha: "2024-10-06", claves: ["A07", "Bod"], cultivo: "9jo", importeTentativo: 420 },
  { nombre: "Rodrigo", fecha: "2024-10-06", claves: ["A16", "RA51"], cultivo: "mB" }, { nombre: "Gus", fecha: "2024-10-06", claves: [], observacion: "falta" }, { nombre: "Beto", fecha: "2024-10-06", claves: ["A07", "Bod"], cultivo: "Ajo" } ] };
const EXCEL = { nombre: "Rayas 2024.xlsx", renglones: [
  { nombre: "Encarnación Inventado Uno", fecha: "2024-10-07", claves: ["A27", "SF4"], cultivo: "AJO", escrito: { actividad: "Revolver Fertilizante A27", ubicacion: "SAN FELIPE 4 SF4" } },
  { nombre: "Guadalupe Inventada Dos", fecha: "2024-10-07", claves: ["A07", "BODEGA AJOS"], cultivo: "PAJ", escrito: { actividad: "Desgranar A07", ubicacion: "BODEGA AJOS" } },
  { nombre: "Rodrigo Inventado Tres", fecha: "2024-10-07", claves: ["A16", "R51"], cultivo: "MAB", escrito: { actividad: "Regar A16", ubicacion: "EL 51 R51" } },
  { nombre: "Alberto Inventado Cuatro", fecha: "2024-10-07", claves: ["A07", "BODEGA PRE AJOS"], cultivo: "AJO", escrito: { actividad: "Desgranar A07", ubicacion: "BODEGA PRE AJOS" } } ] };

test("ra51_y_r51_son_el_mismo_lugar_y_se_conserva_como_lo_escribia_cada_papel", () => {
  const cat = catalogoDeClaves([]);
  assert.equal(canonica("R51", cat), "RA51"); assert.equal(compatibles("RA51", "R51", cat), "igual");
  const [x] = leerClaves(["R51"], cat);
  assert.deepEqual([x.clave, x.significado, x.grupo, x.escritaComo, x.denominacion, x.original], ["RA51", "Rancho 51", "Ranchos 50s", "R51", "El 51", "R51"]);
  assert.equal(compatibles("R50", "RA50", cat), "distinta", "R50 y R53 no se han confirmado: no se juntan solas");
});

test("bod_puede_ser_bodega_ajos_o_pre_ajos_y_no_se_escoge", () => {
  const cat = catalogoDeClaves([]);
  assert.equal(compatibles("Bod", "BODEGA AJOS", cat), "puede_ser"); assert.equal(compatibles("Bod", "BODEGA PRE AJOS", cat), "puede_ser"); assert.equal(compatibles("Bod", "SF4", cat), "distinta");
  assert.equal(compatibles("BODEGA AJOS", "BODEGA PRE AJOS", cat), "distinta", "entre sí siguen siendo dos lugares");
  assert.equal(leerClaves(["Bod"], cat)[0].significado, "Bodega");
});

test("el_cotejo_dice_que_coincide_que_difiere_y_que_aporta_cada_fuente_sin_corregir_a_ninguna", () => {
  const c = cotejar(LIBRETA, EXCEL, catalogoDeClaves([]));
  assert.match(c.discrepancias[0], /domingo 2024-10-06.*lunes 2024-10-07/, "el domingo se queda domingo, y se dice que no es el mismo día");
  assert.deepEqual(c.actividades.map(x => [x.clave, x.enA, x.enB, x.estado]), [["A07", 2, 2, "coincide"], ["A16", 1, 1, "coincide"], ["A27", 1, 1, "coincide"]]);
  const u = Object.fromEntries(c.ubicaciones.map(x => [x.clave, x]));
  assert.equal(u.RA51.estado, "coincide"); assert.deepEqual(u.RA51.conB, ["RA51"]); assert.equal(u.SF4.estado, "coincide");
  assert.equal(u.BOD.estado, "compatible: un papel no dice cuál"); assert.deepEqual([u.BOD.enA, u.BOD.enB, u.BOD.conB.sort()], [2, 2, ["BODEGAAJOS", "BODEGAPREAJOS"]]);
  const ajo = c.cultivos.find(x => x.clave === "AJO");
  assert.deepEqual([ajo.enA, ajo.enB, ajo.estado, ajo.escritoEnB.sort()], [3, 3, "mismo cultivo, clasificado distinto", ["AJO", "PAJ"]]);
  assert.equal(c.cultivos.find(x => x.clave === "MAB").estado, "sólo en B", "«mB» no se toma por maíz blanco: no está confirmado");
  // Personas: sólo posibles, con su pista; lo que no tiene pista clara no se junta.
  assert.deepEqual(c.personas.posibles.map(p => [p.a, p.b, p.por]), [["Lupe", "Guadalupe Inventada Dos", "va dentro del nombre"], ["Rodrigo", "Rodrigo Inventado Tres", "misma palabra"]]);
  assert.deepEqual(c.personas.sinParejaEnA.sort(), ["Beto", "Chon", "Gus"]);
  const rod = c.personas.posibles.find(p => p.a === "Rodrigo"); assert.deepEqual([rod.actividad, rod.ubicacion, rod.cultivo], ["igual", "igual", "escrito distinto"], "«mB» y «MAB» no se dan por iguales");
  assert.deepEqual([c.aporta.a.conImporteTentativo, c.aporta.a.faltas, c.aporta.b.conTextoDeActividad, c.aporta.b.nombresCompletos], [1, 1, 4, 4]);
  assert.deepEqual(LIBRETA.renglones[1].claves, ["A07", "Bod"], "cotejar no cambia nada de lo que recibió");
});

test("un_dia_que_llega_por_dos_fuentes_se_avisa_queda_como_evidencia_y_cuenta_una_sola_vez", () => {
  const R = (x) => ({ fecha: "", nombre: "", concepto: "", cantidad: "", unidad: "", importe: "", litros: "", vehiculo: "", parcela: "", dias: "", puesto: "", claves: "", cultivo: "", observacion: "", ...x });
  const lectura = (fecha) => ({ clase: "raya", confianza: "alta", emisor: "", fecha, folio: "", subtotal: "", total: "", moneda: "", no_se_leyo: [], avisos: [], renglones: [R({ nombre: "Lupe", claves: "A07 | Bod", cultivo: "Ajo" }), R({ nombre: "Chon", claves: "A27 | SF4", cultivo: "Ajo" })] });
  const foto = { id: "f1", nombre: "libreta lunes.jpg", huella: "a".repeat(64), formato: "excel", hojas: hojasDeLectura(lectura("2024-10-07")) };
  const r1 = proponer(foto, {}), c1 = confirmarIncorporacion({ doc: { id: "f1", nombre: foto.nombre, estado: "propuesto" }, resultado: r1, ...sello() });
  const semana = [["", "", "", "Lista"], ["", "", "", "Semana del 07 al 13 de Octubre del 2024"], ["", "", "NOMBRE TRABAJADOR", "LUNES", "", "", "MARTES", "", "", "MIÉRCOLES", "", "", "JUEVES", "", "", "VIERNES", "", "", "SÁBADO"], ["", "", "", ...Array(6).fill(["ACTIVIDAD", "UBICACIÓN", "CULTIVO"]).flat()],
    ["", "", "Guadalupe Inventada", "Desgranar A07", "BODEGA AJOS", "PAJ", "Desgranar A07", "BODEGA AJOS", "PAJ"], ["", "", "Encarnación Inventado", "Revolver Fertilizante A27", "SAN FELIPE 4 SF4", "AJO"]];
  const excel = { id: "x1", nombre: "Rayas 2024.xlsx", huella: "b".repeat(64), formato: "excel", hojas: [{ nombre: "07O-13O", filas: semana }] };
  const r2 = proponer(excel, { historico: historicoDe(c1.eventos) });
  assert.match(r2.excepciones.join(" "), /1 día\(s\) de este documento ya están en el histórico por otra fuente \(2024-10-07; de libreta lunes\.jpg\)/);
  assert.equal(r2.propuestas.filter(p => p.datos.fecha === "2024-10-07").every(p => p.datos.otraFuente?.[0] === "libreta lunes.jpg"), true);
  assert.equal(r2.propuestas.find(p => p.datos.fecha === "2024-10-08").datos.otraFuente, undefined);
  const c2 = confirmarIncorporacion({ doc: { id: "x1", nombre: excel.nombre, estado: "propuesto" }, resultado: r2, ...sello() });
  const historico = historicoDe([...c1.eventos, ...c2.eventos]), f = fuentesPorDia(historico);
  assert.deepEqual(f.varias.map(d => [d.fecha, d.dia, d.fuentes.map(x => x.documento).sort()]), [["2024-10-07", "lunes", ["Rayas 2024.xlsx", "libreta lunes.jpg"]]]);
  const una = unaFuentePorDia(historico, catalogoDeClaves([])), lunes = una.find(d => d.fecha === "2024-10-07");
  assert.equal(lunes.renglones.length, 2, "el lunes son 2 personas, no 4"); assert.equal(lunes.deEvidencia.length, 1);
  assert.equal(una.reduce((s, d) => s + d.renglones.length, 0), 3, "dos del lunes y una del martes");
});

test("corregir_o_fechar_una_clave_no_cambia_lo_que_ya_se_confirmo", () => {
  const ev = []; const aprende = (a) => { const r = aprenderClave({ catalogo: catalogoDeClaves(ev), ...a, ...sello() }); assert.equal(r.ok, true, r.dice); ev.push(r.evento); };
  // «En esas fechas A07 era Desgranar» no dice qué significa hoy.
  aprende({ clave: "A07", clase: "actividad", significado: "Desgranar", desde: "2024-07-29", hasta: "2024-10-27" });
  const rel = (fecha) => relacionDeRenglon({ nombre: "X", fecha, claves: ["A07", "SF4"] }, catalogoDeClaves(ev));
  assert.equal(rel("2024-10-07").actividad.significado, "Desgranar"); assert.equal(rel("2026-11-21").actividad.conocida, false, "fuera de esas fechas se sigue preguntando");
  // Lo incorporado guarda lo que se entendió entonces…
  const filas = [["Fecha", "Nombre", "Claves", "Cultivo"], ["07/10/2024", "Lupe", "A07 | Bod", "Ajo"]];
  const r = proponer({ id: "d1", nombre: "raya.csv", huella: "c".repeat(64), formato: "excel", hojas: [{ nombre: "h", filas }] }, { claves: catalogoDeClaves(ev) });
  const guardado = JSON.stringify(r.propuestas[0].datos);
  assert.deepEqual(r.propuestas[0].datos.leido.actividad, { clave: "A07", significado: "Desgranar" }); assert.equal(r.propuestas[0].datos.leido.ubicacion.significado, "Bodega"); assert.deepEqual(r.propuestas[0].datos.leido.ubicacion.puedeSer, ["BODEGAAJOS", "BODEGAPREAJOS"]);
  const c = confirmarIncorporacion({ doc: { id: "d1", nombre: "raya.csv", estado: "propuesto" }, resultado: r, ...sello() });
  // …y una corrección posterior (otro significado hoy, y otro para esas fechas) no lo toca.
  aprende({ clave: "A07", clase: "actividad", significado: "Limpia de ajo" }); aprende({ clave: "A07", clase: "actividad", significado: "Desgrane de semilla", desde: "2024-07-29", hasta: "2024-10-27" });
  const fila = historicoDe([...c.eventos, ...ev]).find(h => h.clase === "raya");
  assert.deepEqual(fila.leido.actividad, { clave: "A07", significado: "Desgranar" }); assert.deepEqual(fila.claves, ["A07", "Bod"]);
  assert.equal(rel("2024-10-07").actividad.significado, "Desgrane de semilla"); assert.equal(rel("2026-11-21").actividad.significado, "Limpia de ajo");
  assert.equal(JSON.stringify({ ...fila, id: undefined, docId: undefined, documento: undefined, lote: undefined }).includes('"significado":"Desgranar"'), true); assert.ok(guardado.includes('"leido"'));
});

test("una_ubicacion_historica_no_es_una_parcela_hasta_que_alguien_lo_dice", () => {
  const ev = [], cat = catalogoDeClaves(ev), parcelas = [{ id: "p1", nombre: "San Felipe 4" }];
  assert.ok(ubicacionesPorLigar(cat, ligasDeParcelas(ev)).some(u => u.clave === "SF4")); assert.ok(!ubicacionesPorLigar(cat, ligasDeParcelas(ev)).some(u => u.clave === "R51"), "R51 es otra forma de RA51: no se liga aparte");
  assert.equal(ligarParcela({ catalogo: cat, clave: "SF4", tipo: "parcela", parcelas, ...sello() }).ok, false); assert.equal(ligarParcela({ catalogo: cat, clave: "A07", tipo: "no_es_parcela", ...sello() }).ok, false); assert.equal(ligarParcela({ catalogo: cat, clave: "SF4", tipo: "parcela", parcelaId: "p9", parcelas, ...sello() }).ok, false);
  const a = ligarParcela({ catalogo: cat, clave: "SF4", tipo: "parcela", parcelaId: "p1", parcelas, ...sello() }); assert.equal(a.ok, true); ev.push(a.evento);
  const b = ligarParcela({ catalogo: cat, clave: "Bod", tipo: "no_es_parcela", ...sello() }); ev.push(b.evento);
  const c = ligarParcela({ catalogo: cat, clave: "R51", tipo: "varias", nota: "El 51 son dos tablas", ...sello() }); assert.equal(c.evento.datos.clave, "RA51"); ev.push(c.evento);
  const l = ligasDeParcelas(ev); assert.equal(l.get("SF4").parcelaId, "p1"); assert.equal(l.get("BOD").tipo, "no_es_parcela"); assert.equal(l.get("RA51").tipo, "varias");
  ev.push(ligarParcela({ catalogo: cat, clave: "SF4", tipo: "ya_no_existe", nota: "se vendió", ...sello() }).evento);
  assert.equal(ligasDeParcelas(ev).get("SF4").anteriores[0].parcelaId, "p1", "corregir la liga conserva la anterior");
  assert.ok(!ubicacionesPorLigar(cat, ligasDeParcelas(ev)).some(u => ["SF4", "BOD", "RA51"].includes(u.clave)));
});

test("las_rayas_historicas_no_llegan_a_ningun_calculo_de_costos_ni_de_pagos", () => {
  // El histórico de la importación sólo lo leen la importación, el cotejo y las claves. Si un módulo de dinero empieza
  // a leerlo, esta prueba truena: antes hace falta un tabulador histórico confiable (Luis, 21 nov 2026).
  const permitidos = new Set(["importacion.js", "importador.js", "cotejo.js", "claves.js", "excelRayas.js", "interpretacion.js"]);
  const culpables = readdirSync(new URL(".", import.meta.url)).filter(f => f.endsWith(".js") && !f.endsWith(".test.js") && !permitidos.has(f))
    .filter(f => /historico_lote|historicoDe\(|unaFuentePorDia|fuentesPorDia/.test(readFileSync(new URL(f, import.meta.url), "utf8")));
  assert.deepEqual(culpables, []);
});

test("la_libreta_del_domingo_se_queda_en_domingo_aunque_el_excel_solo_tenga_de_lunes_a_sabado", () => {
  const R = (x) => ({ fecha: "", nombre: "", concepto: "", cantidad: "", unidad: "", importe: "", litros: "", vehiculo: "", parcela: "", dias: "", puesto: "", claves: "", cultivo: "", observacion: "", ...x });
  const lectura = { clase: "raya", confianza: "media", emisor: "", fecha: "", folio: "", subtotal: "", total: "", moneda: "", no_se_leyo: [], avisos: [], renglones: [R({ nombre: "Lupe", claves: "A07 | Bod", cultivo: "Ajo" }), R({ nombre: "Rodrigo", claves: "A16 | RA51", cultivo: "mB" })] };
  const r0 = proponer({ id: "f", nombre: "libreta.jpg", huella: "d".repeat(64), formato: "excel", hojas: hojasDeLectura(lectura) }, {});
  assert.equal(r0.propuestas.every(p => !p.datos.fecha), true);
  const yaEstaba = [{ clase: "raya", fecha: "2024-10-06", documento: "otra foto.jpg", llave: "x" }];
  const f = fecharRaya(r0, "2024-10-06", { historico: yaEstaba, documento: "libreta.jpg" });
  assert.equal(f.resultado.propuestas.every(p => p.datos.fecha === "2024-10-06" && p.datos.domingo === true && p.datos.otraFuente[0] === "otra foto.jpg"), true);
  assert.match(f.resultado.excepciones.join(" "), /es domingo\. Se conserva la fecha como se dijo; no se pasa al lunes/); assert.match(f.resultado.excepciones.join(" "), /ya está en el histórico por otra fuente \(otra foto\.jpg\)/);
  const rodrigo = f.resultado.propuestas.find(p => p.datos.contraparte === "Rodrigo").datos;
  assert.deepEqual(rodrigo.leido.ubicacion, { clave: "RA51", significado: "Rancho 51" }); assert.equal(rodrigo.leido.cultivo, null, "«mB» no se guarda como maíz blanco"); assert.equal(rodrigo.cultivoEscrito, "mB");
});
