// La entrada de WhatsApp, probada SIN red, SIN cuenta y SIN mandar nada: Meta y la base son de mentira.
// Se comprueba lo que importa antes de activarla: apagada no hace nada; sin la firma de Meta no guarda;
// guarda tal cual y una sola vez; y en ningún caso le manda un mensaje a nadie.
// Uso: node --test pruebas/funcion_whatsapp.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { buildSync } from "esbuild";
import { recibir as leerEnLaApp, directorio } from "../src/whatsapp.js";

const ruta = (r) => new URL(r, import.meta.url).pathname;
const js = buildSync({ entryPoints: [ruta("../supabase/functions/whatsapp-entrada/index.ts")], bundle: true, format: "esm", write: false }).outputFiles[0].text;
const SECRETO = "secreto-de-mentira", TOKEN = "palabra-de-mentira";
const firmar = (crudo, secreto = SECRETO) => "sha256=" + createHmac("sha256", secreto).update(crudo).digest("hex");
const aviso = (id = "wamid.PRUEBA1") => ({ object: "whatsapp_business_account", entry: [{ id: "cuenta", changes: [{ field: "messages", value: { metadata: { phone_number_id: "numero" }, contacts: [{ wa_id: "5214495550101", profile: { name: "Inventado" } }], messages: [{ from: "5214495550101", id, timestamp: "1795442400", type: "text", text: { body: "Se descompuso la bomba del pozo." } }] } }] }] });

async function montar({ activo = "si", conSecretos = true, baseFalla = false } = {}) {
  const log = { base: [], otras: [] }; let manejador = null;
  const env = { SUPABASE_URL: "https://base.invalid", SUPABASE_SERVICE_ROLE_KEY: "servicio", AGRO_ESPACIO: "espacio-de-prueba", WHATSAPP_ACTIVO: activo, ...(conSecretos ? { WHATSAPP_VERIFY_TOKEN: TOKEN, WHATSAPP_APP_SECRET: SECRETO } : {}) };
  globalThis.Deno = { env: { get: (k) => env[k] }, serve: (f) => { manejador = f; } };
  globalThis.fetch = async (url, opc = {}) => {
    const u = String(url);
    if (u.startsWith("https://base.invalid/rest/v1/whatsapp_entrada")) { log.base.push({ u, cab: opc.headers, cuerpo: JSON.parse(opc.body) }); return new Response(null, { status: baseFalla ? 500 : 201 }); }
    log.otras.push(u); return new Response("{}", { status: 404 });
  };
  await import(`data:text/javascript;base64,${Buffer.from(js + `\n// ${Math.random()}`).toString("base64")}`);
  const llega = async (cuerpo, { firma, crudo } = {}) => { const texto = crudo ?? JSON.stringify(cuerpo); const r = await manejador(new Request("https://f.invalid/", { method: "POST", headers: { "content-type": "application/json", ...(firma === null ? {} : { "x-hub-signature-256": firma ?? firmar(texto) }) }, body: texto })); return { status: r.status, cuerpo: await r.json() }; };
  const saluda = async (q) => { const r = await manejador(new Request(`https://f.invalid/?${new URLSearchParams(q)}`)); return { status: r.status, texto: await r.text() }; };
  return { llega, saluda, log };
}

test("apagada_o_sin_secretos_no_guarda_nada_ni_contesta_el_saludo", async () => {
  for (const caso of [{ activo: "" }, { activo: "no" }, { conSecretos: false }]) {
    const f = await montar(caso);
    assert.equal((await f.llega(aviso())).status, 503);
    assert.equal((await f.saluda({ "hub.mode": "subscribe", "hub.verify_token": TOKEN, "hub.challenge": "123" })).status, 503);
    assert.deepEqual([f.log.base.length, f.log.otras.length], [0, 0]);
  }
});

test("el_saludo_de_meta_solo_se_contesta_con_la_palabra_correcta", async () => {
  const f = await montar();
  assert.deepEqual(await f.saluda({ "hub.mode": "subscribe", "hub.verify_token": TOKEN, "hub.challenge": "4321" }), { status: 200, texto: "4321" });
  assert.equal((await f.saluda({ "hub.mode": "subscribe", "hub.verify_token": "otra", "hub.challenge": "4321" })).status, 403);
});

test("sin_la_firma_de_meta_sobre_el_cuerpo_exacto_no_se_guarda", async () => {
  const f = await montar();
  assert.equal((await f.llega(aviso(), { firma: null })).status, 401);
  assert.equal((await f.llega(aviso(), { firma: firmar(JSON.stringify(aviso()), "otro-secreto") })).status, 401);
  const crudo = JSON.stringify(aviso()), alterado = crudo.replace("bomba", "bodega");
  assert.equal((await f.llega(null, { crudo: alterado, firma: firmar(crudo) })).status, 401, "cambiarle una palabra al mensaje rompe la firma");
  assert.equal(f.log.base.length, 0);
});

test("con_firma_buena_se_guarda_tal_cual_una_vez_y_la_app_lo_lee_con_su_mismo_lector", async () => {
  const f = await montar();
  const r = await f.llega(aviso());
  assert.deepEqual([r.status, r.cuerpo.recibidos], [200, 1]);
  const g = f.log.base[0];
  assert.match(g.u, /on_conflict=id/); assert.match(g.cab.Prefer, /ignore-duplicates/, "el mismo mensaje dos veces no se guarda dos veces");
  assert.deepEqual([g.cuerpo[0].id, g.cuerpo[0].clase, g.cuerpo[0]._espacio, g.cuerpo[0].cuando], ["wamid.PRUEBA1", "text", "espacio-de-prueba", "2026-11-23T14:00:00.000Z"]);
  const enLaApp = leerEnLaApp({ cuerpo: g.cuerpo[0].datos, personas: directorio({ encargados: [{ id: "enc1", nombre: "Capataz Inventado", telefono: "4495550101" }] }) });
  assert.deepEqual([enLaApp.nuevos.length, enLaApp.nuevos[0].de.rol, enLaApp.nuevos[0].texto], [1, "encargado", "Se descompuso la bomba del pozo."]);
});

test("si_la_base_no_guarda_se_contesta_con_error_para_que_meta_lo_vuelva_a_entregar", async () => {
  const f = await montar({ baseFalla: true });
  assert.equal((await f.llega(aviso())).status, 500);
});

test("la_entrada_nunca_le_manda_un_mensaje_a_nadie_ni_sale_a_otro_lado", async () => {
  const f = await montar();
  await f.llega(aviso()); await f.llega({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { statuses: [{ id: "x", status: "read", timestamp: "1795442400", recipient_id: "5214495550101" }] } }] }] });
  assert.deepEqual(f.log.otras, [], "la única salida es guardar en la base");
  for (const a of ["index.ts", "nucleo.ts"]) assert.equal(/graph\.facebook|WHATSAPP_TOKEN|ACCESS_TOKEN/i.test(readFileSync(ruta(`../supabase/functions/whatsapp-entrada/${a}`), "utf8")), false, `${a} no tiene con qué enviar`);
});

test("la_hoja_de_la_base_esta_pendiente_no_instalada_y_es_de_solo_insercion", () => {
  const { hojas } = JSON.parse(readFileSync(ruta("../supabase/orden.json"), "utf8"));
  assert.equal(hojas.some(h => /whatsapp/.test(h)), false, "no se instala hasta que Luis lo autorice");
  assert.equal(existsSync(ruta("../supabase/whatsapp-entrada.sql")), false);
  const sql = readFileSync(ruta("../supabase/pendientes/whatsapp-entrada.sql"), "utf8").replace(/--.*$/gm, "");
  assert.match(sql, /enable row level security/); assert.equal(/for (update|delete|insert|all)/i.test(sql), false, "nadie con sesión escribe, cambia ni borra");
});
