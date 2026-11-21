"""El satélite para análisis, en navegador real, con una parcela INVENTADA y con imágenes DE MENTIRA (fabricadas por
pruebas/apoyo/recortes_falsos.mjs: no son de ningún lugar, y la prueba no toca la red ni el servicio de verdad).
Lo que se comprueba: que nada se pide hasta abrir «Satélite»; que la capa de análisis se distingue del fondo; que cada
fecha dice su nubosidad y cuánta parcela se usó; que la nube no cuenta ni se rellena; que la línea del tiempo sólo usa
lecturas completas; que comparar dice cuánto y no por qué; que se guarda el resumen y no la imagen; y que quien no es
administrador ve pero no guarda.
Uso:  npx vite --port 5173 &   →   LEAFLET=…/leaflet/dist python3 pruebas/satelite_navegador.py"""
import os, pathlib, sys, tempfile, subprocess, re
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
src = (aqui / "mapa_navegador.py").read_text(encoding="utf8").split("with sync_playwright() as p:")[0].replace("def abrir(b, pin, ancho=390):", "def abrir_viejo(b, pin, ancho=390):")
g = {"__file__": str(aqui / "mapa_navegador.py")}; exec(src, g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:800] if det else ""))
plano = lambda t: t.replace("\n", " | ")
DIST, de, ir, punto = g["DIST"], g["de"], g["ir"], g["punto"]
F = pathlib.Path(tempfile.mkdtemp())
subprocess.run(["node", str(aqui / "apoyo" / "recortes_falsos.mjs"), str(F)], check=True, capture_output=True, cwd=str(aqui.parent))
pedidos = {"catalogo": 0, "analisis": 0, "color": 0, "otros": []}
def abrir(b, pin):
    ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City")
    def ruta(r):
        u = r.request.url
        if "localhost" in u: return r.continue_()
        if "leaflet" in u and u.endswith(".js"): return r.fulfill(path=str(DIST / "leaflet.js"), content_type="application/javascript")
        if "leaflet" in u and u.endswith(".css"): return r.fulfill(path=str(DIST / "leaflet.css"), content_type="text/css")
        if "planetarycomputer.microsoft.com/api/stac/v1/search" in u: pedidos["catalogo"] += 1; return r.fulfill(path=str(F / "catalogo.json"), content_type="application/geo+json", headers={"access-control-allow-origin": "*"})
        if "planetarycomputer.microsoft.com/api/data/v1/item/crop.tif" in u:
            if r.request.method == "OPTIONS": return r.fulfill(status=204, headers={"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST"})
            item = re.search(r"item=([^&]+)", u).group(1); color = "assets=visual" in u; pedidos["color" if color else "analisis"] += 1
            return r.fulfill(path=str(F / f"{item}{'-color' if color else ''}.tif"), content_type="image/tiff", headers={"access-control-allow-origin": "*"})
        if "arcgis" not in u and "openstreetmap" not in u and "fonts" not in u: pedidos["otros"].append(u[:80])
        return r.abort()
    ctx.route("**/*", ruta)
    pg = ctx.new_page(); pg.errs = []
    pg.on("pageerror", lambda e: pg.errs.append(str(e))); pg.on("dialog", lambda x: x.accept())
    pg.clock.install(time="2026-11-21T09:00:00-06:00")
    return pg

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = abrir(b, "7391"); g["g"]["sembrar"](pg); g["g"]["entrar"](pg, "", "7391"); pg.wait_for_timeout(400); ir(pg, "mapa")
    pg.get_by_label("Parcelas sin límite").click(); pg.wait_for_timeout(300); pg.get_by_label("Trazar PARCELA UNO").click(); pg.wait_for_timeout(400)
    pg.evaluate("() => window.__agroMapa.setView([22.9005, -102.6995], 17, { animate: false })"); pg.wait_for_timeout(400)
    for q in ((22.9, -102.7), (22.9, -102.699), (22.901, -102.699), (22.901, -102.7)): punto(pg, *q)
    pg.locator(".mp-herramientas .btn-accent").click(); pg.wait_for_timeout(700)
    f = pg.locator(".mp-hoja").inner_text()
    caso("la ficha ofrece «Satélite» y todavía no se ha pedido ninguna imagen", pg.get_by_label("Ver el satélite de esta parcela").count() == 1 and pedidos["catalogo"] == 0 and pedidos["analisis"] == 0, pedidos)
    pg.get_by_label("Ver el satélite de esta parcela").click()
    pg.wait_for_function("() => document.querySelectorAll('.mp-fecha').length === 4 && !document.body.innerText.includes('Leyendo ') && document.querySelector('img.mp-pixelada')", timeout=30000); pg.wait_for_timeout(500)
    t = pg.locator(".mp-sat").inner_text(); arriba = pg.locator(".mp-arriba").inner_text()
    caso("el panel dice que es Sentinel-2, para análisis, y el tamaño del cuadro", "Sentinel-2 · imagen para análisis · cuadros de 10 m" in t, plano(t)[:200])
    caso("arriba se distingue la capa de análisis del fondo del mapa", "Encima: Sentinel-2 del 14/11/2026" in arriba and "para análisis" in arriba and "El fondo es otra imagen, sin fecha" in arriba, plano(arriba)[-260:])
    caso("abre en la fecha más reciente con lectura completa, con su hora, satélite y nubosidad", "14/11/2026, 11:27 h · Sentinel-2C" in t and "Nubes en toda la pasada: 0.4 %" in t, plano(t)[250:700])
    n = float(pg.locator(".mp-lectura-n b").inner_text())
    caso("el número sale de los cuadros de la parcela y dice cuántos se usaron", 0.74 < n < 0.83 and re.search(r"En la parcela se usaron (\d+) de \1 cuadros \(100 %\)", t) is not None, [n, re.findall(r"En la parcela[^.]*\.", t)])
    caso("la capa se pinta encima del mapa, en cuadros, sólo sobre la parcela", pg.locator("img.mp-pixelada").count() == 1 and pg.locator(".mp-escala").count() == 1)
    tira = [x.inner_text().replace("\n", " ") for x in pg.locator(".mp-fecha").all()]
    caso("cada fecha dice su estado: lectura, parcial o nube", tira[0].startswith("5 oct 0.2") and tira[1] == "20 oct nube" and tira[2] == "4 nov parcial" and tira[3].startswith("14 nov 0.7"), tira)
    caso("la línea del tiempo sólo usa las lecturas completas", "evolución en el ciclo (desde el 01/10/2026)" in t.lower() and "2 fecha(s) con lectura completa; 2 no entran a la línea" in t and pg.locator(".mp-grafica circle[r='11']").count() == 2, plano(t)[700:1100])
    ev = de(pg, "lectura_satelital"); d0 = ev[0]["datos"] if ev else {}
    caso("se guardó un resumen por pasada, sin la imagen", len(ev) == 4 and set(d0["indices"].keys()) == {"ndvi", "ndmi"} and d0["fuente"] == "planetary-computer" and d0["resolucionM"] == 10 and "valores" not in d0 and len(str(d0)) < 1200, {k: d0.get(k) for k in ("dia", "plataforma", "nubesEscena", "fuente")})
    caso("se pidió el catálogo y UN recorte por fecha (el modo de desarrollo monta la pantalla dos veces: el catálogo puede salir doble)", pedidos["catalogo"] <= 2 and pedidos["analisis"] == 4 and pedidos["color"] == 0 and not pedidos["otros"], pedidos)
    pg.get_by_label("Pasada del 20/10/2026").click(); pg.wait_for_timeout(500); t = pg.locator(".mp-sat").inner_text()
    caso("un día con nube no tiene número: ni cero ni el de la vez pasada", pg.locator(".mp-lectura-n b").inner_text() == "—" and "Nubes en toda la pasada: 96 %" in t and "Sin imagen útil ese día" in t and "se usaron 0 de" in t, plano(t)[250:650])
    pg.get_by_label("Pasada del 04/11/2026").click(); pg.wait_for_timeout(500); t = pg.locator(".mp-sat").inner_text()
    caso("una lectura parcial se dice, con cuántos cuadros quedaron tapados", "Lectura parcial: una parte de la parcela quedó tapada" in t and "con nube o sombra" in t, plano(t)[250:650])
    pg.get_by_label("Pasada del 14/11/2026").click(); pg.wait_for_timeout(300)
    pg.get_by_role("button", name="Comparar con otra fecha").click(); pg.get_by_label("Pasada del 05/10/2026").click(); pg.wait_for_timeout(400); t = pg.locator(".mp-sat").inner_text()
    caso("comparar dos fechas dice cuánto cambió y no por qué", "05/10/2026 → 14/11/2026" in t and re.search(r"Subió de 0\.2\d* a 0\.7\d* \(\+0\.5\d*\)\. El satélite dice que cambió, no por qué\.", t) is not None, re.findall(r"Subió[^|]*", plano(t)))
    pg.get_by_label("Pasada del 20/10/2026").click(); pg.wait_for_timeout(300)
    caso("contra un día sin lectura completa no se compara", "no tiene lectura completa: no se comparan" in pg.locator(".mp-sat").inner_text())
    pg.get_by_role("button", name="Dejar de comparar").click()
    caso("la advertencia está siempre a la vista: es un indicio, no un diagnóstico", "Es un indicio, no un diagnóstico" in t and "hay que ir a ver la parcela" in t and "Contiene datos Copernicus Sentinel modificados (2026)" in t)
    pg.get_by_role("button", name="Humedad").click(); pg.wait_for_timeout(500); t = pg.locator(".mp-sat").inner_text()
    caso("la humedad sale de las mismas pasadas, sin pedir nada más, y dice que es más gruesa", "NDMI promedio" in t and "Sale de bandas de 20 m" in t and pedidos["analisis"] == 4 and "Sentinel-2C" in t, plano(t)[150:420])
    pg.get_by_role("button", name="Color real").click(); pg.get_by_label("Pasada del 14/11/2026").click(); pg.wait_for_timeout(900)
    caso("el color real de esa pasada se pide aparte y sólo al escogerlo", pedidos["color"] >= 1 and "La foto de esa pasada, en color real" in pg.locator(".mp-sat").inner_text() and "color real" in pg.locator(".mp-arriba").inner_text(), pedidos)
    pg.get_by_role("button", name="Ver el fondo").click(); pg.wait_for_timeout(300)
    caso("se puede quitar la capa para ver el fondo", pg.locator("img.mp-pixelada").count() == 0)
    pg.get_by_label("Cerrar el satélite").click(); pg.wait_for_timeout(400)
    caso("al cerrar, la capa se quita y vuelve la ficha", pg.locator("img.mp-pixelada").count() == 0 and "Encima: Sentinel-2" not in pg.locator(".mp-arriba").inner_text() and pg.get_by_label("Ver el satélite de esta parcela").count() == 1)
    antes = dict(pedidos); pg.get_by_label("Ver el satélite de esta parcela").click(); pg.wait_for_function("() => document.querySelectorAll('.mp-fecha').length === 4 && document.querySelector('img.mp-pixelada')", timeout=20000); pg.wait_for_timeout(600)
    caso("al volver a abrir no se vuelve a leer lo ya guardado", len(de(pg, "lectura_satelital")) == 4 and "Leyendo" not in pg.locator(".mp-sat").inner_text() and float(pg.locator(".mp-lectura-n b").inner_text()) == n, [pedidos, antes])
    caso("el satélite no creó gastos, actividades ni cambió la parcela", pg.evaluate("() => [window.__agroDatos.egresos.length, window.__agroDatos.actividades.length, window.__agroDatos.parcelas.find(p => p.id === 'p1').hectareas]") == [1, 4, 1])
    caso("nada tronó", not g["g"]["trono"](pg) and not pg.errs, pg.errs[:2])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
