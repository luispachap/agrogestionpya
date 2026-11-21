// El candado de la app Android: lo que se puede probar sin teléfono. Lo demás (huella, almacén protegido, pantalla
// privada) sólo se comprueba en un aparato.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tocaBloquear, PLAZOS, almacenDeSesion, comoSeDesbloquea } from "./nativoSeguro.js";

test("la_app_se_bloquea_segun_el_plazo_escogido_inmediato_un_minuto_o_cinco", () => {
  assert.deepEqual(PLAZOS.map(p => p.v), [0, 60, 300]);
  const fuera = (seg, plazo) => tocaBloquear({ salio: 1_000_000, volvio: 1_000_000 + seg * 1000, plazo });
  assert.equal(fuera(1, 0), true, "inmediato: cualquier salida bloquea");
  assert.deepEqual([fuera(59, 60), fuera(60, 60), fuera(299, 300), fuera(300, 300)], [false, true, false, true]);
  assert.equal(tocaBloquear({ salio: null, volvio: 5, plazo: 0 }), false, "si nunca salió, no hay nada que bloquear");
});

test("en_la_web_nada_de_esto_actua_la_sesion_se_guarda_donde_siempre", async () => {
  assert.equal(almacenDeSesion, undefined);
  assert.deepEqual(await comoSeDesbloquea(), { nativo: false, seguro: false, dice: "" });
});
