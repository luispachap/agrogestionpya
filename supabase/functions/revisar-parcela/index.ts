// ============================================================
//  AgroGestión — Revisar con IA las fotos del dron (Edge Function)
//
//  Luis: "hasta un análisis completo a la parcela por ia u otros mecanismos
//  más baratos", y después: "lo del drone sí es lo que quería... y sí con ia
//  que lo revise".
//
//  ─────────────────────────────────────────────────────────────
//  LO QUE ESTO ES, Y LO QUE NO ES
//  ─────────────────────────────────────────────────────────────
//  Esto es una OPINIÓN sobre unas fotos. No es una medición.
//
//  No hay ortomosaico, no hay NDVI calibrado, no hay altura de vuelo conocida.
//  Nada de lo que salga de aquí es un dato duro, nada dispara un movimiento
//  solo, y nada entra al sistema sin que una persona lo confirme. Lo que sí
//  vale, y vale mucho: una segunda mirada sobre 60 fotos que nadie iba a
//  revisar una por una, que señala DÓNDE ir a ver con los propios ojos.
//
//  ─────────────────────────────────────────────────────────────
//  POR QUÉ VA CON CONTEXTO Y NO SOLO CON LAS FOTOS
//  ─────────────────────────────────────────────────────────────
//  Sin contexto, cualquier modelo describe "un campo verde con surcos". Con el
//  cultivo, la fecha de siembra, lo que se le aplicó y lo que dice la bitácora,
//  puede decir algo que sirva: que la orilla norte va atrasada respecto al
//  resto DE ESTA MISMA PARCELA, que el amarillamiento coincide con donde no
//  llegó el riego, que el vuelo anterior se veía distinto.
//
//  La comparación contra el vuelo anterior es lo más útil de todo: un campo
//  no se juzga contra una idea de cómo debería verse, se juzga contra cómo se
//  veía hace tres semanas.
//
//  CÓMO SE INSTALA (una vez, junto con las otras dos):
//     npx supabase secrets set ANTHROPIC_API_KEY=la-llave-real
//     npx supabase functions deploy revisar-parcela
//
//  Si no está instalada, la app NO se rompe: los vuelos se guardan igual y la
//  línea del tiempo funciona sin ninguna IA. La revisión es un extra.
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

const INSTRUCCIONES = `Estás viendo fotos tomadas con un dron sobre una parcela de un rancho de ajo y chile en Zacatecas, México. Quien las va a leer es el capataz o el dueño, en un teléfono, parado en la orilla del terreno.

TU TRABAJO: decir qué se ve y DÓNDE conviene ir a revisar con los propios ojos. Nada más.

LO QUE NO ERES:
· No eres una medición. No des porcentajes de cobertura, ni de humedad, ni índices de vigor: no tienes con qué calcularlos. Un número inventado con cara de dato es peor que no decir nada, porque nadie lo vuelve a cuestionar.
· No diagnostiques una plaga o una enfermedad por su nombre desde el aire. Puedes decir "hay una mancha amarillenta en la esquina noreste que conviene ir a ver"; no puedes decir "es fusarium".
· No recetes. La dosis y el producto los decide el agrónomo, que se llama Fito y conoce la parcela.

CÓMO MIRAR:
· Compara la parcela CONSIGO MISMA. Lo que importa no es si se ve bien contra una idea abstracta, sino si hay pedazos distintos al resto: más claros, más ralos, más atrasados, encharcados, sin emerger.
· Si te dan fotos de un vuelo ANTERIOR, compáralas. Un campo se juzga contra cómo se veía hace tres semanas, no contra un ideal.
· Ubica cada cosa como se ubica en el campo: "la franja de la orilla que da al camino", "las últimas ocho camas del lado del canal". No uses coordenadas ni números de pixel.
· Usa el contexto que te dan (cultivo, fecha de siembra, aplicaciones, bitácora). Si algo que ves coincide con algo que pasó, dilo.

CÓMO ESCRIBIR:
· En español de rancho, llano y corto. Sin jerga técnica, sin adjetivos de folleto.
· Cada observación con su nivel de seguridad, honesto. "Se ve" y "parece" son distintos de "hay", y la diferencia importa.
· Si las fotos no alcanzan para decir algo —salieron movidas, muy altas, muy oscuras, muy pocas— DILO. Un "no se alcanza a ver" es una respuesta útil; una observación inventada sobre una foto borrosa manda a alguien a caminar en balde.
· Si la parcela se ve pareja y sin novedad, dilo en una línea y ya. No inventes hallazgos para llenar el reporte.

Responde solamente con el JSON del formato indicado.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Usa POST" }, 405);

  const llave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!llave) {
    return responder({
      error: "sin_llave",
      dice: "La revisión con IA no está configurada en el servidor. Las fotos del vuelo se guardan igual y la línea del tiempo funciona sin ella.",
    }, 503);
  }

  let cuerpo: {
    fotos?: string[];
    fotosAnteriores?: string[];
    contexto?: Record<string, unknown>;
    dejadasFuera?: number;
  };
  try {
    cuerpo = await req.json();
  } catch {
    return responder({ error: "cuerpo_invalido", dice: "No se entendió la petición." }, 400);
  }

  const fotos = cuerpo.fotos || [];
  const anteriores = cuerpo.fotosAnteriores || [];
  if (fotos.length === 0) {
    return responder({ error: "sin_fotos", dice: "No llegó ninguna foto del vuelo." }, 400);
  }
  // Un tope alto rebasa el límite de la petición y falla entera. Es mejor
  // revisar 12 fotos y DECIR cuántas quedaron fuera, que fallar con 200.
  if (fotos.length > 12 || anteriores.length > 6) {
    return responder({
      error: "demasiadas_fotos",
      dice: `Llegaron ${fotos.length} fotos de este vuelo y ${anteriores.length} del anterior. Manda hasta 12 y 6: las que mejor cubran la parcela. Se puede revisar por partes.`,
    }, 413);
  }

  const c = cuerpo.contexto || {};
  const contextoTexto = [
    c.parcela ? `Parcela: ${c.parcela}` : null,
    c.superficie ? `Superficie: ${c.superficie} hectáreas` : null,
    c.cultivo ? `Cultivo: ${c.cultivo}` : null,
    c.fechaSiembra ? `Se sembró el ${c.fechaSiembra}` : null,
    c.diasDeSembrado ? `Lleva ${c.diasDeSembrado} días de sembrada` : null,
    c.fechaVuelo ? `Este vuelo es del ${c.fechaVuelo}` : null,
    c.fechaVueloAnterior ? `El vuelo anterior es del ${c.fechaVueloAnterior}` : null,
    c.aplicaciones ? `Aplicaciones recientes: ${c.aplicaciones}` : null,
    c.bitacora ? `De la bitácora del rancho: ${c.bitacora}` : null,
    c.riego ? `Riego: ${c.riego}` : null,
  ].filter(Boolean).join("\n");

  const esquema = {
    type: "object",
    additionalProperties: false,
    required: ["seAlcanzaAVer", "resumen", "observaciones", "aDondeIr", "avisos"],
    properties: {
      seAlcanzaAVer: {
        type: "boolean",
        description: "false si las fotos no dan para decir nada (movidas, oscuras, muy pocas, muy altas). Si es false, resumen explica por qué y observaciones va vacío.",
      },
      resumen: {
        type: "string",
        description: "Dos o tres renglones, en español llano, sobre cómo se ve la parcela. Si se ve pareja y sin novedad, dilo así de corto.",
      },
      observaciones: {
        type: "array",
        description: "Lo que se ve distinto al resto de la parcela. Vacío si no hay nada que señalar — no se inventan hallazgos para llenar.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["donde", "que", "seguridad"],
          properties: {
            donde: { type: "string", description: "En términos de campo: \"la franja de la orilla del camino\", \"la esquina que da al canal\"." },
            que: { type: "string", description: "Qué se ve. Descriptivo, no diagnóstico." },
            seguridad: { type: "string", enum: ["se ve claro", "parece", "no se distingue bien"] },
            comparadoConAntes: { type: "string", description: "Sólo si hubo fotos del vuelo anterior: qué cambió. Vacío si no las hubo." },
            coincideCon: { type: "string", description: "Si esto coincide con algo del contexto (una aplicación, algo de la bitácora), dilo. Vacío si no." },
          },
        },
      },
      aDondeIr: {
        type: "array",
        items: { type: "string" },
        description: "Los dos o tres lugares que conviene ir a ver a pie, en orden. Vacío si no hace falta ir a ningún lado.",
      },
      avisos: {
        type: "array",
        items: { type: "string" },
        description: "Problemas con las fotos mismas: pocas, movidas, no cubren toda la parcela, tomadas a contraluz.",
      },
    },
  };

  const contenido: unknown[] = [];
  if (anteriores.length > 0) {
    contenido.push({ type: "text", text: `Primero, las ${anteriores.length} foto(s) del vuelo ANTERIOR, para comparar:` });
    for (const f of anteriores) {
      contenido.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: f } });
    }
  }
  contenido.push({ type: "text", text: `Ahora las ${fotos.length} foto(s) del vuelo de HOY:` });
  for (const f of fotos) {
    contenido.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: f } });
  }
  contenido.push({
    type: "text",
    text: (contextoTexto ? `Contexto de la parcela:\n${contextoTexto}\n\n` : "No se mandó contexto de la parcela: dilo en los avisos, porque sin él lo que puedes decir es mucho menos útil.\n\n")
      + (cuerpo.dejadasFuera
        ? `AVISO: se dejaron fuera ${cuerpo.dejadasFuera} fotos del vuelo por el tope. No estás viendo la parcela completa; ponlo en los avisos.\n\n`
        : "")
      + "Revisa la parcela y responde con el JSON del formato indicado.",
  });

  try {
    const anthropic = new Anthropic({ apiKey: llave });
    const respuesta = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 8000,
      // Comparar dos vuelos y ubicar lo que cambió sí es razonar: aquí el
      // esfuerzo alto se paga solo. Es una revisión al mes por parcela, no una
      // llamada por movimiento — al revés que leer-papel, que va en bajo.
      output_config: { effort: "high", format: { type: "json_schema", schema: esquema } },
      system: INSTRUCCIONES,
      messages: [{ role: "user", content: contenido }],
    });

    if (respuesta.stop_reason === "refusal") {
      return responder({
        error: "no_se_pudo",
        dice: "No se pudo revisar este vuelo. Las fotos siguen guardadas y la línea del tiempo funciona igual.",
      }, 422);
    }

    const bloque = respuesta.content.find((b) => b.type === "text");
    if (!bloque || bloque.type !== "text") {
      return responder({ error: "respuesta_vacia", dice: "La revisión vino vacía. Las fotos siguen guardadas." }, 502);
    }
    let leido;
    try {
      leido = JSON.parse(bloque.text);
    } catch {
      return responder({ error: "respuesta_ilegible", dice: "La revisión no se entendió. Las fotos siguen guardadas." }, 502);
    }
    return responder({
      ok: true,
      fuente: "ia",
      // Marcado desde el servidor, para que la app no pueda presentarlo como
      // otra cosa: esto es una opinión sobre unas fotos.
      esOpinion: true,
      ...leido,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return responder({
      error: "fallo",
      dice: `No se pudo revisar (${msg}). Las fotos del vuelo siguen guardadas y no se pierden.`,
    }, 502);
  }
});
