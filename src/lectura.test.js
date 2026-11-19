// ============================================================
//  Pruebas de la lectura de papeles
//
//  Cada prueba lleva el nombre de lo que cuida. Casi todas cuidan la misma
//  cosa: que el sistema NO invente. Un dato que falta se dice; no se rellena
//  con algo plausible.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizar, renglones, aNumero, numerosDe, aFecha,
  uuidDe, uuidDeQR, clasificar,
  identificarEmisor, leerConPatron, aprenderPatron,
  cobertura, criteriosCoincidencia, evaluarFoto, tasaSobrevivencia,
  proponerAplicacion, yaSeAplico, renglonesAplicables,
  emparejarConInventario, costoUnitarioDe, costoPromedio,
  ventanasDeSeguridad,
} from "./lectura.js";

/* Un ticket de verdad, como el que el encargado guarda en la bolsa de la camisa. */
const TICKET_SURCO = `
AGROVETERINARIA EL SURCO SA DE CV
RFC: ASU120315QX4
CALZ. REVOLUCION 44, ZACATECAS
FECHA: 12/08/2026
FOLIO: 44821
--------------------------------
40 BULTOS UREA 46-00-00      23,200.00
2 LITROS COADYUVANTE            340.00
--------------------------------
SUBTOTAL                     23,540.00
IVA 16%                       3,766.40
TOTAL                        27,306.40
EFECTIVO                     27,306.40
`;

/* El mismo proveedor, el mes que entra: mismo formato, otros números. */
const TICKET_SURCO_SEPTIEMBRE = `
AGROVETERINARIA EL SURCO SA DE CV
RFC: ASU120315QX4
CALZ. REVOLUCION 44, ZACATECAS
FECHA: 09/09/2026
FOLIO: 45903
--------------------------------
15 BULTOS SULFATO DE AMONIO   6,750.00
--------------------------------
SUBTOTAL                      6,750.00
IVA 16%                       1,080.00
TOTAL                         7,830.00
EFECTIVO                      7,830.00
`;

/* ════════════ LEER NÚMEROS Y FECHAS DE UN PAPEL ════════════ */

test("los_pesos_del_ticket_se_leen_con_el_formato_de_mexico", () => {
  assert.equal(aNumero("23,200.00"), 23200);
  assert.equal(aNumero("$ 27,306.40"), 27306.4);
  assert.equal(aNumero("1 234.56"), 1234.56);
  assert.equal(aNumero("(1,500.00)"), -1500); // entre paréntesis es negativo
  assert.equal(aNumero("1.234,56"), 1234.56); // formato europeo
});

test("lo_que_no_es_un_numero_no_se_convierte_en_cero", () => {
  // Un cero se suma; un "no lo encontré" se pregunta. No son lo mismo.
  assert.equal(aNumero(""), null);
  assert.equal(aNumero(null), null);
  assert.equal(aNumero("SUBTOTAL"), null);
  assert.equal(aNumero("no se alcanza a ver"), null);
  assert.equal(aNumero(0), 0); // un cero de verdad sí es cero
});

test("la_fecha_del_rancho_va_con_el_dia_primero", () => {
  assert.equal(aFecha("12/08/2026"), "2026-08-12");   // 12 de agosto, no 8 de diciembre
  assert.equal(aFecha("09-09-26"), "2026-09-09");
  assert.equal(aFecha("2026-08-12"), "2026-08-12");
  assert.equal(aFecha("12 DE AGOSTO DE 2026"), "2026-08-12");
  assert.equal(aFecha("12 AGO 2026"), "2026-08-12");
  assert.equal(aFecha("sin fecha"), null);
});

test("normalizar_quita_acentos_para_poder_comparar", () => {
  assert.equal(normalizar(" Agroveterinaria  El Súrco "), "AGROVETERINARIA EL SURCO");
  assert.equal(normalizar(null), "");
});

test("los_numeros_de_un_renglon_traen_su_posicion", () => {
  const ns = numerosDe("40 BULTOS UREA 46-00-00      23,200.00");
  assert.ok(ns.length >= 2);
  assert.equal(ns[0].valor, 40);
  assert.equal(ns[ns.length - 1].valor, 23200);
  assert.ok(ns[0].desde < ns[ns.length - 1].desde);
});

/* ════════════ QUÉ ES ESTE PAPEL ════════════ */

test("el_folio_fiscal_sale_del_QR_no_de_leerle_el_total", () => {
  // Un 3 leído como 8 sale plausible y equivocado y nadie lo revisa. El UUID
  // no: o está bien formado o no lo está.
  const qr = "https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=A1B2C3D4-E5F6-7890-ABCD-EF1234567890&re=ASU120315QX4&tt=27306.40";
  assert.equal(uuidDeQR(qr), "A1B2C3D4-E5F6-7890-ABCD-EF1234567890");
  assert.equal(uuidDe("Folio fiscal a1b2c3d4-e5f6-7890-abcd-ef1234567890 timbrado"), "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  assert.equal(uuidDeQR("cualquier cosa"), null);
});

test("con_folio_fiscal_es_factura_y_lo_dice_seguro", () => {
  const r = clasificar("COMPROBANTE\nA1B2C3D4-E5F6-7890-ABCD-EF1234567890");
  assert.equal(r.tipo, "factura");
  assert.equal(r.seguro, true);
});

test("si_no_reconoce_el_papel_no_adivina", () => {
  // "por identificar" es la respuesta correcta: una persona lo resuelve en
  // diez segundos, contra tres horas en el cierre.
  const r = clasificar("papel arrugado\nse ve una firma\ny un sello");
  assert.equal(r.tipo, "por identificar");
  assert.equal(r.seguro, false);
  assert.ok(r.porque.length > 0);
});

test("un_estado_de_cuenta_no_se_confunde_con_un_ticket", () => {
  const r = clasificar("BBVA MEXICO\nESTADO DE CUENTA\nSALDO ANTERIOR 120,000.00\nSALDO FINAL 84,300.00");
  assert.equal(r.tipo, "estado_cuenta");
});

test("una_sola_palabra_suelta_no_alcanza_para_clasificar", () => {
  // "TOTAL" aparece en medio mundo. Con una sola pista, no clasifica.
  const r = clasificar("HOJA SUELTA\nTOTAL 500");
  assert.equal(r.tipo, "por identificar");
});

/* ════════════ EL RECONOCIMIENTO LOCAL QUE APRENDE ════════════ */

test("el_proveedor_conocido_se_lee_gratis_el_mes_que_entra", () => {
  // Agosto: una persona confirma los datos y el sistema aprende DÓNDE estaban.
  const patron = aprenderPatron({
    texto: TICKET_SURCO,
    emisor: "AGROVETERINARIA EL SURCO",
    rfc: "ASU120315QX4",
    tipo: "ticket",
    camposConfirmados: { total: 27306.40, subtotal: 23540, iva: 3766.40, fecha: "2026-08-12" },
  });
  assert.equal(patron.campos.total.ancla, "TOTAL");
  assert.equal(patron.campos.fecha.formato, "fecha");

  // Septiembre: el MISMO patrón, sin IA, sin señal, otros números.
  const lectura = leerConPatron(patron, TICKET_SURCO_SEPTIEMBRE);
  assert.equal(lectura.fuente, "patron-local");
  assert.equal(lectura.campos.total.valor, 7830);
  assert.equal(lectura.campos.subtotal.valor, 6750);
  assert.equal(lectura.campos.iva.valor, 1080);
  assert.equal(lectura.campos.fecha.valor, "2026-09-09");
  assert.deepEqual(lectura.faltantes, []);
});

test("lo_que_se_aprende_es_donde_estaba_el_dato_no_cual_era", () => {
  const patron = aprenderPatron({
    texto: TICKET_SURCO, emisor: "EL SURCO", tipo: "ticket",
    camposConfirmados: { total: 27306.40 },
  });
  // El patrón NO guarda 27,306.40 por ningún lado: guarda el ancla.
  assert.equal(JSON.stringify(patron).includes("27306"), false);
  assert.equal(patron.campos.total.ancla, "TOTAL");
});

test("un_campo_que_no_encontro_lo_deja_vacio_y_dice_cual_falta", () => {
  const patron = {
    emisor: "EL SURCO", tipo: "ticket",
    campos: {
      total: { ancla: "TOTAL", donde: "misma-derecha", formato: "moneda" },
      retencion: { ancla: "RETENCION ISR", donde: "misma-derecha", formato: "moneda" },
    },
  };
  const r = leerConPatron(patron, TICKET_SURCO);
  assert.equal(r.campos.total.valor, 27306.40);
  assert.equal(r.campos.retencion, undefined);   // no se inventa
  assert.deepEqual(r.faltantes, ["retencion"]);  // y se dice cuál
});

test("aprende_la_cantidad_aunque_el_numero_vaya_antes_del_texto", () => {
  // "40 BULTOS UREA": el número va primero, el ancla queda a su derecha.
  const patron = aprenderPatron({
    texto: TICKET_SURCO, emisor: "EL SURCO", tipo: "ticket",
    camposConfirmados: { bultos: 40 },
  });
  assert.equal(patron.campos.bultos.ancla, "BULTOS");
  assert.equal(patron.campos.bultos.donde, "misma-izquierda");
  assert.equal(leerConPatron(patron, TICKET_SURCO_SEPTIEMBRE).campos.bultos.valor, 15);
});

test("si_el_valor_confirmado_no_aparece_en_el_papel_no_aprende_de_mas", () => {
  // Más vale no saberlo que aprender mal: un ancla equivocada envenena todos
  // los meses siguientes.
  const patron = aprenderPatron({
    texto: TICKET_SURCO, emisor: "EL SURCO", tipo: "ticket",
    camposConfirmados: { total: 27306.40, flete: 999999 },
  });
  assert.ok(patron.campos.total);
  assert.equal(patron.campos.flete, undefined);
});

test("corregir_un_campo_reaprende_solo_ese_y_respeta_los_demas", () => {
  const v1 = aprenderPatron({
    texto: TICKET_SURCO, emisor: "EL SURCO", tipo: "ticket",
    camposConfirmados: { total: 27306.40, fecha: "2026-08-12" },
  });
  const v2 = aprenderPatron({
    patronPrevio: v1, texto: TICKET_SURCO,
    camposConfirmados: { subtotal: 23540 },
  });
  assert.equal(v2.campos.total.ancla, "TOTAL");      // el viejo sigue
  assert.equal(v2.campos.subtotal.ancla, "SUBTOTAL"); // y se sumó el nuevo
  assert.equal(v2.emisor, "EL SURCO");
});

test("al_emisor_se_le_reconoce_por_su_rfc_antes_que_por_su_nombre", () => {
  const patrones = [
    { emisor: "AGROVETERINARIA EL SURCO", rfc: "ASU120315QX4", tipo: "ticket" },
    { emisor: "FERRETERIA LA UNION", rfc: "FUN980101AB1", tipo: "ticket" },
  ];
  const p = identificarEmisor(TICKET_SURCO, patrones);
  assert.equal(p.emisor, "AGROVETERINARIA EL SURCO");
  assert.equal(identificarEmisor("papel de nadie", patrones), null);
});

test("al_emisor_conocido_ya_no_hay_que_preguntarle_a_la_IA_que_es", () => {
  const patrones = [{ emisor: "AGROVETERINARIA EL SURCO", rfc: "ASU120315QX4", tipo: "ticket" }];
  const r = clasificar(TICKET_SURCO, { patronesConocidos: patrones });
  assert.equal(r.tipo, "ticket");
  assert.equal(r.seguro, true);
  assert.ok(r.porque.includes("ya se conoce"));
});

/* ════════════ NO PINTAR DE VERDE LO QUE NO SE MIRÓ ════════════ */

test("la_cobertura_dice_cuales_campos_faltan_por_su_nombre", () => {
  // "92 %" no le sirve a nadie. Saber que falta la fecha, sí.
  const c = cobertura({ total: 1, subtotal: 1 }, ["total", "subtotal", "fecha", "proveedor"]);
  assert.equal(c.leidos, 2);
  assert.equal(c.completa, false);
  assert.deepEqual(c.faltan, ["fecha", "proveedor"]);
});

test("sin_campos_requeridos_no_hay_fraccion_inventada", () => {
  assert.equal(cobertura({}, []).fraccion, null);
});

test("la_conciliacion_devuelve_los_criterios_no_un_porcentaje", () => {
  const r = criteriosCoincidencia(
    { monto: 27306.40, contraparte: "AGROVETERINARIA EL SURCO", fecha: "2026-08-12" },
    { monto: 27306.40, contraparte: "PAGO AGROVETERINARIA EL SURCO", fecha: "2026-08-15" },
  );
  const dichos = r.criterios.map(c => c.dice);
  assert.ok(dichos.includes("importe exacto"));
  assert.ok(dichos.some(d => d.includes("nombre")));
  assert.ok(dichos.some(d => d.includes("3 día")));
  assert.equal(r.proponer, true);
});

test("dos_pagos_iguales_con_nombre_distinto_no_se_proponen", () => {
  const r = criteriosCoincidencia(
    { monto: 5000, contraparte: "EL SURCO", fecha: "2026-08-12" },
    { monto: 5000, contraparte: "FERRETERIA LA UNION", fecha: "2026-08-12" },
  );
  assert.equal(r.proponer, false);
});

/* ════════════ LA FOTO BORROSA NO SE PIERDE ════════════ */

test("la_foto_borrosa_avisa_pero_JAMAS_bloquea", () => {
  // Esa camisa con el ticket en la bolsa se lava el sábado. El comprobante
  // se guarda siempre, aunque no se pueda leer.
  const r = evaluarFoto({ nitidez: 12, ancho: 400, alto: 300 });
  assert.equal(r.seGuarda, true);
  assert.equal(r.sirveParaLeer, false);
  assert.ok(r.avisos.length >= 1);

  const buena = evaluarFoto({ nitidez: 180, ancho: 1600, alto: 1200 });
  assert.equal(buena.seGuarda, true);
  assert.equal(buena.sirveParaLeer, true);
  assert.deepEqual(buena.avisos, []);
});

/* ════════════ LA MEDIDA QUE IMPORTA ════════════ */

test("se_cuenta_lo_que_sobrevivio_sin_corregir_no_lo_que_se_propuso", () => {
  // Contar "cuántas propuso" sube solo con proponer más, aunque se proponga mal.
  const t = tasaSobrevivencia([
    { revisada: true, corregida: false },
    { revisada: true, corregida: false },
    { revisada: true, corregida: true },
    { revisada: false },
  ]);
  assert.equal(t.propuestas, 4);
  assert.equal(t.revisadas, 3);
  assert.equal(t.sobrevivieron, 2);
  assert.equal(t.corregidas, 1);
  assert.equal(t.sinRevisar, 1);
  assert.ok(Math.abs(t.tasa - 2 / 3) < 1e-9);
});

test("sin_nada_revisado_no_hay_tasa_que_presumir", () => {
  // Un 100 % sobre cero revisiones es una mentira con cara de dato.
  const t = tasaSobrevivencia([{ revisada: false }, { revisada: false }]);
  assert.equal(t.tasa, null);
  assert.equal(t.sinRevisar, 2);
});

/* ════════════ DE UN XML NO SE APRENDEN ANCLAS ════════════ */

test("un_xml_no_ensucia_el_patron_con_anclas_del_marcado", () => {
  // Un XML ya viene estructurado: cada dato trae su nombre. Buscarle "junto
  // a qué palabra estaba el total" dentro del marcado produce anclas sin
  // sentido (Moneda="MXN" Total=") que después se aplicarían a un ticket de
  // papel y leerían cualquier cosa. Más vale no saberlo que aprender mal.
  const xml = '<cfdi:Comprobante Version="4.0" Folio="44821" SubTotal="23540.00" Moneda="MXN" Total="27306.40">';
  const patron = aprenderPatron({
    texto: xml, emisor: "EL SURCO", tipo: "factura",
    camposConfirmados: { total: 27306.40 },
  });
  // aprenderPatron por sí solo SÍ intentaría aprender algo del marcado...
  const anclas = Object.values(patron.campos).map(c => c.ancla);
  // ...y esa ancla no serviría en un ticket impreso, que dice sólo "TOTAL".
  for (const a of anclas) {
    assert.equal(a.includes('="'), false, `el ancla "${a}" viene del marcado del XML, no del papel`);
  }
});

/* ════════════ QUE LA LECTURA SE VUELVA EL MOVIMIENTO ════════════ */

const TICKET_LEIDO = {
  id: "lec1", tipo: "ticket", foto: "data:image/jpeg;base64,xxx",
  campos: { emisor: "AGROVETERINARIA EL SURCO", fecha: "2026-08-12", total: 27306.40, uuid: null },
  renglones: [
    { concepto: "UREA 46-00-00", cantidad: 40, unidad: "BULTO", importe: 23200 },
    { concepto: "COADYUVANTE", cantidad: null, unidad: "LITRO", importe: 340 },
  ],
};

test("el_ticket_de_fertilizante_se_vuelve_un_egreso_con_su_comprobante", () => {
  const p = proponerAplicacion(TICKET_LEIDO);
  assert.equal(p.puede, true);
  assert.equal(p.seccion, "egresos");
  assert.equal(p.borrador.monto, 27306.40);
  assert.equal(p.borrador.fecha, "2026-08-12");
  assert.equal(p.borrador.proveedor, "AGROVETERINARIA EL SURCO");
  // La foto ES el comprobante: va pegada al egreso, no suelta en otro lado.
  assert.equal(p.borrador.ticket, "data:image/jpeg;base64,xxx");
  // Y queda dicho de qué papel salió, para poder volver a él.
  assert.equal(p.borrador.origenLectura, "lec1");
});

test("un_gasto_sin_factura_se_registra_como_tal_no_se_esconde", () => {
  // No es un problema a esconder: es un gasto no deducible que hay que
  // registrar como tal. Lo grave no es que exista, es que nadie sepa.
  assert.equal(proponerAplicacion(TICKET_LEIDO).borrador.tieneComprobanteFiscal, false);
  const conFactura = { ...TICKET_LEIDO, campos: { ...TICKET_LEIDO.campos, uuid: "A1B2C3D4-E5F6-7890-ABCD-EF1234567890" } };
  assert.equal(proponerAplicacion(conFactura).borrador.tieneComprobanteFiscal, true);
});

test("un_papel_no_se_aplica_dos_veces", () => {
  // Dos aplicaciones del mismo ticket duplican el gasto, y un gasto duplicado
  // se descubre tarde y mal.
  const yaAplicado = { ...TICKET_LEIDO, aplicado: { seccion: "egresos", id: "eg9", cuando: "2026-08-13T10:00:00.000Z" } };
  const p = proponerAplicacion(yaAplicado);
  assert.equal(p.puede, false);
  assert.equal(p.yaAplicada, true);
  assert.ok(p.porque.includes("duplicaría"));
  assert.equal(yaSeAplico(yaAplicado), true);
  assert.equal(yaSeAplico(TICKET_LEIDO), false);
});

test("sin_monto_no_se_arma_un_egreso_y_se_dice_que_falta", () => {
  // Un egreso sin monto no es un egreso.
  const sinTotal = { ...TICKET_LEIDO, campos: { emisor: "EL SURCO", fecha: "2026-08-12" } };
  const p = proponerAplicacion(sinTotal);
  assert.equal(p.puede, false);
  assert.deepEqual(p.faltan, ["total"]);
  assert.ok(p.porque.includes("total"));
});

test("un_papel_sin_identificar_no_se_aplica_a_ciegas", () => {
  const p = proponerAplicacion({ id: "x", tipo: "por identificar", campos: { total: 500 } });
  assert.equal(p.puede, false);
  assert.ok(p.porque.includes("Todavía no se sabe qué es"));
});

test("la_lectura_del_horometro_se_aplica_a_la_maquina", () => {
  const p = proponerAplicacion({ id: "h1", tipo: "horometro", campos: { lectura: "1246", fecha: "2026-09-08" } });
  assert.equal(p.puede, true);
  assert.equal(p.seccion, "maquinaria");
  assert.equal(p.borrador.lectura, 1246);
});

test("la_etiqueta_del_agroquimico_NO_pone_cero_en_reentrada_ni_carencia", () => {
  // Es seguridad de personas: un cero ahí dice "ya se puede entrar" sobre un
  // dato que nadie leyó. Si no viene, va en null y se ve que falta.
  const p = proponerAplicacion({ id: "e1", tipo: "etiqueta_agroquimico", campos: { nombre: "Fungicida X" } });
  assert.equal(p.puede, true);
  assert.equal(p.borrador.reentradaDias, null);
  assert.equal(p.borrador.carenciaDias, null);
  const conDatos = proponerAplicacion({ id: "e2", tipo: "etiqueta_agroquimico", campos: { nombre: "Fungicida X", reentradaDias: "2", carenciaDias: "14" } });
  assert.equal(conDatos.borrador.reentradaDias, 2);
  assert.equal(conDatos.borrador.carenciaDias, 14);
});

test("los_renglones_sin_cantidad_no_entran_solos_al_almacen_y_se_dice", () => {
  const r = renglonesAplicables(TICKET_LEIDO);
  assert.equal(r.sirven.length, 1);
  assert.equal(r.sirven[0].concepto, "UREA 46-00-00");
  assert.equal(r.fuera, 1);
  assert.ok(r.porque.includes("no traen cantidad"));
});

/* ════════════ LO QUE ENTRA AL ALMACÉN ════════════ */

const ALMACEN = [
  { id: "i1", nombre: "Urea 46-00-00", unidad: "bulto", existencia: 10, costo_unit: 580 },
  { id: "i2", nombre: "Sulfato de amonio", unidad: "bulto", existencia: 0, costo_unit: 0 },
  { id: "i3", nombre: "Coadyuvante", unidad: "L", existencia: 5, costo_unit: 170 },
];

test("el_renglon_del_ticket_se_engancha_al_insumo_del_almacen", () => {
  const r = emparejarConInventario({ concepto: "UREA 46-00-00", cantidad: 40, importe: 23200 }, ALMACEN);
  assert.equal(r.hay, true);
  assert.equal(r.insumo.id, "i1");
  assert.equal(r.seguro, true);
  assert.deepEqual(r.criterios, ["mismo nombre"]);   // el criterio, no un porcentaje
});

test("cuando_dos_insumos_encajan_igual_NO_elige_solo", () => {
  // Dos fertilizantes parecidos no son el mismo saco.
  const almacen = [
    { id: "a", nombre: "Fertilizante foliar", existencia: 1 },
    { id: "b", nombre: "Fertilizante suelo", existencia: 1 },
  ];
  const r = emparejarConInventario({ concepto: "FERTILIZANTE PREMIUM" }, almacen);
  assert.equal(r.empate, true);
  assert.equal(r.seguro, false);
  assert.ok(r.porque.includes("Elige tú"));
});

test("lo_que_no_esta_en_el_almacen_se_dice_para_darlo_de_alta", () => {
  const r = emparejarConInventario({ concepto: "MANGUERA DE 2 PULGADAS" }, ALMACEN);
  assert.equal(r.hay, false);
  assert.ok(r.porque.includes("dar de alta"));
});

test("el_costo_por_bulto_sale_del_renglon", () => {
  assert.equal(costoUnitarioDe({ cantidad: 40, importe: 23200 }), 580);
  assert.equal(costoUnitarioDe({ cantidad: 3, importe: 100 }), 33.33);
});

test("sin_cantidad_o_sin_importe_NO_se_supone_un_costo", () => {
  // Un costo inventado se arrastra a todas las salidas del año.
  assert.equal(costoUnitarioDe({ cantidad: null, importe: 23200 }), null);
  assert.equal(costoUnitarioDe({ cantidad: 40, importe: null }), null);
  assert.equal(costoUnitarioDe({ cantidad: 0, importe: 100 }), null);
});

test("la_urea_de_marzo_y_la_de_agosto_se_promedian", () => {
  // 10 bultos a $580 (marzo) + 40 bultos a $940 (agosto).
  const r = costoPromedio({ existencia: 10, costoActual: 580, entra: 40, costoEntrada: 940 });
  assert.equal(r.completo, true);
  assert.equal(r.costo, 868);   // (10*580 + 40*940) / 50
});

test("si_lo_que_habia_no_tiene_costo_el_promedio_se_marca_incompleto", () => {
  const r = costoPromedio({ existencia: 10, costoActual: 0, entra: 40, costoEntrada: 940 });
  assert.equal(r.completo, false);
  assert.equal(r.costo, 940);
  assert.ok(r.porque.includes("incompleto"));
});

test("sin_existencia_previa_el_costo_es_el_de_la_entrada", () => {
  const r = costoPromedio({ existencia: 0, costoActual: 0, entra: 40, costoEntrada: 940 });
  assert.equal(r.costo, 940);
  assert.equal(r.completo, true);
});

/* ════════════ REENTRADA Y CARENCIA: SEGURIDAD DE PERSONAS ════════════ */

const INSUMOS_SEG = [
  { id: "q1", nombre: "Fungicida Fuerte", reentradaDias: 3, carenciaDias: 14 },
  { id: "q2", nombre: "Foliar sin datos" },   // la etiqueta no se capturó
];

test("no_se_entra_a_la_parcela_hasta_que_pasa_la_reentrada", () => {
  const v = ventanasDeSeguridad({
    aplicaciones: [{ id: "a1", parcelaId: "R01", fecha: "2026-09-06", productos: [{ insumoId: "q1" }] }],
    inventario: INSUMOS_SEG, hoy: "2026-09-08",
  });
  assert.equal(v.noEntrar.length, 1);
  assert.equal(v.filas[0].entrarDesde, "2026-09-09");
  assert.ok(v.noEntrar[0].entrada.dice.includes("No entrar"));
  // Y el corte sigue cerrado hasta el 20.
  assert.equal(v.filas[0].cortarDesde, "2026-09-20");
  assert.equal(v.noCortar.length, 1);
});

test("pasada_la_reentrada_ya_se_puede_entrar_pero_no_cortar", () => {
  const v = ventanasDeSeguridad({
    aplicaciones: [{ id: "a1", parcelaId: "R01", fecha: "2026-09-06", productos: [{ insumoId: "q1" }] }],
    inventario: INSUMOS_SEG, hoy: "2026-09-10",
  });
  assert.equal(v.noEntrar.length, 0);
  assert.equal(v.noCortar.length, 1);
});

test("un_producto_sin_reentrada_capturada_NO_dice_que_ya_se_puede_entrar", () => {
  // Ésta es la que importa. Un cero ahí manda gente a una parcela recién
  // aplicada, y eso no se arregla después.
  const v = ventanasDeSeguridad({
    aplicaciones: [{ id: "a2", parcelaId: "R02", fecha: "2026-09-08", productos: [{ insumoId: "q2" }] }],
    inventario: INSUMOS_SEG, hoy: "2026-09-08",
  });
  assert.equal(v.filas[0].reentradaDias, null);      // null, NO cero
  assert.equal(v.filas[0].entrarDesde, null);
  assert.equal(v.filas[0].entrada.estado, "no se sabe");
  assert.ok(v.filas[0].entrada.dice.includes("NO quiere decir que ya se pueda entrar"));
  assert.equal(v.noEntrar.length, 0);   // no es una alarma de peligro...
  assert.equal(v.sinDato.length, 1);    // ...es una alarma de dato faltante
});

test("lo_que_bloquea_y_lo_que_no_se_sabe_van_por_separado", () => {
  // Confundirlas enseña a ignorar las dos.
  const v = ventanasDeSeguridad({
    aplicaciones: [
      { id: "a1", parcelaId: "R01", fecha: "2026-09-07", productos: [{ insumoId: "q1" }] },
      { id: "a2", parcelaId: "R02", fecha: "2026-09-07", productos: [{ insumoId: "q2" }] },
    ],
    inventario: INSUMOS_SEG, hoy: "2026-09-08",
  });
  assert.equal(v.noEntrar.length, 1);
  assert.equal(v.sinDato.length, 1);
  assert.notEqual(v.noEntrar[0].parcelaId, v.sinDato[0].parcelaId);
});
