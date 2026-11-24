import { test } from "node:test";
import assert from "node:assert/strict";
import { conSelloOriginal, objetoAFila, filaAObjeto } from "./filas.js";

test("al_restaurar_el_sello_original_viaja_al_lado_del_evento_y_nunca_como_columna", () => {
  const delRespaldo = { id: "e1", tipo: "pago_personal", fecha: "2026-11-19", estado: "vigente", datos: { monto: 500 }, quien: { id: "c-migue", nombre: "QUIEN CAPTURÓ" },
    _recibido: "2026-11-19T12:00:05Z", _validacion: "autorizado", _validadoPor: "c-migue", _validadoRol: "superadmin", _validado: "2026-11-19T12:00:05Z", _selloFirma: "firma-de-la-base" };
  const fila = objetoAFila("eventos", conSelloOriginal(delRespaldo));
  assert.deepEqual(fila.datos._selloOriginal, { validacion: "autorizado", dice: null, por: "c-migue", rol: "superadmin", cuando: "2026-11-19T12:00:05Z", recibido: "2026-11-19T12:00:05Z", firma: "firma-de-la-base" });
  assert.equal(conSelloOriginal({ ...delRespaldo, _selloFirma: undefined })._selloOriginal, undefined, "sin la firma de la base no hay sello que restaurar");
  for (const col of ["validacion", "validado_por", "validado", "recibido", "restaurado", "sello_firma", "_validacion", "_selloFirma"]) assert.equal(col in fila, false, col + " no se manda como columna: la base no lo aceptaría");
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

// 24 nov, primera prueba en teléfonos de verdad: ningún mensaje del chat subía. La app mandaba la columna «deQuien» y en
// la base se llama `dequien` (la hoja la escribió sin comillas y PostgreSQL la guardó en minúsculas). La nube de
// imitación aceptaba cualquier columna, así que ningún recorrido lo vio. Esta prueba compara contra las hojas SQL.
import { COLUMNAS_REALES } from "./filas.js";
import { columnasDeLasHojas } from "../herramientas/columnas.mjs";
test("toda_columna_real_se_sube_con_el_nombre_que_tiene_en_la_base", () => {
  const hojas = columnasDeLasHojas();
  for (const [tabla, reales] of Object.entries(COLUMNAS_REALES)) {
    const fila = objetoAFila(tabla, Object.fromEntries(reales.map(c => [c, "x"])));
    for (const col of Object.keys(fila)) {
      assert.equal(col, col.toLowerCase(), `${tabla}.${col}: una columna sin comillas en la base siempre es minúscula`);
      if (hojas[tabla]) assert.ok(hojas[tabla].has(col), `${tabla}: la base no tiene la columna «${col}»; la app la mandaría y la base rechazaría el renglón entero`);
    }
  }
  assert.ok(hojas.chat && hojas.chat.has("dequien"), "la prueba sí lee las hojas");
});
test("el_mensaje_del_chat_sube_con_dequien_y_regresa_como_deQuien", () => {
  const fila = objetoAFila("chat", { id: "m1", fecha: "2026-11-24", tipo: "texto", deQuien: "c-fito", texto: "Ya entré" });
  assert.equal(fila.dequien, "c-fito"); assert.equal("deQuien" in fila, false);
  assert.equal(filaAObjeto({ id: "m1", dequien: "c-fito", datos: { texto: "Ya entré" } }).deQuien, "c-fito");
});
