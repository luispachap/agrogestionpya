// ============================================================
//  Pruebas de la predicción de insumos
//
//  El hilo de todas: la diferencia entre "no se va a acabar" y "no sé si se
//  va a acabar". La primera es una respuesta; la segunda es una pregunta, y
//  confundirlas es lo que hace que un día la cuadrilla llegue a la parcela y
//  no haya diésel.
//
//  Los datos son los del rancho: diésel del tanque, semilla de ajo, urea y
//  fertilizantes de las hojas de Fito.
//
//  UNA NOTA SOBRE EL SIGNO, porque de ahí salió el peor bug de este archivo:
//  en la app los movimientos de bodega viven todos en la misma lista y se
//  distinguen por el signo — el vale de salida entra en NEGATIVO y la compra
//  en POSITIVO. Por eso aquí las salidas se escriben negativas: así es como
//  las escribe la pantalla de vales, y probar con otra cosa sería probar una
//  app que no existe.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ritmoDeConsumo, cuandoSeAcaba, cuestaReponer, aTiempoDePedir,
  loQueVaAFaltar, pararaLaOperacion,
  VENTANA_DIAS, DIAS_DE_ENTREGA_SUPUESTOS, HORIZONTE_DIAS, ESTADOS,
  SIGNO_PURAS_SALIDAS,
} from "./prediccion.js";

const HOY = "2026-09-08";

const diaAntes = (dias, desde = HOY) => {
  const d = new Date(desde + "T00:00:00");
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Salidas parejas: 100 litros cada 10 días. Van en negativo, como los vales.
const salidasParejas = (insumoId, cuantas, cada, cantidad, hasta = HOY) => {
  const filas = [];
  for (let i = 0; i < cuantas; i++) {
    filas.push({ insumoId, cantidad: -Math.abs(cantidad), fecha: diaAntes(i * cada, hasta) });
  }
  return filas;
};

// Un vale de salida y una compra, tal como los escribe la app.
const vale = (insumoId, cantidad, fecha) => ({ insumoId, cantidad: -Math.abs(cantidad), fecha, concepto: "Vale de salida a parcela" });
const compra = (insumoId, cantidad, fecha) => ({ insumoId, cantidad: Math.abs(cantidad), fecha, concepto: "Compra", yaEsEgreso: true });

const DIESEL = { id: "d1", nombre: "Diésel", unidad: "L", existencia: 600, costo_unit: 24, diasDeEntrega: 3 };
const UREA = { id: "u1", nombre: "Urea", unidad: "bulto", existencia: 50, costo_unit: 868 };

/* ════════════ 1 · EL RITMO ════════════ */

test("sin_ninguna_salida_no_hay_ritmo_y_eso_NO_es_cero", () => {
  // Un cero se multiplica por los días y sale "aguanta para siempre". Un
  // "no sé" se pregunta.
  const r = ritmoDeConsumo({ salidas: [], insumoId: "d1", hoy: HOY });
  assert.equal(r.porDia, null);
  assert.equal(r.sabe, false);
  assert.ok(r.porque.includes("Nunca ha salido"));
  assert.ok(r.porque.includes("No quiere decir que no se gaste"));
});

test("con_una_sola_salida_no_hay_ritmo_hay_un_dato", () => {
  // Ésta es la regla que evita el bug: 200 litros en un día NO son 200 litros
  // diarios. De ahí saldría "se acaba el jueves" y no llegaría.
  const r = ritmoDeConsumo({
    salidas: [vale("d1", 200, "2026-09-01")],
    insumoId: "d1", hoy: HOY,
  });
  assert.equal(r.porDia, null);
  assert.equal(r.cuantas, 1);
  assert.ok(r.porque.includes("con la siguiente ya se sabe"));
});

test("saca_el_ritmo_de_las_salidas_reales_de_bodega", () => {
  // 10 salidas de 100 L, una cada 10 días: 1000 L en 90 días = 11.11 L/día.
  const r = ritmoDeConsumo({ salidas: salidasParejas("d1", 10, 10, 100), insumoId: "d1", hoy: HOY });
  assert.equal(r.sabe, true);
  assert.equal(r.cuantas, 10);
  assert.equal(r.total, 1000);
  assert.equal(r.dias, 90);
  assert.equal(Math.round(r.porDia * 100) / 100, 11.11);
  assert.equal(r.irregular, false);
});

test("salidas_dispares_dan_el_promedio_PERO_diciendo_que_es_irregular", () => {
  // Un tambo de 200 y una garrafa de 5 no son la misma salida. El promedio se
  // da —es lo que hay— pero no se disfraza de dato parejo.
  const r = ritmoDeConsumo({
    salidas: [
      vale("d1", 5, "2026-08-10"),
      vale("d1", 200, "2026-08-20"),
      vale("d1", 8, "2026-09-01"),
      vale("d1", 190, "2026-09-05"),
    ],
    insumoId: "d1", hoy: HOY,
  });
  assert.equal(r.sabe, true);
  assert.equal(r.irregular, true);
  assert.ok(r.queTanIrregular > 0.5);
  assert.equal(r.menor, 5);
  assert.equal(r.mayor, 200);
  assert.ok(r.porque.includes("no son parejas"));
});

test("un_insumo_que_dejo_de_moverse_no_es_un_insumo_sin_ritmo_cualquiera", () => {
  // Salidas de hace medio año. No se inventa un ritmo con ellas, y se dice
  // cuántos días lleva sin moverse — SIN suponer por qué.
  const r = ritmoDeConsumo({
    salidas: [vale("u1", 40, "2026-02-10"), vale("u1", 40, "2026-03-10")],
    insumoId: "u1", hoy: HOY,
  });
  assert.equal(r.porDia, null);
  assert.equal(r.hasta, "2026-03-10");
  assert.ok(r.porque.includes("No ha salido nada de bodega en los últimos 90 días"));
  // Ni una palabra de por qué: puede estar parada la labor o nadie anotó.
  assert.ok(!/robo|descuido|se olvid/i.test(r.porque));
});

test("una_salida_cancelada_no_se_gasto_y_no_cuenta_para_el_ritmo", () => {
  const r = ritmoDeConsumo({
    salidas: [
      vale("d1", 100, "2026-08-09"),
      vale("d1", 100, "2026-08-19"),
      { ...vale("d1", 5000, "2026-08-29"), cancelado: true, motivoCancelacion: "mal capturada" },
      vale("d1", 100, "2026-09-08"),
    ],
    insumoId: "d1", hoy: HOY,
  });
  assert.equal(r.total, 300);
  assert.equal(r.cuantas, 3);
});

test("un_ajuste_de_inventario_no_es_consumo", () => {
  // Una merma de −30 por diferencia de conteo no es producto que se aplicó.
  // Contarla dobla el ritmo y adelanta una fecha que no llega, y las alarmas
  // falsas enseñan a ignorar las alarmas.
  const r = ritmoDeConsumo({
    salidas: [
      vale("u1", 10, "2026-08-09"),
      vale("u1", 10, "2026-09-08"),
      { insumoId: "u1", cantidad: -300, fecha: "2026-09-01", esAjuste: true, causa: "diferencia de conteo" },
    ],
    insumoId: "u1", hoy: HOY,
  });
  assert.equal(r.total, 20);
  assert.equal(r.cuantas, 2);
  assert.equal(r.renglones.ajustes, 1);
});

test("una_salida_con_fecha_del_futuro_no_se_cae_en_silencio", () => {
  // Un dedazo en la fecha. Se deja fuera del cálculo, pero se DICE: un
  // renglón que se cae callado es lo que hace que un dato malo parezca bueno.
  const r = ritmoDeConsumo({
    salidas: [
      vale("d1", 100, "2026-08-09"),
      vale("d1", 100, "2026-09-08"),
      vale("d1", 100, "2027-09-08"),
    ],
    insumoId: "d1", hoy: HOY,
  });
  assert.equal(r.total, 200);
  assert.ok(r.porque.includes("fecha posterior a hoy"));
});

test("un_tramo_de_dos_dias_da_numero_pero_avisa_que_es_muy_corto", () => {
  const r = ritmoDeConsumo({
    salidas: [vale("d1", 100, "2026-09-07"), vale("d1", 100, "2026-09-08")],
    insumoId: "d1", hoy: HOY,
  });
  assert.equal(r.sabe, true);
  assert.equal(r.tramoCorto, true);
  assert.ok(r.porque.includes("muy corto"));
});

/* ── El signo: surtir el tanque no puede adelantar la fecha ── */

test("una_compra_no_es_consumo_y_surtir_el_tanque_no_adelanta_la_fecha", () => {
  // EL BUG QUE ESTO PREVIENE: la lista de bodega trae compras (positivas) y
  // vales (negativos). Si se lee "lo positivo" como consumo, se descarta cada
  // vale real y se cuenta cada COMPRA como si se hubiera gastado. Entonces
  // llegar con 1,000 litros al tanque DISPARA el ritmo y la app grita que hay
  // que pedir diésel el día que acaba de llegar el diésel.
  const movimientos = [
    compra("d1", 1000, "2026-08-09"),
    vale("d1", 100, "2026-08-19"),
    vale("d1", 100, "2026-08-29"),
    vale("d1", 100, "2026-09-05"),
    compra("d1", 1000, "2026-09-08"),
  ];
  const r = ritmoDeConsumo({ salidas: movimientos, insumoId: "d1", hoy: HOY });

  // 300 L de vales en 20 días = 15 al día. NO 2,000 en 30 días.
  assert.equal(r.porDia, 15);
  assert.equal(r.cuantas, 3);
  assert.equal(r.renglones.salidas, 3);
  assert.equal(r.renglones.entradas, 2);
  assert.ok(r.porque.includes("(3 salidas"));

  // Y surtir otra vez el tanque NO mueve el ritmo ni un litro.
  const conOtraCompra = ritmoDeConsumo({
    salidas: [...movimientos, compra("d1", 2000, "2026-09-08")],
    insumoId: "d1", hoy: HOY,
  });
  assert.equal(conOtraCompra.porDia, r.porDia);
});

test("puras_compras_y_ningun_vale_no_es_ritmo_cero_es_que_nadie_capturo_vales", () => {
  const r = ritmoDeConsumo({
    salidas: [compra("d1", 1000, "2026-08-09"), compra("d1", 1000, "2026-09-08")],
    insumoId: "d1", hoy: HOY,
  });
  assert.equal(r.sabe, false);
  assert.equal(r.porDia, null);
  assert.equal(r.renglones.entradas, 2);
  assert.ok(r.porque.includes("una compra no es consumo"));
});

test("quien_trae_una_lista_de_puras_salidas_lo_dice_al_llamar_no_se_adivina", () => {
  // Una lista ya filtrada a vales puede venir en positivo. Se acepta, pero
  // porque el llamador lo declara — nunca porque el módulo lo supuso.
  const r = ritmoDeConsumo({
    salidas: [
      { insumoId: "d1", cantidad: 100, fecha: "2026-08-09" },
      { insumoId: "d1", cantidad: 100, fecha: "2026-09-08" },
    ],
    insumoId: "d1", hoy: HOY, comoVieneElSigno: SIGNO_PURAS_SALIDAS,
  });
  assert.equal(r.sabe, true);
  assert.equal(r.total, 200);
  assert.equal(r.renglones.salidas, 2);
});

/* ── Nada se cae callado, y nada se mezcla ── */

test("un_vale_sin_cantidad_capturada_no_se_cae_en_silencio", () => {
  // EL BUG QUE ESTO PREVIENE: los renglones sin cantidad o sin fecha se
  // tiraban callados. Lo que quedaba cuadraba perfecto —"200 en 30 días,
  // 2 salidas"— y de los otros dos vales no se enteraba nadie. Es la misma
  // trampa del estado de cuenta: lo que sobrevive encadena bonito.
  const r = ritmoDeConsumo({
    salidas: [
      vale("d1", 100, "2026-08-09"),
      { insumoId: "d1", cantidad: null, fecha: "2026-08-19" },
      { insumoId: "d1", fecha: "2026-09-01" },
      vale("d1", 100, "2026-09-08"),
    ],
    insumoId: "d1", hoy: HOY,
  });
  assert.equal(r.renglones.sinCantidad, 2);
  assert.equal(r.hayCapturasIncompletas, true);
  assert.equal(r.descartadas, 2);
  assert.ok(r.porque.includes("no traen cantidad capturada"));
  assert.ok(r.porque.includes("no son cero, son capturas a medias"));
});

test("un_vale_sin_fecha_tampoco_se_cae_en_silencio", () => {
  const r = ritmoDeConsumo({
    salidas: [
      vale("d1", 100, "2026-08-09"),
      { insumoId: "d1", cantidad: -100 },
      vale("d1", 100, "2026-09-08"),
    ],
    insumoId: "d1", hoy: HOY,
  });
  assert.equal(r.renglones.sinFecha, 1);
  assert.ok(r.porque.includes("no traen fecha"));
});

test("sin_decir_de_que_insumo_no_se_contesta_con_la_bodega_entera", () => {
  // EL BUG QUE ESTO PREVIENE: sin insumoId el filtro dejaba pasar TODO, y el
  // ritmo salía de sumar litros de diésel con bultos de urea. Ese número
  // luego le ponía fecha de "se acaba" a un producto del que no ha salido ni
  // un gramo.
  const r = ritmoDeConsumo({
    salidas: [...salidasParejas("d1", 4, 10, 100), ...salidasParejas("u1", 4, 10, 4)],
    hoy: HOY,
  });
  assert.equal(r.sabe, false);
  assert.equal(r.porDia, null);
  assert.ok(r.porque.includes("No se dijo de qué insumo"));
  assert.ok(r.porque.includes("litros de diésel con bultos de urea"));
});

/* ════════════ 2 · CUÁNDO SE ACABA ════════════ */

test("dice_la_fecha_y_los_dias_que_faltan", () => {
  // 600 L a 11.11 L/día alcanzan 54 días: hasta el 1 de noviembre.
  const ritmo = ritmoDeConsumo({ salidas: salidasParejas("d1", 10, 10, 100), insumoId: "d1", hoy: HOY });
  const c = cuandoSeAcaba({ insumo: DIESEL, ritmo, hoy: HOY });
  assert.equal(c.sabe, true);
  assert.equal(c.dias, 54);
  assert.equal(c.fecha, "2026-11-01");
});

test("sin_ritmo_no_hay_fecha_y_la_fecha_es_null_no_una_lejana", () => {
  const ritmo = ritmoDeConsumo({ salidas: [], insumoId: "d1", hoy: HOY });
  const c = cuandoSeAcaba({ insumo: DIESEL, ritmo, hoy: HOY });
  assert.equal(c.sabe, false);
  assert.equal(c.fecha, null);
  assert.equal(c.dias, null);
  assert.ok(c.porque.includes("Nunca ha salido") || c.porque.includes("nunca ha salido"));
});

test("sin_existencia_capturada_no_se_supone_que_hay_cero_ni_que_hay_mucho", () => {
  const c = cuandoSeAcaba({ insumo: { nombre: "Urea", existencia: undefined }, ritmo: 5, hoy: HOY });
  assert.equal(c.sabe, false);
  assert.equal(c.existencia, null);
  assert.ok(c.porque.includes("no se sabe cuánto hay"));
});

test("un_saldo_en_negativo_se_dice_como_lo_que_es_una_pregunta", () => {
  // El almacén deja el saldo ir a negativo a propósito: un −30 dice que o
  // entró algo que nadie capturó, o salió más de lo anotado.
  const c = cuandoSeAcaba({ insumo: { nombre: "Urea", unidad: "bulto", existencia: -30 }, ritmo: 2, hoy: HOY });
  assert.equal(c.dias, 0);
  assert.ok(c.porque.includes("en negativo"));
  assert.ok(c.porque.includes("Antes de pedir, cuéntalo"));
});

test("estar_en_cero_no_es_lo_mismo_que_hacer_falta", () => {
  // EL BUG QUE ESTO PREVIENE: la existencia en cero devolvía "sabe: true"
  // ANTES de mirar si había ritmo. Con eso, un fungicida descontinuado que
  // lleva dos años en cero se convertía en "ya va tarde, si se pide hoy va a
  // haber 7 días sin producto" — sobre un insumo del que no existe un solo
  // dato de consumo.
  const c = cuandoSeAcaba({
    insumo: { id: "z1", nombre: "Fungicida viejo", existencia: 0 },
    ritmo: ritmoDeConsumo({ salidas: [], insumoId: "z1", hoy: HOY }),
    hoy: HOY,
  });
  assert.equal(c.sabe, false);
  assert.equal(c.fecha, null);
  assert.equal(c.yaSeAcabo, true);
  assert.ok(c.porque.includes("ya está en cero"));
  assert.ok(c.porque.includes("no se sabe si hace falta reponerlo"));
});

test("acepta_el_ritmo_como_numero_suelto_para_quien_ya_lo_trae", () => {
  const c = cuandoSeAcaba({ insumo: { nombre: "Urea", existencia: 50 }, ritmo: 5, hoy: HOY });
  assert.equal(c.dias, 10);
  assert.equal(c.fecha, "2026-09-18");
});

/* ════════════ 3 · CUÁNTO CUESTA REPONERLO ════════════ */

test("cuesta_reponerlo_al_costo_promedio_de_la_bodega", () => {
  // Urea a $580 en marzo y $940 en agosto quedó en $868 promedio: 40 bultos
  // son $34,720, no $23,200 ni $37,600.
  const c = cuestaReponer({ insumo: UREA, cantidad: 40 });
  assert.equal(c.sabe, true);
  assert.equal(c.costoUnit, 868);
  assert.equal(c.costoTotal, 34720);
  assert.ok(c.porque.includes("no lo que el proveedor vaya a cobrar"));
});

test("sin_costo_registrado_NO_cuesta_cero_no_se_sabe", () => {
  // Cero pesos sería mentira, y encima una mentira cómoda: no dolería en el
  // total y nadie preguntaría.
  const c = cuestaReponer({ insumo: { nombre: "Semilla de ajo", existencia: 100 }, cantidad: 200 });
  assert.equal(c.sabe, false);
  assert.equal(c.costoTotal, null);
  assert.ok(c.porque.includes("No es que sea gratis"));
});

/* ════════════ 4 · CUÁNDO HAY QUE PEDIRLO — LA CLAVE ════════════ */

test("avisa_con_los_dias_de_entrega_por_delante_no_el_dia_que_se_acaba", () => {
  // Se acaba el 1 de noviembre y el proveedor tarda 3 días: hay que pedirlo
  // antes del 29 de octubre. Avisar el 1 de noviembre es avisar tarde.
  const ritmo = ritmoDeConsumo({ salidas: salidasParejas("d1", 10, 10, 100), insumoId: "d1", hoy: HOY });
  const p = aTiempoDePedir({ insumo: DIESEL, ritmo, hoy: HOY });
  assert.equal(p.sabe, true);
  assert.equal(p.fechaSeAcaba, "2026-11-01");
  assert.equal(p.fechaDePedir, "2026-10-29");
  assert.equal(p.diasDeEntrega, 3);
  assert.equal(p.entregaSupuesta, false);
  assert.equal(p.yaEsTarde, false);
  assert.ok(p.dice.includes("antes del 2026-10-29"));
});

test("YA_se_paso_la_fecha_de_pedirlo_se_dice_sin_rodeos", () => {
  // Quedan 20 litros a 11 al día: se acaba en menos de lo que tarda llegar.
  const ritmo = ritmoDeConsumo({ salidas: salidasParejas("d1", 10, 10, 100), insumoId: "d1", hoy: HOY });
  const p = aTiempoDePedir({ insumo: { ...DIESEL, existencia: 20 }, ritmo, hoy: HOY });
  assert.equal(p.yaEsTarde, true);
  assert.ok(p.dice.startsWith("YA se pasó la fecha de pedir"));
  assert.ok(p.dice.includes("días sin producto") || p.dice.includes("día(s) sin producto"));
});

test("sin_dias_de_entrega_capturados_el_supuesto_se_dice_en_voz_alta", () => {
  // Un supuesto callado es cómo una app empieza a mentir sin que nadie se dé
  // cuenta. Aquí sale el número del supuesto pegado a la respuesta.
  const p = aTiempoDePedir({ insumo: { ...UREA, existencia: 100 }, ritmo: 2, hoy: HOY });
  assert.equal(p.entregaSupuesta, true);
  assert.equal(p.diasDeEntrega, DIAS_DE_ENTREGA_SUPUESTOS);
  assert.ok(p.dice.includes("se están suponiendo"));
  assert.ok(p.dice.includes("Captúralos"));
});

test("sin_ritmo_no_se_inventa_una_fecha_de_pedido", () => {
  const p = aTiempoDePedir({ insumo: DIESEL, ritmo: ritmoDeConsumo({ salidas: [], insumoId: "d1", hoy: HOY }), hoy: HOY });
  assert.equal(p.sabe, false);
  assert.equal(p.fechaDePedir, null);
  assert.ok(p.dice.includes("No se puede decir cuándo hay que pedir"));
});

test("avisar_que_falta_NUNCA_bloquea_nada", () => {
  const ritmo = ritmoDeConsumo({ salidas: salidasParejas("d1", 10, 10, 100), insumoId: "d1", hoy: HOY });
  assert.equal(aTiempoDePedir({ insumo: { ...DIESEL, existencia: 5 }, ritmo, hoy: HOY }).bloquea, false);
});

/* ════════════ 5 · LO QUE VA A FALTAR ════════════ */

const BODEGA = [
  DIESEL,                                                                        // 600 L, 11.11/día → 54 días
  { id: "u1", nombre: "Urea", unidad: "bulto", existencia: 12, costo_unit: 868 }, // se acaba pronto
  { id: "s1", nombre: "Semilla de ajo", unidad: "kg", existencia: 300 },          // sin costo
  { id: "m1", nombre: "MicroMix", unidad: "kg", existencia: 900, costo_unit: 40 },// nunca ha salido
];

const SALIDAS_BODEGA = [
  ...salidasParejas("d1", 10, 10, 100),   // diésel: 11.11 L/día
  ...salidasParejas("u1", 9, 10, 4),      // urea: 36 bultos en 80 días = 0.45/día
  ...salidasParejas("s1", 5, 15, 50),     // semilla: 250 kg en 60 días = 4.17/día
];

test("ordena_por_urgencia_lo_que_ya_va_tarde_hasta_arriba", () => {
  // Un diésel casi vacío: 20 L a 11.11/día se acaban en 1 día y el proveedor
  // tarda 3. Ése tiene que salir ARRIBA de la urea, que se acaba en 26 días.
  const casiVacio = BODEGA.map(i => (i.id === "d1" ? { ...i, existencia: 20 } : i));
  const r = loQueVaAFaltar({ inventario: casiVacio, salidas: SALIDAS_BODEGA, hoy: HOY, horizonteDias: 30 });

  const diesel = r.filas.find(f => f.nombre === "Diésel");
  const urea = r.filas.find(f => f.nombre === "Urea");
  const micro = r.filas.find(f => f.nombre === "MicroMix");

  assert.equal(diesel.estado, "ya va tarde");
  assert.equal(urea.estado, "se va a acabar");
  assert.equal(r.filas[0], diesel);                       // lo tarde, hasta arriba
  assert.ok(r.filas.indexOf(urea) < r.filas.indexOf(micro));
  assert.deepEqual([...new Set(r.filas.map(f => f.estado))].filter(e => !ESTADOS.includes(e)), []);
  assert.ok(r.dice.startsWith("1 insumo(s) YA se pasaron de la fecha de pedirlos: Diésel."));
});

test("el_que_aguanta_mas_va_hasta_abajo_de_los_que_se_acaban", () => {
  const r = loQueVaAFaltar({ inventario: BODEGA, salidas: SALIDAS_BODEGA, hoy: HOY, horizonteDias: 30 });
  const urea = r.filas.find(f => f.nombre === "Urea");       // 26 días
  const diesel = r.filas.find(f => f.nombre === "Diésel");   // 54 días
  assert.equal(urea.estado, "se va a acabar");
  assert.equal(diesel.estado, "aguanta");
  assert.ok(r.filas.indexOf(urea) < r.filas.indexOf(diesel));
});

test("se_va_a_acabar_y_no_se_sabe_si_se_va_a_acabar_son_listas_DISTINTAS", () => {
  // MicroMix nunca ha salido: no se sabe su ritmo. Meterlo en "aguanta" sería
  // afirmar sobre lo que nadie miró.
  const r = loQueVaAFaltar({ inventario: BODEGA, salidas: SALIDAS_BODEGA, hoy: HOY, horizonteDias: 30 });
  const micro = r.filas.find(f => f.nombre === "MicroMix");
  assert.equal(micro.estado, "no se sabe");
  assert.ok(r.noSeSabe.includes(micro));
  assert.ok(!r.aguantan.includes(micro));
  assert.ok(r.dice.includes("No saber no es que aguanten"));
});

test("el_total_de_reponer_no_se_traga_lo_que_no_tiene_costo", () => {
  // La semilla no tiene costo capturado y también se va a acabar. Sumarla
  // como cero deja el total más chico de lo que es, y así se aprueba un
  // presupuesto que no alcanza.
  const pocaSemilla = BODEGA.map(i => (i.id === "s1" ? { ...i, existencia: 20 } : i));
  const r = loQueVaAFaltar({ inventario: pocaSemilla, salidas: SALIDAS_BODEGA, hoy: HOY, horizonteDias: 30 });

  const semilla = r.filas.find(f => f.nombre === "Semilla de ajo");
  assert.equal(semilla.estado, "ya va tarde");
  assert.equal(semilla.faltaParaElHorizonte, 105);   // 4.1667 × 30 − 20
  assert.equal(semilla.costoDeReponer, null);        // NO es cero
  assert.equal(semilla.costoDesconocido, true);

  // La urea sí tiene costo y es lo único que entra al total.
  const urea = r.filas.find(f => f.nombre === "Urea");
  assert.equal(urea.costoDeReponer, 1302);           // 1.5 bultos × $868
  assert.equal(r.costoTotal, 1302);
  assert.deepEqual(r.sinCosto.map(f => f.nombre), ["Semilla de ajo"]);
  assert.ok(r.dice.includes("ese total va incompleto: Semilla de ajo"));
});

test("cuando_nada_se_acaba_lo_dice_sin_inventar_alarmas", () => {
  const r = loQueVaAFaltar({
    inventario: [{ id: "d1", nombre: "Diésel", unidad: "L", existencia: 99999, costo_unit: 24, diasDeEntrega: 3 }],
    salidas: salidasParejas("d1", 10, 10, 100), hoy: HOY, horizonteDias: 30,
  });
  assert.equal(r.seVanAAcabar.length, 0);
  assert.equal(r.yaVanTarde.length, 0);
  assert.ok(r.dice.includes("nada se acaba en los próximos 30 días"));
});

test("la_lista_avisa_no_bloquea", () => {
  const r = loQueVaAFaltar({ inventario: BODEGA, salidas: SALIDAS_BODEGA, hoy: HOY });
  assert.equal(r.bloquea, false);
  assert.equal(r.horizonteDias, HORIZONTE_DIAS);
});

test("un_insumo_sin_clave_no_hereda_el_ritmo_de_toda_la_bodega", () => {
  // EL BUG QUE ESTO PREVIENE: un insumo del catálogo sin clave se quedaba sin
  // filtro, así que heredaba el ritmo de la bodega entera —litros con bultos
  // con kilos— y la app pedía cal agrícola de la que no ha salido un gramo,
  // con su costo sumado al total de reponer.
  const r = loQueVaAFaltar({
    inventario: [{ nombre: "Cal agrícola", unidad: "kg", existencia: 100, costo_unit: 50 }],
    salidas: [
      vale("d1", 100, "2026-08-09"), vale("d1", 100, "2026-09-08"),
      vale("u1", 4, "2026-08-09"), vale("u1", 4, "2026-09-08"),
    ],
    hoy: HOY, horizonteDias: 30,
  });
  const cal = r.filas[0];
  assert.equal(cal.estado, "no se sabe");
  assert.equal(cal.faltaParaElHorizonte, null);
  assert.equal(cal.costoDeReponer, null);
  assert.equal(r.costoTotal, 0);
  assert.equal(r.yaVanTarde.length, 0);
  assert.ok(cal.dice.includes("no trae clave en el catálogo"));
  assert.ok(cal.dice.includes("No es que no se gaste"));
});

test("un_insumo_descontinuado_en_cero_no_es_una_alarma_de_pedido", () => {
  // EL BUG QUE ESTO PREVIENE: con veinte productos muertos en cero, la lista
  // arrancaba con veinte "YA se pasaron de la fecha de pedirlos" — de insumos
  // de los que no existe un solo dato de consumo. Y las alarmas falsas
  // enseñan a ignorar las alarmas.
  const r = loQueVaAFaltar({
    inventario: [
      { id: "z1", nombre: "Fungicida viejo", existencia: 0 },
      { id: "z2", nombre: "Herbicida descontinuado", existencia: 0 },
    ],
    salidas: [], hoy: HOY, horizonteDias: 30,
  });
  assert.equal(r.yaVanTarde.length, 0);
  assert.equal(r.noSeSabe.length, 2);
  assert.ok(!r.dice.includes("YA se pasaron"));
  assert.ok(!r.dice.includes("sin producto"));
  assert.ok(r.filas[0].dice.includes("ya está en cero"));
  assert.ok(r.filas[0].dice.includes("no se sabe si hace falta reponerlo"));
});

test("la_advertencia_del_ritmo_no_se_pierde_en_el_renglon_que_levanta_la_alarma", () => {
  // EL BUG QUE ESTO PREVIENE: tramoCorto e irregular se calculaban y se
  // explicaban dentro de ritmo.porque, que es donde nadie lo lee. El renglón
  // de la lista decía "se van 200 al día, hoy es el día de pedir" y el
  // resumen remataba con $129,600 — sin una palabra de que esos 200 L/día
  // salieron de un tramo de un día.
  const r = loQueVaAFaltar({
    inventario: [DIESEL],
    salidas: [vale("d1", 100, "2026-09-07"), vale("d1", 100, "2026-09-08")],
    hoy: HOY, horizonteDias: 30,
  });
  const diesel = r.filas[0];
  assert.equal(diesel.ritmo.porDia, 200);
  assert.equal(diesel.ritmoMarcado, true);
  assert.ok(diesel.dice.includes("muy corto para llamarle ritmo"));
  assert.equal(r.conRitmoMarcado.length, 1);
  assert.ok(r.dice.includes("el ritmo viene marcado"));
  assert.ok(r.dice.includes("Las fechas se pueden mover"));
});

test("un_saldo_negativo_no_se_vuelve_orden_de_compra_sin_decir_que_hay_que_contar", () => {
  // EL BUG QUE ESTO PREVIENE: con existencia en −30 el aviso correcto
  // ("cuéntalo antes de pedir") se escribía en cuandoSeAcaba, pero la fila
  // "ya va tarde" armaba su texto SÓLO con la fecha de pedir. El −30 —que
  // puede ser mercancía que entró sin capturar— se volvía una orden de compra
  // urgente sin que nadie sugiriera contar primero.
  const r = loQueVaAFaltar({
    inventario: [{ id: "u1", nombre: "Urea", unidad: "bulto", existencia: -30, costo_unit: 868 }],
    salidas: salidasParejas("u1", 9, 10, 4),
    hoy: HOY, horizonteDias: 30,
  });
  const urea = r.filas[0];
  assert.equal(urea.estado, "ya va tarde");
  assert.ok(urea.dice.includes("en negativo"));
  assert.ok(urea.dice.includes("Antes de pedir, cuéntalo"));
  assert.ok(urea.dice.includes("YA se pasó la fecha de pedir"));
});

/* ════════════ 6 · ¿SE VA A PARAR LA OPERACIÓN? ════════════ */

test("dice_QUE_insumo_se_acaba_antes_de_terminar_la_faena", () => {
  // Cuatro días de siembra: 800 kg de semilla (hay 300) y 600 L de diésel
  // (hay 600). La semilla es la que para la máquina.
  const r = pararaLaOperacion({
    plan: {
      nombre: "Siembra parcela 53", fecha: HOY, dias: 4,
      necesita: [{ insumoId: "s1", cantidad: 800 }, { insumoId: "d1", cantidad: 600 }],
    },
    inventario: BODEGA, salidas: SALIDAS_BODEGA, hoy: HOY,
  });
  assert.equal(r.para, true);
  assert.equal(r.elPrimeroQueSeAcaba.nombre, "Semilla de ajo");
  // 300 kg contra 200 kg por día de faena: aguanta 1 día, se para el segundo.
  assert.equal(r.elPrimeroQueSeAcaba.diasQueAguantaLaFaena, 1);
  assert.equal(r.elPrimeroQueSeAcaba.seParaEnElDia, 2);
  assert.ok(r.dice.includes("se pararía el día 2 de 4"));
});

test("cuenta_lo_que_el_dia_a_dia_se_come_antes_de_que_empiece_la_faena", () => {
  // El tanque hoy tiene 600 L, pero la faena es en 20 días y el rancho gasta
  // 11.11 al día: para ese día habrá 378, no 600. Ése es justo el error que
  // se comete a mano.
  const r = pararaLaOperacion({
    plan: { nombre: "Barbecho", fecha: "2026-09-28", dias: 1, necesita: [{ insumoId: "d1", cantidad: 500 }] },
    inventario: BODEGA, salidas: SALIDAS_BODEGA, hoy: HOY,
  });
  const diesel = r.filas[0];
  assert.equal(diesel.existencia, 600);
  assert.ok(diesel.disponibleEseDia < 400);
  assert.equal(diesel.alcanza, false);
  assert.ok(diesel.dice.includes("Se descontaron"));
});

test("sin_ritmo_no_se_puede_proyectar_al_dia_de_la_faena_y_eso_no_es_alcanza", () => {
  // EL BUG QUE ESTO PREVIENE: cuando no había ritmo, el descuento del gasto
  // diario simplemente no ocurría y `disponible` se quedaba con la existencia
  // de HOY. El campo seguía llamándose disponibleEseDia, el mensaje decía
  // "Alcanza" sin la coletilla de "ya se descontaron", y así la app contestaba
  // "no se para" sobre una faena que está a un mes — el mismo "alcanza con
  // cero datos" que el resto del archivo se cuida de no dar.
  const r = pararaLaOperacion({
    plan: { nombre: "Barbecho de octubre", fecha: "2026-10-08", dias: 1, necesita: [{ insumoId: "d1", cantidad: 550 }] },
    inventario: [DIESEL],
    salidas: [vale("d1", 100, "2026-09-01")],   // una sola: no hay ritmo
    hoy: HOY,
  });
  const diesel = r.filas[0];
  assert.equal(diesel.alcanza, null);
  assert.equal(diesel.disponibleEseDia, null);
  assert.equal(diesel.existencia, 600);
  assert.equal(r.para, null);
  assert.ok(diesel.dice.includes("HOY alcanzaría"));
  assert.ok(diesel.dice.includes("No es que alcance: es que no se sabe"));
  assert.ok(!diesel.dice.includes("Alcanza."));
});

test("sin_ritmo_lo_que_ya_falta_hoy_falta_y_se_dice_que_puede_faltar_mas", () => {
  // El otro lado de la misma moneda: si hoy ya no alcanza, eso es un hecho, y
  // el gasto de los días que faltan sólo puede empeorarlo. Se contesta que sí
  // falta, diciendo que ese faltante es el de hoy.
  const r = pararaLaOperacion({
    plan: { nombre: "Barbecho de octubre", fecha: "2026-10-08", dias: 1, necesita: [{ insumoId: "d1", cantidad: 900 }] },
    inventario: [DIESEL],
    salidas: [vale("d1", 100, "2026-09-01")],
    hoy: HOY,
  });
  assert.equal(r.filas[0].alcanza, false);
  assert.equal(r.para, true);
  assert.ok(r.filas[0].dice.includes("ése es el faltante de HOY"));
});

test("el_mismo_insumo_en_dos_renglones_no_ve_dos_veces_la_bodega", () => {
  // EL BUG QUE ESTO PREVIENE: cada renglón del plan se comparaba contra la
  // existencia COMPLETA. Dos parcelas de 200 kg cada una, 300 kg de semilla en
  // bodega, y la app contestaba "no: alcanza para toda la faena". Se ocupan
  // 400 y hay 300: la faena se para y la app dijo que no.
  const r = pararaLaOperacion({
    plan: {
      nombre: "Siembra en dos parcelas", fecha: HOY, dias: 1,
      necesita: [{ insumoId: "s1", cantidad: 200 }, { insumoId: "s1", cantidad: 200 }],
    },
    inventario: BODEGA, salidas: SALIDAS_BODEGA, hoy: HOY,
  });
  assert.equal(r.filas.length, 1);
  assert.equal(r.filas[0].renglonesDelPlan, 2);
  assert.equal(r.filas[0].pedido, 400);
  assert.equal(r.filas[0].falta, 100);
  assert.equal(r.para, true);
  assert.ok(r.filas[0].dice.includes("La bodega es una sola"));
});

test("el_mismo_insumo_por_clave_y_por_nombre_tambien_se_junta", () => {
  // Migue captura una parcela por clave y otra escribiendo el nombre. Es el
  // mismo tambo.
  const r = pararaLaOperacion({
    plan: {
      nombre: "Dos labores", fecha: HOY, dias: 1,
      necesita: [{ insumoId: "d1", cantidad: 400 }, { nombre: "diesel", cantidad: 400 }],
    },
    inventario: BODEGA, salidas: SALIDAS_BODEGA, hoy: HOY,
  });
  assert.equal(r.filas.length, 1);
  assert.equal(r.filas[0].pedido, 800);
  assert.equal(r.para, true);
});

test("un_insumo_que_no_esta_en_el_catalogo_es_no_se_sabe_no_es_falta", () => {
  // Decir "falta" sobre algo que nadie miró es afirmar sobre lo que nadie
  // miró. Y decir "no se para" tampoco: la respuesta es que no se sabe.
  const r = pararaLaOperacion({
    plan: { nombre: "Aplicación", fecha: HOY, dias: 1, necesita: [{ nombre: "serenade", cantidad: 30 }] },
    inventario: BODEGA, salidas: SALIDAS_BODEGA, hoy: HOY,
  });
  assert.equal(r.para, null);
  assert.equal(r.filas[0].alcanza, null);
  assert.ok(r.filas[0].dice.includes("No quiere decir que no haya"));
  assert.ok(r.dice.startsWith("No se sabe"));
});

test("no_saber_de_una_cosa_no_convierte_la_respuesta_en_no_se_para", () => {
  // Alcanza para todo lo que sí se sabe, pero falta un dato: eso NO es un
  // "no". Es un "no sé", y así se contesta.
  const r = pararaLaOperacion({
    plan: {
      nombre: "Riego", fecha: HOY, dias: 1,
      necesita: [{ insumoId: "d1", cantidad: 100 }, { nombre: "ácido fosfórico", cantidad: 20 }],
    },
    inventario: BODEGA, salidas: SALIDAS_BODEGA, hoy: HOY,
  });
  assert.equal(r.para, null);
  assert.equal(r.faltantes.length, 0);
  assert.equal(r.sinSaber.length, 1);
  assert.ok(r.dice.includes("eso no contesta la pregunta"));
});

test("cuando_alcanza_para_toda_la_faena_lo_dice_derecho", () => {
  const r = pararaLaOperacion({
    plan: { nombre: "Riego corto", fecha: HOY, dias: 2, necesita: [{ insumoId: "d1", cantidad: 100 }] },
    inventario: BODEGA, salidas: SALIDAS_BODEGA, hoy: HOY,
  });
  assert.equal(r.para, false);
  assert.equal(r.elPrimeroQueSeAcaba, null);
  assert.ok(r.dice.startsWith("No:"));
});

test("saber_que_va_a_faltar_NUNCA_cancela_la_faena", () => {
  // Si la app impide programar, la faena se planea fuera del sistema y el
  // sistema se vuelve mentira.
  const r = pararaLaOperacion({
    plan: { nombre: "Siembra", fecha: HOY, dias: 4, necesita: [{ insumoId: "s1", cantidad: 800 }] },
    inventario: BODEGA, salidas: SALIDAS_BODEGA, hoy: HOY,
  });
  assert.equal(r.bloquea, false);
  assert.ok(r.dice.includes("se puede programar igual"));
  // Y cuando NINGUNO de los faltantes tiene costo, no se manda a buscar un
  // total que no existe: se dice que no se sabe cuánto costaría.
  assert.ok(!r.dice.includes("ese total"));
  assert.ok(r.dice.includes("No es que sea gratis"));
});

test("dice_cuanto_costaria_no_pararse_y_avisa_si_ese_total_va_incompleto", () => {
  // Falta urea (con costo) y semilla (sin costo). El total es real para la
  // urea y se dice que la semilla no está adentro.
  const r = pararaLaOperacion({
    plan: {
      nombre: "Siembra", fecha: HOY, dias: 1,
      necesita: [{ insumoId: "u1", cantidad: 20 }, { insumoId: "s1", cantidad: 800 }],
    },
    inventario: BODEGA, salidas: SALIDAS_BODEGA, hoy: HOY,
  });
  assert.equal(r.para, true);
  const urea = r.filas.find(f => f.nombre === "Urea");
  assert.equal(urea.falta, 8);                       // se piden 20, hay 12
  assert.equal(urea.costoDeReponer, 8 * 868);
  assert.equal(r.costoDeNoPararse, 8 * 868);         // la semilla NO entra como cero
  assert.ok(r.dice.includes("va incompleto"));
});

test("una_operacion_sin_cantidades_no_se_contesta_a_ciegas", () => {
  const r = pararaLaOperacion({
    plan: { nombre: "Algo", fecha: HOY, necesita: [{ insumoId: "d1" }] },
    inventario: BODEGA, salidas: SALIDAS_BODEGA, hoy: HOY,
  });
  assert.equal(r.para, null);
  assert.ok(r.filas[0].dice.includes("no se dijo cuánto"));
});

test("si_uno_de_los_renglones_del_mismo_insumo_no_trae_cantidad_el_total_queda_incompleto", () => {
  // Juntar renglones no puede tapar que a uno le falta el dato: el total que
  // se va a ocupar no se conoce, y eso se contesta "no sé", no "alcanza".
  const r = pararaLaOperacion({
    plan: {
      nombre: "Siembra", fecha: HOY, dias: 1,
      necesita: [{ insumoId: "s1", cantidad: 100 }, { insumoId: "s1" }],
    },
    inventario: BODEGA, salidas: SALIDAS_BODEGA, hoy: HOY,
  });
  assert.equal(r.filas.length, 1);
  assert.equal(r.filas[0].alcanza, null);
  assert.equal(r.filas[0].pedido, null);
  assert.equal(r.para, null);
  assert.ok(r.filas[0].dice.includes("queda incompleto"));
});

test("la_operacion_lee_los_movimientos_con_su_signo_igual_que_el_ritmo", () => {
  // La misma regla del signo tiene que llegar hasta aquí: si una compra se
  // contara como consumo, el descuento de los días previos se dispararía y la
  // app diría que la faena se para por surtir el tanque.
  const conCompras = [
    ...salidasParejas("d1", 10, 10, 100),
    compra("d1", 3000, "2026-09-06"),
  ];
  const r = pararaLaOperacion({
    plan: { nombre: "Barbecho", fecha: "2026-09-28", dias: 1, necesita: [{ insumoId: "d1", cantidad: 300 }] },
    inventario: BODEGA, salidas: conCompras, hoy: HOY,
  });
  assert.equal(r.filas[0].gastoAntesDeEmpezar, 222.22);   // 11.1111 × 20, sin la compra
  assert.equal(r.para, false);
});

test("la_ventana_de_noventa_dias_es_la_de_la_casa", () => {
  assert.equal(VENTANA_DIAS, 90);
  assert.equal(HORIZONTE_DIAS, 30);
});

/* ════════════ NO AFIRMAR SOBRE LO QUE NADIE MIRÓ ════════════ */

test("CON_LA_BODEGA_VACIA_NO_DICE_QUE_NADA_SE_ACABA", () => {
  // "Nada se acaba en los próximos 30 días" es cierto y engañoso al mismo
  // tiempo cuando no hay ni un insumo capturado: se lee como "todo está bien".
  // Es la misma falta que decía "ALCANZA" con cero bolsas registradas.
  const r = loQueVaAFaltar({ inventario: [], salidas: [], hoy: "2026-09-08" });
  assert.ok(!r.dice.includes("nada se acaba"), `dijo: ${r.dice}`);
  assert.ok(r.dice.includes("no hay nada capturado"));
});

test("SIN_DECIR_QUE_OCUPA_LA_FAENA_NO_CONTESTA_QUE_ALCANZA", () => {
  // Contestar "no se para, alcanza" cuando nadie dijo qué ocupa la faena manda
  // a arrancar tranquilo sobre una comparación que no se hizo.
  const r = pararaLaOperacion({ plan: { necesita: [] }, inventario: [], salidas: [], hoy: "2026-09-08" });
  assert.equal(r.para, null);
  assert.ok(!r.dice.startsWith("No:"), `dijo: ${r.dice}`);
  assert.ok(r.dice.includes("no se dijo qué insumos ocupa"));
});

test("y_cuando_si_hay_con_que_comparar_si_contesta", () => {
  // El mensaje bueno no se pierde: con datos de verdad, sí contesta que alcanza.
  const inv = [{ id: "i1", nombre: "Diésel", unidad: "L", existencia: 600, costo_unit: 24 }];
  const sal = [
    { id: "m1", insumoId: "i1", cantidad: -100, fecha: "2026-08-20" },
    { id: "m2", insumoId: "i1", cantidad: -120, fecha: "2026-09-02" },
  ];
  const r = pararaLaOperacion({
    plan: { necesita: [{ insumoId: "i1", cantidad: 50 }], dias: 1 },
    inventario: inv, salidas: sal, hoy: "2026-09-08",
  });
  assert.equal(r.para, false);
  assert.ok(r.dice.includes("alcanza"));
});
