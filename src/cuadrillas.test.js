import { test } from "node:test";
import assert from "node:assert/strict";
import { cancelarEvento, corregirEvento, efectosDe } from "./eventos.js";
import { marcar, marcaQueFalto, emitirCredencial } from "./checador.js";
import { asignar, terminar, anotarDestajo, repartoActual, tramosDeTrabajo, manoDeObra, agrupar, actividadesDeManoDeObra, capturasDobles, ajusteVigente, cambiarAjuste, horasDe } from "./cuadrillas.js";
import { sumarDinero } from "./calculos.js";

const ENC = { id: "enc1", nombre: "Encargado", rol: "encargado" }, ADMIN = { id: "u1", nombre: "Luis", rol: "admin" };
const D = "2026-11-19";
const a = (hhmm, dia = D) => `${dia}T${hhmm}:00-06:00`;
const hist = (sueldo) => [{ desde: "2026-01-01", sueldo_dia: sueldo, anterior: sueldo }];
const ANA = { id: "t-ana", nombre: "ANA", sueldo_dia: 400, historialSueldo: hist(400) };
const BETO = { id: "t-beto", nombre: "BETO", sueldo_dia: 360, historialSueldo: hist(360) };
const CARO = { id: "t-caro", nombre: "CARO", sueldo_dia: 480, historialSueldo: hist(480), modalidadPago: "hora" };
const DANI = { id: "t-dani", nombre: "DANI", modalidadPago: "destajo" };
const GENTE = [ANA, BETO, CARO, DANI];
let n = 0;
const checa = (evs, t, hhmm, dia = D) => { const r = marcar({ eventos: evs, trabajador: t, via: "qr", ahora: a(hhmm, dia), fecha: dia, quien: ENC, azar: (++n) / 1e6 }); assert.ok(r.ok, r.dice); return [...evs, r.evento]; };
const manda = (evs, ts, parcelaId, actividad, hhmm, mas = {}) => { const r = asignar({ trabajadorIds: ts.map(t => t.id), parcelaId, actividad, desde: a(hhmm), fecha: D, quien: ENC, azar: (++n) / 1e6, ...mas }); assert.ok(r.ok, r.dice); return [...evs, r.evento]; };
const mo = (evs, mas = {}) => manoDeObra(evs, GENTE, { desde: D, hasta: D, hoy: "2026-11-20", ahora: a("23:00"), ...mas });
const costoEn = (r, parcelaId) => sumarDinero(r.partes.filter(p => p.parcelaId === parcelaId).map(p => p.monto));

test("una_sola_captura_manda_a_toda_la_cuadrilla_y_cada_quien_queda_con_su_tiempo_y_su_costo", () => {
  let evs = []; for (const t of [ANA, BETO]) evs = checa(evs, t, "06:00");
  evs = manda(evs, [ANA, BETO], "p7", "Deshierbe", "06:00", { cuadrilla: "Cuadrilla 1" });
  for (const t of [ANA, BETO]) evs = checa(evs, t, "14:00");
  assert.equal(evs.filter(e => e.tipo === "asignacion").length, 1, "un evento para los dos");
  const r = mo(evs);
  assert.equal(costoEn(r, "p7"), 760); assert.equal(r.totalSinAsignar, 0); assert.equal(r.minutosAsignados, 960);
  const ana = r.devengado.find(d => d.trabajadorId === "t-ana");
  assert.equal(ana.monto, 400); assert.equal(ana.minutos, 480); assert.equal(ana.estimado, false);
});

test("entrar_al_rancho_sin_que_lo_manden_a_ninguna_parcela_no_le_carga_a_ninguna", () => {
  let evs = checa([], ANA, "06:00"); evs = checa(evs, ANA, "14:00");
  const r = mo(evs);
  assert.equal(r.totalAsignado, 0); assert.equal(r.totalSinAsignar, 400, "el día se devenga, pero queda a la vista como sin asignar");
  assert.deepEqual(actividadesDeManoDeObra(r.partes, GENTE), [], "y no entra al costo de ninguna parcela");
});

test("cambiar_de_parcela_a_media_manana_es_otra_asignacion_y_el_dia_se_reparte_por_tiempo", () => {
  let evs = checa([], ANA, "06:00");
  evs = manda(evs, [ANA], "p7", "Deshierbe", "06:00");
  evs = manda(evs, [ANA], "p9", "Riego", "12:00");            // 6 h en p7, 2 h en p9
  evs = checa(evs, ANA, "14:00");
  const r = mo(evs);
  assert.equal(costoEn(r, "p7"), 300); assert.equal(costoEn(r, "p9"), 100);
  assert.deepEqual(r.tramos.map(t => [t.parcelaId, t.actividad, t.minutos]), [["p7", "Deshierbe", 360], ["p9", "Riego", 120]]);
  assert.equal(r.total, 400, "el cambio de parcela no duplica el día");
});

test("cambiar_de_actividad_en_la_misma_parcela_separa_el_costo_por_labor", () => {
  let evs = checa([], ANA, "06:00");
  evs = manda(evs, [ANA], "p7", "Deshierbe", "06:00"); evs = manda(evs, [ANA], "p7", "Fertilización", "10:00");
  evs = checa(evs, ANA, "14:00");
  const porLabor = agrupar(mo(evs).partes, ["parcelaId", "actividad"]);
  assert.deepEqual(porLabor.map(g => [g.actividad, g.monto]).sort(), [["Deshierbe", 200], ["Fertilización", 200]]);
});

test("el_rato_entre_que_llego_y_lo_mandaron_no_se_le_carga_a_la_parcela", () => {
  let evs = checa([], ANA, "06:00"); evs = manda(evs, [ANA], "p7", "Deshierbe", "07:00"); evs = checa(evs, ANA, "14:00");
  const r = mo(evs);
  assert.equal(costoEn(r, "p7"), 350); assert.equal(r.totalSinAsignar, 50); assert.equal(r.minutosSinAsignar, 60);
  assert.equal(sumarDinero(r.partes.map(p => p.monto)), 400, "lo repartido suma exacto lo devengado");
});

test("terminaron_los_deja_en_el_rancho_sin_parcela", () => {
  let evs = checa([], ANA, "06:00"); evs = manda(evs, [ANA], "p7", "Deshierbe", "06:00");
  evs = [...evs, terminar({ trabajadorIds: ["t-ana"], desde: a("12:00"), fecha: D, quien: ENC }).evento];
  const ahora = repartoActual(evs, { fecha: D, hoy: D, ahora: a("12:30") });
  assert.equal(ahora.grupos.length, 0); assert.deepEqual(ahora.sinAsignar.map(x => x.trabajadorId), ["t-ana"]);
  evs = checa(evs, ANA, "14:00");
  assert.equal(costoEn(mo(evs), "p7"), 300);
});

test("asignado_que_nunca_checo_no_cuenta_horas_ni_costo_y_se_avisa", () => {
  const evs = manda([], [BETO], "p7", "Deshierbe", "06:00");
  const r = mo(evs);
  assert.equal(r.total, 0); assert.equal(r.avisos.find(x => x.clase === "asignado_sin_checar").trabajadorId, "t-beto");
  assert.deepEqual(repartoActual(evs, { fecha: D, hoy: D, ahora: a("08:00") }).sinChecar.map(x => x.trabajadorId), ["t-beto"]);
});

test("una_entrada_sin_salida_devenga_el_dia_pero_no_se_lo_carga_a_la_parcela_hasta_cerrarla", () => {
  let evs = checa([], ANA, "06:00"); evs = manda(evs, [ANA], "p7", "Deshierbe", "06:00");
  let r = mo(evs);                                            // ya es el día siguiente y nunca checó salida
  assert.equal(r.total, 400); assert.equal(costoEn(r, "p7"), 0); assert.equal(r.totalSinAsignar, 400);
  assert.ok(r.partes[0].sinHoras); assert.equal(r.avisos[0].clase, "sin_salida"); assert.equal(horasDe(r.partes[0].minutos), "no se sabe");
  const cierre = marcaQueFalto({ trabajadorId: "t-ana", sentido: "salida", cuando: a("14:00"), fecha: D, motivo: "se le olvidó", quien: ENC, capturado: a("09:00", "2026-11-20") });
  r = mo([...evs, cierre.evento]);
  assert.equal(costoEn(r, "p7"), 400, "al cerrarla, el costo llega solo a la parcela: nadie lo volvió a capturar");
  assert.equal(r.avisos.length, 0);
});

test("quien_cobra_por_hora_devenga_solo_el_tiempo_que_se_sabe", () => {
  let evs = checa([], CARO, "06:00"); evs = manda(evs, [CARO], "p7", "Riego", "06:00"); evs = checa(evs, CARO, "11:00");
  const r = mo(evs);
  assert.equal(r.total, 300, "5 horas de 8 a $480 el día"); assert.equal(r.partes[0].modalidad, "hora");
});

test("el_destajo_se_reparte_parejo_y_quien_va_solo_a_destajo_no_devenga_por_estar", () => {
  let evs = checa([], DANI, "06:00"); evs = checa(evs, ANA, "06:00");
  evs = manda(evs, [DANI, ANA], "p7", "Corte", "06:00");
  const d = anotarDestajo({ trabajadorIds: ["t-dani"], parcelaId: "p7", actividad: "Corte", unidad: "caja", cantidad: 141, tarifa: 9.5, cuando: a("13:00"), fecha: D, quien: ENC });
  assert.ok(d.ok); evs = [...evs, d.evento];
  evs = checa(evs, DANI, "14:00"); evs = checa(evs, ANA, "14:00");
  const r = mo(evs);
  const dani = r.devengado.find(x => x.trabajadorId === "t-dani");
  assert.equal(dani.monto, 1339.5); assert.deepEqual(dani.partes.map(p => p.modalidad), ["destajo"]);
  assert.equal(costoEn(r, "p7"), 1739.5);
  const dos = anotarDestajo({ trabajadorIds: ["t-dani", "t-x", "t-y"], parcelaId: "p7", unidad: "caja", cantidad: 10, tarifa: 3.33, cuando: a("13:00"), fecha: D, quien: ENC }).evento;
  const partes = manoDeObra([dos], GENTE, { desde: D, hasta: D, hoy: D, ahora: a("15:00") }).partes;
  assert.equal(sumarDinero(partes.map(p => p.monto)), 33.3, "repartir entre tres no pierde centavos");
  assert.equal(anotarDestajo({ trabajadorIds: ["t-dani"], parcelaId: "p7", cantidad: 0, tarifa: 9, cuando: a("13:00"), fecha: D, quien: ENC }).ok, false);
});

test("cancelar_una_asignacion_equivocada_regresa_el_costo_sin_borrar_nada", () => {
  let evs = checa([], ANA, "06:00"); evs = manda(evs, [ANA], "p9", "Riego", "06:00"); evs = checa(evs, ANA, "14:00");
  assert.equal(costoEn(mo(evs), "p9"), 400);
  const i = evs.findIndex(e => e.tipo === "asignacion");
  const c = cancelarEvento(evs[i], { motivo: "era la parcela 7", quien: ENC, cuando: a("15:00") });
  evs = evs.map((e, k) => (k === i ? c.evento : e));
  evs = manda(evs, [ANA], "p7", "Riego", "06:00");
  const r = mo(evs);
  assert.equal(costoEn(r, "p9"), 0); assert.equal(costoEn(r, "p7"), 400); assert.equal(r.total, 400);
  assert.equal(evs.filter(e => e.tipo === "asignacion").length, 2, "la equivocada sigue en el historial");
});

test("corregir_la_hora_de_una_asignacion_mueve_el_reparto_y_no_duplica", () => {
  let evs = checa([], ANA, "06:00"); evs = manda(evs, [ANA], "p7", "Deshierbe", "06:00"); evs = manda(evs, [ANA], "p9", "Riego", "12:00"); evs = checa(evs, ANA, "14:00");
  const i = evs.findIndex(e => e.tipo === "asignacion" && e.datos.parcelaId === "p9");
  const c = corregirEvento(evs[i], { cuando: a("10:00") }, { motivo: "se fueron a las 10", quien: ENC, cuando: a("16:00") });
  evs = [...evs.map((e, k) => (k === i ? c.anterior : e)), c.nuevo];
  const r = mo(evs);
  assert.equal(costoEn(r, "p7"), 200); assert.equal(costoEn(r, "p9"), 200); assert.equal(r.total, 400);
});

test("subir_dos_veces_los_mismos_eventos_no_duplica_ni_horas_ni_costo", () => {
  let evs = checa([], ANA, "06:00"); evs = manda(evs, [ANA], "p7", "Deshierbe", "06:00"); evs = checa(evs, ANA, "14:00");
  const repetidos = [...evs, ...evs.map(e => ({ ...e })), ...evs];
  const r = mo(repetidos);
  assert.equal(r.total, 400); assert.equal(r.minutosAsignados, 480); assert.equal(r.tramos.length, 1);
});

test("cada_peso_dice_de_que_eventos_salio", () => {
  let evs = checa([], ANA, "06:00"); evs = manda(evs, [ANA], "p7", "Deshierbe", "06:00"); evs = checa(evs, ANA, "14:00");
  const [parte] = mo(evs).partes;
  assert.deepEqual([...parte.evs].sort(), evs.map(e => e.id).sort(), "entrada, salida y asignación");
  const [fila] = actividadesDeManoDeObra(mo(evs).partes, GENTE);
  assert.equal(fila.costoMO, 400); assert.equal(fila.horas, 8); assert.equal(fila._deEventos.length, 3); assert.equal(fila.parcelaId, "p7");
  assert.ok(efectosDe(evs).some(f => f.clase === "destino" && f.parcelaId === "p7" && f.ev === evs[1].id));
});

test("un_sueldo_que_no_consta_para_esa_fecha_sale_marcado_estimado_y_sin_sueldo_se_dice", () => {
  const NUEVO = { id: "t-nuevo", nombre: "NUEVO", sueldo_dia: 350 }, SIN = { id: "t-sin", nombre: "SIN" };
  let evs = checa([], NUEVO, "06:00"); evs = checa(evs, NUEVO, "14:00"); evs = checa(evs, SIN, "06:00"); evs = checa(evs, SIN, "14:00");
  const r = manoDeObra(evs, [NUEVO, SIN], { desde: D, hasta: D, hoy: "2026-11-20", ahora: a("23:00") });
  assert.ok(r.devengado.find(d => d.trabajadorId === "t-nuevo").estimado);
  assert.equal(r.avisos.find(x => x.clase === "sin_sueldo").trabajadorId, "t-sin"); assert.equal(r.total, 350);
});

test("mientras_sigue_adentro_el_costo_del_dia_sale_como_provisional", () => {
  let evs = checa([], ANA, "06:00"); evs = manda(evs, [ANA], "p7", "Deshierbe", "06:00");
  const r = manoDeObra(evs, GENTE, { desde: D, hasta: D, hoy: D, ahora: a("09:00") });
  assert.equal(r.tramos[0].minutos, 180); assert.ok(r.partes[0].provisional); assert.equal(costoEn(r, "p7"), 400);
  const g = repartoActual(evs, { fecha: D, hoy: D, ahora: a("09:00") }).grupos;
  assert.equal(g.length, 1); assert.equal(g[0].miembros[0].trabajadorId, "t-ana");
});

test("la_misma_jornada_tecleada_tambien_como_actividad_se_detecta_como_doble", () => {
  let evs = checa([], ANA, "06:00"); evs = manda(evs, [ANA], "p7", "Deshierbe", "06:00"); evs = checa(evs, ANA, "14:00");
  const tecleadas = [{ id: "a1", fecha: D, parcelaId: "p7", tipo: "Deshierbe", horas: 8, trabajadorId: "t-ana" }, { id: "a2", fecha: D, parcelaId: "p7", horas: 8, trabajadorId: "t-beto" }];
  assert.deepEqual(capturasDobles(tecleadas, mo(evs).partes).map(x => x.actividadId), ["a1"]);
});

test("solo_un_encargado_o_administrador_reparte_y_no_se_asigna_al_futuro", () => {
  assert.equal(asignar({ trabajadorIds: ["t-ana"], parcelaId: "p7", actividad: "x", desde: a("06:00"), fecha: D, quien: { id: "t-ana", rol: "trabajador" } }).ok, false);
  assert.equal(asignar({ trabajadorIds: [], parcelaId: "p7", actividad: "x", desde: a("06:00"), fecha: D, quien: ENC }).ok, false);
  assert.equal(asignar({ trabajadorIds: ["t-ana"], parcelaId: "", actividad: "x", desde: a("06:00"), fecha: D, quien: ENC }).ok, false);
  assert.equal(asignar({ trabajadorIds: ["t-ana"], parcelaId: "p7", actividad: "x", desde: a("18:00"), fecha: D, quien: ENC, capturado: a("06:00") }).ok, false);
  assert.deepEqual(asignar({ trabajadorIds: ["t-ana", "t-ana", ""], parcelaId: "p7", actividad: "x", desde: a("06:00"), fecha: D, quien: ENC }).evento.datos.trabajadorIds, ["t-ana"]);
});

test("el_intervalo_de_lecturas_repetidas_se_cambia_y_queda_dicho_quien_lo_cambio", () => {
  assert.equal(ajusteVigente([], "ventana_repetida_min").valor, 15);
  assert.equal(cambiarAjuste({ clave: "ventana_repetida_min", valor: 5, quien: ENC, cuando: a("08:00"), fecha: D }).ok, false, "un encargado no cambia las reglas");
  assert.equal(cambiarAjuste({ clave: "ventana_repetida_min", valor: 0, quien: ADMIN, cuando: a("08:00"), fecha: D }).ok, false);
  const c = cambiarAjuste({ clave: "ventana_repetida_min", valor: 5, quien: ADMIN, cuando: a("08:00"), fecha: D });
  const v = ajusteVigente([c.evento], "ventana_repetida_min");
  assert.equal(v.valor, 5); assert.equal(v.por, "Luis");
  let evs = [c.evento]; evs = checa(evs, ANA, "09:00");
  assert.equal(marcar({ eventos: evs, trabajador: ANA, via: "qr", ahora: a("09:06"), fecha: D, quien: ENC, ventanaMin: v.valor }).sentido, "salida", "con 5 minutos, a los 6 ya es salida");
  assert.equal(marcar({ eventos: evs, trabajador: ANA, via: "qr", ahora: a("09:06"), fecha: D, quien: ENC }).repetida, true, "con 15, todavía es repetida");
  void emitirCredencial;
});
