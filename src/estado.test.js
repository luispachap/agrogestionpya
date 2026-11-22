// El estado del proyecto tiene UNA sola fuente (docs/ESTADO.json). El documento de auditoría y el tablero se generan
// de ahí; esta prueba falla si alguien cambia uno a mano o si el archivo de estado se contradice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generar, leerEstado, cuentas, revisar } from "../herramientas/estado.mjs";

test("el_archivo_de_estado_no_se_contradice", () => { assert.deepEqual(revisar(leerEstado()), []); });
test("el_documento_de_auditoria_y_el_tablero_dicen_lo_mismo_que_el_archivo_de_estado", () => {
  const { md, html } = generar();
  assert.equal(readFileSync(new URL("../docs/AUDITORIA-FUNCIONAL.md", import.meta.url), "utf8"), md, "corre: node herramientas/estado.mjs");
  assert.equal(readFileSync(new URL("../docs/tablero-de-cierre.html", import.meta.url), "utf8"), html, "corre: node herramientas/estado.mjs");
});
test("las_cifras_se_cuentan_no_se_escriben", () => {
  const e = leerEstado(), c = cuentas(e);
  assert.equal(c.aprobados + c.parciales + c.sinVerificar, 67);
  const { md, html } = generar();
  for (const texto of [md, html]) assert.ok(texto.includes(`${c.aprobados} aprobados`) || texto.includes(`${c.aprobados} módulos aprobados`));
});
test("un_modulo_no_se_aprueba_sin_un_recorrido_de_auditoria_que_lo_respalde", () => {
  const e = leerEstado(); e.modulos[0] = { ...e.modulos[0], estado: "APROBADO", prueba: "calculos.test" };
  assert.ok(revisar(e).some(f => /sin un recorrido de auditoría/.test(f)));
});
