// ============================================================
//  AgroGestión — Service Worker (soporte offline)
//
//  Estrategia:
//  · App (HTML/JS/CSS propios): red primero → si no hay señal,
//    se sirve la copia guardada. Así siempre abres la app en
//    el campo, aunque no haya internet.
//  · Fuentes y librerías externas (Google Fonts, Leaflet):
//    caché primero — se descargan una vez y quedan guardadas.
//  · Los ICONOS no necesitan red nunca: van dibujados dentro
//    del propio código de la app (SVG).
// ============================================================
const CACHE_APP = "agrogestion-v3";
const CACHE_EXT = "agrogestion-ext-v2";
const PRECACHE = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];

// Lo que la app necesita para ARRANCAR (su código y su hoja de estilos) se guarda desde la instalación. Antes sólo se
// guardaba la portada: quien abría la app una sola vez con señal y luego se iba al campo encontraba la pantalla en blanco.
const piezasDe = (html) => [...new Set([...String(html).matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]))];
// El orden importa: primero las piezas y HASTA EL FINAL la portada. Si la señal se cae a media bajada de una versión
// nueva, la portada guardada sigue siendo la anterior, que tiene todas sus piezas: nunca queda una portada sin su código.
async function guardarLoNecesario(portada) {
  const c = await caches.open(CACHE_APP);
  try { await c.addAll(PRECACHE.filter((u) => u !== "/" && u !== "/index.html")); } catch { /* se reintenta en otra visita */ }
  try {
    const resp = portada || await fetch("/index.html", { cache: "no-store" });
    if (!resp || !resp.ok) return;
    const piezas = piezasDe(await resp.clone().text());
    await Promise.all(piezas.map((u) => c.match(u, { ignoreVary: true }).then((ya) => ya || c.add(u))));
    await c.put("/index.html", resp.clone()); await c.put("/", resp);
    // Las piezas de arranque de versiones anteriores ya no sirven: se quitan para no llenar el teléfono.
    for (const req of await c.keys()) { const ruta = new URL(req.url).pathname; if (/^\/assets\/index-/.test(ruta) && !piezas.includes(ruta)) await c.delete(req); }
  } catch { /* sin señal: lo guardado de antes se queda como estaba */ }
}
// Con señal mala, esperar a la red sin límite deja la app sin abrir: se le da un rato y, si no contesta, se usa lo guardado.
const conLimite = (promesa, ms) => new Promise((ok, mal) => { const t = setTimeout(() => mal(new Error("tardó")), ms); promesa.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); mal(e); }); });

self.addEventListener("install", (e) => {
  e.waitUntil(guardarLoNecesario().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_APP && k !== CACHE_EXT && k !== "agrogestion-aviso").map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Nunca interceptar Supabase (datos vivos; la app ya tiene su propia cola offline)
  if (url.hostname.endsWith("supabase.co")) return;

  // Externos (fuentes, leaflet): caché primero, luego red
  const esExterno = url.origin !== self.location.origin;
  if (esExterno) {
    e.respondWith(
      caches.open(CACHE_EXT).then(async (c) => {
        const hit = await c.match(request);
        if (hit) return hit;
        try {
          const resp = await fetch(request);
          if (resp && (resp.ok || resp.type === "opaque")) c.put(request, resp.clone());
          return resp;
        } catch {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // Navegación (abrir la app): red primero, pero sin esperar de más; si no hay señal o tarda, el index guardado.
  if (request.mode === "navigate") {
    e.respondWith((async () => {
      const red = fetch(request).then((resp) => {
        if (resp && resp.ok) guardarLoNecesario(resp.clone());
        return resp;
      });
      red.catch(() => {});
      const guardado = await caches.match("/index.html", { ignoreVary: true }) || await caches.match("/", { ignoreVary: true });
      try { return await (guardado ? conLimite(red, 4000) : red); } catch { return guardado || Response.error(); }
    })());
    return;
  }

  // Piezas del build (/assets/…): llevan su huella en el nombre y nunca cambian, así que lo guardado vale siempre.
  // Primero lo guardado; si no está, la red (y se guarda). Así abrir la app no depende de la señal.
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE_APP);
      // Sin fijarse en «Vary»: la misma pieza se pide con y sin encabezado de origen y es el mismo archivo.
      const hit = await c.match(url.pathname, { ignoreVary: true, ignoreSearch: true });
      if (hit) return hit;
      const resp = await fetch(request);
      if (resp && resp.ok) c.put(url.pathname, resp.clone());
      return resp;
    })());
    return;
  }

  // Lo demás propio (iconos, manifiesto): red primero con respaldo en caché
  e.respondWith(
    fetch(request)
      .then((resp) => {
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE_APP).then((c) => c.put(request, copia));
        }
        return resp;
      })
      .catch(() => caches.match(request))
  );
});

// ── Avisos al teléfono (con la app cerrada) ──────────────────────────────
// El aviso llega del servidor ya decidido (a quién y con qué palabras). Aquí sólo se enseña y, al tocarlo, se abre
// AgroGestión en el lugar correcto. El aviso NO trae el contenido: la app lo pide con la sesión de la persona, así
// que quien ya no tiene acceso no ve nada aunque conserve un aviso viejo.
self.addEventListener("push", (e) => {
  let a = {};
  try { a = e.data ? e.data.json() : {}; } catch { a = {}; }
  const titulo = a.titulo || "AgroGestión", tag = a.tag || "agrogestion";
  e.waitUntil((async () => {
    // Varios avisos de lo mismo (una conversación) se juntan en uno solo y se dice cuántos van.
    const previos = await self.registration.getNotifications({ tag });
    const cuantos = (previos[0] && previos[0].data && previos[0].data.cuantos ? previos[0].data.cuantos : 0) + 1;
    await self.registration.showNotification(titulo, {
      body: cuantos > 1 ? `${a.cuerpo || ""} · ${cuantos} avisos` : (a.cuerpo || ""),
      // Que suene y vibre cada vez (renotify), también cuando se junta con el anterior: en el teléfono real llegó mudo (21 nov).
      tag, renotify: true, silent: false, vibrate: [250, 120, 250], timestamp: Date.now(), icon: "/icon-192.png", badge: "/icon-192.png",
      data: { url: a.url || "/", clase: a.clase || "", cuantos },
    });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async () => {
    // Una ventana que quedó dormida en el fondo no siempre se deja traer al frente ni recibe el recado (teléfono real,
    // 21 nov: el aviso desapareció y no abrió nada). Por eso se la LLEVA a la dirección del aviso, y si no se puede
    // traer al frente, se abre una nueva.
    // Además se deja APUNTADO a dónde iba: la app lo lee al abrir o al volver al frente, llegue como llegue.
    try { await (await caches.open("agrogestion-aviso")).put("/__aviso_pendiente", new Response(JSON.stringify({ url, cuando: Date.now() }), { headers: { "Content-Type": "application/json" } })); } catch { /* sin almacén */ }
    const abiertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of abiertas) {
      if (new URL(c.url).origin !== self.location.origin) continue;
      try {
        if (c.visibilityState === "visible") { c.postMessage({ tipo: "abrir", url }); return await c.focus(); }
        const llevada = c.navigate ? await c.navigate(url).catch(() => null) : null;
        if (llevada) return await llevada.focus();
      } catch { /* no se dejó: se abre una nueva */ }
      break;
    }
    return self.clients.openWindow(url);
  })());
});
