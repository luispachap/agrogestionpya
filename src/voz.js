// ============================================================
//  AgroGestión — Hablarle a la app
//
//  Gera anda en la troca entre parcelas. No va a teclear un formulario de
//  ocho campos con las manos llenas de tierra, y si la app se lo exige, la
//  respuesta no es que capture mejor: es que no capture.
//
//  Aquí puede decir, a viva voz y como se dice de verdad:
//
//    «Hoy en San Felipe 1 anduvieron Juan, Pedro y el Chato regando desde las
//     siete. Se compraron doscientos litros de diésel en la gasolinera de la
//     entrada, tres mil ochocientos pesos. Y hace falta un filtro para el
//     tractor 3, ya está sonando feo.»
//
//  Y de ahí salen TRES movimientos distintos: una actividad con tres
//  trabajadores, un gasto, y una necesidad que se le manda a quien compra.
//
//  ─────────────────────────────────────────────────────────────
//  CÓMO SE TRANSCRIBE, DE GRATIS A CARO
//  ─────────────────────────────────────────────────────────────
//  1. El dictado que ya trae el teléfono (`SpeechRecognition`). Gratis, y en
//     Android funciona sin señal. Es el camino normal.
//  2. Si el teléfono no lo trae, se graba el audio y se manda a la Edge
//     Function. Cuesta, y necesita señal — se dice, no se esconde.
//  3. Y siempre queda escribir el texto a mano y clasificarlo igual.
//
//  ─────────────────────────────────────────────────────────────
//  LO QUE NO HACE
//  ─────────────────────────────────────────────────────────────
//  · NO guarda nada solo. Entiende, propone, y espera el sí. Un sistema que
//    registra la nómina de tres personas porque creyó oír un nombre hace más
//    daño que uno que no entiende nada.
//  · NO inventa a quién se refiere. Si dice "el Chato" y hay dos Chatos, los
//    enseña los dos y que la persona elija.
//  · NO tira lo que no entendió. Lo que no cupo en ningún movimiento se
//    guarda como nota, con el audio, para que nadie pierda lo que dijo.
//
//  Sus pruebas están en src/voz.test.js.
// ============================================================

import { normalizar, aNumero, aFecha } from "./lectura.js";
import { fechaLocal, sumarDinero } from "./calculos.js";

/* ════════════ NÚMEROS DICHOS CON LA BOCA ════════════ */

// "tres mil ochocientos" → 3800. El dictado del teléfono a veces entrega los
// números en letra, y un gasto que quedó en null porque decía "tres mil" es
// un gasto perdido.
const UNIDADES = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27,
  veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50,
  sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100,
  doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500,
  seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
};

export function numeroDicho(texto) {
  const t = normalizar(texto).toLowerCase().replace(/[.,]/g, "");
  const palabras = t.split(/\s+/).filter(Boolean);
  let total = 0, parcial = 0, hubo = false;
  for (const p of palabras) {
    if (p === "y") continue;
    if (p === "mil") { parcial = (parcial === 0 ? 1 : parcial) * 1000; total += parcial; parcial = 0; hubo = true; continue; }
    if (p === "millon" || p === "millones") { parcial = (parcial === 0 ? 1 : parcial) * 1000000; total += parcial; parcial = 0; hubo = true; continue; }
    if (UNIDADES[p] !== undefined) { parcial += UNIDADES[p]; hubo = true; continue; }
    // Un dígito suelto también cuenta ("doscientos 50").
    const n = aNumero(p);
    if (n !== null) { parcial += n; hubo = true; continue; }
  }
  if (!hubo) return null;
  return total + parcial;
}

// Todos los números de una frase, vengan en cifra o en letra, con lo que
// dicen a su lado (pesos, litros, cajas, hectáreas).
const UNIDADES_MEDIDA = ["litros", "litro", "kilos", "kilo", "kg", "cajas", "caja", "bultos", "bulto",
  "hectareas", "hectarea", "has", "ha", "toneladas", "tonelada", "pesos", "peso", "horas", "hora", "costales", "costal",
  // Con qué se mide el avance en el campo, y cuánta gente anduvo (un número de personas no es una lista de nombres).
  "reguladores", "regulador", "camas", "cama", "surcos", "surco", "hilos", "hilo", "melgas", "melga", "tablas", "tabla", "piezas", "pieza", "tareas", "tarea", "personas", "persona", "gentes", "gente"];
export const UNIDADES_DE_AVANCE_DICHAS = ["reguladores", "regulador", "camas", "cama", "surcos", "surco", "hilos", "hilo", "melgas", "melga", "tablas", "tabla", "piezas", "pieza", "tareas", "tarea", "hectareas", "hectarea", "has", "ha", "cajas", "caja", "toneladas", "tonelada"];

export function numerosDichos(texto) {
  const t = normalizar(texto).toLowerCase();
  const palabras = t.split(/\s+/);
  const res = [];
  let buffer = [];
  const cerrar = (unidad) => {
    if (buffer.length === 0) return;
    const v = numeroDicho(buffer.join(" "));
    if (v !== null) res.push({ valor: v, unidad: unidad || null, dicho: buffer.join(" ") });
    buffer = [];
  };
  for (const p of palabras) {
    const limpio = p.replace(/[^a-z0-9]/g, "");
    if (UNIDADES[limpio] !== undefined || limpio === "mil" || limpio === "y" || aNumero(limpio) !== null || limpio === "millon" || limpio === "millones") {
      if (limpio !== "y" || buffer.length > 0) buffer.push(limpio);
      continue;
    }
    if (UNIDADES_MEDIDA.includes(limpio)) { cerrar(limpio); continue; }
    cerrar(null);
  }
  cerrar(null);
  return res;
}

/* ════════════ A QUIÉN SE REFIERE ════════════ */

// Encuentra a las personas que se nombraron. Compara por nombre y por apodo,
// sin acentos.
//
// Si hay dos que encajan igual de bien, NO elige: los devuelve los dos. Dos
// personas con el mismo apodo no son la misma persona, y meterle un día de
// trabajo al que no fue es un problema de nómina y de confianza.
export function aQuienesSeRefiere(texto, personas) {
  const t = normalizar(texto);
  const hallados = [];
  const ambiguos = [];

  const candidatos = (persona) => {
    const nombres = [persona.nombre, persona.apodo, persona.alias].filter(Boolean);
    // También el primer nombre y el primer apellido por separado.
    for (const n of [...nombres]) {
      const partes = String(n).trim().split(/\s+/);
      if (partes.length > 1) nombres.push(partes[0], partes[partes.length - 1]);
    }
    return [...new Set(nombres.map(normalizar))].filter(n => n.length >= 3);
  };

  const porNombre = new Map();
  for (const p of personas || []) {
    for (const n of candidatos(p)) {
      if (!palabraCompleta(t, n)) continue;
      if (!porNombre.has(n)) porNombre.set(n, []);
      porNombre.get(n).push(p);
    }
  }
  for (const [nombre, gente] of porNombre) {
    if (gente.length === 1) {
      if (!hallados.some(h => h.id === gente[0].id)) hallados.push(gente[0]);
    } else {
      ambiguos.push({ dijo: nombre, candidatos: gente });
    }
  }
  return {
    personas: hallados,
    ambiguos,
    porque: ambiguos.length > 0
      ? `Dijo "${ambiguos.map(a => a.dijo).join('", "')}" y hay más de una persona con ese nombre. Elige tú cuál: meterle un día de trabajo al que no fue es un problema de nómina y de confianza.`
      : hallados.length > 0 ? `Se entendió: ${hallados.map(p => p.nombre).join(", ")}.` : "No se reconoció ningún nombre de la lista.",
  };
}

function palabraCompleta(texto, palabra) {
  const i = texto.indexOf(palabra);
  if (i === -1) return false;
  const antes = i === 0 ? " " : texto[i - 1];
  const despues = texto[i + palabra.length] ?? " ";
  return !/[A-Z0-9]/.test(antes) && !/[A-Z0-9]/.test(despues);
}

/* ════════════ DE QUÉ PARCELA HABLA ════════════ */

// En el rancho nadie dice el nombre completo del catalogo. La parcela se llama
// "El 53" y Gera dice "se van a LA 53". Por eso tambien se busca el nombre sin
// su articulo — pero con un cuidado: si lo que queda es SOLO un numero, ese
// numero suelto se confunde con una cantidad ("se compraron 53 sacos"), y
// asignarle el trabajo a la parcela equivocada es peor que no reconocerla.
// Asi que un nombre que es puro numero solo cuenta cuando viene precedido de
// "la", "el", "parcela" o "lote" — que es como se dice de verdad.
const SIN_ARTICULO = /^(?:EL|LA|LOS|LAS)\s+/;

function nombraLaParcela(t, nombre) {
  const n = normalizar(nombre);
  if (palabraCompleta(t, n)) return true;
  const pelon = n.replace(SIN_ARTICULO, "").trim();
  if (!pelon || pelon === n) return false;
  if (!palabraCompleta(t, pelon)) return false;
  // Si lo que quedó es puro número, exigir la palabra que lo vuelve parcela.
  // Se busca a mano en vez de armar una expresión regular con el número
  // adentro: meter texto dentro de un patrón es cómo se cuelan los errores de
  // escape, y aquí un patrón mal armado no truena — deja de reconocer la
  // parcela y nadie se entera.
  if (/^[0-9]+$/.test(pelon)) {
    const antesDeParcela = ["LA", "EL", "PARCELA", "LOTE", "CUADRO"];
    return antesDeParcela.some(w => palabraCompleta(t, `${w} ${pelon}`));
  }
  return true;
}

export function deQueParcela(texto, parcelas) {
  const t = normalizar(texto);
  const encontradas = (parcelas || []).filter(p => p.nombre && nombraLaParcela(t, p.nombre));
  return {
    parcelas: encontradas,
    // Si nombró dos, no elige: puede que de verdad haya hablado de las dos.
    seguro: encontradas.length === 1,
    porque: encontradas.length === 0
      ? "No se nombró ninguna parcela conocida."
      : encontradas.length === 1 ? `Se entendió: ${encontradas[0].nombre}.`
      : `Se nombraron varias: ${encontradas.map(p => p.nombre).join(", ")}. Puede que de verdad haya hablado de todas — dilo tú.`,
  };
}

/* ════════════ QUÉ QUISO DECIR ════════════ */

export const TIPOS_DICHO = ["actividad", "gasto", "necesidad", "incidencia", "cosecha", "avance", "nota"];

const SENAS = {
  gasto: ["compre", "compramos", "se compro", "se compraron", "compraron", "pague", "pagamos", "se pago", "costo", "costaron", "gaste", "factura", "ticket", "gasolinera", "pesos"],
  necesidad: ["hace falta", "falta", "necesito", "necesitamos", "se acabo", "ya no hay", "hay que comprar", "urge", "conseguir"],
  incidencia: ["se descompuso", "se rompio", "se poncho", "fallo", "no prende", "se atasco", "accidente", "se lastimo", "se cayo", "problema"],
  cosecha: ["cosechamos", "se cosecho", "cortamos", "se corto", "sacamos", "salieron", "cajas de", "arpillas"],
  // Cuánto se avanzó de un trabajo, en la unidad en que se dice en el campo («terminamos dos reguladores»).
  avance: ["terminamos", "acabamos", "se terminaron", "se termino", "avanzamos", "llevamos", "quedaron pendientes", "regulador", "reguladores", "surcos", "camas", "melgas"],
  actividad: ["anduvieron", "trabajaron", "estuvieron", "regando", "sembrando", "fumigando", "barbechando", "rastreando", "limpiando", "aplicando", "desde las", "jornada"],
};

// Parte lo dicho en FRASES y clasifica cada una por su cuenta. Gera no habla
// de una cosa a la vez: en un mismo audio van la cuadrilla, el diésel y el
// filtro que hace falta.
export function partirEnDichos(texto) {
  return String(texto || "")
    .split(/(?<=[.;])\s+|\s+(?:y luego|luego|tambien|también|aparte|por cierto|otra cosa)\s+/i)
    .map(f => f.trim())
    .filter(f => f.length > 3);
}

// Clasifica UNA frase. Y si no reconoce nada, es "nota" — que se guarda
// igual. Lo que no se entendió no se tira: se guarda con el audio, para que
// nadie pierda lo que dijo.
export function clasificarDicho(frase) {
  const t = normalizar(frase);
  const puntos = Object.entries(SENAS).map(([tipo, senas]) => ({
    tipo, n: senas.filter(s => t.includes(normalizar(s))).length,
  })).sort((a, b) => b.n - a.n);

  if (!puntos[0] || puntos[0].n === 0) {
    return { tipo: "nota", seguro: false, porque: "No se reconoció de qué se trata. Se guarda como nota para que no se pierda." };
  }
  // Empate: no adivina.
  if (puntos[1] && puntos[1].n === puntos[0].n) {
    return {
      tipo: "nota", seguro: false, empate: [puntos[0].tipo, puntos[1].tipo],
      porque: `Podría ser ${puntos[0].tipo} o ${puntos[1].tipo}. Dilo tú; mientras tanto se guarda como nota.`,
    };
  }
  return { tipo: puntos[0].tipo, seguro: puntos[0].n >= 2, porque: `Suena a ${puntos[0].tipo}.` };
}

/* ════════════ LA PROPUESTA COMPLETA ════════════ */

// Toma lo dicho y arma los movimientos que PROPONE. No guarda nada: eso lo
// hace la app cuando la persona confirma, uno por uno.
export function entenderLoDicho({ texto, personas, parcelas, insumos, hoy }) {
  const dia = hoy || fechaLocal();
  const frases = partirEnDichos(texto);
  const propuestas = frases.map((frase, i) => {
    const clase = clasificarDicho(frase);
    const quienes = aQuienesSeRefiere(frase, personas);
    const donde = deQueParcela(frase, parcelas);
    const numeros = numerosDichos(frase);
    const fecha = aFecha(frase) || dia;

    const base = {
      i, frase, tipo: clase.tipo, seguro: clase.seguro, porque: clase.porque,
      fecha, personas: quienes.personas, ambiguos: quienes.ambiguos,
      parcelas: donde.parcelas, numeros,
      // Lo que la app NO pudo llenar, por su nombre. Un campo vacío que nadie
      // señala es un campo que nadie llena.
      falta: [],
    };

    if (clase.tipo === "gasto") {
      // El monto sale de un número dicho CON "pesos", o de un número suelto
      // que no sea el artículo. "Se compró UN filtro" no son $1 — "un" ahí es
      // un artículo, no una cantidad. Inventar ese peso es peor que dejar el
      // gasto sin monto: un monto en blanco se pregunta, uno de $1 se guarda
      // y nadie lo vuelve a mirar.
      const ARTICULOS = ["un", "una", "uno"];
      const sueltos = numeros.filter(n => !n.unidad && !ARTICULOS.includes(String(n.dicho).trim()));
      const pesos = numeros.find(n => n.unidad === "pesos") || sueltos[sueltos.length - 1];
      base.monto = pesos ? pesos.valor : null;
      if (base.monto === null) base.falta.push("cuánto costó");
      const cantidad = numeros.find(n => n.unidad && n.unidad !== "pesos");
      if (cantidad) base.cantidad = cantidad;
    }
    if (clase.tipo === "actividad") {
      if (quienes.personas.length === 0 && quienes.ambiguos.length === 0) base.falta.push("quién trabajó");
      if (donde.parcelas.length === 0) base.falta.push("en qué parcela");
      const horas = numeros.find(n => n.unidad === "horas" || n.unidad === "hora");
      if (horas) base.horas = horas.valor;
    }
    if (clase.tipo === "cosecha") {
      const cajas = numeros.find(n => ["cajas", "caja", "arpillas", "costales", "costal", "kilos", "kilo", "kg"].includes(n.unidad));
      base.cantidad = cajas || null;
      if (!cajas) base.falta.push("cuánto se cosechó");
      if (donde.parcelas.length === 0) base.falta.push("de qué parcela");
    }
    if (clase.tipo === "avance") {
      // Sólo lo que se dijo: cuánto y en qué unidad. Ni porcentaje ni superficie: dos reguladores no son «la mitad».
      const cuanto = numeros.find(n => UNIDADES_DE_AVANCE_DICHAS.includes(n.unidad)) || null, gente = numeros.find(n => /^(personas?|gentes?)$/.test(n.unidad || "")) || null;
      base.cantidad = cuanto; base.personasN = gente ? gente.valor : null;
      if (!cuanto) base.falta.push("cuánto se avanzó y en qué (reguladores, surcos, cajas…)");
      if (donde.parcelas.length === 0) base.falta.push("en qué parcela");
      if (donde.parcelas.length > 1) base.falta.push("en cuál de las parcelas que nombraste");
    }
    if (clase.tipo === "necesidad" || clase.tipo === "incidencia") {
      // Estas no necesitan número: lo que necesitan es llegar a alguien.
      base.paraQuien = clase.tipo === "necesidad" ? "quien compra" : "el encargado";
    }
    return base;
  });

  // Lo que se dice enseguida de un avance y es DE ese avance —cuánta gente anduvo, qué quedó pendiente— se le pega,
  // en vez de volverse otra cosa: «trabajaron siete personas y mañana hay que terminar lo que falta» no es una
  // actividad de siete desconocidos ni una compra.
  for (let i = 1; i < propuestas.length; i++) {
    const p = propuestas[i], previo = propuestas.slice(0, i).reverse().find(x => !x.parteDe);
    if (!previo || previo.tipo !== "avance" || p.tipo === "avance" || p.parcelas.length || p.personas.length) continue;
    const gente = p.numeros.find(n => /^(personas?|gentes?)$/.test(n.unidad || "")), t = normalizar(p.frase).toLowerCase();
    const pendiente = /\b(manana|pendiente|pendientes|lo que falta|falta por|terminar|acabar|seguir|continuar)\b/.test(t);
    if (!gente && !pendiente) continue;
    if (gente && previo.personasN == null) previo.personasN = gente.valor;
    if (pendiente) { const q = p.numeros.find(n => UNIDADES_DE_AVANCE_DICHAS.includes(n.unidad)); previo.pendiente = { texto: p.frase, cantidad: q ? q.valor : null, unidad: q ? q.unidad : null }; }
    p.parteDe = previo.i; p.tipo = "nota"; p.seguro = true; p.porque = "Va con el avance de arriba.";
  }
  return {
    frases: frases.length,
    propuestas,
    // NADA se guarda solo. Está aquí explícito para que nadie lo cambie sin
    // darse cuenta: registrar la nómina de tres personas porque se creyó oír
    // un nombre hace más daño que no entender nada.
    guardaSolo: false,
    resumen: resumirPropuestas(propuestas),
  };
}

function resumirPropuestas(props) {
  const porTipo = {};
  for (const p of props) porTipo[p.tipo] = (porTipo[p.tipo] || 0) + 1;
  const partes = Object.entries(porTipo).map(([t, n]) => `${n} ${t}${n > 1 ? "s" : ""}`);
  const conDudas = props.filter(p => p.falta.length > 0 || p.ambiguos.length > 0).length;
  return partes.length === 0
    ? "No se entendió nada de lo dicho. Se guarda el audio completo como nota."
    : `Se entendieron ${partes.join(", ")}.` + (conDudas > 0 ? ` ${conDudas} necesita(n) que completes algo antes de guardarse.` : "");
}
