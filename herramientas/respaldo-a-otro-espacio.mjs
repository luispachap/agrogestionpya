#!/usr/bin/env node
// RECUPERACIÓN EN OTRA BASE. Un respaldo de AgroGestión sólo se puede restaurar en la base de donde salió: es el candado
// que evita que datos de prueba lleguen a la operación. Si esa base se perdió y hubo que armar OTRA (otro proyecto de
// Supabase), el respaldo tiene que pasar por aquí: cambia la marca del espacio, a propósito y dejando dicho de dónde venía.
// No toca ninguna base ni sube nada: sólo escribe un archivo nuevo junto al original.
//
// Uso:  node herramientas/respaldo-a-otro-espacio.mjs respaldo-agroselectos-2026-11-30.json <espacio-nuevo>
//       (el espacio nuevo es la clave del proyecto de Supabase nuevo: lo que va antes de «.supabase.co»)
import { readFileSync, writeFileSync } from "node:fs";
import { respaldoParaOtroEspacio } from "../src/espacio.js";
const [archivo, espacio] = process.argv.slice(2);
if (!archivo || !espacio) { console.error("Uso: node herramientas/respaldo-a-otro-espacio.mjs <respaldo.json> <espacio-nuevo>"); process.exit(1); }
const original = JSON.parse(readFileSync(archivo, "utf8"));
const movido = respaldoParaOtroEspacio(original, espacio, new Date().toISOString());
const sale = archivo.replace(/\.json$/i, "") + `-para-${espacio}.json`;
writeFileSync(sale, JSON.stringify(movido));
const cuenta = Object.entries(movido).filter(([, v]) => Array.isArray(v) && v.length).map(([k, v]) => `${k}: ${v.length}`).join(" · ");
console.log(`Listo: ${sale}\nVenía de «${original._respaldo.espacio}» y ahora dice «${espacio}».\n${cuenta}\nSe restaura desde la app, en Respaldo → «Elegir archivo de respaldo», con una cuenta de superadministrador.`);
