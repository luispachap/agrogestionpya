// La mensajería institucional: conversaciones, reglas y cómo lo que se dicen entre personas se vuelve UNA propuesta.
// Todo con gente y parcelas inventadas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clasificarMensaje } from "./chat.js";
import { preparar, ejecutar } from "./operaciones.js";
import { pedirConsulta, PERMISO_SUPERVISION, hallazgosDe, antecedentes, deDondeSalio, comoEvidencia, admiteArchivos, ROLES_QUE_ESCRIBEN, ROLES_QUE_ABREN, crearConversacion, cambiarConversacion, conversacionesDe, misConversaciones, puedeVer, puedeEscribir, tituloDe, mensajesDe, paraElAsistente, respuestaDelAsistente, relacionar, conRelacion, temasAbiertos, REGLAS, GENERAL, T_CONVERSACION } from "./mensajeria.js";

const parcelas = [{ id: "sf4", nombre: "San Felipe 4" }], personas = [{ id: "t1", nombre: "Juan Inventado" }];
const miguel = { id: "c-mig", nombre: "Miguel de Prueba", rol: "admin" }, fito = { id: "ag1", nombre: "Agrónomo de Prueba", rol: "agronomo" }, capataz = { id: "enc1", nombre: "Capataz de Prueba", rol: "encargado" }, finanzas = { id: "f1", nombre: "Finanzas de Prueba", rol: "finanzas" }, peon = { id: "t1", nombre: "Juan Inventado", rol: "trabajador" };
const sello = (min = 0) => ({ cuando: `2026-11-21T18:${String(min).padStart(2, "0")}:00.000Z`, fecha: "2026-11-21" });
let n = 0;
const msj = (de, texto, min, conversacion = "c1") => ({ ...clasificarMensaje({ mensaje: { id: `m${n++}`, de, cuando: sello(min).cuando, texto }, personas, parcelas, insumos: [], hoy: "2026-11-21" }), conversacion });

test("una_conversacion_directa_es_la_misma_la_abra_quien_la_abra", () => {
  const a = crearConversacion({ clase: "directa", miembros: [fito], quien: miguel, ...sello() }), b = crearConversacion({ clase: "directa", miembros: [miguel], quien: fito, ...sello(1) });
  assert.equal(a.ok && b.ok, true); assert.equal(a.evento.id, b.evento.id, "dos aparatos abriendo la misma plática no hacen dos");
  assert.equal(a.evento.tipo, T_CONVERSACION); assert.equal(a.evento.datos.institucional, true);
  const convs = conversacionesDe([a.evento, b.evento]);
  assert.equal(convs.length, 2, "la general y ésta"); const c = convs.find(x => x.id === a.evento.id);
  assert.equal(tituloDe(c, miguel), "Agrónomo de Prueba"); assert.equal(tituloDe(c, fito), "Miguel de Prueba");
  assert.equal(crearConversacion({ clase: "directa", miembros: [fito, capataz], quien: miguel, ...sello() }).ok, false);
  assert.equal(crearConversacion({ clase: "grupo", nombre: " ", miembros: [fito], quien: miguel, ...sello() }).ok, false, "un grupo sin nombre no se encuentra");
});

test("una_conversacion_la_leen_sus_participantes_y_nadie_mas_ni_la_administracion", () => {
  const g = crearConversacion({ clase: "grupo", nombre: "Riego", miembros: [fito], quien: capataz, ...sello() }).evento, c = conversacionesDe([g]).find(x => x.id === g.id);
  assert.equal(puedeVer(c, fito).ve, true); assert.equal(puedeVer(c, capataz).ve, true);
  assert.deepEqual([puedeVer(c, finanzas).ve, puedeEscribir(c, finanzas)], [false, false]);
  assert.deepEqual([puedeVer(c, miguel).ve, puedeEscribir(c, miguel)], [false, false], "ser administrador no abre una conversación ajena");
  assert.equal(puedeVer(c, peon).ve, false);
  assert.deepEqual(misConversaciones({ eventos: [g], mensajes: [], persona: miguel }).map(x => x.id), [GENERAL]);
  assert.ok(REGLAS.some(r => /institucionales/.test(r)) && REGLAS.some(r => /No son para vigilar/.test(r)) && REGLAS.some(r => /tampoco la administración/.test(r)) && REGLAS.some(r => /se conservan/.test(r)) && REGLAS.some(r => /DIJO.*INTERPRETÓ.*CONFIRMÓ.*REGISTRADO/.test(r)));
});

test("la_consulta_excepcional_pide_permiso_otorgado_y_motivo_es_de_solo_lectura_y_se_vence", () => {
  const g = crearConversacion({ clase: "grupo", nombre: "Riego", miembros: [fito], quien: capataz, ...sello() }).evento, c = conversacionesDe([g]).find(x => x.id === g.id);
  const direccion = { id: "d1", nombre: "Dirección de Prueba", rol: "dueno" };
  assert.match(pedirConsulta({ conversacion: c, motivo: "Revisar una queja de un proveedor", persona: miguel, otorgados: [] }).dice, /Ser administrador no lo da/);
  assert.equal(pedirConsulta({ conversacion: c, motivo: "ver", persona: direccion, otorgados: [PERMISO_SUPERVISION] }).ok, false, "sin motivo no hay consulta");
  assert.equal(pedirConsulta({ conversacion: c, motivo: "Revisar una queja de un proveedor", persona: direccion, otorgados: [PERMISO_SUPERVISION] }).ok, true);
  const consultas = [{ conversacion: c.id, usuario: "d1", motivo: "Revisar una queja de un proveedor", hasta: "2026-11-22T18:00:00.000Z" }];
  const v = puedeVer(c, direccion, { consultas, ahora: "2026-11-21T19:00:00.000Z" });
  assert.deepEqual([v.ve, v.porConsulta, puedeEscribir(c, direccion)], [true, true, false]);
  assert.equal(puedeVer(c, direccion, { consultas, ahora: "2026-11-22T18:00:01.000Z" }).ve, false, "a las 24 horas se cierra");
  assert.equal(puedeVer(c, miguel, { consultas, ahora: "2026-11-21T19:00:00.000Z" }).ve, false, "la consulta es de quien la pidió");
});

test("un_grupo_por_funcion_incluye_a_quien_tenga_ese_puesto_y_sus_cambios_dejan_historia", () => {
  const g = crearConversacion({ clase: "grupo", nombre: "Compras", miembros: [{ tipo: "rol", rol: "finanzas" }], quien: capataz, ...sello() }).evento;
  let c = conversacionesDe([g]).find(x => x.id === g.id);
  assert.equal(puedeEscribir(c, finanzas), true, "entra por su puesto, sin darlo de alta por nombre");
  const cambio = cambiarConversacion({ conversacion: c, agregar: [fito], quitar: [{ tipo: "rol", rol: "finanzas" }], quien: capataz, ...sello(5) });
  c = conversacionesDe([g, cambio.evento]).find(x => x.id === g.id);
  assert.deepEqual([puedeEscribir(c, fito), puedeEscribir(c, finanzas), c.historial.length, c.historial[0].agrego, c.historial[0].quito], [true, false, 1, ["Agrónomo de Prueba"], ["Finanzas"]]);
  assert.equal(cambiarConversacion({ conversacion: c, agregar: [finanzas], quien: finanzas, ...sello(6) }).ok, false, "nadie se mete solo a un grupo");
});

test("lo_que_ya_habia_sin_conversacion_es_la_general", () => {
  const viejo = { id: "v1", de: capataz, cuando: sello().cuando, texto: "hola" };
  assert.equal(mensajesDe([viejo, { ...viejo, id: "v2", conversacion: "c9" }], GENERAL).length, 1);
});

test("el_encargado_reporta_la_compra_y_miguel_aclara_que_fue_de_caja_chica_es_una_sola_operacion", () => {
  const m1 = msj(capataz, "Compramos un kilo de clavos, 350 pesos.", 0);
  const nuevo = { id: "m-b", de: miguel, cuando: sello(3).cuando, texto: "Se pagó de caja chica" };
  const r = relacionar({ mensajes: [m1], nuevo, personas, parcelas });
  assert.deepEqual([r.clase, r.con.mensaje, r.con.dijo, r.propuesta.pagadoCon], ["aclaracion", m1.id, "Capataz de Prueba", "caja_chica"]);
  // El mensaje de Miguel NO produce otro gasto: actualiza la propuesta del primero.
  const m1b = { ...m1, propuestas: m1.propuestas.map(p => (p.id === r.propuesta.id ? r.propuesta : p)) };
  const plan = preparar({ mensaje: { id: m1.id, canal: "chat", de: capataz, cuando: m1.cuando }, entendido: { propuestas: m1b.propuestas } });
  assert.equal(plan.propuestas.filter(p => p.tipo === "gasto").length, 1);
  const e = ejecutar(plan.propuestas.find(p => p.tipo === "gasto"), { mensaje: plan.mensaje, quien: miguel, parcelas, ...sello(4) });
  assert.deepEqual([e.escrituras.length, e.escrituras[0].coleccion, e.escrituras[0].registro.monto, e.escrituras[0].registro.pagadoCon], [1, "egresos", 350, "caja_chica"]);
  const o = e.escrituras[0].registro.origen;
  assert.deepEqual([o.dijo, o.aclaraciones[0].dijo, o.aclaraciones[0].texto, o.confirmo], ["Capataz de Prueba", "Miguel de Prueba", "Se pagó de caja chica", "Miguel de Prueba"], "quién lo dijo, quién lo aclaró y quién lo confirmó");
});

test("otra_persona_contesta_lo_que_faltaba_y_no_nace_un_gasto_de_veinte_pesos", () => {
  const m1 = msj(capataz, "Compramos tres kilos de clavos.", 0);
  const r = relacionar({ mensajes: [m1], nuevo: { id: "m-c", de: miguel, cuando: sello(2).cuando, texto: "20 pesos el kilo" }, personas, parcelas });
  assert.deepEqual([r.clase, r.propuesta.monto], ["aclaracion", 60]);
  assert.equal(relacionar({ mensajes: [m1], nuevo: { id: "m-d", de: miguel, cuando: "2026-11-23T18:00:00.000Z", texto: "20 pesos el kilo" }, personas, parcelas }), null, "dos días después ya no es respuesta de aquello");
});

test("miguel_reporta_una_plaga_y_fito_dice_que_la_va_a_revisar_observacion_y_pendiente_sin_diagnostico", () => {
  const m1 = msj(miguel, "Vimos mucha plaga en San Felipe 4.", 0);
  const obs = preparar({ mensaje: { id: m1.id, canal: "chat", de: miguel, cuando: m1.cuando }, entendido: { propuestas: m1.propuestas } }).propuestas[0];
  assert.deepEqual([obs.tipo, obs.naturaleza, obs.datos.parcelaId], ["nota", "observacion", "sf4"]);
  const m2 = msj(fito, "Mañana la voy a inspeccionar.", 5);
  const r = relacionar({ mensajes: [m1], nuevo: m2, personas, parcelas });
  assert.deepEqual([r.clase, r.con.mensaje], ["seguimiento", m1.id]); assert.match(r.dice, /no dice qué es ni qué lo causa/);
  const props = conRelacion(m2.propuestas, r);
  const pend = preparar({ mensaje: { id: m2.id, canal: "chat", de: fito, cuando: m2.cuando }, entendido: { propuestas: props } }).propuestas[0];
  assert.deepEqual([pend.tipo, pend.naturaleza, pend.sobre.clase, pend.sobre.mensaje, pend.datos.parcelaId, pend.heredado], ["nota", "plan", "seguimiento", m1.id, "sf4", ["parcela"]]);
  const e = ejecutar(pend, { mensaje: { id: m2.id, canal: "chat", de: fito, cuando: m2.cuando }, quien: fito, parcelas, ...sello(6) }).escrituras[0];
  assert.deepEqual([e.coleccion, e.registro.naturaleza, e.registro.sobre.frase], ["bitacora", "plan", "Vimos mucha plaga en San Felipe 4."]);
  const todo = JSON.stringify([obs, pend, e.registro, r]).toLowerCase();
  for (const palabra of ["trips", "hongo", "enfermedad", "pudricion", "roya", "falta de riego", "se recomienda", "aplicar"]) assert.equal(todo.includes(palabra), false, `no se inventa un diagnóstico (${palabra})`);
});

test("fito_programa_una_aplicacion_y_despues_alguien_dice_que_ya_se_hizo_son_dos_momentos", () => {
  const m1 = msj(fito, "Mañana hay que aplicar el fungicida en San Felipe 4.", 0);
  const prog = preparar({ mensaje: { id: m1.id, canal: "chat", de: fito, cuando: m1.cuando }, entendido: { propuestas: m1.propuestas } }).propuestas[0];
  assert.deepEqual([prog.tipo, prog.naturaleza], ["nota", "plan"], "lo programado no se registra como aplicación hecha");
  const m2 = msj(capataz, "Ya se aplicó.", 30);
  const r = relacionar({ mensajes: [m1], nuevo: m2, personas, parcelas });
  assert.deepEqual([r.clase, r.momento, r.con.mensaje], ["ejecucion", "ejecutado", m1.id]);
  const ej = preparar({ mensaje: { id: m2.id, canal: "chat", de: capataz, cuando: m2.cuando }, entendido: { propuestas: conRelacion(m2.propuestas, r) } }).propuestas[0];
  assert.deepEqual([ej.momento, ej.sobre.mensaje, ej.datos.parcelaId], ["ejecutado", m1.id, "sf4"]);
  assert.notEqual(ej.id, prog.id, "lo ejecutado no pisa lo programado: quedan los dos");
  assert.equal(relacionar({ mensajes: [], nuevo: m2, personas, parcelas }), null, "«ya se aplicó» sin nada programado antes no se cuelga de nada");
});

test("un_mensaje_que_no_tiene_que_ver_no_se_relaciona_y_lo_firmado_ya_no_es_tema_abierto", () => {
  const m1 = msj(capataz, "Compramos tres kilos de clavos.", 0);
  assert.equal(relacionar({ mensajes: [m1], nuevo: { id: "x", de: miguel, cuando: sello(2).cuando, texto: "¿A qué hora llega el camión?" }, personas, parcelas }), null);
  const firmado = { ...m1, propuestas: m1.propuestas.map(p => ({ ...p, confirmacion: { estado: "rechazado" } })) };
  assert.equal(temasAbiertos([firmado], sello(5).cuando).length, 0);
});

test("al_asistente_se_le_habla_por_su_nombre_y_si_no_se_queda_callado", () => {
  assert.deepEqual(paraElAsistente("Agro, compramos clavos"), { es: true, texto: "compramos clavos" });
  assert.equal(paraElAsistente("@agro ¿qué falta por confirmar?").es, true); assert.equal(paraElAsistente("Oye Agro: ya llegó").es, true);
  assert.equal(paraElAsistente("El agrónomo dijo que mañana").es, false); assert.equal(paraElAsistente("Agroquímicos llegaron hoy").es, false);
  const m = msj(capataz, "Compramos clavos.", 0);
  const plan = preparar({ mensaje: { id: m.id, canal: "chat", de: capataz, cuando: m.cuando }, entendido: { propuestas: m.propuestas } });
  assert.match(respuestaDelAsistente({ plan }), /«Compramos clavos\.» — ¿Cuánto costó\?/);
});

test("direccion_lee_y_no_escribe_y_finanzas_participa_pero_no_abre_conversaciones", () => {
  const general = conversacionesDe([]).find(c => c.id === GENERAL), dueno = { id: "d1", nombre: "Dirección de Prueba", rol: "dueno" };
  assert.deepEqual([puedeVer(general, dueno).ve, puedeEscribir(general, dueno)], [true, false]);
  assert.equal(puedeEscribir(general, finanzas), true);
  assert.equal(crearConversacion({ clase: "grupo", nombre: "Pagos", miembros: [miguel], quien: finanzas, ...sello() }).ok, false, "la base no le deja crear eventos: la app no se lo ofrece");
  assert.deepEqual([ROLES_QUE_ESCRIBEN.includes("dueno"), ROLES_QUE_ABREN.includes("finanzas")], [false, false]);
});

test("de_un_hallazgo_se_puede_preguntar_de_donde_salio_y_se_separa_lo_dicho_lo_interpretado_lo_confirmado_y_lo_registrado", () => {
  const g = crearConversacion({ clase: "grupo", nombre: "Campo", miembros: [fito], quien: miguel, ...sello() }).evento, convs = conversacionesDe([g]);
  const m1 = { ...msj(miguel, "Vimos mucha maleza en San Felipe 4.", 0, g.id) };
  const m2 = { ...msj(capataz, "Compramos tres kilos de clavos.", 5, g.id) };
  const conAclaracion = { ...m2, propuestas: m2.propuestas.map(p => ({ ...p, monto: 60, falta: [], aclaraciones: [{ id: "m-a", pregunta: "¿Cuánto costó?", texto: "20 pesos el kilo", de: { id: miguel.id, nombre: miguel.nombre }, cuando: sello(6).cuando, entendido: "$20 por unidad × 3 kilos = $60" }], confirmacion: { estado: "confirmado", quien: "Miguel de Prueba", cuando: sello(7).cuando }, quedoEn: "Gasto: quedó en Egresos." })) };
  const hs = hallazgosDe({ mensajes: [m1, conAclaracion], conversaciones: convs });
  const maleza = hs.find(h => /maleza/.test(h.dicho[0].texto)), compra = hs.find(h => h.tipo === "gasto");
  assert.deepEqual([maleza.tema, maleza.estado, maleza.parcelaId, maleza.dicho[0].quien, maleza.dicho[0].enConversacion], ["observación de campo", "interpretado", "sf4", "Miguel de Prueba", "Campo"]);
  const r1 = deDondeSalio(maleza);
  assert.match(r1.dicho[0].linea, /Miguel de Prueba, 2026-11-21 18:00 UTC, en Campo: «Vimos mucha maleza en San Felipe 4\.»/);
  assert.equal(r1.confirmado, "Nadie lo ha confirmado: es sólo una interpretación."); assert.equal(r1.registrado, "No quedó registrado en ningún módulo.");
  const r2 = deDondeSalio(compra);
  assert.deepEqual([compra.estado, r2.dicho.length, r2.dicho[1].quien, r2.dicho[1].aclara], ["registrado", 2, "Miguel de Prueba", "¿Cuánto costó?"]);
  assert.ok(r2.interpretado.some(x => /De una aclaración: \$20 por unidad × 3 kilos = \$60/.test(x))); assert.match(r2.confirmado, /Lo confirmó Miguel de Prueba/); assert.match(r2.registrado, /Egresos/);
  // Antecedentes: qué se ha dicho de una parcela o de un tema.
  assert.deepEqual(antecedentes(hs, { parcelaId: "sf4" }).map(h => h.tema), ["observación de campo"]);
  assert.deepEqual(antecedentes(hs, { texto: "clavos" }).map(h => h.tipo), ["gasto"]); assert.equal(antecedentes(hs, { tema: "compra", estado: "interpretado" }).length, 0);
});

test("lo_registrado_de_una_conversacion_ajena_se_consulta_pero_sus_mensajes_son_evidencia_aparte", () => {
  const gasto = { id: "g1", fecha: "2026-11-21", concepto: "Compramos tres kilos de clavos.", monto: 60, origen: { mensaje: "m-ajeno", canal: "chat", frase: "Compramos tres kilos de clavos.", dijo: "Capataz de Prueba", confirmo: "Miguel de Prueba", aclaraciones: [{ mensaje: "m-ajeno-2", pregunta: "¿Cuánto costó?", texto: "20 pesos el kilo", dijo: "Miguel de Prueba", cuando: sello(6).cuando, entendido: "$60" }] } };
  const hs = hallazgosDe({ mensajes: [], conversaciones: [], registros: { egresos: [gasto, { id: "g2", monto: 5 }] } });
  assert.equal(hs.length, 1, "un gasto tecleado a mano no es un hallazgo de conversación");
  const r = deDondeSalio(hs[0]);
  assert.deepEqual([hs[0].estado, hs[0].dicho[0].disponible, hs[0].dicho[0].enConversacion], ["registrado", false, "una conversación en la que no participas"]);
  assert.deepEqual(r.evidenciaFuera, ["m-ajeno", "m-ajeno-2"], "para ver esos mensajes completos hace falta el permiso de evidencia");
  assert.match(r.confirmado, /Miguel de Prueba/);
});

test("lo_confirmado_marca_sus_mensajes_como_evidencia_y_lo_de_dinero_como_sensible", () => {
  assert.deepEqual([comoEvidencia({ id: "a" }).esEvidencia, comoEvidencia({ id: "a" }).sensible, comoEvidencia({ id: "a" }, { sensible: true }).sensible], [true, undefined, true]);
  assert.equal(admiteArchivos({ id: "ev-conv-x" }), true, "los archivos ya tienen candado por conversación (hoja 48)");
});

test("los_adjuntos_de_una_conversacion_cerrada_van_a_su_carpeta_y_los_de_la_general_no", async () => {
  const { carpetaDe } = await import("./mensajeria.js"); const { sacarArchivos, leerReferencia } = await import("./archivos.js");
  assert.equal(carpetaDe(GENERAL), ""); assert.equal(carpetaDe(undefined), ""); assert.equal(carpetaDe("ev-conv-d-a-b"), "c/ev-conv-d-a-b/"); assert.equal(carpetaDe("../otra/x"), "c/otrax/", "no se puede salir de la carpeta");
  const foto = `data:image/jpeg;base64,${Buffer.from("x".repeat(5000)).toString("base64")}`;
  const r = sacarArchivos({ id: "m1", foto: { dataUrl: foto } }, { carpeta: carpetaDe("ev-conv-1") });
  assert.match(r.registro.foto.dataUrl, /^archivo:c\/ev-conv-1\/[0-9a-f]{64}\.jpg$/); assert.match(r.archivos[0].ruta, /^c\/ev-conv-1\/[0-9a-f]{64}\.jpg$/);
  assert.equal(leerReferencia(r.registro.foto.dataUrl).ruta, r.archivos[0].ruta);
  const comun = sacarArchivos({ id: "m2", foto: { dataUrl: foto } });
  assert.match(comun.archivos[0].ruta, /^[0-9a-f]{64}\.jpg$/); assert.notEqual(comun.archivos[0].id, r.archivos[0].id, "el mismo archivo en dos lugares son dos archivos: cada uno con su candado");
});
