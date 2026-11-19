import { test } from "node:test";
import assert from "node:assert/strict";
import { desfaseDe, selloDeReloj, estadoDelReloj } from "./reloj.js";

const T0 = Date.parse("2026-11-19T16:00:00.000Z");
test("el_desfase_es_la_hora_del_servidor_menos_la_del_telefono_a_media_pregunta", () => {
  assert.equal(desfaseDe({ servidor: "2026-11-19T19:00:00.500Z", salio: T0, llego: T0 + 1000 }), 3 * 3600000, "el teléfono va 3 horas atrasado");
  assert.equal(desfaseDe({ servidor: "2026-11-19T16:00:00.400Z", salio: T0, llego: T0 + 800 }), 0);
  assert.equal(desfaseDe({ servidor: "2026-11-19T16:00:00Z", salio: T0, llego: T0 + 45000 }), null, "una respuesta que tardó 45 segundos no mide nada");
  assert.equal(desfaseDe({ servidor: "no es hora", salio: T0, llego: T0 + 10 }), null);
});
test("un_evento_nace_con_el_desfase_medido_o_diciendo_que_no_se_ha_comprobado", () => {
  assert.deepEqual(selloDeReloj({ desfase: 1200, cuando: T0 }, T0 + 3600000), { desfase: 1200 });
  assert.deepEqual(selloDeReloj(null, T0), { desfase: null });
  assert.deepEqual(selloDeReloj({ desfase: 1200, cuando: T0 }, T0 + 9 * 86400000), { desfase: null, vieja: true }, "una medida de hace nueve días ya no se da por buena");
});
test("a_la_persona_solo_se_le_avisa_cuando_la_hora_esta_de_verdad_mal", () => {
  assert.equal(estadoDelReloj({ desfase: 90000, cuando: T0 }, T0).clase, "bien");
  const mal = estadoDelReloj({ desfase: 3 * 3600000, cuando: T0 }, T0);
  assert.equal(mal.clase, "mal"); assert.match(mal.dice, /atrasada 3 horas/);
  assert.match(estadoDelReloj({ desfase: -20 * 60000, cuando: T0 }, T0).dice, /adelantada 20 minutos/);
  assert.equal(estadoDelReloj(null, T0).clase, "sin_medir");
});
