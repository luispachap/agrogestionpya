// Guardias de contención (P0). Leen el código fuente: si alguien vuelve a meter
// una credencial o datos personales al código que acaba público, esto truena.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL(".", import.meta.url);
const fuentes = readdirSync(dir).filter(f => /\.(js|jsx)$/.test(f) && !f.endsWith(".test.js"));
const leer = f => readFileSync(new URL(f, dir), "utf8");

test("C-2 · ninguna variable VITE_ con contraseña, correo, secreto o token", () => {
  for (const f of fuentes) {
    const malas = leer(f).match(/VITE_[A-Z0-9_]*(PASSWORD|PASS|EMAIL|SECRET|TOKEN|SERVICE)[A-Z0-9_]*/g);
    assert.equal(malas, null, `${f} lee ${malas}`);
  }
});
test("C-2 · las únicas variables de entorno del cliente son la URL y la llave pública", () => {
  const vistas = new Set();
  for (const f of fuentes) for (const m of leer(f).matchAll(/import\.meta\.env\.(\w+)/g)) vistas.add(m[1]);
  for (const v of vistas) assert.ok(["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "DEV", "PROD", "MODE", "BASE_URL"].includes(v), `variable no permitida: ${v}`);
});
test("C-1 · no queda ningún PIN de fábrica de dirección en el código", () => {
  const app = leer("App.jsx");
  assert.equal(/verificarPinRol\("\w+",\s*"\d+"\)/.test(app), false);
  assert.equal(/busq === fabrica/.test(app), false);
});
test("M-7 · el código no trae trabajadores reales (nombre, sueldo, PIN)", () => {
  const app = leer("App.jsx");
  const ini = app.indexOf("const INITIAL = {"); const fin = app.indexOf("\n};", ini);
  const bloque = app.slice(ini, fin);
  assert.match(bloque, /trabajadores: \[\],/);
  assert.equal(/pin:\s*"\d{3,}"/.test(bloque), false, "hay PIN escritos en los datos iniciales");
  assert.equal(/codigoNomina/.test(bloque), false);
});
test("C-3 · la sesión guardada pasa siempre por sesionRestaurable", () => {
  const app = leer("App.jsx");
  assert.equal(/setSessionRaw\(s\); \/\/ roles de campo/.test(app), false);
  assert.equal(/data\.session && s\.cuenta/.test(app), false);
  assert.match(app, /sesionRestaurable\(JSON\.parse\(guardada\)/);
});
test("C-6 · la recarga remota ya no borra las colas de pendientes", () => {
  const app = leer("App.jsx");
  const i = app.indexOf("planDeRecarga({");
  assert.ok(i > 0);
  const tramo = app.slice(i, i + 900);
  assert.equal(/agro_pending_v7"\)|agro_fallidas_v1"\)/.test(tramo.replace(/lsGet\("agro_(pending_v7|fallidas_v1)"\)/g, "")), false);
});
