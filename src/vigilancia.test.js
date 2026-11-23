// ============================================================
//  Pruebas de "que el dueño se entere a tiempo"
//
//  El hilo: no contestar sobre lo que no se miró, y no dar alarmas falsas —
//  porque las alarmas falsas enseñan a ignorar las alarmas.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  alcanzaPara, loQueDejoDeAparecer, rutinasDelRancho, contraElAnoPasado,
} from "./vigilancia.js";

/* ════════════ ¿ALCANZA PARA EL SÁBADO? ════════════ */

test("contesta_con_una_palabra_y_dice_de_donde_salio_cada_saldo", () => {
  const r = alcanzaPara({
    bolsas: [
      { nombre: "Bajío", saldo: 180000, saldoAl: "2026-09-05" },
      { nombre: "Caja de Zacatecas", saldo: 20000, saldoAl: "2026-09-08" },
    ],
    compromisos: [{ concepto: "Raya del sábado", monto: 95000 }, { concepto: "Luz de los pozos", monto: 40000 }],
    hoy: "2026-09-08",
  });
  assert.equal(r.respuesta, "alcanza");
  assert.equal(r.hay, 200000);
  assert.equal(r.necesita, 135000);
  assert.equal(r.sobra, 65000);
  // La letra chica: de dónde salió cada saldo y de qué fecha es.
  assert.ok(r.detalle[0].dice.includes("hace 3 día"));
  assert.ok(r.detalle[1].dice.includes("al día de hoy"));
});

test("cuando_no_alcanza_lo_dice_sin_decir_que_no_compres", () => {
  const r = alcanzaPara({
    bolsas: [{ nombre: "Bajío", saldo: 50000, saldoAl: "2026-09-08" }],
    compromisos: [{ monto: 95000 }],
    hoy: "2026-09-08",
  });
  assert.equal(r.respuesta, "falta");
  assert.ok(r.dice.includes("faltan"));
  for (const p of ["no compres", "no gastes", "cancela", "debes"]) {
    assert.equal(r.dice.toLowerCase().includes(p), false, `no debe decir "${p}"`);
  }
});

test("si_falta_el_saldo_de_una_bolsa_NO_contesta_que_alcanza", () => {
  // Decir "alcanza" sobre un saldo que nadie miró es justo el pecado que este
  // sistema evita.
  const r = alcanzaPara({
    bolsas: [
      { nombre: "Bajío", saldo: 500000, saldoAl: "2026-09-08" },
      { nombre: "Banorte", saldo: null },
    ],
    compromisos: [{ monto: 95000 }],
    hoy: "2026-09-08",
  });
  assert.equal(r.respuesta, "no sé tu saldo");
  assert.equal(r.sinSaldo.length, 1);
  assert.ok(r.dice.includes("no se sabe el saldo de Banorte"));
  assert.ok(r.dice.includes("está incompleto"));
});

test("un_saldo_viejo_no_se_disfraza_de_actual", () => {
  // Un saldo de hace dos meses sigue siendo mejor que ninguno, pero no se
  // presenta como si fuera de hoy.
  const r = alcanzaPara({
    bolsas: [{ nombre: "Bajío", saldo: 500000, saldoAl: "2026-07-01" }],
    compromisos: [{ monto: 95000 }],
    hoy: "2026-09-08",
  });
  assert.equal(r.respuesta, "no sé tu saldo");
  assert.equal(r.viejos.length, 1);
  assert.ok(r.dice.includes("hace 69 días"));
  // Pero el dato sigue ahí, no se esconde.
  assert.equal(r.hay, 500000);
});

/* ════════════ LO QUE DEJÓ DE APARECER ════════════ */

test("el_tractor_que_dejo_de_reportar_se_ve", () => {
  // Una captura que truena se ve sola. La que dejó de hacerse, no — y ésa es
  // la peligrosa.
  const r = loQueDejoDeAparecer({
    rutinas: [
      { que: "El tractor 3", cadaDias: 15, ultima: "2026-08-20" },
      { que: "El pase de lista", cadaDias: 2, ultima: "2026-09-08" },
    ],
    hoy: "2026-09-08",
  });
  assert.equal(r.dejaronDeAparecer.length, 1);
  assert.equal(r.dejaronDeAparecer[0].que, "El tractor 3");
  assert.ok(r.dejaronDeAparecer[0].dice.includes("19 días sin aparecer"));
  assert.equal(r.alDia.length, 1);
});

test("un_tractor_que_lleva_menos_dias_que_su_ritmo_va_al_dia", () => {
  // Un tractor puede estar parado dos semanas entre labores sin que pase
  // nada. Avisar de eso sería una alarma falsa, y las alarmas falsas enseñan
  // a ignorar las alarmas.
  const r = loQueDejoDeAparecer({
    rutinas: [{ que: "El tractor 3", cadaDias: 15, ultima: "2026-08-27" }],
    hoy: "2026-09-08",
  });
  assert.equal(r.dejaronDeAparecer.length, 0);
  assert.equal(r.alDia.length, 1);
});

test("la_alarma_dice_cuantos_dias_lleva_sin_suponer_por_que", () => {
  // Puede estar descompuesto, prestado, o alguien dejó de anotar. La app no
  // lo sabe y no lo inventa.
  const r = loQueDejoDeAparecer({
    rutinas: [{ que: "El tractor 3", cadaDias: 15, ultima: "2026-08-01" }],
    hoy: "2026-09-08",
  });
  const d = r.dejaronDeAparecer[0].dice.toLowerCase();
  for (const p of ["robo", "descompuesto", "alguien", "no anotaron", "flojera"]) {
    assert.equal(d.includes(p), false, `no debe suponer "${p}"`);
  }
});

test("lo_que_nunca_se_capturo_va_aparte_de_lo_que_dejo_de_aparecer", () => {
  // "Nunca se ha capturado" es un problema de arranque; "dejó de aparecer" es
  // un problema de hoy. No son la misma alarma.
  const r = loQueDejoDeAparecer({
    rutinas: [
      { que: "La caja chica", cadaDias: 15, ultima: null },
      { que: "El tractor 3", cadaDias: 15, ultima: "2026-08-01" },
    ],
    hoy: "2026-09-08",
  });
  assert.equal(r.nunca.length, 1);
  assert.equal(r.dejaronDeAparecer.length, 1);
  assert.equal(r.nunca[0].que, "La caja chica");
});

test("sin_saber_cada_cuanto_deberia_aparecer_no_se_dice_que_va_tarde", () => {
  const r = loQueDejoDeAparecer({
    rutinas: [{ que: "Algo", cadaDias: null, ultima: "2026-01-01" }],
    hoy: "2026-09-08",
  });
  assert.equal(r.sinRitmo.length, 1);
  assert.equal(r.dejaronDeAparecer.length, 0);
  assert.ok(r.sinRitmo[0].dice.includes("no se puede saber si va tarde"));
});

test("las_rutinas_salen_de_lo_que_la_app_ya_guarda", () => {
  const r = rutinasDelRancho({
    data: {
      asistencia: [{ fecha: "2026-09-08" }],
      actividades: [{ fecha: "2026-08-20", maquinariaId: "m1" }],
      maquinaria: [{ id: "m1", nombre: "Tractor 3" }],
    },
    hoy: "2026-09-08",
  });
  assert.ok(r.filas.some(f => f.que === "Tractor 3"));
  assert.ok(r.dejaronDeAparecer.some(f => f.que === "Tractor 3"));
  assert.ok(r.alDia.some(f => f.clave === "asistencia"));
});

test("un_rancho_que_checa_y_reparte_no_sale_como_que_dejo_de_registrar_su_asistencia_ni_su_trabajo", () => {
  const r = rutinasDelRancho({
    data: {
      asistencia: [{ fecha: "2026-08-01" }],                         // el pase de lista de antes
      eventos: [{ id: "ev1", tipo: "marca", fecha: "2026-09-08", cuando: "2026-09-08T14:00:00Z", datos: { sentido: "entrada" } }],
      actividades: [{ fecha: "2026-08-01" }],                        // lo tecleado de antes
      actividadesContables: [{ fecha: "2026-08-01" }, { fecha: "2026-09-07", _deEventos: ["ev2"] }],   // y lo que sale del reparto
    },
    hoy: "2026-09-08",
  });
  assert.ok(r.alDia.some(f => f.clave === "asistencia"), "checó hoy: la asistencia está al día");
  assert.ok(r.alDia.some(f => f.clave === "actividades"), "el trabajo de ayer está registrado aunque nadie lo haya tecleado");
});

/* ════════════ CONTRA EL MISMO MES DEL AÑO PASADO ════════════ */

const GASTOS = [
  { fecha: "2026-08-05", monto: 40000 }, { fecha: "2026-08-20", monto: 60000 },
  { fecha: "2025-08-03", monto: 30000 }, { fecha: "2025-08-19", monto: 50000 },
  { fecha: "2026-07-10", monto: 500000 },   // julio, que en un rancho no se parece a agosto
];

test("se_compara_agosto_contra_agosto_no_contra_julio", () => {
  // Un rancho es estacional: en agosto siempre cae. Comparar contra julio
  // produce alarmas falsas, y las alarmas falsas enseñan a ignorar las alarmas.
  const r = contraElAnoPasado({ movimientos: GASTOS, mes: "2026-08" });
  assert.equal(r.mesComparado, "2025-08");
  assert.equal(r.ahora, 100000);
  assert.equal(r.antes, 80000);
  assert.equal(r.diferencia, 20000);
  assert.equal(r.porciento, 25);
  assert.ok(r.dice.includes("mismo mes del año pasado"));
  // Julio, que es enorme, no entra en la comparación.
  assert.equal(r.dice.includes("500,000"), false);
});

test("sin_datos_del_ano_pasado_NO_se_compara_contra_el_mes_pasado", () => {
  // Ese premio de consolación es justo el que produce la alarma falsa.
  const r = contraElAnoPasado({ movimientos: [{ fecha: "2026-08-05", monto: 40000 }], mes: "2026-08" });
  assert.equal(r.hayConQueComparar, false);
  assert.equal(r.antes, null);
  assert.ok(r.dice.includes("No hay datos de 2025-08"));
  assert.ok(r.dice.includes("por temporada, no por calendario"));
});

test("sin_ninguna_bolsa_registrada_NO_contesta_que_alcanza", () => {
  // Contestar "alcanza" sobre cero bolsas es afirmar sobre lo que nadie miró.
  const r = alcanzaPara({ bolsas: [], compromisos: [{ monto: 95000 }], hoy: "2026-09-08" });
  assert.equal(r.respuesta, "no sé tu saldo");
  assert.equal(r.hay, null);
  assert.equal(r.necesita, 95000);
  assert.ok(r.dice.includes("No hay ninguna bolsa registrada"));
});

test("sin_compromisos_capturados_tampoco_se_inventa_un_alcanza", () => {
  // Con bolsas pero sin nada que pagar, la cuenta es honesta: hay tanto y no
  // se ha dicho qué hay que pagar.
  const r = alcanzaPara({
    bolsas: [{ nombre: "Bajío", saldo: 180000, saldoAl: "2026-09-08" }],
    compromisos: [], hoy: "2026-09-08",
  });
  assert.equal(r.respuesta, "alcanza");
  assert.equal(r.necesita, 0);
  assert.equal(r.hay, 180000);
});
