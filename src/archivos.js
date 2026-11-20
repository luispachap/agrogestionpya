// ════════════════════════════════════════════════════════════════════════
//  ARCHIVOS — las fotos y los PDF salen de los registros
//
//  Antes la foto de un ticket viajaba DENTRO del registro: unas 20 fotos
//  llenaban la memoria del teléfono, y la base gratuita (500 MB) se habría
//  llenado en meses. Ahora el registro guarda sólo una REFERENCIA
//  ("archivo:<huella>.jpg") y el archivo vive aparte: en el teléfono mientras
//  sube, y en el almacén privado de la nube después.
//
//  La huella es el SHA-256 del contenido. Por eso la misma foto subida dos
//  veces ocupa una sola vez, y por eso un documento ya leído con IA no se
//  vuelve a mandar: se reconoce por su huella.
//
//  Todo lo de aquí es puro (sin red, sin cámara) para poderlo probar.
// ════════════════════════════════════════════════════════════════════════

export const TOPE_ARCHIVO_BYTES = 3 * 1024 * 1024;       // el mismo tope del almacén (hoja SQL 26)
// Fotos y PDF (los comprobantes de siempre) y, desde la importación de documentos, los originales que se suben por
// montones: el XML de una factura, un Excel, un CSV o un Word. La misma lista está en la hoja SQL 43.
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/xml", "text/xml", "text/csv", "text/plain", XLSX_MIME, "application/vnd.ms-excel", DOCX_MIME];
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf", "application/xml": "xml", "text/xml": "xml", "text/csv": "csv", "text/plain": "txt", [XLSX_MIME]: "xlsx", "application/vnd.ms-excel": "xls", [DOCX_MIME]: "docx" };
const PREFIJO = "archivo:";
// Menos de esto no vale la pena sacarlo: un icono chico no es un comprobante.
const MINIMO_PARA_SACAR = 4000;

/* ──── SHA-256, de un jalón y sin esperar ──── */
// Se necesita SIN "await": guardar un registro en la app es inmediato y no
// puede quedarse esperando. Una foto de 400 kB tarda unos milisegundos.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
export function sha256Hex(bytes) {
  const n = bytes.length;
  const largo = ((n + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(largo);
  m.set(bytes); m[n] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(largo - 8, Math.floor((n * 8) / 4294967296)); dv.setUint32(largo - 4, (n * 8) >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let o = 0; o < largo; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15], b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  return Array.from(h, x => x.toString(16).padStart(8, "0")).join("");
}

/* ──── De "data:image/jpeg;base64,..." a bytes ──── */
export function partirDataUrl(dataUrl) {
  const m = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)?(;[^,]*)?,(.*)$/is.exec(String(dataUrl || ""));
  if (!m) return null;
  const tipo = (m[1] || "application/octet-stream").toLowerCase();
  const base64 = /;base64/i.test(m[2] || "");
  let bin;
  try { bin = base64 ? atob(m[3]) : decodeURIComponent(m[3]); } catch { return null; }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { tipo, bytes };
}

/* ──── Referencias ──── */
export const esReferencia = (v) => typeof v === "string" && v.startsWith(PREFIJO);
export const referenciaDe = (id, tipo) => `${PREFIJO}${id}.${EXT[tipo] || "bin"}`;
// "archivo:abc.jpg" → { id: "abc", ruta: "abc.jpg" }. La ruta es el nombre en el almacén.
export function leerReferencia(v) {
  if (!esReferencia(v)) return null;
  const ruta = v.slice(PREFIJO.length);
  return { id: ruta.replace(/\.[a-z0-9]+$/i, ""), ruta };
}
const esArchivoIncrustado = (v) =>
  typeof v === "string" && v.length >= MINIMO_PARA_SACAR && /^data:(image\/|application\/pdf|application\/xml|text\/xml|text\/csv|text\/plain|application\/vnd\.openxmlformats-officedocument\.|application\/vnd\.ms-excel)/i.test(v);

// Saca de un registro todo archivo incrustado y deja en su lugar la referencia.
// Devuelve el registro ya ligero y la lista de archivos que hay que guardar.
// El mismo archivo dos veces en el registro (la foto del papel y la del egreso)
// sale UNA vez. No modifica el registro original.
export function sacarArchivos(registro) {
  const archivos = new Map();
  const andar = (v, hondo) => {
    if (esArchivoIncrustado(v)) {
      const p = partirDataUrl(v);
      if (!p) return v;                       // no se pudo leer: se deja como estaba, no se pierde
      const id = sha256Hex(p.bytes);
      if (!archivos.has(id)) archivos.set(id, { id, tipo: p.tipo, bytes: p.bytes.length, ruta: `${id}.${EXT[p.tipo] || "bin"}`, dataUrl: v });
      return referenciaDe(id, p.tipo);
    }
    if (hondo > 6 || v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(x => andar(x, hondo + 1));
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = andar(x, hondo + 1);
    return o;
  };
  const limpio = andar(registro, 0);
  return { registro: limpio, archivos: [...archivos.values()] };
}

// ¿Este archivo puede subir al almacén? Nunca bloquea GUARDARLO en el
// teléfono: la evidencia de un pago no se pierde. Sólo dice si va a subir.
export function revisarArchivo({ tipo, bytes }) {
  if (!TIPOS_ACEPTADOS.includes(tipo)) return { sube: false, dice: `El almacén sólo acepta fotos y PDF (esto es ${tipo || "de tipo desconocido"}). Se queda guardado en este teléfono.` };
  if (bytes > TOPE_ARCHIVO_BYTES) return { sube: false, dice: `Pesa ${aMB(bytes)} y el tope es ${aMB(TOPE_ARCHIVO_BYTES)}. Se queda guardado en este teléfono; hay que volver a tomarlo más ligero.` };
  return { sube: true, dice: "" };
}

// A qué tamaño dejar una foto antes de guardarla. Un ticket se lee bien a
// 1600 px; más que eso sólo ocupa lugar.
export function planDeCompresion({ ancho, alto, ladoMaximo = 1600 }) {
  const mayor = Math.max(ancho || 0, alto || 0);
  if (!mayor) return { ancho: null, alto: null, escala: 1 };
  const escala = Math.min(1, ladoMaximo / mayor);
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala), escala };
}

/* ════════════ EL MEDIDOR ════════════ */

export const aMB = (bytes) => {
  const mb = (bytes || 0) / (1024 * 1024);
  return mb >= 100 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
};

function tramo(usado, tope, { aviso, alto, tope: lleno }, nombre, unidad) {
  if (!tope || tope <= 0) return { nombre, nivel: "sin dato", pct: null, dice: `${nombre}: no hay tope configurado.` };
  const pct = Math.round((usado / tope) * 100);
  const nivel = pct >= lleno ? "lleno" : pct >= alto ? "alto" : pct >= aviso ? "aviso" : "bien";
  return { nombre, nivel, pct, usado, tope, dice: `${nombre}: ${unidad(usado)} de ${unidad(tope)} (${pct} %).` };
}

// Lo que contesta la función consumo() de la base, dicho en palabras.
// Sin medición NO se dice "todo bien": se dice que no se sabe.
export function estadoDeConsumo(c) {
  if (!c || !c.limites) {
    return { seSabe: false, peor: "sin dato", tramos: [], dice: "No se pudo medir cuánto espacio se lleva usado." };
  }
  const L = c.limites;
  const cortes = { aviso: L.aviso_pct ?? 70, alto: L.alto_pct ?? 85, tope: L.tope_pct ?? 95 };
  const MB = 1024 * 1024;
  const tramos = [
    tramo(Number(c.base_bytes) || 0, (L.base_mb || 0) * MB, cortes, "Base de datos", aMB),
    tramo(Number(c.archivos_bytes) || 0, (L.archivos_mb || 0) * MB, cortes, "Fotos y PDF", aMB),
  ];
  if (c.ia_mes) {
    tramos.push(tramo(c.ia_mes.llamadas || 0, L.ia_llamadas_mes || 0, { aviso: 70, alto: 90, tope: 100 }, "Lecturas con IA este mes", n => `${n}`));
    if (L.ia_centavos_mes) tramos.push(tramo(c.ia_mes.centavos || 0, L.ia_centavos_mes, { aviso: 70, alto: 90, tope: 100 }, "Gasto estimado de IA este mes", n => `$${(n / 100).toFixed(2)}`));
  }
  const orden = ["bien", "sin dato", "aviso", "alto", "lleno"];
  const peor = tramos.reduce((p, t) => (orden.indexOf(t.nivel) > orden.indexOf(p) ? t.nivel : p), "bien");
  const malos = tramos.filter(t => t.nivel === "alto" || t.nivel === "lleno");
  return {
    seSabe: true, peor, tramos,
    archivosLlenos: tramos[1].nivel === "lleno",
    iaAgotada: tramos.slice(2).some(t => t.nivel === "lleno"),
    dice: malos.length ? malos.map(t => t.dice).join(" ") : "",
  };
}

/* ════════════ LA IA, UNA VEZ POR DOCUMENTO ════════════ */

// ¿Este mismo documento ya se leyó? Se reconoce por la huella, no por el
// nombre ni por la fecha. Si ya hay una lectura con transcripción, se usa ésa.
export function lecturaYaHecha(huella, lecturas) {
  if (!huella) return null;
  return (lecturas || []).find(l => l && l.huella === huella && !l._borrado && (l.transcripcion || (l.leido && Object.keys(l.leido).length > 0))) || null;
}
