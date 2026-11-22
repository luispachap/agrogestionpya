#!/usr/bin/env node
// LAS FOTOS Y DOCUMENTOS DEL ALMACÉN, en el respaldo. Tres usos:
//   node archivos.mjs bajar     <lista> <carpeta>   → baja de producción sólo lo nuevo o cambiado, cifrado
//   node archivos.mjs subir     <carpeta>           → sube todo lo del respaldo a OTRO proyecto
//   node archivos.mjs comprobar <carpeta>           → vuelve a bajar del otro proyecto y compara byte por byte (huella)
// La lista sale de la base (un renglón por archivo: almacén|nombre|marca|tipo). Lo que ya no está en producción NO se
// borra del respaldo: un archivo borrado por error es justo lo que un respaldo tiene que conservar.
// Lee de las variables PROYECTO_URL, LLAVE_SERVICIO y CLAVE_RESPALDO. Nunca las imprime.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const rutaDe = (carpeta, llave) => join(carpeta, sha(llave).slice(0, 2), sha(llave) + ".gpg");   // el nombre no se ve
export const leerIndice = (carpeta) => existsSync(join(carpeta, "indice.json")) ? JSON.parse(readFileSync(join(carpeta, "indice.json"), "utf8")) : {};
const guardarIndice = (carpeta, i) => writeFileSync(join(carpeta, "indice.json"), JSON.stringify(Object.fromEntries(Object.entries(i).sort()), null, 1));

// La clave nunca va en la línea de comandos: va en un archivo temporal que sólo este proceso puede leer y que se borra.
function conClave(clave, hacer) {
  const tmp = join(process.env.RUNNER_TEMP || process.env.TMPDIR || "/tmp", "c-" + process.pid + "-" + Date.now());
  writeFileSync(tmp, clave, { mode: 0o600 });
  try { return hacer(tmp); } finally { writeFileSync(tmp, "0".repeat(clave.length)); spawnSync("rm", ["-f", tmp]); }
}
export const cifrar = (bytes, clave) => conClave(clave, (f) => {
  const r = spawnSync("gpg", ["--batch", "--quiet", "--yes", "--pinentry-mode", "loopback", "--passphrase-file", f, "--symmetric", "--cipher-algo", "AES256", "-o", "-"], { input: bytes, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error("No se pudo cifrar un archivo.");
  return r.stdout;
});
export const descifrar = (bytes, clave) => conClave(clave, (f) => {
  const r = spawnSync("gpg", ["--batch", "--quiet", "--yes", "--pinentry-mode", "loopback", "--passphrase-file", f, "--decrypt", "-o", "-"], { input: bytes, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error("No se pudo abrir un archivo del respaldo: la clave no es la misma con que se guardó.");
  return r.stdout;
});

const direccion = (base, almacen, nombre) => `${base.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(almacen)}/${nombre.split("/").map(encodeURIComponent).join("/")}`;
const cabeceras = (llave, extra = {}) => ({ apikey: llave, Authorization: "Bearer " + llave, ...extra });

export async function bajar(lista, carpeta, { url, llave, clave, pedir = fetch }) {
  const indice = leerIndice(carpeta);
  const cuenta = { nuevos: 0, iguales: 0, fallaron: [] };
  for (const renglon of lista.split("\n").filter(Boolean)) {
    const [almacen, nombre, marca, tipo] = renglon.split("|");
    const k = almacen + "/" + nombre;
    if (indice[k] && indice[k].marca === marca && existsSync(rutaDe(carpeta, k))) { cuenta.iguales++; continue; }
    const r = await pedir(direccion(url, almacen, nombre), { headers: cabeceras(llave) });
    if (!r.ok) { cuenta.fallaron.push(sha(k).slice(0, 12) + " (" + r.status + ")"); continue; }
    const bytes = Buffer.from(await r.arrayBuffer());
    const ruta = rutaDe(carpeta, k);
    mkdirSync(dirname(ruta), { recursive: true });
    writeFileSync(ruta, cifrar(bytes, clave));
    indice[k] = { marca, tipo: tipo || "application/octet-stream", bytes: bytes.length, sha256: sha(bytes) };
    cuenta.nuevos++;
  }
  mkdirSync(carpeta, { recursive: true });
  guardarIndice(carpeta, indice);
  return { ...cuenta, total: Object.keys(indice).length };
}

export async function subir(carpeta, { url, llave, clave, pedir = fetch }) {
  const indice = leerIndice(carpeta);
  const cuenta = { subidos: 0, fallaron: [] };
  for (const [k, f] of Object.entries(indice)) {
    const [almacen, ...resto] = k.split("/");
    const bytes = descifrar(readFileSync(rutaDe(carpeta, k)), clave);
    if (sha(bytes) !== f.sha256) { cuenta.fallaron.push(sha(k).slice(0, 12) + " (dañado en el respaldo)"); continue; }
    const r = await pedir(direccion(url, almacen, resto.join("/")), { method: "POST", headers: cabeceras(llave, { "Content-Type": f.tipo, "x-upsert": "true" }), body: bytes });
    if (r.ok) cuenta.subidos++; else cuenta.fallaron.push(sha(k).slice(0, 12) + " (" + r.status + ")");
  }
  return { ...cuenta, total: Object.keys(indice).length };
}

export async function comprobar(carpeta, { url, llave, pedir = fetch }) {
  const indice = leerIndice(carpeta);
  const cuenta = { iguales: 0, distintos: [] };
  for (const [k, f] of Object.entries(indice)) {
    const [almacen, ...resto] = k.split("/");
    const r = await pedir(direccion(url, almacen, resto.join("/")), { headers: cabeceras(llave) });
    const igual = r.ok && sha(Buffer.from(await r.arrayBuffer())) === f.sha256;
    if (igual) cuenta.iguales++; else cuenta.distintos.push(sha(k).slice(0, 12));
  }
  return { ...cuenta, total: Object.keys(indice).length };
}

if (import.meta.url === "file://" + process.argv[1]) {
  const [modo, a, b] = process.argv.slice(2);
  const { PROYECTO_URL: url, LLAVE_SERVICIO: llave, CLAVE_RESPALDO: clave } = process.env;
  if (!url || !llave || (modo !== "comprobar" && !clave)) { console.error("Faltan PROYECTO_URL, LLAVE_SERVICIO o CLAVE_RESPALDO."); process.exit(2); }
  const r = modo === "bajar" ? await bajar(readFileSync(a, "utf8"), b, { url, llave, clave })
    : modo === "subir" ? await subir(a, { url, llave, clave })
    : modo === "comprobar" ? await comprobar(a, { url, llave })
    : null;
  if (!r) { console.error("Uso: archivos.mjs bajar <lista> <carpeta> | subir <carpeta> | comprobar <carpeta>"); process.exit(2); }
  console.log(JSON.stringify(r));
  if ((r.fallaron && r.fallaron.length) || (r.distintos && r.distintos.length)) process.exit(1);
}
