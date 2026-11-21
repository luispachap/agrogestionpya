// Los avisos al teléfono, probados SIN red y SIN mandar nada: la base y el servicio de avisos son de mentira.
// Uso: node --test pruebas/funcion_avisos.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSync } from "esbuild";

const js = buildSync({ entryPoints: [new URL("../supabase/functions/avisar/nucleo.ts", import.meta.url).pathname], bundle: true, format: "esm", write: false }).outputFiles[0].text;
const { atender, crearBase, CLASES } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const U = (n) => `00000000-0000-0000-0000-00000000000${n}`;   // cuentas inventadas: 1 Miguel(superadmin) 2 Fito(agronomo) 3 capataz(encargado) 4 finanzas 5 sin aparato
function montar({ prefs = [], permisos = [], conLlaves = true } = {}) {
  const t = {
    avisos_llaves: [{ id: "unico", publica: conLlaves ? "PUB" : null, privada: conLlaves ? "PRIV" : null, secreto: "SECRETO" }],
    perfiles: [{ id: U(1), rol: "superadmin" }, { id: U(2), rol: "agronomo" }, { id: U(3), rol: "encargado" }, { id: U(4), rol: "finanzas" }, { id: U(5), rol: "encargado" }],
    avisos_suscripciones: [1, 2, 3, 4].map(n => ({ usuario: U(n), endpoint: `https://push.invalid/${n}`, p256dh: "k", auth: "a" })),
    avisos_preferencias: prefs, permisos_operacion: permisos, avisos_enviados: [],
    conversacion_miembros: [{ conversacion: "conv-g", miembro: U(3), rol: null }, { conversacion: "conv-g", miembro: U(2), rol: null }],
    eventos: [{ id: "conv-g", tipo: "conversacion", datos: { datos: { clase: "grupo", nombre: "Riego", miembros: [{ id: U(3), nombre: "Capataz Inventado" }, { id: U(2), nombre: "Fito Inventado" }] } } },
      { id: "ev-p", tipo: "prestamo_solicitud", creado_por: U(3), datos: { datos: { monto: 500, nombre: "Trabajador Inventado" } } }],
    chat: [{ id: "m1", creado_por: U(3), datos: { conversacion: "conv-g", texto: "Se pagaron 3,500 pesos del diésel", de: { nombre: "Capataz Inventado" } } },
      { id: "m2", creado_por: U(3), datos: { conversacion: "conv-g", texto: "@Fito ya llegó el producto", audio: { dataUrl: "x" }, de: { nombre: "Capataz Inventado" } } },
      { id: "m3", creado_por: U(3), datos: { texto: "hola a todos", de: { nombre: "Capataz Inventado" } } }, { id: "m4", creado_por: null, datos: { delAsistente: true, texto: "..." } }],
    indicaciones: [{ id: "i1", fecha: "2026-11-23", creado_por: U(1), datos: { tipo: "tarea", asignadoA: U(3), resumen: "Regar la 53" } }, { id: "i2", fecha: "2026-11-23", creado_por: U(1), datos: { tipo: "tarea", asignadoA: "t-de-catalogo" } }],
    incidencias: [{ id: "inc1", creado_por: U(3), datos: { desc: "El tractor tira aceite" } }], solicitudes_compra: [],
  };
  const pedir = async (url, opc = {}) => {
    const u = new URL(url), tabla = u.pathname.split("/").pop(), metodo = opc.method || "GET", json = (x, s = 200) => new Response(JSON.stringify(x), { status: s });
    const pasa = (f) => [...u.searchParams].every(([k, v]) => k === "select" || k === "on_conflict" || (v.startsWith("eq.") ? String(f[k]) === v.slice(3) : v.startsWith("in.(") ? v.slice(4, -1).split(",").includes(String(f[k])) : v === "is.null" ? f[k] == null : true));
    if (metodo === "GET") return json((t[tabla] || []).filter(pasa));
    if (metodo === "POST") { const f = JSON.parse(opc.body); if (t[tabla].some(x => x.llave === f.llave)) return json([]); t[tabla].push(f); return json([f], 201); }
    if (metodo === "PATCH") { const c = JSON.parse(opc.body); t[tabla].filter(pasa).forEach(f => Object.assign(f, c)); return json([]); }
    if (metodo === "DELETE") { t[tabla] = t[tabla].filter(f => !pasa(f)); return json([]); }
    return json([], 400);
  };
  const enviados = [];
  const push = { generateVAPIDKeys: () => ({ publicKey: "PUB-NUEVA", privateKey: "PRIV-NUEVA" }), sendNotification: async (sub, cuerpo, opc) => { if (sub.endpoint.endsWith("/4") && t.caduco) { const e = new Error("gone"); e.statusCode = 410; throw e; } enviados.push({ a: sub.endpoint.split("/").pop(), ...JSON.parse(cuerpo), urgencia: opc.urgency }); } };
  const llama = (cuerpo, secreto = "SECRETO", quien = null) => atender({ base: crearBase({ url: "https://base.invalid", llave: "servicio" }, pedir), push, cuerpo, secreto, quien });
  return { t, enviados, llama };
}

test("un_mensaje_le_avisa_a_los_demas_participantes_y_a_nadie_mas_sin_decir_que_dice", async () => {
  const f = montar(); const r = await f.llama({ tabla: "chat", id: "m1" });
  assert.equal(r.status, 200); assert.deepEqual(f.enviados.map(e => e.a), ["2"], "sólo al otro participante: ni a quien lo escribió ni a la administración");
  const e = f.enviados[0];
  assert.deepEqual([e.titulo, e.cuerpo, e.tag, e.url], ["Capataz Inventado mandó un mensaje", "En «Riego»", "conv-conv-g", "/?ir=chat&conv=conv-g&msj=m1"]);
  assert.equal(/3,500|di[eé]sel|pesos/.test(JSON.stringify(e)), false, "el aviso se ve en la pantalla bloqueada: no lleva el texto ni importes");
  assert.equal(e.urgencia, "high", "con prioridad normal el teléfono lo retiene hasta que se abre el navegador: pasó en la prueba real");
});

test("el_mismo_aviso_no_llega_dos_veces_y_los_de_una_conversacion_se_agrupan", async () => {
  const f = montar(); await f.llama({ tabla: "chat", id: "m1" }); await f.llama({ tabla: "chat", id: "m1" });
  assert.equal(f.enviados.length, 1, "la base puede reintentar: no se duplica");
  await f.llama({ tabla: "chat", id: "m2" });
  assert.deepEqual(f.enviados.map(e => e.tag), ["conv-conv-g", "conv-conv-g"], "misma etiqueta: el teléfono los junta en uno");
});

test("una_mencion_llega_aunque_la_persona_tenga_silenciados_los_mensajes", async () => {
  const f = montar({ prefs: [{ usuario: U(2), datos: { mensaje: false } }] });
  await f.llama({ tabla: "chat", id: "m1" }); assert.equal(f.enviados.length, 0, "silenció los mensajes normales");
  await f.llama({ tabla: "chat", id: "m2" });
  assert.deepEqual([f.enviados[0].a, f.enviados[0].clase, f.enviados[0].titulo, f.enviados[0].urgencia], ["2", "mencion", "Capataz Inventado te mencionó en un audio", "high"]);
});

test("la_general_avisa_a_quienes_tienen_mensajeria_y_el_asistente_no_avisa", async () => {
  const f = montar(); await f.llama({ tabla: "chat", id: "m3" });
  assert.deepEqual(f.enviados.map(e => e.a).sort(), ["1", "2", "4"]); assert.equal(f.enviados[0].cuerpo, "En la conversación general");
  assert.equal((await f.llama({ tabla: "chat", id: "m4" })).cuerpo.motivo, "de_esto_no_se_avisa");
});

test("una_asignacion_le_avisa_a_su_persona_aunque_haya_silenciado_todo_y_sin_decir_el_detalle", async () => {
  const f = montar({ prefs: [{ usuario: U(3), datos: { mensaje: false, asignacion: false } }] });
  await f.llama({ tabla: "indicaciones", id: "i1" });
  assert.deepEqual([f.enviados.length, f.enviados[0].a, f.enviados[0].titulo, f.enviados[0].urgencia], [1, "3", "Tienes una asignación nueva", "high"], "lo obligatorio no se silencia");
  assert.equal(/Regar|53/.test(JSON.stringify(f.enviados[0])), false);
  assert.equal((await f.llama({ tabla: "indicaciones", id: "i2" })).cuerpo.motivo, "de_esto_no_se_avisa", "a quien no tiene cuenta no hay a dónde avisarle");
  assert.ok(CLASES.asignacion.obligatorio && CLASES.autorizacion.obligatorio && !CLASES.mensaje.obligatorio);
});

test("lo_que_espera_autorizacion_le_avisa_a_quien_puede_autorizarlo_sin_nombres_ni_importes", async () => {
  const f = montar({ permisos: [{ usuario: U(4), operacion: "autorizar_prestamos", revocado: null }] });
  await f.llama({ tabla: "eventos", id: "ev-p" });
  assert.deepEqual(f.enviados.map(e => e.a).sort(), ["1", "4"]); assert.equal(/500|Trabajador/.test(JSON.stringify(f.enviados)), false);
  const g = montar(); await g.llama({ tabla: "incidencias", id: "inc1" });
  assert.deepEqual(g.enviados.map(e => e.a), ["1"], "a quien dirige, no a quien la reportó"); assert.equal(/aceite|tractor/.test(JSON.stringify(g.enviados)), false);
});

test("sin_el_secreto_de_la_base_no_se_manda_nada_y_la_prueba_solo_va_a_los_aparatos_de_quien_la_pide", async () => {
  const f = montar();
  assert.equal((await f.llama({ tabla: "chat", id: "m1" }, "otro")).status, 401); assert.equal((await f.llama({ tabla: "chat", id: "m1" }, null)).status, 401);
  assert.equal((await f.llama({ prueba: true }, null, null)).status, 401);
  assert.equal((await f.llama({ tabla: "perfiles", id: U(1) })).status, 400, "no se le puede pedir que lea otra tabla");
  await f.llama({ prueba: true }, null, U(2));
  assert.deepEqual(f.enviados.map(e => [e.a, e.clase]), [["2", "prueba"]]);
});

test("un_aparato_que_ya_no_existe_se_olvida_y_las_llaves_se_generan_solas_la_primera_vez", async () => {
  const f = montar(); f.t.caduco = true; await f.llama({ tabla: "chat", id: "m3" });
  assert.equal(f.t.avisos_suscripciones.some(s => s.endpoint.endsWith("/4")), false);
  const g = montar({ conLlaves: false }); await g.llama({ tabla: "chat", id: "m3" });
  assert.deepEqual([g.t.avisos_llaves[0].publica, g.t.avisos_llaves[0].privada], ["PUB-NUEVA", "PRIV-NUEVA"]); assert.equal(g.enviados.length, 3);
});
