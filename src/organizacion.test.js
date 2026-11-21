// La organización, con áreas, equipos y gente INVENTADOS. Lo que se cuida: que reorganizar no borre lo anterior, que
// nada se asigne solo, que el mapa no dé permisos, y que ningún nombre de persona viva en la lógica.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { organizacionEn, superiorDe, enCalidadDe, crearUnidad, cambiarUnidad, cerrarUnidad, nombrarResponsable, quitarResponsable, adscribir, quitarAdscripcion, apoyar, cancelarHecho,
  historialDe, estructuraProvisional, ARRANQUE_PROVISIONAL, TIPOS, T_UNIDAD, T_CARGO } from "./organizacion.js";
import { OPERACION_DE, sinRepetir } from "./eventos.js";

const jefa = { id: "adm1", nombre: "ADMINISTRADORA INVENTADA", rol: "admin" };
const gente = [{ id: "p1", nombre: "PERSONA UNO" }, { id: "p2", nombre: "PERSONA DOS" }, { id: "p3", nombre: "PERSONA TRES" }, { id: "p4", nombre: "PERSONA CUATRO" }, { id: "p5", nombre: "PERSONA CINCO" }];
const P = (id) => gente.find(g => g.id === id);
let reloj = 0;
const ctx = (hoy) => ({ quien: jefa, hoy, cuando: `${hoy}T15:00:${String(reloj++ % 60).padStart(2, "0")}.000Z` });
// Un rancho de mentira: una dirección, dos áreas y dos equipos.
function armado() {
  const ev = [], va = (r) => { assert.ok(r.ok, r.dice); for (const e of r.eventos || [r.evento]) ev.push(e); return r; };
  const u = (nombre, clase, dependeDe, unidadId) => va(crearUnidad({ eventos: ev, nombre, clase, dependeDe, desde: "2026-11-02", unidadId, ...ctx("2026-11-02") }));
  u("Dirección general", "area", null, "dir"); u("Campo", "area", "dir", "campo"); u("Agronomía", "area", "dir", "agro"); u("Equipo norte", "equipo", "campo", "norte"); u("Aplicaciones", "equipo", "agro", "aplic");
  va(nombrarResponsable({ eventos: ev, unidadId: "dir", persona: P("p1"), desde: "2026-11-02", provisional: false, ...ctx("2026-11-02") }));
  va(nombrarResponsable({ eventos: ev, unidadId: "campo", persona: P("p2"), desde: "2026-11-02", provisional: false, ...ctx("2026-11-02") }));
  va(nombrarResponsable({ eventos: ev, unidadId: "norte", persona: P("p3"), desde: "2026-11-02", ...ctx("2026-11-02") }));
  va(adscribir({ eventos: ev, persona: P("p4"), unidadId: "norte", desde: "2026-11-02", ...ctx("2026-11-02") }));
  return { ev, va };
}
const en = (ev, fecha) => organizacionEn(ev, fecha, { personas: gente });

test("la_organizacion_se_arma_como_arbol_y_dice_lo_que_falta_sin_suponerlo", () => {
  const { ev } = armado(), o = en(ev, "2026-11-10");
  assert.deepEqual(o.unidades.map(u => [u.nombre, u.nivel]), [["Dirección general", 0], ["Agronomía", 1], ["Aplicaciones", 2], ["Campo", 1], ["Equipo norte", 2]]);
  assert.deepEqual(o.avisos.filter(a => a.clase === "sin_responsable").map(a => a.unidadId).sort(), ["agro", "aplic"], "sin responsable se dice; no se le pone el de arriba");
  assert.deepEqual(o.sinEquipo.map(p => p.personaId), ["p1", "p2", "p3", "p5"], "nadie queda en un equipo si nadie lo capturó: ser responsable tampoco te adscribe");
  assert.equal(o.porId.get("norte").responsable.provisional, true, "un responsable nace «por confirmar» si no se dice otra cosa");
  assert.deepEqual(en(ev, "2026-11-01").unidades, [], "antes de existir, no existe");
});

test("el_superior_sale_de_la_cadena_y_si_no_hay_con_que_decirlo_se_dice", () => {
  const { ev } = armado(), o = en(ev, "2026-11-10");
  assert.equal(superiorDe(o, "p4").superior.personaId, "p3", "el trabajador depende del responsable de su equipo");
  assert.equal(superiorDe(o, "p3").superior.personaId, "p2", "el responsable del equipo, del responsable del área");
  assert.equal(superiorDe(o, "p2").superior.personaId, "p1");
  assert.equal(superiorDe(o, "p1").superior, null); assert.match(superiorDe(o, "p1").dice, /unidad más alta/);
  assert.equal(superiorDe(o, "p5").superior, null); assert.match(superiorDe(o, "p5").dice, /No tiene equipo/);
  assert.match(superiorDe(o, "p4").dice, /por confirmar/, "si el cargo es provisional, el superior también se dice provisional");
});

test("cambiar_de_responsable_conserva_al_anterior_con_sus_fechas", () => {
  const { ev, va } = armado();
  assert.equal(nombrarResponsable({ eventos: ev, unidadId: "norte", persona: P("p5"), desde: "2026-11-16", ...ctx("2026-11-14") }).ok, false, "cambiar al responsable pide el porqué");
  va(nombrarResponsable({ eventos: ev, unidadId: "norte", persona: P("p5"), desde: "2026-11-16", provisional: false, motivo: "Persona tres pasa a otra área", ...ctx("2026-11-14") }));
  assert.equal(en(ev, "2026-11-15").porId.get("norte").responsable.personaId, "p3", "el día 15 todavía respondía la anterior");
  assert.equal(en(ev, "2026-11-16").porId.get("norte").responsable.personaId, "p5");
  assert.equal(superiorDe(en(ev, "2026-11-15"), "p4").superior.personaId, "p3"); assert.equal(superiorDe(en(ev, "2026-11-16"), "p4").superior.personaId, "p5");
  assert.deepEqual(enCalidadDe(en(ev, "2026-11-10"), "p3").respondePor.map(u => u.unidadId), ["norte"], "lo que hizo el día 10 lo hizo como responsable del equipo, aunque hoy ya no lo sea");
  assert.deepEqual(enCalidadDe(en(ev, "2026-11-20"), "p3").respondePor, []);
  const h = historialDe(ev, { unidadId: "norte" });
  assert.match(h[0].dice, /PERSONA CINCO quedó como responsable de Equipo norte, en lugar de PERSONA TRES/); assert.equal(h[0].motivo, "Persona tres pasa a otra área"); assert.equal(h[0].quien, "ADMINISTRADORA INVENTADA");
  // Confirmar a la misma persona no es un cambio de responsable.
  const { ev: e2, va: va2 } = armado();
  const c = va2(nombrarResponsable({ eventos: e2, unidadId: "norte", persona: P("p3"), desde: "2026-11-05", provisional: false, ...ctx("2026-11-05") }));
  assert.match(c.dice, /Confirmado/); assert.equal(en(e2, "2026-11-06").porId.get("norte").responsable.provisional, false);
  assert.equal(nombrarResponsable({ eventos: e2, unidadId: "norte", persona: P("p3"), desde: "2026-11-07", provisional: false, ...ctx("2026-11-07") }).ok, false, "ya lo es");
});

test("reorganizar_mover_un_equipo_y_renombrar_no_reescribe_lo_de_antes", () => {
  const { ev, va } = armado(), antes = JSON.stringify(ev);
  va(cambiarUnidad({ eventos: ev, unidadId: "norte", dependeDe: "agro", nombre: "Equipo de riegos", desde: "2026-11-20", motivo: "Riegos pasa a agronomía", ...ctx("2026-11-18") }));
  assert.equal(JSON.stringify(ev.slice(0, -1)), antes, "ningún hecho anterior cambió: sólo se agregó uno");
  const a = en(ev, "2026-11-19").porId.get("norte"), d = en(ev, "2026-11-20").porId.get("norte");
  assert.deepEqual([a.nombre, a.dependeDe], ["Equipo norte", "campo"]); assert.deepEqual([d.nombre, d.dependeDe], ["Equipo de riegos", "agro"]);
  assert.deepEqual(d.miembros.map(m => m.personaId), ["p4"], "la gente del equipo se va con el equipo; nadie se movió solo");
  assert.equal(superiorDe(en(ev, "2026-11-19"), "p3").superior.personaId, "p2"); assert.equal(superiorDe(en(ev, "2026-11-20"), "p3").superior.personaId, "p1", "agronomía no tiene responsable: sube hasta quien sí hay");
  assert.equal(cambiarUnidad({ eventos: ev, unidadId: "dir", dependeDe: "norte", desde: "2026-11-21", motivo: "x", ...ctx("2026-11-21") }).ok, false, "nada depende de algo que depende de ello");
  assert.equal(cambiarUnidad({ eventos: ev, unidadId: "campo", nombre: "Agronomía", desde: "2026-11-21", motivo: "x", ...ctx("2026-11-21") }).ok, false, "dos unidades no se llaman igual");
  assert.equal(cambiarUnidad({ eventos: ev, unidadId: "campo", nombre: "Campo abierto", desde: "2026-11-21", ...ctx("2026-11-21") }).ok, false, "un cambio pide su motivo");
});

test("una_unidad_no_se_cierra_con_gente_o_equipos_adentro_y_cerrada_conserva_su_historia", () => {
  const { ev, va } = armado();
  assert.match(cerrarUnidad({ eventos: ev, unidadId: "campo", hasta: "2026-11-30", motivo: "se junta con agronomía", ...ctx("2026-11-28") }).dice, /Equipo norte/);
  assert.match(cerrarUnidad({ eventos: ev, unidadId: "norte", hasta: "2026-11-30", motivo: "ya no hay", ...ctx("2026-11-28") }).dice, /1 persona/);
  va(adscribir({ eventos: ev, persona: P("p4"), unidadId: "aplic", desde: "2026-12-01", motivo: "se cierra su equipo", ...ctx("2026-11-28") }));
  va(cerrarUnidad({ eventos: ev, unidadId: "norte", hasta: "2026-11-30", motivo: "ya no hay", ...ctx("2026-11-28") }));
  assert.ok(en(ev, "2026-11-30").porId.has("norte")); assert.ok(!en(ev, "2026-12-01").porId.has("norte"));
  assert.equal(en(ev, "2026-11-25").dePersona("p4").equipo.nombre, "Equipo norte", "en noviembre era del equipo norte, aunque el equipo ya no exista");
  assert.equal(en(ev, "2026-12-05").dePersona("p4").equipo.nombre, "Aplicaciones");
  assert.deepEqual(en(ev, "2026-12-05").dePersona("p3").respondePor, [], "el responsable de una unidad cerrada ya no responde por ella");
  assert.match(historialDe(ev, { personaId: "p4" })[0].dice, /quedó en Aplicaciones \(antes, en Equipo norte\)/);
});

test("el_apoyo_temporal_no_cambia_el_equipo_habitual_y_se_acaba_solo", () => {
  const { ev, va } = armado();
  assert.equal(apoyar({ eventos: ev, persona: P("p4"), unidadId: "norte", desde: "2026-11-12", hasta: "2026-11-13", motivo: "x", ...ctx("2026-11-11") }).ok, false, "a su propio equipo no se le apoya");
  assert.equal(apoyar({ eventos: ev, persona: P("p4"), unidadId: "aplic", desde: "2026-11-13", hasta: "2026-11-12", motivo: "x", ...ctx("2026-11-11") }).ok, false);
  va(apoyar({ eventos: ev, persona: P("p4"), unidadId: "aplic", desde: "2026-11-12", hasta: "2026-11-13", motivo: "Faltaba gente para aplicar", ...ctx("2026-11-11") }));
  const d = en(ev, "2026-11-12").dePersona("p4");
  assert.equal(d.equipo.nombre, "Equipo norte"); assert.deepEqual(d.apoya.map(a => a.nombre), ["Aplicaciones"]);
  assert.deepEqual(en(ev, "2026-11-12").porId.get("norte").miembros.map(m => m.personaId), ["p4"], "sigue contando en su equipo: no está en dos");
  assert.deepEqual(en(ev, "2026-11-14").dePersona("p4").apoya, []); assert.deepEqual(en(ev, "2026-11-11").dePersona("p4").apoya, []);
});

test("un_hecho_con_fecha_pasada_se_marca_y_uno_cancelado_deja_de_contar_pero_se_ve", () => {
  const { ev, va } = armado();
  const r = va(adscribir({ eventos: ev, persona: P("p5"), unidadId: "aplic", desde: "2026-11-03", ...ctx("2026-11-20") }));
  assert.equal(r.evento.datos.retroactivo, true); assert.equal(r.evento.fecha, "2026-11-20", "el día en que se capturó no se disfraza");
  assert.equal(historialDe(ev, { personaId: "p5" })[0].retroactivo, true);
  const c = cancelarHecho(r.evento, { motivo: "Era otra persona", quien: jefa, cuando: "2026-11-20T18:00:00.000Z" });
  assert.ok(c.ok); const ev2 = ev.map(e => (e.id === r.evento.id ? c.evento : e));
  assert.equal(en(ev2, "2026-11-10").dePersona("p5").equipo, null);
  assert.deepEqual(historialDe(ev2, { personaId: "p5" })[0].cancelado, { motivo: "Era otra persona", por: "ADMINISTRADORA INVENTADA" });
  assert.equal(cancelarHecho(r.evento, { motivo: "", quien: jefa, cuando: "x" }).ok, false);
  va(quitarAdscripcion({ eventos: ev, personaId: "p4", hasta: "2026-11-21", motivo: "Se fue del rancho", ...ctx("2026-11-21") }));
  assert.equal(en(ev, "2026-11-21").dePersona("p4").equipo.nombre, "Equipo norte"); assert.equal(en(ev, "2026-11-22").dePersona("p4").equipo, null);
  va(quitarResponsable({ eventos: ev, unidadId: "campo", hasta: "2026-11-21", motivo: "Deja el cargo", ...ctx("2026-11-21") }));
  assert.equal(en(ev, "2026-11-22").porId.get("campo").responsable, null);
});

test("la_estructura_de_arranque_son_solo_unidades_provisionales_sin_personas_y_no_se_duplica", () => {
  const r = estructuraProvisional({ eventos: [], desde: "2026-11-23", ...ctx("2026-11-23") });
  assert.ok(r.ok); assert.equal(r.eventos.length, ARRANQUE_PROVISIONAL.length);
  assert.ok(r.eventos.every(e => e.tipo === T_UNIDAD && e.datos.provisional === true), "todo nace provisional");
  assert.ok(!r.eventos.some(e => e.tipo === T_CARGO || e.datos.persona), "ni un responsable ni una persona");
  const o = en(r.eventos, "2026-11-23");
  assert.deepEqual(o.unidades.map(u => [u.nombre, u.nivel, u.clase]), [["Dirección", 0, "area"], ["Operaciones agrícolas generales", 1, "area"], ["Operaciones agronómicas", 1, "area"], ["Riegos", 2, "equipo"]]);
  assert.equal(o.sinEquipo.length, gente.length, "nadie quedó asignado a nada"); assert.equal(o.avisos.filter(a => a.clase === "sin_responsable").length, 4);
  // En otro aparato, sin señal, alguien hace lo mismo: son los mismos hechos, no el doble.
  const otro = estructuraProvisional({ eventos: [], desde: "2026-11-23", ...ctx("2026-11-23") });
  assert.equal(en(sinRepetir([...r.eventos, ...otro.eventos]), "2026-11-23").unidades.length, 4);
  assert.equal(estructuraProvisional({ eventos: r.eventos, desde: "2026-11-24", ...ctx("2026-11-24") }).ok, false, "con unidades ya dadas de alta no se vuelve a proponer");
  // Validar una unidad es un hecho más, con su motivo.
  const v = cambiarUnidad({ eventos: r.eventos, unidadId: "org-riegos", provisional: false, desde: "2026-11-25", motivo: "Validado por Dirección", ...ctx("2026-11-25") });
  assert.ok(v.ok); assert.equal(en([...r.eventos, v.evento], "2026-11-25").porId.get("org-riegos").provisional, false); assert.equal(en([...r.eventos, v.evento], "2026-11-24").porId.get("org-riegos").provisional, true);
});

test("el_mapa_lo_captura_un_administrador_y_no_da_ni_lee_permisos", () => {
  const { ev } = armado();
  for (const rol of ["encargado", "agronomo", "finanzas", "dueno", "trabajador"]) assert.equal(crearUnidad({ eventos: ev, nombre: "Otra", clase: "equipo", desde: "2026-11-10", quien: { id: "x", nombre: "x", rol }, cuando: "2026-11-10T15:00:00.000Z", hoy: "2026-11-10" }).ok, false, rol);
  for (const t of TIPOS) assert.equal(OPERACION_DE[t], undefined, `${t} no es una operación sensible: el mapa no toca los permisos existentes`);
  const fuente = readFileSync(new URL("./organizacion.js", import.meta.url), "utf8");
  assert.ok(!/permisos_operacion|puede_operar|puedeOp|permisos_rol|otorgar_permiso/.test(fuente), "la organización no lee ni escribe permisos");
  // Y nadie decide dinero ni permisos leyendo el mapa.
  const ajenos = ["pagos.js", "resultado.js", "cierreMes.js", "cierres.js", "indirectos.js", "personal.js", "prestaciones.js", "conciliacion.js", "bonos.js", "calculos.js", "cuadrillas.js", "checador.js", "jornada.js", "asignaciones.js", "acceso.js", "eventos.js", "prestamos.js", "bajas.js"];
  for (const f of readdirSync(new URL(".", import.meta.url)).filter(x => ajenos.includes(x))) assert.ok(!/organizacion\.js|org_unidad|org_cargo|org_adscripcion/.test(readFileSync(new URL(f, import.meta.url), "utf8")), `${f} no debe leer la organización en esta etapa`);
});

test("ningun_nombre_de_persona_vive_en_la_logica_de_la_organizacion", () => {
  const fuente = readFileSync(new URL("./organizacion.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter(l => !l.trim().startsWith("//")).join("\n");   // los comentarios cuentan quién decidió; la lógica no nombra a nadie
  for (const nombre of ["Miguel", "Migue", "Fito", "Rodolfo", "Luis", "Gera"]) assert.ok(!new RegExp(`\\b${nombre}\\b`).test(fuente), `«${nombre}» no va en la lógica`);
  assert.ok(ARRANQUE_PROVISIONAL.every(u => !("persona" in u) && !("responsable" in u)));
});
