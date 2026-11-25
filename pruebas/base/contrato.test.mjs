// EL CONTRATO ENTRE LA APP Y LA BASE: lo que la app sube, ¿lo acepta la base?
//
// 24 nov, la primera prueba con teléfonos de verdad: el chat y lo cancelado no subían, y ninguna prueba lo había visto
// porque las pantallas se prueban contra una nube de imitación que acepta todo. Aquí se usa el MISMO código con que la
// app sube (`src/subir.js`: cómo se arma el renglón, cuándo es alta, cuándo es cambio) contra una base de verdad armada
// con las hojas SQL, para cada colección que sincroniza y cada perfil, como lo mandaría PostgREST:
//   · si el perfil puede crear, el alta entra;
//   · subir otra vez lo mismo (la respuesta se perdió con mala señal) nunca es un rechazo;
//   · si el perfil puede editar, la corrección entra y queda;
//   · si no puede crear, la base lo rechaza (y la app no debe ofrecerlo).
// Lo que aquí falle es algo que en el rancho se queda «pendiente de subir» con señal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { armarBase, como, verdad } from "./base.mjs";
import { subirRegistro, SOLO_ALTA } from "../../src/subir.js";
import { COLUMNAS_REALES } from "../../src/filas.js";
import { nuevoEvento, cancelarEvento } from "../../src/eventos.js";

const TABLAS = JSON.parse("[" + /export const TABLAS = \[([\s\S]*?)\];/.exec(readFileSync(new URL("../../src/dataApi.js", import.meta.url), "utf8"))[1].replace(/\/\/[^\n]*/g, "").replace(/,\s*$/, "") + "]");
const PERFILES = ["luis", "encargado", "agronomo", "finanzas", "dueno"];

// Como PostgREST le habla a la base: upsert = INSERT … ON CONFLICT (id) DO UPDATE (o DO NOTHING); update por id.
const q = (k) => `"${k}"`;
const valores = (f) => Object.values(f).map(v => (v !== null && typeof v === "object" ? JSON.stringify(v) : v));
function clienteDe(db, quien) {
  const r = (x) => (x.ok ? { data: x.filas, error: null } : { data: null, error: { code: x.codigo, message: x.error } });
  return {
    upsert: async (tabla, fila, { soloFaltantes = false, regresar = false } = {}) => {
      const c = Object.keys(fila);
      const set = c.filter(k => k !== "id").map(k => `${q(k)} = excluded.${q(k)}`).join(", ");
      return r(await como(db, quien, `insert into ${tabla} (${c.map(q).join(", ")}) values (${c.map((_, i) => `$${i + 1}`).join(", ")})
        on conflict (id) do ${soloFaltantes ? "nothing" : `update set ${set}`}${regresar ? " returning *" : ""}`, valores(fila)));
    },
    update: async (tabla, fila, { regresar = false } = {}) => {
      const c = Object.keys(fila).filter(k => k !== "id");
      return r(await como(db, quien, `update ${tabla} set ${c.map((k, i) => `${q(k)} = $${i + 1}`).join(", ")} where id = $${c.length + 1}${regresar ? " returning *" : ""}`, [...valores(Object.fromEntries(c.map(k => [k, fila[k]]))), fila.id]));
    },
    insert: async (tabla, fila, { regresar = false } = {}) => {
      const c = Object.keys(fila);
      return r(await como(db, quien, `insert into ${tabla} (${c.map(q).join(", ")}) values (${c.map((_, i) => `$${i + 1}`).join(", ")})${regresar ? " returning *" : ""}`, valores(fila)));
    },
    leer: async (tabla, id) => { const x = await como(db, quien, `select * from ${tabla} where id = $1`, [id]); return x.ok ? { data: x.filas[0] || null, error: null } : r(x); },
  };
}

let n = 0;
const idComoLosReales = (letra) => `${letra}${1795222807822 + (n++)}${Math.random().toString(36).slice(2, 9).padEnd(7, "0")}`;
// Un registro como los que arma la app: con su marca de espacio y de nacimiento, y sus columnas propias llenas.
function registroDe(tabla) {
  const o = { id: idComoLosReales(tabla[0]), _espacio: "prueba", _nace: `nace-${n}`, nota: "DE PRUEBA" };
  for (const k of COLUMNAS_REALES[tabla] || []) if (k !== "id") o[k] = k === "confiable" ? false : k === "fecha" ? "2026-11-24" : `${k}-prueba`;
  return o;
}
const puede = async (db, quien, tabla, accion) => (await como(db, quien, "select puede($1, $2) as si", [tabla, accion])).filas[0]?.si === true;

let db;
test("se arma la base y se sella su espacio", async () => {
  db = await armarBase();
  const esp = (await verdad(db, "select espacio from operacion"))[0]?.espacio;
  if (!esp) await verdad(db, "select sellar_espacio('prueba')");
  assert.ok(TABLAS.length >= 55, `se leyeron ${TABLAS.length} colecciones`);
});

test("cada_coleccion_que_sincroniza_la_acepta_la_base_con_quien_puede_y_subir_dos_veces_no_es_rechazo", async () => {
  const fallas = [];
  for (const tabla of TABLAS.filter(t => t !== "eventos" && t !== "chat")) {
    for (const quien of PERFILES) {
      // La bitácora de auditoría la escribe cualquiera con perfil y nadie la cambia (hoja 22): no va por `puede`.
      const soloAlta = SOLO_ALTA.includes(tabla);
      const c = clienteDe(db, quien);
      const crea = soloAlta ? (await como(db, quien, "select tiene_perfil() as si")).filas[0]?.si === true : await puede(db, quien, tabla, "crear");
      const edita = soloAlta ? false : await puede(db, quien, tabla, "editar");
      const r = registroDe(tabla);
      const alta = await subirRegistro(c, tabla, r).then(() => null, (e) => e);
      if (crea && alta) { fallas.push(`${tabla} · ${quien}: el alta se rechazó (${alta.message})`); continue; }
      if (!crea) { if (!alta) fallas.push(`${tabla} · ${quien}: no puede crear y la base lo dejó`); continue; }
      const otra = await subirRegistro(c, tabla, r).then(() => null, (e) => e);
      if (otra) fallas.push(`${tabla} · ${quien}: subir otra vez lo mismo se rechazó (${otra.message})`);
      if (soloAlta) {
        const cambio = await subirRegistro(c, tabla, { ...r, nota: "CAMBIADO" }).then(() => null, (e) => e);
        const quedo = (await verdad(db, `select datos->>'nota' as nota from ${tabla} where id = $1`, [r.id]))[0]?.nota;
        if (quedo !== "DE PRUEBA") fallas.push(`${tabla} · ${quien}: un renglón de la bitácora se pudo cambiar`);
        if (cambio && !/identificador_ocupado/.test(cambio.message || "") && cambio.code !== "42501") fallas.push(`${tabla} · ${quien}: cambiarlo dio un error raro (${cambio.message})`);
      }
      if (edita) {
        const cor = await subirRegistro(c, tabla, { ...r, nota: "CORREGIDO" }).then(() => null, (e) => e);
        const quedo = (await verdad(db, `select datos->>'nota' as nota from ${tabla} where id = $1`, [r.id]))[0]?.nota;
        if (cor || quedo !== "CORREGIDO") fallas.push(`${tabla} · ${quien}: la corrección no quedó (${cor?.message || quedo})`);
      } else if (!soloAlta) {
        // Puede dar de alta y no corregir: la corrección se dice como rechazo (no se da por subida) y lo de la base no cambia.
        const cor = await subirRegistro(c, tabla, { ...r, nota: "CORREGIDO" }).then(() => null, (e) => e);
        const quedo = (await verdad(db, `select datos->>'nota' as nota from ${tabla} where id = $1`, [r.id]))[0]?.nota;
        if (!cor || cor.code !== "42501" || quedo !== "DE PRUEBA") fallas.push(`${tabla} · ${quien}: sin permiso de corregir, la corrección debe ser un rechazo claro (${cor?.message || "entró"}, quedó ${quedo})`);
      }
    }
  }
  assert.deepEqual(fallas, []);
});

const quienEs = (rol, id) => ({ id, nombre: `Prueba ${rol}`, rol });
test("un_evento_de_cada_perfil_que_crea_eventos_entra_y_subirlo_otra_vez_no_es_rechazo", async () => {
  const fallas = [];
  for (const quien of PERFILES) {
    const c = clienteDe(db, quien);
    const ev = { ...nuevoEvento({ tipo: "marca", cuando: "2026-11-24T14:00:00Z", fecha: "2026-11-24", quien: quienEs(quien, quien), datos: { trabajadorId: "t1", sentido: "entrada" } }), _espacio: "prueba", _nace: `nace-ev-${quien}` };
    const crea = await puede(db, quien, "eventos", "crear"), edita = await puede(db, quien, "eventos", "editar");
    const alta = await subirRegistro(c, "eventos", ev).then(() => null, (e) => e);
    if (!crea) { if (!alta) fallas.push(`eventos · ${quien}: no puede crear y la base lo dejó`); continue; }
    if (alta) { fallas.push(`eventos · ${quien}: el alta se rechazó (${alta.message})`); continue; }
    const otra = await subirRegistro(c, "eventos", ev).then((x) => x, (e) => e);
    if (otra instanceof Error) fallas.push(`eventos · ${quien}: subirlo otra vez se rechazó (${otra.message})`);
    else if (!otra?.recibido) fallas.push(`eventos · ${quien}: al subirlo otra vez no regresó el que quedó en la base`);
    const can = cancelarEvento(ev, { motivo: "PIN prestado", quien: quienEs(quien, quien), cuando: "2026-11-24T15:00:00Z" }).evento;
    const r1 = await subirRegistro(c, "eventos", can).then(() => null, (e) => e);
    const estado = (await verdad(db, "select estado from eventos where id = $1", [ev.id]))[0]?.estado;
    if (edita) {
      if (r1 || estado !== "cancelado") fallas.push(`eventos · ${quien}: cancelar no quedó (${r1?.message || estado})`);
      const r2 = await subirRegistro(c, "eventos", can).then(() => null, (e) => e);
      if (r2) fallas.push(`eventos · ${quien}: subir otra vez la cancelación se rechazó (${r2.message})`);
    } else if (!r1 || r1.code !== "42501" || estado !== "vigente") fallas.push(`eventos · ${quien}: sin permiso de editar, cancelar debe ser un rechazo claro y dejarlo vigente (${r1?.message || "entró"})`);
  }
  assert.deepEqual(fallas, []);
});

test("un_evento_creado_y_cancelado_sin_senal_entra_ya_cancelado", async () => {
  const c = clienteDe(db, "encargado");
  const ev = { ...nuevoEvento({ tipo: "marca", cuando: "2026-11-24T16:00:00Z", fecha: "2026-11-24", quien: quienEs("encargado", "encargado"), datos: { trabajadorId: "t1", sentido: "salida" } }), _espacio: "prueba", _nace: "nace-sin-senal" };
  const can = cancelarEvento(ev, { motivo: "era de otro", quien: quienEs("encargado", "encargado"), cuando: "2026-11-24T16:05:00Z" }).evento;
  await subirRegistro(c, "eventos", can);
  const f = (await verdad(db, "select estado, datos->'cancelado'->>'motivo' as motivo from eventos where id = $1", [ev.id]))[0];
  assert.deepEqual([f.estado, f.motivo], ["cancelado", "era de otro"]);
});

test("un_pago_sellado_por_la_base_que_se_sube_otra_vez_conserva_su_sello", async () => {
  const c = clienteDe(db, "luis");
  const pago = { ...nuevoEvento({ tipo: "pago_personal", cuando: "2026-11-24T18:00:00Z", fecha: "2026-11-24", quien: quienEs("superadmin", "luis"), datos: { a: { tipo: "trabajador", id: "t1", nombre: "PRUEBA UNO" }, desde: "2026-11-16", hasta: "2026-11-21", monto: 500, medio: "efectivo" } }), _espacio: "prueba", _nace: "nace-pago" };
  const a = await subirRegistro(c, "eventos", pago);
  const b = await subirRegistro(c, "eventos", pago);
  assert.equal(a.validacion, "autorizado");
  assert.deepEqual([b.validacion, b.sello_firma], [a.validacion, a.sello_firma], "el segundo intento no lo vuelve a validar ni lo cambia");
});

test("un_mensaje_del_chat_general_y_de_una_conversacion_entra_y_subirlo_otra_vez_no_es_rechazo", async () => {
  const fallas = [];
  const conv = { ...nuevoEvento({ tipo: "conversacion", cuando: "2026-11-24T17:00:00Z", fecha: "2026-11-24", quien: quienEs("encargado", "encargado"),
    datos: { clase: "grupo", nombre: "Cuadrilla de prueba", miembros: [{ tipo: "persona", id: "00000000-0000-0000-0000-000000000003", nombre: "Prueba encargado" }, { tipo: "persona", id: "00000000-0000-0000-0000-000000000004", nombre: "Prueba agronomo" }] } }), _espacio: "prueba", _nace: "nace-conv" };
  const alta = await subirRegistro(clienteDe(db, "encargado"), "eventos", conv).then(() => null, (e) => e);
  if (alta) fallas.push(`la conversación no entró (${alta.message})`);
  for (const quien of ["luis", "encargado", "agronomo"]) {
    for (const conversacion of [undefined, conv.id]) {
      // En una conversación en que no participa no escribe nadie, ni el superadministrador (hoja 46): eso no es falla.
      if (conversacion && quien === "luis") {
        const fuera = await subirRegistro(clienteDe(db, quien), "chat", { id: idComoLosReales("msj"), fecha: "2026-11-24", tipo: "texto", estado: null, deQuien: "Prueba luis", texto: "no soy de aquí", conversacion, _espacio: "prueba", _nace: "nace-fuera" }).then(() => null, (e) => e);
        if (!fuera) fallas.push("chat grupo · luis: escribió en una conversación en la que no participa");
        continue;
      }
      const c = clienteDe(db, quien);
      const m = { id: idComoLosReales("msj"), fecha: "2026-11-24", tipo: "texto", estado: null, deQuien: `Prueba ${quien}`, texto: "hola", ...(conversacion ? { conversacion } : {}), _espacio: "prueba", _nace: `nace-m-${quien}-${!!conversacion}` };
      const a = await subirRegistro(c, "chat", m).then(() => null, (e) => e);
      if (a) { fallas.push(`chat ${conversacion ? "grupo" : "general"} · ${quien}: ${a.message}`); continue; }
      const b = await subirRegistro(c, "chat", m).then(() => null, (e) => e);
      if (b) fallas.push(`chat ${conversacion ? "grupo" : "general"} · ${quien}: subir otra vez se rechazó (${b.message})`);
      const cf = await subirRegistro(c, "chat", { ...m, propuestas: [{ id: "p1", confirmacion: { estado: "confirmado" } }] }).then(() => null, (e) => e);
      if (cf) fallas.push(`chat ${conversacion ? "grupo" : "general"} · ${quien}: firmar una propuesta del mensaje se rechazó (${cf.message})`);
    }
  }
  const dq = (await verdad(db, "select dequien from chat where datos->>'texto' = 'hola' limit 1"))[0]?.dequien;
  assert.deepEqual(fallas, []);
  assert.match(dq || "", /^Prueba/, "quién lo mandó queda en su columna");
});

// Lo que la conversación con AgroGestión deja CONFIRMAR a cada perfil (`OPERACIONES[…].confirma`), ¿lo acepta la base de
// ese perfil? Si no, la persona firma, ve «guardado» y el registro se queda sin subir para siempre.
import { entenderLoDicho } from "../../src/voz.js";
import { preparar, ejecutar, OPERACIONES } from "../../src/operaciones.js";
import { conNacimiento } from "../../src/calculos.js";
const CUENTA_DE = { admin: "luis", encargado: "encargado", finanzas: "finanzas", agronomo: "agronomo" };
const DICHOS = {
  avance: "Hoy terminamos dos reguladores de deshierbe en San Felipe 4.",
  actividad: "Hoy Juan Pérez anduvo regando ocho horas en San Felipe 4.",
  cosecha: "Cosechamos 100 cajas de San Felipe 4.",
  gasto: "Compramos 3 kilos de clavos a 20 pesos el kilo",
  necesidad: "Hace falta un filtro para el tractor",
  incidencia: "Se descompuso la bomba del pozo",
  prestamo: "Le presté quinientos pesos a Juan Pérez",
  nota: "Vimos mucha hierba en San Felipe 4",
};
test("lo_que_el_chat_deja_confirmar_a_cada_perfil_lo_acepta_la_base_de_ese_perfil", async () => {
  const fallas = [], personas = [{ id: "t1", nombre: "Juan Pérez" }], parcelas = [{ id: "p1", nombre: "San Felipe 4", ranchoId: "r1" }];
  for (const [tipo, texto] of Object.entries(DICHOS)) {
    for (const rol of OPERACIONES[tipo].confirma) {
      const quien = CUENTA_DE[rol]; if (!quien) continue;
      const de = { id: `00000000-0000-0000-0000-00000000000${{ luis: 1, encargado: 3, agronomo: 4, finanzas: 5 }[quien]}`, nombre: `Prueba ${quien}`, rol };
      const mensaje = { id: idComoLosReales("msj"), canal: "chat", de, cuando: "2026-11-24T18:00:00.000Z", texto };
      const p = preparar({ mensaje, entendido: entenderLoDicho({ texto, personas, parcelas, insumos: [], hoy: "2026-11-24" }) }).propuestas.find(x => x.tipo === tipo);
      if (!p) { fallas.push(`${tipo}: «${texto}» no se entendió como ${tipo}`); continue; }
      const r = ejecutar(p, { mensaje, quien: de, parcelas, cuando: "2026-11-24T18:00:00.000Z", fecha: "2026-11-24" });
      if (!r.ok) { fallas.push(`${tipo} · ${rol}: el chat no lo deja (${r.dice})`); continue; }
      for (const e of r.escrituras || []) {
        // Como `add` en la app: identificador hecho al momento si no trae uno propio, y la marca sólo para ésos.
        const reg = conNacimiento({ id: e.registro.id || idComoLosReales(e.coleccion[0]), ...e.registro, _espacio: "prueba" });
        const err = await subirRegistro(clienteDe(db, quien), e.coleccion, reg).then(() => null, (x) => x);
        if (err) fallas.push(`${tipo} · ${rol}: el chat lo deja confirmar y la base rechaza ${e.coleccion} (${err.message})`);
      }
    }
  }
  assert.deepEqual(fallas, []);
});

// La hoja de fertirriego leída de una foto: la confirma el agrónomo, el encargado o el administrador, y la base de cada uno
// la acepta (hasta el 24 nov la del agrónomo se quedaba sin subir).
import { confirmarDelChat } from "../../src/operaciones.js";
test("la_indicacion_de_fertirriego_que_confirma_cada_perfil_en_el_chat_la_acepta_su_base", async () => {
  const fallas = [];
  for (const rol of OPERACIONES.fertirriego.confirma) {
    const quien = CUENTA_DE[rol];
    const de = { id: `00000000-0000-0000-0000-00000000000${{ luis: 1, encargado: 3, agronomo: 4 }[quien]}`, nombre: `Prueba ${quien}`, rol };
    const mensaje = { id: idComoLosReales("msj"), canal: "chat", de, cuando: "2026-11-24T18:00:00.000Z", texto: "" };
    const propuesta = { id: "p-fert", tipo: "fertirriego", deQue: "foto", confiable: true, falta: [], resumen: "Fertirriego de prueba",
      indicacion: { parcelaId: "p1", parcelaNombre: "San Felipe 4", cultivo: "Ajo", superficie: 2, productos: [{ nombre: "PRODUCTO DE PRUEBA", dosis: "1 L/ha" }], resumen: "Fertirriego de prueba", deQuien: "Prueba agronomo" } };
    const r = confirmarDelChat({ mensaje, propuesta, quien: de, hoy: "2026-11-24", cuando: "2026-11-24T18:00:00.000Z" });
    if (!r.ok) { fallas.push(`fertirriego · ${rol}: el chat no lo deja (${r.dice})`); continue; }
    for (const e of r.escrituras) {
      const reg = conNacimiento({ id: idComoLosReales(e.coleccion[0]), ...e.registro, _espacio: "prueba" });
      const c = clienteDe(db, quien);
      const a = await subirRegistro(c, e.coleccion, reg).then(() => null, (x) => x);
      if (a) { fallas.push(`fertirriego · ${rol}: la base rechaza ${e.coleccion} (${a.message})`); continue; }
      const b = await subirRegistro(c, e.coleccion, reg).then(() => null, (x) => x);
      if (b) fallas.push(`fertirriego · ${rol}: subirla otra vez se rechazó (${b.message})`);
    }
  }
  assert.deepEqual(fallas, []);
});

// Decisiones de Luis (24 nov, hoja 58): el encargado da de ALTA externos y el agrónomo actividades e indicaciones. Sólo el
// alta: corregir lo de otros sigue sin ser suyo, y las credenciales (la ficha del trabajador) las emite un administrador.
test("el_encargado_da_de_alta_un_externo_y_el_agronomo_su_actividad_pero_ninguno_corrige_ni_emite_credenciales", async () => {
  const caso = async (quien, tabla, reg) => {
    const c = clienteDe(db, quien);
    const alta = await subirRegistro(c, tabla, reg).then(() => null, (e) => e);
    const otra = await subirRegistro(c, tabla, reg).then(() => null, (e) => e);
    const cor = await subirRegistro(c, tabla, { ...reg, nota: "CORREGIDO" }).then(() => null, (e) => e);
    return [alta?.message || "entró", otra?.message || "no es rechazo", cor ? "corregir se rechaza" : "corregir entró"];
  };
  const externo = { id: idComoLosReales("ext"), nombre: "EXTERNO DE PRUEBA", fecha_registro: "2026-11-24", nota: "DE PRUEBA", _espacio: "prueba", _nace: "nace-ext" };
  assert.deepEqual(await caso("encargado", "externos", externo), ["entró", "no es rechazo", "corregir se rechaza"]);
  const act = { id: idComoLosReales("act"), parcelaId: "p1", fecha: "2026-11-24", tipo: "Riego", horas: 6, trabajadorId: "t1", indicacionId: "ta1", nota: "DE PRUEBA", _espacio: "prueba", _nace: "nace-act-agr" };
  assert.deepEqual(await caso("agronomo", "actividades", act), ["entró", "no es rechazo", "corregir se rechaza"]);
  // Emitir una credencial es corregir la ficha del trabajador: el encargado no puede (la pantalla ya no se lo ofrece).
  const t = { id: idComoLosReales("t"), nombre: "TRABAJADOR DE PRUEBA", pin: "9911", _espacio: "prueba", _nace: "nace-t" };
  await subirRegistro(clienteDe(db, "luis"), "trabajadores", t);
  const emitir = await subirRegistro(clienteDe(db, "encargado"), "trabajadores", { ...t, credencial: { codigo: "PRUEBA123", emitida: "2026-11-24T18:00:00Z" } }).then(() => null, (e) => e);
  assert.equal(emitir?.code, "42501", "el encargado no cambia la ficha de un trabajador");
});
