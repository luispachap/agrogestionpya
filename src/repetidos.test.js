import { test } from "node:test";
import assert from "node:assert/strict";
import { quizaRepetidos, marcarDistintos } from "./repetidos.js";

const eg = (id, mas = {}) => ({ id, fecha: "2026-11-19", monto: 700, concepto: "Diésel del tractor", categoria: "combustible", registradoPor: { nombre: id === "a" ? "Ana" : "Beto" }, ...mas });

test("el_mismo_gasto_capturado_en_dos_telefonos_se_avisa_con_quien_capturo_cada_uno", () => {
  const g = quizaRepetidos({ egresos: [eg("a"), eg("b", { concepto: "  DIESEL del  tractor " }), eg("c", { monto: 701 })] });
  assert.equal(g.length, 1); assert.equal(g[0].clase, "gasto"); assert.equal(g[0].importe, 700);
  assert.deepEqual(g[0].registros, [{ id: "a", quien: "Ana" }, { id: "b", quien: "Beto" }]);
});
test("no_avisa_de_lo_cancelado_ni_de_lo_que_la_app_creo_sola_ni_de_otro_dia_u_otra_parcela", () => {
  assert.deepEqual(quizaRepetidos({ egresos: [eg("a"), eg("b", { cancelado: { motivo: "repetido" } })] }), []);
  assert.deepEqual(quizaRepetidos({ egresos: [eg("a", { cajachicaId: "cc1" }), eg("b", { cajachicaId: "cc2" })] }), [], "dos salidas de caja son dos movimientos de caja");
  assert.deepEqual(quizaRepetidos({ egresos: [eg("a"), eg("b", { fecha: "2026-11-20" })] }), []);
  assert.deepEqual(quizaRepetidos({ egresos: [eg("a", { parcelaId: "p1" }), eg("b", { parcelaId: "p2" })] }), []);
});
test("decir_que_son_distintos_quita_el_aviso_sin_tocar_importes_y_vuelve_si_aparece_un_tercero", () => {
  const lista = [eg("a"), eg("b")]; const [g] = quizaRepetidos({ egresos: lista });
  const marcados = marcarDistintos(g, lista, { id: "u1", nombre: "Luis" }, "2026-11-20");
  assert.deepEqual(marcados.map(r => [r.id, r.monto, r.distintoDe, r.distintoPor.nombre]), [["a", 700, ["b"], "Luis"], ["b", 700, ["a"], "Luis"]]);
  assert.deepEqual(quizaRepetidos({ egresos: marcados }), []);
  assert.equal(quizaRepetidos({ egresos: [...marcados, eg("c")] }).length, 1, "un tercero igual vuelve a preguntar");
});
test("tambien_ingresos_entradas_al_almacen_y_aplicaciones", () => {
  const data = { inventario: [{ id: "i1", nombre: "Urea" }], parcelas: [{ id: "p1", nombre: "La Presa" }],
    ingresos: [{ id: "i-a", fecha: "2026-11-19", monto: 10000, concepto: "Venta de ajo" }, { id: "i-b", fecha: "2026-11-19", monto: 10000, concepto: "venta de ajo" }],
    entradas_inv: [{ id: "e-a", fecha: "2026-11-19", insumoId: "i1", cantidad: 10, costo_total: 5000 }, { id: "e-b", fecha: "2026-11-19", insumoId: "i1", cantidad: 10, costo_total: 5000 },
      { id: "ei-sol-s1-0", fecha: "2026-11-19", insumoId: "i1", cantidad: 10, costo_total: 5000 }, { id: "e-c", fecha: "2026-11-19", insumoId: "i1", cantidad: -3, costo_total: 0 }],
    aplicaciones: [{ id: "ap-a", fecha: "2026-11-19", parcelaId: "p1", productos: [{ insumoId: "i1", nombre: "Urea", total: 6 }] }, { id: "ap-b", fecha: "2026-11-19", parcelaId: "p1", productos: [{ insumoId: "i1", nombre: "Urea", total: 6 }] },
      { id: "ap-c", fecha: "2026-11-19", parcelaId: "p1", productos: [{ insumoId: "i1", nombre: "Urea", total: 4 }] }] };
  const g = quizaRepetidos(data);
  assert.deepEqual(g.map(x => [x.clase, x.registros.map(r => r.id)]).sort(), [["aplicacion", ["ap-a", "ap-b"]], ["entrada", ["e-a", "e-b"]], ["ingreso", ["i-a", "i-b"]]]);
  assert.equal(g.find(x => x.clase === "entrada").dice, "10 de Urea"); assert.equal(g.find(x => x.clase === "aplicacion").dice, "Urea en La Presa");
});
