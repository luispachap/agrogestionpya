import { test } from "node:test";
import assert from "node:assert/strict";
import { formatoDe, esBasura, leerCfdi, entenderHoja, aprenderHoja, extraerDeHoja, entenderTexto, situar, llaveDe, proponer, incorporar, resumenDeBandeja, relacionados, resumenDelHistorico, categoriaDe, enmascarar, firmaDe, sueldoEsPorDia } from "./importacion.js";

const XML = (mas = {}) => `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" Serie="A" Folio="${mas.folio || "1234"}" Fecha="${mas.fecha || "2026-11-25"}T10:15:00" SubTotal="1000.00" Moneda="${mas.moneda || "MXN"}" Total="${mas.total || "1160.00"}" TipoDeComprobante="${mas.tipo || "I"}" FormaPago="03" MetodoPago="PUE">
  <cfdi:Emisor Rfc="${mas.emisor || "AGR010101AAA"}" Nombre="AGROQUIMICOS DEL CENTRO SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="${mas.receptor || "XAXX010101000"}" Nombre="RANCHO DE PRUEBA" UsoCFDI="G03"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="10171500" Cantidad="20" ClaveUnidad="XBX" Unidad="BULTO" Descripcion="UREA 46% &quot;GRANULADA&quot;" ValorUnitario="50.00" Importe="1000.00"/></cfdi:Conceptos>
  <cfdi:Complemento>${mas.sinTimbre ? "" : `<tfd:TimbreFiscalDigital xmlns:tfd="x" Version="1.1" UUID="${mas.uuid || "11111111-2222-3333-4444-555555555555"}" FechaTimbrado="2026-11-25T10:16:00"/>`}${mas.nomina || ""}</cfdi:Complemento>
</cfdi:Comprobante>`;
const CTX = { inicio: "2026-11-20", rfcsPropios: ["XAXX010101000"], egresos: [], historico: [], trabajadores: [{ id: "t1", nombre: "Ana López Ruiz" }], encargados: [], proveedores: [], maquinaria: [{ id: "m1", nombre: "Tractor 3" }], parcelas: [{ id: "p1", nombre: "La Loma" }], documentos: [], aprendidos: [] };
const doc = (mas) => ({ id: "d1", nombre: "archivo", huella: "h1", formato: "excel", ...mas });

test("cada_archivo_se_reconoce_por_su_extension_y_la_basura_de_una_carpeta_no_es_un_documento", () => {
  assert.equal(formatoDe("factura.XML"), "xml"); assert.equal(formatoDe("nomina sem 12.xlsx"), "excel"); assert.equal(formatoDe("lista.csv"), "csv"); assert.equal(formatoDe("contrato.docx"), "word");
  assert.equal(formatoDe("viejo.doc"), "word_viejo"); assert.equal(formatoDe("ticket.JPG"), "imagen"); assert.equal(formatoDe("x", "application/pdf"), "pdf"); assert.equal(formatoDe("programa.exe"), "otro");
  assert.ok(esBasura("carpeta/.DS_Store")); assert.ok(esBasura("Thumbs.db")); assert.ok(esBasura("nominas/~$nomina.xlsx")); assert.ok(!esBasura("nominas/nomina.xlsx"));
});

test("el_xml_de_una_factura_se_abre_exacto_y_sin_adivinar_nada", () => {
  const c = leerCfdi(XML());
  assert.ok(c.ok); assert.equal(c.uuid, "11111111-2222-3333-4444-555555555555"); assert.equal(c.total, 1160); assert.equal(c.fecha, "2026-11-25"); assert.equal(c.tipo, "ingreso");
  assert.equal(c.emisor.nombre, "AGROQUIMICOS DEL CENTRO SA DE CV"); assert.equal(c.conceptos[0].concepto, 'UREA 46% "GRANULADA"'); assert.equal(c.conceptos[0].cantidad, 20);
  assert.equal(leerCfdi("<hola/>").ok, false);
  assert.match(leerCfdi(XML({ sinTimbre: true })).avisos.join(" "), /No trae folio fiscal/);
  assert.match(leerCfdi(XML({ moneda: "USD" })).avisos.join(" "), /no en pesos/);
});

test("una_factura_recibida_despues_del_arranque_se_propone_como_gasto_y_una_de_antes_va_al_historico_sin_crear_nada", () => {
  const nueva = proponer(doc({ formato: "xml", cfdi: leerCfdi(XML()) }), CTX);
  assert.equal(nueva.estado, "propuesto"); assert.equal(nueva.clase, "cfdi_gasto"); assert.equal(nueva.propuestas[0].destino, "egresos");
  assert.equal(nueva.propuestas[0].datos.monto, 1160); assert.equal(nueva.propuestas[0].datos.categoria, "insumos"); assert.equal(nueva.propuestas[0].datos.uuid, "11111111-2222-3333-4444-555555555555");
  const vieja = proponer(doc({ formato: "xml", cfdi: leerCfdi(XML({ fecha: "2025-08-12" })) }), CTX);
  assert.equal(vieja.propuestas[0].destino, "historico"); assert.equal(vieja.propuestas[0].datos.clase, "gasto"); assert.equal(vieja.propuestas[0].datos.mes, "2025-08");
  const sinInicio = proponer(doc({ formato: "xml", cfdi: leerCfdi(XML()) }), { ...CTX, inicio: null });
  assert.equal(sinInicio.propuestas[0].destino, "historico", "sin fecha de inicio declarada, todo entra como histórico");
});

test("el_mismo_comprobante_no_entra_dos_veces_ni_el_mismo_archivo", () => {
  const ya = { ...CTX, egresos: [{ id: "e1", fecha: "2026-11-25", monto: 1160, uuid: "11111111-2222-3333-4444-555555555555" }] };
  const r = proponer(doc({ formato: "xml", cfdi: leerCfdi(XML()) }), ya);
  assert.equal(r.estado, "duplicado"); assert.equal(r.propuestas[0].accion, "duplicado");
  const gemelo = proponer(doc({ id: "d2", huella: "h1" }), { ...CTX, documentos: [{ id: "d1", nombre: "factura.xml", huella: "h1", estado: "incorporado", recibido: "2026-11-26T10:00:00Z" }] });
  assert.equal(gemelo.estado, "duplicado"); assert.match(gemelo.resumen, /mismo archivo que «factura.xml»/);
  const cancelado = proponer(doc({ formato: "xml", cfdi: leerCfdi(XML()) }), { ...CTX, egresos: [{ ...ya.egresos[0], cancelado: { motivo: "x" } }] });
  assert.equal(cancelado.estado, "propuesto", "un gasto cancelado no estorba");
});

test("una_venta_del_rancho_y_un_recibo_de_nomina_nunca_crean_ingresos_ni_pagos_quedan_como_referencia", () => {
  const venta = proponer(doc({ formato: "xml", cfdi: leerCfdi(XML({ emisor: "XAXX010101000", receptor: "CLI010101BBB" })) }), CTX);
  assert.equal(venta.clase, "cfdi_ingreso"); assert.equal(venta.propuestas[0].destino, "historico"); assert.match(venta.excepciones.join(" "), /se registran en Finanzas/);
  const nomina = `<nomina12:Nomina xmlns:nomina12="x" FechaPago="2026-11-28" FechaInicialPago="2026-11-22" FechaFinalPago="2026-11-28" NumDiasPagados="7" TotalPercepciones="2800.00" TotalDeducciones="150.00"><nomina12:Receptor Curp="XXXX000000HDFXXX00" NumSeguridadSocial="12345678901"/></nomina12:Nomina>`;
  const c = leerCfdi(XML({ tipo: "N", total: "2650.00", emisor: "XAXX010101000", receptor: "LORA900101AB1", nomina }));
  assert.equal(c.tipo, "nomina"); assert.equal(c.nomina.dias, 7); assert.ok(!JSON.stringify(c).includes("12345678901"), "el número de seguridad social no se guarda"); assert.ok(!JSON.stringify(c.nomina).includes("XXXX000000"), "ni la CURP");
  const r = proponer(doc({ formato: "xml", cfdi: c }), CTX);
  assert.equal(r.clase, "cfdi_nomina"); assert.ok(r.propuestas.every(p => p.destino === "historico")); assert.match(r.excepciones.join(" "), /NO crea ningún pago/);
  assert.equal(enmascarar("LORA900101AB1"), "LORA…AB1");
});

const NOMINA = [["RANCHO DE PRUEBA"], ["Nómina semana 46"], [], ["Nombre del trabajador", "Puesto", "Días trabajados", "Sueldo diario", "Total a pagar"],
  ["Ana López Ruiz", "Campo", 6, 350, "2,100.00"], ["Beto Sánchez Díaz", "Riego", 6, 380, "$2,280.00"], ["Carlos sin importe", "Campo", 6, 350, "pendiente"], ["TOTAL", "", "", "", "4,380.00"]];

test("una_hoja_de_nomina_se_reconoce_por_sus_encabezados_aunque_tenga_membrete_y_el_renglon_de_totales_no_es_una_persona", () => {
  const e = entenderHoja(NOMINA);
  assert.equal(e.clase, "nomina"); assert.equal(e.i, 3); assert.equal(e.mapa.nombre, 0); assert.equal(e.mapa.importe, 4); assert.equal(e.mapa.sueldo, 3);
  const x = extraerDeHoja(e, NOMINA);
  assert.deepEqual(x.registros.map(r => [r.nombre, r.monto]), [["Ana López Ruiz", 2100], ["Beto Sánchez Díaz", 2280]]);
  assert.equal(x.descartadas.length, 1); assert.match(x.descartadas[0].porque, /cuánto se le pagó/); assert.equal(x.descartadas[0].renglon, 7, "dice cuál renglón, para irlo a ver");
});

test("la_nomina_va_al_historico_y_jamas_crea_pagos_aunque_sea_posterior_al_arranque", () => {
  const filas = [["Fecha", "Nombre", "Importe"], ["28/11/2026", "Ana López Ruiz", 2100], ["12/08/2025", "Ana López Ruiz", 1900]];
  const r = proponer(doc({ hojas: [{ nombre: "Hoja1", filas }] }), CTX);
  assert.equal(r.clase, "nomina"); assert.ok(r.propuestas.every(p => p.destino === "historico"));
  assert.equal(r.propuestas[0].datos.referencia, true); assert.equal(r.propuestas[1].datos.referencia, false); assert.equal(r.propuestas[1].datos.fecha, "2025-08-12", "el día va primero, como en México");
  assert.match(r.excepciones.join(" "), /NO se crean pagos/);
  const ops = incorporar(doc({}), r, { quien: { id: "u1", nombre: "Luis", rol: "admin" }, fecha: "2026-11-30" }).ops;
  assert.ok(ops.every(o => o.sec === "historico")); assert.equal(ops[0].item._importado.documentoId, "d1");
});

test("una_lista_de_personal_propone_altas_solo_de_quien_no_esta_ya_y_sin_pin_ni_saldos", () => {
  const filas = [["Nombre", "Puesto", "Sueldo diario", "Fecha de ingreso"], ["ANA LOPEZ RUIZ", "Campo", 350, "01/03/2024"], ["Beto Sánchez Díaz", "Riego", 380, "15/06/2022"], ["Beto", "", "", ""]];
  const r = proponer(doc({ hojas: [{ nombre: "Personal", filas }] }), CTX);
  assert.equal(r.clase, "personal");
  assert.deepEqual(r.propuestas.map(p => [p.datos.nombre, p.accion]), [["ANA LOPEZ RUIZ", "duplicado"], ["Beto Sánchez Díaz", "agregar"]], "Ana ya está en el catálogo, aunque venga con otras mayúsculas y sin acento");
  assert.equal(r.descartadas.length, 1);
  const { ops } = incorporar(doc({}), r, { fecha: "2026-11-30" });
  assert.equal(ops.length, 1); assert.equal(ops[0].sec, "trabajadores"); assert.equal(ops[0].item.fechaIngreso, "2022-06-15"); assert.equal(ops[0].item.pin, undefined); assert.equal(ops[0].item.sueldo_dia, 380);
  assert.equal(entenderHoja([["Nombre", "RFC", "Teléfono"], ["Juan Pérez", "X", "1"]]).clase, "desconocido", "sólo con un nombre no se supone que es personal");
});

test("la_bitacora_de_combustible_posterior_al_arranque_se_propone_al_vehiculo_solo_si_se_sabe_cual_es", () => {
  const filas = [["Fecha", "Unidad", "Litros", "Importe", "Horómetro"], ["25/11/2026", "TRACTOR 3", 80, 2000, 1520], ["26/11/2026", "La Nissan", 40, 1000, ""], ["10/05/2025", "Tractor 3", 60, 1400, 900], ["27/11/2026", "Tractor 3", "", 500, ""]];
  const r = proponer(doc({ hojas: [{ nombre: "Diésel", filas }] }), CTX);
  assert.equal(r.clase, "combustible");
  assert.deepEqual(r.propuestas.map(p => p.destino), ["egresos", "historico", "historico"]);
  assert.equal(r.propuestas[0].datos.vehiculoId, "m1"); assert.equal(r.propuestas[0].datos.categoria, "combustible");
  assert.match(r.excepciones.join(" "), /vehículos que no están en el catálogo/); assert.equal(r.descartadas.length, 1); assert.match(r.descartadas[0].porque, /litros/);
});

test("las_actividades_no_se_crean_solas_y_los_gastos_de_antes_no_crean_gastos_de_hoy", () => {
  const act = proponer(doc({ hojas: [{ nombre: "Labores", filas: [["Fecha", "Actividad", "Parcela", "Trabajador", "Importe"], ["26/11/2026", "Riego", "La Loma", "Ana", 350]] }] }), CTX);
  assert.equal(act.clase, "actividades", "aunque traiga nombre e importe, es una hoja de actividades"); assert.equal(act.propuestas[0].destino, "historico"); assert.match(act.excepciones.join(" "), /NO se crean solas/);
  const gastos = proponer(doc({ hojas: [{ nombre: "Gastos", filas: [["Fecha", "Proveedor", "Concepto", "Total"], ["03/03/2025", "CFE", "Luz del pozo", 4500], ["27/11/2026", "Ferretería El Clavo", "Tornillos", 120]] }] }), CTX);
  assert.deepEqual(gastos.propuestas.map(p => [p.destino, p.datos.monto]), [["historico", 4500], ["egresos", 120]]);
  assert.equal(gastos.propuestas[1].datos.categoria, "otro"); assert.equal(categoriaDe("Recibo de CFE"), "servicios"); assert.equal(categoriaDe("DIESEL"), "insumos");
});

test("un_renglon_igual_a_un_gasto_ya_capturado_no_se_propone_otra_vez", () => {
  const ctx = { ...CTX, egresos: [{ id: "e1", fecha: "2026-11-27", monto: 120, proveedor: "FERRETERIA EL CLAVO SA DE CV" }], historico: [{ llave: "gasto:2025-03-03:4500.00:CFE" }] };
  const r = proponer(doc({ hojas: [{ nombre: "Gastos", filas: [["Fecha", "Proveedor", "Concepto", "Total"], ["03/03/2025", "CFE", "Luz del pozo", 4500], ["27/11/2026", "Ferretería El Clavo", "Tornillos", 120], ["27/11/2026", "Ferretería El Clavo", "Tornillos", 120]] }] }), ctx);
  assert.ok(r.propuestas.every(p => p.accion === "duplicado")); assert.equal(r.estado, "duplicado");
  assert.equal(llaveDe({ clase: "gastos", fecha: "2026-11-27", monto: 120, proveedor: "Ferretería El Clavo" }), "gasto:2026-11-27:120.00:FERRETERIA CLAVO");
});

test("lo_que_no_se_reconoce_no_se_adivina_y_lo_que_una_persona_confirma_se_aprende_para_la_siguiente", () => {
  const filas = [["F.", "Quién", "Cuánto"], ["27/11/2026", "Ferretería El Clavo", 120]];
  const r = proponer(doc({ hojas: [{ nombre: "Hoja1", filas }] }), CTX);
  assert.equal(r.estado, "por_revisar"); assert.equal(r.propuestas.length, 0); assert.match(r.excepciones.join(" "), /no se reconoce/);
  assert.equal(aprenderHoja([], { encabezados: filas[0], clase: "gastos", mapa: { fecha: 0 } }).ok, false, "para gastos hacen falta fecha e importe");
  const a = aprenderHoja([], { encabezados: filas[0], clase: "gastos", mapa: { fecha: 0, proveedor: 1, importe: 2 }, quien: "Luis", fecha: "2026-11-30" });
  assert.ok(a.ok); assert.equal(a.patron.firma, firmaDe(filas[0]));
  const otraVez = proponer(doc({ id: "d2", huella: "h2", hojas: [{ nombre: "Hoja1", filas: [filas[0], ["28/11/2026", "Otro", 300]] }] }), { ...CTX, aprendidos: a.aprendidos });
  assert.equal(otraVez.estado, "propuesto"); assert.equal(otraVez.hojas[0].aprendido, true); assert.equal(otraVez.propuestas[0].datos.monto, 300);
});

test("una_imagen_un_escaneo_y_un_word_viejo_se_dicen_y_el_pdf_impreso_de_una_factura_se_pega_a_su_xml", () => {
  assert.equal(proponer(doc({ formato: "imagen" }), CTX).estado, "necesita_lectura");
  assert.equal(proponer(doc({ formato: "pdf", escaneado: true }), CTX).estado, "necesita_lectura");
  assert.equal(proponer(doc({ formato: "word_viejo" }), CTX).estado, "por_revisar");
  const t = entenderTexto("FACTURA\nFolio fiscal: 11111111-2222-3333-4444-555555555555\nRFC emisor AGR010101AAA\nTotal $1,160.00");
  assert.equal(t.uuid, "11111111-2222-3333-4444-555555555555"); assert.deepEqual(t.rfcs, ["AGR010101AAA"]);
  const solo = proponer(doc({ formato: "pdf", texto: "Folio fiscal: 11111111-2222-3333-4444-555555555555 Total 1,160.00" }), CTX);
  assert.equal(solo.estado, "por_revisar"); assert.match(solo.excepciones.join(" "), /Sube también su XML/); assert.equal(solo.propuestas.length, 0, "el total de un PDF no se adivina");
  const conXml = proponer(doc({ id: "d2", huella: "h2", formato: "pdf", texto: "Folio fiscal: 11111111-2222-3333-4444-555555555555" }), { ...CTX, documentos: [{ id: "d1", nombre: "factura.xml", huella: "h1", uuid: "11111111-2222-3333-4444-555555555555", estado: "incorporado" }] });
  assert.equal(conXml.estado, "incorporado"); assert.equal(conXml.relacionadoCon, "d1");
  assert.deepEqual(relacionados([{ id: "d1", uuid: "U" }, { id: "d2", uuid: "U" }, { id: "d3", uuid: "V" }]), [{ uuid: "U", ids: ["d1", "d2"] }]);
  assert.equal(proponer(doc({ formato: "pdf", texto: "Hola, buenas tardes" }), CTX).estado, "por_revisar");
});

test("la_bandeja_cuenta_cada_estado_y_el_historico_se_resume_por_mes_sin_mezclarse_con_la_operacion", () => {
  const b = resumenDeBandeja([{ estado: "recibido" }, { estado: "propuesto" }, { estado: "propuesto" }, { estado: "incorporado" }, { estado: "error" }]);
  assert.equal(b.total, 5); assert.equal(b.por.propuesto, 2); assert.equal(b.pendientes, 1); assert.equal(b.porAtender, 3);
  assert.deepEqual(resumenDelHistorico([{ mes: "2025-08", clase: "gasto", monto: 100 }, { mes: "2025-08", clase: "gasto", monto: 50.5 }, { mes: "2025-08", clase: "nomina", monto: 10 }]).map(x => [x.mes, x.clase, x.monto, x.n]), [["2025-08", "gasto", 150.5, 2], ["2025-08", "nomina", 10, 1]]);
  assert.equal(situar("2026-11-19", "2026-11-20"), "historico"); assert.equal(situar("2026-11-20", "2026-11-20"), "operacion"); assert.equal(situar(null, "2026-11-20"), "sin_fecha");
});

import { recibirDocumento, anotarLectura, confirmarIncorporacion, descartarDocumento, eventoDeAprendizaje, bandejaDe, historicoDe, aprendidosDe, T_DOC } from "./importacion.js";
import { cancelarEvento } from "./eventos.js";
const Q = { id: "u1", nombre: "Luis", rol: "admin" }; let nn = 0; const az = () => (++nn) / 1e6; const en = (d) => ({ quien: Q, cuando: `${d}T12:00:00-06:00`, fecha: d, azar: az() });

test("la_bandeja_se_calcula_de_lo_que_le_paso_a_cada_documento_y_el_mismo_archivo_no_se_recibe_dos_veces", () => {
  const r = recibirDocumento({ huella: "a".repeat(64), nombre: "gastos 2025.xlsx", ruta: "historico/2025", formato: "excel", bytes: 1200, lote: "L1", eventos: [], ...en("2026-11-30") });
  assert.ok(r.ok); let evs = [r.evento];
  assert.equal(bandejaDe(evs)[0].estado, "recibido");
  const otra = recibirDocumento({ huella: "a".repeat(64), nombre: "copia de gastos.xlsx", formato: "excel", eventos: evs, ...en("2026-11-30") });
  assert.equal(otra.ok, false); assert.ok(otra.repetido); assert.match(otra.dice, /mismo archivo que «gastos 2025.xlsx»/);
  // Se lee: 2 renglones al histórico (son de 2025).
  const filas = [["Fecha", "Proveedor", "Concepto", "Total"], ["03/03/2025", "CFE", "Luz del pozo", 4500], ["04/03/2025", "Ferretería", "Tornillos", 120]];
  const d = { ...bandejaDe(evs)[0], hojas: [{ nombre: "Hoja1", filas }] }, res = proponer(d, { ...CTX, documentos: bandejaDe(evs) });
  evs.push(anotarLectura({ doc: d, resultado: res, ...en("2026-11-30") }));
  const leido = bandejaDe(evs)[0];
  assert.equal(leido.estado, "propuesto"); assert.equal(leido.n.historico, 2); assert.equal(leido.clase, "gastos"); assert.deepEqual(leido.periodo, { desde: "2025-03-03", hasta: "2025-03-04" });
  // Se confirma: un lote de histórico y la marca; ningún gasto de hoy.
  const c = confirmarIncorporacion({ doc: leido, resultado: res, ...en("2026-11-30"), azar: az });
  assert.ok(c.ok); assert.equal(c.registros.length, 0, "lo histórico no crea gastos"); assert.deepEqual(c.eventos.map(e => e.tipo), [T_DOC.historico, T_DOC.incorporado]);
  evs.push(...c.eventos);
  assert.equal(bandejaDe(evs)[0].estado, "incorporado"); assert.equal(historicoDe(evs).length, 2); assert.equal(historicoDe(evs)[0].documento, "gastos 2025.xlsx");
  assert.equal(confirmarIncorporacion({ doc: bandejaDe(evs)[0], resultado: res, ...en("2026-12-01") }).ok, false, "un papel se aplica una sola vez");
  // Volverlo a subir con otro nombre no duplica: ya están en el histórico.
  const otroArchivo = proponer({ id: "doc-x", huella: "b", nombre: "otro.xlsx", formato: "excel", hojas: [{ nombre: "Hoja1", filas }] }, { ...CTX, historico: historicoDe(evs), documentos: bandejaDe(evs) });
  assert.equal(otroArchivo.estado, "duplicado");
  // Deshacer: se cancela el lote, y el histórico se vacía sin borrar nada.
  const lote = evs.find(e => e.tipo === T_DOC.historico);
  evs = evs.map(e => (e.id === lote.id ? cancelarEvento(e, { motivo: "Se subió la hoja equivocada", quien: Q, cuando: "2026-12-01T10:00:00-06:00" }) : e));
  assert.equal(historicoDe(evs).length, 0);
});

test("lo_posterior_al_arranque_sale_como_registros_por_guardar_y_solo_lo_que_la_persona_escogio", () => {
  const r = recibirDocumento({ huella: "c".repeat(64), nombre: "gastos nov.xlsx", formato: "excel", eventos: [], ...en("2026-11-30") });
  const filas = [["Fecha", "Proveedor", "Concepto", "Total"], ["27/11/2026", "Ferretería El Clavo", "Tornillos", 120], ["28/11/2026", "CFE", "Luz", 900]];
  const d = { ...bandejaDe([r.evento])[0], hojas: [{ nombre: "Hoja1", filas }] }, res = proponer(d, CTX);
  const c = confirmarIncorporacion({ doc: d, resultado: res, escogidas: [res.propuestas[1].llave], ...en("2026-11-30"), azar: az });
  assert.equal(c.registros.length, 1); assert.equal(c.registros[0].sec, "egresos"); assert.equal(c.registros[0].item.monto, 900); assert.equal(c.registros[0].item._importado.documento, "gastos nov.xlsx");
  assert.deepEqual(c.eventos.map(e => e.tipo), [T_DOC.incorporado]);
  assert.equal(confirmarIncorporacion({ doc: d, resultado: res, escogidas: [], ...en("2026-11-30") }).ok, false);
});

test("descartar_pide_motivo_un_error_se_puede_reintentar_y_lo_aprendido_queda_para_todos", () => {
  const r = recibirDocumento({ huella: "d".repeat(64), nombre: "raro.pdf", formato: "pdf", eventos: [], ...en("2026-11-30") }); let evs = [r.evento];
  evs.push(anotarLectura({ doc: bandejaDe(evs)[0], error: "No se pudo abrir el PDF", ...en("2026-11-30") }));
  assert.equal(bandejaDe(evs)[0].estado, "error"); assert.equal(bandejaDe(evs)[0].intentos, 1); assert.match(bandejaDe(evs)[0].error, /No se pudo abrir/);
  evs.push(anotarLectura({ doc: bandejaDe(evs)[0], error: "No se pudo abrir el PDF", ...en("2026-11-30") }));
  assert.equal(bandejaDe(evs)[0].intentos, 2);
  assert.equal(descartarDocumento({ doc: bandejaDe(evs)[0], motivo: "", ...en("2026-11-30") }).ok, false);
  evs.push(descartarDocumento({ doc: bandejaDe(evs)[0], motivo: "No es del rancho", ...en("2026-11-30") }).evento);
  assert.equal(bandejaDe(evs)[0].estado, "descartado");
  const a = eventoDeAprendizaje({ aprendidos: [], encabezados: ["F.", "Quién", "Cuánto"], clase: "gastos", mapa: { fecha: 0, proveedor: 1, importe: 2 }, ...en("2026-11-30") });
  assert.ok(a.ok); assert.deepEqual(aprendidosDe([a.evento]).map(x => [x.clase, x.mapa.importe]), [["gastos", 2]]);
});

import { csvAFilas, docxAContenido } from "./importacion.js";
test("un_csv_se_lee_como_texto_con_su_separador_y_un_word_entrega_sus_tablas_y_su_texto", () => {
  assert.deepEqual(csvAFilas('Fecha;Proveedor;Total\r\n12/08/2026;"Ferretería; El Clavo";"1,200.50"\r\n\r\n'), [["Fecha", "Proveedor", "Total"], ["12/08/2026", "Ferretería; El Clavo", "1,200.50"]]);
  assert.deepEqual(csvAFilas("a,b\n1,\"dijo \"\"hola\"\"\""), [["a", "b"], ["1", 'dijo "hola"']]);
  const e = entenderHoja(csvAFilas("Fecha,Proveedor,Total\n12/08/2026,CFE,900"));
  assert.equal(extraerDeHoja(e, csvAFilas("Fecha,Proveedor,Total\n12/08/2026,CFE,900")).registros[0].fecha, "2026-08-12", "12 de agosto, no 8 de diciembre");
  const xml = `<w:document><w:body><w:p><w:r><w:t>Lista de personal del rancho</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Nombre</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t xml:space="preserve">Puesto</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Beto S&#225;nchez </w:t></w:r><w:r><w:t>D&amp;az</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Riego</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`;
  const c = docxAContenido(xml);
  assert.equal(c.texto, "Lista de personal del rancho"); assert.deepEqual(c.tablas, [[["Nombre", "Puesto"], ["Beto Sánchez D&az", "Riego"]]]);
  assert.equal(entenderHoja(c.tablas[0]).clase, "personal");
});

import { refrescar } from "./importacion.js";
test("si_entre_leer_y_confirmar_alguien_ya_lo_registro_deja_de_proponerse", () => {
  const filas = [["Fecha", "Proveedor", "Concepto", "Total"], ["27/11/2026", "Ferretería El Clavo", "Tornillos", 120], ["28/11/2026", "CFE", "Luz", 900]];
  const res = proponer(doc({ hojas: [{ nombre: "Hoja1", filas }] }), CTX);
  const r = refrescar(res, { egresos: [{ id: "e9", fecha: "2026-11-28", monto: 900, proveedor: "CFE" }] });
  assert.equal(r.cambiaron, 1); assert.deepEqual(r.propuestas.map(p => p.accion), ["agregar", "duplicado"]);
  const c = confirmarIncorporacion({ doc: doc({}), resultado: r, ...en("2026-12-01"), azar: az });
  assert.equal(c.registros.length, 1); assert.equal(c.registros[0].item.monto, 120);
});

test("un_renglon_de_datos_no_se_toma_por_encabezado_aunque_diga_proveedor_o_total", () => {
  const filas = [["F.", "Quién", "Cuánto"], ["27/11/2026", "PROVEEDOR 3 DE PRUEBA", 120], ["28/11/2026", "TOTAL FERRETERIA", "300.00"]];
  assert.equal(entenderHoja(filas).clase, "desconocido", "los títulos no se reconocen, y los datos de abajo no son títulos");
  assert.equal(entenderHoja([["Fecha", "Proveedor", "Total"], ["27/11/2026", "PROVEEDOR 3", 120]]).i, 0);
});

// Una foto de la lista de nómina del rancho (22 nov): «Empleado | Sueldo | Dispersado | Préstamo | Efectivo | Firma». El
// sueldo es el de la SEMANA y los nombres son apodos.
test("un_sueldo_sin_decir_por_dia_no_se_da_de_alta_como_sueldo_por_dia", () => {
  const filas = [["Lista de nomina"], ["16 al 21 de noviembre 2026"], ["Empleado", "Sueldo", "Dispersado", "Prestamo", "Efectivo", "Prestamo Solicitado", "Firma"],
    ["Abc Defg", 3500, "", 0, 2900, "", ""], ["Abcd Efgh", "4,231.60", "2,500.60", 0, "1,731.00", "", ""]];
  const r = proponer(doc({ hojas: [{ nombre: "Hoja1", filas }] }), CTX);
  assert.equal(r.clase, "personal");
  assert.ok(r.propuestas.length === 2 && r.propuestas.every(p => p.datos.sueldo_dia == null), "3,500 es la semana: no se vuelve sueldo por día");
  assert.deepEqual(r.propuestas.map(p => p.datos.sueldoEscrito), [3500, 4231.6], "se enseña lo que decía la hoja");
  assert.match(r.excepciones.join(" "), /no dice si el sueldo es por día/);
  const { ops } = incorporar(doc({}), r, { fecha: "2026-11-30" });
  assert.ok(ops.every(o => o.item.sueldo_dia === undefined), "la ficha nace sin sueldo: se pone al revisarla");
  for (const [enc, porDia] of [["Sueldo diario", true], ["SALARIO DIARIO", true], ["Pago por día", true], ["SD", true], ["Cuota diaria", true], ["Sueldo", false], ["Salario", false], ["Sueldo semanal", false]]) assert.equal(sueldoEsPorDia(enc), porDia, enc);
});

test("en_una_lista_de_pagos_un_apodo_corto_es_un_nombre", () => {
  const filas = [["Nombre", "Importe"], ["Abcd", "2,128.00"], ["Ab", 1731], ["A", 500], ["Abcdefg", 1000]];
  const x = extraerDeHoja(entenderHoja(filas), filas);
  assert.deepEqual(x.registros.map(r => [r.nombre, r.monto]), [["Abcd", 2128], ["Ab", 1731], ["Abcdefg", 1000]], "un apodo de cuatro letras («Gera», «Rigo») no se tira");
  assert.equal(x.descartadas.length, 1, "una sola letra no es un nombre");
});
