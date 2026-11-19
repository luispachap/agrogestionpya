// ============================================================
//  AgroGestión — El clima como copiloto de la planeación del día
//
//  Luis lo pidió con esas palabras: "poner el pronóstico del clima al sistema
//  para ser un copiloto en la planeación del día". No es el widget del clima
//  del teléfono, que ya tiene todo el mundo. La pregunta del rancho no es
//  "¿va a llover?", es:
//
//      ¿QUÉ SE PUEDE Y QUÉ NO SE PUEDE HACER HOY?
//
//  · Si a las once el viento va en 22 km/h, la fumigada se va en el aire a la
//    parcela del vecino. Eso se llama deriva, y se paga dos veces: el producto
//    que no llegó, y el reclamo del de junto.
//  · Si llueve tres horas después de aplicar, el producto se lava. El gasto ya
//    se hizo y el trabajo hay que repetirlo.
//  · Si a mediodía hacen 34 grados, la gota se evapora antes de entrar a la
//    hoja. Se aplicó, se pagó, y no hizo nada.
//  · Si el jueves caen 20 mm, regar hoy es tirar agua y diésel.
//  · Si el sábado hiela, el chile se pierde. Esa hay que saberla el jueves,
//    no el domingo.
//
//  De dónde salen los datos: Open-Meteo (api.open-meteo.com). Gratis, sin
//  llave y sin registro — eso fue a propósito: a Luis no se le puede pedir
//  otra contraseña que cuidar, y una llave en el navegador se publica sola
//  (ver la sección de secretos en CLAUDE.md).
//
//  ─────────────────────────────────────────────────────────────
//  LO QUE NO HACE — y hay que decirlo
//  ─────────────────────────────────────────────────────────────
//  · NO ordena. Nunca dice "sube el ritmo", "no compres" ni "no riegues".
//    Dice el viento, la lluvia y la hora, y Fito o Migue deciden. Ellos ven
//    el suelo, la planta y la corredora; el pronóstico no.
//  · NO bloquea. Todo lo que devuelve trae `bloquea: false`. Si la app impide
//    aplicar, la aplicación no se detiene: se detiene el registro, y entonces
//    el sistema deja de saber qué pasó en la parcela.
//  · NO inventa. Sin pronóstico la respuesta es `null` y se dice con palabras.
//    "No sé si se puede" NO es lo mismo que "no se puede": lo primero se
//    resuelve mirando el cielo, lo segundo detiene la faena.
//  · NO promedia lo que no midió. Una hora sin dato de viento no es una hora
//    en calma. `Number(null)` vale 0, y ese cero ya causó un error real en
//    este proyecto — por eso todo pasa por `num()`.
//  · NO decide por temporada ni por corazonada: sólo lee lo que el pronóstico
//    trae, y cuando el pronóstico se acaba, lo dice.
//
//  ─────────────────────────────────────────────────────────────
//  LA TRAMPA DE LA HORA — la que más caro sale
//  ─────────────────────────────────────────────────────────────
//  Open-Meteo devuelve las horas YA en la zona que se le pidió. Si se le pide
//  con `timezone=America/Mexico_City`, "2026-09-08T06:00" son las seis de la
//  mañana de Zacatecas y NO hay que convertir nada. Convertirlas otra vez las
//  corre seis horas: una ventana "de 6 a 10 de la mañana" se volvería "de 12
//  a 4 de la tarde" — la peor hora del día, con el sol pegando.
//
//  Por eso este módulo NO convierte horas: las lee como texto. Y si el
//  pronóstico vino en hora de Greenwich (offset 0) —o si de plano no dice en
//  qué zona vienen sus horas— no adivina el corrimiento: lo dice y no usa las
//  horas para nada. El corrimiento desconocido es peor que el conocido: del de
//  Greenwich por lo menos se sabe que está mal.
//
//  ─────────────────────────────────────────────────────────────
//  LA ANTICIPACIÓN SE MIDE DESDE AHORA
//  ─────────────────────────────────────────────────────────────
//  "Granizo a las 8 de la mañana" no sirve de nada; "granizo, faltan 3 horas"
//  sí. Pero esas horas hay que contarlas desde la hora en que la persona está
//  mirando la pantalla, NO desde donde arranca el pronóstico —que es la
//  medianoche del día en que se bajó—. Contadas desde ahí, a las seis de la
//  tarde un granizo de las ocho de la mañana dice "faltan 8 horas" cuando cayó
//  hace diez. Un número presentado como hecho y calculado contra la base
//  equivocada es peor que no dar el número.
//
//  Y un pronóstico guardado se vence: si sus días ya pasaron, no se ofrecen
//  sus horas buenas como si fueran las de mañana. Sin señal —que es lo normal
//  en el rancho— ése es el camino de todos los días, no el raro.
//
//  Lo puro y probado es todo lo de arriba de la línea de "LO IMPURO".
//  Sus pruebas están en src/clima.test.js.
// ============================================================

import { fechaLocal, sumarDias, diasEntre } from "./calculos.js";

/* ════════════ UN DATO QUE FALTA NO ES UN CERO ════════════ */

// Un número, o null si NO viene.
//
// Existe por la misma razón que en maquinaria.js: `Number(null)` vale 0 y
// `Number("")` también. Sin esto, "no se sabe cuánto viento va a hacer" se
// convierte solo en "no va a hacer viento", y a partir de ahí la app manda a
// fumigar con un dato que nadie miró.
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

const sinNulos = (xs) => (xs || []).filter((x) => x !== null && x !== undefined);
const maxDe = (xs) => { const v = sinNulos(xs); return v.length ? Math.max(...v) : null; };
const minDe = (xs) => { const v = sinNulos(xs); return v.length ? Math.min(...v) : null; };
// La suma de una lista donde TODO falta es null, no cero: un día del que no se
// sabe la lluvia no es un día seco.
const sumaDe = (xs) => { const v = sinNulos(xs); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) * 10) / 10 : null; };
const unicos = (xs) => [...new Set(xs)];

/* ════════════ LOS UMBRALES, Y POR QUÉ ESOS ════════════ */

export const UMBRALES = {
  // Viento. Arriba de 15 km/h la gota chica se va en el aire; es el número que
  // trae cualquier etiqueta de agroquímico y el que usa Fito.
  vientoQueArrastra: 15,
  // Lluvia. Medio milímetro ya moja la hoja: con eso se lava lo aplicado.
  lluviaQueLava: 0.5,
  // Probabilidad. Arriba de 60 % ya no es "puede que llueva".
  probabilidadAlta: 60,
  // Entre 30 y 60 no se dice que no; se avisa y la persona decide.
  probabilidadQueSeAvisa: 30,
  // Helada. Se mide a dos metros del suelo, y a ras de tierra siempre hace más
  // frío: por eso 3° ya es aviso, no sólo el cero. El chile no aguanta una
  // helada y al ajo le quema la hoja.
  heladaSegura: 0,
  riesgoDeHelada: 3,
  // Ráfagas que tumban planta, lona y escalera.
  vientoFuerte: 40,
  vientoMuyFuerte: 60,
  // Lluvia del día que deja la terracería intransitable: la camioneta no entra
  // a la parcela y la cuadrilla se queda parada.
  lluviaQueEstorba: 20,
  lluviaQueParaTodo: 40,
  // La lluvia que de verdad sustituye un riego. Tres milímetros nomás asientan
  // el polvo; quince mojan el perfil.
  mmQueSustituyenUnRiego: 15,
  // Horas en que de verdad se trabaja. Ofrecer una ventana buenísima a las
  // tres de la mañana es no haber entendido la pregunta.
  horaInicio: 6,
  horaFin: 19,
};

// Cada faena aguanta cosas distintas, y por razones distintas.
//
// El herbicida es el más delicado con el viento: si se va a la parcela de al
// lado no "se desperdicia", QUEMA el cultivo del vecino. Por eso 10 y no 15.
// El fertirriego va por la manguera y por el suelo, no por el aire: ahí el
// viento no importa — poner un límite de viento al fertirriego sería inventar
// una restricción y enseñar a ignorar las que sí importan.
export const TIPOS_APLICACION = {
  fumigar: {
    etiqueta: "fumigar (aplicación foliar)",
    vientoMax: UMBRALES.vientoQueArrastra, rafagaMax: 25,
    calorMax: 30, horasSinLluvia: 6, humedadMin: 40,
  },
  herbicida: {
    etiqueta: "aplicar herbicida",
    vientoMax: 10, rafagaMax: 18,
    calorMax: 30, horasSinLluvia: 6, humedadMin: 40,
  },
  fertirriego: {
    etiqueta: "fertirrigar",
    vientoMax: null, rafagaMax: null,
    calorMax: 35, horasSinLluvia: 4, humedadMin: null,
  },
};

/* ════════════ EL CIELO, EN PALABRAS ════════════ */

// Los códigos de la Organización Meteorológica Mundial, que es lo que devuelve
// Open-Meteo. Sólo se traducen: no se interpretan de más.
const CIELO = {
  0: "despejado", 1: "casi despejado", 2: "medio nublado", 3: "nublado",
  45: "neblina", 48: "neblina con escarcha",
  51: "llovizna ligera", 53: "llovizna", 55: "llovizna fuerte",
  56: "llovizna helada", 57: "llovizna helada fuerte",
  61: "lluvia ligera", 63: "lluvia", 65: "lluvia fuerte",
  66: "lluvia helada", 67: "lluvia helada fuerte",
  71: "nieve ligera", 73: "nieve", 75: "nieve fuerte", 77: "nieve granulada",
  80: "chubascos", 81: "chubascos fuertes", 82: "aguacero",
  85: "chubascos de nieve", 86: "chubascos de nieve fuertes",
  95: "tormenta eléctrica", 96: "tormenta con granizo", 99: "tormenta con granizo fuerte",
};
export const CODIGOS_CON_GRANIZO = [96, 99];
export const cieloEnPalabras = (c) =>
  (c === null || c === undefined) ? null : (CIELO[c] || `código ${c} del pronóstico`);

/* ════════════ LA HORA Y EL DÍA, EN PALABRAS DEL RANCHO ════════════ */

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// La medianoche NO es "12 de la mañana". Aquí "las doce de la mañana" se lee
// como las doce del día, y una helada de las 00:00 —que es la hora más común
// de una helada— se cubriría a mediodía y se perdería el chile en la
// madrugada. Las 0 son "12 de la noche", y de 1 a 4 es la madrugada, que es
// como se dice en el rancho.
const parteDelDia = (h) =>
  h === 0 ? "de la noche"
    : h < 5 ? "de la madrugada"
      : h < 12 ? "de la mañana"
        : h === 12 ? "del día"
          : h < 19 ? "de la tarde"
            : "de la noche";
const reloj12 = (h) => (h % 12 === 0 ? 12 : h % 12);

// "de 6 a 10 de la mañana", "de 10 de la mañana a 2 de la tarde".
export function rangoEnPalabras(desdeH, hastaH) {
  const a = parteDelDia(desdeH), b = parteDelDia(hastaH);
  return a === b
    ? `de ${reloj12(desdeH)} a ${reloj12(hastaH)} ${a}`
    : `de ${reloj12(desdeH)} ${a} a ${reloj12(hastaH)} ${b}`;
}

export function horaEnPalabras(h) {
  return `${reloj12(h)} ${parteDelDia(h)}`;
}

// "hoy lunes 8 de septiembre", "mañana martes 9", "el jueves 11 de septiembre".
// El "hoy" y el "mañana" sólo aparecen si alguien dijo qué día es hoy: no se
// saca del reloj aquí adentro para que esto se pueda probar.
export function diaEnPalabras(dia, hoy) {
  if (!dia) return "";
  const d = new Date(String(dia).slice(0, 10) + "T00:00:00");
  if (isNaN(d)) return String(dia);
  const base = `${DIAS_SEMANA[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  if (!hoy) return base;
  if (dia === hoy) return `hoy ${base}`;
  if (dia === sumarDias(hoy, 1)) return `mañana ${base}`;
  return `el ${base}`;
}

// ¿Esta marca trae hora, o nomás el día? "2026-09-08" es un día;
// "2026-09-08T18:00" es una hora. De un día no se saca una anticipación en
// horas sin inventarse la hora.
const traeHora = (s) => String(s || "").length > 10;

// La hora de este aparato, en el mismo formato en que vienen las del
// pronóstico ("2026-09-08T18:00"). Se usa como valor por omisión de "ahora",
// igual que `fechaLocal()` en el resto de la casa. En las pruebas siempre se
// pasa la hora a mano, para que no dependan del reloj.
export function ahoraLocal(d = new Date()) {
  return `${fechaLocal(d)}T${String(d.getHours()).padStart(2, "0")}:00`;
}

// Horas enteras entre dos marcas locales ("2026-09-08T06:00"). Las dos vienen
// en la misma zona, así que la resta no arrastra ningún corrimiento.
function horasEntre(a, b) {
  if (!a || !b) return null;
  const arma = (s) => new Date(String(s).length <= 10 ? `${s}T00:00:00` : String(s));
  const da = arma(a), db = arma(b);
  if (isNaN(da) || isNaN(db)) return null;
  return Math.round((db - da) / 3600000);
}

/* ════════════ 1 · INTERPRETAR EL PRONÓSTICO ════════════ */

// Toma la respuesta cruda de Open-Meteo y la deja en algo del rancho: por hora
// y por día, con las palabras que se usan aquí.
//
// Es idempotente a propósito: se le puede pasar lo ya interpretado y lo
// devuelve igual, para que las demás funciones no tengan que preguntar.
export function interpretarPronostico(pronostico) {
  if (pronostico && pronostico._interpretado === true) return pronostico;

  const vacio = (porque) => ({
    _interpretado: true, ok: false, porque,
    horas: [], dias: [], avisos: [],
    zona: null, horaLocal: null, desde: null, hasta: null, lat: null, lon: null,
  });

  if (!pronostico || typeof pronostico !== "object") {
    return vacio("No hay pronóstico. Sin él no se sabe qué clima viene — que es distinto de saber que viene bueno.");
  }

  const H = pronostico.hourly || {};
  const D = pronostico.daily || {};
  const tiempos = Array.isArray(H.time) ? H.time : [];
  const diasCrudos = Array.isArray(D.time) ? D.time : [];

  if (tiempos.length === 0 && diasCrudos.length === 0) {
    return vacio("El pronóstico llegó sin horas ni días. Puede que la petición haya salido mal o que la respuesta viniera cortada.");
  }

  // La zona. Open-Meteo YA devuelve las horas en la que se le pidió; aquí no
  // se convierte nada. Lo único que se hace es reconocer cuándo vino en hora
  // de Greenwich, porque entonces todo lo que dependa de la hora estaría
  // corrido seis y no hay forma honesta de adivinarlo.
  //
  // Y si el pronóstico NO dice en qué zona vienen sus horas (una respuesta
  // cortada, o un guardado por una versión anterior), tampoco se da por bueno:
  // `horaLocal` queda en null y las horas no se usan. El corrimiento
  // desconocido es peor que el de Greenwich — del de Greenwich por lo menos se
  // sabe que está mal.
  const zona = pronostico.timezone || null;
  const offset = num(pronostico.utc_offset_seconds);
  const enGreenwich = offset === 0 || /^(gmt|utc)$/i.test(String(zona || ""));
  const horaLocal = enGreenwich ? false : (offset === null ? null : true);

  const horas = tiempos.map((t, i) => {
    const s = String(t);
    return {
      i,
      hora: s,
      dia: s.slice(0, 10),
      h: Number(s.slice(11, 13)),
      temp: num(H.temperature_2m?.[i]),
      humedad: num(H.relative_humidity_2m?.[i]),
      lluviaMm: num(H.precipitation?.[i]),
      lluviaProb: num(H.precipitation_probability?.[i]),
      viento: num(H.wind_speed_10m?.[i]),
      rafaga: num(H.wind_gusts_10m?.[i]),
      codigo: num(H.weather_code?.[i] ?? H.weathercode?.[i]),
      cielo: cieloEnPalabras(num(H.weather_code?.[i] ?? H.weathercode?.[i])),
    };
  });

  // Los días: primero lo que el propio pronóstico resume por día, y lo que
  // falte se saca de las horas — que es dato medido, no dato inventado.
  const porDia = new Map();
  diasCrudos.forEach((t, i) => {
    const dia = String(t).slice(0, 10);
    porDia.set(dia, {
      dia,
      tempMax: num(D.temperature_2m_max?.[i]),
      tempMin: num(D.temperature_2m_min?.[i]),
      lluviaMm: num(D.precipitation_sum?.[i]),
      lluviaProb: num(D.precipitation_probability_max?.[i]),
      vientoMax: num(D.wind_speed_10m_max?.[i]),
      rafagaMax: num(D.wind_gusts_10m_max?.[i]),
      codigo: num(D.weather_code?.[i] ?? D.weathercode?.[i]),
      delResumen: true,
    });
  });

  for (const dia of unicos(horas.map((h) => h.dia))) {
    if (!porDia.has(dia)) porDia.set(dia, { dia, delResumen: false });
  }

  const elegir = (a, b) => (a === null || a === undefined ? b : a);
  const dias = [...porDia.values()]
    .sort((a, b) => (a.dia < b.dia ? -1 : 1))
    .map((d) => {
      const hs = horas.filter((h) => h.dia === d.dia);
      const codigos = unicos(sinNulos(hs.map((h) => h.codigo)).concat(d.codigo === null || d.codigo === undefined ? [] : [d.codigo]));
      const codigo = elegir(d.codigo ?? null, maxDe(hs.map((h) => h.codigo)));
      const lluviaMm = elegir(d.lluviaMm ?? null, sumaDe(hs.map((h) => h.lluviaMm)));
      // Cuántas de las 24 horas traen de verdad el dato de lluvia.
      //
      // `sumaDe` descarta los nulos y suma lo que queda, y el resultado sale
      // sin ninguna marca de cuántas horas lo respaldan: un día del que sólo se
      // midieron cuatro horas queda con "0 mm" idéntico a un día completo y
      // seco. Es el mismo descarte callado que en el banco vuelve un archivo NO
      // CONFIABLE (`leerMovimientos` devuelve `descartadas`). Aquí el descarte
      // sí se devuelve, y quien lo use decide si le sirve.
      const horasConLluvia = hs.filter((h) => h.lluviaMm !== null).length;
      const delResumenConLluvia = !!d.delResumen && d.lluviaMm !== null && d.lluviaMm !== undefined;
      return {
        dia: d.dia,
        tempMax: elegir(d.tempMax ?? null, maxDe(hs.map((h) => h.temp))),
        tempMin: elegir(d.tempMin ?? null, minDe(hs.map((h) => h.temp))),
        lluviaMm,
        horasConLluvia,
        // El servicio resumió el día entero, o están las 24 horas. Cualquier
        // otra cosa es un piso, no el total del día.
        lluviaCompleta: lluviaMm === null ? false : (delResumenConLluvia || horasConLluvia === 24),
        lluviaProb: elegir(d.lluviaProb ?? null, maxDe(hs.map((h) => h.lluviaProb))),
        vientoMax: elegir(d.vientoMax ?? null, maxDe(hs.map((h) => h.viento))),
        rafagaMax: elegir(d.rafagaMax ?? null, maxDe(hs.map((h) => h.rafaga))),
        codigo,
        codigos,
        cielo: cieloEnPalabras(codigo),
        horas: hs,
        // Cuántas horas del día se alcanzan a ver. Un día del que sólo se ven
        // cuatro horas no es un día completo, y para una helada eso importa.
        horasVistas: hs.length,
        delResumen: !!d.delResumen,
      };
    });

  const avisos = [];
  if (horaLocal === false) {
    avisos.push("Este pronóstico vino en hora de Greenwich, no en la de aquí. Las horas estarían corridas seis, así que no se pueden usar para decir a qué hora aplicar. Mejor vuelve a bajar el pronóstico.");
  } else if (horaLocal === null) {
    avisos.push("Este pronóstico no dice en qué zona horaria vienen sus horas. Puede estar corrido y no hay forma de saber cuánto, así que sus horas no se usan para decir a qué hora aplicar. Mejor vuelve a bajar el pronóstico.");
  }

  return {
    _interpretado: true,
    ok: true,
    porque: null,
    zona, horaLocal, avisos,
    lat: num(pronostico.latitude), lon: num(pronostico.longitude),
    horas, dias,
    desde: horas[0]?.hora || dias[0]?.dia || null,
    hasta: horas[horas.length - 1]?.hora || dias[dias.length - 1]?.dia || null,
  };
}

/* ════════════ 2 · ¿SE PUEDE APLICAR? ════════════ */

// Lo que va a llover de aquí a N horas, mirando desde una hora dada.
//
// Se mira HACIA ADELANTE a propósito: lo que decide si la aplicación se lava
// no es el clima del momento, es el de las siguientes horas. Si el pronóstico
// se acaba antes de terminar de mirar, se dice — no se concluye que no va a
// llover porque ya no haya renglones.
// Y hay dos formas distintas de no saber, que se cuentan por separado:
//   · el pronóstico se ACABA antes de terminar de mirar (faltan renglones), y
//   · los renglones están, pero VIENEN EN BLANCO (falta el dato).
//
// La segunda es la traicionera. Contar renglones y no datos hacía que seis
// horas con la lluvia en null se dieran por "seis horas miradas, sin lluvia" y
// la ventana saliera impresa con la frase "sin lluvia a la vista". Fito
// cargaba la aspersora con un dato que nadie midió — que es justo el pecado
// que el encabezado de este archivo dice no cometer.
//
// Una hora con los milímetros en blanco pero con la probabilidad puesta SÍ
// cuenta como dato: con la probabilidad se puede decir qué tan probable es que
// llueva. Sin ninguno de los dos no se puede decir nada.
function lluviaAdelante(desdeIndice, todas, cuantasHoras) {
  let vistas = 0, enBlanco = 0;
  let probMax = null, horaProbMax = null, primeraEnBlanco = null;
  for (let k = 0; k <= cuantasHoras; k++) {
    const x = todas[desdeIndice + k];
    if (!x) break;
    vistas++;
    if (x.lluviaMm !== null && x.lluviaMm >= UMBRALES.lluviaQueLava) {
      return { llueve: x, porQue: "milimetros", completo: true, enBlanco, primeraEnBlanco, probMax, horaProbMax };
    }
    if (x.lluviaProb !== null && x.lluviaProb >= UMBRALES.probabilidadAlta) {
      return { llueve: x, porQue: "probabilidad", completo: true, enBlanco, primeraEnBlanco, probMax, horaProbMax };
    }
    if (x.lluviaMm === null && x.lluviaProb === null) {
      enBlanco++;
      if (!primeraEnBlanco) primeraEnBlanco = x;
    }
    if (x.lluviaProb !== null && (probMax === null || x.lluviaProb > probMax)) {
      probMax = x.lluviaProb; horaProbMax = x;
    }
  }
  return {
    llueve: null,
    completo: vistas >= cuantasHoras + 1,
    enBlanco,
    primeraEnBlanco,
    ultimaVista: todas[desdeIndice + vistas - 1] || null,
    probMax, horaProbMax,
  };
}

// Revisa UNA hora contra las reglas de la faena. Devuelve tres listas
// separadas a propósito:
//   razones   → por qué NO (eso vuelve la hora un "no")
//   faltantes → qué no se sabe (eso vuelve la hora un "no sé", que es otra cosa)
//   avisos    → lo que hay que mirar pero no detiene nada
function revisarHora(h, todas, reglas) {
  const razones = [], faltantes = [], avisos = [];

  if (reglas.vientoMax !== null) {
    if (h.viento === null) {
      faltantes.push(`a las ${horaEnPalabras(h.h)} no se sabe cuánto viento va a hacer`);
    } else if (h.viento > reglas.vientoMax) {
      razones.push(`el viento va en ${h.viento} km/h y arriba de ${reglas.vientoMax} el producto se va en el aire a la parcela de al lado`);
    }
    if (reglas.rafagaMax !== null && h.rafaga !== null && h.rafaga > reglas.rafagaMax) {
      razones.push(`las ráfagas llegan a ${h.rafaga} km/h`);
    }
  }

  if (reglas.calorMax !== null) {
    if (h.temp === null) {
      faltantes.push(`a las ${horaEnPalabras(h.h)} no se sabe la temperatura`);
    } else if (h.temp > reglas.calorMax) {
      razones.push(`van a hacer ${h.temp}° y arriba de ${reglas.calorMax}° se evapora antes de entrar a la hoja`);
    }
  }

  const ll = lluviaAdelante(h.i, todas, reglas.horasSinLluvia);
  if (ll.llueve) {
    const q = ll.porQue === "milimetros"
      ? `${ll.llueve.lluviaMm} mm`
      : `${ll.llueve.lluviaProb}% de probabilidad`;
    razones.push(`va a llover a las ${horaEnPalabras(ll.llueve.h)} (${q}) y la lluvia de las siguientes ${reglas.horasSinLluvia} horas lo lava: el gasto se pierde`);
  } else if (!ll.completo) {
    faltantes.push(`el pronóstico se acaba ${ll.ultimaVista ? `a las ${horaEnPalabras(ll.ultimaVista.h)} del ${ll.ultimaVista.dia}` : "antes"}, así que no se sabe si va a llover dentro de las siguientes ${reglas.horasSinLluvia} horas`);
  } else if (ll.enBlanco > 0) {
    faltantes.push(`de las ${reglas.horasSinLluvia} hora(s) que siguen a las ${horaEnPalabras(h.h)}, ${ll.enBlanco} vienen sin dato de lluvia (la primera, las ${horaEnPalabras(ll.primeraEnBlanco.h)}), así que no se sabe si se lava`);
  } else if (ll.probMax !== null && ll.probMax >= UMBRALES.probabilidadQueSeAvisa) {
    avisos.push(`hay ${ll.probMax}% de probabilidad de lluvia a las ${horaEnPalabras(ll.horaProbMax.h)}: no es un no, pero mira el cielo antes de cargar`);
  }

  if (reglas.humedadMin !== null && h.humedad !== null && h.humedad < reglas.humedadMin) {
    avisos.push(`la humedad va en ${h.humedad}%: la gota se seca en el aire antes de llegar a la hoja`);
  }

  const puede = razones.length > 0 ? false : (faltantes.length > 0 ? null : true);
  return { hora: h, puede, razones, faltantes, avisos };
}

// Junta las horas buenas que van seguidas en ventanas.
function agruparVentanas(evaluadas) {
  const ventanas = [];
  let actual = null;
  for (const e of evaluadas) {
    if (e.puede === true) {
      if (actual && actual.dia === e.hora.dia && e.hora.h === actual.hastaH) {
        actual.hastaH = e.hora.h + 1;
        actual.horas.push(e.hora);
      } else {
        if (actual) ventanas.push(actual);
        actual = { dia: e.hora.dia, desdeH: e.hora.h, hastaH: e.hora.h + 1, horas: [e.hora] };
      }
    } else if (actual) {
      ventanas.push(actual);
      actual = null;
    }
  }
  if (actual) ventanas.push(actual);
  return ventanas;
}

function vestirVentana(v, hoy) {
  const viento = maxDe(v.horas.map((x) => x.viento));
  const temp = maxDe(v.horas.map((x) => x.temp));
  // "Sin lluvia a la vista" es una AFIRMACIÓN, y sólo se escribe cuando hay
  // con qué respaldarla. Una hora sin dato de lluvia ya no puede llegar aquí
  // —`revisarHora` la vuelve un "no sé"—, pero la frase se arma mirando el
  // dato de todos modos: es la que se lee en el teléfono, y si algún día
  // alguien afloja aquella regla, esta frase no debe seguir mintiendo sola.
  const conDatoDeLluvia = v.horas.every((x) => x.lluviaMm !== null || x.lluviaProb !== null);
  const partes = [
    viento === null ? null : `viento hasta ${viento} km/h`,
    temp === null ? null : `${temp}° como máximo`,
    conDatoDeLluvia ? "sin lluvia a la vista" : "de la lluvia no hay dato en estas horas",
  ].filter(Boolean);
  return {
    ...v,
    horasBuenas: v.horas.length,
    vientoMax: viento,
    tempMax: temp,
    dice: `${diaEnPalabras(v.dia, hoy)}, ${rangoEnPalabras(v.desdeH, v.hastaH)}: ${partes.join(", ")}.`,
  };
}

// Qué horas pidió quien pregunta. Acepta un día ("2026-09-08"), una hora
// ("2026-09-08T07:00"), un rango ({desde, hasta}) o nada — y si no dijo nada,
// se contesta por el primer día que trae el pronóstico y se dice cuál es.
function horasPedidas(p, cuando, { horaInicio, horaFin }) {
  const deTrabajo = (h) => h.h >= horaInicio && h.h <= horaFin;

  if (!cuando) {
    const dia = p.dias[0]?.dia || null;
    return { tipo: "dia", dia, etiqueta: diaEnPalabras(dia), horas: p.horas.filter((h) => h.dia === dia && deTrabajo(h)) };
  }
  if (typeof cuando === "object") {
    const { desde, hasta } = cuando;
    return {
      tipo: "rango", dia: null, etiqueta: `de ${desde || "?"} a ${hasta || "?"}`,
      horas: p.horas.filter((h) => (!desde || h.hora >= desde) && (!hasta || h.hora <= hasta)),
    };
  }
  const s = String(cuando);
  if (s.length <= 10) {
    return { tipo: "dia", dia: s, etiqueta: diaEnPalabras(s), horas: p.horas.filter((h) => h.dia === s && deTrabajo(h)) };
  }
  const exacta = p.horas.filter((h) => h.hora.slice(0, 13) === s.slice(0, 13));
  return { tipo: "hora", dia: s.slice(0, 10), etiqueta: `${diaEnPalabras(s.slice(0, 10))} a las ${horaEnPalabras(Number(s.slice(11, 13)))}`, horas: exacta };
}

// ¿Se puede fumigar / fertirrigar / aplicar herbicida en esa ventana?
//
// `puede` tiene TRES valores y los tres quieren decir cosas distintas:
//   true  → las condiciones dan
//   false → hay una razón concreta, y viene escrita
//   null  → NO SE SABE. Sin pronóstico, o con un dato que falta. No es un "no".
export function sePuedeAplicar({ pronostico, cuando, tipo = "fumigar", hoy = null, horaInicio, horaFin } = {}) {
  // Si no se dijo por cuándo se pregunta pero sí qué día es hoy, se pregunta
  // por hoy. Contestar por el primer día que trae el pronóstico —que en un
  // pronóstico guardado sin señal puede ser el de hace dos semanas— es ofrecer
  // como plan de hoy las horas de un día que ya pasó.
  if (!cuando && hoy) cuando = hoy;

  const base = {
    puede: null, bloquea: false, tipo, cuando: cuando || null,
    ventanasBuenas: [], razones: [], avisos: [], faltantes: [], detalle: [],
    horasMiradas: 0, horasBuenas: 0,
  };

  const reglas = TIPOS_APLICACION[tipo];
  if (!reglas) {
    return {
      ...base,
      porque: `No se sabe con qué reglas medir "${tipo}". Las que este módulo conoce son: ${Object.keys(TIPOS_APLICACION).join(", ")}. Usar las de otra actividad sería inventar un límite — y con un herbicida eso le quema la parcela al vecino.`,
    };
  }

  const p = interpretarPronostico(pronostico);
  if (!p.ok) {
    return {
      ...base,
      porque: `${p.porque} Que no haya pronóstico NO quiere decir que no se pueda aplicar: quiere decir que no se sabe. Sal a ver el viento.`,
    };
  }
  // No sólo Greenwich: también el pronóstico que NO dice en qué zona vienen
  // sus horas. Preguntar `=== false` dejaba pasar derecho el `null`, que es el
  // corrimiento del que ni siquiera se sabe cuánto es.
  if (p.horaLocal !== true) {
    return { ...base, porque: p.avisos[0] };
  }

  const pedidas = horasPedidas(p, cuando, {
    horaInicio: horaInicio ?? UMBRALES.horaInicio,
    horaFin: horaFin ?? UMBRALES.horaFin,
  });
  if (pedidas.horas.length === 0) {
    return {
      ...base,
      porque: `El pronóstico no llega a ${pedidas.etiqueta || "esa fecha"} (va del ${p.desde} al ${p.hasta}), así que de esa hora no se sabe nada.`,
    };
  }

  const evaluadas = pedidas.horas.map((h) => revisarHora(h, p.horas, reglas));
  const buenas = evaluadas.filter((e) => e.puede === true);
  const noSeSabe = evaluadas.filter((e) => e.puede === null);
  const ventanasBuenas = agruparVentanas(evaluadas).map((v) => vestirVentana(v, null));

  const razones = unicos(evaluadas.flatMap((e) => e.razones));
  const faltantes = unicos(evaluadas.flatMap((e) => e.faltantes));
  const avisos = unicos(evaluadas.flatMap((e) => e.avisos));
  const comun = { ...base, tipo, razones, faltantes, avisos, detalle: evaluadas, ventanasBuenas, horasMiradas: evaluadas.length, horasBuenas: buenas.length };

  if (buenas.length > 0) {
    const dondeSi = ventanasBuenas.map((v) => rangoEnPalabras(v.desdeH, v.hastaH)).join(" y ");
    // El "no sé" NO se puede quedar fuera de la frase. Quien lee la pantalla
    // lee `porque`, y "se puede de 6 a 11" a secas se entiende como "de las 11
    // en adelante el clima no da". Si de las 11 en adelante lo que pasa es que
    // NO SE SABE, ésa se resuelve saliendo a ver el viento, no parando la
    // faena — y es justo la distinción que este módulo existe para defender.
    const yLoQueNoSeSabe = noSeSabe.length > 0
      ? ` De otras ${noSeSabe.length} hora(s) NO SE SABE: ${faltantes[0]}. Eso no es un no; se resuelve saliendo a ver.`
      : "";
    return {
      ...comun,
      puede: true,
      porque: pedidas.tipo === "hora"
        ? `Sí se puede ${reglas.etiqueta} ${pedidas.etiqueta}. ${ventanasBuenas[0]?.dice || ""}`.trim()
        : `Sí se puede ${reglas.etiqueta} ${pedidas.etiqueta}, pero no todo el día: ${dondeSi}.` +
          (razones.length ? ` El resto del día no, porque ${razones[0]}.` : "") +
          yLoQueNoSeSabe,
    };
  }
  if (razones.length === 0 && noSeSabe.length > 0) {
    return {
      ...comun,
      puede: null,
      porque: `No se puede decir si se puede ${reglas.etiqueta} ${pedidas.etiqueta}: ${faltantes[0]}. Falta el dato, no es que esté mal el clima.`,
    };
  }
  return {
    ...comun,
    puede: false,
    porque: `No conviene ${reglas.etiqueta} ${pedidas.etiqueta}: ${razones.join("; ")}.` +
      (faltantes.length ? ` (Además, ${faltantes[0]}.)` : ""),
  };
}

/* ════════════ 3 · LAS VENTANAS BUENAS DE LOS PRÓXIMOS DÍAS ════════════ */

// Esto es lo que de verdad sirve en la planeación: "mañana de 6 a 10 de la
// mañana". No un porcentaje ni un icono de nube.
//
// Sólo se ofrecen horas de trabajo (6 de la mañana a 7 de la tarde por
// omisión): una ventana perfecta a las tres de la madrugada no es una
// respuesta, es un dato que estorba.
export function ventanasParaAplicar(pronostico, dias = 3, opciones = {}) {
  const { tipo = "fumigar", hoy = null, horaInicio = UMBRALES.horaInicio, horaFin = UMBRALES.horaFin } = opciones;

  const reglas = TIPOS_APLICACION[tipo];
  if (!reglas) {
    return { ok: false, tipo, ventanas: [], dias: [], dice: `No se sabe con qué reglas medir "${tipo}".` };
  }

  const p = interpretarPronostico(pronostico);
  if (!p.ok) {
    return { ok: false, tipo, ventanas: [], dias: [], dice: `${p.porque} Sin pronóstico no hay ventanas que ofrecer, y no se inventan.` };
  }
  if (p.horaLocal !== true) {
    return { ok: false, tipo, ventanas: [], dias: [], bloquea: false, dice: p.avisos[0] };
  }

  const cuantos = Math.max(1, parseInt(dias, 10) || 1);
  const primero = p.dias[0]?.dia || null;
  const ultimo = p.dias[p.dias.length - 1]?.dia || null;

  // UN PRONÓSTICO GUARDADO SE VENCE.
  //
  // Antes, cuando ningún día del pronóstico alcanzaba a hoy, esto se caía al
  // primer día del pronóstico y seguía como si nada. Y ese camino no es raro:
  // `traerPronostico` está hecho a propósito para devolver el guardado cuando
  // no hay señal, que es lo normal en el rancho. Se abría la app el día 20 con
  // el pronóstico del 8 y ofrecía "el martes 8, de 6 de la mañana a 8 de la
  // noche" — que además se lee como el martes que viene.
  const alcanzan = hoy ? p.dias.filter((d) => d.dia >= hoy) : p.dias;
  if (hoy && alcanzan.length === 0) {
    const viejo = diasEntre(ultimo, hoy);
    return {
      ok: false, tipo, ventanas: [], dias: [], bloquea: false, vencido: true,
      dice: `Este pronóstico va del ${primero} al ${ultimo} y hoy es ${hoy}: ya se venció` +
        (viejo === null ? "" : ` hace ${viejo} día(s)`) +
        `. Las horas buenas de esos días ya pasaron y no se ofrecen como si fueran las de mañana. Baja el pronóstico otra vez cuando haya señal.`,
    };
  }
  const elegidos = alcanzan.slice(0, cuantos).map((d) => d.dia);

  const evaluadas = p.horas
    .filter((h) => elegidos.includes(h.dia) && h.h >= horaInicio && h.h <= horaFin)
    .map((h) => revisarHora(h, p.horas, reglas));

  const ventanas = agruparVentanas(evaluadas).map((v) => vestirVentana(v, hoy));
  const sinSaber = evaluadas.filter((e) => e.puede === null);

  // "Los próximos N días" es una afirmación sobre el calendario, y sin saber
  // qué día es hoy no se puede hacer: se dicen los días con su nombre.
  const cuales = hoy
    ? `los próximos ${elegidos.length} día(s)`
    : `los días que trae el pronóstico (del ${elegidos[0]} al ${elegidos[elegidos.length - 1]})`;

  return {
    ok: true,
    tipo,
    dias: elegidos,
    ventanas,
    horasMiradas: evaluadas.length,
    // "No hay ventana" y "no se alcanza a ver" son cosas distintas y se dicen
    // distinto: la primera se resuelve esperando, la segunda bajando de nuevo
    // el pronóstico.
    sinSaber: sinSaber.length,
    bloquea: false,
    dice: ventanas.length > 0
      ? `Para ${reglas.etiqueta}, las horas buenas de ${cuales}: ` + ventanas.map((v) => v.dice).join(" ")
      : sinSaber.length > 0
        ? `No se encontró ninguna ventana buena para ${reglas.etiqueta} en ${cuales}, y de ${sinSaber.length} hora(s) falta el dato. No es lo mismo que decir que no hay: de esas horas no se sabe.`
        : `En ${cuales} no hay ninguna hora buena para ${reglas.etiqueta}: ` +
          (unicos(evaluadas.flatMap((e) => e.razones))[0] || "el clima no da") + ".",
  };
}

/* ════════════ 4 · LAS ALERTAS DEL CLIMA ════════════ */

// Heladas, granizo, viento fuerte y lluvia que deja la parcela intransitable.
// Cada una con CUÁNTA ANTICIPACIÓN, que es lo único que la vuelve útil: una
// helada avisada el domingo no sirve de nada.
//
// Como en las ventanas de reentrada de lectura.js, hay tres colores y el
// tercero es aparte: rojo (peligro), ámbar (estorba) y azul (NO SE SABE).
// "No sé" no es una alarma de peligro, es una de dato faltante, y confundirlas
// enseña a ignorar las dos.
//
// ─────────────────────────────────────────────────────────────
// DESDE DÓNDE SE CUENTA LA ANTICIPACIÓN
// ─────────────────────────────────────────────────────────────
// Desde AHORA, que es la hora en que la persona está mirando la pantalla. Se
// contaba desde el arranque del pronóstico —la medianoche del día en que se
// bajó—, y así a las seis de la tarde un granizo de las ocho de la mañana
// decía "faltan 8 hora(s)" cuando había caído hacía diez.
//
//   · `ahora` es una marca local como las del pronóstico: "2026-09-08T18:00".
//     Si no se dice, se toma la del aparato (igual que `fechaLocal()` en el
//     resto de la casa). En las pruebas siempre se pasa a mano.
//   · Si sólo se dice `hoy` (el día, sin la hora), la anticipación se da en
//     DÍAS y no en horas: de un día no se saca una hora sin inventarla.
//   · Lo que ya pasó se dice que ya pasó, y se aparta: una helada de esta
//     madrugada arriba de la pantalla en rojo no es un aviso, es historia — y
//     los rojos que no sirven enseñan a ignorar los rojos.
export function alertasDelClima(pronostico, { ahora = null, desde = null, hoy = null } = {}) {
  const p = interpretarPronostico(pronostico);
  if (!p.ok) {
    return {
      ok: false, alertas: [], pendientes: [], pasadas: [], rojas: [], ambar: [], sinDato: [], bloquea: false,
      dice: `${p.porque} Que no haya alertas en pantalla no quiere decir que no venga una helada: quiere decir que no hay pronóstico.`,
    };
  }

  // LA TRAMPA DE LA HORA TAMBIÉN SE ATRAPA AQUÍ.
  //
  // Antes esta función no miraba `horaLocal` —sólo `p.ok`—, y como el plan del
  // día pone las alertas al frente, lo primero y más grande que se leía era
  // "lo más frío a las 6 de la mañana" cuando a ras de Zacatecas eso era la
  // medianoche, seis horas antes.
  //
  // Pero una helada NO se calla por un problema de zona horaria: eso es
  // seguridad del cultivo. Lo que se calla es LA HORA, que es lo que no consta.
  // El día sí, y con eso el chile se cubre.
  const horaConfiable = p.horaLocal === true;
  const avisos = horaConfiable ? [] : [p.avisos[0]];

  const marca = ahora || desde || (hoy ? null : ahoraLocal());
  const diaDeHoy = hoy || (marca ? String(marca).slice(0, 10) : null);
  const conHora = traeHora(marca);

  // Tres formas de contestar "¿cuánto falta?", y ninguna inventa la que no se
  // puede: horas cuando se sabe la hora de los dos lados, días cuando sólo se
  // sabe el día, y nada —dicho con todas sus letras— cuando no se sabe ni eso.
  function anticipacion(cuando) {
    if (conHora && traeHora(cuando)) {
      const hrs = horasEntre(marca, cuando);
      if (hrs !== null) {
        return {
          horas: hrs, dias: null, yaPaso: hrs < 0,
          dice: hrs > 0 ? ` (faltan ${hrs} hora(s))`
            : hrs === 0 ? " (está pasando)"
              : ` (ya pasó hace ${-hrs} hora(s))`,
        };
      }
    }
    const ds = diaDeHoy ? diasEntre(diaDeHoy, String(cuando).slice(0, 10)) : null;
    if (ds === null) {
      return { horas: null, dias: null, yaPaso: false, dice: " (no se dijo qué hora es, así que no se sabe cuánto falta)" };
    }
    return {
      horas: null, dias: ds, yaPaso: ds < 0,
      dice: ds > 0 ? ` (faltan ${ds} día(s))` : ds === 0 ? " (es hoy)" : ` (fue hace ${-ds} día(s))`,
    };
  }

  // Una alerta se arma siempre igual: se le pregunta cuánto falta y se le pega
  // la respuesta a la frase. Así ninguna se queda sin ese dato ni lo calcula
  // por su cuenta contra otra base.
  const alertas = [];
  const sinDato = [];
  // `texto` es el aviso; `cola` es el por qué importa, que va DESPUÉS de la
  // anticipación para que el número quede pegado al hecho y no en medio de la
  // explicación.
  const anotar = ({ que, gravedad, dia, cuando, valor = null, medida = null, texto, cola = "" }) => {
    const a = anticipacion(cuando);
    alertas.push({
      que, gravedad, dia, cuando, valor, medida,
      horasDeAviso: a.horas, diasDeAviso: a.dias, yaPaso: a.yaPaso,
      dice: `${texto}${a.dice}.${cola ? ` ${cola}` : ""}`,
    });
  };

  for (const d of p.dias) {
    const cuandoDia = diaEnPalabras(d.dia, diaDeHoy);
    // Cuando la hora no es de fiar, la alerta se ancla al DÍA: ni la marca de
    // tiempo ni la frase mencionan una hora que no consta.
    const horaDe = (h) => (horaConfiable && h ? h : null);
    const marcaDe = (h) => (horaConfiable && h ? h.hora : d.dia);

    // ── Helada. La hora la da la hora más fría del día; si el pronóstico sólo
    //    trae el resumen, se dice el día y se dice que no se sabe la hora.
    if (d.tempMin === null) {
      sinDato.push({
        que: "helada", gravedad: "azul", dia: d.dia, cuando: d.dia, horasDeAviso: null, diasDeAviso: null,
        dice: `De ${cuandoDia} no se sabe la temperatura mínima, así que NO se puede decir que no vaya a helar.`,
      });
    } else if (d.tempMin <= UMBRALES.riesgoDeHelada) {
      const masFria = horaDe(d.horas.filter((h) => h.temp !== null).sort((a, b) => a.temp - b.temp)[0] || null);
      const segura = d.tempMin <= UMBRALES.heladaSegura;
      anotar({
        que: "helada", gravedad: segura ? "roja" : "ambar", dia: d.dia,
        cuando: marcaDe(masFria), valor: d.tempMin,
        texto: `${segura ? "HELADA" : "Riesgo de helada"} ${cuandoDia}: ${d.tempMin}°` +
          (masFria ? `, lo más frío a las ${horaEnPalabras(masFria.h)}` : ", sin saber a qué hora"),
        cola: "El chile no aguanta una helada y al ajo le quema la hoja." +
          (segura ? "" : " A dos metros marca 3°, pero a ras de suelo siempre hace más frío."),
      });
    }

    // ── Granizo. Sólo cuando el pronóstico lo dice con su nombre (96 y 99).
    const conGranizo = d.codigos.filter((c) => CODIGOS_CON_GRANIZO.includes(c));
    if (conGranizo.length > 0) {
      const hora = horaDe(d.horas.find((h) => CODIGOS_CON_GRANIZO.includes(h.codigo)) || null);
      anotar({
        que: "granizo", gravedad: "roja", dia: d.dia, cuando: marcaDe(hora),
        texto: `Granizo ${cuandoDia}${hora ? ` alrededor de las ${horaEnPalabras(hora.h)}` : ""}`,
      });
    } else if (d.codigos.includes(95)) {
      // Tormenta NO es granizo. Decirle granizo a una tormenta es la clase de
      // alarma falsa que enseña a ignorar las alarmas.
      const hora = horaDe(d.horas.find((h) => h.codigo === 95) || null);
      anotar({
        que: "tormenta", gravedad: "ambar", dia: d.dia, cuando: marcaDe(hora),
        texto: `Tormenta eléctrica ${cuandoDia}${hora ? ` alrededor de las ${horaEnPalabras(hora.h)}` : ""}`,
        cola: "El pronóstico dice tormenta, no dice granizo.",
      });
    }

    // ── Viento fuerte.
    //
    // LA RÁFAGA Y EL VIENTO SOSTENIDO SON DOS MEDICIONES DISTINTAS, y la
    // ráfaga siempre es más alta. Antes se tomaba `rafagaMax ?? vientoMax` y el
    // número salía siempre con el nombre "ráfagas de X km/h": quien decide si
    // amarra la lona o baja al de la escalera oía un número de ráfaga que en
    // realidad era el viento sostenido, y la ráfaga de verdad pudo ser el doble.
    // Cada número sale con el nombre de lo que se midió.
    if (d.rafagaMax === null && d.vientoMax === null) {
      sinDato.push({
        que: "viento", gravedad: "azul", dia: d.dia, cuando: d.dia, horasDeAviso: null, diasDeAviso: null,
        dice: `De ${cuandoDia} no se sabe el viento.`,
      });
    } else {
      const esRafaga = d.rafagaMax !== null;
      const valor = esRafaga ? d.rafagaMax : d.vientoMax;
      if (valor >= UMBRALES.vientoFuerte) {
        const cual = (h) => (esRafaga ? h.rafaga : h.viento);
        const hora = horaDe(d.horas.filter((h) => cual(h) !== null).sort((a, b) => cual(b) - cual(a))[0] || null);
        anotar({
          que: "viento fuerte", gravedad: valor >= UMBRALES.vientoMuyFuerte ? "roja" : "ambar",
          dia: d.dia, cuando: marcaDe(hora), valor,
          medida: esRafaga ? "ráfaga" : "viento sostenido",
          texto: `Viento fuerte ${cuandoDia}: ` +
            (esRafaga ? `ráfagas de ${valor} km/h` : `viento sostenido de ${valor} km/h`) +
            (hora ? ` hacia las ${horaEnPalabras(hora.h)}` : ""),
          cola: esRafaga ? "" : "De la ráfaga no hay dato, y la ráfaga siempre pega más fuerte que el sostenido.",
        });
      }
    }

    // ── Lluvia que estorba: la terracería se vuelve intransitable y la
    //    camioneta no entra a la parcela.
    if (d.lluviaMm === null) {
      sinDato.push({
        que: "lluvia", gravedad: "azul", dia: d.dia, cuando: d.dia, horasDeAviso: null, diasDeAviso: null,
        dice: `De ${cuandoDia} no se sabe cuánta lluvia viene.`,
      });
    } else if (d.lluviaMm >= UMBRALES.lluviaQueEstorba) {
      anotar({
        que: "lluvia fuerte", gravedad: d.lluviaMm >= UMBRALES.lluviaQueParaTodo ? "roja" : "ambar",
        dia: d.dia, cuando: d.dia, valor: d.lluviaMm,
        texto: `Lluvia fuerte ${cuandoDia}: ${d.lluviaMm} mm` +
          (d.lluviaCompleta ? "" : ` (medidos en ${d.horasConLluvia} de las 24 horas, así que es un piso)`),
        cola: "Con eso la terracería se pone intransitable y la parcela no se puede andar.",
      });
    }
  }

  alertas.sort((a, b) => (String(a.cuando) < String(b.cuando) ? -1 : 1));
  // Lo que ya pasó se aparta de lo que viene. Sigue en la lista —para eso está
  // `alertas`, y saber que ayer granizó es información—, pero no se cuenta
  // entre los rojos ni encabeza la pantalla.
  const pendientes = alertas.filter((a) => !a.yaPaso);
  const pasadas = alertas.filter((a) => a.yaPaso);
  const rojas = pendientes.filter((a) => a.gravedad === "roja");
  const ambar = pendientes.filter((a) => a.gravedad === "ambar");

  const cola = [
    pasadas.length ? `${pasadas.length} aviso(s) de este pronóstico ya pasaron.` : null,
    sinDato.length && pendientes.length ? `De ${sinDato.length} cosa(s) falta el dato.` : null,
  ].filter(Boolean).join(" ");

  return {
    ok: true, alertas, pendientes, pasadas, rojas, ambar, sinDato,
    desde: marca, hoy: diaDeHoy, horaConfiable, avisos, bloquea: false,
    dice: [
      avisos[0] || null,
      pendientes.length === 0
        ? (sinDato.length > 0
          ? `Ninguna alerta en lo que se alcanza a ver, pero de ${sinDato.length} cosa(s) falta el dato.`
          : pasadas.length > 0
            ? "Ninguna alerta por delante."
            : "Ninguna alerta en los días que trae el pronóstico.")
        : pendientes.map((a) => a.dice).join(" "),
      cola || null,
    ].filter(Boolean).join(" "),
  };
}

/* ════════════ 5 · ¿HACE FALTA REGAR? ════════════ */

// Si va a llover suficiente en los próximos días, regar hoy es tirar agua y
// diésel. Pero la app NO dice "no riegues": dice cuánta agua viene, cuándo se
// regó por última vez, y quién decide es quien ve el suelo.
//
// Si no hay dato del último riego, lo DICE — y no lo trata como si se hubiera
// regado ayer ni como si nunca se hubiera regado.
export function riegoNecesario({
  pronostico, ultimoRiego = null, hoy = null, dias = 3,
  cadaDias = null, mmQueSustituyenUnRiego = UMBRALES.mmQueSustituyenUnRiego,
} = {}) {
  const dia = hoy || fechaLocal();
  const hasta = sumarDias(dia, dias);
  const diasSinRiego = ultimoRiego ? diasEntre(ultimoRiego, dia) : null;
  const cada = num(cadaDias);

  const base = {
    necesario: null, bloquea: false,
    lluviaEsperadaMm: null, diasConDato: 0, diasSinDato: 0,
    diasFueraDelPronostico: 0, diasIncompletos: 0,
    desde: dia, hasta, ultimoRiego, diasSinRiego, cadaDias: cada,
    avisos: [],
  };

  const p = interpretarPronostico(pronostico);
  if (!p.ok) {
    return {
      ...base,
      porque: `${p.porque} Sin pronóstico no se sabe si la lluvia va a hacer el trabajo del riego.` +
        (diasSinRiego === null
          ? " Tampoco se sabe cuándo se regó por última vez."
          : ` Lo que sí se sabe: la última vez que se regó fue hace ${diasSinRiego} día(s), el ${ultimoRiego}.`),
    };
  }

  // LA VENTANA QUE SE PIDIÓ Y LA QUE EL PRONÓSTICO ALCANZA A CUBRIR NO SON LA
  // MISMA COSA.
  //
  // Se preguntaba por cuatro días, el pronóstico traía tres, y la frase
  // anunciaba los cuatro: "del 8 al 11 se esperan 0 mm", con `diasSinDato: 0` y
  // sin un solo aviso. Del día 11 nadie miró nada. Y con la lluvia justo en el
  // borde —los 15 mm que sustituyen un riego— ese día decide si se prende la
  // bomba. Aquí se dicen los días que faltaron, con su nombre.
  const pedidos = [];
  for (let d0 = dia; d0 <= hasta; d0 = sumarDias(d0, 1)) pedidos.push(d0);
  if (pedidos.length === 0) pedidos.push(dia);

  const enLaVentana = p.dias.filter((d) => d.dia >= dia && d.dia <= hasta);
  const cubiertos = enLaVentana.map((d) => d.dia);
  const fuera = pedidos.filter((d) => !cubiertos.includes(d));

  const conDato = enLaVentana.filter((d) => d.lluviaMm !== null);
  const sinDato = enLaVentana.length - conDato.length;
  // Un día medido a medias no es un día completo. Sus milímetros son un PISO:
  // sirven para decir "por lo menos llovió tanto", nunca para decir "no llovió
  // más".
  const parciales = conDato.filter((d) => d.lluviaCompleta === false);
  const mm = conDato.length > 0 ? sumaDe(conDato.map((d) => d.lluviaMm)) : null;
  const masMojado = conDato.slice().sort((a, b) => b.lluviaMm - a.lluviaMm)[0] || null;

  const datos = {
    ...base, lluviaEsperadaMm: mm, diasConDato: conDato.length, diasSinDato: sinDato,
    diasFueraDelPronostico: fuera.length, diasIncompletos: parciales.length,
  };
  const avisos = [];
  if (sinDato > 0) {
    avisos.push(`De ${sinDato} de los ${enLaVentana.length} días que se miraron no se sabe la lluvia, así que ${mm === null ? "no hay" : "esos milímetros son"} una cuenta incompleta.`);
  }
  if (fuera.length > 0 && enLaVentana.length > 0) {
    avisos.push(`Se preguntó del ${dia} al ${hasta}, pero el pronóstico sólo llega al ${cubiertos[cubiertos.length - 1]}: del ${fuera.join(", ")} nadie miró nada.`);
  }
  if (parciales.length > 0) {
    avisos.push(`De ${parciales.length} día(s) sólo se midieron algunas horas de lluvia (${parciales.map((d) => `${d.dia}: ${d.horasConLluvia} de 24`).join("; ")}), así que esos milímetros son un piso, no el total del día.`);
  }
  if (enLaVentana.length === 0) {
    avisos.push(`El pronóstico no llega del ${dia} al ${hasta} (va del ${p.desde} al ${p.hasta}).`);
  }

  // Todo lo que se afirme sobre la lluvia se dice del rango QUE SÍ SE MIRÓ, no
  // del que se preguntó.
  const rangoVisto = cubiertos.length
    ? `Del ${dia} al ${cubiertos[cubiertos.length - 1]}`
    : `Del ${dia} al ${hasta}`;
  const recorte = (fuera.length > 0 && cubiertos.length > 0)
    ? ` (se preguntó hasta el ${hasta}; de ${fuera.length} día(s) el pronóstico no alcanza)`
    : "";
  const piso = parciales.length > 0
    ? ` De ${parciales.length} día(s) sólo se midieron algunas horas: esos milímetros son un piso.`
    : "";

  const cuandoSeRego = diasSinRiego === null
    ? "No se sabe cuándo se regó por última vez"
    : `Se regó hace ${diasSinRiego} día(s), el ${ultimoRiego}`;

  // ── Viene bastante agua: eso sí se puede afirmar, venga de donde venga el
  //    calendario de riego. Lo que NO se hace es ordenar que no se riegue.
  if (mm !== null && mm >= mmQueSustituyenUnRiego) {
    if (diasSinRiego !== null && cada !== null && diasSinRiego > cada + dias) {
      avisos.push(`Ojo: lleva ${diasSinRiego} día(s) sin riego y la lluvia buena llega hasta el ${masMojado?.dia}. Puede que la planta no aguante hasta entonces — eso lo ves tú en el suelo, no el pronóstico.`);
    }
    return {
      ...datos, necesario: false, avisos,
      porque: `${rangoVisto} se esperan ${mm} mm${recorte}` +
        (masMojado ? `, el grueso el ${masMojado.dia} (${masMojado.lluviaMm} mm)` : "") +
        `. Arriba de ${mmQueSustituyenUnRiego} mm la lluvia moja como un riego, así que regar hoy sería tirar agua y diésel.${piso} ${cuandoSeRego}. Tú ves el suelo; el pronóstico nomás dice el agua que viene.`,
    };
  }

  // Aquí NO alcanzan los milímetros medidos. Y como puede que falten días o
  // falten horas, la frase lo carga: decir "se esperan 0 mm" de una ventana
  // recortada es afirmar sobre lo que nadie miró.
  const loQueViene = mm === null
    ? "Del pronóstico no se alcanza a saber cuánta lluvia viene"
    : `${rangoVisto} se esperan ${mm} mm, que no mojan lo que moja un riego (${mmQueSustituyenUnRiego} mm)${recorte}`;

  // ── No viene agua suficiente. Para decir "ya toca" hacen falta LOS DOS
  //    datos: cuándo se regó y cada cuánto toca. Si falta uno, se dice cuál —
  //    inventar un calendario de riego es exactamente lo que este sistema no
  //    hace.
  if (diasSinRiego === null) {
    return {
      ...datos, necesario: null, avisos,
      porque: `No se sabe cuándo se regó esta parcela por última vez, así que no se puede decir si ya toca. ${loQueViene}.${piso} Captura el último riego y la respuesta sale sola.`,
    };
  }
  if (cada === null) {
    return {
      ...datos, necesario: null, avisos,
      porque: `${cuandoSeRego}, pero no se ha dicho cada cuántos días se riega este cultivo, así que no se puede decir si ya toca. ${loQueViene}.${piso}`,
    };
  }
  if (mm === null) {
    avisos.push("El calendario dice que ya toca, pero de la lluvia que viene no se sabe: puede que llueva y se ahorre el riego.");
  }
  return {
    ...datos,
    necesario: diasSinRiego >= cada,
    avisos,
    porque: diasSinRiego >= cada
      ? `${cuandoSeRego} y aquí se riega cada ${cada}. ${loQueViene}.${piso} Por calendario ya toca.`
      : `${cuandoSeRego} y aquí se riega cada ${cada}: todavía no toca. ${loQueViene}.${piso}`,
  };
}

/* ════════════ EL COPILOTO: TODO JUNTO EN UNA LÍNEA ════════════ */

// Lo que se enseña arriba de la pantalla en la mañana. No es una función
// nueva: junta las de arriba en el orden en que importan — primero lo que
// pone en riesgo la cosecha o a la gente, después las horas buenas.
// `ahora` se pasa hasta las alertas para que la anticipación se cuente desde
// la hora en que se está mirando la pantalla, no desde donde arranca el
// pronóstico. Si sólo se dice `hoy`, la anticipación sale en días — que es
// menos preciso, pero no es falso.
export function planDelDia({ pronostico, hoy = null, ahora = null, tipo = "fumigar", dias = 2 } = {}) {
  const p = interpretarPronostico(pronostico);
  const marca = ahora || (hoy ? null : ahoraLocal());
  const dia = hoy || (marca ? String(marca).slice(0, 10) : fechaLocal());
  if (!p.ok) {
    return {
      ok: false, alertas: [], ventanas: [], bloquea: false,
      dice: `${p.porque} El día se planea igual, nomás sin el clima de copiloto.`,
    };
  }
  const al = alertasDelClima(p, { ahora: marca, hoy: dia });
  const ven = ventanasParaAplicar(p, dias, { tipo, hoy: dia });
  // Sólo lo que viene por delante encabeza la pantalla: un granizo de esta
  // mañana en rojo arriba de todo enseña a ignorar el rojo.
  const urgentes = [...al.rojas, ...al.ambar];
  return {
    ok: true,
    bloquea: false,
    alertas: al.alertas, rojas: al.rojas, pasadas: al.pasadas, sinDato: al.sinDato,
    ventanas: ven.ventanas,
    // `unicos` porque el aviso de la zona horaria lo devuelven las alertas y
    // las ventanas: dicho dos veces en la misma línea se lee como un error.
    dice: unicos([
      // Si las horas de este pronóstico no son de fiar, eso va PRIMERO: es lo
      // que le quita el piso a todo lo demás que se lee abajo.
      al.horaConfiable ? null : al.avisos[0],
      urgentes.length ? urgentes.map((a) => a.dice).join(" ") : null,
      ven.dice,
      al.sinDato.length ? `De ${al.sinDato.length} cosa(s) falta el dato del clima.` : null,
    ].filter(Boolean)).join(" "),
  };
}

/* ════════════════════════════════════════════════════════════
   ██  LO IMPURO — DE AQUÍ PARA ABAJO SE TOCA LA RED Y EL
   ██  ALMACENAMIENTO DEL NAVEGADOR. NO SE PRUEBA CON node --test.
   ══════════════════════════════════════════════════════════════
   Lo que sí está probado de esta parte es lo que se pudo dejar puro:
   `urlDePronostico` (que la petición pida lo correcto) y `describirEdad`
   (que un pronóstico viejo no se disfrace de fresco).
   ════════════════════════════════════════════════════════════ */

export const ZONA = "America/Mexico_City";
export const LLAVE_CLIMA = "agro_clima_v1";

// Sólo lo que se usa. Pedirle a Open-Meteo veinte variables que nadie mira es
// bajar de más en un teléfono que anda con la señal del rancho.
//
// Las unidades van ESCRITAS aunque sean las de fábrica: si algún día cambiara
// el valor por omisión, un umbral de 15 km/h se estaría comparando contra
// millas por hora y la app diría que se puede fumigar con el doble de viento.
export function urlDePronostico({ lat, lon, dias = 7 } = {}) {
  const la = num(lat), lo = num(lon);
  if (la === null || lo === null) return null;
  const q = new URLSearchParams({
    latitude: String(la),
    longitude: String(lo),
    hourly: "temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max",
    // La hora de aquí, pedida de una vez. Así las horas llegan listas y nadie
    // tiene que convertirlas — que es donde se corren seis.
    timezone: ZONA,
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
    forecast_days: String(Math.max(1, Math.min(16, parseInt(dias, 10) || 7))),
  });
  return `https://api.open-meteo.com/v1/forecast?${q.toString()}`;
}

// De cuándo es el pronóstico que se está enseñando.
//
// Esto es la mitad del valor de guardar el pronóstico: enseñar el de antier
// como si fuera el de hoy es peor que no enseñar ninguno, porque el de antier
// se ve igualito y nadie sospecha.
export function describirEdad({ guardadoEn, ahora } = {}) {
  const nada = (dice) => ({ horas: null, dias: null, fresco: null, sirve: null, dice });
  if (!guardadoEn) return nada("No se sabe de cuándo es este pronóstico. Trátalo como si no lo tuvieras.");
  const t0 = new Date(guardadoEn).getTime();
  const t1 = ahora ? new Date(ahora).getTime() : Date.now();
  if (!isFinite(t0) || !isFinite(t1)) return nada("No se entiende la fecha de este pronóstico, así que no se sabe si sirve.");

  const horas = Math.floor((t1 - t0) / 3600000);
  if (horas < 0) {
    return { horas, dias: null, fresco: false, sirve: false, dice: "Este pronóstico está fechado en el futuro. Algo anda mal con la hora del aparato: no es de fiar." };
  }
  const dias = Math.floor(horas / 24);
  return {
    horas, dias,
    fresco: horas < 3,
    // Pasado un día ya no dice qué va a pasar hoy. Sirve para ver qué venía,
    // no para planear la faena.
    sirve: horas < 24,
    dice: horas < 1
      ? "Pronóstico de hace menos de una hora."
      : horas < 24
        ? `Este pronóstico es de hace ${horas} hora(s).`
        : `Este pronóstico es de hace ${dias} día(s): ya no dice qué va a pasar hoy. Sirve para ver qué venía, no para planear.`,
  };
}

function guardarPronostico(pronostico, { lat, lon, ahora } = {}) {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(LLAVE_CLIMA, JSON.stringify({
      guardadoEn: ahora || new Date().toISOString(),   // marca de tiempo: UTC, como manda la casa
      lat: num(lat), lon: num(lon),
      pronostico,
    }));
    return true;
  } catch { return false; }
}

export function leerPronosticoGuardado() {
  try {
    if (typeof localStorage === "undefined") return null;
    const crudo = localStorage.getItem(LLAVE_CLIMA);
    if (!crudo) return null;
    const g = JSON.parse(crudo);
    return g && g.pronostico ? g : null;
  } catch { return null; }
}

// Baja el pronóstico. Falla SUAVE: sin internet la app no se rompe — enseña
// el último que se bajó, diciendo de cuándo es, y sigue viva.
//
// Nunca devuelve un pronóstico viejo haciéndolo pasar por fresco: `ok` es
// false, `fresco` es false, y `edad.dice` trae la frase que hay que enseñar
// pegada al pronóstico.
export async function traerPronostico({ lat, lon, dias = 7, segundos = 12, ahora = null } = {}) {
  const url = urlDePronostico({ lat, lon, dias });
  if (!url) {
    return {
      ok: false, fresco: false, pronostico: null, edad: describirEdad({}),
      dice: "No se sabe de qué lugar pedir el clima: falta la ubicación de la parcela (latitud y longitud). No se pide a ciegas.",
    };
  }

  try {
    if (typeof fetch !== "function") throw new Error("este aparato no puede pedir por internet");
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const reloj = ctrl ? setTimeout(() => ctrl.abort(), Math.max(1, segundos) * 1000) : null;
    let r;
    try {
      r = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    } finally {
      if (reloj) clearTimeout(reloj);
    }
    if (!r.ok) throw new Error(`el servicio contestó ${r.status}`);
    const datos = await r.json();
    if (!datos || (!datos.hourly && !datos.daily)) throw new Error("la respuesta vino sin datos");

    const cuando = ahora || new Date().toISOString();
    guardarPronostico(datos, { lat, lon, ahora: cuando });
    return {
      ok: true, fresco: true, pronostico: datos, guardadoEn: cuando,
      edad: describirEdad({ guardadoEn: cuando, ahora: cuando }),
      dice: "Pronóstico recién bajado.",
    };
  } catch (e) {
    const motivo = (e && e.name === "AbortError")
      ? `no contestó en ${segundos} segundos`
      : (e && e.message) || "no se pudo conectar";
    const g = leerPronosticoGuardado();
    if (!g) {
      return {
        ok: false, fresco: false, pronostico: null, edad: describirEdad({}),
        dice: `No se pudo bajar el pronóstico (${motivo}) y no hay ninguno guardado en este aparato. Hoy el clima se ve como siempre se ha visto: saliendo a verlo.`,
      };
    }
    const edad = describirEdad({ guardadoEn: g.guardadoEn, ahora });
    return {
      ok: false, fresco: false, pronostico: g.pronostico, guardadoEn: g.guardadoEn, edad,
      dice: `No se pudo bajar el pronóstico (${motivo}). Éste es el que quedó guardado. ${edad.dice}`,
    };
  }
}
