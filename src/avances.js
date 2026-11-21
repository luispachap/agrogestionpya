// ============================================================
//  AgroGestión — Cuánto se avanzó de un trabajo (puro)
//
//  En el campo el avance se dice en la unidad que se tiene a la mano:
//  «terminamos dos reguladores», «llevamos cuarenta surcos», «salieron 300
//  cajas». Aquí se guarda ASÍ, como evento `avance_trabajo`, sin pedir una
//  precisión que hoy no existe.
//
//  REGLAS
//  · Avance NO es pago. Un avance no crea rayas, costos ni actividades de
//    nadie: cómo se mide un trabajo y cómo se le paga a la gente son dos cosas.
//  · Avance NO es porcentaje. Dos reguladores de cuatro no son «la mitad»: los
//    reguladores no son iguales. Mientras no se sepa cuánto mide cada uno, no
//    se calcula ni se enseña un porcentaje.
//  · «Trabajaron siete» es un número, no siete personas con nombre: no le
//    registra nada a nadie.
//  · Lo que quedó pendiente se conserva como se dijo, para planear lo de mañana.
//  · Una sugerencia dice en qué se basa; sin datos suficientes, lo dice.
// ============================================================
import { nuevoEvento, vigentes } from "./eventos.js";

export const T_AVANCE = "avance_trabajo";
// Singular → cómo se dice en plural y las formas en que se oye. «otra» = cualquier unidad que el rancho use y no esté aquí.
export const UNIDADES_DE_AVANCE = {
  regulador: ["reguladores", "regulador"], cama: ["camas", "cama"], surco: ["surcos", "surco"], hilo: ["hilos", "hilo"], melga: ["melgas", "melga"], tabla: ["tablas", "tabla"],
  hectarea: ["hectáreas", "hectareas", "hectarea", "has", "ha"], caja: ["cajas", "caja"], tonelada: ["toneladas", "tonelada"], pieza: ["piezas", "pieza"], tarea: ["tareas", "tarea"], otra: [],
};
const texto = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const sinAcentos = (s) => texto(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const unidadDe = (dicha) => { const d = sinAcentos(dicha); return Object.keys(UNIDADES_DE_AVANCE).find(k => k === d || UNIDADES_DE_AVANCE[k].some(f => sinAcentos(f) === d)) || null; };
export const decirUnidad = (unidad, n, dicha = "") => (unidad === "otra" ? dicha || "unidades" : n === 1 ? unidad.replace("hectarea", "hectárea") : UNIDADES_DE_AVANCE[unidad][0]);

// De qué actividad se habla, COMO SE DIJO: «dos reguladores de deshierbe en…» → «deshierbe». Si no se dijo, no se pone una.
export function actividadDicha(frase) {
  const formas = Object.values(UNIDADES_DE_AVANCE).flat().map(sinAcentos).sort((a, b) => b.length - a.length).join("|");
  const m = new RegExp(`\\b(?:${formas})\\s+(?:de|del|de la|en el|en la)\\s+([a-zñ ]{3,40}?)(?=\\s+(?:en|de la parcela|del rancho|hoy|ayer)\\b|[.,;]|$)`).exec(sinAcentos(frase));
  if (m) return texto(m[1]);
  const v = /\b(deshierb\w+|desyerb\w+|rieg\w+|regando|siembr\w+|sembrando|fumig\w+|cosech\w+|cort\w+|empa\w+|limpi\w+|barbech\w+|rastre\w+|fertiliz\w+|aplicaci\w+)\b/.exec(sinAcentos(frase));
  return v ? v[1] : "";
}

// Registrar un avance. Sin dinero y sin nombres: sólo qué, cuánto, dónde, cuándo y qué quedó pendiente.
export function registrarAvance({ id, parcelaId, parcelas = [], actividad, cantidad, unidad, unidadDicha = "", personas = null, pendiente = null, nota = "", origen = null, quien, cuando, fecha, azar }) {
  if (!parcelaId || (parcelas.length && !parcelas.some(p => p.id === parcelaId))) return { ok: false, dice: "Falta decir en qué parcela." };
  if (texto(actividad).length < 3) return { ok: false, dice: "Falta decir de qué actividad es el avance (deshierbe, riego, corte…)." };
  const n = Number(cantidad); if (!(n > 0)) return { ok: false, dice: "Falta cuánto se avanzó." };
  const u = UNIDADES_DE_AVANCE[unidad] ? unidad : unidadDe(unidad); if (!u) return { ok: false, dice: "Falta en qué se mide el avance (reguladores, surcos, cajas…)." };
  if (u === "otra" && texto(unidadDicha).length < 2) return { ok: false, dice: "Falta decir cuál es esa otra unidad." };
  if (personas != null && !(Number(personas) > 0)) return { ok: false, dice: "El número de personas no se entiende." };
  const pend = pendiente && (texto(pendiente.texto) || pendiente.cantidad) ? { texto: texto(pendiente.texto), ...(Number(pendiente.cantidad) > 0 ? { cantidad: Number(pendiente.cantidad), unidad: unidadDe(pendiente.unidad) || u } : {}) } : null;
  return { ok: true, evento: nuevoEvento({ id, tipo: T_AVANCE, cuando, fecha, quien, azar, datos: { parcelaId, actividad: texto(actividad).toLowerCase(), cantidad: n, unidad: u, ...(u === "otra" ? { unidadDicha: texto(unidadDicha) } : {}),
    ...(personas != null ? { personas: Number(personas) } : {}), ...(pend ? { pendiente: pend } : {}), ...(texto(nota) ? { nota: texto(nota) } : {}), ...(origen ? { origenDicho: origen } : {}) } }) };
}
export function avancesDe(eventos = []) {
  return vigentes(eventos).filter(e => e.tipo === T_AVANCE).map(e => ({ ...e.datos, dia: e.fecha, quien: e.quien?.nombre || "", evento: e.id, cuando: e.cuando })).sort((a, b) => String(a.cuando).localeCompare(String(b.cuando)));
}
// Lo avanzado en una parcela, por actividad y unidad. Sin porcentaje: no se sabe cuánto es el total.
export function avanceDeParcela(eventos = [], parcelaId, desde = null) {
  const m = new Map();
  for (const a of avancesDe(eventos)) { if (a.parcelaId !== parcelaId || (desde && a.dia < desde)) continue; const k = `${a.actividad}|${a.unidad}|${a.unidadDicha || ""}`, x = m.get(k) || { actividad: a.actividad, unidad: a.unidad, unidadDicha: a.unidadDicha || "", cantidad: 0, registros: 0, ultimo: null, pendiente: null };
    x.cantidad += a.cantidad; x.registros++; x.ultimo = a.dia; x.pendiente = a.pendiente || null; m.set(k, x); }
  return [...m.values()].map(x => ({ ...x, porcentaje: null, porque: "No se calcula un porcentaje: no se sabe cuánto mide cada unidad ni cuántas tiene la parcela." }));
}

/* ════════════ Para planear lo de mañana ════════════ */
const mediana = (l) => { const o = [...l].sort((a, b) => a - b), i = Math.floor(o.length / 2); return o.length % 2 ? o[i] : (o[i - 1] + o[i]) / 2; };
export const MINIMO_PARA_ESTIMAR = 3;
// Lo que quedó pendiente la última vez que se trabajó cada cosa, y —sólo si hay con qué— cuánta gente podría hacer falta.
// Cada sugerencia dice en qué se basa. Decide quien dirige el rancho.
export function sugerenciasDeContinuidad(eventos = [], hoy, parcelas = []) {
  const todos = avancesDe(eventos).filter(a => a.dia < hoy), ultimo = new Map();
  for (const a of todos) ultimo.set(`${a.parcelaId}|${a.actividad}`, a);
  return [...ultimo.values()].filter(a => a.pendiente).map(a => {
    const parcela = parcelas.find(p => p.id === a.parcelaId)?.nombre || "esa parcela", u = (n) => decirUnidad(a.unidad, n, a.unidadDicha);
    const base = `El ${a.dia}${a.personas ? ` trabajaron ${a.personas} persona(s)` : ""} en ${a.actividad} en ${parcela}: avanzaron ${a.cantidad} ${u(a.cantidad)} y quedó pendiente${a.pendiente.cantidad ? ` ${a.pendiente.cantidad} ${decirUnidad(a.pendiente.unidad, a.pendiente.cantidad, a.unidadDicha)}` : ""}${a.pendiente.texto ? ` («${a.pendiente.texto}»)` : ""}.`;
    // ¿Cuánta gente? Sólo con el mismo trabajo, en la misma parcela y unidad, medido con gente al menos tres veces, y con lo pendiente dicho en número.
    const iguales = todos.filter(x => x.parcelaId === a.parcelaId && x.actividad === a.actividad && x.unidad === a.unidad && x.personas > 0);
    let estimacion = null, sinEstimar = "";
    if (!a.pendiente.cantidad) sinEstimar = "No se dijo cuánto quedó pendiente, así que no se puede calcular cuánta gente hace falta.";
    else if (a.pendiente.unidad !== a.unidad) sinEstimar = "Lo pendiente se dijo en otra unidad que el avance: no se comparan.";
    else if (iguales.length < MINIMO_PARA_ESTIMAR) sinEstimar = `Sólo hay ${iguales.length} registro(s) de este trabajo con número de personas; hacen falta ${MINIMO_PARA_ESTIMAR} para estimar.`;
    else { const ritmo = mediana(iguales.map(x => x.cantidad / x.personas)); estimacion = { personas: Math.max(1, Math.ceil(a.pendiente.cantidad / ritmo)), ritmo: Math.round(ritmo * 100) / 100, registros: iguales.length,
      dice: `Para terminar en un día harían falta alrededor de ${Math.max(1, Math.ceil(a.pendiente.cantidad / ritmo))} persona(s), si rinden como en los ${iguales.length} registros anteriores (${Math.round(ritmo * 100) / 100} ${u(2)} por persona al día). Es una cuenta gruesa: las unidades no son todas iguales.` }; }
    return { parcelaId: a.parcelaId, actividad: a.actividad, dice: `${base} Conviene considerar gente para continuar.`, seBasaEn: [a.evento, ...(estimacion ? iguales.map(x => x.evento) : [])].filter((x, i, l) => l.indexOf(x) === i), estimacion, sinEstimar };
  });
}
