// ============================================================
//  AgroGestión — Mensajería institucional (puro)
//
//  El chat de adentro deja de ser un solo hilo y se vuelve la mensajería de trabajo del rancho:
//  conversaciones entre dos personas y grupos de trabajo. NO es otro chat: son los mismos mensajes
//  (colección `chat`, leídos con `chat.js`) con un campo `conversacion`; lo que ya había sin ese
//  campo es la conversación general.
//
//  Y es una FUENTE de información operativa: lo que la gente se dice entre sí se lee con las mismas
//  reglas que lo que se le dice a la app (`operaciones.js`) y se vuelve PROPUESTA. Nunca registro:
//  una persona con permiso confirma.
//
//  · Las conversaciones son eventos (`conversacion`, `conversacion_cambio`): no se editan ni se borran.
//  · Un mensaje se RELACIONA con lo que ya se venía hablando (aclaración, seguimiento, ejecución de
//    algo programado) para preparar UNA operación, no dos; la relación se enseña y se puede deshacer.
//  · No se inventa: «voy a revisar la plaga» es un pendiente sobre una observación, no un diagnóstico.
//  · El asistente sólo habla cuando se le habla (`paraElAsistente`); entre personas se queda callado
//    y deja sus propuestas debajo del mensaje.
// ============================================================
import { nuevoEvento, vigentes } from "./eventos.js";
import { aclarar, naturalezaDe, formaDePagoDicha, preparar, esOperativo } from "./operaciones.js";

export const T_CONVERSACION = "conversacion", T_CAMBIO = "conversacion_cambio";
export const GENERAL = "general";
// Quién tiene mensajería hoy. El personal de campo todavía no (no tiene cuenta propia: ver docs/MENSAJERIA.md).
export const ROLES_CON_MENSAJES = ["admin", "encargado", "agronomo", "finanzas", "dueno"];
export const NOMBRE_DE_GRUPO = { admin: "Administración", encargado: "Encargados", agronomo: "Agrónomo", finanzas: "Finanzas", dueno: "Dirección" };
// Por confirmar con Luis: que la administración pueda abrir cualquier conversación. Hoy sí, y se le dice a todos.
export const LA_ADMINISTRACION_VE_TODO = true;

// Las reglas, tal como se le enseñan a la gente. Si cambia una regla, cambia aquí y en la pantalla sola.
export const REGLAS = [
  "Estos mensajes son de trabajo. No es un lugar para pláticas personales: para eso está tu teléfono.",
  "AgroGestión lee lo que se escribe aquí para PROPONER registros (una compra, un avance, una falla, un pendiente). No registra nada solo: siempre lo confirma una persona con permiso.",
  "Una conversación la ven sus participantes" + (LA_ADMINISTRACION_VE_TODO ? " y la administración del rancho." : "."),
  "Nada se borra ni se edita: un mensaje equivocado se aclara con otro mensaje. Las fotos, audios y documentos se conservan junto al mensaje.",
  "Cada registro que salga de aquí dice de qué mensaje salió, quién lo dijo, quién lo aclaró y quién lo confirmó.",
  "Escribir aquí no da permisos: un gasto lo sigue confirmando quien lleva las cuentas.",
  "Para pedirle algo a AgroGestión, empieza el mensaje con «Agro,». Si no, se queda callado.",
];

const plano = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const llave = (m) => (m.tipo === "rol" ? `rol:${m.rol}` : `p:${m.id}`);
const limpiarMiembros = (lista) => { const v = new Map(); for (const m of lista || []) { if (m?.tipo === "rol" && ROLES_CON_MENSAJES.includes(m.rol)) v.set(llave(m), { tipo: "rol", rol: m.rol }); else if (m?.id) v.set(llave({ id: m.id }), { tipo: "persona", id: m.id, nombre: m.nombre || "", rol: m.rol || "" }); } return [...v.values()]; };

/* ── Conversaciones ── */

export function crearConversacion({ clase, nombre = "", miembros = [], quien, cuando, fecha }) {
  if (!quien?.id) return { ok: false, dice: "Falta quién la crea." };
  if (!ROLES_QUE_ABREN.includes(quien.rol)) return { ok: false, dice: "Tu perfil participa en conversaciones, pero no las abre: pídele a un administrador o a un encargado que abra el grupo." };
  const yo = { tipo: "persona", id: quien.id, nombre: quien.nombre || "", rol: quien.rol };
  const todos = limpiarMiembros([yo, ...miembros]), otros = todos.filter(m => llave(m) !== llave(yo));
  if (clase === "directa") {
    if (otros.length !== 1 || otros[0].tipo !== "persona") return { ok: false, dice: "Una conversación directa es con UNA persona." };
    // El mismo par de personas es la misma conversación, la abra quien la abra y en el aparato que sea.
    const id = `ev-conv-d-${[quien.id, otros[0].id].map(x => String(x).replace(/[^A-Za-z0-9]/g, "")).sort().join("-")}`.slice(0, 120);
    return { ok: true, evento: nuevoEvento({ id, tipo: T_CONVERSACION, cuando, fecha, quien, datos: { clase, nombre: "", miembros: todos, institucional: true } }) };
  }
  if (clase !== "grupo") return { ok: false, dice: "Di si es directa o de grupo." };
  if (!String(nombre).trim()) return { ok: false, dice: "Ponle nombre al grupo: es como lo van a encontrar." };
  if (!otros.length) return { ok: false, dice: "Un grupo necesita a alguien más." };
  return { ok: true, evento: nuevoEvento({ tipo: T_CONVERSACION, cuando, fecha, quien, datos: { clase, nombre: String(nombre).trim(), miembros: todos, institucional: true } }) };
}

export function cambiarConversacion({ conversacion, agregar = [], quitar = [], nombre, quien, cuando, fecha }) {
  if (!conversacion || conversacion.clase !== "grupo") return { ok: false, dice: "Sólo los grupos cambian de gente o de nombre." };
  if (!puedeEscribir(conversacion, quien)) return { ok: false, dice: "Sólo un participante puede cambiar el grupo." };
  const mas = limpiarMiembros(agregar), menos = limpiarMiembros(quitar);
  if (!mas.length && !menos.length && !String(nombre || "").trim()) return { ok: false, dice: "No cambió nada." };
  return { ok: true, evento: nuevoEvento({ tipo: T_CAMBIO, cuando, fecha, quien, datos: { conversacion: conversacion.id, agregar: mas, quitar: menos, ...(String(nombre || "").trim() ? { nombre: String(nombre).trim() } : {}) } }) };
}

export function conversacionesDe(eventos) {
  const vivos = vigentes(eventos || []).slice().sort((a, b) => String(a.cuando).localeCompare(String(b.cuando)));
  const convs = new Map();
  convs.set(GENERAL, { id: GENERAL, clase: "general", nombre: "General del rancho", miembros: ROLES_CON_MENSAJES.map(rol => ({ tipo: "rol", rol })), creada: null, por: "", historial: [] });
  for (const e of vivos) if (e.tipo === T_CONVERSACION && !convs.has(e.id)) convs.set(e.id, { id: e.id, clase: e.datos.clase, nombre: e.datos.nombre || "", miembros: limpiarMiembros(e.datos.miembros), creada: e.cuando, por: e.quien?.nombre || "", historial: [] });
  for (const e of vivos) {
    if (e.tipo !== T_CAMBIO) continue;
    const c = convs.get(e.datos.conversacion); if (!c || c.clase !== "grupo") continue;
    const fuera = new Set((e.datos.quitar || []).map(llave));
    c.miembros = limpiarMiembros([...c.miembros.filter(m => !fuera.has(llave(m))), ...(e.datos.agregar || [])]);
    if (e.datos.nombre) c.nombre = e.datos.nombre;
    c.historial.push({ cuando: e.cuando, por: e.quien?.nombre || "", agrego: (e.datos.agregar || []).map(nombreDeMiembro), quito: (e.datos.quitar || []).map(nombreDeMiembro), nombre: e.datos.nombre || null });
  }
  return [...convs.values()];
}

export const nombreDeMiembro = (m) => (m.tipo === "rol" ? NOMBRE_DE_GRUPO[m.rol] || m.rol : m.nombre || "Alguien");
export const esParticipante = (c, persona) => !!persona?.id && (c?.miembros || []).some(m => (m.tipo === "rol" ? m.rol === persona.rol : m.id === persona.id));
// Dirección lee y no escribe, como en el resto de la app (por confirmar con Luis si debe poder escribir mensajes).
export const ROLES_QUE_ESCRIBEN = ["admin", "encargado", "agronomo", "finanzas"];
// Abrir una conversación es un evento, y la base sólo deja crear eventos a estos perfiles (hoja 35).
export const ROLES_QUE_ABREN = ["admin", "encargado", "agronomo"];
export const puedeEscribir = (c, persona) => ROLES_QUE_ESCRIBEN.includes(persona?.rol) && esParticipante(c, persona);
export function puedeVer(c, persona) {
  if (!ROLES_CON_MENSAJES.includes(persona?.rol)) return { ve: false, porque: "Tu perfil todavía no tiene mensajería." };
  if (esParticipante(c, persona)) return { ve: true, porque: "Participas en esta conversación." };
  if (LA_ADMINISTRACION_VE_TODO && persona.rol === "admin") return { ve: true, comoAdministracion: true, porque: "La ves como administración; no participas en ella." };
  return { ve: false, porque: "No participas en esta conversación." };
}
export function tituloDe(c, persona) {
  if (c.clase !== "directa") return c.nombre || "Grupo";
  const otro = c.miembros.find(m => m.tipo === "persona" && m.id !== persona?.id);
  return otro ? otro.nombre : c.miembros.map(nombreDeMiembro).join(" y ");
}
export const conversacionDe = (mensaje) => mensaje?.conversacion || GENERAL;
export const mensajesDe = (mensajes, convId) => (mensajes || []).filter(m => m && conversacionDe(m) === convId);

// Mis conversaciones, la más reciente arriba, con su último mensaje y cuántas propuestas esperan.
export function misConversaciones({ eventos, mensajes, persona }) {
  return conversacionesDe(eventos).map(c => ({ c, v: puedeVer(c, persona) })).filter(x => x.v.ve).map(({ c, v }) => {
    const suyos = mensajesDe(mensajes, c.id).sort((a, b) => String(a.cuando).localeCompare(String(b.cuando))), ultimo = suyos[suyos.length - 1] || null;
    const porConfirmar = suyos.reduce((n, m) => n + (m.propuestas || []).filter(p => !p.confirmacion && p.parteDe == null).length, 0);
    return { ...c, titulo: tituloDe(c, persona), comoAdministracion: !!v.comoAdministracion, cuantos: suyos.length, porConfirmar,
      ultimo: ultimo ? { de: ultimo.de?.nombre || ultimo.deQuien || "", texto: String(ultimo.texto || (ultimo.foto ? "📷 Foto" : ultimo.audio ? "🎤 Audio" : ultimo.documento ? `📎 ${ultimo.documento.nombre || "Documento"}` : "")).slice(0, 70), cuando: ultimo.cuando } : null };
  }).sort((a, b) => (a.id === GENERAL ? -1 : b.id === GENERAL ? 1 : String(b.ultimo?.cuando || b.creada || "").localeCompare(String(a.ultimo?.cuando || a.creada || ""))));
}

/* ── Hablarle al asistente ── */

const MENCION = /^\s*(@\s*agro(gesti[oó]n)?|oye,?\s+agro(gesti[oó]n)?|agro(gesti[oó]n)?)\s*[,:\-]\s*/i;
export function paraElAsistente(texto) {
  const t = String(texto || ""), m = t.match(MENCION) || t.match(/^\s*@\s*agro(gesti[oó]n)?\s+/i);
  return m ? { es: true, texto: t.slice(m[0].length).trim() } : { es: false, texto: t.trim() };
}
export const ASISTENTE = { id: "agrogestion", nombre: "AgroGestión", rol: "asistente" };

// Lo que contesta cuando se le habla: qué entendió, qué falta y a quién le toca. No promete nada que no hizo.
export function respuestaDelAsistente({ plan, relacion }) {
  if (relacion?.clase === "aclaracion") return relacion.dice;
  const ps = plan?.propuestas || [];
  if (!ps.length) return "No reconocí nada para registrar. Tu mensaje queda guardado tal cual.";
  return ps.map(p => {
    const base = `«${p.frase}»`;
    if (p.preguntas.length) return `${base} — ${p.preguntas[0]}`;
    if (!p.permiso.puede) return `${base} — lo dejé preparado. ${p.permiso.dice}`;
    return `${base} — lo dejé preparado como ${p.tipo === "nota" ? "nota" : p.tipo}; falta que lo confirmes.${p.aviso ? ` ${p.aviso}` : ""}`;
  }).join("\n");
}

/* ── Relacionar lo que se va diciendo ── */

const YA_SE_HIZO = /\b(ya se aplico|ya aplicamos|ya se fumigo|ya fumigamos|ya quedo|ya se hizo|ya lo hicimos|ya esta hecho|ya se rego|ya regamos|ya terminamos|se ejecuto|ya se ejecuto|listo,? ya)\b/;
const VOY_A = /\b(voy a|vamos a|la reviso|lo reviso|la checo|lo checo|paso a|la voy a|lo voy a|manana la|manana lo|yo la veo|yo lo veo|ahorita la|ahorita lo|voy para alla|inspeccion)/;
const HORAS = 24, HACIA_ATRAS = 12;

// Lo que sigue abierto en una conversación: propuestas dichas, sin firmar, recientes. La más nueva primero.
export function temasAbiertos(mensajes, ahora) {
  const tope = new Date(ahora).getTime() - HORAS * 3600000, temas = [];
  const recientes = (mensajes || []).filter(m => m && m.cuando && !m.delAsistente && new Date(m.cuando).getTime() >= tope).sort((a, b) => String(b.cuando).localeCompare(String(a.cuando))).slice(0, HACIA_ATRAS);
  for (const m of recientes) for (const p of m.propuestas || []) {
    if (typeof p.i !== "number" || p.confirmacion || p.parteDe != null) continue;
    temas.push({ mensaje: m, propuesta: p, naturaleza: p.momento === "programado" ? "plan" : naturalezaDe(p.frase, p.tipo) });
  }
  return temas;
}

// ¿Lo nuevo va con algo que ya se venía hablando? Devuelve la relación, o null si es otra cosa.
//   aclaracion  contesta lo que le faltaba a una propuesta, o dice cómo se pagó  → la MISMA operación
//   ejecucion   «ya se aplicó» sobre algo que se había dicho como por hacer       → otro momento del mismo asunto
//   seguimiento «voy a revisarla» sobre algo que alguien vio o avisó              → un pendiente sobre esa observación
export function relacionar({ mensajes, nuevo, personas = [], parcelas = [], ahora, hoy }) {
  const texto = String(nuevo?.texto || "").trim(), t = plano(texto);
  if (!texto) return null;
  const temas = temasAbiertos(mensajes, ahora || nuevo.cuando), corto = texto.split(/\s+/).length <= 14 && !/[.!?]\s+\S/.test(texto);
  const ref = (x) => ({ mensaje: x.mensaje.id, propuesta: x.propuesta.id, frase: x.propuesta.frase, dijo: x.mensaje.de?.nombre || x.mensaje.deQuien || "" });
  if (corto) {
    // 1. Contesta una pregunta abierta. Primero la de la misma persona; si no, la más reciente de la conversación.
    const conPregunta = temas.filter(x => { const pr = preparar({ mensaje: { id: x.mensaje.id, de: x.mensaje.de?.id ? x.mensaje.de : { id: "x" }, cuando: x.mensaje.cuando }, entendido: { propuestas: [x.propuesta] } }).propuestas[0]; return pr && pr.preguntas.length > 0; });
    const orden = [...conPregunta.filter(x => x.mensaje.de?.id === nuevo.de?.id), ...conPregunta.filter(x => x.mensaje.de?.id !== nuevo.de?.id)];
    for (const x of orden) {
      const r = aclarar({ propuesta: x.propuesta, respuesta: nuevo, personas, parcelas, hoy });
      if (r.ok) return { clase: "aclaracion", con: ref(x), propuesta: r.propuesta, dice: r.dice, entendio: r.entendio };
    }
    // 2. Dice cómo se pagó la compra de la que se venía hablando.
    if (formaDePagoDicha(texto)) {
      const x = temas.find(y => y.propuesta.tipo === "gasto" && !y.propuesta.pagadoCon);
      if (x) { const r = aclarar({ propuesta: x.propuesta, respuesta: nuevo, personas, parcelas, hoy }); if (r.ok) return { clase: "aclaracion", con: ref(x), propuesta: r.propuesta, dice: r.dice, entendio: r.entendio }; }
    }
  }
  // 3. Se ejecutó algo que se había dicho como por hacer.
  if (YA_SE_HIZO.test(t)) {
    const x = temas.find(y => y.naturaleza === "plan" || y.propuesta.tipo === "fertirriego");
    if (x) return { clase: "ejecucion", con: ref(x), momento: "ejecutado", heredar: x.propuesta, dice: `Va con lo que se había dicho como por hacer: «${x.propuesta.frase}». Son dos momentos distintos: lo programado y lo ejecutado.` };
  }
  // 4. Alguien se hace cargo de algo que otro vio o avisó.
  if (VOY_A.test(t)) {
    const x = temas.find(y => ["observacion", "reporte", "hipotesis", "necesidad"].includes(y.naturaleza));
    if (x) return { clase: "seguimiento", con: ref(x), heredar: x.propuesta, dice: `Va con lo que avisó ${ref(x).dijo || "alguien"}: «${x.propuesta.frase}». Queda como un pendiente; no dice qué es ni qué lo causa.` };
  }
  return null;
}

// Aplica una relación de seguimiento o ejecución a las propuestas del mensaje nuevo: apuntan a lo anterior y heredan
// la parcela si no traían una (y se dice que es heredada). No cambia lo que se dijo.
export function conRelacion(propuestas, relacion) {
  if (!relacion || relacion.clase === "aclaracion") return propuestas || [];
  const h = relacion.heredar || {};
  return (propuestas || []).map((p, k) => {
    if (typeof p.i !== "number" || k > 0) return p;
    const sinParcela = !(p.parcelas || []).length && (h.parcelas || []).length === 1;
    return { ...p, sobre: { ...relacion.con, clase: relacion.clase }, ...(relacion.momento ? { momento: relacion.momento } : {}),
      ...(sinParcela ? { parcelas: h.parcelas, parcelaId: h.parcelas[0].id, heredado: ["parcela"] } : {}) };
  });
}

// De todo lo que se entendió de un mensaje entre personas, qué merece ser una propuesta. Lo demás es plática:
// se guarda como mensaje y no se le pide a nadie que lo confirme. Si se le habló al asistente, todo cuenta.
export function propuestasDeLaPlatica(propuestas, { alAsistente = false } = {}) {
  return (propuestas || []).filter(p => typeof p.i !== "number" || alAsistente || p.sobre || p.parteDe != null || esOperativo(p.frase, p.tipo));
}
export const esPlatica = (m) => !!m && (m.platica || m.delAsistente || !!m.aclaraA);
