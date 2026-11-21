// ============================================================
//  AgroGestión — Interpretar un documento de la importación (Edge Function)
//
//  CUÁNDO SE LLAMA
//  Sólo cuando los lectores gratuitos de la app no pudieron: una foto, un
//  ticket, un escaneo, o una hoja cuyas columnas no se reconocen. Un XML, un
//  Excel ordenado o un PDF con tabla NUNCA llegan aquí. Y nunca se llama sola:
//  la pide una persona, viendo antes cuánto puede costar.
//
//  LA LLAVE VIVE AQUÍ
//  `ANTHROPIC_API_KEY` es un secreto del proyecto de Supabase. No está en el
//  código, ni en GitHub, ni en el navegador. Mientras no exista, esta función
//  contesta «no está configurada» y no gasta nada.
//
//  EL DINERO
//  · Dos niveles: `economico` (el modelo más barato) y `superior` (uno mejor,
//    unas veinte veces más caro), que sólo se usa si una persona lo pide para
//    un documento difícil.
//  · Antes de llamar se APARTA en la base lo máximo que podría costar
//    (`reservar_ia`, hoja 44). Si no alcanza el tope, no se llama.
//  · Al terminar se anota lo que costó de verdad, con las unidades de texto
//    que reporta la propia API y los precios de la tabla de abajo.
//  · El mismo documento, con el mismo nivel, no se paga dos veces: se devuelve
//    lo ya leído.
//
//  LO QUE NO HACE
//  · No registra nada en el rancho: devuelve lo que leyó y la app lo PROPONE.
//  · No adivina: lo que no se alcanza a leer va vacío y se dice cuál fue.
//  · No guarda el documento. De una persona no devuelve CURP, número de
//    seguridad social ni cuentas bancarias.
// ============================================================

import { interpretar, type Pedido } from "./nucleo.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const responder = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const BASE = Deno.env.get("SUPABASE_URL") ?? "";
const PUBLICA_DEL_SERVIDOR = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// `llaveDeLaApp`: la llave pública que manda la propia app en su petición. Se prefiere a la variable del servidor, que
// en proyectos nuevos puede no existir (la llave «anon» antigua es opcional).
async function quienLlama(autorizacion: string | null, llaveDeLaApp: string | null): Promise<{ ok: boolean; estado: number; dice: string; cuenta?: string | null }> {
  const PUBLICA = llaveDeLaApp || PUBLICA_DEL_SERVIDOR;
  if (!autorizacion || !BASE || !PUBLICA) return { ok: false, estado: 401, dice: "Hay que entrar con tu cuenta para leer documentos con IA." };
  try {
    const r = await fetch(`${BASE}/rest/v1/rpc/puede_interpretar`, { method: "POST", headers: { Authorization: autorizacion, apikey: PUBLICA, "Content-Type": "application/json" }, body: "{}" });
    if (r.ok && (await r.json()) === true) {
      let cuenta: string | null = null;
      try { cuenta = JSON.parse(atob(autorizacion.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub ?? null; } catch { /* sólo es para anotar quién */ }
      return { ok: true, estado: 200, dice: "", cuenta };
    }
    return { ok: false, estado: 403, dice: "Tu cuenta no tiene permiso para leer documentos con IA. Lo hace quien administra." };
  } catch { return { ok: false, estado: 503, dice: "No se pudo comprobar tu cuenta. Intenta de nuevo." }; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Usa POST" }, 405);

  const quien = await quienLlama(req.headers.get("Authorization"), req.headers.get("apikey"));
  if (!quien.ok) return responder({ error: "sin_permiso", dice: quien.dice }, quien.estado);

  let c: Pedido;
  try { c = await req.json(); } catch { return responder({ error: "cuerpo_invalido", dice: "No se entendió la petición." }, 400); }
  const r = await interpretar(c, quien.cuenta ?? null);
  return responder(r.cuerpo, r.estado);
});
