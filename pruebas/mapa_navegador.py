"""El mapa del rancho, en navegador real, con un rancho INVENTADO (coordenadas de un lugar cualquiera de Zacatecas;
no son parcelas de nadie). Lo que se comprueba: que una parcela sin límite no se dibuja; que el límite se traza
tocando la imagen y la superficie se mide; que un trazo en forma de moño no se guarda; que la ficha enseña lo que el
sistema ya sabe del ciclo vigente; que la superficie capturada no cambia sola; que un KML se importa diciendo de qué
parcela es cada figura; y que quien no es administrador ve, pero no traza.
La librería del mapa se sirve de una copia local (LEAFLET=/carpeta/con/leaflet/dist) y las imágenes de fondo se cortan:
aquí se prueba la app, no al proveedor de imágenes.
Uso:  npx vite --port 5173 &   →   LEAFLET=…/node_modules/leaflet/dist python3 pruebas/mapa_navegador.py"""
import os, pathlib, sys, tempfile, json
from playwright.sync_api import sync_playwright
aqui = pathlib.Path(__file__).parent
g = {"__file__": str(aqui / "recorrido_navegador.py")}
exec((aqui / "recorrido_navegador.py").read_text(encoding="utf8").split("with sync_playwright()")[0], g)
res = []
def caso(n, ok, det=""): res.append(ok); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:700] if det else ""))
plano = lambda t: t.replace("\n", " | ")
DIST = pathlib.Path(os.environ.get("LEAFLET", ""))
if not (DIST / "leaflet.js").exists(): print("Falta LEAFLET=/ruta/a/leaflet/dist"); sys.exit(2)
LEER = """() => new Promise((ok) => { const r = indexedDB.open('agro_eventos_v8:local', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('eventos', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
  r.onsuccess = () => { const q = r.result.transaction('eventos').objectStore('eventos').getAll(); q.onsuccess = () => { r.result.close(); ok(q.result); }; q.onerror = () => ok([]); };
  r.onerror = () => ok([]); })"""
de = lambda pg, tipo: sorted([e for e in pg.evaluate(LEER) if e["tipo"] == tipo], key=lambda e: e["capturado"])
def ir(pg, pagina): pg.evaluate("p => window.__agroIr(p)", pagina); pg.wait_for_timeout(900)
g["SEMILLA"].update({
    "ranchos": [{"id": "r1", "nombre": "RANCHO INVENTADO", "hectareas": 20, "lat": 22.9, "lng": -102.7}],
    "parcelas": [{"id": "p1", "nombre": "PARCELA UNO", "ranchoId": "r1", "hectareas": 1, "cultivo": "Ajo", "emoji": "🌾"},
                 {"id": "p2", "nombre": "PARCELA DOS", "ranchoId": "r1", "hectareas": 3, "cultivo": "", "emoji": "🌾", "lat": 22.903, "lng": -102.7}],
    "siembras": [{"id": "s1", "parcelaId": "p1", "cultivoNombre": "Ajo", "variedadNombre": "Morado", "fechaSiembra": "2026-10-01", "superficie": 1}],
    "actividades": [{"id": "a1", "parcelaId": "p1", "fecha": "2026-10-05", "tipo": "Riego", "costoTotal": 300}, {"id": "a2", "parcelaId": "p1", "fecha": "2026-11-02", "tipo": "Riego", "costoTotal": 320},
                    {"id": "a3", "parcelaId": "p1", "fecha": "2026-10-20", "tipo": "Fertilización", "costoTotal": 900}, {"id": "a0", "parcelaId": "p1", "fecha": "2026-05-01", "tipo": "Riego", "costoTotal": 999}],
    "egresos": [{"id": "e1", "parcelaId": "p1", "fecha": "2026-10-15", "monto": 1200, "concepto": "gasto de prueba", "categoria": "otros"}],
})
def punto(pg, lat, lng):
    xy = pg.evaluate("([a, b]) => { const p = window.__agroMapa.latLngToContainerPoint([a, b]), r = window.__agroMapa.getContainer().getBoundingClientRect(); return [r.left + p.x, r.top + p.y]; }", [lat, lng])
    pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(180)
def abrir(b, pin, ancho=390):
    ctx = b.new_context(viewport={"width": ancho, "height": 820}, timezone_id="America/Mexico_City")
    def ruta(r):
        u = r.request.url
        if "localhost" in u: return r.continue_()
        if "leaflet" in u and u.endswith(".js"): return r.fulfill(path=str(DIST / "leaflet.js"), content_type="application/javascript")
        if "leaflet" in u and u.endswith(".css"): return r.fulfill(path=str(DIST / "leaflet.css"), content_type="text/css")
        return r.abort()
    ctx.route("**/*", ruta)
    pg = ctx.new_page(); pg.errs = []
    pg.on("pageerror", lambda e: pg.errs.append(str(e))); pg.on("dialog", lambda x: x.accept())
    pg.clock.install(time="2026-11-21T09:00:00-06:00")
    g["sembrar"](pg); g["entrar"](pg, "", pin); pg.wait_for_timeout(400)
    return pg

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = abrir(b, "7391"); ir(pg, "mapa")
    t = pg.locator(".mp-pagina").inner_text()
    caso("el mapa abre y dice cuántas parcelas tienen límite: ninguna, y no dibuja ninguna", "Mapa del rancho" in t and "0 de 2 parcelas con límite" in t and pg.locator(".mp-pagina path.leaflet-interactive").count() == 1, plano(t)[:300])
    caso("la parcela que sólo tiene un punto sale como punto «sin límite», no como un cuadro", "PARCELA DOS · sin límite" in pg.locator(".mp-pagina").inner_html())
    pg.get_by_label("Parcelas sin límite").click(); pg.wait_for_timeout(300); t = pg.locator(".mp-hoja").inner_text()
    caso("lo que falta se dice: la app no supone forma ni tamaño", "la app no supone su forma ni su tamaño" in t and "PARCELA UNO" in t and "1 ha capturadas" in t, plano(t)[:400])
    pg.get_by_label("Trazar PARCELA UNO").click(); pg.wait_for_timeout(500)
    pg.evaluate("() => window.__agroMapa.setView([22.9005, -102.6995], 17, { animate: false })"); pg.wait_for_timeout(400)
    A, B, C, D = (22.9, -102.7), (22.9, -102.699), (22.901, -102.699), (22.901, -102.7)
    punto(pg, *A); punto(pg, *C); punto(pg, *B); punto(pg, *D)
    t = pg.locator(".mp-arriba").inner_text()
    caso("un trazo en forma de moño se dice y no se puede guardar", "se cruza consigo mismo" in t and pg.get_by_role("button", name="Guardar").is_disabled(), plano(t)[:300])
    for _ in range(4): pg.get_by_role("button", name="Deshacer").click(); pg.wait_for_timeout(80)
    for q in (A, B, C, D): punto(pg, *q)
    t = pg.locator(".mp-arriba").inner_text(); bt = pg.locator(".mp-herramientas .btn-accent").inner_text()
    caso("al trazar se va midiendo la superficie", "4 esquinas" in t and "1.14 ha" in t and "Guardar · 1.14 ha" in bt, plano(t)[:260] + " / " + bt)
    caso("todavía no se guardó nada", len(de(pg, "limite_geo")) == 0)
    pg.locator(".mp-herramientas .btn-accent").click(); pg.wait_for_timeout(700)
    ev = de(pg, "limite_geo"); d = ev[0]["datos"] if ev else {}
    caso("guardar deja un evento con el contorno, de dónde salió y la superficie medida", len(ev) == 1 and d["de"] == {"tipo": "parcela", "id": "p1"} and d["fuente"] == "dibujado" and len(d["anillo"]) == 4 and 11250 < d["m2"] < 11500, {k: v for k, v in d.items() if k != "anillo"})
    t = pg.locator(".mp-pagina").inner_text(); f = pg.locator(".mp-hoja").inner_text()
    caso("el mapa ya cuenta una parcela con límite y sus hectáreas medidas", "1 de 2 parcelas con límite" in t and "ha medidas" in t, plano(t)[:200])
    caso("la ficha enseña cultivo y ciclo vigente, y sólo lo de ese ciclo", "PARCELA UNO" in f and "RANCHO INVENTADO" in f and "Ajo" in f and "Morado" in f and "Ciclo vigente desde el 01/10/2026" in f and "Riegos\n2" in f and "último 02/11/2026" in f and "Fertilizaciones\n1" in f and "Actividades\n3" in f, plano(f)[:900])
    caso("lo que no hay se dice «sin registros», y el dinero sale de lo ya registrado", "Aplicaciones\nSin registros" in f and "$1,520" in f and "$1,200" in f, plano(f)[300:900])
    caso("la superficie capturada y la medida se enseñan las dos: no cambia sola", "La parcela dice 1 ha y el límite mide 1.14 ha" in f and pg.evaluate("() => window.__agroDatos.parcelas.find(p => p.id === 'p1').hectareas") == 1, plano(f)[200:520])
    pg.get_by_role("button", name="Usar la medida del mapa").click(); pg.wait_for_timeout(400)
    pp = pg.evaluate("() => window.__agroDatos.parcelas.find(p => p.id === 'p1')")
    caso("usar la medida del mapa es una decisión de la persona, y queda de dónde salió y cuánto decía antes", pp["hectareas"] == 1.14 and pp["superficieDe"] == "medida en el mapa" and pp["superficieAntes"] == 1 and "poligono" not in pp, {k: pp.get(k) for k in ("hectareas", "superficieDe", "superficieAntes")})
    # corregir: el trazo anterior se conserva
    pg.get_by_role("button", name="Corregir límite").click(); pg.wait_for_timeout(500)
    pg.evaluate("() => window.__agroMapa.setView([22.9005, -102.6995], 17, { animate: false })"); pg.wait_for_timeout(300)
    punto(pg, 22.9005, -102.7005); pg.wait_for_timeout(200)
    pg.locator(".mp-herramientas .btn-accent").click(); pg.wait_for_timeout(600)
    ev = de(pg, "limite_geo"); f = pg.locator(".mp-hoja").inner_text()
    caso("corregir un límite es otro evento y el anterior queda guardado", len(ev) == 2 and len(ev[1]["datos"]["anillo"]) == 5 and "1 trazo(s) anterior(es) guardados" in f, plano(f)[-420:])
    # quitar pide motivo
    pg.get_by_role("button", name="Quitar límite").click(); pg.get_by_role("button", name="Quitar", exact=True).click(); pg.wait_for_timeout(300)
    caso("quitar un límite sin decir por qué no se hace", "Falta decir por qué se quita" in pg.locator(".mp-arriba").inner_text() and len(de(pg, "limite_geo")) == 2)
    pg.get_by_label("Cerrar la ficha").click(); pg.wait_for_timeout(200)
    # importar un KML: nada entra hasta decir de qué parcela es
    d = pathlib.Path(tempfile.mkdtemp())
    (d / "ranchos.kml").write_text("""<?xml version="1.0"?><kml><Document>
      <Placemark><name>Parcela dos</name><Polygon><outerBoundaryIs><LinearRing><coordinates>-102.7,22.902,0 -102.698,22.902,0 -102.698,22.904,0 -102.7,22.904,0 -102.7,22.902,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
      <Placemark><name>Lote sin nombre conocido</name><Polygon><outerBoundaryIs><LinearRing><coordinates>-102.71,22.91,0 -102.709,22.91,0 -102.709,22.911,0 -102.71,22.911,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
      <Placemark><name>Pozo</name><Point><coordinates>-102.7,22.9,0</coordinates></Point></Placemark></Document></kml>""", encoding="utf8")
    pg.get_by_label("Capas del mapa").click(); pg.wait_for_timeout(300)
    caso("las capas avisan que la imagen de fondo no es de hoy", "no dice cómo está hoy el cultivo" in pg.locator(".mp-hoja").inner_text())
    pg.get_by_label("Archivo con límites").set_input_files(str(d / "ranchos.kml")); pg.wait_for_timeout(700)
    f = pg.locator(".mp-hoja").inner_text()
    caso("el archivo se lee en el aparato: figuras con su medida, y lo que no es polígono se dice", "ranchos.kml" in f and "2 figura(s)" in f and "4.54 ha medidas" in f and "1 marca(s) del archivo son puntos o rutas" in f and "se llama igual que una parcela: confirma" in f, plano(f)[:700])
    caso("la figura que se llama igual llega sugerida; la otra, sin parcela; nada guardado aún", pg.get_by_label("Parcela de la figura 1").input_value() == "parcela:p2" and pg.get_by_label("Parcela de la figura 2").input_value() == "" and len(de(pg, "limite_geo")) == 2)
    pg.get_by_role("button", name="Guardar 1 límite(s)").click(); pg.wait_for_timeout(700)
    ev = de(pg, "limite_geo"); u = ev[-1]["datos"]
    caso("se guarda sólo lo que la persona asignó, con el nombre del archivo", len(ev) == 3 and u["de"]["id"] == "p2" and u["fuente"] == "archivo" and u["archivo"] == "ranchos.kml", {k: v for k, v in u.items() if k != "anillo"})
    caso("el mapa ya tiene las dos parcelas", "2 de 2 parcelas con límite" in pg.locator(".mp-pagina").inner_text())
    caso("el mapa no creó gastos, actividades ni pagos", pg.evaluate("() => [window.__agroDatos.egresos.length, window.__agroDatos.actividades.length, (window.__agroDatos.eventos || []).filter(e => e.tipo !== 'limite_geo').length]") == [1, 4, 0])
    caso("nada tronó (administrador)", not g["trono"](pg) and not pg.errs, pg.errs[:2])
    # el encargado ve y no traza
    pg2 = abrir(b, "5501"); pg2.evaluate("s => { const k = 'agro_v8:local', d = JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(d)); }", ""); ir(pg2, "mapa")
    t = pg2.locator(".mp-pagina").inner_text()
    pg2.get_by_label("Parcelas sin límite").click(); pg2.wait_for_timeout(300); h = pg2.locator(".mp-hoja").inner_text()
    caso("el encargado ve el mapa pero no traza límites ni ve dinero", "Mapa del rancho" in t and pg2.get_by_role("button", name="Trazar").count() == 0 and "Los traza un administrador" in h and not pg2.errs, plano(h)[:300])
    b.close()
print(f"\n{sum(res)}/{len(res)} pasan"); sys.exit(0 if all(res) else 1)
