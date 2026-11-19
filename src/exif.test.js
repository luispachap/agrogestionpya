// ============================================================
//  Pruebas del lector de EXIF
//
//  Leer bytes a mano es de lo más fácil de equivocar y de lo más difícil de
//  notar: un desplazamiento mal calculado no truena, devuelve un número. Y un
//  número de coordenada equivocado manda el vuelo a la parcela de junto — o a
//  China, si se olvida la letra W.
//
//  Por eso aquí se arma un JPEG con EXIF de verdad, byte por byte, con las
//  coordenadas de Zacatecas, y se comprueba que salgan las mismas.
// ============================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import { leerExif } from "./exif.js";

/* ════════════ ARMAR UN JPEG CON EXIF ════════════ */

// Una parcela del rancho, en Zacatecas: 22.7709 N, 102.5832 W.
// En grados/minutos/segundos: 22° 46' 15.24"  y  102° 34' 59.52".
const LAT_GMS = [[22, 1], [46, 1], [1524, 100]];
const LON_GMS = [[102, 1], [34, 1], [5952, 100]];

function armarJpeg({ conGps = true, latRef = "N", lonRef = "W", conFecha = true, conExif = true } = {}) {
  if (!conExif) return new Uint8Array([0xFF, 0xD8, 0xFF, 0xDA, 0x00, 0x02, 0xFF, 0xD9]);

  const FECHA = "2026:09:08 07:14:22\0";           // 20 bytes
  const partes = [];
  const tiff = [];
  const u8 = (v) => tiff.push(v & 0xFF);
  const u16 = (v) => { u8(v); u8(v >> 8); };        // little-endian
  const u32 = (v) => { u16(v & 0xFFFF); u16(v >>> 16); };
  const at = () => tiff.length;

  u8(0x49); u8(0x49);      // "II" — los números van al derecho
  u16(42);
  u32(8);                  // el IFD0 empieza en el byte 8

  const entradas0 = [];
  if (conFecha) entradas0.push("fecha");
  entradas0.push("exif");
  if (conGps) entradas0.push("gps");

  u16(entradas0.length);
  // Cada entrada mide 12 bytes; después van 4 del "siguiente IFD".
  const finIFD0 = 8 + 2 + entradas0.length * 12 + 4;
  let libre = finIFD0;

  const posFecha = conFecha ? libre : null;
  if (conFecha) libre += FECHA.length;
  const posExifIFD = libre;
  libre += 2 + 12 + 4 + FECHA.length;               // el IFD de Exif y su cadena
  const posGpsIFD = conGps ? libre : null;

  const entrada = (tag, tipo, cuantos, valor) => {
    u16(tag); u16(tipo); u32(cuantos); u32(valor);
  };
  if (conFecha) entrada(0x0132, 2, FECHA.length, posFecha);
  entrada(0x8769, 4, 1, posExifIFD);
  if (conGps) entrada(0x8825, 4, 1, posGpsIFD);
  u32(0);                                            // no hay IFD1

  if (conFecha) {
    assert.equal(at(), posFecha, "la cadena de fecha no quedó donde dice la entrada");
    for (const c of FECHA) u8(c.charCodeAt(0));
  }

  // ── El IFD de Exif: sólo DateTimeOriginal ──
  assert.equal(at(), posExifIFD, "el IFD de Exif no quedó donde dice el puntero");
  u16(1);
  entrada(0x9003, 2, FECHA.length, posExifIFD + 2 + 12 + 4);
  u32(0);
  for (const c of FECHA) u8(c.charCodeAt(0));

  // ── El IFD de GPS ──
  if (conGps) {
    assert.equal(at(), posGpsIFD, "el IFD de GPS no quedó donde dice el puntero");
    const nEnt = 6;
    const datos = posGpsIFD + 2 + nEnt * 12 + 4;
    const posLat = datos;
    const posLon = datos + 24;
    const posAlt = datos + 48;

    u16(nEnt);
    // Lo que cabe en cuatro bytes va ahí mismo, sin puntero: así lo escribe
    // un dron de verdad y así hay que saber leerlo.
    entrada(1, 2, 2, latRef.charCodeAt(0));          // "N\0" o "S\0"
    entrada(2, 5, 3, posLat);
    entrada(3, 2, 2, lonRef.charCodeAt(0));          // "W\0" o "E\0"
    entrada(4, 5, 3, posLon);
    entrada(5, 1, 1, 0);                             // sobre el nivel del mar
    entrada(6, 5, 1, posAlt);
    u32(0);

    assert.equal(at(), posLat);
    for (const [n, d] of LAT_GMS) { u32(n); u32(d); }
    assert.equal(at(), posLon);
    for (const [n, d] of LON_GMS) { u32(n); u32(d); }
    assert.equal(at(), posAlt);
    u32(21005); u32(10);                             // 2100.5 metros
  }

  // Envolverlo en el JPEG.
  const cabecera = [0x45, 0x78, 0x69, 0x66, 0, 0];   // "Exif\0\0"
  const largo = 2 + cabecera.length + tiff.length;
  partes.push(0xFF, 0xD8, 0xFF, 0xE1, (largo >> 8) & 0xFF, largo & 0xFF, ...cabecera, ...tiff, 0xFF, 0xD9);
  return new Uint8Array(partes);
}

const comoArchivo = (bytes) => new Blob([bytes]);

/* ════════════ LAS PRUEBAS ════════════ */

test("saca_las_coordenadas_de_la_foto_del_dron", async () => {
  const r = await leerExif(comoArchivo(armarJpeg()));
  assert.equal(r.tieneGps, true);
  assert.ok(Math.abs(r.lat - 22.7709) < 0.0001, `lat salió ${r.lat}`);
  assert.ok(Math.abs(r.lon - (-102.5832)) < 0.0001, `lon salió ${r.lon}`);
  assert.equal(r.altitud, 2100.5);
});

test("LA_W_IMPORTA_sin_ella_la_parcela_acaba_en_China", async () => {
  // 102.5832 al este de Greenwich cae en China. En Zacatecas la longitud es
  // OESTE y va en negativo. Confundirse aquí no da un error: da un vuelo
  // archivado en el otro lado del mundo.
  const oeste = await leerExif(comoArchivo(armarJpeg({ lonRef: "W" })));
  const este = await leerExif(comoArchivo(armarJpeg({ lonRef: "E" })));
  assert.ok(oeste.lon < 0);
  assert.ok(este.lon > 0);
  assert.equal(oeste.lon, -este.lon);
});

test("sin_la_letra_del_hemisferio_NO_se_adivina", async () => {
  // Suponer el hemisferio es mandar la parcela al otro lado del mundo. Se
  // prefiere no ubicar la foto.
  const r = await leerExif(comoArchivo(armarJpeg({ lonRef: "\0" })));
  assert.equal(r.lon, null);
  assert.equal(r.tieneGps, false);
  assert.ok(r.porque.includes("a mano"));
});

test("la_fecha_sale_del_disparo_y_NO_se_corre_un_dia", async () => {
  // El vuelo fue a las 7:14 de la mañana del 8 de septiembre. Si la fecha
  // pasara por Date y se convirtiera a UTC, Zacatecas va seis horas atrás y
  // quedaría archivado el día 7.
  const r = await leerExif(comoArchivo(armarJpeg()));
  assert.equal(r.fecha, "2026-09-08");
  assert.equal(r.tomadaEl, "2026:09:08 07:14:22");
});

test("una_foto_sin_gps_lo_dice_no_la_ubica_donde_sea", async () => {
  // Un vuelo archivado en la parcela equivocada es peor que uno sin archivar:
  // el segundo se nota y el primero no.
  const r = await leerExif(comoArchivo(armarJpeg({ conGps: false })));
  assert.equal(r.tieneGps, false);
  assert.equal(r.lat, null);
  assert.equal(r.lon, null);
  assert.equal(r.fecha, "2026-09-08");     // la fecha sí se pudo leer
  assert.ok(r.porque.includes("no trae GPS"));
});

test("una_foto_reenviada_por_whatsapp_se_explica_por_su_nombre", async () => {
  // WhatsApp le quita el EXIF a lo que se reenvía. Decir "no trae EXIF" no le
  // sirve a nadie; decir de dónde viene el problema, sí.
  const r = await leerExif(comoArchivo(armarJpeg({ conExif: false })));
  assert.equal(r.tieneGps, false);
  assert.ok(r.porque.includes("WhatsApp"));
});

test("lo_que_no_es_jpeg_se_dice_sin_truenar", async () => {
  const r = await leerExif(comoArchivo(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0])));
  assert.equal(r.tieneGps, false);
  assert.ok(r.porque.includes("JPEG"));
});

test("un_archivo_cortado_no_truena_ni_inventa_coordenadas", async () => {
  // Media foto no da media coordenada: no da ninguna.
  const bytes = armarJpeg();
  const r = await leerExif(comoArchivo(bytes.slice(0, Math.floor(bytes.length / 2))));
  assert.equal(r.lat, null);
  assert.equal(r.lon, null);
  assert.equal(r.tieneGps, false);
});

test("nunca_devuelve_el_punto_cero_cero", async () => {
  // (0,0) es un punto en el mar frente a África, y es donde acaban todas las
  // fotos mal leídas. Ninguna respuesta de este módulo puede ser 0,0.
  const casos = [
    armarJpeg(),
    armarJpeg({ conGps: false }),
    armarJpeg({ conExif: false }),
    armarJpeg({ lonRef: "\0" }),
    new Uint8Array([0xFF, 0xD8]),
  ];
  for (const c of casos) {
    const r = await leerExif(comoArchivo(c));
    assert.ok(!(r.lat === 0 && r.lon === 0), "salió el punto (0,0)");
  }
});
