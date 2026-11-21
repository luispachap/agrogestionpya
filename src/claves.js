// ============================================================
//  AgroGestión — Las claves de las rayas (puro, sin React ni red)
//
//  En las libretas del rancho cada renglón trae códigos cortos: «A07 · Bod»,
//  «A27 · SF4». Unos dicen QUÉ se hizo (actividad) y otros DÓNDE (ubicación).
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
export const CLASES_DE_CLAVE = { actividad: "Actividad (qué se hizo)", ubicacion: "Ubicación (dónde)", nota: "Una anotación, no una clave", ignorar: "No significa nada: ignorarla" };

const sinAcentos = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");

// De como viene escrita a como se guarda. A mano, «A07» sale «Ao7», «A O7» o «A7»: es la MISMA clave. El original no se pierde.
export function normalizarClave(texto) {
  const original = String(texto ?? "").replace(/\s+/g, " ").trim();
  let c = sinAcentos(original).toUpperCase().replace(/[\s.\-_/]+/g, "");
  // Clave de actividad: A + uno o dos dígitos (una «O» escrita a mano es un cero; una «I» o «L», un uno).
  const act = /^A([0-9OIL]{1,2})$/.exec(c);
  if (act) { const n = act[1].replace(/O/g, "0").replace(/[IL]/g, "1"); c = `A${n.padStart(2, "0")}`; }
  const sf = /^SF([0-9OIL])$/.exec(c);
  if (sf) c = `SF${sf[1].replace(/O/g, "0").replace(/[IL]/g, "1")}`;
  return { clave: c, original, ajustada: !!c && c !== sinAcentos(original).toUpperCase() };
}

// Lo que la FORMA de la clave ya dice, sin saber su significado. null = no se sabe qué clase de cosa es.
export function formaDe(clave) {
  if (/^A\d{2}$/.test(clave)) return "actividad";
  if (/^SF\d$/.test(clave) || clave === "BOD") return "ubicacion";
  return null;
}

// Lo que el rancho ya dijo (Luis, 20 nov 2026). Se puede corregir como cualquier otra equivalencia.
export const CLAVES_DICHAS = [
  { clave: "BOD", clase: "ubicacion", significado: "Bodega" },
  { clave: "SF1", clase: "ubicacion", significado: "San Felipe 1" },
  { clave: "SF2", clase: "ubicacion", significado: "San Felipe 2" },
  { clave: "SF3", clase: "ubicacion", significado: "San Felipe 3" },
  { clave: "SF4", clase: "ubicacion", significado: "San Felipe 4" },
];

// El catálogo vigente: lo dicho de arranque + lo aprendido (lo más reciente manda; lo anterior se conserva).
export function catalogoDeClaves(eventos = []) {
  const m = new Map();
  for (const c of CLAVES_DICHAS) m.set(c.clave, { ...c, deArranque: true, quien: "", fecha: "", anteriores: [] });
  const ev = vigentes(eventos).filter(e => e.tipo === T_CLAVE).sort((a, b) => String(a.cuando).localeCompare(String(b.cuando)));
  for (const e of ev) {
    const d = e.datos || {}, previo = m.get(d.clave);
    const anteriores = previo ? [...previo.anteriores, { clase: previo.clase, significado: previo.significado, quien: previo.quien, fecha: previo.fecha, deArranque: !!previo.deArranque }] : [];
    m.set(d.clave, { clave: d.clave, clase: d.clase, significado: d.significado || "", original: d.original || d.clave, quien: e.quien?.nombre || "", fecha: e.fecha || "", evento: e.id, docId: d.docId || null, anteriores });
  }
  return m;
}
export const listaDeClaves = (catalogo) => [...catalogo.values()].sort((a, b) => a.clase.localeCompare(b.clase) || a.clave.localeCompare(b.clave, "es", { numeric: true }));

// Guardar (o corregir) una equivalencia. Devuelve { ok, evento } o { ok:false, dice }.
export function aprenderClave({ catalogo, clave: escrita, clase, significado = "", docId = null, quien, cuando, fecha, azar }) {
  const { clave, original } = normalizarClave(escrita), que = String(significado || "").replace(/\s+/g, " ").trim();
  if (!clave) return { ok: false, dice: "Falta la clave." };
  if (clave.length > 12) return { ok: false, dice: "Eso no parece una clave: es muy largo." };
  if (!CLASES_DE_CLAVE[clase]) return { ok: false, dice: `Falta decir si «${original}» es una actividad o una ubicación.` };
  const forma = formaDe(clave);
  if (forma && ["actividad", "ubicacion"].includes(clase) && clase !== forma)
    return { ok: false, dice: forma === "actividad" ? `«${clave}» es una clave de actividad (empieza con A y un número): no se guarda como ubicación.` : `«${clave}» es una clave de ubicación: no se guarda como actividad.` };
  if (["actividad", "ubicacion"].includes(clase) && que.length < 2) return { ok: false, dice: `Falta decir qué significa «${clave}».` };
  // Dos claves distintas de la misma clase con el mismo significado casi siempre es un error de dedo: se avisa, no se impide.
  const gemela = [...(catalogo?.values() || [])].find(c => c.clave !== clave && c.clase === clase && que && sinAcentos(c.significado).toUpperCase() === sinAcentos(que).toUpperCase());
  const previo = catalogo?.get(clave);
  if (previo && previo.clase === clase && previo.significado === que) return { ok: false, igual: true, dice: `«${clave}» ya estaba guardada así.` };
  return { ok: true, corrige: !!previo, aviso: gemela ? `Ojo: «${gemela.clave}» ya significa «${gemela.significado}». Si son la misma, corrige una.` : "",
    evento: nuevoEvento({ tipo: T_CLAVE, cuando, fecha, quien, azar, datos: { clave, original, clase, significado: que, ...(docId ? { docId } : {}) } }) };
}

// Parte una celda con varias claves («A07 | Bod», «A07 Bod», «A07, Bod»).
export const partirClaves = (celda) => { const t = String(celda ?? ""); return (t.includes("|") ? t.split("|") : t.split(/[,;\s]+/)).map(s => s.trim()).filter(Boolean); };

// Cada código de un renglón, con lo que se sabe de él.
export function leerClaves(escritas = [], catalogo = new Map()) {
  return (escritas || []).map(x => {
    const { clave, original, ajustada } = normalizarClave(x), sabida = catalogo.get(clave), forma = formaDe(clave);
    const clase = sabida?.clase || forma || null;
    return { original, clave, ajustada, clase, significado: sabida?.significado || "", conocida: !!sabida,
      falta: sabida ? null : forma ? "significado" : "todo" };
  }).filter(c => c.clave);
}

// Un renglón de raya → la relación trabajador · fecha · actividad · ubicación, con sus dudas. No decide nada: describe.
export function relacionDeRenglon({ nombre = "", fecha = null, claves = [], observacion = "" }, catalogo = new Map()) {
  const leidas = leerClaves(claves, catalogo).filter(c => c.clase !== "ignorar");
  const act = leidas.filter(c => c.clase === "actividad"), ubi = leidas.filter(c => c.clase === "ubicacion"), notas = leidas.filter(c => c.clase === "nota"), raras = leidas.filter(c => !c.clase);
  const dudas = [];
  if (!fecha) dudas.push("No se sabe de qué día es.");
  if (act.length > 1) dudas.push(`Trae ${act.length} claves de actividad (${act.map(c => c.clave).join(", ")}): no se escoge una.`);
  if (ubi.length > 1) dudas.push(`Trae ${ubi.length} claves de ubicación (${ubi.map(c => c.clave).join(", ")}): no se escoge una.`);
  for (const c of act.filter(c => !c.conocida)) dudas.push(`Falta decir qué actividad es «${c.clave}».`);
  for (const c of ubi.filter(c => !c.conocida)) dudas.push(`Falta decir qué lugar es «${c.clave}».`);
  for (const c of raras) dudas.push(`No se sabe qué es «${c.original}» (¿actividad, ubicación o una anotación?).`);
  const sinTrabajo = act.length === 0 && ubi.length === 0;
  if (sinTrabajo && !observacion && raras.length === 0) dudas.push("No trae ninguna clave.");
  else if (!sinTrabajo && act.length === 0) dudas.push("No trae clave de actividad.");
  else if (!sinTrabajo && ubi.length === 0) dudas.push("No trae clave de ubicación.");
  return { nombre, fecha, actividad: act.length === 1 ? act[0] : null, ubicacion: ubi.length === 1 ? ubi[0] : null, claves: leidas, notas: notas.map(c => c.significado || c.original), observacion,
    dudas, completa: !!nombre && !!fecha && act.length === 1 && ubi.length === 1 && act[0].conocida && ubi[0].conocida && raras.length === 0 };
}

// Cómo se enseña una clave: su significado si se sabe; si no, el código tal cual.
export const decirClave = (c) => (!c ? "" : c.conocida ? `${c.significado} (${c.clave})` : c.clase ? `${c.clave}: falta decir qué ${c.clase === "actividad" ? "actividad" : "lugar"} es` : `«${c.original}»: no se sabe qué es`);
export function decirRelacion(rel) {
  return [rel.actividad ? decirClave(rel.actividad) : "", rel.ubicacion ? decirClave(rel.ubicacion) : "", ...rel.claves.filter(c => c !== rel.actividad && c !== rel.ubicacion && c.clase !== "nota").map(decirClave), ...rel.notas, rel.observacion].filter(Boolean).join(" · ");
}

// Lo que hay que preguntar: cada clave sin registrar UNA vez, con cuántas veces sale y un ejemplo. Primero las que más salen.
export function clavesPorPreguntar(renglones = [], catalogo = new Map()) {
  const m = new Map();
  for (const r of renglones) for (const c of leerClaves(r.claves || [], catalogo)) {
    if (c.conocida) continue;
    const x = m.get(c.clave) || { clave: c.clave, original: c.original, clase: c.clase, falta: c.falta, veces: 0, escritas: new Set(), ejemplo: "" };
    x.veces++; x.escritas.add(c.original); if (!x.ejemplo) x.ejemplo = [r.fecha, r.nombre, (r.claves || []).join(" · ")].filter(Boolean).join(" — ");
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
