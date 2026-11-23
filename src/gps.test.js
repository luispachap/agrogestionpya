import { test } from "node:test";
import assert from "node:assert/strict";
import { dondeEstoy, marcaDesdeSuTelefono, textoDeMarcaGps, reglasDeGps, puedeChecarConGps } from "./gps.js";

// Dos ranchos inventados a unos 5 km uno del otro.
const R1 = { id: "r1", nombre: "RANCHO UNO", lat: 22.7700, lng: -102.5800 };
const R2 = { id: "r2", nombre: "RANCHO DOS", lat: 22.8150, lng: -102.5800 };
const ENC = { id: "enc1", nombre: "ENCARGADO", rol: "encargado" };
const ANA = { id: "t-ana", nombre: "ANA", checaConGps: "si", ranchoId: "r1" };
const cerca = (r, dLat = 0.0009) => ({ lat: r.lat + dLat, lng: r.lng, precision: 15 });   // ~100 m al norte

test("checar_desde_el_telefono_propio_cerca_de_su_rancho_deja_la_marca_con_su_posicion", () => {
  const d = dondeEstoy({ posicion: cerca(R1), ranchos: [R1, R2], ranchoHabitualId: "r1" });
  assert.equal(d.estado, "en_su_rancho"); assert.ok(d.distanciaM > 80 && d.distanciaM < 120, String(d.distanciaM));
  const r = marcaDesdeSuTelefono({ eventos: [], trabajador: ANA, soloDe: { id: "t-ana" }, ahora: "2026-11-19T13:00:00Z", fecha: "2026-11-19", quien: ENC, posicion: cerca(R1), donde: d });
  assert.ok(r.ok, r.dice);
  assert.equal(r.evento.datos.desdeSuTelefono, true); assert.equal(r.evento.datos.gps.ranchoId, "r1"); assert.equal(r.evento.datos.lugar.nombre, "RANCHO UNO");
  assert.match(textoDeMarcaGps(r.evento), /Desde su teléfono · a \d+ m de RANCHO UNO/);
});

test("en_otro_rancho_tiene_que_decir_a_que_fue_y_lejos_de_todo_no_se_registra", () => {
  const otro = dondeEstoy({ posicion: cerca(R2), ranchos: [R1, R2], ranchoHabitualId: "r1" });
  assert.equal(otro.estado, "en_otro_rancho");
  const sin = marcaDesdeSuTelefono({ eventos: [], trabajador: ANA, soloDe: { id: "t-ana" }, ahora: "2026-11-19T13:00:00Z", fecha: "2026-11-19", quien: ENC, posicion: cerca(R2), donde: otro });
  assert.equal(sin.ok, false); assert.equal(sin.pideMotivo, true);
  const con = marcaDesdeSuTelefono({ eventos: [], trabajador: ANA, soloDe: { id: "t-ana" }, ahora: "2026-11-19T13:00:00Z", fecha: "2026-11-19", quien: ENC, posicion: cerca(R2), donde: otro, motivo: "A AYUDAR CON LA COSECHA" });
  assert.ok(con.ok); assert.equal(con.evento.datos.motivo, "A AYUDAR CON LA COSECHA"); assert.match(textoDeMarcaGps(con.evento), /no es el suyo/);
  const lejos = dondeEstoy({ posicion: { lat: 23.2, lng: -102.58, precision: 10 }, ranchos: [R1, R2] });
  assert.equal(lejos.estado, "lejos"); assert.equal(lejos.marca, false); assert.match(lejos.dice, /Avisa a tu encargado/);
});

test("un_gps_sin_precision_no_tira_la_marca_la_deja_por_revisar_y_sin_ranchos_con_ubicacion_no_se_supone_nada", () => {
  const d = dondeEstoy({ posicion: { ...cerca(R1), precision: 400 }, ranchos: [R1], precisionMaxM: 100 });
  assert.equal(d.estado, "sin_precision"); assert.equal(d.marca, true);
  const r = marcaDesdeSuTelefono({ eventos: [], trabajador: ANA, soloDe: { id: "t-ana" }, ahora: "2026-11-19T13:00:00Z", fecha: "2026-11-19", quien: ENC, posicion: { ...cerca(R1), precision: 400 }, donde: d });
  assert.ok(r.ok); assert.equal(r.evento.datos.porRevisar, true); assert.match(textoDeMarcaGps(r.evento), /por revisar/);
  assert.equal(dondeEstoy({ posicion: cerca(R1), ranchos: [{ id: "r9", nombre: "SIN UBICACION" }] }).estado, "sin_ranchos");
  assert.equal(dondeEstoy({ posicion: null, ranchos: [R1] }).estado, "sin_gps");
});

test("en_el_telefono_de_una_persona_solo_checa_esa_persona_y_solo_si_la_activaron", () => {
  const d = dondeEstoy({ posicion: cerca(R1), ranchos: [R1] });
  assert.equal(marcaDesdeSuTelefono({ eventos: [], trabajador: { id: "t-beto", checaConGps: "si" }, soloDe: { id: "t-ana", nombre: "ANA" }, ahora: "2026-11-19T13:00:00Z", fecha: "2026-11-19", quien: ENC, posicion: cerca(R1), donde: d }).ok, false);
  assert.equal(marcaDesdeSuTelefono({ eventos: [], trabajador: { id: "t-ana" }, soloDe: { id: "t-ana" }, ahora: "2026-11-19T13:00:00Z", fecha: "2026-11-19", quien: ENC, posicion: cerca(R1), donde: d }).ok, false, "sin activar en su ficha no checa desde su teléfono");
  assert.equal(puedeChecarConGps({ checaConGps: "si", activo: false }), false);
  assert.deepEqual(reglasDeGps([]), { radioM: 300, precisionMaxM: 100 });
});

test("un_gps_impreciso_lejisimos_de_todo_rancho_no_se_acepta_por_revisar_se_dice_que_esta_lejos", () => {
  const d = dondeEstoy({ posicion: { lat: 23.2, lng: -102.58, precision: 400 }, ranchos: [R1, R2], radioM: 300, precisionMaxM: 100 });
  assert.equal(d.estado, "lejos"); assert.equal(d.marca, false);
  assert.equal(dondeEstoy({ posicion: { lat: R1.lat + 0.004, lng: R1.lng, precision: 400 }, ranchos: [R1], radioM: 300, precisionMaxM: 100 }).estado, "sin_precision", "a 450 m con ±400 m puede estar en el rancho: por revisar");
});
