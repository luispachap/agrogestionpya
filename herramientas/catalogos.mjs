#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
//  Catálogos de antes → hoja de revisión → lo aprobado, listo para entrar
//
//  NO toca ninguna base ni ningún teléfono. Sólo lee archivos y escribe
//  archivos, dentro de la carpeta respaldos/ (que no se sube al repositorio:
//  trae nombres de personas).
//
//  PASO 1 — armar la hoja de revisión:
//    node herramientas/catalogos.mjs candidatos respaldos/
//    → respaldos/catalogos-por-revisar.xlsx
//    Lee todo .json de la carpeta (respaldos de teléfonos, "datos de antes")
//    más la lista que venía escrita en el código. Saca SÓLO catálogos, sin
//    PIN, sin existencias, sin costos.
//
//  PASO 2 — Luis y Migue abren el Excel y en la columna "¿ENTRA?" escriben
//    sí o no en cada renglón (en blanco = no). Pueden corregir el nombre.
//
//  PASO 3 — convertir lo aprobado:
//    node herramientas/catalogos.mjs aprobar respaldos/catalogos-por-revisar.xlsx \
//         --por "Luis y Migue" --fecha 2026-11-20 --espacio XXXXXXXX
//    → respaldos/catalogos-aprobados.sql  (NO se corre solo: se revisa y se
//      carga en el proyecto nuevo con autorización)
//    → respaldos/catalogos-aprobados-resumen.txt
// ════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { candidatosDeCatalogo, catalogoAprobado, CATALOGOS_QUE_PUEDEN_VENIR } from "../src/arranque.js";
import { objetoAFila } from "../src/filas.js";
const XLSX = createRequire(import.meta.url)("xlsx");
const AQUI = dirname(fileURLToPath(import.meta.url));

// Un respaldo puede venir en tres formas; de las tres se saca el mismo objeto de datos.
export function datosDe(obj) {
  if (obj && obj._archivoAnterior && obj.llaves && obj.llaves.agro_v7) { try { return JSON.parse(obj.llaves.agro_v7); } catch { return null; } }
  if (obj && obj._respaldo) { const { _respaldo, ...d } = obj; return d; }
  return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
}

function candidatos(carpeta) {
  const fuentes = [{ nombre: "código anterior", datos: JSON.parse(readFileSync(join(AQUI, "catalogo-del-codigo.json"), "utf8")) }];
  for (const f of existsSync(carpeta) ? readdirSync(carpeta).filter(f => f.endsWith(".json")) : []) {
    let d = null;
    try { d = datosDe(JSON.parse(readFileSync(join(carpeta, f), "utf8"))); } catch { d = null; }
    if (d) fuentes.push({ nombre: f.replace(/\.json$/, ""), datos: d }); else console.log(`   (no se pudo leer ${f}: se deja fuera)`);
  }
  const hoja = candidatosDeCatalogo(fuentes);
  const libro = XLSX.utils.book_new();
  for (const [tabla, columnas] of Object.entries(CATALOGOS_QUE_PUEDEN_VENIR)) {
    const filas = hoja.filter(h => h.tabla === tabla).sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));
    if (filas.length === 0) continue;
    const aoa = [["¿ENTRA? (sí / no)", "CORRECCIÓN DEL NOMBRE", ...columnas, "veces", "fuentes", "DUDAS"],
      ...filas.map(f => ["", "", ...columnas.map(c => f[c] ?? ""), f.veces, f.fuentes.join(" · "), f.dudas.join("; ")])];
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(aoa), tabla);
  }
  mkdirSync(carpeta, { recursive: true });
  const salida = join(carpeta, "catalogos-por-revisar.xlsx");
  XLSX.writeFile(libro, salida);
  console.log(`Fuentes leídas: ${fuentes.map(f => f.nombre).join(", ")}`);
  for (const t of Object.keys(CATALOGOS_QUE_PUEDEN_VENIR)) { const n = hoja.filter(h => h.tabla === t); if (n.length) console.log(`  ${t}: ${n.length} candidato(s), ${n.filter(x => x.dudas.length).length} con dudas`); }
  console.log(`\nHoja de revisión: ${salida}\nNada entra hasta que alguien escriba "sí" en la primera columna.`);
}

const sqlTexto = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
function aprobar(archivo, { por, fecha, espacio }) {
  if (!por || !fecha || !espacio) { console.error('Faltan datos: --por "quién aprueba" --fecha AAAA-MM-DD --espacio identificador-del-proyecto'); process.exit(1); }
  const libro = XLSX.readFile(archivo);
  const hoja = [];
  for (const tabla of libro.SheetNames) {
    if (!CATALOGOS_QUE_PUEDEN_VENIR[tabla]) continue;
    for (const r of XLSX.utils.sheet_to_json(libro.Sheets[tabla], { defval: "" })) {
      const fila = { tabla, entra: r["¿ENTRA? (sí / no)"], correccion: r["CORRECCIÓN DEL NOMBRE"], fuentes: String(r.fuentes || "").split(" · ").filter(Boolean) };
      for (const c of CATALOGOS_QUE_PUEDEN_VENIR[tabla]) fila[c] = r[c];
      hoja.push(fila);
    }
  }
  const r = catalogoAprobado(hoja, { aprobadoPor: por, fecha, espacio, nuevoId: (t) => `${t[0]}_${randomUUID().slice(0, 12)}` });
  if (!r.ok) { console.error(r.dice); process.exit(1); }
  const lineas = [`-- Catálogos validados por ${por} el ${fecha}, para el espacio "${espacio}".`,
    "-- NO correr sin revisarlo. Se carga UNA vez, desde el panel del proyecto nuevo.",
    "-- No trae PIN, contraseñas, existencias ni costos. Los id son nuevos.", "begin;"];
  for (const [tabla, registros] of Object.entries(r.registros)) {
    for (const reg of registros) {
      const { actualizado, ...fila } = objetoAFila(tabla, reg);
      const cols = Object.keys(fila);
      lineas.push(`insert into ${tabla} (${cols.join(", ")}) values (${cols.map(c => (c === "datos" ? `${sqlTexto(JSON.stringify(fila[c]))}::jsonb` : sqlTexto(fila[c]))).join(", ")});`);
    }
  }
  lineas.push("commit;");
  const dir = dirname(archivo);
  writeFileSync(join(dir, "catalogos-aprobados.sql"), lineas.join("\n") + "\n");
  const resumen = [`Aprobado por: ${por} · ${fecha} · espacio ${espacio}`, `Entran ${r.entran}, quedan fuera ${r.fuera}.`,
    ...Object.entries(r.registros).map(([t, l]) => `  ${t}: ${l.length}`),
    r.parcelasSinRancho ? `OJO: ${r.parcelasSinRancho} parcela(s) quedan sin rancho (hay más de uno o ninguno): se asignan en la app.` : "",
    (r.registros.trabajadores || []).length ? "Los trabajadores entran SIN PIN: cada uno recibe uno nuevo desde la app." : ""].filter(Boolean).join("\n");
  writeFileSync(join(dir, "catalogos-aprobados-resumen.txt"), resumen + "\n");
  console.log(resumen + `\n\nArchivo: ${join(dir, "catalogos-aprobados.sql")}  (no se corrió nada)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , orden, ruta, ...resto] = process.argv;
  const op = {}; for (let i = 0; i < resto.length; i += 2) op[resto[i].replace(/^--/, "")] = resto[i + 1];
  if (orden === "candidatos" && ruta) candidatos(ruta);
  else if (orden === "aprobar" && ruta) aprobar(ruta, op);
  else console.log('Uso:\n  node herramientas/catalogos.mjs candidatos respaldos/\n  node herramientas/catalogos.mjs aprobar respaldos/catalogos-por-revisar.xlsx --por "Luis y Migue" --fecha AAAA-MM-DD --espacio XXXXXXXX');
}
