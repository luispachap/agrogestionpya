// ============================================================
//  AgroGestión — Avisos al teléfono (Edge Function)
//
//  La llama la BASE cuando entra un mensaje, una asignación, una incidencia
//  o algo por autorizar (hoja 47), con un secreto que sólo conocen la base y
//  esta función. También la puede llamar una persona con su sesión para
//  mandarse un aviso de prueba a sus propios aparatos.
//
//  No cuesta: usa el servicio de avisos del navegador de cada teléfono. Las
//  llaves con que se firman los avisos se generan aquí la primera vez y se
//  guardan en la base, en una tabla que ninguna cuenta puede leer.
// ============================================================
import webpush from "npm:web-push@3.6.7";
import { atender, crearBase } from "./nucleo.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "metodo_no_permitido" }), { status: 405, headers: CORS });
  const url = Deno.env.get("SUPABASE_URL") || "", llave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  let cuerpo: unknown = null; try { cuerpo = await req.json(); } catch { /* sin cuerpo */ }
  // Si viene con sesión, se le pregunta a Supabase de quién es: nunca se le cree al propio pedido.
  let quien: string | null = null;
  const auth = req.headers.get("authorization") || "";
  if (auth && !req.headers.get("x-aviso-secreto")) {
    try { const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey: Deno.env.get("SUPABASE_ANON_KEY") || llave } }); if (r.ok) quien = (await r.json())?.id || null; } catch { /* sin sesión válida */ }
  }
  const s = await atender({ base: crearBase({ url, llave }, fetch), push: webpush as any, cuerpo, secreto: req.headers.get("x-aviso-secreto"), quien });
  return new Response(JSON.stringify(s.cuerpo), { status: s.status, headers: { ...CORS, "Content-Type": "application/json" } });
});
