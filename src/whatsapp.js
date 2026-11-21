// WHATSAPP: OTRA PUERTA A LA MISMA OPERACIÓN. Preparado, NO ACTIVADO.
//
// Hoy no hay cuenta de WhatsApp Business, no hay número, no hay función instalada y nada de
// aquí manda un mensaje a nadie. Este archivo es la parte que se puede dejar lista y probada
// sin contratar nada: entender lo que Meta entrega cuando alguien escribe, saber QUIÉN es por
// su teléfono (sin adivinar) y convertirlo en el mismo «mensaje» que usa el camino común
// (`operaciones.js`). De ahí en adelante un mensaje de WhatsApp se trata igual que uno del
// chat de adentro: se propone, se pregunta lo que falta, y lo confirma quien tiene permiso.
//
// Reglas:
//   · WhatsApp no da permisos: el teléfono dice quién es; su rol sale del catálogo.
//   · Un teléfono que no está en el catálogo, o que está en dos personas, NO se le asigna a nadie.
//   · El mismo mensaje entregado dos veces (Meta reintenta) entra una sola vez.
//   · Una nota de voz o una foto se reciben, pero no se «entienden» solas: quedan dichas como
//     pendientes de transcribir o de leer (eso cuesta y lo autoriza Luis).
//   · La respuesta se ARMA, no se envía (`seEnvia: false`).

export const ESTADO_WHATSAPP = { activo: false, porque: "Falta autorizar la cuenta de WhatsApp Business, el número y los costos. Nada se envía ni se recibe todavía." };
export const HORAS_DE_VENTANA = 24;

// Los últimos diez dígitos: en México el mismo celular llega como 52… o como 521…
export const claveDeTelefono = (t) => { const d = String(t ?? "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };
const isoDe = (segundos) => { const n = Number(segundos); return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null; };

const CLASES = { text: "texto", audio: "audio", image: "foto", document: "documento", location: "ubicacion", interactive: "boton", button: "boton" };

// Lo que Meta entrega en un aviso → una lista pareja de mensajes. Lo que no se reconoce se cuenta, no se inventa.
export function mensajesDeAviso(cuerpo) {
  const mensajes = [], estados = []; let ignorados = 0;
  if (cuerpo?.object !== "whatsapp_business_account") return { mensajes, estados, ignorados: 0, valido: false };
  for (const entrada of cuerpo.entry || []) for (const cambio of entrada.changes || []) {
    if (cambio.field !== "messages") { ignorados++; continue; }
    const v = cambio.value || {}, nombres = new Map((v.contacts || []).map(c => [c.wa_id, c.profile?.name || ""]));
    for (const s of v.statuses || []) estados.push({ id: s.id, estado: s.status, cuando: isoDe(s.timestamp), para: claveDeTelefono(s.recipient_id) });
    for (const m of v.messages || []) {
      const clase = CLASES[m.type] || "otro", cuando = isoDe(m.timestamp);
      if (!m.id || !m.from || !cuando) { ignorados++; continue; }
      const medio = m.audio || m.image || m.document || null;
      const texto = m.type === "text" ? String(m.text?.body || "") : String(medio?.caption || m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || m.button?.text || "");
      mensajes.push({ id: m.id, de: claveDeTelefono(m.from), deCompleto: String(m.from), nombreEnWhatsApp: nombres.get(m.from) || "", cuando, clase, texto: texto.trim(),
        medio: medio ? { id: medio.id || null, tipo: medio.mime_type || "", nombre: medio.filename || "", esNotaDeVoz: !!m.audio?.voice } : null,
        boton: m.interactive?.button_reply?.id || m.button?.payload || null, respondeA: m.context?.id || null, numeroDelRancho: v.metadata?.phone_number_id || null });
    }
  }
  return { mensajes, estados, ignorados, valido: true };
}

// A quién se le puede reconocer por teléfono. El rol sale del catálogo donde está la persona, nunca del mensaje.
export function directorio(data = {}) {
  const de = (lista, rol) => (lista || []).filter(p => p && p.activo !== false && claveDeTelefono(p.telefono)).map(p => ({ id: p.id, nombre: p.nombre || "", rol, telefono: claveDeTelefono(p.telefono) }));
  return [...de(data.encargados, "encargado"), ...de(data.agronomos, "agronomo"), ...de(data.trabajadores, "trabajador")];
}

export function quienEscribe(telefono, personas = []) {
  const clave = claveDeTelefono(telefono);
  if (!clave) return { ok: false, motivo: "sin_telefono", dice: "El mensaje no trae un teléfono que se pueda leer." };
  const son = personas.filter(p => claveDeTelefono(p.telefono) === clave);
  if (son.length === 0) return { ok: false, motivo: "desconocido", dice: "Ese teléfono no está en el catálogo: el mensaje se guarda, pero no se le atribuye a nadie." };
  if (son.length > 1) return { ok: false, motivo: "repetido", dice: `Ese teléfono está en ${son.length} personas (${son.map(p => p.nombre).join(", ")}): no se escoge a una. Hay que corregir el catálogo.` };
  return { ok: true, persona: { id: son[0].id, nombre: son[0].nombre, rol: son[0].rol } };
}

// El mismo «mensaje» que entiende el camino común. El id sale del de WhatsApp: recibirlo dos veces es el mismo mensaje.
export const idDeMensaje = (idDeWhatsApp) => `wa-${String(idDeWhatsApp).replace(/[^A-Za-z0-9_-]/g, "").slice(-80)}`;
export function aMensajeComun(m, persona) {
  const falta = m.clase === "audio" ? "transcribir" : (m.clase === "foto" || m.clase === "documento") ? "leer" : null;
  return { id: idDeMensaje(m.id), canal: "whatsapp", de: { id: persona.id, nombre: persona.nombre, rol: persona.rol }, cuando: m.cuando, texto: m.texto,
    whatsapp: { id: m.id, clase: m.clase, medio: m.medio, boton: m.boton, respondeA: m.respondeA },
    pendienteDe: falta, porque: falta === "transcribir" ? "Es una nota de voz: falta pasarla a texto para poder entenderla." : falta === "leer" ? "Trae una foto o un documento: falta leerlo." : "" };
}

// Un aviso completo: qué entra, qué ya había entrado y qué no se le puede atribuir a nadie.
export function recibir({ cuerpo, personas = [], yaRecibidos = [] }) {
  const { mensajes, estados, ignorados, valido } = mensajesDeAviso(cuerpo), vistos = new Set(yaRecibidos);
  const nuevos = [], repetidos = [], sinDueno = [];
  for (const m of mensajes) {
    const id = idDeMensaje(m.id);
    if (vistos.has(id)) { repetidos.push(id); continue; }
    vistos.add(id);
    const q = quienEscribe(m.de, personas);
    if (!q.ok) { sinDueno.push({ id, cuando: m.cuando, telefonoTermina: m.de.slice(-4), motivo: q.motivo, dice: q.dice }); continue; }
    nuevos.push(aMensajeComun(m, q.persona));
  }
  return { valido, nuevos, repetidos, sinDueno, estados, ignorados };
}

// La regla de las 24 horas: sólo se puede contestar con texto libre si la persona escribió en las últimas 24 h.
export function ventana(ultimoDeLaPersona, ahora) {
  if (!ultimoDeLaPersona) return { abierta: false, hasta: null, dice: "Esta persona no ha escrito: para iniciarle una conversación hace falta una plantilla aprobada." };
  const hasta = new Date(new Date(ultimoDeLaPersona).getTime() + HORAS_DE_VENTANA * 3600000).toISOString();
  const abierta = new Date(ahora).getTime() < new Date(hasta).getTime();
  return { abierta, hasta, dice: abierta ? "Se le puede contestar con texto libre." : "Pasaron más de 24 horas desde su último mensaje: sólo con una plantilla aprobada." };
}

// Lo que se le CONTESTARÍA. Se arma para poder revisarlo y probarlo; no se envía.
export function respuestaPara(plan, { ventanaAbierta = true } = {}) {
  const ps = plan?.propuestas || [], lineas = [];
  if (!ps.length) lineas.push("Recibido. No reconocí nada para registrar; queda guardado tal cual.");
  for (const p of ps) {
    if (p.yaHecha) lineas.push(`Ya estaba registrado: ${p.frase}`);
    else if (p.preguntas.length) lineas.push(`«${p.frase}» — ${p.preguntas.join(" ")}`);
    else if (!p.permiso.puede) lineas.push(`«${p.frase}» — queda anotado para revisión. ${p.permiso.dice}`);
    else lineas.push(`«${p.frase}» — listo para confirmar.`);
    if (p.aviso) lineas.push(p.aviso);
  }
  return { texto: lineas.join("\n"), requierePlantilla: !ventanaAbierta, seEnvia: false, porque: ESTADO_WHATSAPP.porque };
}
