// ============================================================
//  AgroGestión — Entrada de WhatsApp (Edge Function)
//
//  ESTADO: PREPARADA, NO INSTALADA. No hay cuenta de WhatsApp Business ni
//  número contratado. Esta función no está desplegada, y aunque lo estuviera
//  contesta «no está activada» mientras no existan sus cuatro secretos:
//    WHATSAPP_ACTIVO = "si"          (el interruptor; lo pone Luis al autorizar)
//    WHATSAPP_VERIFY_TOKEN           (la palabra con que Meta comprueba la dirección)
//    WHATSAPP_APP_SECRET             (con el que Meta firma cada aviso)
//    AGRO_ESPACIO                    (la marca del espacio, como en todo lo demás)
//
//  QUÉ HACE
//  · Comprueba que el aviso viene de Meta (firma sobre el cuerpo exacto).
//  · Guarda cada mensaje TAL CUAL en `whatsapp_entrada` (hoja pendiente).
//
//  QUÉ NO HACE
//  · No entiende el mensaje ni registra nada del rancho: eso lo hace la app,
//    por el mismo camino que el chat (`src/whatsapp.js` → `src/operaciones.js`),
//    y lo confirma una persona con permiso.
//  · No le contesta a nadie ni manda mensajes: aquí no hay llave para enviar.
//  · No baja audios ni fotos (eso pide otra llave y otro permiso).
// ============================================================

import { recibir, saludo, type Ambiente } from "./nucleo.ts";

const ambiente = (): Ambiente => ({
  activo: Deno.env.get("WHATSAPP_ACTIVO") || "", tokenDeVerificacion: Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "", secretoDeLaApp: Deno.env.get("WHATSAPP_APP_SECRET") || "",
  urlBase: Deno.env.get("SUPABASE_URL") || "", llaveDeServicio: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", espacio: Deno.env.get("AGRO_ESPACIO") || "",
});

Deno.serve(async (req: Request) => {
  const a = ambiente();
  const s = req.method === "GET" ? saludo(a, new URL(req.url))
    : req.method === "POST" ? await recibir(a, await req.text(), req.headers.get("x-hub-signature-256"), fetch)
    : { status: 405, cuerpo: { error: "metodo_no_permitido" } };
  return s.texto !== undefined ? new Response(s.texto, { status: s.status, headers: { "Content-Type": "text/plain" } })
    : new Response(JSON.stringify(s.cuerpo), { status: s.status, headers: { "Content-Type": "application/json" } });
});
