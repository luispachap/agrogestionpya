// ============================================================
//  AgroGestión — Leer un papel con IA (Edge Function)
//
//  POR QUÉ ESTO VIVE AQUÍ Y NO EN LA APP
//
//  Vite mete el valor de TODA variable VITE_* dentro del archivo JavaScript
//  que Vercel le sirve a cualquiera que abra la página. Una llave de la API
//  puesta en el navegador queda pública: cualquiera puede verla con el menú
//  "ver código fuente" y gastar con ella. Por eso la llave vive aquí, en el
//  servidor de Supabase, y la app sólo pide "léeme esta foto".
//
//  CUÁNDO SE LLAMA — casi nunca
//
//  La app intenta primero con el patrón local que ya aprendió de ese
//  proveedor: gratis, sin señal y reproducible. Sólo cuando NO conoce el
//  papel llega aquí. Y de esa lectura la app aprende el patrón, así que el
//  mes que entra ese mismo proveedor ya no pasa por aquí.
//
//  LO QUE DEVUELVE — el texto, no sólo los datos
//
//  Devuelve la TRANSCRIPCIÓN completa además de los campos. Eso es lo que
//  hace posible aprender: el motor local busca dónde quedó cada dato dentro
//  de ese texto y se guarda el ancla. Si sólo devolviera los valores, habría
//  que pagar la lectura todos los meses.
//
//  LO QUE NO HACE
//
//  · No adivina. Un campo que no se alcanza a leer va en null, y su nombre
//    va en "noSeLeyo". Un dato que falta no es un cero.
//  · No decide nada. Propone; la persona confirma en la app.
//  · No guarda la foto ni el texto. Sólo responde y se olvida.
//
//  CÓMO SE INSTALA (para Luis, una sola vez):
//
//    1. En la terminal, dentro de la carpeta del proyecto:
//         npx supabase login
//         npx supabase link --project-ref zicflluuksanrjwjotps
//         npx supabase secrets set ANTHROPIC_API_KEY=la-llave-real
//         npx supabase functions deploy leer-papel
//
//    2. La llave se pone UNA vez con "secrets set" y nunca aparece en el
//       código ni en GitHub ni en el navegador.
//
//  Si esto no está instalado, la app NO se rompe: sigue leyendo con los
//  patrones que ya aprendió, y para los papeles nuevos avisa que la lectura
//  con IA no está disponible y pide capturar a mano.
// ============================================================

import Anthropic from "npm:@anthropic-ai/sdk@^0.71.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// Lo que se le pide leer según el tipo de papel. Se piden POCOS campos a
// propósito: cada campo de más es una oportunidad de inventar.
const CAMPOS_POR_TIPO: Record<string, string> = {
  ticket: "emisor, rfc, fecha, folio, subtotal, iva, total, y los renglones de la compra (concepto, cantidad, unidad, importe)",
  factura: "emisor, rfc, uuid (folio fiscal), fecha, subtotal, iva, total, y los renglones",
  remision: "emisor, fecha, folio, y los renglones (concepto, cantidad, unidad); una remisión normalmente NO trae impuestos",
  horometro: "la lectura del horómetro en horas, y el identificador de la máquina si se alcanza a ver",
  etiqueta_agroquimico:
    "nombre comercial, ingrediente activo, concentración, presentación (litros o kilos), número de registro, y MUY IMPORTANTE: el intervalo de reentrada y el intervalo de seguridad (carencia) al corte, en días",
  estado_cuenta: "banco, últimos 4 dígitos de la cuenta, periodo, saldo inicial, saldo final, y los movimientos (fecha, concepto, cargo, abono, saldo)",
};

const INSTRUCCIONES = `Eres el lector de papeles de un rancho de ajo en Zacatecas, México. Te llega la foto de un comprobante que tomó un trabajador en el campo o en la bodega.

Tu trabajo tiene dos partes:

1. TRANSCRIBIR. Copia el texto del papel tal como está, renglón por renglón, respetando el orden y dejando los números como aparecen impresos ("23,200.00", no 23200). Esta transcripción es lo más importante de tu respuesta: con ella el sistema aprende a leer solo a este proveedor y ya no vuelve a preguntarte.

2. SEÑALAR LOS DATOS. Di qué valor corresponde a cada campo.

REGLAS QUE NO SE ROMPEN:

· Si un dato NO se alcanza a leer, ponlo en null y escribe su nombre en "noSeLeyo". NUNCA lo completes con algo que parezca razonable. Un número inventado que se ve plausible es peor que un hueco, porque nadie lo revisa.
· Si la foto está borrosa, cortada o le falta un pedazo, dilo en "avisos" y transcribe sólo lo que de verdad se ve.
· Si no puedes distinguir un dígito, el campo va en null. No elijas "el más probable": un 3 leído como 8 sale plausible y equivocado.
· Los montos van como número, sin signo de pesos ni comas: 23200.00
· Las fechas van como AAAA-MM-DD. En México el día va primero: "12/08/2026" es el 12 de agosto.
· No calcules ni corrijas nada. Si el total impreso no cuadra con la suma de los renglones, transcribe lo impreso y anótalo en "avisos". El papel es lo que es.
· No inventes el nombre del proveedor a partir del logo si el texto no lo dice.

Responde solamente con el JSON del formato indicado.`;

// ── La libreta de uso: una lectura por documento, y con presupuesto ────────
// Se escribe con la llave de servicio, que sólo existe aquí en el servidor:
// desde la app nadie puede inflar ni borrar el consumo (hoja SQL 28).
const BASE = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICIO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const cabServicio = { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}`, "Content-Type": "application/json" };

async function huellaDe(base64: string): Promise<string> {
  const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const h = await crypto.subtle.digest("SHA-256", bin);
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ¿Este documento ya se leyó? Entonces se devuelve lo ya leído: no cuesta.
async function yaLeido(funcion: string, huella: string): Promise<Record<string, unknown> | null> {
  if (!BASE || !SERVICIO) return null;
  try {
    const r = await fetch(`${BASE}/rest/v1/uso_ia?select=resultado&funcion=eq.${funcion}&huella=eq.${huella}&resultado=not.is.null&order=cuando.desc&limit=1`, { headers: cabServicio });
    const filas = r.ok ? await r.json() : [];
    return filas[0]?.resultado ?? null;
  } catch { return null; }
}

// ¿Queda presupuesto este mes? Si NO se puede comprobar, no se llama a la IA:
// un presupuesto que se salta cuando falla la consulta no es un presupuesto.
async function quedaPresupuesto(): Promise<{ ok: boolean; dice: string }> {
  if (!BASE || !SERVICIO) return { ok: false, dice: "No se pudo comprobar el presupuesto de IA. Captura a mano." };
  try {
    const inicio = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
    const desde = new Date(Date.UTC(inicio.getFullYear(), inicio.getMonth(), 1, 6)).toISOString(); // día 1, medianoche de Zacatecas
    const [lim, uso] = await Promise.all([
      fetch(`${BASE}/rest/v1/limites?select=ia_llamadas_mes,ia_centavos_mes&limit=1`, { headers: cabServicio }).then((r) => r.json()),
      fetch(`${BASE}/rest/v1/uso_ia?select=centavos&de_cache=eq.false&cuando=gte.${desde}`, { headers: cabServicio }).then((r) => r.json()),
    ]);
    const tope = lim?.[0];
    if (!tope || !Array.isArray(uso)) return { ok: false, dice: "No se pudo comprobar el presupuesto de IA. Captura a mano." };
    const gastado = uso.reduce((s: number, u: { centavos: number | null }) => s + (u.centavos ?? 0), 0);
    if (uso.length >= tope.ia_llamadas_mes) return { ok: false, dice: `Ya se usaron las ${tope.ia_llamadas_mes} lecturas con IA de este mes. Se puede capturar a mano; el XML y los proveedores ya conocidos se siguen leyendo solos.` };
    if (tope.ia_centavos_mes && gastado >= tope.ia_centavos_mes) return { ok: false, dice: "Se llegó al presupuesto de IA de este mes. Se puede capturar a mano." };
    return { ok: true, dice: "" };
  } catch { return { ok: false, dice: "No se pudo comprobar el presupuesto de IA. Captura a mano." }; }
}

async function anotarUso(fila: Record<string, unknown>) {
  if (!BASE || !SERVICIO) return;
  try { await fetch(`${BASE}/rest/v1/uso_ia`, { method: "POST", headers: { ...cabServicio, Prefer: "return=minimal" }, body: JSON.stringify(fila) }); } catch { /* la lectura ya se hizo: no se pierde por no poder anotarla */ }
}

// El costo estimado sólo se calcula si alguien configuró el precio. Sin
// precio no se inventa: se deja en blanco y manda el tope por número de lecturas.
function centavosDe(entrada: number | null, salida: number | null): number | null {
  const pe = Number(Deno.env.get("IA_CENTAVOS_POR_MILLON_ENTRADA")), ps = Number(Deno.env.get("IA_CENTAVOS_POR_MILLON_SALIDA"));
  if (!pe || !ps || entrada == null || salida == null) return null;
  return Math.ceil((entrada * pe + salida * ps) / 1_000_000);
}

async function tienePerfil(autorizacion: string | null): Promise<{ ok: boolean; estado: number; dice: string; cuenta?: string | null }> {
  const base = Deno.env.get("SUPABASE_URL");
  const publica = Deno.env.get("SUPABASE_ANON_KEY");
  if (!autorizacion || !base || !publica) {
    return { ok: false, estado: 401, dice: "Hay que iniciar sesión con tu cuenta para leer papeles con IA. Se puede capturar a mano." };
  }
  try {
    const r = await fetch(`${base}/rest/v1/rpc/tiene_perfil`, {
      method: "POST",
      headers: { Authorization: autorizacion, apikey: publica, "Content-Type": "application/json" },
      body: "{}",
    });
    if (r.ok && (await r.json()) === true) {
      let cuenta: string | null = null;
      try { cuenta = JSON.parse(atob(autorizacion.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub ?? null; } catch { /* sólo es para anotar quién */ }
      return { ok: true, estado: 200, dice: "", cuenta };
    }
    return { ok: false, estado: 403, dice: "Tu cuenta no tiene permiso para leer papeles con IA. Se puede capturar a mano." };
  } catch {
    // Si no se pudo comprobar, NO se deja pasar.
    return { ok: false, estado: 503, dice: "No se pudo comprobar tu cuenta. Intenta de nuevo o captura a mano." };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Usa POST" }, 405);

  // ¿Quién llama? Sin esto, cualquiera con la llave pública de la app (que
  // viene dentro de la app) podía mandar fotos aquí y gastar la lectura con IA.
  // Sólo pasa quien tiene sesión Y perfil en el rancho; se le pregunta a la
  // propia base con la sesión de quien llama.
  const quien = await tienePerfil(req.headers.get("Authorization"));
  if (!quien.ok) {
    return responder({ error: "sin_permiso", dice: quien.dice }, quien.estado);
  }

  const llave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!llave) {
    // Se dice con todas sus letras en vez de fallar callada. La app enseña
    // este mensaje y ofrece capturar a mano.
    return responder({
      error: "sin_llave",
      dice: "La lectura con IA no está configurada en el servidor. Se puede capturar a mano; los papeles de proveedores ya conocidos se siguen leyendo solos.",
    }, 503);
  }

  let cuerpo: {
    imagenBase64?: string;
    tipoMedio?: string;
    tipo?: string;
    pistaEmisor?: string;
  };
  try {
    cuerpo = await req.json();
  } catch {
    return responder({ error: "cuerpo_invalido", dice: "No se entendió la petición." }, 400);
  }

  const { imagenBase64, tipoMedio = "image/jpeg", tipo = "ticket", pistaEmisor } = cuerpo;
  if (!imagenBase64) {
    return responder({ error: "sin_imagen", dice: "No llegó la foto." }, 400);
  }
  // ~7 MB en base64. Arriba de eso, mejor que la app la achique antes.
  if (imagenBase64.length > 7_000_000) {
    return responder({
      error: "imagen_muy_grande",
      dice: "La foto pesa demasiado. La app debe reducirla antes de mandarla.",
    }, 413);
  }

  // Una lectura por documento: si esta misma foto ya se leyó, se devuelve eso.
  const huella = await huellaDe(imagenBase64);
  const previa = await yaLeido("leer-papel", huella);
  if (previa) {
    await anotarUso({ huella, funcion: "leer-papel", cuenta: quien.cuenta ?? null, de_cache: true });
    return responder({ ...previa, ok: true, fuente: "ia", deMemoria: true, huella });
  }
  const presupuesto = await quedaPresupuesto();
  if (!presupuesto.ok) return responder({ error: "sin_presupuesto", dice: presupuesto.dice }, 429);

  const esquema = {
    type: "object",
    additionalProperties: false,
    required: ["transcripcion", "tipo", "campos", "noSeLeyo", "avisos"],
    properties: {
      transcripcion: {
        type: "string",
        description: "El texto del papel, renglón por renglón, tal como está impreso.",
      },
      tipo: {
        type: "string",
        enum: ["ticket", "factura", "remision", "estado_cuenta", "horometro", "etiqueta_agroquimico", "por identificar"],
        description: "Qué es este papel. Si no estás seguro, 'por identificar'.",
      },
      campos: {
        type: "object",
        additionalProperties: true,
        description: "Los datos leídos. Un dato que no se alcanzó a leer va en null, nunca inventado.",
      },
      renglones: {
        type: "array",
        description: "Las partidas del comprobante, si las trae.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            concepto: { type: "string" },
            cantidad: { type: ["number", "null"] },
            unidad: { type: ["string", "null"] },
            importe: { type: ["number", "null"] },
          },
          required: ["concepto", "cantidad", "unidad", "importe"],
        },
      },
      noSeLeyo: {
        type: "array",
        items: { type: "string" },
        description: "Nombres de los campos que NO se alcanzaron a leer. Es tan importante como los que sí.",
      },
      avisos: {
        type: "array",
        items: { type: "string" },
        description: "Lo que hay que decirle a la persona: foto borrosa, papel cortado, un total que no cuadra con sus renglones.",
      },
    },
  };

  const queBuscar = CAMPOS_POR_TIPO[tipo] || CAMPOS_POR_TIPO.ticket;
  const pista = pistaEmisor ? `\n\nEs posible que el emisor sea "${pistaEmisor}", pero compruébalo en el papel: si el texto dice otra cosa, manda lo que dice el texto.` : "";

  try {
    const anthropic = new Anthropic({ apiKey: llave });
    const respuesta = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 8000,
      // Esto es transcribir y señalar, no razonar largo. Con esfuerzo medio
      // sale bien y cuesta menos; y de todos modos casi nunca se llama,
      // porque el patrón local se lleva la mayoría de los papeles.
      output_config: { effort: "medium", format: { type: "json_schema", schema: esquema } },
      system: INSTRUCCIONES,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: tipoMedio, data: imagenBase64 } },
          { type: "text", text: `Este papel debería ser: ${tipo}. Busca sobre todo: ${queBuscar}.${pista}` },
        ],
      }],
    });

    if (respuesta.stop_reason === "refusal") {
      return responder({
        error: "no_se_pudo_leer",
        dice: "No se pudo leer esta foto. Se puede capturar a mano; la foto queda guardada igual.",
      }, 422);
    }

    const texto = respuesta.content.find((b) => b.type === "text");
    if (!texto || texto.type !== "text") {
      return responder({ error: "respuesta_vacia", dice: "La lectura vino vacía. Captura a mano." }, 502);
    }

    let leido;
    try {
      leido = JSON.parse(texto.text);
    } catch {
      return responder({ error: "respuesta_ilegible", dice: "La lectura no se entendió. Captura a mano." }, 502);
    }

    const entrada = respuesta.usage?.input_tokens ?? null, salida = respuesta.usage?.output_tokens ?? null;
    await anotarUso({
      huella, funcion: "leer-papel", cuenta: quien.cuenta ?? null, de_cache: false,
      entrada, salida, centavos: centavosDe(entrada, salida), resultado: leido,
    });

    return responder({
      ok: true,
      fuente: "ia",                 // para que la app sepa que esta lectura SÍ costó
      huella,
      ...leido,
      uso: {
        entrada: respuesta.usage?.input_tokens ?? null,
        salida: respuesta.usage?.output_tokens ?? null,
      },
    });
  } catch (e) {
    // Se dice qué pasó. Fallar callada es lo que ya nos costó una vez con
    // los iconos: el navegador nunca bajaba la fuente y nadie se enteraba.
    const msg = e instanceof Error ? e.message : String(e);
    return responder({
      error: "fallo_la_lectura",
      dice: `No se pudo leer la foto con IA (${msg}). La foto se guarda igual y se puede capturar a mano.`,
    }, 502);
  }
});
