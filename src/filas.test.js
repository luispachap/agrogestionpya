import { test } from "node:test";
import assert from "node:assert/strict";
import { conSelloOriginal, objetoAFila, filaAObjeto } from "./filas.js";

test("al_restaurar_el_sello_original_viaja_al_lado_del_evento_y_nunca_como_columna", () => {
  const delRespaldo = { id: "e1", tipo: "pago_personal", fecha: "2026-11-19", estado: "vigente", datos: { monto: 500 }, quien: { id: "c-migue", nombre: "QUIEN CAPTURÓ" },
    _recibido: "2026-11-19T12:00:05Z", _validacion: "autorizado", _validadoPor: "c-migue", _validadoRol: "superadmin", _validado: "2026-11-19T12:00:05Z" };
  const fila = objetoAFila("eventos", conSelloOriginal(delRespaldo));
  assert.deepEqual(fila.datos._selloOriginal, { validacion: "autorizado", dice: null, por: "c-migue", rol: "superadmin", cuando: "2026-11-19T12:00:05Z", recibido: "2026-11-19T12:00:05Z" });
  for (const col of ["validacion", "validado_por", "validado", "recibido", "restaurado", "_validacion"]) assert.equal(col in fila, false, col + " no se manda como columna: la base no lo aceptaría");
  assert.equal(fila.datos.quien.nombre, "QUIEN CAPTURÓ", "quien lo capturó va dentro del evento, como siempre");
});
test("un_evento_que_nunca_subio_no_lleva_sello_que_restaurar", () => {
  const nuevo = { id: "e2", tipo: "marca", datos: {} };
  assert.equal(conSelloOriginal(nuevo), nuevo);
});
test("lo_restaurado_baja_diciendo_quien_lo_restauro_y_eso_solo_lo_dice_la_base", () => {
  const o = filaAObjeto({ id: "e1", tipo: "pago_personal", datos: { datos: { monto: 500 }, _restauradoPor: "yo-mismo" }, validacion: "autorizado", validado_por: "c-migue", restaurado: "2026-12-01T10:00:00Z", restaurado_por: "c-luis" });
  assert.equal(o._validadoPor, "c-migue"); assert.equal(o._restauradoPor, "c-luis", "vale la columna, no lo que venga escrito dentro"); assert.equal(o._restaurado, "2026-12-01T10:00:00Z");
  assert.equal(filaAObjeto({ id: "e3", datos: { _restauradoPor: "inventado" } })._restauradoPor, undefined);
});
