// Fabrica recortes de satélite DE MENTIRA para las pruebas de navegador (no son imágenes de ningún lugar).
// Uso: node recortes_falsos.mjs <carpeta>   → escribe <carpeta>/<escena>.tif, <escena>-color.tif y catalogo.json
import { writeFileSync } from "node:fs";
import { fromArrayBuffer } from "geotiff";
// Un GeoTIFF mínimo, escrito a mano: sin compresión, bandas intercaladas, en latitud/longitud.
function tiff(bandas, { W, H, bits, oeste, norte, res }) {
  const N = bandas.length, bps = bits / 8, datos = Buffer.alloc(W * H * N * bps);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let b = 0; b < N; b++) { const o = ((y * W + x) * N + b) * bps, v = bandas[b][y][x]; if (bits === 16) datos.writeUInt16LE(v, o); else datos.writeUInt8(v, o); }
  const shorts = (a) => { const b = Buffer.alloc(a.length * 2); a.forEach((v, i) => b.writeUInt16LE(v, i * 2)); return b; }, dobles = (a) => { const b = Buffer.alloc(a.length * 8); a.forEach((v, i) => b.writeDoubleLE(v, i * 8)); return b; };
  const etiquetas = [[256, 3, [W]], [257, 3, [H]], [258, 3, Array(N).fill(bits)], [259, 3, [1]], [262, 3, [1]], [273, 4, ["DATOS"]], [277, 3, [N]], [278, 3, [H]], [279, 4, [datos.length]], [284, 3, [1]], [338, 3, Array(N - 1).fill(0)], [339, 3, Array(N).fill(1)],
    [33550, 12, [res, res, 0]], [33922, 12, [0, 0, 0, oeste, norte, 0]], [34735, 3, [1, 1, 0, 3, 1024, 0, 1, 2, 1025, 0, 1, 1, 2048, 0, 1, 4326]]];
  const ifd = Buffer.alloc(2 + etiquetas.length * 12 + 4), extras = []; let fuera = 8 + ifd.length; ifd.writeUInt16LE(etiquetas.length, 0);
  const bloques = etiquetas.map(([, tipo, v]) => (tipo === 12 ? dobles(v) : tipo === 3 ? shorts(v) : null));
  const tamExtras = bloques.reduce((n, b, i) => n + (b && (b.length > 4) ? b.length : 0), 0), inicioDatos = fuera + tamExtras;
  etiquetas.forEach(([id, tipo, v], i) => { const o = 2 + i * 12; ifd.writeUInt16LE(id, o); ifd.writeUInt16LE(tipo, o + 2); ifd.writeUInt32LE(v.length, o + 4);
    if (tipo === 4) ifd.writeUInt32LE(v[0] === "DATOS" ? inicioDatos : v[0], o + 8);
    else if (bloques[i].length <= 4) bloques[i].copy(ifd, o + 8);
    else { ifd.writeUInt32LE(fuera, o + 8); extras.push(bloques[i]); fuera += bloques[i].length; } });
  const cab = Buffer.alloc(8); cab.write("II"); cab.writeUInt16LE(42, 2); cab.writeUInt32LE(8, 4);
  return Buffer.concat([cab, ifd, ...extras, datos]);
}
const carpeta = process.argv[2], W = 22, H = 24, oeste = -102.7007, norte = 22.9017, res = 0.00009375;
// reflectancias (rojo, infrarrojo, infrarrojo de 20 m, onda corta) y qué dice el satélite de cada cuadro
const ESCENAS = [
  { id: "S2A_FALSA_20261005", utc: "2026-10-05T17:27:00Z", nubes: 2.1, plataforma: "sentinel-2a", rojo: 0.14, nir: 0.22, swir: 0.30, scl: () => 5 },          // suelo: NDVI ≈ 0.22
  { id: "S2B_FALSA_20261020", utc: "2026-10-20T17:27:00Z", nubes: 96.0, plataforma: "sentinel-2b", rojo: 0.50, nir: 0.52, swir: 0.40, scl: () => 9 },        // todo nube
  { id: "S2A_FALSA_20261104", utc: "2026-11-04T17:27:00Z", nubes: 12.4, plataforma: "sentinel-2a", rojo: 0.07, nir: 0.33, swir: 0.20, scl: (x) => (x < 13 ? 8 : 4) },   // media parcela tapada
  { id: "S2C_FALSA_20261114", utc: "2026-11-14T17:27:00Z", nubes: 0.4, plataforma: "sentinel-2c", rojo: 0.05, nir: 0.38, swir: 0.18, scl: () => 4 },         // cultivo: NDVI ≈ 0.77
];
const dn = (r) => Math.round(r * 10000 + 1000);
for (const e of ESCENAS) {
  const banda = (f) => Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => f(x, y)));
  // una franja un poco más verde al oriente, para que la capa no salga de un solo color
  const nir = banda((x) => dn(e.nir + (x > 14 ? 0.05 : 0)));
  const analisis = [banda(() => dn(e.rojo)), nir, nir, banda(() => dn(e.swir)), banda((x) => e.scl(x)), banda(() => 255)];
  writeFileSync(`${carpeta}/${e.id}.tif`, tiff(analisis, { W, H, bits: 16, oeste, norte, res }));
  const gris = Math.min(180, Math.round(e.rojo * 400)), color = [banda(() => gris + 40), banda(() => gris + 70), banda(() => gris + 30), banda(() => 255)];
  writeFileSync(`${carpeta}/${e.id}-color.tif`, tiff(color, { W, H, bits: 8, oeste, norte, res }));
}
const cubre = { type: "Polygon", coordinates: [[[-103, 22], [-102, 22], [-102, 23.5], [-103, 23.5], [-103, 22]]] };
writeFileSync(`${carpeta}/catalogo.json`, JSON.stringify({ type: "FeatureCollection", features: ESCENAS.map(e => ({ id: e.id, geometry: cubre, properties: { datetime: e.utc, "eo:cloud_cover": e.nubes, platform: e.plataforma, "s2:processing_baseline": "05.13", "s2:nodata_pixel_percentage": 0 } })) }));
const leido = (await import("node:fs")).readFileSync(`${carpeta}/${ESCENAS[3].id}.tif`);
const img = await (await fromArrayBuffer(leido.buffer.slice(leido.byteOffset, leido.byteOffset + leido.byteLength))).getImage(), d = await img.readRasters();
console.log("recortes falsos:", ESCENAS.length, "| ejemplo", img.getWidth() + "x" + img.getHeight(), "bandas", d.length, d[0].constructor.name, "origen", img.getOrigin().slice(0, 2), "res", img.getResolution().slice(0, 2), "| rojo", d[0][0], "nir", d[1][0], "scl", d[4][0], "máscara", d[5][0]);
