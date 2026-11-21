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
// Decidido por Luis (21 nov): NADIE lee una conversación por su puesto, tampoco la administración. Tres niveles:
//   1. Lo interpretado y lo registrado: se consulta como cualquier registro, con los permisos de siempre.
//   2. La evidencia: los mensajes concretos que sustentan un registro. Quien no participa los ve sólo con el
//      permiso `ver_evidencia`, y cada consulta queda en la bitácora.
//   3. La conversación completa, sin participar: permiso `supervisar_conversaciones`, motivo, 24 horas y bitácora.
// Las tres las comprueba la BASE (hoja 46); lo de aquí sólo evita ofrecer lo que la base va a negar.
export const PERMISO_EVIDENCIA = "ver_evidencia", PERMISO_SUPERVISION = "supervisar_conversaciones";
export const HORAS_DE_CONSULTA = 24;

// Las reglas, tal como se le enseñan a la gente. Si cambia una regla, cambia aquí y en la pantalla sola.
export const REGLAS = [
  "Estas conversaciones son institucionales: son de trabajo de Agroselectos. No son para asuntos personales.",
  "No son para vigilar a nadie. AgroGestión las lee para armar la memoria del rancho: lo que se vio, lo que se decidió, lo que quedó pendiente y lo que se hizo.",
  "De lo que lee sólo PROPONE. Nada se registra solo: siempre lo confirma una persona con permiso.",
  "Una conversación la leen sus participantes. Nadie más la lee por su puesto: tampoco la administración ni dirección.",
  "De cada cosa registrada se puede preguntar «¿de dónde salió?» y ver quién lo dijo, cuándo y en qué conversación. Los mensajes concretos que la sustentan sólo los ve, fuera de la conversación, quien tiene ese permiso; y cada vez queda anotado.",
  "Una conversación completa sólo puede abrirla alguien que no participa en ella si tiene el permiso de supervisión, dice el motivo y por 24 horas. Queda anotado quién, cuándo y por qué, y esa lista la pueden ver todos.",
  "Nada se borra ni se edita: un mensaje equivocado se aclara con otro mensaje. Los mensajes, audios, fotos y documentos se conservan mientras AgroGestión esté en uso, porque son el sustento de los registros.",
  "Siempre se distingue lo que alguien DIJO, lo que AgroGestión INTERPRETÓ, lo que una persona CONFIRMÓ y lo que quedó REGISTRADO.",
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
// `consultas` = consultas excepcionales vigentes (las otorga y las vence la base).
export function puedeVer(c, persona, { consultas = [], ahora } = {}) {
  if (!ROLES_CON_MENSAJES.includes(persona?.rol)) return { ve: false, porque: "Tu perfil todavía no tiene mensajería." };
  if (esParticipante(c, persona)) return { ve: true, porque: "Participas en esta conversación." };
  const t = new Date(ahora || Date.now()).getTime();
  const consulta = (consultas || []).find(x => x.conversacion === c?.id && x.usuario === persona.id && new Date(x.hasta).getTime() > t);
  if (consulta) return { ve: true, porConsulta: true, hasta: consulta.hasta, motivo: consulta.motivo, porque: "La abriste por consulta excepcional: sólo lectura, queda anotado." };
  return { ve: false, porque: "No participas en esta conversación." };
}
// Pedir una consulta excepcional. No la concede: dice si vale la pena pedírsela a la base y con qué.
export function pedirConsulta({ conversacion, motivo, persona, otorgados = [] }) {
  if (!otorgados.includes(PERMISO_SUPERVISION)) return { ok: false, dice: "Abrir una conversación en la que no participas pide el permiso de supervisión, otorgado a tu cuenta. Ser administrador no lo da." };
  if (!conversacion || conversacion.id === GENERAL) return { ok: false, dice: "Escoge la conversación." };
  if (esParticipante(conversacion, persona)) return { ok: false, dice: "Ya participas en esa conversación." };
  if (String(motivo || "").trim().length < 10) return { ok: false, dice: "Di el motivo de la consulta: queda anotado y lo pueden ver los demás." };
  return { ok: true, conversacion: conversacion.id, motivo: String(motivo).trim() };
}
export function tituloDe(c, persona) {
  if (c.clase !== "directa") return c.nombre || "Grupo";
  const otro = c.miembros.find(m => m.tipo === "persona" && m.id !== persona?.id);
  return otro ? otro.nombre : c.miembros.map(nombreDeMiembro).join(" y ");
}
export const conversacionDe = (mensaje) => mensaje?.conversacion || GENERAL;
export const mensajesDe = (mensajes, convId) => (mensajes || []).filter(m => m && conversacionDe(m) === convId);

// Mis conversaciones, la más reciente arriba, con su último mensaje y cuántas propuestas esperan.
export function misConversaciones({ eventos, mensajes, persona, consultas = [], ahora, leido = {} }) {
  return conversacionesDe(eventos).map(c => ({ c, v: puedeVer(c, persona, { consultas, ahora }) })).filter(x => x.v.ve).map(({ c, v }) => {
    const suyos = mensajesDe(mensajes, c.id).sort((a, b) => String(a.cuando).localeCompare(String(b.cuando))), ultimo = suyos[suyos.length - 1] || null;
    const porConfirmar = suyos.reduce((n, m) => n + (m.propuestas || []).filter(p => !p.confirmacion && p.parteDe == null).length, 0);
    const sinLeer = suyos.filter(m => m.de?.id !== persona.id && String(m.cuando || "") > String(leido[c.id] || "")).length;
    return { ...c, titulo: tituloDe(c, persona), porConsulta: !!v.porConsulta, consultaHasta: v.hasta || null, cuantos: suyos.length, porConfirmar, sinLeer,
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

/* ── LA MEMORIA: hallazgos con origen verificable ──
   Un hallazgo es algo que AgroGestión interpretó de lo que alguien dijo. Siempre lleva separadas cuatro cosas:
     dicho        lo que alguien escribió, literal, con quién, cuándo y en qué conversación
     interpretado qué entendió AgroGestión y por qué
     confirmado   quién lo confirmó (o que nadie lo ha confirmado, o que se rechazó)
     registrado   dónde quedó (o que no quedó en ningún lado)
   Sale de dos fuentes: los mensajes de las conversaciones en que la persona participa, y los registros que ya
   existen (bitácora, gastos, incidencias, avances…), que cualquiera con permiso de leerlos puede consultar. */
const ESTADO = { interpretado: "AgroGestión lo interpretó; nadie lo ha confirmado", confirmado: "Confirmado por una persona", rechazado: "Una persona dijo que no", registrado: "Confirmado y registrado" };
const TEMA = { gasto: "compra", prestamo: "préstamo", actividad: "trabajo", avance: "avance", cosecha: "cosecha", incidencia: "incidencia", necesidad: "necesidad", fertirriego: "aplicación", nota: "nota" };
const temaDe = (p) => (/\b(aplic|fumig|herbicida|insecticida|fungicida|fertiliz)/.test(plano(p.frase)) ? "aplicación" : /\b(maleza|hierba|plaga|gusano|mancha)/.test(plano(p.frase)) && p.tipo === "nota" ? "observación de campo" : TEMA[p.tipo] || p.tipo);

export function hallazgosDe({ mensajes = [], conversaciones = [], registros = {} }) {
  const titulo = (id) => { const c = conversaciones.find(x => x.id === id); return c ? (c.clase === "directa" ? `Conversación directa (${c.miembros.map(nombreDeMiembro).join(" y ")})` : c.nombre) : "una conversación en la que no participas"; };
  const hallazgos = [], vistos = new Set();
  for (const m of mensajes) for (const p of m.propuestas || []) {
    if (p.parteDe != null) continue;
    const f = p.confirmacion || null, estado = !f ? "interpretado" : f.estado === "rechazado" ? "rechazado" : p.quedoEn ? "registrado" : "confirmado";
    const conv = conversacionDe(m), clave = `${m.id}|${typeof p.i === "number" ? p.i : p.id}`;
    vistos.add(m.id);
    hallazgos.push({ id: clave, tema: temaDe(p), tipo: p.tipo, naturaleza: typeof p.i === "number" ? naturalezaDe(p.frase, p.tipo) : "hecho", cuando: m.cuando, parcelaId: p.parcelaId || p.parcelas?.[0]?.id || "", estado, dice: ESTADO[estado],
      dicho: [{ mensaje: m.id, quien: m.de?.nombre || m.deQuien || "", cuando: m.cuando, conversacion: conv, enConversacion: titulo(conv), texto: p.frase || p.resumen || m.texto || "", adjuntos: [m.foto ? "foto" : null, m.audio ? "audio" : null, m.documento ? `documento: ${m.documento.nombre || ""}` : null].filter(Boolean), disponible: true },
        ...(p.aclaraciones || []).map(a => ({ mensaje: a.id, quien: a.de?.nombre || "", cuando: a.cuando, conversacion: conv, enConversacion: titulo(conv), texto: a.texto, aclara: a.pregunta || "lo aclaró por su cuenta", disponible: true }))],
      interpretado: { que: p.resumen || `${TEMA[p.tipo] || p.tipo}${p.monto != null ? ` de $${Number(p.monto).toLocaleString("es-MX")}` : ""}`, porque: p.porque || "", deAclaraciones: (p.aclaraciones || []).filter(a => a.entendido).map(a => a.entendido), sobre: p.sobre || null, momento: p.momento || null, heredado: p.heredado || [] },
      confirmado: f ? { quien: f.quien, cuando: f.cuando, estado: f.estado, motivo: f.motivo || null } : null,
      registrado: p.quedoEn ? { dice: p.quedoEn } : null });
  }
  // Lo ya registrado cuyo mensaje de origen no está entre los míos: se sabe quién lo dijo y qué quedó; el mensaje
  // completo es evidencia y se pide aparte.
  for (const [coleccion, lista] of Object.entries(registros)) for (const r of lista || []) {
    const o = r?.origen || r?.datos?.origenDicho; if (!o?.mensaje || vistos.has(o.mensaje) || o.canal == null) continue;
    hallazgos.push({ id: `reg|${coleccion}|${r.id}`, tema: TEMA[coleccion === "egresos" ? "gasto" : coleccion === "incidencias" ? "incidencia" : "nota"] || coleccion, tipo: coleccion, naturaleza: r.naturaleza || "hecho", cuando: r.origen?.aclaraciones?.[0]?.cuando || r._actualizado || r.fecha, parcelaId: r.parcelaId || r.datos?.parcelaId || "", estado: "registrado", dice: ESTADO.registrado,
      dicho: [{ mensaje: o.mensaje, quien: o.dijo || "", cuando: null, conversacion: null, enConversacion: "una conversación en la que no participas", texto: o.frase || "", disponible: false },
        ...(o.aclaraciones || []).map(a => ({ mensaje: a.mensaje, quien: a.dijo || "", cuando: a.cuando, conversacion: null, enConversacion: "una conversación en la que no participas", texto: a.texto, aclara: a.pregunta || "lo aclaró por su cuenta", disponible: false }))],
      interpretado: { que: r.concepto || r.nota || r.desc || r.notas || coleccion, porque: "", deAclaraciones: (o.aclaraciones || []).filter(a => a.entendido).map(a => a.entendido), sobre: r.sobre || null, momento: r.momento || null, heredado: r.heredado || [] },
      confirmado: { quien: o.confirmo || "", cuando: null, estado: "confirmado", motivo: null },
      registrado: { dice: `Quedó en ${coleccion}`, coleccion, id: r.id } });
  }
  return hallazgos.sort((a, b) => String(b.cuando || "").localeCompare(String(a.cuando || "")));
}

// Consultar antecedentes: qué se ha dicho de una parcela, un tema o una palabra, entre fechas.
export function antecedentes(hallazgos, { parcelaId = "", tema = "", texto = "", desde = "", hasta = "", estado = "" } = {}) {
  const q = plano(texto).trim();
  return (hallazgos || []).filter(h => (!parcelaId || h.parcelaId === parcelaId) && (!tema || h.tema === tema) && (!estado || h.estado === estado)
    && (!desde || String(h.cuando || "").slice(0, 10) >= desde) && (!hasta || String(h.cuando || "").slice(0, 10) <= hasta)
    && (!q || plano([h.interpretado.que, ...h.dicho.map(d => `${d.texto} ${d.quien}`)].join(" ")).includes(q)));
}
export const temasDe = (hallazgos) => [...new Set((hallazgos || []).map(h => h.tema))].sort();

// «¿De dónde sacaste esto?», en palabras y por capas. No mezcla lo dicho con lo interpretado.
export function deDondeSalio(h) {
  return {
    dicho: h.dicho.map(d => ({ ...d, linea: `${d.quien || "Alguien"}${d.cuando ? `, ${String(d.cuando).slice(0, 16).replace("T", " ")} UTC` : ""}, en ${d.enConversacion}${d.aclara ? ` (${d.aclara})` : ""}: «${d.texto}»` })),
    interpretado: [`AgroGestión lo entendió como: ${h.interpretado.que}.`, h.interpretado.porque, ...h.interpretado.deAclaraciones.map(x => `De una aclaración: ${x}.`),
      h.interpretado.sobre ? `Lo relacionó con lo que dijo ${h.interpretado.sobre.dijo || "alguien"}: «${h.interpretado.sobre.frase}».` : "", h.interpretado.heredado.includes("parcela") ? "La parcela no se dijo en este mensaje: se tomó del mensaje con que se relacionó." : "",
      h.interpretado.momento === "ejecutado" ? "Es lo EJECUTADO de algo que antes se dijo como por hacer." : ""].filter(Boolean),
    confirmado: h.confirmado ? (h.confirmado.estado === "rechazado" ? `${h.confirmado.quien} dijo que no${h.confirmado.motivo ? `: ${h.confirmado.motivo}` : ""}.` : `Lo confirmó ${h.confirmado.quien || "una persona"}.`) : "Nadie lo ha confirmado: es sólo una interpretación.",
    registrado: h.registrado ? h.registrado.dice : "No quedó registrado en ningún módulo.",
    evidenciaFuera: h.dicho.filter(d => !d.disponible).map(d => d.mensaje).filter(Boolean),
  };
}

// Al confirmarse algo, sus mensajes pasan a ser EVIDENCIA (la base sólo deja consultar como evidencia lo marcado).
// `sensible`: toca dinero; para verla fuera de la conversación hace falta además poder leer los gastos.
export function comoEvidencia(mensaje, { sensible = false } = {}) { return { ...mensaje, esEvidencia: true, ...(sensible || mensaje.sensible ? { sensible: true } : {}) }; }
// Los archivos de una conversación cerrada van en su propia carpeta del almacén, que la base sólo le abre a sus
// participantes (hoja 48). Los de la general siguen como comprobantes de siempre.
export const carpetaDe = (conversacionId) => (!conversacionId || conversacionId === GENERAL ? "" : `c/${String(conversacionId).replace(/[^A-Za-z0-9_-]/g, "")}/`);
export const admiteArchivos = () => true;
