// ============================================================
//  Pruebas del recorrido del dron
//
//  El hilo de todas: la foto dice de dónde es, o no dice nada. Nunca se le
//  pega a la parcela menos lejana, nunca se le pone la fecha de hoy, y de dos
//  fotos NUNCA sale un porcentaje.
//
//  Las parcelas de aquí son las del rancho: la 53 y GABINO, con coordenadas
//  inventadas pero a distancias reales — 0.001° de latitud son unos 111 m.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  fechaDeLaFoto, diaDeLaFoto, aDiaLocal, puntoEnPoligono, ubicarLaFoto, recorrido,
  lineaDelTiempo, parcelasSinVolar, compararVuelos, prepararRevision, guardarObservacion,
  resumenDeParcela, TOPE_FOTOS_REVISION, TIPOS_OCURRENCIA, ORIGENES_OBSERVACION,
} from "./dron.js";

/* Dos parcelas separadas ~1.1 km: la 53 con polígono, GABINO sólo con centro. */
const P53 = {
  id: "p53", nombre: "EL 53", cultivo: "AJO", hectareas: 11,
  lat: 22.7500, lng: -102.5000,
  poligono: [
    { lat: 22.7480, lng: -102.5020 },
    { lat: 22.7520, lng: -102.5020 },
    { lat: 22.7520, lng: -102.4980 },
    { lat: 22.7480, lng: -102.4980 },
  ],
};
const GABINO = { id: "pgab", nombre: "GABINO", cultivo: "CHILE MIRASOL", hectareas: 10, lat: 22.7600, lng: -102.5000 };
const SIN_COORDS = { id: "pmar", nombre: "MARCOS", hectareas: 8, lat: null, lng: null };
const PARCELAS = [P53, GABINO, SIN_COORDS];

const foto = (id, lat, lng, fecha, extra = {}) => ({ id, lat, lng, fecha, ...extra });

/* ════════════ 1 · NUNCA INVENTAR UN DATO ════════════ */

test("una_foto_sin_gps_no_se_le_asigna_a_ninguna_parcela", () => {
  const u = ubicarLaFoto({ foto: foto("f1", null, null, "2026-07-03"), parcelas: PARCELAS });
  assert.equal(u.parcelaId, null);
  assert.equal(u.estado, "sin gps");
  assert.ok(u.dice.includes("no lo va a adivinar"));
});

test("UNA_PARCELA_SIN_COORDENADAS_NO_VALE_COMO_LATITUD_CERO", () => {
  // Éste es el bug que la regla previene. Number(null) da 0, y latitud 0,
  // longitud 0 es un punto en el mar frente a África: con Number() en vez de
  // num(), MARCOS quedaría a 11 mil kilómetros de todo — o, peor, empataría
  // con cualquier otra foto sin GPS y se volvería "la parcela más cercana".
  const u = ubicarLaFoto({ foto: foto("f1", 22.7500, -102.5000, "2026-07-03"), parcelas: PARCELAS });
  assert.equal(u.parcelaId, "p53");
  // MARCOS no aparece por ningún lado: no se mide contra una parcela que no
  // tiene dónde.
  assert.ok(!u.candidatas.some(c => c.parcelaId === "pmar"));
  assert.notEqual(u.masCercana?.parcelaId, "pmar");
});

test("una_foto_lejos_de_todo_NO_se_le_pega_a_la_menos_lejana", () => {
  // Cinco kilómetros al norte: puede ser el lote del vecino, o una parcela
  // nueva que nadie ha dado de alta. Se nombra la más cercana como pista,
  // pero no se asigna — una traza inventada no se distingue después de una
  // buena.
  const u = ubicarLaFoto({ foto: foto("f9", 22.8100, -102.5000, "2026-07-03"), parcelas: PARCELAS });
  assert.equal(u.parcelaId, null);
  assert.equal(u.estado, "no cae en ninguna parcela conocida");
  assert.equal(u.masCercana.parcelaNombre, "GABINO");
  assert.ok(u.masCercana.metros > 4000);
  assert.ok(u.dice.includes("Dile tú de cuál es"));
});

test("que_ninguna_parcela_tenga_coordenadas_no_es_que_la_foto_este_fuera", () => {
  // Hoy CASI ninguna parcela tiene GPS capturado. Si esto contestara "no cae
  // en ninguna parcela conocida", Luis creería que el dron voló donde no
  // debía, cuando lo que falta es capturar las parcelas.
  const u = ubicarLaFoto({ foto: foto("f1", 22.75, -102.50, "2026-07-03"), parcelas: [SIN_COORDS] });
  assert.equal(u.parcelaId, null);
  assert.equal(u.estado, "sin parcelas ubicadas");
  assert.ok(u.dice.includes("faltan las coordenadas de las parcelas"));
});

test("el_poligono_manda_sobre_la_distancia_al_centro", () => {
  // Un punto dentro del polígono de la 53 es de la 53, punto. No es una
  // estimación: es una respuesta exacta.
  assert.equal(puntoEnPoligono(22.7490, -102.4990, P53.poligono), true);
  assert.equal(puntoEnPoligono(22.7700, -102.4990, P53.poligono), false);
  const u = ubicarLaFoto({ foto: foto("f2", 22.7490, -102.4990, "2026-07-03"), parcelas: PARCELAS });
  assert.equal(u.estado, "dentro del polígono");
  assert.equal(u.parcelaId, "p53");
});

test("un_poligono_de_dos_esquinas_no_es_un_poligono", () => {
  assert.equal(puntoEnPoligono(22.75, -102.50, [{ lat: 22.74, lng: -102.51 }, { lat: 22.76, lng: -102.49 }]), null);
});

test("cuando_dos_parcelas_alcanzan_el_mismo_punto_se_dice_que_es_dudosa", () => {
  // Dos parcelas pegadas. Se propone la más cercana, pero se dice que hubo
  // otra: confirmarlo cuesta un toque y una traza mal puesta se arrastra todo
  // el ciclo.
  const A = { id: "a", nombre: "A", hectareas: 10, lat: 22.7500, lng: -102.5000 };
  const B = { id: "b", nombre: "B", hectareas: 10, lat: 22.7510, lng: -102.5000 };
  const u = ubicarLaFoto({ foto: foto("f3", 22.7503, -102.5000, "2026-07-03"), parcelas: [A, B] });
  assert.equal(u.parcelaId, "a");
  assert.equal(u.dudosa, true);
  assert.equal(u.candidatas.length, 2);
  assert.ok(u.dice.includes("Confírmalo"));
});

test("la_orilla_capturada_que_dice_que_NO_no_se_queda_callada", () => {
  // 22.7522 está 22 m ARRIBA de la orilla norte de la 53 (que llega a
  // 22.7520). Se sigue proponiendo la 53 —el GPS de un dron falla unos metros
  // y las orillas se dibujan a ojo—, pero el polígono ya había contestado que
  // no: si eso no se dice, la foto se queda pegada como si el polígono nunca
  // hubiera opinado.
  const u = ubicarLaFoto({ foto: foto("f4", 22.7522, -102.5000, "2026-07-03"), parcelas: [P53] });
  assert.equal(u.parcelaId, "p53");
  assert.equal(u.fueraDeSuPoligono, true);
  assert.equal(u.dudosa, true);                       // hay que confirmarla
  assert.ok(u.dice.includes("FUERA"));
  assert.ok(u.dice.includes("confírmalo") || u.dice.includes("Confírmalo"));
});

test("con_dos_poligonos_encimados_no_se_queda_con_el_primero_de_la_lista", () => {
  // Una parcela redibujada, o un KML pegado dos veces: dos parcelas con el
  // mismo polígono. Antes se quedaba con la primera del arreglo mientras el
  // texto juraba que era "la más cercana" — proponía una y decía la otra.
  const LEJOS  = { id: "a", nombre: "LEJOS",  hectareas: 11, lat: 22.7900, lng: -102.5000, poligono: P53.poligono };
  const PEGADA = { id: "b", nombre: "PEGADA", hectareas: 11, lat: 22.7500, lng: -102.5000, poligono: P53.poligono };
  const u = ubicarLaFoto({ foto: foto("f5", 22.7500, -102.5000, "2026-07-03"), parcelas: [LEJOS, PEGADA] });
  assert.equal(u.parcelaId, "b");                     // la que de verdad está encima
  assert.equal(u.dudosa, true);
  assert.ok(!/más cercana es LEJOS/.test(u.dice));    // no puede decir lo contrario de lo que hizo
  assert.ok(u.dice.includes("PEGADA"));
  assert.ok(u.dice.includes("mal dibujado"));
});

/* ════════════ 6 · FECHAS ════════════ */

test("una_foto_sin_fecha_NO_se_cuenta_como_de_hoy", () => {
  // Éste es el bug que la regla previene: una foto sin fecha metida en el
  // vuelo de hoy ensucia la línea del tiempo para siempre, y nadie la va a
  // volver a mirar para corregirla.
  assert.equal(fechaDeLaFoto({ id: "x" }), null);
  const r = recorrido({ fotos: [foto("f1", 22.7490, -102.4990, null)], parcelas: PARCELAS });
  assert.equal(r.vuelos.length, 0);
  assert.equal(r.sinFecha.length, 1);
  assert.ok(r.dice.includes("NO se dieron por de hoy"));
});

test("el_dia_de_la_foto_sale_de_la_hora_de_zacatecas_no_del_UTC_crudo", () => {
  // Supabase guarda en UTC y Zacatecas va seis horas atrás. La UNA DE LA
  // MAÑANA del 1 de octubre en UTC son las SIETE DE LA NOCHE del 30 de
  // septiembre en el rancho: con toISOString() esa foto se fecha en octubre y
  // se pasa de mes ella sola.
  //
  // Esta prueba fija el huso a propósito, y compara contra una fecha ESCRITA.
  // Antes comparaba contra fechaLocal() —la misma función que usa el código
  // por dentro—, así que la versión rota pasaba igual; y encima usaba una
  // marca de las 23:30 UTC, que en Zacatecas sigue siendo el mismo día. El
  // build corre en UTC, donde el día UTC y el local coinciden: una prueba que
  // sólo truena fuera de UTC no cuida nada donde de verdad se corre.
  const guardado = process.env.TZ;
  process.env.TZ = "America/Mexico_City";
  try {
    const laUnaEnUtc = "2026-10-01T01:00:00.000Z";
    assert.equal(new Date(laUnaEnUtc).getDate(), 30,
      "esta prueba necesita correr en hora de Zacatecas; el huso no se pudo fijar");
    assert.equal(fechaDeLaFoto({ tomadaEn: laUnaEnUtc }), "2026-09-30");
    // Y da igual por cuál de los dos campos venga la marca de tiempo.
    assert.equal(fechaDeLaFoto({ fecha: laUnaEnUtc }), "2026-09-30");
    // El día capturado a mano gana sobre la marca de tiempo.
    assert.equal(fechaDeLaFoto({ fecha: "2026-07-03", tomadaEn: laUnaEnUtc }), "2026-07-03");
    // Y el mediodía no se mueve para ningún lado, en ningún huso.
    assert.equal(fechaDeLaFoto({ tomadaEn: "2026-09-30T18:00:00.000Z" }), "2026-09-30");
  } finally {
    if (guardado === undefined) delete process.env.TZ; else process.env.TZ = guardado;
  }
});

test("una_fecha_capturada_como_03_07_2026_no_se_adivina_se_dice_que_no_se_pudo_leer", () => {
  // Puede ser el 3 de julio o el 7 de marzo. Es la misma trampa con la que la
  // librería de Excel fechó en diciembre un estado de cuenta de agosto: si se
  // adivina, la foto se va de mes y nadie lo nota.
  const d = diaDeLaFoto({ id: "x", fecha: "03/07/2026" });
  assert.equal(d.dia, null);
  assert.equal(d.ilegible, true);
  assert.ok(d.porque.includes("aaaa-mm-dd"));

  // Y "no trae fecha" es OTRO problema, no el mismo: en uno falta el dato, en
  // el otro falta entenderlo.
  const sin = diaDeLaFoto({ id: "y" });
  assert.equal(sin.dia, null);
  assert.equal(sin.ilegible, false);
});

test("una_fecha_que_llega_como_objeto_Date_no_se_guarda_como_Fri_Jul_03", () => {
  // String(new Date()).slice(0,10) da "Fri Jul 03", que no es un día del
  // calendario, no se ordena y rompe todas las restas de días de ahí para
  // abajo.
  assert.equal(fechaDeLaFoto({ fecha: new Date(2026, 6, 3, 10, 0, 0) }), "2026-07-03");
  // Y la fecha de los EXIF, que viene con dos puntos, ya es hora de la cámara.
  assert.equal(fechaDeLaFoto({ tomadaEn: "2026:07:03 10:12:00" }), "2026-07-03");
});

/* ════════════ EL RECORRIDO ════════════ */

const VUELO_JULIO = [
  foto("a1", 22.7490, -102.4990, "2026-07-03"),
  foto("a2", 22.7495, -102.4995, "2026-07-03"),
  foto("a3", 22.7500, -102.5000, "2026-07-03"),
];
const VUELO_AGOSTO = [
  foto("b1", 22.74901, -102.49901, "2026-08-20"),
  foto("b2", 22.74951, -102.49951, "2026-08-20"),
];
const VUELO_GABINO = [foto("g1", 22.7601, -102.5001, "2026-07-03")];

test("dos_fotos_del_mismo_dia_en_la_misma_parcela_son_un_solo_vuelo", () => {
  const r = recorrido({ fotos: [...VUELO_JULIO, ...VUELO_AGOSTO, ...VUELO_GABINO], parcelas: PARCELAS });
  assert.equal(r.vuelos.length, 3);              // 53 en julio, 53 en agosto, GABINO en julio
  const julio53 = r.vuelos.find(v => v.parcelaId === "p53" && v.fecha === "2026-07-03");
  assert.equal(julio53.cuantas, 3);
  assert.equal(r.porParcela.find(p => p.parcelaId === "p53").ultimoVuelo, "2026-08-20");
});

test("las_fotos_que_no_entraron_se_cuentan_y_se_dicen_no_se_caen_en_silencio", () => {
  // Es el mismo pecado del estado de cuenta: si un renglón se cae callado, lo
  // que queda encadena perfecto y el archivo parece bueno.
  const r = recorrido({
    fotos: [...VUELO_JULIO, foto("x1", null, null, "2026-07-03"), foto("x2", 22.9, -102.9, "2026-07-03")],
    parcelas: PARCELAS,
  });
  assert.equal(r.fotosTotal, 5);
  assert.equal(r.fotosEnVuelos, 3);
  assert.equal(r.fotosFuera, 2);
  assert.equal(r.sinUbicar.length, 2);
  assert.ok(r.dice.includes("apartadas, no perdidas"));
});

/* ════════════ LA LÍNEA DEL TIEMPO ════════════ */

test("el_primer_vuelo_no_lleva_cero_dias_desde_el_anterior_lleva_nada", () => {
  // Un cero ahí se lee como "se voló dos veces el mismo día". No hubo
  // anterior: eso es null.
  const l = lineaDelTiempo([...VUELO_JULIO, ...VUELO_AGOSTO], "p53", { parcelas: PARCELAS });
  assert.equal(l.cuantosVuelos, 2);
  assert.equal(l.vuelos[0].diasDesdeElAnterior, null);
  assert.equal(l.vuelos[1].diasDesdeElAnterior, 48);   // del 3 de julio al 20 de agosto
  assert.ok(l.vuelos[0].dice.includes("primer vuelo"));
});

test("con_un_solo_vuelo_se_dice_que_todavia_no_hay_comparacion", () => {
  const l = lineaDelTiempo(VUELO_JULIO, "p53", { parcelas: PARCELAS });
  assert.equal(l.cuantosVuelos, 1);
  assert.ok(l.dice.includes("no hay comparación todavía"));
});

test("no_dice_que_es_el_primer_vuelo_cuando_si_hubo_uno_antes", () => {
  // El mensaje lo decide SI HUBO VUELO ANTERIOR, no si la resta salió. Antes
  // las dos cosas llegaban como null por caminos distintos: con las fechas
  // como objeto Date, los dos vuelos juraban ser "el primer vuelo registrado"
  // aunque el segundo traía al primero anotado como anterior.
  const l = lineaDelTiempo([
    { id: "a1", parcelaId: "p53", fecha: new Date(2026, 6, 3) },
    { id: "b1", parcelaId: "p53", fecha: new Date(2026, 7, 20) },
  ], "p53");
  assert.equal(l.cuantosVuelos, 2);
  assert.equal(l.vuelos[0].fecha, "2026-07-03");
  assert.equal(l.vuelos[1].fecha, "2026-08-20");
  assert.equal(l.vuelos[1].diasDesdeElAnterior, 48);
  assert.ok(l.vuelos[0].dice.includes("primer vuelo"));
  assert.ok(!l.vuelos[1].dice.includes("primer vuelo"));
});

test("una_fecha_que_no_se_pudo_leer_no_se_vuelve_un_vuelo_fantasma", () => {
  // "03/07/2026" no se adivina. Antes entraba tal cual como si fuera un día:
  // se ordenaba alfabéticamente, la resta de días daba null y los dos vuelos
  // decían ser el primero. Ahora no hay vuelo, y se dice por qué.
  const l = lineaDelTiempo([
    { id: "a1", parcelaId: "p53", fecha: "03/07/2026" },
    { id: "b1", parcelaId: "p53", fecha: "20/08/2026" },
  ], "p53");
  assert.equal(l.cuantosVuelos, 0);
  assert.equal(l.fechaIlegible.length, 2);
  assert.equal(l.fotosFueraDeVuelos, 2);
  assert.ok(l.dice.includes("no se pudo leer"));
});

/* ════════════ 2 · NO AFIRMAR SOBRE LO QUE NADIE MIRÓ ════════════ */

test("una_parcela_que_NUNCA_se_ha_volado_va_aparte_de_la_que_dejo_de_volarse", () => {
  // Mezclarlas hace que la lista salga toda en rojo el primer día y que nadie
  // la vuelva a abrir. Son dos problemas distintos: uno de arranque y uno de
  // hoy.
  const r = parcelasSinVolar({ fotos: VUELO_JULIO, parcelas: PARCELAS, hoy: "2026-08-17", cada: 30 });
  const p53 = r.filas.find(f => f.parcelaId === "p53");
  assert.equal(p53.estado, "sin volar");
  assert.equal(p53.dias, 45);
  assert.ok(p53.dice.includes("hace 45 días que nadie la vuela"));

  assert.equal(r.nunca.length, 2);                       // GABINO y MARCOS
  assert.ok(!r.sinVolar.some(f => f.estado === "nunca"));
  assert.ok(r.dice.includes("todavía no hay nada que comparar"));
});

test("no_supone_por_que_dejo_de_volarse", () => {
  // Puede estar descompuesto el dron, prestado, o pudo haber llovido tres
  // semanas. Los días y ya.
  const r = parcelasSinVolar({ fotos: VUELO_JULIO, parcelas: [P53], hoy: "2026-08-17", cada: 30 });
  const dicho = r.filas[0].dice.toLowerCase();
  for (const palabra of ["olvid", "descuid", "flojera", "nadie quiso", "debería", "hay que"]) {
    assert.ok(!dicho.includes(palabra), `no debe decir "${palabra}"`);
  }
});

test("sin_ritmo_dicho_no_se_afirma_que_va_tarde", () => {
  const r = parcelasSinVolar({ fotos: VUELO_JULIO, parcelas: [P53], hoy: "2026-08-17", cada: null });
  assert.equal(r.filas[0].estado, "sin ritmo");
  assert.equal(r.filas[0].cada, null);
  assert.ok(r.filas[0].dice.includes("no se puede saber si va tarde"));
  assert.equal(r.sinVolar.length, 0);
});

test("cada_parcela_puede_traer_su_propio_ritmo", () => {
  // La de ajo en plena corrida se mira más seguido que un potrero en descanso.
  const apurada = { ...P53, volarCadaDias: 15 };
  const r = parcelasSinVolar({ fotos: VUELO_JULIO, parcelas: [apurada], hoy: "2026-07-25", cada: 30 });
  assert.equal(r.filas[0].estado, "sin volar");
  assert.equal(r.filas[0].proximoSugerido, "2026-07-18");
});

test("UNA_CUENTA_QUE_NO_SE_PUDO_HACER_NO_SALE_EN_EL_RENGLON_VERDE", () => {
  // El bug que la regla previene, y el más caro que ha tenido este archivo:
  // cuando los días no se podían calcular, el número salía null, `null > 30`
  // es falso y la parcela caía en "al día". La 53 llevaba 67 días sin volarse
  // y salía en verde, con "voló hace null día(s)" y un "NaN-NaN-NaN" de fecha
  // sugerida — que además es hablarle en programador a un capataz.
  const r = parcelasSinVolar({
    fotos: [foto("a1", 22.7490, -102.4990, "03/07/2026", { parcelaId: "p53" })],
    parcelas: [P53], hoy: "2026-09-08", cada: 30,
  });
  const fila = r.filas[0];
  assert.notEqual(fila.estado, "al día");
  assert.equal(r.alDia.length, 0);
  assert.equal(fila.dias, null);
  assert.equal(fila.proximoSugerido, null);
  assert.ok(!JSON.stringify(fila).includes("NaN"));
  assert.ok(!fila.dice.includes("null"));
  // Y el dato que sí hay —que existe una foto y no se le entendió la fecha—
  // se dice, en vez de desaparecer.
  assert.equal(r.sinMirar.fechaIlegible, 1);
  assert.ok(r.dice.includes("no se pudo leer"));
});

test("con_hoy_como_objeto_Date_no_se_ponen_todas_las_parcelas_en_verde", () => {
  // Una pantalla que pase `new Date()` en vez de texto no puede tumbar la
  // alarma entera: antes eso volvía null TODOS los días calculados de golpe y
  // el tablero quedaba impecable.
  const r = parcelasSinVolar({ fotos: VUELO_JULIO, parcelas: [P53], hoy: new Date(2026, 8, 8), cada: 30 });
  assert.equal(r.filas[0].estado, "sin volar");
  assert.equal(r.filas[0].dias, 67);
  assert.equal(r.filas[0].proximoSugerido, "2026-08-02");
});

test("cuando_no_se_sabe_ni_que_dia_es_hoy_se_dice_en_vez_de_afirmar", () => {
  const r = parcelasSinVolar({ fotos: VUELO_JULIO, parcelas: [P53], hoy: "08/09/2026", cada: 30 });
  assert.equal(r.filas[0].estado, "no se sabe");
  assert.equal(r.noSeSabe.length, 1);
  assert.equal(r.alDia.length, 0);
  assert.ok(r.dice.includes("no se pudo leer la fecha de hoy") || r.dice.includes("No se pudo leer la fecha de hoy"));
  assert.ok(r.filas[0].dice.includes("NO se puede decir si va al día"));
});

test("las_fotos_que_no_se_pudieron_ubicar_no_desaparecen_de_la_alarma", () => {
  // Dos fotos del 1 de septiembre en la mano; lo único que les falta es GPS.
  // Antes la alarma decía "no se ha volado nunca" y punto: afirmaba sin decir
  // que no había mirado todo.
  const r = parcelasSinVolar({
    fotos: [foto("x1", null, null, "2026-09-01"), { id: "x2", fecha: "2026-09-01" }],
    parcelas: [P53], hoy: "2026-09-08",
  });
  assert.equal(r.filas[0].estado, "nunca");
  assert.equal(r.sinMirar.sinUbicar, 2);
  assert.ok(r.filas[0].dice.includes("no se pudieron ubicar"));
  assert.ok(r.filas[0].dice.includes("podría ser de aquí"));
  assert.ok(r.dice.includes("esto no lo mira todo"));
});

test("una_foto_dudosa_que_sostiene_el_ultimo_vuelo_se_dice", () => {
  // Si el último vuelo de una parcela se apoya en una foto que alcanzaba dos
  // parcelas, el "al día" depende de esa duda — y quien lo lee tiene que
  // saberlo.
  const A = { id: "a", nombre: "A", hectareas: 10, lat: 22.7500, lng: -102.5000 };
  const B = { id: "b", nombre: "B", hectareas: 10, lat: 22.7510, lng: -102.5000 };
  const r = parcelasSinVolar({
    fotos: [foto("f3", 22.7503, -102.5000, "2026-09-01")],
    parcelas: [A, B], hoy: "2026-09-08", cada: 30,
  });
  const fa = r.filas.find(f => f.parcelaId === "a");
  assert.equal(fa.estado, "al día");
  assert.equal(fa.fotosDudosas, 1);
  assert.ok(fa.dice.includes("alcanzaban más de una parcela"));
  assert.equal(r.sinMirar.dudosas, 1);
});

test("de_una_parcela_sin_vuelos_no_se_dice_que_este_bien", () => {
  const r = resumenDeParcela({ parcela: GABINO, fotos: [], observaciones: [], hoy: "2026-08-17" });
  assert.equal(r.cuantosVuelos, 0);
  assert.equal(r.ultimoVuelo, null);
  assert.equal(r.diasDesdeElUltimo, null);
  assert.ok(r.dice.includes("no se ha visto"));
});

/* ════════════ COMPARAR DOS VUELOS ════════════ */

const rec = recorrido({ fotos: [...VUELO_JULIO, ...VUELO_AGOSTO, ...VUELO_GABINO], parcelas: PARCELAS });
const vJulio = rec.vuelos.find(v => v.parcelaId === "p53" && v.fecha === "2026-07-03");
const vAgosto = rec.vuelos.find(v => v.parcelaId === "p53" && v.fecha === "2026-08-20");
const vGabino = rec.vuelos.find(v => v.parcelaId === "pgab");

test("NO_SE_INVENTA_UN_PORCENTAJE_DE_CRECIMIENTO_ENTRE_DOS_FOTOS", () => {
  // La razón de ser de esta función. Un "creció 18 %" sacado de mirar dos
  // fotos es un número inventado, y un número inventado con decimales se cree
  // más que una opinión dicha como opinión. Distinta altura, distinta hora y
  // distinta luz mueven el color más que la planta.
  const c = compararVuelos(vJulio, vAgosto);
  assert.equal(c.crecimiento, null);
  assert.ok(c.porqueNoHayPorcentaje.includes("dos fotos no lo miden"));
  assert.ok(c.porqueNoHayPorcentaje.includes("servicio aparte"));
  assert.ok(!/\d+\s?%/.test(c.dice));
});

test("los_dias_entre_vuelos_no_salen_al_reves_aunque_se_escojan_al_reves", () => {
  // Migue escoge dos de una lista en el orden que se le ocurra. Si el orden
  // lo pusiera el clic, saldrían días negativos y una "mejoría" que en
  // realidad es el vuelo viejo.
  const alDerecho = compararVuelos(vJulio, vAgosto);
  const alReves = compararVuelos(vAgosto, vJulio);
  assert.equal(alDerecho.dias, 48);
  assert.equal(alReves.dias, 48);
  assert.equal(alReves.antes.fecha, "2026-07-03");
  assert.equal(alReves.despues.fecha, "2026-08-20");
});

test("empareja_las_fotos_del_mismo_punto_y_dice_las_que_se_quedaron_sin_par", () => {
  const c = compararVuelos(vJulio, vAgosto);
  assert.equal(c.emparejadoPor, "lugar");
  assert.equal(c.pares.length, 2);            // a1↔b1 y a2↔b2
  assert.equal(c.sinPar.length, 1);           // a3 no tiene par en agosto
  assert.ok(c.pares[0].metros <= 40);
});

test("dos_fotos_sin_id_no_se_tapan_una_a_la_otra_al_emparejar", () => {
  // Las ya usadas se marcaban por id, y el id es opcional en todo el módulo.
  // Con una foto sin id se marcaba `undefined` como usado y a partir de ahí se
  // saltaban TODAS las demás del vuelo de después: se perdían de los dos
  // lados, ni en pares ni en sin par. Dos tarjetas con el mismo IMG_0001
  // hacían lo mismo.
  const c = compararVuelos(
    { id: "vA", parcelaId: "p53", fecha: "2026-07-03", fotos: [{ id: "a1", lat: 22.7490, lng: -102.4990 }, { id: "a2", lat: 22.7495, lng: -102.4995 }] },
    { id: "vB", parcelaId: "p53", fecha: "2026-08-20", fotos: [{ lat: 22.74901, lng: -102.49901 }, { lat: 22.74951, lng: -102.49951 }] },
  );
  assert.equal(c.pares.length, 2);
  assert.equal(c.sinPar.length, 0);

  // Y con el mismo id repetido —dos tarjetas, dos IMG_0001— tampoco.
  const repetidos = compararVuelos(
    { id: "vA", parcelaId: "p53", fecha: "2026-07-03", fotos: [{ id: "IMG_0001", lat: 22.7490, lng: -102.4990 }, { id: "IMG_0002", lat: 22.7495, lng: -102.4995 }] },
    { id: "vB", parcelaId: "p53", fecha: "2026-08-20", fotos: [{ id: "IMG_0001", lat: 22.74901, lng: -102.49901 }, { id: "IMG_0001", lat: 22.74951, lng: -102.49951 }] },
  );
  assert.equal(repetidos.pares.length, 2);
  assert.equal(repetidos.sinPar.length, 0);
});

test("las_fotos_sin_gps_de_un_vuelo_no_se_esfuman_de_la_comparacion", () => {
  // Al emparejar por lugar, las que no traen GPS no pueden entrar. Que no
  // entren está bien; que nadie se entere, no.
  const c = compararVuelos(
    { id: "vA", parcelaId: "p53", fecha: "2026-07-03", fotos: [{ id: "a1", lat: 22.7490, lng: -102.4990 }, { id: "a9" }] },
    { id: "vB", parcelaId: "p53", fecha: "2026-08-20", fotos: [{ id: "b1", lat: 22.74901, lng: -102.49901 }] },
  );
  assert.equal(c.sinGps.antes, 1);
  assert.equal(c.sinGps.despues, 0);
  assert.ok(c.dice.includes("no traen GPS"));
  assert.ok(c.dice.includes("no borradas"));
});

test("si_se_empareja_por_orden_se_dice_que_puede_no_ser_el_mismo_punto", () => {
  const sinGpsA = { id: "vA", parcelaId: "p53", fecha: "2026-07-03", fotos: [{ id: "s1" }, { id: "s2" }] };
  const sinGpsB = { id: "vB", parcelaId: "p53", fecha: "2026-08-20", fotos: [{ id: "s3" }, { id: "s4" }] };
  const c = compararVuelos(sinGpsA, sinGpsB);
  assert.equal(c.emparejadoPor, "orden");
  assert.ok(c.pares[0].dice.includes("puede que no sean el mismo punto"));
});

test("dos_parcelas_distintas_no_se_comparan_como_si_fuera_el_tiempo", () => {
  const c = compararVuelos(vJulio, vGabino);
  assert.equal(c.comparable, false);
  assert.equal(c.pares.length, 0);
  assert.ok(c.dice.includes("parcelas distintas"));
});

/* ════════════ LO QUE SE LE MANDA A LA IA ════════════ */

const vueloGrande = {
  id: "vg", parcelaId: "p53", fecha: "2026-08-20",
  fotos: Array.from({ length: 200 }, (_, i) => foto(`z${i}`, 22.749 + i / 100000, -102.499, "2026-08-20", { tomadaEn: `2026-08-20T1${String(i).padStart(3, "0")}` })),
};

test("EL_TOPE_DE_FOTOS_DICE_CUANTAS_DEJO_FUERA", () => {
  // El bug que la regla previene: un tope callado hace creer que se revisó
  // todo el vuelo cuando se revisó la décima parte — y esa creencia es peor
  // que no haber revisado.
  const r = prepararRevision({ vuelo: vueloGrande, parcela: P53, bitacora: [], aplicaciones: [] });
  assert.equal(r.fotosMandadas, TOPE_FOTOS_REVISION);
  assert.equal(r.fotosTotal, 200);
  assert.equal(r.fotosFuera, 188);
  assert.ok(r.dice.includes("NO es de todo el vuelo"));
});

test("las_fotos_se_reparten_a_lo_largo_del_vuelo_no_son_las_primeras", () => {
  // Las primeras doce son todas la misma esquina, porque así se levanta un
  // vuelo.
  const r = prepararRevision({ vuelo: vueloGrande, parcela: P53 });
  const ids = r.fotos.map(f => f.id);
  assert.equal(ids[0], "z0");
  assert.notEqual(ids[1], "z1");
  assert.ok(Number(ids[ids.length - 1].slice(1)) > 150);
});

test("sin_registro_de_aplicaciones_se_le_dice_a_la_IA_que_es_falta_de_registro", () => {
  // "Ninguna aplicación registrada" no es "no se aplicó nada". Si la pregunta
  // no lo aclara, el modelo va a razonar sobre una parcela que nunca se tocó.
  const r = prepararRevision({ vuelo: vueloGrande, parcela: P53, bitacora: [], aplicaciones: [] });
  assert.ok(r.pregunta.includes("no hay registro, NO que no se haya aplicado nada"));
  assert.ok(r.faltaContexto.includes("qué se le ha aplicado"));
});

test("el_contexto_solo_lleva_lo_de_esa_parcela_y_lo_de_antes_del_vuelo", () => {
  // Una aplicación de la semana que viene no explica una foto de hoy, y una
  // de la parcela de junto tampoco.
  const r = prepararRevision({
    vuelo: vueloGrande, parcela: P53,
    aplicaciones: [
      { parcelaId: "p53", fecha: "2026-08-01", producto: "Fosfonitrato" },
      { parcelaId: "p53", fecha: "2026-09-05", producto: "MKP" },      // después del vuelo
      { parcelaId: "pgab", fecha: "2026-08-02", producto: "UREA" },    // otra parcela
    ],
    bitacora: [{ parcelaId: "p53", fecha: "2026-08-10", texto: "se ve amarilla la orilla norte", quien: "Fito" }],
  });
  assert.equal(r.contexto.aplicaciones.length, 1);
  assert.equal(r.contexto.aplicaciones[0].que, "Fosfonitrato");
  assert.equal(r.contexto.bitacora.length, 1);
  assert.ok(r.pregunta.includes("se ve amarilla la orilla norte"));
});

test("NO_SE_LE_PEGA_A_UNA_PARCELA_LO_QUE_NO_SE_PUDO_AMARRAR_A_ELLA", () => {
  // El bug que la regla previene: el filtro dejaba pasar lo que no traía
  // parcela ("si no dice de cuál es, ha de ser de ésta") y, si la ficha de la
  // parcela venía sin identificador, dejaba pasar TODO. La urea de GABINO y
  // la plaga de GABINO acababan explicando una foto de la 53, el modelo
  // razonaba sobre una parcela que no existe y eso terminaba escrito en la
  // bitácora como observación.
  const r = prepararRevision({
    vuelo: vueloGrande,
    parcela: { nombre: "EL 53", cultivo: "AJO" },              // sin id
    aplicaciones: [{ parcelaId: "pgab", fecha: "2026-08-01", producto: "UREA DE GABINO" }],
    bitacora: [{ parcelaId: "pgab", fecha: "2026-08-02", texto: "plaga en GABINO" }],
  });
  assert.ok(!r.pregunta.includes("GABINO"));
  assert.equal(r.contexto.aplicaciones.length, 0);
  assert.equal(r.contexto.bitacora.length, 0);
  assert.equal(r.noSeUsaron.total, 2);
  assert.ok(r.faltaContexto.includes("qué se le ha aplicado"));
  assert.ok(r.faltaContexto.some(f => f.includes("no trae identificador")));
  assert.ok(r.dice.includes("no se pudieron amarrar a esta parcela"));
});

test("una_aplicacion_sin_parcela_anotada_no_se_da_por_de_esta_parcela", () => {
  const r = prepararRevision({
    vuelo: vueloGrande, parcela: P53,
    aplicaciones: [{ fecha: "2026-08-01", producto: "SIN PARCELA" }],
    bitacora: [],
  });
  assert.equal(r.contexto.aplicaciones.length, 0);
  assert.ok(!r.pregunta.includes("SIN PARCELA"));
  assert.equal(r.noSeUsaron.sinParcela, 1);
  assert.ok(r.pregunta.includes("NO se le pegaron"));
});

/* ════════════ 3 · NADA BLOQUEA, Y LA IA OPINA ════════════ */

test("la_revision_nunca_bloquea_ni_ordena_ni_da_cifras", () => {
  const r = prepararRevision({ vuelo: vueloGrande, parcela: P53 });
  assert.equal(r.bloquea, false);
  assert.equal(r.esOpinion, true);
  // Lo que se le pide al modelo, en sus propias palabras.
  assert.ok(r.pregunta.includes("NO des órdenes"));
  assert.ok(r.pregunta.includes("NO des porcentajes"));
  assert.ok(r.pregunta.includes("Quien decide es el agrónomo"));
  assert.ok(r.dice.includes("no para decidir solo"));
});

test("un_vuelo_sin_fotos_lo_dice_en_vez_de_mandar_una_revision_vacia", () => {
  const r = prepararRevision({ vuelo: { id: "v0", fecha: "2026-08-20", fotos: [] }, parcela: P53 });
  assert.equal(r.listo, false);
  assert.equal(r.pregunta, null);
  assert.ok(r.dice.includes("no hay nada que revisar"));
});

/* ════════════ 4 · NADA SE GUARDA SOLO ════════════ */

test("guardarObservacion_devuelve_la_propuesta_no_la_guarda", () => {
  const r = guardarObservacion({ parcelaId: "p53", vueloId: "p53|2026-08-20", texto: "hueco grande al centro", quien: "Fito", fecha: "2026-08-20" });
  assert.equal(r.ok, true);
  assert.equal(r.observacion.parcelaId, "p53");
  assert.equal(r.observacion.confirmada, false);
  assert.equal(r.observacion.soloInsercion, true);
  assert.ok(r.dice.includes("No se edita ni se borra"));
});

test("LA_OBSERVACION_DE_LA_IA_NACE_SIN_CONFIRMAR_Y_MARCADA_COMO_OPINION", () => {
  // El bug que la regla previene: si naciera confirmada, en seis meses nadie
  // distinguiría lo que Fito vio con sus ojos de lo que un modelo creyó ver
  // en una foto — y esa mezcla se vuelve un dato duro que nadie miró.
  const r = guardarObservacion({ parcelaId: "p53", origen: "ia", texto: "la orilla norte se ve más clara que el resto" });
  assert.equal(r.observacion.esOpinion, true);
  assert.equal(r.observacion.confirmada, false);
  assert.ok(r.observacion.quien.includes("IA"));
  assert.ok(r.dice.includes("alguien tiene que ir a ver"));

  const dePersona = guardarObservacion({ parcelaId: "p53", texto: "igual", quien: "Fito" });
  assert.equal(dePersona.observacion.esOpinion, false);
});

test("una_observacion_sin_texto_no_es_una_observacion", () => {
  const r = guardarObservacion({ parcelaId: "p53", texto: "   ", quien: "Fito" });
  assert.equal(r.ok, false);
  assert.equal(r.observacion, null);
  assert.ok(r.porque.includes("sin texto"));
});

test("sin_nombre_se_guarda_igual_pero_se_avisa", () => {
  // El capataz que dicta desde el campo no va a perder su nota por no haber
  // escogido su usuario. Se guarda y se dice que falta.
  const r = guardarObservacion({ parcelaId: "p53", texto: "se encharcó la esquina" });
  assert.equal(r.ok, true);
  assert.ok(r.avisos.some(a => a.includes("a nombre de quién")));
});

test("un_tipo_que_no_esta_en_la_lista_se_guarda_tal_cual_no_se_cambia", () => {
  assert.ok(TIPOS_OCURRENCIA.includes("plaga"));
  const r = guardarObservacion({ parcelaId: "p53", texto: "algo", tipo: "chahuistle", quien: "Fito" });
  assert.equal(r.observacion.tipo, "chahuistle");
  assert.ok(r.avisos.some(a => a.includes("no se cambia por otro")));
});

test("un_origen_que_no_se_conoce_no_se_da_por_persona", () => {
  assert.deepEqual(ORIGENES_OBSERVACION, ["persona", "ia"]);
  const r = guardarObservacion({ parcelaId: "p53", texto: "algo", origen: "quien sabe" });
  assert.equal(r.ok, false);
  assert.ok(r.porque.includes("de dónde salió"));
});

test("DOS_OBSERVACIONES_DEL_MISMO_MILISEGUNDO_NO_NACEN_CON_EL_MISMO_ID", () => {
  // El bug que la regla previene: con `obs${Date.now()}` las tres
  // observaciones que propone una revisión con IA —que salen en fila, en el
  // mismo milisegundo— nacían con el mismo id. En una bitácora de SÓLO
  // INSERCIÓN eso es una tapando a la otra, o la nube rechazando la segunda, y
  // la que se pierde no deja rastro de que existió.
  const ids = new Set();
  for (let i = 0; i < 200; i++) {
    const r = guardarObservacion({ parcelaId: "p53", texto: `ocurrencia ${i}`, quien: "Fito" });
    ids.add(r.observacion.id);
  }
  assert.equal(ids.size, 200);
});

test("una_fecha_de_observacion_que_no_se_pudo_leer_no_se_cambia_por_la_de_hoy", () => {
  // Sin fecha se pone la del día en que se anota, que es lo correcto. Pero si
  // vino una fecha y no se entendió, taparla con la de hoy deja la ocurrencia
  // en el día equivocado y nadie se entera.
  const r = guardarObservacion({ parcelaId: "p53", texto: "hueco al centro", quien: "Fito", fecha: "03/07/2026" });
  assert.equal(r.ok, true);
  assert.equal(r.observacion.fecha, null);
  assert.ok(r.avisos.some(a => a.includes("no se pudo leer")));
});

/* ════════════ EL RESUMEN DE LA PARCELA ════════════ */

test("el_resumen_separa_lo_que_vio_la_gente_de_lo_que_opino_la_IA", () => {
  const r = resumenDeParcela({
    parcela: P53,
    fotos: [...VUELO_JULIO, ...VUELO_AGOSTO],
    observaciones: [
      { parcelaId: "p53", origen: "persona", texto: "hueco al centro", confirmada: false },
      { parcelaId: "p53", origen: "ia", texto: "orilla más clara", confirmada: false, esOpinion: true },
      { parcelaId: "pgab", origen: "persona", texto: "de otra parcela" },
    ],
    hoy: "2026-09-08", cada: 30,
  });
  assert.equal(r.cuantosVuelos, 2);
  assert.equal(r.cuantasFotos, 5);
  assert.equal(r.hayComparacion, true);
  assert.equal(r.diasDesdeElUltimo, 19);
  assert.equal(r.observaciones.dePersona.length, 1);
  assert.equal(r.observaciones.deIA.length, 1);
  assert.equal(r.observaciones.sinConfirmar.length, 1);
  assert.ok(r.dice.includes("opiniones sobre fotos, no mediciones"));
});

test("el_resumen_del_dueno_dice_las_fotos_que_se_quedaron_fuera", () => {
  // Ésta es la pantalla que abre Rodolfo. Antes contaba nada más las fotos que
  // entraron a un vuelo: enseñaba "1 foto" cuando había tres en la mano y se
  // veía completo, sin una palabra de las dos que se quedaron fuera por no
  // traer fecha. Un número menor que el real y con cara de estar entero es
  // peor que no dar el número.
  const r = resumenDeParcela({
    parcela: P53,
    fotos: [
      foto("a1", 22.7490, -102.4990, "2026-07-03"),
      { id: "a2", lat: 22.7490, lng: -102.4990 },
      { id: "a3", lat: 22.7490, lng: -102.4990 },
    ],
    observaciones: [], hoy: "2026-09-08",
  });
  assert.equal(r.cuantasFotos, 1);
  assert.equal(r.fotosSinFecha, 2);
  assert.equal(r.fotosFueraDeVuelos, 2);
  assert.ok(r.dice.includes("2 no"));
  assert.ok(r.dice.includes("sin fecha"));
  assert.ok(r.dice.includes("no están perdidas"));
});

test("el_resumen_no_dice_hace_cuantos_dias_cuando_no_lo_pudo_calcular", () => {
  const r = resumenDeParcela({ parcela: P53, fotos: VUELO_JULIO, observaciones: [], hoy: "08/09/2026" });
  assert.equal(r.diasDesdeElUltimo, null);
  assert.ok(!r.dice.includes("hace null"));
  assert.ok(r.dice.includes("no se dice si va al día"));
});

test("SIN_PARCELAS_NO_DICE_QUE_TODAS_ESTAN_AL_DIA", () => {
  // Decir "todas se han volado dentro de su ritmo" cuando no hay ni una
  // parcela es afirmar sobre lo que nadie miró — la misma falta que ya había
  // mordido en vigilancia, donde `alcanzaPara` contestaba "ALCANZA" con cero
  // bolsas registradas. Lo que falta no es volar: es capturar las parcelas.
  const r = parcelasSinVolar({ fotos: [], parcelas: [], hoy: "2026-09-08" });
  assert.equal(r.filas.length, 0);
  assert.ok(!r.dice.includes("dentro de su ritmo"), `dijo: ${r.dice}`);
  assert.ok(r.dice.includes("No hay ninguna parcela dada de alta"));
  assert.equal(r.bloquea, false);
});

test("con_parcelas_y_todas_voladas_si_lo_dice", () => {
  // Y el mensaje bueno no se pierde: cuando SÍ hay parcelas y todas están al
  // día, se dice, porque esa también es una respuesta útil.
  const r = parcelasSinVolar({
    parcelas: [{ id: "p1", nombre: "El 53", lat: 22.77, lng: -102.58 }],
    fotos: [{ id: "f1", lat: 22.77, lng: -102.58, fecha: "2026-09-06" }],
    hoy: "2026-09-08", cada: 30,
  });
  assert.equal(r.filas.length, 1);
  assert.ok(r.dice.includes("dentro de su ritmo"), `dijo: ${r.dice}`);
});
