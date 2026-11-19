import { test } from "node:test";
import assert from "node:assert/strict";
import { nuevoEvento, cancelarEvento, corregirEvento, vigentes, sinRepetir, efectosDe, reglasDe, rastroDe, derivadosDe, cambioPermitido, idDeEvento, idDeEfecto } from "./eventos.js";

const LUIS = { id: "u1", nombre: "Luis", rol: "admin" };
const ev = (datos, mas = {}) => nuevoEvento({ tipo: "prueba", cuando: "2026-11-19T12:00:00Z", fecha: "2026-11-19", quien: LUIS, datos, ...mas });
reglasDe("prueba", (e) => [{ clase: "kilos", kilos: e.datos.kilos }, { clase: "kilos", kilos: 1 }]);

test("un_evento_sin_quien_cuando_o_dia_no_nace", () => {
  assert.throws(() => nuevoEvento({ tipo: "x", cuando: "2026-11-19T12:00:00Z", fecha: "2026-11-19", quien: {} }));
  assert.throws(() => nuevoEvento({ tipo: "x", cuando: "ayer", fecha: "2026-11-19", quien: LUIS }));
  assert.throws(() => nuevoEvento({ tipo: "x", cuando: "2026-11-19T12:00:00Z", fecha: "19/11/2026", quien: LUIS }));
  assert.throws(() => nuevoEvento({ tipo: "x", cuando: "2026-11-19T12:00:00Z", fecha: "2026-11-19", quien: LUIS, origen: "ev-1" }), "origen sin decir qué relación");
});

test("dos_aparatos_sin_senal_a_la_misma_hora_no_chocan_de_id", () => {
  const ids = new Set(Array.from({ length: 500 }, () => idDeEvento("marca", "2026-11-19T12:00:00Z")));
  assert.equal(ids.size, 500);
});

test("subir_dos_veces_el_mismo_evento_no_duplica_ni_el_evento_ni_su_costo", () => {
  const e = ev({ kilos: 40 });
  const dosVeces = [e, { ...e }, { ...e }];
  assert.equal(sinRepetir(dosVeces).length, 1);
  const efectos = efectosDe(dosVeces);
  assert.equal(efectos.length, 2);
  assert.equal(efectos.reduce((s, f) => s + f.kilos, 0), 41);
});

test("cada_efecto_dice_de_que_evento_salio_y_su_id_sale_del_evento", () => {
  const e = ev({ kilos: 40 });
  const [a, b] = efectosDe([e]);
  assert.equal(a.ev, e.id); assert.equal(a.id, idDeEfecto(e.id, "kilos", 0)); assert.equal(b.id, idDeEfecto(e.id, "kilos", 1));
  assert.equal(a.fecha, "2026-11-19");
  assert.deepEqual(efectosDe([e]).map(x => x.id), efectosDe([e]).map(x => x.id), "calcular otra vez da los mismos ids");
});

test("cancelar_pide_motivo_no_borra_y_quita_las_consecuencias", () => {
  const e = ev({ kilos: 40 });
  assert.equal(cancelarEvento(e, { motivo: " ", quien: LUIS, cuando: "2026-11-19T13:00:00Z" }).ok, false);
  const c = cancelarEvento(e, { motivo: "se capturó dos veces", quien: LUIS, cuando: "2026-11-19T13:00:00Z" });
  assert.ok(c.ok);
  assert.deepEqual(c.evento.datos, e.datos, "lo que decía sigue ahí");
  assert.equal(c.evento.cancelado.por.nombre, "Luis");
  assert.deepEqual(efectosDe([c.evento]), []);
  assert.equal(cancelarEvento(c.evento, { motivo: "otra vez", quien: LUIS, cuando: "2026-11-19T14:00:00Z" }).ok, false, "lo cancelado no se vuelve a cancelar");
});

test("corregir_deja_el_anterior_intacto_y_solo_cuenta_el_nuevo", () => {
  const e = ev({ kilos: 40 });
  const c = corregirEvento(e, { datos: { kilos: 45 } }, { motivo: "eran 45", quien: LUIS, cuando: "2026-11-19T15:00:00Z" });
  assert.ok(c.ok);
  assert.equal(c.anterior.datos.kilos, 40); assert.equal(c.anterior.corregidoPor, c.nuevo.id);
  assert.equal(c.nuevo.origen, e.id); assert.equal(c.nuevo.relacion, "corrige");
  const todos = [c.anterior, c.nuevo];
  assert.equal(vigentes(todos).length, 1);
  assert.equal(efectosDe(todos).reduce((s, f) => s + f.kilos, 0), 46, "no se suman los 40 viejos");
  assert.deepEqual(rastroDe(todos, c.nuevo.id).map(x => x.datos.kilos), [40, 45]);
  assert.deepEqual(rastroDe(todos, e.id).map(x => x.id), [e.id, c.nuevo.id], "desde el viejo también se llega al nuevo");
});

test("una_copia_vieja_de_otro_telefono_no_revive_un_evento_cancelado", () => {
  const e = ev({ kilos: 40 });
  const c = cancelarEvento(e, { motivo: "error", quien: LUIS, cuando: "2026-11-19T13:00:00Z" }).evento;
  assert.deepEqual(efectosDe([c, e]), []); assert.deepEqual(efectosDe([e, c]), []);
});

test("lo_que_cuelga_de_un_evento_sin_corregirlo_se_encuentra", () => {
  const retiro = ev({ kilos: 10 });
  const devol = ev({ kilos: 3 }, { origen: retiro.id, relacion: "devuelve", cuando: "2026-11-19T18:00:00Z" });
  assert.deepEqual(derivadosDe([retiro, devol], retiro.id).map(x => x.id), [devol.id]);
});

test("un_evento_guardado_solo_cambia_de_estado_nunca_de_contenido", () => {
  const e = ev({ kilos: 40, lugar: { a: 1, b: 2 } });
  assert.ok(cambioPermitido(e, cancelarEvento(e, { motivo: "x", quien: LUIS, cuando: "2026-11-19T13:00:00Z" }).evento));
  assert.ok(cambioPermitido(e, { ...e, datos: { lugar: { b: 2, a: 1 }, kilos: 40 } }), "el orden de los campos no es un cambio");
  assert.ok(!cambioPermitido(e, { ...e, datos: { ...e.datos, kilos: 400 } }));
  assert.ok(!cambioPermitido(e, { ...e, cuando: "2026-11-18T12:00:00.000Z" }));
  assert.ok(!cambioPermitido(e, { ...e, quien: { ...e.quien, id: "otro" } }));
});
