import { test } from "node:test";
import assert from "node:assert/strict";
import { solicitarPrestamo, autorizarPrestamo, rechazarPrestamo, entregarPrestamo, prestamosDe, saldoInicialDePrestamo, corregirSaldoInicial, prestarDeUnaVez, abonoAcordado, T_SALDO_INICIAL } from "./prestamos.js";
import { flujoDeEfectivo } from "./resultado.js";
import { OPERACION_DE, exigirValidacion } from "./eventos.js";
import { abonar, saldosDePrestamos } from "./pagos.js";
import { cancelarEvento } from "./eventos.js";

const ADMIN = { id: "u1", nombre: "Luis", rol: "admin" }, ENC = { id: "e1", nombre: "Chuy", rol: "encargado" };
const ANA = { id: "t-ana", nombre: "Ana" }; const HOY = "2026-11-19"; let n = 0; const c = () => `2026-11-19T12:${String(++n).padStart(2, "0")}:00-06:00`;
const pide = (monto = 1000) => solicitarPrestamo({ trabajador: ANA, monto, motivo: "medicinas", quien: ENC, cuando: c(), fecha: HOY, azar: n / 1e3 }).evento;
const base = () => ({ quien: ADMIN, cuando: c(), fecha: HOY, azar: n / 1e3 });

test("un_encargado_solicita_pero_solicitar_no_es_deuda_ni_dinero_entregado", () => {
  assert.equal(solicitarPrestamo({ trabajador: ANA, monto: 0, motivo: "x", quien: ENC, cuando: c(), fecha: HOY }).ok, false);
  assert.equal(solicitarPrestamo({ trabajador: ANA, monto: 100, motivo: "", quien: ENC, cuando: c(), fecha: HOY }).ok, false);
  const s = pide(); const [p] = prestamosDe([s]);
  assert.equal(p.estado, "solicitado"); assert.equal(p.solicitado, 1000); assert.equal(p.monto, 0, "no debe nada"); assert.equal(p.entregado, 0); assert.equal(p.solicito, "Chuy");
});

test("solo_quien_tiene_el_permiso_autoriza_y_autorizar_todavia_no_es_entregar", () => {
  const s = pide();
  assert.equal(autorizarPrestamo({ eventos: [s], solicitudId: s.id, monto: 800, autorizo: "Rodolfo", ...base(), quien: ENC }).ok, false, "el encargado que lo pidió no lo autoriza");
  assert.equal(autorizarPrestamo({ eventos: [s], solicitudId: s.id, monto: 800, autorizo: "Rodolfo", ...base(), permitido: false }).ok, false);
  assert.equal(autorizarPrestamo({ eventos: [s], solicitudId: s.id, monto: 800, autorizo: "", ...base() }).ok, false);
  const a = autorizarPrestamo({ eventos: [s], solicitudId: s.id, monto: 800, condiciones: "abonos de 200 por semana", abonoSemanal: 200, autorizo: "Rodolfo", ...base() });
  assert.ok(a.ok, a.dice); assert.equal(a.evento.origen, s.id);
  const [p] = prestamosDe([s, a.evento]);
  assert.equal(p.estado, "autorizado"); assert.equal(p.autorizado, 800); assert.equal(p.porEntregar, 800);
  assert.equal(p.monto, 0, "autorizado no es entregado: todavía no debe nada"); assert.equal(p.autorizacion.abonoSemanal, 200);
  assert.equal(autorizarPrestamo({ eventos: [s, a.evento], solicitudId: s.id, monto: 900, autorizo: "Rodolfo", ...base() }).ok, false, "no se autoriza dos veces");
  assert.equal(abonar({ prestamos: saldosDePrestamos(prestamosDe([s, a.evento]), []), monto: 100, ...base() }).ok, false, "no se abona a lo que no se ha entregado");
});

test("la_entrega_es_lo_que_genera_la_deuda_puede_ser_en_partes_y_nunca_mas_de_lo_autorizado", () => {
  const s = pide(), a = autorizarPrestamo({ eventos: [s], solicitudId: s.id, monto: 800, autorizo: "Rodolfo", ...base() }).evento;
  assert.equal(entregarPrestamo({ eventos: [s], solicitudId: s.id, monto: 500, medio: "efectivo", ...base() }).ok, false, "sin autorización no se entrega");
  assert.equal(entregarPrestamo({ eventos: [s, a], solicitudId: s.id, monto: 500, medio: "efectivo", ...base(), quien: ENC }).ok, false);
  const e1 = entregarPrestamo({ eventos: [s, a], solicitudId: s.id, monto: 500, medio: "efectivo", recibe: "Ana", ...base() });
  assert.ok(e1.ok); assert.match(e1.avisos[0], /sin comprobante/);
  let [p] = prestamosDe([s, a, e1.evento]);
  assert.equal(p.estado, "activo"); assert.equal(p.monto, 500); assert.equal(p.porEntregar, 300);
  assert.equal(entregarPrestamo({ eventos: [s, a, e1.evento], solicitudId: s.id, monto: 400, medio: "efectivo", ...base() }).ok, false, "quedan 300 por entregar, no 400");
  const e2 = entregarPrestamo({ eventos: [s, a, e1.evento], solicitudId: s.id, monto: 300, medio: "transferencia", comprobante: "archivo:x.jpg", ...base() }).evento;
  [p] = prestamosDe([s, a, e1.evento, e2]);
  assert.equal(p.monto, 800); assert.equal(p.porEntregar, 0); assert.equal(p.entregas.length, 2);
});

test("el_saldo_es_lo_entregado_menos_los_abonos_y_cancelar_una_entrega_la_quita_de_la_deuda", () => {
  const s = pide(), a = autorizarPrestamo({ eventos: [s], solicitudId: s.id, monto: 800, autorizo: "Rodolfo", ...base() }).evento;
  const e1 = entregarPrestamo({ eventos: [s, a], solicitudId: s.id, monto: 800, medio: "efectivo", ...base() }).evento;
  const ab = abonar({ prestamos: saldosDePrestamos(prestamosDe([s, a, e1]), []), monto: 300, ...base() });
  assert.ok(ab.ok); assert.equal(ab.eventos[0].datos.prestamoId, s.id);
  const todo = [s, a, e1, ...ab.eventos];
  const [p] = saldosDePrestamos(prestamosDe(todo), todo);
  assert.equal(p.monto, 800); assert.equal(p.abonado, 300); assert.equal(p.estado, "activo");
  const pagado = abonar({ prestamos: [p], monto: 500, ...base() }).eventos;
  assert.equal(saldosDePrestamos(prestamosDe(todo), [...todo, ...pagado])[0].estado, "pagado");
  const cancelada = cancelarEvento(e1, { motivo: "no se le dio", quien: ADMIN, cuando: c() }).evento;
  assert.equal(prestamosDe([s, a, cancelada])[0].estado, "autorizado", "vuelve a estar sólo autorizado; la entrega cancelada se conserva tachada");
});

test("una_solicitud_rechazada_no_genera_nada_y_queda_con_su_motivo", () => {
  const s = pide();
  assert.equal(rechazarPrestamo({ eventos: [s], solicitudId: s.id, motivo: "", ...base() }).ok, false);
  const r = rechazarPrestamo({ eventos: [s], solicitudId: s.id, motivo: "ya tiene uno", ...base() }).evento;
  const [p] = prestamosDe([s, r]);
  assert.equal(p.estado, "rechazado"); assert.equal(p.rechazo.motivo, "ya tiene uno"); assert.equal(p.monto, 0);
  assert.equal(autorizarPrestamo({ eventos: [s, r], solicitudId: s.id, monto: 100, autorizo: "x", ...base() }).ok, false);
});

// La nómina en papel del rancho (22 nov) descontaba cada semana préstamos que se dieron antes de la app («500 pend»).
test("lo_que_un_trabajador_ya_debia_al_arrancar_se_abona_igual_y_no_es_dinero_que_salio", () => {
  const sin = { trabajador: ANA, monto: 500, fechaCorte: "2026-11-14", responsable: "Miguel", ...base() };
  assert.equal(saldoInicialDePrestamo({ ...sin, quien: ENC }).ok, false, "un encargado no crea una deuda");
  assert.equal(saldoInicialDePrestamo({ ...sin, permitido: false }).ok, false);
  assert.equal(saldoInicialDePrestamo({ ...sin, monto: 0 }).ok, false);
  assert.equal(saldoInicialDePrestamo({ ...sin, fechaCorte: "" }).ok, false, "sin fecha de corte no se sabe a qué día es ese saldo");
  assert.equal(saldoInicialDePrestamo({ ...sin, fechaCorte: "2026-12-01" }).ok, false, "un corte no puede ser después de hoy");
  assert.equal(saldoInicialDePrestamo({ ...sin, responsable: " " }).ok, false, "alguien responde por la cifra");
  const r = saldoInicialDePrestamo({ ...sin, abonoSemanal: 250, evidencia: "archivo:hoja.jpg" });
  assert.ok(r.ok, r.dice); assert.deepEqual(r.avisos, []); assert.equal(OPERACION_DE[T_SALDO_INICIAL], "autorizar_prestamos", "es sensible: lo valida la base");
  assert.equal(saldoInicialDePrestamo({ ...sin, eventos: [r.evento] }).ok, false, "uno por persona: si está mal, se corrige ése");
  assert.match(saldoInicialDePrestamo({ ...sin, trabajador: { id: "t-beto", nombre: "Beto" } }).avisos[0], /sin evidencia/);
  const [p] = prestamosDe([r.evento]);
  assert.equal(p.estado, "activo"); assert.equal(p.monto, 500); assert.equal(p.deAntes, true); assert.equal(p.fecha, "2026-11-14"); assert.equal(p.saldoInicial.responsable, "Miguel");
  const ab = abonar({ prestamos: saldosDePrestamos([p], []), monto: 250, semana: { desde: "2026-11-23", hasta: "2026-11-29" }, ...base() });
  assert.ok(ab.ok); const [q] = saldosDePrestamos(prestamosDe([r.evento]), ab.eventos); assert.equal(q.monto - q.abonado, 250);
  assert.equal(abonoAcordado([q]), 250); assert.equal(abonoAcordado(saldosDePrestamos(prestamosDe([r.evento]), [...ab.eventos, ...abonar({ prestamos: [q], monto: 200, ...base() }).eventos])), 50, "el acordado nunca pasa de lo que falta");
  const f = flujoDeEfectivo({ eventos: [r.evento, ...ab.eventos], prestamos: prestamosDe([r.evento]), hoy: HOY });
  assert.equal(f.egresos, 0, "el dinero salió antes de la app: no sale otra vez en el flujo"); assert.equal(f.ingresos, 0, "y el abono descontado de la semana tampoco es dinero que entra");
});

test("prestar_en_un_paso_deja_los_tres_hechos_a_nombre_de_quien_lo_hizo_y_el_abono_acordado_es_solo_sugerencia", () => {
  const pedir = { permitidoAutorizar: true, permitidoEntregar: true, trabajador: ANA, monto: 1500, motivo: "un pendiente", semanas: 2, medio: "efectivo", ...base() };
  assert.equal(prestarDeUnaVez({ ...pedir, quien: ENC, permitidoAutorizar: undefined, permitidoEntregar: undefined }).ok, false, "un encargado sólo lo pide");
  assert.equal(prestarDeUnaVez({ ...pedir, permitidoEntregar: false }).ok, false, "autorizar no es poder entregar: no queda nada a medias");
  assert.equal(prestarDeUnaVez({ ...pedir, semanas: 1.5 }).ok, false); assert.equal(prestarDeUnaVez({ ...pedir, medio: "" }).ok, false); assert.equal(prestarDeUnaVez({ ...pedir, motivo: "" }).ok, false);
  const r = prestarDeUnaVez(pedir);
  assert.ok(r.ok, r.dice); assert.deepEqual(r.eventos.map(e => e.tipo), ["prestamo_solicitud", "prestamo_autorizacion", "prestamo_entrega"]);
  assert.equal(new Set(r.eventos.map(e => e.id)).size, 3); assert.ok(r.eventos.every(e => e.quien.id === ADMIN.id));
  assert.equal(r.eventos[1].origen, r.eventos[0].id); assert.equal(r.eventos[2].origen, r.eventos[0].id);
  const [p] = prestamosDe(r.eventos);
  assert.equal(p.estado, "activo"); assert.equal(p.monto, 1500); assert.equal(p.autorizacion.por, "Luis"); assert.equal(p.autorizacion.abonoSemanal, 750); assert.equal(p.autorizacion.condiciones, "Se paga en 2 semanas");
  assert.equal(abonoAcordado(saldosDePrestamos([p], [])), 750);
  assert.equal(prestarDeUnaVez({ ...pedir, monto: 1000, semanas: 3 }).abonoSemanal, 333.34, "redondeado hacia arriba: en tres semanas se termina");
  assert.equal(prestarDeUnaVez({ ...pedir, semanas: "" }).abonoSemanal, null, "sin semanas, sin abono acordado");
  assert.equal(flujoDeEfectivo({ eventos: r.eventos, prestamos: prestamosDe(r.eventos), hoy: HOY }).egresos, 1500, "el dinero sale una vez, con la entrega");
});

test("corregir_lo_que_debia_al_arrancar_deja_la_cifra_anterior_y_los_abonos_siguen_contando", () => {
  const r = saldoInicialDePrestamo({ trabajador: ANA, monto: 500, fechaCorte: "2026-11-14", responsable: "Miguel", ...base() });
  const ab = abonar({ prestamos: saldosDePrestamos(prestamosDe([r.evento]), []), monto: 200, ...base() });
  assert.equal(corregirSaldoInicial({ evento: r.evento, monto: 800, motivo: "", ...base() }).ok, false, "sin motivo no se corrige");
  assert.equal(corregirSaldoInicial({ evento: r.evento, monto: 800, motivo: "era 800", ...base(), quien: ENC }).ok, false);
  assert.equal(corregirSaldoInicial({ evento: r.evento, monto: 500, motivo: "igual", ...base() }).ok, false);
  const c = corregirSaldoInicial({ evento: r.evento, monto: 800, motivo: "En la hoja decía 800", ...base() });
  assert.ok(c.ok, c.dice);
  const eventos = [c.anterior, c.nuevo];
  const [p] = saldosDePrestamos(prestamosDe(eventos), ab.eventos);
  assert.equal(prestamosDe(eventos).length, 1, "sigue siendo un solo préstamo");
  assert.equal(p.monto, 800); assert.equal(p.id, r.evento.id, "conserva el identificador del primero");
  assert.equal(p.monto - p.abonado, 600, "el abono de 200 sigue contando");
  assert.equal(c.anterior.datos.monto, 500, "lo que decía antes no se toca");
});

// Lo encontró el recorrido con cuentas: con servidor, la autorización recién hecha todavía no trae sello y la entrega
// decía «no está autorizado».
test("prestar_en_un_paso_funciona_aunque_la_base_todavia_no_haya_sellado_la_autorizacion", () => {
  exigirValidacion(true);
  try {
    const r = prestarDeUnaVez({ permitidoAutorizar: true, permitidoEntregar: true, trabajador: ANA, monto: 500, motivo: "x", medio: "efectivo", ...base() });
    assert.ok(r.ok, r.dice); assert.deepEqual(r.eventos.map(e => e.tipo), ["prestamo_solicitud", "prestamo_autorizacion", "prestamo_entrega"]);
    assert.equal(prestamosDe(r.eventos)[0].estado, "solicitado", "hasta que la base selle la autorización y la entrega, no es deuda");
  } finally { exigirValidacion(false); }
});
