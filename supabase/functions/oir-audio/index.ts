// ============================================================
//  AgroGestión — Transcribir un audio (Edge Function)
//
//  ÉSTE ES EL ÚLTIMO RECURSO, NO EL NORMAL.
//
//  El camino de todos los días es el dictado que ya trae el teléfono
//  (`SpeechRecognition`): es gratis y en Android va sin señal. Aquí sólo
//  llegan los audios de teléfonos que no lo traen, o los que se grabaron sin
//  internet y se quedaron esperando.
//
//  Lo que hace: transcribe. Nada más. Entender de qué se trata lo hace
//  src/voz.js, en el teléfono y con reglas — gratis, reproducible, y sin que
//  la misma frase se lea distinto dos veces.
//
//  CÓMO SE INSTALA (una sola vez, junto con leer-papel):
//     npx supabase secrets set ANTHROPIC_API_KEY=la-llave-real
//     npx supabase functions deploy oir-audio
//
//  Si no está instalada, la app NO se rompe: el audio se queda guardado y se
//  puede transcribir después, o escribir el texto a mano.
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

const INSTRUCCIONES = `Estás transcribiendo lo que dice el capataz de un rancho de ajo en Zacatecas, México. Habla como se habla en el campo: rápido, con apodos, con nombres de parcelas, y a veces con el tractor prendido de fondo.

Tu trabajo es UNO: escribir lo que dijo. Nada más.

REGLAS:

· Escríbelo tal como lo dijo. No lo acomodes, no lo hagas sonar bonito, no lo resumas. Si dijo "anduvieron ahí un rato", eso escribe — no "trabajaron durante un periodo".
· Los números déjalos como los dijo: si dijo "tres mil ochocientos", escribe "tres mil ochocientos". El sistema los convierte después, y si tú los cambias a 3800 y te equivocas, nadie lo va a notar.
· Los nombres de personas y de parcelas escríbelos como suenan. Si no estás seguro, escríbelo entre corchetes: [¿Chato?]. Un nombre inventado le mete un día de trabajo a quien no fue.
· Si un pedazo no se entiende, escribe [no se entiende] en ese lugar. NO adivines qué pudo haber dicho: un hueco marcado se pregunta, una frase inventada se guarda.
· No agregues nada que no haya dicho. Ni conclusiones, ni contexto, ni ordenar las ideas.

Responde solamente con el JSON del formato indicado.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Usa POST" }, 405);

  const llave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!llave) {
    return responder({
      error: "sin_llave",
      dice: "Transcribir con IA no está configurado en el servidor. El audio se queda guardado y se puede escribir el texto a mano.",
    }, 503);
  }

  let cuerpo: { audioBase64?: string; tipoMedio?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return responder({ error: "cuerpo_invalido", dice: "No se entendió la petición." }, 400);
  }

  const { audioBase64, tipoMedio = "audio/webm" } = cuerpo;
  if (!audioBase64) return responder({ error: "sin_audio", dice: "No llegó el audio." }, 400);
  // ~15 MB en base64. Un audio más largo que eso conviene partirlo.
  if (audioBase64.length > 15_000_000) {
    return responder({
      error: "audio_muy_largo",
      dice: "El audio pesa demasiado. Conviene grabar en tramos más cortos: uno por cada cosa que pasó.",
    }, 413);
  }

  const esquema = {
    type: "object",
    additionalProperties: false,
    required: ["texto", "avisos"],
    properties: {
      texto: {
        type: "string",
        description: "Lo que dijo, tal cual. Con [no se entiende] donde no se alcanzó a oír.",
      },
      avisos: {
        type: "array",
        items: { type: "string" },
        description: "Lo que hay que decirle a la persona: mucho ruido, se cortó, hay pedazos que no se entendieron.",
      },
    },
  };

  try {
    const anthropic = new Anthropic({ apiKey: llave });
    const respuesta = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 8000,
      // Transcribir no es razonar largo. Con esfuerzo bajo sale bien y cuesta
      // menos — y de todos modos casi nunca se llama, porque el teléfono suele
      // transcribir solo.
      output_config: { effort: "low", format: { type: "json_schema", schema: esquema } },
      system: INSTRUCCIONES,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: tipoMedio, data: audioBase64 } },
          { type: "text", text: "Escribe lo que dice este audio, tal como lo dice." },
        ],
      }],
    });

    if (respuesta.stop_reason === "refusal") {
      return responder({
        error: "no_se_pudo",
        dice: "No se pudo transcribir este audio. Sigue guardado; se puede escribir el texto a mano.",
      }, 422);
    }

    const bloque = respuesta.content.find((b) => b.type === "text");
    if (!bloque || bloque.type !== "text") {
      return responder({ error: "respuesta_vacia", dice: "La transcripción vino vacía. El audio sigue guardado." }, 502);
    }
    let leido;
    try {
      leido = JSON.parse(bloque.text);
    } catch {
      return responder({ error: "respuesta_ilegible", dice: "La transcripción no se entendió. El audio sigue guardado." }, 502);
    }
    return responder({ ok: true, fuente: "ia", ...leido });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return responder({
      error: "fallo",
      dice: `No se pudo transcribir (${msg}). El audio sigue guardado y no se pierde.`,
    }, 502);
  }
});
