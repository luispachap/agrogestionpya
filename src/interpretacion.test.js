import { test } from "node:test";
import assert from "node:assert/strict";
import { necesitaIA, pedidoDeHoja, sinDatosSensibles, hojasDeLectura, aprendidoDeLectura, revisarLectura, resultadoConIA, metricasDeIA, costoMaximo, enDolares, estadoDelPresupuesto } from "./interpretacion.js";
import { recibirDocumento, anotarLectura, confirmarIncorporacion, descartarDocumento, bandejaDe, proponer } from "./importacion.js";

const CTX = { inicio: "2026-11-20", rfcsPropios: [], egresos: [], historico: [], trabajadores: [{ id: "t1", nombre: "Ana López Ruiz" }], encargados: [], proveedores: [], maquinaria: [{ id: "m1", nombre: "Tractor 3" }], parcelas: [], documentos: [], aprendidos: [] };
const R = (mas = {}) => ({ fecha: "", nombre: "", concepto: "", cantidad: "", unidad: "", importe: "", litros: "", vehiculo: "", parcela: "", dias: "", puesto: "", ...mas });
const TICKET = { clase: "ticket", confianza: "alta", emisor: "Ferretería El Clavo", fecha: "2026-11-27", folio: "A-1021", subtotal: "", total: "348.00", moneda: "MXN",
  renglones: [R({ concepto: "Tornillo 1/4", cantidad: "20", importe: "120.00" }), R({ concepto: "Broca 3/8", cantidad: "2", importe: "228.00" })], no_se_leyo: [], avisos: [] };
const USO = { modelo: "claude-haiku-5-5", nivel: "economico", entrada: 2600, salida: 420, microusd: 470 };
const Q = { id: "u1", nombre: "Luis", rol: "admin" }; let n = 0; const az = () => (++n) / 1e6; const en = (d) => ({ quien: Q, cuando: `${d}T12:00:0${n % 9}-06:00`, fecha: d, azar: az() });

test("la_ia_solo_se_ofrece_para_lo_que_los_lectores_gratuitos_no_pudieron", () => {
  assert.equal(necesitaIA({ estado: "propuesto", formato: "excel" }), null, "una hoja que ya se leyó sola no la necesita");
  assert.equal(necesitaIA({ estado: "incorporado", formato: "imagen" }), null); assert.equal(necesitaIA({ estado: "duplicado", formato: "xml" }), null);
  assert.equal(necesitaIA({ estado: "necesita_lectura", formato: "imagen" }).via, "imagen"); assert.equal(necesitaIA({ estado: "necesita_lectura", formato: "pdf" }).via, "paginas");
  assert.equal(necesitaIA({ estado: "por_revisar", formato: "excel", hojasSinReconocer: 1 }).modo, "hoja");
  assert.equal(necesitaIA({ estado: "por_revisar", formato: "pdf", sinEntender: true }).via, "texto");
  assert.equal(necesitaIA({ estado: "por_revisar", formato: "pdf" }), null, "un PDF de factura que sólo espera su XML no se manda a la IA");
  assert.equal(necesitaIA({ estado: "por_revisar", formato: "word_viejo" }), null);
});

test("de_una_hoja_solo_viajan_sus_primeros_renglones_y_nunca_curp_ni_numero_de_seguro", () => {
  const filas = [["RAYA SEMANA 46"], [], ["Quién", "Cuánto", "CURP"], ["Ana López Ruiz", 2100, "LORA900101MZSPZN05"], ...Array.from({ length: 80 }, (_, i) => [`Persona ${i}`, 100 + i, ""])];
  const p = pedidoDeHoja(filas);
  assert.equal(p.split("\n").length, 30, "sólo los primeros treinta renglones con algo"); assert.match(p, /^r0: c0=RAYA SEMANA 46/); assert.match(p, /r2: c0=Quién \| c1=Cuánto \| c2=CURP/);
  assert.ok(!p.includes("LORA900101MZSPZN05"), "la CURP no sale del aparato"); assert.match(p, /c2=▮▮▮/);
  assert.equal(sinDatosSensibles("NSS 12345678901 cuenta 012345678901234567"), "NSS ▮▮▮ cuenta ▮▮▮");
});

test("un_ticket_leido_por_la_ia_entra_por_el_mismo_camino_como_un_gasto_por_confirmar", () => {
  const doc = { id: "d1", nombre: "ticket.jpg", huella: "h1", formato: "imagen", estado: "necesita_lectura" };
  const { resultado, ia } = resultadoConIA(doc, { ok: true, modo: "documento", lectura: TICKET, uso: USO }, CTX);
  assert.equal(resultado.estado, "propuesto"); assert.equal(resultado.propuestas.length, 1, "un ticket es UN gasto: su total, no sus artículos");
  const p = resultado.propuestas[0];
  assert.equal(p.destino, "egresos"); assert.equal(p.datos.monto, 348); assert.equal(p.datos.proveedor, "Ferretería El Clavo"); assert.equal(p.datos.fecha, "2026-11-27"); assert.equal(p.viaIA, true);
  assert.equal(ia.confiable, true); assert.equal(ia.microusd, 470); assert.match(resultado.resumen, /^Leído con IA/);
  // …y no se duplica contra lo ya capturado.
  const ya = resultadoConIA(doc, { ok: true, modo: "documento", lectura: TICKET, uso: USO }, { ...CTX, egresos: [{ id: "e1", fecha: "2026-11-27", monto: 348, proveedor: "FERRETERIA EL CLAVO" }] });
  assert.equal(ya.resultado.estado, "duplicado");
  // Un ticket anterior al arranque va al histórico: no crea un gasto de hoy.
  const viejo = resultadoConIA(doc, { ok: true, modo: "documento", lectura: { ...TICKET, fecha: "2025-03-03" }, uso: USO }, CTX);
  assert.equal(viejo.resultado.propuestas[0].destino, "historico");
});

test("la_aritmetica_la_hace_la_app_y_lo_dudoso_queda_por_revisar", () => {
  assert.equal(revisarLectura(TICKET).confiable, true);
  assert.match(revisarLectura({ ...TICKET, total: "384.00" }).motivos.join(" "), /suman 348 y el total leído es 384/);
  assert.equal(revisarLectura({ ...TICKET, subtotal: "348.00", total: "403.68" }).confiable, true, "si los renglones suman el subtotal, la diferencia es el IVA");
  assert.match(revisarLectura({ ...TICKET, total: "", no_se_leyo: ["total"] }).motivos.join(" "), /No se leyó el total/);
  assert.match(revisarLectura({ ...TICKET, fecha: "" }).motivos.join(" "), /fecha/);
  assert.equal(revisarLectura({ ...TICKET, confianza: "baja" }).confiable, false);
  assert.match(revisarLectura(TICKET, { cortada: true }).motivos.join(" "), /se cortó/);
  assert.deepEqual([revisarLectura({ clase: "ilegible" }).sirve, revisarLectura({ clase: "otro" }).sirve, revisarLectura({ clase: "estado_cuenta" }).sirve], [false, false, false]);
  const sinTotal = resultadoConIA({ id: "d1", nombre: "t.jpg", huella: "h" }, { ok: true, modo: "documento", lectura: { ...TICKET, total: "" }, uso: USO }, CTX);
  assert.equal(sinTotal.resultado.propuestas.length, 0, "sin total no se propone ningún gasto: no se inventa"); assert.equal(sinTotal.resultado.estado, "por_revisar");
});

test("una_nomina_en_foto_va_al_historico_y_jamas_crea_pagos", () => {
  const nomina = { clase: "nomina", confianza: "media", emisor: "", fecha: "2026-11-28", folio: "", subtotal: "", total: "4380", moneda: "", avisos: ["La letra del tercer renglón es difícil."], no_se_leyo: [],
    renglones: [R({ nombre: "Ana López Ruiz", importe: "2100", dias: "6" }), R({ nombre: "Beto Sánchez Díaz", importe: "2280", dias: "6" }), R({ nombre: "Carlos", importe: "" })] };
  const { resultado, ia } = resultadoConIA({ id: "d1", nombre: "raya.jpg", huella: "h" }, { ok: true, modo: "documento", lectura: nomina, uso: USO }, CTX);
  assert.ok(resultado.propuestas.every(p => p.destino === "historico")); assert.equal(resultado.propuestas.length, 2); assert.equal(resultado.descartadas.length, 1);
  assert.equal(ia.confiable, false); assert.match(resultado.excepciones.join(" "), /NO se crean pagos/); assert.match(resultado.excepciones.join(" "), /difícil/);
});

test("de_una_hoja_desordenada_la_ia_solo_dice_que_columna_es_cada_cosa_y_la_app_lee_toda_la_hoja", () => {
  const filas = [["RAYA"], ["Quién", "Cuánto", "Cuándo"], ["Ana López Ruiz", 2100, "28/11/2026"], ["Beto Sánchez Díaz", 2280, "28/11/2026"]];
  const lectura = { clase: "nomina", confianza: "alta", renglon_encabezado: "1", columnas: { nombre: "0", importe: "c1", fecha: "2", puesto: "", dias: "9" }, avisos: [] };
  const a = aprendidoDeLectura(lectura, filas);
  assert.ok(a.ok); assert.deepEqual(a.mapa, { fecha: 2, nombre: 0, importe: 1 }, "una columna que no existe (la 9) no se acepta");
  const doc = { id: "d1", nombre: "raya.xlsx", huella: "h", formato: "excel", hojas: [{ nombre: "Hoja1", filas }] };
  assert.equal(proponer(doc, CTX).estado, "por_revisar", "sola, la app no la reconoce");
  const r = resultadoConIA(doc, { ok: true, modo: "hoja", lectura, uso: { ...USO, microusd: 60 } }, CTX);
  assert.equal(r.resultado.estado, "propuesto"); assert.equal(r.resultado.propuestas.length, 2); assert.equal(r.resultado.propuestas[0].datos.monto, 2100);
  assert.match(r.resultado.excepciones[0], /las reconoció la IA/); assert.deepEqual(r.aprendido.mapa, a.mapa, "queda listo para aprenderse CUANDO una persona lo confirme");
  assert.equal(aprendidoDeLectura({ clase: "estado_cuenta" }, filas).ok, false); assert.equal(aprendidoDeLectura({ clase: "nomina", renglon_encabezado: "40", columnas: {} }, filas).ok, false);
});

test("si_el_servidor_dice_que_no_hay_presupuesto_o_falta_la_llave_no_se_inventa_nada", () => {
  const r = resultadoConIA({ id: "d1" }, { error: "sin_presupuesto", dice: "Se llegó al tope autorizado." }, CTX);
  assert.equal(r.motivo, "sin_presupuesto"); assert.equal(r.resultado, undefined); assert.match(r.error, /tope autorizado/);
  assert.equal(resultadoConIA({ id: "d1" }, { error: "sin_llave", dice: "No está configurada." }, CTX).motivo, "sin_llave");
});

test("se_sabe_cuanto_costo_cada_documento_y_cuantos_leyo_bien_la_ia", () => {
  let evs = [];
  const sube = (h, nombre) => { const r = recibirDocumento({ huella: h.repeat(64), nombre, formato: "imagen", eventos: evs, ...en("2026-11-30") }); evs.push(r.evento); return bandejaDe(evs).find(d => d.id === r.evento.id); };
  const lee = (doc, lectura, uso = USO) => { const r = resultadoConIA(doc, { ok: true, modo: "documento", lectura, uso }, { ...CTX, egresos: [], documentos: bandejaDe(evs) }); evs.push(anotarLectura({ doc, resultado: r.resultado, ia: r.ia, ...en("2026-11-30") })); return r.resultado; };
  // 1: leído bien y aceptado tal cual.
  const d1 = sube("a", "ticket1.jpg"), r1 = lee(d1, TICKET);
  evs.push(...confirmarIncorporacion({ doc: bandejaDe(evs).find(d => d.id === d1.id), resultado: r1, conIA: true, ...en("2026-11-30"), azar: az }).eventos);
  // 2: una relación de dos gastos; la persona quitó uno.
  const d2 = sube("b", "gastos.jpg"), r2 = lee(d2, { ...TICKET, clase: "gastos", total: "", renglones: [R({ fecha: "2026-11-26", nombre: "CFE", importe: "900" }), R({ fecha: "2026-11-26", nombre: "Gasolinera", importe: "500" })] });
  evs.push(...confirmarIncorporacion({ doc: bandejaDe(evs).find(d => d.id === d2.id), resultado: r2, escogidas: [r2.propuestas[0].llave], conIA: true, ...en("2026-11-30"), azar: az }).eventos);
  // 3: primero con el económico (dudoso), luego con el superior; la persona lo descarta.
  const d3 = sube("c", "borroso.jpg"); lee(d3, { ...TICKET, confianza: "baja", folio: "B-9", total: "99" }); lee(bandejaDe(evs).find(d => d.id === d3.id), { ...TICKET, folio: "B-9", total: "99", renglones: [] }, { ...USO, modelo: "claude-sonnet-5-5", nivel: "superior", microusd: 9000 });
  evs.push(descartarDocumento({ doc: bandejaDe(evs).find(d => d.id === d3.id), motivo: "La IA lo leyó mal", ...en("2026-11-30") }).evento);
  // 4: la IA no pudo.  5: leído y esperando a una persona.
  const d4 = sube("d", "mancha.jpg"); lee(d4, { clase: "ilegible", confianza: "baja", renglones: [], no_se_leyo: [], avisos: [] });
  const d5 = sube("e", "ticket5.jpg"); lee(d5, { ...TICKET, folio: "Z-5", total: "77" });
  const m = metricasDeIA(evs);
  assert.equal(m.documentos, 5); assert.equal(m.lecturas, 6); assert.equal(m.microusd, 470 * 5 + 9000); assert.equal(m.superior, 1);
  assert.deepEqual([m.correctos, m.conCambios, m.descartados, m.noPudo, m.pendientes], [1, 1, 1, 1, 1]);
  assert.equal(m.tasa, 25, "1 aceptado tal cual de 4 ya decididos; el pendiente no cuenta"); assert.equal(m.filas[0].nombre, "borroso.jpg", "el más caro primero");
  assert.equal(metricasDeIA([]).tasa, null, "sin documentos decididos no hay tasa: un 100 % sobre cero es una mentira");
  assert.equal(bandejaDe(evs).find(d => d.id === d3.id).iaMicrousd, 9470, "el costo de un documento suma todas sus lecturas");
});

test("el_costo_maximo_se_dice_antes_de_gastar_y_el_presupuesto_se_dice_en_palabras", () => {
  assert.equal(costoMaximo("economico", { imagenes: 1 }), 5450); assert.equal(costoMaximo("superior", { imagenes: 1 }), 109000, "el superior aparta veinte veces más");
  assert.equal(enDolares(5450), "$0.0055"); assert.equal(enDolares(4000000), "$4.00"); assert.equal(enDolares(0), "$0");
  const p = estadoDelPresupuesto({ tope: 4000000, gastado: 1250000, apartado: 50000, lecturas: 310 });
  assert.equal(p.queda, 2700000); assert.equal(p.agotado, false); assert.match(p.dice, /Autorizado \$4\.00 · gastado \$1\.25 en 310 lectura\(s\) · queda \$2\.70/);
  assert.equal(estadoDelPresupuesto({ tope: 4000000, gastado: 4000000 }).agotado, true);
  assert.equal(estadoDelPresupuesto(null).seSabe, false, "si no se pudo consultar, no se manda nada");
});
