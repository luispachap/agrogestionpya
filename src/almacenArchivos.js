// ════════════════════════════════════════════════════════════════════════
//  ALMACÉN DE ARCHIVOS — la parte que sí toca el teléfono y la red
//
//  Las reglas (qué se saca, la huella, los topes) viven en archivos.js y
//  están probadas. Aquí sólo se guarda y se sube:
//
//   1. La foto se guarda EN EL TELÉFONO en cuanto se toma (IndexedDB, que
//      aguanta cientos de fotos; la memoria de antes se llenaba con veinte).
//   2. Cuando hay señal y una cuenta ligada, sube al almacén privado.
//   3. Para verla: primero la copia del teléfono; si no está aquí, se pide a
//      la nube un enlace que caduca en una hora. Nunca hay enlace público.
//
//  Nunca se borra la copia del teléfono antes de confirmar que subió.
// ════════════════════════════════════════════════════════════════════════
import { supabase, supabaseListo } from "./supabase";
import { leerReferencia, partirDataUrl, revisarArchivo } from "./archivos.js";

const BD = "agro_archivos_v1", CAJON = "archivos", BODEGA = "comprobantes";
let bd = null;
const enMemoria = new Map();   // id → dataURL recién tomada (se ve al instante)
const enlaces = new Map();     // id → enlace para <img> (del teléfono o de la nube)

export const almacenListo = () => !!bd;

export function abrirAlmacen() {
  return new Promise((ok) => {
    if (bd) return ok(true);
    try {
      const p = indexedDB.open(BD, 1);
      p.onupgradeneeded = () => p.result.createObjectStore(CAJON, { keyPath: "id" });
      p.onsuccess = () => {
        bd = p.result;
        // Pedirle al navegador que NO tire estas fotos si le falta espacio.
        try { navigator.storage?.persist?.(); } catch { /* no todos lo traen */ }
        ok(true);
      };
      p.onerror = () => ok(false);   // modo privado: la app sigue como antes, con la foto dentro del registro
    } catch { ok(false); }
  });
}

const cajon = (modo) => bd.transaction(CAJON, modo).objectStore(CAJON);
const pedir = (r) => new Promise((ok, mal) => { r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); });

// Guarda en el teléfono un archivo recién sacado de un registro.
export function guardarEnTelefono(a) {
  enMemoria.set(a.id, a.dataUrl);
  if (!bd) return;
  const p = partirDataUrl(a.dataUrl);
  if (!p) return;
  const rev = revisarArchivo({ tipo: a.tipo, bytes: a.bytes });
  (async () => {
    try {
      const ya = await pedir(cajon("readonly").get(a.id));
      if (ya) return;                 // misma huella = mismo archivo: no se guarda dos veces
      await pedir(cajon("readwrite").put({
        id: a.id, ruta: a.ruta, tipo: a.tipo, bytes: a.bytes,
        blob: new Blob([p.bytes], { type: a.tipo }),
        subido: false, noSube: rev.sube ? null : rev.dice, cuando: new Date().toISOString(),
      }));
    } catch (e) { console.warn("No se pudo guardar el archivo en el teléfono:", e?.message); }
  })();
}

const aDataUrl = (blob) => new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(null); fr.readAsDataURL(blob); });

// Para enseñarlo en pantalla. Devuelve un enlace o null si no se puede ver ahora.
export async function enlaceDeArchivo(valor) {
  const ref = leerReferencia(valor);
  if (!ref) return valor || null;                 // fotos viejas que aún viven dentro del registro
  if (enMemoria.has(ref.id)) return enMemoria.get(ref.id);
  if (enlaces.has(ref.id)) return enlaces.get(ref.id);
  if (bd) {
    try {
      const f = await pedir(cajon("readonly").get(ref.id));
      if (f?.blob) { const u = URL.createObjectURL(f.blob); enlaces.set(ref.id, u); return u; }
    } catch { /* se intenta la nube */ }
  }
  if (!supabaseListo) return null;
  try {
    const { data, error } = await supabase.storage.from(BODEGA).createSignedUrl(ref.ruta, 3600);
    if (error || !data?.signedUrl) return null;
    enlaces.set(ref.id, data.signedUrl);
    setTimeout(() => enlaces.delete(ref.id), 50 * 60 * 1000);   // el enlace caduca: no se guarda de más
    return data.signedUrl;
  } catch { return null; }
}

// Para mandarlo a leer: el contenido completo, no un enlace.
export async function contenidoDeArchivo(valor) {
  const ref = leerReferencia(valor);
  if (!ref) return valor || null;
  if (enMemoria.has(ref.id)) return enMemoria.get(ref.id);
  try {
    if (bd) { const f = await pedir(cajon("readonly").get(ref.id)); if (f?.blob) return await aDataUrl(f.blob); }
    if (!supabaseListo) return null;
    const { data, error } = await supabase.storage.from(BODEGA).download(ref.ruta);
    return error || !data ? null : await aDataUrl(data);
  } catch { return null; }
}

// Sube lo que falta. Se llama cuando hay señal y una cuenta ligada.
// `lleno` = el medidor dice que el almacén ya no acepta archivos: no se
// intenta (sólo gastaría datos) y se dice.
export async function subirArchivosPendientes({ lleno = false } = {}) {
  const res = { subidos: 0, faltan: 0, noSuben: 0, motivo: "" };
  if (!bd || !supabaseListo) return res;
  let todos = [];
  try { todos = await pedir(cajon("readonly").getAll()); } catch { return res; }
  const faltan = todos.filter(f => !f.subido);
  for (const f of faltan) {
    if (f.noSube) { res.noSuben++; continue; }
    if (lleno) { res.faltan++; res.motivo = "El almacén de la nube está lleno: las fotos se quedan en este teléfono hasta que se libere espacio."; continue; }
    try {
      const { error } = await supabase.storage.from(BODEGA).upload(f.ruta, f.blob, { contentType: f.tipo, upsert: false });
      // "Ya existe" es una buena noticia: alguien más subió esta misma foto.
      const yaEstaba = error && (String(error.statusCode) === "409" || /exist|duplicate/i.test(error.message || ""));
      if (error && !yaEstaba) { res.faltan++; res.motivo = error.message || "no se pudo subir"; continue; }
      await pedir(cajon("readwrite").put({ ...f, subido: true, subidoEl: new Date().toISOString() }));
      res.subidos++;
    } catch (e) { res.faltan++; res.motivo = e?.message || "sin señal"; }
  }
  return res;
}

export async function archivosSinSubir() {
  if (!bd) return { cuantos: 0, bytes: 0, noSuben: 0 };
  try {
    const todos = (await pedir(cajon("readonly").getAll())).filter(f => !f.subido);
    return { cuantos: todos.length, bytes: todos.reduce((s, f) => s + (f.bytes || 0), 0), noSuben: todos.filter(f => f.noSube).length };
  } catch { return { cuantos: 0, bytes: 0, noSuben: 0 }; }
}

// La huella de una foto recién tomada, para preguntar si ya se leyó antes.
export { sha256Hex } from "./archivos.js";
