import { test } from "node:test";
import assert from "node:assert/strict";
import { candidatosDeCatalogo, catalogoAprobado, dudasDe, revisarConteoInicial, revisarSaldoInicial, respectoAlInicio } from "./arranque.js";

const telefonoA = { nombre: "teléfono A", datos: {
  trabajadores: [{ id: "t1", nombre: "Persona Uno", pin: "1234", sueldo_dia: 350, categoria: "jornalero" }, { id: "t2", nombre: "prueba", pin: "0000", sueldo_dia: 0 }],
  proveedores: [{ id: "p1", nombre: "Proveedor Ejemplar SA", rfc: "XAXX010101000" }],
  inventario: [{ id: "i1", nombre: "Urea", unidad: "bulto", existencia: 40, costo_unit: 868, cat: "insumo" }],
  egresos: [{ id: "e1", monto: 999999, concepto: "inventado" }], actividades: [{ id: "a1" }],
  config_seguridad: [{ id: "seg", pin_admin: "hash" }],
} };
const telefonoB = { nombre: "teléfono B", datos: {
  trabajadores: [{ id: "x9", nombre: "PERSONA  UNO", pin: "9999", sueldo_dia: 400, categoria: "jornalero" }],
} };

test("de_un_respaldo_viejo_solo_salen_catalogos_nunca_movimientos", () => {
  const hoja = candidatosDeCatalogo([telefonoA]);
  assert.deepEqual([...new Set(hoja.map(h => h.tabla))].sort(), ["inventario", "proveedores", "trabajadores"]);
  assert.equal(JSON.stringify(hoja).includes("999999"), false, "ningún gasto viajó");
  assert.equal(JSON.stringify(hoja).includes("hash"), false);
});

test("no_viajan_PIN_ni_existencias_ni_costos", () => {
  const texto = JSON.stringify(candidatosDeCatalogo([telefonoA, telefonoB]));
  for (const prohibido of ['"pin"', "1234", "9999", "existencia", "costo_unit", "868"]) assert.equal(texto.includes(prohibido), false, prohibido);
});

test("la_misma_persona_en_dos_telefonos_sale_una_vez_y_se_dice_si_los_datos_no_coinciden", () => {
  const hoja = candidatosDeCatalogo([telefonoA, telefonoB]);
  const uno = hoja.filter(h => h.tabla === "trabajadores" && /UNO/i.test(h.nombre));
  assert.equal(uno.length, 1); assert.equal(uno[0].veces, 2);
  assert.deepEqual(uno[0].fuentes, ["teléfono A", "teléfono B"]);
  assert.ok(uno[0].dudas.some(d => /datos distintos en: sueldo_dia/.test(d)));
});

test("lo_que_huele_a_prueba_se_marca_pero_no_se_quita_decide_la_persona", () => {
  const hoja = candidatosDeCatalogo([telefonoA]);
  const p = hoja.find(h => h.nombre === "prueba");
  assert.ok(p, "sigue en la hoja");
  assert.ok(p.dudas.includes("el nombre parece de prueba")); assert.ok(p.dudas.includes("sueldo en cero"));
  assert.deepEqual(dudasDe("proveedores", { nombre: "Proveedor Ejemplar SA" }), []);
  assert.ok(dudasDe("trabajadores", { nombre: "aaaa" }).length > 0);
});

test("nada_entra_solo_una_casilla_en_blanco_es_no", () => {
  const hoja = candidatosDeCatalogo([telefonoA]);
  assert.ok(hoja.every(h => h.entra === ""));
  const r = catalogoAprobado(hoja, { aprobadoPor: "Luis y Migue", fecha: "2026-11-20", espacio: "abc", nuevoId: () => "n1" });
  assert.equal(r.entran, 0); assert.equal(r.fuera, hoja.length);
});

test("lo_aprobado_entra_con_id_nuevo_sin_PIN_y_con_la_constancia_de_quien_lo_aprobo", () => {
  const hoja = candidatosDeCatalogo([telefonoA, telefonoB]).map(h => ({ ...h, entra: h.nombre === "prueba" ? "no" : "sí" }));
  let n = 0;
  const r = catalogoAprobado(hoja, { aprobadoPor: "Luis y Migue", fecha: "2026-11-20", espacio: "abc", nuevoId: (t) => `${t}-${++n}` });
  assert.equal(r.ok, true); assert.equal(r.entran, 3);
  const t = r.registros.trabajadores[0];
  assert.equal(t.id, "trabajadores-1"); assert.notEqual(t.id, "t1");
  assert.equal(t.pin, undefined);
  assert.equal(t.origen.aprobadoPor, "Luis y Migue"); assert.equal(t._espacio, "abc");
  assert.deepEqual(r.registros.inventario[0], { ...r.registros.inventario[0], existencia: 0, costo_unit: 0 });
  assert.equal(catalogoAprobado(hoja, { nuevoId: () => "x" }).ok, false, "sin quién y cuándo no se aprueba nada");
});

test("una_correccion_escrita_a_mano_gana_sobre_el_nombre_viejo", () => {
  const hoja = [{ tabla: "parcelas", nombre: "RANCHO 1", hectareas: 12, entra: "si", correccion: "Rancho Uno (norte)" }];
  const r = catalogoAprobado(hoja, { aprobadoPor: "Migue", fecha: "2026-11-20", nuevoId: () => "p1" });
  assert.equal(r.registros.parcelas[0].nombre, "Rancho Uno (norte)");
});

test("el_inventario_inicial_es_un_conteo_con_fecha_lugar_y_responsable", () => {
  const bueno = { fecha: "2026-12-01", ubicacion: "Bodega", responsable: "Persona Uno", renglones: [{ insumoId: "i1", contado: 0 }, { insumoId: "i2", contado: 12 }] };
  assert.equal(revisarConteoInicial(bueno).ok, true);
  const malo = revisarConteoInicial({ fecha: "2026-12-01", renglones: [{ insumoId: "i1", contado: "" }] });
  assert.equal(malo.ok, false);
  assert.deepEqual(malo.falta, ["dónde se contó", "quién contó", "1 artículo(s) sin cantidad contada (cero se escribe: 0)"]);
});

test("un_saldo_inicial_no_se_inventa_lleva_corte_responsable_y_evidencia", () => {
  assert.equal(revisarSaldoInicial({ bolsaId: "b1", fechaCorte: "2026-11-30", monto: "", responsable: "Luis" }).ok, false);
  const sin = revisarSaldoInicial({ bolsaId: "b1", fechaCorte: "2026-11-30", monto: "15230.55", responsable: "Luis" });
  assert.equal(sin.ok, true); assert.equal(sin.sinEvidencia, true); assert.equal(sin.centavos, 1523055);
  assert.match(sin.dice, /SIN evidencia/);
  const con = revisarSaldoInicial({ bolsaId: "b1", fechaCorte: "2026-11-30", monto: 0, responsable: "Luis", evidencia: "archivo:abc.pdf" });
  assert.equal(con.ok, true); assert.equal(con.sinEvidencia, false); assert.equal(con.centavos, 0); assert.equal(con.dice, "");
});

test("sin_fecha_de_inicio_declarada_no_se_dice_que_algo_es_nuevo_o_viejo", () => {
  assert.equal(respectoAlInicio("2026-10-01", null).seSabe, false);
  assert.equal(respectoAlInicio("2026-10-01", "2026-12-01").antes, true);
  assert.equal(respectoAlInicio("2026-12-01", "2026-12-01").antes, false);
});

test("las_parcelas_quedan_en_su_rancho_solo_si_no_hay_duda_de_cual", () => {
  const base = { aprobadoPor: "Migue", fecha: "2026-11-20", nuevoId: (() => { let n = 0; return (t) => `${t}-${++n}`; }) };
  const una = catalogoAprobado([{ tabla: "ranchos", nombre: "Rancho Uno", entra: "sí" }, { tabla: "parcelas", nombre: "Tabla 1", hectareas: 5, entra: "sí" }], { ...base, nuevoId: base.nuevoId() });
  assert.equal(una.registros.parcelas[0].ranchoId, una.registros.ranchos[0].id); assert.equal(una.parcelasSinRancho, 0);
  const dos = catalogoAprobado([{ tabla: "ranchos", nombre: "Rancho Uno", entra: "sí" }, { tabla: "ranchos", nombre: "Rancho Dos", entra: "sí" }, { tabla: "parcelas", nombre: "Tabla 1", entra: "sí" }], { ...base, nuevoId: base.nuevoId() });
  assert.equal(dos.registros.parcelas[0].ranchoId, undefined); assert.equal(dos.parcelasSinRancho, 1);
});
