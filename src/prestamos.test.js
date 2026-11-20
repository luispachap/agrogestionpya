import { test } from "node:test";
import assert from "node:assert/strict";
import { solicitarPrestamo, autorizarPrestamo, rechazarPrestamo, entregarPrestamo, prestamosDe } from "./prestamos.js";
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
