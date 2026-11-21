// Decide A QUIÉN se le avisa de QUÉ y con qué palabras. No sabe nada de Deno: recibe con qué pedirle a la base y
// con qué mandar el aviso, para poder probarse sin red.
//
// Reglas:
//  · El aviso no lleva el texto del mensaje, ni importes, ni datos de una persona: se ve en la pantalla bloqueada.
//  · Sólo se le avisa a quien PUEDE ver eso (participantes de la conversación, el asignado, quien autoriza).
//  · Nunca a quien lo escribió. Nunca dos veces lo mismo a la misma persona.
//  · Los mensajes de una conversación se agrupan en un solo aviso (misma etiqueta).
//  · Cada quien puede silenciar lo que no es obligatorio. Lo obligatorio (asignaciones y autorizaciones) llega siempre.

export type Base = { url: string; llave: string };
export type Push = { generateVAPIDKeys(): { publicKey: string; privateKey: string }; sendNotification(sub: unknown, cuerpo: string, opciones: unknown): Promise<unknown> };
export type Aviso = { clase: string; titulo: string; cuerpo: string; url: string; tag: string; obligatorio: boolean; usuarios?: string[]; roles?: string[]; permiso?: string; excluye?: string | null };

export const CLASES: Record<string, { nombre: string; obligatorio: boolean }> = {
  mensaje: { nombre: "Mensajes nuevos", obligatorio: false },
  mencion: { nombre: "Cuando me mencionan", obligatorio: false },
  conversacion: { nombre: "Cuando me agregan a una conversación", obligatorio: false },
  incidencia: { nombre: "Incidencias de campo o maquinaria", obligatorio: false },
  compra: { nombre: "Solicitudes de compra por revisar", obligatorio: false },
  asignacion: { nombre: "Mis asignaciones y sus cambios", obligatorio: true },
  autorizacion: { nombre: "Lo que espera mi autorización", obligatorio: true },
  prueba: { nombre: "Aviso de prueba", obligatorio: true },
};
const ES_CUENTA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CON_MENSAJES = ["superadmin", "admin", "encargado", "agronomo", "finanzas", "dueno"];
const plano = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function crearBase(b: Base, pedir: typeof fetch) {
  const cab = { apikey: b.llave, Authorization: `Bearer ${b.llave}`, "Content-Type": "application/json" };
  return {
    async leer(ruta: string): Promise<any[]> { const r = await pedir(`${b.url}/rest/v1/${ruta}`, { headers: cab }); return r.ok ? await r.json() : []; },
    async escribir(ruta: string, metodo: string, cuerpo: unknown, prefer = "return=representation"): Promise<any[]> {
      const r = await pedir(`${b.url}/rest/v1/${ruta}`, { method: metodo, headers: { ...cab, Prefer: prefer }, body: cuerpo === null ? undefined : JSON.stringify(cuerpo) });
      if (!r.ok) return []; try { return await r.json(); } catch { return []; }
    },
  };
}
type B = ReturnType<typeof crearBase>;

// Qué aviso sale de un renglón. null = de esto no se avisa.
export async function avisoDe(base: B, tabla: string, fila: any): Promise<Aviso | null> {
  const d = fila?.datos || {}, autor = fila?.creado_por || null;
  if (!fila || fila.borrado) return null;
  if (tabla === "chat") {
    if (d.delAsistente) return null;
    const conv = d.conversacion && d.conversacion !== "general" ? String(d.conversacion) : "general";
    let nombre = "General del rancho", usuarios: string[] | undefined, roles: string[] | undefined, nombres: string[] = [];
    if (conv === "general") roles = CON_MENSAJES;
    else {
      const miembros = await base.leer(`conversacion_miembros?conversacion=eq.${encodeURIComponent(conv)}&select=miembro,rol`);
      usuarios = miembros.map((m) => m.miembro).filter((m) => m && ES_CUENTA.test(m)); roles = miembros.map((m) => m.rol).filter(Boolean).flatMap((r) => (r === "admin" ? ["admin", "superadmin"] : [r]));
      const ev = (await base.leer(`eventos?id=eq.${encodeURIComponent(conv)}&select=datos`))[0]?.datos?.datos;
      nombre = ev?.clase === "directa" ? "conversación directa" : ev?.nombre || "una conversación";
      nombres = (ev?.miembros || []).filter((m: any) => m.nombre).map((m: any) => ({ id: m.id, primer: plano(m.nombre).split(/\s+/)[0] }));
    }
    const de = d.de?.nombre || fila.dequien || "Alguien";
    const que = d.audio ? "un audio" : d.foto ? "una foto" : d.documento ? "un documento" : "un mensaje";
    // Una mención: «@Fito» con el primer nombre de un participante. A esa persona le llega aunque tenga silenciados los mensajes.
    const mencionados = (nombres as any[]).filter((m) => m.primer && new RegExp(`@\\s*${m.primer}\\b`).test(plano(d.texto))).map((m) => m.id).filter((id) => ES_CUENTA.test(id));
    return { clase: "mensaje", titulo: `${de} mandó ${que}`, cuerpo: conv === "general" ? "En la conversación general" : nombre === "conversación directa" ? "En su conversación directa" : `En «${nombre}»`,
      url: `/?ir=chat&conv=${encodeURIComponent(conv)}&msj=${encodeURIComponent(fila.id)}`, tag: `conv-${conv}`, obligatorio: false, usuarios, roles, excluye: autor, ...(mencionados.length ? { mencionados } as any : {}) };
  }
  if (tabla === "indicaciones") {
    if (d.tipo !== "tarea" || !ES_CUENTA.test(String(d.asignadoA || ""))) return null;
    return { clase: "asignacion", titulo: d.cambioDe ? "Cambió tu asignación" : "Tienes una asignación nueva", cuerpo: `Para el ${fila.fecha || d.fecha || "día indicado"}. Ábrela para ver a qué vas.`, url: "/?ir=home", tag: `asig-${fila.fecha || d.fecha || ""}`, obligatorio: true, usuarios: [d.asignadoA], excluye: autor };
  }
  if (tabla === "incidencias") return { clase: "incidencia", titulo: "Se reportó una incidencia", cuerpo: "Ábrela para ver de qué se trata.", url: "/?ir=equipo", tag: "incidencias", obligatorio: false, roles: ["admin", "superadmin", "encargado"], excluye: autor };
  if (tabla === "solicitudes_compra") return { clase: "compra", titulo: "Hay una solicitud de compra por revisar", cuerpo: "Entra a Solicitudes para verla.", url: "/?ir=solicitudes", tag: "compras", obligatorio: false, roles: ["admin", "superadmin", "finanzas"], excluye: autor };
  if (tabla === "eventos") {
    if (fila.tipo === "prestamo_solicitud") return { clase: "autorizacion", titulo: "Hay un préstamo por autorizar", cuerpo: "Entra a Préstamos para revisarlo.", url: "/?ir=deudas", tag: "autorizar-prestamos", obligatorio: true, permiso: "autorizar_prestamos", excluye: autor };
    if (fila.tipo === "conversacion") { const ms = (d.datos?.miembros || []).map((m: any) => m.id).filter((id: string) => ES_CUENTA.test(String(id))); return ms.length ? { clase: "conversacion", titulo: "Te agregaron a una conversación", cuerpo: d.datos?.clase === "directa" ? "Una conversación directa" : `«${d.datos?.nombre || "Grupo"}»`, url: `/?ir=chat&conv=${encodeURIComponent(fila.id)}`, tag: `conv-${fila.id}`, obligatorio: false, usuarios: ms, excluye: autor } : null; }
  }
  return null;
}

export async function destinatarios(base: B, a: Aviso): Promise<string[]> {
  const ids = new Set<string>(a.usuarios || []);
  if (a.roles?.length) for (const p of await base.leer(`perfiles?rol=in.(${[...new Set(a.roles)].join(",")})&select=id`)) ids.add(p.id);
  if (a.permiso) {
    for (const p of await base.leer(`permisos_operacion?operacion=eq.${a.permiso}&revocado=is.null&select=usuario`)) ids.add(p.usuario);
    for (const p of await base.leer(`perfiles?rol=eq.superadmin&select=id`)) ids.add(p.id);
  }
  if (a.excluye) ids.delete(a.excluye);
  if (!ids.size) return [];
  // Sólo cuentas con perfil vigente, y respetando lo que cada quien silenció (menos lo obligatorio y las menciones).
  const lista = [...ids].join(",");
  const conPerfil = new Set((await base.leer(`perfiles?id=in.(${lista})&select=id`)).map((p) => p.id));
  const prefs = new Map((await base.leer(`avisos_preferencias?usuario=in.(${lista})&select=usuario,datos`)).map((p) => [p.usuario, p.datos || {}]));
  const mencionados = new Set<string>((a as any).mencionados || []);
  return [...ids].filter((id) => conPerfil.has(id) && (a.obligatorio || (mencionados.has(id) ? prefs.get(id)?.mencion !== false : prefs.get(id)?.[a.clase] !== false)));
}

export async function llaves(base: B, push: Push) {
  let k = (await base.leer("avisos_llaves?id=eq.unico&select=publica,privada,secreto"))[0] || null;
  if (k && !k.privada) {
    const n = push.generateVAPIDKeys();
    await base.escribir("avisos_llaves?id=eq.unico&privada=is.null", "PATCH", { publica: n.publicKey, privada: n.privateKey });
    k = (await base.leer("avisos_llaves?id=eq.unico&select=publica,privada,secreto"))[0] || null;
  }
  return k;
}

export async function mandar(base: B, push: Push, k: any, a: Aviso, usuarios: string[], llaveDeEnvio: string) {
  let enviados = 0, caducos = 0;
  for (const u of usuarios) {
    // El mismo aviso no se manda dos veces a la misma persona (la base puede llamar dos veces por un reintento).
    const nuevo = await base.escribir("avisos_enviados?on_conflict=llave", "POST", { llave: `${llaveDeEnvio}:${u}`, usuario: u }, "resolution=ignore-duplicates,return=representation");
    if (!nuevo.length && a.clase !== "prueba") continue;
    const esMencion = ((a as any).mencionados || []).includes(u);
    const cuerpo = JSON.stringify({ clase: esMencion ? "mencion" : a.clase, titulo: esMencion ? a.titulo.replace(" mandó ", " te mencionó en ") : a.titulo, cuerpo: a.cuerpo, url: a.url, tag: a.tag });
    for (const s of await base.leer(`avisos_suscripciones?usuario=eq.${u}&select=endpoint,p256dh,auth`)) {
      try {
        await push.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, cuerpo,
          { vapidDetails: { subject: "https://app.agroselectos.com", publicKey: k.publica, privateKey: k.privada }, TTL: 86400, urgency: a.obligatorio || esMencion ? "high" : "normal", topic: a.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined });
        enviados++;
      } catch (e: any) {
        // El aparato ya no existe (desinstalaron o quitaron el permiso): se olvida esa suscripción.
        if (e?.statusCode === 404 || e?.statusCode === 410) { caducos++; await base.escribir(`avisos_suscripciones?endpoint=eq.${encodeURIComponent(s.endpoint)}`, "DELETE", null, "return=minimal"); }
      }
    }
  }
  return { enviados, caducos };
}

// Lo que hace la función con un llamado. `quien` = la cuenta, si lo llamó una persona (el aviso de prueba).
export async function atender({ base, push, cuerpo, secreto, quien }: { base: B; push: Push; cuerpo: any; secreto: string | null; quien: string | null }) {
  const k = await llaves(base, push);
  if (!k?.privada) return { status: 503, cuerpo: { error: "sin_llaves" } };
  if (cuerpo?.prueba) {
    if (!quien) return { status: 401, cuerpo: { error: "sin_sesion" } };
    const a: Aviso = { clase: "prueba", titulo: "Aviso de prueba de AgroGestión", cuerpo: "Si lo ves con la app cerrada, los avisos funcionan en este teléfono.", url: "/?ir=chat", tag: "prueba", obligatorio: true };
    return { status: 200, cuerpo: await mandar(base, push, k, a, [quien], `prueba:${Date.now()}`) };
  }
  if (!secreto || secreto !== k.secreto) return { status: 401, cuerpo: { error: "no_autorizado" } };
  const tabla = String(cuerpo?.tabla || ""), id = String(cuerpo?.id || "");
  if (!["chat", "indicaciones", "incidencias", "solicitudes_compra", "eventos"].includes(tabla) || !id) return { status: 400, cuerpo: { error: "pedido_invalido" } };
  const fila = (await base.leer(`${tabla}?id=eq.${encodeURIComponent(id)}&select=*`))[0];
  const a = await avisoDe(base, tabla, fila);
  if (!a) return { status: 200, cuerpo: { enviados: 0, motivo: "de_esto_no_se_avisa" } };
  const usuarios = await destinatarios(base, a);
  return { status: 200, cuerpo: { ...(await mandar(base, push, k, a, usuarios, `${tabla}:${id}`)), destinatarios: usuarios.length } };
}
