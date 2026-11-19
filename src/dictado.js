// ============================================================
//  AgroGestión — Oír lo que se dice
//
//  Este archivo SÍ toca el mundo: el micrófono del teléfono. La lógica de
//  entender lo dicho vive en src/voz.js, y ahí están sus pruebas.
//
//  ─────────────────────────────────────────────────────────────
//  DE GRATIS A CARO, COMO SIEMPRE
//  ─────────────────────────────────────────────────────────────
//  1. El dictado que YA TRAE el teléfono (`SpeechRecognition`). No cuesta
//     nada, y en Android funciona sin señal porque el reconocimiento va en el
//     aparato. Es el camino normal y el que hay que preferir.
//  2. Si el teléfono no lo trae —o si no hay señal y el navegador lo manda a
//     un servidor— se GRABA el audio y se guarda. Ese audio no se pierde
//     nunca: se puede transcribir después, cuando haya internet.
//  3. Y siempre queda escribir el texto a mano.
//
//  La regla que manda: **el audio se guarda SIEMPRE**, se haya entendido o
//  no. Es la misma idea que la foto borrosa del ticket — nunca se pierde
//  evidencia de lo que alguien dijo.
// ============================================================

/* ════════════ ¿ESTE TELÉFONO PUEDE OÍR? ════════════ */

export function comoPuedeOir() {
  if (typeof window === "undefined") return { dictado: false, grabar: false, porque: "Sin navegador." };
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const grabar = !!(navigator.mediaDevices && window.MediaRecorder);
  return {
    dictado: !!Rec,
    grabar,
    porque: Rec
      ? "Este teléfono transcribe solo, sin costo."
      : grabar
        ? "Este teléfono no transcribe solo, pero sí puede grabar. El audio se guarda y se transcribe cuando haya señal."
        : "Este teléfono no deja ni transcribir ni grabar. Se puede escribir el texto a mano y el sistema lo clasifica igual.",
  };
}

/* ════════════ EL DICTADO DEL TELÉFONO ════════════ */

// Devuelve un controlador con .detener(). Va entregando el texto conforme lo
// oye (`onParcial`) para que se vea que está funcionando, y al final entrega
// lo definitivo (`onListo`).
//
// Si falla, lo DICE. Un micrófono que no prende y no avisa hace que la
// persona hable diez minutos a la nada.
export function dictar({ onParcial, onListo, onError, idioma = "es-MX" }) {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) {
    onError?.("Este teléfono no trae dictado. Graba el audio o escribe el texto.");
    return { detener: () => {} };
  }
  const rec = new Rec();
  rec.lang = idioma;
  rec.continuous = true;      // Gera va a hablar largo, no una frase suelta
  rec.interimResults = true;

  let definitivo = "";
  rec.onresult = (ev) => {
    let parcial = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const t = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) definitivo += t + " ";
      else parcial += t;
    }
    onParcial?.((definitivo + parcial).trim());
  };
  rec.onerror = (ev) => {
    const porque = {
      "not-allowed": "No se dio permiso para usar el micrófono. Hay que dárselo en los ajustes del navegador.",
      "no-speech": "No se oyó nada. ¿Está muy lejos el teléfono?",
      "audio-capture": "No se encontró micrófono.",
      "network": "El dictado de este navegador necesita señal y no la hay. Graba el audio: se guarda y se transcribe después.",
    }[ev.error] || `Falló el dictado (${ev.error}).`;
    onError?.(porque);
  };
  rec.onend = () => onListo?.(definitivo.trim());

  try { rec.start(); } catch (e) { onError?.(`No se pudo empezar a oír (${e?.message || e}).`); }
  return {
    detener: () => { try { rec.stop(); } catch { /* ya estaba detenido */ } },
  };
}

/* ════════════ GRABAR EL AUDIO ════════════ */

// El audio se guarda SIEMPRE, se haya podido transcribir o no. Es la misma
// idea que la foto borrosa del ticket: nunca se pierde evidencia de lo que
// alguien dijo. Si el dictado falló, el audio queda para transcribirlo
// después con señal.
export async function grabar({ onError }) {
  if (!(navigator.mediaDevices && window.MediaRecorder)) {
    onError?.("Este teléfono no deja grabar audio.");
    return null;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    const pedazos = [];
    mr.ondataavailable = (e) => { if (e.data.size > 0) pedazos.push(e.data); };
    mr.start();
    return {
      detener: () => new Promise((ok) => {
        mr.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(pedazos, { type: mr.mimeType || "audio/webm" });
          const fr = new FileReader();
          fr.onload = () => ok({ blob, dataUrl: fr.result, tipo: blob.type, bytes: blob.size });
          fr.readAsDataURL(blob);
        };
        mr.stop();
      }),
    };
  } catch (e) {
    onError?.(`No se pudo prender el micrófono (${e?.message || e}).`);
    return null;
  }
}

/* ════════════ TRANSCRIBIR UN AUDIO GUARDADO ════════════ */

// Para los audios que quedaron sin transcribir: se mandan a la Edge Function
// cuando hay señal. Esto SÍ cuesta, y por eso es el último recurso.
export async function transcribirGuardado({ supabase, supabaseListo, audioBase64, tipoMedio }) {
  if (!supabaseListo) {
    return { ok: false, dice: "No hay conexión con la nube. El audio sigue guardado; se puede transcribir después." };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, dice: "Transcribir necesita señal. El audio sigue guardado y no se pierde." };
  }
  try {
    const { data, error } = await supabase.functions.invoke("oir-audio", {
      body: { audioBase64, tipoMedio },
    });
    if (error) return { ok: false, dice: `No se pudo transcribir (${error.message}). El audio sigue guardado.` };
    if (!data || data.error) return { ok: false, dice: data?.dice || "No se pudo transcribir. El audio sigue guardado." };
    return { ok: true, texto: data.texto };
  } catch (e) {
    return { ok: false, dice: `No se pudo transcribir (${e?.message || e}). El audio sigue guardado.` };
  }
}
