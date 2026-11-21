// Lo que hace la entrada de WhatsApp, sin saber nada de Deno: comprobar quién llama y guardar tal cual.
// NO entiende el mensaje, NO registra nada del rancho y NO le contesta a nadie.

export type Ambiente = { activo: string; tokenDeVerificacion: string; secretoDeLaApp: string; urlBase: string; llaveDeServicio: string; espacio: string };
export type Salida = { status: number; cuerpo: unknown; texto?: string };

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
// Comparar sin que el tiempo de respuesta diga cuántos caracteres coincidieron.
const iguales = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

export async function firmaDe(secreto: string, crudo: string): Promise<string> {
  const llave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return "sha256=" + hex(await crypto.subtle.sign("HMAC", llave, new TextEncoder().encode(crudo)));
}

export const listo = (a: Ambiente) => a.activo === "si" && !!a.tokenDeVerificacion && !!a.secretoDeLaApp && !!a.urlBase && !!a.llaveDeServicio;
const APAGADO: Salida = { status: 503, cuerpo: { error: "no_activado", dice: "La entrada de WhatsApp no está activada." } };

// El saludo con que Meta comprueba que la dirección es nuestra.
export function saludo(a: Ambiente, url: URL): Salida {
  if (!listo(a)) return APAGADO;
  const ok = url.searchParams.get("hub.mode") === "subscribe" && iguales(url.searchParams.get("hub.verify_token") || "", a.tokenDeVerificacion);
  return ok ? { status: 200, cuerpo: null, texto: url.searchParams.get("hub.challenge") || "" } : { status: 403, cuerpo: { error: "token_incorrecto" } };
}

type Renglon = { id: string; de: string; cuando: string; clase: string; datos: unknown; _espacio: string };

export function renglonesDe(cuerpo: any, espacio: string): Renglon[] {
  const out: Renglon[] = [];
  if (cuerpo?.object !== "whatsapp_business_account") return out;
  for (const e of cuerpo.entry || []) for (const c of e.changes || []) {
    if (c.field !== "messages") continue;
    const v = c.value || {};
    for (const m of v.messages || []) {
      const t = Number(m.timestamp);
      if (!m.id || !m.from || !Number.isFinite(t) || t <= 0) continue;
      const contacto = (v.contacts || []).find((x: any) => x.wa_id === m.from) || null;
      // Se guarda el mensaje como llegó, envuelto igual que el aviso, para que la app lo lea con su mismo lector.
      out.push({ id: String(m.id), de: String(m.from), cuando: new Date(t * 1000).toISOString(), clase: String(m.type || "otro"), _espacio: espacio,
        datos: { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: v.metadata || null, contacts: contacto ? [contacto] : [], messages: [m] } }] }] } });
    }
  }
  return out;
}

export async function recibir(a: Ambiente, crudo: string, firma: string | null, pedir: typeof fetch): Promise<Salida> {
  if (!listo(a)) return APAGADO;
  // Sin la firma de Meta sobre el cuerpo EXACTO, cualquiera podría inventar mensajes de cualquier teléfono.
  if (!firma || !iguales(firma, await firmaDe(a.secretoDeLaApp, crudo))) return { status: 401, cuerpo: { error: "firma_invalida" } };
  let cuerpo: unknown;
  try { cuerpo = JSON.parse(crudo); } catch { return { status: 400, cuerpo: { error: "no_es_json" } }; }
  const renglones = renglonesDe(cuerpo, a.espacio);
  if (!renglones.length) return { status: 200, cuerpo: { recibidos: 0 } };
  // El mismo mensaje entregado dos veces no se guarda dos veces: el id es el de WhatsApp.
  const r = await pedir(`${a.urlBase}/rest/v1/whatsapp_entrada?on_conflict=id`, { method: "POST",
    headers: { apikey: a.llaveDeServicio, Authorization: `Bearer ${a.llaveDeServicio}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(renglones) });
  // Si no se pudo guardar se contesta con error para que Meta lo vuelva a entregar: un mensaje no se pierde en silencio.
  if (!r.ok) return { status: 500, cuerpo: { error: "no_se_guardo" } };
  return { status: 200, cuerpo: { recibidos: renglones.length } };
}
