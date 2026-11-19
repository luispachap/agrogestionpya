// ============================================================
//  Pruebas del ganado
//
//  Dos hilos: el tiempo de retiro es seguridad de personas (vender antes le
//  llega al consumidor), y el hato se cuadra pero NO se ajusta solo.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  estaEnElHato, cuadreDelHato, gananciaDiaria, puedeVenderse, hatoParaVenta,
  faltaVacuna, cargaAnimal, costoPorKilo, mermaDeEmbarque,
} from "./ganado.js";

const HATO = [
  { id: "a1", arete: "MX-0001", sexo: "hembra" },
  { id: "a2", arete: "MX-0002", sexo: "macho" },
  { id: "a3", arete: "MX-0003", sexo: "hembra", baja: { motivo: "vendido", fecha: "2026-07-10" } },
  { id: "a4", arete: "MX-0004", sexo: "macho", baja: { motivo: "muerto", fecha: "2026-06-02", causa: "timpanismo" } },
];

/* ════════════ EL CUADRE DEL HATO ════════════ */

test("el_padron_NO_se_ajusta_al_conteo_del_potrero", () => {
  // Un sistema que "cuadra solo" borra justamente el dato que servía: un
  // animal que falta es una pregunta, no un número que se corrige.
  const c = cuadreDelHato({ animales: HATO, conteoFisico: 1 });
  assert.equal(c.segunPadron, 2);
  assert.equal(c.contado, 1);
  assert.equal(c.diferencia, -1);
  assert.equal(c.ajustaSolo, false);
  assert.ok(c.dice.includes("falta 1") || c.dice.includes("faltan 1"));
  assert.ok(c.dice.includes("no ajustarla"));
});

test("si_nadie_ha_contado_el_hato_no_se_dice_que_cuadra", () => {
  const c = cuadreDelHato({ animales: HATO, conteoFisico: null });
  assert.equal(c.contado, null);
  assert.equal(c.diferencia, null);
  assert.ok(c.dice.includes("no se sabe si es cierto"));
});

test("cada_baja_lleva_su_motivo_y_la_mortandad_tambien_se_anota", () => {
  const c = cuadreDelHato({ animales: HATO, conteoFisico: 2 });
  assert.equal(c.bajas, 2);
  assert.equal(c.porMotivo.vendido, 1);
  assert.equal(c.porMotivo.muerto, 1);
  assert.equal(c.sinMotivo, 0);
  assert.equal(estaEnElHato(HATO[0]), true);
  assert.equal(estaEnElHato(HATO[2]), false);
});

test("una_baja_sin_motivo_se_cuenta_aparte_para_poder_verla", () => {
  // Un animal que desaparece del padrón sin decir por qué es exactamente lo
  // que hay que poder ver.
  const c = cuadreDelHato({ animales: [...HATO, { id: "a5", baja: { fecha: "2026-08-01" } }], conteoFisico: 2 });
  assert.equal(c.sinMotivo, 1);
});

/* ════════════ LA BÁSCULA ════════════ */

test("la_ganancia_diaria_sale_de_dos_pesajes_no_de_uno", () => {
  const g = gananciaDiaria([
    { fecha: "2026-06-01", kg: 220 },
    { fecha: "2026-08-30", kg: 310 },
  ]);
  assert.equal(g.hay, true);
  assert.equal(g.dias, 90);
  assert.equal(g.gdp, 1);
  assert.ok(g.dice.includes("90 días"));
});

test("con_un_solo_pesaje_NO_se_inventa_una_ganancia", () => {
  const g = gananciaDiaria([{ fecha: "2026-06-01", kg: 220 }]);
  assert.equal(g.hay, false);
  assert.equal(g.gdp, null);
  assert.ok(g.dice.includes("hace falta otro"));
  assert.equal(gananciaDiaria([]).gdp, null);
});

test("un_animal_sin_pesar_no_pesa_cero", () => {
  const g = gananciaDiaria([{ fecha: "2026-06-01", kg: null }, { fecha: "2026-08-30", kg: 310 }]);
  assert.equal(g.hay, false);   // sólo quedó un pesaje válido
});

/* ════════════ EL TIEMPO DE RETIRO: SEGURIDAD ════════════ */

test("un_animal_en_retiro_NO_se_puede_vender_y_se_dice_hasta_cuando", () => {
  const r = puedeVenderse({
    tratamientos: [{ producto: "Oxitetraciclina", fecha: "2026-09-01", retiroDias: 28 }],
    hoy: "2026-09-08",
  });
  assert.equal(r.puede, false);
  assert.equal(r.estado, "en retiro");
  assert.equal(r.venderDesde, "2026-09-29");
  assert.ok(r.dice.includes("NO se puede vender hasta el 2026-09-29"));
});

test("un_tratamiento_sin_retiro_capturado_NO_dice_que_ya_se_puede_vender", () => {
  // La regla que protege al consumidor: "no sé" NO es "sí".
  const r = puedeVenderse({
    tratamientos: [{ producto: "Antibiótico del frasco viejo", fecha: "2026-08-01" }],
    hoy: "2026-09-08",
  });
  assert.equal(r.puede, false);
  assert.equal(r.estado, "no se sabe");
  assert.equal(r.sinDato.length, 1);
  assert.ok(r.dice.includes("NO quiere decir que ya se pueda vender"));
  assert.ok(r.dice.includes("Búscalo en el frasco"));
});

test("manda_el_retiro_mas_largo_cuando_hay_varios_tratamientos", () => {
  const r = puedeVenderse({
    tratamientos: [
      { producto: "A", fecha: "2026-09-01", retiroDias: 10 },
      { producto: "B", fecha: "2026-09-01", retiroDias: 28 },
    ],
    hoy: "2026-09-08",
  });
  assert.equal(r.venderDesde, "2026-09-29");
});

test("pasado_el_retiro_si_se_puede_vender", () => {
  const r = puedeVenderse({
    tratamientos: [{ producto: "A", fecha: "2026-07-01", retiroDias: 28 }],
    hoy: "2026-09-08",
  });
  assert.equal(r.puede, true);
  assert.equal(r.estado, "libre");
});

test("lo_que_bloquea_y_lo_que_no_se_sabe_van_por_separado", () => {
  // Confundirlas enseña a ignorar las dos.
  const h = hatoParaVenta({
    animales: HATO,
    tratamientos: [
      { animalId: "a1", producto: "A", fecha: "2026-09-01", retiroDias: 28 },
      { animalId: "a2", producto: "B del frasco viejo", fecha: "2026-08-01" },
    ],
    hoy: "2026-09-08",
  });
  assert.equal(h.enRetiro.length, 1);
  assert.equal(h.sinSaber.length, 1);
  assert.notEqual(h.enRetiro[0].animal.id, h.sinSaber[0].animal.id);
  // Los animales dados de baja no se revisan: ya no están en el hato.
  assert.equal(h.filas.length, 2);
});

/* ════════════ LO QUE NO SE VACUNÓ ════════════ */

test("la_lista_util_es_la_de_los_que_FALTAN_no_la_de_los_que_si", () => {
  // Preguntar "¿a cuáles sí?" deja fuera justo a los que importan.
  const f = faltaVacuna({
    animales: HATO,
    tratamientos: [{ animalId: "a1", producto: "Bacterina", fecha: "2026-09-01" }],
    vacuna: "bacterina", cadaDias: 180, hoy: "2026-09-08",
  });
  assert.equal(f.faltan.length, 1);
  assert.equal(f.faltan[0].animal.id, "a2");
  assert.equal(f.nunca.length, 1);
});

test("sin_saber_cada_cuanto_toca_solo_se_puede_decir_a_cuales_nunca", () => {
  const f = faltaVacuna({
    animales: HATO,
    tratamientos: [{ animalId: "a1", producto: "Bacterina", fecha: "2020-01-01" }],
    vacuna: "bacterina", cadaDias: null, hoy: "2026-09-08",
  });
  assert.ok(f.dice.includes("NUNCA"));
  assert.equal(f.nunca.length, 1);
});

/* ════════════ POTREROS Y CARGA ════════════ */

test("sin_hectareas_capturadas_NO_se_estima_la_carga_del_potrero", () => {
  // Una carga inventada manda ganado a un potrero que no lo aguanta.
  const c = cargaAnimal({ potrero: { id: "p1", nombre: "El Llano" }, animales: [{ id: "a1", potreroId: "p1" }] });
  assert.equal(c.carga, null);
  assert.ok(c.dice.includes("no se puede decir si los aguanta"));
});

test("la_carga_se_compara_contra_lo_que_se_registro_del_potrero", () => {
  const animales = Array.from({ length: 30 }, (_, i) => ({ id: `a${i}`, potreroId: "p1" }));
  const c = cargaAnimal({ potrero: { id: "p1", nombre: "El Llano", hectareas: 20, cargaMaxima: 1 }, animales });
  assert.equal(c.carga, 1.5);
  assert.equal(c.llamaLaAtencion, true);
  // Informa; no ordena mover el ganado.
  assert.equal(c.dice.toLowerCase().includes("saca"), false);
  assert.equal(c.dice.toLowerCase().includes("mueve"), false);
});

test("sin_saber_cuanto_aguanta_el_potrero_no_hay_con_que_comparar", () => {
  const c = cargaAnimal({ potrero: { id: "p1", hectareas: 20 }, animales: [{ id: "a1", potreroId: "p1" }] });
  assert.equal(c.carga, 0.05);
  assert.equal(c.soporta, null);
  assert.ok(c.dice.includes("no hay con qué compararlo"));
});

/* ════════════ COSTO POR KILO Y MERMA ════════════ */

test("el_costo_por_kilo_dice_sobre_que_esta_calculado", () => {
  const c = costoPorKilo({ gastos: [{ monto: 120000 }, { monto: 30000 }], kilosProducidos: 5000 });
  assert.equal(c.completo, true);
  assert.equal(c.porKilo, 30);
});

test("sin_kilos_producidos_no_hay_costo_por_kilo_que_valga", () => {
  const c = costoPorKilo({ gastos: [{ monto: 120000 }], kilosProducidos: null });
  assert.equal(c.porKilo, null);
  assert.deepEqual(c.falta, ["kilos producidos"]);
});

test("la_merma_del_embarque_se_mide_no_se_supone", () => {
  const m = mermaDeEmbarque({ kilosSalida: 10000, kilosLlegada: 9700, cabezas: 25 });
  assert.equal(m.merma, 300);
  assert.equal(m.porciento, 3);
  assert.equal(m.porCabeza, 12);
  // No dice si está bien o mal: eso lo sabe quien conoce el viaje.
  assert.equal(m.dice.toLowerCase().includes("normal"), false);
  assert.equal(m.dice.toLowerCase().includes("excesiv"), false);
});

test("si_no_se_peso_a_la_salida_no_hay_merma_que_calcular", () => {
  const m = mermaDeEmbarque({ kilosSalida: null, kilosLlegada: 9700 });
  assert.equal(m.merma, null);
  assert.ok(m.dice.includes("No se pesó a la salida"));
});
