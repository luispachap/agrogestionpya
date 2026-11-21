// De lo que alguien dice a lo que el sistema registra: propone, pregunta, respeta permisos y no repite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { entenderLoDicho } from "./voz.js";
import { preparar, ejecutar, naturalezaDe, decirPropuesta, OPERACIONES } from "./operaciones.js";
import { avancesDe, avanceDeParcela, sugerenciasDeContinuidad, registrarAvance, actividadDicha, unidadDe, T_AVANCE } from "./avances.js";

const parcelas = [{ id: "sf4", nombre: "San Felipe 4" }, { id: "p53", nombre: "La 53" }], personas = [{ id: "t1", nombre: "Juan Inventado" }, { id: "t2", nombre: "Pedro Inventado" }];
const capataz = { id: "enc1", nombre: "Capataz de prueba", rol: "encargado" }, admin = { id: "a1", nombre: "Admin de prueba", rol: "admin" }, agronomo = { id: "ag1", nombre: "Agrónomo de prueba", rol: "agronomo" };
let n = 0; const sello = () => ({ cuando: `2026-11-21T18:00:${String(n++).padStart(2, "0")}.000Z`, fecha: "2026-11-21" });
const dicho = (texto, de = capataz, id = `m${n++}`) => { const mensaje = { id, canal: "app", de, cuando: "2026-11-21T18:00:00.000Z", texto }; return { mensaje, plan: preparar({ mensaje, entendido: entenderLoDicho({ texto, personas, parcelas, insumos: [], hoy: "2026-11-21" }) }) }; };

test("el_avance_de_miguel_se_entiende_como_un_avance_con_su_gente_y_su_pendiente_no_como_dos_notas", () => {
  const { mensaje, plan } = dicho("Hoy terminamos dos reguladores de deshierbe en San Felipe 4. Trabajaron siete personas y mañana tenemos que terminar lo que falta.");
  assert.equal(plan.propuestas.length, 1, "la segunda frase va con el avance: no es otra cosa");
  const p = plan.propuestas[0];
  assert.deepEqual([p.tipo, p.naturaleza, p.datos.actividad, p.datos.cantidad.valor, p.datos.unidad, p.datos.parcelaId, p.datos.personasN, p.lista, p.permiso.puede], ["avance", "hecho", "deshierbe", 2, "regulador", "sf4", 7, true, true]);
  assert.match(p.datos.pendiente.texto, /mañana tenemos que terminar lo que falta/); assert.equal(decirPropuesta(p), "2 reguladores de deshierbe en San Felipe 4 · 7 persona(s) · quedó pendiente");
  const r = ejecutar(p, { mensaje, quien: capataz, parcelas, ...sello() });
  assert.equal(r.ok, true); assert.deepEqual(r.escrituras.map(e => [e.coleccion, e.registro.tipo]), [["eventos", T_AVANCE]], "UNA escritura: el avance. Ni actividades de siete personas, ni rayas, ni costo");
  const d = r.escrituras[0].registro.datos;
  assert.deepEqual([d.cantidad, d.unidad, d.personas, d.actividad], [2, "regulador", 7, "deshierbe"]); assert.equal(d.monto, undefined); assert.equal(d.origenDicho.mensaje, mensaje.id);
  const av = avanceDeParcela([r.escrituras[0].registro], "sf4")[0];
  assert.deepEqual([av.cantidad, av.unidad, av.porcentaje], [2, "regulador", null], "dos reguladores no son un porcentaje"); assert.match(av.porque, /No se calcula un porcentaje/);
});

test("lo_que_falta_se_pregunta_y_no_se_guarda_a_medias", () => {
  const { mensaje, plan } = dicho("Terminamos tres reguladores.");
  const p = plan.propuestas[0];
  assert.equal(p.tipo, "avance"); assert.equal(p.lista, false); assert.deepEqual(plan.porPreguntar[0].preguntas, ["¿En qué parcela?", "¿De qué actividad es el avance (deshierbe, riego, corte…)?"]);
  assert.match(ejecutar(p, { mensaje, quien: capataz, parcelas, ...sello() }).dice, /¿En qué parcela\?/);
  assert.equal(dicho("Compramos un kilo de clavos.").plan.porPreguntar[0].preguntas[0], "¿Cuánto costó?");
});

test("hablar_no_da_permisos_un_gasto_lo_confirma_quien_lleva_las_cuentas", () => {
  const { mensaje, plan } = dicho("Compramos doscientos litros de diésel, tres mil ochocientos pesos.");
  const p = plan.propuestas[0];
  assert.deepEqual([p.tipo, p.datos.monto, p.permiso.puede], ["gasto", 3800, false]); assert.match(p.permiso.dice, /lo confirma un administrador o finanzas/); assert.equal(plan.resumen.deOtroPermiso, 1);
  const no = ejecutar(p, { mensaje, quien: capataz, parcelas, ...sello() }); assert.equal(no.ok, false); assert.equal(no.sinPermiso, true);
  const si = ejecutar(p, { mensaje, quien: admin, parcelas, ...sello() });
  assert.equal(si.ok, true); assert.deepEqual([si.escrituras[0].coleccion, si.escrituras[0].registro.monto, si.escrituras[0].registro.origen.dijo, si.escrituras[0].registro.origen.confirmo], ["egresos", 3800, "Capataz de prueba", "Admin de prueba"], "queda quién lo dijo y quién lo confirmó");
});

test("una_sospecha_o_algo_por_hacer_no_se_registra_como_hecho", () => {
  assert.equal(naturalezaDe("Creo que cosechamos como cien cajas", "cosecha"), "hipotesis"); assert.equal(naturalezaDe("Mañana hay que comprar diésel", "necesidad"), "necesidad");
  assert.equal(naturalezaDe("Vimos mucha hierba en la 53", "nota"), "observacion"); assert.equal(naturalezaDe("El tractor se descompuso", "incidencia"), "reporte"); assert.equal(naturalezaDe("Decidimos adelantar el riego", "nota"), "decision");
  const { mensaje, plan } = dicho("Creo que cosechamos como cien cajas de la 53.");
  const p = plan.propuestas[0];
  assert.deepEqual([p.tipo, p.tipoEntendido, p.naturaleza], ["nota", "cosecha", "hipotesis"]); assert.match(p.aviso, /Se dijo como una sospecha \(no confirmada\), no como algo ya hecho/);
  const r = ejecutar(p, { mensaje, quien: capataz, parcelas, ...sello() });
  assert.deepEqual([r.escrituras[0].coleccion, r.escrituras[0].registro.naturaleza, r.escrituras[0].registro.sonabaA], ["bitacora", "hipotesis", "cosecha"], "se conserva, con su clase, y no entra a cosechas");
});

test("un_mensaje_con_varias_cosas_da_varias_propuestas_ligadas_y_cada_una_con_su_clase", () => {
  const { plan } = dicho("Hoy terminamos dos reguladores de deshierbe en San Felipe 4. El tractor se descompuso, tira aceite. Vimos mucha hierba en La 53.", capataz, "m-varias");
  assert.deepEqual(plan.propuestas.map(p => [p.tipo, p.naturaleza]), [["avance", "hecho"], ["incidencia", "reporte"], ["nota", "observacion"]]);
  assert.equal(new Set(plan.propuestas.map(p => p.grupo)).size, 1, "las tres salen del mismo mensaje"); assert.deepEqual(plan.propuestas.map(p => p.id), ["m-varias#0", "m-varias#1", "m-varias#2"]);
  assert.equal(plan.propuestas[2].datos.parcelaId, "p53");
});

test("el_mismo_mensaje_no_se_registra_dos_veces_ni_el_mismo_dinero_dos_veces", () => {
  const texto = "Compramos diésel, tres mil ochocientos pesos. Pagamos tres mil ochocientos pesos en la gasolinera.";
  const mensaje = { id: "m-dinero", canal: "chat", de: admin, cuando: "2026-11-21T18:00:00.000Z", texto }, entendido = entenderLoDicho({ texto, personas, parcelas, insumos: [], hoy: "2026-11-21" });
  const plan = preparar({ mensaje, entendido });
  assert.deepEqual(plan.propuestas.map(p => [p.tipo, p.mismoDineroQue, p.lista]), [["gasto", null, true], ["gasto", "m-dinero#0", false]]); assert.equal(plan.resumen.repetidas, 1);
  assert.match(ejecutar(plan.propuestas[1], { mensaje, quien: admin, ...sello() }).dice, /mismo dinero/);
  const otraVez = preparar({ mensaje, entendido, yaHechas: ["m-dinero#0"] });
  assert.equal(otraVez.propuestas[0].yaHecha, true); assert.match(ejecutar(otraVez.propuestas[0], { mensaje, quien: admin, ...sello() }).dice, /ya se registró de este mismo mensaje/);
  const a = ejecutar(dicho("Terminamos dos reguladores de deshierbe en San Felipe 4.", capataz, "m-fijo").plan.propuestas[0], { mensaje: { id: "m-fijo", de: capataz }, quien: capataz, parcelas, ...sello() });
  const b = ejecutar(dicho("Terminamos dos reguladores de deshierbe en San Felipe 4.", capataz, "m-fijo").plan.propuestas[0], { mensaje: { id: "m-fijo", de: capataz }, quien: capataz, parcelas, ...sello() });
  assert.equal(a.escrituras[0].registro.id, b.escrituras[0].registro.id, "confirmar dos veces el mismo avance es el mismo registro");
});

test("un_pago_o_una_aplicacion_no_se_guardan_parecido_por_otro_lado", () => {
  for (const [texto, pantalla, frase] of [["Le pagué a Pedro mil pesos.", "nomina", /Pagos al personal/], ["Aplicamos herbicida en La 53.", "aplicaciones", /producto, dosis, quién la indicó y por qué/]]) {
    const { mensaje, plan } = dicho(texto, admin), p = plan.propuestas[0];
    assert.deepEqual([p.tipo, p.pantalla], ["nota", pantalla], texto); assert.match(p.aviso, frase);
    const r = ejecutar(p, { mensaje, quien: admin, parcelas, ...sello() });
    assert.equal(r.escrituras[0].coleccion, "bitacora", "se conserva lo dicho, pero no nace un gasto ni un pago"); assert.equal(r.escrituras.some(e => ["egresos", "actividades", "prestamos"].includes(e.coleccion)), false);
  }
  assert.ok(Object.values(OPERACIONES).every(o => o.confirma.length && o.a && o.porque));
});

test("con_lo_que_quedo_pendiente_se_sugiere_continuar_y_solo_se_estima_gente_si_hay_con_que", () => {
  const ev = []; const q = { id: "enc1", nombre: "Capataz", rol: "encargado" };
  const av = (dia, cantidad, personas, pendiente = null) => ev.push(registrarAvance({ parcelaId: "sf4", parcelas, actividad: "Deshierbe", cantidad, unidad: "reguladores", personas, pendiente, quien: q, cuando: `${dia}T20:00:00.000Z`, fecha: dia, azar: ev.length / 100 }).evento);
  av("2026-11-20", 2, 7, { texto: "mañana terminar lo que falta" });
  let s = sugerenciasDeContinuidad(ev, "2026-11-21", parcelas);
  assert.equal(s.length, 1); assert.match(s[0].dice, /El 2026-11-20 trabajaron 7 persona\(s\) en deshierbe en San Felipe 4: avanzaron 2 reguladores y quedó pendiente \(«mañana terminar lo que falta»\)\. Conviene considerar gente para continuar\./);
  assert.equal(s[0].estimacion, null); assert.match(s[0].sinEstimar, /No se dijo cuánto quedó pendiente/); assert.equal(s[0].seBasaEn.length, 1);
  ev.length = 0; av("2026-11-18", 2, 8); av("2026-11-19", 1, 4); av("2026-11-20", 2, 7, { texto: "quedaron dos", cantidad: 2, unidad: "reguladores" });
  s = sugerenciasDeContinuidad(ev, "2026-11-21", parcelas);
  assert.deepEqual([s[0].estimacion.personas, s[0].estimacion.registros, s[0].estimacion.ritmo], [8, 3, 0.25]); assert.match(s[0].estimacion.dice, /alrededor de 8 persona\(s\).*Es una cuenta gruesa: las unidades no son todas iguales/); assert.equal(s[0].seBasaEn.length, 3);
  ev.pop(); av("2026-11-20", 2, 7, { texto: "quedaron dos", cantidad: 2, unidad: "reguladores" }); ev.splice(0, 1);
  assert.match(sugerenciasDeContinuidad(ev, "2026-11-21", parcelas)[0].sinEstimar, /Sólo hay 2 registro\(s\).*hacen falta 3/);
  av("2026-11-21", 2, 6); assert.equal(sugerenciasDeContinuidad(ev, "2026-11-22", parcelas).length, 0, "si después ya se trabajó y no quedó pendiente, no se sugiere");
  assert.equal(avancesDe(ev).every(a => a.monto === undefined && a.costo === undefined), true);
  assert.equal(registrarAvance({ parcelaId: "sf4", parcelas, actividad: "corte", cantidad: 300, unidad: "arpillas", quien: q, cuando: "2026-11-21T20:00:00.000Z", fecha: "2026-11-21" }).ok, false);
  assert.equal(unidadDe("Hectáreas"), "hectarea"); assert.equal(actividadDicha("llevamos cuarenta surcos de corte en la 53"), "corte"); assert.equal(actividadDicha("terminamos dos reguladores"), "");
});

/* ── El chat de adentro, por el mismo camino ── */
import { clasificarMensaje, marcarConfirmacion } from "./chat.js";
import { confirmarDelChat } from "./operaciones.js";
const delChat = (texto, de = capataz, extra = {}) => clasificarMensaje({ mensaje: { id: `chat${n++}`, de, cuando: "2026-11-21T18:00:00.000Z", texto, ...extra }, personas, parcelas, insumos: [], hoy: "2026-11-21" });

test("en_el_chat_un_gasto_no_lo_confirma_el_encargado_y_no_queda_firmado_ni_guardado", () => {
  const m = delChat("Compramos un kilo de clavos, 350 pesos.");
  const pr = m.propuestas.find(x => x.tipo === "gasto"); assert.ok(pr, "se entendió el gasto");
  const no = confirmarDelChat({ mensaje: m, propuesta: pr, quien: capataz, hoy: "2026-11-21", parcelas });
  assert.equal(no.ok, false); assert.equal(no.sinPermiso, true); assert.equal(no.escrituras, undefined); assert.match(no.dice, /lleva las cuentas/);
  const si = confirmarDelChat({ mensaje: m, propuesta: pr, quien: admin, hoy: "2026-11-21", parcelas });
  assert.equal(si.ok, true); assert.deepEqual(si.escrituras.map(e => e.coleccion), ["egresos"]);
  const o = si.escrituras[0].registro.origen;
  assert.deepEqual([o.mensaje, o.canal, o.dijo, o.confirmo], [m.id, "chat", "Capataz de prueba", "Admin de prueba"], "queda dicho de qué mensaje salió, quién lo dijo y quién lo confirmó");
});

test("en_el_chat_el_avance_es_un_avance_y_su_segunda_frase_no_se_registra_aparte", () => {
  const m = delChat("Hoy terminamos dos reguladores de deshierbe en San Felipe 4. Trabajaron siete personas y mañana tenemos que terminar lo que falta.");
  const principal = m.propuestas.find(x => x.tipo === "avance"), parte = m.propuestas.find(x => x.parteDe != null);
  assert.ok(principal && parte);
  const r = confirmarDelChat({ mensaje: m, propuesta: principal, quien: capataz, hoy: "2026-11-21", parcelas });
  assert.equal(r.ok, true); assert.deepEqual(r.escrituras.map(e => [e.coleccion, e.registro.tipo]), [["eventos", T_AVANCE]], "ni actividades ni pagos de siete personas");
  assert.equal(r.escrituras[0].registro.datos.origenDicho.canal, "chat");
  const r2 = confirmarDelChat({ mensaje: m, propuesta: parte, quien: capataz, hoy: "2026-11-21", parcelas });
  assert.deepEqual([r2.ok, r2.escrituras.length], [true, 0]);
});

test("en_el_chat_lo_ya_firmado_no_se_registra_otra_vez_y_lo_que_falta_se_dice", () => {
  const m = delChat("Se descompuso la bomba del pozo.");
  const pr = m.propuestas[0];
  const r = confirmarDelChat({ mensaje: m, propuesta: pr, quien: capataz, hoy: "2026-11-21", parcelas });
  assert.equal(r.ok, true); assert.equal(r.escrituras.length, 1);
  const firmada = marcarConfirmacion(pr, { estado: "confirmado", quien: capataz }).propuesta;
  const otra = confirmarDelChat({ mensaje: { ...m, propuestas: [firmada] }, propuesta: firmada, quien: capataz, hoy: "2026-11-21", parcelas });
  assert.equal(otra.ok, false); assert.match(otra.dice, /ya se firmó/);
  const m2 = delChat("Terminamos tres reguladores.");
  const falta = confirmarDelChat({ mensaje: m2, propuesta: m2.propuestas[0], quien: capataz, hoy: "2026-11-21", parcelas });
  assert.equal(falta.ok, false); assert.ok(falta.falta.length > 0, "sin parcela ni actividad no se guarda a medias");
});

test("en_el_chat_la_hoja_que_no_cuadra_o_el_papel_sin_total_no_entran_aunque_firme_un_administrador", () => {
  const base = { id: "chatX", de: agronomo, cuando: "2026-11-21T18:00:00.000Z", propuestas: [] };
  const hoja = { id: "chatX:hoja", tipo: "fertirriego", deQue: "foto", confiable: false, falta: [], indicacion: { parcelaId: "sf4", productos: [] } };
  assert.match(confirmarDelChat({ mensaje: base, propuesta: hoja, quien: admin, hoy: "2026-11-21", parcelas }).dice, /no cuadra/);
  const papel = { id: "chatX:papel", tipo: "gasto", deQue: "foto", monto: null, falta: [] };
  assert.equal(confirmarDelChat({ mensaje: base, propuesta: papel, quien: admin, hoy: "2026-11-21", parcelas }).ok, false, "el total sale del papel o se pregunta");
  const bien = { ...hoja, confiable: true, indicacion: { parcelaId: "sf4", parcelaNombre: "San Felipe 4", productos: [{ nombre: "Producto inventado", total: 10 }], resumen: "Hoja de prueba", deQuien: "Agrónomo de prueba" } };
  const r = confirmarDelChat({ mensaje: base, propuesta: bien, quien: capataz, hoy: "2026-11-21", parcelas });
  assert.equal(r.ok, true); assert.deepEqual([r.escrituras[0].coleccion, r.escrituras[0].registro.estado, r.escrituras[0].registro.origen.confirmo], ["indicaciones", "propuesta", "Capataz de prueba"]);
  assert.equal(confirmarDelChat({ mensaje: base, propuesta: bien, quien: { id: "f1", nombre: "Finanzas de prueba", rol: "finanzas" }, hoy: "2026-11-21", parcelas }).sinPermiso, true);
});

test("una_incidencia_o_una_necesidad_dichas_se_guardan_con_la_forma_que_leen_sus_pantallas", () => {
  // Pasó de verdad: se guardaba «descripcion» y la pantalla de inicio leía «desc»; al haber una incidencia dicha, el inicio tronaba.
  const a = dicho("Se descompuso la bomba del pozo.");
  const inc = ejecutar(a.plan.propuestas[0], { mensaje: a.mensaje, quien: capataz, parcelas, ...sello() }).escrituras[0];
  assert.equal(inc.coleccion, "incidencias"); assert.deepEqual([typeof inc.registro.desc, inc.registro.estado, inc.registro.trabajadorId], ["string", "pendiente", "enc1"]); assert.equal(inc.registro.descripcion, undefined);
  const b = dicho("Hace falta comprar urea para la semana que entra.");
  const nec = b.plan.propuestas.find(x => x.tipo === "necesidad"); assert.ok(nec, "se entendió que hace falta algo");
  const sol = ejecutar(nec, { mensaje: b.mensaje, quien: capataz, parcelas, ...sello() }).escrituras[0];
  assert.equal(sol.coleccion, "solicitudes_compra"); assert.deepEqual([sol.registro.items, sol.registro.creadaPor.id, sol.registro.estado], [[], "enc1", "pendiente"]); assert.match(sol.registro.notas, /urea/);
});

/* ── La conversación continúa: lo que falta se contesta, no se repite ── */
import { aclarar, pendienteDe, esRespuesta } from "./operaciones.js";
import { T_SOLICITUD, prestamosDe } from "./prestamos.js";
const entendida = (texto) => entenderLoDicho({ texto, personas, parcelas, insumos: [], hoy: "2026-11-21" }).propuestas[0];
const resp = (texto, de = capataz, id = `r${n++}`) => ({ id, texto, de, cuando: "2026-11-21T18:05:00.000Z" });

test("veinte_pesos_el_kilo_se_entiende_dentro_de_la_compra_pendiente_y_no_como_otro_gasto", () => {
  const p0 = entendida("Compramos tres kilos de clavos.");
  assert.deepEqual(p0.falta, ["cuánto costó"]);
  const r = aclarar({ propuesta: p0, respuesta: resp("20 pesos el kilo"), personas, parcelas });
  assert.equal(r.ok, true); assert.deepEqual([r.propuesta.monto, r.propuesta.precioUnitario, r.propuesta.falta], [60, 20, []], "20 por kilo × 3 kilos; no un gasto de 20");
  assert.equal(r.propuesta.frase, p0.frase, "lo que se dijo primero no se toca");
  assert.deepEqual([r.propuesta.aclaraciones.length, r.propuesta.aclaraciones[0].texto, r.propuesta.aclaraciones[0].pregunta, r.propuesta.aclaraciones[0].de.nombre], [1, "20 pesos el kilo", "¿Cuánto costó?", "Capataz de prueba"]);
  assert.equal(r.propuesta.comoLlego.monto, null, "queda cómo venía antes de aclararse");
  // Y de punta a punta: el registro lleva el mensaje original, la aclaración y quién confirmó.
  const mensaje = { id: "m-clavos", canal: "chat", de: capataz, cuando: "2026-11-21T18:00:00.000Z" };
  const plan = preparar({ mensaje, entendido: { propuestas: [r.propuesta] } });
  const e = ejecutar(plan.propuestas[0], { mensaje, quien: admin, parcelas, ...sello() });
  assert.equal(e.ok, true); const o = e.escrituras[0].registro.origen;
  assert.deepEqual([e.escrituras[0].registro.monto, o.frase, o.aclaraciones[0].texto, o.aclaraciones[0].dijo, o.dijo, o.confirmo], [60, "Compramos tres kilos de clavos.", "20 pesos el kilo", "Capataz de prueba", "Capataz de prueba", "Admin de prueba"]);
});

test("si_no_se_sabe_cuantos_fueron_el_precio_por_kilo_no_se_vuelve_total_se_pregunta", () => {
  const r1 = aclarar({ propuesta: entendida("Compramos clavos."), respuesta: resp("20 pesos el kilo"), personas, parcelas });
  assert.equal(r1.ok, true); assert.deepEqual([r1.propuesta.monto ?? null, r1.propuesta.falta], [null, ["cuántos fueron"]]); assert.match(r1.dice, /¿Cuántos fueron en total\?/);
  const mensaje = { id: "m-x", canal: "chat", de: capataz, cuando: "2026-11-21T18:00:00.000Z" };
  assert.equal(preparar({ mensaje, entendido: { propuestas: [r1.propuesta] } }).propuestas[0].lista, false, "sin total no se puede confirmar");
  const r2 = aclarar({ propuesta: r1.propuesta, respuesta: resp("fueron cinco"), personas, parcelas });
  assert.deepEqual([r2.propuesta.monto, r2.propuesta.falta, r2.propuesta.aclaraciones.length], [100, [], 2]);
});

test("una_respuesta_que_no_contesta_no_se_adivina_pero_si_se_conserva", () => {
  const r = aclarar({ propuesta: entendida("Compramos clavos."), respuesta: resp("en la ferretería de siempre"), personas, parcelas });
  assert.equal(r.ok, false); assert.match(r.dice, /No entendí esa respuesta\. ¿Cuánto costó\?/);
  assert.deepEqual([r.propuesta.monto ?? null, r.propuesta.aclaraciones[0].texto, r.propuesta.aclaraciones[0].entendido], [null, "en la ferretería de siempre", null]);
  const kilos = aclarar({ propuesta: entendida("Compramos clavos."), respuesta: resp("tres kilos"), personas, parcelas });
  assert.deepEqual([kilos.propuesta.monto ?? null, kilos.propuesta.cantidad.valor, kilos.propuesta.falta], [null, 3, ["cuánto costó"]], "tres kilos no son tres pesos");
});

test("la_parcela_la_gente_y_la_actividad_tambien_se_contestan_en_corto", () => {
  const a = aclarar({ propuesta: entendida("Terminamos tres reguladores."), respuesta: resp("de deshierbe en San Felipe 4"), personas, parcelas });
  assert.equal(a.ok, true); assert.deepEqual([a.propuesta.actividad, a.propuesta.parcelas[0].id], ["deshierbe", "sf4"]);
  const mensaje = { id: "m-av", canal: "chat", de: capataz, cuando: "2026-11-21T18:00:00.000Z" };
  assert.equal(preparar({ mensaje, entendido: { propuestas: [a.propuesta] } }).propuestas[0].lista, true);
});

test("otra_persona_aclara_como_se_pago_y_sigue_siendo_una_sola_operacion", () => {
  const p0 = entendida("Compramos un kilo de clavos, 350 pesos.");
  const r = aclarar({ propuesta: p0, respuesta: resp("Se pagó de caja chica", admin), personas, parcelas });
  assert.equal(r.ok, true); assert.deepEqual([r.propuesta.pagadoCon, r.propuesta.monto, r.propuesta.aclaraciones[0].de.nombre], ["caja_chica", 350, "Admin de prueba"]);
  const mensaje = { id: "m-caja", canal: "chat", de: capataz, cuando: "2026-11-21T18:00:00.000Z" };
  const plan = preparar({ mensaje, entendido: { propuestas: [r.propuesta] } });
  assert.equal(plan.propuestas.length, 1); assert.equal(decirPropuesta(plan.propuestas[0]), "Gasto de $350 · caja chica");
  const e = ejecutar(plan.propuestas[0], { mensaje, quien: admin, parcelas, ...sello() });
  assert.deepEqual([e.escrituras.length, e.escrituras[0].registro.pagadoCon, e.escrituras[0].registro.origen.aclaraciones[0].dijo], [1, "caja_chica", "Admin de prueba"]);
});

test("un_prestamo_dicho_nace_como_solicitud_no_como_gasto_ni_como_deuda", () => {
  const { mensaje, plan } = dicho("Le presté quinientos pesos a Juan.", admin), p = plan.propuestas[0];
  assert.deepEqual([p.tipo, p.lista, p.datos.monto, p.datos.personas[0].id], ["prestamo", true, 500, "t1"]); assert.match(p.aviso, /todavía no es deuda y no descuenta nada/);
  const r = ejecutar(p, { mensaje, quien: admin, parcelas, ...sello() });
  assert.deepEqual(r.escrituras.map(e => [e.coleccion, e.registro.tipo]), [["eventos", T_SOLICITUD]]);
  const pr = prestamosDe([r.escrituras[0].registro]);
  assert.equal(pr.filter(x => x.estado === "activo").length, 0, "nadie debe nada todavía");
  assert.equal(r.escrituras[0].registro.datos.dichoComoYaEntregado, true);
  const sinNombre = dicho("Le presté quinientos pesos.", admin).plan.propuestas[0];
  assert.deepEqual([sinNombre.tipo, sinNombre.falta], ["prestamo", ["a quién se le prestó"]]);
  const cruda = entendida("Le presté quinientos pesos.");
  assert.deepEqual(aclarar({ propuesta: cruda, respuesta: resp("a Pedro"), personas, parcelas }).propuesta.personas.map(x => x.id), ["t2"]);
});

test("un_telefono_conocido_no_basta_para_confirmar_lo_que_mueve_dinero", () => {
  const porTelefono = { ...admin, via: "telefono" };
  const g = dicho("Compramos un kilo de clavos, 350 pesos.", porTelefono);
  assert.deepEqual([g.plan.propuestas[0].permiso.puede, g.plan.propuestas[0].soloTelefono], [false, true]); assert.match(g.plan.propuestas[0].permiso.dice, /dentro de la app, con tu sesión/);
  assert.equal(ejecutar(g.plan.propuestas[0], { mensaje: g.mensaje, quien: porTelefono, parcelas, ...sello() }).requiereSesion, true, "ni siendo administrador");
  assert.equal(ejecutar(g.plan.propuestas[0], { mensaje: g.mensaje, quien: admin, parcelas, ...sello() }).ok, true, "con su sesión en la app, sí");
  const i = dicho("Se descompuso la bomba del pozo.", porTelefono);
  assert.equal(ejecutar(i.plan.propuestas[0], { mensaje: i.mensaje, quien: porTelefono, parcelas, ...sello() }).ok, true, "avisar de una falla no mueve dinero");
  assert.deepEqual(Object.entries(OPERACIONES).filter(([, o]) => o.dinero && !o.requiereSesion).map(([k]) => k), [], "todo lo que mueve dinero pide sesión");
});

test("la_pregunta_abierta_es_lo_ultimo_que_dijo_esa_persona_y_caduca", () => {
  const cruda = entendida("Compramos clavos.");
  const m = { id: "c1", de: capataz, cuando: "2026-11-21T18:00:00.000Z", propuestas: [{ ...cruda, id: "c1:0", confirmacion: null }] };
  const pend = pendienteDe([m], "enc1", "2026-11-21T18:10:00.000Z");
  assert.deepEqual([pend.propuesta.id, pend.pregunta], ["c1:0", "¿Cuánto costó?"]);
  assert.equal(esRespuesta({ pendiente: pend, texto: "20 pesos el kilo", personas, parcelas }).es, true);
  assert.equal(esRespuesta({ pendiente: pend, texto: "Oye, mañana hay que regar la 53 temprano porque va a hacer mucho calor.", personas, parcelas }).es, false, "un mensaje largo es otra cosa");
  assert.equal(esRespuesta({ pendiente: pend, texto: "ya llegó el camión", personas, parcelas }).es, false, "no contesta lo que se preguntó");
  assert.equal(pendienteDe([m], "enc1", "2026-11-23T18:10:00.000Z"), null, "dos días después ya no es una respuesta");
  assert.equal(pendienteDe([m, { id: "c2", de: capataz, cuando: "2026-11-21T18:05:00.000Z", propuestas: [] }], "enc1", "2026-11-21T18:10:00.000Z"), null, "si ya dijo otra cosa después, tampoco");
});
