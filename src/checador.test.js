import { test } from "node:test";
import assert from "node:assert/strict";
import { efectosDe } from "./eventos.js";
import {
  emitirCredencial, textoDeCredencial, leerCredencial, quienEsPorQR, quienEsPorPin, marcar, marcaQueFalto, cancelarMarca, cambiarHoraDeMarca, voltearMarca,
  jornadasDe, resumenDelDia, presenciasDe, siguienteMarca, marcasDe, horasYMinutos, NAVE,
} from "./checador.js";

const CHECADOR = { id: "enc1", nombre: "Encargado", rol: "encargado" };
const emitir = (t) => emitirCredencial(t, { cuando: "2026-11-01T00:00:00Z", quien: CHECADOR });
const ANA = emitir({ id: "t-ana", nombre: "ANA PRUEBA", pin: "4821", sueldo_dia: 350 });
const BETO = emitir({ id: "t-beto", nombre: "BETO PRUEBA", pin: "9033" });
const GENTE = [ANA, BETO];
const D = "2026-11-19";
const a = (hhmm) => `${D}T${hhmm}:00-06:00`;
const checa = (eventos, t, hhmm, mas = {}) => marcar({ eventos, trabajador: t, via: "qr", ahora: a(hhmm), fecha: D, quien: CHECADOR, ...mas });
const dia = (...pasos) => { let evs = []; for (const [t, h] of pasos) { const r = checa(evs, t, h); if (r.ok) evs = [...evs, r.evento]; } return evs; };

test("la_credencial_no_lleva_ni_el_nombre_ni_el_pin_ni_el_sueldo", () => {
  const texto = textoDeCredencial(ANA);
  assert.ok(!texto.includes("ANA") && !texto.includes("4821") && !texto.includes("350"));
  assert.deepEqual(leerCredencial(texto), { id: "t-ana", codigo: ANA.credencial.codigo });
  assert.equal(leerCredencial("https://verificacfdi.facturaelectronica.sat.gob.mx/?id=1"), null, "el QR de una factura no es credencial");
  assert.equal(textoDeCredencial({ id: "x" }), "", "sin credencial emitida no hay QR");
});

test("una_credencial_perdida_deja_de_servir_al_emitir_otra", () => {
  const vieja = textoDeCredencial(ANA);
  const ana2 = emitirCredencial(ANA, { cuando: "2026-11-10T00:00:00Z", quien: CHECADOR });
  assert.notEqual(ana2.credencial.codigo, ANA.credencial.codigo);
  assert.equal(ana2.credencialesAnteriores.length, 1);
  const r = quienEsPorQR(vieja, [ana2]);
  assert.equal(r.ok, false); assert.match(r.dice, /ya no sirve/);
  assert.equal(quienEsPorQR(textoDeCredencial(ana2), [ana2]).trabajador.id, "t-ana");
  assert.equal(quienEsPorQR(textoDeCredencial(ana2), [{ ...ana2, activo: false }]).ok, false, "dado de baja no checa");
});

test("el_pin_sirve_de_respaldo_pero_no_si_dos_personas_traen_el_mismo", () => {
  assert.equal(quienEsPorPin("4821", GENTE).trabajador.id, "t-ana");
  assert.equal(quienEsPorPin("0000", GENTE).ok, false);
  assert.match(quienEsPorPin("4821", [...GENTE, { id: "t-c", nombre: "C", pin: "4821" }]).dice, /dos personas/);
  assert.equal(quienEsPorPin("48", GENTE).ok, false);
});

test("la_primera_lectura_es_entrada_la_siguiente_salida_y_la_repetida_no_cuenta", () => {
  let evs = [];
  const e1 = checa(evs, ANA, "06:02"); assert.equal(e1.sentido, "entrada"); evs.push(e1.evento);
  const rep = checa(evs, ANA, "06:03");
  assert.equal(rep.ok, false); assert.ok(rep.repetida); assert.match(rep.dice, /Ya quedó tu entrada de las 6:02/);
  const s1 = checa(evs, ANA, "14:30"); assert.equal(s1.sentido, "salida"); evs.push(s1.evento);
  assert.equal(checa(evs, ANA, "15:10").sentido, "entrada", "regresar en la tarde es otra entrada");
  assert.equal(marcasDe(evs, { trabajadorId: "t-ana", fecha: D }).length, 2);
});

test("entrar_al_rancho_no_carga_costo_a_ninguna_parcela", () => {
  const evs = dia([ANA, "06:00"], [ANA, "14:00"]);
  const efectos = efectosDe(evs);
  assert.deepEqual(efectos.map(f => f.clase), ["llegada", "retiro"]);
  assert.ok(efectos.every(f => !("parcelaId" in f) && !("costo" in f) && !("monto" in f)));
  assert.ok(efectos.every(f => evs.some(e => e.id === f.ev)), "cada efecto apunta a su marca");
});

test("la_jornada_suma_solo_los_tramos_cerrados", () => {
  const evs = dia([ANA, "06:00"], [ANA, "12:00"], [ANA, "13:00"], [ANA, "15:30"], [BETO, "07:15"]);
  const js = jornadasDe(evs, { fecha: D, hoy: D, ahora: a("16:00") });
  const ana = js.find(j => j.trabajadorId === "t-ana"), beto = js.find(j => j.trabajadorId === "t-beto");
  assert.equal(ana.minutos, 360 + 150); assert.ok(ana.completa); assert.equal(ana.tramos.length, 2);
  assert.equal(horasYMinutos(ana.minutos), "8 h 30 min");
  assert.ok(beto.adentro && !beto.completa); assert.equal(beto.minutos, 0); assert.equal(beto.minutosCorriendo, 525);
});

test("una_entrada_sin_salida_de_ayer_no_vale_ocho_horas_vale_no_se_sabe", () => {
  const evs = dia([ANA, "06:00"]);
  const [j] = jornadasDe(evs, { fecha: D, hoy: "2026-11-20", ahora: "2026-11-20T15:00:00Z" });
  assert.equal(j.adentro, false); assert.equal(j.minutos, 0); assert.equal(j.completa, false);
  assert.match(j.avisos[0], /no checó salida/);
  assert.equal(horasYMinutos(j.tramos[0].minutos), "no se sabe");
});

test("cerrar_a_mano_la_salida_que_falto_pide_motivo_y_queda_dicho_que_fue_a_mano", () => {
  const evs = dia([ANA, "06:00"]);
  const base = { trabajadorId: "t-ana", sentido: "salida", cuando: a("14:00"), fecha: D, quien: CHECADOR, capturado: "2026-11-20T15:00:00Z" };
  assert.equal(marcaQueFalto({ ...base, motivo: "" }).ok, false);
  assert.equal(marcaQueFalto({ ...base, motivo: "x", quien: { id: "t-ana", rol: "trabajador" } }).ok, false, "nadie se pone su propia salida");
  assert.equal(marcaQueFalto({ ...base, motivo: "x", cuando: "2026-11-21T00:00:00Z" }).ok, false, "ni en el futuro");
  const r = marcaQueFalto({ ...base, motivo: "se le olvidó checar al salir" });
  assert.ok(r.ok); assert.equal(r.evento.datos.via, "correccion"); assert.notEqual(r.evento.capturado, r.evento.cuando);
  const [j] = jornadasDe([...evs, r.evento], { fecha: D, hoy: "2026-11-20" });
  assert.equal(j.minutos, 480); assert.ok(j.completa); assert.ok(j.aMano);
});

test("cancelar_una_marca_equivocada_recalcula_la_jornada_y_la_marca_sigue_en_el_historial", () => {
  const evs = dia([ANA, "06:00"], [ANA, "10:00"], [ANA, "14:00"]);          // la de las 10 fue sin querer: quedó entrada-salida-entrada
  const c = cancelarMarca(evs[1], { motivo: "pasó la credencial sin querer", quien: CHECADOR, cuando: a("15:00") });
  let todos = [evs[0], c.evento, evs[2]];
  assert.match(jornadasDe(todos, { fecha: D, hoy: "2026-11-20" })[0].avisos[0], /Dos entradas seguidas/, "no se acomoda sola: lo dice");
  const v = voltearMarca(evs[2], { motivo: "la de las 2 era su salida", quien: CHECADOR, cuando: a("15:01") });
  todos = [evs[0], c.evento, v.anterior, v.nuevo];
  const [j] = jornadasDe(todos, { fecha: D, hoy: D });
  assert.equal(j.minutos, 480); assert.ok(j.completa);
  assert.equal(todos.length, 4, "nada se borró"); assert.equal(todos[1].cancelado.motivo, "pasó la credencial sin querer");
});

test("corregir_la_hora_de_una_marca_no_duplica_la_marca", () => {
  const evs = dia([ANA, "06:00"], [ANA, "14:00"]);
  const c = cambiarHoraDeMarca(evs[1], a("15:00"), { motivo: "el reloj de la tableta estaba mal", quien: CHECADOR, cuando: a("16:00") });
  const todos = [evs[0], c.anterior, c.nuevo];
  const [j] = jornadasDe(todos, { fecha: D, hoy: D });
  assert.equal(j.minutos, 540); assert.equal(j.tramos.length, 1); assert.ok(j.aMano);
});

test("la_llegada_directa_a_campo_la_registra_un_encargado_y_dice_donde_y_quien_autorizo", () => {
  const lugar = { tipo: "rancho", id: "r2", nombre: "RANCHO DE PRUEBA" };
  assert.equal(checa([], ANA, "06:30", { lugar, quien: { id: "t-ana", nombre: "Ana", rol: "trabajador" } }).ok, false);
  const r = checa([], ANA, "06:30", { lugar });
  assert.ok(r.ok); assert.equal(r.evento.datos.via, "remoto"); assert.equal(r.evento.datos.autorizo, "Encargado"); assert.equal(r.evento.datos.lugar.id, "r2");
  assert.equal(checa([r.evento], ANA, "06:35").repetida, true, "y si luego pasa por la nave no se duplica la asistencia");
});

test("dos_aparatos_que_registran_a_la_misma_persona_sin_senal_no_le_dan_dos_asistencias", () => {
  const enNave = checa([], ANA, "06:00").evento;
  const enCampo = checa([], ANA, "06:04", { lugar: { tipo: "rancho", id: "r2", nombre: "R2" } }).evento;   // el otro aparato no sabía de la primera
  const juntos = [enNave, enCampo, { ...enNave }];                                                        // y además un reintento de subida
  assert.equal(presenciasDe(juntos).size, 1, "un día de presencia, no dos");
  const [j] = jornadasDe(juntos, { fecha: D, hoy: D });
  assert.match(j.avisos[0], /Dos entradas seguidas/, "y la jornada lo dice en vez de esconderlo");
});

test("el_dia_de_un_vistazo_separa_adentro_ya_se_fue_no_ha_llegado_y_por_revisar", () => {
  const CARO = { id: "t-caro", nombre: "CARO PRUEBA" };
  const evs = dia([ANA, "06:00"], [ANA, "14:00"], [BETO, "06:10"]);
  const r = resumenDelDia(evs, [...GENTE, CARO, { id: "t-baja", nombre: "BAJA", activo: false }], { fecha: D, hoy: D, ahora: a("15:00") });
  assert.deepEqual(r.adentro.map(j => j.trabajadorId), ["t-beto"]);
  assert.deepEqual(r.salieron.map(j => j.trabajadorId), ["t-ana"]);
  assert.deepEqual(r.sinLlegar.map(t => t.id), ["t-caro"]);
  assert.equal(siguienteMarca([], a("06:00")).hacer, "entrada");
  assert.equal(NAVE.tipo, "nave");
});
