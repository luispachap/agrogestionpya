// ============================================================
//  Pruebas del chat de adentro de la app
//
//  El hilo de todas: el chat ENTIENDE y PROPONE, y una persona con nombre
//  confirma. Lo que nadie confirmó no es un movimiento, lo que no se entendió
//  no se tira, y lo que no se sabe se dice — nunca se rellena con un cero ni
//  con una suposición.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  TIPOS_MENSAJE, CONFIANZAS, ROL_QUE_ATIENDE, ESTADOS_CONFIRMACION,
  diaDe, origenDe, clasificarMensaje, aQuienLeToca, marcarConfirmacion,
  cuentaComoMovimiento, estadoDeConfirmacion, hiloDeMensajes,
  pendientesDeConfirmar, resumenDelDia, tipoDeMensaje, estadoParaLaTabla,
} from "./chat.js";

/* ════════════ LA GENTE DEL RANCHO ════════════ */

const GENTE = [
  { id: "u1", nombre: "Luis", rol: "admin" },
  { id: "u2", nombre: "Rodolfo", rol: "dueno" },
  { id: "u3", nombre: "Fito", rol: "agronomo" },
  { id: "u4", nombre: "Gera", rol: "encargado" },
  { id: "u5", nombre: "Juan Pérez", rol: "trabajador", parcelas: ["p1"] },
  { id: "u6", nombre: "Pedro Ramírez", rol: "trabajador", parcelas: ["p2"] },
];

const PARCELAS = [
  { id: "p1", nombre: "San Felipe 1" },
  { id: "p2", nombre: "53" },
  { id: "p3", nombre: "Gabino" },
];

/* Como habla Gera de verdad: tres cosas distintas en un mismo mensaje. */
const LO_QUE_MANDO_GERA =
  "Hoy en San Felipe 1 anduvieron Juan y Pedro regando ocho horas. " +
  "También se compraron doscientos litros de diésel en la gasolinera de la entrada, tres mil ochocientos pesos. " +
  "Y hace falta un filtro para el tractor 3, ya está sonando feo.";

const MSJ_GERA = {
  id: "m1",
  de: { id: "u4", nombre: "Gera", rol: "encargado" },
  cuando: "2026-09-08T15:20:00.000Z",
  texto: LO_QUE_MANDO_GERA,
};

/* La hoja de fertirriego de Fito, la de la parcela 53: 11 hectáreas. */
const HOJA_53 = [
  ["Fertiriego en el cultivo de:", "CHILE MIRASOL", "Superficie en Ha:", "11"],
  ["Parcela:", "53", "Fecha:", "17/07/2026"],
  ["Fertilizantes", "Dosis kg/ha", "Fertilizante total", "Productos Extras", "Dosis/ha:Lt o Kg", "Producto total"],
  ["Fosfonitrato", "20", "220", "infinito", "1", "0"],
  ["S.Amonio", "", "0", "serenade", "3", "0"],
  ["MAP", "", "0", "barrier", "5", "0"],
  ["S.Potasio", "", "0"],
  ["S. Magnesio", "20", "220"],
  ["N. Calcio", "25", "275"],
  ["Cl. Potasio", "", "0"],
  ["NKS", "", "0"],
  ["UREA", "", "0"],
  ["MKP", "40", "440"],
  ["MicroMix", "", "0"],
];
const copiar = (filas) => filas.map(f => [...f]);

const clasificar = (mensaje) =>
  clasificarMensaje({ mensaje, personas: GENTE, parcelas: PARCELAS, hoy: "2026-09-08" });

const YO = { id: "u1", nombre: "Luis" };

/* ════════════ QUÉ ES CADA MENSAJE ════════════ */

test("un_solo_mensaje_de_gera_saca_tres_movimientos_distintos", () => {
  // En el grupo esto es un párrafo que nadie captura. Aquí salen la
  // actividad, el gasto y la necesidad, cada uno por su lado.
  const r = clasificar(MSJ_GERA);
  const tipos = r.movimientos.map(p => p.tipo);
  assert.ok(tipos.includes("actividad"), `salieron: ${tipos.join(", ")}`);
  assert.ok(tipos.includes("gasto"));
  assert.ok(tipos.includes("necesidad"));
});

test("el_gasto_dicho_se_queda_con_su_monto", () => {
  const r = clasificar(MSJ_GERA);
  const gasto = r.movimientos.find(p => p.tipo === "gasto");
  assert.equal(gasto.monto, 3800);
});

test("el_chat_no_vuelve_a_escribir_el_clasificador_de_voz", () => {
  // Los tipos que salen del texto son los mismos que ya entiende el dictado.
  // Si aquí saliera un tipo que voz.js no conoce, es que se duplicó la lógica.
  const r = clasificar(MSJ_GERA);
  for (const p of r.propuestas) assert.ok(TIPOS_MENSAJE.includes(p.tipo), `tipo desconocido: ${p.tipo}`);
});

/* ════════════ EL ORIGEN, PEGADO A CADA MOVIMIENTO ════════════ */

test("cada_movimiento_se_lleva_pegado_de_donde_salio", () => {
  // Seis meses después, en un cierre, alguien va a preguntar de dónde salió
  // este gasto. La respuesta tiene que estar en el mismo renglón.
  const r = clasificar(MSJ_GERA);
  for (const p of r.movimientos) {
    assert.equal(p.origen.mensajeId, "m1");
    assert.equal(p.origen.de, "Gera");
    assert.equal(p.origen.cuando, "2026-09-08T15:20:00.000Z");
    assert.equal(p.origen.completo, true);
  }
});

test("la_foto_y_el_audio_originales_van_pegados_al_movimiento", () => {
  // Nunca se pierde evidencia: es la misma regla de la foto borrosa del
  // ticket y del audio que no se pudo transcribir.
  const r = clasificar({
    ...MSJ_GERA,
    foto: { dataUrl: "data:image/jpeg;base64,LAFOTO" },
    audio: { dataUrl: "data:audio/webm;base64,ELAUDIO" },
  });
  const gasto = r.movimientos.find(p => p.tipo === "gasto");
  assert.equal(gasto.origen.foto, "data:image/jpeg;base64,LAFOTO");
  assert.equal(gasto.origen.audio, "data:audio/webm;base64,ELAUDIO");
});

test("un_movimiento_sin_su_origen_no_se_puede_aclarar_despues", () => {
  // Si falta quién lo mandó o a qué hora, se DICE. No se inventa un remitente
  // ni se le pone la hora de ahorita.
  const o = origenDe({ texto: "se compró diésel" });
  assert.equal(o.completo, false);
  assert.equal(o.cuando, null);
  assert.equal(o.de, null);
  assert.deepEqual(o.falta, ["cuál mensaje fue", "quién lo mandó", "a qué hora llegó"]);
  assert.ok(o.dice.includes("no se puede aclarar después"));
});

/* ════════════ LO QUE NO SE ENTENDIÓ NO SE TIRA ════════════ */

test("un_mensaje_que_no_se_entendio_se_marca_por_identificar_y_se_queda_completo", () => {
  const r = clasificar({
    id: "m9", de: { id: "u4", nombre: "Gera" }, cuando: "2026-09-08T15:20:00.000Z",
    texto: "ahí te va lo de ayer",
    audio: { dataUrl: "data:audio/webm;base64,ELAUDIO" },
  });
  assert.equal(r.confianza, "por identificar");
  assert.equal(r.porIdentificar, true);
  assert.equal(r.movimientos.length, 0);
  // Se queda TAL CUAL, con su audio.
  assert.equal(r.seGuarda, true);
  assert.equal(r.texto, "ahí te va lo de ayer");
  assert.equal(r.audio.dataUrl, "data:audio/webm;base64,ELAUDIO");
  assert.ok(r.porque.includes("por identificar"));
});

test("la_foto_que_nadie_ha_leido_NO_se_adivina", () => {
  // Afirmar qué es una foto que nadie miró es el pecado que este sistema
  // evita. Se dice que está sin leer y ahí se detiene.
  const r = clasificar({
    id: "m10", de: { id: "u3", nombre: "Fito" }, cuando: "2026-09-08T15:20:00.000Z",
    foto: { dataUrl: "data:image/jpeg;base64,LOQUESEA" },
  });
  assert.equal(r.confianza, "por identificar");
  assert.equal(r.movimientos.length, 0);
  assert.ok(r.pasos.some(p => p.dice.includes("todavía no se ha leído")));
});

/* ════════════ LA HOJA DE FITO ════════════ */

test("la_hoja_de_fertirriego_se_vuelve_indicacion_con_su_parcela", () => {
  const r = clasificar({
    id: "m2", de: { id: "u3", nombre: "Fito", rol: "agronomo" },
    cuando: "2026-09-08T14:00:00.000Z",
    foto: { dataUrl: "data:image/jpeg;base64,LAHOJA", renglones: HOJA_53 },
  });
  const hoja = r.movimientos.find(p => p.tipo === "fertirriego");
  assert.equal(hoja.confiable, true);
  assert.equal(hoja.parcelaId, "p2");             // la parcela "53" del catálogo
  assert.equal(hoja.indicacion.deQuien, "Fito");
  assert.equal(hoja.origen.foto, "data:image/jpeg;base64,LAHOJA");
});

test("una_hoja_que_no_cuadra_llega_marcada_y_con_el_renglon_malo", () => {
  // Un dígito mal leído rompe la multiplicación. La hoja NO se rechaza sola
  // —eso lo hace una persona— pero llega señalada, para que nadie la
  // confirme de corrida.
  const mala = copiar(HOJA_53);
  mala[8] = ["N. Calcio", "25", "375"];           // 25 × 11 = 275, no 375
  const r = clasificar({
    id: "m3", de: { id: "u3", nombre: "Fito" }, cuando: "2026-09-08T14:00:00.000Z",
    foto: { dataUrl: "data:image/jpeg;base64,LAHOJA", renglones: mala },
  });
  const hoja = r.movimientos.find(p => p.tipo === "fertirriego");
  assert.equal(hoja.confiable, false);
  assert.equal(hoja.renglonMalo.nombre, "N. Calcio");
  assert.equal(hoja.renglonMalo.totalQueDeberia, 275);
  assert.equal(r.confianza, "media");
});

/* ════════════ EL PAPEL YA LEÍDO ════════════ */

const TICKET_LEIDO = {
  ok: true, tipo: "ticket", fuente: "patron-local",
  campos: { emisor: "Gasolinera La Entrada", fecha: "2026-09-08", total: 3800 },
  noSeLeyo: [],
};

test("un_ticket_ya_leido_se_vuelve_gasto_con_su_proveedor", () => {
  const r = clasificar({
    id: "m4", de: { id: "u4", nombre: "Gera" }, cuando: "2026-09-08T15:00:00.000Z",
    foto: { dataUrl: "data:image/jpeg;base64,ELTICKET", lectura: TICKET_LEIDO },
  });
  const g = r.movimientos.find(p => p.tipo === "gasto");
  assert.equal(g.monto, 3800);
  assert.equal(g.proveedor, "Gasolinera La Entrada");
  assert.equal(g.fecha, "2026-09-08");
  assert.equal(r.confianza, "alta");
});

test("un_ticket_sin_total_deja_el_monto_en_null_no_en_cero", () => {
  // Number(null) es 0, y ese cero se suma y nadie lo vuelve a mirar. Un
  // monto en blanco se pregunta.
  const r = clasificar({
    id: "m5", de: { id: "u4", nombre: "Gera" }, cuando: "2026-09-08T15:00:00.000Z",
    foto: {
      dataUrl: "data:image/jpeg;base64,BORROSO",
      lectura: { ok: true, tipo: "ticket", campos: { emisor: "Ferretería" }, noSeLeyo: ["total", "fecha"] },
    },
  });
  const g = r.movimientos.find(p => p.tipo === "gasto");
  assert.equal(g.monto, null);
  assert.notEqual(g.monto, 0);
  assert.ok(g.falta.includes("cuánto costó"));
  assert.equal(g.seguro, false);
});

/* ════════════ A QUIÉN LE TOCA ════════════ */

test("la_hoja_de_fertirriego_le_toca_al_que_atiende_esa_parcela", () => {
  const r = aQuienLeToca({
    propuesta: { tipo: "fertirriego", parcelaId: "p2" }, personas: GENTE,
  });
  assert.equal(r.paraQuien.nombre, "Pedro Ramírez");
  assert.equal(r.sinAsignar, false);
  assert.ok(r.porque.includes("atiende esa parcela"));
});

test("la_necesidad_le_toca_a_quien_compra_y_el_gasto_a_quien_lleva_las_cuentas", () => {
  const soloLuis = GENTE.filter(p => p.rol !== "finanzas");
  const nec = aQuienLeToca({ propuesta: { tipo: "necesidad" }, personas: soloLuis });
  assert.equal(nec.paraQuien.nombre, "Luis");
  assert.ok(nec.porque.includes("quien compra"));
  const gas = aQuienLeToca({ propuesta: { tipo: "gasto" }, personas: soloLuis });
  assert.equal(gas.paraQuien.nombre, "Luis");
});

test("si_no_se_sabe_a_quien_le_toca_se_deja_SIN_ASIGNAR_y_se_dice", () => {
  // Nadie registrado en esa parcela. NO se cae al encargado general:
  // mandarle el riego de la 53 a quien no la riega es mandarlo a nadie,
  // sólo que con acuse de recibo.
  const r = aQuienLeToca({ propuesta: { tipo: "fertirriego", parcelaId: "p3" }, personas: GENTE });
  assert.equal(r.paraQuien, null);
  assert.equal(r.sinAsignar, true);
  assert.ok(r.porque.includes("Nadie está registrado como responsable de esa parcela"));
});

test("sin_saber_de_que_parcela_es_tampoco_se_adivina_a_quien", () => {
  const r = aQuienLeToca({ propuesta: { tipo: "fertirriego", parcelaId: null }, personas: GENTE });
  assert.equal(r.sinAsignar, true);
  assert.ok(r.porque.includes("No se sabe de qué parcela es"));
});

test("cuando_hay_varios_no_elige_porque_si_le_llega_a_todos_no_la_hace_nadie", () => {
  const r = aQuienLeToca({
    propuesta: { tipo: "necesidad" },
    personas: [...GENTE, { id: "u7", nombre: "Migue", rol: "finanzas" }],
  });
  assert.equal(r.paraQuien, null);
  assert.equal(r.sinAsignar, true);
  assert.equal(r.candidatos.length, 2);
  assert.ok(r.porque.includes("no lo hace nadie"));
});

test("una_nota_no_le_toca_a_nadie_y_eso_NO_es_un_problema", () => {
  // "No le toca a nadie a propósito" va aparte de "no se supo a quién", igual
  // que "nunca se capturó" va aparte de "dejó de aparecer".
  const r = aQuienLeToca({ propuesta: { tipo: "nota" }, personas: GENTE });
  assert.equal(r.sinAsignar, false);
  assert.equal(r.esParaNadie, true);
  assert.ok(r.porque.includes("queda en el hilo"));
});

test("asignar_NUNCA_bloquea", () => {
  for (const tipo of TIPOS_MENSAJE) {
    const r = aQuienLeToca({ propuesta: { tipo }, personas: [] });
    assert.equal(r.bloquea, false, `${tipo} no debe bloquear`);
  }
});

/* ════════════ NADA SE GUARDA SOLO ════════════ */

test("el_chat_entiende_y_propone_pero_no_guarda_solo", () => {
  const r = clasificar(MSJ_GERA);
  assert.equal(r.guardaSolo, false);
  assert.equal(r.bloquea, false);
  for (const p of r.propuestas) assert.equal(p.confirmacion, null);
});

test("un_mensaje_sin_confirmar_NUNCA_cuenta_como_movimiento", () => {
  const r = clasificar(MSJ_GERA);
  const est = estadoDeConfirmacion(r);
  assert.equal(est.estado, "pendiente");
  assert.equal(est.cuentaComoMovimiento, false);
  for (const p of r.movimientos) assert.equal(cuentaComoMovimiento(p), false);
});

test("una_confirmacion_sin_nombre_no_es_una_confirmacion", () => {
  // Un registro que apareció solo es justo lo que este chat evita.
  const r = marcarConfirmacion({ tipo: "gasto", monto: 3800 }, { estado: "confirmado", quien: null });
  assert.equal(r.ok, false);
  assert.ok(r.dice.includes("Falta quién"));
  // Y si un registro viejo llegara así, tampoco cuenta.
  const colado = { tipo: "gasto", monto: 3800, confirmacion: { estado: "confirmado", quien: null } };
  assert.equal(cuentaComoMovimiento(colado), false);
});

test("rechazar_sin_motivo_no_se_deja", () => {
  // Es la misma regla de la merma sin causa: lo que se descarta se descarta
  // con su porqué.
  const sin = marcarConfirmacion({ tipo: "gasto" }, { estado: "rechazado", quien: YO });
  assert.equal(sin.ok, false);
  assert.ok(sin.dice.includes("Falta por qué"));
  const con = marcarConfirmacion({ tipo: "gasto" }, {
    estado: "rechazado", quien: YO, motivo: "ya se había capturado el lunes",
  });
  assert.equal(con.ok, true);
  assert.equal(con.propuesta.confirmacion.motivo, "ya se había capturado el lunes");
  assert.equal(cuentaComoMovimiento(con.propuesta), false);
});

test("corregir_guarda_tambien_como_llego", () => {
  // Corregir no es borrar: el dato original se queda, para poder ver qué se
  // leyó mal y de quién.
  const r = marcarConfirmacion({ tipo: "gasto", monto: 3800 }, {
    estado: "corregido", quien: YO, cuando: "2026-09-08T18:00:00.000Z", cambios: { monto: 3850 },
  });
  assert.equal(r.ok, true);
  assert.equal(r.propuesta.monto, 3850);
  assert.equal(r.propuesta.comoLlego.monto, 3800);
  assert.equal(cuentaComoMovimiento(r.propuesta), true);
});

test("mientras_quede_uno_colgado_el_mensaje_sigue_pendiente", () => {
  // Un mensaje trae tres cosas y se confirman una por una. Darlo por cerrado
  // con dos de tres es dar por registrado algo que no lo está.
  const r = clasificar(MSJ_GERA);
  const props = r.movimientos.map((p, i) =>
    i === 0 ? p : marcarConfirmacion(p, { estado: "confirmado", quien: YO, cuando: "2026-09-08T18:00:00.000Z" }).propuesta
  );
  const est = estadoDeConfirmacion({ ...r, propuestas: props });
  assert.equal(est.estado, "pendiente");
  assert.equal(est.pendientes, 1);
  assert.ok(est.dice.includes("quedan 1 sin revisar"));
});

test("los_estados_son_los_cuatro_y_traen_quien_y_cuando", () => {
  assert.deepEqual(ESTADOS_CONFIRMACION, ["pendiente", "confirmado", "corregido", "rechazado"]);
  const r = clasificar(MSJ_GERA);
  const props = r.movimientos.map(p =>
    marcarConfirmacion(p, { estado: "confirmado", quien: YO, cuando: "2026-09-08T18:00:00.000Z" }).propuesta
  );
  const est = estadoDeConfirmacion({ ...r, propuestas: props });
  assert.equal(est.estado, "confirmado");
  assert.equal(est.quien, "Luis");
  assert.equal(est.cuando, "2026-09-08T18:00:00.000Z");
  assert.equal(est.cuentaComoMovimiento, true);
});

/* ════════════ EL HILO ════════════ */

test("un_mensaje_de_las_diez_y_media_de_la_noche_no_se_va_al_dia_siguiente", () => {
  // Zacatecas va seis horas atrás de UTC: la marca de tiempo de esa hora ya
  // dice el día siguiente. Agrupado por esa marca, lo que Gera mandó el lunes
  // en la noche aparecería el martes — el mismo bug que movía de mes al panel
  // del dueño a media tarde.
  const nocheDelLunes = new Date(2026, 8, 7, 22, 30);   // 7 de septiembre, en el rancho
  const h = hiloDeMensajes([
    { id: "m1", de: { nombre: "Gera" }, cuando: nocheDelLunes.toISOString(), texto: "ahí va" },
  ]);
  assert.equal(h.dias[0].fecha, "2026-09-07");
  // Donde de verdad se ve el bug es en un aparato puesto en la hora del
  // rancho; en uno puesto en UTC no hay diferencia que ver, y la prueba no
  // finge que la hay.
  if (nocheDelLunes.getTimezoneOffset() > 60) {
    assert.notEqual(nocheDelLunes.toISOString().slice(0, 10), "2026-09-07");
  }
});

test("una_fecha_pelona_no_retrocede_un_dia", () => {
  // "2026-09-08" ya ES un día local. Pasarlo por new Date() lo leería como
  // medianoche UTC y en el rancho retrocedería al 7.
  assert.equal(diaDe("2026-09-08"), "2026-09-08");
  assert.equal(diaDe(null), null);
  assert.equal(diaDe("cualquier cosa"), null);
});

test("el_hilo_va_en_orden_agrupado_por_dia_y_con_quien_lo_mando", () => {
  const h = hiloDeMensajes([
    { id: "b", de: { nombre: "Fito" }, cuando: "2026-09-08T14:00:00.000Z" },
    { id: "a", de: { nombre: "Gera" }, cuando: "2026-09-08T13:00:00.000Z" },
    { id: "c", de: { nombre: "Gera" }, cuando: "2026-09-09T13:00:00.000Z" },
  ]);
  assert.equal(h.dias.length, 2);
  assert.deepEqual(h.dias[0].mensajes.map(m => m.id), ["a", "b"]);
  assert.deepEqual(h.dias[0].dePersonas, ["Gera", "Fito"]);
  assert.equal(h.total, 3);
});

test("un_mensaje_sin_hora_no_se_mete_en_hoy", () => {
  // Ponerle la fecha de hoy sería inventársela, y un mensaje con fecha
  // inventada estorba justo cuando hay que reconstruir un día.
  const h = hiloDeMensajes([
    { id: "a", de: { nombre: "Gera" }, cuando: "2026-09-08T13:00:00.000Z" },
    { id: "x", de: { nombre: "Gera" } },
  ]);
  assert.equal(h.sinHora.length, 1);
  assert.equal(h.total, 1);
  assert.equal(h.dias.length, 1);
  assert.ok(h.dice.includes("no se sabe de qué día son"));
});

/* ════════════ LO QUE LLEVA RATO COLGADO ════════════ */

test("lo_mas_viejo_sale_arriba_y_dice_cuanto_rato_lleva", () => {
  // Un chat donde todo entra y nada se cierra es peor que no tenerlo: da la
  // sensación de que ya quedó registrado, y no quedó.
  const ayer = clasificar({ ...MSJ_GERA, id: "viejo", cuando: "2026-09-07T15:00:00.000Z" });
  const hoy = clasificar({ ...MSJ_GERA, id: "nuevo", cuando: "2026-09-08T15:00:00.000Z" });
  const r = pendientesDeConfirmar([hoy, ayer], { ahora: "2026-09-08T18:00:00.000Z" });
  assert.equal(r.cuantos, 2);
  assert.equal(r.filas[0].mensajeId, "viejo");
  assert.equal(r.filas[0].horas, 27);
  assert.equal(r.filas[0].apura, true);
  assert.equal(r.filas[1].horas, 3);
  assert.ok(r.dice.includes("el más viejo lleva 1 día(s)"));
});

test("lo_ya_confirmado_deja_de_estar_colgado", () => {
  const m = clasificar(MSJ_GERA);
  const listo = {
    ...m,
    propuestas: m.propuestas.map(p =>
      marcarConfirmacion(p, { estado: "confirmado", quien: YO, cuando: "2026-09-08T16:00:00.000Z" }).propuesta
    ),
  };
  const r = pendientesDeConfirmar([listo], { ahora: "2026-09-08T18:00:00.000Z" });
  assert.equal(r.cuantos, 0);
  assert.equal(r.dice, "No hay nada esperando confirmación.");
});

test("lo_que_esta_por_identificar_tambien_espera_a_una_persona", () => {
  const raro = clasificar({
    id: "raro", de: { nombre: "Gera" }, cuando: "2026-09-08T15:00:00.000Z",
    foto: { dataUrl: "data:image/jpeg;base64,LOQUESEA" },
  });
  const r = pendientesDeConfirmar([raro], { ahora: "2026-09-08T18:00:00.000Z" });
  assert.equal(r.cuantos, 1);
  assert.equal(r.filas[0].porIdentificar, true);
  assert.ok(r.filas[0].dice.includes("todavía no se sabe qué es"));
});

test("sin_hora_no_se_sabe_cuanto_lleva_esperando_y_eso_no_son_cero_horas", () => {
  // Cero horas diría "acaba de llegar", que es lo contrario de lo que se sabe.
  const m = clasificar({ id: "sinhora", de: { nombre: "Gera" }, texto: LO_QUE_MANDO_GERA });
  const r = pendientesDeConfirmar([m], { ahora: "2026-09-08T18:00:00.000Z" });
  assert.equal(r.filas[0].horas, null);
  assert.notEqual(r.filas[0].horas, 0);
  assert.equal(r.sinHora.length, 1);
  assert.ok(r.filas[0].dice.includes("no se sabe de cuándo es"));
});

/* ════════════ EL RESUMEN DEL DÍA ════════════ */

const gastoDe = (id, monto, confirmado) => ({
  id, de: { id: "u4", nombre: "Gera" }, cuando: "2026-09-08T15:00:00.000Z",
  propuestas: [{
    id: `${id}:0`, tipo: "gasto", monto,
    confirmacion: confirmado
      ? { estado: "confirmado", quien: "Luis", cuando: "2026-09-08T18:00:00.000Z" }
      : null,
  }],
});

test("el_resumen_del_dia_NO_cuenta_lo_que_nadie_confirmo", () => {
  const r = resumenDelDia({
    mensajes: [gastoDe("a", 1000, true), gastoDe("b", 40000, false)],
    fecha: "2026-09-08",
  });
  assert.equal(r.movimientos.length, 1);
  assert.equal(r.colgados.length, 1);
  assert.equal(r.gastado, 1000);          // los 40,000 sin confirmar NO entran
  assert.ok(r.dice.includes("Quedaron 1 sin confirmar"));
});

test("un_gasto_confirmado_sin_monto_no_entra_como_cero_y_se_dice_cuantos_son", () => {
  // Sumarlo como cero haría que el gasto del día se viera más chico de lo que
  // es, y nadie volvería a mirar ese renglón.
  const r = resumenDelDia({
    mensajes: [gastoDe("a", 1000, true), gastoDe("b", null, true)],
    fecha: "2026-09-08",
  });
  assert.equal(r.gastado, 1000);
  assert.equal(r.gastosSinMonto, 1);
  assert.ok(r.dice.includes("sin monto capturado"));
});

test("el_dinero_del_dia_se_suma_en_centavos_enteros", () => {
  // 0.1 + 0.2 en punto flotante da 0.30000000000000004, y ese sobrante se
  // acumula hasta que la suma de las partes ya no da el total.
  const r = resumenDelDia({
    mensajes: [gastoDe("a", 0.1, true), gastoDe("b", 0.2, true)],
    fecha: "2026-09-08",
  });
  assert.equal(r.gastado, 0.3);
});

test("un_dia_sin_nada_confirmado_lo_dice_sin_inventar_un_total", () => {
  const r = resumenDelDia({ mensajes: [gastoDe("b", 40000, false)], fecha: "2026-09-08" });
  assert.equal(r.movimientos.length, 0);
  assert.equal(r.gastado, null);          // no es cero: es que no hubo
  assert.ok(r.dice.includes("no se confirmó ningún movimiento"));
});

test("el_resumen_separa_lo_movido_de_lo_colgado_y_lo_por_identificar", () => {
  const raro = clasificar({
    id: "raro", de: { nombre: "Fito" }, cuando: "2026-09-08T16:00:00.000Z",
    foto: { dataUrl: "data:image/jpeg;base64,LOQUESEA" },
  });
  const r = resumenDelDia({
    mensajes: [gastoDe("a", 1000, true), raro], fecha: "2026-09-08",
  });
  assert.equal(r.movimientos.length, 1);
  assert.equal(r.porIdentificar.length, 1);
  assert.deepEqual(r.dePersonas, ["Gera", "Fito"]);
  assert.equal(r.cuantosMensajes, 2);
});

test("el_resumen_solo_toma_los_mensajes_de_ese_dia", () => {
  const r = resumenDelDia({
    mensajes: [
      gastoDe("a", 1000, true),
      { ...gastoDe("otro", 999999, true), cuando: "2026-09-01T15:00:00.000Z" },
    ],
    fecha: "2026-09-08",
  });
  assert.equal(r.cuantosMensajes, 1);
  assert.equal(r.gastado, 1000);
});

/* ════════════ LO QUE VA EN LAS COLUMNAS DE LA TABLA ════════════ */

test("el_tipo_que_se_guarda_es_el_que_la_tabla_espera", () => {
  assert.equal(tipoDeMensaje({ texto: "ahí va" }), "texto");
  assert.equal(tipoDeMensaje({ audio: { dataUrl: "x" } }), "audio");
  assert.equal(tipoDeMensaje({ foto: { dataUrl: "x" } }), "foto");
  assert.equal(tipoDeMensaje({ foto: { dataUrl: "x", renglones: HOJA_53 } }), "hoja");
  // Sin texto, sin foto y sin audio no hay mensaje que guardar.
  assert.equal(tipoDeMensaje({}), null);
});

test("por_identificar_se_guarda_distinto_de_pendiente", () => {
  // Los dos esperan a una persona, pero uno espera un sí y el otro espera que
  // alguien diga qué es. Son dos trabajos distintos y se buscan por separado.
  const raro = clasificar({
    id: "raro", de: { nombre: "Gera" }, cuando: "2026-09-08T15:00:00.000Z",
    foto: { dataUrl: "data:image/jpeg;base64,LOQUESEA" },
  });
  assert.equal(estadoParaLaTabla(raro), "por_identificar");
  assert.equal(estadoParaLaTabla(clasificar(MSJ_GERA)), "pendiente");
});

test("un_mensaje_que_no_era_nada_se_puede_cerrar_a_mano_con_su_motivo", () => {
  const raro = clasificar({
    id: "raro", de: { nombre: "Gera" }, cuando: "2026-09-08T15:00:00.000Z",
    foto: { dataUrl: "data:image/jpeg;base64,LOQUESEA" },
  });
  const cerrado = marcarConfirmacion(raro, {
    estado: "rechazado", quien: YO, cuando: "2026-09-08T18:00:00.000Z",
    motivo: "era una foto de la troca, no de un papel",
  });
  assert.equal(cerrado.ok, true);
  const est = estadoDeConfirmacion(cerrado.propuesta);
  assert.equal(est.estado, "rechazado");
  assert.equal(est.porIdentificar, false);
  assert.ok(est.dice.includes("era una foto de la troca"));
  // Se queda en el hilo con su foto: rechazar no es borrar.
  assert.equal(cerrado.propuesta.foto.dataUrl, "data:image/jpeg;base64,LOQUESEA");
  // Y deja de estar colgado.
  assert.equal(pendientesDeConfirmar([cerrado.propuesta], { ahora: "2026-09-08T19:00:00.000Z" }).cuantos, 0);
});

/* ════════════ ESTE CHAT NO SALE DE LA APP ════════════ */

test("el_chat_no_manda_nada_fuera_de_la_app", () => {
  // No hay integración con WhatsApp ni con nada externo: lo que se escribe
  // aquí se queda aquí. Está puesto explícito para que ningún cambio futuro
  // lo pise sin darse cuenta.
  const r = clasificar(MSJ_GERA);
  assert.equal(r.saleDeLaApp, false);
});

test("las_confianzas_y_los_puestos_que_atienden_estan_declarados", () => {
  assert.deepEqual(CONFIANZAS, ["alta", "media", "por identificar"]);
  for (const tipo of TIPOS_MENSAJE) {
    assert.ok(ROL_QUE_ATIENDE[tipo], `falta decir quién atiende un "${tipo}"`);
  }
});

/* ════════════════════════════════════════════════════════════
   LO QUE YA SE ROMPIÓ UNA VEZ

   Cada una de estas pruebas existe por un renglón que salía mal en la
   pantalla. El nombre dice cuál, porque dentro de seis meses el nombre es lo
   único que va a explicar por qué la prueba está aquí.
   ════════════════════════════════════════════════════════════ */

test("la_foto_del_ticket_y_el_texto_que_lo_describe_no_pasan_por_dos_gastos", () => {
  // El hueco que este chat vino a cerrar es el gasto capturado dos veces, y se
  // volvía a abrir solo: Gera manda la foto del ticket Y escribe qué fue, y
  // salían dos gastos de $3,800, los dos marcados con confianza "alta".
  const r = clasificar({
    id: "mA", de: { id: "u4", nombre: "Gera" }, cuando: "2026-09-08T15:00:00.000Z",
    texto: "Se compraron doscientos litros de diésel en la gasolinera de la entrada, tres mil ochocientos pesos.",
    foto: { dataUrl: "data:image/jpeg;base64,ELTICKET", lectura: TICKET_LEIDO },
  });
  const gastos = r.movimientos.filter(p => p.tipo === "gasto");
  assert.equal(gastos.length, 2);
  // No se junta ninguno ni se tira ninguno: se señalan, cada uno apuntando al
  // otro, y el mensaje deja de decir que está seguro.
  assert.deepEqual(gastos[0].posibleDuplicadoDe, [gastos[1].id]);
  assert.deepEqual(gastos[1].posibleDuplicadoDe, [gastos[0].id]);
  assert.notEqual(r.confianza, "alta");
  assert.ok(r.porque.includes("capturado dos veces"), r.porque);
});

test("dos_gastos_confirmados_del_mismo_mensaje_no_salen_como_un_total_pelon", () => {
  // Y si aun así alguien confirma los dos, el total del día no se enseña solo:
  // sale con el aviso al lado. La app informa; el total no se corrige solo.
  const r = clasificar({
    id: "mA", de: { id: "u4", nombre: "Gera" }, cuando: "2026-09-08T15:00:00.000Z",
    texto: "Se compraron doscientos litros de diésel en la gasolinera de la entrada, tres mil ochocientos pesos.",
    foto: { dataUrl: "data:image/jpeg;base64,ELTICKET", lectura: TICKET_LEIDO },
  });
  const listo = {
    ...r,
    propuestas: r.propuestas.map(p =>
      marcarConfirmacion(p, { estado: "confirmado", quien: YO, cuando: "2026-09-08T18:00:00.000Z" }).propuesta),
  };
  const res = resumenDelDia({ mensajes: [listo], fecha: "2026-09-08" });
  assert.equal(res.posiblesDuplicados.length, 1);
  assert.ok(res.dice.includes("podrían ser el mismo"), res.dice);
  assert.ok(res.dice.includes("capturado dos veces"), res.dice);
});

test("dos_gastos_del_mismo_texto_NO_se_marcan_como_duplicados", () => {
  // Gera dice tres cosas en un párrafo, y a veces dos de ellas son dos gastos
  // de verdad. Marcar eso sería una alarma falsa, y las alarmas falsas enseñan
  // a ignorar las alarmas.
  const r = clasificar({
    ...MSJ_GERA,
    texto: "Se compraron doscientos litros de diésel, tres mil ochocientos pesos. " +
      "También se pagó la comida de la cuadrilla, cuatrocientos pesos.",
  });
  for (const p of r.movimientos) assert.equal(p.posibleDuplicadoDe, undefined);
  assert.equal(r.posiblesDuplicados.length, 0);
});

test("una_hoja_a_la_que_le_faltan_ocho_de_los_once_no_se_va_en_alta", () => {
  // Una foto cortada es lo más común del mundo. Lo poco que se leyó multiplica
  // exacto, y con eso se iba en "alta" con el 70% de la hoja sin ver. Cuadrar
  // tres renglones no dice nada de los ocho que nadie miró.
  const cortada = copiar(HOJA_53).slice(0, 6);
  const r = clasificar({
    id: "m6", de: { id: "u3", nombre: "Fito" }, cuando: "2026-09-08T14:00:00.000Z",
    foto: { dataUrl: "data:image/jpeg;base64,CORTADA", renglones: cortada },
  });
  const hoja = r.movimientos.find(p => p.tipo === "fertirriego");
  assert.equal(hoja.confiable, true);          // lo que se alcanzó a leer sí cuadra
  assert.equal(hoja.seguro, false);            // pero ocho no salieron
  assert.notEqual(r.confianza, "alta");
  assert.ok(hoja.porque.includes("No salieron en la hoja"), hoja.porque);
  // Y el aviso viaja hasta el resumen que va a leer el que riega.
  assert.ok(hoja.resumen.includes("OJO"), hoja.resumen);
});

test("volver_a_clasificar_un_mensaje_ya_confirmado_no_le_borra_la_firma", () => {
  // La pantalla reclasifica un mensaje guardado sin pensarlo. Antes eso rehacía
  // las propuestas desde cero, con la confirmación en null: se perdía quién
  // firmó, el mensaje volvía a la fila, y el mismo gasto se podía registrar una
  // segunda vez. En un archivo cuya regla es que nada de dinero se borra, la
  // firma se borraba sola.
  const m = clasificar(MSJ_GERA);
  const listo = {
    ...m,
    propuestas: m.propuestas.map(p =>
      marcarConfirmacion(p, { estado: "confirmado", quien: YO, cuando: "2026-09-08T16:00:00.000Z" }).propuesta),
  };
  const otraVez = clasificar(listo);
  const est = estadoDeConfirmacion(otraVez);
  assert.equal(est.estado, "confirmado");
  assert.equal(est.quien, "Luis");
  for (const p of otraVez.propuestas) assert.ok(p.confirmacion?.quien, "se borró la firma");
  assert.equal(otraVez.yaClasificado, true);
  assert.equal(pendientesDeConfirmar([otraVez], { ahora: "2026-09-08T18:00:00.000Z" }).cuantos, 0);
});

test("volver_a_clasificar_un_mensaje_cerrado_a_mano_no_lo_reabre", () => {
  // Lo mismo con el que alguien cerró diciendo "no era nada": esa marca vive en
  // el propio mensaje, y reclasificarlo la borraba.
  const raro = clasificar({
    id: "raro", de: { nombre: "Gera" }, cuando: "2026-09-08T15:00:00.000Z",
    foto: { dataUrl: "data:image/jpeg;base64,LOQUESEA" },
  });
  const cerrado = marcarConfirmacion(raro, {
    estado: "rechazado", quien: YO, cuando: "2026-09-08T18:00:00.000Z",
    motivo: "era una foto de la troca, no de un papel",
  }).propuesta;
  const otraVez = clasificar(cerrado);
  assert.equal(otraVez.confirmacion.quien, "Luis");
  assert.equal(estadoDeConfirmacion(otraVez).estado, "rechazado");
});

test("un_movimiento_confirmado_sin_fecha_no_se_cae_del_resumen_en_silencio", () => {
  // No se mete en el día —eso sería inventarle una fecha— pero tampoco
  // desaparece: cuarenta mil pesos confirmados que no están en ningún día son
  // justo lo que el dueño tiene que ver.
  const sinFecha = {
    id: "mL", de: { nombre: "Gera" },
    propuestas: [{
      id: "mL:0", tipo: "gasto", monto: 40000,
      confirmacion: { estado: "confirmado", quien: "Luis", cuando: "2026-09-08T18:00:00.000Z" },
    }],
  };
  const r = resumenDelDia({ mensajes: [sinFecha], fecha: "2026-09-08" });
  assert.equal(r.cuantosMensajes, 0);
  assert.equal(r.gastado, null);              // sigue sin entrar en el total del día
  assert.equal(r.sinFecha.length, 1);
  assert.equal(r.movimientosSinFecha.length, 1);
  assert.equal(r.gastadoSinFecha, 40000);
  assert.ok(r.dice.includes("sin fecha"), r.dice);
});

test("el_gasto_se_fecha_el_dia_del_mensaje_no_el_dia_en_que_alguien_lo_revisa", () => {
  // Un mensaje del viernes revisado el martes quedaba fechado el martes: tres
  // días de corrimiento en un archivo que se cuida de no inventar fechas.
  const viernes = clasificarMensaje({
    mensaje: {
      id: "mV", de: { id: "u4", nombre: "Gera" }, cuando: "2026-09-05T18:00:00.000Z",
      texto: "Se compró diésel en la gasolinera, tres mil ochocientos pesos.",
    },
    personas: GENTE, parcelas: PARCELAS, hoy: "2026-09-08",
  });
  const g = viernes.movimientos.find(p => p.tipo === "gasto");
  assert.equal(g.fecha, "2026-09-05");

  // Y el ticket cuya fecha no se leyó se queda con el día del mensaje, no con
  // el día en que alguien lo abrió.
  const conTicket = clasificarMensaje({
    mensaje: {
      id: "mV2", de: { nombre: "Gera" }, cuando: "2026-09-05T18:00:00.000Z",
      foto: {
        dataUrl: "data:image/jpeg;base64,ELTICKET",
        lectura: { ok: true, tipo: "ticket", campos: { emisor: "Ferretería", total: 500 }, noSeLeyo: ["fecha"] },
      },
    },
    personas: GENTE, parcelas: PARCELAS, hoy: "2026-09-08",
  });
  assert.equal(conTicket.movimientos[0].fecha, "2026-09-05");
});

test("el_mensaje_cerrado_a_mano_deja_de_pedir_trabajo_en_el_resumen_del_dia", () => {
  // Dos funciones del mismo archivo contestaban distinto sobre el mismo
  // mensaje, y la que se equivocaba era la que le habla al dueño: le seguía
  // pidiendo un trabajo que ya estaba hecho.
  const raro = clasificar({
    id: "raro", de: { nombre: "Gera" }, cuando: "2026-09-08T15:00:00.000Z",
    foto: { dataUrl: "data:image/jpeg;base64,LOQUESEA" },
  });
  const cerrado = marcarConfirmacion(raro, {
    estado: "rechazado", quien: YO, cuando: "2026-09-08T18:00:00.000Z",
    motivo: "era una foto de la troca, no de un papel",
  }).propuesta;

  const est = estadoDeConfirmacion(cerrado);
  const r = resumenDelDia({ mensajes: [cerrado], fecha: "2026-09-08" });
  assert.equal(est.porIdentificar, false);
  assert.equal(r.porIdentificar.length, 0);
  assert.equal(r.rechazados.length, 1);
  assert.ok(!r.dice.includes("por identificar"), r.dice);
});

test("cada_motivo_de_rechazo_se_le_cuelga_a_quien_lo_dijo", () => {
  // El nombre salía de la confirmación más reciente y el motivo de la primera
  // propuesta: cuando no eran la misma persona, se le colgaba a uno lo que dijo
  // el otro. En una familia, ésa es la línea que arma el pleito.
  const MIGUE = { id: "u7", nombre: "Migue" };
  const uno = marcarConfirmacion({ id: "p1", tipo: "gasto" }, {
    estado: "rechazado", quien: YO, cuando: "2026-09-08T18:00:00.000Z",
    motivo: "ya se había capturado el lunes",
  }).propuesta;
  const dos = marcarConfirmacion({ id: "p2", tipo: "gasto" }, {
    estado: "rechazado", quien: MIGUE, cuando: "2026-09-08T19:00:00.000Z",
    motivo: "eso fue gasto personal mío",
  }).propuesta;

  const est = estadoDeConfirmacion({ propuestas: [uno, dos] });
  assert.equal(est.estado, "rechazado");
  assert.ok(!/Migue[^;]*lunes/.test(est.dice), est.dice);   // Migue nunca dijo eso
  assert.ok(est.dice.includes("Luis — ya se había capturado el lunes"), est.dice);
  assert.ok(est.dice.includes("Migue — eso fue gasto personal mío"), est.dice);
});

test("una_hora_que_no_se_entiende_no_es_una_hora", () => {
  // Con un "ayer en la tarde" en el campo de la hora, el origen se daba por
  // completo y la pantalla le enseñaba "Lo mandó Gera el null" a un capataz.
  const o = origenDe({ id: "mE", de: { nombre: "Gera" }, cuando: "ayer en la tarde" });
  assert.equal(o.completo, false);
  assert.equal(o.dia, null);
  assert.equal(o.cuandoSeEntiende, false);
  assert.equal(o.cuando, "ayer en la tarde");        // se queda tal como llegó
  assert.ok(!o.dice.includes("null"), o.dice);
  assert.ok(o.dice.includes("no se puede aclarar después"), o.dice);
});

test("quien_mando_la_hoja_de_fertirriego_sale_del_mensaje_no_de_una_constante", () => {
  // La indicación de fertirriego es la que manda a alguien a echar producto en
  // una parcela. Decía "de Fito" aunque la hubiera mandado Gera, porque el
  // nombre venía quemado y nadie miraba el remitente, que estaba a un renglón.
  const r = clasificar({
    id: "m7", de: { id: "u4", nombre: "Gera", rol: "encargado" },
    cuando: "2026-09-08T14:00:00.000Z",
    foto: { dataUrl: "data:image/jpeg;base64,LAHOJA", renglones: HOJA_53 },
  });
  const hoja = r.movimientos.find(p => p.tipo === "fertirriego");
  assert.equal(hoja.origen.de, "Gera");
  assert.equal(hoja.indicacion.deQuien, "Gera");
  assert.notEqual(hoja.indicacion.deQuien, "Fito");

  // Y si no se sabe quién la mandó, no se pone un nombre: se pide.
  const anonima = clasificar({
    id: "m7b", cuando: "2026-09-08T14:00:00.000Z",
    foto: { dataUrl: "data:image/jpeg;base64,LAHOJA", renglones: HOJA_53 },
  });
  const suelta = anonima.movimientos.find(p => p.tipo === "fertirriego");
  assert.equal(suelta.indicacion.deQuien, null);
  assert.ok(suelta.falta.includes("quién la mandó"));
});

test("los_renglones_del_estado_de_cuenta_no_se_quedan_en_el_camino", () => {
  // Quedaba un estado de cuenta declarado "seguro" sobre el que ya nadie podía
  // correr la comprobación renglón por renglón, porque los renglones se habían
  // quedado en el camino y ni eso se decía.
  const r = clasificar({
    id: "m8", de: { nombre: "Luis" }, cuando: "2026-09-08T15:00:00.000Z",
    foto: {
      dataUrl: "data:image/jpeg;base64,ELESTADO",
      lectura: {
        ok: true, tipo: "estado_cuenta",
        campos: { banco: "BBVA", saldoInicial: 10000, saldoFinal: 12000 },
        renglones: [
          ["01/08/2026", "DEPOSITO", "5000", "", "15000"],
          ["02/08/2026", "PAGO", "", "3000", "12000"],
        ],
        noSeLeyo: [],
      },
    },
  });
  const e = r.movimientos.find(p => p.tipo === "estado_cuenta");
  assert.equal(e.renglones.length, 2);
  assert.equal(e.porComprobar, true);
  assert.equal(e.seguro, false);            // tres saldos no hacen un estado bueno
  assert.notEqual(r.confianza, "alta");
  assert.ok(e.porque.includes("saldo anterior + abono − cargo"), e.porque);

  // Y si el papel no trajo los renglones, se dice que faltan.
  const pelon = clasificar({
    id: "m8b", de: { nombre: "Luis" }, cuando: "2026-09-08T15:00:00.000Z",
    foto: {
      dataUrl: "data:image/jpeg;base64,ELESTADO",
      lectura: {
        ok: true, tipo: "estado_cuenta",
        campos: { banco: "BBVA", saldoInicial: 10000, saldoFinal: 12000 },
        noSeLeyo: [],
      },
    },
  });
  const sinRenglones = pelon.movimientos.find(p => p.tipo === "estado_cuenta");
  assert.deepEqual(sinRenglones.renglones, []);
  assert.ok(sinRenglones.falta.includes("los movimientos renglón por renglón"));
});
