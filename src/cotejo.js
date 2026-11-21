// ============================================================
//  AgroGestión — Cotejar dos fuentes del mismo trabajo (puro)
//
//  Un mismo día puede llegar por dos papeles: la foto de la libreta y la hoja
//  del Excel. Eso NO es el doble de trabajo: son dos testigos. Este módulo los
//  pone lado a lado y dice qué coincide, qué difiere y qué trae cada uno que el
//  otro no. No corrige a ninguno, no escoge un ganador y no junta personas por
//  su cuenta: «Chon» y un nombre completo son la misma persona sólo si alguien
//  lo confirma; aquí salen como «posible», con el porqué.
// ============================================================
import { relacionDeRenglon, canonica, compatibles, normalizarClave } from "./claves.js";

const plano = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
// Clasificaciones que el Excel 2024 separaba y otros papeles no (Luis, 21 nov 2026): se dicen, no cuentan como choque.
export const FAMILIA_DE_CULTIVO = { PAJ: "AJO", PFR: "FRI", AJOPOSTCOSECHA: "AJO", AJOMORADO: "AJO" };
const familia = (c) => { const k = normalizarClave(c || "").clave; return FAMILIA_DE_CULTIVO[k] || k; };
const diaDe = (f) => (f ? ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][new Date(`${f}T12:00:00Z`).getUTCDay()] : "");

// Qué documentos traen rayas de cada día. `varias` = los días que llegaron por más de una fuente.
export function fuentesPorDia(historico = []) {
  const m = new Map();
  for (const h of historico) { if (h.clase !== "raya" || !h.fecha) continue; const d = m.get(h.fecha) || new Map(); const doc = h.documento || "otro documento"; d.set(doc, [...(d.get(doc) || []), h]); m.set(h.fecha, d); }
  const dias = [...m.entries()].map(([fecha, d]) => ({ fecha, dia: diaDe(fecha), fuentes: [...d.entries()].map(([documento, renglones]) => ({ documento, renglones })) })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { dias, varias: dias.filter(x => x.fuentes.length > 1) };
}
// Para CONTAR un día (personas, actividades) se usa UNA sola fuente; las demás quedan como evidencia. Se prefiere la que
// trae más renglones con actividad y lugar identificados; en empate, la primera que se incorporó. Devuelve cuál y por qué.
export function unaFuentePorDia(historico = [], catalogo = new Map()) {
  return fuentesPorDia(historico).dias.map(d => {
    const con = d.fuentes.map(f => ({ ...f, completos: f.renglones.filter(r => { const x = relacionDeRenglon(aRenglon(r), catalogo); return x.actividad && x.ubicacion; }).length }));
    const mejor = [...con].sort((a, b) => b.completos - a.completos || b.renglones.length - a.renglones.length)[0];
    return { fecha: d.fecha, cuenta: mejor.documento, renglones: mejor.renglones, deEvidencia: con.filter(f => f !== mejor).map(f => f.documento) };
  });
}
const aRenglon = (r) => ({ nombre: r.nombre ?? r.contraparte ?? "", fecha: r.fecha || null, claves: r.claves || [], cultivo: r.cultivo ?? r.cultivoEscrito ?? "", observacion: r.observacion || "", importeTentativo: r.importeTentativo || null, escrito: r.escrito || null });

// ¿Podrían ser la misma persona? Sólo pistas: una palabra del nombre corto dentro del largo, o el mismo arranque (apodo).
function parecidoDeNombres(corto, largo) {
  const a = plano(corto).split(" ").filter(t => t.length >= 3 && !["DON", "DONA", "EL", "LA"].includes(t)), b = plano(largo).split(" ");
  for (const t of a) { if (b.includes(t)) return "misma palabra"; if (t.length >= 4 && b.some(x => x.length >= 4 && (x.startsWith(t.slice(0, 4)) || t.startsWith(x.slice(0, 4))))) return "empieza igual"; if (t.length >= 4 && b.some(x => x.includes(t))) return "va dentro del nombre"; }
  return null;
}

// Lo que la app todavía no tiene en su catálogo no se pierde al cotejar: si el papel decía en qué columna iba (el Excel
// trae «ubicación» y «cultivo» en su propia columna), se compara por lo escrito, sin darle significado.
// Si el propio archivo decía que ese nombre era otra forma de escribir un código suyo («EL 51» = R51), se usa el código.
const porReferencia = (k, referencias, catalogo) => { const a = (referencias?.get?.(k) || []).find(r => r.aliasDe && r.clase === "ubicacion"); if (!a) return k; const destino = canonica(a.aliasDe, catalogo);
  return (catalogo.get(destino)?.puedeSer || []).includes(k) ? k : destino; };   // «Bodega ajos» no se funde en «Bod»: hoy Bod puede ser dos lugares
const lugarDe = (r, x, referencias, catalogo) => x.ubicacion?.clave || (r.escrito?.ubicacion && r.claves?.[1] ? porReferencia(normalizarClave(r.claves[1]).clave, referencias, catalogo) : null);
const cultivoDe = (r, x) => x.cultivo?.clave || (r.cultivo ? normalizarClave(r.cultivo).clave : null) || null;

// Cotejar dos listas de renglones (cada una de una fuente). `a` y `b`: { nombre, renglones }.
export function cotejar(a, b, catalogo = new Map(), referencias = new Map()) {
  const A = (a.renglones || []).map(aRenglon), B = (b.renglones || []).map(aRenglon);
  const rel = (r) => relacionDeRenglon(r, catalogo);
  const cuenta = (lista, de) => { const m = new Map(); for (const r of lista) { const k = de(rel(r), r); if (k) m.set(k, (m.get(k) || 0) + 1); } return m; };
  const lado = (ma, mb) => [...new Set([...ma.keys(), ...mb.keys()])].sort().map(k => ({ clave: k, enA: ma.get(k) || 0, enB: mb.get(k) || 0 }));
  const actividades = lado(cuenta(A, x => x.actividad?.clave), cuenta(B, x => x.actividad?.clave)).map(x => ({ ...x, estado: x.enA && x.enB ? (x.enA === x.enB ? "coincide" : "en las dos, distinta cantidad") : x.enA ? "sólo en A" : "sólo en B" }));
  // Lugares: «Bod» puede ser «Bodega ajos» o «Pre ajos»: se juntan para comparar y se dice que no se distingue.
  const lugar = (x, r) => lugarDe(r, x, referencias, catalogo);
  const ua = cuenta(A, lugar), ub = cuenta(B, lugar), usadas = new Set(), ubicaciones = [];
  for (const [k, n] of ua) { const pares = [...ub.keys()].filter(o => !usadas.has(o) && compatibles(k, o, catalogo) !== "distinta"); pares.forEach(o => usadas.add(o));
    const enB = pares.reduce((s, o) => s + ub.get(o), 0), como = pares.some(o => compatibles(k, o, catalogo) === "puede_ser") ? "puede_ser" : "igual";
    ubicaciones.push({ clave: k, enA: n, enB, conB: pares, estado: !pares.length ? "sólo en A" : como === "puede_ser" ? "compatible: un papel no dice cuál" : n === enB ? "coincide" : "en las dos, distinta cantidad" }); }
  for (const [o, n] of ub) if (!usadas.has(o)) ubicaciones.push({ clave: o, enA: 0, enB: n, conB: [o], estado: "sólo en B" });
  const fam = (x, r) => { const c = cultivoDe(r, x); return c ? familia(c) : null; };
  const ca = cuenta(A, fam), cb = cuenta(B, fam);
  const crudoB = cuenta(B, (x, r) => cultivoDe(r, x)), crudoA = cuenta(A, (x, r) => cultivoDe(r, x));
  const cultivos = lado(ca, cb).map(x => ({ ...x, escritoEnA: [...crudoA.keys()].filter(k => familia(k) === x.clave), escritoEnB: [...crudoB.keys()].filter(k => familia(k) === x.clave) }))
    .map(x => ({ ...x, estado: x.enA && x.enB ? (x.escritoEnA.join() !== x.escritoEnB.join() ? "mismo cultivo, clasificado distinto" : "coincide") : x.enA ? "sólo en A" : "sólo en B" }));
  // Personas: sólo posibles parejas, y sólo cuando la pista apunta a UNA persona del otro lado.
  const posibles = [], sinPareja = [], ambiguas = [], tomadas = new Set();
  for (const r of A) {
    const cand = B.map((x, i) => ({ i, x, por: parecidoDeNombres(r.nombre, x.nombre) })).filter(c => c.por && !tomadas.has(c.i));
    if (cand.length === 1) { tomadas.add(cand[0].i); const ra = rel(r), rb = rel(cand[0].x);
      posibles.push({ a: r.nombre, b: cand[0].x.nombre, por: cand[0].por,
        actividad: !ra.actividad || !rb.actividad ? "falta en una" : ra.actividad.clave === rb.actividad.clave ? "igual" : "distinta",
        ubicacion: ((la, lb) => !la || !lb ? "falta en una" : { igual: "igual", puede_ser: "compatible", distinta: "distinta" }[compatibles(la, lb, catalogo)])(lugar(ra, r), lugar(rb, cand[0].x)),
        cultivo: ((ka, kb) => !ka || !kb ? "falta en una" : ka === kb ? "igual" : familia(ka) === familia(kb) ? "mismo, clasificado distinto" : "escrito distinto")(cultivoDe(r, ra), cultivoDe(cand[0].x, rb)) }); }
    else (cand.length ? ambiguas : sinPareja).push(r.nombre);
  }
  const fechasA = [...new Set(A.map(r => r.fecha).filter(Boolean))], fechasB = [...new Set(B.map(r => r.fecha).filter(Boolean))];
  const discrepancias = [];
  if (fechasA.join() !== fechasB.join()) discrepancias.push(`Las fechas no son las mismas: «${a.nombre}» es de ${fechasA.map(f => `${diaDe(f)} ${f}`).join(", ") || "sin fecha"} y «${b.nombre}» de ${fechasB.map(f => `${diaDe(f)} ${f}`).join(", ") || "sin fecha"}. Se conserva cada fecha como viene; lo que sigue compara días distintos.`);
  const aporta = (L) => ({ renglones: L.length, conImporteTentativo: L.filter(r => r.importeTentativo).length, faltas: L.filter(r => /falta/i.test(r.observacion) || (r.claves || []).some(c => /^F[AN]J$/.test(normalizarClave(c).clave))).length,
    conCultivo: L.filter(r => r.cultivo).length, conTextoDeActividad: L.filter(r => r.escrito?.actividad && r.escrito.actividad.trim().includes(" ")).length, nombresCompletos: L.filter(r => plano(r.nombre).split(" ").length >= 3).length,
    sinEntender: L.filter(r => rel(r).dudas.some(d => /No se sabe qué es|no se sabe qué es/.test(d))).length });
  return { a: a.nombre, b: b.nombre, discrepancias, actividades, ubicaciones, cultivos, personas: { posibles, sinParejaEnA: sinPareja, ambiguas, sinParejaEnB: B.filter((_, i) => !tomadas.has(i)).map(x => x.nombre) }, aporta: { a: aporta(A), b: aporta(B) } };
}
