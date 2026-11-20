import { test } from "node:test";
import assert from "node:assert/strict";
import { integrar, validarPercepcion, percepcionesDe } from "./salarioIntegrado.js";
import { condicionesDe } from "./prestaciones.js";

const ANA = { id: "t-ana", nombre: "Ana", sueldo_dia: 365, historialSueldo: [{ desde: "2020-01-01", sueldo_dia: 365, anterior: 365 }], fechaIngreso: "2024-03-01" };
const DIA = "2026-11-19";
const sdi = (persona, mas = {}) => integrar({ cond: condicionesDe(persona, {}, mas.remuneraciones || []), diario: 365, n: 3, fecha: DIA, persona, ...mas });
const con = (lista, revisado = "2026-11-01") => ({ ...ANA, percepciones: { revisado, por: "Luis", lista } });
const de = (r, clave) => r.partes.find(p => p.clave === clave);

test("sin_revisar_su_ficha_el_salario_integrado_es_un_piso_y_queda_por_revisar", () => {
  const r = sdi(ANA);
  assert.equal(r.monto, 384, "cuota 365 + 15 de aguinaldo + 4 de prima vacacional"); assert.equal(r.completo, false);
  assert.match(r.falta[0], /nadie ha revisado en su ficha/); assert.match(r.explica, /Es un piso, no la cifra final/);
  const ok = sdi(con([]));
  assert.equal(ok.monto, 384); assert.equal(ok.completo, true, "revisada y sin nada más: ya no falta información"); assert.match(ok.explica, /Su ficha se revisó el 2026-11-01 \(Luis\)/);
});

test("las_percepciones_fijas_se_llevan_a_un_dia_segun_su_periodo_semana_entre_7_mes_entre_30", () => {
  const r = sdi(con([{ id: "a", nombre: "Despensa", clase: "despensa", tipo: "fija", monto: 700, periodo: "semana", desde: "2025-01-01" }, { id: "b", nombre: "Ayuda de renta", clase: "habitacion", tipo: "fija", monto: 1500, periodo: "mes", desde: "2025-01-01" }, { id: "c", nombre: "Bono anual", clase: "bono", tipo: "fija", monto: 3650, periodo: "anio", desde: "2025-01-01" }]));
  assert.equal(de(r, "fija:a").porDia, 100); assert.equal(de(r, "fija:b").porDia, 50); assert.equal(de(r, "fija:c").porDia, 10);
  assert.equal(r.monto, 384 + 160); assert.equal(r.completo, true); assert.match(de(r, "fija:a").base, /700 por semana, entre 7/);
});

test("una_percepcion_cuenta_solo_en_el_periodo_en_que_se_recibio", () => {
  const lista = [{ id: "a", nombre: "Despensa", clase: "despensa", tipo: "fija", monto: 700, periodo: "semana", desde: "2025-01-01", hasta: "2026-06-30" }, { id: "b", nombre: "Bono nuevo", clase: "bono", tipo: "fija", monto: 70, periodo: "semana", desde: "2026-12-01" }];
  assert.equal(sdi(con(lista)).monto, 384, "el 19 de noviembre ya no recibía la despensa y todavía no el bono");
  assert.equal(integrar({ cond: condicionesDe(ANA), diario: 365, n: 3, fecha: "2026-06-15", persona: con(lista) }).monto, 484, "una baja con fecha de junio sí la cuenta: no se borró, se le puso fin");
});

test("lo_variable_va_con_el_promedio_de_los_ultimos_treinta_dias_trabajados", () => {
  const r = sdi(con([{ id: "v", nombre: "Comisiones", clase: "comision", tipo: "variable", monto: 3000, al: "2026-11-15" }]));
  assert.equal(de(r, "variable:v").porDia, 100); assert.equal(r.completo, true);
  const viejo = sdi(con([{ id: "v", nombre: "Comisiones", clase: "comision", tipo: "variable", monto: 3000, al: "2026-05-01" }]));
  assert.equal(viejo.completo, false); assert.match(viejo.falta[0], /ya no son sus últimos 30 días trabajados/);
  const sin = sdi(con([{ id: "v", nombre: "Comisiones", clase: "comision", tipo: "variable", monto: null }]));
  assert.equal(sin.monto, 384, "sin el total no se inventa nada"); assert.match(sin.falta[0], /falta el total de «Comisiones»/);
});

test("lo_que_la_app_ya_registro_que_gano_de_mas_se_integra_solo_y_no_se_duplica_en_quien_cobra_por_destajo", () => {
  const treinta = Array.from({ length: 30 }, (_, i) => ({ fecha: `2026-10-${String(i + 1).padStart(2, "0")}`, monto: i < 10 ? 665 : 365 }));   // 10 días ganó 300 de más
  const r = sdi(con([]), { remuneraciones: treinta });
  assert.equal(de(r, "variable:registrado").porDia, 100); assert.equal(r.monto, 484); assert.equal(r.completo, true);
  const pocos = sdi(con([]), { remuneraciones: treinta.slice(0, 12) });
  assert.equal(pocos.completo, false); assert.match(pocos.falta[0], /sólo 12 días trabajados; la ley pide 30/);
  const menos = sdi(con([]), { remuneraciones: treinta.map(d => ({ ...d, monto: 200 })) });
  assert.equal(menos.monto, 384, "si un día salió antes y ganó menos, no baja su salario integrado");
  const DORA = { ...ANA, modalidadPago: "destajo", sueldo_dia: 0, historialSueldo: [], percepciones: { revisado: "2026-11-01", lista: [] } };
  const d = integrar({ cond: condicionesDe(DORA, {}, treinta), diario: 465, n: 3, fecha: DIA, persona: DORA, remuneraciones: treinta });
  assert.equal(de(d, "variable:registrado"), undefined, "su promedio YA es su cuota diaria");
});

test("las_bonificaciones_de_la_pantalla_vieja_no_se_integran_solas_pero_se_avisan", () => {
  const r = sdi(con([]), { bonificaciones: [{ trabajadorId: "t-ana", monto: 2000, anio: 2026, concepto: "Bono de cosecha" }, { monto: 500, anio: 2020, concepto: "Viejo" }] });
  assert.equal(r.monto, 384); assert.equal(r.completo, false); assert.match(r.falta[0], /1 bonificación\(es\).*Bono de cosecha 2026/);
});

test("una_percepcion_sin_valor_o_mal_capturada_no_entra", () => {
  assert.equal(validarPercepcion({ clase: "despensa", tipo: "fija", monto: 700, periodo: "semana" }).ok, false, "falta desde cuándo");
  assert.equal(validarPercepcion({ clase: "despensa", tipo: "fija", monto: 700, desde: "2025-01-01" }).ok, false, "falta cada cuánto");
  assert.equal(validarPercepcion({ clase: "otra", tipo: "fija", monto: 1, periodo: "dia", desde: "2025-01-01" }).ok, false);
  assert.equal(validarPercepcion({ clase: "comision", tipo: "variable", monto: 3000 }).ok, false, "el total de lo variable necesita su fecha");
  assert.equal(validarPercepcion({ clase: "despensa", tipo: "fija", monto: -5, periodo: "semana", desde: "2025-01-01" }).ok, false);
  const v = validarPercepcion({ id: "h", clase: "habitacion", tipo: "fija", monto: "", periodo: "mes", desde: "2025-01-01" });
  assert.ok(v.ok && v.percepcion.monto === null, "se puede anotar que la recibe aunque todavía no se sepa el valor");
  assert.match(sdi(con([v.percepcion])).falta[0], /falta el valor de «Habitación o ayuda de renta»/);
  assert.deepEqual(percepcionesDe({}).lista, []);
});

test("los_incentivos_de_productividad_de_sus_ultimos_treinta_dias_trabajados_integran_y_los_viejos_no", () => {
  const treinta = Array.from({ length: 30 }, (_, i) => ({ fecha: `2026-10-${String(i + 1).padStart(2, "0")}`, monto: 365 }));
  const bonos = [{ monto: 900, hasta: "2026-10-15", motivo: "Meta de cajas" }, { monto: 600, hasta: "2026-10-29", motivo: "Meta de cajas" }, { monto: 5000, hasta: "2026-08-01", motivo: "Viejo" }];
  const r = sdi(con([]), { remuneraciones: treinta, bonos });
  assert.equal(de(r, "variable:bonos").porDia, 50, "1,500 entre 30 días trabajados"); assert.equal(r.monto, 434); assert.equal(r.completo, true);
  const sinDias = sdi(con([]), { bonos: [{ monto: 900, hasta: "2026-11-10", motivo: "Meta" }] });
  assert.equal(de(sinDias, "variable:bonos").porDia, 30); assert.equal(sinDias.completo, false); assert.match(sinDias.falta[0], /no hay días trabajados registrados/);
});
