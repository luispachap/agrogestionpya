"""AUDITORÍA FUNCIONAL · MAPA DEL RANCHO y DRON con cuentas y dos teléfonos: el administrador traza el límite de una
parcela (la superficie se mide; la capturada no cambia sola); el dron sube fotos con GPS que caen dentro de ese límite y se
ubican solas (la que no trae GPS no se adivina); se anota qué se vio; en otro teléfono el agrónomo ve el límite y el vuelo,
pero no traza. La librería del mapa se sirve de una copia local y las imágenes de fondo se cortan.
Uso:  VITE_SUPABASE_URL=http://localhost:5199 VITE_SUPABASE_ANON_KEY=prueba npx vite --port 5174 &
      LEAFLET=…/node_modules/leaflet/dist python3 pruebas/auditoria_mapa_navegador.py   (FOTOS=/ruta para capturas)"""
import io, os, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "apoyo")); import nube_entera as N
from playwright.sync_api import sync_playwright
URL = "http://localhost:5174/"; HOY = "2026-11-21"
FOTOS = os.environ.get("FOTOS"); VER = os.environ.get("VER")
DIST = pathlib.Path(os.environ.get("LEAFLET", ""))
if not (DIST / "leaflet.js").exists(): print("Falta LEAFLET=/ruta/a/leaflet/dist"); sys.exit(2)
res = []
def caso(n, ok, det=""): res.append(bool(ok)); print(("PASA  " if ok else "FALLA ") + n + (" — " + str(det)[:900] if det and (not ok or VER) else ""), flush=True)
plano = lambda t: t.replace("\n", " | ")
ADM = N.cuenta(1, "admin@prueba.invalid", "ADMIN DE PRUEBA", "superadmin"); AGR = N.cuenta(3, "agronomo@prueba.invalid", "AGRONOMO DE PRUEBA", "agronomo")
nube = N.Nube([ADM, AGR]); E = {"_espacio": "localhost"}; V = "2026-11-01T00:00:00Z"; t = nube.t
t["ranchos"] = {"r1": {"id": "r1", "nombre": "RANCHO INVENTADO", "datos": {"hectareas": 20, "lat": 22.9, "lng": -102.7, **E}, "actualizado": V}}
t["parcelas"] = {"p1": {"id": "p1", "nombre": "PARCELA UNO", "rancho_id": "r1", "cultivo": "Ajo", "datos": {"hectareas": 1, "emoji": "🌾", **E}, "actualizado": V},
                 "p2": {"id": "p2", "nombre": "PARCELA DOS", "rancho_id": "r1", "cultivo": "", "datos": {"hectareas": 3, "emoji": "🌾", "lat": 22.903, "lng": -102.7, **E}, "actualizado": V}}
# Fotos de dron inventadas: dos con GPS dentro de la parcela uno y una sin GPS.
from PIL import Image
import piexif
def jpeg(lat=None, lng=None, fecha="2026:11:20 10:00:00"):
    import random; random.seed(int(abs(lat or 1) * 1e4)); im = Image.frombytes("RGB", (600, 450), bytes(random.randrange(256) for _ in range(600 * 450 * 3))); buf = io.BytesIO()   # con ruido: pesa como una foto de verdad
    ex = {"0th": {}, "Exif": {piexif.ExifIFD.DateTimeOriginal: fecha.encode()}, "GPS": {}}
    if lat is not None:
        dms = lambda v: ((int(abs(v)), 1), (int((abs(v) % 1) * 60), 1), (int(round(((abs(v) * 60) % 1) * 60 * 1000)), 1000))
        ex["GPS"] = {piexif.GPSIFD.GPSLatitudeRef: b"N" if lat >= 0 else b"S", piexif.GPSIFD.GPSLatitude: dms(lat), piexif.GPSIFD.GPSLongitudeRef: b"E" if lng >= 0 else b"W", piexif.GPSIFD.GPSLongitude: dms(lng)}
    im.save(buf, "jpeg", exif=piexif.dump(ex)); return buf.getvalue()
ir = lambda pg, p: (pg.evaluate("p => window.__agroIr(p)", "home"), pg.wait_for_timeout(250), pg.evaluate("p => window.__agroIr(p)", p), pg.wait_for_timeout(900))
def foto(pg, nombre):
    if FOTOS: pathlib.Path(FOTOS).mkdir(parents=True, exist_ok=True); pg.screenshot(path=f"{FOTOS}/{nombre}.png", full_page=True)
COLA = "() => JSON.parse(localStorage.getItem('agro_cola_v8:localhost') || '[]').length"
def subio(pg, seg=40):
    for _ in range(seg * 2):
        pg.wait_for_timeout(500)
        if pg.evaluate(COLA) == 0: return True
    return False
limites = lambda pg: pg.evaluate("() => (window.__agroDatos.eventos || []).filter(e => e.tipo === 'limite_geo')")
def punto(pg, lat, lng):
    xy = pg.evaluate("([a, b]) => { const p = window.__agroMapa.latLngToContainerPoint([a, b]), r = window.__agroMapa.getContainer().getBoundingClientRect(); return [r.left + p.x, r.top + p.y]; }", [lat, lng])
    pg.mouse.click(xy[0], xy[1]); pg.wait_for_timeout(180)

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    def aparato(cuenta_):
        ctx = b.new_context(viewport={"width": 390, "height": 820}, timezone_id="America/Mexico_City", service_workers="block", device_scale_factor=2 if FOTOS else 1)
        def ruta(r):
            u = r.request.url
            if "localhost" in u: return r.continue_()
            if "leaflet" in u and u.endswith(".js"): return r.fulfill(path=str(DIST / "leaflet.js"), content_type="application/javascript")
            if "leaflet" in u and u.endswith(".css"): return r.fulfill(path=str(DIST / "leaflet.css"), content_type="text/css")
            return r.abort()
        ctx.route("**/*", ruta); ctx.route(N.NUBE + "/**", nube)
        pg = ctx.new_page(); pg.dialogos = []
        pg.on("pageerror", lambda e: errs.append(str(e) + " @ " + (e.stack or "")[:400])); pg.on("dialog", lambda d: (pg.dialogos.append(d.message), d.accept()))
        pg.clock.install(time=f"{HOY}T09:00:00-06:00"); pg.goto(URL); pg.wait_for_timeout(1500)
        pg.get_by_placeholder("Tu correo o tu PIN").fill(cuenta_["correo"]); pg.get_by_placeholder("Contraseña", exact=True).fill("contrasena-larga-1"); pg.get_by_role("button", name="Entrar").click()
        for _ in range(30):
            pg.wait_for_timeout(300)
            if pg.locator(".login-bg").count() == 0: break
        pg.wait_for_timeout(2500); return pg
    A = aparato(ADM); ir(A, "mapa"); tx = plano(A.locator(".mp-pagina").inner_text())
    caso("el mapa abre: 0 de 2 parcelas con límite, y no supone ninguna forma", "0 de 2 parcelas con límite" in tx, tx[:300])
    A.get_by_label("Parcelas sin límite").click(); A.wait_for_timeout(300); A.get_by_label("Trazar PARCELA UNO").click(); A.wait_for_timeout(500)
    A.evaluate("() => window.__agroMapa.setView([22.9005, -102.6995], 17, { animate: false })"); A.wait_for_timeout(400)
    for q in ((22.9, -102.7), (22.9, -102.699), (22.901, -102.699), (22.901, -102.7)): punto(A, *q)
    A.locator(".mp-herramientas .btn-accent").click(); A.wait_for_timeout(800); tx = plano(A.locator(".mp-pagina").inner_text()); foto(A, "01-limite")
    ev = limites(A); d = ev[0]["datos"] if ev else {}
    caso("el límite se guarda como evento, con su contorno y la superficie medida (~1.14 ha)", len(ev) == 1 and d.get("de") == {"tipo": "parcela", "id": "p1"} and 11250 < d.get("m2", 0) < 11500, d)
    caso("y la superficie capturada de la parcela NO cambia sola (sigue en 1 ha)", next(x for x in A.evaluate("() => window.__agroDatos.parcelas") if x["id"] == "p1")["hectareas"] == 1)
    caso("el mapa ya cuenta una parcela con límite", "1 de 2 parcelas con límite" in tx, tx[:300])
    caso("subió", subio(A))

    # ── Dron: las fotos se ubican solas por su GPS ──
    ir(A, "dron"); A.locator(".tab-pill", has_text="Subir vuelo").first.click(); A.wait_for_timeout(300)
    A.locator("input[type=file]").first.set_input_files([{"name": f"DJI_{i}.JPG", "mimeType": "image/jpeg", "buffer": jpeg(*ll)} for i, ll in enumerate(((22.9004, -102.6996), (22.9006, -102.6994), (None, None)))])
    A.wait_for_timeout(2500); tx = plano(A.locator("body").inner_text()); foto(A, "02-dron")
    caso("las dos fotos con GPS dentro del límite se ubican en la PARCELA UNO; la que no trae GPS no se adivina", "PARCELA UNO" in tx and ("sin GPS" in tx.lower() or "no trae" in tx.lower() or "¿De qué parcela es?" in tx), tx[:1500])
    A.get_by_role("button", name="Guardar el vuelo").click(); A.wait_for_timeout(800)
    vu = A.evaluate("() => window.__agroDatos.vuelos || []")
    caso("se guarda UN vuelo de la parcela uno con sus 2 fotos, y se dice que la otra no se guardó", len(vu) == 1 and vu[0]["parcelaId"] == "p1" and vu[0]["cuantas"] == 2 and any("NO se guardaron" in x for x in A.dialogos), ([(v.get("parcelaId"), v.get("cuantas")) for v in vu], A.dialogos[-1:]))
    caso("las fotos no van dentro del registro: quedan como archivos aparte", all(str(f.get("dataUrl", "")).startswith("archivo:") for v in vu for f in v.get("fotos", [])), [str(f.get("dataUrl"))[:20] for v in vu for f in v.get("fotos", [])])
    caso("subió", subio(A, 60))

    # ── Otro teléfono: el agrónomo ve, pero no traza ──
    G = aparato(AGR); ir(G, "mapa"); tx = plano(G.locator(".mp-pagina").inner_text())
    caso("en el teléfono del agrónomo el mapa ya trae el límite (1 de 2)", "1 de 2 parcelas con límite" in tx, tx[:300])
    G.get_by_label("Parcelas sin límite").click() if G.get_by_label("Parcelas sin límite").count() else None; G.wait_for_timeout(300)
    caso("y no puede trazar: lo ve, pero no lo cambia", G.get_by_label("Trazar PARCELA DOS").count() == 0, plano(G.locator(".mp-pagina").inner_text())[:400])
    caso("ninguna pantalla tronó", not errs, errs[:3])
    caso("la nube no rechazó ningún registro por identificador ocupado", not nube.ocupados, nube.ocupados[:3])
    b.close()
print(f"\n{sum(res)} de {len(res)}"); sys.exit(0 if all(res) else 1)
