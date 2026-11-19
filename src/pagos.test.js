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
