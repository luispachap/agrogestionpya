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

test("un_prestamo_un_pago_o_una_aplicacion_no_se_guardan_parecido_por_otro_lado", () => {
  for (const [texto, pantalla, frase] of [["Le presté quinientos pesos a Juan.", "deudas", /Un préstamo no es un gasto y no descuenta nada solo/], ["Le pagué a Pedro mil pesos.", "nomina", /Pagos al personal/], ["Aplicamos herbicida en La 53.", "aplicaciones", /producto, dosis, quién la indicó y por qué/]]) {
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
