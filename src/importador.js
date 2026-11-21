// ════════════════════════════════════════════════════════════════════════
//  ABRIR CADA ARCHIVO — la parte que sí toca el navegador
//
//  Las reglas (qué es, qué se propone, qué no se duplica) viven en
//  `importacion.js` y están probadas. Aquí sólo se abre el archivo y se deja
//  en la forma que esas reglas entienden: un CFDI, hojas, o texto.
//
//  Todo se lee EN EL APARATO: gratis, sin mandar el documento a ningún lado y
//  sin señal. Lo único que no se puede leer así es una imagen o un escaneo
//  (hace falta la lectura con IA, que es un gasto y la autoriza Luis): ésos
//  se guardan y se dicen, no se inventan.
// ════════════════════════════════════════════════════════════════════════
import * as XLSX from "xlsx";
import { sha256Hex } from "./archivos.js";
import { supabase, supabaseListo } from "./supabase";
import { formatoDe, leerCfdi, csvAFilas, docxAContenido, entenderHoja } from "./importacion.js";

export const TOPE_DE_LECTURA = 20 * 1024 * 1024;     // más que esto no se abre en un teléfono sin atorarlo
export const TOPE_DE_RENGLONES = 20000;
const MIME = { xml: "application/xml", excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", pdf: "application/pdf", word: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", texto: "text/plain" };

const aTexto = (bytes) => { try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return new TextDecoder("windows-1252").decode(bytes); } };

// Abre un archivo. Nunca truena: si no puede, devuelve `error` con el porqué.
export async function abrirArchivo(file) {
  const nombre = file.name || "archivo", formato = formatoDe(nombre, file.type);
  const base = { nombre, ruta: (file.webkitRelativePath || "").replace(/[^/]*$/, "").replace(/\/$/, ""), formato, bytes: file.size || 0 };
  if (formato === "otro") return { ...base, error: "Ese tipo de archivo no se puede abrir aquí. Se aceptan XML, Excel, CSV, PDF, Word (.docx) e imágenes." };
  if (file.size > TOPE_DE_LECTURA) return { ...base, error: `Pesa ${(file.size / 1048576).toFixed(1)} MB y aquí se abren archivos de hasta ${TOPE_DE_LECTURA / 1048576} MB. Pártelo en varios o súbelo desde una computadora.` };
  let bytes;
  try { bytes = new Uint8Array(await file.arrayBuffer()); } catch (e) { return { ...base, error: `No se pudo leer el archivo (${e?.message || e}).` }; }
  const doc = { ...base, huella: sha256Hex(bytes), tipo: file.type || MIME[formato] || "application/octet-stream", _bytes: bytes };
  try {
    if (formato === "imagen" || formato === "word_viejo") return doc;
    if (formato === "xml") { const t = aTexto(bytes), c = leerCfdi(t); return c.ok ? { ...doc, cfdi: c } : { ...doc, texto: t.replace(/<[^>]+>/g, " ").slice(0, 20000), aviso: c.dice }; }
    if (formato === "csv" || formato === "texto") { const t = aTexto(bytes), filas = csvAFilas(t).slice(0, TOPE_DE_RENGLONES); return { ...doc, hojas: [{ nombre: "Hoja", filas }], texto: t.slice(0, 20000) }; }
    if (formato === "excel") {
      const wb = XLSX.read(bytes, { type: "array", cellDates: false, raw: true });
      const hojas = wb.SheetNames.slice(0, 30).map(n => ({ nombre: n, filas: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "", blankrows: false, raw: true }).slice(0, TOPE_DE_RENGLONES) })).filter(h => h.filas.length > 0);
      return { ...doc, hojas };
    }
    if (formato === "word") {
      const zip = XLSX.CFB.read(bytes, { type: "array" }), parte = XLSX.CFB.find(zip, "word/document.xml") || XLSX.CFB.find(zip, "/word/document.xml");
      if (!parte?.content) return { ...doc, error: "El Word no trae contenido que se pueda leer (¿está dañado o protegido?)." };
      const c = docxAContenido(aTexto(parte.content instanceof Uint8Array ? parte.content : new Uint8Array(parte.content)));
      return { ...doc, hojas: c.tablas.map((filas, i) => ({ nombre: `Tabla ${i + 1}`, filas })), texto: c.texto.slice(0, 40000) };
    }
    if (formato === "pdf") {
      const pdf = await import("./pdf.js");
      const r = await pdf.leerPdf(new File([bytes], nombre, { type: "application/pdf" }), { maxPaginas: 60 });
      if (!r.ok) return { ...doc, error: r.dice };
      if (r.clase === "escaneado" || (r.renglones || []).length === 0) return { ...doc, escaneado: true };
      // ¿Trae una tabla? Se busca el renglón de encabezados y las columnas salen de la POSICIÓN de cada celda.
      const crudas = r.filas.map(f => f.celdas.map(c => c.texto)), e = entenderHoja(crudas);
      const hojas = [];
      if (e.i >= 0) { const alineadas = pdf.columnasPorPosicion(r.filas[e.i], r.filas.slice(e.i + 1)); if (alineadas) hojas.push({ nombre: "Tabla del PDF", filas: [crudas[e.i], ...alineadas].slice(0, TOPE_DE_RENGLONES) }); }
      return { ...doc, hojas, texto: (r.texto || "").slice(0, 40000), aviso: r.recortado || "" };
    }
  } catch (e) { return { ...doc, error: `No se pudo abrir (${e?.message || e}).` }; }
  return doc;
}

// El original, para guardarlo: como «data:…» (así lo saca y lo sube el almacén de archivos, igual que una foto).
export function originalDe(doc) {
  if (!doc?._bytes) return null;
  let bin = ""; const b = doc._bytes; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return `data:${doc.tipo};base64,${btoa(bin)}`;
}

/* ──── Lo que se queda en el aparato mientras se confirma ──── */
// Las propuestas de un documento pueden ser miles de renglones: no viajan a la nube hasta que una persona las
// confirma. Viven aquí, en la base del navegador, por documento. Si el aparato se apaga a media carga, siguen ahí.
let bd = null;
const abrir = (nombreBD) => new Promise((ok) => { if (bd) return ok(bd); try { const p = indexedDB.open(nombreBD, 1); p.onupgradeneeded = () => p.result.createObjectStore("propuestas", { keyPath: "id" }); p.onsuccess = () => { bd = p.result; ok(bd); }; p.onerror = () => ok(null); } catch { ok(null); } });
const enMemoria = new Map();
const pedir = (r) => new Promise((ok) => { r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); });
export async function guardarPropuesta(nombreBD, id, resultado) { enMemoria.set(id, resultado); const b = await abrir(nombreBD); if (b) await pedir(b.transaction("propuestas", "readwrite").objectStore("propuestas").put({ id, resultado, cuando: new Date().toISOString() })); }
export async function leerPropuesta(nombreBD, id) { if (enMemoria.has(id)) return enMemoria.get(id); const b = await abrir(nombreBD); if (!b) return null; const r = await pedir(b.transaction("propuestas", "readonly").objectStore("propuestas").get(id)); if (r?.resultado) enMemoria.set(id, r.resultado); return r?.resultado || null; }
export async function olvidarPropuesta(nombreBD, id) { enMemoria.delete(id); const b = await abrir(nombreBD); if (b) await pedir(b.transaction("propuestas", "readwrite").objectStore("propuestas").delete(id)); }

/* ──── La lectura con IA: preparar lo que se manda, y pedirla al servidor ──── */
// Una foto se achica ANTES de mandarla: más de 1568 pixeles por lado no se lee mejor y sí cuesta más.
export function imagenParaIA(blob, { lado = 1568, calidad = 0.82 } = {}) {
  return new Promise((ok) => {
    const url = URL.createObjectURL(blob), img = new Image();
    img.onload = () => {
      try {
        const e = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight)), lienzo = document.createElement("canvas");
        lienzo.width = Math.max(1, Math.round(img.naturalWidth * e)); lienzo.height = Math.max(1, Math.round(img.naturalHeight * e));
        lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
        ok({ ok: true, imagen: { tipoMedio: "image/jpeg", base64: lienzo.toDataURL("image/jpeg", calidad).split(",")[1] } });
      } catch (err) { ok({ ok: false, dice: `No se pudo preparar la imagen (${err?.message || err}).` }); }
      finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); ok({ ok: false, dice: "Este aparato no pudo abrir la imagen (¿es un formato que el navegador no conoce, como HEIC?). Conviértela a JPG y vuelve a subirla." }); };
    img.src = url;
  });
}
export async function paginasParaIA(blob, nombre) { const pdf = await import("./pdf.js"); return pdf.paginasComoImagenes(new File([blob], nombre || "documento.pdf", { type: "application/pdf" })); }

// Pedirle la lectura al servidor. La llave de la IA vive allá; aquí sólo se manda el documento y se recibe lo leído y lo que costó.
// Nunca truena: si no se pudo, devuelve { error, dice }.
export async function pedirInterpretacion(pedido) {
  // (En desarrollo, las pruebas ponen aquí un servidor de mentira: no se gasta ni un centavo probando.)
  if (import.meta.env.DEV && typeof window !== "undefined" && typeof window.__agroIA === "function") return window.__agroIA(pedido);
  if (!supabaseListo) return { error: "sin_nube", dice: "Este aparato no está conectado a la nube: la lectura con IA se pide al servidor." };
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { error: "sin_senal", dice: "Leer con IA necesita señal. El documento queda guardado." };
  try {
    const { data, error } = await supabase.functions.invoke("interpretar-documento", { body: pedido });
    if (error) {
      let cuerpo = null; try { cuerpo = await error.context?.json?.(); } catch { /* sin cuerpo */ }
      return cuerpo?.error ? cuerpo : { error: "fallo", dice: `No se pudo pedir la lectura con IA (${error.message}).` };
    }
    return data || { error: "fallo", dice: "El servidor no contestó nada." };
  } catch (e) { return { error: "fallo", dice: `No se pudo pedir la lectura con IA (${e?.message || e}).` }; }
}
export async function leerPresupuestoIA() {
  if (import.meta.env.DEV && typeof window !== "undefined" && window.__agroPresupuestoIA) return typeof window.__agroPresupuestoIA === "function" ? window.__agroPresupuestoIA() : window.__agroPresupuestoIA;
  if (!supabaseListo) return null;
  try { const { data, error } = await supabase.rpc("presupuesto_ia"); return error ? null : data; } catch { return null; }
}
