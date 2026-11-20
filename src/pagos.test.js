import { test } from "node:test";
import assert from "node:assert/strict";
import { cancelarEvento } from "./eventos.js";
import { registrarAusencia, justificarFalta, ausenciasDe, semanaDe, leToca, cuentasDeCuadrillas, registrarPago, pagosA, saldoDe, emitirRecibo, recibosDe, reciboAlDia, reconocerHoras, cuentaDeHoras, rastroDe, LEYENDA_CUADRILLA } from "./pagos.js";
import { manoDeObra, asignar, TIPO_DECISION } from "./cuadrillas.js";
import { marcar } from "./checador.js";
import { nuevoEvento } from "./eventos.js";

const ADMIN = { id: "u1", nombre: "Luis", rol: "admin" }, ENC = { id: "enc1", nombre: "Encargado", rol: "encargado" };
const L = "2026-11-16", S = "2026-11-21", D = "2026-11-22", HOY = "2026-11-21";   // lunes a sábado; el 22 es domingo
const ANA = { id: "t-ana", nombre: "Ana", sueldo_dia: 400, historialSueldo: [{ desde: "2026-01-01", sueldo_dia: 400, anterior: 400 }] };
const BETO = { ...ANA, id: "t-beto", nombre: "Beto", diasAsistencia: [1, 2, 3, 4, 5] };   // estudia los sábados
let n = 0; const az = () => (++n) / 1e6; const c = (f, h = "12:00") => `${f}T${h}:00-06:00`;
const dev = (t, fecha, monto = 400, minutos = 480) => ({ trabajadorId: t.id, fecha, monto, minutos, provisional: false, partes: [{ evs: [`m-${fecha}`] }] });
const aus = (mas) => { const r = registrarAusencia({ trabajadorId: "t-ana", quien: ENC, cuando: c(HOY), azar: az(), ...mas }); assert.ok(r.ok, r.dice); return r.eventos; };
const semana = (t, mas = {}) => semanaDe({ trabajador: t, desde: L, hasta: D, hoy: HOY, ...mas });

// ── Permisos, descansos y faltas ──
test("un_permiso_o_descanso_autorizado_se_paga_el_dia_y_lleva_causa_y_quien_autorizo", () => {
  assert.equal(registrarAusencia({ trabajadorId: "t-ana", desde: L, clase: "permiso", causa: "cita médica", quien: ENC, cuando: c(HOY) }).ok, false, "sin quién autorizó no");
  assert.equal(registrarAusencia({ trabajadorId: "t-ana", desde: L, clase: "permiso", autorizo: "Rodolfo", quien: ENC, cuando: c(HOY) }).ok, false, "sin causa no");
  const evs = aus({ desde: "2026-11-17", hasta: "2026-11-18", clase: "permiso", causa: "cita médica", autorizo: "Rodolfo" });
  assert.equal(evs.length, 2, "un registro por día");
  const s = semana(ANA, { devengado: [dev(ANA, L)], ausencias: evs });
  assert.equal(s.corresponde, 1200, "un día trabajado y dos de permiso pagado"); assert.equal(s.pagadosSinTrabajar, 2);
  assert.equal(s.dias[1].autorizo, "Rodolfo"); assert.equal(s.dias[1].causa, "cita médica");
});

test("una_falta_sin_justificar_no_se_paga_y_si_despues_se_justifica_se_corrige_sin_borrar_lo_anterior", () => {
  const [falta] = aus({ desde: "2026-11-17", clase: "falta" });
  assert.equal(semana(ANA, { ausencias: [falta] }).corresponde, 0); assert.equal(semana(ANA, { ausencias: [falta] }).sinPago, 1);
  assert.equal(justificarFalta(falta, { causa: "trajo receta", autorizo: "Migue", quien: ENC, cuando: c(HOY) }).ok, false, "hay que decidir si se paga");
  const r = justificarFalta(falta, { causa: "trajo receta del doctor", paga: true, autorizo: "Migue", quien: ENC, cuando: c(HOY), azar: az() });
  assert.ok(r.ok);
  const todo = [r.anterior, r.nuevo];
  assert.equal(ausenciasDe(todo).length, 1, "cuenta la corrección, no las dos");
  assert.equal(semana(ANA, { ausencias: ausenciasDe(todo) }).corresponde, 400);
  const rastro = rastroDe(todo, r.nuevo.id);
  assert.deepEqual(rastro.map(e => e.datos.clase), ["falta", "justificada"], "y se puede ver que primero fue falta"); assert.equal(rastro[0].estado, "corregido");
});

test("quien_no_vino_y_nadie_ha_dicho_por_que_no_es_falta_todavia_es_una_pregunta", () => {
  const s = semana(ANA, { devengado: [dev(ANA, L)] });
  assert.equal(s.corresponde, 400); assert.deepEqual(s.sinRegistro, ["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"]);
  assert.equal(semana(ANA, { hoy: D }).dias[6].estado, "no_le_toca", "el domingo no se espera a nadie");
});

test("quien_tiene_permiso_de_no_venir_los_sabados_no_aparece_con_falta_el_sabado", () => {
  assert.equal(leToca(BETO, S), false); assert.equal(leToca(ANA, S), true);
  const s = semana(BETO, { devengado: [L, "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"].map(f => dev(BETO, f)) });
  assert.deepEqual(s.sinRegistro, []); assert.equal(s.dias[5].estado, "no_le_toca"); assert.equal(s.corresponde, 2000);
  assert.equal(semana(BETO, { devengado: [dev(BETO, S)] }).dias[5].monto, 400, "y si un sábado sí viene, se le paga");
});

// ── Salidas anticipadas: no hay descuento automático ──
const ENT = (t, fecha, hora) => marcar({ eventos: [], trabajador: t, via: "pin", ahora: c(fecha, hora), fecha, quien: ENC, azar: az() });
test("salir_antes_no_descuenta_nada_solo_queda_por_revisar_y_la_decision_la_toma_una_persona", () => {
  let evs = [];
  const m1 = marcar({ eventos: evs, trabajador: ANA, via: "pin", ahora: c(L, "07:00"), fecha: L, quien: ENC, azar: az() }); evs = [...evs, m1.evento];
  evs = [...evs, asignar({ trabajadorIds: ["t-ana"], parcelaId: "p7", actividad: "Riego", desde: c(L, "07:00"), fecha: L, quien: ENC, azar: az() }).evento];
  const m2 = marcar({ eventos: evs, trabajador: ANA, via: "pin", ahora: c(L, "11:00"), fecha: L, quien: ENC, azar: az() }); evs = [...evs, m2.evento];
  const r = manoDeObra(evs, [ANA], { desde: L, hasta: L, hoy: HOY, ahora: c(HOY, "18:00") });
  assert.equal(r.total, 400, "sin decisión, el día se paga completo"); assert.equal(r.salidasPorRevisar.length, 1); assert.equal(r.salidasPorRevisar[0].faltaron, 240);
  const decide = (pago) => nuevoEvento({ tipo: TIPO_DECISION, cuando: c(L), fecha: L, capturado: c(HOY), quien: ADMIN, azar: az(), datos: { trabajadorId: "t-ana", situacion: "abandono", pago, motivo: "se fue sin avisar" } });
  const con = (pago) => manoDeObra([...evs, decide(pago)], [ANA], { desde: L, hasta: L, hoy: HOY, ahora: c(HOY, "18:00") });
  assert.equal(con("medio").total, 200); assert.equal(con("horas").total, 200, "4 de 8 horas"); assert.equal(con("ninguno").total, 0); assert.equal(con("completo").total, 400);
  assert.equal(con("medio").salidasPorRevisar.length, 0, "ya decidido, deja de estar por revisar");
  assert.equal(con("medio").partes[0].parcelaId, "p7", "y a la parcela le llega lo que de verdad se pagó");
  assert.ok(con("medio").partes[0].evs.length >= 4, "la decisión queda en el rastro de ese importe");
});

// ── Cuadrillas y temporales ──
const parte = (mas) => ({ clase: "pago", cuadrillaId: "cq1", cuadrilla: "Los de Villa", responsable: "Don Chuy", independiente: false, persona: "Ana", fecha: L, monto: 350, ...mas });
test("a_la_cuadrilla_se_le_lleva_una_sola_cuenta_la_de_su_responsable_y_al_temporal_independiente_la_suya", () => {
  const cuentas = cuentasDeCuadrillas([parte({}), parte({ persona: "Beto" }), parte({ fecha: "2026-11-17" }), parte({ independiente: true, cuadrillaId: null, cuadrilla: "Temporales", responsable: "", persona: "Chema López", monto: 300 })], { desde: L, hasta: D });
  assert.equal(cuentas.length, 2);
  const cq = cuentas.find(x => x.a.tipo === "cuadrilla"), ind = cuentas.find(x => x.a.tipo === "independiente");
  assert.equal(cq.corresponde, 1050); assert.equal(cq.responsable, "Don Chuy"); assert.deepEqual(cq.integrantes.sort(), ["Ana", "Beto"]);
  assert.equal(ind.a.nombre, "Chema López"); assert.equal(ind.corresponde, 300);
});

test("entregarle_al_responsable_no_marca_pagado_a_cada_integrante_y_deja_el_saldo_a_la_vista", () => {
  const [cq] = cuentasDeCuadrillas([parte({}), parte({ persona: "Beto" })], { desde: L, hasta: D });
  assert.equal(registrarPago({ a: cq.a, desde: L, hasta: D, monto: 500, medio: "efectivo", quien: ADMIN, cuando: c(HOY), fecha: HOY }).ok, false, "falta quién recibió");
  assert.equal(registrarPago({ a: cq.a, desde: L, hasta: D, monto: 500, medio: "efectivo", recibe: "Don Chuy", quien: ENC, cuando: c(HOY), fecha: HOY }).ok, false, "un pago lo registra un administrador");
  const p = registrarPago({ a: cq.a, desde: L, hasta: D, monto: 500, medio: "efectivo", recibe: "Don Chuy", comprobante: "archivo:abc.jpg", corresponde: 700, quien: ADMIN, cuando: c(HOY), fecha: HOY, azar: az() });
  assert.ok(p.ok); assert.equal(p.avisos.length, 0);
  const s = saldoDe({ corresponde: cq.corresponde, pagos: pagosA([p.evento], cq.a, { desde: L, hasta: D }) });
  assert.equal(s.entregado, 500); assert.equal(s.pendiente, 200); assert.equal(s.estado, "parcial");
  assert.ok(!("pagado" in cq.renglones[0]), "la app no sabe —ni dice— que a Ana ya le pagaron");
  const r = emitirRecibo({ eventos: [p.evento], a: cq.a, clase: "cuadrilla", desde: L, hasta: D, conceptos: cq.renglones.map(x => ({ fecha: x.fecha, que: x.persona, monto: x.monto })), saldo: s, pagos: [p.evento], responsable: "Don Chuy", quien: ADMIN, cuando: c(HOY), fecha: HOY, azar: az() });
  assert.equal(r.evento.datos.leyenda, LEYENDA_CUADRILLA); assert.match(r.evento.datos.leyenda, /No acredita el pago individual/);
});

test("un_pago_no_genera_costo_y_cancelarlo_regresa_el_pendiente", () => {
  const a = { tipo: "trabajador", id: "t-ana", nombre: "Ana" };
  const p = registrarPago({ a, desde: L, hasta: D, monto: 1200, medio: "transferencia", comprobante: "archivo:x.jpg", quien: ADMIN, cuando: c(HOY), fecha: HOY, azar: az() }).evento;
  assert.equal(saldoDe({ corresponde: 1200, pagos: pagosA([p], a, { desde: L, hasta: D }) }).estado, "pagado");
  const can = cancelarEvento(p, { motivo: "se capturó dos veces", quien: ADMIN, cuando: c(HOY) }).evento;
  assert.equal(saldoDe({ corresponde: 1200, pagos: pagosA([can], a, { desde: L, hasta: D }) }).pendiente, 1200);
  assert.equal(saldoDe({ corresponde: 1200, descuentos: 200, pagos: [] }).neto, 1000, "lo retenido o abonado a su préstamo no se le entrega");
  const deMas = registrarPago({ a, desde: L, hasta: D, monto: 1500, medio: "efectivo", corresponde: 1200, quien: ADMIN, cuando: c(HOY), fecha: HOY });
  assert.ok(deMas.ok); assert.equal(deMas.avisos.length, 2, "pagar de más no se bloquea, pero se avisa; y sin comprobante también");
});

// ── Recibos ──
test("un_recibo_emitido_no_se_modifica_si_algo_cambia_se_emite_otro_y_el_anterior_se_queda", () => {
  const a = { tipo: "trabajador", id: "t-ana", nombre: "Ana" }; const conceptos = [{ fecha: L, que: "Día trabajado", monto: 400, como: "pago por día" }];
  const s1 = saldoDe({ corresponde: 400, pagos: [] });
  const r1 = emitirRecibo({ eventos: [], a, clase: "planta", desde: L, hasta: D, conceptos, saldo: s1, quien: ADMIN, cuando: c(HOY), fecha: HOY, azar: az() });
  assert.ok(r1.ok); assert.equal(r1.evento.datos.version, 1); assert.match(r1.evento.datos.leyenda, /No es un CFDI de nómina/);
  assert.equal(emitirRecibo({ eventos: [r1.evento], a, clase: "planta", desde: L, hasta: D, conceptos, saldo: s1, quien: ADMIN, cuando: c(HOY), fecha: HOY }).ok, false, "otro recibo de la misma semana pide decir qué cambió");
  const s2 = saldoDe({ corresponde: 800, pagos: [] });
  assert.equal(reciboAlDia(r1.evento, s2).alDia, false, "si lo calculado cambió, se avisa; el recibo no se cambia solo");
  const r2 = emitirRecibo({ eventos: [r1.evento], a, clase: "planta", desde: L, hasta: D, conceptos: [...conceptos, { fecha: "2026-11-17", que: "Permiso autorizado", monto: 400 }], saldo: s2, motivo: "se registró un permiso del martes", quien: ADMIN, cuando: c(HOY), fecha: HOY, azar: az() });
  assert.equal(r2.evento.datos.version, 2); assert.equal(r2.evento.datos.sustituye, 1); assert.equal(r2.evento.origen, r1.evento.id);
  const hist = recibosDe([r1.evento, r2.evento], a, { desde: L, hasta: D });
  assert.equal(hist.length, 2); assert.equal(hist[0].datos.saldo.corresponde, 400, "la versión 1 sigue diciendo lo que decía");
  assert.equal(emitirRecibo({ eventos: [], a, clase: "planta", desde: L, hasta: D, conceptos: [], saldo: s1, quien: ADMIN, cuando: c(HOY), fecha: HOY }).ok, false);
});

// ── Horas adicionales ──
test("las_horas_adicionales_registradas_no_estan_reconocidas_ni_saldadas_por_estar_anotadas", () => {
  const ad = [{ trabajadorId: "t-ana", fecha: L, minutos: 90 }, { trabajadorId: "t-ana", fecha: "2026-11-18", minutos: 60 }, { trabajadorId: "t-beto", fecha: L, minutos: 30 }];
  const antes = cuentaDeHoras(ad, [], { trabajadorId: "t-ana", desde: L, hasta: D });
  assert.equal(antes.registradas, 150); assert.equal(antes.reconocidas, 0); assert.equal(antes.sinTratar, 150); assert.equal(antes.dias.length, 2);
  assert.equal(reconocerHoras({ trabajadorId: "t-ana", desde: L, hasta: D, horas: 2, tratamiento: "se pagan dobles", quien: ADMIN, cuando: c(HOY), fecha: HOY }).ok, false, "sin quién autoriza no");
  const r = reconocerHoras({ trabajadorId: "t-ana", desde: L, hasta: D, horas: 2, tratamiento: "se compensan con el viernes libre", autorizo: "Rodolfo", quien: ADMIN, cuando: c(HOY), fecha: HOY, azar: az() });
  const despues = cuentaDeHoras(ad, [r.evento], { trabajadorId: "t-ana", desde: L, hasta: D });
  assert.equal(despues.reconocidas, 120); assert.equal(despues.sinTratar, 30); assert.equal(despues.reconocimientos[0].autorizo, "Rodolfo");
});

// ── Encargados, vacaciones, abonos a préstamo y el PDF del recibo ──
import { abonar, abonosDe, abonosDeSemana, saldosDePrestamos, paraGuardarPrestamo, activarCalendario, cerrarCalendario, calendarioActivo, porCalendario } from "./pagos.js";
import { juntarEventos, corregirEvento } from "./eventos.js";
test("un_encargado_por_calendario_cobra_su_dia_sin_checar_y_si_checa_manda_el_checador", () => {
  const CHUY = { id: "en1", nombre: "Chuy", sueldo_dia: 600, historialSueldo: [{ desde: "2026-01-01", sueldo_dia: 600, anterior: 600 }], calendario: [{ desde: "2026-11-17" }] };
  const falta = registrarAusencia({ trabajadorId: "en1", desde: "2026-11-19", clase: "falta", quien: ADMIN, cuando: c(HOY), azar: az() }).eventos;
  const s = semanaDe({ trabajador: CHUY, desde: L, hasta: D, hoy: HOY, modo: "calendario", devengado: [dev(CHUY, "2026-11-18", 600, 300)], ausencias: falta });
  assert.deepEqual(s.dias.map(d => d.estado), ["no_le_toca", "calendario", "trabajo", "ausencia_sin_pago", "calendario", "calendario", "futuro"], "el lunes todavía no tenía la modalidad: no se le inventa");
  assert.equal(s.corresponde, 2400); assert.equal(s.porCalendario, 3); assert.equal(s.sinRegistro.length, 0, "a un encargado no se le pregunta por qué no checó");
  const sin = semanaDe({ trabajador: { ...CHUY, calendario: [] }, desde: L, hasta: D, hoy: HOY, modo: "actividades" });
  assert.equal(sin.corresponde, 0); assert.equal(sin.sinRegistro.length, 0);
});

test("el_pago_por_calendario_lo_activa_un_administrador_por_persona_con_fecha_de_inicio_y_quitarlo_no_cambia_lo_anterior", () => {
  const e0 = { id: "en1", nombre: "Chuy" };
  assert.equal(activarCalendario(e0, { desde: "2026-11-10", hoy: "2026-11-10", quien: ENC }).ok, false, "un encargado no se lo activa");
  assert.equal(activarCalendario(e0, { desde: "", hoy: "2026-11-10", quien: ADMIN }).ok, false, "pide la fecha de inicio");
  let e = activarCalendario(e0, { desde: "2026-11-10", hoy: "2026-11-12", quien: ADMIN }).persona;
  assert.equal(e.calendario[0].activo.por, "Luis"); assert.ok(calendarioActivo(e, "2026-11-12"));
  assert.equal(activarCalendario(e, { desde: "2026-11-15", hoy: "2026-11-15", quien: ADMIN }).ok, false, "no se activa dos veces");
  e = cerrarCalendario(e, { hasta: "2026-11-19", hoy: "2026-11-20", quien: ADMIN }).persona;
  assert.equal(calendarioActivo(e, "2026-11-20"), null); assert.equal(porCalendario(e, "2026-11-15"), true); assert.equal(porCalendario(e, "2026-11-20"), false);
  e = activarCalendario(e, { desde: "2026-12-01", hoy: "2026-12-01", quien: ADMIN }).persona;
  assert.equal(e.calendario.length, 2); assert.equal(porCalendario(e, "2026-11-15"), true); assert.equal(porCalendario(e, "2026-11-25"), false); assert.equal(porCalendario(e, "2026-12-02"), true);
});

test("las_vacaciones_se_pagan_en_su_semana_y_piden_quien_las_autorizo_pero_no_una_causa", () => {
  assert.equal(registrarAusencia({ trabajadorId: "t-ana", desde: L, clase: "vacaciones", quien: ENC, cuando: c(HOY) }).ok, false);
  const evs = aus({ desde: L, hasta: "2026-11-17", clase: "vacaciones", autorizo: "Rodolfo" });
  const s = semana(ANA, { ausencias: evs });
  assert.equal(s.corresponde, 800); assert.equal(s.dias[0].clase, "vacaciones");
});

const P = () => [{ id: "p2", trabajadorId: "t-ana", fecha: "2026-10-01", monto: 1000, abonado: 0, estado: "activo" }, { id: "p1", trabajadorId: "t-ana", fecha: "2026-09-01", monto: 300, abonado: 100, estado: "activo" }];
const abona = (prestamos, monto, mas = {}) => abonar({ prestamos, monto, semana: { desde: L, hasta: D }, quien: ADMIN, cuando: c(HOY), fecha: HOY, azar: az(), ...mas });
test("cada_abono_a_un_prestamo_es_un_movimiento_y_el_saldo_se_calcula_de_ellos", () => {
  assert.equal(abona(P(), 500, { quien: ENC }).ok, false, "lo registra quien tiene el permiso");
  assert.equal(abona(P(), 0).ok, false);
  const r = abona(P(), 500);
  assert.ok(r.ok); assert.deepEqual(r.eventos.map(e => [e.datos.prestamoId, e.datos.monto]), [["p1", 200], ["p2", 300]], "primero el más viejo");
  assert.notEqual(r.eventos[0].id, r.eventos[1].id);
  const con = saldosDePrestamos(P(), r.eventos);
  assert.deepEqual(con.map(p => [p.id, p.abonado, p.estado]), [["p2", 300, "activo"], ["p1", 300, "pagado"]]);
  assert.equal(P()[1].abonado, 100, "el préstamo guardado no se tocó");
  assert.deepEqual(paraGuardarPrestamo(con[1]), P()[1], "y al guardarlo (por ejemplo al cancelarlo) no se le escribe lo calculado");
  assert.equal(abona(con, 5000).sobrante, 4300, "no se abona más de lo que debe");
  assert.equal(abona(saldosDePrestamos(P(), abona(P(), 1200).eventos), 10).ok, false, "ya no debe nada");
});

test("dos_aparatos_sin_señal_abonando_al_mismo_prestamo_no_se_pisan_y_el_mismo_abono_dos_veces_es_uno", () => {
  const a = abona(P().slice(0, 1), 200).eventos, b = abona(P().slice(0, 1), 300).eventos;   // cada aparato veía el préstamo en $1,000
  const enUno = juntarEventos(a, b).eventos, enOtro = juntarEventos(b, a).eventos;
  assert.equal(saldosDePrestamos(P(), enUno)[0].abonado, 500, "cuentan los dos");
  assert.deepEqual(saldosDePrestamos(P(), enUno)[0].abonado, saldosDePrestamos(P(), enOtro)[0].abonado, "sin importar en qué orden lleguen");
  const repetido = juntarEventos(enUno, [...a, ...a]).eventos;
  assert.equal(abonosDe(repetido).length, 2, "subir otra vez el mismo abono no lo duplica");
  // Si entre los dos abonan de más, se ve; no se recorta.
  const c2 = abona(P().slice(0, 1), 900).eventos;
  assert.equal(saldosDePrestamos(P(), [...enUno, ...c2])[0]._deMas, 400);
});

test("un_abono_mal_capturado_se_cancela_o_se_corrige_y_queda_su_historial", () => {
  const [ab] = abona(P().slice(0, 1), 200).eventos;
  const can = cancelarEvento(ab, { motivo: "era de otra persona", quien: ADMIN, cuando: c(HOY) }).evento;
  assert.equal(saldosDePrestamos(P(), [can])[0].abonado, 0); assert.equal(can.datos.monto, 200, "lo que decía se conserva");
  const cor = corregirEvento(ab, { datos: { monto: 250 } }, { motivo: "eran 250", quien: ADMIN, cuando: c(HOY), azar: az() });
  assert.equal(saldosDePrestamos(P(), [cor.anterior, cor.nuevo])[0].abonado, 250);
  assert.equal(rastroDe([cor.anterior, cor.nuevo], cor.nuevo.id).length, 2);
});

test("el_abono_cuenta_en_su_semana_sin_importar_si_el_pago_se_registro_antes_o_despues", () => {
  const r = abona(P(), 500);
  assert.equal(abonosDeSemana(r.eventos, P(), "t-ana", L, D).reduce((s, a) => s + a.monto, 0), 500);
  assert.equal(abonosDeSemana(r.eventos, P(), "t-ana", "2026-11-09", "2026-11-15").length, 0, "otra semana no lo ve");
  assert.equal(abonosDeSemana(r.eventos, P(), "t-beto", L, D).length, 0);
  const pagoAntes = registrarPago({ a: { tipo: "trabajador", id: "t-ana", nombre: "Ana" }, desde: L, hasta: D, monto: 1900, medio: "efectivo", comprobante: "x", quien: ADMIN, cuando: c(HOY), fecha: HOY, azar: az() }).evento;
  assert.equal(saldoDe({ corresponde: 2400, descuentos: 500, pagos: [pagoAntes] }).pendiente, 0);
});

test("el_recibo_emitido_guarda_su_pdf_y_cada_version_el_suyo", () => {
  const a = { tipo: "trabajador", id: "t-ana", nombre: "Ana" }, base = { a, clase: "planta", desde: L, hasta: D, conceptos: [{ fecha: L, que: "Día trabajado", monto: 400 }], saldo: { corresponde: 400, entregado: 0, pendiente: 400 }, quien: ADMIN, cuando: c(HOY), fecha: HOY };
  const r1 = emitirRecibo({ ...base, eventos: [], pdf: (x) => `PDF v${x.version}`, azar: az() });
  assert.equal(r1.evento.datos.pdf, "PDF v1");
  const r2 = emitirRecibo({ ...base, eventos: [r1.evento], motivo: "se justificó una falta", pdf: (x) => `PDF v${x.version} sustituye ${x.sustituye}: ${x.motivo}`, azar: az() });
  assert.equal(r2.evento.datos.pdf, "PDF v2 sustituye 1: se justificó una falta"); assert.equal(r1.evento.datos.pdf, "PDF v1", "el anterior no se toca");
  assert.equal("pdf" in emitirRecibo({ ...base, eventos: [], azar: az() }).evento.datos, false);
});

test("quien_fue_marcado_presente_en_el_pase_de_lista_no_sale_como_que_no_vino_pero_tampoco_cobra_solo", () => {
  const r = semanaDe({ trabajador: ANA, desde: L, hasta: D, hoy: HOY, asistencia: [{ trabajadorId: "t-ana", fecha: "2026-11-17", presente: true }, { trabajadorId: "t-ana", fecha: "2026-11-18", presente: false }, { trabajadorId: "t-beto", fecha: "2026-11-19", presente: true }] });
  assert.deepEqual(r.presentesSinDetalle, ["2026-11-17"], "sólo el día que SÍ la marcaron presente, y sólo a ella");
  assert.ok(r.sinRegistro.includes("2026-11-17") && r.sinRegistro.includes("2026-11-18"), "sigue siendo una pregunta abierta");
  assert.equal(r.corresponde, 0, "el pase de lista no dice en qué trabajó: no genera pago ni costo solo");
});
