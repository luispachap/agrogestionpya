// ============================================================
//  AgroGestión — Sacarle a una foto dónde y cuándo se tomó
//
//  Una foto del dron sin fecha ni GPS es una foto bonita. Con fecha y GPS es
//  el registro de una parcela en un día. Todo el recorrido del dron depende de
//  poder leer esas dos cosas.
//
//  ─────────────────────────────────────────────────────────────
//  POR QUÉ ESTÁ ESCRITO A MANO Y NO CON UNA LIBRERÍA
//  ─────────────────────────────────────────────────────────────
//  Lo único que se necesita del EXIF son cuatro campos: latitud, longitud,
//  altitud y la fecha en que se tomó. Una librería de EXIF pesa cientos de
//  kilobytes y hay que bajarla en un teléfono que está en el rancho con media
//  raya de señal. Esto son doscientas líneas y lee esos cuatro campos.
//
//  Es la misma decisión que ya se tomó con el QR y con el PDF: cero
//  dependencias nuevas.
//
//  ─────────────────────────────────────────────────────────────
//  LO QUE HACE CUANDO NO PUEDE
//  ─────────────────────────────────────────────────────────────
//  Devuelve null y lo DICE. Una foto sin GPS no se ubica "en la parcela más
//  probable": se guarda sin ubicar, y una persona dice de cuál es. Un vuelo
//  archivado en la parcela equivocada es peor que uno sin archivar, porque el
//  segundo se nota y el primero no.
//
//  Sus pruebas están en src/exif.test.js, y arman un JPEG con EXIF byte por
//  byte con las coordenadas de Zacatecas. Leer bytes a mano es de lo más fácil
//  de equivocar y de lo más difícil de notar: un desplazamiento mal calculado
//  no truena, devuelve un número — y un número de coordenada equivocado manda
//  el vuelo a la parcela de junto, o a China si se olvida la letra W.
//
//  La lógica que decide a qué parcela pertenece una foto ya ubicada vive en
//  src/dron.js.
// ============================================================

// Los tags que interesan, por su número en la especificación EXIF.
const TAG_GPS_IFD = 0x8825;
const TAG_EXIF_IFD = 0x8769;
const TAG_FECHA_ORIGINAL = 0x9003;   // DateTimeOriginal: cuándo se DISPARÓ
const TAG_FECHA_DIGITAL = 0x9004;    // DateTimeDigitized
const TAG_FECHA_ARCHIVO = 0x0132;    // DateTime: cuándo se guardó (menos fiel)

const GPS_LAT_REF = 1, GPS_LAT = 2, GPS_LON_REF = 3, GPS_LON = 4;
const GPS_ALT_REF = 5, GPS_ALT = 6;

// Cuántos bytes ocupa cada tipo de dato del EXIF.
const TAM = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

/* ════════════ LO QUE SE USA DESDE LA APP ════════════ */

// Lee el EXIF de un File o un Blob. Devuelve siempre un objeto: si algo no se
// pudo leer, ese campo va en null y `porque` explica cuál faltó.
export async function leerExif(archivo) {
  try {
    const buf = await archivo.arrayBuffer();
    return desdeBytes(new DataView(buf));
  } catch (e) {
    return vacio(`No se pudo abrir la foto (${e?.message || e}).`);
  }
}

// Lo mismo, pero desde un dataURL — que es como quedan las fotos ya guardadas
// en la app.
export function leerExifDeDataUrl(dataUrl) {
  try {
    const coma = String(dataUrl || "").indexOf(",");
    if (coma < 0) return vacio("Eso no es una imagen guardada.");
    const bin = atob(dataUrl.slice(coma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return desdeBytes(new DataView(bytes.buffer));
  } catch (e) {
    return vacio(`No se pudo leer la imagen guardada (${e?.message || e}).`);
  }
}

const vacio = (porque) => ({
  lat: null, lon: null, altitud: null, fecha: null, tomadaEl: null,
  tieneGps: false, porque,
});

/* ════════════ EL PARSEO ════════════ */

function desdeBytes(dv) {
  if (dv.byteLength < 4) return vacio("El archivo está vacío o cortado.");

  // ¿Es un JPEG? Empieza con FF D8.
  if (dv.getUint16(0) !== 0xFFD8) {
    return vacio("La foto no es JPEG. El EXIF con GPS sólo viene en JPEG; un PNG o un HEIC convertido casi nunca lo trae. Se puede subir igual y decir a mano de qué parcela es.");
  }

  // Recorrer los segmentos buscando el APP1 que trae el EXIF.
  let p = 2;
  let inicio = -1;
  while (p + 4 <= dv.byteLength) {
    if (dv.getUint8(p) !== 0xFF) break;             // segmento mal formado
    const marca = dv.getUint8(p + 1);
    if (marca === 0xD8 || marca === 0x01 || (marca >= 0xD0 && marca <= 0xD7)) { p += 2; continue; }
    if (marca === 0xDA) break;                       // ya empezó la imagen: no hay EXIF
    const largo = dv.getUint16(p + 2);
    if (largo < 2) break;
    if (marca === 0xE1 && p + 10 <= dv.byteLength) {
      // "Exif\0\0"
      if (dv.getUint32(p + 4) === 0x45786966 && dv.getUint16(p + 8) === 0x0000) {
        inicio = p + 10;
        break;
      }
    }
    p += 2 + largo;
  }
  if (inicio < 0) {
    return vacio("La foto no trae EXIF. Suele pasar cuando pasó por WhatsApp: al reenviarla se le quitan la fecha y el GPS. Súbela desde el dron o desde la galería, sin reenviarla.");
  }

  // El TIFF de adentro dice si los números van al derecho o al revés.
  const orden = dv.getUint16(inicio);
  if (orden !== 0x4949 && orden !== 0x4D4D) return vacio("El EXIF de la foto está dañado.");
  const le = orden === 0x4949;                       // little-endian
  const u16 = (o) => dv.getUint16(o, le);
  const u32 = (o) => dv.getUint32(o, le);

  if (u16(inicio + 2) !== 42) return vacio("El EXIF de la foto está dañado.");

  const ifd0 = inicio + u32(inicio + 4);
  const campos0 = leerIFD(dv, inicio, ifd0, le);
  if (!campos0) return vacio("No se pudo leer el EXIF de la foto.");

  // ── La fecha ──
  let fecha = null, tomadaEl = null;
  const sub = campos0.get(TAG_EXIF_IFD);
  const desplE = sub ? valorNumerico(dv, inicio, sub, le) : null;
  // Si el puntero no se leyo, NO se suma null a `inicio`: eso daria el propio
  // inicio y se pondria a leer como campos lo que sea que haya ahi.
  if (desplE !== null) {
    const camposE = leerIFD(dv, inicio, inicio + desplE, le);
    if (camposE) {
      const cruda = textoDe(dv, inicio, camposE.get(TAG_FECHA_ORIGINAL), le)
        || textoDe(dv, inicio, camposE.get(TAG_FECHA_DIGITAL), le);
      if (cruda) { fecha = aFechaExif(cruda); tomadaEl = cruda; }
    }
  }
  if (!fecha) {
    // La fecha del archivo es el último recurso: puede ser la de cuando se
    // copió, no la del disparo. Se usa, pero se dice de dónde salió.
    const cruda = textoDe(dv, inicio, campos0.get(TAG_FECHA_ARCHIVO), le);
    if (cruda) { fecha = aFechaExif(cruda); tomadaEl = cruda; }
  }

  // ── El GPS ──
  const gpsPtr = campos0.get(TAG_GPS_IFD);
  if (!gpsPtr) {
    return {
      lat: null, lon: null, altitud: null, fecha, tomadaEl, tieneGps: false,
      porque: fecha
        ? "La foto trae fecha pero no trae GPS. Puede que el dron tuviera apagado el guardado de ubicación. Se sube igual y se dice a mano de qué parcela es."
        : "La foto no trae ni GPS ni fecha.",
    };
  }
  const desplG = valorNumerico(dv, inicio, gpsPtr, le);
  const camposG = desplG === null ? null : leerIFD(dv, inicio, inicio + desplG, le);
  if (!camposG) return { lat: null, lon: null, altitud: null, fecha, tomadaEl, tieneGps: false, porque: "El GPS de la foto no se pudo leer." };

  const lat = aGrados(racionales(dv, inicio, camposG.get(GPS_LAT), le), textoDe(dv, inicio, camposG.get(GPS_LAT_REF), le));
  const lon = aGrados(racionales(dv, inicio, camposG.get(GPS_LON), le), textoDe(dv, inicio, camposG.get(GPS_LON_REF), le));

  let altitud = null;
  const alt = racionales(dv, inicio, camposG.get(GPS_ALT), le);
  if (alt && alt.length > 0 && alt[0] !== null) {
    // La referencia 1 quiere decir "por debajo del nivel del mar".
    const bajoElMar = valorNumerico(dv, inicio, camposG.get(GPS_ALT_REF), le) === 1;
    altitud = Math.round((bajoElMar ? -alt[0] : alt[0]) * 10) / 10;
  }

  if (lat === null || lon === null) {
    return {
      lat: null, lon: null, altitud, fecha, tomadaEl, tieneGps: false,
      porque: "La foto trae el bloque de GPS pero sin coordenadas legibles. Se sube igual y se dice a mano de qué parcela es.",
    };
  }

  return {
    lat, lon, altitud, fecha, tomadaEl, tieneGps: true,
    porque: fecha ? null : "La foto trae GPS pero no fecha; se va a usar la del día en que se subió, y eso conviene revisarlo.",
  };
}

/* ════════════ AYUDANTES ════════════ */

// Un IFD es una lista de campos: cuántos hay, y luego cada uno con su número
// de tag, su tipo, cuántos valores trae y dónde están.
function leerIFD(dv, base, offset, le) {
  if (offset < base || offset + 2 > dv.byteLength) return null;
  const n = dv.getUint16(offset, le);
  // Un número absurdo de campos quiere decir que el offset estaba mal: más
  // vale rendirse que ponerse a leer basura como si fueran coordenadas.
  if (n > 1000) return null;
  const campos = new Map();
  for (let i = 0; i < n; i++) {
    const o = offset + 2 + i * 12;
    if (o + 12 > dv.byteLength) break;
    campos.set(dv.getUint16(o, le), {
      tipo: dv.getUint16(o + 2, le),
      cuantos: dv.getUint32(o + 4, le),
      datos: o + 8,
    });
  }
  return campos;
}

// Dónde están de verdad los datos de un campo: si caben en cuatro bytes están
// ahí mismo; si no, ahí va un puntero.
function dondeEstan(dv, base, campo, le) {
  const bytes = (TAM[campo.tipo] || 1) * campo.cuantos;
  return bytes <= 4 ? campo.datos : base + dv.getUint32(campo.datos, le);
}

function valorNumerico(dv, base, campo, le) {
  if (!campo) return null;
  const o = dondeEstan(dv, base, campo, le);
  if (o + 4 > dv.byteLength) return null;
  if (campo.tipo === 3) return dv.getUint16(o, le);
  return dv.getUint32(o, le);
}

function textoDe(dv, base, campo, le) {
  if (!campo || campo.tipo !== 2) return null;
  const o = dondeEstan(dv, base, campo, le);
  if (o + campo.cuantos > dv.byteLength) return null;
  let s = "";
  for (let i = 0; i < campo.cuantos; i++) {
    const c = dv.getUint8(o + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.trim() || null;
}

// Los racionales del EXIF son pares de enteros: numerador y denominador.
function racionales(dv, base, campo, le) {
  if (!campo || (campo.tipo !== 5 && campo.tipo !== 10)) return null;
  const o = dondeEstan(dv, base, campo, le);
  const res = [];
  for (let i = 0; i < campo.cuantos; i++) {
    const p = o + i * 8;
    if (p + 8 > dv.byteLength) return null;
    const num = campo.tipo === 10 ? dv.getInt32(p, le) : dv.getUint32(p, le);
    const den = campo.tipo === 10 ? dv.getInt32(p + 4, le) : dv.getUint32(p + 4, le);
    // Dividir entre cero devuelve null, NO cero. Un cero aquí es la costa de
    // África: el famoso punto (0,0) donde acaban las fotos mal leídas.
    res.push(den === 0 ? null : num / den);
  }
  return res;
}

// El EXIF guarda grados, minutos y segundos por separado, y la letra N/S/E/W
// aparte. Zacatecas es latitud norte y longitud OESTE: sin aplicar la W, la
// parcela acabaría en China.
function aGrados(gms, ref) {
  if (!gms || gms.length < 3) return null;
  const [g, m, s] = gms;
  if (g === null || m === null || s === null) return null;
  const d = g + m / 60 + s / 3600;
  if (!isFinite(d) || d > 180) return null;
  const r = String(ref || "").toUpperCase();
  // Sin la letra no se sabe el hemisferio, y suponerlo es mandar la parcela al
  // otro lado del mundo. Se prefiere no ubicar la foto.
  if (r !== "N" && r !== "S" && r !== "E" && r !== "W") return null;
  return (r === "S" || r === "W") ? -d : d;
}

// El EXIF escribe la fecha "2026:09:08 07:14:22". Se saca el día tal cual, sin
// pasar por Date: convertirlo a UTC correría el día seis horas hacia atrás y
// un vuelo de las 7 de la mañana acabaría archivado el día anterior.
function aFechaExif(cruda) {
  const m = String(cruda).match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})/);
  if (!m) return null;
  const [, y, mes, d] = m;
  if (+mes < 1 || +mes > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${mes}-${d}`;
}
