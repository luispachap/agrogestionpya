"""Mensajes como app de mensajería, en pantalla de teléfono (Pixel 7), con gente y mensajes INVENTADOS.
Lo que se comprueba es lo que se siente al usarla: abre en lo más reciente, la barra de escribir no se pierde
(tampoco cuando el teclado encoge la pantalla), el historial sube, lo nuevo se marca, el botón «atrás» regresa a la
lista, y se puede grabar un audio y mandar una foto y un documento. El teclado se imita encogiendo la pantalla: el
teclado de verdad sólo se prueba en un teléfono.
Uso:  npx vite --port 5173 &   →   python3 pruebas/mensajes_movil.py   (FOTOS=carpeta guarda capturas)"""
import pathlib, sys, os, base64, datetime
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:500] if det else ""))
ahora = datetime.datetime.now(datetime.timezone.utc)
otro = {"id": "otro1", "nombre": "MIGUEL INVENTADO", "rol": "admin"}
viejos = [{"id": f"v{i}", "de": otro, "deQuien": otro["nombre"], "cuando": (ahora - datetime.timedelta(hours=60 - i)).isoformat().replace("+00:00", "Z"), "texto": f"Mensaje inventado número {i}", "propuestas": [], "tipo": "texto", "estado": "platica", "platica": True, "canal": "chat", "fecha": "2026-01-01"} for i in range(1, 41)]
g["SEMILLA"].update({"chat": viejos})
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAS0lEQVR4nO3PQQ0AIBDAsAP/nuGNAvZoFSzZOjPzsX0HvDXQGmgNtAZaA62B1kBroDXQGmgNtAZaA62B1kBroDXQGmgNtAZaA60LqfABf0n3FPkAAAAASUVORK5CYII=")
fotos = os.environ.get("FOTOS")
def foto(pg, n):
    if fotos: pg.screenshot(path=f"{fotos}/{n}.png")
caja = lambda pg, sel: pg.locator(sel).last.bounding_box()
def entrar_como(pg, pin):
    pg.evaluate("() => { for (const k of Object.keys(localStorage)) if (/sesion/i.test(k)) localStorage.removeItem(k); }")
    pg.reload(); pg.wait_for_timeout(1200); g["entrar"](pg, "", pin); pg.wait_for_timeout(500)
    pg.evaluate("p => window.__agroIr(p)", "chat"); pg.wait_for_timeout(500)
def manda(pg, texto):
    pg.get_by_label("Mensaje", exact=True).fill(texto); pg.get_by_role("button", name="Mandar").click(); pg.wait_for_timeout(600)

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"])
    ctx = b.new_context(**p.devices["Pixel 7"], timezone_id="America/Mexico_City", permissions=["microphone"])
    pedidos = []
    ctx.route("**/*", lambda r: (pedidos.append(r.request.url), r.continue_() if "localhost" in r.request.url else r.abort())[1])
    pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:300])); pg.on("dialog", lambda x: x.accept("no aplica"))
    g["sembrar"](pg); g["entrar"](pg, "Encargado", "5501"); pg.wait_for_timeout(400)
    pg.evaluate("p => window.__agroIr(p)", "chat"); pg.wait_for_timeout(500)
    alto = pg.viewport_size["height"]; foto(pg, "1-lista")

    # ── La lista ──
    fila = pg.locator(".msj-conv", has_text="General del rancho")
    caso("la lista enseña cada conversación con su último mensaje, su hora y los no leídos", "Mensaje inventado número 40" in fila.inner_text() and fila.locator(".msj-nuevos").inner_text() == "40", fila.inner_text())
    fila.click(); pg.wait_for_timeout(600); foto(pg, "2-conversacion")

    # ── Abrir: lo reciente a la vista, la barra abajo ──
    ult = caja(pg, ".msj-burbuja"); barra = caja(pg, ".msj-barra"); cab = caja(pg, ".msj-cabeza")
    caso("al abrir se ve el mensaje más reciente sin tener que bajar", "número 40" in pg.locator(".msj-burbuja").last.inner_text() and ult["y"] > cab["y"] + cab["height"] and ult["y"] + ult["height"] <= barra["y"] + 1, (ult, barra))
    caso("la barra de escribir está pegada abajo y el encabezado arriba", abs(barra["y"] + barra["height"] - alto) <= 1 and cab["y"] <= 1 and "General del rancho" in pg.locator(".msj-cabeza").inner_text(), (barra, alto))
    caso("la barra trae adjuntar, cámara y audio; el botón de mandar aparece al escribir", all(pg.get_by_role("button", name=n).count() == 1 for n in ["Adjuntar", "Cámara", "Grabar audio"]) and pg.get_by_role("button", name="Mandar").count() == 0)
    r = pg.locator(".msj-renglon")
    caso("lo recibido va a la izquierda y los mensajes van del más viejo al más nuevo", "mio" not in (r.last.get_attribute("class") or "") and pg.locator(".msj-burbuja").first.inner_text().find("número 1") >= 0)
    caso("los días se separan con su etiqueta (Hoy, Ayer o la fecha)", pg.locator(".msj-dia").count() >= 2 and any(x in pg.locator(".msj-dia").last.inner_text() for x in ["Hoy", "Ayer"]), pg.locator(".msj-dia").all_inner_texts())

    # ── Escribir y el teclado ──
    manda(pg, "Va uno mío para ver de qué lado queda"); foto(pg, "3-enviado")
    mio = pg.locator(".msj-renglon").last; mb = caja(pg, ".msj-burbuja")
    caso("lo enviado queda a la derecha, al final, con su hora", "mio" in mio.get_attribute("class") and mb["x"] + mb["width"] > pg.viewport_size["width"] * 0.9 and pg.locator(".msj-pie").last.inner_text().strip() != "")
    pg.get_by_label("Mensaje", exact=True).click(); pg.set_viewport_size({"width": pg.viewport_size["width"], "height": 430}); pg.wait_for_timeout(500); foto(pg, "4-teclado")
    barra = caja(pg, ".msj-barra"); ult = caja(pg, ".msj-burbuja")
    caso("con el teclado afuera (pantalla encogida) la barra sigue visible y el último mensaje también", barra["y"] + barra["height"] <= 431 and barra["y"] > 300 and ult["y"] + ult["height"] <= barra["y"] + 1 and ult["y"] > 0, (barra, ult))
    pg.get_by_label("Mensaje", exact=True).fill("uno\ndos\ntres\ncuatro\ncinco\nseis\nsiete\nocho"); pg.wait_for_timeout(200)
    h = caja(pg, ".msj-caja")["height"]; barra = caja(pg, ".msj-barra")
    caso("un mensaje largo hace crecer la caja, pero no se come la pantalla", 60 < h <= 122 and barra["y"] + barra["height"] <= 431, h)
    pg.get_by_label("Mensaje", exact=True).fill(""); pg.set_viewport_size({"width": pg.viewport_size["width"], "height": alto}); pg.wait_for_timeout(400)

    # ── El historial ──
    pg.locator(".msj-hilo").evaluate("el => { el.scrollTop = 0; }"); pg.wait_for_timeout(300)
    caso("se sube al historial y aparece el botón para volver a lo reciente", pg.get_by_role("button", name="Ir a lo más reciente").count() == 1 and caja(pg, ".msj-barra")["y"] + caja(pg, ".msj-barra")["height"] <= alto + 1)
    pg.get_by_role("button", name="Ir a lo más reciente").click(); pg.wait_for_timeout(300)
    ult = caja(pg, ".msj-burbuja")
    caso("y con un toque regresa al final", ult["y"] + ult["height"] <= caja(pg, ".msj-barra")["y"] + 1 and pg.get_by_role("button", name="Ir a lo más reciente").count() == 0)

    # ── Audio ──
    pg.get_by_role("button", name="Grabar audio").click(); pg.wait_for_timeout(1600); foto(pg, "5-grabando")
    caso("al grabar se ve que está grabando, con su tiempo, y se puede cancelar o terminar", "Grabando 0:01" in pg.locator(".msj-grabando").inner_text() and pg.get_by_role("button", name="Cancelar la grabación").count() == 1, pg.locator(".msj-barra").inner_text())
    pg.get_by_role("button", name="Terminar de grabar").click(); pg.wait_for_timeout(700)
    caso("al terminar, el audio queda listo para oírse antes de mandarlo", pg.locator(".msj-prev audio").count() == 1 and pg.get_by_role("button", name="Quitar el audio").count() == 1)
    pg.get_by_role("button", name="Mandar").click(); pg.wait_for_timeout(900)
    caso("el audio mandado se reproduce dentro de la conversación", pg.locator(".msj-burbuja").last.locator("audio").count() == 1 and pg.locator(".msj-prev").count() == 0, pg.locator(".msj-burbuja").last.inner_html()[:200])
    pg.get_by_role("button", name="Grabar audio").click(); pg.wait_for_timeout(700); pg.get_by_role("button", name="Cancelar la grabación").click(); pg.wait_for_timeout(500)
    caso("una grabación cancelada no deja nada pegado", pg.locator(".msj-prev").count() == 0 and pg.locator(".msj-grabando").count() == 0)

    # ── Foto y documento ──
    pg.get_by_role("button", name="Adjuntar").click(); pg.wait_for_timeout(200); foto(pg, "6-adjuntar")
    caso("adjuntar ofrece foto o documento", "Foto o imagen" in pg.locator(".msj-adj").inner_text() and "Documento" in pg.locator(".msj-adj").inner_text())
    pg.get_by_label("Adjuntar foto").set_input_files({"name": "ticket.png", "mimeType": "image/png", "buffer": PNG}); pg.wait_for_timeout(400)
    caso("la foto escogida se ve antes de mandarla", pg.locator(".msj-prev img").count() == 1)
    pg.get_by_role("button", name="Mandar").click(); pg.wait_for_timeout(2500)
    caso("la foto queda dentro de la conversación", pg.locator(".msj-burbuja").last.locator("img.msj-img").count() == 1)
    caso("mandar una foto NO llama a ninguna lectura con IA: sólo ofrece leerla", not any("leer-papel" in u or "anthropic" in u for u in pedidos) and pg.locator(".msj-burbuja").last.get_by_role("button", name="Leer este papel con IA (lectura pagada)").count() == 1, [u for u in pedidos if "functions" in u])
    pg.locator("img.msj-img").last.click(); pg.wait_for_timeout(300); foto(pg, "7-foto")
    caso("al tocarla se abre en grande, y se cierra", pg.locator(".msj-visor img").count() == 1)
    pg.get_by_role("button", name="Cerrar la foto").click(); pg.wait_for_timeout(200)
    pg.get_by_label("Adjuntar documento").set_input_files({"name": "lista de precios.csv", "mimeType": "text/csv", "buffer": b"producto,precio\nclavos,20\n"}); pg.wait_for_timeout(300)
    pg.get_by_role("button", name="Mandar").click(); pg.wait_for_timeout(900)
    caso("el documento queda en la conversación con su nombre, para abrirlo", "lista de precios.csv" in pg.locator(".msj-burbuja").last.locator(".msj-doc").inner_text())
    ult = caja(pg, ".msj-burbuja")
    caso("después de mandar varias cosas se sigue viendo lo último", ult["y"] + ult["height"] <= caja(pg, ".msj-barra")["y"] + 1, ult)
    foto(pg, "8-adjuntos")

    # ── Lo institucional, sin estorbar ──
    caso("en la conversación no hay letreros administrativos fijos: sólo encabezado, mensajes y barra", pg.locator(".msj-pantalla .tabs-row").count() == 0 and pg.locator(".msj-pantalla .msj-aviso").count() == 0)
    pg.get_by_role("button", name="Opciones").click(); pg.wait_for_timeout(200); t = pg.locator(".msj-menu").inner_text(); foto(pg, "9-opciones")
    caso("las opciones llevan a lo por confirmar, lo de hoy, integrantes, avisos y reglas", all(x in t for x in ["Por confirmar", "Lo de hoy", "Integrantes", "Avisos", "Reglas"]), t)
    pg.get_by_role("button", name="Integrantes e información").click(); pg.wait_for_timeout(200)
    caso("la información dice que es institucional y cómo hablarle a AgroGestión", "institucional" in pg.locator(".msj-info").inner_text() and "«Agro,»" in pg.locator(".msj-info").inner_text())
    pg.go_back(); pg.wait_for_timeout(300)
    caso("el botón atrás del teléfono cierra primero lo que está encima", pg.locator(".msj-info").count() == 0 and pg.locator(".msj-pantalla").count() == 1)
    manda(pg, "Compramos tres kilos de clavos."); foto(pg, "10-propuesta")
    bur = pg.locator(".msj-burbuja", has_text="Compramos tres kilos").first
    caso("una propuesta va plegada dentro del mensaje, con su pregunta a la vista", bur.locator(".msj-prop-chip").count() == 1 and "AgroGestión pregunta" in bur.inner_text() and bur.get_by_role("button", name="No").count() == 0, bur.inner_text())
    bur.locator(".msj-prop-chip").click(); pg.wait_for_timeout(200); foto(pg, "11-propuesta-abierta")
    caso("y se despliega al tocarla", bur.get_by_role("button", name="No").count() == 1 and pg.locator(".msj-pend").count() == 1)
    pg.go_back(); pg.wait_for_timeout(400)
    caso("el botón atrás del teléfono regresa a la lista de conversaciones, no al inicio", pg.locator(".msj-pantalla").count() == 0 and pg.locator(".msj-lista").count() == 1 and pg.locator(".msj-conv", has_text="General del rancho").locator(".msj-nuevos").count() == 0)

    # ── Mensajes nuevos de otra persona ──
    entrar_como(pg, "7391")
    pg.locator(".msj-conv", has_text="General del rancho").click(); pg.wait_for_timeout(400)
    manda(pg, "Llegó el camión de la composta"); manda(pg, "Lo recibió el velador")
    entrar_como(pg, "5501")
    fila = pg.locator(".msj-conv", has_text="General del rancho")
    caso("lo que escribió otra persona sale como no leído en la lista", fila.locator(".msj-nuevos").inner_text() == "2" and "velador" in fila.inner_text(), fila.inner_text())
    fila.click(); pg.wait_for_timeout(600); foto(pg, "12-nuevos")
    caso("al abrir, una raya dice cuántos mensajes nuevos hay y se ven", "2 mensajes nuevos" in pg.locator(".msj-corte").inner_text() and caja(pg, ".msj-burbuja")["y"] + caja(pg, ".msj-burbuja")["height"] <= caja(pg, ".msj-barra")["y"] + 1)
    caso("en un grupo cada mensaje recibido dice de quién es", "Administrador" in pg.locator(".msj-quien").last.inner_text(), pg.locator(".msj-quien").last.inner_text())
    if fotos:
        pg.evaluate("() => document.documentElement.setAttribute('data-tema', 'claro')"); pg.wait_for_timeout(200); foto(pg, "13-claro")
    caso("ninguna pantalla tronó", not errs and not g["trono"](pg), errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)}"); sys.exit(0 if all(res) else 1)
