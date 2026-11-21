// El catálogo único de actividades, con datos INVENTADOS. Lo que se cuida: que no se invente ninguna actividad, que
// un texto desconocido no se adivine, que lo legal no se dé por bueno sin su norma y que nada restrinja todavía.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { catalogoEn, porLigar, guardarActividad, ligarTexto, ponerRequisito, claveDe, DE_FABRICA, TIPOS, OPERACION, RESTRICCIONES_ACTIVAS, CLASES_DE_REQUISITO } from "./actividades.js";
import { OPERACION_DE, nuevoEvento, exigirValidacion } from "./eventos.js";

const HOY = "2026-11-23", jefa = { id: "adm1", nombre: "ADMINISTRADORA INVENTADA", rol: "admin" };
let n = 0; const ctx = () => ({ quien: jefa, hoy: HOY, cuando: `${HOY}T15:00:${String(n++ % 60).padStart(2, "0")}.000Z` });
const va = (ev, r) => { assert.ok(r.ok, r.dice); ev.push(r.evento); return r; };

test("de_fabrica_solo_estan_las_actividades_que_las_pantallas_ya_ofrecian", () => {
  const c = catalogoEn([], HOY);
  assert.deepEqual(c.nombres(["campo"]), ["Control de plagas", "Cosecha", "Deshierbe", "Fertilización", "Limpieza", "Preparación de suelo", "Riego", "Siembra"]);
  assert.deepEqual(c.nombres(["vehiculo"]), ["Acarreo de cosecha", "Acarreo de insumos", "Mantenimiento del vehículo", "Traslado de personal"]);
  assert.equal(c.actividades.length, DE_FABRICA.length); assert.ok(c.actividades.every(a => a.deFabrica && a.requisitos.length === 0), "ninguna nace con requisitos: la app no decide qué pide cada una");
  // Y son las mismas que usa la app: una sola lista, no una copia.
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.ok(!/const ACTIVIDADES_DE_CAMPO = \[/.test(app) && !/const tiposAct = \["Preparación/.test(app), "las pantallas ya no traen su propia lista escrita a mano");
});

test("un_texto_se_reconoce_por_su_nombre_o_porque_alguien_lo_ligo_y_si_no_no_se_adivina", () => {
  const ev = [];
  assert.equal(catalogoEn(ev, HOY).normalizar("  RIEGO ").nombre, "Riego"); assert.equal(catalogoEn(ev, HOY).normalizar("fertilizacion").nombre, "Fertilización", "sin acento es la misma");
  assert.deepEqual(catalogoEn(ev, HOY).normalizar("echar agua a la 4"), { actividadId: null, nombre: "", via: "sin_reconocer" }, "parecerse no basta");
  va(ev, ligarTexto({ eventos: ev, escrito: "Regar", actividadId: "act-riego", ...ctx() }));
  assert.deepEqual([catalogoEn(ev, HOY).normalizar("regar").nombre, catalogoEn(ev, HOY).normalizar("regar").via], ["Riego", "equivalencia"]);
  assert.equal(ligarTexto({ eventos: ev, escrito: "Riego", actividadId: "act-siembra", ...ctx() }).ok, false, "el nombre de una actividad no se liga a otra");
  assert.equal(ligarTexto({ eventos: ev, escrito: "regar", actividadId: "act-siembra", ...ctx() }).ok, false, "cambiar una liga pide el porqué");
  va(ev, ligarTexto({ eventos: ev, escrito: "regar", actividadId: null, motivo: "se ligó mal", ...ctx() }));
  assert.equal(catalogoEn(ev, HOY).normalizar("regar").via, "sin_reconocer"); assert.equal(ev.length, 2, "quitar la liga es otro hecho: el anterior se queda");
});

test("lo_que_anda_en_los_registros_y_el_catalogo_no_reconoce_sale_por_ligar_sin_tocar_los_registros", () => {
  const e = (tipo, actividad) => nuevoEvento({ tipo, cuando: `${HOY}T14:00:00.000Z`, fecha: HOY, quien: jefa, datos: { actividad, trabajadorIds: ["p1"] } });
  const eventos = [e("asignacion", "Riego"), e("asignacion", "Destape de ajo"), e("cuadrilla_dia", "destape de ajo"), e("avance_trabajo", "Regar"), e("marca", "x")], antes = JSON.stringify(eventos);
  const tecleadas = [{ tipo: "Siembra" }, { tipo: "Otro" }, { tipo: "Pizca", cancelado: { motivo: "x" } }, { tipo: "Pizca" }];
  const p = porLigar({ eventos, actividades: tecleadas, catalogo: catalogoEn(eventos, HOY) });
  assert.deepEqual(p.map(x => [x.escrito, x.veces, x.donde]), [["Destape de ajo", 2, ["Cuadrillas", "Equipos de trabajo"]], ["Pizca", 1, ["Actividades registradas"]], ["Regar", 1, ["Avances"]]]);
  assert.equal(JSON.stringify(eventos), antes, "sólo se leen");
  const ev = [...eventos]; va(ev, guardarActividad({ eventos: ev, nombre: "Destape de ajo", ambito: "campo", ...ctx() }));
  assert.deepEqual(porLigar({ eventos: ev, actividades: tecleadas, catalogo: catalogoEn(ev, HOY) }).map(x => x.escrito), ["Pizca", "Regar"], "al darla de alta, lo ya registrado se reconoce solo");
});

test("agregar_renombrar_y_dar_de_baja_una_actividad_deja_historial_y_no_duplica", () => {
  const ev = [];
  assert.equal(guardarActividad({ eventos: ev, nombre: "riego", ambito: "campo", ...ctx() }).ok, false, "ya existe, aunque se escriba distinto");
  assert.equal(guardarActividad({ eventos: ev, nombre: "Poda", ambito: "donde sea", ...ctx() }).ok, false);
  const r = va(ev, guardarActividad({ eventos: ev, nombre: "Poda", ambito: "campo", ...ctx() })), id = r.evento.datos.actividadId;
  assert.equal(guardarActividad({ eventos: ev, actividadId: id, nombre: "Poda de formación", ambito: "campo", ...ctx() }).ok, false, "un cambio pide motivo");
  va(ev, guardarActividad({ eventos: ev, actividadId: id, nombre: "Poda de formación", ambito: "campo", motivo: "así le dicen", ...ctx() }));
  va(ev, guardarActividad({ eventos: ev, actividadId: "act-limpieza", nombre: "Limpieza", ambito: "campo", activa: false, motivo: "ya no se usa", ...ctx() }));
  const c = catalogoEn(ev, HOY);
  assert.ok(c.nombres(["campo"]).includes("Poda de formación") && !c.nombres(["campo"]).includes("Limpieza"), "la dada de baja ya no se ofrece");
  assert.equal(c.normalizar("limpieza").nombre, "Limpieza", "pero lo ya registrado con ella se sigue entendiendo");
  assert.equal(ev[1].datos.antes.nombre, "Poda"); assert.equal(ev.length, 3);
});

test("un_requisito_legal_nace_por_validar_y_no_se_da_por_bueno_sin_su_norma_ni_quien_la_valido", () => {
  const ev = [], base = { actividadId: "act-control-de-plagas", clase: "legal", descripcion: "Capacitación para manejo de plaguicidas" };
  const r = va(ev, ponerRequisito({ eventos: ev, ...base, ...ctx() })), id = r.evento.datos.requisitoId;
  let q = catalogoEn(ev, HOY).porId.get("act-control-de-plagas").requisitos[0];
  assert.deepEqual([q.clase, q.aplicabilidad, q.restringiria, q.restringeHoy], ["legal", "por_validar", false, false]); assert.match(q.estado, /Por validar/); assert.match(r.dice, /No restringe nada/);
  assert.match(ponerRequisito({ eventos: ev, ...base, requisitoId: id, aplicabilidad: "validada", motivo: "x", ...ctx() }).dice, /QUÉ norma/);
  assert.match(ponerRequisito({ eventos: ev, ...base, requisitoId: id, aplicabilidad: "validada", norma: "Norma inventada 000, numeral 1", motivo: "x", ...ctx() }).dice, /quién validó/);
  va(ev, ponerRequisito({ eventos: ev, ...base, requisitoId: id, aplicabilidad: "validada", norma: "Norma inventada 000, numeral 1", validadoPor: "ASESORA INVENTADA", motivo: "se revisó la norma", ...ctx() }));
  q = catalogoEn(ev, HOY).porId.get("act-control-de-plagas").requisitos[0];
  assert.deepEqual([q.aplicabilidad, q.norma, q.validadoPor, q.restringiria, q.restringeHoy], ["validada", "Norma inventada 000, numeral 1", "ASESORA INVENTADA", true, false], "validado restringiría… el día que se enciendan; hoy no");
  assert.equal(RESTRICCIONES_ACTIVAS, false, "nada de esto restringe todavía ninguna asignación");
});

test("lo_interno_no_se_disfraza_de_legal_y_la_experiencia_recomendada_nunca_impide", () => {
  const ev = [], A = "act-traslado-de-personal";
  assert.match(ponerRequisito({ eventos: ev, actividadId: A, clase: "interno", descripcion: "Autorización del encargado", norma: "Alguna ley", ...ctx() }).dice, /regístralo como legal/);
  const i = va(ev, ponerRequisito({ eventos: ev, actividadId: A, clase: "interno", descripcion: "Autorización del encargado", obliga: true, ...ctx() }));
  va(ev, ponerRequisito({ eventos: ev, actividadId: A, clase: "experiencia", descripcion: "Haber manejado antes ese vehículo", ...ctx() }));
  va(ev, ponerRequisito({ eventos: ev, actividadId: A, clase: "legal", descripcion: "Licencia vigente", ...ctx() }));
  const rs = catalogoEn(ev, HOY).porId.get(A).requisitos;
  assert.deepEqual(rs.map(r => [r.clase, r.restringiria]).sort(), [["experiencia", false], ["interno", true], ["legal", false]], "tres renglones aparte; el interno no hace válido al legal");
  assert.match(ponerRequisito({ eventos: ev, requisitoId: i.evento.datos.requisitoId, actividadId: A, clase: "legal", descripcion: "x", motivo: "x", ...ctx() }).dice, /no cambia de clase/);
  assert.ok(!("sustituye" in i.evento.datos)); assert.deepEqual(Object.keys(CLASES_DE_REQUISITO), ["legal", "interno", "experiencia"]);
  assert.equal(ponerRequisito({ eventos: ev, requisitoId: i.evento.datos.requisitoId, actividadId: A, activo: false, ...ctx() }).ok, false, "quitar un requisito pide el porqué");
  va(ev, ponerRequisito({ eventos: ev, requisitoId: i.evento.datos.requisitoId, actividadId: A, activo: false, motivo: "ya no se pide", ...ctx() }));
  assert.equal(catalogoEn(ev, HOY).porId.get(A).requisitos.length, 2);
  assert.equal(catalogoEn([], HOY).actividades.filter(a => a.requisitos.some(r => r.clase === "legal")).length, 0, "no se asume que ninguna actividad pida habilitación legal");
});

test("el_catalogo_lo_captura_quien_tiene_el_permiso_y_con_base_no_cuenta_hasta_que_se_autoriza", () => {
  for (const t of TIPOS) assert.equal(OPERACION_DE[t], OPERACION);
  const base = { eventos: [], nombre: "Poda", ambito: "campo", hoy: HOY, cuando: `${HOY}T15:00:00.000Z` };
  assert.equal(guardarActividad({ ...base, quien: { id: "x", nombre: "x", rol: "encargado" } }).ok, false);
  assert.equal(guardarActividad({ ...base, quien: jefa, permitido: false }).ok, false, "ni el administrador, si su cuenta no lo tiene otorgado");
  const r = guardarActividad({ ...base, quien: { id: "x", nombre: "x", rol: "agronomo" }, permitido: true }); assert.ok(r.ok);
  try { exigirValidacion(true);
    assert.ok(!catalogoEn([r.evento], HOY).nombres().includes("Poda"), "sin el sello de la base todavía no está en el catálogo");
    assert.ok(catalogoEn([{ ...r.evento, _validacion: "autorizado" }], HOY).nombres().includes("Poda"));
    assert.ok(!catalogoEn([{ ...r.evento, _validacion: "rechazado" }], HOY).nombres().includes("Poda"));
  } finally { exigirValidacion(false); }
  assert.equal(claveDe("  Preparación   de SUELO. "), "preparacion de suelo");
});
