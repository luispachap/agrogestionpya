// La función del servidor que le pide la lectura a la IA, probada SIN red y SIN gastar: aquí la base y la API son de
// mentira. Se comprueba lo que cuesta dinero si sale mal: que sin permiso, sin llave o sin presupuesto NO se llama a la
// IA; que se aparta antes y se anota lo real después; que lo ya leído no se vuelve a pagar; y que la llave no sale.
// Uso: node --test pruebas/funcion_ia.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";

const js = buildSync({ entryPoints: [new URL("../supabase/functions/interpretar-documento/index.ts", import.meta.url).pathname], bundle: true, format: "esm", write: false }).outputFiles[0].text;
const LLAVE = "sk-ant-LLAVE-DE-MENTIRA";

async function montar({ conLlave = true, puede = true, reserva = "res-1", memoria = null, api = null } = {}) {
  const log = { anthropic: [], rpc: [], rest: [] }; let manejador = null;
  const env = { SUPABASE_URL: "https://base.invalid", SUPABASE_SERVICE_ROLE_KEY: "servicio", SUPABASE_ANON_KEY: "publica", ...(conLlave ? { ANTHROPIC_API_KEY: LLAVE } : {}) };
  globalThis.Deno = { env: { get: (k) => env[k] }, serve: (f) => { manejador = f; } };
  globalThis.fetch = async (url, opc = {}) => {
    const u = String(url), cuerpo = opc.body ? JSON.parse(opc.body) : null;
    const json = (x, status = 200) => new Response(JSON.stringify(x), { status, headers: { "content-type": "application/json" } });
    if (u.includes("api.anthropic.com")) { log.anthropic.push({ cuerpo, cab: opc.headers }); return api ? api(cuerpo, log.anthropic.length) : json({ content: [{ type: "text", text: JSON.stringify({ clase: "ticket", confianza: "alta", total: "348.00" }) }], usage: { input_tokens: 2600, output_tokens: 420 }, stop_reason: "end_turn" }); }
    if (u.includes("/rpc/puede_interpretar")) return json(puede);
    if (u.includes("/rpc/reservar_ia")) { log.rpc.push(["reservar", cuerpo]); return json(reserva); }
    if (u.includes("/rpc/cerrar_ia")) { log.rpc.push(["cerrar", cuerpo]); return json(null); }
    if (u.includes("/rest/v1/uso_ia") && (opc.method || "GET") === "GET") { log.rest.push(u); return json(memoria ? [memoria] : []); }
    if (u.includes("/rest/v1/uso_ia")) { log.rpc.push(["memoria", cuerpo]); return json(null, 201); }
    return json({}, 404);
  };
  await import(`data:text/javascript;base64,${Buffer.from(js + `\n// ${Math.random()}`).toString("base64")}`);
  const jwt = `x.${Buffer.from(JSON.stringify({ sub: "cuenta-1" })).toString("base64url")}.y`;
  const pedir = async (cuerpo, conSesion = true) => { const r = await manejador(new Request("https://f.invalid/", { method: "POST", headers: { "content-type": "application/json", ...(conSesion ? { Authorization: `Bearer ${jwt}` } : {}) }, body: JSON.stringify(cuerpo) })); return { estado: r.status, datos: await r.json() }; };
  return { pedir, log };
}
const HUELLA = "a".repeat(64), IMAGEN = { tipoMedio: "image/jpeg", base64: "QUJD" };
const PEDIDO = { huella: HUELLA, nivel: "economico", modo: "documento", nombre: "ticket.jpg", imagenes: [IMAGEN] };

test("sin_sesion_sin_permiso_o_sin_llave_no_se_llama_a_la_ia", async () => {
  let m = await montar(); let r = await m.pedir(PEDIDO, false);
  assert.equal(r.estado, 401); assert.equal(m.log.anthropic.length, 0);
  m = await montar({ puede: false }); r = await m.pedir(PEDIDO);
  assert.equal(r.estado, 403); assert.equal(r.datos.error, "sin_permiso"); assert.equal(m.log.anthropic.length, 0);
  m = await montar({ conLlave: false }); r = await m.pedir(PEDIDO);
  assert.equal(r.estado, 503); assert.equal(r.datos.error, "sin_llave"); assert.equal(m.log.anthropic.length, 0); assert.equal(m.log.rpc.length, 0, "ni siquiera se aparta");
});

test("si_no_alcanza_el_tope_no_se_llama_a_la_ia", async () => {
  const m = await montar({ reserva: null }), r = await m.pedir(PEDIDO);
  assert.equal(r.estado, 429); assert.equal(r.datos.error, "sin_presupuesto"); assert.equal(m.log.anthropic.length, 0);
});

test("se_aparta_lo_maximo_antes_se_usa_el_modelo_barato_y_se_anota_lo_que_costo_de_verdad", async () => {
  const m = await montar(), r = await m.pedir(PEDIDO);
  assert.equal(r.estado, 200); assert.equal(r.datos.ok, true); assert.equal(r.datos.lectura.total, "348.00");
  const [reservar, cerrar] = m.log.rpc;
  assert.equal(reservar[0], "reservar"); assert.equal(reservar[1].p_modelo, "claude-haiku-5-5"); assert.equal(reservar[1].p_microusd_max, 3450, "(2,500 + 12,000) × 0.10 + 4,000 × 0.50"); assert.equal(reservar[1].p_cuenta, "cuenta-1");
  assert.equal(m.log.anthropic[0].cuerpo.model, "claude-haiku-5-5"); assert.equal(m.log.anthropic[0].cuerpo.max_tokens, 4000);
  assert.equal(cerrar[0], "cerrar"); assert.equal(cerrar[1].p_microusd, 470, "2,600 × 0.10 + 420 × 0.50"); assert.equal(cerrar[1].p_fallo, false);
  assert.deepEqual(r.datos.uso, { modelo: "claude-haiku-5-5", modeloQueContesto: null, formato: "estructurado", nivel: "economico", entrada: 2600, salida: 420, microusd: 470 });
  assert.ok(!JSON.stringify(r.datos).includes(LLAVE), "la llave nunca viaja de regreso");
  assert.equal(m.log.anthropic[0].cab["x-api-key"], LLAVE);
});

test("el_nivel_superior_solo_si_se_pide_y_aparta_veinte_veces_mas", async () => {
  const m = await montar(), r = await m.pedir({ ...PEDIDO, nivel: "superior" });
  assert.equal(m.log.anthropic[0].cuerpo.model, "claude-sonnet-5-5"); assert.equal(m.log.rpc[0][1].p_microusd_max, 69000); assert.equal(r.datos.uso.microusd, 2600 * 2 + 420 * 10);
  const otro = await montar(); await otro.pedir({ ...PEDIDO, nivel: "cualquier-cosa" });
  assert.equal(otro.log.anthropic[0].cuerpo.model, "claude-haiku-5-5", "un nivel desconocido no se vuelve el caro");
});

test("un_documento_ya_leido_no_se_vuelve_a_pagar", async () => {
  const m = await montar({ memoria: { resultado: { clase: "ticket", total: "348.00" }, modelo: "claude-haiku-5-5", nivel: "economico", microusd: 470 } }), r = await m.pedir(PEDIDO);
  assert.equal(r.datos.deMemoria, true); assert.equal(r.datos.uso.microusd, 0); assert.equal(m.log.anthropic.length, 0); assert.ok(!m.log.rpc.some(x => x[0] === "reservar"));
  assert.match(m.log.rest[0], /nivel=in\.\(economico,superior\)/, "para el económico sirve lo leído con cualquiera de los dos");
  const s = await montar({ memoria: null }); await s.pedir({ ...PEDIDO, nivel: "superior" });
  assert.match(s.log.rest[0], /nivel=eq\.superior/, "pedir el superior no se conforma con una lectura del económico");
});

test("si_la_api_falla_se_suelta_lo_apartado_y_no_cuesta", async () => {
  const m = await montar({ api: () => new Response(JSON.stringify({ error: { message: "overloaded" } }), { status: 529 }) }), r = await m.pedir(PEDIDO);
  assert.equal(r.estado, 502); assert.equal(r.datos.error, "fallo_la_lectura");
  const cerrar = m.log.rpc.find(x => x[0] === "cerrar"); assert.equal(cerrar[1].p_fallo, true);
  const sinSaldo = await montar({ api: () => new Response(JSON.stringify({ error: { message: "Your credit balance is too low" } }), { status: 400 }) });
  assert.equal((await sinSaldo.pedir(PEDIDO)).datos.error, "sin_saldo");
  const mala = await montar({ api: () => new Response("{}", { status: 401 }) });
  assert.equal((await mala.pedir(PEDIDO)).datos.error, "llave_invalida");
});

test("si_el_servidor_no_acepta_el_formato_estructurado_se_pide_con_palabras_una_sola_vez", async () => {
  const m = await montar({ api: (cuerpo, n) => (n === 1 ? new Response(JSON.stringify({ error: { message: "output_config: Extra inputs are not permitted" } }), { status: 400 })
    : new Response(JSON.stringify({ content: [{ type: "text", text: 'Aquí va:\n{"clase":"ticket","total":"10"}' }], usage: { input_tokens: 3000, output_tokens: 100 }, stop_reason: "end_turn" }), { status: 200 })) });
  const r = await m.pedir(PEDIDO);
  assert.equal(r.datos.ok, true); assert.equal(r.datos.lectura.total, "10"); assert.equal(m.log.anthropic.length, 2);
  assert.ok(m.log.anthropic[0].cuerpo.output_config); assert.equal(m.log.anthropic[1].cuerpo.output_config, undefined); assert.match(m.log.anthropic[1].cuerpo.system, /JSON Schema/);
});

test("lo_que_no_es_un_documento_valido_se_rechaza_antes_de_apartar", async () => {
  const m = await montar();
  assert.equal((await m.pedir({ ...PEDIDO, huella: "corta" })).datos.error, "sin_huella");
  assert.equal((await m.pedir({ ...PEDIDO, imagenes: [] })).datos.error, "sin_contenido");
  assert.equal((await m.pedir({ ...PEDIDO, imagenes: [{ tipoMedio: "application/pdf", base64: "QUJD" }] })).datos.error, "imagen_no_valida");
  assert.equal((await m.pedir({ ...PEDIDO, imagenes: [{ tipoMedio: "image/jpeg", base64: "A".repeat(1_700_000) }] })).estado, 413);
  assert.equal(m.log.rpc.length, 0); assert.equal(m.log.anthropic.length, 0);
  const cinco = await montar(); await cinco.pedir({ ...PEDIDO, imagenes: Array(9).fill(IMAGEN) });
  assert.equal(cinco.log.anthropic[0].cuerpo.messages[0].content.filter(b => b.type === "image").length, 4, "a lo más cuatro páginas por documento");
});

test("una_hoja_usa_sus_propias_instrucciones_y_no_manda_imagenes", async () => {
  const m = await montar({ api: () => new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ clase: "gastos", confianza: "alta", renglon_encabezado: "0", columnas: {}, avisos: [] }) }], usage: { input_tokens: 900, output_tokens: 120 } }), { status: 200 }) });
  const r = await m.pedir({ huella: HUELLA, modo: "hoja", nombre: "rara.csv", texto: "r0: c0=F. | c1=Quién | c2=Cuánto" });
  assert.equal(r.datos.modo, "hoja"); assert.match(m.log.anthropic[0].cuerpo.system, /NO es copiar los datos/); assert.equal(r.datos.uso.microusd, 150);
  assert.equal(m.log.rpc[0][1].p_huella, `${HUELLA}:hoja`, "la lectura de las columnas y la del documento no se confunden en la memoria");
});
