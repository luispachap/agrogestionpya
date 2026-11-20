import test from "node:test";
import assert from "node:assert/strict";
import { CATALOGO_OFICIAL, catalogoDe, salarioMinimoEn, capturarSalarioMinimo, alertaDeSalarioMinimo } from "./salariosMinimos.js";

const quien = { id: "u1", nombre: "LUIS DE PRUEBA", rol: "admin" };
const base = { permitido: true, quien, cuando: "2026-12-10T18:00:00.000Z", fecha: "2026-12-10", liga: "https://www.dof.gob.mx/nota_detalle.php?codigo=1" };

test("el_salario_minimo_es_el_de_la_fecha_del_calculo_no_el_de_hoy", () => {
  assert.equal(salarioMinimoEn("2026-11-19").monto, 315.04);
  assert.equal(salarioMinimoEn("2025-12-31").monto, 278.80);
  assert.equal(salarioMinimoEn("2024-06-15").monto, 248.93);
  assert.equal(salarioMinimoEn("2019-01-01").monto, 102.68);
});
test("zacatecas_usa_el_general_y_la_frontera_norte_va_aparte", () => {
  assert.equal(salarioMinimoEn("2026-03-01", "general").monto, 315.04);
  assert.equal(salarioMinimoEn("2026-03-01", "frontera").monto, 440.87);
  assert.equal(salarioMinimoEn("2026-03-01", "zona_inventada").zona, "general");
});
test("si_falta_el_anio_dice_no_se_y_no_usa_el_del_anio_pasado", () => {
  const r = salarioMinimoEn("2027-01-15");
  assert.equal(r.monto, null);
  assert.match(r.dice, /Falta capturar el salario mínimo oficial de 2027/);
  assert.equal(salarioMinimoEn("2018-05-01").monto, null);
  assert.equal(salarioMinimoEn("").monto, null);
});
test("cada_renglon_de_fabrica_dice_de_que_publicacion_sale_y_no_hay_anios_repetidos", () => {
  assert.equal(new Set(CATALOGO_OFICIAL.map(c => c.desde)).size, CATALOGO_OFICIAL.length);
  for (const c of CATALOGO_OFICIAL) { assert.match(c.fuente, /CONASAMI, DOF/); assert.ok(c.frontera > c.general && c.general > 0); assert.ok(["texto", "tabla"].includes(c.verificado)); }
  for (let i = 1; i < CATALOGO_OFICIAL.length; i++) assert.ok(CATALOGO_OFICIAL[i].general > CATALOGO_OFICIAL[i - 1].general);
});
test("capturar_un_anio_nuevo_pide_la_publicacion_oficial_y_conserva_lo_anterior", () => {
  assert.equal(capturarSalarioMinimo({ ...base, permitido: false, desde: "2027-01-01", general: 350, frontera: 460, fuente: "Resolución CONASAMI, DOF 09/12/2026" }).ok, false);
  assert.match(capturarSalarioMinimo({ ...base, desde: "2027-01-01", general: 350, frontera: 460, fuente: "" }).dice, /publicación oficial/);
  assert.match(capturarSalarioMinimo({ ...base, desde: "2027-01-01", general: 350, frontera: 300, fuente: "Resolución CONASAMI, DOF 09/12/2026" }).dice, /no puede ser menor/);
  assert.match(capturarSalarioMinimo({ ...base, desde: "2027-01-01", general: 0, frontera: 300, fuente: "Resolución CONASAMI, DOF 09/12/2026" }).dice, /general/);
  const r = capturarSalarioMinimo({ ...base, desde: "2027-01-01", general: 350, frontera: 460, fuente: "Resolución CONASAMI, DOF 09/12/2026" });
  assert.ok(r.ok);
  const ev = [r.evento];
  assert.equal(salarioMinimoEn("2027-02-01", "general", ev).monto, 350);
  assert.equal(salarioMinimoEn("2026-12-31", "general", ev).monto, 315.04, "el de 2026 no cambia");
  assert.equal(salarioMinimoEn("2027-02-01", "general", ev).origen, "capturado");
});
test("corregir_un_anio_no_borra_lo_que_decia_queda_como_historial", () => {
  const a = capturarSalarioMinimo({ ...base, desde: "2027-01-01", general: 305, frontera: 460, fuente: "Resolución CONASAMI, DOF 09/12/2026" });
  assert.ok(a.ok && a.avisos.some(x => /menor que el del periodo anterior/.test(x)), "avisa el posible error de dedo y no bloquea");
  const b = capturarSalarioMinimo({ ...base, eventos: [a.evento], cuando: "2026-12-11T18:00:00.000Z", desde: "2027-01-01", general: 350, frontera: 460, fuente: "Resolución CONASAMI, DOF 09/12/2026 (corregido)" });
  assert.ok(b.ok && b.avisos.some(x => /Quedan como historial/.test(x)));
  const fila = catalogoDe([a.evento, b.evento]).find(c => c.desde === "2027-01-01");
  assert.equal(fila.general, 350); assert.equal(fila.anteriores.length, 1); assert.equal(fila.anteriores[0].general, 305);
  assert.equal(capturarSalarioMinimo({ ...base, eventos: [a.evento, b.evento], desde: "2027-01-01", general: 350, frontera: 460, fuente: "Resolución CONASAMI, DOF 09/12/2026" }).ok, false, "lo mismo dos veces no entra");
  const c = capturarSalarioMinimo({ ...base, desde: "2026-01-01", general: 316, frontera: 441, fuente: "Fe de erratas de prueba, DOF" });
  assert.equal(catalogoDe([c.evento]).find(x => x.desde === "2026-01-01").anteriores[0].origen, "fabrica");
});

test("en_diciembre_avisa_que_falta_el_del_anio_que_viene_y_en_enero_ya_es_urgente_sin_proponer_importe", () => {
  assert.equal(alertaDeSalarioMinimo("2026-11-30"), null, "en noviembre todavía no se publica: no es alarma");
  const dic = alertaDeSalarioMinimo("2026-12-01");
  assert.equal(dic.nivel, "aviso"); assert.equal(dic.anio, 2027); assert.match(dic.dice, /Diario Oficial de la Federación; no se usa el del año anterior/); assert.doesNotMatch(dic.dice, /\$|315/);
  const ene = alertaDeSalarioMinimo("2027-01-02");
  assert.equal(ene.nivel, "urgente"); assert.equal(ene.anio, 2027);
  const r = capturarSalarioMinimo({ ...base, desde: "2027-01-01", general: 350, frontera: 460, fuente: "Resolución CONASAMI, DOF 09/12/2026" });
  assert.equal(alertaDeSalarioMinimo("2026-12-15", "general", [r.evento]), null, "capturado, se calla"); assert.equal(alertaDeSalarioMinimo("2027-01-02", "general", [r.evento]), null);
});
test("el_salario_minimo_no_entra_sin_evidencia_de_la_publicacion_oficial", () => {
  const d = { ...base, liga: "", desde: "2027-01-01", general: 350, frontera: 460 };
  assert.match(capturarSalarioMinimo({ ...d, fuente: "Lo dijo el periódico de hoy" }).dice, /Diario Oficial de la Federación/);
  assert.match(capturarSalarioMinimo({ ...d, fuente: "Resolución CONASAMI, DOF 09/12/2026" }).dice, /Falta la evidencia/);
  assert.match(capturarSalarioMinimo({ ...d, fuente: "Resolución CONASAMI, DOF 09/12/2026", liga: "https://noticias.example.com/salario" }).dice, /sitio oficial/);
  assert.match(capturarSalarioMinimo({ ...d, fuente: "Resolución CONASAMI, DOF 09/12/2026", liga: "https://dof.gob.mx.falso.example.com/x" }).dice, /sitio oficial/);
  const conFoto = capturarSalarioMinimo({ ...d, fuente: "Resolución CONASAMI, DOF 09/12/2026", evidencia: "archivo:abc.pdf" });
  assert.ok(conFoto.ok); assert.equal(conFoto.evento.datos.evidencia, "archivo:abc.pdf");
  const conLiga = capturarSalarioMinimo({ ...d, fuente: "Resolución CONASAMI, DOF 09/12/2026", liga: "https://sidof.segob.gob.mx/notas/123" });
  assert.ok(conLiga.ok); assert.equal(catalogoDe([conLiga.evento]).find(c => c.desde === "2027-01-01").liga, "https://sidof.segob.gob.mx/notas/123");
});
