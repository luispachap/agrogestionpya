// Las claves de las rayas: actividad no es ubicación, nada se inventa, y el código del papel se conserva.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarClave, formaDe, catalogoDeClaves, aprenderClave, leerClaves, relacionDeRenglon, decirRelacion, clavesPorPreguntar, partirClaves, listaDeClaves, T_CLAVE } from "./claves.js";

const quien = { rol: "admin", id: "a1", nombre: "Luis" };
let n = 0;
const sello = () => ({ quien, cuando: `2026-11-20T10:00:${String(n++).padStart(2, "0")}.000Z`, fecha: "2026-11-20", azar: n / 1000 });
const aprende = (eventos, clave, clase, significado) => { const r = aprenderClave({ catalogo: catalogoDeClaves(eventos), clave, clase, significado, ...sello() }); if (r.ok) eventos.push(r.evento); return r; };

test("la_misma_clave_escrita_a_mano_de_tres_formas_es_una_sola_y_no_pierde_como_venia", () => {
  for (const escrita of ["A07", "Ao7", "a 07", "A7", "A O7"]) assert.equal(normalizarClave(escrita).clave, "A07", escrita);
  assert.equal(normalizarClave("Ao7").original, "Ao7");
  assert.equal(normalizarClave("sf 4").clave, "SF4"); assert.equal(normalizarClave("5f4").clave, "SF4", "así la leyó la IA en la primera libreta real"); assert.equal(normalizarClave("5f4").original, "5f4"); assert.equal(normalizarClave("Bod").clave, "BOD"); assert.equal(normalizarClave("Bod.").clave, "BOD");
  assert.equal(normalizarClave("Alma").clave, "ALMA", "un nombre que empieza con A no es una clave de actividad");
  assert.equal(formaDe("ALMA"), null);
});

test("las_claves_con_a_son_actividades_y_bod_y_sf_son_lugares", () => {
  assert.equal(formaDe("A07"), "actividad"); assert.equal(formaDe("A50"), "actividad");
  assert.equal(formaDe("SF4"), "ubicacion"); assert.equal(formaDe("BOD"), "ubicacion");
  assert.equal(formaDe("GEN"), "general", "Gen es trabajo general, no un lugar"); assert.equal(formaDe("RA51"), "ubicacion"); assert.equal(formaDe("MB"), null); assert.equal(formaDe("AJO"), "cultivo");
});

test("de_arranque_solo_se_sabe_lo_que_luis_dijo_y_ninguna_actividad", () => {
  const c = catalogoDeClaves([]);
  assert.equal(c.get("BOD").significado, "Bodega"); assert.equal(c.get("SF4").significado, "San Felipe 4"); assert.equal(c.get("SF1").significado, "San Felipe 1");
  assert.equal(listaDeClaves(c).filter(x => x.clase === "actividad").length, 0, "no se inventa el significado de ninguna actividad");
});

test("una_actividad_sin_registrar_no_se_inventa_se_pregunta", () => {
  const [a, b] = leerClaves(["Ao7", "Bod"], catalogoDeClaves([]));
  assert.deepEqual([a.clave, a.clase, a.conocida, a.significado, a.falta], ["A07", "actividad", false, "", "significado"]);
  assert.deepEqual([b.clave, b.clase, b.conocida, b.significado], ["BOD", "ubicacion", true, "Bodega"]);
  const rel = relacionDeRenglon({ nombre: "Persona Uno", fecha: "2024-10-06", claves: ["Ao7", "Bod"] }, catalogoDeClaves([]));
  assert.equal(rel.completa, false); assert.match(rel.dudas.join(" "), /Falta decir qué actividad es «A07»/);
  assert.match(decirRelacion(rel), /A07: falta decir qué actividad es · Bodega \(BOD\)/);
});

test("una_clave_aprendida_sirve_para_todos_los_documentos_que_vengan_despues", () => {
  const ev = []; assert.ok(aprende(ev, "Ao7", "actividad", "Limpia de ajo").ok);
  assert.equal(ev[0].tipo, T_CLAVE); assert.equal(ev[0].datos.clave, "A07"); assert.equal(ev[0].datos.original, "Ao7");
  const rel = relacionDeRenglon({ nombre: "Persona Dos", fecha: "2024-10-07", claves: ["A 07", "SF4"] }, catalogoDeClaves(ev));
  assert.equal(rel.completa, true); assert.equal(rel.actividad.significado, "Limpia de ajo"); assert.equal(rel.ubicacion.significado, "San Felipe 4");
  assert.equal(rel.actividad.original, "A 07", "se conserva como venía en el papel");
});

test("una_actividad_no_se_guarda_como_ubicacion_ni_al_reves", () => {
  const ev = [];
  let r = aprende(ev, "A12", "ubicacion", "San Felipe 2"); assert.equal(r.ok, false); assert.match(r.dice, /clave de actividad/);
  r = aprende(ev, "SF2", "actividad", "Riego"); assert.equal(r.ok, false); assert.match(r.dice, /clave de ubicación/);
  r = aprende(ev, "Bod", "actividad", "Embodegar"); assert.equal(r.ok, false);
  assert.equal(ev.length, 0);
  assert.equal(aprende(ev, "A12", "actividad", "").ok, false, "sin significado no se guarda");
  assert.equal(aprende(ev, "RASI", "", "algo").ok, false, "de una clave rara hay que decir qué clase de cosa es");
});

test("corregir_una_equivalencia_no_borra_la_anterior", () => {
  const ev = []; aprende(ev, "A07", "actividad", "Limpia"); const r = aprende(ev, "A07", "actividad", "Relimpia de ajo");
  assert.equal(r.ok, true); assert.equal(r.corrige, true);
  const c = catalogoDeClaves(ev).get("A07");
  assert.equal(c.significado, "Relimpia de ajo"); assert.equal(c.anteriores.length, 1); assert.equal(c.anteriores[0].significado, "Limpia"); assert.equal(c.anteriores[0].quien, "Luis");
  assert.equal(aprende(ev, "A07", "actividad", "Relimpia de ajo").igual, true, "guardar lo mismo no crea otro evento");
  // Lo de arranque también se puede corregir, y queda dicho que venía de arranque.
  aprende(ev, "Bod", "ubicacion", "Bodega de Aguascalientes");
  const b = catalogoDeClaves(ev).get("BOD"); assert.equal(b.significado, "Bodega de Aguascalientes"); assert.equal(b.anteriores[0].deArranque, true);
});

test("dos_claves_con_el_mismo_significado_se_avisa_y_no_se_impide", () => {
  const ev = []; aprende(ev, "A07", "actividad", "Limpia de ajo");
  const r = aprende(ev, "A17", "actividad", "limpia de ajo"); assert.equal(r.ok, true); assert.match(r.aviso, /A07/);
});

test("no_todas_las_celdas_de_una_raya_son_lo_mismo_lo_raro_queda_como_duda", () => {
  const cat = catalogoDeClaves([]);
  const rel = relacionDeRenglon({ nombre: "Persona Tres", fecha: "2024-10-06", claves: ["A16", "XYZ", "mB"] }, cat);
  assert.equal(rel.ubicacion, null, "XYZ no se toma por ubicación sólo por estar en esa columna");
  assert.equal(rel.dudas.filter(d => /No se sabe qué es/.test(d)).length, 2); assert.equal(rel.completa, false);
  const dos = relacionDeRenglon({ nombre: "Persona Cuatro", fecha: "2024-10-06", claves: ["A07", "A27", "Bod"] }, cat);
  assert.equal(dos.actividad, null, "con dos actividades no se escoge una"); assert.match(dos.dudas.join(" "), /2 claves de actividad/);
  const falta = relacionDeRenglon({ nombre: "Persona Cinco", fecha: "2024-10-06", claves: [], observacion: "falta" }, cat);
  assert.deepEqual(falta.dudas, [], "un renglón que sólo dice «falta» no tiene nada que preguntar"); assert.equal(falta.completa, false);
});

test("una_anotacion_o_algo_que_se_ignora_deja_de_preguntarse", () => {
  const ev = []; aprende(ev, "mB", "nota", "medio día en bodega"); aprende(ev, "XYZ", "ignorar", "");
  const rel = relacionDeRenglon({ nombre: "Persona Seis", fecha: "2024-10-06", claves: ["A23", "XYZ", "mB"] }, catalogoDeClaves(ev));
  assert.deepEqual(rel.notas, ["medio día en bodega"]); assert.equal(rel.dudas.some(d => /No se sabe qué es/.test(d)), false);
});

test("se_pregunta_una_vez_por_clave_y_primero_la_que_mas_sale", () => {
  const renglones = [
    { nombre: "Uno", fecha: "2024-10-06", claves: ["Ao7", "Bod"] }, { nombre: "Dos", fecha: "2024-10-06", claves: ["A07", "Bod"] }, { nombre: "Tres", fecha: "2024-10-06", claves: ["A 7", "Bod"] },
    { nombre: "Cuatro", fecha: "2024-10-06", claves: ["A27", "SF4"] }, { nombre: "Cinco", fecha: "2024-10-06", claves: ["A16", "XYZ"] },
  ];
  const p = clavesPorPreguntar(renglones, catalogoDeClaves([]));
  assert.deepEqual(p.map(x => x.clave), ["A07", "A16", "A27", "XYZ"]); assert.equal(p[0].veces, 3); assert.deepEqual(p[0].escritas.sort(), ["A 7", "A07", "Ao7"]);
  assert.equal(p.find(x => x.clave === "XYZ").falta, "todo"); assert.equal(p[0].falta, "significado");
  const ev = []; aprende(ev, "A07", "actividad", "Limpia de ajo");
  assert.deepEqual(clavesPorPreguntar(renglones, catalogoDeClaves(ev)).map(x => x.clave), ["A16", "A27", "XYZ"], "lo ya contestado no se vuelve a preguntar");
});

test("una_celda_con_varias_claves_se_parte_sin_romper_las_que_traen_espacio", () => {
  assert.deepEqual(partirClaves("A 07 | Bod"), ["A 07", "Bod"]); assert.deepEqual(partirClaves("A07 Bod"), ["A07", "Bod"]); assert.deepEqual(partirClaves("A07, SF4"), ["A07", "SF4"]); assert.deepEqual(partirClaves(""), []);
});

// ── Lo que aclaró el rancho sobre la libreta del domingo (20 nov 2026) ──
test("ajo_es_un_cultivo_y_nunca_la_clave_a07", () => {
  for (const escrita of ["Ajo", "ajo", "2jo", "9jo", "AJO"]) assert.equal(normalizarClave(escrita).clave, "AJO", escrita);
  assert.notEqual(normalizarClave("Ajo").clave, "A07"); assert.equal(formaDe("AJO"), "cultivo");
  for (const palabra of ["Alo", "AO", "Ail", "Alma"]) assert.equal(formaDe(normalizarClave(palabra).clave), null, `«${palabra}» no se vuelve clave de actividad`);
  const cat = catalogoDeClaves([]);
  const rel = relacionDeRenglon({ nombre: "Persona", fecha: "2024-10-06", claves: ["A27", "SF4"], cultivo: "Ajo" }, cat);
  assert.equal(rel.actividad.clave, "A27"); assert.equal(rel.ubicacion.clave, "SF4"); assert.equal(rel.cultivo.significado, "Ajo");
  assert.ok(!rel.dudas.some(d => /cultivo|Ajo/i.test(d)));
  // Aunque la IA meta «Ajo» entre las claves, sigue siendo el cultivo y no una segunda actividad.
  const mezclado = relacionDeRenglon({ nombre: "Persona", fecha: "2024-10-06", claves: ["A07", "Bod", "Ajo"] }, cat);
  assert.equal(mezclado.actividad.clave, "A07"); assert.equal(mezclado.cultivo.clave, "AJO"); assert.ok(!mezclado.dudas.some(d => /2 claves de actividad/.test(d)));
  assert.equal(aprenderClave({ catalogo: cat, clave: "Ajo", clase: "actividad", significado: "Limpia", ...sello() }).ok, false, "Ajo no se guarda como actividad");
  assert.equal(aprenderClave({ catalogo: cat, clave: "A07", clase: "cultivo", significado: "Ajo", ...sello() }).ok, false, "A07 no se guarda como cultivo");
});

test("un_ajo_leido_raro_o_un_codigo_en_el_lugar_del_cultivo_quedan_por_confirmar", () => {
  const cat = catalogoDeClaves([]);
  const raro = relacionDeRenglon({ nombre: "Persona", fecha: "2024-10-06", claves: ["A07", "Bod"], cultivo: "9jo" }, cat);
  assert.equal(raro.cultivo.clave, "AJO"); assert.equal(raro.cultivo.original, "9jo", "queda dicho cómo se leyó");
  const codigo = relacionDeRenglon({ nombre: "Persona", fecha: "2024-10-06", claves: ["Bod"], cultivo: "A07" }, cat);
  assert.equal(codigo.cultivo, null); assert.match(codigo.dudas.join(" "), /En el lugar del cultivo se leyó «A07»/);
  const otro = relacionDeRenglon({ nombre: "Persona", fecha: "2024-10-06", claves: ["A16", "RA51"], cultivo: "mB" }, cat);
  assert.equal(otro.cultivo, null); assert.match(otro.dudas.join(" "), /En el lugar del cultivo dice «mB» y no se sabe qué es/);
});

test("gen_es_trabajo_general_no_un_lugar_fisico", () => {
  const cat = catalogoDeClaves([]), rel = relacionDeRenglon({ nombre: "Persona", fecha: "2024-10-06", claves: ["A23", "Gen"] }, cat);
  assert.equal(rel.ubicacion.clave, "GEN"); assert.equal(rel.ubicacion.clase, "general"); assert.equal(rel.sinLugarFisico, true);
  assert.match(decirRelacion(rel), /General \(sin rancho específico\) \(GEN\)/);
  assert.equal(listaDeClaves(cat).filter(c => c.clase === "ubicacion").some(c => c.clave === "GEN"), false);
  assert.equal(aprenderClave({ catalogo: cat, clave: "Gen", clase: "ubicacion", significado: "Rancho general", ...sello() }).ok, false);
});

test("rancho_51_y_san_felipe_son_ubicaciones_independientes_con_su_grupo", () => {
  const cat = catalogoDeClaves([]);
  assert.deepEqual(["RA50", "RA51", "RA53"].map(k => [cat.get(k).significado, cat.get(k).grupo]), [["Rancho 50", "Ranchos 50s"], ["Rancho 51", "Ranchos 50s"], ["Rancho 53", "Ranchos 50s"]]);
  assert.deepEqual(["SF1", "SF2", "SF3", "SF4"].map(k => cat.get(k).grupo), Array(4).fill("San Felipe")); assert.equal(cat.get("BOD").significado, "Bodega"); assert.equal(cat.get("BOD").grupo, undefined);
  assert.equal(normalizarClave("RASI").clave, "RA51"); assert.equal(normalizarClave("RASI").original, "RASI");
  const rel = relacionDeRenglon({ nombre: "Persona", fecha: "2024-10-06", claves: ["A16", "RASI"] }, cat);
  assert.equal(rel.ubicacion.significado, "Rancho 51"); assert.equal(rel.ubicacion.grupo, "Ranchos 50s"); assert.equal(rel.ubicacion.original, "RASI");
  assert.match(rel.dudas.join(" "), /Se leyó «RASI» y se tomó como RA51/, "una lectura ajustada se confirma contra el papel");
  assert.equal(relacionDeRenglon({ nombre: "Persona", fecha: "2024-10-06", claves: ["A16", "RA51"] }, cat).dudas.some(d => /se tomó como/.test(d)), false);
  // RA52 tiene forma de rancho, pero nadie lo ha dicho: se pregunta.
  assert.equal(leerClaves(["RA52"], cat)[0].falta, "significado");
  // Corregir el significado conserva el grupo; y el grupo se puede cambiar.
  const ev = []; let r = aprende(ev, "RA51", "ubicacion", "Rancho 51 (el de abajo)"); assert.equal(r.ok, true); assert.equal(catalogoDeClaves(ev).get("RA51").grupo, "Ranchos 50s");
  r = aprenderClave({ catalogo: catalogoDeClaves(ev), clave: "RA52", clase: "ubicacion", significado: "Rancho 52", grupo: "Ranchos 50s", ...sello() }); ev.push(r.evento);
  assert.equal(catalogoDeClaves(ev).get("RA52").grupo, "Ranchos 50s");
});
