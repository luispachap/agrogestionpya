// ============================================================
//  AgroGestión — Leer papeles sin pagar por leerlos
//
//  El rancho le compra a los mismos veinte proveedores todo el año, y el
//  ticket de la agroveterinaria de agosto tiene el mismo formato que el de
//  julio. Mandarlo a un modelo cada vez es pagar por resolver un problema
//  ya resuelto — y mete variabilidad donde no la había: la misma línea
//  puede leerse distinto dos veces.
//
//  Por eso el orden es de gratis a caro:
//    1. ¿Ya conozco a este emisor?  → se lee con la regla aprendida. Gratis,
//       reproducible, sin señal, y cuando falla FALLA RUIDOSAMENTE.
//    2. ¿No lo conozco?             → ahí sí, la IA (y sólo esa vez).
//    3. ¿Sigo sin saber qué es?     → "por identificar". NO adivina.
//
//  Lo que se aprende es DÓNDE estaba el dato, no cuál era. El mes que entra
//  ese proveedor se lee solo.
//
//  Nada de este archivo toca la pantalla, la red ni el almacenamiento.
//  Sus pruebas están en src/lectura.test.js.
// ============================================================

import { aCentavos, aPesos } from "./calculos.js";

/* ════════════ TEXTO ════════════ */

// Deja el texto comparable: sin acentos, en mayúsculas, sin espacios de más.
// Se usa SOLO para buscar; el valor se saca siempre del texto original.
export function normalizar(t) {
  return String(t == null ? "" : t)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[ \t]+/g, " ")
    .trim();
}

// Parte el texto en renglones numerados, sin los vacíos.
export function renglones(texto) {
  return String(texto || "").split(/\r?\n/)
    .map((t, i) => ({ i, texto: t.trim(), norm: normalizar(t) }))
    .filter(r => r.texto !== "");
}

// Convierte a número lo que viene escrito como en México ("1,234.56", "$ 1 234.56").
// Devuelve null si de plano no hay un número: NO inventa un cero, porque un
// cero se suma y un "no lo encontré" se pregunta.
export function aNumero(s) {
  if (s == null) return null;
  if (typeof s === "number") return isFinite(s) ? s : null;
  let t = String(s).replace(/[$\s]/g, "");
  if (!t) return null;
  const negativo = /^\(.*\)$/.test(t) || t.startsWith("-");
  t = t.replace(/[()\-]/g, "");
  // Formato europeo "1.234,56": la coma es el decimal.
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = parseFloat(t);
  if (!isFinite(n)) return null;
  return negativo ? -n : n;
}

// Todos los números que aparecen en un renglón, con la posición donde empiezan.
export function numerosDe(linea) {
  const res = [];
  const re = /-?\$?\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|-?\$?\s?\d+(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(String(linea || ""))) !== null) {
    const valor = aNumero(m[0]);
    if (valor !== null) res.push({ valor, texto: m[0].trim(), desde: m.index });
  }
  return res;
}

// Fechas en los formatos que de verdad se ven en un papel mexicano.
// Devuelve YYYY-MM-DD, o null si no hay ninguna.
const MESES_TXT = {
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
  JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12,
};
export function aFecha(s) {
  // Número serial de Excel: días desde el 30/12/1899. En un .xlsx una celda de
  // fecha ES un serial y no tiene ambigüedad — al revés que el texto
  // "12/08/2026", que un lector descuidado interpreta a la americana.
  if (typeof s === "number" && isFinite(s) && s > 1000 && s < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(s) * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  const t = normalizar(s);
  if (!t) return null;
  const arma = (y, m, d) => {
    y = Number(y); m = Number(m); d = Number(d);
    if (y < 100) y += 2000;
    if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return null;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  let m;
  if ((m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) return arma(m[1], m[2], m[3]);
  // dd/mm/aaaa — en México el día va primero
  if ((m = t.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/))) return arma(m[3], m[2], m[1]);
  // "12 DE AGOSTO DE 2026" o "12 AGO 2026"
  if ((m = t.match(/(\d{1,2})\s*(?:DE\s*)?([A-Z]{3})[A-Z]*\.?\s*(?:DE\s*)?(\d{2,4})/))) {
    const mes = MESES_TXT[m[2]];
    if (mes) return arma(m[3], mes, m[1]);
  }
  return null;
}

/* ════════════ QUÉ ES ESTE PAPEL ════════════ */

// El folio fiscal de un CFDI. Sale del QR de la factura impresa o del XML.
// NO se saca leyendo el total con OCR: un 3 leído como 8 sale plausible y
// equivocado, y nadie lo revisa. El UUID, en cambio, o está bien o no valida.
const RE_UUID = /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/i;
export const uuidDe = (texto) => (String(texto || "").match(RE_UUID) || [null])[0];

// El QR de una factura del SAT trae la liga de verificación con el folio.
export function uuidDeQR(contenidoQR) {
  const t = String(contenidoQR || "");
  const porParametro = t.match(/[?&](?:id|uuid)=([0-9A-Fa-f-]{36})/);
  if (porParametro) return porParametro[1].toUpperCase();
  const suelto = uuidDe(t);
  return suelto ? suelto.toUpperCase() : null;
}

export const TIPOS_PAPEL = [
  "factura", "ticket", "remision", "estado_cuenta", "horometro", "por identificar",
];

const PISTAS = {
  estado_cuenta: ["ESTADO DE CUENTA", "SALDO ANTERIOR", "SALDO FINAL", "SALDO INICIAL", "MOVIMIENTOS DEL PERIODO"],
  remision: ["REMISION", "NOTA DE REMISION", "NOTA DE VENTA", "VALE DE SALIDA"],
  factura: ["FACTURA", "CFDI", "FOLIO FISCAL", "COMPROBANTE FISCAL"],
  ticket: ["TOTAL", "SUBTOTAL", "IVA", "EFECTIVO", "CAMBIO"],
  horometro: ["HOROMETRO", "HORAS MAQUINA", "HR TOTALES"],
};

// Cascada de barato a caro. Y si duda, NO adivina: devuelve "por identificar"
// y una persona lo resuelve en diez segundos. Diez segundos hoy contra tres
// horas en el cierre.
export function clasificar(texto, { patronesConocidos = [], contenidoQR = null } = {}) {
  const t = normalizar(texto);

  // 1 · Lo más barato y lo que falla ruidosamente: el folio fiscal.
  const uuid = uuidDeQR(contenidoQR) || uuidDe(t);
  if (uuid) return { tipo: "factura", porque: "trae folio fiscal (UUID)", uuid, seguro: true };

  // 2 · ¿Ya conozco a este emisor? Su patrón dice de qué tipo es.
  const patron = identificarEmisor(t, patronesConocidos);
  if (patron) return { tipo: patron.tipo, porque: `ya se conoce a ${patron.emisor}`, emisor: patron.emisor, seguro: true };

  // 3 · Pistas de palabras. Requiere al menos dos, para no clasificar de más.
  const puntos = Object.entries(PISTAS).map(([tipo, palabras]) => ({
    tipo, n: palabras.filter(p => t.includes(p)).length,
  })).sort((a, b) => b.n - a.n);
  if (puntos[0] && puntos[0].n >= 2 && (!puntos[1] || puntos[0].n > puntos[1].n)) {
    return { tipo: puntos[0].tipo, porque: "por las palabras del papel", seguro: false };
  }

  // 4 · No sé qué es. Decirlo es la respuesta correcta.
  return { tipo: "por identificar", porque: "no se reconoció el formato ni el emisor", seguro: false };
}

/* ════════════ RECONOCIMIENTO LOCAL QUE APRENDE ════════════ */

// Un patrón guarda DÓNDE estaba cada dato, nunca cuál era:
//   { emisor, tipo, campos: { total: { ancla, donde, formato } }, aciertos, correcciones }
// "ancla" es el texto fijo del papel (TOTAL, FECHA, IMPORTE); "donde" dice si
// el valor va en el mismo renglón a la derecha, o en el de abajo.

export const DONDE = ["misma-derecha", "misma-izquierda", "renglon-siguiente"];
export const FORMATOS = ["moneda", "numero", "fecha", "texto"];

// ¿A cuál emisor conocido se parece este texto? Se compara por las señas que
// no cambian: el RFC primero, y si no, el nombre.
export function identificarEmisor(texto, patrones) {
  const t = normalizar(texto);
  let mejor = null;
  for (const p of patrones || []) {
    if (!p || !p.emisor) continue;
    let puntos = 0;
    if (p.rfc && t.includes(normalizar(p.rfc))) puntos += 10;
    if (t.includes(normalizar(p.emisor))) puntos += 5;
    for (const s of p.senas || []) if (t.includes(normalizar(s))) puntos += 2;
    if (puntos > 0 && (!mejor || puntos > mejor.puntos)) mejor = { ...p, puntos };
  }
  return mejor;
}

// Dónde empieza el ancla dentro de un renglón, RESPETANDO PALABRAS COMPLETAS.
// Importa más de lo que parece: sin esto, el ancla "TOTAL" casa adentro de
// "SUBTOTAL" — y como el subtotal va arriba en el ticket, el sistema leería
// 23,540.00 creyendo que es el total de 27,306.40. Un error así sale
// plausible y nadie lo revisa.
//
// Se hace a mano en vez de con lookbehind porque los teléfonos viejos del
// rancho pueden traer un navegador que no lo soporta.
function posAncla(norm, ancla) {
  const esLetra = c => c !== undefined && /[A-Z0-9]/.test(c);
  let desde = 0;
  for (;;) {
    const i = norm.indexOf(ancla, desde);
    if (i === -1) return -1;
    const antes = i === 0 ? undefined : norm[i - 1];
    const despues = norm[i + ancla.length];
    if (!esLetra(antes) && !esLetra(despues)) return i;
    desde = i + 1;
  }
}

// Los números candidatos junto a un ancla, ORDENADOS del más cercano al ancla
// hacia afuera. Ese orden es lo que hace posible guardar "cuál" era: en
// "IVA 16%   1,080.00" el ancla IVA tiene dos números a la derecha, y el que
// importa es el segundo. Como el formato del ticket no cambia de un mes a
// otro, esa posición tampoco cambia.
function candidatosJunto(rens, r, pos, ancla, donde, formato) {
  if (donde === "renglon-siguiente") {
    const sig = rens.find(x => x.i > r.i);
    if (!sig) return [];
    return formato === "fecha" ? [{ texto: sig.texto, desde: 0 }] : numerosDe(sig.texto);
  }
  if (donde === "misma-izquierda") {
    // De derecha a izquierda: el más pegado al ancla va primero.
    return numerosDe(r.texto).filter(n => n.desde < pos).reverse();
  }
  // misma-derecha
  if (formato === "fecha") return [{ texto: r.texto.slice(pos + ancla.length), desde: pos }];
  return numerosDe(r.texto).filter(n => n.desde >= pos);
}

// Saca el valor que va junto a un ancla dentro del texto.
function valorJunto(rens, ancla, donde, formato, cual = 0) {
  const a = normalizar(ancla);
  if (!a) return null;
  for (const r of rens) {
    const pos = posAncla(r.norm, a);
    if (pos === -1) continue;
    const candidatos = candidatosJunto(rens, r, pos, a, donde, formato);
    const bruto = candidatos[cual] || candidatos[0];
    if (!bruto) continue;
    if (formato === "fecha") {
      const f = aFecha(bruto.texto);
      if (f) return { valor: f, renglon: r.i, textoCrudo: bruto.texto.trim() };
      continue;
    }
    const n = bruto.valor !== undefined ? bruto.valor : aNumero(bruto.texto);
    if (n === null) continue;
    return {
      valor: formato === "moneda" ? aPesos(aCentavos(n)) : n,
      renglon: r.i, textoCrudo: bruto.texto.trim(),
    };
  }
  return null;
}

// Lee un papel con un patrón ya aprendido. Gratis, sin señal y reproducible.
// Lo que NO encuentra lo deja vacío y lo dice en "faltantes": no inventa un
// campo que no vio.
export function leerConPatron(patron, texto) {
  const rens = renglones(texto);
  const campos = {};
  const faltantes = [];
  for (const [nombre, def] of Object.entries((patron && patron.campos) || {})) {
    const hallado = valorJunto(rens, def.ancla, def.donde, def.formato, def.cual || 0);
    if (hallado) campos[nombre] = { ...hallado, ancla: def.ancla, formato: def.formato };
    else faltantes.push(nombre);
  }
  return {
    emisor: patron?.emisor || null,
    tipo: patron?.tipo || "por identificar",
    campos, faltantes,
    fuente: "patron-local",   // no costó nada y no necesitó señal
  };
}

// APRENDER. Se le da el texto del papel y los valores que una PERSONA
// confirmó, y busca dónde estaba cada uno para poder repetirlo el mes que
// entra. Si un valor no aparece en el texto, ese campo no se aprende — más
// vale no saberlo que aprender mal.
export function aprenderPatron({ patronPrevio, texto, emisor, tipo, rfc, camposConfirmados }) {
  const rens = renglones(texto);
  const campos = { ...((patronPrevio && patronPrevio.campos) || {}) };

  for (const [nombre, valor] of Object.entries(camposConfirmados || {})) {
    if (valor === null || valor === undefined || valor === "") continue;
    const formato = adivinarFormato(nombre, valor);
    const sitio = dondeEsta(rens, valor, formato);
    if (sitio) campos[nombre] = { ancla: sitio.ancla, donde: sitio.donde, cual: sitio.cual, formato };
    // si no se encontró, no se toca: el patrón viejo sigue valiendo
  }

  return {
    id: patronPrevio?.id || null,
    emisor: emisor || patronPrevio?.emisor || "",
    rfc: rfc || patronPrevio?.rfc || "",
    tipo: tipo || patronPrevio?.tipo || "por identificar",
    senas: patronPrevio?.senas || [],
    campos,
    aciertos: patronPrevio?.aciertos || 0,
    correcciones: patronPrevio?.correcciones || 0,
  };
}

function adivinarFormato(nombre, valor) {
  if (/fecha|vencimiento/i.test(nombre)) return "fecha";
  if (/total|importe|monto|precio|subtotal|iva/i.test(nombre)) return "moneda";
  if (typeof valor === "number") return "numero";
  if (aFecha(valor)) return "fecha";
  return aNumero(valor) !== null ? "numero" : "texto";
}

// Busca en qué renglón está el valor y cuál es el texto fijo que lo precede.
// Ese texto fijo es el ancla: es lo que va a seguir ahí el mes que entra.
function dondeEsta(rens, valor, formato) {
  const objetivo = formato === "fecha" ? aFecha(valor) : aNumero(valor);
  if (objetivo === null || objetivo === undefined) return null;

  // Dado un ancla y una colocación, en qué lugar de la fila de candidatos
  // cae el valor confirmado. Guardar ese lugar es lo que permite distinguir
  // el "16" del "16%" del importe del IVA que va junto.
  const cualDe = (r, ancla, donde) => {
    const pos = posAncla(r.norm, normalizar(ancla));
    if (pos === -1) return null;
    const cands = candidatosJunto(rens, r, pos, normalizar(ancla), donde, formato);
    const i = cands.findIndex(c => {
      const v = c.valor !== undefined ? c.valor : aNumero(c.texto);
      return v !== null && Math.abs(v - objetivo) <= 0.005;
    });
    return i === -1 ? null : i;
  };

  for (const r of rens) {
    if (formato === "fecha") {
      if (aFecha(r.texto) !== objetivo) continue;
      const ancla = anclaAntesDe(r.texto, r.texto.search(/\d/));
      if (ancla) return { ancla, donde: "misma-derecha", cual: 0 };
      continue;
    }
    for (const n of numerosDe(r.texto)) {
      if (Math.abs(n.valor - objetivo) > 0.005) continue;
      const ancla = anclaAntesDe(r.texto, n.desde);
      if (ancla) {
        const cual = cualDe(r, ancla, "misma-derecha");
        if (cual !== null) return { ancla, donde: "misma-derecha", cual };
      }
      // El número va al principio: el ancla está a su derecha (ej. "40 BULTOS UREA")
      const derecha = r.texto.slice(n.desde + n.texto.length).trim();
      const palabra = (derecha.match(/^[A-Za-zÁÉÍÓÚÑáéíóúñ]+/) || [null])[0];
      if (palabra) {
        const cual = cualDe(r, palabra, "misma-izquierda");
        if (cual !== null) return { ancla: palabra, donde: "misma-izquierda", cual };
      }
      // Solo el número en el renglón: el ancla es el renglón de arriba
      const arriba = rens.filter(x => x.i < r.i).pop();
      if (arriba && arriba.texto) {
        const cual = cualDe(arriba, arriba.texto.trim(), "renglon-siguiente");
        if (cual !== null) return { ancla: arriba.texto.trim(), donde: "renglon-siguiente", cual };
      }
    }
  }
  return null;
}

function anclaAntesDe(linea, hasta) {
  const izq = String(linea).slice(0, hasta).trim().replace(/[:$\-]+$/, "").trim();
  if (!izq) return null;
  // El ancla son las últimas palabras antes del número, sin números adentro.
  const palabras = izq.split(/\s+/).filter(w => !/\d/.test(w));
  if (palabras.length === 0) return null;
  return palabras.slice(-3).join(" ");
}

/* ════════════ QUÉ TAN COMPLETA SALIÓ LA LECTURA ════════════ */

// Devuelve la COBERTURA, no un porcentaje suelto. "92 %" no le sirve a nadie:
// un 92 calculado sobre la mitad de los campos no es un 92, es un dato
// incompleto disfrazado de certeza. Aquí se dice cuáles faltan, por su nombre.
export function cobertura(campos, requeridos) {
  const req = requeridos || [];
  const leidos = req.filter(k => campos && campos[k] !== undefined && campos[k] !== null);
  const faltan = req.filter(k => !leidos.includes(k));
  return {
    leidos: leidos.length,
    requeridos: req.length,
    faltan,
    completa: faltan.length === 0,
    // Se ofrece la fracción, pero SIEMPRE junto a lo que falta.
    fraccion: req.length === 0 ? null : leidos.length / req.length,
  };
}

// Los criterios en palabras, para que Migue lo juzgue de un vistazo.
// "92 %" no dice nada; "importe exacto + el nombre del proveedor + 3 días de
// diferencia" sí.
export function criteriosCoincidencia(a, b, { toleranciaDias = 5 } = {}) {
  const criterios = [];
  const ca = aCentavos(a?.monto), cb = aCentavos(b?.monto);
  if (ca && cb) {
    if (ca === cb) criterios.push({ ok: true, dice: "importe exacto" });
    else criterios.push({ ok: false, dice: `importes distintos (${aPesos(ca)} contra ${aPesos(cb)})` });
  }
  const na = normalizar(a?.contraparte), nb = normalizar(b?.contraparte);
  if (na && nb) {
    if (na === nb) criterios.push({ ok: true, dice: "mismo nombre" });
    else if (na.includes(nb) || nb.includes(na)) criterios.push({ ok: true, dice: "el nombre aparece en el concepto" });
    else criterios.push({ ok: false, dice: "nombres distintos" });
  }
  if (a?.fecha && b?.fecha) {
    const d = Math.abs(Math.round((new Date(a.fecha + "T00:00:00") - new Date(b.fecha + "T00:00:00")) / 86400000));
    criterios.push({ ok: d <= toleranciaDias, dice: d === 0 ? "mismo día" : `${d} día(s) de diferencia` });
  }
  return {
    criterios,
    // Propone sólo si TODO cuadra. Y aun así, propone: no concilia solo.
    proponer: criterios.length > 0 && criterios.every(c => c.ok),
  };
}

/* ════════════ LA FOTO ════════════ */

// Avisa de la foto borrosa ANTES de gastar en leerla, pero JAMÁS bloquea:
// el comprobante se guarda igual. Nunca se pierde evidencia de un pago —
// esa camisa con el ticket en la bolsa se lava el sábado.
export function evaluarFoto({ nitidez, ancho, alto }) {
  const avisos = [];
  if (nitidez !== null && nitidez !== undefined && nitidez < 60) {
    avisos.push("La foto se ve borrosa. Se guarda igual, pero puede que no se lea bien.");
  }
  if (ancho && alto && Math.min(ancho, alto) < 600) {
    avisos.push("La foto está chica. Acércate un poco y toma otra si puedes.");
  }
  return { avisos, sirveParaLeer: avisos.length === 0, seGuarda: true }; // seGuarda: SIEMPRE
}

/* ════════════ LA MEDIDA QUE IMPORTA ════════════ */

// No cuentes "cuántas propuso": esa medida sube sola con sólo proponer más,
// aunque se proponga mal. Cuenta cuántas SOBREVIVIERON sin que nadie las
// corrigiera.
export function tasaSobrevivencia(lecturas) {
  const revisadas = (lecturas || []).filter(l => l && l.revisada);
  const sobrevivieron = revisadas.filter(l => !l.corregida);
  return {
    propuestas: (lecturas || []).length,
    revisadas: revisadas.length,
    sobrevivieron: sobrevivieron.length,
    corregidas: revisadas.length - sobrevivieron.length,
    sinRevisar: (lecturas || []).length - revisadas.length,
    // Sin revisiones no hay tasa. Un 100 % sobre cero revisiones es una mentira.
    tasa: revisadas.length === 0 ? null : sobrevivieron.length / revisadas.length,
  };
}

/* ════════════ APLICAR LA LECTURA: QUE SE VUELVA EL MOVIMIENTO ════════════ */

// Leer un papel no sirve de nada si se queda en el buzón. Un ticket de
// fertilizante tiene que volverse un EGRESO y una ENTRADA AL INVENTARIO; la
// carátula del horómetro, una LECTURA de esa máquina.
//
// Tres reglas que no se rompen:
//
//  1. NO aplica solo. Arma la propuesta y una persona la confirma. Marcar
//     como gasto del rancho lo que era personal esconde un gasto real;
//     marcar como del rancho la despensa de una casa infla el costo. Las dos
//     duelen, y ninguna se arregla con un sistema seguro de sí mismo.
//  2. Se aplica UNA SOLA VEZ. Dos aplicaciones del mismo ticket duplican el
//     gasto, y un gasto duplicado se descubre tarde y mal.
//  3. Si falta un dato para armar el movimiento, NO lo arma: dice cuál falta.
//     Un egreso sin monto no es un egreso.

// Qué movimiento le toca a cada tipo de papel, y qué necesita para armarlo.
export const APLICACION_POR_TIPO = {
  ticket:    { seccion: "egresos", requiere: ["total", "fecha"], nombre: "un egreso" },
  factura:   { seccion: "egresos", requiere: ["total", "fecha"], nombre: "un egreso" },
  remision:  { seccion: "entradas_inv", requiere: ["fecha"], nombre: "una entrada de almacén" },
  horometro: { seccion: "maquinaria", requiere: ["lectura"], nombre: "una lectura de horómetro" },
  etiqueta_agroquimico: { seccion: "inventario", requiere: ["nombre"], nombre: "una ficha de agroquímico" },
};

// ¿Ya se aplicó? Se pregunta por el registro mismo, no por una lista aparte:
// así no hay forma de que se desincronicen.
export const yaSeAplico = (lectura) => !!(lectura && lectura.aplicado && lectura.aplicado.id);

// Arma la PROPUESTA del movimiento. No lo guarda: eso lo hace la app cuando
// la persona dice que sí.
export function proponerAplicacion(lectura) {
  if (!lectura) return { puede: false, porque: "No hay lectura." };
  if (yaSeAplico(lectura)) {
    return {
      puede: false, yaAplicada: true,
      porque: `Este papel ya se aplicó como ${lectura.aplicado.seccion} el ${(lectura.aplicado.cuando || "").slice(0, 10)}. Aplicarlo otra vez duplicaría el movimiento.`,
    };
  }
  const plan = APLICACION_POR_TIPO[lectura.tipo];
  if (!plan) {
    return {
      puede: false,
      porque: lectura.tipo === "por identificar"
        ? "Todavía no se sabe qué es este papel. Dile de qué se trata y entonces se puede aplicar."
        : `Un papel de tipo "${lectura.tipo}" todavía no se convierte en movimiento por su cuenta.`,
    };
  }
  const campos = lectura.campos || {};
  const faltan = plan.requiere.filter(k => campos[k] === undefined || campos[k] === null || campos[k] === "");
  if (faltan.length > 0) {
    return {
      puede: false, seccion: plan.seccion, faltan,
      porque: `Para hacer ${plan.nombre} falta: ${faltan.join(", ")}. Complétalo arriba y vuelve a intentar.`,
    };
  }
  return { puede: true, seccion: plan.seccion, nombre: plan.nombre, borrador: borradorDe(lectura, plan.seccion) };
}

function borradorDe(lectura, seccion) {
  const c = lectura.campos || {};
  const origen = { origenLectura: lectura.id, origenPapel: lectura.tipo };
  if (seccion === "egresos") {
    return {
      ...origen,
      fecha: c.fecha,
      concepto: c.emisor ? `Compra a ${c.emisor}` : "Compra (del buzón de papeles)",
      proveedor: c.emisor || "",
      monto: aPesos(aCentavos(c.total)),
      categoria: "insumos",
      // La foto ES el comprobante. Va pegada al egreso, no suelta en otro lado.
      ticket: lectura.foto || null,
      uuid: c.uuid || null,
      // Un gasto sin factura NO es un problema a esconder: es un gasto no
      // deducible que hay que registrar como tal. Lo grave no es que exista,
      // es que nadie sepa que existe.
      tieneComprobanteFiscal: !!c.uuid,
    };
  }
  if (seccion === "maquinaria") {
    return { ...origen, lectura: aNumero(c.lectura), fecha: c.fecha || null };
  }
  if (seccion === "inventario") {
    return {
      ...origen,
      nombre: c.nombre, cat: "agroquimico",
      ingredienteActivo: c.ingredienteActivo || null,
      // Reentrada y carencia son SEGURIDAD DE PERSONAS, no un dato más.
      // Si no vienen, se dice: no se supone que sean cero.
      reentradaDias: aNumero(c.reentradaDias),
      carenciaDias: aNumero(c.carenciaDias),
    };
  }
  return { ...origen, fecha: c.fecha, proveedor: c.emisor || "" };
}

// Los renglones del papel, listos para entrar al almacén. Sólo los que traen
// lo necesario; de los otros se dice cuántos quedaron fuera y por qué.
export function renglonesAplicables(lectura) {
  const rs = (lectura?.renglones || []);
  const sirven = rs.filter(r => r && r.concepto && aNumero(r.cantidad) !== null);
  return {
    sirven,
    fuera: rs.length - sirven.length,
    porque: rs.length === sirven.length ? null
      : `${rs.length - sirven.length} renglón(es) no traen cantidad, así que no pueden entrar al almacén solos.`,
  };
}

/* ════════════ QUÉ ENTRÓ AL ALMACÉN, Y A QUÉ COSTO ════════════ */

// El renglón del ticket dice "40 BULTOS UREA 46-00-00 · $23,200". Eso son 40
// bultos que entraron al almacén a $580 cada uno. La app propone el enganche;
// una persona lo confirma.
//
// El emparejamiento devuelve los CRITERIOS en palabras, no un porcentaje.
// "92 %" no le sirve a nadie; "mismo nombre" o "el nombre del ticket contiene
// el del insumo" sí, porque Migue lo juzga de un vistazo.
export function emparejarConInventario(renglon, inventario) {
  const nombre = normalizar(renglon?.concepto);
  if (!nombre) return { hay: false, criterios: [], porque: "El renglón no trae concepto." };

  const candidatos = [];
  for (const it of inventario || []) {
    const n = normalizar(it.nombre);
    if (!n) continue;
    if (n === nombre) { candidatos.push({ it, puntos: 100, dice: "mismo nombre" }); continue; }
    if (nombre.includes(n)) { candidatos.push({ it, puntos: 60, dice: `el renglón contiene "${it.nombre}"` }); continue; }
    if (n.includes(nombre)) { candidatos.push({ it, puntos: 55, dice: `"${it.nombre}" contiene el renglón` }); continue; }
    // Palabras en común de 4 letras o más (UREA, SULFATO, COADYUVANTE).
    const pa = new Set(nombre.split(/[^A-Z0-9]+/).filter(w => w.length >= 4));
    const pb = new Set(n.split(/[^A-Z0-9]+/).filter(w => w.length >= 4));
    const juntas = [...pa].filter(w => pb.has(w));
    if (juntas.length > 0) candidatos.push({ it, puntos: 20 + juntas.length * 10, dice: `coincide en: ${juntas.join(", ")}` });
  }
  candidatos.sort((a, b) => b.puntos - a.puntos);
  if (candidatos.length === 0) {
    return { hay: false, criterios: [], porque: "No hay nada parecido en el almacén. Se puede dar de alta." };
  }
  const mejor = candidatos[0];
  // Dos candidatos igual de buenos: NO elige. Que decida la persona — dos
  // fertilizantes parecidos no son el mismo saco.
  const empate = candidatos[1] && candidatos[1].puntos === mejor.puntos;
  return {
    hay: true, insumo: mejor.it, criterios: [mejor.dice],
    seguro: mejor.puntos >= 100 && !empate,
    empate: !!empate,
    otros: candidatos.slice(1, 4).map(c => c.it),
    porque: empate
      ? `Hay más de un insumo que encaja igual de bien (${[mejor.it.nombre, candidatos[1].it.nombre].join(" y ")}). Elige tú cuál es.`
      : mejor.dice,
  };
}

// Costo unitario que sale del renglón. Si no trae importe o no trae cantidad,
// devuelve null: NO se supone un costo, porque un costo inventado se arrastra
// a todas las salidas del año.
export function costoUnitarioDe(renglon) {
  const cant = aNumero(renglon?.cantidad);
  const imp = aNumero(renglon?.importe);
  if (cant === null || imp === null || cant === 0) return null;
  return aPesos(Math.round(aCentavos(imp) / cant));
}

// Costo promedio ponderado al entrar mercancía nueva.
//
// El caso del catálogo: urea a $580 el bulto en marzo y a $940 en agosto.
// Salen 40 bultos a la parcela 7 — ¿cargó $23,200 o $37,600? Ni uno ni otro:
// carga el promedio de lo que de verdad hay en la bodega.
//
// Si no se sabe el costo de lo que ya había, NO se inventa uno: se dice, y el
// promedio queda marcado como incompleto.
export function costoPromedio({ existencia, costoActual, entra, costoEntrada }) {
  const ex = aNumero(existencia), ca = aNumero(costoActual);
  const en = aNumero(entra), ce = aNumero(costoEntrada);
  if (en === null || ce === null) {
    return { costo: ca, completo: false, porque: "No se sabe a qué costo entró lo nuevo; el promedio se queda como estaba." };
  }
  if (ex === null || ex <= 0) {
    return { costo: ce, completo: true, porque: "No había existencia: el costo es el de esta entrada." };
  }
  if (ca === null || ca <= 0) {
    return {
      costo: ce, completo: false,
      porque: `Había ${ex} en existencia pero sin costo registrado. El promedio se toma sólo de esta entrada, así que está incompleto.`,
    };
  }
  const valor = aCentavos(ca) * ex + aCentavos(ce) * en;
  return {
    costo: aPesos(Math.round(valor / (ex + en))),
    completo: true,
    porque: `Promedio de ${ex} a ${ca} más ${en} a ${ce}.`,
  };
}

/* ════════════ HASTA CUÁNDO NO SE ENTRA Y HASTA CUÁNDO NO SE CORTA ════════════ */

// Reentrada: las horas o días que nadie debe pisar la parcela después de una
// aplicación. Carencia: los días que deben pasar entre la aplicación y el
// corte para que el producto no llegue con residuo al cliente.
//
// **Esto es seguridad de personas, no un dato más.** Por eso la regla aquí es
// más dura que en el resto de la app:
//
//   Si NO se sabe la reentrada de un producto, la respuesta NO es "ya se
//   puede entrar". Es "no sé". Un cero ahí manda gente a una parcela recién
//   aplicada, y eso no se arregla después.
//
// Informa; no bloquea. La app no cierra la parcela ni impide capturar una
// cosecha: enseña la fecha y quién decide es la persona.
export function ventanasDeSeguridad({ aplicaciones, inventario, hoy }) {
  const dia = hoy || null;
  const porInsumo = new Map((inventario || []).map(i => [i.id, i]));
  const filas = [];

  for (const ap of aplicaciones || []) {
    if (!ap || !ap.fecha || !ap.parcelaId) continue;
    for (const pr of ap.productos || []) {
      const insumo = porInsumo.get(pr.insumoId);
      const nombre = insumo?.nombre || pr.nombre || "un producto";
      const re = aNumero(insumo?.reentradaDias);
      const ca = aNumero(insumo?.carenciaDias);
      filas.push({
        parcelaId: ap.parcelaId, aplicacionId: ap.id, fecha: ap.fecha, producto: nombre,
        // null NO es cero: es "no se capturó".
        reentradaDias: re, carenciaDias: ca,
        entrarDesde: re === null ? null : sumarDiasSimple(ap.fecha, re),
        cortarDesde: ca === null ? null : sumarDiasSimple(ap.fecha, ca),
      });
    }
  }

  const evaluar = (f) => {
    const entrada = f.entrarDesde === null
      ? { estado: "no se sabe", dice: `De "${f.producto}" no se capturó el tiempo de reentrada. NO quiere decir que ya se pueda entrar: quiere decir que no se sabe. Búscalo en la etiqueta.` }
      : (dia && dia < f.entrarDesde)
        ? { estado: "no entrar", dice: `No entrar a la parcela hasta el ${f.entrarDesde} (por "${f.producto}", aplicado el ${f.fecha}).` }
        : { estado: "libre", dice: `Se puede entrar desde el ${f.entrarDesde}.` };
    const corte = f.cortarDesde === null
      ? { estado: "no se sabe", dice: `De "${f.producto}" no se capturó la carencia al corte. No se puede decir que ya se pueda cortar.` }
      : (dia && dia < f.cortarDesde)
        ? { estado: "no cortar", dice: `No cortar hasta el ${f.cortarDesde} (por "${f.producto}", aplicado el ${f.fecha}).` }
        : { estado: "libre", dice: `Se puede cortar desde el ${f.cortarDesde}.` };
    return { ...f, entrada, corte };
  };

  const evaluadas = filas.map(evaluar);
  return {
    filas: evaluadas,
    // Lo que hay que enseñar arriba: lo que bloquea y lo que no se sabe. Se
    // separan a propósito — "no sé" no es una alarma de peligro, es una
    // alarma de dato faltante, y confundirlas enseña a ignorar las dos.
    noEntrar: evaluadas.filter(f => f.entrada.estado === "no entrar"),
    noCortar: evaluadas.filter(f => f.corte.estado === "no cortar"),
    sinDato: evaluadas.filter(f => f.entrada.estado === "no se sabe" || f.corte.estado === "no se sabe"),
  };
}

// Suma días a una fecha AAAA-MM-DD por calendario local, sin depender de
// calculos.js para no cruzar los módulos.
function sumarDiasSimple(fecha, dias) {
  const d = new Date(String(fecha).slice(0, 10) + "T00:00:00");
  d.setDate(d.getDate() + (parseInt(dias, 10) || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
