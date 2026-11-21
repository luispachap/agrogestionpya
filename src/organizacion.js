// LA ORGANIZACIÓN: áreas, equipos, responsables y de quién depende cada quien. (Etapa 1 de `docs/ORGANIZACION.md`.)
//
// Es SÓLO EL MAPA. Reglas que no se rompen:
//   · Todo es un hecho con fecha «desde». La organización de un día se CALCULA (`organizacionEn`); nada se sobrescribe.
//     Cambiar de responsable, mover un equipo o reorganizar un área deja lo anterior con sus fechas.
//   · Ningún nombre de persona vive en la lógica: las personas llegan de fuera, por su identificador.
//   · Ser responsable aquí NO da ningún permiso en el sistema. Son tres cosas aparte:
//       1. administrar el sistema (el perfil de la cuenta),
//       2. la autoridad operativa (este mapa: quién responde por qué),
//       3. la autorización de operaciones sensibles (permisos por cuenta y por operación, hoja 37).
//     Este módulo no lee ni escribe permisos, y ningún módulo de permisos o de dinero lo lee (hay prueba).
//   · Nada se asigna solo: nadie queda en un equipo ni con un superior si una persona no lo captura. Quien no tiene
//     equipo sale «sin equipo»; una unidad sin responsable sale «sin responsable». No se supone.
//   · Lo que está por confirmar se dice: `provisional`.
import { nuevoEvento, sinRepetir, estaVigente, vigentes, cancelarEvento, negado, validacionDe } from "./eventos.js";
import { sumarDias } from "./calculos.js";

export const T_UNIDAD = "org_unidad", T_UNIDAD_CAMBIO = "org_unidad_cambio", T_UNIDAD_CIERRE = "org_unidad_cierre";
export const T_CARGO = "org_cargo", T_CARGO_FIN = "org_cargo_fin";
export const T_ADSCRIPCION = "org_adscripcion", T_ADSCRIPCION_FIN = "org_adscripcion_fin", T_APOYO = "org_apoyo";
export const TIPOS = [T_UNIDAD, T_UNIDAD_CAMBIO, T_UNIDAD_CIERRE, T_CARGO, T_CARGO_FIN, T_ADSCRIPCION, T_ADSCRIPCION_FIN, T_APOYO];
export const CLASES = { area: "Área", equipo: "Equipo" };
// Quién captura el mapa: lo decide LA BASE (hoja 52). Cada hecho de la organización es una operación validada con la
// cuenta de la sesión, y el permiso `configurar_organizacion` no viene con ningún perfil —tampoco con ser
// superadministrador—: hay que tenerlo otorgado. Sin él, el hecho se guarda rechazado y no cuenta. A las funciones se
// les pasa `permitido` (lo que la base dijo de esta cuenta); sin base (un aparato suelto, las pruebas) manda el perfil.
export const OPERACION = "configurar_organizacion";
export const PUEDE_CONFIGURAR = ["admin"];
export const LO_QUE_NO_ES = "Este mapa dice quién responde por qué. No da ni quita permisos en el sistema: ésos se asignan aparte, cuenta por cuenta.";

const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ""));
const texto = (t) => String(t || "").trim();
const persona = (p) => (p && p.id ? { id: p.id, nombre: texto(p.nombre) } : null);
const deOrg = (eventos) => sinRepetir(eventos || []).filter(e => e && TIPOS.includes(e.tipo));
const enOrden = (a, b) => String(a.datos.desde).localeCompare(String(b.datos.desde)) || String(a.capturado).localeCompare(String(b.capturado)) || String(a.id).localeCompare(String(b.id));

/* ── La organización de un día ── */
export function organizacionEn(eventos, fecha, { personas = [] } = {}) {
  // Sólo cuenta lo vigente Y autorizado por la base: lo capturado sin señal está «por validar»; lo rechazado no cuenta.
  const vivos = vigentes(eventos || []).filter(e => TIPOS.includes(e.tipo)).map(e => (e.tipo === T_UNIDAD_CIERRE || e.tipo === T_CARGO_FIN || e.tipo === T_ADSCRIPCION_FIN ? { ...e, datos: { ...e.datos, desde: sumarDias(e.datos.hasta, 1) } } : e))
    .filter(e => e.datos.desde <= fecha).sort(enOrden);
  const nombreDe = (id, dicho) => (personas.find(p => p.id === id)?.nombre) || dicho || "Alguien que ya no está en el catálogo";
  const unidades = new Map(), cargo = new Map(), adscrito = new Map(), apoyos = [];
  for (const e of vivos) {
    const d = e.datos;
    if (e.tipo === T_UNIDAD) unidades.set(d.unidadId, { id: d.unidadId, nombre: d.nombre, clase: d.clase, dependeDe: d.dependeDe || null, desde: d.desde, provisional: !!d.provisional, nota: d.nota || "" });
    else if (e.tipo === T_UNIDAD_CAMBIO) { const u = unidades.get(d.unidadId); if (u) { if (d.nombre !== undefined) u.nombre = d.nombre; if (d.dependeDe !== undefined) u.dependeDe = d.dependeDe || null; if (d.clase !== undefined) u.clase = d.clase; if (d.provisional !== undefined) u.provisional = !!d.provisional; } }
    else if (e.tipo === T_UNIDAD_CIERRE) unidades.delete(d.unidadId);
    else if (e.tipo === T_CARGO) cargo.set(d.unidadId, { personaId: d.persona.id, nombre: d.persona.nombre, desde: d.desde, provisional: !!d.provisional, evento: e.id });
    else if (e.tipo === T_CARGO_FIN) cargo.delete(d.unidadId);
    else if (e.tipo === T_ADSCRIPCION) adscrito.set(d.persona.id, { personaId: d.persona.id, nombre: d.persona.nombre, unidadId: d.unidadId, desde: d.desde, evento: e.id });
    else if (e.tipo === T_ADSCRIPCION_FIN) adscrito.delete(d.personaId);
    else if (e.tipo === T_APOYO && d.hasta >= fecha) apoyos.push({ personaId: d.persona.id, nombre: d.persona.nombre, unidadId: d.unidadId, desde: d.desde, hasta: d.hasta, motivo: d.motivo || "", evento: e.id });
  }
  const avisos = [];
  const lista = [...unidades.values()].map(u => {
    const r = cargo.get(u.id) || null, padre = u.dependeDe && unidades.get(u.dependeDe);
    if (u.dependeDe && !padre) avisos.push({ clase: "sin_superior", unidadId: u.id, dice: `${u.nombre} dependía de una unidad que ya se cerró: falta decir de quién depende ahora.` });
    if (!r) avisos.push({ clase: "sin_responsable", unidadId: u.id, dice: `${u.nombre} no tiene responsable.` });
    return { ...u, dependeDe: padre ? u.dependeDe : null, huerfana: !!(u.dependeDe && !padre),
      responsable: r ? { ...r, nombre: nombreDe(r.personaId, r.nombre) } : null,
      miembros: [...adscrito.values()].filter(a => a.unidadId === u.id).map(a => ({ ...a, nombre: nombreDe(a.personaId, a.nombre) })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      apoyos: apoyos.filter(a => a.unidadId === u.id).map(a => ({ ...a, nombre: nombreDe(a.personaId, a.nombre) })) };
  });
  // El árbol, de arriba hacia abajo, con su nivel.
  const arbol = [], baja = (padreId, nivel) => { for (const u of lista.filter(x => (x.dependeDe || null) === padreId).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))) { arbol.push({ ...u, nivel }); baja(u.id, nivel + 1); } };
  baja(null, 0);
  const porId = new Map(arbol.map(u => [u.id, u]));
  const conEquipo = new Set([...adscrito.values()].filter(a => porId.has(a.unidadId)).map(a => a.personaId));
  return {
    fecha, unidades: arbol, porId, avisos, apoyos,
    sinEquipo: personas.filter(p => !conEquipo.has(p.id)).map(p => ({ personaId: p.id, nombre: p.nombre })),
    // De una persona: su equipo habitual, de qué responde y a quién apoya ese día.
    dePersona(id) {
      const a = adscrito.get(id), equipo = a && porId.get(a.unidadId) ? { unidadId: a.unidadId, nombre: porId.get(a.unidadId).nombre, desde: a.desde } : null;
      return { personaId: id, equipo, respondePor: arbol.filter(u => u.responsable?.personaId === id).map(u => ({ unidadId: u.id, nombre: u.nombre, clase: u.clase, provisional: u.responsable.provisional })),
        apoya: apoyos.filter(x => x.personaId === id && porId.has(x.unidadId)).map(x => ({ unidadId: x.unidadId, nombre: porId.get(x.unidadId).nombre, hasta: x.hasta })) };
    },
  };
}

// El superior de alguien NO se captura: sale de la cadena. Si no hay con qué decirlo, se dice que no se sabe.
export function superiorDe(org, personaId) {
  const p = org.dePersona(personaId);
  // Quien responde por una unidad depende del responsable de la unidad de arriba; quien no, del responsable de su equipo.
  const propias = p.respondePor.map(u => org.porId.get(u.unidadId)).sort((a, b) => a.nivel - b.nivel);
  let u = propias.length ? (propias[0].dependeDe ? org.porId.get(propias[0].dependeDe) : null) : p.equipo ? org.porId.get(p.equipo.unidadId) : undefined;
  if (u === undefined) return { superior: null, dice: "No tiene equipo: no hay con qué decir de quién depende." };
  const subida = [];
  while (u) {
    subida.push(u.nombre);
    if (u.responsable && u.responsable.personaId !== personaId) return { superior: { personaId: u.responsable.personaId, nombre: u.responsable.nombre, por: u.nombre, unidadId: u.id, provisional: u.responsable.provisional || u.provisional }, dice: `${u.responsable.nombre}, responsable de ${u.nombre}${u.responsable.provisional || u.provisional ? " (por confirmar)" : ""}.` };
    u = u.dependeDe ? org.porId.get(u.dependeDe) : null;
  }
  return { superior: null, dice: propias.length && !subida.length ? "Responde por la unidad más alta: no tiene superior en este mapa." : `Nadie responde por ${subida.join(" ni por ")}: no hay con qué decir de quién depende.` };
}

// En calidad de qué actúa alguien un día: para copiarlo a lo que haga (etapas siguientes) y que una reorganización
// posterior no le cambie la autoría a lo ya hecho.
export function enCalidadDe(org, personaId) {
  const p = org.dePersona(personaId);
  return { fecha: org.fecha, respondePor: p.respondePor.map(u => ({ unidadId: u.unidadId, nombre: u.nombre })), equipo: p.equipo ? { unidadId: p.equipo.unidadId, nombre: p.equipo.nombre } : null };
}

/* ── Capturar los hechos ── */
const ahoraSi = ({ quien, cuando, hoy, permitido }) => (!quien?.id ? "Falta quién lo registra." : negado(quien, permitido, "La organización la captura quien tiene ese permiso.") || (!cuando || !esFecha(hoy) ? "Falta la fecha de hoy." : null));
const hecho = (tipo, datos, { quien, cuando, hoy, id }) => nuevoEvento({ id, tipo, cuando, fecha: hoy, quien, datos: { ...datos, ...((datos.desde || datos.hasta) < hoy ? { retroactivo: true } : {}) } });
const bajan = (org, id) => { const s = new Set(); const baja = (x) => { for (const u of org.unidades) if (u.dependeDe === x && !s.has(u.id)) { s.add(u.id); baja(u.id); } }; baja(id); return s; };

export function crearUnidad({ eventos = [], nombre, clase, dependeDe = null, desde, provisional = false, nota = "", unidadId, quien, cuando, hoy, id, permitido } = {}) {
  const no = ahoraSi({ quien, cuando, hoy, permitido }); if (no) return { ok: false, dice: no };
  if (!texto(nombre)) return { ok: false, dice: "Falta el nombre." };
  if (!CLASES[clase]) return { ok: false, dice: "Di si es un área o un equipo." };
  if (!esFecha(desde)) return { ok: false, dice: "Falta desde cuándo existe." };
  const org = organizacionEn(eventos, desde);
  if (dependeDe && !org.porId.has(dependeDe)) return { ok: false, dice: "La unidad de la que depende no existe en esa fecha." };
  if (org.unidades.some(u => u.nombre.toLowerCase() === texto(nombre).toLowerCase())) return { ok: false, dice: `Ya hay una unidad que se llama ${texto(nombre)}.` };
  const ev = hecho(T_UNIDAD, { unidadId: unidadId || null, nombre: texto(nombre), clase, dependeDe: dependeDe || null, desde, provisional: !!provisional, nota: texto(nota) }, { quien, cuando, hoy, id });
  if (!ev.datos.unidadId) ev.datos.unidadId = ev.id;
  return { ok: true, evento: ev, dice: `${CLASES[clase]} «${texto(nombre)}» dada de alta.` };
}

// Cambiar nombre, de quién depende, o confirmar lo provisional. Lo anterior se queda con sus fechas.
export function cambiarUnidad({ eventos = [], unidadId, nombre, dependeDe, provisional, desde, motivo, quien, cuando, hoy, id, permitido } = {}) {
  const no = ahoraSi({ quien, cuando, hoy, permitido }); if (no) return { ok: false, dice: no };
  if (!esFecha(desde)) return { ok: false, dice: "Falta desde cuándo vale el cambio." };
  const org = organizacionEn(eventos, desde), u = org.porId.get(unidadId);
  if (!u) return { ok: false, dice: "Esa unidad no existe en esa fecha." };
  const cambios = {};
  if (nombre !== undefined && texto(nombre) !== u.nombre) { if (!texto(nombre)) return { ok: false, dice: "Falta el nombre." }; if (org.unidades.some(x => x.id !== u.id && x.nombre.toLowerCase() === texto(nombre).toLowerCase())) return { ok: false, dice: `Ya hay una unidad que se llama ${texto(nombre)}.` }; cambios.nombre = texto(nombre); }
  if (dependeDe !== undefined && (dependeDe || null) !== (u.huerfana ? "?" : u.dependeDe || null)) {
    if (dependeDe && !org.porId.has(dependeDe)) return { ok: false, dice: "La unidad de la que dependería no existe en esa fecha." };
    if (dependeDe && (dependeDe === u.id || bajan(org, u.id).has(dependeDe))) return { ok: false, dice: "Una unidad no puede depender de sí misma ni de una que depende de ella." };
    cambios.dependeDe = dependeDe || null;
  }
  if (provisional !== undefined && !!provisional !== u.provisional) cambios.provisional = !!provisional;
  if (!Object.keys(cambios).length) return { ok: false, dice: "No cambió nada." };
  if (!texto(motivo)) return { ok: false, dice: "Di por qué cambia: después es lo único que lo explica." };
  return { ok: true, evento: hecho(T_UNIDAD_CAMBIO, { unidadId, ...cambios, desde, motivo: texto(motivo), antes: { nombre: u.nombre, dependeDe: u.dependeDe, provisional: u.provisional } }, { quien, cuando, hoy, id }), cambio: Object.keys(cambios), dice: "Cambio registrado. Lo anterior queda guardado con sus fechas." };
}

// Cerrar una unidad: `hasta` es su último día. No se cierra con equipos o gente adentro: primero se dice a dónde van.
export function cerrarUnidad({ eventos = [], unidadId, hasta, motivo, quien, cuando, hoy, id, permitido } = {}) {
  const no = ahoraSi({ quien, cuando, hoy, permitido }); if (no) return { ok: false, dice: no };
  if (!esFecha(hasta)) return { ok: false, dice: "Falta su último día." };
  const org = organizacionEn(eventos, sumarDias(hasta, 1)), u = org.porId.get(unidadId);
  if (!u) return { ok: false, dice: "Esa unidad ya no existe en esa fecha." };
  if (!texto(motivo)) return { ok: false, dice: "Di por qué se cierra." };
  const hijas = org.unidades.filter(x => x.dependeDe === unidadId);
  if (hijas.length) return { ok: false, dice: `Primero di de quién van a depender: ${hijas.map(x => x.nombre).join(", ")}.` };
  if (u.miembros.length) return { ok: false, dice: `Todavía tiene ${u.miembros.length} persona(s). Primero di a qué equipo pasan.` };
  return { ok: true, evento: hecho(T_UNIDAD_CIERRE, { unidadId, hasta, motivo: texto(motivo), nombre: u.nombre, responsable: u.responsable ? { id: u.responsable.personaId, nombre: u.responsable.nombre } : null }, { quien, cuando, hoy, id }), dice: `«${u.nombre}» queda cerrada desde el ${sumarDias(hasta, 1)}. Su historial se conserva.` };
}

// Nombrar responsable. Si ya había uno, deja de serlo ese día (queda en el historial). Por defecto es «por confirmar».
export function nombrarResponsable({ eventos = [], unidadId, persona: p, desde, provisional = true, motivo = "", quien, cuando, hoy, id, permitido } = {}) {
  const no = ahoraSi({ quien, cuando, hoy, permitido }); if (no) return { ok: false, dice: no };
  if (!esFecha(desde)) return { ok: false, dice: "Falta desde cuándo." };
  const quienEs = persona(p); if (!quienEs) return { ok: false, dice: "Falta la persona." };
  const org = organizacionEn(eventos, desde), u = org.porId.get(unidadId);
  if (!u) return { ok: false, dice: "Esa unidad no existe en esa fecha." };
  const previo = u.responsable;
  if (previo && previo.personaId === quienEs.id && previo.provisional === !!provisional) return { ok: false, dice: `${previo.nombre} ya es responsable de ${u.nombre}.` };
  const confirma = !!previo && previo.personaId === quienEs.id;
  if (previo && !confirma && !texto(motivo)) return { ok: false, dice: `Di por qué cambia el responsable (hoy es ${previo.nombre}).` };
  return { ok: true, evento: hecho(T_CARGO, { unidadId, persona: quienEs, desde, provisional: !!provisional, motivo: texto(motivo), ...(confirma ? { confirma: true } : {}), anterior: previo && !confirma ? { id: previo.personaId, nombre: previo.nombre, desde: previo.desde } : null }, { quien, cuando, hoy, id }),
    dice: confirma ? `Confirmado: ${quienEs.nombre} responde por ${u.nombre}.` : `${quienEs.nombre} responde por ${u.nombre} desde el ${desde}${provisional ? " (por confirmar)" : ""}. Esto no le da permisos en el sistema.` };
}

export function quitarResponsable({ eventos = [], unidadId, hasta, motivo, quien, cuando, hoy, id, permitido } = {}) {
  const no = ahoraSi({ quien, cuando, hoy, permitido }); if (no) return { ok: false, dice: no };
  if (!esFecha(hasta)) return { ok: false, dice: "Falta su último día como responsable." };
  const u = organizacionEn(eventos, hasta).porId.get(unidadId);
  if (!u?.responsable) return { ok: false, dice: "Esa unidad no tiene responsable en esa fecha." };
  if (!texto(motivo)) return { ok: false, dice: "Di por qué deja de ser responsable." };
  return { ok: true, evento: hecho(T_CARGO_FIN, { unidadId, hasta, motivo: texto(motivo), persona: { id: u.responsable.personaId, nombre: u.responsable.nombre } }, { quien, cuando, hoy, id }), dice: `${u.nombre} queda sin responsable desde el ${sumarDias(hasta, 1)}.` };
}

// El equipo habitual de una persona: uno a la vez. Pasar a otro deja el anterior con sus fechas.
export function adscribir({ eventos = [], persona: p, unidadId, desde, motivo = "", quien, cuando, hoy, id, permitido } = {}) {
  const no = ahoraSi({ quien, cuando, hoy, permitido }); if (no) return { ok: false, dice: no };
  if (!esFecha(desde)) return { ok: false, dice: "Falta desde cuándo." };
  const quienEs = persona(p); if (!quienEs) return { ok: false, dice: "Falta la persona." };
  const org = organizacionEn(eventos, desde), u = org.porId.get(unidadId);
  if (!u) return { ok: false, dice: "Esa unidad no existe en esa fecha." };
  const previo = org.dePersona(quienEs.id).equipo;
  if (previo?.unidadId === unidadId) return { ok: false, dice: `${quienEs.nombre} ya está en ${u.nombre}.` };
  if (previo && !texto(motivo)) return { ok: false, dice: `Di por qué cambia de equipo (hoy está en ${previo.nombre}).` };
  return { ok: true, evento: hecho(T_ADSCRIPCION, { persona: quienEs, unidadId, desde, motivo: texto(motivo), anterior: previo ? { unidadId: previo.unidadId, nombre: previo.nombre, desde: previo.desde } : null }, { quien, cuando, hoy, id }), dice: `${quienEs.nombre} queda en ${u.nombre} desde el ${desde}.` };
}

export function quitarAdscripcion({ eventos = [], personaId, hasta, motivo, quien, cuando, hoy, id, permitido } = {}) {
  const no = ahoraSi({ quien, cuando, hoy, permitido }); if (no) return { ok: false, dice: no };
  if (!esFecha(hasta)) return { ok: false, dice: "Falta su último día en el equipo." };
  const eq = organizacionEn(eventos, hasta).dePersona(personaId).equipo;
  if (!eq) return { ok: false, dice: "Esa persona no tiene equipo en esa fecha." };
  if (!texto(motivo)) return { ok: false, dice: "Di por qué sale del equipo." };
  return { ok: true, evento: hecho(T_ADSCRIPCION_FIN, { personaId, hasta, motivo: texto(motivo), de: { unidadId: eq.unidadId, nombre: eq.nombre } }, { quien, cuando, hoy, id }), dice: `Queda sin equipo desde el ${sumarDias(hasta, 1)}.` };
}

// Colaborar un tiempo con otro equipo. NO cambia el equipo habitual, y no asigna trabajo ni horas: sólo lo dice.
export function apoyar({ eventos = [], persona: p, unidadId, desde, hasta, motivo, quien, cuando, hoy, id, permitido } = {}) {
  const no = ahoraSi({ quien, cuando, hoy, permitido }); if (no) return { ok: false, dice: no };
  if (!esFecha(desde) || !esFecha(hasta)) return { ok: false, dice: "Faltan las fechas del apoyo." };
  if (hasta < desde) return { ok: false, dice: "El apoyo no puede terminar antes de empezar." };
  const quienEs = persona(p); if (!quienEs) return { ok: false, dice: "Falta la persona." };
  const org = organizacionEn(eventos, desde), u = org.porId.get(unidadId);
  if (!u) return { ok: false, dice: "Esa unidad no existe en esa fecha." };
  if (org.dePersona(quienEs.id).equipo?.unidadId === unidadId) return { ok: false, dice: `${quienEs.nombre} ya es de ${u.nombre}: no hace falta apoyo.` };
  if (!texto(motivo)) return { ok: false, dice: "Di para qué es el apoyo." };
  return { ok: true, evento: hecho(T_APOYO, { persona: quienEs, unidadId, desde, hasta, motivo: texto(motivo) }, { quien, cuando, hoy, id }), dice: `${quienEs.nombre} apoya a ${u.nombre} del ${desde} al ${hasta}. Su equipo habitual no cambia.` };
}

// Un hecho capturado por error se cancela, con motivo: queda tachado en el historial y deja de contar.
export const cancelarHecho = (evento, { motivo, quien, cuando, permitido }) => { const no = negado(quien, permitido, "La organización la corrige quien tiene ese permiso."); return no ? { ok: false, dice: no } : cancelarEvento(evento, { motivo, quien, cuando }); };

/* ── El historial: qué se registró, cuándo, quién y por qué ── */
export function historialDe(eventos, { unidadId, personaId } = {}) {
  const todas = deOrg(eventos), nombreU = new Map();
  for (const e of [...todas].sort((a, b) => String(a.capturado).localeCompare(String(b.capturado)))) { if (e.tipo === T_UNIDAD) nombreU.set(e.datos.unidadId, e.datos.nombre); else if (e.tipo === T_UNIDAD_CAMBIO && e.datos.nombre && estaVigente(e)) nombreU.set(e.datos.unidadId, e.datos.nombre); }
  const U = (id) => nombreU.get(id) || "una unidad", P = (e) => e.datos.persona?.nombre || "alguien";
  const dice = (e) => { const d = e.datos; switch (e.tipo) {
    case T_UNIDAD: return `Se dio de alta ${CLASES[d.clase]?.toLowerCase() || "la unidad"} «${d.nombre}»${d.dependeDe ? `, que depende de ${U(d.dependeDe)}` : ""}${d.provisional ? " (provisional)" : ""}.`;
    case T_UNIDAD_CAMBIO: return [d.nombre !== undefined ? `«${d.antes?.nombre}» pasó a llamarse «${d.nombre}»` : "", d.dependeDe !== undefined ? `${U(d.unidadId)} pasó a depender de ${d.dependeDe ? U(d.dependeDe) : "nadie"}${d.antes?.dependeDe ? ` (antes, de ${U(d.antes.dependeDe)})` : ""}` : "", d.provisional !== undefined ? (d.provisional ? `${U(d.unidadId)} quedó como provisional` : `${U(d.unidadId)} quedó confirmada`) : ""].filter(Boolean).join("; ") + ".";
    case T_UNIDAD_CIERRE: return `Se cerró «${d.nombre}».`;
    case T_CARGO: return d.confirma ? `Se confirmó a ${P(e)} como responsable de ${U(d.unidadId)}.` : `${P(e)} quedó como responsable de ${U(d.unidadId)}${d.anterior ? `, en lugar de ${d.anterior.nombre}` : ""}${d.provisional ? " (por confirmar)" : ""}.`;
    case T_CARGO_FIN: return `${P(e)} dejó de ser responsable de ${U(d.unidadId)}.`;
    case T_ADSCRIPCION: return `${P(e)} quedó en ${U(d.unidadId)}${d.anterior ? ` (antes, en ${d.anterior.nombre})` : ""}.`;
    case T_ADSCRIPCION_FIN: return `Salió de ${d.de?.nombre || "su equipo"}.`;
    default: return `${P(e)} apoya a ${U(d.unidadId)} hasta el ${d.hasta}.`;
  } };
  const toca = (e) => { const d = e.datos; if (unidadId) return d.unidadId === unidadId || d.dependeDe === unidadId || d.antes?.dependeDe === unidadId; if (personaId) return d.persona?.id === personaId || d.personaId === personaId || d.anterior?.id === personaId; return true; };
  return todas.filter(toca).sort((a, b) => String(b.capturado).localeCompare(String(a.capturado))).map(e => ({ evento: e.id, tipo: e.tipo, vale: e.datos.hasta ? sumarDias(e.datos.hasta, 1) : e.datos.desde, registrado: e.capturado, quien: e.quien?.nombre || "", dice: dice(e), motivo: e.datos.motivo || "", retroactivo: !!e.datos.retroactivo, validacion: validacionDe(e),
    cancelado: estaVigente(e) ? null : { motivo: e.cancelado?.motivo || "", por: e.cancelado?.por?.nombre || "" } }));
}

/* ── La estructura provisional de arranque (decidida por Luis, 21 nov) ── */
// Son sólo las unidades: SIN personas, SIN responsables. Todo nace «provisional» hasta que Dirección, Miguel y Fito lo
// validen. Los identificadores son fijos: crearla en dos aparatos da los mismos hechos, no el doble.
export const ARRANQUE_PROVISIONAL = [
  { clave: "direccion", nombre: "Dirección", clase: "area", dependeDe: null },
  { clave: "agricolas", nombre: "Operaciones agrícolas generales", clase: "area", dependeDe: "direccion" },
  { clave: "agronomicas", nombre: "Operaciones agronómicas", clase: "area", dependeDe: "direccion" },
  { clave: "riegos", nombre: "Riegos", clase: "equipo", dependeDe: "agronomicas" },
];
export function estructuraProvisional({ eventos = [], desde, quien, cuando, hoy, permitido } = {}) {
  const no = ahoraSi({ quien, cuando, hoy, permitido }); if (no) return { ok: false, dice: no };
  if (!esFecha(desde)) return { ok: false, dice: "Falta desde cuándo." };
  if (deOrg(eventos).some(e => e.tipo === T_UNIDAD)) return { ok: false, dice: "Ya hay unidades dadas de alta: la estructura de arranque sólo se propone cuando no hay ninguna." };
  const uid = (c) => `org-${c}`;
  return { ok: true, eventos: ARRANQUE_PROVISIONAL.map(u => hecho(T_UNIDAD, { unidadId: uid(u.clave), nombre: u.nombre, clase: u.clase, dependeDe: u.dependeDe ? uid(u.dependeDe) : null, desde, provisional: true, nota: "Estructura de arranque, sujeta a validación." }, { quien, cuando, hoy, id: `ev-orgunidad-arranque-${u.clave}` })),
    dice: "Quedó la estructura provisional: sólo las áreas y un equipo, sin personas ni responsables. Falta validarla." };
}
