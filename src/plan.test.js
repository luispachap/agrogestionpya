// ============================================================
//  Pruebas de la planeación del día
//
//  El hilo de todas: la app reparte lo que OYÓ, no lo que supone. Una tarea
//  sin persona se queda arriba, sin mandarse a nadie — repartir mal el día es
//  peor que no repartirlo.
//
//  El dictado de aquí es el de Gera de verdad, el de las seis de la mañana.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  repartirElDia, aQueSeVaCadaQuien, quienNoTieneNada, chocanLasTareas,
  indicacionParaElTrabajador, comoVaElDia, deLaHojaDeFito,
  queLabor, queMaquinas, horaDicha, horasDichas, paraQueDia, partirEnTareas,
} from "./plan.js";
import { leerFertiriego, indicacionDesdeHoja } from "./fertiriego.js";

const GENTE = [
  { id: "t1", nombre: "Juan Pérez" },
  { id: "t2", nombre: "Pedro Ramírez" },
  { id: "t3", nombre: "Salvador Núñez", apodo: "El Chato" },
  { id: "t4", nombre: "Ramiro Ávila" },
  { id: "t5", nombre: "Aurelio Luna" },
];
const PARCELAS = [
  { id: "p1", nombre: "53" },
  { id: "p2", nombre: "Naranjo" },
  { id: "p3", nombre: "Bodega" },
  { id: "p4", nombre: "San Felipe 1" },
];
const MAQUINAS = [
  { id: "m3", nombre: "Tractor 3" },
  { id: "m30", nombre: "Tractor 30" },
];

/* Como reparte Gera de verdad: de corrido, en una sola bocanada. */
const LO_QUE_DIJO_GERA =
  "Hoy Juan y Pedro se van a la 53 a regar, el Chato que ande con el tractor 3 " +
  "en el Naranjo levantando la basura, y a Ramiro mándalo a la bodega por los sacos de fosfonitrato.";

const REPARTO = () => repartirElDia({
  texto: LO_QUE_DIJO_GERA, personas: GENTE, parcelas: PARCELAS, maquinaria: MAQUINAS,
  hoy: "2026-09-08", deQuien: "Gera", dichoALas: "6:10",
});

/* ════════════ REPARTIR LO DICHO ════════════ */

test("reparte_de_corrido_lo_que_gera_dijo_en_una_sola_bocanada", () => {
  const r = REPARTO();
  assert.equal(r.todas.length, 3);
  assert.equal(r.tareas.length, 3);
  assert.equal(r.sinAsignar.length, 0);

  const [regar, limpiar, acarrear] = r.tareas;
  assert.equal(regar.que, "regar");
  assert.deepEqual(regar.personas.map(p => p.id), ["t1", "t2"]);
  assert.equal(regar.parcela.id, "p1");

  assert.equal(limpiar.que, "limpiar");
  assert.deepEqual(limpiar.personas.map(p => p.id), ["t3"]);
  assert.equal(limpiar.parcela.id, "p2");
  assert.equal(limpiar.maquina.id, "m3");

  assert.equal(acarrear.que, "acarrear");
  assert.deepEqual(acarrear.personas.map(p => p.id), ["t4"]);
  assert.equal(acarrear.parcela.id, "p3");
});

test("juan_y_pedro_son_una_cuadrilla_no_dos_tareas", () => {
  // Si la "y" partiera la frase, saldrían dos tareas: una para Juan sin qué
  // hacer, y Pedro se iría solo a regar once hectáreas.
  const pedazos = partirEnTareas("Juan y Pedro se van a la 53 a regar", GENTE);
  assert.equal(pedazos.length, 1);
  assert.ok(pedazos[0].includes("Juan"));
  assert.ok(pedazos[0].includes("Pedro"));
});

test("una_tarea_sin_persona_no_se_da_por_asignada", () => {
  // LA REGLA DEL MÓDULO. Se queda arriba hasta que alguien diga de quién es.
  const r = repartirElDia({
    texto: "Hay que ir a limpiar el Naranjo.",
    personas: GENTE, parcelas: PARCELAS, hoy: "2026-09-08",
  });
  assert.equal(r.tareas.length, 0);
  assert.equal(r.sinAsignar.length, 1);
  assert.equal(r.sinAsignar[0].asignada, false);
  assert.ok(r.sinAsignar[0].falta.includes("a quién le toca"));
  assert.ok(r.dice.includes("NO se mandan a nadie"));
});

test("una_tarea_sin_persona_no_se_manda_a_nadie", () => {
  const r = repartirElDia({
    texto: "Hay que ir a limpiar el Naranjo.",
    personas: GENTE, parcelas: PARCELAS, hoy: "2026-09-08",
  });
  const ind = indicacionParaElTrabajador(r.sinAsignar[0]);
  assert.equal(ind.mandable, false);
  assert.equal(ind.texto, null);
  assert.equal(ind.mensajes.length, 0);
});

test("si_dos_se_llaman_igual_la_tarea_se_queda_sin_asignar", () => {
  // Se oyó un nombre, pero no se sabe de quién es. Mandarle el día al que no
  // era es peor que no mandárselo a nadie.
  const dosChatos = [...GENTE, { id: "t9", nombre: "Efraín Soto", apodo: "El Chato" }];
  const r = repartirElDia({
    texto: "El Chato que ande limpiando el Naranjo.",
    personas: dosChatos, parcelas: PARCELAS, hoy: "2026-09-08",
  });
  assert.equal(r.tareas.length, 0);
  assert.equal(r.sinAsignar.length, 1);
  assert.equal(r.sinAsignar[0].personas.length, 0);
  assert.ok(r.sinAsignar[0].ambiguos.length >= 1);
  assert.equal(r.sinAsignar[0].ambiguos[0].candidatos.length, 2);
  assert.ok(r.sinAsignar[0].falta.includes("cuál de los que se llaman así es"));
});

test("nada_se_guarda_ni_se_manda_solo_y_nada_bloquea", () => {
  const r = REPARTO();
  assert.equal(r.guardaSolo, false);
  assert.equal(r.mandaSolo, false);
  assert.equal(r.bloquea, false);
  assert.equal(indicacionParaElTrabajador(r.tareas[0]).mandaSolo, false);
});

test("lo_que_falta_se_dice_pero_la_tarea_se_manda_igual", () => {
  // Si la app exige el dictado perfecto, el día se reparte por teléfono y la
  // app se queda vacía.
  const r = repartirElDia({
    texto: "Aurelio se va a barbechar.", personas: GENTE, parcelas: PARCELAS,
    hoy: "2026-09-08", deQuien: "Gera",
  });
  const t = r.tareas[0];
  assert.equal(t.parcela, null);
  assert.deepEqual(t.falta, ["en qué parcela"]);
  assert.equal(r.bloquea, false);
  assert.equal(indicacionParaElTrabajador(t).mandable, true);
});

test("dos_encargos_pegados_se_marcan_para_revisar_no_se_mandan_como_uno", () => {
  // "Juan a la 53 y Pedro al Naranjo" son DOS encargos, uno de cada quien.
  // La app no los sabe separar sin adivinar quién va a dónde, pero callarse
  // que oyó dos personas y dos parcelas manda a los dos a los dos lados —
  // que es exactamente el daño que este módulo existe para no hacer.
  const r = repartirElDia({
    texto: "Juan que se vaya a la 53 y Pedro al Naranjo a regar.",
    personas: GENTE, parcelas: PARCELAS, hoy: "2026-09-08",
  });
  const t = r.tareas[0];
  assert.equal(t.personas.length, 2);
  assert.equal(t.parcelas.length, 2);
  assert.ok(t.falta.length > 0, "una tarea con dos personas y dos parcelas NO está completa");
  assert.ok(t.falta.includes("en cuál parcela va cada quien"));
  assert.ok(t.porque.includes("dos encargos distintos"), t.porque);
  assert.equal(r.incompletas.length, 1);
});

test("la_maquina_que_se_nombro_no_se_borra_del_encargo", () => {
  // Guardarla sólo cuando hay una y callar cuando hay dos deja el recado con
  // cara de completo y sin tractor: el Chato llega al Naranjo a levantar la
  // basura y no sabe con qué máquina.
  const r = repartirElDia({
    texto: "El Chato que ande con el tractor 3 o el tractor 30 en el Naranjo levantando la basura.",
    personas: GENTE, parcelas: PARCELAS, maquinaria: MAQUINAS, hoy: "2026-09-08",
  });
  const t = r.tareas[0];
  assert.equal(t.maquina, null);
  assert.equal(t.maquinas.length, 2);
  assert.ok(t.falta.includes("con cuál máquina"));
  assert.ok(t.dice.includes("Tractor 3 o el Tractor 30"), t.dice);

  const texto = indicacionParaElTrabajador(t, GENTE[2]).texto;
  assert.ok(texto.includes("Tractor 3 o el Tractor 30"), texto);
  assert.ok(texto.includes("dinos con cuál"), texto);
});

test("el_apodo_viene_dentro_del_nombre_en_la_nomina_de_verdad", () => {
  // En la nómina real el apodo NO tiene campo propio: va dentro del nombre y
  // entre paréntesis. Y Gera nombra a la gente por el apodo, siempre. Sin
  // esto el dictado entero caía en la columna roja mientras las pruebas
  // seguían verdes, porque el fixture inventaba un campo `apodo` que los
  // datos de verdad no tienen.
  const NOMINA = [
    { id: "t_e01", nombre: "ANASTASIO PRUEBA UNO (TACHO)", categoria: "jornalero" },
    { id: "t_e04", nombre: "ZENON PRUEBA DOS (ZURDO)", categoria: "jornalero" },
    { id: "t_e10", nombre: "ALBERTO PRUEBA TRES (BETO)", categoria: "jornalero" },
  ];
  const conApodo = (texto) => repartirElDia({
    texto, personas: NOMINA, parcelas: PARCELAS, hoy: "2026-09-08",
  });

  const zurdo = conApodo("El Zurdo se va a la 53 a regar.");
  assert.equal(zurdo.sinAsignar.length, 0);
  assert.deepEqual(zurdo.tareas[0].personas.map(p => p.id), ["t_e04"]);

  assert.deepEqual(conApodo("Beto se va a barbechar el Naranjo.").tareas[0].personas.map(p => p.id), ["t_e10"]);
  assert.deepEqual(conApodo("Tacho que limpie la bodega.").tareas[0].personas.map(p => p.id), ["t_e01"]);
});

test("una_parcela_que_se_llama_como_un_trabajador_no_le_asigna_el_dia", () => {
  // El rancho tiene parcelas "SAN FELIPE 1", "MARCOS" y "RANCHO NARANJO". Si
  // el nombre de la parcela cuenta como si hubieran nombrado a la persona,
  // Felipe recibe en su teléfono un día de trabajo que nadie le dio y nada en
  // la pantalla señala que ahí pasó algo raro.
  const conFelipe = [...GENTE, { id: "t6", nombre: "Felipe Cruz" }];
  const r = repartirElDia({
    texto: "Juan se va a San Felipe 1 a regar.",
    personas: conFelipe, parcelas: PARCELAS, hoy: "2026-09-08",
  });
  assert.deepEqual(r.tareas[0].personas.map(p => p.id), ["t1"]);
  assert.equal(r.tareas[0].parcela.id, "p4");
  assert.ok(!r.tareas[0].dice.includes("Felipe Cruz"), r.tareas[0].dice);

  const q = quienNoTieneNada({ tareas: r.tareas, personas: conFelipe });
  assert.ok(q.sinTarea.some(p => p.id === "t6"), "Felipe no tenía nada que ver con este encargo");
});

/* ════════════ NO INVENTAR UN DATO ════════════ */

test("no_se_inventa_la_parcela_ni_la_maquina_que_no_se_nombraron", () => {
  const r = repartirElDia({
    texto: "Aurelio anda barbechando.", personas: GENTE, parcelas: PARCELAS,
    maquinaria: MAQUINAS, hoy: "2026-09-08",
  });
  const t = r.tareas[0];
  assert.equal(t.parcela, null);
  assert.equal(t.maquina, null);
  assert.equal(t.hora, null);
  assert.deepEqual(t.parcelas, []);
  assert.deepEqual(t.maquinas, []);
});

test("la_53_no_es_la_una_de_la_tarde", () => {
  // El bug que la regla previene: «se van a la 53 a regar» se leía como
  // «a la 5, 3 de la tarde» y salía una hora que nadie dijo. Una hora
  // inventada manda a la cuadrilla al campo antes de que llegue el agua.
  assert.equal(horaDicha("se van a la 53 a regar"), null);
  assert.equal(horaDicha("Juan a la 5 a regar"), null);
  assert.equal(horaDicha("van a las parcelas a regar"), null);
});

test("la_hora_dicha_con_la_boca_se_entiende", () => {
  assert.equal(horaDicha("desde las siete"), "07:00");
  assert.equal(horaDicha("a las 6:30 en la 53"), "06:30");
  assert.equal(horaDicha("a las siete de la mañana"), "07:00");
  assert.equal(horaDicha("a las cinco de la tarde"), "17:00");
  assert.equal(horaDicha("a la una de la tarde"), "13:00");
  assert.equal(horaDicha("a las ocho y media"), "08:30");
});

test("manana_de_la_manana_no_es_el_dia_siguiente", () => {
  // Sin acentos "mañana" y "de la mañana" se ven igual. Confundirlas manda la
  // tarea al día siguiente: la gente llega y no hay quién le abra la bodega.
  assert.equal(paraQueDia("Juan riega a las siete de la mañana", "2026-09-08"), "2026-09-08");
  assert.equal(paraQueDia("mañana Juan riega la 53", "2026-09-08"), "2026-09-09");
  assert.equal(paraQueDia("pasado mañana se barbecha", "2026-09-08"), "2026-09-10");
});

test("por_la_manana_y_en_la_manana_tambien_son_hoy", () => {
  // Nadie dice sólo "de la mañana". Se dice "por la mañana", "en la mañana",
  // "esta mañana", y las tres son HOY. Taparle nada más una es dejar el bug
  // puesto con una prueba en verde: la tarea se corre al día siguiente, la
  // gente llega y no hay quién le abra la bodega, y encima esa tarea
  // desaparece del seguimiento de hoy, que es donde alguien la habría echado
  // de menos.
  assert.equal(paraQueDia("Juan riega la 53 por la mañana", "2026-09-08"), "2026-09-08");
  assert.equal(paraQueDia("Juan riega la 53 en la mañana", "2026-09-08"), "2026-09-08");
  assert.equal(paraQueDia("esta mañana se barbecha el Naranjo", "2026-09-08"), "2026-09-08");
  // Y lo que sí es el día siguiente sigue siéndolo.
  assert.equal(paraQueDia("mañana temprano se riega la 53", "2026-09-08"), "2026-09-09");
  assert.equal(paraQueDia("mañana por la mañana se riega la 53", "2026-09-08"), "2026-09-09");

  const r = repartirElDia({
    texto: "Juan riega la 53 por la mañana.", personas: GENTE, parcelas: PARCELAS,
    hoy: "2026-09-08", deQuien: "Gera",
  });
  assert.equal(r.tareas[0].fecha, "2026-09-08");
  assert.equal(r.tareas[0].cuandoDicho, "Hoy");
  // Y como es de hoy, sale en el seguimiento de hoy.
  assert.equal(comoVaElDia({ tareas: r.tareas, confirmaciones: [], hoy: "2026-09-08" }).total, 1);
});

test("las_siete_de_la_manana_no_son_las_siete_de_la_noche", () => {
  // Dos vueltas de riego en un mismo encargo. Buscar "de la tarde" en TODA la
  // frase le pegaba la tarde de la segunda hora a la primera: se dijo a las
  // siete de la mañana y le llegaba a las siete de la NOCHE, doce horas
  // después. Y la segunda hora se perdía sin decirlo.
  assert.deepEqual(
    horasDichas("Juan riega la 53 a las siete de la mañana y a las cuatro de la tarde."),
    ["07:00", "16:00"],
  );

  const r = repartirElDia({
    texto: "Juan riega la 53 a las siete de la mañana y a las cuatro de la tarde.",
    personas: GENTE, parcelas: PARCELAS, hoy: "2026-09-08",
  });
  assert.equal(r.todas.length, 1);
  assert.deepEqual(r.tareas[0].horas, ["07:00", "16:00"]);
  // Con dos horas dichas no se elige una: elegir sería inventar.
  assert.equal(r.tareas[0].hora, null);

  const texto = indicacionParaElTrabajador(r.tareas[0], GENTE[0]).texto;
  assert.ok(texto.includes("a las 07:00 y a las 16:00"), texto);
  assert.ok(!texto.includes("19:00"), texto);
});

test("el_tractor_3_no_es_el_tractor_30", () => {
  // Mandar al tractorista a la máquina equivocada es un día perdido y un
  // horómetro que ya no cuadra con nada.
  const r = queMaquinas("que ande con el tractor 3 en el Naranjo", MAQUINAS);
  assert.equal(r.maquinas.length, 1);
  assert.equal(r.maquinas[0].id, "m3");
});

test("si_no_se_entendio_la_faena_no_se_inventa_una", () => {
  const l = queLabor("que le eche una vuelta al asunto ese");
  assert.equal(l.que, null);
  assert.equal(l.queDice, null);
});

/* ════════════ LA INDICACIÓN QUE LE LLEGA AL TELÉFONO ════════════ */

test("la_indicacion_se_lee_de_un_vistazo_y_no_lleva_ids_ni_jerga", () => {
  const r = REPARTO();
  const juan = GENTE[0];
  const ind = indicacionParaElTrabajador(r.tareas[0], juan);
  assert.equal(ind.texto, "Hoy: regar la parcela 53 con Pedro Ramírez. Dijo Gera a las 6:10.");
  assert.equal(ind.mandable, true);
  // Ni ids de catálogo, ni nombres de pantalla.
  assert.ok(!ind.texto.includes("p1"));
  assert.ok(!ind.texto.includes("t1"));
  assert.ok(!/parcelaId|tarea\.|null|undefined/.test(ind.texto));
});

test("cuando_no_se_entendio_que_es_se_mandan_las_palabras_tal_como_se_dijeron", () => {
  // La app no entendió; Gera sí se explicó. El que va a hacer el trabajo
  // conoce el rancho mejor que la app.
  const r = repartirElDia({
    texto: "Ramiro que le dé una vuelta al pozo del Naranjo.",
    personas: GENTE, parcelas: PARCELAS, hoy: "2026-09-08", deQuien: "Gera",
  });
  const t = r.tareas[0];
  assert.equal(t.que, null);
  const ind = indicacionParaElTrabajador(t);
  assert.equal(ind.mandable, true);
  assert.ok(ind.texto.includes("le dé una vuelta al pozo"));
  assert.ok(ind.texto.includes("Dijo Gera"));
});

test("sin_saber_quien_lo_dijo_no_se_le_pone_firma", () => {
  // No se firma "Dijo Gera" si nadie dijo que fue Gera.
  const r = repartirElDia({
    texto: "Ramiro se va a barbechar la 53.", personas: GENTE, parcelas: PARCELAS, hoy: "2026-09-08",
  });
  const ind = indicacionParaElTrabajador(r.tareas[0]);
  assert.ok(!ind.texto.includes("Dijo"));
});

test("no_se_le_arma_la_indicacion_a_quien_no_le_tocaba", () => {
  // Ésta es la única puerta por donde sale un recado. Si abre para
  // cualquiera, basta un id equivocado en la pantalla para que a Aurelio le
  // llegue el día de Juan — y todo el cuidado de no mandar una tarea sin
  // dueño no sirve de nada.
  const r = REPARTO();
  const ind = indicacionParaElTrabajador(r.tareas[0], { id: "t5", nombre: "Aurelio Luna" });
  assert.equal(ind.mandable, false);
  assert.equal(ind.texto, null);
  assert.deepEqual(ind.mensajes, []);
  assert.ok(ind.porque.includes("Aurelio Luna"));
  assert.ok(ind.porque.includes("No se le manda a quien no le tocaba"), ind.porque);
  // Y a quien sí le toca le sigue llegando.
  assert.equal(indicacionParaElTrabajador(r.tareas[0], GENTE[0]).mandable, true);
});

/* ════════════ A QUÉ SE VA CADA QUIEN ════════════ */

test("cada_quien_ve_lo_suyo_y_con_quien_le_toca", () => {
  const r = REPARTO();
  const filas = aQueSeVaCadaQuien(r.tareas);
  assert.equal(filas.length, 4);

  const juan = filas.find(f => f.personaId === "t1");
  assert.equal(juan.cuantas, 1);
  assert.ok(juan.mensajes[0].includes("con Pedro Ramírez"));
  // Lo del Chato no aparece en la vista de Juan.
  assert.ok(!juan.dice.includes("Tractor 3"));

  const chato = filas.find(f => f.personaId === "t3");
  assert.ok(chato.mensajes[0].includes("Tractor 3"));
  // Anda solo: no se le nombra ningún compañero.
  assert.ok(!/con (Juan|Pedro|Ramiro|Aurelio)/.test(chato.mensajes[0]));
});

/* ════════════ QUIÉN QUEDÓ SIN NADA ════════════ */

test("quien_quedo_sin_nada_se_pregunta_no_se_supone", () => {
  // Puede ser su descanso o puede ser que se le pasó a Gera. La app no sabe
  // cuál de las dos.
  const r = REPARTO();
  const q = quienNoTieneNada({ tareas: r.tareas, personas: GENTE });
  assert.equal(q.sabe, true);
  assert.deepEqual(q.sinTarea.map(p => p.id), ["t5"]);
  assert.equal(q.suponeElMotivo, false);
  assert.ok(q.pregunta.includes("¿Descansan"));
  assert.ok(!/descansa\./i.test(q.pregunta));
});

test("sin_lista_de_gente_no_dice_que_todos_tienen_tarea", () => {
  // Afirmar sobre una lista vacía es afirmar sobre lo que nadie miró.
  const q = quienNoTieneNada({ tareas: [], personas: [] });
  assert.equal(q.sabe, false);
  assert.deepEqual(q.sinTarea, []);
  assert.ok(q.pregunta.includes("no se puede saber"));
});

/* ════════════ LO QUE CHOCA ════════════ */

const tareaDe = (id, personas, parcela, hora, maquina) => ({
  id, personas, parcela, parcelas: parcela ? [parcela] : [], hora,
  maquina: maquina || null, fecha: "2026-09-08", que: "regar", queDice: "regar",
  cuandoDicho: "Hoy", dice: id,
});

test("la_misma_persona_a_la_misma_hora_en_dos_lados_es_un_choque", () => {
  const c = chocanLasTareas([
    tareaDe("a", [GENTE[0]], PARCELAS[0], "07:00"),
    tareaDe("b", [GENTE[0]], PARCELAS[1], "07:00"),
  ]);
  assert.equal(c.hay, true);
  assert.equal(c.choques.length, 1);
  assert.equal(c.choques[0].tipo, "persona");
  assert.ok(c.choques[0].dice.includes("no se parte en dos"));
});

test("un_tractor_no_se_parte_en_dos", () => {
  const c = chocanLasTareas([
    tareaDe("a", [GENTE[0]], PARCELAS[0], "07:00", MAQUINAS[0]),
    tareaDe("b", [GENTE[2]], PARCELAS[1], "07:00", MAQUINAS[0]),
  ]);
  assert.equal(c.choques.filter(x => x.tipo === "maquina").length, 1);
  assert.ok(c.choques.find(x => x.tipo === "maquina").dice.includes("Tractor 3"));
});

test("el_tractor_en_la_manana_y_en_otra_parcela_en_la_tarde_no_es_choque", () => {
  // El día normal del rancho: el tractor 3 barbecha en la 53 temprano y se
  // pasa al Naranjo en la tarde. Antes eso salía como choque nada más porque
  // era el mismo tractor el mismo día, sin mirar la hora — al revés de como
  // se miran las personas. Y las alarmas falsas enseñan a ignorar las
  // alarmas: la que sí importa se lee igual que ésta, o sea, ya no se lee.
  const c = chocanLasTareas([
    tareaDe("a", [GENTE[0]], PARCELAS[0], "07:00", MAQUINAS[0]),
    tareaDe("b", [GENTE[2]], PARCELAS[1], "15:00", MAQUINAS[0]),
  ]);
  assert.equal(c.hay, false);
  assert.equal(c.choques.length, 0);
  assert.equal(c.porRevisar.length, 0);
});

test("sin_la_hora_no_se_afirma_que_el_tractor_choca", () => {
  // No se sabe: puede que uno lo use en la mañana y el otro en la tarde. Se
  // pregunta, no se declara.
  const c = chocanLasTareas([
    tareaDe("a", [GENTE[0]], PARCELAS[0], null, MAQUINAS[0]),
    tareaDe("b", [GENTE[2]], PARCELAS[1], "15:00", MAQUINAS[0]),
  ]);
  assert.equal(c.hay, false);
  assert.equal(c.porRevisar.filter(x => x.tipo === "maquina sin hora").length, 1);
  assert.ok(c.porRevisar.find(x => x.tipo === "maquina sin hora").dice.includes("NO se sabe"));
});

test("sin_la_hora_no_se_afirma_que_chocan", () => {
  // Puede regar en la mañana y limpiar en la tarde. Las alarmas falsas
  // enseñan a ignorar las alarmas.
  const c = chocanLasTareas([
    tareaDe("a", [GENTE[0]], PARCELAS[0], null),
    tareaDe("b", [GENTE[0]], PARCELAS[1], null),
  ]);
  assert.equal(c.hay, false);
  assert.equal(c.choques.length, 0);
  assert.equal(c.porRevisar.length, 1);
  assert.ok(c.porRevisar[0].dice.includes("NO se sabe si chocan"));
});

test("el_choque_se_señala_pero_no_se_resuelve_solo_ni_bloquea", () => {
  const c = chocanLasTareas([
    tareaDe("a", [GENTE[0]], PARCELAS[0], "07:00"),
    tareaDe("b", [GENTE[0]], PARCELAS[1], "07:00"),
  ]);
  assert.equal(c.resuelveSolo, false);
  assert.equal(c.bloquea, false);
});

test("el_dia_de_gera_no_trae_ningun_choque", () => {
  const c = chocanLasTareas(REPARTO().tareas);
  assert.equal(c.hay, false);
  assert.equal(c.porRevisar.length, 0);
});

/* ════════════ CÓMO VA EL DÍA ════════════ */

test("no_contestar_no_es_lo_mismo_que_no_haberlo_hecho", () => {
  // En el Naranjo no hay señal. Tratar el silencio como incumplimiento es la
  // forma más rápida de que la gente deje de contestar.
  const r = REPARTO();
  const v = comoVaElDia({
    tareas: r.tareas, hoy: "2026-09-08",
    confirmaciones: [
      { tareaId: r.tareas[0].id, personaId: "t1", estado: "hecha", cuando: "2026-09-08T15:00:00Z" },
      { tareaId: r.tareas[0].id, personaId: "t2", estado: "hecha", cuando: "2026-09-08T15:05:00Z" },
      { tareaId: r.tareas[2].id, personaId: "t4", estado: "no puedo, se descompuso la camioneta", cuando: "2026-09-08T14:00:00Z" },
    ],
  });
  assert.equal(v.total, 3);
  assert.equal(v.hechas.length, 1);
  assert.equal(v.noPueden.length, 1);
  assert.equal(v.sinContestar.length, 1);
  assert.ok(v.sinContestar[0].dice.includes("No se sabe si se hizo o no"));
  assert.ok(v.dice.includes("Sin contestar NO quiere decir que no se hizo"));
});

test("una_tarea_a_medias_dice_quien_falta_de_contestar", () => {
  const r = REPARTO();
  const v = comoVaElDia({
    tareas: r.tareas, hoy: "2026-09-08",
    confirmaciones: [{ tareaId: r.tareas[0].id, personaId: "t1", estado: "voy" }],
  });
  const fila = v.filas.find(f => f.tarea.id === r.tareas[0].id);
  assert.equal(fila.estado, "a medias");
  assert.ok(fila.dice.includes("Pedro Ramírez"));
});

const SOLO_RAMIRO = () => repartirElDia({
  texto: "Ramiro se va a barbechar la 53.", personas: GENTE, parcelas: PARCELAS, hoy: "2026-09-08",
});

const comoQuedo = (tarea, dicho) => comoVaElDia({
  tareas: [tarea], hoy: "2026-09-08",
  confirmaciones: [{ tareaId: tarea.id, personaId: "t4", estado: dicho, cuando: "2026-09-08T14:00:00Z" }],
});

test("un_todavia_no_termino_no_se_reporta_como_hecha", () => {
  // Buscar "TERMIN" antes que "NO PUED", y sin mirar la negación, convertía
  // «no puedo terminar, se descompuso la bomba» en HECHA: el que dijo que
  // estaba parado quedaba reportado como cumplido y el problema no le llegaba
  // a nadie en todo el día.
  const t = SOLO_RAMIRO().tareas[0];
  for (const dicho of [
    "no puedo terminar, se descompuso la bomba",
    "todavía no termino",
    "no está hecho",
    "aún no lo he terminado",
  ]) {
    const v = comoQuedo(t, dicho);
    assert.equal(v.hechas.length, 0, `«${dicho}» no es una tarea hecha`);
    assert.equal(v.avance, 0, `«${dicho}» no avanza nada`);
    assert.notEqual(v.filas[0].estado, "hecha");
  }
  // Y el que de plano dijo que no puede sale como problema, no como duda.
  assert.equal(comoQuedo(t, "no puedo terminar, se descompuso la bomba").noPueden.length, 1);
});

test("un_problema_reportado_no_se_lee_como_aceptacion", () => {
  // Antes cualquier respuesta fuera de la lista caía en "vista" y el renglón
  // se reportaba confirmada: el que avisó de un problema quedaba contado como
  // que dijo que sí.
  const t = SOLO_RAMIRO().tareas[0];
  const v = comoQuedo(t, "no hay agua en el canal");
  assert.equal(v.confirmadas.length, 0);
  assert.equal(v.porLeer.length, 1);
  assert.equal(v.filas[0].estado, "por leer");
  // Y se enseñan sus palabras, que es lo único que sirve cuando la app no
  // entendió.
  assert.ok(v.porLeer[0].dice.includes("no hay agua en el canal"), v.porLeer[0].dice);
  assert.ok(v.dice.includes("no se da por hecho"), v.dice);
  // Un "ya quedó" sigue siendo hecha, faltaba más.
  assert.equal(comoQuedo(t, "ya quedó").hechas.length, 1);
});

test("dos_dictados_del_mismo_dia_no_comparten_id", () => {
  // Gera dicta a las 6:10 y otra vez a la una de la tarde. Con el id armado
  // nada más con el día y el lugar en la lista, las dos tareas se llaman
  // igual: contesta el de la tarde y se reporta hecha la de la mañana.
  const manana = repartirElDia({
    texto: "Juan riega la 53.", personas: GENTE, parcelas: PARCELAS,
    hoy: "2026-09-08", deQuien: "Gera", dichoALas: "6:10",
  });
  const tarde = repartirElDia({
    texto: "Pedro barbecha el Naranjo.", personas: GENTE, parcelas: PARCELAS,
    hoy: "2026-09-08", deQuien: "Gera", dichoALas: "13:00",
  });
  assert.notEqual(manana.tareas[0].id, tarde.tareas[0].id);

  const v = comoVaElDia({
    tareas: [...manana.tareas, ...tarde.tareas], hoy: "2026-09-08",
    confirmaciones: [{ tareaId: tarde.tareas[0].id, personaId: "t2", estado: "hecha" }],
  });
  assert.equal(v.hechas.length, 1);
  assert.equal(v.hechas[0].tarea.id, tarde.tareas[0].id);
  const deJuan = v.filas.find(f => f.tarea.id === manana.tareas[0].id);
  assert.equal(deJuan.estado, "sin contestar");
});

test("sin_tareas_no_hay_avance_que_ensenar", () => {
  // Un avance sobre cero tareas es una mentira redonda: no hay de dónde.
  const v = comoVaElDia({ tareas: [], confirmaciones: [], hoy: "2026-09-08" });
  assert.equal(v.total, 0);
  assert.equal(v.avance, null);
  assert.ok(v.dice.includes("no se repartió en la app"));
});

/* ════════════ LA HOJA DE FITO ════════════ */

const HOJA_53 = [
  ["Fertiriego en el cultivo de:", "CHILE MIRASOL", "Superficie en Ha:", "11"],
  ["Parcela:", "53", "Fecha:", "2026-09-08"],
  ["Fertilizantes", "Dosis kg/ha", "Fertilizante total"],
  ["Fosfonitrato", "20", "220"],
  ["S. Magnesio", "20", "220"],
  ["N. Calcio", "25", "275"],
];

const INDICACION_DE_FITO = () => indicacionDesdeHoja({
  hoja: leerFertiriego(HOJA_53), parcelas: PARCELAS,
});

test("la_hoja_de_fito_le_llega_a_quien_riega_esa_parcela", () => {
  const regino = { id: "t7", nombre: "Regino Díaz", categoria: "regador", riega: ["p1"] };
  const r = deLaHojaDeFito({
    indicacion: INDICACION_DE_FITO(), personas: [...GENTE, regino],
    parcelas: PARCELAS, hoy: "2026-09-08",
  });
  assert.equal(r.asignada, true);
  assert.deepEqual(r.tarea.personas.map(p => p.id), ["t7"]);
  assert.equal(r.tarea.que, "fertirriego");
  assert.equal(r.tarea.deQuien, "Fito");
  assert.equal(r.tarea.parcela.id, "p1");

  const ind = indicacionParaElTrabajador(r.tarea);
  assert.equal(ind.texto,
    "Hoy: fertirregar la parcela 53: Fosfonitrato 220 kg, S. Magnesio 220 kg, N. Calcio 275 kg. Dijo Fito.");
});

test("no_saber_quien_riega_no_es_mandarselo_al_unico_regador", () => {
  // El que riega la 53 y el que riega el Naranjo pueden ser distintos. Una
  // aplicación que le llega al que no era se hace tarde, o no se hace.
  const regador = { id: "t8", nombre: "Aurelio Luna", categoria: "regador" };
  const r = deLaHojaDeFito({
    indicacion: INDICACION_DE_FITO(), personas: [regador],
    parcelas: PARCELAS, hoy: "2026-09-08",
  });
  assert.equal(r.asignada, false);
  assert.deepEqual(r.tarea.personas, []);
  assert.deepEqual(r.candidatos.map(p => p.id), ["t8"]);
  assert.ok(r.dice.includes("Dinos cuál"));
  assert.equal(indicacionParaElTrabajador(r.tarea).mandable, false);
});

test("si_dos_riegan_la_misma_parcela_la_hoja_no_se_manda_a_ninguno", () => {
  const dos = [
    { id: "t7", nombre: "Regino Díaz", riega: ["p1"] },
    { id: "t8", nombre: "Aurelio Luna", riega: ["p1"] },
  ];
  const r = deLaHojaDeFito({
    indicacion: INDICACION_DE_FITO(), personas: dos, parcelas: PARCELAS, hoy: "2026-09-08",
  });
  assert.equal(r.asignada, false);
  assert.equal(r.candidatos.length, 2);
  assert.ok(r.tarea.porque.includes("Dinos cuál"));
});

test("una_parcela_que_no_esta_en_el_catalogo_no_le_llega_a_nadie", () => {
  const otra = HOJA_53.map(f => [...f]);
  otra[1] = ["Parcela:", "R7", "Fecha:", "2026-09-08"];
  const r = deLaHojaDeFito({
    indicacion: indicacionDesdeHoja({ hoja: leerFertiriego(otra), parcelas: PARCELAS }),
    personas: GENTE, parcelas: PARCELAS, hoy: "2026-09-08",
  });
  assert.equal(r.asignada, false);
  assert.ok(r.tarea.falta.includes("en qué parcela"));
  assert.ok(r.tarea.porque.includes("no está en el catálogo"));
});

test("dos_hojas_de_la_misma_parcela_el_mismo_dia_no_comparten_id", () => {
  // Fito manda la hoja de la 53 y al rato la manda corregida. Con el id
  // armado nada más con la fecha y la parcela, las dos son la misma tarea:
  // una confirmación cae en la que no era y la corregida se pisa con la
  // primera al guardarse.
  const corregida = HOJA_53.map(f => [...f]);
  corregida[3] = ["Fosfonitrato", "25", "275"];

  const primera = deLaHojaDeFito({
    indicacion: INDICACION_DE_FITO(), personas: GENTE, parcelas: PARCELAS, hoy: "2026-09-08",
  });
  const segunda = deLaHojaDeFito({
    indicacion: indicacionDesdeHoja({ hoja: leerFertiriego(corregida), parcelas: PARCELAS }),
    personas: GENTE, parcelas: PARCELAS, hoy: "2026-09-08",
  });
  assert.notEqual(primera.tarea.id, segunda.tarea.id);
});

test("la_hoja_de_fito_tampoco_se_manda_sola", () => {
  const regino = { id: "t7", nombre: "Regino Díaz", riega: ["53"] };
  const r = deLaHojaDeFito({
    indicacion: INDICACION_DE_FITO(), personas: [regino], parcelas: PARCELAS, hoy: "2026-09-08",
  });
  assert.equal(r.asignada, true);   // también se reconoce por el nombre de la parcela
  assert.equal(r.mandaSolo, false);
  assert.equal(r.bloquea, false);
  assert.ok(r.dice.includes("Falta que la mandes"));
});
