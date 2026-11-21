// ════════════════════════════════════════════════════════════════════════
//  IMPORTAR DOCUMENTOS — muchos papeles de un jalón, sin capturarlos a mano
//
//  Aquí están las REGLAS (puras, probadas). Abrir cada archivo —el Excel, el
//  PDF, el Word, el XML— lo hace `importador.js`, que sí toca el navegador.
//
//  Lo que entra: un archivo ya abierto, en una de tres formas:
//    · un CFDI (el XML de una factura o de un recibo de nómina): exacto.
//    · una o varias HOJAS (Excel, CSV, una tabla de un PDF o de un Word).
//    · TEXTO suelto (un PDF o un Word sin tabla).
//  Lo que sale: QUÉ ES (clase), DE CUÁNDO es (periodo) y una lista de
//  PROPUESTAS — nunca un registro hecho. Una persona las confirma.
//
//  Las reglas que no se rompen:
//   1. NO SE INVENTA. Un renglón sin fecha o sin importe legible no se
//      adivina: sale en `descartadas`, con su razón, y el documento queda
//      «por revisar». Una columna que no se reconoce no se supone.
//   2. NO SE DUPLICA. El mismo archivo (misma huella) no entra dos veces. El
//      mismo comprobante (mismo folio fiscal) tampoco, aunque llegue como XML
//      y como PDF. Y un renglón igual a algo ya registrado (fecha, importe y
//      contraparte) se marca como posible duplicado y NO se propone.
//   3. LO HISTÓRICO NO CREA NADA DE HOY. Lo anterior a la fecha de inicio de
//      operaciones entra al HISTÓRICO: sirve para comparar y consultar, y no
//      genera gastos, deudas, pagos, compras ni existencias. Si todavía no hay
//      fecha de inicio declarada, TODO entra como histórico.
//   4. LO POSTERIOR AL ARRANQUE SE PROPONE con cuidado: una factura → un
//      gasto por confirmar. Una nómina o una lista de pagos NUNCA crea pagos
//      (eso es de Pagos al personal, con su permiso): queda como referencia.
//      Las actividades tampoco se crean solas (su mano de obra sale del
//      checador): quedan como referencia.
//   5. LOS CATÁLOGOS (personas, proveedores) se proponen sólo si no existe
//      ya alguien con ese nombre; sin PIN, sin saldos, sin existencias.
//   6. SE APRENDE SÓLO DE LO CONFIRMADO: cuando una persona dice «esta
//      columna es el importe», eso se guarda por la FIRMA de los encabezados
//      y la siguiente hoja igual ya no pregunta.
//   7. LO PERSONAL SE CUIDA: de un recibo de nómina no se guardan CURP, NSS
//      ni cuentas; el RFC de una persona se guarda enmascarado.
// ════════════════════════════════════════════════════════════════════════
import { normalizar, aNumero, aFecha } from "./lectura.js";
import { sumarDinero } from "./calculos.js";
import { nuevoEvento, vigentes } from "./eventos.js";
import { catalogoDeClaves, normalizarClave, formaDe, partirClaves, relacionDeRenglon, clavesPorPreguntar, CLASE_REFERENCIA, canonica } from "./claves.js";
import { leerCatalogos, leerRayaSemanal, periodoDelLibro } from "./excelRayas.js";

export const ESTADOS = {
  recibido: "Recibido, falta abrirlo",
  necesita_lectura: "Es una imagen o un escaneo: falta leerlo",
  por_revisar: "Por revisar: hay algo que la app no pudo decidir",
  propuesto: "Leído: con propuestas por confirmar",
  incorporado: "Incorporado",
  duplicado: "Duplicado: ya estaba",
  sin_uso: "Leído: no trae nada que incorporar",
  descartado: "Descartado por una persona",
  error: "No se pudo abrir",
};
export const CLASES = {
  cfdi_gasto: "Factura recibida (compra o gasto)",
  cfdi_ingreso: "Factura emitida (venta)",
  cfdi_nomina: "Recibo de nómina timbrado",
  cfdi_pago: "Complemento de pago",
  cfdi_otro: "Comprobante fiscal de otro tipo",
  personal: "Lista de personal",
  nomina: "Nómina o lista de pagos al personal",
  raya: "Lista de raya con claves de actividad y de lugar",
  catalogo_claves: "Catálogo de claves de un Excel anterior (referencia histórica)",
  combustible: "Bitácora de combustible",
  actividades: "Actividades agrícolas",
  gastos: "Compras, gastos o pagos",
  proveedores: "Lista de proveedores",
  banco: "Estado de cuenta del banco",
  desconocido: "No se reconoce",
};

/* ════════════ 1 · QUÉ ARCHIVO ES ════════════ */
const POR_EXTENSION = { xml: "xml", xlsx: "excel", xls: "excel", xlsm: "excel", ods: "excel", csv: "csv", tsv: "csv", txt: "texto", pdf: "pdf", docx: "word", doc: "word_viejo", jpg: "imagen", jpeg: "imagen", png: "imagen", webp: "imagen", heic: "imagen", heif: "imagen", tif: "imagen", tiff: "imagen", bmp: "imagen", gif: "imagen" };
export function formatoDe(nombre, mime = "") {
  const ext = (String(nombre || "").match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();
  if (POR_EXTENSION[ext]) return POR_EXTENSION[ext];
  if (/^image\//.test(mime)) return "imagen";
  if (/pdf/.test(mime)) return "pdf";
  if (/xml/.test(mime)) return "xml";
  if (/spreadsheet|excel/.test(mime)) return "excel";
  if (/wordprocessing/.test(mime)) return "word";
  if (/^text\//.test(mime)) return "texto";
  return "otro";
}
// Archivos que el sistema operativo deja regados en una carpeta y no son documentos.
export const esBasura = (nombre) => /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini|~\$[^/]*|\.[^/]*)$/i.test(String(nombre || ""));

/* ════════════ 2 · EL CFDI, SIN NAVEGADOR ════════════ */
// Un CFDI trae todo en atributos: se abre con expresiones, sin `DOMParser`, para poderlo probar y usar en cualquier lado.
const atributos = (etiqueta) => { const o = {}; const re = /([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g; let m; while ((m = re.exec(etiqueta))) o[m[1].toLowerCase()] = desescapar(m[2]); return o; };
const desescapar = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/&amp;/g, "&");
const etiquetas = (xml, nombre) => { const re = new RegExp(`<(?:[A-Za-z0-9]+:)?${nombre}(\\s[^>]*)?/?>`, "g"), r = []; let m; while ((m = re.exec(xml))) r.push(atributos(m[1] || "")); return r; };
export const enmascarar = (rfc) => { const t = String(rfc || "").trim().toUpperCase(); return t.length < 8 ? "" : `${t.slice(0, 4)}…${t.slice(-3)}`; };
const TIPO_CFDI = { I: "ingreso", E: "egreso", T: "traslado", N: "nomina", P: "pago" };

export function leerCfdi(xml) {
  const t = String(xml || "");
  if (!/<(?:[A-Za-z0-9]+:)?Comprobante[\s>]/.test(t)) return { ok: false, dice: "El XML no es un comprobante fiscal (CFDI)." };
  const comp = etiquetas(t, "Comprobante")[0] || {}, emisor = etiquetas(t, "Emisor")[0] || {}, receptor = etiquetas(t, "Receptor")[0] || {}, timbre = etiquetas(t, "TimbreFiscalDigital")[0] || {};
  const total = aNumero(comp.total), tipo = TIPO_CFDI[(comp.tipodecomprobante || "").toUpperCase()] || "otro";
  const conceptos = etiquetas(t, "Concepto").map(c => ({ concepto: c.descripcion || "", cantidad: aNumero(c.cantidad), unidad: c.unidad || c.claveunidad || "", valorUnitario: aNumero(c.valorunitario), importe: aNumero(c.importe), clave: c.claveprodserv || "" }));
  const r = { ok: true, tipo, uuid: (timbre.uuid || "").toUpperCase() || null, fecha: (comp.fecha || "").slice(0, 10) || null, serie: comp.serie || "", folio: comp.folio || "", subtotal: aNumero(comp.subtotal), total, moneda: comp.moneda || "MXN", metodoPago: comp.metodopago || "", formaPago: comp.formapago || "",
    emisor: { nombre: emisor.nombre || "", rfc: (emisor.rfc || "").toUpperCase() }, receptor: { nombre: receptor.nombre || "", rfc: (receptor.rfc || "").toUpperCase() }, conceptos, avisos: [] };
  if (!r.uuid) r.avisos.push("No trae folio fiscal (timbre): puede ser una prefactura. No se toma como comprobante.");
  if (total == null) r.avisos.push("No se pudo leer el total.");
  if (r.moneda && r.moneda !== "MXN" && r.moneda !== "XXX") r.avisos.push(`Está en ${r.moneda}, no en pesos: el importe no se convierte solo.`);
  const nom = etiquetas(t, "Nomina")[0];
  if (nom || tipo === "nomina") {
    r.tipo = "nomina";
    // De la persona: nombre y periodo. NO se guardan CURP, número de seguridad social ni cuentas.
    r.nomina = { fechaPago: (nom?.fechapago || "").slice(0, 10) || null, desde: (nom?.fechainicialpago || "").slice(0, 10) || null, hasta: (nom?.fechafinalpago || "").slice(0, 10) || null, dias: aNumero(nom?.numdiaspagados),
      percepciones: aNumero(nom?.totalpercepciones), deducciones: aNumero(nom?.totaldeducciones), otrosPagos: aNumero(nom?.totalotrospagos), persona: receptor.nombre || "" };
  }
  return r;
}

/* ════════════ 3 · LAS HOJAS: QUÉ COLUMNA ES QUÉ ════════════ */
// Cada campo, con las palabras con que suele venir escrito. Se compara ya normalizado (sin acentos, en mayúsculas).
const PALABRAS = {
  fecha: ["FECHA", "DIA", "FECHA DE PAGO", "FECHA PAGO", "FECHA COMPRA", "FECHA DE CARGA", "F. PAGO"],
  nombre: ["NOMBRE", "TRABAJADOR", "EMPLEADO", "NOMBRE COMPLETO", "NOMBRE DEL TRABAJADOR", "NOMBRE DEL EMPLEADO", "PERSONA", "COLABORADOR", "OPERADOR"],
  puesto: ["PUESTO", "CARGO", "CATEGORIA", "OCUPACION", "FUNCION"],
  sueldo: ["SUELDO", "SALARIO", "SUELDO DIARIO", "SALARIO DIARIO", "SUELDO POR DIA", "PAGO POR DIA", "CUOTA DIARIA", "SD", "SUELDO DIA"],
  ingreso: ["FECHA DE INGRESO", "FECHA INGRESO", "INGRESO", "ALTA", "FECHA DE ALTA", "ANTIGUEDAD DESDE"],
  dias: ["DIAS", "DIAS TRABAJADOS", "DIAS PAGADOS", "JORNADAS"],
  importe: ["IMPORTE", "TOTAL", "MONTO", "NETO", "NETO A PAGAR", "TOTAL A PAGAR", "PAGO", "TOTAL PAGADO", "CANTIDAD PAGADA", "COSTO", "COSTO TOTAL", "IMPORTE TOTAL", "PAGADO"],
  proveedor: ["PROVEEDOR", "EMISOR", "RAZON SOCIAL", "BENEFICIARIO", "A QUIEN", "ESTACION", "GASOLINERA", "NOMBRE O RAZON SOCIAL"],
  concepto: ["CONCEPTO", "DESCRIPCION", "DETALLE", "PRODUCTO", "ARTICULO", "INSUMO", "OBSERVACIONES", "NOTA", "MOTIVO"],
  rfc: ["RFC"],
  telefono: ["TELEFONO", "TEL", "CELULAR"],
  litros: ["LITROS", "LTS", "LT", "L", "CANTIDAD LITROS", "LITROS CARGADOS"],
  vehiculo: ["VEHICULO", "MAQUINA", "MAQUINARIA", "UNIDAD", "TRACTOR", "EQUIPO", "CAMIONETA", "ECONOMICO", "NO. ECONOMICO"],
  horometro: ["HOROMETRO", "HORAS", "ODOMETRO", "KILOMETRAJE", "KM", "LECTURA"],
  parcela: ["PARCELA", "LOTE", "PREDIO", "TABLA", "POTRERO", "TERRENO", "RANCHO"],
  actividad: ["ACTIVIDAD", "TRABAJO", "TAREA", "OPERACION", "TIPO DE ACTIVIDAD"],
  personas: ["PERSONAS", "TRABAJADORES", "NO. PERSONAS", "NUM PERSONAS", "GENTE", "NO. TRABAJADORES"],
  cantidad: ["CANTIDAD", "CANT", "UNIDADES"],
  folio: ["FOLIO", "FACTURA", "NO. FACTURA", "UUID", "FOLIO FISCAL", "NUMERO", "TICKET"],
  saldo: ["SALDO"], cargo: ["CARGO", "CARGOS", "RETIRO", "RETIROS"], abono: ["ABONO", "ABONOS", "DEPOSITO", "DEPOSITOS"],
  periodo: ["PERIODO", "SEMANA", "QUINCENA"],
  claves: ["CLAVES", "CLAVE", "CODIGOS", "CODIGO", "CLAVES DE ACTIVIDAD Y LUGAR"],
  cultivo: ["CULTIVO", "CULTIVOS"],
};
// Qué campos hacen falta y cuáles ayudan, por clase de hoja. El orden importa: gana la primera que junte más.
const RECETAS = [
  { clase: "banco", pide: ["fecha", "saldo"], ayuda: ["cargo", "abono", "concepto"] },
  { clase: "combustible", pide: ["fecha", "litros"], ayuda: ["vehiculo", "importe", "horometro", "proveedor", "nombre"] },
  // Una raya con claves («A07 · Bod»): quién, qué hizo y dónde. El importe ayuda, pero no hace falta.
  { clase: "raya", pide: ["nombre", "claves"], ayuda: ["fecha", "cultivo", "importe", "concepto", "dias"] },
  { clase: "nomina", pide: ["nombre", "importe"], ayuda: ["fecha", "dias", "periodo", "puesto", "sueldo"] },
  { clase: "personal", pide: ["nombre"], alguna: ["puesto", "sueldo", "ingreso"], ayuda: ["puesto", "sueldo", "ingreso", "telefono"], prohibe: ["importe", "litros"] },
  { clase: "actividades", pide: ["fecha", "actividad"], ayuda: ["parcela", "personas", "importe", "nombre", "cantidad"] },
  { clase: "gastos", pide: ["fecha", "importe"], ayuda: ["proveedor", "concepto", "folio", "parcela"] },
  { clase: "proveedores", pide: ["proveedor"], ayuda: ["rfc", "telefono", "concepto"], prohibe: ["importe", "fecha"] },
];
// ¿Qué campo es este encabezado? El texto exacto pesa más que «contiene».
function campoDe(encabezado) {
  const t = normalizar(encabezado).replace(/[.:#]/g, " ").replace(/\s+/g, " ").trim(); if (!t) return [];
  const r = [];
  for (const [campo, lista] of Object.entries(PALABRAS)) {
    if (lista.includes(t)) r.push({ campo, peso: 3 });
    else if (lista.some(p => p.length >= 4 && (t.startsWith(p + " ") || t.endsWith(" " + p) || t.includes(" " + p + " ")))) r.push({ campo, peso: 2 });
    else if (lista.some(p => p.length >= 5 && t.includes(p))) r.push({ campo, peso: 1 });
  }
  return r.sort((a, b) => b.peso - a.peso);
}
// La firma de unos encabezados: para reconocer «esta hoja ya la vi» aunque cambien los renglones.
export const firmaDe = (encabezados) => (encabezados || []).map(e => normalizar(e)).filter(Boolean).join("|");

// Busca el renglón de encabezados (puede haber membrete arriba) y qué columna es cada campo.
// `aprendidos`: [{ firma, clase, mapa }] — lo que una persona ya confirmó para hojas iguales.
export function entenderHoja(filas, aprendidos = []) {
  let mejor = null;
  const tope = Math.min((filas || []).length, 25);
  for (let i = 0; i < tope; i++) {
    const fila = filas[i] || []; if (fila.filter(c => String(c ?? "").trim()).length < 2) continue;
    // Un renglón de encabezados trae títulos, no datos: si alguna celda es un número o una fecha, es un renglón de datos
    // (aunque diga «PROVEEDOR 3» o «TOTAL 500») y no se toma como encabezado.
    if (fila.some(c => typeof c === "number" || (String(c ?? "").trim() !== "" && (aNumero(c) != null || /^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}$/.test(String(c).trim()))))) continue;
    const firma = firmaDe(fila), sabido = aprendidos.find(a => a.firma === firma);
    if (sabido) return { i, encabezados: fila.map(c => String(c ?? "").trim()), firma, clase: sabido.clase, mapa: { ...sabido.mapa }, aprendido: true, puntaje: 99, faltan: [], dudas: [] };
    // A cada campo, la columna que mejor le queda; una columna no sirve a dos campos (salvo cargo/importe, que se llaman igual).
    const cand = []; fila.forEach((c, col) => campoDe(c).forEach(x => cand.push({ ...x, col })));
    cand.sort((a, b) => b.peso - a.peso || a.col - b.col);
    const mapa = {}, usadas = new Set();
    for (const c of cand) { if (mapa[c.campo] != null || usadas.has(c.col)) continue; mapa[c.campo] = c.col; usadas.add(c.col); }
    // De las clases que sí cuadran con estos encabezados, la que junte más campos (en empate, la primera de la lista).
    for (const receta of RECETAS) {
      if (!receta.pide.every(k => mapa[k] != null)) continue;
      if (receta.alguna && !receta.alguna.some(k => mapa[k] != null)) continue;
      if ((receta.prohibe || []).some(k => mapa[k] != null)) continue;
      const puntaje = receta.pide.length * 3 + receta.ayuda.filter(k => mapa[k] != null).length;
      if (!mejor || puntaje > mejor.puntaje) mejor = { i, encabezados: fila.map(c => String(c ?? "").trim()), firma, clase: receta.clase, mapa, aprendido: false, puntaje, faltan: [], dudas: [] };
    }
  }
  if (mejor) {
    // Columnas con texto en el encabezado que no se supo qué son: se dicen, no se suponen.
    const usadas = new Set(Object.values(mejor.mapa));
    mejor.dudas = mejor.encabezados.map((e, col) => ({ e, col })).filter(x => x.e && !usadas.has(x.col)).map(x => x.e);
    return mejor;
  }
  return { i: -1, encabezados: [], firma: "", clase: "desconocido", mapa: {}, aprendido: false, puntaje: 0, faltan: ["No se encontró un renglón de encabezados que se reconozca (fecha, nombre, importe, litros…)."], dudas: [] };
}

// Lo que una persona confirmó: «esta hoja es de tal clase y estas son sus columnas». Sólo se aprende de eso.
export function aprenderHoja(aprendidos = [], { encabezados, clase, mapa, quien = "", fecha = "" }) {
  const firma = firmaDe(encabezados);
  if (!firma || !CLASES[clase] || clase === "desconocido") return { ok: false, dice: "No hay qué aprender: faltan los encabezados o la clase.", aprendidos };
  const limpio = {}; for (const [k, v] of Object.entries(mapa || {})) if (PALABRAS[k] && Number.isInteger(v) && v >= 0) limpio[k] = v;
  const receta = RECETAS.find(r => r.clase === clase);
  if (receta && !receta.pide.every(k => limpio[k] != null)) return { ok: false, dice: `Para ${CLASES[clase].toLowerCase()} hace falta decir cuál columna es: ${receta.pide.filter(k => limpio[k] == null).join(", ")}.`, aprendidos };
  const previo = aprendidos.find(a => a.firma === firma);
  const nuevo = { firma, clase, mapa: limpio, veces: (previo?.veces || 0) + 1, quien, fecha };
  return { ok: true, patron: nuevo, aprendidos: [...aprendidos.filter(a => a.firma !== firma), nuevo] };
}
export const CAMPOS_DE = (clase) => { const r = RECETAS.find(x => x.clase === clase); return r ? [...r.pide, ...r.ayuda] : []; };
export const NOMBRE_DE_CAMPO = { claves: "Claves (A07, Bod, SF4…)", cultivo: "Cultivo (Ajo…)", fecha: "Fecha", nombre: "Nombre de la persona", puesto: "Puesto", sueldo: "Sueldo por día", ingreso: "Fecha de ingreso", dias: "Días", importe: "Importe", proveedor: "Proveedor", concepto: "Concepto", rfc: "RFC", telefono: "Teléfono", litros: "Litros", vehiculo: "Vehículo o máquina", horometro: "Horómetro o kilometraje", parcela: "Parcela", actividad: "Actividad", personas: "Número de personas", cantidad: "Cantidad", folio: "Folio", saldo: "Saldo", cargo: "Cargo", abono: "Abono", periodo: "Periodo" };

/* ════════════ 4 · DE LA HOJA A RENGLONES LIMPIOS ════════════ */
const texto = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const pareceTotal = (fila) => fila.some(c => /^(GRAN )?(SUB)?TOTAL(ES)?\b|^SUMA\b/.test(normalizar(c)));
// Devuelve { registros, descartadas }. Un renglón que no se puede leer NO se adivina: va a `descartadas` con su razón.
export function extraerDeHoja(entendida, filas) {
  const { clase, mapa, i } = entendida, registros = [], descartadas = [];
  const de = (fila, campo) => (mapa[campo] == null ? undefined : fila[mapa[campo]]);
  for (let n = i + 1; n < (filas || []).length; n++) {
    const fila = filas[n] || [];
    if (fila.every(c => texto(c) === "")) continue;
    if (pareceTotal(fila)) continue;                               // el renglón de totales no es un movimiento
    const descarta = (porque) => descartadas.push({ renglon: n + 1, porque, vista: fila.map(texto).filter(Boolean).slice(0, 6).join(" · ") });
    const fecha = mapa.fecha != null ? aFecha(de(fila, "fecha")) : null, importe = mapa.importe != null ? aNumero(de(fila, "importe")) : null;
    if (clase === "personal") {
      const nombre = texto(de(fila, "nombre")); if (nombre.length < 5 || !/\s/.test(nombre)) { descarta("No trae un nombre completo."); continue; }
      const sueldo = aNumero(de(fila, "sueldo")), ingreso = mapa.ingreso != null ? aFecha(de(fila, "ingreso")) : null;
      registros.push({ clase: "personal", nombre, puesto: texto(de(fila, "puesto")), sueldo: sueldo > 0 ? sueldo : null, fechaIngreso: ingreso, renglon: n + 1 });
    } else if (clase === "proveedores") {
      const nombre = texto(de(fila, "proveedor")); if (nombre.length < 3) { descarta("No trae el nombre del proveedor."); continue; }
      registros.push({ clase: "proveedores", nombre, rfc: texto(de(fila, "rfc")).toUpperCase(), telefono: texto(de(fila, "telefono")), giro: texto(de(fila, "concepto")), renglon: n + 1 });
    } else if (clase === "nomina") {
      const nombre = texto(de(fila, "nombre")); if (nombre.length < 5) { descarta("No trae el nombre de la persona."); continue; }
      if (!(importe > 0)) { descarta("No se pudo leer cuánto se le pagó."); continue; }
      registros.push({ clase: "nomina", fecha, nombre, monto: importe, dias: aNumero(de(fila, "dias")), periodo: texto(de(fila, "periodo")), puesto: texto(de(fila, "puesto")), renglon: n + 1 });
    } else if (clase === "raya") {
      // Los nombres de una libreta son cortos («Rigo», «Gus»): con dos letras basta. Las claves se copian TAL CUAL:
      // qué es cada una lo decide el catálogo, no la columna donde venía.
      const nombre = texto(de(fila, "nombre")); if (nombre.length < 2) { descarta("No trae el nombre de la persona."); continue; }
      const usadas = new Set(Object.values(mapa));
      const sueltas = fila.map((c, col) => ({ c: texto(c), col })).filter(x => x.c && !usadas.has(x.col) && formaDe(normalizarClave(x.c).clave)).map(x => x.c);
      const claves = [...partirClaves(texto(de(fila, "claves"))), ...sueltas], observacion = texto(de(fila, "concepto")), cultivo = texto(de(fila, "cultivo"));
      if (claves.length === 0 && !observacion && !cultivo) { descarta("No trae ninguna clave ni anotación."); continue; }
      registros.push({ clase: "raya", fecha, nombre, claves, cultivo, observacion, monto: importe > 0 ? importe : null, dias: aNumero(de(fila, "dias")), renglon: n + 1 });
    } else if (clase === "combustible") {
      const litros = aNumero(de(fila, "litros"));
      if (!fecha) { descarta("No se pudo leer la fecha."); continue; }
      if (!(litros > 0)) { descarta("No se pudieron leer los litros."); continue; }
      registros.push({ clase: "combustible", fecha, litros, monto: importe > 0 ? importe : null, vehiculo: texto(de(fila, "vehiculo")), horometro: aNumero(de(fila, "horometro")), proveedor: texto(de(fila, "proveedor")), quien: texto(de(fila, "nombre")), renglon: n + 1 });
    } else if (clase === "actividades") {
      const actividad = texto(de(fila, "actividad"));
      if (!fecha) { descarta("No se pudo leer la fecha."); continue; }
      if (!actividad) { descarta("No dice qué actividad fue."); continue; }
      registros.push({ clase: "actividades", fecha, actividad, parcela: texto(de(fila, "parcela")), personas: aNumero(de(fila, "personas")), monto: importe > 0 ? importe : null, quien: texto(de(fila, "nombre")), renglon: n + 1 });
    } else if (clase === "gastos") {
      if (!fecha) { descarta("No se pudo leer la fecha."); continue; }
      if (!(importe > 0)) { descarta("No se pudo leer el importe."); continue; }
      registros.push({ clase: "gastos", fecha, monto: importe, proveedor: texto(de(fila, "proveedor")), concepto: texto(de(fila, "concepto")), folio: texto(de(fila, "folio")), parcela: texto(de(fila, "parcela")), renglon: n + 1 });
    }
  }
  return { registros, descartadas };
}

/* ════════════ 4b · CSV Y WORD, SIN LIBRERÍAS ════════════ */
// Un CSV se lee como TEXTO (nunca por la librería de Excel, que voltea las fechas a la americana).
// Acepta coma, punto y coma o tabulador, y comillas con comas adentro.
export function csvAFilas(textoCsv) {
  const t = String(textoCsv || "").replace(/^\uFEFF/, ""), primera = t.split(/\r?\n/).find(l => l.trim()) || "";
  const cuenta = (c) => primera.split(c).length - 1, sep = cuenta("\t") > Math.max(cuenta(","), cuenta(";")) ? "\t" : cuenta(";") > cuenta(",") ? ";" : ",";
  const filas = []; let fila = [], celda = "", comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) { if (c === '"') { if (t[i + 1] === '"') { celda += '"'; i++; } else comillas = false; } else celda += c; }
    else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(celda.trim()); celda = ""; }
    else if (c === "\n") { fila.push(celda.trim()); celda = ""; if (fila.some(x => x !== "")) filas.push(fila); fila = []; }
    else if (c !== "\r") celda += c;
  }
  fila.push(celda.trim()); if (fila.some(x => x !== "")) filas.push(fila);
  return filas;
}
// El contenido de un Word (.docx) es un XML: de ahí salen sus tablas (como hojas) y su texto corrido.
export function docxAContenido(xml) {
  const t = String(xml || "");
  const textoDe = (trozo) => trozo.replace(/<w:tab\b[^>]*\/>/g, " ").replace(/<w:br\b[^>]*\/>/g, "\n").split(/<\/w:p>/).map(p => (p.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) || []).map(x => desescapar(x.replace(/<[^>]+>/g, ""))).join("")).map(x => x.trim()).filter(Boolean).join("\n");
  const tablas = [];
  const sinTablas = t.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tbl) => {
    const filas = (tbl.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) || []).map(tr => (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(tc => textoDe(tc).replace(/\n/g, " ")));
    if (filas.length) tablas.push(filas);
    return "";
  });
  return { texto: textoDe(sinTablas), tablas };
}

/* ════════════ 5 · TEXTO SUELTO (un PDF o un Word sin tabla) ════════════ */
const RE_UUID = /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/i;
const RE_RFC = /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/g;
// De un texto sólo se saca lo que NO admite duda: el folio fiscal. El total de una factura impresa no se adivina
// del texto (hay subtotal, IVA, total, importe con letra): si no viene el XML, el papel queda por revisar.
export function entenderTexto(textoLibre) {
  const t = String(textoLibre || ""), norm = normalizar(t), uuid = (t.match(RE_UUID) || [null])[0];
  const rfcs = [...new Set((t.toUpperCase().match(RE_RFC) || []))];
  if (uuid) return { clase: /RECIBO DE NOMINA|PERCEPCIONES|DEDUCCIONES/.test(norm) ? "cfdi_nomina" : "cfdi_gasto", uuid: uuid.toUpperCase(), rfcs, impreso: true };
  if (/ESTADO DE CUENTA/.test(norm) && /SALDO/.test(norm)) return { clase: "banco", uuid: null, rfcs, impreso: true };
  return { clase: "desconocido", uuid: null, rfcs, impreso: true };
}

/* ════════════ 6 · DE CUÁNDO ES, Y SI ES HISTÓRICO ════════════ */
export function periodoDe(registros) {
  const f = (registros || []).map(r => r.fecha).filter(Boolean).sort();
  return f.length ? { desde: f[0], hasta: f[f.length - 1] } : null;
}
// «historico»: anterior al inicio de operaciones (o no hay inicio declarado). «operacion»: del inicio en adelante.
export function situar(fecha, inicio) {
  if (!inicio) return "historico";
  if (!fecha) return "sin_fecha";
  return fecha < inicio ? "historico" : "operacion";
}

/* ════════════ 7 · LLAVES PARA NO DUPLICAR ════════════ */
const pesos = (m) => (Math.round((Number(m) || 0) * 100) / 100).toFixed(2);
const corto = (s) => normalizar(s).replace(/[^A-Z0-9 ]/g, "").replace(/\b(SA|DE|CV|S|A|C|V|RL|SPR|LA|EL|LOS|LAS|Y)\b/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
export function llaveDe(r) {
  if (r.uuid) return `uuid:${String(r.uuid).toUpperCase()}`;
  if (r.clase === "personal") return `persona:${corto(r.nombre)}`;
  if (r.clase === "proveedores") return `proveedor:${corto(r.nombre)}`;
  if (r.clase === "nomina") return `nomina:${r.fecha || r.periodo || ""}:${corto(r.nombre)}:${pesos(r.monto)}`;
  if (r.clase === "raya") return `raya:${r.fecha || `sinfecha-${r.deDonde || ""}`}:${corto(r.nombre)}:${(r.claves || []).map(c => normalizarClave(c).clave).sort().join("+") || corto(r.observacion)}`;
  if (r.clase === "combustible") return `combustible:${r.fecha}:${corto(r.vehiculo)}:${r.litros}`;
  if (r.clase === "actividades") return `actividad:${r.fecha}:${corto(r.parcela)}:${corto(r.actividad)}:${pesos(r.monto)}`;
  return `gasto:${r.fecha}:${pesos(r.monto)}:${corto(r.proveedor || r.concepto)}`;
}
// Un egreso ya capturado, con la misma llave que le tocaría a un renglón importado.
const llaveDeEgreso = (e) => (e.uuid ? `uuid:${String(e.uuid).toUpperCase()}` : `gasto:${e.fecha}:${pesos(e.monto)}:${corto(e.proveedor || e.concepto)}`);

/* ════════════ 8 · LA PROPUESTA ════════════ */
const CATEGORIA_POR_PALABRA = [
  [/\b(CFE|ENERGIA ELECTRICA|LUZ|AGUA POTABLE|TELMEX|TELCEL|INTERNET|TELEFON)/, "servicios"],
  [/\b(FLETE|TRANSPORTE|ACARREO|CASETA|PEAJE)/, "transporte"],
  [/\b(DIESEL|GASOLINA|MAGNA|PREMIUM|COMBUSTIBLE|FERTILIZ|UREA|FOSFATO|SULFATO|NITRATO|HERBICID|FUNGICID|INSECTICID|AGROQUIM|SEMILLA|ADHERENTE|FOLIAR|CINTILLA|PLASTICO|RAFIA|HILO|CAJA)/, "insumos"],
  [/\b(RENTA DE MAQUIN|MAQUILA|BARBECHO|RASTRA)/, "maquinaria"],
  [/\b(HONORARIO|CONTAB|NOTARI|PAPELER|TRAMITE|DERECHOS|PREDIAL|TENENCIA|SEGURO)/, "administrativo"],
  [/\b(INTERES|COMISION BANC|ANUALIDAD)/, "financiero"],
];
export const categoriaDe = (textoConcepto) => { const t = normalizar(textoConcepto); const hit = CATEGORIA_POR_PALABRA.find(([re]) => re.test(t)); return hit ? hit[1] : "otro"; };

// Lo que se propone hacer con un documento ya leído.
//   doc        { id, nombre, huella, formato, cfdi?, hojas?: [{ nombre, filas }], texto? }
//   contexto   { inicio, rfcsPropios: [], egresos, historico, trabajadores, encargados, proveedores, maquinaria, parcelas, documentos (los ya recibidos), aprendidos }
// Devuelve   { estado, clase, periodo, propuestas, descartadas, excepciones, resumen, hojas }
export function proponer(doc, contexto = {}) {
  const { inicio = null, rfcsPropios = [], egresos = [], historico = [], trabajadores = [], encargados = [], proveedores = [], maquinaria = [], parcelas = [], documentos = [], aprendidos = [], claves = catalogoDeClaves([]) } = contexto;
  const base = { clase: "desconocido", periodo: null, propuestas: [], descartadas: [], excepciones: [], hojas: [] };
  // 1. El mismo archivo, otra vez.
  const gemelo = documentos.find(d => d.id !== doc.id && d.huella && d.huella === doc.huella && d.estado !== "error");
  if (gemelo) return { ...base, estado: "duplicado", duplicadoDe: gemelo.id, resumen: `Es el mismo archivo que «${gemelo.nombre}», que ya se había recibido${gemelo.recibido ? ` el ${String(gemelo.recibido).slice(0, 10)}` : ""}.` };
  if (doc.formato === "imagen" || doc.escaneado) return { ...base, estado: "necesita_lectura", resumen: doc.escaneado ? "Es un PDF escaneado (una foto dentro de un PDF): no trae texto que se pueda leer aquí." : "Es una imagen: los lectores gratuitos no la leen. El original queda guardado; se puede leer con IA (si tú lo pides) o capturar a mano en Papeles." };
  if (doc.formato === "word_viejo") return { ...base, estado: "por_revisar", excepciones: ["Es un Word del formato antiguo (.doc), que no se puede abrir aquí. Guárdalo como .docx o como PDF y vuelve a subirlo."], resumen: "Word del formato antiguo: no se pudo abrir." };

  const yaHay = new Set([...egresos.filter(e => !e.cancelado).map(llaveDeEgreso), ...historico.map(h => h.llave).filter(Boolean)]);
  const enEsteLote = new Set();
  const propuestas = [], excepciones = [], descartadas = [], hojasVistas = [];
  const persona = new Set([...trabajadores, ...encargados].map(p => `persona:${corto(p.nombre)}`)), prov = new Set(proveedores.map(p => `proveedor:${corto(p.nombre)}`));
  const propone = (p) => {
    const llave = p.llave || llaveDe(p.datos);
    if (yaHay.has(llave) || persona.has(llave) || prov.has(llave)) { propuestas.push({ ...p, llave, accion: "duplicado", nota: "Ya está registrado: no se propone otra vez." }); return; }
    if (enEsteLote.has(llave)) { propuestas.push({ ...p, llave, accion: "duplicado", nota: "Viene repetido dentro del mismo documento." }); return; }
    enEsteLote.add(llave); propuestas.push({ ...p, llave, ...(doc.viaIA ? { viaIA: true } : {}) });
  };
  const comoHistorico = (r, clase, mas = {}) => ({ destino: "historico", accion: "agregar", datos: { clase, fecha: r.fecha || null, mes: (r.fecha || "").slice(0, 7) || null, monto: r.monto ?? null, ...mas } });

  let clase = "desconocido";
  /* ── a) Un comprobante fiscal ── */
  if (doc.cfdi) {
    const c = doc.cfdi, propios = rfcsPropios.map(x => String(x).toUpperCase());
    excepciones.push(...(c.avisos || []));
    const esMio = (rfc) => propios.includes(rfc);
    if (c.tipo === "nomina") clase = "cfdi_nomina";
    else if (c.tipo === "pago") clase = "cfdi_pago";
    else if (c.tipo === "ingreso" || c.tipo === "egreso") {
      if (propios.length === 0) { clase = "cfdi_gasto"; excepciones.push("No se sabe cuáles RFC son del rancho (faltan los titulares): se tomó como factura RECIBIDA. Si es una venta del rancho, descártala."); }
      else if (esMio(c.emisor.rfc) && !esMio(c.receptor.rfc)) clase = "cfdi_ingreso";
      else if (esMio(c.receptor.rfc)) clase = "cfdi_gasto";
      else { clase = "cfdi_gasto"; excepciones.push(`Ni quien la emite (${c.emisor.nombre || enmascarar(c.emisor.rfc)}) ni quien la recibe (${c.receptor.nombre || enmascarar(c.receptor.rfc)}) es un titular del rancho: revisa si de verdad es del rancho.`); }
    } else clase = "cfdi_otro";
    const lugar = situar(c.fecha, inicio), conceptoCorto = c.conceptos.map(x => x.concepto).filter(Boolean).slice(0, 3).join(" · ").slice(0, 120);
    if (!c.uuid || c.total == null) { /* sin folio fiscal o sin total no se propone nada: ya quedó dicho en los avisos */ }
    else if (clase === "cfdi_gasto") {
      if (c.tipo === "egreso") excepciones.push("Es una NOTA DE CRÉDITO (devuelve o descuenta): no es un gasto nuevo. Queda como referencia.");
      if (lugar === "operacion" && c.tipo !== "egreso" && c.moneda === "MXN") propone({ destino: "egresos", accion: "agregar", llave: `uuid:${c.uuid}`,
        datos: { fecha: c.fecha, concepto: conceptoCorto || `Factura de ${c.emisor.nombre}`, proveedor: c.emisor.nombre, monto: c.total, categoria: categoriaDe(c.conceptos.map(x => x.concepto).join(" ")), uuid: c.uuid, rfcEmisor: c.emisor.rfc, aNombreDe: c.receptor.rfc, tieneComprobanteFiscal: true, metodo: c.formaPago === "01" ? "efectivo" : "transferencia", renglones: c.conceptos.slice(0, 40) } });
      else propone({ ...comoHistorico({ fecha: c.fecha, monto: c.tipo === "egreso" ? -c.total : c.total }, "gasto", { contraparte: c.emisor.nombre, concepto: conceptoCorto, uuid: c.uuid, moneda: c.moneda }), llave: `uuid:${c.uuid}` });
    } else if (clase === "cfdi_ingreso") {
      propone({ ...comoHistorico({ fecha: c.fecha, monto: c.total }, "venta", { contraparte: c.receptor.nombre, concepto: conceptoCorto, uuid: c.uuid, moneda: c.moneda }), llave: `uuid:${c.uuid}` });
      if (lugar === "operacion") excepciones.push("Es una venta del rancho posterior al arranque. Las ventas se registran en Finanzas (con su parcela y su cosecha): aquí queda sólo como referencia.");
    } else if (clase === "cfdi_nomina") {
      const n = c.nomina || {};
      propone({ ...comoHistorico({ fecha: n.fechaPago || c.fecha, monto: c.total }, "nomina", { contraparte: n.persona, concepto: `Recibo de nómina${n.desde ? ` del ${n.desde} al ${n.hasta}` : ""}`, dias: n.dias ?? null, percepciones: n.percepciones ?? null, deducciones: n.deducciones ?? null, uuid: c.uuid }), llave: `uuid:${c.uuid}` });
      if (situar(n.fechaPago || c.fecha, inicio) === "operacion") excepciones.push("Es un recibo de nómina posterior al arranque. NO crea ningún pago: los pagos se registran en Pagos al personal. Queda como referencia.");
    } else propone({ ...comoHistorico({ fecha: c.fecha, monto: c.total }, "otro", { contraparte: c.emisor.nombre, concepto: clase === "cfdi_pago" ? "Complemento de pago" : "Comprobante fiscal", uuid: c.uuid }), llave: `uuid:${c.uuid}` });
  }
  /* ── b) Hojas ── */
  const delLibro = periodoDelLibro(doc.hojas || []);
  // Qué documentos ya traen rayas de cada día (para no contar dos veces un día que viene en el Excel y en una foto).
  const fuentesDelDia = new Map(), empalmes = new Map();
  for (const h of historico) if (h.clase === "raya" && h.fecha) { if (!fuentesDelDia.has(h.fecha)) fuentesDelDia.set(h.fecha, new Set()); fuentesDelDia.get(h.fecha).add(h.documento || "otro documento"); }
  for (const h of doc.hojas || []) {
    // Un catálogo de claves de un Excel anterior: entra como REFERENCIA histórica (de qué archivo, de qué fechas), nunca
    // como definición. Los trabajadores y el tabulador de sueldos de esa misma hoja no se leen.
    const cat = leerCatalogos(h.filas);
    if (cat.referencias.length >= 3) {
      if (clase === "desconocido") clase = "catalogo_claves";
      hojasVistas.push({ nombre: h.nombre, clase: "catalogo_claves", encabezados: [], mapa: {}, registros: cat.referencias.length, descartadas: 0 });
      for (const r of cat.referencias) propone({ destino: "historico", accion: "agregar", origen: { hoja: h.nombre },
        datos: { clase: CLASE_REFERENCIA, fecha: null, mes: null, monto: null, contraparte: r.clave, concepto: `${r.significado}${r.cultivoAsociado ? ` · cultivo que tenía: ${r.cultivoAsociado}` : ""}`, clave: normalizarClave(r.clave).clave, tipoDeClave: r.clase, significado: r.significado, escrita: r.escrita,
          ...(r.cultivoAsociado ? { cultivoAsociado: r.cultivoAsociado } : {}), ...(r.sinCodigo ? { sinCodigo: true } : {}), ...(r.aliasDe ? { aliasDe: r.aliasDe } : {}), documento: doc.nombre, hoja: h.nombre, desde: delLibro?.desde || null, hasta: delLibro?.hasta || null, vigencia: "por confirmar" },
        llave: `ref:${normalizarClave(r.clave).clave}:${r.clase}:${corto(r.significado)}:${r.cultivoAsociado || ""}:${String(doc.huella || doc.id || "").slice(0, 12)}` });
      excepciones.push(`«${h.nombre}» trae catálogos de claves (${cat.secciones.map(s => `${s.renglones} de ${s.clase === "ubicacion" ? "ubicaciones" : s.clase === "actividad" ? "actividades" : "cultivos"}`).join(", ")}). Entran como REFERENCIA histórica de este archivo${delLibro ? ` (${delLibro.desde} a ${delLibro.hasta})` : ""}, con vigencia por confirmar: se sugieren al preguntar una clave, y una persona decide. Los trabajadores y los sueldos de esa hoja NO se leen.`);
      continue;
    }
    // La hoja semanal del Excel de rayas: un renglón por trabajador y tres columnas por día.
    const sem = leerRayaSemanal(h.filas);
    const e = sem ? { clase: sem.registros.length ? "raya" : "desconocido", encabezados: [], mapa: {}, dudas: [], i: 0 } : entenderHoja(h.filas, aprendidos);
    if (sem && !sem.registros.length) { hojasVistas.push({ nombre: h.nombre, clase: "raya", encabezados: [], mapa: {}, registros: 0, descartadas: 0 }); excepciones.push(`«${h.nombre}» es una hoja semanal de rayas sin nada capturado.`); continue; }
    if (sem) {
      if (!sem.semana) excepciones.push(`En «${h.nombre}» no se pudo leer de qué semana es: sus renglones entran «sin fecha».`);
      if (sem.cultivoConError) excepciones.push(`En «${h.nombre}», ${sem.cultivoConError} día(s) no traen cultivo (en el Excel venía vacío o con error #N/A, casi siempre porque el nombre de la ubicación no coincidía con su catálogo). Se conserva la actividad y la ubicación, y el cultivo queda vacío: no se supone. Esos días el Excel tampoco contó su costo.`);
    }
    const vista = { nombre: h.nombre, clase: e.clase, encabezados: e.encabezados, mapa: e.mapa, aprendido: e.aprendido, dudas: e.dudas, renglonEncabezado: e.i, registros: 0, descartadas: 0 };
    hojasVistas.push(vista);
    // Para poder preguntarle a la persona: el primer renglón que parece de encabezados (dos o más celdas con texto).
    if (e.clase === "desconocido") vista.primeraFila = ((h.filas || []).slice(0, 25).find(f => (f || []).filter(c => texto(c)).length >= 2) || []).map(texto);
    if (e.clase === "desconocido") { if ((h.filas || []).some(f => f.filter(c => texto(c)).length >= 2)) excepciones.push(`La hoja «${h.nombre}» no se reconoce: hay que decir qué es y cuáles son sus columnas.`); continue; }
    if (clase === "desconocido") clase = e.clase;
    if (e.clase === "banco") { excepciones.push(`La hoja «${h.nombre}» parece un estado de cuenta del banco. Esos se suben en la pantalla Banco, que comprueba que los saldos cuadren antes de creerle.`); continue; }
    const x = sem ? { registros: sem.registros, descartadas: sem.descartadas } : extraerDeHoja(e, h.filas);
    vista.registros = x.registros.length; vista.descartadas = x.descartadas.length;
    descartadas.push(...x.descartadas.map(d => ({ ...d, hoja: h.nombre })));
    for (const r of x.registros) {
      const lugar = situar(r.fecha, inicio), origen = { hoja: h.nombre, renglon: r.renglon };
      if (r.clase === "personal") propone({ destino: "trabajadores", accion: "agregar", origen, datos: { clase: "personal", nombre: r.nombre, puesto: r.puesto, sueldo_dia: r.sueldo, fechaIngreso: r.fechaIngreso } });
      else if (r.clase === "proveedores") propone({ destino: "proveedores", accion: "agregar", origen, datos: { clase: "proveedores", nombre: r.nombre, rfc: r.rfc, telefono: r.telefono, giro: r.giro } });
      else if (r.clase === "nomina") propone({ ...comoHistorico(r, "nomina", { contraparte: r.nombre, concepto: [r.puesto, r.periodo, r.dias ? `${r.dias} días` : ""].filter(Boolean).join(" · "), referencia: lugar === "operacion" }), origen, llave: llaveDe(r) });
      else if (r.clase === "raya") {
        // Trabajador · fecha · actividad · ubicación · cultivo, SIEMPRE como histórico o referencia: de una raya importada nunca
        // sale un pago ni una actividad. Se guarda la CLAVE (no su significado): lo que se aprenda o se corrija después
        // vale también para lo ya importado.
        const rel = relacionDeRenglon(r, claves);
        // Lo que se entendió AL IMPORTAR queda escrito en el renglón (`leido`): si después se corrige una clave, este
        // renglón ya confirmado no cambia; se sabrá qué decía, qué se entendió entonces y qué significa hoy.
        const dicho = (c) => (c ? { clave: c.clave, significado: c.conocida ? c.significado : null, ...(c.escritaComo ? { escritaComo: c.escritaComo, denominacion: c.denominacion } : {}), ...(c.puedeSer ? { puedeSer: c.puedeSer } : {}) } : null);
        const leido = { actividad: dicho(rel.actividad), ubicacion: dicho(rel.ubicacion), cultivo: dicho(rel.cultivo) };
        // Otro documento ya trae rayas de ese mismo día: son DOS FUENTES del mismo día, no más trabajo. Se avisa y se cotejan.
        const otras = r.fecha ? [...(fuentesDelDia.get(r.fecha) || [])].filter(d => d !== doc.nombre) : [];
        if (otras.length) empalmes.set(r.fecha, otras);
        propone({ ...comoHistorico(r, "raya", { leido, ...(otras.length ? { otraFuente: otras } : {}), ...(r.fecha && new Date(`${r.fecha}T12:00:00Z`).getUTCDay() === 0 ? { domingo: true } : {}), contraparte: r.nombre, concepto: [...r.claves, r.cultivo, r.observacion].filter(Boolean).join(" · "), claves: r.claves, actividad: rel.actividad?.clave || null, ubicacion: rel.ubicacion?.clave || null,
          // El cultivo es un campo propio: lo que venía escrito (`cultivoEscrito`) y, si se reconoce, cuál es (`cultivo`).
          ...(r.cultivo ? { cultivoEscrito: r.cultivo } : {}), cultivo: rel.cultivo?.clave || null, ...(rel.sinLugarFisico ? { general: true } : {}),
          // El número que trae el renglón PROBABLEMENTE es el pago del día, pero no está confirmado: se guarda como
          // tentativo, aparte, y no como importe (así no suma en ningún total ni parece un pago).
          monto: null, ...(r.monto > 0 ? { importeTentativo: r.monto } : {}),
          ...(r.observacion ? { observacion: r.observacion } : {}), ...(r.dias ? { dias: r.dias } : {}), ...(r.escrito ? { escrito: r.escrito } : {}), referencia: lugar === "operacion" }), origen, llave: llaveDe({ ...r, claves: r.claves.map(c => canonica(c, claves)), deDonde: `${String(doc.huella || doc.id || "").slice(0, 12)}-${h.nombre}-${r.renglon}` }) });
      }
      else if (r.clase === "combustible") {
        const m = maquinaria.filter(v => corto(v.nombre) && corto(v.nombre) === corto(r.vehiculo));
        if (lugar === "operacion" && r.monto > 0 && m.length === 1) propone({ destino: "egresos", accion: "agregar", origen, llave: llaveDe(r), datos: { fecha: r.fecha, concepto: `Combustible: ${r.litros} L${r.horometro != null ? ` · lectura ${r.horometro}` : ""}`, proveedor: r.proveedor, monto: r.monto, categoria: "combustible", vehiculoId: m[0].id, litros: r.litros } });
        else propone({ ...comoHistorico(r, "combustible", { contraparte: r.proveedor, concepto: r.vehiculo, litros: r.litros, horometro: r.horometro, referencia: lugar === "operacion" }), origen, llave: llaveDe(r) });
      } else if (r.clase === "actividades") propone({ ...comoHistorico(r, "actividad", { concepto: r.actividad, parcela: r.parcela, personas: r.personas, referencia: lugar === "operacion" }), origen, llave: llaveDe(r) });
      else if (lugar === "operacion") {
        const p = parcelas.filter(q => corto(q.nombre) && corto(q.nombre) === corto(r.parcela));
        propone({ destino: "egresos", accion: "agregar", origen, llave: llaveDe(r), datos: { fecha: r.fecha, concepto: r.concepto || (r.proveedor ? `Compra a ${r.proveedor}` : "Gasto importado"), proveedor: r.proveedor, monto: r.monto, categoria: categoriaDe(`${r.concepto} ${r.proveedor}`), folio: r.folio, ...(p.length === 1 ? { parcelaId: p[0].id } : {}) } });
      } else propone({ ...comoHistorico(r, "gasto", { contraparte: r.proveedor, concepto: r.concepto, parcela: r.parcela }), origen, llave: llaveDe(r) });
    }
    if (x.registros.some(r => r.clase === "nomina" && situar(r.fecha, inicio) === "operacion")) excepciones.push(`La hoja «${h.nombre}» trae pagos al personal posteriores al arranque. NO se crean pagos: se registran en Pagos al personal. Quedan como referencia.`);
    if (x.registros.some(r => r.clase === "actividades" && situar(r.fecha, inicio) === "operacion")) excepciones.push(`La hoja «${h.nombre}» trae actividades posteriores al arranque. NO se crean solas (la mano de obra sale del checador y de las asignaciones): quedan como referencia.`);
    if (x.registros.some(r => r.clase === "combustible" && situar(r.fecha, inicio) === "operacion" && !(r.monto > 0))) excepciones.push(`En «${h.nombre}» hay cargas de combustible posteriores al arranque sin importe: no se proponen como gasto, quedan como referencia.`);
    if (x.registros.some(r => r.clase === "combustible" && situar(r.fecha, inicio) === "operacion" && r.monto > 0 && maquinaria.filter(v => corto(v.nombre) === corto(r.vehiculo)).length !== 1)) excepciones.push(`En «${h.nombre}» hay cargas de combustible de vehículos que no están en el catálogo con ese nombre: no se sabe a cuál cargarlas, quedan como referencia.`);
    const deRaya = x.registros.filter(r => r.clase === "raya");
    if (deRaya.length) {
      const domingos = [...new Set(deRaya.filter(r => r.fecha && new Date(`${r.fecha}T12:00:00Z`).getUTCDay() === 0).map(r => r.fecha))];
      if (domingos.length) excepciones.push(`«${h.nombre}» trae renglones de domingo (${domingos.join(", ")}). Se conserva la fecha como viene; no se pasa al lunes aunque otros documentos de esa época sólo tengan de lunes a sábado.`);
      const faltan = clavesPorPreguntar(deRaya, claves), conDuda = deRaya.filter(r => relacionDeRenglon(r, claves).dudas.length).length;
      excepciones.push(`«${h.nombre}» es una raya con claves: entra al histórico como relación de quién hizo qué, dónde y en qué cultivo. NO se crean pagos ni actividades.`);
      if (faltan.length) excepciones.push(`Hay ${faltan.length} clave(s) que todavía no se sabe qué significan (${faltan.slice(0, 8).map(f => f.clave).join(", ")}${faltan.length > 8 ? "…" : ""}). No se inventan: se pueden contestar aquí abajo, o incorporar así —se guardan con su código— y contestarlas después.`);
      const ajoRaro = deRaya.filter(r => r.cultivo && normalizarClave(r.cultivo).clave === "AJO" && !/^ajo$/i.test(r.cultivo.trim()));
      if (ajoRaro.length) excepciones.push(`En ${ajoRaro.length} renglón(es) el cultivo se leyó «${[...new Set(ajoRaro.map(r => r.cultivo))].join("», «")}» y se tomó como Ajo (así se escribe a mano en las libretas, confirmado por el rancho). Si en alguno no dice Ajo, quítale la marca.`);
      const tentativos = deRaya.filter(r => r.monto > 0).length;
      if (tentativos) excepciones.push(`${tentativos} renglón(es) traen un número al lado (probablemente el pago del día). Se guarda como importe TENTATIVO, por confirmar: no es un pago ni suma en ningún total.`);
      if (deRaya.some(r => !r.fecha)) excepciones.push(`En «${h.nombre}» hay renglones sin día: entran al histórico «sin fecha».`);
      if (conDuda > faltan.length && conDuda) excepciones.push(`${conDuda} renglón(es) de «${h.nombre}» traen alguna duda (se enseña en cada uno).`);
    }
    if (x.registros.some(r => r.clase === "nomina" && !r.fecha)) excepciones.push(`La hoja «${h.nombre}» no trae la fecha de cada pago: esos renglones entran al histórico «sin fecha» (no se supone de qué semana son). Si quieres ubicarlos por mes, agrégale una columna de fecha y vuelve a subirla.`);
    if (x.descartadas.length) excepciones.push(`En «${h.nombre}» hay ${x.descartadas.length} renglón(es) que no se pudieron leer: no se adivinaron.`);
  }
  /* ── c) Texto suelto ── */
  let impreso = null;
  if (!doc.cfdi && !(doc.hojas || []).some(h => entenderHoja(h.filas, aprendidos).clase !== "desconocido") && doc.texto) {
    impreso = entenderTexto(doc.texto); clase = impreso.clase;
    if (impreso.uuid) {
      const llave = `uuid:${impreso.uuid}`, pareja = documentos.find(d => d.id !== doc.id && d.uuid === impreso.uuid);
      if (yaHay.has(llave) || pareja) return { ...base, estado: "incorporado", clase, uuid: impreso.uuid, relacionadoCon: pareja?.id || null, hojas: hojasVistas, resumen: `Es la versión impresa del comprobante ${impreso.uuid.slice(0, 8)}…, que ya está ${pareja ? `en «${pareja.nombre}»` : "registrado"}. Se guarda junto a él; no se cuenta otra vez.` };
      excepciones.push("Es un comprobante fiscal impreso (trae folio fiscal), pero de un PDF no se saca el total con seguridad. Sube también su XML: con el XML entra exacto y este PDF se le pega solo.");
    } else if (impreso.clase === "banco") excepciones.push("Parece un estado de cuenta del banco. Se sube en la pantalla Banco, que comprueba que los saldos cuadren.");
    else excepciones.push("Se pudo abrir, pero no se reconoce qué es. No se propone nada: dilo tú o captúralo a mano.");
  }
  if (!doc.cfdi && !(doc.hojas || []).length && !doc.texto) excepciones.push("El archivo no trae nada que se pueda leer.");

  const utiles = propuestas.filter(p => p.accion !== "duplicado"), dobles = propuestas.filter(p => p.accion === "duplicado");
  const periodo = periodoDe(propuestas.map(p => p.datos)) || (doc.cfdi?.fecha ? { desde: doc.cfdi.fecha, hasta: doc.cfdi.fecha } : null);
  const estado = utiles.length ? "propuesto" : dobles.length && !excepciones.some(e => /no se reconoce|no se pudo|hay que decir/i.test(e)) ? "duplicado" : excepciones.length ? "por_revisar" : "sin_uso";
  if (empalmes.size) { const dias = [...empalmes.keys()].sort();
    excepciones.push(`OJO: ${dias.length} día(s) de este documento ya están en el histórico por otra fuente (${dias.slice(0, 6).join(", ")}${dias.length > 6 ? "…" : ""}; de ${[...new Set([...empalmes.values()].flat())].slice(0, 3).join(", ")}). Son dos fuentes del MISMO día, no más trabajo: si se incorporan, quedan como evidencia y se cotejan en el Histórico, pero el día cuenta una sola vez.`); }
  const cuenta = (k) => utiles.filter(p => p.destino === k).length;
  const partes = [cuenta("egresos") && `${cuenta("egresos")} gasto(s) por confirmar`, cuenta("historico") && `${cuenta("historico")} renglón(es) al histórico`, cuenta("trabajadores") && `${cuenta("trabajadores")} persona(s) para el catálogo`, cuenta("proveedores") && `${cuenta("proveedores")} proveedor(es) para el catálogo`, dobles.length && `${dobles.length} que ya estaban`, descartadas.length && `${descartadas.length} sin leer`].filter(Boolean);
  return { estado, clase, periodo, propuestas, descartadas, excepciones, hojas: hojasVistas, uuid: doc.cfdi?.uuid || impreso?.uuid || null,
    total: sumarDinero(utiles.map(p => Number(p.datos.monto) || 0)),
    resumen: `${CLASES[clase]}${periodo ? ` · ${periodo.desde === periodo.hasta ? periodo.desde : `${periodo.desde} a ${periodo.hasta}`}` : ""}${partes.length ? ` · ${partes.join(" · ")}` : ""}` };
}

// Una libreta a veces no trae el día legible (o lo trae en el mensaje con que se mandó, no en la hoja). La persona lo
// dice y se le pone a los renglones de raya que NO traían fecha; los que sí traían no se tocan. Queda dicho que la
// fecha la puso una persona (`fechaDicha`), y las llaves se rehacen para que no se duplique con otra foto del mismo día.
export function fecharRaya(resultado, fecha, { historico = [], claves = catalogoDeClaves([]), documento = "" } = {}) {
  const f = aFecha(fecha); if (!f) return { ok: false, dice: "Falta el día (por ejemplo 06/10/2024)." };
  let n = 0; const usadas = new Set(resultado.propuestas.filter(p => !(p.datos.clase === "raya" && !p.datos.fecha)).map(p => p.llave));
  const yaHay = new Set(historico.map(h => h.llave).filter(Boolean)), esDomingo = new Date(`${f}T12:00:00Z`).getUTCDay() === 0;
  // Con el día ya dicho se sabe lo que antes no: si es domingo, si ese día ya llegó por otro documento, y qué significaba
  // cada clave EN ESA FECHA. Es lo mismo que hace `proponer` cuando el papel sí traía su día.
  const otras = [...new Set(historico.filter(h => h.clase === "raya" && h.fecha === f && (h.documento || "otro documento") !== documento).map(h => h.documento || "otro documento"))];
  const dicho = (c) => (c ? { clave: c.clave, significado: c.conocida ? c.significado : null, ...(c.escritaComo ? { escritaComo: c.escritaComo, denominacion: c.denominacion } : {}), ...(c.puedeSer ? { puedeSer: c.puedeSer } : {}) } : null);
  const propuestas = resultado.propuestas.map(p => {
    if (p.datos.clase !== "raya" || p.datos.fecha) return p;
    const rel = relacionDeRenglon({ nombre: p.datos.contraparte, fecha: f, claves: p.datos.claves || [], cultivo: p.datos.cultivoEscrito || "", observacion: p.datos.observacion || "" }, claves);
    const datos = { ...p.datos, fecha: f, mes: f.slice(0, 7), fechaDicha: true, leido: { actividad: dicho(rel.actividad), ubicacion: dicho(rel.ubicacion), cultivo: dicho(rel.cultivo) }, ...(esDomingo ? { domingo: true } : {}), ...(otras.length ? { otraFuente: otras } : {}) };
    const llave = llaveDe({ clase: "raya", fecha: f, nombre: datos.contraparte, claves: (datos.claves || []).map(k => canonica(k, claves)), observacion: datos.observacion });
    n++; if (usadas.has(llave)) return { ...p, datos, llave, accion: "duplicado", nota: "Viene repetido dentro del mismo documento." };
    usadas.add(llave); if (yaHay.has(llave)) return { ...p, datos, llave, accion: "duplicado", nota: "Este renglón ya está en el histórico." };
    return { ...p, datos, llave };
  });
  if (!n) return { ok: false, dice: "Todos los renglones ya traían su día." };
  const excepciones = (resultado.excepciones || []).filter(e => !/sin día|No se sabe de qué día/.test(e));
  if (esDomingo) excepciones.push(`El ${f} es domingo. Se conserva la fecha como se dijo; no se pasa al lunes aunque otros documentos de esa época sólo tengan de lunes a sábado.`);
  if (otras.length) excepciones.push(`OJO: el ${f} ya está en el histórico por otra fuente (${otras.slice(0, 3).join(", ")}). Son dos fuentes del MISMO día, no más trabajo: si se incorporan, quedan como evidencia y se cotejan en el Histórico, pero el día cuenta una sola vez.`);
  return { ok: true, puestos: n, resultado: { ...resultado, propuestas, periodo: periodoDe(propuestas.map(p => p.datos)), excepciones } };
}

export function refrescar(resultado, { egresos = [], historico = [], trabajadores = [], encargados = [], proveedores = [] } = {}) {
  const yaHay = new Set([...egresos.filter(e => !e.cancelado).map(llaveDeEgreso), ...historico.map(h => h.llave).filter(Boolean), ...[...trabajadores, ...encargados].map(p => `persona:${corto(p.nombre)}`), ...proveedores.map(p => `proveedor:${corto(p.nombre)}`)]);
  let cambiaron = 0;
  const propuestas = (resultado.propuestas || []).map(p => { if (p.accion !== "duplicado" && yaHay.has(p.llave)) { cambiaron++; return { ...p, accion: "duplicado", nota: "Mientras tanto ya se registró por otro lado: no se propone otra vez." }; } return p; });
  return { ...resultado, propuestas, cambiaron };
}

/* ════════════ 9 · INCORPORAR ════════════ */
// De las propuestas confirmadas a los registros que se guardan. NO guarda: devuelve las operaciones.
//   escogidas: las llaves que la persona dejó marcadas (por defecto, todas las que no son duplicado)
export function incorporar(doc, resultado, { escogidas = null, quien = null, fecha = "", nuevoId = (p) => `${p}${Date.now()}${Math.floor(Math.random() * 1e6)}` } = {}) {
  const ops = [], van = resultado.propuestas.filter(p => p.accion !== "duplicado" && (!escogidas || escogidas.includes(p.llave)));
  const origen = { documentoId: doc.id, documento: doc.nombre, importado: fecha, por: quien?.nombre || "" };
  for (const p of van) {
    if (p.destino === "egresos") ops.push({ sec: "egresos", item: { id: nuevoId("eg"), ...p.datos, _importado: origen, registradoPor: quien ? { rol: quien.rol, id: quien.id, nombre: quien.nombre } : undefined } });
    else if (p.destino === "historico") ops.push({ sec: "historico", item: { id: nuevoId("h"), ...p.datos, llave: p.llave, _importado: origen } });
    else if (p.destino === "trabajadores") ops.push({ sec: "trabajadores", item: { id: nuevoId("t"), nombre: p.datos.nombre, puesto: p.datos.puesto || "", ...(p.datos.sueldo_dia ? { sueldo_dia: p.datos.sueldo_dia } : {}), ...(p.datos.fechaIngreso ? { fechaIngreso: p.datos.fechaIngreso } : {}), categoria: "jornalero", activo: true, _importado: origen } });
    else if (p.destino === "proveedores") ops.push({ sec: "proveedores", item: { id: nuevoId("pv"), nombre: p.datos.nombre, rfc: p.datos.rfc || "", telefono: p.datos.telefono || "", giro: p.datos.giro || "", _importado: origen } });
  }
  const cuenta = {}; for (const o of ops) cuenta[o.sec] = (cuenta[o.sec] || 0) + 1;
  return { ops, cuenta, incorporadas: van.map(p => p.llave) };
}

/* ════════════ 10 · LA BANDEJA ════════════ */
export function resumenDeBandeja(documentos = []) {
  const por = {}; for (const k of Object.keys(ESTADOS)) por[k] = 0;
  for (const d of documentos) por[d.estado] = (por[d.estado] || 0) + 1;
  return { total: documentos.length, por, pendientes: (por.recibido || 0), porAtender: (por.propuesto || 0) + (por.por_revisar || 0) + (por.necesita_lectura || 0) + (por.error || 0) };
}
// Los documentos que hablan de la misma operación (el XML y el PDF de una factura): por su folio fiscal.
export function relacionados(documentos = []) {
  const m = new Map();
  for (const d of documentos) if (d.uuid) { if (!m.has(d.uuid)) m.set(d.uuid, []); m.get(d.uuid).push(d.id); }
  return [...m.entries()].filter(([, ids]) => ids.length > 1).map(([uuid, ids]) => ({ uuid, ids }));
}
// Para volver a intentar: lo que tronó o se quedó a medias, sin pasar de tres intentos seguidos por sí solo.
export const porProcesar = (documentos = [], { maxIntentos = 3 } = {}) => documentos.filter(d => d.estado === "recibido" || (d.estado === "error" && (d.intentos || 0) < maxIntentos && d.reintentar));
// Resumen del histórico, por mes y clase: para consultar y comparar, sin mezclarlo con la operación.
export function resumenDelHistorico(historico = []) {
  const m = new Map();
  for (const h of historico) { const k = `${h.mes || "sin fecha"}|${h.clase}`; const x = m.get(k) || { mes: h.mes || "sin fecha", clase: h.clase, monto: 0, n: 0 }; x.monto = sumarDinero(x.monto, Number(h.monto) || 0); x.n++; m.set(k, x); }
  return [...m.values()].sort((a, b) => a.mes.localeCompare(b.mes) || a.clase.localeCompare(b.clase));
}

/* ════════════ 11 · LA BANDEJA COMO EVENTOS ════════════ */
// Cada cosa que le pasa a un documento es un evento (como todo en la app): se recibió, se leyó, se incorporó, se
// descartó. Nada se edita ni se borra; el estado del documento se CALCULA. El histórico también son eventos, por
// lotes, así que deshacer una incorporación es cancelar su lote: no queda nada regado.
export const T_DOC = { recibido: "doc_recibido", leido: "doc_leido", incorporado: "doc_incorporado", descartado: "doc_descartado", historico: "historico_lote", aprendida: "hoja_aprendida" };
export const RENGLONES_POR_LOTE = 400;
const limpio = (s) => String(s || "").trim();

export function recibirDocumento({ huella, nombre, ruta = "", formato, bytes, lote, original = null, eventos = [], quien, cuando, fecha, azar }) {
  if (!huella) return { ok: false, dice: "No se pudo sacar la huella del archivo." };
  const ya = bandejaDe(eventos).find(d => d.huella === huella);
  if (ya) return { ok: false, repetido: true, docId: ya.id, dice: `«${nombre}» es el mismo archivo que «${ya.nombre}», que ya se había recibido el ${ya.fecha}. No se recibe otra vez.` };
  return { ok: true, evento: nuevoEvento({ id: `doc-${huella.slice(0, 32)}`, tipo: T_DOC.recibido, cuando, fecha, quien, azar, datos: { huella, nombre: limpio(nombre), ruta: limpio(ruta), formato, bytes: bytes || 0, lote: lote || "", ...(original ? { original } : {}) } }) };
}
// Lo que salió de leerlo. Los renglones propuestos NO van aquí (pueden ser miles): se quedan en el aparato hasta confirmarse.
export function anotarLectura({ doc, resultado, error = "", ia = null, quien, cuando, fecha, azar }) {
  const utiles = (resultado?.propuestas || []).filter(p => p.accion !== "duplicado"), n = {};
  for (const p of utiles) n[p.destino] = (n[p.destino] || 0) + 1;
  // Para saber después si a este documento le serviría la IA: cuántas hojas no se reconocieron, o si el texto no se entendió.
  const sinReconocer = (resultado?.hojas || []).filter(h => h.clase === "desconocido").length, sinEntender = !!resultado && resultado.estado === "por_revisar" && resultado.clase === "desconocido" && sinReconocer === 0 && !(resultado.uuid) && !ia;
  const datos = error ? { docId: doc.id, estado: "error", error: limpio(error).slice(0, 300), intento: (doc.intentos || 0) + 1, ...(ia ? { ia } : {}) }
    : { docId: doc.id, estado: resultado.estado, clase: resultado.clase, periodo: resultado.periodo || null, resumen: resultado.resumen || "", excepciones: (resultado.excepciones || []).slice(0, 12), uuid: resultado.uuid || null,
        n, duplicados: (resultado.propuestas || []).length - utiles.length, sinLeer: (resultado.descartadas || []).length, total: resultado.total || 0, intento: (doc.intentos || 0) + 1,
        ...(sinReconocer ? { hojasSinReconocer: sinReconocer } : {}), ...(sinEntender ? { sinEntender: true } : {}), ...(ia ? { ia } : {}),
        ...(resultado.duplicadoDe ? { duplicadoDe: resultado.duplicadoDe } : {}), ...(resultado.relacionadoCon ? { relacionadoCon: resultado.relacionadoCon } : {}) };
  return nuevoEvento({ tipo: T_DOC.leido, cuando, fecha, quien, azar, datos });
}
// Confirmar: devuelve TODO lo que hay que guardar — los registros (gastos, personas, proveedores), los lotes del
// histórico y la marca de «incorporado». Si no se escogió nada, no hace nada.
export function confirmarIncorporacion({ doc, resultado, escogidas = null, conIA = false, quien, cuando, fecha, azar = Math.random, nuevoId }) {
  if (doc.estado === "incorporado") return { ok: false, dice: "Ese documento ya se incorporó. Un papel se aplica una sola vez." };
  const { ops, cuenta, incorporadas } = incorporar(doc, resultado, { escogidas, quien, fecha, ...(nuevoId ? { nuevoId } : {}) });
  if (ops.length === 0) return { ok: false, dice: "No hay nada escogido que incorporar." };
  const registros = ops.filter(o => o.sec !== "historico"), renglones = ops.filter(o => o.sec === "historico").map(o => { const { id, _importado, ...r } = o.item; return r; });
  const eventos = [];
  for (let i = 0; i < renglones.length; i += RENGLONES_POR_LOTE)
    eventos.push(nuevoEvento({ tipo: T_DOC.historico, cuando, fecha, quien, azar: typeof azar === "function" ? azar() : azar + i / 1e9, datos: { docId: doc.id, documento: doc.nombre, parte: i / RENGLONES_POR_LOTE + 1, renglones: renglones.slice(i, i + RENGLONES_POR_LOTE) } }));
  eventos.push(nuevoEvento({ tipo: T_DOC.incorporado, cuando, fecha, quien, azar: typeof azar === "function" ? azar() : azar + 0.5, datos: { docId: doc.id, cuenta, renglones: incorporadas.length, registros: registros.map(o => ({ sec: o.sec, id: o.item.id })), lotes: eventos.map(e => e.id),
    // Si lo leyó la IA: ¿la persona aceptó todo lo propuesto, o quitó algo? De ahí sale qué tan bien lee.
    ...(conIA ? { ia: { sinCambios: incorporadas.length === resultado.propuestas.filter(p => p.accion !== "duplicado").length } } : {}) } }));
  return { ok: true, registros, eventos, cuenta };
}
export function descartarDocumento({ doc, motivo, quien, cuando, fecha, azar }) {
  if (limpio(motivo).length < 4) return { ok: false, dice: "Falta decir por qué se descarta (por ejemplo: «no es del rancho», «ya está capturado»)." };
  if (doc.estado === "incorporado") return { ok: false, dice: "Ese documento ya se incorporó: no se descarta. Si entró mal, se cancela lo que generó." };
  return { ok: true, evento: nuevoEvento({ tipo: T_DOC.descartado, cuando, fecha, quien, azar, datos: { docId: doc.id, motivo: limpio(motivo) } }) };
}
export function eventoDeAprendizaje({ aprendidos, encabezados, clase, mapa, quien, cuando, fecha, azar }) {
  const a = aprenderHoja(aprendidos, { encabezados, clase, mapa, quien: quien?.nombre || "", fecha });
  if (!a.ok) return a;
  return { ok: true, patron: a.patron, evento: nuevoEvento({ tipo: T_DOC.aprendida, cuando, fecha, quien, azar, datos: { firma: a.patron.firma, clase, mapa: a.patron.mapa } }) };
}

// El estado de cada documento, calculado de sus eventos. El último «leído» manda; «incorporado» y «descartado» cierran.
export function bandejaDe(eventos = []) {
  const v = vigentes(eventos).filter(e => Object.values(T_DOC).includes(e.tipo)).sort((a, b) => String(a.cuando).localeCompare(String(b.cuando)));
  const docs = new Map();
  for (const e of v) if (e.tipo === T_DOC.recibido) docs.set(e.id, { id: e.id, ...e.datos, estado: "recibido", fecha: e.fecha, recibido: e.cuando, recibio: e.quien?.nombre || "", intentos: 0, excepciones: [], n: {}, resumen: "" });
  for (const e of v) {
    const d = docs.get(e.datos?.docId); if (!d) continue;
    if (e.tipo === T_DOC.leido && d.estado !== "incorporado" && d.estado !== "descartado") Object.assign(d, { estado: e.datos.estado, clase: e.datos.clase || d.clase, periodo: e.datos.periodo || null, resumen: e.datos.resumen || "", excepciones: e.datos.excepciones || [], uuid: e.datos.uuid || d.uuid || null,
      n: e.datos.n || {}, duplicados: e.datos.duplicados || 0, sinLeer: e.datos.sinLeer || 0, total: e.datos.total || 0, intentos: e.datos.intento || d.intentos + 1, error: e.datos.error || "", duplicadoDe: e.datos.duplicadoDe || null, relacionadoCon: e.datos.relacionadoCon || null, leido: e.cuando,
      hojasSinReconocer: e.datos.hojasSinReconocer || 0, sinEntender: !!e.datos.sinEntender, ia: e.datos.ia || d.ia || null, iaMicrousd: (d.iaMicrousd || 0) + (Number(e.datos.ia?.microusd) || 0) });
    else if (e.tipo === T_DOC.incorporado) Object.assign(d, { estado: "incorporado", cuenta: e.datos.cuenta || {}, incorporado: e.cuando, incorporo: e.quien?.nombre || "", registros: e.datos.registros || [], lotes: e.datos.lotes || [], eventoIncorporacion: e.id });
    else if (e.tipo === T_DOC.descartado) Object.assign(d, { estado: "descartado", motivo: e.datos.motivo, descarto: e.quien?.nombre || "" });
  }
  return [...docs.values()].sort((a, b) => String(b.recibido).localeCompare(String(a.recibido)));
}
// El histórico: todos los renglones de los lotes vigentes, cada uno con su documento.
export function historicoDe(eventos = []) {
  return vigentes(eventos).filter(e => e.tipo === T_DOC.historico).flatMap(e => (e.datos.renglones || []).map((r, i) => ({ ...r, id: `${e.id}:${i}`, docId: e.datos.docId, documento: e.datos.documento, lote: e.id })));
}
export const aprendidosDe = (eventos = []) => { const m = new Map(); for (const e of vigentes(eventos).filter(x => x.tipo === T_DOC.aprendida).sort((a, b) => String(a.cuando).localeCompare(String(b.cuando)))) m.set(e.datos.firma, { firma: e.datos.firma, clase: e.datos.clase, mapa: e.datos.mapa, quien: e.quien?.nombre || "", fecha: e.fecha }); return [...m.values()]; };
