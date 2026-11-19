// ============================================================
//  AgroGestión — El lector de papeles (la cascada, de gratis a caro)
//
//  Este archivo SÍ toca el mundo: la cámara, el lector de códigos del
//  teléfono y, sólo cuando no queda de otra, la IA. La lógica pura vive en
//  src/lectura.js y ahí están sus pruebas.
//
//  ─────────────────────────────────────────────────────────────
//  LO QUE ES GRATIS Y FUNCIONA SIN SEÑAL (la mayoría de las veces)
//  ─────────────────────────────────────────────────────────────
//  1. El QR de la factura impresa → `BarcodeDetector`, que ya viene en el
//     teléfono. Da el folio fiscal. NO se le hace OCR al total: un 3 leído
//     como 8 sale plausible y equivocado y nadie lo revisa. El QR o está
//     bien o no valida — falla ruidosamente, que es lo que se quiere.
//  2. El XML de un CFDI → `DOMParser`, nativo. Trae TODO exacto: emisor,
//     RFC, conceptos, impuestos, total. Cero lecturas, cero errores.
//  3. El Excel o CSV del banco → `excelLoader.leerExcel`, que ya existe.
//  4. Cualquier texto ya digital → el patrón aprendido de ese proveedor.
//
//  ─────────────────────────────────────────────────────────────
//  LO QUE SÍ CUESTA: LA FOTO DE UN PAPEL
//  ─────────────────────────────────────────────────────────────
//  Y aquí hay que ser claros, porque es fácil prometer de más:
//
//  **El patrón aprendido NO quita la llamada a la IA cuando lo único que
//  hay es una foto.** Para aplicar una regla hace falta texto, y de una
//  foto el texto sale de leerla. Un lector local de imágenes (OCR) pesa
//  megas y el service worker es "red primero": no cabe en teléfonos con
//  internet intermitente. Así que la foto de un papel nuevo pasa por la IA.
//
//  Lo que el patrón SÍ ahorra, y no es poco:
//   · La IA sólo TRANSCRIBE; ya no decide cuál número es el total. Eso lo
//     resuelve la regla local, igual todos los meses. Se acaba la
//     variabilidad de que la misma línea se lea distinto dos veces.
//   · Los campos salen de la transcripción de forma reproducible, y si uno
//     no está, se dice cuál falta en vez de rellenarlo.
//   · El papel que llega como archivo (XML, Excel, PDF con texto) no pasa
//     por la IA NUNCA, ni la primera vez.
//
//  Por eso la recomendación al rancho es la misma que para el banco: pide
//  el XML o el archivo, no la foto. La foto es para lo que no tiene otra.
// ============================================================

import { supabase, supabaseListo } from "./supabase";
import {
  clasificar, identificarEmisor, leerConPatron, aprenderPatron,
  uuidDeQR, aNumero, aFecha, normalizar, cobertura, evaluarFoto,
} from "./lectura.js";

/* ════════════ 1 · EL QR, GRATIS Y SIN SEÑAL ════════════ */

// Lee el código QR de una imagen usando el detector que ya trae el teléfono.
// Si el navegador no lo tiene, lo DICE en vez de fallar callada — eso ya nos
// costó una vez con la fuente de los iconos, que nunca se descargaba y nadie
// se enteraba.
export async function leerQR(imagenDataUrl) {
  if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
    return { hay: false, porque: "Este teléfono no trae lector de códigos; hay que leer el papel de otra forma." };
  }
  try {
    const det = new window.BarcodeDetector({ formats: ["qr_code", "code_128", "ean_13"] });
    const img = await cargarImagen(imagenDataUrl);
    const codigos = await det.detect(img);
    if (!codigos || codigos.length === 0) return { hay: false, porque: "No se vio ningún código en la foto." };
    const bruto = codigos[0].rawValue;
    return { hay: true, contenido: bruto, uuid: uuidDeQR(bruto), formato: codigos[0].format };
  } catch (e) {
    return { hay: false, porque: `No se pudo leer el código (${e?.message || e}).` };
  }
}

function cargarImagen(src) {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error("no se pudo abrir la imagen"));
    img.src = src;
  });
}

/* ════════════ 2 · EL XML DEL CFDI, EXACTO Y GRATIS ════════════ */

// Un CFDI en XML no se "lee": se abre. Todos los datos vienen exactos y con
// su nombre. Esto es lo mejor que le puede pasar a un comprobante, y no
// cuesta ni un centavo ni necesita señal.
export function leerXmlCFDI(textoXml) {
  try {
    const doc = new DOMParser().parseFromString(textoXml, "text/xml");
    if (doc.querySelector("parsererror")) return { ok: false, dice: "El archivo XML no se pudo abrir." };
    const buscar = (n) => doc.getElementsByTagName(n)[0] || doc.getElementsByTagName("cfdi:" + n)[0];
    const comp = doc.documentElement;
    if (!comp || !/Comprobante$/.test(comp.nodeName)) return { ok: false, dice: "El XML no es un CFDI." };
    const emisor = buscar("Emisor");
    const timbre = doc.getElementsByTagName("tfd:TimbreFiscalDigital")[0] || doc.getElementsByTagName("TimbreFiscalDigital")[0];
    const conceptos = [...doc.getElementsByTagName("cfdi:Concepto"), ...doc.getElementsByTagName("Concepto")];

    return {
      ok: true,
      fuente: "xml",     // no costó nada
      tipo: "factura",
      campos: {
        emisor: emisor?.getAttribute("Nombre") || null,
        rfc: emisor?.getAttribute("Rfc") || null,
        uuid: timbre?.getAttribute("UUID") || null,
        fecha: (comp.getAttribute("Fecha") || "").slice(0, 10) || null,
        folio: comp.getAttribute("Folio") || null,
        subtotal: aNumero(comp.getAttribute("SubTotal")),
        total: aNumero(comp.getAttribute("Total")),
        moneda: comp.getAttribute("Moneda") || null,
      },
      renglones: conceptos.map(c => ({
        concepto: c.getAttribute("Descripcion") || "",
        cantidad: aNumero(c.getAttribute("Cantidad")),
        unidad: c.getAttribute("Unidad") || c.getAttribute("ClaveUnidad") || null,
        importe: aNumero(c.getAttribute("Importe")),
      })),
      noSeLeyo: [],
      avisos: [],
    };
  } catch (e) {
    return { ok: false, dice: `No se pudo abrir el XML (${e?.message || e}).` };
  }
}

/* ════════════ 3 · LA IA, SÓLO CUANDO NO QUEDA DE OTRA ════════════ */

// Llama a la Edge Function. La llave vive allá, nunca aquí: cualquier
// variable VITE_* queda dentro del archivo que Vercel le sirve a quien sea.
//
// Si la función no está instalada, NO se rompe nada: devuelve el porqué y la
// app ofrece capturar a mano. La foto ya se guardó de todos modos.
export async function leerConIA({ imagenBase64, tipoMedio, tipo, pistaEmisor }) {
  if (!supabaseListo) {
    return { ok: false, motivo: "sin_nube", dice: "No hay conexión con la nube. Puedes capturar a mano; la foto se guarda igual." };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, motivo: "sin_senal", dice: "Leer con IA necesita señal. La foto queda guardada y se puede leer cuando haya internet." };
  }
  try {
    const { data, error } = await supabase.functions.invoke("leer-papel", {
      body: { imagenBase64, tipoMedio, tipo, pistaEmisor },
    });
    if (error) {
      return { ok: false, motivo: "fallo", dice: `No se pudo leer con IA (${error.message}). Puedes capturar a mano; la foto se guarda igual.` };
    }
    if (!data || data.error) {
      return { ok: false, motivo: data?.error || "fallo", dice: data?.dice || "No se pudo leer la foto." };
    }
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, motivo: "fallo", dice: `No se pudo leer con IA (${e?.message || e}). Puedes capturar a mano; la foto se guarda igual.` };
  }
}

/* ════════════ LA CASCADA ════════════ */

// Campos que se esperan de cada tipo de papel. Sirven para decir CUÁLES
// faltan por su nombre, en vez de un porcentaje que no le sirve a nadie.
export const CAMPOS_ESPERADOS = {
  ticket: ["emisor", "fecha", "total"],
  factura: ["emisor", "rfc", "fecha", "total", "uuid"],
  remision: ["emisor", "fecha"],
  horometro: ["lectura"],
  etiqueta_agroquimico: ["nombre", "ingredienteActivo", "reentradaDias", "carenciaDias"],
  estado_cuenta: ["banco", "saldoInicial", "saldoFinal"],
  "por identificar": [],
};

// Lee un papel de barato a caro. Devuelve SIEMPRE algo que la persona puede
// revisar, incluso cuando no se pudo leer nada.
//
// NO decide: propone. Lo que salga de aquí lo confirma una persona antes de
// convertirse en un gasto, una entrada de inventario o una lectura de
// horómetro.
export async function leerPapel({ imagenDataUrl, textoArchivo, nombreArchivo, patrones = [], nitidez = null, ancho = null, alto = null }) {
  const pasos = [];

  // La foto se guarda SIEMPRE, se lea o no. Nunca se pierde evidencia de un pago.
  const foto = evaluarFoto({ nitidez, ancho, alto });
  if (foto.avisos.length) pasos.push({ paso: "foto", dice: foto.avisos.join(" ") });

  // ── Paso 1: ¿es un archivo con texto? Entonces es gratis y exacto.
  if (textoArchivo && /\.xml$/i.test(nombreArchivo || "")) {
    const xml = leerXmlCFDI(textoArchivo);
    pasos.push({ paso: "xml", dice: xml.ok ? "Se abrió el XML del CFDI: los datos vienen exactos." : xml.dice });
    if (xml.ok) return terminar(xml, patrones, textoArchivo, pasos);
  }
  if (textoArchivo && !nombreArchivo?.match(/\.xml$/i)) {
    const conocido = identificarEmisor(textoArchivo, patrones);
    if (conocido) {
      const r = leerConPatron(conocido, textoArchivo);
      pasos.push({ paso: "patron", dice: `Se leyó con lo aprendido de ${conocido.emisor}: no costó nada ni necesitó señal.` });
      // El emisor y su RFC NO son campos que se busquen en el papel: son las
      // señas por las que se le reconoció. Si se dejaran vacíos, la pantalla
      // diría "no se leyó el proveedor" justo del proveedor que acaba de
      // identificar — y eso es decir una cosa por otra.
      const campos = { ...r.campos, emisor: conocido.emisor };
      if (conocido.rfc) campos.rfc = conocido.rfc;
      return terminar({ ok: true, ...r, campos, transcripcion: textoArchivo, noSeLeyo: r.faltantes, avisos: [] }, patrones, textoArchivo, pasos);
    }
  }

  // ── Paso 2: ¿trae QR? El folio fiscal es gratis y no se equivoca callado.
  let qr = null;
  if (imagenDataUrl) {
    qr = await leerQR(imagenDataUrl);
    pasos.push({ paso: "qr", dice: qr.hay ? (qr.uuid ? `Se leyó el folio fiscal del QR: ${qr.uuid}` : "Se leyó un código, pero no trae folio fiscal.") : qr.porque });
  }

  // ── Paso 3: la foto. Aquí sí se paga, y sólo la primera vez de cada formato.
  if (!imagenDataUrl) {
    if (textoArchivo) {
      // Hay texto, pero de un proveedor que todavía no se conoce. No se manda
      // a la IA: el texto YA está: lo único que falta es que una persona diga
      // una vez cuál número es cuál. De ahí en adelante se lee solo, gratis y
      // sin señal. Enseñarle sale más barato que preguntarle a un modelo.
      const clase = clasificar(textoArchivo, { patronesConocidos: patrones });
      pasos.push({
        paso: "sin patron",
        dice: "Este proveedor todavía no se conoce. Captura los datos esta vez y, a partir de la próxima, su papel se lee solo.",
      });
      return terminar({
        ok: true, fuente: "texto-nuevo", tipo: clase.tipo,
        campos: {}, renglones: [],
        noSeLeyo: CAMPOS_ESPERADOS[clase.tipo] || CAMPOS_ESPERADOS.ticket,
        avisos: [],
      }, patrones, textoArchivo, pasos);
    }
    return {
      ok: false, tipo: "por identificar", campos: {}, noSeLeyo: [], pasos,
      dice: "No hay foto ni archivo con texto que leer.",
    };
  }

  const clase = clasificar(textoArchivo || "", { patronesConocidos: patrones, contenidoQR: qr?.contenido });
  const base64 = String(imagenDataUrl).split(",")[1] || "";
  const tipoMedio = (String(imagenDataUrl).match(/^data:([^;]+);/) || [])[1] || "image/jpeg";

  const ia = await leerConIA({
    imagenBase64: base64, tipoMedio,
    tipo: clase.tipo === "por identificar" ? "ticket" : clase.tipo,
    pistaEmisor: clase.emisor,
  });

  if (!ia.ok) {
    pasos.push({ paso: "ia", dice: ia.dice });
    return {
      ok: false, tipo: clase.tipo, campos: qr?.uuid ? { uuid: qr.uuid } : {},
      noSeLeyo: CAMPOS_ESPERADOS[clase.tipo] || [], pasos,
      seGuardaLaFoto: true,
      dice: `${ia.dice} La foto queda guardada en el buzón; se puede capturar a mano o volver a intentar cuando haya señal.`,
    };
  }
  pasos.push({ paso: "ia", dice: "Se leyó con IA porque el formato de este papel todavía no se conocía. La próxima vez de este proveedor ya no hará falta interpretarlo." });

  // Si el QR dio folio fiscal, ese manda sobre lo que se leyó de la imagen:
  // el QR no se equivoca a medias.
  if (qr?.uuid) ia.campos = { ...ia.campos, uuid: qr.uuid };
  return terminar(ia, patrones, ia.transcripcion, pasos);
}

function terminar(lectura, patrones, texto, pasos) {
  const tipo = lectura.tipo || "por identificar";
  const campos = lectura.campos || {};
  // Los campos vienen como valor pelón desde el XML/IA, o como {valor} desde
  // el patrón local. Se normalizan a valor pelón para la pantalla.
  const planos = {};
  for (const [k, v] of Object.entries(campos)) {
    planos[k] = (v && typeof v === "object" && "valor" in v) ? v.valor : v;
  }
  const cob = cobertura(planos, CAMPOS_ESPERADOS[tipo] || []);
  return {
    ok: true, tipo, fuente: lectura.fuente || "patron-local",
    campos: planos,
    renglones: lectura.renglones || [],
    // Se dice CUÁLES faltan, por su nombre. No un porcentaje suelto.
    noSeLeyo: [...new Set([...(lectura.noSeLeyo || []), ...cob.faltan])],
    cobertura: cob,
    avisos: lectura.avisos || [],
    transcripcion: texto || lectura.transcripcion || "",
    pasos,
    seGuardaLaFoto: true,
  };
}

/* ════════════ APRENDER DE LO QUE LA PERSONA CONFIRMÓ ════════════ */

// Se llama DESPUÉS de que una persona revisó y confirmó. Guarda dónde estaba
// cada dato dentro de la transcripción, para que el mes que entra este mismo
// proveedor se resuelva con la regla y no con un modelo.
//
// Devuelve el patrón nuevo, o null si no había con qué aprender. No aprende
// de una lectura que nadie revisó: eso sería aprender de una suposición.
export function aprenderDeLaConfirmacion({ patronPrevio, transcripcion, tipo, camposConfirmados, fuente }) {
  if (!transcripcion || !camposConfirmados) return null;
  const emisor = camposConfirmados.emisor || patronPrevio?.emisor;
  if (!emisor) return null;  // sin emisor no hay a quién atribuirle el patrón

  // De un XML NO se aprenden anclas. Un XML ya viene estructurado: cada dato
  // trae su nombre y se lee exacto siempre. Buscarle "junto a qué palabra
  // estaba el total" dentro del marcado produciría anclas sin sentido
  // (`Moneda="MXN" Total="`) que después se aplicarían a un ticket de papel y
  // leerían cualquier cosa. Más vale no saberlo que aprender mal.
  //
  // Lo que sí se guarda del XML son las SEÑAS —nombre y RFC— para reconocer
  // al proveedor la próxima vez sin preguntarle a nadie qué es este papel.
  if (fuente === "xml") {
    return {
      id: patronPrevio?.id || `pl${Date.now()}`,
      emisor,
      rfc: camposConfirmados.rfc || patronPrevio?.rfc || "",
      tipo: tipo || patronPrevio?.tipo || "factura",
      senas: [...new Set([...(patronPrevio?.senas || []), normalizar(emisor)])],
      // Se conservan las anclas que se hayan aprendido antes de un papel de
      // verdad; simplemente no se agregan las del XML.
      campos: patronPrevio?.campos || {},
      soloSenas: !patronPrevio || Object.keys(patronPrevio.campos || {}).length === 0,
      aciertos: (patronPrevio?.aciertos || 0) + 1,
      correcciones: patronPrevio?.correcciones || 0,
    };
  }

  const patron = aprenderPatron({
    patronPrevio, texto: transcripcion, emisor,
    rfc: camposConfirmados.rfc || patronPrevio?.rfc,
    tipo: tipo || patronPrevio?.tipo,
    // El emisor y el RFC son las SEÑAS para reconocerlo, no campos que leer.
    camposConfirmados: Object.fromEntries(
      Object.entries(camposConfirmados).filter(([k]) => !["emisor", "rfc"].includes(k))
    ),
  });
  if (Object.keys(patron.campos).length === 0) return null;
  return {
    ...patron,
    id: patronPrevio?.id || `pl${Date.now()}`,
    senas: [...new Set([...(patron.senas || []), normalizar(emisor)])],
    aciertos: (patronPrevio?.aciertos || 0) + 1,
  };
}

/* ════════════ LO QUE SE VE DE LA CASCADA ════════════ */

// Para enseñarle a la persona por qué el sistema hizo lo que hizo. Un
// resultado sin explicación sólo se puede obedecer o ignorar.
export const EXPLICA_FUENTE = {
  "xml": "Del XML del CFDI — exacto, gratis y sin señal.",
  "texto-nuevo": "Todavía no se conoce a este proveedor. Captura los datos una vez; a partir de la próxima se leen solos.",
  "patron-local": "Con lo que ya se había aprendido de este proveedor — gratis y sin señal.",
  "ia": "Con IA, porque este formato todavía no se conocía. Al confirmarlo, se aprende.",
};
