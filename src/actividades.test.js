// El catálogo único de actividades, con datos INVENTADOS. Lo que se cuida: que no se invente ninguna actividad, que
// un texto desconocido no se adivine, que lo legal no se dé por bueno sin su norma y que nada restrinja todavía.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { catalogoEn, porLigar, guardarActividad, ligarTexto, ponerRequisito, claveDe, DE_FABRICA, DEL_RANCHO, TIPOS, OPERACION, RESTRICCIONES_ACTIVAS, CLASES_DE_REQUISITO, UMBRAL_PROVISIONAL } from "./actividades.js";
import { OPERACION_DE, nuevoEvento, exigirValidacion } from "./eventos.js";

const HOY = "2026-11-23", jefa = { id: "adm1", nombre: "ADMINISTRADORA INVENTADA", rol: "admin" };
let n = 0; const ctx = () => ({ quien: jefa, hoy: HOY, cuando: `${HOY}T15:00:${String(n++ % 60).padStart(2, "0")}.000Z` });
const va = (ev, r) => { assert.ok(r.ok, r.dice); ev.push(r.evento); return r; };

test("de_fabrica_solo_estan_las_actividades_que_las_pantallas_ya_ofrecian_y_las_del_rancho", () => {
  const c = catalogoEn([], HOY);
  const deSiempre = ["Control de plagas", "Cosecha", "Deshierbe", "Fertilización", "Limpieza", "Preparación de suelo", "Riego", "Siembra"];
  const delRanchoEn = (ambito) => DEL_RANCHO.filter(a => a.ambito === ambito).map(a => a.nombre);
  const orden = (l) => [...l].sort((a, b) => a.localeCompare(b, "es"));
  assert.deepEqual(c.nombres(["campo"]), orden([...deSiempre, ...delRanchoEn("campo")]));
  assert.deepEqual(c.nombres(["vehiculo"]), orden(["Acarreo de cosecha", "Acarreo de insumos", "Mantenimiento del vehículo", "Traslado de personal", "Subsoleo", "Rastreo", ...delRanchoEn("vehiculo")]));
  assert.equal(c.actividades.length, DE_FABRICA.length); assert.ok(c.actividades.every(a => a.deFabrica && a.requisitos.length === 0), "ninguna nace con requisitos: la app no decide qué pide cada una");
  // Todo lo que CUALQUIER captura ya ofrecía está en el catálogo con su mismo nombre: nada queda «por ligar» de fábrica
  // y nada nació duplicado (incluye el trabajo de bodega, que usa la captura del administrador).
  const app0 = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  const ofrecidas = new Set([...app0.matchAll(/\{ label: "([^"]+)", icon: "[^"]+" \}/g)].map(m => m[1]).filter(n => n !== "Otro"));
  assert.ok(ofrecidas.size >= 20, "se leyeron las listas de las capturas");
  for (const n of ofrecidas) assert.ok(c.normalizar(n).actividadId, `«${n}» se ofrece en una captura y no está en el catálogo`);
  assert.equal(new Set(c.actividades.map(a => claveDe(a.nombre))).size, c.actividades.length, "ninguna repetida");
  assert.equal(c.porId.get("act-empaque").ambito, "bodega"); assert.equal(c.normalizar("Limpieza").nombre, "Limpieza", "la bodega es un lugar: su limpieza es la misma Limpieza");
  assert.ok(!c.nombres().includes("Surcado") && !c.nombres().includes("Empaque"), "las de las capturas por oficio se reconocen, pero no se meten a Equipos de trabajo ni a Cuadrillas");
  assert.ok(c.nombres(["vehiculo"]).includes("Subsoleo"), "salvo las que el rancho tiene en su catálogo (Subsuelar, Arrastre)");
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
  assert.deepEqual([q.clase, q.aplicabilidad, q.restringiria, q.restringeHoy], ["legal", "por_validar", false, false]); assert.match(q.estado, /Por validar/); assert.match(q.estado, /no autoriza a nadie/); // un requisito pendiente nunca se lee como permiso para trabajar assert.match(r.dice, /No restringe nada/);
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

test("el_minimo_para_sugerir_una_especialidad_es_provisional_configurable_por_actividad_y_no_autoriza_nada", () => {
  const ev = [], c0 = catalogoEn(ev, HOY);
  assert.deepEqual(UMBRAL_PROVISIONAL, { dias: 10, horas: 40, confirmadas: 1, meses: 12 });
  assert.ok(c0.actividades.every(a => !a.umbralPropio && a.umbral === UMBRAL_PROVISIONAL));
  const base = { eventos: ev, actividadId: "act-riego", nombre: "Riego", ambito: "campo" };
  assert.match(guardarActividad({ ...base, umbral: { dias: 5, horas: 20, confirmadas: 0, meses: 12 }, motivo: "x", ...ctx() }).dice, /Sin ninguna jornada confirmada no se sugiere/);
  va(ev, guardarActividad({ ...base, umbral: { dias: 20, horas: 80, confirmadas: 3, meses: 12 }, motivo: "el riego pide más práctica", ...ctx() }));
  const c = catalogoEn(ev, HOY);
  assert.deepEqual([c.porId.get("act-riego").umbral, c.porId.get("act-riego").umbralPropio], [{ dias: 20, horas: 80, confirmadas: 3, meses: 12 }, true]);
  assert.equal(c.porId.get("act-siembra").umbralPropio, false, "las demás siguen con el provisional");
  assert.ok(c.porId.get("act-riego").requisitos.length === 0 && RESTRICCIONES_ACTIVAS === false, "el umbral no crea requisitos ni autoriza nada");
});

test("un_requisito_legal_guarda_fundamento_vigencia_y_quien_lo_valido_y_vencido_ya_no_restringiria", () => {
  const ev = [], A = "act-aplicacion-agroquimicos";
  const base = { actividadId: A, clase: "legal", descripcion: "Capacitación vigente", norma: "Norma inventada 000, numeral 2", aplicabilidad: "validada", validadoPor: "ASESORA INVENTADA (seguridad)" };
  assert.equal(ponerRequisito({ eventos: ev, ...base, vigenteDesde: "2026-12-01", vigenteHasta: "2026-11-01", ...ctx() }).ok, false);
  const r = va(ev, ponerRequisito({ eventos: ev, ...base, vigenteDesde: "2026-01-01", vigenteHasta: "2026-12-31", ...ctx() }));
  assert.equal(r.evento.datos.validadoEl, HOY);
  const q = catalogoEn(ev, HOY).porId.get(A).requisitos[0];
  assert.deepEqual([q.norma, q.validadoPor, q.validadoEl, q.vigenteDesde, q.vigenteHasta, q.vencido, q.restringiria, q.restringeHoy], ["Norma inventada 000, numeral 2", "ASESORA INVENTADA (seguridad)", HOY, "2026-01-01", "2026-12-31", false, true, false]);
  const v = catalogoEn(ev, "2027-01-05").porId.get(A).requisitos[0];
  assert.deepEqual([v.vencido, v.restringiria], [true, false]); assert.match(v.estado, /vigencia terminó/);
});

test("las_actividades_del_rancho_entran_sin_su_codigo_sin_duplicar_y_sin_las_ausencias", () => {
  const c = catalogoEn([], HOY);
  assert.equal(DEL_RANCHO.length, 33, "45 del Excel − Deshierbe (ya estaba) − 8 dichas de otra forma − 3 ausencias");
  for (const a of DEL_RANCHO) {
    assert.ok(!/\b([AG]\d{2}|GA\d|SUP|FAJ|FNJ|VAC)\b/.test(a.nombre), `«${a.nombre}» trae el código del Excel`);
    assert.equal(c.porId.get(c.normalizar(a.nombre).actividadId).nombre, a.nombre, "se reconoce por su nombre");
  }
  // Lo que ya estaba con otro nombre NO se duplica: si alguien lo escribe así, lo liga una persona.
  for (const n of ["Regar", "Sembrar", "Cosechar", "Fertilizar", "Limpiar", "Empacar", "Subsuelar", "Arrastre (Rastrear)"]) assert.equal(c.normalizar(n).via, "sin_reconocer", `«${n}» no se adivina`);
  // Una falta o las vacaciones no son una actividad.
  for (const n of ["Falta justificada", "Falta injustificada", "Vacaciones"]) assert.equal(c.normalizar(n).actividadId, null);
  // Plantar y Sembrar son distintas en el rancho: cada una tenía su clave.
  assert.notEqual(c.normalizar("Plantar").actividadId, c.normalizar("Siembra").actividadId);
  // La bodega y lo general quedan en el catálogo, pero no se ofrecen para pintar una parcela.
  assert.equal(c.porId.get(c.normalizar("Desgranar").actividadId).ambito, "bodega");
  assert.ok(!c.nombres(["campo", "vehiculo"]).includes("Desgranar") && !c.nombres(["campo"]).includes("Supervisar"));
});
