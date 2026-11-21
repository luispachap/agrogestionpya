// ============================================================
//  AgroGestión — Las claves de las rayas (puro, sin React ni red)
//
//  En las libretas del rancho cada renglón trae códigos cortos: «A07 · Bod»,
//  «A27 · SF4 · Ajo». Unos dicen QUÉ se hizo (actividad), otros DÓNDE
//  (ubicación) y, aparte, EN QUÉ cultivo. «Ajo» es un cultivo, no la clave A07.
//  Este módulo es el catálogo de esas equivalencias, y se llena solo, poco a
//  poco, con lo que las personas van contestando.
//
//  REGLAS
//  · La app NO inventa el significado de una clave. Si no está registrada,
//    pregunta; mientras nadie conteste, el renglón conserva su código y dice
//    «falta decir qué significa».
//  · Una actividad no es una ubicación. Las claves «A» + número son de
//    actividad (lo dijo Luis, 20 nov 2026); «Bod» y «SF1…SF4» son lugares.
//    Guardar una como lo otro se rechaza.
//  · El código ORIGINAL del papel se conserva siempre. En el histórico se
//    guarda la clave, no su significado: si después se aprende o se corrige,
//    todo lo ya importado se lee con el significado vigente.
//  · Corregir no borra: la equivalencia anterior queda en `anteriores`, con
//    quién y cuándo.
//  · No toda celda de una raya es una clave: lo que no se reconoce queda como
//    duda para que lo vea una persona, no se le asigna un papel.
// ============================================================

import { nuevoEvento, vigentes } from "./eventos.js";

export const T_CLAVE = "clave_aprendida";
export const CLASES_DE_CLAVE = { actividad: "Actividad (qué se hizo)", ubicacion: "Ubicación (dónde)", general: "General (trabajo sin rancho específico)", cultivo: "Cultivo (en qué)", nota: "Una anotación, no una clave", ignorar: "No significa nada: ignorarla" };

const sinAcentos = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");

// De como viene escrita a como se guarda. A mano, «A07» sale «Ao7», «A O7» o «A7»: es la MISMA clave. El original no se pierde.
export function normalizarClave(texto) {
  const original = String(texto ?? "").replace(/\s+/g, " ").trim();
  let c = sinAcentos(original).toUpperCase().replace(/[\s.\-_/]+/g, "");
  // Clave de actividad: A + uno o dos dígitos, y al menos uno tiene que ser un dígito de verdad (una «o» chica escrita
  // a mano junto a un número es un cero: «Ao7»). «Ajo», «Alo» o «AO» NO son claves de actividad: «Ajo» es un cultivo, y
  // una palabra mal leída no se convierte en un número.
  const act = /^A([0-9O]{1,2})$/.exec(c);
  if (act && /\d/.test(act[1])) c = `A${act[1].replace(/O/g, "0").padStart(2, "0")}`;
  // «SF4» a mano se lee fácil como «5f4»: no existe ninguna clave que empiece con 5F, así que es la misma.
  if (/^5F[0-9OIL]$/.test(c)) c = `S${c.slice(1)}`;
  // «RA51» (Rancho 51) a mano se lee «RASI»: la S es un 5 y la I un 1. Sólo dentro de esta forma (RA + dos signos).
  const ra = /^RA([5S])([0-9OIL])$/.exec(c);
  if (ra) c = `RA5${ra[2].replace(/O/g, "0").replace(/[IL]/g, "1")}`;
  // «Ajo» a mano se ha leído «2jo» y «9jo» (confirmado por el rancho, 20 nov 2026): es la palabra, no un código.
  if (/^[29A]J[O0]$/.test(c)) c = "AJO";
  const sf = /^SF([0-9OIL])$/.exec(c);
  if (sf) c = `SF${sf[1].replace(/O/g, "0").replace(/[IL]/g, "1")}`;
  return { clave: c, original, ajustada: !!c && c !== sinAcentos(original).toUpperCase() };
}

// Lo que la FORMA de la clave ya dice, sin saber su significado. null = no se sabe qué clase de cosa es.
export function formaDe(clave) {
  if (/^A\d{2}$/.test(clave)) return "actividad";
  if (/^SF\d$/.test(clave) || /^RA\d{2}$/.test(clave) || clave === "BOD") return "ubicacion";
  if (clave === "GEN") return "general";
  if (clave === "AJO") return "cultivo";
  return null;
}

// Lo que el rancho ya dijo (Luis, 20 nov 2026). Se puede corregir como cualquier otra equivalencia.
// `grupo`: varias ubicaciones independientes que se juntan para verlas en conjunto; cada una sigue siendo la suya.
// «Gen» NO es un lugar: es trabajo general, sin rancho específico. Tampoco es, por sí solo, un gasto general.
export const CLAVES_DICHAS = [
  { clave: "BOD", clase: "ubicacion", significado: "Bodega" },
  { clave: "SF1", clase: "ubicacion", significado: "San Felipe 1", grupo: "San Felipe" },
  { clave: "SF2", clase: "ubicacion", significado: "San Felipe 2", grupo: "San Felipe" },
  { clave: "SF3", clase: "ubicacion", significado: "San Felipe 3", grupo: "San Felipe" },
  { clave: "SF4", clase: "ubicacion", significado: "San Felipe 4", grupo: "San Felipe" },
  { clave: "RA50", clase: "ubicacion", significado: "Rancho 50", grupo: "Ranchos 50s" },
  { clave: "RA51", clase: "ubicacion", significado: "Rancho 51", grupo: "Ranchos 50s" },
  { clave: "RA53", clase: "ubicacion", significado: "Rancho 53", grupo: "Ranchos 50s" },
  { clave: "GEN", clase: "general", significado: "General (sin rancho específico)" },
  { clave: "AJO", clase: "cultivo", significado: "Ajo" },
];

// El catálogo vigente: lo dicho de arranque + lo aprendido (lo más reciente manda; lo anterior se conserva).
export function catalogoDeClaves(eventos = []) {
  const m = new Map();
  for (const c of CLAVES_DICHAS) m.set(c.clave, { ...c, deArranque: true, quien: "", fecha: "", anteriores: [] });
  const ev = vigentes(eventos).filter(e => e.tipo === T_CLAVE).sort((a, b) => String(a.cuando).localeCompare(String(b.cuando)));
  for (const e of ev) {
    const d = e.datos || {}, previo = m.get(d.clave);
    const anteriores = previo ? [...previo.anteriores, { clase: previo.clase, significado: previo.significado, quien: previo.quien, fecha: previo.fecha, deArranque: !!previo.deArranque }] : [];
    m.set(d.clave, { clave: d.clave, clase: d.clase, significado: d.significado || "", ...((d.grupo ?? previo?.grupo) ? { grupo: d.grupo ?? previo.grupo } : {}), original: d.original || d.clave, quien: e.quien?.nombre || "", fecha: e.fecha || "", evento: e.id, docId: d.docId || null, anteriores });
  }
  return m;
}
export const listaDeClaves = (catalogo) => [...catalogo.values()].sort((a, b) => a.clase.localeCompare(b.clase) || a.clave.localeCompare(b.clave, "es", { numeric: true }));

// Guardar (o corregir) una equivalencia. Devuelve { ok, evento } o { ok:false, dice }.
export function aprenderClave({ catalogo, clave: escrita, clase, significado = "", grupo = undefined, deReferencia = null, docId = null, quien, cuando, fecha, azar }) {
  const { clave, original } = normalizarClave(escrita), que = String(significado || "").replace(/\s+/g, " ").trim();
  if (!clave) return { ok: false, dice: "Falta la clave." };
  if (clave.length > 24) return { ok: false, dice: "Eso no parece una clave: es muy largo." };
  if (!CLASES_DE_CLAVE[clase]) return { ok: false, dice: `Falta decir si «${original}» es una actividad o una ubicación.` };
  const forma = formaDe(clave);
  const DIM = ["actividad", "ubicacion", "general", "cultivo"], COMO = { actividad: "actividad", ubicacion: "ubicación", general: "trabajo general", cultivo: "cultivo" };
  if (forma && DIM.includes(clase) && clase !== forma)
    return { ok: false, dice: forma === "actividad" ? `«${clave}» es una clave de actividad (empieza con A y un número): no se guarda como ${COMO[clase]}.` : forma === "cultivo" ? `«${clave}» es un cultivo: no se guarda como ${COMO[clase]}.` : forma === "general" ? `«${clave}» es trabajo general, no un lugar: no se guarda como ${COMO[clase]}.` : `«${clave}» es una clave de ubicación: no se guarda como ${COMO[clase]}.` };
  if (DIM.includes(clase) && que.length < 2) return { ok: false, dice: `Falta decir qué significa «${clave}».` };
  // Dos claves distintas de la misma clase con el mismo significado casi siempre es un error de dedo: se avisa, no se impide.
  const gemela = [...(catalogo?.values() || [])].find(c => c.clave !== clave && c.clase === clase && que && sinAcentos(c.significado).toUpperCase() === sinAcentos(que).toUpperCase());
  const previo = catalogo?.get(clave);
  if (previo && previo.clase === clase && previo.significado === que && (grupo === undefined || (previo.grupo || "") === String(grupo).trim())) return { ok: false, igual: true, dice: `«${clave}» ya estaba guardada así.` };
  return { ok: true, corrige: !!previo, aviso: gemela ? `Ojo: «${gemela.clave}» ya significa «${gemela.significado}». Si son la misma, corrige una.` : "",
    evento: nuevoEvento({ tipo: T_CLAVE, cuando, fecha, quien, azar, datos: { clave, original, clase, significado: que, ...(deReferencia ? { deReferencia } : {}), ...(typeof grupo === "string" ? { grupo: grupo.replace(/\s+/g, " ").trim() } : {}), ...(docId ? { docId } : {}) } }) };
}

// Parte una celda con varias claves («A07 | Bod», «A07 Bod», «A07, Bod»).
export const partirClaves = (celda) => { const t = String(celda ?? ""); return (t.includes("|") ? t.split("|") : t.split(/[,;\s]+/)).map(s => s.trim()).filter(Boolean); };

// Cada código de un renglón, con lo que se sabe de él.
export function leerClaves(escritas = [], catalogo = new Map()) {
  return (escritas || []).map(x => {
    const { clave, original, ajustada } = normalizarClave(x), sabida = catalogo.get(clave), forma = formaDe(clave);
    const clase = sabida?.clase || forma || null;
    return { original, clave, ajustada, clase, significado: sabida?.significado || "", grupo: sabida?.grupo || "", conocida: !!sabida,
      falta: sabida ? null : forma ? "significado" : "todo" };
  }).filter(c => c.clave);
}

// Un renglón de raya → cinco cosas independientes: trabajador · fecha · actividad · ubicación · cultivo, con sus dudas.
// No decide nada: describe. `cultivo` es lo que venía escrito como cultivo («Ajo»); va aparte de las claves y nunca
// cuenta como actividad. Si entre las claves viene una palabra que el catálogo conoce como cultivo, también es cultivo.
export function relacionDeRenglon({ nombre = "", fecha = null, claves = [], cultivo = "", observacion = "" }, catalogo = new Map()) {
  const escritoCultivo = String(cultivo ?? "").replace(/\s+/g, " ").trim();
  const leidas = [...leerClaves(claves, catalogo), ...leerClaves(escritoCultivo ? [escritoCultivo] : [], catalogo).map(c => ({ ...c, deCultivo: true }))].filter(c => c.clase !== "ignorar");
  const act = leidas.filter(c => c.clase === "actividad"), ubi = leidas.filter(c => c.clase === "ubicacion" || c.clase === "general"), cul = leidas.filter(c => c.clase === "cultivo"), notas = leidas.filter(c => c.clase === "nota"), raras = leidas.filter(c => !c.clase);
  const dudas = [];
  if (!fecha) dudas.push("No se sabe de qué día es.");
  if (act.length > 1) dudas.push(`Trae ${act.length} claves de actividad (${act.map(c => c.clave).join(", ")}): no se escoge una.`);
  if (ubi.length > 1) dudas.push(`Trae ${ubi.length} claves de ubicación (${ubi.map(c => c.clave).join(", ")}): no se escoge una.`);
  for (const c of act.filter(c => !c.conocida)) dudas.push(`Falta decir qué actividad es «${c.clave}».`);
  for (const c of ubi.filter(c => !c.conocida)) dudas.push(`Falta decir qué lugar es «${c.clave}».`);
  if (new Set(cul.map(c => c.clave)).size > 1) dudas.push(`Trae ${cul.length} cultivos (${cul.map(c => c.original).join(", ")}): no se escoge uno.`);
  for (const c of act.filter(c => c.deCultivo)) dudas.push(`En el lugar del cultivo se leyó «${c.original}», que tiene forma de clave de actividad: confirma contra el papel.`);
  // Lo que se ajustó al leer (una letra por un número) se dice: es una interpretación, no un hecho.
  const literal = (c) => c.original.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[\s.\-_/]+/g, "");
  // («Ajo» leído «9jo» o «2jo» no se repite en cada renglón: lo confirmó el rancho, y se avisa una vez por documento.)
  for (const c of leidas.filter(c => ["SF", "RA"].includes(c.clave.slice(0, 2)) && literal(c) !== c.clave)) dudas.push(`Se leyó «${c.original}» y se tomó como ${c.clave}: confirma contra el papel.`);
  for (const c of raras) dudas.push(c.deCultivo ? `En el lugar del cultivo dice «${c.original}» y no se sabe qué es.` : `No se sabe qué es «${c.original}» (¿actividad, ubicación, cultivo o una anotación?).`);
  const sinTrabajo = act.length === 0 && ubi.length === 0;
  if (sinTrabajo && !observacion && raras.length === 0) dudas.push("No trae ninguna clave.");
  else if (!sinTrabajo && act.length === 0) dudas.push("No trae clave de actividad.");
  else if (!sinTrabajo && ubi.length === 0) dudas.push("No trae clave de ubicación.");
  const unCultivo = new Set(cul.map(c => c.clave)).size === 1 ? cul[0] : null;
  return { nombre, fecha, actividad: act.length === 1 ? act[0] : null, ubicacion: ubi.length === 1 ? ubi[0] : null, sinLugarFisico: ubi.length === 1 && ubi[0].clase === "general", cultivo: unCultivo, claves: leidas, notas: notas.map(c => c.significado || c.original), observacion,
    dudas, completa: !!nombre && !!fecha && act.length === 1 && ubi.length === 1 && act[0].conocida && ubi[0].conocida && raras.length === 0 };
}

// Cómo se enseña una clave: su significado si se sabe; si no, el código tal cual.
export const decirClave = (c) => (!c ? "" : c.conocida ? (c.clase === "cultivo" ? `Cultivo: ${c.significado}` : `${c.significado}${c.grupo ? `, de ${c.grupo}` : ""} (${c.clave})`) : c.clase ? `${c.clave}: falta decir qué ${c.clase === "actividad" ? "actividad" : "lugar"} es` : `«${c.original}»: no se sabe qué es`);
export function decirRelacion(rel) {
  return [rel.actividad ? decirClave(rel.actividad) : "", rel.ubicacion ? decirClave(rel.ubicacion) : "", rel.cultivo ? decirClave(rel.cultivo) : "", ...rel.claves.filter(c => c !== rel.actividad && c !== rel.ubicacion && c.clase !== "cultivo" && c.clase !== "nota").map(decirClave), ...rel.notas, rel.observacion].filter(Boolean).join(" · ");
}

// Lo que hay que preguntar: cada clave sin registrar UNA vez, con cuántas veces sale y un ejemplo. Primero las que más salen.
export function clavesPorPreguntar(renglones = [], catalogo = new Map()) {
  const m = new Map();
  for (const r of renglones) for (const c of leerClaves([...(r.claves || []), ...(String(r.cultivo ?? "").trim() ? [String(r.cultivo).trim()] : [])], catalogo)) {
    if (c.conocida) continue;
    const x = m.get(c.clave) || { clave: c.clave, original: c.original, clase: c.clase, falta: c.falta, veces: 0, escritas: new Set(), ejemplo: "" };
    x.veces++; x.escritas.add(c.original); if (!x.ejemplo) x.ejemplo = [r.fecha, r.nombre, [...(r.claves || []), r.cultivo].filter(Boolean).join(" · ")].filter(Boolean).join(" — ");
    m.set(c.clave, x);
  }
  return [...m.values()].map(x => ({ ...x, escritas: [...x.escritas] })).sort((a, b) => b.veces - a.veces || a.clave.localeCompare(b.clave, "es", { numeric: true }));
}

// Dónde se usa cada clave en lo ya importado (para decidir con calma antes de corregir una equivalencia).
export function usoDeClaves(historico = []) {
  const m = new Map();
  for (const h of historico) for (const c of h.claves || []) { const k = normalizarClave(c).clave; if (k) m.set(k, (m.get(k) || 0) + 1); }
  return m;
}

/* ════════════ REFERENCIAS HISTÓRICAS ════════════
   Lo que una clave significaba en un documento viejo (un Excel de rayas de otro año). NO es el catálogo: es evidencia.
   · Cada referencia dice de qué archivo salió y de qué fechas era; su vigencia queda «por confirmar».
   · Una misma clave puede tener VARIAS (los significados cambiaron entre versiones): se conservan todas.
   · Nunca se aplican solas: se SUGIEREN al preguntar una clave, y una persona confirma (ahí nace `clave_aprendida`,
     que anota de qué referencia salió). Viven en el histórico de la importación (clase `referencia_clave`). */
export const CLASE_REFERENCIA = "referencia_clave";
export function referenciasDeClaves(historico = []) {
  const m = new Map();
  for (const h of historico) {
    if (h.clase !== CLASE_REFERENCIA || !h.clave) continue;
    const lista = m.get(h.clave) || [];
    const igual = lista.find(x => x.clase === h.tipoDeClave && sinAcentos(x.significado).toUpperCase() === sinAcentos(h.significado).toUpperCase() && (x.cultivoAsociado || "") === (h.cultivoAsociado || ""));
    const fuente = { documento: h.documento || h._importado?.documento || "", hoja: h.hoja || "", desde: h.desde || null, hasta: h.hasta || null };
    // La misma interpretación en dos archivos: una sola, con sus dos fuentes (más evidencia, no otra interpretación).
    if (igual) { if (!igual.fuentes.some(f => f.documento === fuente.documento)) igual.fuentes.push(fuente); }
    else lista.push({ clave: h.clave, clase: h.tipoDeClave, significado: h.significado, escrita: h.escrita || "", cultivoAsociado: h.cultivoAsociado || "", sinCodigo: !!h.sinCodigo, aliasDe: h.aliasDe || "", vigencia: "por confirmar", fuentes: [fuente] });
    m.set(h.clave, lista);
  }
  return m;
}
const mismo = (a, b) => sinAcentos(a).toUpperCase().replace(/\s+/g, " ").trim() === sinAcentos(b).toUpperCase().replace(/\s+/g, " ").trim();
// Lo que se le puede sugerir a la persona para una clave, comparado con lo que ya se sabe. No decide nada.
//  estado: "nueva" (el catálogo no la tiene) · "coincide" · "difiere" (el catálogo dice otra cosa: las dos se enseñan)
//          · "otra_clase" (la referencia la usa para otra cosa: actividad contra ubicación, por ejemplo)
export function sugerenciasDe(clave, referencias = new Map(), catalogo = new Map()) {
  const k = normalizarClave(clave).clave, sabida = catalogo.get(k), forma = formaDe(k);
  return (referencias.get(k) || []).map(r => {
    const claseActual = sabida?.clase || forma;
    const estado = claseActual && claseActual !== r.clase && !(claseActual === "general" && r.clase === "ubicacion") ? "otra_clase" : !sabida ? "nueva" : mismo(sabida.significado, r.significado) ? "coincide" : "difiere";
    return { ...r, estado, actual: sabida ? { clase: sabida.clase, significado: sabida.significado } : null, variasInterpretaciones: (referencias.get(k) || []).length > 1 };
  });
}
// Claves de las referencias que se escriben CASI igual (una letra de más o de menos: «RA51» y «R51», «MB» y «MAB»).
// Es sólo una pista para la persona: parecerse no es ser la misma, y nunca se toma sola.
const aUna = (a, b) => { if (a === b || Math.abs(a.length - b.length) > 1) return false; let i = 0, j = 0, d = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } } return d + (a.length - i) + (b.length - j) <= 1; };
export function parecidasDe(clave, referencias = new Map()) {
  const k = normalizarClave(clave).clave; if (k.length < 2 || referencias.has(k)) return [];
  return [...referencias.entries()].filter(([otra]) => otra.length <= 6 && aUna(k, otra)).flatMap(([otra, lista]) => lista.filter(r => !r.aliasDe).map(r => ({ ...r, parecida: true, estado: "parecida", claveDeLaReferencia: otra })));
}
export const decirFuente = (f) => `${f.documento || "un documento anterior"}${f.desde ? ` (${f.desde}${f.hasta && f.hasta !== f.desde ? ` a ${f.hasta}` : ""})` : ""}`;
// Comparar un conjunto de claves vistas (las de una libreta, por ejemplo) contra las referencias: qué coincide, qué no está.
export function compararConReferencias(claves = [], referencias = new Map(), catalogo = new Map()) {
  return [...new Set(claves.map(c => normalizarClave(c).clave).filter(Boolean))].map(k => ({ clave: k, enCatalogo: catalogo.get(k) || null, sugerencias: sugerenciasDe(k, referencias, catalogo) }));
}
